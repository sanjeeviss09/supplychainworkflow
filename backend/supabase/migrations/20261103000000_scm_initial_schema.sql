-- =============================================================================
-- SCM FLOW — ENTERPRISE DATABASE SCHEMA DEFINITION
-- Target: PostgreSQL 15+ (Supabase)
-- Base Currency: INR (₹)
-- Default Timezone: Asia/Kolkata (IST)
-- Material Categories: API, EXE, PM, Consumables
-- Roles: super_admin, scm_admin, scm_team_user
-- =============================================================================

BEGIN;

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. ENUMERATED TYPES
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE public.material_category AS ENUM ('API', 'EXE', 'PM', 'Consumables');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.supplier_status AS ENUM ('active', 'on_hold', 'blacklisted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.project_status AS ENUM (
        'draft', 'planned', 'budget_approved', 'active', 'completed', 'closed', 'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.milestone_status AS ENUM ('pending', 'in_progress', 'completed', 'delayed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.material_req_status AS ENUM (
        'unassigned', 'partially_requisitioned', 'fully_requisitioned',
        'partially_ordered', 'fully_ordered', 'delivered'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.approval_entity_type AS ENUM (
        'budget_request', 'purchase_requisition', 'purchase_order', 'project_closure'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.approval_status AS ENUM ('pending', 'in_progress', 'approved', 'rejected', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.approval_step_status AS ENUM ('pending', 'approved', 'rejected', 'skipped');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.budget_request_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.priority_level AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.pr_status AS ENUM (
        'draft', 'submitted', 'approved', 'partially_ordered', 'fully_ordered', 'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.po_status AS ENUM (
        'draft', 'pending_approval', 'approved', 'issued', 'confirmed',
        'partially_delivered', 'fully_delivered', 'closed', 'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.delivery_schedule_status AS ENUM (
        'scheduled', 'reminder_dispatched', 'in_transit', 'delivered', 'delayed', 'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.shipment_status AS ENUM ('dispatched', 'in_transit', 'at_gate', 'unloaded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.qc_inspection_status AS ENUM (
        'quarantine', 'under_testing', 'accepted', 'partially_rejected', 'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.grn_status AS ENUM ('draft', 'submitted', 'qc_completed', 'closed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.invoice_verification_status AS ENUM (
        'unverified', 'matched', 'discrepancy', 'approved_for_payment', 'paid', 'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.match_status AS ENUM ('exact_match', 'tolerance_accepted', 'discrepancy_held');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- 2. CORE IDENTITY, ROLES & ORGANIZATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    head_user_id UUID,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    phone VARCHAR(30),
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Circular FK resolution for departments.head_user_id
ALTER TABLE public.departments 
    DROP CONSTRAINT IF EXISTS fk_departments_head;
ALTER TABLE public.departments 
    ADD CONSTRAINT fk_departments_head 
    FOREIGN KEY (head_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id VARCHAR(50) NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_user_role UNIQUE (user_id, role_id)
);

-- Helper function to evaluate current user role in RLS
CREATE OR REPLACE FUNCTION public.current_user_has_role(required_role VARCHAR)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.user_roles 
        WHERE user_id = auth.uid() 
          AND role_id = required_role
    );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS VARCHAR
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role_id 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    LIMIT 1;
$$;

-- =============================================================================
-- 3. MASTER DATA: MATERIALS & SUPPLIERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.material_masters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category public.material_category NOT NULL,
    description TEXT,
    unit_of_measure VARCHAR(20) NOT NULL,
    cas_number VARCHAR(50),
    hsn_sac_code VARCHAR(20),
    standard_lead_time_days INTEGER DEFAULT 14 NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_code VARCHAR(50) UNIQUE NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    gstin VARCHAR(15) UNIQUE,
    pan VARCHAR(10),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    country VARCHAR(50) DEFAULT 'India' NOT NULL,
    msme_registered BOOLEAN DEFAULT false NOT NULL,
    payment_terms_days INTEGER DEFAULT 30 NOT NULL,
    rating NUMERIC(3, 2) CHECK (rating IS NULL OR (rating >= 1.0 AND rating <= 5.0)),
    status public.supplier_status DEFAULT 'active' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.supplier_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    designation VARCHAR(100),
    email VARCHAR(255) NOT NULL,
    mobile VARCHAR(30) NOT NULL,
    is_primary BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- 4. PROJECTS, MILESTONES & MATERIAL REQUIREMENTS (BOM)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    lead_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    status public.project_status DEFAULT 'draft' NOT NULL,
    target_start_date DATE NOT NULL,
    target_completion_date DATE NOT NULL,
    actual_completion_date DATE,
    currency VARCHAR(3) DEFAULT 'INR' NOT NULL,
    requested_budget NUMERIC(15, 2) DEFAULT 0.00 NOT NULL CHECK (requested_budget >= 0),
    approved_budget NUMERIC(15, 2) DEFAULT 0.00 NOT NULL CHECK (approved_budget >= 0),
    po_committed_budget NUMERIC(15, 2) DEFAULT 0.00 NOT NULL CHECK (po_committed_budget >= 0),
    invoiced_budget NUMERIC(15, 2) DEFAULT 0.00 NOT NULL CHECK (invoiced_budget >= 0),
    paid_budget NUMERIC(15, 2) DEFAULT 0.00 NOT NULL CHECK (paid_budget >= 0),
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    target_date DATE NOT NULL,
    actual_completion_date DATE,
    estimated_budget NUMERIC(15, 2) DEFAULT 0.00 NOT NULL CHECK (estimated_budget >= 0),
    status public.milestone_status DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_project_milestone_sequence UNIQUE (project_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS public.project_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL,
    material_master_id UUID NOT NULL REFERENCES public.material_masters(id) ON DELETE RESTRICT,
    required_quantity NUMERIC(12, 3) NOT NULL CHECK (required_quantity > 0),
    estimated_unit_rate NUMERIC(15, 2) NOT NULL CHECK (estimated_unit_rate >= 0),
    estimated_total_cost NUMERIC(15, 2) GENERATED ALWAYS AS (required_quantity * estimated_unit_rate) STORED,
    currency VARCHAR(3) DEFAULT 'INR' NOT NULL,
    needed_by_date DATE NOT NULL,
    requisitioned_quantity NUMERIC(12, 3) DEFAULT 0.000 NOT NULL CHECK (requisitioned_quantity >= 0),
    ordered_quantity NUMERIC(12, 3) DEFAULT 0.000 NOT NULL CHECK (ordered_quantity >= 0),
    delivered_quantity NUMERIC(12, 3) DEFAULT 0.000 NOT NULL CHECK (delivered_quantity >= 0),
    status public.material_req_status DEFAULT 'unassigned' NOT NULL,
    technical_specification TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- 5. APPROVAL WORKFLOW ENGINE & BUDGET REQUESTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.approval_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
    entity_type public.approval_entity_type NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.approval_workflow_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES public.approval_workflows(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    effective_from TIMESTAMPTZ DEFAULT now() NOT NULL,
    effective_to TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    notes TEXT,
    CONSTRAINT uq_workflow_version UNIQUE (workflow_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.approval_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_version_id UUID NOT NULL REFERENCES public.approval_workflow_versions(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    min_amount NUMERIC(15, 2) DEFAULT 0.00 NOT NULL CHECK (min_amount >= 0),
    max_amount NUMERIC(15, 2) CHECK (max_amount IS NULL OR max_amount >= min_amount),
    approver_role_id VARCHAR(50) REFERENCES public.roles(id) ON DELETE SET NULL,
    specific_approver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    escalation_timeout_hours INTEGER DEFAULT 48 NOT NULL,
    CONSTRAINT chk_rule_approver CHECK (approver_role_id IS NOT NULL OR specific_approver_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.approval_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type public.approval_entity_type NOT NULL,
    entity_id UUID NOT NULL,
    workflow_version_id UUID NOT NULL REFERENCES public.approval_workflow_versions(id) ON DELETE RESTRICT,
    current_step_order INTEGER DEFAULT 1 NOT NULL,
    status public.approval_status DEFAULT 'pending' NOT NULL,
    initiated_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.approval_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES public.approval_instances(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    approver_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    status public.approval_step_status DEFAULT 'pending' NOT NULL,
    comments TEXT,
    action_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.budget_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    request_number VARCHAR(50) UNIQUE NOT NULL,
    requested_amount NUMERIC(15, 2) NOT NULL CHECK (requested_amount > 0),
    approved_amount NUMERIC(15, 2) CHECK (approved_amount IS NULL OR approved_amount >= 0),
    currency VARCHAR(3) DEFAULT 'INR' NOT NULL,
    justification TEXT NOT NULL,
    status public.budget_request_status DEFAULT 'draft' NOT NULL,
    submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- 6. PROCUREMENT: PR, PO & CONFIRMATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.purchase_requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_number VARCHAR(50) UNIQUE NOT NULL,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    status public.pr_status DEFAULT 'draft' NOT NULL,
    urgency public.priority_level DEFAULT 'normal' NOT NULL,
    total_estimated_amount NUMERIC(15, 2) DEFAULT 0.00 NOT NULL CHECK (total_estimated_amount >= 0),
    currency VARCHAR(3) DEFAULT 'INR' NOT NULL,
    purpose TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.pr_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_id UUID NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
    project_material_id UUID NOT NULL REFERENCES public.project_materials(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    estimated_rate NUMERIC(15, 2) NOT NULL CHECK (estimated_rate >= 0),
    estimated_amount NUMERIC(15, 2) GENERATED ALWAYS AS (quantity * estimated_rate) STORED,
    ordered_quantity NUMERIC(12, 3) DEFAULT 0.000 NOT NULL CHECK (ordered_quantity >= 0),
    technical_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(50) UNIQUE NOT NULL,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    supplier_contact_id UUID REFERENCES public.supplier_contacts(id) ON DELETE SET NULL,
    status public.po_status DEFAULT 'draft' NOT NULL,
    subtotal_amount NUMERIC(15, 2) DEFAULT 0.00 NOT NULL CHECK (subtotal_amount >= 0),
    tax_amount NUMERIC(15, 2) DEFAULT 0.00 NOT NULL CHECK (tax_amount >= 0),
    total_amount NUMERIC(15, 2) DEFAULT 0.00 NOT NULL CHECK (total_amount >= 0),
    currency VARCHAR(3) DEFAULT 'INR' NOT NULL,
    payment_terms TEXT NOT NULL,
    delivery_terms TEXT NOT NULL,
    issued_date DATE,
    expected_delivery_date DATE NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.po_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    pr_item_id UUID NOT NULL REFERENCES public.pr_items(id) ON DELETE RESTRICT,
    project_material_id UUID NOT NULL REFERENCES public.project_materials(id) ON DELETE RESTRICT,
    quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    unit_rate NUMERIC(15, 2) NOT NULL CHECK (unit_rate >= 0),
    tax_rate_percent NUMERIC(5, 2) DEFAULT 18.00 NOT NULL CHECK (tax_rate_percent >= 0),
    tax_amount NUMERIC(15, 2) GENERATED ALWAYS AS ((quantity * unit_rate) * (tax_rate_percent / 100.0)) STORED,
    line_total NUMERIC(15, 2) GENERATED ALWAYS AS ((quantity * unit_rate) + ((quantity * unit_rate) * (tax_rate_percent / 100.0))) STORED,
    delivered_quantity NUMERIC(12, 3) DEFAULT 0.000 NOT NULL CHECK (delivered_quantity >= 0),
    invoiced_quantity NUMERIC(12, 3) DEFAULT 0.000 NOT NULL CHECK (invoiced_quantity >= 0),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.po_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    confirmation_reference VARCHAR(100) NOT NULL,
    confirmed_date DATE NOT NULL,
    promised_dispatch_date DATE NOT NULL,
    promised_delivery_date DATE NOT NULL,
    acknowledged_total_amount NUMERIC(15, 2) NOT NULL CHECK (acknowledged_total_amount >= 0),
    notes TEXT,
    confirmed_by_name VARCHAR(100) NOT NULL,
    recorded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- 7. LOGISTICS, DELIVERY SCHEDULES & 3-DAY REMINDERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.delivery_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    schedule_number INTEGER NOT NULL,
    planned_quantity NUMERIC(12, 3) NOT NULL CHECK (planned_quantity > 0),
    promised_delivery_date DATE NOT NULL,
    reminder_sent BOOLEAN DEFAULT false NOT NULL,
    reminder_sent_at TIMESTAMPTZ,
    status public.delivery_schedule_status DEFAULT 'scheduled' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_po_delivery_schedule UNIQUE (po_id, schedule_number)
);

CREATE TABLE IF NOT EXISTS public.delivery_shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_schedule_id UUID NOT NULL REFERENCES public.delivery_schedules(id) ON DELETE CASCADE,
    transporter_name VARCHAR(150) NOT NULL,
    docket_lr_number VARCHAR(100) NOT NULL,
    dispatch_date DATE NOT NULL,
    vehicle_number VARCHAR(30),
    e_way_bill_number VARCHAR(50),
    driver_contact VARCHAR(30),
    status public.shipment_status DEFAULT 'dispatched' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- 8. GOODS RECEIPT NOTES (GRN) & QUALITY INSPECTION
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.goods_receipt_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_number VARCHAR(50) UNIQUE NOT NULL,
    po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
    supplier_challan_number VARCHAR(100) NOT NULL,
    challan_date DATE NOT NULL,
    received_date DATE NOT NULL,
    gate_entry_number VARCHAR(50) NOT NULL,
    received_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    qc_status public.qc_inspection_status DEFAULT 'quarantine' NOT NULL,
    overall_status public.grn_status DEFAULT 'draft' NOT NULL,
    storage_location VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.grn_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id UUID NOT NULL REFERENCES public.goods_receipt_notes(id) ON DELETE CASCADE,
    po_item_id UUID NOT NULL REFERENCES public.po_items(id) ON DELETE RESTRICT,
    batch_lot_number VARCHAR(100) NOT NULL,
    manufacturer_date DATE,
    expiry_date DATE,
    challan_quantity NUMERIC(12, 3) NOT NULL CHECK (challan_quantity >= 0),
    received_quantity NUMERIC(12, 3) NOT NULL CHECK (received_quantity >= 0),
    accepted_quantity NUMERIC(12, 3) DEFAULT 0.000 NOT NULL CHECK (accepted_quantity >= 0),
    rejected_quantity NUMERIC(12, 3) DEFAULT 0.000 NOT NULL CHECK (rejected_quantity >= 0),
    rejection_reason TEXT,
    coa_verified BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- 9. INVOICE VERIFICATION & 3-WAY MATCHING
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(100) NOT NULL,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
    invoice_date DATE NOT NULL,
    received_date DATE NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR' NOT NULL,
    subtotal_amount NUMERIC(15, 2) NOT NULL CHECK (subtotal_amount >= 0),
    tax_amount NUMERIC(15, 2) NOT NULL CHECK (tax_amount >= 0),
    total_amount NUMERIC(15, 2) NOT NULL CHECK (total_amount >= 0),
    due_date DATE NOT NULL,
    verification_status public.invoice_verification_status DEFAULT 'unverified' NOT NULL,
    entered_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_supplier_invoice UNIQUE (supplier_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    po_item_id UUID NOT NULL REFERENCES public.po_items(id) ON DELETE RESTRICT,
    grn_item_id UUID REFERENCES public.grn_items(id) ON DELETE RESTRICT,
    billed_quantity NUMERIC(12, 3) NOT NULL CHECK (billed_quantity > 0),
    unit_rate NUMERIC(15, 2) NOT NULL CHECK (unit_rate >= 0),
    tax_rate_percent NUMERIC(5, 2) NOT NULL CHECK (tax_rate_percent >= 0),
    tax_amount NUMERIC(15, 2) NOT NULL CHECK (tax_amount >= 0),
    line_total NUMERIC(15, 2) NOT NULL CHECK (line_total >= 0),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.three_way_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID UNIQUE NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
    grn_id UUID NOT NULL REFERENCES public.goods_receipt_notes(id) ON DELETE RESTRICT,
    po_total_amount NUMERIC(15, 2) NOT NULL,
    grn_accepted_value NUMERIC(15, 2) NOT NULL,
    invoice_total_amount NUMERIC(15, 2) NOT NULL,
    quantity_variance NUMERIC(12, 3) NOT NULL,
    price_variance NUMERIC(15, 2) NOT NULL,
    total_variance_amount NUMERIC(15, 2) NOT NULL,
    is_within_tolerance BOOLEAN NOT NULL,
    matched_status public.match_status NOT NULL,
    reconciliation_remarks TEXT,
    matched_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    matched_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- 10. PROJECT CLOSURE, DOCUMENTS, NOTIFICATIONS & AUDITING
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.project_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID UNIQUE NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    total_budget_sanctioned NUMERIC(15, 2) NOT NULL,
    total_po_committed NUMERIC(15, 2) NOT NULL,
    total_grn_value NUMERIC(15, 2) NOT NULL,
    total_invoiced NUMERIC(15, 2) NOT NULL,
    total_paid NUMERIC(15, 2) NOT NULL,
    budget_savings_or_overrun NUMERIC(15, 2) NOT NULL,
    unfulfilled_pos_cleared BOOLEAN DEFAULT false NOT NULL,
    inventory_reconciled BOOLEAN DEFAULT false NOT NULL,
    closure_summary TEXT NOT NULL,
    closed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    closed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_bucket VARCHAR(100) NOT NULL,
    storage_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    sha256_checksum VARCHAR(64),
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.entity_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    document_tag VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    is_read BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =============================================================================
-- 11. AUTOMATIC UPDATED_AT TRIGGER & AUDIT TRIGGER
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.log_entity_audit()
RETURNS TRIGGER AS $$
DECLARE
    rec_id UUID;
    v_user_id UUID;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        rec_id := OLD.id;
    ELSE
        rec_id := NEW.id;
    END IF;

    -- Extract current user safely from auth context
    v_user_id := auth.uid();

    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        action,
        old_values,
        new_values,
        changed_by,
        created_at
    ) VALUES (
        TG_TABLE_NAME,
        rec_id,
        TG_OP,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        v_user_id,
        now()
    );

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_material_masters_updated_at ON public.material_masters;
CREATE TRIGGER trg_material_masters_updated_at BEFORE UPDATE ON public.material_masters FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_milestones_updated_at ON public.milestones;
CREATE TRIGGER trg_milestones_updated_at BEFORE UPDATE ON public.milestones FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_project_materials_updated_at ON public.project_materials;
CREATE TRIGGER trg_project_materials_updated_at BEFORE UPDATE ON public.project_materials FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_purchase_requisitions_updated_at ON public.purchase_requisitions;
CREATE TRIGGER trg_purchase_requisitions_updated_at BEFORE UPDATE ON public.purchase_requisitions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_purchase_orders_updated_at ON public.purchase_orders;
CREATE TRIGGER trg_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_delivery_schedules_updated_at ON public.delivery_schedules;
CREATE TRIGGER trg_delivery_schedules_updated_at BEFORE UPDATE ON public.delivery_schedules FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_grn_updated_at ON public.goods_receipt_notes;
CREATE TRIGGER trg_grn_updated_at BEFORE UPDATE ON public.goods_receipt_notes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Apply Audit triggers to high-governance tables
DROP TRIGGER IF EXISTS trg_audit_projects ON public.projects;
CREATE TRIGGER trg_audit_projects AFTER INSERT OR UPDATE OR DELETE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.log_entity_audit();

DROP TRIGGER IF EXISTS trg_audit_budget_requests ON public.budget_requests;
CREATE TRIGGER trg_audit_budget_requests AFTER INSERT OR UPDATE OR DELETE ON public.budget_requests FOR EACH ROW EXECUTE FUNCTION public.log_entity_audit();

DROP TRIGGER IF EXISTS trg_audit_purchase_orders ON public.purchase_orders;
CREATE TRIGGER trg_audit_purchase_orders AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.log_entity_audit();

DROP TRIGGER IF EXISTS trg_audit_invoices ON public.invoices;
CREATE TRIGGER trg_audit_invoices AFTER INSERT OR UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.log_entity_audit();

-- =============================================================================
-- 12. PERFORMANCE INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_dept ON public.projects(department_id);
CREATE INDEX IF NOT EXISTS idx_milestones_proj ON public.milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_proj_mat_proj ON public.project_materials(project_id);
CREATE INDEX IF NOT EXISTS idx_proj_mat_mat ON public.project_materials(material_master_id);
CREATE INDEX IF NOT EXISTS idx_material_cat ON public.material_masters(category);
CREATE INDEX IF NOT EXISTS idx_pr_proj ON public.purchase_requisitions(project_id);
CREATE INDEX IF NOT EXISTS idx_pr_items_pr ON public.pr_items(pr_id);
CREATE INDEX IF NOT EXISTS idx_po_proj ON public.purchase_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_po_supp ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON public.po_items(po_id);
CREATE INDEX IF NOT EXISTS idx_delivery_reminder ON public.delivery_schedules(reminder_sent, promised_delivery_date)
    WHERE status = 'scheduled' AND reminder_sent = false;
CREATE INDEX IF NOT EXISTS idx_grn_po ON public.goods_receipt_notes(po_id);
CREATE INDEX IF NOT EXISTS idx_invoices_po ON public.invoices(po_id);
CREATE INDEX IF NOT EXISTS idx_invoices_supp ON public.invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(verification_status);
CREATE INDEX IF NOT EXISTS idx_audit_table_rec ON public.audit_logs(table_name, record_id);

-- =============================================================================
-- 13. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.three_way_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Base Read Policy for Authenticated Users on Master Data
CREATE POLICY "Allow authenticated read on departments" 
    ON public.departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read on profiles" 
    ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow users to update own profile" 
    ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Allow authenticated read on roles" 
    ON public.roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read on user_roles" 
    ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read on materials" 
    ON public.material_masters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read on suppliers" 
    ON public.suppliers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read on supplier_contacts" 
    ON public.supplier_contacts FOR SELECT TO authenticated USING (true);

-- Super Admin Global Full Access
CREATE POLICY "Super Admin all on departments" ON public.departments FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on roles" ON public.roles FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on user_roles" ON public.user_roles FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on materials" ON public.material_masters FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on suppliers" ON public.suppliers FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on supplier_contacts" ON public.supplier_contacts FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on projects" ON public.projects FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on milestones" ON public.milestones FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on project_materials" ON public.project_materials FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on workflows" ON public.approval_workflows FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on workflow_versions" ON public.approval_workflow_versions FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on approval_rules" ON public.approval_rules FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on approval_instances" ON public.approval_instances FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on approval_steps" ON public.approval_steps FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on budget_requests" ON public.budget_requests FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on PR" ON public.purchase_requisitions FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on PR items" ON public.pr_items FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on PO" ON public.purchase_orders FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on PO items" ON public.po_items FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on PO confirmations" ON public.po_confirmations FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on delivery_schedules" ON public.delivery_schedules FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on delivery_shipments" ON public.delivery_shipments FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on GRN" ON public.goods_receipt_notes FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on GRN items" ON public.grn_items FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on invoices" ON public.invoices FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on invoice_items" ON public.invoice_items FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on three_way_matches" ON public.three_way_matches FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin all on project_closures" ON public.project_closures FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));
CREATE POLICY "Super Admin read on audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.current_user_has_role('super_admin'));

-- SCM Admin & SCM Team Operational Policies
CREATE POLICY "Operational read on projects" ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team insert on projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (
    public.current_user_has_role('scm_admin') OR public.current_user_has_role('scm_team_user')
);
CREATE POLICY "Team update own projects" ON public.projects FOR UPDATE TO authenticated USING (
    public.current_user_has_role('scm_admin') OR (public.current_user_has_role('scm_team_user') AND created_by = auth.uid())
);

CREATE POLICY "Operational read on milestones" ON public.milestones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team manage milestones" ON public.milestones FOR ALL TO authenticated USING (
    public.current_user_has_role('scm_admin') OR public.current_user_has_role('scm_team_user')
);

CREATE POLICY "Operational read on project_materials" ON public.project_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team manage project_materials" ON public.project_materials FOR ALL TO authenticated USING (
    public.current_user_has_role('scm_admin') OR public.current_user_has_role('scm_team_user')
);

CREATE POLICY "Operational read on PR" ON public.purchase_requisitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team manage PR" ON public.purchase_requisitions FOR ALL TO authenticated USING (
    public.current_user_has_role('scm_admin') OR public.current_user_has_role('scm_team_user')
);

CREATE POLICY "Operational read on PR items" ON public.pr_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team manage PR items" ON public.pr_items FOR ALL TO authenticated USING (
    public.current_user_has_role('scm_admin') OR public.current_user_has_role('scm_team_user')
);

CREATE POLICY "Operational read on PO" ON public.purchase_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage PO" ON public.purchase_orders FOR ALL TO authenticated USING (
    public.current_user_has_role('scm_admin')
);
CREATE POLICY "Team create draft PO" ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (
    public.current_user_has_role('scm_team_user')
);

CREATE POLICY "Operational read on PO items" ON public.po_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage PO items" ON public.po_items FOR ALL TO authenticated USING (
    public.current_user_has_role('scm_admin')
);

CREATE POLICY "Operational read on GRN" ON public.goods_receipt_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team manage GRN" ON public.goods_receipt_notes FOR ALL TO authenticated USING (
    public.current_user_has_role('scm_admin') OR public.current_user_has_role('scm_team_user')
);

CREATE POLICY "Operational read on GRN items" ON public.grn_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team manage GRN items" ON public.grn_items FOR ALL TO authenticated USING (
    public.current_user_has_role('scm_admin') OR public.current_user_has_role('scm_team_user')
);

CREATE POLICY "Operational read on Invoices" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Team create Invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (
    public.current_user_has_role('scm_admin') OR public.current_user_has_role('scm_team_user')
);
CREATE POLICY "Admin verify Invoices" ON public.invoices FOR UPDATE TO authenticated USING (
    public.current_user_has_role('scm_admin')
);

CREATE POLICY "User read own notifications" ON public.notifications FOR SELECT TO authenticated USING (
    recipient_user_id = auth.uid()
);
CREATE POLICY "User update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (
    recipient_user_id = auth.uid()
);

-- =============================================================================
-- 14. SEED MASTER ROLES & INITIAL CONFIGURATION
-- =============================================================================

INSERT INTO public.roles (id, name, description) VALUES
    ('super_admin', 'Super Admin', 'Full system control, user provisioning, global overrides, and security audit inspection.'),
    ('scm_admin', 'SCM Admin', 'Supply chain governance, approval workflow definitions, vendor management, and PO authorization.'),
    ('scm_team_user', 'SCM Team User', 'Operational execution across projects, BOM requisitions, deliveries, GRN, and preliminary invoice capture.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.departments (name, code) VALUES
    ('Formulations & Synthesis', 'FORM-01'),
    ('Supply Chain Management', 'SCM-01'),
    ('Quality Assurance & Control', 'QAQC-01'),
    ('Finance & Accounts', 'FIN-01'),
    ('Operations & Engineering', 'OPS-01')
ON CONFLICT (code) DO NOTHING;

COMMIT;

