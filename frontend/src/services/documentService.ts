import { supabase } from '@/lib/supabase';
import {
  DocumentCategoryConfig,
  DocumentCategoryGroup,
  DocumentDashboardMetrics,
  DocumentExpiryStatus,
  DocumentReviewStatus,
  ScmDocumentRecord,
} from '@/types/database.types';
import { MOCK_DOCUMENTS } from '@/lib/mockData';
import { fastQuery } from '@/lib/asyncUtils';

export interface DocumentFilters {
  search?: string;
  categoryGroup?: string;
  categoryId?: string;
  expiryStatus?: string;
  reviewStatus?: string;
  supplierId?: string;
  materialId?: string;
  trackingId?: string;
}

/**
 * Pure TypeScript implementation of Document Expiry Status Calculation
 * Replicates the database function public.calculate_document_expiry_status identically.
 */
export function calculateDocumentExpiryStatus(
  expiryDate?: string | null,
  isArchived: boolean = false,
  isSuperseded: boolean = false,
  asOfDateStr?: string
): DocumentExpiryStatus {
  if (isArchived) return 'Archived';
  if (isSuperseded) return 'Superseded';
  if (!expiryDate) return 'No Expiry Date';

  const today = asOfDateStr ? new Date(asOfDateStr) : new Date();
  today.setHours(0, 0, 0, 0);

  const expDate = new Date(expiryDate);
  expDate.setHours(0, 0, 0, 0);

  const diffTime = expDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'Expired';
  } else if (diffDays <= 90) {
    return 'Expiring Soon';
  } else {
    return 'Active';
  }
}

/**
 * Fetch all configurable document categories
 */
export async function fetchDocumentCategories(): Promise<DocumentCategoryConfig[]> {
  try {
    const { data, error } = await supabase
      .from('document_categories_config')
      .select('*')
      .eq('is_active', true)
      .order('display_name', { ascending: true });

    if (error) {
      console.warn('Error fetching document categories:', error);
      return [];
    }

    return (data as DocumentCategoryConfig[]) || [];
  } catch (err) {
    console.warn('fetchDocumentCategories fallback:', err);
    return [];
  }
}

/**
 * Fetch central SCM documents with filters
 */
export async function fetchScmDocuments(filters: DocumentFilters = {}): Promise<ScmDocumentRecord[]> {
  try {
    let query = supabase
      .from('scm_documents')
      .select(`
        *,
        category:document_categories_config(*),
        owner:employees!scm_documents_owner_employee_id_fkey(id, full_name, employee_id),
        current_version:document_versions!scm_documents_current_version_id_fkey(*),
        links:document_links(*)
      `)
      .order('created_at', { ascending: false });

    if (filters.categoryGroup && filters.categoryGroup !== 'ALL') {
      query = query.eq('category_group', filters.categoryGroup);
    }
    if (filters.categoryId && filters.categoryId !== 'ALL') {
      query = query.eq('category_id', filters.categoryId);
    }
    if (filters.expiryStatus && filters.expiryStatus !== 'ALL') {
      query = query.eq('expiry_status', filters.expiryStatus);
    }
    if (filters.reviewStatus && filters.reviewStatus !== 'ALL') {
      query = query.eq('review_status', filters.reviewStatus);
    }

    const { data, error } = await fastQuery(query, { data: MOCK_DOCUMENTS, error: null } as any);
    if (error || !data || data.length === 0) {
      return MOCK_DOCUMENTS;
    }

    let records: ScmDocumentRecord[] = (data as ScmDocumentRecord[]) || [];

    // Filter by linked target IDs if requested
    if (filters.supplierId) {
      records = records.filter((r) =>
        r.links?.some((l) => l.link_type === 'SUPPLIER' && l.target_id === filters.supplierId)
      );
    }
    if (filters.materialId) {
      records = records.filter((r) =>
        r.links?.some((l) => l.link_type === 'MATERIAL' && l.target_id === filters.materialId)
      );
    }
    if (filters.trackingId) {
      records = records.filter((r) =>
        r.links?.some((l) => l.link_type === 'DELIVERY_TRACKING' && l.target_id === filters.trackingId)
      );
    }

    // Client-side search across multiple fields
    if (filters.search && filters.search.trim()) {
      const term = filters.search.toLowerCase().trim();
      records = records.filter(
        (r) =>
          r.document_number?.toLowerCase().includes(term) ||
          r.title?.toLowerCase().includes(term) ||
          r.document_reference_number?.toLowerCase().includes(term) ||
          r.category?.display_name?.toLowerCase().includes(term) ||
          r.links?.some((l) => l.target_reference?.toLowerCase().includes(term))
      );
    }

    return records;
  } catch (err) {
    console.warn('fetchScmDocuments fallback:', err);
    return MOCK_DOCUMENTS;
  }
}

/**
 * Fetch a single document by ID with complete versions, links, reviews, and audit events
 */
export async function fetchScmDocumentById(docId: string): Promise<ScmDocumentRecord | null> {
  try {
    const singleQuery = supabase
      .from('scm_documents')
      .select(`
        *,
        category:document_categories_config(*),
        owner:employees!scm_documents_owner_employee_id_fkey(id, full_name, employee_id),
        current_version:document_versions!scm_documents_current_version_id_fkey(*),
        versions:document_versions(*),
        links:document_links(*),
        reviews:document_reviews(*),
        events:document_events(*)
      `)
      .eq('id', docId)
      .single();

    const fallbackMatch = MOCK_DOCUMENTS.find((d) => d.id === docId) || MOCK_DOCUMENTS[0];
    const { data, error } = await fastQuery(singleQuery, { data: fallbackMatch, error: null } as any);

    if (error || !data) {
      return fallbackMatch;
    }

    const doc = data as ScmDocumentRecord;
    // Sort versions descending
    if (doc.versions) {
      doc.versions.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
    }
    // Sort reviews descending
    if (doc.reviews) {
      doc.reviews.sort((a, b) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime());
    }
    // Sort events descending
    if (doc.events) {
      doc.events.sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime());
    }

    return doc;
  } catch (err) {
    console.error('fetchScmDocumentById exception:', err);
    return null;
  }
}

/**
 * Fetch aggregate metrics for the Document Dashboard
 */
export async function fetchDocumentMetrics(): Promise<DocumentDashboardMetrics> {
  try {
    const { data, error } = await supabase
      .from('scm_documents')
      .select('id, category_group, expiry_status, review_status, expiry_date');

    if (error) {
      console.warn('fetchDocumentMetrics error:', error);
      return {
        totalDocuments: 0,
        activeDocuments: 0,
        expiringWithin90d: 0,
        expiringWithin30d: 0,
        expiredDocuments: 0,
        reviewPendingCount: 0,
        archivedCount: 0,
        categoryGroupCounts: [],
      };
    }

    const records = data || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let expiring90 = 0;
    let expiring30 = 0;

    records.forEach((r) => {
      if (r.expiry_date && r.expiry_status !== 'Archived') {
        const exp = new Date(r.expiry_date);
        exp.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 90) expiring90++;
        if (diffDays >= 0 && diffDays <= 30) expiring30++;
      }
    });

    const groups: DocumentCategoryGroup[] = ['SUPPLIER', 'MATERIAL', 'PO_DELIVERY', 'GENERAL'];
    const categoryGroupCounts = groups.map((grp) => ({
      group: grp,
      count: records.filter((r) => r.category_group === grp && r.expiry_status !== 'Archived').length,
    }));

    return {
      totalDocuments: records.length,
      activeDocuments: records.filter((r) => r.expiry_status === 'Active').length,
      expiringWithin90d: expiring90,
      expiringWithin30d: expiring30,
      expiredDocuments: records.filter((r) => r.expiry_status === 'Expired').length,
      reviewPendingCount: records.filter((r) => r.review_status === 'Pending Review').length,
      archivedCount: records.filter((r) => r.expiry_status === 'Archived').length,
      categoryGroupCounts,
    };
  } catch (err) {
    console.warn('fetchDocumentMetrics fallback:', err);
    return {
      totalDocuments: 0,
      activeDocuments: 0,
      expiringWithin90d: 0,
      expiringWithin30d: 0,
      expiredDocuments: 0,
      reviewPendingCount: 0,
      archivedCount: 0,
      categoryGroupCounts: [],
    };
  }
}

/**
 * Register a new SCM document with Version 1
 */
export async function createScmDocument(params: {
  title: string;
  categoryId: string;
  description?: string;
  documentReferenceNumber?: string;
  ownerEmployeeId?: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  isConfidential?: boolean;
  fileName: string;
  fileKey: string;
  fileSizeBytes?: number;
  mimeType?: string;
  fileChecksum?: string;
  versionNotes?: string;
  supplierId?: string;
  materialId?: string;
  trackingId?: string;
  sapPoId?: string;
  issueId?: string;
}): Promise<{ success: boolean; document_id?: string; document_number?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_create_scm_document', {
      p_title: params.title.trim(),
      p_category_id: params.categoryId,
      p_description: params.description?.trim() || null,
      p_document_reference_number: params.documentReferenceNumber?.trim() || null,
      p_owner_employee_id: params.ownerEmployeeId || null,
      p_issue_date: params.issueDate || null,
      p_expiry_date: params.expiryDate || null,
      p_is_confidential: params.isConfidential ?? false,
      p_file_name: params.fileName,
      p_file_key: params.fileKey,
      p_file_size_bytes: params.fileSizeBytes || null,
      p_mime_type: params.mimeType || 'application/pdf',
      p_file_checksum: params.fileChecksum || null,
      p_version_notes: params.versionNotes?.trim() || 'Initial document version upload',
      p_supplier_id: params.supplierId || null,
      p_material_id: params.materialId || null,
      p_tracking_id: params.trackingId || null,
      p_sap_po_id: params.sapPoId || null,
      p_issue_id: params.issueId || null,
    });

    if (error) {
      console.error('RPC api_create_scm_document error:', error);
      return { success: false, error: error.message };
    }

    return {
      success: Boolean(data?.success),
      document_id: data?.document_id,
      document_number: data?.document_number,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create SCM document.' };
  }
}

/**
 * Upload a new version for an existing SCM document
 */
export async function createDocumentVersion(params: {
  documentId: string;
  fileName: string;
  fileKey: string;
  fileSizeBytes?: number;
  mimeType?: string;
  fileChecksum?: string;
  versionNotes?: string;
}): Promise<{ success: boolean; version_id?: string; version_number?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_create_document_version', {
      p_document_id: params.documentId,
      p_file_name: params.fileName,
      p_file_key: params.fileKey,
      p_file_size_bytes: params.fileSizeBytes || null,
      p_mime_type: params.mimeType || 'application/pdf',
      p_file_checksum: params.fileChecksum || null,
      p_version_notes: params.versionNotes?.trim() || 'Updated version',
    });

    if (error) {
      console.error('RPC api_create_document_version error:', error);
      return { success: false, error: error.message };
    }

    return {
      success: Boolean(data?.success),
      version_id: data?.version_id,
      version_number: data?.version_number,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to upload new document version.' };
  }
}

/**
 * Record internal operational review verification
 */
export async function reviewScmDocument(params: {
  documentId: string;
  newReviewStatus: DocumentReviewStatus;
  remarks: string;
}): Promise<{ success: boolean; review_id?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_review_scm_document', {
      p_document_id: params.documentId,
      p_new_review_status: params.newReviewStatus,
      p_remarks: params.remarks.trim(),
    });

    if (error) {
      console.error('RPC api_review_scm_document error:', error);
      return { success: false, error: error.message };
    }

    return { success: Boolean(data?.success), review_id: data?.review_id };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to submit document review.' };
  }
}

/**
 * Archive an SCM document
 */
export async function archiveScmDocument(
  documentId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_archive_scm_document', {
      p_document_id: documentId,
      p_reason: reason.trim(),
    });

    if (error) {
      console.error('RPC api_archive_scm_document error:', error);
      return { success: false, error: error.message };
    }

    return { success: Boolean(data?.success) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to archive document.' };
  }
}

/**
 * Export SCM documents report in RFC 4180 CSV format
 */
export function exportDocumentsCsv(documents: ScmDocumentRecord[], reportTitle: string = 'SCM_Documents_Register'): void {
  const headers = [
    'Document #',
    'Title',
    'Category Group',
    'Category',
    'Reference #',
    'Current Version',
    'Expiry Status',
    'Review Status',
    'Issue Date',
    'Expiry Date',
    'Responsible Employee',
    'Confidential',
    'Created At',
  ];

  const escapeField = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = documents.map((d) => [
    escapeField(d.document_number),
    escapeField(d.title),
    escapeField(d.category_group),
    escapeField(d.category?.display_name || d.category_id),
    escapeField(d.document_reference_number || 'N/A'),
    escapeField(d.current_version_number),
    escapeField(d.expiry_status),
    escapeField(d.review_status),
    escapeField(d.issue_date || 'N/A'),
    escapeField(d.expiry_date || 'N/A'),
    escapeField(d.owner?.full_name || 'N/A'),
    escapeField(d.is_confidential ? 'YES' : 'NO'),
    escapeField(d.created_at),
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `${reportTitle}_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

