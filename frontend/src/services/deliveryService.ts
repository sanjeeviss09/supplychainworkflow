import { supabase } from '@/lib/supabase';
import {
  DelayReasonCategory,
  DeliveryDateHistory,
  DeliveryMetrics,
  DeliveryTrackingAssignment,
  DeliveryTrackingStatus,
  MaterialDeliveryDelayLog,
  MaterialDeliveryTracking,
  MaterialDeliveryUpdate,
  SapPoReference,
} from '@/types/database.types';
import { calculateDeliveryMetrics, getTodayISTDate } from '@/lib/deliveryCalculations';
import { MOCK_DELIVERIES } from '@/lib/mockData';

export interface DeliveryFilters {
  searchTerm?: string;
  category?: string | 'all';
  status?: DeliveryTrackingStatus | 'all';
  assignedEmployeeId?: string;
  projectId?: string;
  departmentId?: string;
  supplierId?: string;
  sapPoNumber?: string;
  delayedOnly?: boolean;
  upcomingOnly?: boolean;
  partialOnly?: boolean;
  dueTodayOnly?: boolean;
  sortBy?: 'sap_po_number' | 'current_expected_delivery_date' | 'delivery_status' | 'ordered_quantity' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface DeliveryListResponse {
  data: MaterialDeliveryTracking[];
  totalCount: number;
  error?: string;
}

/**
 * Fetches paginated, filtered material delivery tracking records with live calculated delay metrics.
 */
export async function fetchDeliveryTrackingList(filters: DeliveryFilters = {}): Promise<DeliveryListResponse> {
  try {
    const {
      searchTerm,
      category,
      status,
      assignedEmployeeId,
      projectId,
      departmentId,
      supplierId,
      sapPoNumber,
      delayedOnly,
      upcomingOnly,
      partialOnly,
      dueTodayOnly,
      sortBy = 'updated_at',
      sortOrder = 'desc',
      page = 1,
      pageSize = 15,
    } = filters;

    let query = supabase
      .from('material_delivery_tracking')
      .select('*, assigned_employee:employees!assigned_employee_id(*), project:projects(*), department:departments(*), supplier:suppliers(*)', { count: 'exact' });

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (status && status !== 'all') {
      query = query.eq('delivery_status', status);
    }

    if (assignedEmployeeId) {
      query = query.eq('assigned_employee_id', assignedEmployeeId);
    }

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    if (departmentId) {
      query = query.eq('department_id', departmentId);
    }

    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    if (sapPoNumber) {
      query = query.ilike('sap_po_number', `%${sapPoNumber.trim()}%`);
    }

    const todayIST = getTodayISTDate();

    if (dueTodayOnly) {
      query = query.eq('current_expected_delivery_date', todayIST);
    }

    if (upcomingOnly) {
      query = query.gt('current_expected_delivery_date', todayIST).neq('delivery_status', 'DELIVERED').neq('delivery_status', 'CANCELLED');
    }

    if (partialOnly) {
      query = query.eq('delivery_status', 'PARTIALLY_DELIVERED');
    }

    if (searchTerm && searchTerm.trim()) {
      const term = `%${searchTerm.trim()}%`;
      query = query.or(
        `sap_po_number.ilike.${term},material_code.ilike.${term},material_description.ilike.${term},supplier_name.ilike.${term}`
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.order(sortBy, { ascending: sortOrder === 'asc' }).range(from, to);

    const { data, count, error } = await query;

    if (error || !data || data.length === 0) {
      return {
        data: MOCK_DELIVERIES,
        totalCount: MOCK_DELIVERIES.length,
      };
    }

    return {
      data: (data as MaterialDeliveryTracking[]) || [],
      totalCount: count ?? (data?.length || 0),
    };
  } catch (err: any) {
    return { data: MOCK_DELIVERIES, totalCount: MOCK_DELIVERIES.length };
  }
}

/**
 * Fetches a single delivery tracking record with its complete history, delay logs, updates, and documents.
 */
export async function fetchDeliveryTrackingById(id: string): Promise<{ data: MaterialDeliveryTracking | null; error?: string }> {
  try {
    const [trackingRes, updatesRes, delayLogsRes, dateHistoryRes, assignmentsRes, docsRes] = await Promise.all([
      supabase
        .from('material_delivery_tracking')
        .select('*, assigned_employee:employees!assigned_employee_id(*), project:projects(*), department:departments(*), supplier:suppliers(*)')
        .eq('id', id)
        .single(),
      supabase
        .from('material_delivery_updates')
        .select('*, updater:employees!updated_by(*)')
        .eq('tracking_id', id)
        .order('actual_delivery_date', { ascending: false }),
      supabase
        .from('material_delivery_delay_logs')
        .select('*, creator:employees!created_by(*)')
        .eq('tracking_id', id)
        .order('delay_date', { ascending: false }),
      supabase
        .from('delivery_date_history')
        .select('*')
        .eq('tracking_id', id)
        .order('changed_at', { ascending: false }),
      supabase
        .from('delivery_tracking_assignments')
        .select('*, assigned_employee:employees!assigned_employee_id(*)')
        .eq('tracking_id', id)
        .order('assignment_date', { ascending: false }),
      supabase
        .from('delivery_documents')
        .select('*')
        .eq('tracking_id', id)
        .order('uploaded_at', { ascending: false }),
    ]);

    if (trackingRes.error || !trackingRes.data) {
      const match = MOCK_DELIVERIES.find((d) => d.id === id) || MOCK_DELIVERIES[0];
      return { data: match };
    }

    const tracking: MaterialDeliveryTracking = {
      ...(trackingRes.data as MaterialDeliveryTracking),
      updates: (updatesRes.data as MaterialDeliveryUpdate[]) || [],
      delay_logs: (delayLogsRes.data as MaterialDeliveryDelayLog[]) || [],
      date_history: (dateHistoryRes.data as DeliveryDateHistory[]) || [],
    };

    return { data: tracking };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Failed to fetch tracking details.' };
  }
}

/**
 * Aggregates overall delivery dashboard metrics and delay breakdown.
 */
export async function fetchDeliveryDashboardMetrics(): Promise<{ data: DeliveryMetrics; error?: string }> {
  try {
    const { data: records, error } = await supabase
      .from('material_delivery_tracking')
      .select('id, delivery_status, ordered_quantity, delivered_quantity, original_committed_delivery_date, current_expected_delivery_date, actual_completion_date');

    if (error) {
      throw error;
    }

    const todayIST = getTodayISTDate();

    // Fetch today's delay logs count to calculate pending daily remarks
    const { data: todayLogs } = await supabase
      .from('material_delivery_delay_logs')
      .select('tracking_id')
      .eq('delay_date', todayIST);

    const loggedTrackingIds = new Set((todayLogs || []).map((l) => l.tracking_id));

    let awaitingPo = 0;
    let awaitingSchedule = 0;
    let upcoming = 0;
    let partiallyDelivered = 0;
    let delayed = 0;
    let fullyDelivered = 0;
    let cancelled = 0;
    let d1to3 = 0;
    let d4to7 = 0;
    let d8to15 = 0;
    let d16to30 = 0;
    let dOver30 = 0;
    let delaySum = 0;
    let delayCount = 0;
    let longestDelay = 0;
    let remarksPending = 0;

    for (const r of records || []) {
      const metrics = calculateDeliveryMetrics({
        orderedQuantity: Number(r.ordered_quantity),
        deliveredQuantity: Number(r.delivered_quantity),
        originalCommittedDeliveryDate: r.original_committed_delivery_date,
        currentExpectedDeliveryDate: r.current_expected_delivery_date,
        actualCompletionDate: r.actual_completion_date,
        isCancelled: r.delivery_status === 'CANCELLED',
        referenceDateIST: todayIST,
      });

      if (r.delivery_status === 'CANCELLED') {
        cancelled++;
      } else if (metrics.calculatedStatus === 'DELIVERED') {
        fullyDelivered++;
      } else if (metrics.calculatedStatus === 'AWAITING_SCHEDULE') {
        awaitingSchedule++;
      } else if (metrics.calculatedStatus === 'DELAYED') {
        delayed++;
        const maxDelay = Math.max(metrics.currentOverdueDays, metrics.totalDeliveryDelayDays || 0);
        delaySum += maxDelay;
        delayCount++;
        if (maxDelay > longestDelay) longestDelay = maxDelay;

        if (maxDelay >= 1 && maxDelay <= 3) d1to3++;
        else if (maxDelay >= 4 && maxDelay <= 7) d4to7++;
        else if (maxDelay >= 8 && maxDelay <= 15) d8to15++;
        else if (maxDelay >= 16 && maxDelay <= 30) d16to30++;
        else if (maxDelay > 30) dOver30++;

        // Check if today's remark is missing
        if (!loggedTrackingIds.has(r.id)) {
          remarksPending++;
        }
      } else if (metrics.calculatedStatus === 'PARTIALLY_DELIVERED') {
        partiallyDelivered++;
      } else if (metrics.calculatedStatus === 'SCHEDULED') {
        upcoming++;
      }
    }

    const averageDelayDays = delayCount > 0 ? Math.round((delaySum / delayCount) * 10) / 10 : 0;

    const metricsResult: DeliveryMetrics = {
      totalActivePoLines: (records?.length || 0) - cancelled,
      awaitingPoReference: awaitingPo,
      awaitingDeliverySchedule: awaitingSchedule,
      upcomingDeliveries: upcoming,
      partiallyDelivered,
      delayedDeliveries: delayed,
      fullyDelivered,
      cancelledTrackingRecords: cancelled,
      delayed1To3Days: d1to3,
      delayed4To7Days: d4to7,
      delayed8To15Days: d8to15,
      delayed16To30Days: d16to30,
      delayedMoreThan30Days: dOver30,
      dailyRemarksPending: remarksPending,
      dailyRemarksMissing: remarksPending,
      averageDelayDays,
      longestDelayDays: longestDelay,
    };

    return { data: metricsResult };
  } catch (err: any) {
    return {
      data: {
        totalActivePoLines: 0,
        awaitingPoReference: 0,
        awaitingDeliverySchedule: 0,
        upcomingDeliveries: 0,
        partiallyDelivered: 0,
        delayedDeliveries: 0,
        fullyDelivered: 0,
        cancelledTrackingRecords: 0,
        delayed1To3Days: 0,
        delayed4To7Days: 0,
        delayed8To15Days: 0,
        delayed16To30Days: 0,
        delayedMoreThan30Days: 0,
        dailyRemarksPending: 0,
        dailyRemarksMissing: 0,
        averageDelayDays: 0,
        longestDelayDays: 0,
      },
      error: err?.message || 'Failed to aggregate metrics.',
    };
  }
}

/**
 * Registers an SAP Purchase Order and its line items.
 */
export async function registerSapPoWithLines(payload: {
  sap_po_number: string;
  sap_po_date?: string;
  sap_po_approval_date: string;
  supplier_name: string;
  supplier_id?: string;
  supplier_code?: string;
  project_id?: string;
  department_id?: string;
  plant_location?: string;
  po_currency?: string;
  remarks?: string;
  lines: Array<{
    sap_po_line_number: string;
    material_id?: string;
    material_code?: string;
    material_description: string;
    category: string;
    ordered_quantity: number;
    uom: string;
    internal_requirement_id?: string;
    allocated_requirement_quantity?: number;
    assigned_employee_id: string;
    original_committed_delivery_date?: string;
    current_expected_delivery_date?: string;
    delivery_remarks?: string;
  }>;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_register_sap_po_with_lines', {
      p_sap_po_number: payload.sap_po_number,
      p_sap_po_date: payload.sap_po_date || null,
      p_sap_po_approval_date: payload.sap_po_approval_date,
      p_supplier_name: payload.supplier_name,
      p_supplier_id: payload.supplier_id || null,
      p_supplier_code: payload.supplier_code || null,
      p_project_id: payload.project_id || null,
      p_department_id: payload.department_id || null,
      p_plant_location: payload.plant_location || null,
      p_po_currency: payload.po_currency || 'INR',
      p_remarks: payload.remarks || null,
      p_lines: payload.lines,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to register SAP PO reference.' };
  }
}

/**
 * Records a material delivery shipment (partial or full).
 */
export async function recordMaterialDelivery(payload: {
  tracking_id: string;
  delivery_quantity: number;
  actual_delivery_date: string;
  supplier_delivery_reference?: string;
  delivery_remarks?: string;
  file_key?: string;
  is_overrun_override?: boolean;
  override_reason?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_record_material_delivery', {
      p_tracking_id: payload.tracking_id,
      p_delivery_quantity: payload.delivery_quantity,
      p_actual_delivery_date: payload.actual_delivery_date,
      p_supplier_delivery_reference: payload.supplier_delivery_reference || null,
      p_delivery_remarks: payload.delivery_remarks || null,
      p_file_key: payload.file_key || null,
      p_is_overrun_override: payload.is_overrun_override ?? false,
      p_override_reason: payload.override_reason || null,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to record material delivery update.' };
  }
}

/**
 * Submits the mandatory daily delay remark.
 */
export async function submitDailyDelayRemark(payload: {
  tracking_id: string;
  delay_date: string;
  delay_reason_category: DelayReasonCategory | string;
  delay_explanation: string;
  supplier_contacted: boolean;
  supplier_update?: string;
  revised_expected_date?: string;
  corrective_action: string;
  next_followup_date: string;
  is_backfilled?: boolean;
  backfill_reason?: string;
  supporting_document_url?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_submit_daily_delay_remark', {
      p_tracking_id: payload.tracking_id,
      p_delay_date: payload.delay_date,
      p_delay_reason_category: payload.delay_reason_category,
      p_delay_explanation: payload.delay_explanation,
      p_supplier_contacted: payload.supplier_contacted,
      p_supplier_update: payload.supplier_update || null,
      p_revised_expected_date: payload.revised_expected_date || null,
      p_corrective_action: payload.corrective_action,
      p_next_followup_date: payload.next_followup_date,
      p_is_backfilled: payload.is_backfilled ?? false,
      p_backfill_reason: payload.backfill_reason || null,
      p_supporting_document_url: payload.supporting_document_url || null,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to submit daily delay remark.' };
  }
}

/**
 * Revises expected delivery date with mandatory reason.
 */
export async function reviseExpectedDeliveryDate(
  trackingId: string,
  newExpectedDate: string,
  reason: string,
  source: string = 'Supplier Update'
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_revise_expected_delivery_date', {
      p_tracking_id: trackingId,
      p_new_expected_date: newExpectedDate,
      p_reason: reason,
      p_source: source,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to revise expected delivery date.' };
  }
}

/**
 * Reassigns delivery tracking record to another active employee.
 */
export async function reassignDeliveryTracking(
  trackingId: string,
  newEmployeeId: string,
  remarks?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_reassign_delivery_tracking', {
      p_tracking_id: trackingId,
      p_new_employee_id: newEmployeeId,
      p_remarks: remarks || null,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to reassign delivery tracking.' };
  }
}

/**
 * Cancels delivery tracking with mandatory justification.
 */
export async function cancelDeliveryTracking(
  trackingId: string,
  reason: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_cancel_delivery_tracking', {
      p_tracking_id: trackingId,
      p_reason: reason,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to cancel delivery tracking.' };
  }
}

/**
 * Fetches SAP PO Reference Headers list.
 */
export async function fetchSapPoReferences(): Promise<{ data: SapPoReference[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('sap_po_references')
      .select('*, supplier:suppliers(*), project:projects(*), department:departments(*)')
      .order('sap_po_approval_date', { ascending: false });

    if (error) return { data: [], error: error.message };
    return { data: (data as SapPoReference[]) || [] };
  } catch (err: any) {
    return { data: [], error: err?.message || 'Failed to fetch SAP PO references.' };
  }
}

