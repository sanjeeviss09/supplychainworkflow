-- =============================================================================
-- SCM FLOW — PHASE 2: DATABASE, DATA MODEL & SECURE BACKEND MIGRATION
-- File: backend/supabase/migrations/20261103020000_phase2_core_backend_security.sql
-- Purpose:
--   1. Enforce strict 1:1 user-to-employee identity mapping & field constraints.
--   2. Establish database-backed permissions & role_permissions tables.
--   3. Create employee_import_batches and employee_import_rows for full import history.
--   4. Create app_settings table for authentication & access control governance.
--   5. Harden audit_logs with secret sanitization & append-only immutability triggers.
--   6. Centralize active-employee and role/permission resolution in PostgreSQL.
--   7. Replace permissive RLS policies with strict least-privilege, active-only policies.
--   8. Provide preview_employee_import & confirm_employee_import transactional RPCs.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. HARDEN USER-TO-EMPLOYEE IDENTITY MAPPING & CONSTRAINTS
-- =============================================================================

-- Ensure each authenticated user maps to at most ONE employee record (1:1 mapping)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_employees_user_id'
    ) THEN
        ALTER TABLE public.employees
            ADD CONSTRAINT uq_employees_user_id UNIQUE (user_id);
    END IF;
END $$;

-- Ensure employee_id and email are properly formatted and non-empty
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_employees_non_empty_fields'
    ) THEN
        ALTER TABLE public.employees
            ADD CONSTRAINT chk_employees_non_empty_fields CHECK (
                length(trim(employee_id)) > 0
                AND length(trim(full_name)) > 0
                AND position('@' in trim(email)) > 1
            );
    END IF;
END $$;

COMMENT ON TABLE public.employees IS 'Authoritative corporate employee list governing system access, active status, and role assignment.';
COMMENT ON COLUMN public.employees.employee_id IS 'Unique corporate Employee ID (e.g., EMP-1001).';
COMMENT ON COLUMN public.employees.user_id IS '1:1 link to auth.users(id) populated upon verified registration.';
COMMENT ON COLUMN public.employees.assigned_role IS 'Authoritative role assigned by administrator; never supplied by client.';
COMMENT ON COLUMN public.employees.is_active IS 'Authoritative active status; when false, all RLS and RPC access is immediately denied.';

-- =============================================================================
-- 2. ROLES & GRANULAR PERMISSIONS DATA MODEL
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.permissions (
    id VARCHAR(100) PRIMARY KEY,
    module VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.permissions IS 'Catalog of granular system capabilities enforced across backend RPCs, RLS, and UI.';

CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id VARCHAR(50) NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(100) NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_role_permission UNIQUE (role_id, permission_id)
);

COMMENT ON TABLE public.role_permissions IS 'Maps each enterprise role (super_admin, scm_admin, scm_team_user) to its granted permissions.';

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);

-- Seed authoritative permission catalog
INSERT INTO public.permissions (id, module, description) VALUES
    ('employees.read', 'administration', 'View employee access directory and status'),
    ('employees.write', 'administration', 'Create or update individual employee records'),
    ('employees.import', 'administration', 'Preview and confirm bulk employee CSV/Excel imports'),
    ('roles.assign', 'administration', 'Assign or modify employee roles and activate/deactivate access'),
    ('audit.read', 'security', 'Read immutable security and administrative audit logs'),
    ('settings.read', 'administration', 'Read application authentication and SCM configuration settings'),
    ('settings.manage', 'administration', 'Modify application authentication and system configuration settings'),
    ('scm.projects.read', 'projects', 'View SCM projects, milestones, and material requirements'),
    ('scm.projects.write', 'projects', 'Create and update SCM projects, milestones, and BOM items'),
    ('scm.workflows.manage', 'approvals', 'Configure departmental approval workflows and amount thresholds'),
    ('scm.requisitions.write', 'procurement', 'Draft and submit Purchase Requisitions (PR)'),
    ('scm.orders.authorize', 'procurement', 'Approve and issue official Purchase Orders (PO)'),
    ('scm.receiving.write', 'logistics', 'Record Goods Receipt Notes (GRN) and delivery schedules'),
    ('scm.invoices.verify', 'finance', 'Execute 3-way matching and verify supplier invoices')
ON CONFLICT (id) DO NOTHING;

-- Map permissions to super_admin (Full Governance)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'super_admin', id FROM public.permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Map permissions to scm_admin (SCM Governance & Operations, NO Super Admin elevation or employee import)
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_admin', 'employees.read'),
    ('scm_admin', 'settings.read'),
    ('scm_admin', 'scm.projects.read'),
    ('scm_admin', 'scm.projects.write'),
    ('scm_admin', 'scm.workflows.manage'),
    ('scm_admin', 'scm.requisitions.write'),
    ('scm_admin', 'scm.orders.authorize'),
    ('scm_admin', 'scm.receiving.write'),
    ('scm_admin', 'scm.invoices.verify')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Map permissions to scm_team_user (Assigned Operational Execution only)
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_team_user', 'settings.read'),
    ('scm_team_user', 'scm.projects.read'),
    ('scm_team_user', 'scm.projects.write'),
    ('scm_team_user', 'scm.requisitions.write'),
    ('scm_team_user', 'scm.receiving.write')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- =============================================================================
-- 3. EMPLOYEE IMPORT HISTORY & ROW-LEVEL RESULTS TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.employee_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(30) NOT NULL CHECK (lower(file_type) IN ('csv', 'xlsx', 'xls')),
    status VARCHAR(30) NOT NULL CHECK (status IN ('previewed', 'completed', 'failed')),
    total_rows INTEGER DEFAULT 0 NOT NULL CHECK (total_rows >= 0),
    accepted_rows INTEGER DEFAULT 0 NOT NULL CHECK (accepted_rows >= 0),
    skipped_rows INTEGER DEFAULT 0 NOT NULL CHECK (skipped_rows >= 0),
    rejected_rows INTEGER DEFAULT 0 NOT NULL CHECK (rejected_rows >= 0),
    imported_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    confirmed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.employee_import_batches IS 'Master log of every employee list import batch confirmed by an administrator.';

CREATE TABLE IF NOT EXISTS public.employee_import_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES public.employee_import_batches(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL CHECK (row_number > 0),
    employee_id VARCHAR(50),
    full_name VARCHAR(150),
    email VARCHAR(255),
    department VARCHAR(100),
    designation VARCHAR(100),
    assigned_role VARCHAR(50),
    outcome VARCHAR(30) NOT NULL CHECK (outcome IN ('accepted_insert', 'accepted_update', 'skipped', 'rejected')),
    error_message TEXT,
    employee_record_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_import_batch_row UNIQUE (batch_id, row_number)
);

COMMENT ON TABLE public.employee_import_rows IS 'Row-level validation and execution outcome for each row in an employee import batch.';

CREATE INDEX IF NOT EXISTS idx_import_batches_actor ON public.employee_import_batches(imported_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_rows_batch ON public.employee_import_rows(batch_id, row_number);
CREATE INDEX IF NOT EXISTS idx_import_rows_outcome ON public.employee_import_rows(batch_id, outcome);

-- =============================================================================
-- 4. APPLICATION SETTINGS FOR AUTHENTICATION & ACCESS CONTROL
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('authentication', 'access_control', 'scm_defaults')),
    description TEXT NOT NULL,
    is_public BOOLEAN DEFAULT false NOT NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.app_settings IS 'System-wide configuration settings for authentication, access control, and confirmed SCM defaults.';

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
    BEFORE UPDATE ON public.app_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.app_settings (key, value, category, description, is_public) VALUES
    ('auth.require_active_employee', 'true'::jsonb, 'authentication', 'Require an active employee record match for registration and login.', true),
    ('auth.enforce_temp_password_change', 'true'::jsonb, 'authentication', 'Force users with temporary credentials to change their password upon first login.', true),
    ('auth.session_timeout_minutes', '480'::jsonb, 'authentication', 'Maximum idle/active session duration in minutes before re-authentication is required.', true),
    ('access.allow_self_signup', 'true'::jsonb, 'access_control', 'Allow pre-enrolled active employees to self-register their account.', true),
    ('scm.default_currency', '"INR"'::jsonb, 'scm_defaults', 'Default base currency across all SCM modules (Indian Rupee ₹).', true),
    ('scm.default_timezone', '"Asia/Kolkata"'::jsonb, 'scm_defaults', 'Default timezone for scheduling, reminders, and audit timestamps.', true),
    ('scm.delivery_reminder_days', '3'::jsonb, 'scm_defaults', 'Default calendar days prior to promised delivery date to trigger proactive alerts.', true),
    ('scm.material_categories', '["API", "EXE", "PM", "Consumables"]'::jsonb, 'scm_defaults', 'Default authorized material classification categories.', true)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 5. AUDIT LOG HARDENING: SECRET SANITIZATION & APPEND-ONLY IMMUTABILITY
-- =============================================================================

ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS outcome VARCHAR(30) DEFAULT 'SUCCESS' NOT NULL,
    ADD COLUMN IF NOT EXISTS target_employee_id VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

-- Helper to strip any sensitive fields before storing in audit_logs
CREATE OR REPLACE FUNCTION public.sanitize_audit_jsonb(p_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_data IS NULL OR jsonb_typeof(p_data) != 'object' THEN
        RETURN p_data;
    END IF;

    RETURN p_data
        - 'password'
        - 'new_password'
        - 'old_password'
        - 'encrypted_password'
        - 'token'
        - 'access_token'
        - 'refresh_token'
        - 'recovery_token'
        - 'confirmation_token'
        - 'secret'
        - 'service_role_key'
        - 'anon_key'
        - 'api_key';
END;
$$;

-- Trigger to sanitize audit payloads on INSERT
CREATE OR REPLACE FUNCTION public.trg_fn_sanitize_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.old_values := public.sanitize_audit_jsonb(NEW.old_values);
    NEW.new_values := public.sanitize_audit_jsonb(NEW.new_values);
    IF NEW.outcome IS NULL OR trim(NEW.outcome) = '' THEN
        NEW.outcome := 'SUCCESS';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sanitize_audit_log ON public.audit_logs;
CREATE TRIGGER trg_sanitize_audit_log
    BEFORE INSERT ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_sanitize_audit_log();

-- Trigger to enforce append-only immutability on audit_logs (blocks UPDATE and DELETE)
CREATE OR REPLACE FUNCTION public.trg_fn_immutable_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Security Violation: audit_logs is an append-only immutable ledger. % operations are strictly prohibited.', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_audit_log ON public.audit_logs;
CREATE TRIGGER trg_immutable_audit_log
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_immutable_audit_log();

-- Centralized Server-Side Audit Writer
CREATE OR REPLACE FUNCTION public.write_security_audit_event(
    p_table_name VARCHAR,
    p_record_id UUID,
    p_action VARCHAR,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_target_employee_id VARCHAR DEFAULT NULL,
    p_outcome VARCHAR DEFAULT 'SUCCESS'
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id BIGINT;
BEGIN
    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        action,
        old_values,
        new_values,
        changed_by,
        target_employee_id,
        outcome,
        created_at
    ) VALUES (
        p_table_name,
        coalesce(p_record_id, gen_random_uuid()),
        p_action,
        public.sanitize_audit_jsonb(p_old_values),
        public.sanitize_audit_jsonb(p_new_values),
        auth.uid(),
        p_target_employee_id,
        coalesce(p_outcome, 'SUCCESS'),
        now()
    ) RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

-- =============================================================================
-- 6. CENTRALIZED AUTHORIZATION & ACTIVE EMPLOYEE RESOLUTION FUNCTIONS
-- =============================================================================

-- Check if a specific user UUID is linked to an active employee and active profile
CREATE OR REPLACE FUNCTION public.check_employee_active(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.employees e
        LEFT JOIN public.profiles p ON p.id = e.user_id
        WHERE e.user_id = coalesce(p_user_id, auth.uid())
          AND e.is_active = true
          AND coalesce(p.is_active, true) = true
    );
$$;

-- Parameterless helper for RLS policies: is the current session an active employee?
CREATE OR REPLACE FUNCTION public.current_user_is_active_employee()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT CASE
        WHEN auth.uid() IS NULL THEN false
        ELSE public.check_employee_active(auth.uid())
    END;
$$;

-- Authoritative role resolution from linked active employee record
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS VARCHAR
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT e.assigned_role
    FROM public.employees e
    WHERE e.user_id = auth.uid()
      AND e.is_active = true
    LIMIT 1;
$$;

-- Authoritative role check: requires active employee status AND matching assigned_role
DROP FUNCTION IF EXISTS public.current_user_has_role(character varying) CASCADE;
DROP FUNCTION IF EXISTS public.current_user_has_role(varchar) CASCADE;
DROP FUNCTION IF EXISTS public.current_user_has_role(text) CASCADE;
DROP FUNCTION IF EXISTS public.current_user_has_role CASCADE;

CREATE OR REPLACE FUNCTION public.current_user_has_role(required_role VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.employees e
        WHERE e.user_id = auth.uid()
          AND e.is_active = true
          AND e.assigned_role = required_role
    );
$$;

-- Authoritative permission check: verifies active employee status AND granted role permission
DROP FUNCTION IF EXISTS public.current_user_has_permission(character varying) CASCADE;
DROP FUNCTION IF EXISTS public.current_user_has_permission(varchar) CASCADE;
DROP FUNCTION IF EXISTS public.current_user_has_permission(text) CASCADE;
DROP FUNCTION IF EXISTS public.current_user_has_permission CASCADE;

CREATE OR REPLACE FUNCTION public.current_user_has_permission(required_permission VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.employees e
        JOIN public.role_permissions rp ON rp.role_id = e.assigned_role
        WHERE e.user_id = auth.uid()
          AND e.is_active = true
          AND rp.permission_id = required_permission
    );
$$;

-- Resolve effective role and full permission list for a user
CREATE OR REPLACE FUNCTION public.get_user_role_and_permissions(p_user_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_uid UUID := coalesce(p_user_id, auth.uid());
    v_emp public.employees%ROWTYPE;
    v_permissions JSONB;
BEGIN
    IF v_target_uid IS NULL THEN
        RETURN jsonb_build_object(
            'authenticated', false,
            'is_active', false,
            'role', null,
            'permissions', '[]'::jsonb
        );
    END IF;

    -- Non-super-admins can only query their own role and permissions
    IF v_target_uid != auth.uid() AND NOT public.current_user_has_role('super_admin') THEN
        RAISE EXCEPTION 'Access denied: Cannot inspect another user''s permissions.';
    END IF;

    SELECT * INTO v_emp
    FROM public.employees
    WHERE user_id = v_target_uid
    LIMIT 1;

    IF NOT FOUND OR v_emp.is_active = false THEN
        RETURN jsonb_build_object(
            'authenticated', true,
            'is_active', false,
            'role', null,
            'permissions', '[]'::jsonb
        );
    END IF;

    SELECT coalesce(jsonb_agg(rp.permission_id ORDER BY rp.permission_id), '[]'::jsonb)
    INTO v_permissions
    FROM public.role_permissions rp
    WHERE rp.role_id = v_emp.assigned_role;

    RETURN jsonb_build_object(
        'authenticated', true,
        'is_active', v_emp.is_active,
        'employee_id', v_emp.employee_id,
        'role', v_emp.assigned_role,
        'must_change_password', v_emp.must_change_password,
        'permissions', v_permissions
    );
END;
$$;

-- Load current authenticated user, linked employee record, profile, role, and permissions
CREATE OR REPLACE FUNCTION public.get_current_user_context()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_emp public.employees%ROWTYPE;
    v_prof public.profiles%ROWTYPE;
    v_permissions JSONB := '[]'::jsonb;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('authenticated', false);
    END IF;

    -- Match by user_id first, or fallback to email if not yet linked
    SELECT * INTO v_emp
    FROM public.employees
    WHERE user_id = v_uid
    LIMIT 1;

    SELECT * INTO v_prof
    FROM public.profiles
    WHERE id = v_uid
    LIMIT 1;

    IF v_emp.id IS NULL THEN
        RETURN jsonb_build_object(
            'authenticated', true,
            'user_id', v_uid,
            'employee_linked', false,
            'is_active', false,
            'error', 'No employee record is linked to this account. Please contact your SCM Administrator.'
        );
    END IF;

    IF v_emp.is_active = false THEN
        RETURN jsonb_build_object(
            'authenticated', true,
            'user_id', v_uid,
            'employee_linked', true,
            'is_active', false,
            'employee', to_jsonb(v_emp),
            'error', 'Your employee record is inactive. Access to SCM Flow has been revoked.'
        );
    END IF;

    SELECT coalesce(jsonb_agg(rp.permission_id ORDER BY rp.permission_id), '[]'::jsonb)
    INTO v_permissions
    FROM public.role_permissions rp
    WHERE rp.role_id = v_emp.assigned_role;

    RETURN jsonb_build_object(
        'authenticated', true,
        'user_id', v_uid,
        'employee_linked', true,
        'is_active', true,
        'role', v_emp.assigned_role,
        'must_change_password', v_emp.must_change_password,
        'permissions', v_permissions,
        'employee', to_jsonb(v_emp),
        'profile', CASE WHEN v_prof.id IS NOT NULL THEN to_jsonb(v_prof) ELSE NULL END
    );
END;
$$;

-- =============================================================================
-- 7. PRIVILEGE ESCALATION GUARD & TRUSTED ADMIN RPC FUNCTIONS
-- =============================================================================

-- Guard trigger on public.employees: Prevent any non-super-admin from changing roles or active status
CREATE OR REPLACE FUNCTION public.trg_fn_guard_employee_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Allow system/migration context (when auth.uid() is null and current_user is postgres/supabase_admin)
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- If sensitive security columns are modified, caller MUST be an active super_admin
    IF (
        OLD.assigned_role IS DISTINCT FROM NEW.assigned_role
        OR OLD.is_active IS DISTINCT FROM NEW.is_active
        OR OLD.employee_id IS DISTINCT FROM NEW.employee_id
        OR lower(OLD.email) IS DISTINCT FROM lower(NEW.email)
    ) THEN
        IF NOT public.current_user_has_role('super_admin') THEN
            RAISE EXCEPTION 'Security Violation: Only an active Super Admin can modify employee roles, identifiers, or active status.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_employee_security_fields ON public.employees;
CREATE TRIGGER trg_guard_employee_security_fields
    BEFORE UPDATE ON public.employees
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_guard_employee_security_fields();

-- Trusted Admin RPC: Create or Update an Employee Record
CREATE OR REPLACE FUNCTION public.admin_upsert_employee(
    p_id UUID DEFAULT NULL,
    p_employee_id VARCHAR DEFAULT NULL,
    p_full_name VARCHAR DEFAULT NULL,
    p_email VARCHAR DEFAULT NULL,
    p_department VARCHAR DEFAULT NULL,
    p_designation VARCHAR DEFAULT NULL,
    p_assigned_role VARCHAR DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_emp public.employees%ROWTYPE;
    v_clean_emp_id VARCHAR(50) := upper(trim(coalesce(p_employee_id, '')));
    v_clean_email VARCHAR(255) := lower(trim(coalesce(p_email, '')));
    v_clean_name VARCHAR(150) := trim(coalesce(p_full_name, ''));
    v_clean_dept VARCHAR(100) := trim(coalesce(p_department, ''));
    v_clean_desig VARCHAR(100) := trim(coalesce(p_designation, ''));
    v_clean_role VARCHAR(50) := lower(trim(coalesce(p_assigned_role, '')));
BEGIN
    -- Verify caller has Super Admin role
    IF NOT public.current_user_has_role('super_admin') THEN
        RAISE EXCEPTION 'Access denied: Only an active Super Admin can create or modify employee records.';
    END IF;

    -- Validate role explicitly (never silently default!)
    IF v_clean_role NOT IN ('super_admin', 'scm_admin', 'scm_team_user') THEN
        RAISE EXCEPTION 'Validation failed: Role must be explicitly set to super_admin, scm_admin, or scm_team_user.';
    END IF;

    IF v_clean_name = '' THEN
        RAISE EXCEPTION 'Validation failed: Full name is required.';
    END IF;

    IF p_id IS NULL THEN
        -- Creating a new employee record
        IF v_clean_emp_id = '' THEN
            RAISE EXCEPTION 'Validation failed: Employee ID is required.';
        END IF;

        IF v_clean_email = '' OR position('@' in v_clean_email) <= 1 THEN
            RAISE EXCEPTION 'Validation failed: A valid work email address is required.';
        END IF;

        IF EXISTS (SELECT 1 FROM public.employees WHERE lower(employee_id) = lower(v_clean_emp_id)) THEN
            RAISE EXCEPTION 'Duplicate record: Employee ID % already exists.', v_clean_emp_id;
        END IF;

        IF EXISTS (SELECT 1 FROM public.employees WHERE lower(email) = v_clean_email) THEN
            RAISE EXCEPTION 'Duplicate record: Work email % is already assigned to another employee.', v_clean_email;
        END IF;

        INSERT INTO public.employees (
            employee_id, full_name, email, department, designation, assigned_role, is_active, must_change_password
        ) VALUES (
            v_clean_emp_id,
            v_clean_name,
            v_clean_email,
            CASE WHEN v_clean_dept = '' THEN 'General' ELSE v_clean_dept END,
            CASE WHEN v_clean_desig = '' THEN 'Staff' ELSE v_clean_desig END,
            v_clean_role,
            coalesce(p_is_active, true),
            true
        ) RETURNING * INTO v_emp;

        PERFORM public.write_security_audit_event(
            'employees',
            v_emp.id,
            'EMPLOYEE_CREATED',
            NULL,
            to_jsonb(v_emp),
            v_emp.employee_id,
            'SUCCESS'
        );
    ELSE
        -- Updating an existing employee record
        SELECT * INTO v_emp FROM public.employees WHERE id = p_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Employee record not found.';
        END IF;

        UPDATE public.employees
        SET full_name = v_clean_name,
            department = CASE WHEN v_clean_dept = '' THEN department ELSE v_clean_dept END,
            designation = CASE WHEN v_clean_desig = '' THEN designation ELSE v_clean_desig END,
            assigned_role = v_clean_role,
            is_active = coalesce(p_is_active, is_active),
            updated_at = now()
        WHERE id = p_id
        RETURNING * INTO v_emp;

        PERFORM public.write_security_audit_event(
            'employees',
            v_emp.id,
            'EMPLOYEE_UPDATED',
            NULL,
            to_jsonb(v_emp),
            v_emp.employee_id,
            'SUCCESS'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'employee', to_jsonb(v_emp)
    );
END;
$$;

-- Trusted Admin RPC: Update Application Setting with Audit Trail
CREATE OR REPLACE FUNCTION public.admin_update_app_setting(
    p_key VARCHAR,
    p_value JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old public.app_settings%ROWTYPE;
    v_new public.app_settings%ROWTYPE;
BEGIN
    IF NOT public.current_user_has_role('super_admin') THEN
        RAISE EXCEPTION 'Access denied: Only Super Admin can update application settings.';
    END IF;

    SELECT * INTO v_old FROM public.app_settings WHERE key = p_key FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Setting key "%" does not exist.', p_key;
    END IF;

    UPDATE public.app_settings
    SET value = p_value,
        updated_by = auth.uid(),
        updated_at = now()
    WHERE key = p_key
    RETURNING * INTO v_new;

    PERFORM public.write_security_audit_event(
        'app_settings',
        gen_random_uuid(),
        'SETTING_UPDATED',
        jsonb_build_object('key', v_old.key, 'value', v_old.value),
        jsonb_build_object('key', v_new.key, 'value', v_new.value),
        NULL,
        'SUCCESS'
    );

    RETURN jsonb_build_object('success', true, 'setting', to_jsonb(v_new));
END;
$$;

-- =============================================================================
-- 8. EMPLOYEE IMPORT BACKEND: SERVER-SIDE PREVIEW & TRANSACTIONAL CONFIRM
-- =============================================================================

-- Core validation helper used by both preview_employee_import and confirm_employee_import
CREATE OR REPLACE FUNCTION public.validate_employee_import_payload(
    p_file_name TEXT,
    p_file_type TEXT,
    p_records JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_type TEXT := lower(trim(coalesce(p_file_type, '')));
    v_item JSONB;
    v_idx INTEGER := 0;
    v_emp_id VARCHAR(50);
    v_name VARCHAR(150);
    v_email VARCHAR(255);
    v_dept VARCHAR(100);
    v_desig VARCHAR(100);
    v_role VARCHAR(50);
    v_seen_emp_ids TEXT[] := ARRAY[]::TEXT[];
    v_seen_emails TEXT[] := ARRAY[]::TEXT[];
    v_existing_by_id public.employees%ROWTYPE;
    v_existing_by_email public.employees%ROWTYPE;
    v_outcome VARCHAR(30);
    v_error TEXT;
    v_rows JSONB := '[]'::jsonb;
    v_accepted INTEGER := 0;
    v_skipped INTEGER := 0;
    v_rejected INTEGER := 0;
BEGIN
    -- 1. Validate caller authorization
    IF NOT public.current_user_has_role('super_admin') THEN
        RAISE EXCEPTION 'Access denied: Only an active Super Admin can validate or import employee lists.';
    END IF;

    -- 2. Validate file metadata
    IF trim(coalesce(p_file_name, '')) = '' THEN
        RAISE EXCEPTION 'Validation failed: File name is required.';
    END IF;

    IF v_clean_type NOT IN ('csv', 'xlsx', 'xls') THEN
        RAISE EXCEPTION 'Validation failed: Unsupported file type "%". Only CSV and Excel (XLSX/XLS) are permitted.', p_file_type;
    END IF;

    IF p_records IS NULL OR jsonb_typeof(p_records) != 'array' OR jsonb_array_length(p_records) = 0 THEN
        RAISE EXCEPTION 'Validation failed: The import payload contains no rows.';
    END IF;

    -- 3. Validate each row without silently defaulting missing or invalid roles
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_records) LOOP
        v_idx := v_idx + 1;
        v_emp_id := upper(trim(coalesce(v_item->>'employee_id', '')));
        v_name := trim(coalesce(v_item->>'full_name', ''));
        v_email := lower(trim(coalesce(v_item->>'email', '')));
        v_dept := trim(coalesce(v_item->>'department', ''));
        v_desig := trim(coalesce(v_item->>'designation', ''));
        v_role := lower(trim(coalesce(v_item->>'assigned_role', '')));

        v_outcome := NULL;
        v_error := NULL;

        -- Required field checks
        IF v_emp_id = '' THEN
            v_outcome := 'rejected';
            v_error := 'Missing required field: employee_id';
        ELSIF v_name = '' THEN
            v_outcome := 'rejected';
            v_error := 'Missing required field: full_name';
        ELSIF v_email = '' OR position('@' in v_email) <= 1 OR position('.' in substring(v_email from position('@' in v_email))) = 0 THEN
            v_outcome := 'rejected';
            v_error := 'Invalid or missing work email address';
        ELSIF v_dept = '' THEN
            v_outcome := 'rejected';
            v_error := 'Missing required field: department';
        ELSIF v_desig = '' THEN
            v_outcome := 'rejected';
            v_error := 'Missing required field: designation';
        ELSIF v_role = '' THEN
            -- Strict compliance: Never silently assign a default role!
            v_outcome := 'rejected';
            v_error := 'Missing required field: assigned_role (must not be blank)';
        ELSIF v_role NOT IN ('super_admin', 'scm_admin', 'scm_team_user') THEN
            v_outcome := 'rejected';
            v_error := format('Invalid role "%s": must be super_admin, scm_admin, or scm_team_user', v_role);
        ELSIF v_emp_id = ANY(v_seen_emp_ids) THEN
            v_outcome := 'rejected';
            v_error := format('Duplicate Employee ID "%s" within the uploaded file', v_emp_id);
        ELSIF v_email = ANY(v_seen_emails) THEN
            v_outcome := 'rejected';
            v_error := format('Duplicate Work Email "%s" within the uploaded file', v_email);
        END IF;

        -- Track seen identifiers within file
        IF v_emp_id != '' THEN
            v_seen_emp_ids := array_append(v_seen_emp_ids, v_emp_id);
        END IF;
        IF v_email != '' THEN
            v_seen_emails := array_append(v_seen_emails, v_email);
        END IF;

        -- Database conflict & unchanged-row detection if row passed basic validation
        IF v_outcome IS NULL THEN
            SELECT * INTO v_existing_by_id FROM public.employees WHERE lower(employee_id) = lower(v_emp_id) LIMIT 1;
            SELECT * INTO v_existing_by_email FROM public.employees WHERE lower(email) = v_email LIMIT 1;

            IF v_existing_by_id.id IS NOT NULL AND v_existing_by_email.id IS NOT NULL AND v_existing_by_id.id != v_existing_by_email.id THEN
                v_outcome := 'rejected';
                v_error := format(
                    'Database conflict: Employee ID %s and email %s belong to two different existing employee records',
                    v_emp_id, v_email
                );
            ELSIF v_existing_by_id.id IS NOT NULL OR v_existing_by_email.id IS NOT NULL THEN
                -- Determine whether record is identical (skipped) or modified (accepted_update)
                DECLARE
                    v_existing public.employees%ROWTYPE := coalesce(v_existing_by_id, v_existing_by_email);
                BEGIN
                    IF lower(v_existing.employee_id) = lower(v_emp_id)
                       AND lower(v_existing.email) = v_email
                       AND v_existing.full_name = v_name
                       AND v_existing.department = v_dept
                       AND v_existing.designation = v_desig
                       AND v_existing.assigned_role = v_role
                    THEN
                        v_outcome := 'skipped';
                        v_error := 'Record already exists with identical values (no changes needed)';
                    ELSE
                        v_outcome := 'accepted_update';
                    END IF;
                END;
            ELSE
                v_outcome := 'accepted_insert';
            END IF;
        END IF;

        IF v_outcome IN ('accepted_insert', 'accepted_update') THEN
            v_accepted := v_accepted + 1;
        ELSIF v_outcome = 'skipped' THEN
            v_skipped := v_skipped + 1;
        ELSE
            v_rejected := v_rejected + 1;
        END IF;

        v_rows := v_rows || jsonb_build_object(
            'row_number', v_idx,
            'employee_id', v_emp_id,
            'full_name', v_name,
            'email', v_email,
            'department', v_dept,
            'designation', v_desig,
            'assigned_role', v_role,
            'outcome', v_outcome,
            'is_valid', v_outcome IN ('accepted_insert', 'accepted_update'),
            'error', v_error
        );
    END LOOP;

    RETURN jsonb_build_object(
        'file_name', p_file_name,
        'file_type', v_clean_type,
        'total_rows', v_idx,
        'accepted_rows', v_accepted,
        'skipped_rows', v_skipped,
        'rejected_rows', v_rejected,
        'rows', v_rows
    );
END;
$$;

-- Step 1 RPC: Server-side validation preview (read-only, does not commit changes)
CREATE OR REPLACE FUNCTION public.preview_employee_import(
    p_file_name TEXT,
    p_file_type TEXT,
    p_records JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.validate_employee_import_payload(p_file_name, p_file_type, p_records);
END;
$$;

-- Step 2 RPC: Confirmed transactional import (persists batch, row outcomes, employees, and audit log)
CREATE OR REPLACE FUNCTION public.confirm_employee_import(
    p_file_name TEXT,
    p_file_type TEXT,
    p_records JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_validation JSONB;
    v_batch_id UUID;
    v_row JSONB;
    v_emp_record_id UUID;
    v_inserted INTEGER := 0;
    v_updated INTEGER := 0;
    v_skipped INTEGER := 0;
    v_rejected INTEGER := 0;
BEGIN
    IF NOT public.current_user_has_role('super_admin') THEN
        RAISE EXCEPTION 'Access denied: Only an active Super Admin can confirm employee imports.';
    END IF;

    -- Re-validate on server inside the transaction
    v_validation := public.validate_employee_import_payload(p_file_name, p_file_type, p_records);

    -- Create import batch header
    INSERT INTO public.employee_import_batches (
        file_name,
        file_type,
        status,
        total_rows,
        accepted_rows,
        skipped_rows,
        rejected_rows,
        imported_by,
        confirmed_at
    ) VALUES (
        v_validation->>'file_name',
        v_validation->>'file_type',
        'completed',
        (v_validation->>'total_rows')::INTEGER,
        (v_validation->>'accepted_rows')::INTEGER,
        (v_validation->>'skipped_rows')::INTEGER,
        (v_validation->>'rejected_rows')::INTEGER,
        v_actor,
        now()
    ) RETURNING id INTO v_batch_id;

    -- Process each validated row and record row-level result
    FOR v_row IN SELECT * FROM jsonb_array_elements(v_validation->'rows') LOOP
        v_emp_record_id := NULL;

        IF (v_row->>'outcome') = 'accepted_insert' THEN
            INSERT INTO public.employees (
                employee_id,
                full_name,
                email,
                department,
                designation,
                assigned_role,
                is_active,
                must_change_password
            ) VALUES (
                v_row->>'employee_id',
                v_row->>'full_name',
                v_row->>'email',
                v_row->>'department',
                v_row->>'designation',
                v_row->>'assigned_role',
                true,
                false
            ) RETURNING id INTO v_emp_record_id;

            v_inserted := v_inserted + 1;

        ELSIF (v_row->>'outcome') = 'accepted_update' THEN
            UPDATE public.employees
            SET full_name = v_row->>'full_name',
                email = v_row->>'email',
                department = v_row->>'department',
                designation = v_row->>'designation',
                assigned_role = v_row->>'assigned_role',
                updated_at = now()
            WHERE lower(employee_id) = lower(v_row->>'employee_id')
               OR lower(email) = lower(v_row->>'email')
            RETURNING id INTO v_emp_record_id;

            v_updated := v_updated + 1;

        ELSIF (v_row->>'outcome') = 'skipped' THEN
            SELECT id INTO v_emp_record_id
            FROM public.employees
            WHERE lower(employee_id) = lower(v_row->>'employee_id')
            LIMIT 1;

            v_skipped := v_skipped + 1;
        ELSE
            v_rejected := v_rejected + 1;
        END IF;

        -- Insert row-level audit record into employee_import_rows
        INSERT INTO public.employee_import_rows (
            batch_id,
            row_number,
            employee_id,
            full_name,
            email,
            department,
            designation,
            assigned_role,
            outcome,
            error_message,
            employee_record_id
        ) VALUES (
            v_batch_id,
            (v_row->>'row_number')::INTEGER,
            v_row->>'employee_id',
            v_row->>'full_name',
            v_row->>'email',
            v_row->>'department',
            v_row->>'designation',
            v_row->>'assigned_role',
            v_row->>'outcome',
            v_row->>'error',
            v_emp_record_id
        );
    END LOOP;

    -- Record security audit event
    PERFORM public.write_security_audit_event(
        'employee_import_batches',
        v_batch_id,
        'EMPLOYEE_LIST_IMPORTED',
        NULL,
        jsonb_build_object(
            'batch_id', v_batch_id,
            'file_name', v_validation->>'file_name',
            'file_type', v_validation->>'file_type',
            'total_rows', (v_validation->>'total_rows')::INTEGER,
            'inserted', v_inserted,
            'updated', v_updated,
            'skipped', v_skipped,
            'rejected', v_rejected
        ),
        NULL,
        'SUCCESS'
    );

    RETURN jsonb_build_object(
        'success', true,
        'batch_id', v_batch_id,
        'total', (v_validation->>'total_rows')::INTEGER,
        'accepted', v_inserted + v_updated,
        'inserted', v_inserted,
        'updated', v_updated,
        'skipped', v_skipped,
        'failed', v_rejected,
        'rows', v_validation->'rows'
    );
END;
$$;

-- Backward-compatible wrapper for import_employees_bulk calling confirm_employee_import
CREATE OR REPLACE FUNCTION public.import_employees_bulk(p_records JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.confirm_employee_import('uploaded_employees.csv', 'csv', p_records);
END;
$$;

-- =============================================================================
-- 9. LEAST-PRIVILEGE ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 9.1 Tighten public.employees RLS (Fix self-update privilege escalation & restrict directory read)
DROP POLICY IF EXISTS "Allow authenticated read on employees" ON public.employees;
DROP POLICY IF EXISTS "Users update own password flag" ON public.employees;
DROP POLICY IF EXISTS "Super Admin manage employees" ON public.employees;
DROP POLICY IF EXISTS "Active employee read own or admin read all" ON public.employees;

-- Only active Super Admin or SCM Admin can view the full directory; active Team Users can only read their own record
CREATE POLICY "Active employee read own or admin read all"
    ON public.employees FOR SELECT TO authenticated
    USING (
        public.current_user_is_active_employee()
        AND (
            user_id = auth.uid()
            OR public.current_user_has_role('super_admin')
            OR public.current_user_has_role('scm_admin')
        )
    );

-- Only active Super Admin can insert, update, or delete employee records
CREATE POLICY "Super Admin manage employees"
    ON public.employees FOR ALL TO authenticated
    USING (public.current_user_has_role('super_admin'))
    WITH CHECK (public.current_user_has_role('super_admin'));

-- 9.2 Tighten public.profiles & public.user_roles RLS (Active employees only)
DROP POLICY IF EXISTS "Allow authenticated read on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated read on user_roles" ON public.user_roles;

CREATE POLICY "Active employees read profiles"
    ON public.profiles FOR SELECT TO authenticated
    USING (
        id = auth.uid()
        OR public.current_user_is_active_employee()
    );

CREATE POLICY "Active users update own non-privileged profile"
    ON public.profiles FOR UPDATE TO authenticated
    USING (id = auth.uid() AND public.current_user_is_active_employee())
    WITH CHECK (id = auth.uid() AND public.current_user_is_active_employee() AND is_active = true);

CREATE POLICY "Active users read own role or admin read all"
    ON public.user_roles FOR SELECT TO authenticated
    USING (
        public.current_user_is_active_employee()
        AND (
            user_id = auth.uid()
            OR public.current_user_has_role('super_admin')
            OR public.current_user_has_role('scm_admin')
        )
    );

-- 9.3 Permissions & Role Permissions RLS
DROP POLICY IF EXISTS "Active employees read permissions" ON public.permissions;
CREATE POLICY "Active employees read permissions"
    ON public.permissions FOR SELECT TO authenticated
    USING (public.current_user_is_active_employee());

DROP POLICY IF EXISTS "Super Admin manage permissions" ON public.permissions;
CREATE POLICY "Super Admin manage permissions"
    ON public.permissions FOR ALL TO authenticated
    USING (public.current_user_has_role('super_admin'))
    WITH CHECK (public.current_user_has_role('super_admin'));

DROP POLICY IF EXISTS "Active employees read role_permissions" ON public.role_permissions;
CREATE POLICY "Active employees read role_permissions"
    ON public.role_permissions FOR SELECT TO authenticated
    USING (public.current_user_is_active_employee());

DROP POLICY IF EXISTS "Super Admin manage role_permissions" ON public.role_permissions;
CREATE POLICY "Super Admin manage role_permissions"
    ON public.role_permissions FOR ALL TO authenticated
    USING (public.current_user_has_role('super_admin'))
    WITH CHECK (public.current_user_has_role('super_admin'));

-- 9.4 Employee Import Batches & Rows RLS (Super Admin only)
DROP POLICY IF EXISTS "Super Admin manage import batches" ON public.employee_import_batches;
CREATE POLICY "Super Admin manage import batches"
    ON public.employee_import_batches FOR ALL TO authenticated
    USING (public.current_user_has_role('super_admin'))
    WITH CHECK (public.current_user_has_role('super_admin'));

DROP POLICY IF EXISTS "Super Admin manage import rows" ON public.employee_import_rows;
CREATE POLICY "Super Admin manage import rows"
    ON public.employee_import_rows FOR ALL TO authenticated
    USING (public.current_user_has_role('super_admin'))
    WITH CHECK (public.current_user_has_role('super_admin'));

-- 9.5 Application Settings RLS
DROP POLICY IF EXISTS "Active employees read public settings" ON public.app_settings;
CREATE POLICY "Active employees read public settings"
    ON public.app_settings FOR SELECT TO authenticated
    USING (
        public.current_user_is_active_employee()
        AND (is_public = true OR public.current_user_has_role('super_admin'))
    );

DROP POLICY IF EXISTS "Super Admin manage app settings" ON public.app_settings;
CREATE POLICY "Super Admin manage app settings"
    ON public.app_settings FOR ALL TO authenticated
    USING (public.current_user_has_role('super_admin'))
    WITH CHECK (public.current_user_has_role('super_admin'));

-- 9.6 Audit Logs RLS (Read-only for active Super Admin; no client UPDATE/DELETE policies)
DROP POLICY IF EXISTS "Super Admin read on audit_logs" ON public.audit_logs;
CREATE POLICY "Super Admin read on audit_logs"
    ON public.audit_logs FOR SELECT TO authenticated
    USING (public.current_user_has_role('super_admin'));

COMMIT;

