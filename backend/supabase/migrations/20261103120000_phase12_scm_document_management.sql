-- =============================================================================
-- SCM Flow — Phase 12: SCM Document Management & Expiry Tracking
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

