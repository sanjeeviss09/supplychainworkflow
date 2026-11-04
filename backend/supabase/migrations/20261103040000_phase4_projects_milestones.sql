-- =============================================================================
-- SCM FLOW — PHASE 4: PROJECTS AND MILESTONES DATA MODEL & PERSISTENCE
-- File: backend/supabase/migrations/20261103040000_phase4_projects_milestones.sql
-- =============================================================================

BEGIN;

-- 1. Project Code Sequence & Generator
CREATE SEQUENCE IF NOT EXISTS public.project_code_seq START WITH 1001;

CREATE OR REPLACE FUNCTION public.generate_project_code()
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
    v_year VARCHAR := to_char(CURRENT_DATE, 'YYYY');
    v_seq BIGINT := nextval('public.project_code_seq');
BEGIN
    RETURN 'PRJ-' || v_year || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

-- 2. Upgrade / Align `projects` Table
-- Ensure all Phase 4 fields, timestamps, constraints, and audit columns exist
DO $$ BEGIN
    -- Add columns if not already present on public.projects
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'name') THEN
        ALTER TABLE public.projects ADD COLUMN name VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'owner_employee_id') THEN
        ALTER TABLE public.projects ADD COLUMN owner_employee_id UUID REFERENCES public.employees(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'planned_start_date') THEN
        ALTER TABLE public.projects ADD COLUMN planned_start_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'planned_end_date') THEN
        ALTER TABLE public.projects ADD COLUMN planned_end_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'version') THEN
        ALTER TABLE public.projects ADD COLUMN version INTEGER DEFAULT 1 NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'updated_by') THEN
        ALTER TABLE public.projects ADD COLUMN updated_by UUID REFERENCES public.profiles(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'archived_at') THEN
        ALTER TABLE public.projects ADD COLUMN archived_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'archived_by') THEN
        ALTER TABLE public.projects ADD COLUMN archived_by UUID REFERENCES public.profiles(id);
    END IF;
END $$;

-- Populate missing name/planned dates from legacy columns if needed
UPDATE public.projects
SET name = coalesce(name, title),
    planned_start_date = coalesce(planned_start_date, target_start_date, CURRENT_DATE),
    planned_end_date = coalesce(planned_end_date, target_completion_date, CURRENT_DATE + INTERVAL '30 days')
WHERE name IS NULL OR planned_start_date IS NULL OR planned_end_date IS NULL;

-- Default project_code to generated code if null
ALTER TABLE public.projects ALTER COLUMN project_code SET DEFAULT public.generate_project_code();

-- Add constraints on projects
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS chk_project_dates;
ALTER TABLE public.projects ADD CONSTRAINT chk_project_dates CHECK (planned_end_date >= planned_start_date);

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS chk_project_completed;
ALTER TABLE public.projects ADD CONSTRAINT chk_project_completed CHECK (status::text != 'completed' OR actual_completion_date IS NOT NULL);

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS chk_project_completion_date;
ALTER TABLE public.projects ADD CONSTRAINT chk_project_completion_date CHECK (actual_completion_date IS NULL OR actual_completion_date >= planned_start_date);

CREATE INDEX IF NOT EXISTS idx_projects_dept ON public.projects(department_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_employee_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_dates ON public.projects(planned_start_date, planned_end_date);

-- 3. Project Members Table (One Active Membership Per Employee Per Project)
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
    added_by UUID NOT NULL REFERENCES public.profiles(id),
    added_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    removed_by UUID REFERENCES public.profiles(id),
    removed_at TIMESTAMPTZ
);

-- Unique index enforcing exactly one active membership per employee per project,
-- while preserving full history of removed memberships
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_active_member
    ON public.project_members(project_id, employee_id)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_project_members_emp ON public.project_members(employee_id);
CREATE INDEX IF NOT EXISTS idx_project_members_proj ON public.project_members(project_id);

-- 4. Upgrade / Align `milestones` Table
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'milestones' AND column_name = 'milestone_code') THEN
        ALTER TABLE public.milestones ADD COLUMN milestone_code VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'milestones' AND column_name = 'planned_start_date') THEN
        ALTER TABLE public.milestones ADD COLUMN planned_start_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'milestones' AND column_name = 'planned_end_date') THEN
        ALTER TABLE public.milestones ADD COLUMN planned_end_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'milestones' AND column_name = 'assignee_employee_id') THEN
        ALTER TABLE public.milestones ADD COLUMN assignee_employee_id UUID REFERENCES public.employees(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'milestones' AND column_name = 'created_by') THEN
        ALTER TABLE public.milestones ADD COLUMN created_by UUID REFERENCES public.profiles(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'milestones' AND column_name = 'updated_by') THEN
        ALTER TABLE public.milestones ADD COLUMN updated_by UUID REFERENCES public.profiles(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'milestones' AND column_name = 'archived_at') THEN
        ALTER TABLE public.milestones ADD COLUMN archived_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'milestones' AND column_name = 'archived_by') THEN
        ALTER TABLE public.milestones ADD COLUMN archived_by UUID REFERENCES public.profiles(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'milestones' AND column_name = 'version') THEN
        ALTER TABLE public.milestones ADD COLUMN version INTEGER DEFAULT 1 NOT NULL;
    END IF;
END $$;

-- Populate milestone planned dates and sequence codes
UPDATE public.milestones
SET planned_start_date = coalesce(planned_start_date, CURRENT_DATE),
    planned_end_date = coalesce(planned_end_date, target_date, CURRENT_DATE + INTERVAL '14 days'),
    milestone_code = coalesce(milestone_code, 'MLS-' || lpad(sequence_number::text, 2, '0'))
WHERE planned_start_date IS NULL OR planned_end_date IS NULL OR milestone_code IS NULL;

-- Constraints on milestones
ALTER TABLE public.milestones DROP CONSTRAINT IF EXISTS chk_milestone_dates;
ALTER TABLE public.milestones ADD CONSTRAINT chk_milestone_dates CHECK (planned_end_date >= planned_start_date);

ALTER TABLE public.milestones DROP CONSTRAINT IF EXISTS chk_milestone_completion_date;
ALTER TABLE public.milestones ADD CONSTRAINT chk_milestone_completion_date CHECK (actual_completion_date IS NULL OR actual_completion_date >= planned_start_date);

CREATE INDEX IF NOT EXISTS idx_milestones_proj ON public.milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_assignee ON public.milestones(assignee_employee_id);

-- Milestone code auto-generator function within a project
CREATE OR REPLACE FUNCTION public.generate_milestone_code(p_project_id UUID)
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
    v_next_num INTEGER;
BEGIN
    SELECT coalesce(max(
        CASE 
            WHEN milestone_code ~ '^MLS-[0-9]+$' THEN substring(milestone_code from 5)::integer
            ELSE 0
        END
    ), 0) + 1
    INTO v_next_num
    FROM public.milestones
    WHERE project_id = p_project_id;

    RETURN 'MLS-' || lpad(v_next_num::text, 2, '0');
END;
$$;

-- 5. Exception Grants Table (for Step 7 in the Decision Algorithm)
CREATE TABLE IF NOT EXISTS public.project_exception_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
    allowed_permissions VARCHAR(100)[] NOT NULL,
    reason TEXT NOT NULL,
    granted_by UUID NOT NULL REFERENCES public.profiles(id),
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exception_grants_emp ON public.project_exception_grants(employee_id);
CREATE INDEX IF NOT EXISTS idx_exception_grants_proj ON public.project_exception_grants(project_id);

-- 6. Explicit Security Denies Table (for Step 3 in the Decision Algorithm)
CREATE TABLE IF NOT EXISTS public.project_explicit_denies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_explicit_denies_emp ON public.project_explicit_denies(employee_id);

-- 7. Register Phase 4 Granular Permissions in public.permissions
INSERT INTO public.permissions (id, module, description) VALUES
    ('projects.view', 'projects', 'View project metadata, dates, members, and milestone schedules'),
    ('projects.create', 'projects', 'Create new SCM projects in draft status with departmental assignment'),
    ('projects.update', 'projects', 'Modify project details, status, planned dates, and description'),
    ('projects.archive', 'projects', 'Archive a completed or inactive project'),
    ('projects.delete', 'projects', 'Permanently delete projects (strictly restricted and disabled by default)'),
    ('projects.view_all', 'projects', 'View all projects across all departments without departmental scoping'),
    ('projects.manage_members', 'projects', 'Add or remove project team members and assign project scope'),
    ('projects.manage_owner', 'projects', 'Assign or reassign the single authoritative owner of a project'),
    ('milestones.view', 'milestones', 'View milestones within authorized projects'),
    ('milestones.create', 'milestones', 'Create milestones inside authorized projects'),
    ('milestones.update', 'milestones', 'Update milestone title, description, and planned dates'),
    ('milestones.complete', 'milestones', 'Record milestone completion and actual completion date'),
    ('milestones.archive', 'milestones', 'Archive a milestone without affecting active project progress'),
    ('milestones.assign', 'milestones', 'Assign or reassign milestone task deliverables to team members')
ON CONFLICT (id) DO UPDATE
SET module = EXCLUDED.module,
    description = EXCLUDED.description;

-- Grant permissions to Super Admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'super_admin', id FROM public.permissions
WHERE id LIKE 'projects.%' OR id LIKE 'milestones.%'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant permissions to SCM Admin (Scoped to Department/Unit)
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_admin', 'projects.view'),
    ('scm_admin', 'projects.create'),
    ('scm_admin', 'projects.update'),
    ('scm_admin', 'projects.archive'),
    ('scm_admin', 'projects.manage_members'),
    ('scm_admin', 'projects.manage_owner'),
    ('scm_admin', 'milestones.view'),
    ('scm_admin', 'milestones.create'),
    ('scm_admin', 'milestones.update'),
    ('scm_admin', 'milestones.complete'),
    ('scm_admin', 'milestones.archive'),
    ('scm_admin', 'milestones.assign')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant permissions to SCM Team User (Operational execution within assigned project scope)
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_team_user', 'projects.view'),
    ('scm_team_user', 'projects.create'),
    ('scm_team_user', 'projects.update'),
    ('scm_team_user', 'milestones.view'),
    ('scm_team_user', 'milestones.create'),
    ('scm_team_user', 'milestones.update'),
    ('scm_team_user', 'milestones.complete')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 8. Centralized Backend Authorization Decision Algorithm in PostgreSQL
-- Order of evaluation (stopping at first denial):
-- 1. AUTH_REQUIRED
-- 2. EMPLOYEE_NOT_FOUND, EMPLOYEE_INACTIVE
-- 3. EXPLICIT_DENY
-- 4. MISSING_PERMISSION
-- 5. SCOPE_UNVERIFIED, OUT_OF_SCOPE
-- 6. NO_PROJECT_ACCESS
-- 7. EXCEPTION_INVALID, EXCEPTION_EXPIRED
-- 8. OWNER_CHANGE_DENIED, MEMBER_CHANGE_DENIED, MILESTONE_ASSIGN_DENIED, ARCHIVE_NOT_PERMITTED
-- 9. allow
CREATE OR REPLACE FUNCTION public.authorize_project_action(
    p_action VARCHAR,
    p_project_id UUID DEFAULT NULL,
    p_target_employee_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_employee RECORD;
    v_project RECORD;
    v_has_perm BOOLEAN := false;
    v_has_exception BOOLEAN := false;
    v_is_owner BOOLEAN := false;
    v_is_member BOOLEAN := false;
BEGIN
    -- Step 1: Authenticate
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason_code', 'AUTH_REQUIRED',
            'message', 'Authentication required. No valid active session.'
        );
    END IF;

    -- Step 2: Validate Employee
    SELECT id, employee_id, department, assigned_role, is_active
    INTO v_employee
    FROM public.employees
    WHERE user_id = v_user_id;

    IF v_employee.id IS NULL THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason_code', 'EMPLOYEE_NOT_FOUND',
            'message', 'Authenticated account is not linked to any approved employee record.'
        );
    END IF;

    IF v_employee.is_active IS NOT TRUE THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason_code', 'EMPLOYEE_INACTIVE',
            'message', 'Employee account is inactive or access has been revoked.'
        );
    END IF;

    -- Step 3: Check Explicit Restrictions
    IF p_project_id IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM public.project_explicit_denies
            WHERE employee_id = v_employee.id
              AND (project_id = p_project_id OR project_id IS NULL)
        ) THEN
            RETURN jsonb_build_object(
                'allowed', false,
                'reason_code', 'EXPLICIT_DENY',
                'message', 'Explicit security restriction denies access to this project.'
            );
        END IF;
    END IF;

    -- Step 4: Check Exact Action Permission
    SELECT EXISTS (
        SELECT 1 FROM public.role_permissions
        WHERE role_id = v_employee.assigned_role
          AND permission_id = p_action
    ) INTO v_has_perm;

    -- If not granted via role, check active exception grant
    IF NOT v_has_perm THEN
        SELECT EXISTS (
            SELECT 1 FROM public.project_exception_grants
            WHERE employee_id = v_employee.id
              AND p_action = ANY(allowed_permissions)
              AND is_revoked = false
              AND expires_at > now()
              AND (project_id = p_project_id OR project_id IS NULL)
        ) INTO v_has_exception;

        IF NOT v_has_exception THEN
            RETURN jsonb_build_object(
                'allowed', false,
                'reason_code', 'MISSING_PERMISSION',
                'message', 'User role does not grant required action permission: ' || p_action
            );
        END IF;
    END IF;

    -- If no specific project is targeted (e.g. projects.create or global view check)
    IF p_project_id IS NULL THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'reason_code', 'ALLOWED',
            'message', 'Authorized for general action: ' || p_action,
            'effective_scope', v_employee.assigned_role
        );
    END IF;

    -- Step 5: Resolve Project and Department Scope
    SELECT p.*, d.name AS dept_name
    INTO v_project
    FROM public.projects p
    LEFT JOIN public.departments d ON p.department_id = d.id
    WHERE p.id = p_project_id;

    IF v_project.id IS NULL THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason_code', 'SCOPE_UNVERIFIED',
            'message', 'Target project does not exist or department scope cannot be resolved.'
        );
    END IF;

    -- Step 6: Check Project-Level Access & Scope
    -- Super Admin has global platform scope
    IF v_employee.assigned_role = 'super_admin' THEN
        -- Allowed, continues to safeguards
    ELSIF v_employee.assigned_role = 'scm_admin' THEN
        -- SCM Admin must match department OR hold exception grant
        IF v_employee.department != v_project.dept_name AND NOT v_has_exception THEN
            RETURN jsonb_build_object(
                'allowed', false,
                'reason_code', 'OUT_OF_SCOPE',
                'message', 'Project is outside assigned department scope (' || coalesce(v_project.dept_name, 'Unassigned') || ').'
            );
        END IF;
    ELSE
        -- SCM Team User must be owner OR active member OR hold exception grant
        v_is_owner := (v_project.owner_employee_id = v_employee.id OR v_project.lead_user_id = v_user_id);
        
        SELECT EXISTS (
            SELECT 1 FROM public.project_members
            WHERE project_id = p_project_id
              AND employee_id = v_employee.id
              AND status = 'active'
        ) INTO v_is_member;

        IF NOT v_is_owner AND NOT v_is_member AND NOT v_has_exception THEN
            RETURN jsonb_build_object(
                'allowed', false,
                'reason_code', 'NO_PROJECT_ACCESS',
                'message', 'User is neither owner nor active member of this project.'
            );
        END IF;
    END IF;

    -- Step 7: Action-Specific Safeguards
    IF p_action = 'projects.manage_owner' AND v_employee.assigned_role NOT IN ('super_admin', 'scm_admin') THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason_code', 'OWNER_CHANGE_DENIED',
            'message', 'Changing project ownership requires projects.manage_owner authority.'
        );
    END IF;

    IF p_action = 'projects.manage_members' AND v_employee.assigned_role NOT IN ('super_admin', 'scm_admin') THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason_code', 'MEMBER_CHANGE_DENIED',
            'message', 'Managing project members requires projects.manage_members authority.'
        );
    END IF;

    IF p_action = 'milestones.assign' AND v_employee.assigned_role NOT IN ('super_admin', 'scm_admin') THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason_code', 'MILESTONE_ASSIGN_DENIED',
            'message', 'Assigning milestones requires milestones.assign authority.'
        );
    END IF;

    -- Step 8: Allow
    RETURN jsonb_build_object(
        'allowed', true,
        'reason_code', 'ALLOWED',
        'message', 'Authorized for action ' || p_action || ' on project ' || v_project.project_code,
        'effective_scope', CASE 
            WHEN v_employee.assigned_role = 'super_admin' THEN 'global'
            WHEN v_employee.assigned_role = 'scm_admin' THEN 'department'
            ELSE 'project_member'
        END
    );
END;
$$;

-- 9. Secure Server-Side Project & Milestone Mutation RPCs (with Audit Logging)

-- A. Create Project
CREATE OR REPLACE FUNCTION public.api_create_project(
    p_name VARCHAR,
    p_description TEXT,
    p_department_id UUID,
    p_owner_employee_id UUID,
    p_planned_start_date DATE,
    p_planned_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_auth JSONB;
    v_code VARCHAR;
    v_project_id UUID;
    v_owner_user_id UUID;
    v_owner_active BOOLEAN;
BEGIN
    -- Authorize create action
    v_auth := public.authorize_project_action('projects.create');
    IF NOT (v_auth->>'allowed')::boolean THEN
        RAISE EXCEPTION 'Access Denied: % (Reason: %)', v_auth->>'message', v_auth->>'reason_code';
    END IF;

    -- Validate Owner
    SELECT user_id, is_active INTO v_owner_user_id, v_owner_active
    FROM public.employees
    WHERE id = p_owner_employee_id;

    IF v_owner_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Invalid project owner: Owner must be an active corporate employee.';
    END IF;

    -- Validate Dates
    IF p_planned_end_date < p_planned_start_date THEN
        RAISE EXCEPTION 'Planned end date cannot precede planned start date.';
    END IF;

    v_code := public.generate_project_code();

    INSERT INTO public.projects (
        project_code,
        title,
        name,
        description,
        department_id,
        owner_employee_id,
        lead_user_id,
        planned_start_date,
        planned_end_date,
        target_start_date,
        target_completion_date,
        status,
        created_by,
        version
    ) VALUES (
        v_code,
        trim(p_name),
        trim(p_name),
        trim(p_description),
        p_department_id,
        p_owner_employee_id,
        coalesce(v_owner_user_id, auth.uid()),
        p_planned_start_date,
        p_planned_end_date,
        p_planned_start_date,
        p_planned_end_date,
        'draft',
        auth.uid(),
        1
    ) RETURNING id INTO v_project_id;

    -- Audit Log
    PERFORM public.write_security_audit_event(
        'projects',
        v_project_id,
        'PROJECT_CREATED',
        NULL,
        jsonb_build_object('project_code', v_code, 'name', p_name, 'owner_employee_id', p_owner_employee_id),
        NULL,
        'SUCCESS'
    );

    RETURN jsonb_build_object('success', true, 'project_id', v_project_id, 'project_code', v_code);
END;
$$;

-- B. Update Project
CREATE OR REPLACE FUNCTION public.api_update_project(
    p_project_id UUID,
    p_name VARCHAR,
    p_description TEXT,
    p_status VARCHAR,
    p_planned_start_date DATE,
    p_planned_end_date DATE,
    p_actual_completion_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_auth JSONB;
    v_old_project RECORD;
    v_new_status VARCHAR := lower(trim(p_status));
BEGIN
    v_auth := public.authorize_project_action('projects.update', p_project_id);
    IF NOT (v_auth->>'allowed')::boolean THEN
        RAISE EXCEPTION 'Access Denied: % (Reason: %)', v_auth->>'message', v_auth->>'reason_code';
    END IF;

    SELECT * INTO v_old_project FROM public.projects WHERE id = p_project_id;
    IF v_old_project.id IS NULL THEN
        RAISE EXCEPTION 'Project not found.';
    END IF;

    IF v_old_project.status::text = 'archived' THEN
        RAISE EXCEPTION 'Archived projects are read-only and cannot be updated.';
    END IF;

    IF p_planned_end_date < p_planned_start_date THEN
        RAISE EXCEPTION 'Planned end date cannot precede planned start date.';
    END IF;

    -- Status Transition Validation
    IF v_new_status = 'completed' AND p_actual_completion_date IS NULL THEN
        RAISE EXCEPTION 'A completed project must have a valid actual completion date.';
    END IF;

    IF p_actual_completion_date IS NOT NULL AND p_actual_completion_date < p_planned_start_date THEN
        RAISE EXCEPTION 'Actual completion date cannot precede planned start date.';
    END IF;

    UPDATE public.projects
    SET name = trim(p_name),
        title = trim(p_name),
        description = trim(p_description),
        status = v_new_status::public.project_status,
        planned_start_date = p_planned_start_date,
        planned_end_date = p_planned_end_date,
        target_start_date = p_planned_start_date,
        target_completion_date = p_planned_end_date,
        actual_completion_date = CASE WHEN v_new_status = 'completed' THEN p_actual_completion_date ELSE NULL END,
        updated_by = auth.uid(),
        updated_at = now(),
        version = version + 1
    WHERE id = p_project_id;

    -- Audit Log
    PERFORM public.write_security_audit_event(
        'projects',
        p_project_id,
        'PROJECT_UPDATED',
        jsonb_build_object('status', v_old_project.status, 'name', v_old_project.name),
        jsonb_build_object('status', v_new_status, 'name', p_name),
        NULL,
        'SUCCESS'
    );

    RETURN jsonb_build_object('success', true, 'project_id', p_project_id);
END;
$$;

-- C. Archive Project
CREATE OR REPLACE FUNCTION public.api_archive_project(
    p_project_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_auth JSONB;
BEGIN
    v_auth := public.authorize_project_action('projects.archive', p_project_id);
    IF NOT (v_auth->>'allowed')::boolean THEN
        RAISE EXCEPTION 'Access Denied: % (Reason: %)', v_auth->>'message', v_auth->>'reason_code';
    END IF;

    UPDATE public.projects
    SET status = 'archived'::public.project_status,
        archived_at = now(),
        archived_by = auth.uid(),
        updated_at = now(),
        version = version + 1
    WHERE id = p_project_id;

    PERFORM public.write_security_audit_event(
        'projects',
        p_project_id,
        'PROJECT_ARCHIVED',
        NULL,
        jsonb_build_object('reason', p_reason),
        NULL,
        'SUCCESS'
    );

    RETURN jsonb_build_object('success', true, 'project_id', p_project_id);
END;
$$;

-- D. Add / Remove Project Member
CREATE OR REPLACE FUNCTION public.api_manage_project_member(
    p_project_id UUID,
    p_employee_id UUID,
    p_action VARCHAR -- 'add' or 'remove'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_auth JSONB;
    v_emp RECORD;
BEGIN
    v_auth := public.authorize_project_action('projects.manage_members', p_project_id);
    IF NOT (v_auth->>'allowed')::boolean THEN
        RAISE EXCEPTION 'Access Denied: % (Reason: %)', v_auth->>'message', v_auth->>'reason_code';
    END IF;

    SELECT id, is_active INTO v_emp FROM public.employees WHERE id = p_employee_id;
    IF v_emp.id IS NULL THEN
        RAISE EXCEPTION 'Employee not found.';
    END IF;

    IF p_action = 'add' THEN
        IF v_emp.is_active IS NOT TRUE THEN
            RAISE EXCEPTION 'Cannot add inactive employee to project membership.';
        END IF;

        INSERT INTO public.project_members (
            project_id,
            employee_id,
            status,
            added_by,
            added_at
        ) VALUES (
            p_project_id,
            p_employee_id,
            'active',
            auth.uid(),
            now()
        )
        ON CONFLICT (project_id, employee_id) WHERE status = 'active'
        DO NOTHING;

        PERFORM public.write_security_audit_event(
            'project_members',
            p_project_id,
            'MEMBER_ADDED',
            NULL,
            jsonb_build_object('employee_id', p_employee_id),
            NULL,
            'SUCCESS'
        );
    ELSIF p_action = 'remove' THEN
        UPDATE public.project_members
        SET status = 'removed',
            removed_by = auth.uid(),
            removed_at = now()
        WHERE project_id = p_project_id
          AND employee_id = p_employee_id
          AND status = 'active';

        PERFORM public.write_security_audit_event(
            'project_members',
            p_project_id,
            'MEMBER_REMOVED',
            NULL,
            jsonb_build_object('employee_id', p_employee_id),
            NULL,
            'SUCCESS'
        );
    ELSE
        RAISE EXCEPTION 'Invalid action: must be "add" or "remove".';
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- E. Manage Project Owner
CREATE OR REPLACE FUNCTION public.api_change_project_owner(
    p_project_id UUID,
    p_new_owner_employee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_auth JSONB;
    v_new_owner RECORD;
    v_old_owner UUID;
BEGIN
    v_auth := public.authorize_project_action('projects.manage_owner', p_project_id);
    IF NOT (v_auth->>'allowed')::boolean THEN
        RAISE EXCEPTION 'Access Denied: % (Reason: %)', v_auth->>'message', v_auth->>'reason_code';
    END IF;

    SELECT id, user_id, is_active INTO v_new_owner
    FROM public.employees
    WHERE id = p_new_owner_employee_id;

    IF v_new_owner.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'New owner must be an active corporate employee.';
    END IF;

    SELECT owner_employee_id INTO v_old_owner FROM public.projects WHERE id = p_project_id;

    UPDATE public.projects
    SET owner_employee_id = p_new_owner_employee_id,
        lead_user_id = coalesce(v_new_owner.user_id, lead_user_id),
        updated_by = auth.uid(),
        updated_at = now(),
        version = version + 1
    WHERE id = p_project_id;

    PERFORM public.write_security_audit_event(
        'projects',
        p_project_id,
        'OWNER_CHANGED',
        jsonb_build_object('previous_owner_id', v_old_owner),
        jsonb_build_object('new_owner_id', p_new_owner_employee_id),
        NULL,
        'SUCCESS'
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

-- F. Upsert Milestone
CREATE OR REPLACE FUNCTION public.api_upsert_milestone(
    p_id UUID DEFAULT NULL,
    p_project_id UUID DEFAULT NULL,
    p_title VARCHAR DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_planned_start_date DATE DEFAULT NULL,
    p_planned_end_date DATE DEFAULT NULL,
    p_status VARCHAR DEFAULT 'draft',
    p_assignee_employee_id UUID DEFAULT NULL,
    p_actual_completion_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_auth JSONB;
    v_target_project_id UUID := p_project_id;
    v_milestone_code VARCHAR;
    v_milestone_id UUID := p_id;
    v_new_status VARCHAR := lower(trim(p_status));
BEGIN
    IF v_milestone_id IS NOT NULL THEN
        SELECT project_id INTO v_target_project_id FROM public.milestones WHERE id = v_milestone_id;
    END IF;

    IF v_milestone_id IS NULL THEN
        v_auth := public.authorize_project_action('milestones.create', v_target_project_id);
    ELSE
        v_auth := public.authorize_project_action('milestones.update', v_target_project_id);
    END IF;

    IF NOT (v_auth->>'allowed')::boolean THEN
        RAISE EXCEPTION 'Access Denied: % (Reason: %)', v_auth->>'message', v_auth->>'reason_code';
    END IF;

    IF p_planned_end_date < p_planned_start_date THEN
        RAISE EXCEPTION 'Planned end date cannot precede planned start date.';
    END IF;

    IF v_new_status = 'completed' AND p_actual_completion_date IS NULL THEN
        RAISE EXCEPTION 'Completed milestone must have an actual completion date.';
    END IF;

    IF v_milestone_id IS NULL THEN
        v_milestone_code := public.generate_milestone_code(v_target_project_id);

        INSERT INTO public.milestones (
            project_id,
            sequence_number,
            milestone_code,
            title,
            description,
            planned_start_date,
            planned_end_date,
            target_date,
            status,
            assignee_employee_id,
            actual_completion_date,
            created_by,
            version
        ) VALUES (
            v_target_project_id,
            coalesce((SELECT max(sequence_number) FROM public.milestones WHERE project_id = v_target_project_id), 0) + 1,
            v_milestone_code,
            trim(p_title),
            trim(p_description),
            p_planned_start_date,
            p_planned_end_date,
            p_planned_end_date,
            v_new_status::public.milestone_status,
            p_assignee_employee_id,
            CASE WHEN v_new_status = 'completed' THEN p_actual_completion_date ELSE NULL END,
            auth.uid(),
            1
        ) RETURNING id INTO v_milestone_id;

        PERFORM public.write_security_audit_event(
            'milestones',
            v_milestone_id,
            'MILESTONE_CREATED',
            NULL,
            jsonb_build_object('milestone_code', v_milestone_code, 'title', p_title),
            NULL,
            'SUCCESS'
        );
    ELSE
        UPDATE public.milestones
        SET title = trim(p_title),
            description = trim(p_description),
            planned_start_date = p_planned_start_date,
            planned_end_date = p_planned_end_date,
            target_date = p_planned_end_date,
            status = v_new_status::public.milestone_status,
            assignee_employee_id = p_assignee_employee_id,
            actual_completion_date = CASE WHEN v_new_status = 'completed' THEN p_actual_completion_date ELSE NULL END,
            updated_by = auth.uid(),
            updated_at = now(),
            version = version + 1
        WHERE id = v_milestone_id;

        PERFORM public.write_security_audit_event(
            'milestones',
            v_milestone_id,
            'MILESTONE_UPDATED',
            NULL,
            jsonb_build_object('title', p_title, 'status', v_new_status),
            NULL,
            'SUCCESS'
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'milestone_id', v_milestone_id);
END;
$$;

-- G. Archive Milestone
CREATE OR REPLACE FUNCTION public.api_archive_milestone(
    p_milestone_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_auth JSONB;
    v_project_id UUID;
BEGIN
    SELECT project_id INTO v_project_id FROM public.milestones WHERE id = p_milestone_id;
    IF v_project_id IS NULL THEN
        RAISE EXCEPTION 'Milestone not found.';
    END IF;

    v_auth := public.authorize_project_action('milestones.archive', v_project_id);
    IF NOT (v_auth->>'allowed')::boolean THEN
        RAISE EXCEPTION 'Access Denied: % (Reason: %)', v_auth->>'message', v_auth->>'reason_code';
    END IF;

    UPDATE public.milestones
    SET status = 'archived'::public.milestone_status,
        archived_at = now(),
        archived_by = auth.uid(),
        updated_at = now(),
        version = version + 1
    WHERE id = p_milestone_id;

    PERFORM public.write_security_audit_event(
        'milestones',
        p_milestone_id,
        'MILESTONE_ARCHIVED',
        NULL,
        jsonb_build_object('milestone_id', p_milestone_id),
        NULL,
        'SUCCESS'
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

COMMIT;

