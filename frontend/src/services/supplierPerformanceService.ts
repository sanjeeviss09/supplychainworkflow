import { supabase } from '@/lib/supabase';
import {
  MaterialDeliveryTracking,
  SupplierPerformanceAnalyticsResult,
  SupplierScorecardItem,
} from '@/types/database.types';
import {
  calculateDeliveryMetrics,
  getTodayISTDate,
} from '@/lib/deliveryCalculations';

export interface PerformanceFilterParams {
  startDate?: string | null;
  endDate?: string | null;
  supplierId?: string | null;
  category?: string | null;
}

/**
 * Fetches authoritative supplier performance analytics summary from database RPC
 * with fallback to client-side evaluation if RPC is unavailable.
 */
export async function fetchSupplierPerformanceAnalytics(
  filters: PerformanceFilterParams
): Promise<{ data: SupplierPerformanceAnalyticsResult | null; error?: string }> {
  try {
    // 1. Try server-side analytical RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'api_get_supplier_performance_analytics',
      {
        p_start_date: filters.startDate || null,
        p_end_date: filters.endDate || null,
        p_supplier_id: filters.supplierId || null,
        p_category: filters.category || null,
      }
    );

    if (!rpcError && rpcData) {
      return { data: rpcData as SupplierPerformanceAnalyticsResult };
    }

    // 2. Client-side fallback if RPC is executing against older migration
    const todayIST = getTodayISTDate();
    let query = supabase
      .from('material_delivery_tracking')
      .select('*, assigned_employee:employees!assigned_employee_id(id, full_name, employee_id)')
      .neq('delivery_status', 'CANCELLED');

    if (filters.supplierId) {
      query = query.eq('supplier_id', filters.supplierId);
    }
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.startDate) {
      query = query.gte('original_committed_delivery_date', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('original_committed_delivery_date', filters.endDate);
    }

    const { data: lines, error: linesError } = await query;
    if (linesError) {
      return { data: null, error: linesError.message };
    }

    const trackingRows = (lines as MaterialDeliveryTracking[]) || [];

    // Aggregate client-side
    const supplierMap = new Map<string, SupplierScorecardItem>();
    const categoryMap = new Map<string, { total: number; onTime: number; delayed: number; missing: number }>();
    const today = todayIST;

    let totalDelivered = 0;
    let totalOnTime = 0;
    let totalLate = 0;
    let totalOverdue = 0;
    let totalPartial = 0;
    let totalMissingCommitment = 0;
    const finalDelays: number[] = [];
    const currentDelays: number[] = [];

    trackingRows.forEach((row) => {
      const metrics = calculateDeliveryMetrics({
        orderedQuantity: Number(row.ordered_quantity),
        deliveredQuantity: Number(row.delivered_quantity),
        originalCommittedDeliveryDate: row.original_committed_delivery_date,
        currentExpectedDeliveryDate: row.current_expected_delivery_date,
        actualCompletionDate: row.actual_completion_date,
        referenceDateIST: today,
      });

      const isDelivered = Number(row.delivered_quantity) >= Number(row.ordered_quantity);
      const hasCommitment = Boolean(row.original_committed_delivery_date);
      const isLateDelivered =
        isDelivered && hasCommitment && metrics.totalDeliveryDelayDays !== null && metrics.totalDeliveryDelayDays > 0;
      const isOnTimeDelivered =
        isDelivered && hasCommitment && (metrics.totalDeliveryDelayDays === 0 || metrics.totalDeliveryDelayDays === null);
      const isOverdueOutstanding = !isDelivered && metrics.isOverdue;

      if (!hasCommitment) totalMissingCommitment++;
      if (isDelivered) totalDelivered++;
      if (isOnTimeDelivered) totalOnTime++;
      if (isLateDelivered) {
        totalLate++;
        if (metrics.totalDeliveryDelayDays) finalDelays.push(metrics.totalDeliveryDelayDays);
      }
      if (isOverdueOutstanding) {
        totalOverdue++;
        if (metrics.totalDeliveryDelayDays) currentDelays.push(metrics.totalDeliveryDelayDays);
      }
      if (!isDelivered && Number(row.delivered_quantity) > 0) totalPartial++;

      // Supplier Scorecard group
      const suppId = row.supplier_id || 'unknown';
      const suppName = row.supplier_name || 'Unknown Supplier';

      if (!supplierMap.has(suppId)) {
        supplierMap.set(suppId, {
          supplier_id: suppId,
          supplier_name: suppName,
          total_lines: 0,
          evaluable_lines: 0,
          missing_commitment_count: 0,
          on_time_delivered_lines: 0,
          late_delivered_lines: 0,
          overdue_outstanding_lines: 0,
          partial_delivery_lines: 0,
          total_outstanding_quantity: 0,
          on_time_percentage: 0,
          avg_final_delay_days_late: 0,
          max_final_delay_days: 0,
          avg_current_delay_days_overdue: 0,
        });
      }

      const item = supplierMap.get(suppId)!;
      item.total_lines++;
      item.total_outstanding_quantity += metrics.outstandingQuantity;
      if (!hasCommitment) {
        item.missing_commitment_count++;
      } else {
        item.evaluable_lines++;
        if (isOnTimeDelivered) item.on_time_delivered_lines++;
        if (isLateDelivered) {
          item.late_delivered_lines++;
          item.max_final_delay_days = Math.max(item.max_final_delay_days, metrics.totalDeliveryDelayDays || 0);
        }
        if (isOverdueOutstanding) item.overdue_outstanding_lines++;
      }
      if (!isDelivered && Number(row.delivered_quantity) > 0) item.partial_delivery_lines++;

      // Category breakdown
      const cat = row.category || 'API';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { total: 0, onTime: 0, delayed: 0, missing: 0 });
      }
      const c = categoryMap.get(cat)!;
      c.total++;
      if (!hasCommitment) c.missing++;
      else if (isOnTimeDelivered) c.onTime++;
      else if (isLateDelivered || isOverdueOutstanding) c.delayed++;
    });

    const scorecards = Array.from(supplierMap.values()).map((s) => ({
      ...s,
      on_time_percentage:
        s.evaluable_lines > 0 ? Math.round((s.on_time_delivered_lines / s.evaluable_lines) * 1000) / 10 : 0,
    }));

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([cat, c]) => ({
      category: cat,
      total_lines: c.total,
      on_time_lines: c.onTime,
      delayed_lines: c.delayed,
      missing_commitment_count: c.missing,
      on_time_percentage:
        c.total - c.missing > 0 ? Math.round((c.onTime / (c.total - c.missing)) * 1000) / 10 : 0,
    }));

    const evaluableCount = trackingRows.length - totalMissingCommitment;
    const overallRate =
      evaluableCount > 0 ? Math.round((totalOnTime / evaluableCount) * 1000) / 10 : 0;

    const avgFinal =
      finalDelays.length > 0
        ? Math.round((finalDelays.reduce((a, b) => a + b, 0) / finalDelays.length) * 10) / 10
        : 0;
    const maxFinal = finalDelays.length > 0 ? Math.max(...finalDelays) : 0;
    const avgCurrent =
      currentDelays.length > 0
        ? Math.round((currentDelays.reduce((a, b) => a + b, 0) / currentDelays.length) * 10) / 10
        : 0;

    return {
      data: {
        as_of_date_ist: todayIST,
        filters: {
          start_date: filters.startDate,
          end_date: filters.endDate,
          supplier_id: filters.supplierId,
          category: filters.category,
        },
        overall_summary: {
          total_lines: trackingRows.length,
          total_delivered_lines: totalDelivered,
          total_on_time_lines: totalOnTime,
          total_late_completed_lines: totalLate,
          total_overdue_outstanding_lines: totalOverdue,
          total_partial_lines: totalPartial,
          total_missing_commitment_lines: totalMissingCommitment,
          on_time_delivery_rate: overallRate,
          avg_final_delay_days: avgFinal,
          max_final_delay_days: maxFinal,
          avg_current_delay_days: avgCurrent,
        },
        supplier_scorecards: scorecards,
        category_breakdown: categoryBreakdown,
        delay_reasons_breakdown: [],
      },
    };
  } catch (err: any) {
    console.error('fetchSupplierPerformanceAnalytics error:', err);
    return { data: null, error: err?.message || 'Failed to fetch supplier performance data.' };
  }
}

/**
 * Fetches the underlying PO line details for drill-down into a specific supplier's score.
 */
export async function fetchSupplierDrillDownLines(params: {
  supplierId: string;
  category?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}): Promise<{ data: MaterialDeliveryTracking[] | null; error?: string }> {
  try {
    let query = supabase
      .from('material_delivery_tracking')
      .select(
        `
        *,
        assigned_employee:employees!assigned_employee_id(id, full_name, employee_id),
        delivery_updates:material_delivery_updates(*),
        delay_logs:material_delivery_delay_logs(*)
      `
      )
      .eq('supplier_id', params.supplierId)
      .neq('delivery_status', 'CANCELLED');

    if (params.category) {
      query = query.eq('category', params.category);
    }
    if (params.startDate) {
      query = query.gte('original_committed_delivery_date', params.startDate);
    }
    if (params.endDate) {
      query = query.lte('original_committed_delivery_date', params.endDate);
    }

    const { data, error } = await query.order('sap_po_number', { ascending: true });
    if (error) {
      return { data: null, error: error.message };
    }

    return { data: (data as MaterialDeliveryTracking[]) || [] };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Failed to fetch supplier drill-down lines.' };
  }
}

/**
 * Generates and downloads a clean RFC 4180 CSV export of supplier scorecards.
 */
export function exportSupplierScorecardCsv(
  result: SupplierPerformanceAnalyticsResult,
  appliedFiltersDesc: string
): void {
  const headers = [
    'Supplier Name',
    'Total PO Lines',
    'Evaluable Lines',
    'On-Time Delivered Lines',
    'Late Delivered Lines',
    'Overdue Outstanding Lines',
    'Partial Delivery Lines',
    'Missing Commitment Lines',
    'Total Outstanding Qty',
    'On-Time Delivery Rate (%)',
    'Avg Final Delay Days (Late)',
    'Max Final Delay Days',
    'Avg Current Delay Days (Overdue)',
  ];

  const rows = result.supplier_scorecards.map((s) => [
    `"${s.supplier_name.replace(/"/g, '""')}"`,
    s.total_lines,
    s.evaluable_lines,
    s.on_time_delivered_lines,
    s.late_delivered_lines,
    s.overdue_outstanding_lines,
    s.partial_delivery_lines,
    s.missing_commitment_count,
    s.total_outstanding_quantity,
    `${s.on_time_percentage}%`,
    s.avg_final_delay_days_late,
    s.max_final_delay_days,
    s.avg_current_delay_days_overdue,
  ]);

  const csvContent = [
    `# SCM FLOW — SUPPLIER DELIVERY PERFORMANCE SCORECARD`,
    `# Generated At (IST): ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
    `# Applied Filters: ${appliedFiltersDesc}`,
    `# Metric Rule: Delay calculated against Original Committed Date in calendar days (Asia/Kolkata). Missing commitments excluded from % denominator.`,
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\r\n');

  downloadCsvBlob(csvContent, `supplier_delivery_scorecard_${getTodayISTDate()}.csv`);
}

/**
 * Generates and downloads a clean RFC 4180 CSV export of underlying PO line items.
 */
export function exportSupplierLinesDetailCsv(
  lines: MaterialDeliveryTracking[],
  supplierName: string
): void {
  const headers = [
    'SAP PO Number',
    'SAP PO Line',
    'Material Code',
    'Material Description',
    'Category',
    'Ordered Qty',
    'Delivered Qty',
    'Outstanding Qty',
    'UOM',
    'Original Commitment Date',
    'Current Revised ETA',
    'Actual Completion Date',
    'Delivery Status',
    'Original Commitment Delay Days',
    'Current ETA Overdue Days',
    'Responsible Employee',
  ];

  const today = getTodayISTDate();

  const rows = lines.map((line) => {
    const metrics = calculateDeliveryMetrics({
      orderedQuantity: Number(line.ordered_quantity),
      deliveredQuantity: Number(line.delivered_quantity),
      originalCommittedDeliveryDate: line.original_committed_delivery_date,
      currentExpectedDeliveryDate: line.current_expected_delivery_date,
      actualCompletionDate: line.actual_completion_date,
      referenceDateIST: today,
    });

    return [
      `"${line.sap_po_number}"`,
      `"${line.sap_po_line_number}"`,
      `"${line.material_code || ''}"`,
      `"${(line.material_description || '').replace(/"/g, '""')}"`,
      line.category,
      line.ordered_quantity,
      line.delivered_quantity,
      metrics.outstandingQuantity,
      line.uom,
      line.original_committed_delivery_date || 'Missing',
      line.current_expected_delivery_date || '',
      line.actual_completion_date || '',
      line.delivery_status,
      metrics.totalDeliveryDelayDays !== null ? metrics.totalDeliveryDelayDays : 'Not Calculable',
      metrics.currentOverdueDays,
      `"${line.assigned_employee?.full_name || ''}"`,
    ];
  });

  const csvContent = [
    `# SCM FLOW — SUPPLIER PO LINE DELIVERY DETAIL REPORT`,
    `# Supplier: ${supplierName}`,
    `# Generated At (IST): ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\r\n');

  downloadCsvBlob(
    csvContent,
    `supplier_${supplierName.replace(/[^a-zA-Z0-9]/g, '_')}_lines_${today}.csv`
  );
}

function downloadCsvBlob(csvContent: string, fileName: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

