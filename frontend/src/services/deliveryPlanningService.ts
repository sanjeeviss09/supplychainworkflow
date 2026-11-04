import { supabase } from '@/lib/supabase';
import {
  DeliveryPlanningResult,
  DeliveryScheduleChangeRecord,
} from '@/types/database.types';
import { getTodayISTDate } from '@/lib/deliveryCalculations';

export interface PlanningScheduleFilterParams {
  startDate: string;
  endDate: string;
  supplierId?: string | null;
  category?: string | null;
  assignedEmployeeId?: string | null;
}

/**
 * Fetches authoritative delivery planning schedule, calendar days,
 * and UOM-safe workload aggregations from backend RPC.
 */
export async function fetchDeliveryPlanningSchedule(
  params: PlanningScheduleFilterParams
): Promise<{ data: DeliveryPlanningResult | null; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_get_delivery_planning_schedule', {
      p_start_date: params.startDate,
      p_end_date: params.endDate,
      p_supplier_id: params.supplierId || null,
      p_category: params.category || null,
      p_assigned_employee_id: params.assignedEmployeeId || null,
    });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: data as DeliveryPlanningResult };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Failed to load delivery planning schedule.' };
  }
}

/**
 * Fetches chronological ETA schedule revisions from delivery date history.
 */
export async function fetchDeliveryScheduleChangeHistory(params: {
  limit?: number;
  trackingId?: string;
}): Promise<{ data: DeliveryScheduleChangeRecord[]; error?: string }> {
  try {
    let query = supabase
      .from('delivery_date_history')
      .select(
        `
        *,
        changer:employees!changed_by(id, full_name, employee_id),
        tracking:material_delivery_tracking!tracking_id(
          sap_po_number,
          sap_po_line_number,
          material_description,
          supplier_name
        )
      `
      )
      .order('changed_at', { ascending: false })
      .limit(params.limit || 50);

    if (params.trackingId) {
      query = query.eq('tracking_id', params.trackingId);
    }

    const { data, error } = await query;
    if (error) {
      return { data: [], error: error.message };
    }

    return { data: (data as DeliveryScheduleChangeRecord[]) || [] };
  } catch (err: any) {
    return { data: [], error: err?.message || 'Failed to fetch schedule change history.' };
  }
}

/**
 * Generates and downloads an RFC 4180 CSV export for incoming delivery planning.
 */
export function exportDeliveryPlanningCsv(
  result: DeliveryPlanningResult,
  viewName: string,
  filterDescription: string
): void {
  const headers = [
    'Scheduled Date',
    'SAP PO Number',
    'SAP Line Number',
    'Supplier Name',
    'Material Code',
    'Material Description',
    'Category',
    'Ordered Qty',
    'Delivered Qty',
    'Outstanding Qty',
    'UOM',
    'Assigned Owner',
    'Delivery Status',
    'Original Commitment Delay Days',
    'Has Open Issue',
    'Critical Issue Flag',
  ];

  const rows: any[] = [];

  result.calendar_days.forEach((day) => {
    day.line_items.forEach((item) => {
      rows.push([
        day.date,
        `"${item.sap_po_number}"`,
        `"${item.sap_po_line_number}"`,
        `"${(item.supplier_name || '').replace(/"/g, '""')}"`,
        `"${item.material_code || ''}"`,
        `"${(item.material_description || '').replace(/"/g, '""')}"`,
        item.category,
        item.ordered_quantity,
        item.delivered_quantity,
        item.outstanding_quantity,
        item.uom,
        `"${item.assigned_employee_name || 'Unassigned'}"`,
        item.delivery_status,
        item.original_delay_days !== null ? item.original_delay_days : 'Uncommitted',
        item.has_open_issue ? 'Yes' : 'No',
        item.has_critical_issue ? 'CRITICAL' : 'No',
      ]);
    });
  });

  const uomSummaryRows = result.uom_workload_breakdown.map((u) => [
    `# SUMMARY UOM: ${u.category} [${u.uom}]`,
    `Lines: ${u.lines_count}`,
    `Ordered: ${u.ordered_qty} ${u.uom}`,
    `Delivered: ${u.delivered_qty} ${u.uom}`,
    `Outstanding: ${u.outstanding_qty} ${u.uom}`,
  ]);

  const csvContent = [
    `# SCM FLOW — INCOMING MATERIAL DELIVERY PLANNING SCHEDULE (${viewName.toUpperCase()})`,
    `# Generated At (IST): ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
    `# Date Window: ${result.window.start_date} to ${result.window.end_date}`,
    `# Applied Filters: ${filterDescription}`,
    ...uomSummaryRows.map((r) => r.join(' | ')),
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `delivery_planning_${viewName}_${getTodayISTDate()}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

