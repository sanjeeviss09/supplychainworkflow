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

-- =============================================================================
-- 15. PHASE 1 & PHASE 2: EMPLOYEE ACCESS, PERMISSIONS, IMPORT & AUDIT SECURITY
-- =============================================================================

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
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT chk_employees_non_empty_fields CHECK (
        length(trim(employee_id)) > 0
        AND length(trim(full_name)) > 0
        AND position('@' in trim(email)) > 1
    )
);

CREATE INDEX IF NOT EXISTS idx_employees_email_lower ON public.employees(lower(email));
CREATE INDEX IF NOT EXISTS idx_employees_emp_id_lower ON public.employees(lower(employee_id));
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_role ON public.employees(assigned_role);

DROP TRIGGER IF EXISTS trg_employees_updated_at ON public.employees;
CREATE TRIGGER trg_employees_updated_at 
    BEFORE UPDATE ON public.employees 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Granular Permissions & Role-Permission Mappings
CREATE TABLE IF NOT EXISTS public.permissions (
    id VARCHAR(100) PRIMARY KEY,
    module VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id VARCHAR(50) NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(100) NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_role_permission UNIQUE (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);

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

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'super_admin', id FROM public.permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_admin', 'employees.read'),
    ('scm_admin', 'settings.read'),
    ('scm_admin', 'scm.projects.read'),
    ('scm_admin', 'scm.projects.write'),
    ('scm_admin', 'scm.workflows.manage'),
    ('scm_admin', 'scm.requisitions.write'),
    ('scm_admin', 'scm.orders.authorize'),
    ('scm_admin', 'scm.receiving.write'),
    ('scm_admin', 'scm.invoices.verify'),
    ('scm_team_user', 'settings.read'),
    ('scm_team_user', 'scm.projects.read'),
    ('scm_team_user', 'scm.projects.write'),
    ('scm_team_user', 'scm.requisitions.write'),
    ('scm_team_user', 'scm.receiving.write')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Employee Import History & Row-Level Results
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

CREATE INDEX IF NOT EXISTS idx_import_batches_actor ON public.employee_import_batches(imported_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_rows_batch ON public.employee_import_rows(batch_id, row_number);
CREATE INDEX IF NOT EXISTS idx_import_rows_outcome ON public.employee_import_rows(batch_id, outcome);

-- Application Settings
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

-- Audit Log Hardening & Secret Sanitization
ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS outcome VARCHAR(30) DEFAULT 'SUCCESS' NOT NULL,
    ADD COLUMN IF NOT EXISTS target_employee_id VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

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

-- Centralized Active-Employee & Role/Permission Resolution
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

-- Synchronization and Guard Triggers on employees
CREATE OR REPLACE FUNCTION public.trg_fn_guard_employee_security_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

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

CREATE OR REPLACE FUNCTION public.handle_employee_update_sync()
RETURNS TRIGGER AS $$
DECLARE
    v_actor UUID := auth.uid();
BEGIN
    IF (OLD.assigned_role IS DISTINCT FROM NEW.assigned_role AND NEW.user_id IS NOT NULL) THEN
        UPDATE public.user_roles 
        SET role_id = NEW.assigned_role,
            assigned_by = v_actor
        WHERE user_id = NEW.user_id;

        IF NOT FOUND THEN
            INSERT INTO public.user_roles (user_id, role_id, assigned_by)
            VALUES (NEW.user_id, NEW.assigned_role, v_actor)
            ON CONFLICT (user_id, role_id) DO NOTHING;
        END IF;

        PERFORM public.write_security_audit_event(
            'employees',
            NEW.id,
            'ROLE_CHANGED',
            jsonb_build_object('role', OLD.assigned_role, 'employee_id', OLD.employee_id),
            jsonb_build_object('role', NEW.assigned_role, 'employee_id', NEW.employee_id),
            NEW.employee_id,
            'SUCCESS'
        );
    END IF;

    IF (OLD.is_active IS DISTINCT FROM NEW.is_active AND NEW.user_id IS NOT NULL) THEN
        UPDATE public.profiles 
        SET is_active = NEW.is_active
        WHERE id = NEW.user_id;

        PERFORM public.write_security_audit_event(
            'employees',
            NEW.id,
            CASE WHEN NEW.is_active THEN 'EMPLOYEE_ACTIVATED' ELSE 'EMPLOYEE_DEACTIVATED' END,
            jsonb_build_object('is_active', OLD.is_active, 'employee_id', OLD.employee_id),
            jsonb_build_object('is_active', NEW.is_active, 'employee_id', NEW.employee_id),
            NEW.employee_id,
            'SUCCESS'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_employee_update_sync ON public.employees;
CREATE TRIGGER trg_employee_update_sync 
    AFTER UPDATE ON public.employees 
    FOR EACH ROW EXECUTE FUNCTION public.handle_employee_update_sync();

-- Server-side signup trigger: requires active employee record to register
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_emp public.employees%ROWTYPE;
    v_first_name VARCHAR(100);
    v_last_name VARCHAR(100);
    v_dept_id UUID;
    v_space_idx INTEGER;
BEGIN
    SELECT * INTO v_emp 
    FROM public.employees 
    WHERE lower(trim(email)) = lower(trim(NEW.email))
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration denied: No employee record found matching work email %', NEW.email;
    END IF;

    IF (v_emp.is_active = false) THEN
        RAISE EXCEPTION 'Registration denied: Employee record for % is currently deactivated. Contact SCM Administrator.', NEW.email;
    END IF;

    v_space_idx := position(' ' in trim(v_emp.full_name));
    IF v_space_idx > 0 THEN
        v_first_name := substring(trim(v_emp.full_name) from 1 for v_space_idx - 1);
        v_last_name := substring(trim(v_emp.full_name) from v_space_idx + 1);
    ELSE
        v_first_name := trim(v_emp.full_name);
        v_last_name := '';
    END IF;

    SELECT id INTO v_dept_id 
    FROM public.departments 
    WHERE lower(name) = lower(v_emp.department) 
    LIMIT 1;

    INSERT INTO public.profiles (id, email, first_name, last_name, department_id, is_active)
    VALUES (NEW.id, NEW.email, v_first_name, v_last_name, v_dept_id, true)
    ON CONFLICT (id) DO UPDATE 
    SET first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        is_active = true;

    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, v_emp.assigned_role)
    ON CONFLICT (user_id, role_id) DO NOTHING;

    UPDATE public.employees 
    SET user_id = NEW.id 
    WHERE id = v_emp.id;

    PERFORM public.write_security_audit_event(
        'employees',
        v_emp.id,
        'ACCOUNT_PROVISIONED',
        NULL,
        jsonb_build_object(
            'employee_id', v_emp.employee_id,
            'email', NEW.email,
            'role', v_emp.assigned_role,
            'user_id', NEW.id
        ),
        v_emp.employee_id,
        'SUCCESS'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
    AFTER INSERT ON auth.users 
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- RPC: Validate employee for signup
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

-- RPC: Resolve login identifier (User ID or Email)
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

-- RPC: Complete password change
CREATE OR REPLACE FUNCTION public.complete_password_change()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_emp public.employees%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE public.employees 
    SET must_change_password = false,
        updated_at = now()
    WHERE user_id = v_user_id
    RETURNING * INTO v_emp;

    PERFORM public.write_security_audit_event(
        'employees',
        coalesce(v_emp.id, v_user_id),
        'PASSWORD_CHANGED',
        NULL,
        jsonb_build_object('must_change_password', false),
        v_emp.employee_id,
        'SUCCESS'
    );

    RETURN jsonb_build_object('success', true);
END;
$$;

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
    IF NOT public.current_user_has_role('super_admin') THEN
        RAISE EXCEPTION 'Access denied: Only an active Super Admin can create or modify employee records.';
    END IF;

    IF v_clean_role NOT IN ('super_admin', 'scm_admin', 'scm_team_user') THEN
        RAISE EXCEPTION 'Validation failed: Role must be explicitly set to super_admin, scm_admin, or scm_team_user.';
    END IF;

    IF v_clean_name = '' THEN
        RAISE EXCEPTION 'Validation failed: Full name is required.';
    END IF;

    IF p_id IS NULL THEN
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

-- Employee Import Validation, Preview & Confirm RPCs
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
    IF NOT public.current_user_has_role('super_admin') THEN
        RAISE EXCEPTION 'Access denied: Only an active Super Admin can validate or import employee lists.';
    END IF;

    IF trim(coalesce(p_file_name, '')) = '' THEN
        RAISE EXCEPTION 'Validation failed: File name is required.';
    END IF;

    IF v_clean_type NOT IN ('csv', 'xlsx', 'xls') THEN
        RAISE EXCEPTION 'Validation failed: Unsupported file type "%". Only CSV and Excel (XLSX/XLS) are permitted.', p_file_type;
    END IF;

    IF p_records IS NULL OR jsonb_typeof(p_records) != 'array' OR jsonb_array_length(p_records) = 0 THEN
        RAISE EXCEPTION 'Validation failed: The import payload contains no rows.';
    END IF;

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

        IF v_emp_id != '' THEN
            v_seen_emp_ids := array_append(v_seen_emp_ids, v_emp_id);
        END IF;
        IF v_email != '' THEN
            v_seen_emails := array_append(v_seen_emails, v_email);
        END IF;

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

    v_validation := public.validate_employee_import_payload(p_file_name, p_file_type, p_records);

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

-- Least-Privilege RLS Policies for Core Identity & Governance Tables
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated read on user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super Admin read on audit_logs" ON public.audit_logs;

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

CREATE POLICY "Super Admin manage employees"
    ON public.employees FOR ALL TO authenticated 
    USING (public.current_user_has_role('super_admin'))
    WITH CHECK (public.current_user_has_role('super_admin'));

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

CREATE POLICY "Active employees read permissions"
    ON public.permissions FOR SELECT TO authenticated
    USING (public.current_user_is_active_employee());

CREATE POLICY "Super Admin manage permissions"
    ON public.permissions FOR ALL TO authenticated
    USING (public.current_user_has_role('super_admin'))
    WITH CHECK (public.current_user_has_role('super_admin'));

CREATE POLICY "Active employees read role_permissions"
    ON public.role_permissions FOR SELECT TO authenticated
    USING (public.current_user_is_active_employee());

CREATE POLICY "Super Admin manage role_permissions"
    ON public.role_permissions FOR ALL TO authenticated
    USING (public.current_user_has_role('super_admin'))
    WITH CHECK (public.current_user_has_role('super_admin'));

CREATE POLICY "Super Admin manage import batches"
    ON public.employee_import_batches FOR ALL TO authenticated
    USING (public.current_user_has_role('super_admin'))
    WITH CHECK (public.current_user_has_role('super_admin'));

CREATE POLICY "Super Admin manage import rows"
    ON public.employee_import_rows FOR ALL TO authenticated
    USING (public.current_user_has_role('super_admin'))
    WITH CHECK (public.current_user_has_role('super_admin'));

CREATE POLICY "Active employees read public settings"
    ON public.app_settings FOR SELECT TO authenticated
    USING (
        public.current_user_is_active_employee()
        AND (is_public = true OR public.current_user_has_role('super_admin'))
    );

CREATE POLICY "Super Admin manage app settings"
    ON public.app_settings FOR ALL TO authenticated
    USING (public.current_user_has_role('super_admin'))
    WITH CHECK (public.current_user_has_role('super_admin'));

CREATE POLICY "Super Admin read on audit_logs"
    ON public.audit_logs FOR SELECT TO authenticated
    USING (public.current_user_has_role('super_admin'));

-- =============================================================================
-- PHASE 3: CANONICAL ROLE-ROUTE PERMISSIONS & WORKFLOW AUTHORIZATION
-- =============================================================================

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

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'super_admin', id FROM public.permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_admin', 'profile.view.self'),
    ('scm_admin', 'projects.view'),
    ('scm_admin', 'materials.view'),
    ('scm_admin', 'budgets.view'),
    ('scm_admin', 'procurement.view'),
    ('scm_admin', 'deliveries.view'),
    ('scm_admin', 'reports.view'),
    ('scm_admin', 'settings.scm.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_team_user', 'profile.view.self'),
    ('scm_team_user', 'projects.view'),
    ('scm_team_user', 'materials.view'),
    ('scm_team_user', 'procurement.view'),
    ('scm_team_user', 'deliveries.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

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
    IF v_user_id IS NULL OR v_user_id = p_requester_id THEN
        RETURN FALSE;
    END IF;

    IF NOT public.current_user_is_active_employee() THEN
        RETURN FALSE;
    END IF;

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

-- =============================================================================
-- PHASE 4: FULL PROJECTS AND MILESTONES IMPLEMENTATION
-- =============================================================================

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

DO $$ BEGIN
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

UPDATE public.projects
SET name = coalesce(name, title),
    planned_start_date = coalesce(planned_start_date, target_start_date, CURRENT_DATE),
    planned_end_date = coalesce(planned_end_date, target_completion_date, CURRENT_DATE + INTERVAL '30 days')
WHERE name IS NULL OR planned_start_date IS NULL OR planned_end_date IS NULL;

ALTER TABLE public.projects ALTER COLUMN project_code SET DEFAULT public.generate_project_code();

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS chk_project_dates;
ALTER TABLE public.projects ADD CONSTRAINT chk_project_dates CHECK (planned_end_date >= planned_start_date);

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS chk_project_completed;
ALTER TABLE public.projects ADD CONSTRAINT chk_project_completed CHECK (status::text != 'completed' OR actual_completion_date IS NOT NULL);

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS chk_project_completion_date;
ALTER TABLE public.projects ADD CONSTRAINT chk_project_completion_date CHECK (actual_completion_date IS NULL OR actual_completion_date >= planned_start_date);

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

CREATE UNIQUE INDEX IF NOT EXISTS uq_project_active_member
    ON public.project_members(project_id, employee_id)
    WHERE status = 'active';

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

UPDATE public.milestones
SET planned_start_date = coalesce(planned_start_date, CURRENT_DATE),
    planned_end_date = coalesce(planned_end_date, target_date, CURRENT_DATE + INTERVAL '14 days'),
    milestone_code = coalesce(milestone_code, 'MLS-' || lpad(sequence_number::text, 2, '0'))
WHERE planned_start_date IS NULL OR planned_end_date IS NULL OR milestone_code IS NULL;

ALTER TABLE public.milestones DROP CONSTRAINT IF EXISTS chk_milestone_dates;
ALTER TABLE public.milestones ADD CONSTRAINT chk_milestone_dates CHECK (planned_end_date >= planned_start_date);

ALTER TABLE public.milestones DROP CONSTRAINT IF EXISTS chk_milestone_completion_date;
ALTER TABLE public.milestones ADD CONSTRAINT chk_milestone_completion_date CHECK (actual_completion_date IS NULL OR actual_completion_date >= planned_start_date);

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

CREATE TABLE IF NOT EXISTS public.project_explicit_denies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

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

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'super_admin', id FROM public.permissions
WHERE id LIKE 'projects.%' OR id LIKE 'milestones.%'
ON CONFLICT (role_id, permission_id) DO NOTHING;

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

INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_team_user', 'projects.view'),
    ('scm_team_user', 'projects.create'),
    ('scm_team_user', 'projects.update'),
    ('scm_team_user', 'milestones.view'),
    ('scm_team_user', 'milestones.create'),
    ('scm_team_user', 'milestones.update'),
    ('scm_team_user', 'milestones.complete')
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;

-- =============================================================================
-- SCM FLOW — SUPPLIER DELIVERY PERFORMANCE & ANALYTICS
-- File: backend/supabase/migrations/20261103080000_supplier_delivery_performance.sql
-- =============================================================================

BEGIN;

-- 1. Index Optimizations for Analytics & Scorecard Queries
CREATE INDEX IF NOT EXISTS idx_mdt_supplier_commitment 
ON public.material_delivery_tracking(supplier_id, original_committed_delivery_date);

CREATE INDEX IF NOT EXISTS idx_mdt_supplier_expected
ON public.material_delivery_tracking(supplier_id, current_expected_delivery_date);

CREATE INDEX IF NOT EXISTS idx_mdt_completion_date 
ON public.material_delivery_tracking(actual_completion_date);

CREATE INDEX IF NOT EXISTS idx_mdt_supplier_category
ON public.material_delivery_tracking(supplier_id, category);


-- 2. Seed Granular Permissions for Supplier Performance
INSERT INTO public.permissions (id, module, description) VALUES
    ('supplier_performance.view', 'supplier_management', 'View supplier delivery performance analytics, scorecards, and trends'),
    ('supplier_performance.export', 'supplier_management', 'Export supplier performance analytics and PO line drill-down to CSV/Excel')
ON CONFLICT (id) DO UPDATE 
SET module = EXCLUDED.module,
    description = EXCLUDED.description;


-- 3. Map Permissions to Roles
-- Super Admin has full view and export authority
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('super_admin', 'supplier_performance.view'),
    ('super_admin', 'supplier_performance.export')
ON CONFLICT DO NOTHING;

-- SCM Admin has full view and export authority
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_admin', 'supplier_performance.view'),
    ('scm_admin', 'supplier_performance.export')
ON CONFLICT DO NOTHING;

-- SCM Team User has operational view authority
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_team_user', 'supplier_performance.view')
ON CONFLICT DO NOTHING;


-- 4. Authoritative Supplier Performance Analytics RPC
CREATE OR REPLACE FUNCTION public.api_get_supplier_performance_analytics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_supplier_id UUID DEFAULT NULL,
    p_category VARCHAR DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_today_ist DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE;
    v_result JSONB;
BEGIN
    -- Verify permission
    IF NOT public.current_user_has_permission('supplier_performance.view') 
       AND NOT public.current_user_has_permission('delivery_reports.view') THEN
        RAISE EXCEPTION 'Access denied: You do not have permission to view supplier performance analytics.';
    END IF;

    WITH filtered_lines AS (
        SELECT 
            mdt.id,
            mdt.sap_po_number,
            mdt.sap_po_line_number,
            mdt.category,
            mdt.supplier_id,
            mdt.supplier_name,
            mdt.ordered_quantity,
            mdt.delivered_quantity,
            mdt.uom,
            mdt.original_committed_delivery_date,
            mdt.current_expected_delivery_date,
            mdt.actual_completion_date,
            mdt.delivery_status,
            -- Evaluated commitment date
            mdt.original_committed_delivery_date AS committed_date,
            -- Is fully delivered
            (mdt.delivered_quantity >= mdt.ordered_quantity AND mdt.ordered_quantity > 0) AS is_delivered,
            -- Outstanding quantity
            GREATEST(0, mdt.ordered_quantity - mdt.delivered_quantity) AS outstanding_qty,
            -- Delay days against original commitment
            CASE 
                WHEN mdt.original_committed_delivery_date IS NULL THEN NULL
                WHEN (mdt.delivered_quantity >= mdt.ordered_quantity AND mdt.ordered_quantity > 0) THEN 
                    GREATEST(0, (COALESCE(mdt.actual_completion_date, v_today_ist) - mdt.original_committed_delivery_date))
                ELSE 
                    GREATEST(0, (v_today_ist - mdt.original_committed_delivery_date))
            END AS original_delay_days,
            -- Current overdue days against revised expected date
            CASE
                WHEN (mdt.delivered_quantity >= mdt.ordered_quantity AND mdt.ordered_quantity > 0) THEN 0
                WHEN mdt.current_expected_delivery_date IS NULL THEN 0
                ELSE GREATEST(0, (v_today_ist - mdt.current_expected_delivery_date))
            END AS current_overdue_days
        FROM public.material_delivery_tracking mdt
        WHERE mdt.delivery_status <> 'CANCELLED'
          AND (p_supplier_id IS NULL OR mdt.supplier_id = p_supplier_id)
          AND (p_category IS NULL OR mdt.category = p_category)
          AND (p_start_date IS NULL OR COALESCE(mdt.original_committed_delivery_date, mdt.current_expected_delivery_date) >= p_start_date)
          AND (p_end_date IS NULL OR COALESCE(mdt.original_committed_delivery_date, mdt.current_expected_delivery_date) <= p_end_date)
    ),
    scorecard_by_supplier AS (
        SELECT 
            fl.supplier_id,
            COALESCE(fl.supplier_name, 'Unknown Supplier') AS supplier_name,
            COUNT(*) AS total_lines,
            COUNT(*) FILTER (WHERE fl.committed_date IS NULL) AS missing_commitment_count,
            COUNT(*) FILTER (WHERE fl.committed_date IS NOT NULL) AS evaluable_lines,
            COUNT(*) FILTER (WHERE fl.is_delivered AND fl.committed_date IS NOT NULL AND fl.actual_completion_date <= fl.committed_date) AS on_time_delivered_lines,
            COUNT(*) FILTER (WHERE fl.is_delivered AND fl.committed_date IS NOT NULL AND fl.actual_completion_date > fl.committed_date) AS late_delivered_lines,
            COUNT(*) FILTER (WHERE NOT fl.is_delivered AND fl.committed_date IS NOT NULL AND v_today_ist > fl.committed_date) AS overdue_outstanding_lines,
            COUNT(*) FILTER (WHERE NOT fl.is_delivered AND fl.delivered_quantity > 0) AS partial_delivery_lines,
            SUM(fl.outstanding_qty) AS total_outstanding_quantity,
            ROUND(
                AVG(fl.original_delay_days) FILTER (WHERE fl.is_delivered AND fl.original_delay_days > 0),
                1
            ) AS avg_final_delay_days_late,
            COALESCE(
                MAX(fl.original_delay_days) FILTER (WHERE fl.is_delivered),
                0
            ) AS max_final_delay_days,
            ROUND(
                AVG(fl.original_delay_days) FILTER (WHERE NOT fl.is_delivered AND fl.original_delay_days > 0),
                1
            ) AS avg_current_delay_days_overdue
        FROM filtered_lines fl
        GROUP BY fl.supplier_id, fl.supplier_name
    ),
    category_summary AS (
        SELECT 
            fl.category,
            COUNT(*) AS total_lines,
            COUNT(*) FILTER (WHERE fl.is_delivered AND fl.committed_date IS NOT NULL AND fl.actual_completion_date <= fl.committed_date) AS on_time_lines,
            COUNT(*) FILTER (WHERE fl.committed_date IS NOT NULL AND fl.original_delay_days > 0) AS delayed_lines,
            COUNT(*) FILTER (WHERE fl.committed_date IS NULL) AS missing_commitment_count,
            ROUND(
                CASE 
                    WHEN COUNT(*) FILTER (WHERE fl.committed_date IS NOT NULL) > 0 THEN 
                        (COUNT(*) FILTER (WHERE fl.is_delivered AND fl.committed_date IS NOT NULL AND fl.actual_completion_date <= fl.committed_date)::NUMERIC / 
                         COUNT(*) FILTER (WHERE fl.committed_date IS NOT NULL)::NUMERIC) * 100
                    ELSE 0 
                END, 
                1
            ) AS on_time_percentage
        FROM filtered_lines fl
        GROUP BY fl.category
    ),
    delay_reasons_summary AS (
        SELECT 
            dl.delay_reason_category,
            COUNT(*) AS occurrences_count,
            COUNT(DISTINCT dl.tracking_id) AS distinct_lines_affected
        FROM public.material_delivery_delay_logs dl
        JOIN filtered_lines fl ON fl.id = dl.tracking_id
        GROUP BY dl.delay_reason_category
        ORDER BY occurrences_count DESC
        LIMIT 10
    )
    SELECT jsonb_build_object(
        'as_of_date_ist', v_today_ist,
        'filters', jsonb_build_object(
            'start_date', p_start_date,
            'end_date', p_end_date,
            'supplier_id', p_supplier_id,
            'category', p_category
        ),
        'overall_summary', (
            SELECT jsonb_build_object(
                'total_lines', COUNT(*),
                'total_delivered_lines', COUNT(*) FILTER (WHERE fl.is_delivered),
                'total_on_time_lines', COUNT(*) FILTER (WHERE fl.is_delivered AND fl.committed_date IS NOT NULL AND fl.actual_completion_date <= fl.committed_date),
                'total_late_completed_lines', COUNT(*) FILTER (WHERE fl.is_delivered AND fl.committed_date IS NOT NULL AND fl.actual_completion_date > fl.committed_date),
                'total_overdue_outstanding_lines', COUNT(*) FILTER (WHERE NOT fl.is_delivered AND fl.committed_date IS NOT NULL AND v_today_ist > fl.committed_date),
                'total_partial_lines', COUNT(*) FILTER (WHERE NOT fl.is_delivered AND fl.delivered_quantity > 0),
                'total_missing_commitment_lines', COUNT(*) FILTER (WHERE fl.committed_date IS NULL),
                'on_time_delivery_rate', ROUND(
                    CASE 
                        WHEN COUNT(*) FILTER (WHERE fl.committed_date IS NOT NULL) > 0 THEN 
                            (COUNT(*) FILTER (WHERE fl.is_delivered AND fl.committed_date IS NOT NULL AND fl.actual_completion_date <= fl.committed_date)::NUMERIC / 
                             COUNT(*) FILTER (WHERE fl.committed_date IS NOT NULL)::NUMERIC) * 100
                        ELSE 0 
                    END, 
                    1
                ),
                'avg_final_delay_days', COALESCE(ROUND(AVG(fl.original_delay_days) FILTER (WHERE fl.is_delivered AND fl.original_delay_days > 0), 1), 0),
                'max_final_delay_days', COALESCE(MAX(fl.original_delay_days) FILTER (WHERE fl.is_delivered), 0),
                'avg_current_delay_days', COALESCE(ROUND(AVG(fl.original_delay_days) FILTER (WHERE NOT fl.is_delivered AND fl.original_delay_days > 0), 1), 0)
            ) FROM filtered_lines fl
        ),
        'supplier_scorecards', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'supplier_id', s.supplier_id,
                    'supplier_name', s.supplier_name,
                    'total_lines', s.total_lines,
                    'evaluable_lines', s.evaluable_lines,
                    'missing_commitment_count', s.missing_commitment_count,
                    'on_time_delivered_lines', s.on_time_delivered_lines,
                    'late_delivered_lines', s.late_delivered_lines,
                    'overdue_outstanding_lines', s.overdue_outstanding_lines,
                    'partial_delivery_lines', s.partial_delivery_lines,
                    'total_outstanding_quantity', s.total_outstanding_quantity,
                    'on_time_percentage', ROUND(
                        CASE 
                            WHEN s.evaluable_lines > 0 THEN 
                                (s.on_time_delivered_lines::NUMERIC / s.evaluable_lines::NUMERIC) * 100
                            ELSE 0 
                        END, 
                        1
                    ),
                    'avg_final_delay_days_late', COALESCE(s.avg_final_delay_days_late, 0),
                    'max_final_delay_days', s.max_final_delay_days,
                    'avg_current_delay_days_overdue', COALESCE(s.avg_current_delay_days_overdue, 0)
                ) ORDER BY s.total_lines DESC, s.supplier_name ASC
            ), '[]'::jsonb) FROM scorecard_by_supplier s
        ),
        'category_breakdown', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'category', c.category,
                    'total_lines', c.total_lines,
                    'on_time_lines', c.on_time_lines,
                    'delayed_lines', c.delayed_lines,
                    'missing_commitment_count', c.missing_commitment_count,
                    'on_time_percentage', c.on_time_percentage
                )
            ), '[]'::jsonb) FROM category_summary c
        ),
        'delay_reasons_breakdown', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'category', dr.delay_reason_category,
                    'occurrences_count', dr.occurrences_count,
                    'distinct_lines_affected', dr.distinct_lines_affected
                )
            ), '[]'::jsonb) FROM delay_reasons_summary dr
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Grant execution to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.api_get_supplier_performance_analytics(DATE, DATE, UUID, VARCHAR) TO authenticated, service_role;

COMMIT;
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
-- =============================================================================
-- SCM FLOW — PHASE 10: INCOMING MATERIAL DELIVERY PLANNING & SCHEDULE MANAGEMENT
-- File: backend/supabase/migrations/20261103100000_phase10_delivery_planning_calendar.sql
-- =============================================================================

BEGIN;

-- 1. Index Optimizations for Date-Based Planning Queries
CREATE INDEX IF NOT EXISTS idx_mdt_expected_status 
ON public.material_delivery_tracking(current_expected_delivery_date, delivery_status);

CREATE INDEX IF NOT EXISTS idx_mdt_assigned_expected 
ON public.material_delivery_tracking(assigned_employee_id, current_expected_delivery_date);

CREATE INDEX IF NOT EXISTS idx_ddh_changed_at 
ON public.delivery_date_history(changed_at);


-- 2. Seed Granular Permissions for Delivery Planning
INSERT INTO public.permissions (id, module, description) VALUES
    ('delivery_planning.view', 'delivery_planning', 'View incoming material delivery schedule, calendar, and workload planning'),
    ('delivery_planning.export', 'delivery_planning', 'Export incoming delivery schedules, calendar agendas, and workload summaries')
ON CONFLICT (id) DO UPDATE 
SET module = EXCLUDED.module,
    description = EXCLUDED.description;


-- 3. Map Permissions to Roles
-- Super Admin
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('super_admin', 'delivery_planning.view'),
    ('super_admin', 'delivery_planning.export')
ON CONFLICT DO NOTHING;

-- SCM Admin
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_admin', 'delivery_planning.view'),
    ('scm_admin', 'delivery_planning.export')
ON CONFLICT DO NOTHING;

-- SCM Team User (Full planning view and operational export)
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    ('scm_team_user', 'delivery_planning.view'),
    ('scm_team_user', 'delivery_planning.export')
ON CONFLICT DO NOTHING;


-- 4. Authoritative Planning & Calendar Schedule RPC
CREATE OR REPLACE FUNCTION public.api_get_delivery_planning_schedule(
    p_start_date DATE,
    p_end_date DATE,
    p_supplier_id UUID DEFAULT NULL,
    p_category VARCHAR DEFAULT NULL,
    p_assigned_employee_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_today_ist DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE;
    v_result JSONB;
BEGIN
    -- Authorization check
    IF NOT public.current_user_has_permission('delivery_planning.view') 
       AND NOT public.current_user_has_permission('deliveries.view') THEN
        RAISE EXCEPTION 'Access denied: You do not have permission to view delivery planning schedules.';
    END IF;

    WITH filtered_tracking AS (
        SELECT 
            mdt.id,
            mdt.sap_po_number,
            mdt.sap_po_line_number,
            mdt.category,
            mdt.material_code,
            mdt.material_description,
            mdt.supplier_id,
            mdt.supplier_name,
            mdt.ordered_quantity,
            mdt.delivered_quantity,
            GREATEST(0, mdt.ordered_quantity - mdt.delivered_quantity) AS outstanding_quantity,
            mdt.uom,
            mdt.assigned_employee_id,
            e.full_name AS assigned_employee_name,
            e.employee_id AS assigned_employee_code,
            mdt.original_committed_delivery_date,
            mdt.current_expected_delivery_date,
            mdt.actual_completion_date,
            mdt.delivery_status,
            -- Evaluated operational date for calendar placement
            COALESCE(mdt.current_expected_delivery_date, mdt.original_committed_delivery_date) AS operational_date,
            -- Status indicators
            (mdt.delivered_quantity >= mdt.ordered_quantity AND mdt.ordered_quantity > 0) AS is_delivered,
            (mdt.delivered_quantity > 0 AND mdt.delivered_quantity < mdt.ordered_quantity) AS is_partial,
            (mdt.current_expected_delivery_date = v_today_ist AND mdt.delivered_quantity < mdt.ordered_quantity) AS is_due_today,
            (mdt.original_committed_delivery_date IS NOT NULL AND v_today_ist > mdt.original_committed_delivery_date AND mdt.delivered_quantity < mdt.ordered_quantity) AS is_overdue,
            (mdt.current_expected_delivery_date > v_today_ist AND mdt.delivered_quantity < mdt.ordered_quantity) AS is_upcoming,
            -- Delay days against original commitment
            CASE 
                WHEN mdt.original_committed_delivery_date IS NULL THEN NULL
                WHEN (mdt.delivered_quantity >= mdt.ordered_quantity AND mdt.ordered_quantity > 0) THEN 
                    GREATEST(0, (COALESCE(mdt.actual_completion_date, v_today_ist) - mdt.original_committed_delivery_date))
                ELSE 
                    GREATEST(0, (v_today_ist - mdt.original_committed_delivery_date))
            END AS original_delay_days,
            -- Open Issue flags from Phase 9
            EXISTS (
                SELECT 1 FROM public.delivery_issues di 
                WHERE di.tracking_id = mdt.id AND di.status NOT IN ('Resolved', 'Closed')
            ) AS has_open_issue,
            EXISTS (
                SELECT 1 FROM public.delivery_issues di 
                WHERE di.tracking_id = mdt.id AND di.status NOT IN ('Resolved', 'Closed') AND di.severity IN ('High', 'Critical')
            ) AS has_critical_issue
        FROM public.material_delivery_tracking mdt
        LEFT JOIN public.employees e ON e.id = mdt.assigned_employee_id
        WHERE mdt.delivery_status <> 'CANCELLED'
          AND (p_supplier_id IS NULL OR mdt.supplier_id = p_supplier_id)
          AND (p_category IS NULL OR mdt.category = p_category)
          AND (p_assigned_employee_id IS NULL OR mdt.assigned_employee_id = p_assigned_employee_id)
          AND (
              COALESCE(mdt.current_expected_delivery_date, mdt.original_committed_delivery_date) BETWEEN p_start_date AND p_end_date
              OR (mdt.delivered_quantity < mdt.ordered_quantity AND mdt.original_committed_delivery_date < p_start_date) -- include carried-over overdue
          )
    ),
    uom_quantity_aggregations AS (
        SELECT 
            ft.uom,
            ft.category,
            COUNT(*) AS po_lines_count,
            SUM(ft.ordered_quantity) AS total_ordered_qty,
            SUM(ft.delivered_quantity) AS total_delivered_qty,
            SUM(ft.outstanding_quantity) AS total_outstanding_qty
        FROM filtered_tracking ft
        GROUP BY ft.uom, ft.category
    ),
    calendar_daily_groups AS (
        SELECT 
            ft.operational_date,
            COUNT(*) AS lines_count,
            COUNT(*) FILTER (WHERE ft.is_delivered) AS delivered_count,
            COUNT(*) FILTER (WHERE ft.is_partial) AS partial_count,
            COUNT(*) FILTER (WHERE ft.has_critical_issue) AS critical_issue_count,
            jsonb_agg(
                jsonb_build_object(
                    'id', ft.id,
                    'sap_po_number', ft.sap_po_number,
                    'sap_po_line_number', ft.sap_po_line_number,
                    'category', ft.category,
                    'material_code', ft.material_code,
                    'material_description', ft.material_description,
                    'supplier_name', ft.supplier_name,
                    'ordered_quantity', ft.ordered_quantity,
                    'delivered_quantity', ft.delivered_quantity,
                    'outstanding_quantity', ft.outstanding_quantity,
                    'uom', ft.uom,
                    'assigned_employee_name', ft.assigned_employee_name,
                    'original_committed_delivery_date', ft.original_committed_delivery_date,
                    'current_expected_delivery_date', ft.current_expected_delivery_date,
                    'delivery_status', ft.delivery_status,
                    'original_delay_days', ft.original_delay_days,
                    'has_open_issue', ft.has_open_issue,
                    'has_critical_issue', ft.has_critical_issue
                ) ORDER BY ft.has_critical_issue DESC, ft.sap_po_number ASC
            ) AS line_items
        FROM filtered_tracking ft
        WHERE ft.operational_date IS NOT NULL
        GROUP BY ft.operational_date
    )
    SELECT jsonb_build_object(
        'as_of_date_ist', v_today_ist,
        'window', jsonb_build_object(
            'start_date', p_start_date,
            'end_date', p_end_date
        ),
        'summary', (
            SELECT jsonb_build_object(
                'total_scheduled_lines', COUNT(*),
                'due_today_count', COUNT(*) FILTER (WHERE ft.is_due_today),
                'upcoming_7d_count', COUNT(*) FILTER (WHERE ft.is_upcoming AND ft.operational_date <= v_today_ist + 7),
                'upcoming_15d_count', COUNT(*) FILTER (WHERE ft.is_upcoming AND ft.operational_date <= v_today_ist + 15),
                'upcoming_30d_count', COUNT(*) FILTER (WHERE ft.is_upcoming AND ft.operational_date <= v_today_ist + 30),
                'overdue_count', COUNT(*) FILTER (WHERE ft.is_overdue),
                'partial_count', COUNT(*) FILTER (WHERE ft.is_partial),
                'fully_delivered_count', COUNT(*) FILTER (WHERE ft.is_delivered),
                'critical_issue_count', COUNT(*) FILTER (WHERE ft.has_critical_issue),
                'unassigned_count', COUNT(*) FILTER (WHERE ft.assigned_employee_id IS NULL)
            ) FROM filtered_tracking ft
        ),
        'uom_workload_breakdown', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'uom', u.uom,
                    'category', u.category,
                    'lines_count', u.po_lines_count,
                    'ordered_qty', u.total_ordered_qty,
                    'delivered_qty', u.total_delivered_qty,
                    'outstanding_qty', u.total_outstanding_qty
                ) ORDER BY u.category ASC, u.uom ASC
            ), '[]'::jsonb) FROM uom_quantity_aggregations u
        ),
        'calendar_days', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'date', cdg.operational_date,
                    'lines_count', cdg.lines_count,
                    'delivered_count', cdg.delivered_count,
                    'partial_count', cdg.partial_count,
                    'critical_issue_count', cdg.critical_issue_count,
                    'line_items', cdg.line_items
                ) ORDER BY cdg.operational_date ASC
            ), '[]'::jsonb) FROM calendar_daily_groups cdg
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.api_get_delivery_planning_schedule(DATE, DATE, UUID, VARCHAR, UUID) TO authenticated, service_role;

COMMIT;
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
-- =============================================================================
-- SCM Flow â€” Phase 12: SCM Document Management & Expiry Tracking
-- File: backend/supabase/migrations/20261103120000_phase12_scm_document_management.sql
-- =============================================================================

BEGIN;

-- 1. Sequential Document Number Generator Sequence
CREATE SEQUENCE IF NOT EXISTS public.seq_scm_document_number START WITH 1 INCREMENT BY 1;

-- 2. Document Categories Configuration Table
CREATE TABLE IF NOT EXISTS public.document_categories_config (
    id VARCHAR(50) PRIMARY KEY,
    category_group VARCHAR(50) NOT NULL CHECK (category_group IN ('SUPPLIER', 'MATERIAL', 'PO_DELIVERY', 'GENERAL')),
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    default_reminder_days INTEGER[] DEFAULT '{90, 60, 30, 15, 7, 0}',
    is_mandatory_for_qualification BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Seed Initial Categories (Supplier, Material, PO/Delivery)
INSERT INTO public.document_categories_config (id, category_group, display_name, description, is_mandatory_for_qualification)
VALUES
    -- Supplier-level
    ('SUPPLIER_REGISTRATION', 'SUPPLIER', 'Supplier Registration Certificate', 'Certificate of incorporation or commercial register extract', true),
    ('GST_REGISTRATION', 'SUPPLIER', 'GST Registration', 'Goods & Services Tax identification and registration certificate (India)', true),
    ('MSME_UDYAM', 'SUPPLIER', 'MSME/Udyam Certificate', 'Micro, Small, Medium Enterprise registration certificate', false),
    ('BUSINESS_REGISTRATION', 'SUPPLIER', 'Business Registration', 'Trade license, shop establishment, or municipal registration', false),
    ('ISO_CERTIFICATES', 'SUPPLIER', 'ISO Certificates', 'ISO 9001, 14001, 45001, 22000, or GMP quality certifications', true),
    ('COMMERCIAL_AGREEMENT', 'SUPPLIER', 'Commercial Agreement Reference', 'Master supply agreement, NDA, or commercial terms reference', false),
    ('SUPPLIER_CONTACT_INFO', 'SUPPLIER', 'Supplier Contact and Business Information', 'Authorized signatory, banking, or business profile documentation', false),
    ('OTHER_SUPPLIER_DOCS', 'SUPPLIER', 'Other Supplier Documents', 'Miscellaneous supplier-level statutory or operational records', false),

    -- Material-level
    ('MATERIAL_SPEC', 'MATERIAL', 'Material Specification Reference', 'Standard specifications, analytical parameters, and grade definitions', true),
    ('TECHNICAL_DATA_SHEET', 'MATERIAL', 'Technical Data Sheet', 'TDS detailing physical, chemical, and storage characteristics', false),
    ('SAFETY_DATA_SHEET', 'MATERIAL', 'Safety Data Sheet', 'SDS / MSDS compliance sheet for handling and hazard safety', true),
    ('MATERIAL_REF_DOC', 'MATERIAL', 'Material Reference Document', 'Internal quality monograph, qualification record, or CoA template', false),
    ('PACKAGING_SPEC', 'MATERIAL', 'Packaging Specification Reference', 'Packaging, labeling, and palletizing requirements', false),
    ('OTHER_MATERIAL_DOCS', 'MATERIAL', 'Other Material Documents', 'Miscellaneous material testing or reference documentation', false),

    -- PO and Delivery-level
    ('DELIVERY_CONFIRMATION', 'PO_DELIVERY', 'Supplier Delivery Confirmation', 'Order acknowledgment or written shipment date confirmation', false),
    ('DISPATCH_DOCUMENTATION', 'PO_DELIVERY', 'Dispatch Documentation', 'Delivery Challan, packing list, or dispatch advice note', false),
    ('TRANSPORT_SHIPMENT_DOC', 'PO_DELIVERY', 'Transport or Shipment Document', 'Lorry Receipt (LR), Airway Bill (AWB), or Bill of Lading (B/L)', false),
    ('DELIVERY_SUPPORTING_DOC', 'PO_DELIVERY', 'Delivery-related Supporting Document', 'Weight slip, temperature log, or preliminary arrival note', false),
    ('OTHER_PO_DOCS', 'PO_DELIVERY', 'Other PO-related Documents', 'Miscellaneous purchase order or freight records', false)
ON CONFLICT (id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    category_group = EXCLUDED.category_group,
    description = EXCLUDED.description,
    is_mandatory_for_qualification = EXCLUDED.is_mandatory_for_qualification;


-- 3. Central SCM Documents Table
CREATE TABLE IF NOT EXISTS public.scm_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category_group VARCHAR(50) NOT NULL CHECK (category_group IN ('SUPPLIER', 'MATERIAL', 'PO_DELIVERY', 'GENERAL')),
    category_id VARCHAR(50) NOT NULL REFERENCES public.document_categories_config(id),
    document_reference_number VARCHAR(100),
    owner_employee_id UUID REFERENCES public.employees(id),
    current_version_id UUID,
    current_version_number VARCHAR(20) DEFAULT 'V1' NOT NULL,
    issue_date DATE,
    expiry_date DATE,
    expiry_status VARCHAR(50) NOT NULL DEFAULT 'Active' CHECK (
        expiry_status IN ('Active', 'Expiring Soon', 'Expired', 'No Expiry Date', 'Review Required', 'Superseded', 'Archived')
    ),
    review_status VARCHAR(50) NOT NULL DEFAULT 'Pending Review' CHECK (
        review_status IN ('Pending Review', 'Verified', 'Review Required', 'Unable to Verify')
    ),
    is_confidential BOOLEAN DEFAULT false NOT NULL,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    archived_at TIMESTAMPTZ,
    archived_by UUID REFERENCES auth.users(id),
    archive_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_scm_docs_group ON public.scm_documents(category_group);
CREATE INDEX IF NOT EXISTS idx_scm_docs_category ON public.scm_documents(category_id);
CREATE INDEX IF NOT EXISTS idx_scm_docs_expiry ON public.scm_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_scm_docs_expiry_status ON public.scm_documents(expiry_status);
CREATE INDEX IF NOT EXISTS idx_scm_docs_review ON public.scm_documents(review_status);
CREATE INDEX IF NOT EXISTS idx_scm_docs_owner ON public.scm_documents(owner_employee_id);


-- 4. Document Versions Table
CREATE TABLE IF NOT EXISTS public.document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.scm_documents(id) ON DELETE CASCADE,
    version_number VARCHAR(20) NOT NULL,
    file_key TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    file_checksum VARCHAR(64),
    version_notes TEXT,
    is_current BOOLEAN DEFAULT true NOT NULL,
    uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unq_document_version UNIQUE(document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_doc ON public.document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_versions_current ON public.document_versions(document_id, is_current);


-- Add Foreign Key from scm_documents to document_versions
ALTER TABLE public.scm_documents
    DROP CONSTRAINT IF EXISTS fk_scm_docs_curr_version;
ALTER TABLE public.scm_documents
    ADD CONSTRAINT fk_scm_docs_curr_version
    FOREIGN KEY (current_version_id) REFERENCES public.document_versions(id) ON DELETE SET NULL;


-- 5. Document Links Table (Associations to Suppliers, Materials, PO lines, etc.)
CREATE TABLE IF NOT EXISTS public.document_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.scm_documents(id) ON DELETE CASCADE,
    link_type VARCHAR(50) NOT NULL CHECK (
        link_type IN ('SUPPLIER', 'MATERIAL', 'SAP_PO', 'PO_LINE', 'DELIVERY_TRACKING', 'DELIVERY_ISSUE')
    ),
    target_id UUID NOT NULL,
    target_reference VARCHAR(100),
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unq_document_link UNIQUE(document_id, link_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_links_target ON public.document_links(link_type, target_id);
CREATE INDEX IF NOT EXISTS idx_doc_links_doc ON public.document_links(document_id);


-- 6. Document Reviews Table
CREATE TABLE IF NOT EXISTS public.document_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.scm_documents(id) ON DELETE CASCADE,
    version_id UUID REFERENCES public.document_versions(id) ON DELETE SET NULL,
    previous_review_status VARCHAR(50),
    new_review_status VARCHAR(50) NOT NULL CHECK (
        new_review_status IN ('Pending Review', 'Verified', 'Review Required', 'Unable to Verify')
    ),
    remarks TEXT NOT NULL,
    reviewed_by UUID REFERENCES auth.users(id) NOT NULL,
    reviewed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_doc_reviews_doc ON public.document_reviews(document_id);


-- 7. Document Audit Trail Table (Events)
CREATE TABLE IF NOT EXISTS public.document_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.scm_documents(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (
        event_type IN ('UPLOADED', 'VERSION_CREATED', 'REVIEW_UPDATED', 'EXPIRY_RECALCULATED', 'METADATA_UPDATED', 'ARCHIVED', 'DOWNLOADED')
    ),
    old_state JSONB,
    new_state JSONB,
    change_reason TEXT NOT NULL,
    performed_by UUID REFERENCES auth.users(id) NOT NULL,
    performed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_doc_events_doc ON public.document_events(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_events_perf_at ON public.document_events(performed_at);


-- 8. Register Phase 12 Permissions
INSERT INTO public.permissions (id, module, description) VALUES
    ('documents.view', 'documents', 'View central SCM documents, metadata, versions, and linkages'),
    ('documents.upload', 'documents', 'Upload new SCM documents and supplementary files'),
    ('documents.update', 'documents', 'Edit document metadata, descriptions, references, and associations'),
    ('documents.review', 'documents', 'Conduct internal operational document verification reviews'),
    ('documents.archive', 'documents', 'Archive expired or superseded SCM documents'),
    ('documents.export', 'documents', 'Export document registers and expiry tracking reports to CSV')
ON CONFLICT (id) DO UPDATE
SET module = EXCLUDED.module,
    description = EXCLUDED.description;

-- Seed Role Permissions for Phase 12
-- Super Admin: all
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'super_admin', id FROM public.permissions WHERE module = 'documents'
ON CONFLICT DO NOTHING;

-- SCM Admin: all
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'scm_admin', id FROM public.permissions WHERE module = 'documents'
ON CONFLICT DO NOTHING;

-- SCM Team User: view, upload, update, review (no archive, no export without administrative clearance)
INSERT INTO public.role_permissions (role_id, permission_id)
VALUES
    ('scm_team_user', 'documents.view'),
    ('scm_team_user', 'documents.upload'),
    ('scm_team_user', 'documents.update'),
    ('scm_team_user', 'documents.review')
ON CONFLICT DO NOTHING;


-- 9. Enable Row Level Security (RLS)
ALTER TABLE public.document_categories_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scm_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_categories_select_policy" ON public.document_categories_config
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "scm_documents_select_policy" ON public.scm_documents
    FOR SELECT TO authenticated
    USING (public.current_user_has_permission('documents.view'));

CREATE POLICY "document_versions_select_policy" ON public.document_versions
    FOR SELECT TO authenticated
    USING (public.current_user_has_permission('documents.view'));

CREATE POLICY "document_links_select_policy" ON public.document_links
    FOR SELECT TO authenticated
    USING (public.current_user_has_permission('documents.view'));

CREATE POLICY "document_reviews_select_policy" ON public.document_reviews
    FOR SELECT TO authenticated
    USING (public.current_user_has_permission('documents.view'));

CREATE POLICY "document_events_select_policy" ON public.document_events
    FOR SELECT TO authenticated
    USING (public.current_user_has_permission('documents.view'));


-- 10. Authoritative Calculation Function: Document Expiry Status (Asia/Kolkata)
CREATE OR REPLACE FUNCTION public.calculate_document_expiry_status(
    p_expiry_date DATE,
    p_is_archived BOOLEAN DEFAULT false,
    p_is_superseded BOOLEAN DEFAULT false
)
RETURNS VARCHAR(50)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_today_ist DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE;
    v_days_left INTEGER;
BEGIN
    IF p_is_archived THEN
        RETURN 'Archived';
    END IF;

    IF p_is_superseded THEN
        RETURN 'Superseded';
    END IF;

    IF p_expiry_date IS NULL THEN
        RETURN 'No Expiry Date';
    END IF;

    v_days_left := p_expiry_date - v_today_ist;

    IF v_days_left < 0 THEN
        RETURN 'Expired';
    ELSIF v_days_left <= 90 THEN
        RETURN 'Expiring Soon';
    ELSE
        RETURN 'Active';
    END IF;
END;
$$;


-- 11. Authoritative RPC: Add SCM Document & Initial Version
CREATE OR REPLACE FUNCTION public.api_create_scm_document(
    p_title VARCHAR,
    p_category_id VARCHAR,
    p_description TEXT DEFAULT NULL,
    p_document_reference_number VARCHAR DEFAULT NULL,
    p_owner_employee_id UUID DEFAULT NULL,
    p_issue_date DATE DEFAULT NULL,
    p_expiry_date DATE DEFAULT NULL,
    p_is_confidential BOOLEAN DEFAULT false,
    p_file_name VARCHAR DEFAULT 'document.pdf',
    p_file_key TEXT DEFAULT 'documents/upload.pdf',
    p_file_size_bytes BIGINT DEFAULT NULL,
    p_mime_type VARCHAR DEFAULT 'application/pdf',
    p_file_checksum VARCHAR DEFAULT NULL,
    p_version_notes TEXT DEFAULT 'Initial document version upload',
    p_supplier_id UUID DEFAULT NULL,
    p_material_id UUID DEFAULT NULL,
    p_tracking_id UUID DEFAULT NULL,
    p_sap_po_id UUID DEFAULT NULL,
    p_issue_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_doc_number VARCHAR(50);
    v_doc_id UUID;
    v_version_id UUID;
    v_cat RECORD;
    v_calc_status VARCHAR(50);
    v_target_ref VARCHAR(100);
BEGIN
    IF NOT public.current_user_has_permission('documents.upload') THEN
        RAISE EXCEPTION 'Access denied: You do not have permission to upload SCM documents.';
    END IF;

    IF trim(COALESCE(p_title, '')) = '' THEN
        RAISE EXCEPTION 'Document title is required.';
    END IF;

    SELECT * INTO v_cat FROM public.document_categories_config WHERE id = p_category_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid document category: %', p_category_id;
    END IF;

    -- Calculate initial expiry status
    v_calc_status := public.calculate_document_expiry_status(p_expiry_date, false, false);

    -- Generate DOC-YYYY-XXXX document identifier
    v_doc_number := 'DOC-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('public.seq_scm_document_number')::TEXT, 4, '0');

    -- Insert central document record
    INSERT INTO public.scm_documents (
        document_number,
        title,
        description,
        category_group,
        category_id,
        document_reference_number,
        owner_employee_id,
        current_version_number,
        issue_date,
        expiry_date,
        expiry_status,
        review_status,
        is_confidential,
        created_by,
        updated_by
    ) VALUES (
        v_doc_number,
        trim(p_title),
        trim(COALESCE(p_description, '')),
        v_cat.category_group,
        p_category_id,
        trim(COALESCE(p_document_reference_number, '')),
        p_owner_employee_id,
        'V1',
        p_issue_date,
        p_expiry_date,
        v_calc_status,
        'Pending Review',
        p_is_confidential,
        v_uid,
        v_uid
    ) RETURNING id INTO v_doc_id;

    -- Insert Version 1 record
    INSERT INTO public.document_versions (
        document_id,
        version_number,
        file_key,
        file_name,
        file_size_bytes,
        mime_type,
        file_checksum,
        version_notes,
        is_current,
        uploaded_by
    ) VALUES (
        v_doc_id,
        'V1',
        p_file_key,
        p_file_name,
        p_file_size_bytes,
        p_mime_type,
        p_file_checksum,
        p_version_notes,
        true,
        v_uid
    ) RETURNING id INTO v_version_id;

    -- Link current version back to document
    UPDATE public.scm_documents
    SET current_version_id = v_version_id
    WHERE id = v_doc_id;

    -- Link Supplier
    IF p_supplier_id IS NOT NULL THEN
        SELECT COALESCE(supplier_code, legal_name) INTO v_target_ref FROM public.suppliers WHERE id = p_supplier_id;
        INSERT INTO public.document_links (document_id, link_type, target_id, target_reference, created_by)
        VALUES (v_doc_id, 'SUPPLIER', p_supplier_id, v_target_ref, v_uid)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Link Material
    IF p_material_id IS NOT NULL THEN
        SELECT material_code INTO v_target_ref FROM public.material_master WHERE id = p_material_id;
        INSERT INTO public.document_links (document_id, link_type, target_id, target_reference, created_by)
        VALUES (v_doc_id, 'MATERIAL', p_material_id, v_target_ref, v_uid)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Link PO Line / Delivery Tracking
    IF p_tracking_id IS NOT NULL THEN
        SELECT (sap_po_number || '-' || sap_po_line_number) INTO v_target_ref FROM public.material_delivery_tracking WHERE id = p_tracking_id;
        INSERT INTO public.document_links (document_id, link_type, target_id, target_reference, created_by)
        VALUES (v_doc_id, 'DELIVERY_TRACKING', p_tracking_id, v_target_ref, v_uid)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Link SAP PO Reference
    IF p_sap_po_id IS NOT NULL THEN
        SELECT sap_po_number INTO v_target_ref FROM public.sap_po_references WHERE id = p_sap_po_id;
        INSERT INTO public.document_links (document_id, link_type, target_id, target_reference, created_by)
        VALUES (v_doc_id, 'SAP_PO', p_sap_po_id, v_target_ref, v_uid)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Link Delivery Issue
    IF p_issue_id IS NOT NULL THEN
        SELECT issue_number INTO v_target_ref FROM public.delivery_issues WHERE id = p_issue_id;
        INSERT INTO public.document_links (document_id, link_type, target_id, target_reference, created_by)
        VALUES (v_doc_id, 'DELIVERY_ISSUE', p_issue_id, v_target_ref, v_uid)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Audit Event
    INSERT INTO public.document_events (
        document_id,
        event_type,
        new_state,
        change_reason,
        performed_by
    ) VALUES (
        v_doc_id,
        'UPLOADED',
        jsonb_build_object('document_number', v_doc_number, 'version', 'V1', 'file_name', p_file_name),
        'Document registered with initial version V1',
        v_uid
    );

    RETURN jsonb_build_object(
        'success', true,
        'document_id', v_doc_id,
        'document_number', v_doc_number,
        'version_id', v_version_id
    );
END;
$$;


-- 12. Authoritative RPC: Upload New Document Version
CREATE OR REPLACE FUNCTION public.api_create_document_version(
    p_document_id UUID,
    p_file_name VARCHAR,
    p_file_key TEXT,
    p_file_size_bytes BIGINT DEFAULT NULL,
    p_mime_type VARCHAR DEFAULT 'application/pdf',
    p_file_checksum VARCHAR DEFAULT NULL,
    p_version_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_doc RECORD;
    v_next_version_num INTEGER;
    v_next_version_str VARCHAR(20);
    v_new_version_id UUID;
BEGIN
    IF NOT public.current_user_has_permission('documents.upload') THEN
        RAISE EXCEPTION 'Access denied: You do not have permission to upload document versions.';
    END IF;

    SELECT * INTO v_doc FROM public.scm_documents WHERE id = p_document_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Document record not found: %', p_document_id;
    END IF;

    IF v_doc.expiry_status = 'Archived' THEN
        RAISE EXCEPTION 'Cannot add new versions to an archived document.';
    END IF;

    -- Compute next version number based on existing count
    SELECT COUNT(*) + 1 INTO v_next_version_num FROM public.document_versions WHERE document_id = p_document_id;
    v_next_version_str := 'V' || v_next_version_num::TEXT;

    -- Mark previous versions as superseded / is_current = false
    UPDATE public.document_versions
    SET is_current = false
    WHERE document_id = p_document_id;

    -- Insert new version record
    INSERT INTO public.document_versions (
        document_id,
        version_number,
        file_key,
        file_name,
        file_size_bytes,
        mime_type,
        file_checksum,
        version_notes,
        is_current,
        uploaded_by
    ) VALUES (
        p_document_id,
        v_next_version_str,
        p_file_key,
        p_file_name,
        p_file_size_bytes,
        p_mime_type,
        p_file_checksum,
        p_version_notes,
        true,
        v_uid
    ) RETURNING id INTO v_new_version_id;

    -- Update parent document with new version and RESET review status to 'Pending Review'
    UPDATE public.scm_documents
    SET current_version_id = v_new_version_id,
        current_version_number = v_next_version_str,
        review_status = 'Pending Review',
        updated_by = v_uid,
        updated_at = now()
    WHERE id = p_document_id;

    -- Audit Event
    INSERT INTO public.document_events (
        document_id,
        event_type,
        new_state,
        change_reason,
        performed_by
    ) VALUES (
        p_document_id,
        'VERSION_CREATED',
        jsonb_build_object('version', v_next_version_str, 'file_name', p_file_name, 'notes', p_version_notes),
        'New version ' || v_next_version_str || ' uploaded; review status reset to Pending Review',
        v_uid
    );

    RETURN jsonb_build_object(
        'success', true,
        'version_id', v_new_version_id,
        'version_number', v_next_version_str
    );
END;
$$;


-- 13. Authoritative RPC: Review SCM Document
CREATE OR REPLACE FUNCTION public.api_review_scm_document(
    p_document_id UUID,
    p_new_review_status VARCHAR,
    p_remarks TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_doc RECORD;
    v_review_id UUID;
BEGIN
    IF NOT public.current_user_has_permission('documents.review') THEN
        RAISE EXCEPTION 'Access denied: You do not have permission to review documents.';
    END IF;

    SELECT * INTO v_doc FROM public.scm_documents WHERE id = p_document_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Document record not found: %', p_document_id;
    END IF;

    IF trim(COALESCE(p_remarks, '')) = '' THEN
        RAISE EXCEPTION 'Verification remarks are mandatory for review status change.';
    END IF;

    -- Record review history
    INSERT INTO public.document_reviews (
        document_id,
        version_id,
        previous_review_status,
        new_review_status,
        remarks,
        reviewed_by
    ) VALUES (
        p_document_id,
        v_doc.current_version_id,
        v_doc.review_status,
        p_new_review_status,
        trim(p_remarks),
        v_uid
    ) RETURNING id INTO v_review_id;

    -- Update document review status
    UPDATE public.scm_documents
    SET review_status = p_new_review_status,
        updated_by = v_uid,
        updated_at = now()
    WHERE id = p_document_id;

    -- Audit Event
    INSERT INTO public.document_events (
        document_id,
        event_type,
        old_state,
        new_state,
        change_reason,
        performed_by
    ) VALUES (
        p_document_id,
        'REVIEW_UPDATED',
        jsonb_build_object('review_status', v_doc.review_status),
        jsonb_build_object('review_status', p_new_review_status),
        'Document review updated to ' || p_new_review_status || ': ' || p_remarks,
        v_uid
    );

    RETURN jsonb_build_object('success', true, 'review_id', v_review_id);
END;
$$;


-- 14. Authoritative RPC: Archive SCM Document
CREATE OR REPLACE FUNCTION public.api_archive_scm_document(
    p_document_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_doc RECORD;
BEGIN
    IF NOT public.current_user_has_permission('documents.archive') THEN
        RAISE EXCEPTION 'Access denied: You do not have permission to archive documents.';
    END IF;

    SELECT * INTO v_doc FROM public.scm_documents WHERE id = p_document_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Document record not found: %', p_document_id;
    END IF;

    UPDATE public.scm_documents
    SET expiry_status = 'Archived',
        archived_at = now(),
        archived_by = v_uid,
        archive_reason = trim(p_reason),
        updated_by = v_uid,
        updated_at = now()
    WHERE id = p_document_id;

    INSERT INTO public.document_events (
        document_id,
        event_type,
        old_state,
        new_state,
        change_reason,
        performed_by
    ) VALUES (
        p_document_id,
        'ARCHIVED',
        jsonb_build_object('expiry_status', v_doc.expiry_status),
        jsonb_build_object('expiry_status', 'Archived', 'reason', p_reason),
        'Document archived: ' || COALESCE(p_reason, 'No reason provided'),
        v_uid
    );

    RETURN jsonb_build_object('success', true);
END;
$$;


-- 15. Authoritative RPC: Generate Document Expiry Reminders
CREATE OR REPLACE FUNCTION public.api_generate_document_expiry_reminders()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_today_ist DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::DATE;
    v_doc RECORD;
    v_rem_count INTEGER := 0;
    v_days_left INTEGER;
    v_new_status VARCHAR(50);
    v_recip_id UUID;
BEGIN
    -- Recalculate expiry status for all unarchived documents
    FOR v_doc IN 
        SELECT d.*, c.default_reminder_days
        FROM public.scm_documents d
        JOIN public.document_categories_config c ON c.id = d.category_id
        WHERE d.expiry_status NOT IN ('Archived', 'Superseded')
    LOOP
        v_new_status := public.calculate_document_expiry_status(v_doc.expiry_date, false, false);
        
        IF v_new_status <> v_doc.expiry_status THEN
            UPDATE public.scm_documents
            SET expiry_status = v_new_status,
                updated_at = now()
            WHERE id = v_doc.id;
        END IF;

        -- Check if expiry date exists
        IF v_doc.expiry_date IS NOT NULL THEN
            v_days_left := v_doc.expiry_date - v_today_ist;

            -- Check if today matches any reminder intervals: 90, 60, 30, 15, 7, 0
            IF v_days_left = ANY(v_doc.default_reminder_days) OR v_days_left = 0 THEN
                -- Select recipient (owner employee profile or admin)
                SELECT p.id INTO v_recip_id
                FROM public.profiles p
                WHERE p.id = v_doc.created_by LIMIT 1;

                IF v_recip_id IS NOT NULL THEN
                    -- Check if notification already delivered today for this doc & interval
                    IF NOT EXISTS (
                        SELECT 1 FROM public.notifications
                        WHERE recipient_user_id = v_recip_id
                          AND related_entity_type = 'scm_document'
                          AND related_entity_id = v_doc.id
                          AND (created_at AT TIME ZONE 'Asia/Kolkata')::DATE = v_today_ist
                    ) THEN
                        INSERT INTO public.notifications (
                            recipient_user_id,
                            notification_type,
                            title,
                            message,
                            related_entity_type,
                            related_entity_id
                        ) VALUES (
                            v_recip_id,
                            CASE WHEN v_days_left <= 0 THEN 'DOCUMENT_EXPIRED' ELSE 'DOCUMENT_EXPIRING_SOON' END,
                            'Document ' || v_doc.document_number || ' ' || 
                            CASE WHEN v_days_left = 0 THEN 'Expires Today' 
                                 WHEN v_days_left < 0 THEN 'Has Expired' 
                                 ELSE 'Expiring in ' || v_days_left || ' days' END,
                            'Document "' || v_doc.title || '" (' || v_doc.document_number || ') validity date is ' || v_doc.expiry_date,
                            'scm_document',
                            v_doc.id
                        );
                        v_rem_count := v_rem_count + 1;
                    END IF;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'reminders_created', v_rem_count);
END;
$$;

COMMIT;
