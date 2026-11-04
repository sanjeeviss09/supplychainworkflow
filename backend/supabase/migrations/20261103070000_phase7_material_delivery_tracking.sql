-- =============================================================================
-- SCM FLOW — PHASE 7: SAP PROCUREMENT REFERENCE & MATERIAL DELIVERY TRACKING
-- File: backend/supabase/migrations/20261103070000_phase7_material_delivery_tracking.sql
-- =============================================================================

BEGIN;

-- 1. SAP Purchase Requisition References Table
CREATE TABLE IF NOT EXISTS public.sap_pr_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internal_requirement_id UUID, -- Optional link to SCM Flow material requirement
    sap_pr_number VARCHAR(50) NOT NULL,
    sap_pr_date DATE,
    sap_pr_item_number VARCHAR(20),
    sap_reference_remarks TEXT,
    recorded_by UUID REFERENCES auth.users(id),
    recorded_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sap_pr_number ON public.sap_pr_references(sap_pr_number);
CREATE INDEX IF NOT EXISTS idx_sap_pr_req ON public.sap_pr_references(internal_requirement_id);


-- 2. SAP Purchase Order References (Header) Table
CREATE TABLE IF NOT EXISTS public.sap_po_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sap_po_number VARCHAR(50) UNIQUE NOT NULL,
    sap_po_date DATE,
    sap_po_approval_date DATE NOT NULL, -- Stored strictly separately from creation date!
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    supplier_name VARCHAR(255) NOT NULL,
    supplier_code VARCHAR(50),
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    department_name VARCHAR(100),
    plant_location VARCHAR(100),
    po_currency VARCHAR(10) DEFAULT 'INR' NOT NULL,
    sap_reference_remarks TEXT,
    recorded_by UUID REFERENCES auth.users(id),
    recorded_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sap_po_number ON public.sap_po_references(sap_po_number);
CREATE INDEX IF NOT EXISTS idx_sap_po_project ON public.sap_po_references(project_id);
CREATE INDEX IF NOT EXISTS idx_sap_po_dept ON public.sap_po_references(department_id);


-- 3. Material Delivery Tracking Table (SAP PO Line Items & Tracking Master)
CREATE TABLE IF NOT EXISTS public.material_delivery_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sap_po_reference_id UUID NOT NULL REFERENCES public.sap_po_references(id) ON DELETE RESTRICT,
    sap_po_number VARCHAR(50) NOT NULL,
    sap_po_line_number VARCHAR(20) NOT NULL,
    material_id UUID REFERENCES public.material_masters(id) ON DELETE SET NULL,
    material_code VARCHAR(50),
    material_description VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('API', 'PM', 'EXE', 'CONSUMABLE', 'Consumables')),
    ordered_quantity NUMERIC(18, 6) NOT NULL CHECK (ordered_quantity > 0),
    uom VARCHAR(50) NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    supplier_name VARCHAR(255) NOT NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    internal_requirement_id UUID,
    allocated_requirement_quantity NUMERIC(18, 6),
    assigned_employee_id UUID REFERENCES public.employees(id) ON DELETE RESTRICT,
    original_committed_delivery_date DATE, -- First supplier-confirmed commitment
    current_expected_delivery_date DATE, -- Latest revised delivery commitment
    actual_completion_date DATE, -- Populated when full ordered quantity is arrived
    delivered_quantity NUMERIC(18, 6) DEFAULT 0 NOT NULL CHECK (delivered_quantity >= 0),
    delivery_status VARCHAR(30) DEFAULT 'AWAITING_SCHEDULE' NOT NULL 
        CHECK (delivery_status IN ('AWAITING_PO', 'PO_REGISTERED', 'AWAITING_SCHEDULE', 'SCHEDULED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'DELAYED', 'CANCELLED')),
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES auth.users(id),
    cancelled_at TIMESTAMPTZ,
    delivery_remarks TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Unique constraint: Unique SAP PO line item among active tracking records
CREATE UNIQUE INDEX IF NOT EXISTS uq_tracking_sap_po_line
ON public.material_delivery_tracking(sap_po_number, sap_po_line_number)
WHERE (delivery_status <> 'CANCELLED');

CREATE INDEX IF NOT EXISTS idx_mdt_po_ref ON public.material_delivery_tracking(sap_po_reference_id);
CREATE INDEX IF NOT EXISTS idx_mdt_assigned ON public.material_delivery_tracking(assigned_employee_id);
CREATE INDEX IF NOT EXISTS idx_mdt_status ON public.material_delivery_tracking(delivery_status);
CREATE INDEX IF NOT EXISTS idx_mdt_category ON public.material_delivery_tracking(category);
CREATE INDEX IF NOT EXISTS idx_mdt_expected_date ON public.material_delivery_tracking(current_expected_delivery_date);


-- 4. Delivery Tracking Assignments History Table
CREATE TABLE IF NOT EXISTS public.delivery_tracking_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_id UUID NOT NULL REFERENCES public.material_delivery_tracking(id) ON DELETE CASCADE,
    assigned_employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
    assigned_by UUID REFERENCES auth.users(id) NOT NULL,
    assignment_date TIMESTAMPTZ DEFAULT now() NOT NULL,
    assignment_remarks TEXT,
    assignment_status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL CHECK (assignment_status IN ('ACTIVE', 'REASSIGNED', 'COMPLETED'))
);

CREATE INDEX IF NOT EXISTS idx_dta_tracking ON public.delivery_tracking_assignments(tracking_id);
CREATE INDEX IF NOT EXISTS idx_dta_employee ON public.delivery_tracking_assignments(assigned_employee_id);


-- 5. Delivery Expected Date Revision History Table
CREATE TABLE IF NOT EXISTS public.delivery_date_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_id UUID NOT NULL REFERENCES public.material_delivery_tracking(id) ON DELETE CASCADE,
    previous_date DATE,
    new_date DATE NOT NULL,
    reason TEXT NOT NULL,
    source VARCHAR(50) DEFAULT 'Supplier Update' NOT NULL,
    changed_by UUID REFERENCES auth.users(id) NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ddh_tracking ON public.delivery_date_history(tracking_id);


-- 6. Material Delivery Updates Table (Full and Partial Shipments)
CREATE TABLE IF NOT EXISTS public.material_delivery_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_id UUID NOT NULL REFERENCES public.material_delivery_tracking(id) ON DELETE RESTRICT,
    delivery_quantity NUMERIC(18, 6) NOT NULL CHECK (delivery_quantity > 0),
    actual_delivery_date DATE NOT NULL,
    supplier_delivery_reference VARCHAR(100),
    delivery_remarks TEXT,
    attachment_url TEXT,
    file_key TEXT,
    is_overrun_override BOOLEAN DEFAULT false NOT NULL,
    override_reason TEXT,
    is_corrected BOOLEAN DEFAULT false NOT NULL,
    correction_reason TEXT,
    updated_by UUID REFERENCES auth.users(id) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mdu_tracking ON public.material_delivery_updates(tracking_id);
CREATE INDEX IF NOT EXISTS idx_mdu_actual_date ON public.material_delivery_updates(actual_delivery_date);


-- 7. Material Delivery Daily Delay Remarks Table
CREATE TABLE IF NOT EXISTS public.material_delivery_delay_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_id UUID NOT NULL REFERENCES public.material_delivery_tracking(id) ON DELETE RESTRICT,
    delay_date DATE NOT NULL,
    delay_reason_category VARCHAR(100) NOT NULL,
    delay_explanation TEXT NOT NULL,
    supplier_contacted BOOLEAN NOT NULL DEFAULT false,
    supplier_update TEXT,
    revised_expected_date DATE,
    corrective_action TEXT NOT NULL,
    next_followup_date DATE NOT NULL,
    is_backfilled BOOLEAN DEFAULT false NOT NULL,
    backfill_reason TEXT,
    supporting_document_url TEXT,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Exactly one delay remark per delayed PO line per calendar date
CREATE UNIQUE INDEX IF NOT EXISTS uq_delay_log_tracking_date 
ON public.material_delivery_delay_logs(tracking_id, delay_date);

CREATE INDEX IF NOT EXISTS idx_mddl_tracking ON public.material_delivery_delay_logs(tracking_id);
CREATE INDEX IF NOT EXISTS idx_mddl_date ON public.material_delivery_delay_logs(delay_date);


-- 8. Delivery Documents & Attachments Table
CREATE TABLE IF NOT EXISTS public.delivery_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_id UUID NOT NULL REFERENCES public.material_delivery_tracking(id) ON DELETE RESTRICT,
    delivery_update_id UUID REFERENCES public.material_delivery_updates(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_key TEXT NOT NULL,
    document_type VARCHAR(50) NOT NULL, -- e.g. 'CHALLAN', 'LR_WAYBILL', 'DISPATCH_CONFIRMATION', 'PROOF_OF_ARRIVAL', 'OTHER'
    uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dd_tracking ON public.delivery_documents(tracking_id);


-- 9. Automatic Delivery Status & Delay Calculation Function
CREATE OR REPLACE FUNCTION public.recalculate_delivery_tracking_status(p_tracking_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_rec RECORD;
    v_total_delivered NUMERIC(18, 6) := 0;
    v_latest_delivery_date DATE;
    v_today_ist DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE;
    v_new_status VARCHAR(30);
    v_actual_comp_date DATE;
BEGIN
    SELECT * INTO v_rec FROM public.material_delivery_tracking WHERE id = p_tracking_id;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- If cancelled, state remains permanently CANCELLED
    IF v_rec.delivery_status = 'CANCELLED' THEN
        RETURN;
    END IF;

    -- Aggregate total delivered quantity and latest arrival date
    SELECT 
        coalesce(sum(delivery_quantity), 0),
        max(actual_delivery_date)
    INTO v_total_delivered, v_latest_delivery_date
    FROM public.material_delivery_updates
    WHERE tracking_id = p_tracking_id AND is_corrected = false;

    -- Determine calculated status
    IF v_total_delivered >= v_rec.ordered_quantity THEN
        v_new_status := 'DELIVERED';
        v_actual_comp_date := coalesce(v_rec.actual_completion_date, v_latest_delivery_date, v_today_ist);
    ELSE
        v_actual_comp_date := NULL;
        IF v_rec.current_expected_delivery_date IS NULL THEN
            v_new_status := 'AWAITING_SCHEDULE';
        ELSE
            -- Check if delayed (past current expected date OR past original committed date)
            IF v_today_ist > v_rec.current_expected_delivery_date 
               OR (v_rec.original_committed_delivery_date IS NOT NULL AND v_today_ist > v_rec.original_committed_delivery_date) THEN
                v_new_status := 'DELAYED';
            ELSIF v_total_delivered > 0 THEN
                v_new_status := 'PARTIALLY_DELIVERED';
            ELSE
                v_new_status := 'SCHEDULED';
            END IF;
        END IF;
    END IF;

    -- Update tracking row
    UPDATE public.material_delivery_tracking
    SET delivered_quantity = v_total_delivered,
        delivery_status = v_new_status,
        actual_completion_date = v_actual_comp_date,
        updated_at = now()
    WHERE id = p_tracking_id;
END;
$$;


-- 10. Seed Phase 7 Permissions into `public.permissions`
INSERT INTO public.permissions (id, module, description) VALUES
    ('sap_references.view', 'delivery_tracking', 'View SAP PR and PO references and line item data'),
    ('sap_references.create', 'delivery_tracking', 'Record and map SAP PR and PO references'),
    ('sap_references.update', 'delivery_tracking', 'Update SAP PO references and line metadata'),
    ('sap_references.import', 'delivery_tracking', 'Bulk import SAP procurement references from authorized interface'),
    ('delivery_tracking.view', 'delivery_tracking', 'View delivery tracking records and schedules'),
    ('delivery_tracking.view_all', 'delivery_tracking', 'View delivery tracking across all projects, departments, and units'),
    ('delivery_tracking.create', 'delivery_tracking', 'Create material delivery tracking records from SAP lines'),
    ('delivery_tracking.update', 'delivery_tracking', 'Update delivery schedules, commitments, and status'),
    ('delivery_tracking.cancel', 'delivery_tracking', 'Cancel delivery tracking records with mandatory justification'),
    ('delivery_tracking.assign', 'delivery_tracking', 'Assign responsible employees to delivery tracking records'),
    ('delivery_tracking.reassign', 'delivery_tracking', 'Reassign delivery tracking records to another employee'),
    ('delivery_updates.view', 'delivery_tracking', 'View delivery update history and partial deliveries'),
    ('delivery_updates.create', 'delivery_tracking', 'Record partial or full material deliveries'),
    ('delivery_updates.correct', 'delivery_tracking', 'Correct previously recorded delivery entries with audit reason'),
    ('delivery_updates.override_quantity', 'delivery_tracking', 'Authorize delivery quantity exceeding ordered quantity with mandatory reason'),
    ('delivery_reports.view', 'delivery_tracking', 'View delivery analytics and delay dashboards'),
    ('delivery_reports.export', 'delivery_tracking', 'Export delivery tracking reports to Excel and PDF formats'),
    ('delivery_documents.view', 'delivery_tracking', 'View and download delivery challans and supporting documents'),
    ('delivery_documents.upload', 'delivery_tracking', 'Upload delivery challans, LR slips, and proof of arrival')
ON CONFLICT (id) DO UPDATE 
SET module = EXCLUDED.module,
    description = EXCLUDED.description;

-- Seed Role Permissions for Phase 7
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    -- Super Admin: Full administrative oversight
    ('super_admin', 'sap_references.view'),
    ('super_admin', 'sap_references.create'),
    ('super_admin', 'sap_references.update'),
    ('super_admin', 'sap_references.import'),
    ('super_admin', 'delivery_tracking.view'),
    ('super_admin', 'delivery_tracking.view_all'),
    ('super_admin', 'delivery_tracking.create'),
    ('super_admin', 'delivery_tracking.update'),
    ('super_admin', 'delivery_tracking.cancel'),
    ('super_admin', 'delivery_tracking.assign'),
    ('super_admin', 'delivery_tracking.reassign'),
    ('super_admin', 'delivery_updates.view'),
    ('super_admin', 'delivery_updates.create'),
    ('super_admin', 'delivery_updates.correct'),
    ('super_admin', 'delivery_updates.override_quantity'),
    ('super_admin', 'delivery_reports.view'),
    ('super_admin', 'delivery_reports.export'),
    ('super_admin', 'delivery_documents.view'),
    ('super_admin', 'delivery_documents.upload'),

    -- SCM Admin: Operational Leadership
    ('scm_admin', 'sap_references.view'),
    ('scm_admin', 'sap_references.create'),
    ('scm_admin', 'sap_references.update'),
    ('scm_admin', 'sap_references.import'),
    ('scm_admin', 'delivery_tracking.view'),
    ('scm_admin', 'delivery_tracking.view_all'),
    ('scm_admin', 'delivery_tracking.create'),
    ('scm_admin', 'delivery_tracking.update'),
    ('scm_admin', 'delivery_tracking.cancel'),
    ('scm_admin', 'delivery_tracking.assign'),
    ('scm_admin', 'delivery_tracking.reassign'),
    ('scm_admin', 'delivery_updates.view'),
    ('scm_admin', 'delivery_updates.create'),
    ('scm_admin', 'delivery_updates.correct'),
    ('scm_admin', 'delivery_updates.override_quantity'),
    ('scm_admin', 'delivery_reports.view'),
    ('scm_admin', 'delivery_reports.export'),
    ('scm_admin', 'delivery_documents.view'),
    ('scm_admin', 'delivery_documents.upload'),

    -- SCM Team User: Execution for Assigned Workload
    ('scm_team_user', 'sap_references.view'),
    ('scm_team_user', 'delivery_tracking.view'),
    ('scm_team_user', 'delivery_updates.view'),
    ('scm_team_user', 'delivery_updates.create'),
    ('scm_team_user', 'delivery_reports.view'),
    ('scm_team_user', 'delivery_documents.view'),
    ('scm_team_user', 'delivery_documents.upload')
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- 11. Core RPCs for Phase 7 Execution

-- Helper: Check Auth & Permission
CREATE OR REPLACE FUNCTION public.check_delivery_auth(required_perm VARCHAR)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_active BOOLEAN;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT is_active INTO v_is_active FROM public.employees WHERE user_id = v_user_id;
    IF v_is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Active employee status required.';
    END IF;

    IF NOT public.current_user_has_permission(required_perm) THEN
        RAISE EXCEPTION 'Access denied. Missing permission: %', required_perm;
    END IF;

    RETURN v_user_id;
END;
$$;


-- RPC: Register SAP PO Header & Line Items
CREATE OR REPLACE FUNCTION public.api_register_sap_po_with_lines(
    p_sap_po_number VARCHAR,
    p_sap_po_date DATE,
    p_sap_po_approval_date DATE,
    p_supplier_name VARCHAR,
    p_supplier_id UUID DEFAULT NULL,
    p_supplier_code VARCHAR DEFAULT NULL,
    p_project_id UUID DEFAULT NULL,
    p_department_id UUID DEFAULT NULL,
    p_plant_location VARCHAR DEFAULT NULL,
    p_po_currency VARCHAR DEFAULT 'INR',
    p_remarks TEXT DEFAULT NULL,
    p_lines JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_po_ref RECORD;
    v_line JSONB;
    v_tracking_id UUID;
    v_dept_name VARCHAR;
    v_line_number VARCHAR;
    v_ordered_qty NUMERIC(18, 6);
    v_assigned_emp UUID;
    v_exp_date DATE;
    v_orig_date DATE;
    v_status VARCHAR(30);
BEGIN
    v_user_id := public.check_delivery_auth('sap_references.create');

    IF p_sap_po_number IS NULL OR trim(p_sap_po_number) = '' THEN
        RAISE EXCEPTION 'SAP PO number is required.';
    END IF;
    IF p_sap_po_approval_date IS NULL THEN
        RAISE EXCEPTION 'SAP PO approval date is required.';
    END IF;
    IF p_supplier_name IS NULL OR trim(p_supplier_name) = '' THEN
        RAISE EXCEPTION 'Supplier name is required.';
    END IF;

    IF p_department_id IS NOT NULL THEN
        SELECT name INTO v_dept_name FROM public.departments WHERE id = p_department_id;
    END IF;

    -- Upsert SAP PO Header Reference
    INSERT INTO public.sap_po_references (
        sap_po_number, sap_po_date, sap_po_approval_date, supplier_id, supplier_name, supplier_code,
        project_id, department_id, department_name, plant_location, po_currency, sap_reference_remarks,
        recorded_by, recorded_at, updated_by, updated_at
    ) VALUES (
        trim(p_sap_po_number), p_sap_po_date, p_sap_po_approval_date, p_supplier_id, trim(p_supplier_name), nullif(trim(p_supplier_code), ''),
        p_project_id, p_department_id, v_dept_name, nullif(trim(p_plant_location), ''), coalesce(p_po_currency, 'INR'), nullif(trim(p_remarks), ''),
        v_user_id, now(), v_user_id, now()
    )
    ON CONFLICT (sap_po_number) DO UPDATE
    SET sap_po_date = EXCLUDED.sap_po_date,
        sap_po_approval_date = EXCLUDED.sap_po_approval_date,
        supplier_id = coalesce(EXCLUDED.supplier_id, public.sap_po_references.supplier_id),
        supplier_name = EXCLUDED.supplier_name,
        supplier_code = coalesce(EXCLUDED.supplier_code, public.sap_po_references.supplier_code),
        project_id = coalesce(EXCLUDED.project_id, public.sap_po_references.project_id),
        department_id = coalesce(EXCLUDED.department_id, public.sap_po_references.department_id),
        department_name = coalesce(EXCLUDED.department_name, public.sap_po_references.department_name),
        plant_location = coalesce(EXCLUDED.plant_location, public.sap_po_references.plant_location),
        sap_reference_remarks = coalesce(EXCLUDED.sap_reference_remarks, public.sap_po_references.sap_reference_remarks),
        updated_by = v_user_id,
        updated_at = now()
    RETURNING * INTO v_po_ref;

    -- Process Each PO Line Item
    FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
    LOOP
        v_line_number := trim((v_line->>'sap_po_line_number')::text);
        v_ordered_qty := (v_line->>'ordered_quantity')::numeric;
        v_assigned_emp := (v_line->>'assigned_employee_id')::uuid;
        v_exp_date := (v_line->>'current_expected_delivery_date')::date;
        v_orig_date := coalesce((v_line->>'original_committed_delivery_date')::date, v_exp_date);

        IF v_line_number IS NULL OR v_line_number = '' THEN
            RAISE EXCEPTION 'SAP PO line number is required for all line items.';
        END IF;
        IF v_ordered_qty IS NULL OR v_ordered_qty <= 0 THEN
            RAISE EXCEPTION 'Ordered quantity must be greater than zero for line %.', v_line_number;
        END IF;

        IF v_exp_date IS NULL THEN
            v_status := 'AWAITING_SCHEDULE';
        ELSE
            v_status := 'SCHEDULED';
        END IF;

        -- Insert or Update tracking record
        INSERT INTO public.material_delivery_tracking (
            sap_po_reference_id, sap_po_number, sap_po_line_number, material_id, material_code,
            material_description, category, ordered_quantity, uom, supplier_id, supplier_name,
            project_id, department_id, internal_requirement_id, allocated_requirement_quantity,
            assigned_employee_id, original_committed_delivery_date, current_expected_delivery_date,
            delivery_status, delivery_remarks, created_by, created_at, updated_by, updated_at
        ) VALUES (
            v_po_ref.id, trim(p_sap_po_number), v_line_number, (v_line->>'material_id')::uuid, nullif(trim((v_line->>'material_code')::text), ''),
            trim((v_line->>'material_description')::text), (v_line->>'category')::varchar, v_ordered_qty, trim((v_line->>'uom')::text),
            v_po_ref.supplier_id, v_po_ref.supplier_name, v_po_ref.project_id, v_po_ref.department_id, (v_line->>'internal_requirement_id')::uuid,
            (v_line->>'allocated_requirement_quantity')::numeric, v_assigned_emp, v_orig_date, v_exp_date,
            v_status, nullif(trim((v_line->>'delivery_remarks')::text), ''), v_user_id, now(), v_user_id, now()
        )
        ON CONFLICT (sap_po_number, sap_po_line_number) WHERE (delivery_status <> 'CANCELLED')
        DO UPDATE SET
            material_id = coalesce(EXCLUDED.material_id, public.material_delivery_tracking.material_id),
            material_description = EXCLUDED.material_description,
            ordered_quantity = EXCLUDED.ordered_quantity,
            uom = EXCLUDED.uom,
            assigned_employee_id = coalesce(EXCLUDED.assigned_employee_id, public.material_delivery_tracking.assigned_employee_id),
            current_expected_delivery_date = coalesce(EXCLUDED.current_expected_delivery_date, public.material_delivery_tracking.current_expected_delivery_date),
            updated_by = v_user_id,
            updated_at = now()
        RETURNING id INTO v_tracking_id;

        -- Record initial assignment history if employee assigned
        IF v_assigned_emp IS NOT NULL THEN
            INSERT INTO public.delivery_tracking_assignments (
                tracking_id, assigned_employee_id, assigned_by, assignment_date, assignment_remarks, assignment_status
            ) VALUES (
                v_tracking_id, v_assigned_emp, v_user_id, now(), 'Initial assignment via SAP PO line registration', 'ACTIVE'
            );
        END IF;

        -- Trigger status recalculation
        PERFORM public.recalculate_delivery_tracking_status(v_tracking_id);
    END LOOP;

    -- Audit log
    INSERT INTO public.audit_logs (table_name, record_id, action, new_values, changed_by, created_at)
    VALUES ('sap_po_references', v_po_ref.id, 'REGISTER_SAP_PO', jsonb_build_object('sap_po_number', p_sap_po_number, 'supplier', p_supplier_name), v_user_id, now());

    RETURN jsonb_build_object('success', true, 'po_reference_id', v_po_ref.id, 'sap_po_number', p_sap_po_number);
END;
$$;


-- RPC: Record Delivery Update (Partial or Full Delivery)
CREATE OR REPLACE FUNCTION public.api_record_material_delivery(
    p_tracking_id UUID,
    p_delivery_quantity NUMERIC,
    p_actual_delivery_date DATE,
    p_supplier_delivery_reference VARCHAR DEFAULT NULL,
    p_delivery_remarks TEXT DEFAULT NULL,
    p_file_key TEXT DEFAULT NULL,
    p_is_overrun_override BOOLEAN DEFAULT false,
    p_override_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_rec RECORD;
    v_new_delivered NUMERIC(18, 6);
    v_update_id UUID;
BEGIN
    v_user_id := public.check_delivery_auth('delivery_updates.create');

    IF p_delivery_quantity IS NULL OR p_delivery_quantity <= 0 THEN
        RAISE EXCEPTION 'Delivery quantity must be strictly greater than zero.';
    END IF;
    IF p_actual_delivery_date IS NULL THEN
        RAISE EXCEPTION 'Actual delivery date is required.';
    END IF;

    SELECT * INTO v_rec FROM public.material_delivery_tracking WHERE id = p_tracking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Delivery tracking record not found.';
    END IF;

    IF v_rec.delivery_status = 'CANCELLED' THEN
        RAISE EXCEPTION 'Cannot record deliveries against a cancelled tracking record.';
    END IF;

    -- Calculate projected delivered quantity
    v_new_delivered := v_rec.delivered_quantity + p_delivery_quantity;

    -- Safeguard: Delivered quantity must not exceed ordered quantity unless authorized override
    IF v_new_delivered > v_rec.ordered_quantity AND NOT p_is_overrun_override THEN
        RAISE EXCEPTION 'Cumulative delivered quantity (%) would exceed ordered quantity (%). Authorized quantity override required.',
            v_new_delivered, v_rec.ordered_quantity;
    END IF;

    IF p_is_overrun_override AND (p_override_reason IS NULL OR trim(p_override_reason) = '') THEN
        RAISE EXCEPTION 'Reason is mandatory when recording a delivery quantity overrun.';
    END IF;

    -- Insert delivery update shipment record
    INSERT INTO public.material_delivery_updates (
        tracking_id, delivery_quantity, actual_delivery_date, supplier_delivery_reference,
        delivery_remarks, file_key, is_overrun_override, override_reason, updated_by, updated_at
    ) VALUES (
        p_tracking_id, p_delivery_quantity, p_actual_delivery_date, nullif(trim(p_supplier_delivery_reference), ''),
        nullif(trim(p_delivery_remarks), ''), nullif(trim(p_file_key), ''), coalesce(p_is_overrun_override, false),
        nullif(trim(p_override_reason), ''), v_user_id, now()
    ) RETURNING id INTO v_update_id;

    -- Recalculate status and aggregate totals
    PERFORM public.recalculate_delivery_tracking_status(p_tracking_id);

    -- Audit log
    INSERT INTO public.audit_logs (table_name, record_id, action, new_values, changed_by, created_at)
    VALUES ('material_delivery_updates', v_update_id, 'RECORD_DELIVERY',
        jsonb_build_object('tracking_id', p_tracking_id, 'delivered_quantity', p_delivery_quantity, 'actual_delivery_date', p_actual_delivery_date),
        v_user_id, now());

    RETURN jsonb_build_object('success', true, 'delivery_update_id', v_update_id);
END;
$$;


-- RPC: Submit Mandatory Daily Delay Remark
CREATE OR REPLACE FUNCTION public.api_submit_daily_delay_remark(
    p_tracking_id UUID,
    p_delay_date DATE,
    p_delay_reason_category VARCHAR,
    p_delay_explanation TEXT,
    p_supplier_contacted BOOLEAN,
    p_supplier_update TEXT DEFAULT NULL,
    p_revised_expected_date DATE DEFAULT NULL,
    p_corrective_action TEXT DEFAULT '',
    p_next_followup_date DATE DEFAULT NULL,
    p_is_backfilled BOOLEAN DEFAULT false,
    p_backfill_reason TEXT DEFAULT NULL,
    p_supporting_document_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_rec RECORD;
    v_today_ist DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE;
    v_log_id UUID;
BEGIN
    v_user_id := public.check_delivery_auth('delivery_tracking.update');

    SELECT * INTO v_rec FROM public.material_delivery_tracking WHERE id = p_tracking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Delivery tracking record not found.';
    END IF;

    IF p_delay_explanation IS NULL OR trim(p_delay_explanation) = '' THEN
        RAISE EXCEPTION 'Delay explanation is mandatory and cannot be blank.';
    END IF;
    IF p_corrective_action IS NULL OR trim(p_corrective_action) = '' THEN
        RAISE EXCEPTION 'Corrective action plan is mandatory.';
    END IF;
    IF p_next_followup_date IS NULL THEN
        RAISE EXCEPTION 'Next follow-up date is mandatory.';
    END IF;

    IF p_supplier_contacted IS TRUE AND (p_supplier_update IS NULL OR trim(p_supplier_update) = '') THEN
        RAISE EXCEPTION 'Supplier communication update is required when supplier was contacted.';
    END IF;

    IF p_is_backfilled IS TRUE AND (p_backfill_reason IS NULL OR trim(p_backfill_reason) = '') THEN
        RAISE EXCEPTION 'Backfill justification is mandatory for past dates.';
    END IF;

    -- Upsert daily delay log (one per tracking record per date)
    INSERT INTO public.material_delivery_delay_logs (
        tracking_id, delay_date, delay_reason_category, delay_explanation, supplier_contacted,
        supplier_update, revised_expected_date, corrective_action, next_followup_date,
        is_backfilled, backfill_reason, supporting_document_url, created_by, created_at, updated_by, updated_at
    ) VALUES (
        p_tracking_id, p_delay_date, p_delay_reason_category, trim(p_delay_explanation), p_supplier_contacted,
        nullif(trim(p_supplier_update), ''), p_revised_expected_date, trim(p_corrective_action), p_next_followup_date,
        coalesce(p_is_backfilled, false), nullif(trim(p_backfill_reason), ''), nullif(trim(p_supporting_document_url), ''),
        v_user_id, now(), v_user_id, now()
    )
    ON CONFLICT (tracking_id, delay_date) DO UPDATE SET
        delay_reason_category = EXCLUDED.delay_reason_category,
        delay_explanation = EXCLUDED.delay_explanation,
        supplier_contacted = EXCLUDED.supplier_contacted,
        supplier_update = EXCLUDED.supplier_update,
        revised_expected_date = coalesce(EXCLUDED.revised_expected_date, public.material_delivery_delay_logs.revised_expected_date),
        corrective_action = EXCLUDED.corrective_action,
        next_followup_date = EXCLUDED.next_followup_date,
        updated_by = v_user_id,
        updated_at = now()
    RETURNING id INTO v_log_id;

    -- If a revised expected date is provided and differs, record in date history
    IF p_revised_expected_date IS NOT NULL AND (v_rec.current_expected_delivery_date IS NULL OR p_revised_expected_date <> v_rec.current_expected_delivery_date) THEN
        INSERT INTO public.delivery_date_history (
            tracking_id, previous_date, new_date, reason, source, changed_by, changed_at
        ) VALUES (
            p_tracking_id, v_rec.current_expected_delivery_date, p_revised_expected_date,
            'Revised via Daily Delay Remark: ' || trim(p_delay_explanation),
            'Supplier Communication Update', v_user_id, now()
        );

        UPDATE public.material_delivery_tracking
        SET current_expected_delivery_date = p_revised_expected_date,
            updated_by = v_user_id,
            updated_at = now()
        WHERE id = p_tracking_id;
    END IF;

    -- Recalculate status
    PERFORM public.recalculate_delivery_tracking_status(p_tracking_id);

    RETURN jsonb_build_object('success', true, 'delay_log_id', v_log_id);
END;
$$;


-- RPC: Revise Expected Delivery Date
CREATE OR REPLACE FUNCTION public.api_revise_expected_delivery_date(
    p_tracking_id UUID,
    p_new_expected_date DATE,
    p_reason TEXT,
    p_source VARCHAR DEFAULT 'Supplier Update'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_rec RECORD;
BEGIN
    v_user_id := public.check_delivery_auth('delivery_tracking.update');

    IF p_new_expected_date IS NULL THEN
        RAISE EXCEPTION 'New expected delivery date is required.';
    END IF;
    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'Reason for revising expected delivery date is mandatory.';
    END IF;

    SELECT * INTO v_rec FROM public.material_delivery_tracking WHERE id = p_tracking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Delivery tracking record not found.';
    END IF;

    -- Record in date history
    INSERT INTO public.delivery_date_history (
        tracking_id, previous_date, new_date, reason, source, changed_by, changed_at
    ) VALUES (
        p_tracking_id, v_rec.current_expected_delivery_date, p_new_expected_date,
        trim(p_reason), coalesce(p_source, 'Supplier Update'), v_user_id, now()
    );

    -- Update tracking record
    UPDATE public.material_delivery_tracking
    SET current_expected_delivery_date = p_new_expected_date,
        original_committed_delivery_date = coalesce(original_committed_delivery_date, p_new_expected_date),
        updated_by = v_user_id,
        updated_at = now()
    WHERE id = p_tracking_id;

    -- Recalculate delivery status
    PERFORM public.recalculate_delivery_tracking_status(p_tracking_id);

    RETURN jsonb_build_object('success', true, 'new_expected_date', p_new_expected_date);
END;
$$;


-- RPC: Reassign Delivery Tracking Record
CREATE OR REPLACE FUNCTION public.api_reassign_delivery_tracking(
    p_tracking_id UUID,
    p_new_employee_id UUID,
    p_remarks TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_rec RECORD;
    v_emp RECORD;
BEGIN
    v_user_id := public.check_delivery_auth('delivery_tracking.reassign');

    SELECT * INTO v_emp FROM public.employees WHERE id = p_new_employee_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Employee not found.';
    END IF;
    IF v_emp.is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Cannot assign delivery tracking to an inactive employee.';
    END IF;

    SELECT * INTO v_rec FROM public.material_delivery_tracking WHERE id = p_tracking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Delivery tracking record not found.';
    END IF;

    -- Mark prior assignment as REASSIGNED
    UPDATE public.delivery_tracking_assignments
    SET assignment_status = 'REASSIGNED'
    WHERE tracking_id = p_tracking_id AND assignment_status = 'ACTIVE';

    -- Insert new assignment
    INSERT INTO public.delivery_tracking_assignments (
        tracking_id, assigned_employee_id, assigned_by, assignment_date, assignment_remarks, assignment_status
    ) VALUES (
        p_tracking_id, p_new_employee_id, v_user_id, now(), nullif(trim(p_remarks), ''), 'ACTIVE'
    );

    -- Update tracking row
    UPDATE public.material_delivery_tracking
    SET assigned_employee_id = p_new_employee_id,
        updated_by = v_user_id,
        updated_at = now()
    WHERE id = p_tracking_id;

    RETURN jsonb_build_object('success', true, 'assigned_employee_id', p_new_employee_id);
END;
$$;


-- RPC: Cancel Delivery Tracking
CREATE OR REPLACE FUNCTION public.api_cancel_delivery_tracking(
    p_tracking_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_rec RECORD;
BEGIN
    v_user_id := public.check_delivery_auth('delivery_tracking.cancel');

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'Mandatory cancellation justification is required.';
    END IF;

    SELECT * INTO v_rec FROM public.material_delivery_tracking WHERE id = p_tracking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Delivery tracking record not found.';
    END IF;

    UPDATE public.material_delivery_tracking
    SET delivery_status = 'CANCELLED',
        cancellation_reason = trim(p_reason),
        cancelled_by = v_user_id,
        cancelled_at = now(),
        updated_by = v_user_id,
        updated_at = now()
    WHERE id = p_tracking_id;

    INSERT INTO public.audit_logs (table_name, record_id, action, new_values, changed_by, created_at)
    VALUES ('material_delivery_tracking', p_tracking_id, 'CANCEL_TRACKING',
        jsonb_build_object('reason', trim(p_reason), 'sap_po_number', v_rec.sap_po_number), v_user_id, now());

    RETURN jsonb_build_object('success', true, 'status', 'CANCELLED');
END;
$$;


-- 12. Row Level Security Policies
ALTER TABLE public.sap_pr_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sap_po_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_delivery_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_tracking_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_date_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_delivery_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_delivery_delay_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_documents ENABLE ROW LEVEL SECURITY;

-- Read policies for authenticated active employees
DROP POLICY IF EXISTS "Auth read sap_pr_references" ON public.sap_pr_references;
CREATE POLICY "Auth read sap_pr_references" ON public.sap_pr_references FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth read sap_po_references" ON public.sap_po_references;
CREATE POLICY "Auth read sap_po_references" ON public.sap_po_references FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth read material_delivery_tracking" ON public.material_delivery_tracking;
CREATE POLICY "Auth read material_delivery_tracking" ON public.material_delivery_tracking FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth read delivery_tracking_assignments" ON public.delivery_tracking_assignments;
CREATE POLICY "Auth read delivery_tracking_assignments" ON public.delivery_tracking_assignments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth read delivery_date_history" ON public.delivery_date_history;
CREATE POLICY "Auth read delivery_date_history" ON public.delivery_date_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth read material_delivery_updates" ON public.material_delivery_updates;
CREATE POLICY "Auth read material_delivery_updates" ON public.material_delivery_updates FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth read material_delivery_delay_logs" ON public.material_delivery_delay_logs;
CREATE POLICY "Auth read material_delivery_delay_logs" ON public.material_delivery_delay_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth read delivery_documents" ON public.delivery_documents;
CREATE POLICY "Auth read delivery_documents" ON public.delivery_documents FOR SELECT TO authenticated USING (true);

-- Super admin full management
DROP POLICY IF EXISTS "Super admin all delivery tracking" ON public.material_delivery_tracking;
CREATE POLICY "Super admin all delivery tracking" ON public.material_delivery_tracking FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));

COMMIT;

