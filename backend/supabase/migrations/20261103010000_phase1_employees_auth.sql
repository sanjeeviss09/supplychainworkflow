-- =============================================================================
-- SCM FLOW — PHASE 1: EMPLOYEE ACCESS CONTROL & AUTHENTICATION MIGRATION
-- File: backend/supabase/migrations/20261103010000_phase1_employees_auth.sql
-- =============================================================================

BEGIN;

-- 1. Create employees table as authoritative source of access and roles
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    department VARCHAR(100) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    assigned_role VARCHAR(50) NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    must_change_password BOOLEAN DEFAULT false NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Performance and lookup indexes
CREATE INDEX IF NOT EXISTS idx_employees_email_lower ON public.employees(lower(email));
CREATE INDEX IF NOT EXISTS idx_employees_emp_id_lower ON public.employees(lower(employee_id));
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_role ON public.employees(assigned_role);

-- Enable updated_at trigger
DROP TRIGGER IF EXISTS trg_employees_updated_at ON public.employees;
CREATE TRIGGER trg_employees_updated_at 
    BEFORE UPDATE ON public.employees 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. Audit and Synchronization Trigger on Employee Changes
CREATE OR REPLACE FUNCTION public.handle_employee_update_sync()
RETURNS TRIGGER AS $$
DECLARE
    v_actor UUID := auth.uid();
BEGIN
    -- If role was modified and user is already linked, synchronize user_roles immediately
    IF (OLD.assigned_role IS DISTINCT FROM NEW.assigned_role AND NEW.user_id IS NOT NULL) THEN
        UPDATE public.user_roles 
        SET role_id = NEW.assigned_role,
            assigned_by = v_actor
        WHERE user_id = NEW.user_id;

        -- If no user_role record existed for some reason, insert it
        IF NOT FOUND THEN
            INSERT INTO public.user_roles (user_id, role_id, assigned_by)
            VALUES (NEW.user_id, NEW.assigned_role, v_actor)
            ON CONFLICT (user_id, role_id) DO NOTHING;
        END IF;

        -- Log security audit
        INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, changed_by, created_at)
        VALUES (
            'employees',
            NEW.id,
            'ROLE_CHANGED',
            jsonb_build_object('role', OLD.assigned_role, 'employee_id', OLD.employee_id),
            jsonb_build_object('role', NEW.assigned_role, 'employee_id', NEW.employee_id),
            v_actor,
            now()
        );
    END IF;

    -- If active status was changed, synchronize profiles.is_active immediately
    IF (OLD.is_active IS DISTINCT FROM NEW.is_active AND NEW.user_id IS NOT NULL) THEN
        UPDATE public.profiles 
        SET is_active = NEW.is_active
        WHERE id = NEW.user_id;

        -- Log security audit
        INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, changed_by, created_at)
        VALUES (
            'employees',
            NEW.id,
            CASE WHEN NEW.is_active THEN 'EMPLOYEE_ACTIVATED' ELSE 'EMPLOYEE_DEACTIVATED' END,
            jsonb_build_object('is_active', OLD.is_active, 'employee_id', OLD.employee_id),
            jsonb_build_object('is_active', NEW.is_active, 'employee_id', NEW.employee_id),
            v_actor,
            now()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_employee_update_sync ON public.employees;
CREATE TRIGGER trg_employee_update_sync 
    AFTER UPDATE ON public.employees 
    FOR EACH ROW EXECUTE FUNCTION public.handle_employee_update_sync();

-- 3. Server-Side Signup Validation Trigger on auth.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_emp public.employees%ROWTYPE;
    v_first_name VARCHAR(100);
    v_last_name VARCHAR(100);
    v_dept_id UUID;
    v_space_idx INTEGER;
BEGIN
    -- Look up employee matching email (case-insensitive, trimmed)
    SELECT * INTO v_emp 
    FROM public.employees 
    WHERE lower(trim(email)) = lower(trim(NEW.email))
    LIMIT 1;

    -- Strict server-side enforcement: Deny access if missing or inactive
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration denied: No employee record found matching work email %', NEW.email;
    END IF;

    IF (v_emp.is_active = false) THEN
        RAISE EXCEPTION 'Registration denied: Employee record for % is currently deactivated. Contact SCM Administrator.', NEW.email;
    END IF;

    -- Split full name into first and last name
    v_space_idx := position(' ' in trim(v_emp.full_name));
    IF v_space_idx > 0 THEN
        v_first_name := substring(trim(v_emp.full_name) from 1 for v_space_idx - 1);
        v_last_name := substring(trim(v_emp.full_name) from v_space_idx + 1);
    ELSE
        v_first_name := trim(v_emp.full_name);
        v_last_name := '';
    END IF;

    -- Resolve department if exists
    SELECT id INTO v_dept_id 
    FROM public.departments 
    WHERE lower(name) = lower(v_emp.department) 
    LIMIT 1;

    -- Automatically provision user profile
    INSERT INTO public.profiles (id, email, first_name, last_name, department_id, is_active)
    VALUES (NEW.id, NEW.email, v_first_name, v_last_name, v_dept_id, true)
    ON CONFLICT (id) DO UPDATE 
    SET first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        is_active = true;

    -- Automatically assign role from employees.assigned_role (NEVER from client!)
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, v_emp.assigned_role)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    -- Link employee record to the new auth user
    UPDATE public.employees 
    SET user_id = NEW.id 
    WHERE id = v_emp.id;

    -- Log audit trail for account provisioning
    INSERT INTO public.audit_logs (table_name, record_id, action, new_values, changed_by, created_at)
    VALUES (
        'employees',
        v_emp.id,
        'ACCOUNT_PROVISIONED',
        jsonb_build_object(
            'employee_id', v_emp.employee_id,
            'email', NEW.email,
            'role', v_emp.assigned_role,
            'user_id', NEW.id
        ),
        NEW.id,
        now()
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
    AFTER INSERT ON auth.users 
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 4. Secure RPC Helper Functions

-- Validate employee credentials prior to signup submission
CREATE OR REPLACE FUNCTION public.validate_employee_for_signup(p_employee_id TEXT, p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_emp public.employees%ROWTYPE;
BEGIN
    SELECT * INTO v_emp 
    FROM public.employees 
    WHERE lower(trim(employee_id)) = lower(trim(p_employee_id))
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'valid', false,
            'message', 'Employee ID not found in the approved employee directory. Please contact your SCM Administrator.'
        );
    END IF;

    IF lower(trim(v_emp.email)) != lower(trim(p_email)) THEN
        RETURN jsonb_build_object(
            'valid', false,
            'message', 'The provided work email does not match the employee record on file.'
        );
    END IF;

    IF v_emp.is_active = false THEN
        RETURN jsonb_build_object(
            'valid', false,
            'message', 'Your employee account is currently marked inactive. Please contact the SCM Administrator.'
        );
    END IF;

    IF v_emp.user_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'valid', false,
            'message', 'An account is already registered for this employee. Please log in or use Forgot Password.'
        );
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'employee', jsonb_build_object(
            'employee_id', v_emp.employee_id,
            'full_name', v_emp.full_name,
            'department', v_emp.department,
            'designation', v_emp.designation,
            'assigned_role', v_emp.assigned_role
        )
    );
END;
$$;

-- Resolve login identifier (supports logging in via User ID or Work Email)
CREATE OR REPLACE FUNCTION public.resolve_login_identifier(p_identifier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_emp public.employees%ROWTYPE;
BEGIN
    IF position('@' in p_identifier) > 0 THEN
        SELECT * INTO v_emp 
        FROM public.employees 
        WHERE lower(trim(email)) = lower(trim(p_identifier))
        LIMIT 1;
    ELSE
        SELECT * INTO v_emp 
        FROM public.employees 
        WHERE lower(trim(employee_id)) = lower(trim(p_identifier))
        LIMIT 1;
    END IF;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'found', false,
            'message', 'No employee record found for this identifier.'
        );
    END IF;

    RETURN jsonb_build_object(
        'found', true,
        'email', v_emp.email,
        'employee_id', v_emp.employee_id,
        'is_active', v_emp.is_active,
        'must_change_password', v_emp.must_change_password,
        'assigned_role', v_emp.assigned_role
    );
END;
$$;

-- Complete password change (clears must_change_password)
CREATE OR REPLACE FUNCTION public.complete_password_change()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE public.employees 
    SET must_change_password = false,
        updated_at = now()
    WHERE user_id = v_user_id;

    INSERT INTO public.audit_logs (table_name, record_id, action, changed_by, created_at)
    VALUES ('employees', v_user_id, 'PASSWORD_CHANGED', v_user_id, now());

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Bulk Employee Import RPC (Transaction-safe with row-level validation)
CREATE OR REPLACE FUNCTION public.import_employees_bulk(p_records JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_item JSONB;
    v_emp_id VARCHAR(50);
    v_name VARCHAR(150);
    v_email VARCHAR(255);
    v_dept VARCHAR(100);
    v_desig VARCHAR(100);
    v_role VARCHAR(50);
    v_inserted INTEGER := 0;
    v_updated INTEGER := 0;
    v_failed INTEGER := 0;
    v_errors JSONB := '[]'::jsonb;
    v_idx INTEGER := 0;
BEGIN
    -- Verify caller is super_admin
    IF NOT public.current_user_has_role('super_admin') THEN
        RAISE EXCEPTION 'Access denied: Only Super Admin can import employees';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_records) LOOP
        v_idx := v_idx + 1;
        v_emp_id := trim(v_item->>'employee_id');
        v_name := trim(v_item->>'full_name');
        v_email := lower(trim(v_item->>'email'));
        v_dept := trim(v_item->>'department');
        v_desig := trim(v_item->>'designation');
        v_role := trim(v_item->>'assigned_role');

        -- Row-level field validation
        IF v_emp_id IS NULL OR v_emp_id = '' THEN
            v_failed := v_failed + 1;
            v_errors := v_errors || jsonb_build_object('row', v_idx, 'error', 'Missing Employee ID');
            CONTINUE;
        END IF;

        IF v_name IS NULL OR v_name = '' THEN
            v_failed := v_failed + 1;
            v_errors := v_errors || jsonb_build_object('row', v_idx, 'error', 'Missing Full Name');
            CONTINUE;
        END IF;

        IF v_email IS NULL OR position('@' in v_email) = 0 THEN
            v_failed := v_failed + 1;
            v_errors := v_errors || jsonb_build_object('row', v_idx, 'error', 'Invalid work email address');
            CONTINUE;
        END IF;

        IF v_role NOT IN ('super_admin', 'scm_admin', 'scm_team_user') THEN
            v_failed := v_failed + 1;
            v_errors := v_errors || jsonb_build_object('row', v_idx, 'error', 'Invalid role: must be super_admin, scm_admin, or scm_team_user');
            CONTINUE;
        END IF;

        -- Insert or Update employee record
        IF EXISTS (SELECT 1 FROM public.employees WHERE employee_id = v_emp_id OR email = v_email) THEN
            UPDATE public.employees
            SET full_name = v_name,
                email = v_email,
                department = v_dept,
                designation = v_desig,
                assigned_role = v_role,
                updated_at = now()
            WHERE employee_id = v_emp_id OR email = v_email;
            v_updated := v_updated + 1;
        ELSE
            INSERT INTO public.employees (
                employee_id, full_name, email, department, designation, assigned_role, is_active, must_change_password
            ) VALUES (
                v_emp_id, v_name, v_email, coalesce(v_dept, 'General'), coalesce(v_desig, 'Staff'), v_role, true, false
            );
            v_inserted := v_inserted + 1;
        END IF;
    END LOOP;

    -- Audit log import event
    INSERT INTO public.audit_logs (table_name, record_id, action, new_values, changed_by, created_at)
    VALUES (
        'employees',
        gen_random_uuid(),
        'EMPLOYEE_LIST_IMPORTED',
        jsonb_build_object(
            'total_rows', v_idx,
            'inserted', v_inserted,
            'updated', v_updated,
            'failed', v_failed
        ),
        v_actor,
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'total', v_idx,
        'inserted', v_inserted,
        'updated', v_updated,
        'failed', v_failed,
        'errors', v_errors
    );
END;
$$;

-- 5. Row-Level Security on employees table
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Read policy: Authenticated users can view employee records
CREATE POLICY "Allow authenticated read on employees"
    ON public.employees FOR SELECT TO authenticated USING (true);

-- Super Admin full write access
CREATE POLICY "Super Admin manage employees"
    ON public.employees FOR ALL TO authenticated 
    USING (public.current_user_has_role('super_admin'))
    WITH CHECK (public.current_user_has_role('super_admin'));

-- Users can update must_change_password on their own record
CREATE POLICY "Users update own password flag"
    ON public.employees FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 6. Development seed data (AXX09) has been separated into backend/supabase/seed.sql
-- so that production migrations never seed temporary development credentials by default.

COMMIT;

