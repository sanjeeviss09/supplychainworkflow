-- =============================================================================
-- SCM FLOW — PHASE 11: MATERIAL SUPPLY RISK & CRITICALITY MANAGEMENT
-- File: backend/supabase/migrations/20261103110000_phase11_material_supply_risk.sql
-- =============================================================================

BEGIN;

-- 1. Extend Material Delivery Tracking with Criticality and Internal Required-By Date
ALTER TABLE public.material_delivery_tracking
ADD COLUMN IF NOT EXISTS material_criticality VARCHAR(20) DEFAULT 'Medium' NOT NULL 
    CHECK (material_criticality IN ('Low', 'Medium', 'High', 'Critical')),
ADD COLUMN IF NOT EXISTS required_by_date DATE,
ADD COLUMN IF NOT EXISTS business_impact_level VARCHAR(20) DEFAULT 'Medium' NOT NULL 
    CHECK (business_impact_level IN ('Low', 'Medium', 'High', 'Critical')),
ADD COLUMN IF NOT EXISTS required_by_reason TEXT,
ADD COLUMN IF NOT EXISTS required_by_updated_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS required_by_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_mdt_criticality ON public.material_delivery_tracking(material_criticality);
CREATE INDEX IF NOT EXISTS idx_mdt_required_by ON public.material_delivery_tracking(required_by_date);


-- 2. Sequence for Risk Number Generation: RSK-YYYY-XXXX
CREATE SEQUENCE IF NOT EXISTS public.seq_supply_risk_number START WITH 1001 INCREMENT BY 1;


-- 3. Supply Risk Records Master Table
CREATE TABLE IF NOT EXISTS public.supply_risk_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    risk_number VARCHAR(50) UNIQUE NOT NULL,
    tracking_id UUID NOT NULL REFERENCES public.material_delivery_tracking(id) ON DELETE RESTRICT,
    sap_po_number VARCHAR(50) NOT NULL,
    sap_po_line_number VARCHAR(20) NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    supplier_name VARCHAR(255) NOT NULL,
    material_code VARCHAR(50),
    material_description VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    material_criticality VARCHAR(20) NOT NULL CHECK (material_criticality IN ('Low', 'Medium', 'High', 'Critical')),
    business_impact_level VARCHAR(20) NOT NULL CHECK (business_impact_level IN ('Low', 'Medium', 'High', 'Critical')),
    required_by_date DATE,
    original_committed_delivery_date DATE,
    current_expected_delivery_date DATE,
    risk_score INTEGER NOT NULL DEFAULT 0,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High', 'Critical')),
    risk_explanation TEXT NOT NULL,
    risk_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(30) DEFAULT 'Identified' NOT NULL 
        CHECK (status IN ('Identified', 'Under Assessment', 'Mitigation Planned', 'Monitoring', 'Resolved', 'Closed')),
    risk_owner_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    identified_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_srr_tracking ON public.supply_risk_records(tracking_id);
CREATE INDEX IF NOT EXISTS idx_srr_risk_level ON public.supply_risk_records(risk_level);
CREATE INDEX IF NOT EXISTS idx_srr_status ON public.supply_risk_records(status);
CREATE INDEX IF NOT EXISTS idx_srr_owner ON public.supply_risk_records(risk_owner_id);
CREATE INDEX IF NOT EXISTS idx_srr_supplier ON public.supply_risk_records(supplier_id);
CREATE INDEX IF NOT EXISTS idx_srr_category ON public.supply_risk_records(category);


-- 4. Risk Mitigation Actions Table
CREATE TABLE IF NOT EXISTS public.risk_mitigation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    risk_id UUID NOT NULL REFERENCES public.supply_risk_records(id) ON DELETE CASCADE,
    action_title VARCHAR(255) NOT NULL,
    action_description TEXT NOT NULL,
    assigned_employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    due_date DATE NOT NULL,
    priority VARCHAR(20) DEFAULT 'Medium' NOT NULL CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    status VARCHAR(30) DEFAULT 'Pending' NOT NULL CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
    followup_remarks TEXT,
    outcome TEXT,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rma_risk ON public.risk_mitigation_actions(risk_id);
CREATE INDEX IF NOT EXISTS idx_rma_assigned ON public.risk_mitigation_actions(assigned_employee_id);
CREATE INDEX IF NOT EXISTS idx_rma_due_date ON public.risk_mitigation_actions(due_date);
CREATE INDEX IF NOT EXISTS idx_rma_status ON public.risk_mitigation_actions(status);


-- 5. Supply Risk Events / Audit Trail Table
CREATE TABLE IF NOT EXISTS public.supply_risk_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    risk_id UUID NOT NULL REFERENCES public.supply_risk_records(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    old_state JSONB,
    new_state JSONB,
    change_reason TEXT NOT NULL,
    performed_by UUID REFERENCES auth.users(id) NOT NULL,
    performed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sre_risk ON public.supply_risk_events(risk_id);
CREATE INDEX IF NOT EXISTS idx_sre_event_type ON public.supply_risk_events(event_type);


-- 6. Seed Granular Permissions for Supply Risk Management
INSERT INTO public.permissions (id, module, description) VALUES
    ('supply_risk.view', 'supply_risk', 'View material supply risk dashboard, risk register, and criticality indicators'),
    ('supply_risk.create', 'supply_risk', 'Register supply risk assessments and record operational required-by dates'),
    ('supply_risk.update', 'supply_risk', 'Update supply risk evaluation, material criticality, and business impact'),
    ('supply_risk.mitigate', 'supply_risk', 'Assign, update, and monitor risk mitigation actions and recovery plans'),
    ('supply_risk.resolve', 'supply_risk', 'Resolve or close evaluated material supply risk records with audit rationale'),
    ('supply_risk.export', 'supply_risk', 'Export critical material risk reports and mitigation action registers to CSV/Excel')
ON CONFLICT (id) DO UPDATE 
SET module = EXCLUDED.module,
    description = EXCLUDED.description;


-- 7. Map Permissions to Roles
-- Super Admin
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('super_admin', 'supply_risk.view'),
    ('super_admin', 'supply_risk.create'),
    ('super_admin', 'supply_risk.update'),
    ('super_admin', 'supply_risk.mitigate'),
    ('super_admin', 'supply_risk.resolve'),
    ('super_admin', 'supply_risk.export')
ON CONFLICT DO NOTHING;

-- SCM Admin
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_admin', 'supply_risk.view'),
    ('scm_admin', 'supply_risk.create'),
    ('scm_admin', 'supply_risk.update'),
    ('scm_admin', 'supply_risk.mitigate'),
    ('scm_admin', 'supply_risk.resolve'),
    ('scm_admin', 'supply_risk.export')
ON CONFLICT DO NOTHING;

-- SCM Team User (Operational risk view, mitigation updates, and action tracking)
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_team_user', 'supply_risk.view'),
    ('scm_team_user', 'supply_risk.create'),
    ('scm_team_user', 'supply_risk.update'),
    ('scm_team_user', 'supply_risk.mitigate')
ON CONFLICT DO NOTHING;


-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.supply_risk_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_mitigation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_risk_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supply_risk_records_select_policy" ON public.supply_risk_records
    FOR SELECT TO authenticated
    USING (public.current_user_has_permission('supply_risk.view'));

CREATE POLICY "risk_mitigation_actions_select_policy" ON public.risk_mitigation_actions
    FOR SELECT TO authenticated
    USING (public.current_user_has_permission('supply_risk.view'));

CREATE POLICY "supply_risk_events_select_policy" ON public.supply_risk_events
    FOR SELECT TO authenticated
    USING (public.current_user_has_permission('supply_risk.view'));


-- 9. Authoritative Function: Calculate Supply Risk Score & Factors
CREATE OR REPLACE FUNCTION public.calculate_supply_risk_score(
    p_criticality VARCHAR,
    p_impact VARCHAR,
    p_required_by_date DATE,
    p_current_expected_date DATE,
    p_original_committed_date DATE,
    p_delivered_qty NUMERIC,
    p_ordered_qty NUMERIC,
    p_has_critical_issue BOOLEAN DEFAULT false
)
RETURNS TABLE (
    calculated_score INTEGER,
    calculated_level VARCHAR,
    factors_json JSONB,
    explanation_text TEXT
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_score INTEGER := 0;
    v_level VARCHAR(20);
    v_factors TEXT[] := ARRAY[]::TEXT[];
    v_today_ist DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE;
BEGIN
    -- 1. Material Criticality Factor
    IF p_criticality = 'Critical' THEN
        v_score := v_score + 35;
        v_factors := array_append(v_factors, 'Material Criticality is Critical (+35)');
    ELSIF p_criticality = 'High' THEN
        v_score := v_score + 25;
        v_factors := array_append(v_factors, 'Material Criticality is High (+25)');
    ELSIF p_criticality = 'Medium' THEN
        v_score := v_score + 15;
        v_factors := array_append(v_factors, 'Material Criticality is Medium (+15)');
    ELSE
        v_score := v_score + 5;
    END IF;

    -- 2. Business Impact Factor
    IF p_impact = 'Critical' THEN
        v_score := v_score + 30;
        v_factors := array_append(v_factors, 'Operational Business Impact is Critical (+30)');
    ELSIF p_impact = 'High' THEN
        v_score := v_score + 20;
        v_factors := array_append(v_factors, 'Operational Business Impact is High (+20)');
    ELSIF p_impact = 'Medium' THEN
        v_score := v_score + 10;
        v_factors := array_append(v_factors, 'Operational Business Impact is Medium (+10)');
    END IF;

    -- 3. ETA vs Required-by Date Overrun
    IF p_required_by_date IS NOT NULL AND p_current_expected_date IS NOT NULL AND p_current_expected_date > p_required_by_date THEN
        v_score := v_score + 30;
        v_factors := array_append(v_factors, 'Current ETA (' || p_current_expected_date || ') breaches Required-by Date (' || p_required_by_date || ') (+30)');
    ELSIF p_required_by_date IS NOT NULL AND p_required_by_date <= v_today_ist + 3 AND p_delivered_qty < p_ordered_qty THEN
        v_score := v_score + 15;
        v_factors := array_append(v_factors, 'Required-by Date approaching within 3 calendar days (+15)');
    END IF;

    -- 4. Original Delivery Commitment Overdue
    IF p_original_committed_date IS NOT NULL AND v_today_ist > p_original_committed_date AND p_delivered_qty < p_ordered_qty THEN
        v_score := v_score + 20;
        v_factors := array_append(v_factors, 'Past Original Confirmed Commitment (+20)');
    END IF;

    -- 5. Partial Delivery Outstanding
    IF p_delivered_qty > 0 AND p_delivered_qty < p_ordered_qty THEN
        v_score := v_score + 10;
        v_factors := array_append(v_factors, 'Partial Delivery arrived with balance outstanding (+10)');
    END IF;

    -- 6. Active Phase 9 Critical Issue
    IF p_has_critical_issue THEN
        v_score := v_score + 25;
        v_factors := array_append(v_factors, 'Active Phase 9 Critical/High Delivery Issue/Escalation (+25)');
    END IF;

    -- Determine Risk Level Threshold
    IF v_score >= 70 THEN
        v_level := 'Critical';
    ELSIF v_score >= 45 THEN
        v_level := 'High';
    ELSIF v_score >= 25 THEN
        v_level := 'Medium';
    ELSE
        v_level := 'Low';
    END IF;

    calculated_score := v_score;
    calculated_level := v_level;
    factors_json := to_jsonb(v_factors);
    explanation_text := array_to_string(v_factors, '; ');

    RETURN NEXT;
END;
$$;


-- 10. RPC: Update PO Line Criticality & Required-By Date (and evaluate risk)
CREATE OR REPLACE FUNCTION public.api_update_po_line_criticality_and_required_date(
    p_tracking_id UUID,
    p_criticality VARCHAR,
    p_impact VARCHAR,
    p_required_by_date DATE DEFAULT NULL,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_tracking RECORD;
    v_uid UUID := auth.uid();
    v_has_critical_issue BOOLEAN := false;
    v_score_rec RECORD;
    v_risk_id UUID;
    v_risk_number VARCHAR(50);
    v_emp_id UUID;
BEGIN
    IF NOT public.current_user_has_permission('supply_risk.update') 
       AND NOT public.current_user_has_permission('supply_risk.create') THEN
        RAISE EXCEPTION 'Access denied: You do not have permission to update material supply criticality.';
    END IF;

    SELECT * INTO v_tracking FROM public.material_delivery_tracking WHERE id = p_tracking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tracking record not found: %', p_tracking_id;
    END IF;

    -- Check for Phase 9 critical issue
    SELECT EXISTS (
        SELECT 1 FROM public.delivery_issues 
        WHERE tracking_id = p_tracking_id AND status NOT IN ('Resolved', 'Closed') AND severity IN ('High', 'Critical')
    ) INTO v_has_critical_issue;

    -- Update tracking row
    UPDATE public.material_delivery_tracking
    SET material_criticality = p_criticality,
        business_impact_level = p_impact,
        required_by_date = p_required_by_date,
        required_by_reason = p_reason,
        required_by_updated_by = v_uid,
        required_by_updated_at = now()
    WHERE id = p_tracking_id;

    -- Calculate risk score
    SELECT * INTO v_score_rec FROM public.calculate_supply_risk_score(
        p_criticality,
        p_impact,
        p_required_by_date,
        v_tracking.current_expected_delivery_date,
        v_tracking.original_committed_delivery_date,
        v_tracking.delivered_quantity,
        v_tracking.ordered_quantity,
        v_has_critical_issue
    );

    -- Find existing active risk record for tracking
    SELECT id INTO v_risk_id FROM public.supply_risk_records 
    WHERE tracking_id = p_tracking_id AND status NOT IN ('Closed') LIMIT 1;

    IF v_risk_id IS NOT NULL THEN
        UPDATE public.supply_risk_records
        SET material_criticality = p_criticality,
            business_impact_level = p_impact,
            required_by_date = p_required_by_date,
            risk_score = v_score_rec.calculated_score,
            risk_level = v_score_rec.calculated_level,
            risk_explanation = v_score_rec.explanation_text,
            risk_factors = v_score_rec.factors_json,
            updated_by = v_uid,
            updated_at = now()
        WHERE id = v_risk_id;

        INSERT INTO public.supply_risk_events (
            risk_id,
            event_type,
            change_reason,
            performed_by
        ) VALUES (
            v_risk_id,
            'ASSESSED',
            'Material criticality / required-by date updated: ' || COALESCE(p_reason, 'Operational schedule update'),
            v_uid
        );
    ELSE
        -- Generate new risk record if score is Medium, High, or Critical
        IF v_score_rec.calculated_level IN ('Medium', 'High', 'Critical') THEN
            v_risk_number := 'RSK-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('public.seq_supply_risk_number')::TEXT, 4, '0');

            -- Pick active owner
            v_emp_id := v_tracking.assigned_employee_id;
            IF v_emp_id IS NULL THEN
                SELECT id INTO v_emp_id FROM public.employees WHERE is_active = true LIMIT 1;
            END IF;

            INSERT INTO public.supply_risk_records (
                risk_number,
                tracking_id,
                sap_po_number,
                sap_po_line_number,
                supplier_id,
                supplier_name,
                material_code,
                material_description,
                category,
                material_criticality,
                business_impact_level,
                required_by_date,
                original_committed_delivery_date,
                current_expected_delivery_date,
                risk_score,
                risk_level,
                risk_explanation,
                risk_factors,
                status,
                risk_owner_id,
                created_by
            ) VALUES (
                v_risk_number,
                v_tracking.id,
                v_tracking.sap_po_number,
                v_tracking.sap_po_line_number,
                v_tracking.supplier_id,
                v_tracking.supplier_name,
                v_tracking.material_code,
                v_tracking.material_description,
                v_tracking.category,
                p_criticality,
                p_impact,
                p_required_by_date,
                v_tracking.original_committed_delivery_date,
                v_tracking.current_expected_delivery_date,
                v_score_rec.calculated_score,
                v_score_rec.calculated_level,
                v_score_rec.explanation_text,
                v_score_rec.factors_json,
                'Identified',
                v_emp_id,
                v_uid
            ) RETURNING id INTO v_risk_id;

            INSERT INTO public.supply_risk_events (
                risk_id,
                event_type,
                new_state,
                change_reason,
                performed_by
            ) VALUES (
                v_risk_id,
                'IDENTIFIED',
                jsonb_build_object('risk_level', v_score_rec.calculated_level, 'score', v_score_rec.calculated_score),
                'Supply risk condition identified from operational parameters',
                v_uid
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'risk_id', v_risk_id,
        'calculated_level', v_score_rec.calculated_level,
        'calculated_score', v_score_rec.calculated_score
    );
END;
$$;


-- 11. RPC: Add Risk Mitigation Action
CREATE OR REPLACE FUNCTION public.api_create_risk_mitigation_action(
    p_risk_id UUID,
    p_action_title VARCHAR,
    p_action_description TEXT,
    p_assigned_employee_id UUID,
    p_due_date DATE,
    p_priority VARCHAR DEFAULT 'Medium'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_risk RECORD;
    v_action_id UUID;
    v_uid UUID := auth.uid();
BEGIN
    IF NOT public.current_user_has_permission('supply_risk.mitigate') THEN
        RAISE EXCEPTION 'Access denied: You do not have permission to assign risk mitigation actions.';
    END IF;

    SELECT * INTO v_risk FROM public.supply_risk_records WHERE id = p_risk_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Supply risk record not found: %', p_risk_id;
    END IF;

    INSERT INTO public.risk_mitigation_actions (
        risk_id,
        action_title,
        action_description,
        assigned_employee_id,
        due_date,
        priority,
        status,
        created_by
    ) VALUES (
        p_risk_id,
        trim(p_action_title),
        trim(p_action_description),
        p_assigned_employee_id,
        p_due_date,
        p_priority,
        'Pending',
        v_uid
    ) RETURNING id INTO v_action_id;

    -- Transition risk status to 'Mitigation Planned' if currently 'Identified' or 'Under Assessment'
    IF v_risk.status IN ('Identified', 'Under Assessment') THEN
        UPDATE public.supply_risk_records
        SET status = 'Mitigation Planned',
            updated_by = v_uid,
            updated_at = now()
        WHERE id = p_risk_id;
    END IF;

    INSERT INTO public.supply_risk_events (
        risk_id,
        event_type,
        new_state,
        change_reason,
        performed_by
    ) VALUES (
        p_risk_id,
        'ACTION_ASSIGNED',
        jsonb_build_object('action_title', p_action_title, 'due_date', p_due_date, 'assigned_to', p_assigned_employee_id),
        'Mitigation action scheduled to address supply risk',
        v_uid
    );

    RETURN jsonb_build_object('success', true, 'action_id', v_action_id);
END;
$$;


-- 12. RPC: Resolve or Transition Supply Risk
CREATE OR REPLACE FUNCTION public.api_transition_supply_risk(
    p_risk_id UUID,
    p_new_status VARCHAR,
    p_explanation TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_risk RECORD;
    v_uid UUID := auth.uid();
BEGIN
    SELECT * INTO v_risk FROM public.supply_risk_records WHERE id = p_risk_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Supply risk record not found: %', p_risk_id;
    END IF;

    IF p_new_status = 'Resolved' THEN
        IF NOT public.current_user_has_permission('supply_risk.resolve') THEN
            RAISE EXCEPTION 'Access denied: You do not have permission to resolve supply risks.';
        END IF;

        UPDATE public.supply_risk_records
        SET status = 'Resolved',
            resolved_at = now(),
            updated_by = v_uid,
            updated_at = now()
        WHERE id = p_risk_id;
    ELSIF p_new_status = 'Closed' THEN
        IF NOT public.current_user_has_permission('supply_risk.resolve') THEN
            RAISE EXCEPTION 'Access denied: You do not have permission to close supply risks.';
        END IF;

        UPDATE public.supply_risk_records
        SET status = 'Closed',
            closed_at = now(),
            updated_by = v_uid,
            updated_at = now()
        WHERE id = p_risk_id;
    ELSE
        IF NOT public.current_user_has_permission('supply_risk.update') THEN
            RAISE EXCEPTION 'Access denied: You do not have permission to transition supply risks.';
        END IF;

        UPDATE public.supply_risk_records
        SET status = p_new_status,
            updated_by = v_uid,
            updated_at = now()
        WHERE id = p_risk_id;
    END IF;

    INSERT INTO public.supply_risk_events (
        risk_id,
        event_type,
        old_state,
        new_state,
        change_reason,
        performed_by
    ) VALUES (
        p_risk_id,
        'STATUS_CHANGED',
        jsonb_build_object('status', v_risk.status),
        jsonb_build_object('status', p_new_status),
        trim(p_explanation),
        v_uid
    );

    RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$$;


-- 13. Grant Executions
GRANT EXECUTE ON FUNCTION public.calculate_supply_risk_score(VARCHAR, VARCHAR, DATE, DATE, DATE, NUMERIC, NUMERIC, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.api_update_po_line_criticality_and_required_date(UUID, VARCHAR, VARCHAR, DATE, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.api_create_risk_mitigation_action(UUID, VARCHAR, TEXT, UUID, DATE, VARCHAR) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.api_transition_supply_risk(UUID, VARCHAR, TEXT) TO authenticated, service_role;

COMMIT;

