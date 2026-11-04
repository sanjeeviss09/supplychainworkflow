-- =============================================================================
-- SCM FLOW — PHASE 6: SUPPLIER MANAGEMENT DATA MODEL & RPCs
-- File: backend/supabase/migrations/20261103060000_phase6_supplier_management.sql
-- =============================================================================

BEGIN;

-- 1. Supplier Code Sequence and Generator
CREATE SEQUENCE IF NOT EXISTS public.supplier_code_seq START WITH 1;

CREATE OR REPLACE FUNCTION public.generate_supplier_code()
RETURNS VARCHAR
LANGUAGE plpgsql
AS $$
DECLARE
    v_seq BIGINT := nextval('public.supplier_code_seq');
BEGIN
    RETURN 'SUP-' || lpad(v_seq::text, 6, '0');
END;
$$;

-- 2. Upgrade / Align `suppliers` Table
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'supplier_code') THEN
        ALTER TABLE public.suppliers ADD COLUMN supplier_code VARCHAR(50);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'display_name') THEN
        ALTER TABLE public.suppliers ADD COLUMN display_name VARCHAR(150);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'supplier_type') THEN
        ALTER TABLE public.suppliers ADD COLUMN supplier_type VARCHAR(50) DEFAULT 'MANUFACTURER' NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'tax_identifier') THEN
        ALTER TABLE public.suppliers ADD COLUMN tax_identifier VARCHAR(30);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'website') THEN
        ALTER TABLE public.suppliers ADD COLUMN website VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'general_email') THEN
        ALTER TABLE public.suppliers ADD COLUMN general_email VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'general_phone') THEN
        ALTER TABLE public.suppliers ADD COLUMN general_phone VARCHAR(30);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'registered_address') THEN
        ALTER TABLE public.suppliers ADD COLUMN registered_address TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'supplier_status') THEN
        ALTER TABLE public.suppliers ADD COLUMN supplier_status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'qualification_status') THEN
        ALTER TABLE public.suppliers ADD COLUMN qualification_status VARCHAR(30) DEFAULT 'NOT_STARTED' NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'qualification_start_date') THEN
        ALTER TABLE public.suppliers ADD COLUMN qualification_start_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'qualification_expiry_date') THEN
        ALTER TABLE public.suppliers ADD COLUMN qualification_expiry_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'last_reviewed_date') THEN
        ALTER TABLE public.suppliers ADD COLUMN last_reviewed_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'review_notes') THEN
        ALTER TABLE public.suppliers ADD COLUMN review_notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'qualification_updated_by') THEN
        ALTER TABLE public.suppliers ADD COLUMN qualification_updated_by UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'qualification_updated_at') THEN
        ALTER TABLE public.suppliers ADD COLUMN qualification_updated_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'created_by') THEN
        ALTER TABLE public.suppliers ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'updated_by') THEN
        ALTER TABLE public.suppliers ADD COLUMN updated_by UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'deactivated_by') THEN
        ALTER TABLE public.suppliers ADD COLUMN deactivated_by UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'deactivated_at') THEN
        ALTER TABLE public.suppliers ADD COLUMN deactivated_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'deactivation_reason') THEN
        ALTER TABLE public.suppliers ADD COLUMN deactivation_reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'reactivated_by') THEN
        ALTER TABLE public.suppliers ADD COLUMN reactivated_by UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'reactivated_at') THEN
        ALTER TABLE public.suppliers ADD COLUMN reactivated_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'reactivation_reason') THEN
        ALTER TABLE public.suppliers ADD COLUMN reactivation_reason TEXT;
    END IF;
END $$;

-- Populate missing supplier_code and display_name for existing records
UPDATE public.suppliers
SET supplier_code = coalesce(supplier_code, vendor_code, public.generate_supplier_code()),
    display_name = coalesce(display_name, trade_name, legal_name),
    tax_identifier = coalesce(tax_identifier, gstin),
    general_email = coalesce(general_email, email),
    general_phone = coalesce(general_phone, phone),
    supplier_status = CASE 
        WHEN status = 'active' THEN 'ACTIVE' 
        ELSE 'INACTIVE' 
    END
WHERE supplier_code IS NULL OR display_name IS NULL;

-- Set default and unique constraint on supplier_code
ALTER TABLE public.suppliers ALTER COLUMN supplier_code SET DEFAULT public.generate_supplier_code();
CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_code ON public.suppliers(supplier_code);

-- Check constraints on supplier status and qualification status
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_supplier_status_values') THEN
        ALTER TABLE public.suppliers ADD CONSTRAINT chk_supplier_status_values 
            CHECK (supplier_status IN ('ACTIVE', 'INACTIVE'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_qualification_status_values') THEN
        ALTER TABLE public.suppliers ADD CONSTRAINT chk_qualification_status_values 
            CHECK (qualification_status IN ('NOT_STARTED', 'IN_PROGRESS', 'QUALIFIED', 'NOT_QUALIFIED', 'EXPIRED'));
    END IF;
END $$;

-- Immutability check trigger on supplier_code
CREATE OR REPLACE FUNCTION public.check_supplier_code_immutable()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.supplier_code IS NOT NULL AND NEW.supplier_code <> OLD.supplier_code THEN
        RAISE EXCEPTION 'supplier_code is immutable and cannot be changed once assigned.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supplier_code_immutable ON public.suppliers;
CREATE TRIGGER trg_supplier_code_immutable
BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.check_supplier_code_immutable();


-- 3. Upgrade / Align `supplier_contacts` Table
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'supplier_contacts' AND column_name = 'full_name') THEN
        ALTER TABLE public.supplier_contacts ADD COLUMN full_name VARCHAR(200);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'supplier_contacts' AND column_name = 'job_title') THEN
        ALTER TABLE public.supplier_contacts ADD COLUMN job_title VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'supplier_contacts' AND column_name = 'phone') THEN
        ALTER TABLE public.supplier_contacts ADD COLUMN phone VARCHAR(30);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'supplier_contacts' AND column_name = 'contact_type') THEN
        ALTER TABLE public.supplier_contacts ADD COLUMN contact_type VARCHAR(50) DEFAULT 'PRIMARY' NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'supplier_contacts' AND column_name = 'is_active') THEN
        ALTER TABLE public.supplier_contacts ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'supplier_contacts' AND column_name = 'created_by') THEN
        ALTER TABLE public.supplier_contacts ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'supplier_contacts' AND column_name = 'updated_by') THEN
        ALTER TABLE public.supplier_contacts ADD COLUMN updated_by UUID REFERENCES auth.users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'supplier_contacts' AND column_name = 'updated_at') THEN
        ALTER TABLE public.supplier_contacts ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;
    END IF;
END $$;

UPDATE public.supplier_contacts
SET full_name = coalesce(full_name, name),
    job_title = coalesce(job_title, designation),
    phone = coalesce(phone, mobile)
WHERE full_name IS NULL;

-- Enforce exactly one active primary contact per supplier
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_active_primary_contact
ON public.supplier_contacts(supplier_id)
WHERE (is_primary = true AND is_active = true);


-- 4. Create `supplier_addresses` Table
CREATE TABLE IF NOT EXISTS public.supplier_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    address_type VARCHAR(50) NOT NULL CHECK (address_type IN ('REGISTERED', 'OFFICE', 'MANUFACTURING_SITE', 'WAREHOUSE', 'OTHER')),
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city VARCHAR(100) NOT NULL,
    state_province VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) DEFAULT 'India' NOT NULL,
    is_primary BOOLEAN DEFAULT false NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_supplier_addresses_supp ON public.supplier_addresses(supplier_id);
-- Enforce only one active primary address per supplier and address type
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_active_primary_address 
ON public.supplier_addresses(supplier_id, address_type) 
WHERE (is_primary = true AND is_active = true);


-- 5. Create `supplier_materials` Table (Supplier-Material Associations)
CREATE TABLE IF NOT EXISTS public.supplier_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    material_id UUID NOT NULL REFERENCES public.material_masters(id) ON DELETE RESTRICT,
    supplier_part_number VARCHAR(100),
    supplier_material_description TEXT,
    specification_grade VARCHAR(100),
    minimum_order_quantity NUMERIC(18, 4) CHECK (minimum_order_quantity IS NULL OR minimum_order_quantity > 0),
    lead_time_days INTEGER CHECK (lead_time_days IS NULL OR lead_time_days >= 0),
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_supp_mat_supplier ON public.supplier_materials(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supp_mat_material ON public.supplier_materials(material_id);
-- Prevent duplicate active associations for the same supplier and material
CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_material_active 
ON public.supplier_materials(supplier_id, material_id) 
WHERE (status = 'ACTIVE');


-- 6. Create `supplier_documents` Table
CREATE TABLE IF NOT EXISTS public.supplier_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('REGISTRATION_CERTIFICATE', 'TAX_GST_CERTIFICATE', 'QUALITY_CERTIFICATION', 'MANUFACTURING_LICENSE', 'MSME_CERTIFICATE', 'OTHER')),
    document_name VARCHAR(255) NOT NULL,
    file_key TEXT NOT NULL,
    file_url TEXT,
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL CHECK (status IN ('ACTIVE', 'EXPIRED', 'ARCHIVED')),
    notes TEXT,
    uploaded_by UUID REFERENCES auth.users(id),
    uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    archived_by UUID REFERENCES auth.users(id),
    archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_supp_docs_supplier ON public.supplier_documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supp_docs_expiry ON public.supplier_documents(expiry_date);


-- 7. Create `supplier_qualification_history` Table
CREATE TABLE IF NOT EXISTS public.supplier_qualification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    changed_by UUID REFERENCES auth.users(id) NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_supp_qual_hist ON public.supplier_qualification_history(supplier_id, changed_at DESC);


-- 8. Seed Phase 6 Permissions into `public.permissions`
INSERT INTO public.permissions (id, module, description) VALUES
    ('suppliers.view', 'suppliers', 'View supplier catalog, contacts, addresses, and qualification'),
    ('suppliers.create', 'suppliers', 'Create new supplier master records'),
    ('suppliers.update', 'suppliers', 'Update supplier master data and general details'),
    ('suppliers.deactivate', 'suppliers', 'Deactivate active suppliers with mandatory reason'),
    ('suppliers.reactivate', 'suppliers', 'Reactivate inactive suppliers with mandatory reason'),
    ('suppliers.delete', 'suppliers', 'Permanently delete unreferenced suppliers with no dependencies'),
    ('suppliers.view_all', 'suppliers', 'View all suppliers across all operational scopes and statuses'),
    ('supplier_contacts.manage', 'suppliers', 'Create, update, and manage supplier contacts'),
    ('supplier_addresses.manage', 'suppliers', 'Create, update, and manage supplier addresses'),
    ('supplier_materials.view', 'suppliers', 'View supplier-material catalog associations'),
    ('supplier_materials.manage', 'suppliers', 'Create, update, and deactivate supplier-material associations'),
    ('supplier_documents.view', 'suppliers', 'View and download authorized supplier documents'),
    ('supplier_documents.upload', 'suppliers', 'Upload supplier verification and quality documents'),
    ('supplier_documents.archive', 'suppliers', 'Archive expired or obsolete supplier documents'),
    ('supplier_qualification.view', 'suppliers', 'View supplier qualification status and review notes'),
    ('supplier_qualification.update', 'suppliers', 'Update supplier qualification status with mandatory review notes')
ON CONFLICT (id) DO UPDATE 
SET module = EXCLUDED.module,
    description = EXCLUDED.description;

-- Seed Role Permissions for Phase 6
INSERT INTO public.role_permissions (role_id, permission_id) VALUES
    -- Super Admin: Full platform & supplier administration
    ('super_admin', 'suppliers.view'),
    ('super_admin', 'suppliers.create'),
    ('super_admin', 'suppliers.update'),
    ('super_admin', 'suppliers.deactivate'),
    ('super_admin', 'suppliers.reactivate'),
    ('super_admin', 'suppliers.delete'),
    ('super_admin', 'suppliers.view_all'),
    ('super_admin', 'supplier_contacts.manage'),
    ('super_admin', 'supplier_addresses.manage'),
    ('super_admin', 'supplier_materials.view'),
    ('super_admin', 'supplier_materials.manage'),
    ('super_admin', 'supplier_documents.view'),
    ('super_admin', 'supplier_documents.upload'),
    ('super_admin', 'supplier_documents.archive'),
    ('super_admin', 'supplier_qualification.view'),
    ('super_admin', 'supplier_qualification.update'),

    -- SCM Admin: Operational Supplier Management (all except permanent hard-delete)
    ('scm_admin', 'suppliers.view'),
    ('scm_admin', 'suppliers.create'),
    ('scm_admin', 'suppliers.update'),
    ('scm_admin', 'suppliers.deactivate'),
    ('scm_admin', 'suppliers.reactivate'),
    ('scm_admin', 'suppliers.view_all'),
    ('scm_admin', 'supplier_contacts.manage'),
    ('scm_admin', 'supplier_addresses.manage'),
    ('scm_admin', 'supplier_materials.view'),
    ('scm_admin', 'supplier_materials.manage'),
    ('scm_admin', 'supplier_documents.view'),
    ('scm_admin', 'supplier_documents.upload'),
    ('scm_admin', 'supplier_documents.archive'),
    ('scm_admin', 'supplier_qualification.view'),
    ('scm_admin', 'supplier_qualification.update'),

    -- SCM Team User: Operational View Access
    ('scm_team_user', 'suppliers.view'),
    ('scm_team_user', 'supplier_materials.view'),
    ('scm_team_user', 'supplier_documents.view'),
    ('scm_team_user', 'supplier_qualification.view')
ON CONFLICT (role_id, permission_id) DO NOTHING;


-- 9. RPC Functions with 9-Step Authorization & Audit Trail

-- Helper: Verify employee active status
CREATE OR REPLACE FUNCTION public.check_supplier_auth(required_perm VARCHAR)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_is_active BOOLEAN;
    v_role VARCHAR;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT is_active, assigned_role INTO v_is_active, v_role
    FROM public.employees
    WHERE user_id = v_user_id;

    IF v_is_active IS NOT TRUE THEN
        RAISE EXCEPTION 'Active employee record required.';
    END IF;

    IF NOT public.current_user_has_permission(required_perm) THEN
        RAISE EXCEPTION 'Access denied. Missing permission: %', required_perm;
    END IF;

    RETURN v_user_id;
END;
$$;


-- RPC: Create Supplier
CREATE OR REPLACE FUNCTION public.api_create_supplier(
    p_legal_name VARCHAR,
    p_display_name VARCHAR DEFAULT NULL,
    p_supplier_type VARCHAR DEFAULT 'MANUFACTURER',
    p_tax_identifier VARCHAR DEFAULT NULL,
    p_website VARCHAR DEFAULT NULL,
    p_general_email VARCHAR DEFAULT NULL,
    p_general_phone VARCHAR DEFAULT NULL,
    p_registered_address TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_supplier_id UUID;
    v_code VARCHAR;
    v_res RECORD;
BEGIN
    v_user_id := public.check_supplier_auth('suppliers.create');

    IF p_legal_name IS NULL OR trim(p_legal_name) = '' THEN
        RAISE EXCEPTION 'Legal name is required.';
    END IF;

    v_code := public.generate_supplier_code();

    INSERT INTO public.suppliers (
        vendor_code,
        supplier_code,
        legal_name,
        display_name,
        trade_name,
        supplier_type,
        tax_identifier,
        gstin,
        website,
        general_email,
        email,
        general_phone,
        phone,
        registered_address,
        address_line1,
        city,
        state,
        pincode,
        supplier_status,
        status,
        qualification_status,
        created_by,
        created_at,
        updated_at
    ) VALUES (
        v_code,
        v_code,
        trim(p_legal_name),
        coalesce(nullif(trim(p_display_name), ''), trim(p_legal_name)),
        coalesce(nullif(trim(p_display_name), ''), trim(p_legal_name)),
        p_supplier_type,
        nullif(trim(p_tax_identifier), ''),
        nullif(trim(p_tax_identifier), ''),
        nullif(trim(p_website), ''),
        coalesce(nullif(trim(p_general_email), ''), 'supplier@placeholder.local'),
        coalesce(nullif(trim(p_general_email), ''), 'supplier@placeholder.local'),
        nullif(trim(p_general_phone), ''),
        nullif(trim(p_general_phone), ''),
        nullif(trim(p_registered_address), ''),
        coalesce(nullif(trim(p_registered_address), ''), 'Registered Office'),
        'Headquarters',
        'State',
        '000000',
        'ACTIVE',
        'active',
        'NOT_STARTED',
        v_user_id,
        now(),
        now()
    ) RETURNING * INTO v_res;

    -- Audit log
    INSERT INTO public.audit_logs (
        table_name, record_id, action, new_values, changed_by, created_at
    ) VALUES (
        'suppliers', v_res.id, 'CREATE_SUPPLIER',
        jsonb_build_object('supplier_code', v_code, 'legal_name', v_res.legal_name, 'supplier_type', p_supplier_type),
        v_user_id, now()
    );

    RETURN to_jsonb(v_res);
END;
$$;


-- RPC: Update Supplier Master
CREATE OR REPLACE FUNCTION public.api_update_supplier(
    p_supplier_id UUID,
    p_legal_name VARCHAR,
    p_display_name VARCHAR DEFAULT NULL,
    p_supplier_type VARCHAR DEFAULT NULL,
    p_tax_identifier VARCHAR DEFAULT NULL,
    p_website VARCHAR DEFAULT NULL,
    p_general_email VARCHAR DEFAULT NULL,
    p_general_phone VARCHAR DEFAULT NULL,
    p_registered_address TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_old RECORD;
    v_res RECORD;
BEGIN
    v_user_id := public.check_supplier_auth('suppliers.update');

    SELECT * INTO v_old FROM public.suppliers WHERE id = p_supplier_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Supplier record not found.';
    END IF;

    IF p_legal_name IS NULL OR trim(p_legal_name) = '' THEN
        RAISE EXCEPTION 'Legal name is required.';
    END IF;

    UPDATE public.suppliers
    SET legal_name = trim(p_legal_name),
        display_name = coalesce(nullif(trim(p_display_name), ''), trim(p_legal_name)),
        supplier_type = coalesce(p_supplier_type, supplier_type),
        tax_identifier = nullif(trim(p_tax_identifier), ''),
        gstin = nullif(trim(p_tax_identifier), ''),
        website = nullif(trim(p_website), ''),
        general_email = coalesce(nullif(trim(p_general_email), ''), general_email),
        general_phone = nullif(trim(p_general_phone), ''),
        registered_address = nullif(trim(p_registered_address), ''),
        updated_by = v_user_id,
        updated_at = now()
    WHERE id = p_supplier_id
    RETURNING * INTO v_res;

    INSERT INTO public.audit_logs (
        table_name, record_id, action, old_values, new_values, changed_by, created_at
    ) VALUES (
        'suppliers', p_supplier_id, 'UPDATE_SUPPLIER',
        jsonb_build_object('legal_name', v_old.legal_name, 'display_name', v_old.display_name, 'supplier_type', v_old.supplier_type),
        jsonb_build_object('legal_name', v_res.legal_name, 'display_name', v_res.display_name, 'supplier_type', v_res.supplier_type),
        v_user_id, now()
    );

    RETURN to_jsonb(v_res);
END;
$$;


-- RPC: Deactivate Supplier
CREATE OR REPLACE FUNCTION public.api_deactivate_supplier(
    p_supplier_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_old RECORD;
BEGIN
    v_user_id := public.check_supplier_auth('suppliers.deactivate');

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'Deactivation reason is mandatory.';
    END IF;

    SELECT * INTO v_old FROM public.suppliers WHERE id = p_supplier_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Supplier not found.';
    END IF;

    IF v_old.supplier_status = 'INACTIVE' THEN
        RAISE EXCEPTION 'Supplier is already inactive.';
    END IF;

    UPDATE public.suppliers
    SET supplier_status = 'INACTIVE',
        status = 'on_hold',
        deactivated_by = v_user_id,
        deactivated_at = now(),
        deactivation_reason = trim(p_reason),
        updated_by = v_user_id,
        updated_at = now()
    WHERE id = p_supplier_id;

    INSERT INTO public.audit_logs (
        table_name, record_id, action, old_values, new_values, changed_by, created_at
    ) VALUES (
        'suppliers', p_supplier_id, 'DEACTIVATE_SUPPLIER',
        jsonb_build_object('supplier_status', 'ACTIVE'),
        jsonb_build_object('supplier_status', 'INACTIVE', 'reason', trim(p_reason)),
        v_user_id, now()
    );

    RETURN jsonb_build_object('success', true, 'supplier_status', 'INACTIVE');
END;
$$;


-- RPC: Reactivate Supplier
CREATE OR REPLACE FUNCTION public.api_reactivate_supplier(
    p_supplier_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_old RECORD;
BEGIN
    v_user_id := public.check_supplier_auth('suppliers.reactivate');

    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RAISE EXCEPTION 'Reactivation reason is mandatory.';
    END IF;

    SELECT * INTO v_old FROM public.suppliers WHERE id = p_supplier_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Supplier not found.';
    END IF;

    IF v_old.supplier_status = 'ACTIVE' THEN
        RAISE EXCEPTION 'Supplier is already active.';
    END IF;

    UPDATE public.suppliers
    SET supplier_status = 'ACTIVE',
        status = 'active',
        reactivated_by = v_user_id,
        reactivated_at = now(),
        reactivation_reason = trim(p_reason),
        updated_by = v_user_id,
        updated_at = now()
    WHERE id = p_supplier_id;

    INSERT INTO public.audit_logs (
        table_name, record_id, action, old_values, new_values, changed_by, created_at
    ) VALUES (
        'suppliers', p_supplier_id, 'REACTIVATE_SUPPLIER',
        jsonb_build_object('supplier_status', 'INACTIVE'),
        jsonb_build_object('supplier_status', 'ACTIVE', 'reason', trim(p_reason)),
        v_user_id, now()
    );

    RETURN jsonb_build_object('success', true, 'supplier_status', 'ACTIVE');
END;
$$;


-- RPC: Delete Supplier (Permanent Deletion Only When No Dependencies Exist)
CREATE OR REPLACE FUNCTION public.api_delete_supplier(
    p_supplier_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_old RECORD;
    v_count INTEGER;
BEGIN
    v_user_id := public.check_supplier_auth('suppliers.delete');

    SELECT * INTO v_old FROM public.suppliers WHERE id = p_supplier_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Supplier not found.';
    END IF;

    -- Safeguard 1: Dependent contacts
    SELECT count(*) INTO v_count FROM public.supplier_contacts WHERE supplier_id = p_supplier_id;
    IF v_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete supplier: supplier has % dependent contact(s). Use deactivation instead.', v_count;
    END IF;

    -- Safeguard 2: Dependent addresses
    SELECT count(*) INTO v_count FROM public.supplier_addresses WHERE supplier_id = p_supplier_id;
    IF v_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete supplier: supplier has % dependent address(es). Use deactivation instead.', v_count;
    END IF;

    -- Safeguard 3: Dependent material associations
    SELECT count(*) INTO v_count FROM public.supplier_materials WHERE supplier_id = p_supplier_id;
    IF v_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete supplier: supplier has % material association(s). Use deactivation instead.', v_count;
    END IF;

    -- Safeguard 4: Dependent documents
    SELECT count(*) INTO v_count FROM public.supplier_documents WHERE supplier_id = p_supplier_id;
    IF v_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete supplier: supplier has % stored document(s). Use deactivation instead.', v_count;
    END IF;

    -- Safeguard 5: Qualification history
    SELECT count(*) INTO v_count FROM public.supplier_qualification_history WHERE supplier_id = p_supplier_id;
    IF v_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete supplier: supplier has historical qualification records. Use deactivation instead.';
    END IF;

    -- Safeguard 6: Purchase orders or invoices if any exist in the database
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') THEN
        EXECUTE 'SELECT count(*) FROM public.purchase_orders WHERE supplier_id = $1' INTO v_count USING p_supplier_id;
        IF v_count > 0 THEN
            RAISE EXCEPTION 'Cannot delete supplier: supplier is referenced in % purchase order(s).', v_count;
        END IF;
    END IF;

    -- Delete cleanly
    DELETE FROM public.suppliers WHERE id = p_supplier_id;

    INSERT INTO public.audit_logs (
        table_name, record_id, action, old_values, changed_by, created_at
    ) VALUES (
        'suppliers', p_supplier_id, 'PERMANENT_DELETE_SUPPLIER',
        jsonb_build_object('supplier_code', v_old.supplier_code, 'legal_name', v_old.legal_name),
        v_user_id, now()
    );

    RETURN jsonb_build_object('success', true, 'deleted_supplier_id', p_supplier_id);
END;
$$;


-- RPC: Manage Supplier Contact
CREATE OR REPLACE FUNCTION public.api_manage_supplier_contact(
    p_supplier_id UUID,
    p_contact_id UUID DEFAULT NULL,
    p_full_name VARCHAR DEFAULT NULL,
    p_job_title VARCHAR DEFAULT NULL,
    p_email VARCHAR DEFAULT NULL,
    p_phone VARCHAR DEFAULT NULL,
    p_contact_type VARCHAR DEFAULT 'PRIMARY',
    p_is_primary BOOLEAN DEFAULT false,
    p_is_active BOOLEAN DEFAULT true,
    p_action VARCHAR DEFAULT 'upsert' -- 'upsert' or 'delete'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_res RECORD;
BEGIN
    v_user_id := public.check_supplier_auth('supplier_contacts.manage');

    IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id) THEN
        RAISE EXCEPTION 'Supplier not found.';
    END IF;

    IF p_action = 'delete' THEN
        IF p_contact_id IS NULL THEN
            RAISE EXCEPTION 'Contact ID required for deletion.';
        END IF;
        DELETE FROM public.supplier_contacts WHERE id = p_contact_id AND supplier_id = p_supplier_id;
        
        INSERT INTO public.audit_logs (table_name, record_id, action, changed_by, created_at)
        VALUES ('supplier_contacts', p_contact_id, 'DELETE_CONTACT', v_user_id, now());

        RETURN jsonb_build_object('success', true, 'action', 'deleted');
    END IF;

    IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
        RAISE EXCEPTION 'Contact full name is required.';
    END IF;

    -- If this contact is designated as active primary, demote existing primary contacts
    IF p_is_primary IS TRUE AND p_is_active IS TRUE THEN
        UPDATE public.supplier_contacts
        SET is_primary = false, updated_at = now()
        WHERE supplier_id = p_supplier_id AND is_primary = true AND (p_contact_id IS NULL OR id <> p_contact_id);
    END IF;

    IF p_contact_id IS NULL THEN
        -- Insert
        INSERT INTO public.supplier_contacts (
            supplier_id, full_name, name, job_title, designation, email, phone, mobile, contact_type, is_primary, is_active, created_by, created_at, updated_at
        ) VALUES (
            p_supplier_id, trim(p_full_name), trim(p_full_name), nullif(trim(p_job_title), ''), nullif(trim(p_job_title), ''),
            coalesce(nullif(trim(p_email), ''), 'supplier@placeholder.local'), nullif(trim(p_phone), ''), coalesce(nullif(trim(p_phone), ''), '0000000000'),
            coalesce(p_contact_type, 'PRIMARY'), coalesce(p_is_primary, false), coalesce(p_is_active, true), v_user_id, now(), now()
        ) RETURNING * INTO v_res;
    ELSE
        -- Update
        UPDATE public.supplier_contacts
        SET full_name = trim(p_full_name),
            name = trim(p_full_name),
            job_title = nullif(trim(p_job_title), ''),
            designation = nullif(trim(p_job_title), ''),
            email = coalesce(nullif(trim(p_email), ''), email),
            phone = nullif(trim(p_phone), ''),
            mobile = coalesce(nullif(trim(p_phone), ''), mobile),
            contact_type = coalesce(p_contact_type, contact_type),
            is_primary = coalesce(p_is_primary, is_primary),
            is_active = coalesce(p_is_active, is_active),
            updated_by = v_user_id,
            updated_at = now()
        WHERE id = p_contact_id AND supplier_id = p_supplier_id
        RETURNING * INTO v_res;
    END IF;

    INSERT INTO public.audit_logs (table_name, record_id, action, new_values, changed_by, created_at)
    VALUES ('supplier_contacts', v_res.id, 'SAVE_CONTACT', to_jsonb(v_res), v_user_id, now());

    RETURN to_jsonb(v_res);
END;
$$;


-- RPC: Manage Supplier Address
CREATE OR REPLACE FUNCTION public.api_manage_supplier_address(
    p_supplier_id UUID,
    p_address_id UUID DEFAULT NULL,
    p_address_type VARCHAR DEFAULT 'REGISTERED',
    p_address_line1 TEXT DEFAULT NULL,
    p_address_line2 TEXT DEFAULT NULL,
    p_city VARCHAR DEFAULT NULL,
    p_state_province VARCHAR DEFAULT NULL,
    p_postal_code VARCHAR DEFAULT NULL,
    p_country VARCHAR DEFAULT 'India',
    p_is_primary BOOLEAN DEFAULT false,
    p_is_active BOOLEAN DEFAULT true,
    p_action VARCHAR DEFAULT 'upsert' -- 'upsert' or 'delete'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_res RECORD;
BEGIN
    v_user_id := public.check_supplier_auth('supplier_addresses.manage');

    IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id) THEN
        RAISE EXCEPTION 'Supplier not found.';
    END IF;

    IF p_action = 'delete' THEN
        IF p_address_id IS NULL THEN
            RAISE EXCEPTION 'Address ID required for deletion.';
        END IF;
        DELETE FROM public.supplier_addresses WHERE id = p_address_id AND supplier_id = p_supplier_id;
        
        INSERT INTO public.audit_logs (table_name, record_id, action, changed_by, created_at)
        VALUES ('supplier_addresses', p_address_id, 'DELETE_ADDRESS', v_user_id, now());

        RETURN jsonb_build_object('success', true, 'action', 'deleted');
    END IF;

    IF p_address_line1 IS NULL OR trim(p_address_line1) = '' THEN
        RAISE EXCEPTION 'Address line 1 is required.';
    END IF;
    IF p_city IS NULL OR trim(p_city) = '' THEN
        RAISE EXCEPTION 'City is required.';
    END IF;
    IF p_state_province IS NULL OR trim(p_state_province) = '' THEN
        RAISE EXCEPTION 'State/province is required.';
    END IF;
    IF p_postal_code IS NULL OR trim(p_postal_code) = '' THEN
        RAISE EXCEPTION 'Postal code is required.';
    END IF;

    -- If designated as active primary for this address type, demote existing primary of same type
    IF p_is_primary IS TRUE AND p_is_active IS TRUE THEN
        UPDATE public.supplier_addresses
        SET is_primary = false, updated_at = now()
        WHERE supplier_id = p_supplier_id AND address_type = p_address_type AND is_primary = true AND (p_address_id IS NULL OR id <> p_address_id);
    END IF;

    IF p_address_id IS NULL THEN
        -- Insert
        INSERT INTO public.supplier_addresses (
            supplier_id, address_type, address_line1, address_line2, city, state_province, postal_code, country, is_primary, is_active, created_by, created_at, updated_at
        ) VALUES (
            p_supplier_id, p_address_type, trim(p_address_line1), nullif(trim(p_address_line2), ''), trim(p_city), trim(p_state_province), trim(p_postal_code),
            coalesce(nullif(trim(p_country), ''), 'India'), coalesce(p_is_primary, false), coalesce(p_is_active, true), v_user_id, now(), now()
        ) RETURNING * INTO v_res;
    ELSE
        -- Update
        UPDATE public.supplier_addresses
        SET address_type = p_address_type,
            address_line1 = trim(p_address_line1),
            address_line2 = nullif(trim(p_address_line2), ''),
            city = trim(p_city),
            state_province = trim(p_state_province),
            postal_code = trim(p_postal_code),
            country = coalesce(nullif(trim(p_country), ''), 'India'),
            is_primary = coalesce(p_is_primary, is_primary),
            is_active = coalesce(p_is_active, is_active),
            updated_by = v_user_id,
            updated_at = now()
        WHERE id = p_address_id AND supplier_id = p_supplier_id
        RETURNING * INTO v_res;
    END IF;

    INSERT INTO public.audit_logs (table_name, record_id, action, new_values, changed_by, created_at)
    VALUES ('supplier_addresses', v_res.id, 'SAVE_ADDRESS', to_jsonb(v_res), v_user_id, now());

    RETURN to_jsonb(v_res);
END;
$$;


-- RPC: Manage Supplier-Material Association
CREATE OR REPLACE FUNCTION public.api_manage_supplier_material(
    p_supplier_id UUID,
    p_material_id UUID,
    p_association_id UUID DEFAULT NULL,
    p_supplier_part_number VARCHAR DEFAULT NULL,
    p_supplier_material_description TEXT DEFAULT NULL,
    p_specification_grade VARCHAR DEFAULT NULL,
    p_minimum_order_quantity NUMERIC DEFAULT NULL,
    p_lead_time_days INTEGER DEFAULT NULL,
    p_status VARCHAR DEFAULT 'ACTIVE',
    p_action VARCHAR DEFAULT 'upsert' -- 'upsert' or 'delete'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_supplier_status VARCHAR;
    v_res RECORD;
BEGIN
    v_user_id := public.check_supplier_auth('supplier_materials.manage');

    SELECT supplier_status INTO v_supplier_status FROM public.suppliers WHERE id = p_supplier_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Supplier not found.';
    END IF;

    IF p_action = 'delete' THEN
        IF p_association_id IS NULL THEN
            RAISE EXCEPTION 'Association ID required for deletion.';
        END IF;
        DELETE FROM public.supplier_materials WHERE id = p_association_id AND supplier_id = p_supplier_id;

        INSERT INTO public.audit_logs (table_name, record_id, action, changed_by, created_at)
        VALUES ('supplier_materials', p_association_id, 'DELETE_SUPPLIER_MATERIAL', v_user_id, now());

        RETURN jsonb_build_object('success', true, 'action', 'deleted');
    END IF;

    -- Rule: An inactive supplier cannot be selected for new associations
    IF p_association_id IS NULL AND v_supplier_status = 'INACTIVE' THEN
        RAISE EXCEPTION 'Cannot associate materials with an inactive supplier.';
    END IF;

    -- Validate MOQ > 0 if provided
    IF p_minimum_order_quantity IS NOT NULL AND p_minimum_order_quantity <= 0 THEN
        RAISE EXCEPTION 'Minimum order quantity must be greater than zero.';
    END IF;

    -- Validate lead time >= 0 if provided
    IF p_lead_time_days IS NOT NULL AND p_lead_time_days < 0 THEN
        RAISE EXCEPTION 'Lead time in calendar days must be a non-negative whole number.';
    END IF;

    -- Verify material exists
    IF NOT EXISTS (SELECT 1 FROM public.material_masters WHERE id = p_material_id) THEN
        RAISE EXCEPTION 'Referenced material does not exist in the Material Catalog.';
    END IF;

    IF p_association_id IS NULL THEN
        -- Check if active association already exists
        IF EXISTS (SELECT 1 FROM public.supplier_materials WHERE supplier_id = p_supplier_id AND material_id = p_material_id AND status = 'ACTIVE') THEN
            RAISE EXCEPTION 'An active material association already exists for this supplier and material.';
        END IF;

        INSERT INTO public.supplier_materials (
            supplier_id, material_id, supplier_part_number, supplier_material_description, specification_grade, minimum_order_quantity, lead_time_days, status, created_by, created_at, updated_at
        ) VALUES (
            p_supplier_id, p_material_id, nullif(trim(p_supplier_part_number), ''), nullif(trim(p_supplier_material_description), ''), nullif(trim(p_specification_grade), ''),
            p_minimum_order_quantity, p_lead_time_days, coalesce(p_status, 'ACTIVE'), v_user_id, now(), now()
        ) RETURNING * INTO v_res;
    ELSE
        UPDATE public.supplier_materials
        SET supplier_part_number = nullif(trim(p_supplier_part_number), ''),
            supplier_material_description = nullif(trim(p_supplier_material_description), ''),
            specification_grade = nullif(trim(p_specification_grade), ''),
            minimum_order_quantity = p_minimum_order_quantity,
            lead_time_days = p_lead_time_days,
            status = coalesce(p_status, status),
            updated_by = v_user_id,
            updated_at = now()
        WHERE id = p_association_id AND supplier_id = p_supplier_id
        RETURNING * INTO v_res;
    END IF;

    INSERT INTO public.audit_logs (table_name, record_id, action, new_values, changed_by, created_at)
    VALUES ('supplier_materials', v_res.id, 'SAVE_SUPPLIER_MATERIAL', to_jsonb(v_res), v_user_id, now());

    RETURN to_jsonb(v_res);
END;
$$;


-- RPC: Upload / Register Supplier Document
CREATE OR REPLACE FUNCTION public.api_upload_supplier_document(
    p_supplier_id UUID,
    p_document_type VARCHAR,
    p_document_name VARCHAR,
    p_file_key TEXT,
    p_file_url TEXT DEFAULT NULL,
    p_file_size_bytes BIGINT DEFAULT NULL,
    p_mime_type VARCHAR DEFAULT NULL,
    p_issue_date DATE DEFAULT NULL,
    p_expiry_date DATE DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_status VARCHAR := 'ACTIVE';
    v_res RECORD;
BEGIN
    v_user_id := public.check_supplier_auth('supplier_documents.upload');

    IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id) THEN
        RAISE EXCEPTION 'Supplier not found.';
    END IF;

    IF p_document_name IS NULL OR trim(p_document_name) = '' THEN
        RAISE EXCEPTION 'Document name is required.';
    END IF;
    IF p_file_key IS NULL OR trim(p_file_key) = '' THEN
        RAISE EXCEPTION 'File key/reference is required.';
    END IF;

    -- If expiry date has passed, mark initial status as EXPIRED
    IF p_expiry_date IS NOT NULL AND p_expiry_date < CURRENT_DATE THEN
        v_status := 'EXPIRED';
    END IF;

    INSERT INTO public.supplier_documents (
        supplier_id, document_type, document_name, file_key, file_url, file_size_bytes, mime_type, issue_date, expiry_date, status, notes, uploaded_by, uploaded_at
    ) VALUES (
        p_supplier_id, p_document_type, trim(p_document_name), trim(p_file_key), p_file_url, p_file_size_bytes, p_mime_type, p_issue_date, p_expiry_date, v_status, nullif(trim(p_notes), ''), v_user_id, now()
    ) RETURNING * INTO v_res;

    INSERT INTO public.audit_logs (table_name, record_id, action, new_values, changed_by, created_at)
    VALUES ('supplier_documents', v_res.id, 'UPLOAD_DOCUMENT', jsonb_build_object('document_name', v_res.document_name, 'document_type', p_document_type, 'expiry_date', p_expiry_date), v_user_id, now());

    RETURN to_jsonb(v_res);
END;
$$;


-- RPC: Archive Supplier Document
CREATE OR REPLACE FUNCTION public.api_archive_supplier_document(
    p_document_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_res RECORD;
BEGIN
    v_user_id := public.check_supplier_auth('supplier_documents.archive');

    SELECT * INTO v_res FROM public.supplier_documents WHERE id = p_document_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Document not found.';
    END IF;

    UPDATE public.supplier_documents
    SET status = 'ARCHIVED',
        archived_by = v_user_id,
        archived_at = now(),
        notes = CASE 
            WHEN p_reason IS NOT NULL AND trim(p_reason) <> '' THEN coalesce(notes || ' | ', '') || 'Archived: ' || trim(p_reason)
            ELSE notes 
        END
    WHERE id = p_document_id
    RETURNING * INTO v_res;

    INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, changed_by, created_at)
    VALUES ('supplier_documents', p_document_id, 'ARCHIVE_DOCUMENT', jsonb_build_object('status', 'ACTIVE'), jsonb_build_object('status', 'ARCHIVED', 'reason', p_reason), v_user_id, now());

    RETURN to_jsonb(v_res);
END;
$$;


-- RPC: Update Supplier Qualification Status
CREATE OR REPLACE FUNCTION public.api_update_supplier_qualification(
    p_supplier_id UUID,
    p_new_status VARCHAR,
    p_review_notes TEXT,
    p_qualification_start_date DATE DEFAULT NULL,
    p_qualification_expiry_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_old RECORD;
    v_res RECORD;
BEGIN
    v_user_id := public.check_supplier_auth('supplier_qualification.update');

    SELECT * INTO v_old FROM public.suppliers WHERE id = p_supplier_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Supplier not found.';
    END IF;

    -- Validation rule: Require a reason or review note when changing status to NOT_QUALIFIED or EXPIRED
    IF p_new_status IN ('NOT_QUALIFIED', 'EXPIRED') AND (p_review_notes IS NULL OR trim(p_review_notes) = '') THEN
        RAISE EXCEPTION 'Review note/reason is mandatory when changing qualification to %.', p_new_status;
    END IF;

    UPDATE public.suppliers
    SET qualification_status = p_new_status,
        qualification_start_date = coalesce(p_qualification_start_date, qualification_start_date),
        qualification_expiry_date = coalesce(p_qualification_expiry_date, qualification_expiry_date),
        last_reviewed_date = CURRENT_DATE,
        review_notes = nullif(trim(p_review_notes), ''),
        qualification_updated_by = v_user_id,
        qualification_updated_at = now(),
        updated_by = v_user_id,
        updated_at = now()
    WHERE id = p_supplier_id
    RETURNING * INTO v_res;

    -- Record transition in qualification history
    INSERT INTO public.supplier_qualification_history (
        supplier_id, previous_status, new_status, reason, changed_by, changed_at
    ) VALUES (
        p_supplier_id, v_old.qualification_status, p_new_status, coalesce(nullif(trim(p_review_notes), ''), 'Qualification status updated'), v_user_id, now()
    );

    -- Record in audit logs
    INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, changed_by, created_at)
    VALUES (
        'suppliers', p_supplier_id, 'UPDATE_QUALIFICATION',
        jsonb_build_object('qualification_status', v_old.qualification_status),
        jsonb_build_object('qualification_status', p_new_status, 'notes', p_review_notes, 'expiry_date', p_qualification_expiry_date),
        v_user_id, now()
    );

    RETURN to_jsonb(v_res);
END;
$$;


-- 10. Enable Row Level Security (RLS) on all Supplier Tables
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_qualification_history ENABLE ROW LEVEL SECURITY;

-- Allow authenticated read on suppliers & sub-entities
DROP POLICY IF EXISTS "Auth read on suppliers" ON public.suppliers;
CREATE POLICY "Auth read on suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth read on supplier_contacts" ON public.supplier_contacts;
CREATE POLICY "Auth read on supplier_contacts" ON public.supplier_contacts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth read on supplier_addresses" ON public.supplier_addresses;
CREATE POLICY "Auth read on supplier_addresses" ON public.supplier_addresses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth read on supplier_materials" ON public.supplier_materials;
CREATE POLICY "Auth read on supplier_materials" ON public.supplier_materials FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth read on supplier_documents" ON public.supplier_documents;
CREATE POLICY "Auth read on supplier_documents" ON public.supplier_documents FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth read on supplier_qualification_history" ON public.supplier_qualification_history;
CREATE POLICY "Auth read on supplier_qualification_history" ON public.supplier_qualification_history FOR SELECT TO authenticated USING (true);

-- Super admin full management
DROP POLICY IF EXISTS "Super admin all on suppliers" ON public.suppliers;
CREATE POLICY "Super admin all on suppliers" ON public.suppliers FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));

DROP POLICY IF EXISTS "Super admin all on supplier_contacts" ON public.supplier_contacts;
CREATE POLICY "Super admin all on supplier_contacts" ON public.supplier_contacts FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));

DROP POLICY IF EXISTS "Super admin all on supplier_addresses" ON public.supplier_addresses;
CREATE POLICY "Super admin all on supplier_addresses" ON public.supplier_addresses FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));

DROP POLICY IF EXISTS "Super admin all on supplier_materials" ON public.supplier_materials;
CREATE POLICY "Super admin all on supplier_materials" ON public.supplier_materials FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));

DROP POLICY IF EXISTS "Super admin all on supplier_documents" ON public.supplier_documents;
CREATE POLICY "Super admin all on supplier_documents" ON public.supplier_documents FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));

DROP POLICY IF EXISTS "Super admin all on supplier_qualification_history" ON public.supplier_qualification_history;
CREATE POLICY "Super admin all on supplier_qualification_history" ON public.supplier_qualification_history FOR ALL TO authenticated USING (public.current_user_has_role('super_admin'));

COMMIT;

