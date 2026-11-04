-- =============================================================================
-- SCM FLOW — DEVELOPMENT SEED DATA (LOCAL / DEV ENVIRONMENT ONLY)
-- File: backend/supabase/seed.sql
-- WARNING: DO NOT EXECUTE THIS SEED SCRIPT IN PRODUCTION.
-- Contains synthetic employee directory records (@scmflow.internal) for local testing.
-- Per Phase 2 security requirements, no passwords are seeded or stored in database
-- records or client code.
-- =============================================================================

BEGIN;

-- 1. Seed Synthetic Development Employee Records (Pre-enrolled in HR list for testing)
INSERT INTO public.employees (
    employee_id, full_name, email, department, designation, assigned_role, is_active, must_change_password
) VALUES
    ('AXX09', 'Dev System Administrator', 'axx09@scmflow.internal', 'Supply Chain Management', 'System Administrator', 'super_admin', true, true),
    ('EMP-1001', 'Dev SCM Administrator', 'scm.admin@scmflow.internal', 'Supply Chain Management', 'SCM Manager', 'scm_admin', true, false),
    ('EMP-1002', 'Dev SCM Team Analyst', 'scm.team@scmflow.internal', 'Formulations & Synthesis', 'Procurement Executive', 'scm_team_user', true, false),
    ('EMP-1003', 'Dev Inactive Account', 'inactive.user@scmflow.internal', 'Quality Assurance & Control', 'QC Officer', 'scm_team_user', false, false)
ON CONFLICT (employee_id) DO UPDATE
SET full_name = EXCLUDED.full_name,
    department = EXCLUDED.department,
    designation = EXCLUDED.designation,
    assigned_role = EXCLUDED.assigned_role,
    is_active = EXCLUDED.is_active;

-- 2. Optional helper for local CLI provisioning of AXX09
-- Requires the developer to pass an explicit password at runtime (never hardcoded in SQL or client code),
-- or developers can activate AXX09 directly via the standard /signup self-registration page.
CREATE OR REPLACE FUNCTION public.provision_dev_account_axx09(p_runtime_password TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_test_uid UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    IF p_runtime_password IS NULL OR length(trim(p_runtime_password)) < 6 THEN
        RAISE EXCEPTION 'An explicit runtime password (min 6 chars) must be supplied to provision_dev_account_axx09().';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'axx09@scmflow.internal') THEN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_test_uid,
            'authenticated',
            'authenticated',
            'axx09@scmflow.internal',
            crypt(p_runtime_password, gen_salt('bf')),
            now(),
            '{"provider":"email","providers":["email"]}',
            '{"employee_id":"AXX09","full_name":"Dev System Administrator"}',
            now(),
            now()
        );

        UPDATE public.employees
        SET user_id = v_test_uid,
            must_change_password = true
        WHERE employee_id = 'AXX09';

        INSERT INTO public.profiles (id, email, first_name, last_name, is_active)
        VALUES (v_test_uid, 'axx09@scmflow.internal', 'Dev System', 'Administrator', true)
        ON CONFLICT (id) DO UPDATE SET is_active = true;

        INSERT INTO public.user_roles (user_id, role_id)
        VALUES (v_test_uid, 'super_admin')
        ON CONFLICT (user_id, role_id) DO NOTHING;
    END IF;
END;
$$;

COMMIT;
