import { supabase } from '@/lib/supabase';
import {
  BusinessImpactLevel,
  MaterialCriticalityLevel,
  RiskMitigationAction,
  SupplyRiskDashboardMetrics,
  SupplyRiskEvent,
  SupplyRiskLevel,
  SupplyRiskRecord,
  SupplyRiskStatus,
} from '@/types/database.types';
import { MOCK_SUPPLY_RISKS } from '@/lib/mockData';

export interface SupplyRiskFilters {
  search?: string;
  status?: string;
  riskLevel?: string;
  category?: string;
  criticality?: string;
}

/**
 * Pure TypeScript implementation of the supply risk scoring engine
 * Replicates the database formula identically for instant UI calculation and deterministic testing.
 *
 * Factors:
 * 1. Material Criticality: Critical (+35), High (+25), Medium (+15), Low (+5)
 * 2. Business Impact: Critical (+30), High (+20), Medium (+10), Low (+0)
 * 3. Required-by Date Overrun:
 *    - Current ETA > Required-by Date (+30)
 *    - Required-by Date <= today + 3 days and balance pending (+15)
 * 4. Original Commitment Overdue: today > Original Committed Date and balance pending (+20)
 * 5. Partial Delivery Outstanding: delivered > 0 and delivered < ordered (+10)
 * 6. Active Critical Issue: Phase 9 high/critical issue open (+25)
 *
 * Thresholds:
 * - Critical: >= 70
 * - High: 45 - 69
 * - Medium: 25 - 44
 * - Low: < 25
 */
export function calculateSupplyRiskScore(
  criticality: MaterialCriticalityLevel,
  businessImpact: BusinessImpactLevel,
  requiredByDate?: string | null,
  currentExpectedDate?: string | null,
  originalCommittedDate?: string | null,
  deliveredQty: number = 0,
  orderedQty: number = 0,
  hasCriticalIssue: boolean = false,
  asOfDateStr?: string
): {
  score: number;
  level: SupplyRiskLevel;
  factors: string[];
  explanation: string;
} {
  let score = 0;
  const factors: string[] = [];

  // Parse today in IST or current local date
  const today = asOfDateStr ? new Date(asOfDateStr) : new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Material Criticality
  if (criticality === 'Critical') {
    score += 35;
    factors.push('Material Criticality is Critical (+35)');
  } else if (criticality === 'High') {
    score += 25;
    factors.push('Material Criticality is High (+25)');
  } else if (criticality === 'Medium') {
    score += 15;
    factors.push('Material Criticality is Medium (+15)');
  } else {
    score += 5;
    factors.push('Material Criticality is Low (+5)');
  }

  // 2. Business Impact
  if (businessImpact === 'Critical') {
    score += 30;
    factors.push('Operational Business Impact is Critical (+30)');
  } else if (businessImpact === 'High') {
    score += 20;
    factors.push('Operational Business Impact is High (+20)');
  } else if (businessImpact === 'Medium') {
    score += 10;
    factors.push('Operational Business Impact is Medium (+10)');
  }

  // Parse dates
  const reqDate = requiredByDate ? new Date(requiredByDate) : null;
  if (reqDate) reqDate.setHours(0, 0, 0, 0);

  const etaDate = currentExpectedDate ? new Date(currentExpectedDate) : null;
  if (etaDate) etaDate.setHours(0, 0, 0, 0);

  const origDate = originalCommittedDate ? new Date(originalCommittedDate) : null;
  if (origDate) origDate.setHours(0, 0, 0, 0);

  // 3. Required-by Date Overrun / Approaching
  if (reqDate && etaDate && etaDate.getTime() > reqDate.getTime()) {
    score += 30;
    factors.push(`Current ETA (${currentExpectedDate}) breaches Required-by Date (${requiredByDate}) (+30)`);
  } else if (reqDate && deliveredQty < orderedQty) {
    const diffDays = Math.ceil((reqDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 3) {
      score += 15;
      factors.push('Required-by Date approaching within 3 calendar days (+15)');
    }
  }

  // 4. Original Delivery Commitment Overdue
  if (origDate && today.getTime() > origDate.getTime() && deliveredQty < orderedQty) {
    score += 20;
    factors.push('Past Original Confirmed Commitment (+20)');
  }

  // 5. Partial Delivery Outstanding
  if (deliveredQty > 0 && deliveredQty < orderedQty) {
    score += 10;
    factors.push('Partial Delivery arrived with balance outstanding (+10)');
  }

  // 6. Active Phase 9 Critical Issue
  if (hasCriticalIssue) {
    score += 25;
    factors.push('Active Phase 9 Critical/High Delivery Issue/Escalation (+25)');
  }

  // Thresholds
  let level: SupplyRiskLevel;
  if (score >= 70) {
    level = 'Critical';
  } else if (score >= 45) {
    level = 'High';
  } else if (score >= 25) {
    level = 'Medium';
  } else {
    level = 'Low';
  }

  const explanation = `${level} supply risk (score: ${score}/100) identified based on ${factors.length} operational factor(s).`;

  return {
    score,
    level,
    factors,
    explanation,
  };
}

/**
 * Fetch list of supply risks with optional filters
 */
export async function fetchSupplyRisks(filters: SupplyRiskFilters = {}): Promise<SupplyRiskRecord[]> {
  try {
    let query = supabase
      .from('supply_risk_records')
      .select(`
        *,
        risk_owner:employees!supply_risk_records_risk_owner_id_fkey(id, full_name, employee_id),
        tracking:material_delivery_tracking!supply_risk_records_tracking_id_fkey(
          id, sap_po_number, sap_po_line_number, material_code, material_description,
          category, ordered_quantity, delivered_quantity, uom, delivery_status,
          original_committed_delivery_date, current_expected_delivery_date,
          material_criticality, business_impact_level, required_by_date
        )
      `)
      .order('risk_score', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters.status && filters.status !== 'ALL') {
      query = query.eq('status', filters.status);
    }
    if (filters.riskLevel && filters.riskLevel !== 'ALL') {
      query = query.eq('risk_level', filters.riskLevel);
    }
    if (filters.category && filters.category !== 'ALL') {
      query = query.eq('category', filters.category);
    }
    if (filters.criticality && filters.criticality !== 'ALL') {
      query = query.eq('material_criticality', filters.criticality);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      return MOCK_SUPPLY_RISKS;
    }

    let records: SupplyRiskRecord[] = data || [];

    if (filters.search && filters.search.trim()) {
      const term = filters.search.toLowerCase().trim();
      records = records.filter(
        (r) =>
          r.risk_number?.toLowerCase().includes(term) ||
          r.sap_po_number?.toLowerCase().includes(term) ||
          r.material_description?.toLowerCase().includes(term) ||
          r.material_code?.toLowerCase().includes(term) ||
          r.supplier_name?.toLowerCase().includes(term)
      );
    }

    return records;
  } catch (err) {
    console.warn('fetchSupplyRisks error (fallback to demo list):', err);
    return MOCK_SUPPLY_RISKS;
  }
}

/**
 * Fetch a single supply risk record with joined mitigation actions and audit history
 */
export async function fetchSupplyRiskById(riskId: string): Promise<SupplyRiskRecord | null> {
  try {
    const { data, error } = await supabase
      .from('supply_risk_records')
      .select(`
        *,
        risk_owner:employees!supply_risk_records_risk_owner_id_fkey(id, full_name, employee_id),
        tracking:material_delivery_tracking!supply_risk_records_tracking_id_fkey(
          id, sap_po_number, sap_po_line_number, material_code, material_description,
          category, ordered_quantity, delivered_quantity, uom, delivery_status,
          original_committed_delivery_date, current_expected_delivery_date,
          material_criticality, business_impact_level, required_by_date, required_by_reason
        ),
        mitigation_actions:risk_mitigation_actions(
          id, risk_id, action_title, action_description, assigned_employee_id,
          due_date, priority, status, followup_remarks, outcome, completed_at,
          created_by, created_at,
          assigned_employee:employees!risk_mitigation_actions_assigned_employee_id_fkey(id, full_name, employee_id)
        ),
        events:supply_risk_events(
          id, risk_id, event_type, old_state, new_state, change_reason, performed_by, performed_at
        )
      `)
      .eq('id', riskId)
      .single();

    if (error || !data) {
      return MOCK_SUPPLY_RISKS.find((r) => r.id === riskId) || MOCK_SUPPLY_RISKS[0];
    }

    return data as SupplyRiskRecord;
  } catch (err) {
    return MOCK_SUPPLY_RISKS.find((r) => r.id === riskId) || MOCK_SUPPLY_RISKS[0];
  }
}

/**
 * Aggregate dashboard metrics for supply risk
 */
export async function fetchSupplyRiskMetrics(): Promise<SupplyRiskDashboardMetrics> {
  try {
    const { data, error } = await supabase
      .from('supply_risk_records')
      .select('id, category, risk_level, status');

    if (error) {
      console.warn('Error fetching supply risk metrics:', error);
      return {
        totalActiveRisks: 0,
        criticalRisksCount: 0,
        highRisksCount: 0,
        mediumRisksCount: 0,
        lowRisksCount: 0,
        resolvedRisksCount: 0,
        overdueActionsCount: 0,
        categoryBreakdown: [],
      };
    }

    const records = data || [];
    const active = records.filter((r) => !['Resolved', 'Closed'].includes(r.status));
    const resolved = records.filter((r) => ['Resolved', 'Closed'].includes(r.status));

    // Overdue mitigation actions
    const todayStr = new Date().toISOString().split('T')[0];
    const { count: overdueCount } = await supabase
      .from('risk_mitigation_actions')
      .select('id', { count: 'exact', head: true })
      .lt('due_date', todayStr)
      .in('status', ['Pending', 'In Progress']);

    // Category breakdown
    const categories = ['API', 'PM', 'EXE', 'CONSUMABLE'];
    const categoryBreakdown = categories.map((cat) => {
      const catRisks = active.filter((r) => r.category === cat);
      return {
        category: cat,
        activeCount: catRisks.length,
        criticalCount: catRisks.filter((r) => r.risk_level === 'Critical').length,
      };
    });

    return {
      totalActiveRisks: active.length,
      criticalRisksCount: active.filter((r) => r.risk_level === 'Critical').length,
      highRisksCount: active.filter((r) => r.risk_level === 'High').length,
      mediumRisksCount: active.filter((r) => r.risk_level === 'Medium').length,
      lowRisksCount: active.filter((r) => r.risk_level === 'Low').length,
      resolvedRisksCount: resolved.length,
      overdueActionsCount: overdueCount || 0,
      categoryBreakdown,
    };
  } catch (err) {
    console.warn('fetchSupplyRiskMetrics fallback:', err);
    return {
      totalActiveRisks: 0,
      criticalRisksCount: 0,
      highRisksCount: 0,
      mediumRisksCount: 0,
      lowRisksCount: 0,
      resolvedRisksCount: 0,
      overdueActionsCount: 0,
      categoryBreakdown: [],
    };
  }
}

/**
 * Update PO Line Criticality and Internal Required-By Date
 * Invokes backend RPC api_update_po_line_criticality_and_required_date
 */
export async function updatePoLineCriticalityAndRequiredDate(params: {
  trackingId: string;
  criticality: MaterialCriticalityLevel;
  businessImpact: BusinessImpactLevel;
  requiredByDate?: string | null;
  reason?: string | null;
}): Promise<{ success: boolean; risk_id?: string; calculated_level?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_update_po_line_criticality_and_required_date', {
      p_tracking_id: params.trackingId,
      p_criticality: params.criticality,
      p_impact: params.businessImpact,
      p_required_by_date: params.requiredByDate || null,
      p_reason: params.reason || null,
    });

    if (error) {
      console.error('RPC api_update_po_line_criticality_and_required_date error:', error);
      return { success: false, error: error.message };
    }

    return {
      success: Boolean(data?.success),
      risk_id: data?.risk_id,
      calculated_level: data?.calculated_level,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update criticality and evaluate supply risk.' };
  }
}

/**
 * Assign a new risk mitigation action
 * Invokes backend RPC api_create_risk_mitigation_action
 */
export async function createRiskMitigationAction(params: {
  riskId: string;
  actionTitle: string;
  actionDescription: string;
  assignedEmployeeId: string;
  dueDate: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
}): Promise<{ success: boolean; action_id?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_create_risk_mitigation_action', {
      p_risk_id: params.riskId,
      p_action_title: params.actionTitle.trim(),
      p_action_description: params.actionDescription.trim(),
      p_assigned_employee_id: params.assignedEmployeeId,
      p_due_date: params.dueDate,
      p_priority: params.priority || 'Medium',
    });

    if (error) {
      console.error('RPC api_create_risk_mitigation_action error:', error);
      return { success: false, error: error.message };
    }

    return { success: Boolean(data?.success), action_id: data?.action_id };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to schedule mitigation action.' };
  }
}

/**
 * Transition risk status (Under Assessment, Mitigation Planned, Monitoring, Resolved, Closed)
 * Invokes backend RPC api_transition_supply_risk
 */
export async function transitionSupplyRisk(params: {
  riskId: string;
  newStatus: SupplyRiskStatus;
  explanation: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_transition_supply_risk', {
      p_risk_id: params.riskId,
      p_new_status: params.newStatus,
      p_explanation: params.explanation.trim(),
    });

    if (error) {
      console.error('RPC api_transition_supply_risk error:', error);
      return { success: false, error: error.message };
    }

    return { success: Boolean(data?.success) };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to transition supply risk status.' };
  }
}

/**
 * Export RFC 4180 compliant CSV of supply risks
 */
export function exportSupplyRiskCsv(risks: SupplyRiskRecord[]): void {
  const headers = [
    'Risk Number',
    'Status',
    'Risk Level',
    'Risk Score',
    'SAP PO Number',
    'PO Line',
    'Material Code',
    'Material Description',
    'Category',
    'Material Criticality',
    'Business Impact',
    'Original Committed Date',
    'Current Expected ETA',
    'Required By Date',
    'Supplier Name',
    'Identified At',
  ];

  const escapeField = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = risks.map((r) => [
    escapeField(r.risk_number),
    escapeField(r.status),
    escapeField(r.risk_level),
    escapeField(r.risk_score),
    escapeField(r.sap_po_number),
    escapeField(r.sap_po_line_number),
    escapeField(r.material_code || ''),
    escapeField(r.material_description),
    escapeField(r.category),
    escapeField(r.material_criticality),
    escapeField(r.business_impact_level),
    escapeField(r.original_committed_delivery_date || 'N/A'),
    escapeField(r.current_expected_delivery_date || 'N/A'),
    escapeField(r.required_by_date || 'N/A'),
    escapeField(r.supplier_name),
    escapeField(r.identified_at),
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `SCM_Flow_Material_Supply_Risks_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

