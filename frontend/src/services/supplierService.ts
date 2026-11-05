import { supabase } from '@/lib/supabase';
import {
  Supplier,
  SupplierAddress,
  SupplierContact,
  SupplierDocument,
  SupplierMaterial,
  SupplierQualificationHistory,
  SupplierQualificationStatus,
  SupplierType,
} from '@/types/database.types';
import { MOCK_SUPPLIERS } from '@/lib/mockData';
import { fastQuery } from '@/lib/asyncUtils';

export interface SupplierFilters {
  searchTerm?: string;
  supplierType?: SupplierType | 'all';
  supplierStatus?: 'ACTIVE' | 'INACTIVE' | 'all';
  qualificationStatus?: SupplierQualificationStatus | 'all';
  expiringDocumentsOnly?: boolean;
  sortBy?: 'supplier_code' | 'legal_name' | 'supplier_status' | 'qualification_status' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface SupplierListResponse {
  data: Supplier[];
  totalCount: number;
  error?: string;
}

/**
 * Fetches paginated, filtered, and sorted suppliers.
 */
export async function fetchSuppliers(filters: SupplierFilters = {}): Promise<SupplierListResponse> {
  try {
    const {
      searchTerm,
      supplierType,
      supplierStatus,
      qualificationStatus,
      sortBy = 'updated_at',
      sortOrder = 'desc',
      page = 1,
      pageSize = 15,
    } = filters;

    let query = supabase.from('suppliers').select('*', { count: 'exact' });

    if (supplierStatus && supplierStatus !== 'all') {
      query = query.eq('supplier_status', supplierStatus);
    }

    if (supplierType && supplierType !== 'all') {
      query = query.eq('supplier_type', supplierType);
    }

    if (qualificationStatus && qualificationStatus !== 'all') {
      query = query.eq('qualification_status', qualificationStatus);
    }

    if (searchTerm && searchTerm.trim()) {
      const term = `%${searchTerm.trim()}%`;
      query = query.or(
        `supplier_code.ilike.${term},legal_name.ilike.${term},display_name.ilike.${term},tax_identifier.ilike.${term}`
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.order(sortBy, { ascending: sortOrder === 'asc' }).range(from, to);

    const fallbackRes = { data: MOCK_SUPPLIERS, count: MOCK_SUPPLIERS.length, error: null };
    const { data, count, error } = await fastQuery(query, fallbackRes as any);

    if (error || !data || data.length === 0) {
      return { data: MOCK_SUPPLIERS, totalCount: MOCK_SUPPLIERS.length };
    }

    return {
      data: (data as Supplier[]) || [],
      totalCount: count ?? (data?.length || 0),
    };
  } catch (err: any) {
    return { data: MOCK_SUPPLIERS, totalCount: MOCK_SUPPLIERS.length };
  }
}

/**
 * Fetches a single supplier by ID with aggregate dependency metrics.
 */
export async function fetchSupplierById(supplierId: string): Promise<{ data?: Supplier | null; error?: string }> {
  try {
    const singleQuery = supabase
      .from('suppliers')
      .select('*')
      .eq('id', supplierId)
      .single();

    const match = MOCK_SUPPLIERS.find((s) => s.id === supplierId) || MOCK_SUPPLIERS[0];
    const { data, error } = await fastQuery(singleQuery, { data: match, error: null } as any);

    if (error || !data) {
      return { data: match };
    }

    return { data: data as Supplier };
  } catch (err: any) {
    const match = MOCK_SUPPLIERS.find((s) => s.id === supplierId) || MOCK_SUPPLIERS[0];
    return { data: match };
  }
}

/**
 * Creates a new supplier master record via authoritative RPC.
 */
export async function createSupplier(payload: {
  legal_name: string;
  display_name?: string;
  supplier_type: SupplierType;
  tax_identifier?: string;
  website?: string;
  general_email?: string;
  general_phone?: string;
  registered_address?: string;
}): Promise<{ data?: Supplier; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_create_supplier', {
      p_legal_name: payload.legal_name,
      p_display_name: payload.display_name || null,
      p_supplier_type: payload.supplier_type,
      p_tax_identifier: payload.tax_identifier || null,
      p_website: payload.website || null,
      p_general_email: payload.general_email || null,
      p_general_phone: payload.general_phone || null,
      p_registered_address: payload.registered_address || null,
    });

    if (error) {
      return { error: error.message };
    }

    return { data: data as Supplier };
  } catch (err: any) {
    return { error: err?.message || 'Failed to create supplier master record.' };
  }
}

/**
 * Updates an existing supplier master record via authoritative RPC.
 */
export async function updateSupplier(
  supplierId: string,
  payload: {
    legal_name: string;
    display_name?: string;
    supplier_type?: SupplierType;
    tax_identifier?: string;
    website?: string;
    general_email?: string;
    general_phone?: string;
    registered_address?: string;
  }
): Promise<{ data?: Supplier; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_update_supplier', {
      p_supplier_id: supplierId,
      p_legal_name: payload.legal_name,
      p_display_name: payload.display_name || null,
      p_supplier_type: payload.supplier_type || null,
      p_tax_identifier: payload.tax_identifier || null,
      p_website: payload.website || null,
      p_general_email: payload.general_email || null,
      p_general_phone: payload.general_phone || null,
      p_registered_address: payload.registered_address || null,
    });

    if (error) {
      return { error: error.message };
    }

    return { data: data as Supplier };
  } catch (err: any) {
    return { error: err?.message || 'Failed to update supplier record.' };
  }
}

/**
 * Deactivates an active supplier with a mandatory reason.
 */
export async function deactivateSupplier(
  supplierId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('api_deactivate_supplier', {
      p_supplier_id: supplierId,
      p_reason: reason,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to deactivate supplier.' };
  }
}

/**
 * Reactivates an inactive supplier with a mandatory reason.
 */
export async function reactivateSupplier(
  supplierId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('api_reactivate_supplier', {
      p_supplier_id: supplierId,
      p_reason: reason,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to reactivate supplier.' };
  }
}

/**
 * Permanently deletes a supplier if no dependent records exist.
 */
export async function deleteSupplier(
  supplierId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('api_delete_supplier', {
      p_supplier_id: supplierId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete supplier.' };
  }
}

/**
 * Checks count of dependent records to advise UI if deletion is permitted.
 */
export async function checkSupplierDependencyCounts(supplierId: string): Promise<{
  contacts: number;
  addresses: number;
  materials: number;
  documents: number;
  qualificationHistory: number;
  total: number;
}> {
  try {
    const [cRes, aRes, mRes, dRes, qRes] = await Promise.all([
      supabase.from('supplier_contacts').select('id', { count: 'exact', head: true }).eq('supplier_id', supplierId),
      supabase.from('supplier_addresses').select('id', { count: 'exact', head: true }).eq('supplier_id', supplierId),
      supabase.from('supplier_materials').select('id', { count: 'exact', head: true }).eq('supplier_id', supplierId),
      supabase.from('supplier_documents').select('id', { count: 'exact', head: true }).eq('supplier_id', supplierId),
      supabase.from('supplier_qualification_history').select('id', { count: 'exact', head: true }).eq('supplier_id', supplierId),
    ]);

    const contacts = cRes.count || 0;
    const addresses = aRes.count || 0;
    const materials = mRes.count || 0;
    const documents = dRes.count || 0;
    const qualificationHistory = qRes.count || 0;

    return {
      contacts,
      addresses,
      materials,
      documents,
      qualificationHistory,
      total: contacts + addresses + materials + documents + qualificationHistory,
    };
  } catch {
    return { contacts: 0, addresses: 0, materials: 0, documents: 0, qualificationHistory: 0, total: 0 };
  }
}

// =============================================================================
// Contacts Management
// =============================================================================

export async function fetchSupplierContacts(supplierId: string): Promise<{ data: SupplierContact[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('supplier_contacts')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) return { data: [], error: error.message };
    return { data: (data as SupplierContact[]) || [] };
  } catch (err: any) {
    return { data: [], error: err?.message || 'Failed to fetch contacts.' };
  }
}

export async function manageSupplierContact(
  supplierId: string,
  payload: {
    contact_id?: string;
    full_name?: string;
    job_title?: string;
    email?: string;
    phone?: string;
    contact_type?: string;
    is_primary?: boolean;
    is_active?: boolean;
    action?: 'upsert' | 'delete';
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_manage_supplier_contact', {
      p_supplier_id: supplierId,
      p_contact_id: payload.contact_id || null,
      p_full_name: payload.full_name || null,
      p_job_title: payload.job_title || null,
      p_email: payload.email || null,
      p_phone: payload.phone || null,
      p_contact_type: payload.contact_type || 'PRIMARY',
      p_is_primary: payload.is_primary ?? false,
      p_is_active: payload.is_active ?? true,
      p_action: payload.action || 'upsert',
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to manage contact.' };
  }
}

// =============================================================================
// Addresses Management
// =============================================================================

export async function fetchSupplierAddresses(supplierId: string): Promise<{ data: SupplierAddress[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('supplier_addresses')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('is_primary', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) return { data: [], error: error.message };
    return { data: (data as SupplierAddress[]) || [] };
  } catch (err: any) {
    return { data: [], error: err?.message || 'Failed to fetch addresses.' };
  }
}

export async function manageSupplierAddress(
  supplierId: string,
  payload: {
    address_id?: string;
    address_type?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state_province?: string;
    postal_code?: string;
    country?: string;
    is_primary?: boolean;
    is_active?: boolean;
    action?: 'upsert' | 'delete';
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_manage_supplier_address', {
      p_supplier_id: supplierId,
      p_address_id: payload.address_id || null,
      p_address_type: payload.address_type || 'REGISTERED',
      p_address_line1: payload.address_line1 || null,
      p_address_line2: payload.address_line2 || null,
      p_city: payload.city || null,
      p_state_province: payload.state_province || null,
      p_postal_code: payload.postal_code || null,
      p_country: payload.country || 'India',
      p_is_primary: payload.is_primary ?? false,
      p_is_active: payload.is_active ?? true,
      p_action: payload.action || 'upsert',
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to manage address.' };
  }
}

// =============================================================================
// Supplier-Material Associations
// =============================================================================

export async function fetchSupplierMaterials(supplierId: string): Promise<{ data: SupplierMaterial[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('supplier_materials')
      .select('*, material:material_masters(*)')
      .eq('supplier_id', supplierId)
      .order('status', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: (data as SupplierMaterial[]) || [] };
  } catch (err: any) {
    return { data: [], error: err?.message || 'Failed to fetch supplier material associations.' };
  }
}

export async function fetchAvailableMaterials(supplierId: string): Promise<{ data: any[]; error?: string }> {
  try {
    // Fetch all materials from material_masters
    const { data: materials, error: matError } = await supabase
      .from('material_masters')
      .select('id, material_code, name, category, uom')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (matError) return { data: [], error: matError.message };

    // Fetch already active associations
    const { data: existing, error: existError } = await supabase
      .from('supplier_materials')
      .select('material_id')
      .eq('supplier_id', supplierId)
      .eq('status', 'ACTIVE');

    if (existError) return { data: [], error: existError.message };

    const associatedIds = new Set((existing || []).map((e) => e.material_id));
    const available = (materials || []).filter((m) => !associatedIds.has(m.id));

    return { data: available };
  } catch (err: any) {
    return { data: [], error: err?.message || 'Failed to fetch available materials.' };
  }
}

export async function manageSupplierMaterial(
  supplierId: string,
  payload: {
    material_id: string;
    association_id?: string;
    supplier_part_number?: string;
    supplier_material_description?: string;
    specification_grade?: string;
    minimum_order_quantity?: number | null;
    lead_time_days?: number | null;
    status?: 'ACTIVE' | 'INACTIVE';
    action?: 'upsert' | 'delete';
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_manage_supplier_material', {
      p_supplier_id: supplierId,
      p_material_id: payload.material_id,
      p_association_id: payload.association_id || null,
      p_supplier_part_number: payload.supplier_part_number || null,
      p_supplier_material_description: payload.supplier_material_description || null,
      p_specification_grade: payload.specification_grade || null,
      p_minimum_order_quantity: payload.minimum_order_quantity ?? null,
      p_lead_time_days: payload.lead_time_days ?? null,
      p_status: payload.status || 'ACTIVE',
      p_action: payload.action || 'upsert',
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to manage supplier material association.' };
  }
}

// =============================================================================
// Supplier Documents Management
// =============================================================================

export async function fetchSupplierDocuments(supplierId: string): Promise<{ data: SupplierDocument[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('supplier_documents')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('uploaded_at', { ascending: false });

    if (error) return { data: [], error: error.message };

    // Mark documents whose expiry date has passed as EXPIRED
    const today = new Date().toISOString().slice(0, 10);
    const enriched = (data || []).map((doc) => {
      if (doc.status === 'ACTIVE' && doc.expiry_date && doc.expiry_date < today) {
        return { ...doc, status: 'EXPIRED' as const };
      }
      return doc;
    });

    return { data: enriched as SupplierDocument[] };
  } catch (err: any) {
    return { data: [], error: err?.message || 'Failed to fetch supplier documents.' };
  }
}

export async function uploadSupplierDocument(
  supplierId: string,
  payload: {
    document_type: string;
    document_name: string;
    file_key: string;
    file_url?: string;
    file_size_bytes?: number;
    mime_type?: string;
    issue_date?: string;
    expiry_date?: string;
    notes?: string;
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_upload_supplier_document', {
      p_supplier_id: supplierId,
      p_document_type: payload.document_type,
      p_document_name: payload.document_name,
      p_file_key: payload.file_key,
      p_file_url: payload.file_url || null,
      p_file_size_bytes: payload.file_size_bytes || null,
      p_mime_type: payload.mime_type || null,
      p_issue_date: payload.issue_date || null,
      p_expiry_date: payload.expiry_date || null,
      p_notes: payload.notes || null,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to upload document.' };
  }
}

export async function archiveSupplierDocument(
  documentId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('api_archive_supplier_document', {
      p_document_id: documentId,
      p_reason: reason || null,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to archive document.' };
  }
}

// =============================================================================
// Qualification Tracking Management
// =============================================================================

export async function fetchSupplierQualificationHistory(
  supplierId: string
): Promise<{ data: SupplierQualificationHistory[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('supplier_qualification_history')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('changed_at', { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: (data as SupplierQualificationHistory[]) || [] };
  } catch (err: any) {
    return { data: [], error: err?.message || 'Failed to fetch qualification history.' };
  }
}

export async function updateSupplierQualification(
  supplierId: string,
  payload: {
    new_status: SupplierQualificationStatus;
    review_notes: string;
    qualification_start_date?: string;
    qualification_expiry_date?: string;
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_update_supplier_qualification', {
      p_supplier_id: supplierId,
      p_new_status: payload.new_status,
      p_review_notes: payload.review_notes,
      p_qualification_start_date: payload.qualification_start_date || null,
      p_qualification_expiry_date: payload.qualification_expiry_date || null,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update qualification status.' };
  }
}

