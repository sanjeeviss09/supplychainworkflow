-- =============================================================================
-- SCM FLOW — PHASE 3: ROLE-ROUTE AUTHORIZATION & CENTRALIZED PERMISSION MATRIX
-- File: backend/supabase/migrations/20261103030000_phase3_role_route_authorization.sql
-- Purpose:
--   1. Seed the canonical Phase 3 permission catalogue into public.permissions.
--   2. Map permissions to Super Admin, SCM Admin, and SCM Team User baseline roles.
--   3. Establish server-side authorization check functions for route & action permissions.
--   4. Enforce workflow-based approval authority and self-approval denial baseline.
-- =============================================================================

BEGIN;

-- 1. Insert Canonical Phase 3 Permissions into public.permissions
INSERT INTO public.permissions (id, module, description) VALUES
    ('profile.view.self', 'profile', 'View own employee profile and assigned permissions'),
    ('projects.view', 'projects', 'View SCM projects, work breakdown structures, and milestones'),
    ('materials.view', 'materials', 'View material requirements, bill of materials (BOM), and categories'),
    ('budgets.view', 'budgets', 'View departmental budget allocations, caps, and expenditure ledgers'),
    ('approvals.view', 'approvals', 'View pending approval queues assigned via authorized approval workflows'),
    ('procurement.view', 'procurement', 'View purchase requisitions (PR) and purchase orders (PO)'),
    ('deliveries.view', 'logistics', 'View delivery schedules, shipment tracking, and delivery reminders'),
    ('reports.view', 'reports', 'View analytical reports, compliance metrics, and operational dashboards'),
    ('employees.manage', 'administration', 'Manage employee access list, designations, and role assignments'),
    ('employees.import', 'administration', 'Perform CSV/Excel employee list imports and review batch results'),
    ('audit.view', 'security', 'View immutable security audit logs and administrative event history'),
    ('settings.system.manage', 'settings', 'Manage global system parameters, authentication rules, and RLS policies'),
    ('settings.scm.manage', 'settings', 'Manage SCM business settings: categories, currency, and reminder intervals')
ON CONFLICT (id) DO UPDATE
SET module = EXCLUDED.module,
    description = EXCLUDED.description;

-- 2. Populate Role-Permission Baseline in public.role_permissions

-- Super Admin: Full platform administration, employee import & management, role assignment,
-- global settings, audit-log access, and SCM access.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'super_admin', id FROM public.permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- SCM Admin: SCM operations and approved SCM configuration (settings.scm.manage);
-- CANNOT create Super Admins, assign roles, import employees, change global access controls, or view security audit logs.
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_admin', 'profile.view.self'),
    ('scm_admin', 'projects.view'),
    ('scm_admin', 'materials.view'),
    ('scm_admin', 'budgets.view'),
    ('scm_admin', 'procurement.view'),
    ('scm_admin', 'deliveries.view'),
    ('scm_admin', 'reports.view'),
    ('scm_admin', 'settings.scm.manage'),
    ('scm_admin', 'settings.read'),
    ('scm_admin', 'scm.projects.read'),
    ('scm_admin', 'scm.projects.write'),
    ('scm_admin', 'scm.workflows.manage'),
    ('scm_admin', 'scm.requisitions.write'),
    ('scm_admin', 'scm.orders.authorize'),
    ('scm_admin', 'scm.receiving.write'),
    ('scm_admin', 'scm.invoices.verify')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- SCM Team User: Permitted SCM work within assigned scope;
-- CANNOT manage employees, roles, global settings, view audit logs, or view budgets/reports.
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_team_user', 'profile.view.self'),
    ('scm_team_user', 'projects.view'),
    ('scm_team_user', 'materials.view'),
    ('scm_team_user', 'procurement.view'),
    ('scm_team_user', 'deliveries.view'),
    ('scm_team_user', 'scm.projects.read'),
    ('scm_team_user', 'scm.projects.write'),
    ('scm_team_user', 'scm.requisitions.write'),
    ('scm_team_user', 'scm.receiving.write')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3. Server-side Helper RPC: Verify whether the calling authenticated active user has a specific permission
DROP FUNCTION IF EXISTS public.current_user_has_permission(character varying) CASCADE;
DROP FUNCTION IF EXISTS public.current_user_has_permission(varchar) CASCADE;
DROP FUNCTION IF EXISTS public.current_user_has_permission(text) CASCADE;
DROP FUNCTION IF EXISTS public.current_user_has_permission CASCADE;

CREATE OR REPLACE FUNCTION public.current_user_has_permission(required_permission VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_role VARCHAR;
    v_is_active BOOLEAN;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT assigned_role, is_active INTO v_role, v_is_active
    FROM public.employees
    WHERE user_id = v_user_id;

    IF v_is_active IS NOT TRUE OR v_role IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.role_permissions
        WHERE role_id = v_role AND permission_id = required_permission
    );
END;
$$;

-- 4. Server-side Helper RPC: Verify whether the calling user has ANY of the specified permissions (for OR rules)
CREATE OR REPLACE FUNCTION public.current_user_has_any_permission(p_permissions VARCHAR[])
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_role VARCHAR;
    v_is_active BOOLEAN;
BEGIN
    IF v_user_id IS NULL OR p_permissions IS NULL OR cardinality(p_permissions) = 0 THEN
        RETURN FALSE;
    END IF;

    SELECT assigned_role, is_active INTO v_role, v_is_active
    FROM public.employees
    WHERE user_id = v_user_id;

    IF v_is_active IS NOT TRUE OR v_role IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.role_permissions
        WHERE role_id = v_role AND permission_id = ANY(p_permissions)
    );
END;
$$;

-- 5. Server-side Approval Authority Rule: Deny Self-Approval by Default
-- Approvals must come through explicit workflow assignments, never self-approval or arbitrary role elevation.
CREATE OR REPLACE FUNCTION public.check_can_approve(
    p_step_id UUID,
    p_requester_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    -- Rule 1: Deny self-approval by default
    IF v_user_id IS NULL OR v_user_id = p_requester_id THEN
        RETURN FALSE;
    END IF;

    -- Rule 2: Must be an active employee
    IF NOT public.current_user_is_active_employee() THEN
        RETURN FALSE;
    END IF;

    -- Rule 3: Must be an authorized approver for this workflow step
    RETURN EXISTS (
        SELECT 1
        FROM public.approval_workflow_steps s
        JOIN public.approval_workflow_definitions w ON s.workflow_id = w.id
        WHERE s.id = p_step_id
          AND s.approver_id = v_user_id
          AND w.is_active = TRUE
    );
END;
$$;

COMMIT;

