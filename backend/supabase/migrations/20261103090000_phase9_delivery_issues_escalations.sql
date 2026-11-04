-- =============================================================================
-- SCM FLOW — PHASE 9: DELIVERY ISSUE & ESCALATION MANAGEMENT
-- File: backend/supabase/migrations/20261103090000_phase9_delivery_issues_escalations.sql
-- =============================================================================

BEGIN;

-- 1. Sequential Issue Number Generator Sequence
CREATE SEQUENCE IF NOT EXISTS public.seq_delivery_issue_number START WITH 1001 INCREMENT BY 1;

-- 2. Delivery Issues Master Table
CREATE TABLE IF NOT EXISTS public.delivery_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_number VARCHAR(50) UNIQUE NOT NULL,
    tracking_id UUID NOT NULL REFERENCES public.material_delivery_tracking(id) ON DELETE RESTRICT,
    sap_po_number VARCHAR(50) NOT NULL,
    sap_po_line_number VARCHAR(20) NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    supplier_name VARCHAR(255) NOT NULL,
    material_code VARCHAR(50),
    material_description VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    issue_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    status VARCHAR(30) DEFAULT 'Open' NOT NULL 
        CHECK (status IN ('Open', 'In Progress', 'Awaiting Supplier', 'Escalated', 'Resolved', 'Closed')),
    description TEXT NOT NULL,
    reported_date DATE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE NOT NULL,
    initial_action_required TEXT,
    assigned_employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    next_followup_date DATE,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_di_tracking ON public.delivery_issues(tracking_id);
CREATE INDEX IF NOT EXISTS idx_di_po_line ON public.delivery_issues(sap_po_number, sap_po_line_number);
CREATE INDEX IF NOT EXISTS idx_di_supplier ON public.delivery_issues(supplier_id);
CREATE INDEX IF NOT EXISTS idx_di_assigned ON public.delivery_issues(assigned_employee_id);
CREATE INDEX IF NOT EXISTS idx_di_status ON public.delivery_issues(status);
CREATE INDEX IF NOT EXISTS idx_di_severity ON public.delivery_issues(severity);
CREATE INDEX IF NOT EXISTS idx_di_next_followup ON public.delivery_issues(next_followup_date);


-- 3. Delivery Issue Attachments Table
CREATE TABLE IF NOT EXISTS public.delivery_issue_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES public.delivery_issues(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_key TEXT NOT NULL,
    file_type VARCHAR(100),
    file_size_bytes BIGINT,
    uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dia_issue ON public.delivery_issue_attachments(issue_id);


-- 4. Delivery Issue Follow-ups Table
CREATE TABLE IF NOT EXISTS public.delivery_issue_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES public.delivery_issues(id) ON DELETE CASCADE,
    followup_date TIMESTAMPTZ DEFAULT now() NOT NULL,
    contact_method VARCHAR(50) NOT NULL CHECK (contact_method IN ('Email', 'Phone', 'Meeting', 'Other')),
    contact_person VARCHAR(255),
    initiated_by UUID REFERENCES public.employees(id) ON DELETE RESTRICT NOT NULL,
    supplier_response TEXT,
    committed_action TEXT,
    revised_expected_date DATE,
    next_followup_date DATE,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dif_issue ON public.delivery_issue_followups(issue_id);
CREATE INDEX IF NOT EXISTS idx_dif_date ON public.delivery_issue_followups(followup_date);


-- 5. Delivery Issue Escalations Table
CREATE TABLE IF NOT EXISTS public.delivery_issue_escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES public.delivery_issues(id) ON DELETE CASCADE,
    escalation_level VARCHAR(50) NOT NULL,
    trigger_reason TEXT NOT NULL,
    escalated_by UUID REFERENCES auth.users(id) NOT NULL,
    recipient_role VARCHAR(50),
    recipient_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    required_action TEXT NOT NULL,
    expected_response_date DATE,
    escalation_outcome TEXT,
    escalation_status VARCHAR(30) DEFAULT 'Escalated' NOT NULL 
        CHECK (escalation_status IN ('Escalated', 'Acknowledged', 'Action Taken', 'De-escalated')),
    escalated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_die_issue ON public.delivery_issue_escalations(issue_id);
CREATE INDEX IF NOT EXISTS idx_die_status ON public.delivery_issue_escalations(escalation_status);


-- 6. Delivery Issue Resolutions Table
CREATE TABLE IF NOT EXISTS public.delivery_issue_resolutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID UNIQUE NOT NULL REFERENCES public.delivery_issues(id) ON DELETE CASCADE,
    resolution_category VARCHAR(100) NOT NULL,
    resolution_description TEXT NOT NULL,
    requires_further_followup BOOLEAN DEFAULT false NOT NULL,
    next_operational_action TEXT,
    resolved_by UUID REFERENCES auth.users(id) NOT NULL,
    resolved_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dir_issue ON public.delivery_issue_resolutions(issue_id);


-- 7. Delivery Issue Events / Audit Trail Table
CREATE TABLE IF NOT EXISTS public.delivery_issue_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID NOT NULL REFERENCES public.delivery_issues(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    old_state JSONB,
    new_state JSONB,
    change_reason TEXT NOT NULL,
    performed_by UUID REFERENCES auth.users(id) NOT NULL,
    performed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_die_events_issue ON public.delivery_issue_events(issue_id);
CREATE INDEX IF NOT EXISTS idx_die_events_type ON public.delivery_issue_events(event_type);


-- 8. Seed Granular Permissions for Delivery Issues
INSERT INTO public.permissions (id, module, description) VALUES
    ('delivery_issues.view', 'delivery_issues', 'View delivery issues register, details, and follow-ups'),
    ('delivery_issues.create', 'delivery_issues', 'Create delivery issues from PO lines or issue register'),
    ('delivery_issues.update', 'delivery_issues', 'Update delivery issue details and follow-up schedules'),
    ('delivery_issues.reassign', 'delivery_issues', 'Reassign delivery issue ownership to another active employee'),
    ('delivery_issues.escalate', 'delivery_issues', 'Escalate delivery issues with trigger rationale and target recipient'),
    ('delivery_issues.resolve', 'delivery_issues', 'Resolve delivery issues with root-cause category and evidence'),
    ('delivery_issues.close', 'delivery_issues', 'Confirm closure or reopen resolved delivery issues'),
    ('delivery_issues.export', 'delivery_issues', 'Export delivery issue register and escalation logs to CSV/Excel')
ON CONFLICT (id) DO UPDATE 
SET module = EXCLUDED.module,
    description = EXCLUDED.description;


-- 9. Map Permissions to Roles
-- Super Admin
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('super_admin', 'delivery_issues.view'),
    ('super_admin', 'delivery_issues.create'),
    ('super_admin', 'delivery_issues.update'),
    ('super_admin', 'delivery_issues.reassign'),
    ('super_admin', 'delivery_issues.escalate'),
    ('super_admin', 'delivery_issues.resolve'),
    ('super_admin', 'delivery_issues.close'),
    ('super_admin', 'delivery_issues.export')
ON CONFLICT DO NOTHING;

-- SCM Admin
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_admin', 'delivery_issues.view'),
    ('scm_admin', 'delivery_issues.create'),
    ('scm_admin', 'delivery_issues.update'),
    ('scm_admin', 'delivery_issues.reassign'),
    ('scm_admin', 'delivery_issues.escalate'),
    ('scm_admin', 'delivery_issues.resolve'),
    ('scm_admin', 'delivery_issues.close'),
    ('scm_admin', 'delivery_issues.export')
ON CONFLICT DO NOTHING;

-- SCM Team User (Operational issue tracking, creation, follow-ups, escalation within scope)
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_team_user', 'delivery_issues.view'),
    ('scm_team_user', 'delivery_issues.create'),
    ('scm_team_user', 'delivery_issues.update'),
    ('scm_team_user', 'delivery_issues.escalate'),
    ('scm_team_user', 'delivery_issues.resolve')
ON CONFLICT DO NOTHING;


-- 10. Enable Row Level Security
ALTER TABLE public.delivery_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_issue_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_issue_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_issue_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_issue_resolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_issue_events ENABLE ROW LEVEL SECURITY;

-- Select policy: Authorized users with delivery_issues.view can inspect records
CREATE POLICY "delivery_issues_select_policy" ON public.delivery_issues
    FOR SELECT TO authenticated
    USING (public.current_user_has_permission('delivery_issues.view'));

CREATE POLICY "delivery_issue_attachments_select_policy" ON public.delivery_issue_attachments
    FOR SELECT TO authenticated
    USING (public.current_user_has_permission('delivery_issues.view'));

CREATE POLICY "delivery_issue_followups_select_policy" ON public.delivery_issue_followups
    FOR SELECT TO authenticated
    USING (public.current_user_has_permission('delivery_issues.view'));

CREATE POLICY "delivery_issue_escalations_select_policy" ON public.delivery_issue_escalations
    FOR SELECT TO authenticated
    USING (public.current_user_has_permission('delivery_issues.view'));

CREATE POLICY "delivery_issue_resolutions_select_policy" ON public.delivery_issue_resolutions
    FOR SELECT TO authenticated
    USING (public.current_user_has_permission('delivery_issues.view'));

CREATE POLICY "delivery_issue_events_select_policy" ON public.delivery_issue_events
    FOR SELECT TO authenticated
    USING (public.current_user_has_permission('delivery_issues.view'));


-- 11. RPC: Create Delivery Issue with Validations & Audit Event
CREATE OR REPLACE FUNCTION public.api_create_delivery_issue(
    p_tracking_id UUID,
    p_issue_type VARCHAR,
    p_severity VARCHAR,
    p_description TEXT,
    p_reported_date DATE,
    p_assigned_employee_id UUID,
    p_initial_action_required TEXT DEFAULT NULL,
    p_next_followup_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_tracking RECORD;
    v_emp RECORD;
    v_issue_number VARCHAR(50);
    v_issue_id UUID;
    v_uid UUID := auth.uid();
BEGIN
    -- Authorization check
    IF NOT public.current_user_has_permission('delivery_issues.create') THEN
        RAISE EXCEPTION 'Access denied: You do not have permission to create delivery issues.';
    END IF;

    -- Validate tracking record
    SELECT * INTO v_tracking FROM public.material_delivery_tracking WHERE id = p_tracking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid PO line tracking ID: %', p_tracking_id;
    END IF;

    IF v_tracking.delivery_status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Cannot log an issue against a cancelled PO line delivery tracking record.';
    END IF;

    -- Validate assigned employee
    SELECT * INTO v_emp FROM public.employees WHERE id = p_assigned_employee_id;
    IF NOT FOUND OR NOT v_emp.is_active THEN
        RAISE EXCEPTION 'Assigned issue owner must be an active employee.';
    END IF;

    -- Validate severity
    IF p_severity NOT IN ('Low', 'Medium', 'High', 'Critical') THEN
        RAISE EXCEPTION 'Invalid severity: %. Must be Low, Medium, High, or Critical.', p_severity;
    END IF;

    -- Generate issue number: ISS-YYYY-XXXX
    v_issue_number := 'ISS-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('public.seq_delivery_issue_number')::TEXT, 4, '0');

    -- Insert issue
    INSERT INTO public.delivery_issues (
        issue_number,
        tracking_id,
        sap_po_number,
        sap_po_line_number,
        supplier_id,
        supplier_name,
        material_code,
        material_description,
        category,
        issue_type,
        severity,
        status,
        description,
        reported_date,
        initial_action_required,
        assigned_employee_id,
        next_followup_date,
        created_by,
        created_at,
        updated_by,
        updated_at
    ) VALUES (
        v_issue_number,
        v_tracking.id,
        v_tracking.sap_po_number,
        v_tracking.sap_po_line_number,
        v_tracking.supplier_id,
        v_tracking.supplier_name,
        v_tracking.material_code,
        v_tracking.material_description,
        v_tracking.category,
        p_issue_type,
        p_severity,
        'Open',
        trim(p_description),
        COALESCE(p_reported_date, (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE),
        p_initial_action_required,
        p_assigned_employee_id,
        p_next_followup_date,
        v_uid,
        now(),
        v_uid,
        now()
    ) RETURNING id INTO v_issue_id;

    -- Record event in issue audit trail
    INSERT INTO public.delivery_issue_events (
        issue_id,
        event_type,
        new_state,
        change_reason,
        performed_by
    ) VALUES (
        v_issue_id,
        'CREATED',
        jsonb_build_object(
            'issue_number', v_issue_number,
            'issue_type', p_issue_type,
            'severity', p_severity,
            'status', 'Open',
            'assigned_employee_id', p_assigned_employee_id
        ),
        'Issue registered at SAP PO line',
        v_uid
    );

    -- Optional notification to assigned employee user if linked
    IF v_emp.user_id IS NOT NULL THEN
        INSERT INTO public.notifications (
            recipient_user_id,
            notification_type,
            title,
            message,
            related_entity_type,
            related_entity_id
        ) VALUES (
            v_emp.user_id,
            'DELIVERY_ISSUE_ASSIGNED',
            'New Delivery Issue Assigned: ' || v_issue_number,
            'You have been assigned as the owner of delivery issue ' || v_issue_number || ' for PO ' || v_tracking.sap_po_number || ' Line ' || v_tracking.sap_po_line_number || '.',
            'delivery_issues',
            v_issue_id
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'issue_id', v_issue_id,
        'issue_number', v_issue_number
    );
END;
$$;


-- 12. RPC: Add Follow-up to Delivery Issue
CREATE OR REPLACE FUNCTION public.api_add_issue_followup(
    p_issue_id UUID,
    p_contact_method VARCHAR,
    p_contact_person VARCHAR,
    p_supplier_response TEXT,
    p_committed_action TEXT,
    p_revised_expected_date DATE DEFAULT NULL,
    p_next_followup_date DATE DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_issue RECORD;
    v_emp_id UUID;
    v_uid UUID := auth.uid();
    v_followup_id UUID;
BEGIN
    -- Permission check
    IF NOT public.current_user_has_permission('delivery_issues.update') THEN
        RAISE EXCEPTION 'Access denied: You do not have permission to log delivery issue follow-ups.';
    END IF;

    SELECT * INTO v_issue FROM public.delivery_issues WHERE id = p_issue_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Delivery issue not found: %', p_issue_id;
    END IF;

    -- Lookup acting employee
    SELECT id INTO v_emp_id FROM public.employees WHERE user_id = v_uid AND is_active = true LIMIT 1;
    IF v_emp_id IS NULL THEN
        v_emp_id := v_issue.assigned_employee_id;
    END IF;

    -- Insert follow-up
    INSERT INTO public.delivery_issue_followups (
        issue_id,
        followup_date,
        contact_method,
        contact_person,
        initiated_by,
        supplier_response,
        committed_action,
        revised_expected_date,
        next_followup_date,
        notes,
        created_by
    ) VALUES (
        p_issue_id,
        now(),
        p_contact_method,
        p_contact_person,
        v_emp_id,
        p_supplier_response,
        p_committed_action,
        p_revised_expected_date,
        p_next_followup_date,
        p_notes,
        v_uid
    ) RETURNING id INTO v_followup_id;

    -- Update issue status and next follow-up date
    UPDATE public.delivery_issues
    SET status = CASE 
            WHEN status = 'Open' THEN 'In Progress' 
            WHEN p_supplier_response IS NULL OR trim(p_supplier_response) = '' THEN 'Awaiting Supplier'
            ELSE 'In Progress' 
        END,
        next_followup_date = COALESCE(p_next_followup_date, next_followup_date),
        updated_by = v_uid,
        updated_at = now()
    WHERE id = p_issue_id;

    -- If revised expected date was communicated, record in delivery date history
    IF p_revised_expected_date IS NOT NULL THEN
        UPDATE public.material_delivery_tracking
        SET current_expected_delivery_date = p_revised_expected_date,
            updated_by = v_uid,
            updated_at = now()
        WHERE id = v_issue.tracking_id;

        INSERT INTO public.delivery_date_history (
            tracking_id,
            previous_date,
            new_date,
            reason,
            source,
            changed_by
        ) VALUES (
            v_issue.tracking_id,
            v_issue.next_followup_date,
            p_revised_expected_date,
            'Communicated via Delivery Issue Follow-up: ' || v_issue.issue_number,
            'Supplier Follow-up',
            v_uid
        );
    END IF;

    -- Record event in issue audit
    INSERT INTO public.delivery_issue_events (
        issue_id,
        event_type,
        new_state,
        change_reason,
        performed_by
    ) VALUES (
        p_issue_id,
        'FOLLOW_UP_ADDED',
        jsonb_build_object(
            'followup_id', v_followup_id,
            'contact_method', p_contact_method,
            'revised_expected_date', p_revised_expected_date,
            'next_followup_date', p_next_followup_date
        ),
        'Supplier follow-up interaction recorded',
        v_uid
    );

    RETURN jsonb_build_object(
        'success', true,
        'followup_id', v_followup_id
    );
END;
$$;


-- 13. RPC: Escalate Delivery Issue
CREATE OR REPLACE FUNCTION public.api_escalate_delivery_issue(
    p_issue_id UUID,
    p_escalation_level VARCHAR,
    p_trigger_reason TEXT,
    p_required_action TEXT,
    p_expected_response_date DATE DEFAULT NULL,
    p_recipient_role VARCHAR DEFAULT NULL,
    p_recipient_employee_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_issue RECORD;
    v_uid UUID := auth.uid();
    v_esc_id UUID;
BEGIN
    IF NOT public.current_user_has_permission('delivery_issues.escalate') THEN
        RAISE EXCEPTION 'Access denied: You do not have permission to escalate delivery issues.';
    END IF;

    SELECT * INTO v_issue FROM public.delivery_issues WHERE id = p_issue_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Delivery issue not found: %', p_issue_id;
    END IF;

    IF v_issue.status = 'Closed' THEN
        RAISE EXCEPTION 'Cannot escalate a closed issue. Please reopen it first.';
    END IF;

    -- Insert escalation record
    INSERT INTO public.delivery_issue_escalations (
        issue_id,
        escalation_level,
        trigger_reason,
        escalated_by,
        recipient_role,
        recipient_employee_id,
        required_action,
        expected_response_date,
        escalation_status
    ) VALUES (
        p_issue_id,
        p_escalation_level,
        trim(p_trigger_reason),
        v_uid,
        p_recipient_role,
        p_recipient_employee_id,
        trim(p_required_action),
        p_expected_response_date,
        'Escalated'
    ) RETURNING id INTO v_esc_id;

    -- Update issue status
    UPDATE public.delivery_issues
    SET status = 'Escalated',
        updated_by = v_uid,
        updated_at = now()
    WHERE id = p_issue_id;

    -- Record event in issue audit
    INSERT INTO public.delivery_issue_events (
        issue_id,
        event_type,
        old_state,
        new_state,
        change_reason,
        performed_by
    ) VALUES (
        p_issue_id,
        'ESCALATED',
        jsonb_build_object('status', v_issue.status),
        jsonb_build_object('status', 'Escalated', 'escalation_level', p_escalation_level),
        trim(p_trigger_reason),
        v_uid
    );

    RETURN jsonb_build_object('success', true, 'escalation_id', v_esc_id);
END;
$$;


-- 14. RPC: Resolve Delivery Issue
CREATE OR REPLACE FUNCTION public.api_resolve_delivery_issue(
    p_issue_id UUID,
    p_resolution_category VARCHAR,
    p_resolution_description TEXT,
    p_requires_further_followup BOOLEAN DEFAULT false,
    p_next_operational_action TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_issue RECORD;
    v_uid UUID := auth.uid();
BEGIN
    IF NOT public.current_user_has_permission('delivery_issues.resolve') THEN
        RAISE EXCEPTION 'Access denied: You do not have permission to resolve delivery issues.';
    END IF;

    SELECT * INTO v_issue FROM public.delivery_issues WHERE id = p_issue_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Delivery issue not found: %', p_issue_id;
    END IF;

    -- Upsert resolution record
    INSERT INTO public.delivery_issue_resolutions (
        issue_id,
        resolution_category,
        resolution_description,
        requires_further_followup,
        next_operational_action,
        resolved_by,
        resolved_at
    ) VALUES (
        p_issue_id,
        p_resolution_category,
        trim(p_resolution_description),
        p_requires_further_followup,
        p_next_operational_action,
        v_uid,
        now()
    ) ON CONFLICT (issue_id) DO UPDATE
    SET resolution_category = EXCLUDED.resolution_category,
        resolution_description = EXCLUDED.resolution_description,
        requires_further_followup = EXCLUDED.requires_further_followup,
        next_operational_action = EXCLUDED.next_operational_action,
        resolved_by = EXCLUDED.resolved_by,
        resolved_at = now();

    -- Transition issue to Resolved
    UPDATE public.delivery_issues
    SET status = 'Resolved',
        updated_by = v_uid,
        updated_at = now()
    WHERE id = p_issue_id;

    -- Record event in issue audit
    INSERT INTO public.delivery_issue_events (
        issue_id,
        event_type,
        old_state,
        new_state,
        change_reason,
        performed_by
    ) VALUES (
        p_issue_id,
        'RESOLVED',
        jsonb_build_object('status', v_issue.status),
        jsonb_build_object('status', 'Resolved', 'resolution_category', p_resolution_category),
        trim(p_resolution_description),
        v_uid
    );

    RETURN jsonb_build_object('success', true);
END;
$$;


-- 15. RPC: Close or Reopen Delivery Issue
CREATE OR REPLACE FUNCTION public.api_transition_delivery_issue(
    p_issue_id UUID,
    p_new_status VARCHAR,
    p_explanation TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_issue RECORD;
    v_uid UUID := auth.uid();
BEGIN
    SELECT * INTO v_issue FROM public.delivery_issues WHERE id = p_issue_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Delivery issue not found: %', p_issue_id;
    END IF;

    IF p_new_status = 'Closed' THEN
        IF NOT public.current_user_has_permission('delivery_issues.close') THEN
            RAISE EXCEPTION 'Access denied: You do not have permission to close delivery issues.';
        END IF;

        IF v_issue.status <> 'Resolved' THEN
            RAISE EXCEPTION 'Cannot close an issue that is not in Resolved status.';
        END IF;
    ELSIF p_new_status IN ('In Progress', 'Open') THEN
        IF NOT public.current_user_has_permission('delivery_issues.update') 
           AND NOT public.current_user_has_permission('delivery_issues.close') THEN
            RAISE EXCEPTION 'Access denied: You do not have permission to reopen delivery issues.';
        END IF;
    ELSE
        IF NOT public.current_user_has_permission('delivery_issues.update') THEN
            RAISE EXCEPTION 'Access denied: You do not have permission to transition delivery issues.';
        END IF;
    END IF;

    UPDATE public.delivery_issues
    SET status = p_new_status,
        updated_by = v_uid,
        updated_at = now()
    WHERE id = p_issue_id;

    INSERT INTO public.delivery_issue_events (
        issue_id,
        event_type,
        old_state,
        new_state,
        change_reason,
        performed_by
    ) VALUES (
        p_issue_id,
        CASE WHEN p_new_status = 'Closed' THEN 'CLOSED' ELSE 'STATUS_CHANGED' END,
        jsonb_build_object('status', v_issue.status),
        jsonb_build_object('status', p_new_status),
        trim(p_explanation),
        v_uid
    );

    RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$;


-- 16. Grant Execution
GRANT EXECUTE ON FUNCTION public.api_create_delivery_issue(UUID, VARCHAR, VARCHAR, TEXT, DATE, UUID, TEXT, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.api_add_issue_followup(UUID, VARCHAR, VARCHAR, TEXT, TEXT, DATE, DATE, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.api_escalate_delivery_issue(UUID, VARCHAR, TEXT, TEXT, DATE, VARCHAR, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.api_resolve_delivery_issue(UUID, VARCHAR, TEXT, BOOLEAN, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.api_transition_delivery_issue(UUID, VARCHAR, TEXT) TO authenticated, service_role;

COMMIT;

