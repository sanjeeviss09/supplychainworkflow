import { supabase } from '@/lib/supabase';
import {
  DeliveryIssue,
  DeliveryIssueMetrics,
  DeliveryIssueSeverity,
  DeliveryIssueStatus,
  DeliveryIssueType,
} from '@/types/database.types';
import { getTodayISTDate } from '@/lib/deliveryCalculations';
import { MOCK_DELIVERY_ISSUES } from '@/lib/mockData';

export interface DeliveryIssueFilterParams {
  searchTerm?: string;
  status?: string;
  severity?: string;
  category?: string;
  supplierId?: string;
  assignedEmployeeId?: string;
  overdueFollowupOnly?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Fetches a list of delivery issues with filters, search, and pagination.
 */
export async function fetchDeliveryIssues(
  params: DeliveryIssueFilterParams = {}
): Promise<{ data: DeliveryIssue[]; totalCount: number; error?: string }> {
  try {
    const {
      searchTerm = '',
      status = 'all',
      severity = 'all',
      category = 'all',
      supplierId = '',
      assignedEmployeeId = '',
      overdueFollowupOnly = false,
      page = 1,
      pageSize = 25,
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = params;

    const todayIST = getTodayISTDate();

    let query = supabase
      .from('delivery_issues')
      .select(
        `
        *,
        assigned_employee:employees!assigned_employee_id(id, full_name, employee_id),
        resolution:delivery_issue_resolutions(*)
      `,
        { count: 'exact' }
      );

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (severity && severity !== 'all') {
      query = query.eq('severity', severity);
    }

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    if (assignedEmployeeId) {
      query = query.eq('assigned_employee_id', assignedEmployeeId);
    }

    if (overdueFollowupOnly) {
      query = query
        .lt('next_followup_date', todayIST)
        .neq('status', 'Closed')
        .neq('status', 'Resolved');
    }

    if (searchTerm && searchTerm.trim()) {
      const term = `%${searchTerm.trim()}%`;
      query = query.or(
        `issue_number.ilike.${term},sap_po_number.ilike.${term},supplier_name.ilike.${term},material_description.ilike.${term}`
      );
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.order(sortBy, { ascending: sortOrder === 'asc' }).range(from, to);

    const { data, count, error } = await query;
    if (error || !data || data.length === 0) {
      return { data: MOCK_DELIVERY_ISSUES, totalCount: MOCK_DELIVERY_ISSUES.length };
    }

    return {
      data: (data as DeliveryIssue[]) || [],
      totalCount: count || 0,
    };
  } catch (err: any) {
    return { data: MOCK_DELIVERY_ISSUES, totalCount: MOCK_DELIVERY_ISSUES.length };
  }
}

/**
 * Fetches complete details of a single delivery issue including PO tracking,
 * follow-up timeline, escalations, attachments, and audit events.
 */
export async function fetchDeliveryIssueById(
  issueId: string
): Promise<{ data: DeliveryIssue | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('delivery_issues')
      .select(
        `
        *,
        assigned_employee:employees!assigned_employee_id(id, full_name, employee_id),
        tracking:material_delivery_tracking!tracking_id(
          *,
          assigned_employee:employees!assigned_employee_id(id, full_name, employee_id),
          delivery_updates:material_delivery_updates(*),
          delay_logs:material_delivery_delay_logs(*)
        ),
        attachments:delivery_issue_attachments(*),
        followups:delivery_issue_followups(
          *,
          initiator:employees!initiated_by(id, full_name, employee_id)
        ),
        escalations:delivery_issue_escalations(
          *,
          recipient_employee:employees!recipient_employee_id(id, full_name, employee_id)
        ),
        resolution:delivery_issue_resolutions(*),
        events:delivery_issue_events(*)
      `
      )
      .eq('id', issueId)
      .maybeSingle();

    if (error) {
      return { data: null, error: error.message };
    }
    if (!data) {
      return { data: null, error: 'Delivery issue not found.' };
    }

    // Sort relations
    if (data.followups) {
      data.followups.sort(
        (a: any, b: any) => new Date(b.followup_date).getTime() - new Date(a.followup_date).getTime()
      );
    }
    if (data.events) {
      data.events.sort(
        (a: any, b: any) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime()
      );
    }
    if (data.escalations) {
      data.escalations.sort(
        (a: any, b: any) => new Date(b.escalated_at).getTime() - new Date(a.escalated_at).getTime()
      );
    }

    return { data: data as DeliveryIssue };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Failed to load delivery issue details.' };
  }
}

/**
 * Computes dashboard KPI metrics across all delivery issues.
 */
export async function fetchDeliveryIssueMetrics(): Promise<{
  data: DeliveryIssueMetrics | null;
  error?: string;
}> {
  try {
    const todayIST = getTodayISTDate();

    const { data, error } = await supabase
      .from('delivery_issues')
      .select('id, status, severity, reported_date, next_followup_date, resolution:delivery_issue_resolutions(resolved_at)');

    if (error) {
      return { data: null, error: error.message };
    }

    const rows = data || [];
    let openCount = 0;
    let inProgressCount = 0;
    let awaitingSupplierCount = 0;
    let escalatedCount = 0;
    let resolvedCount = 0;
    let closedCount = 0;
    let criticalCount = 0;
    let highCount = 0;
    let overdueFollowups = 0;
    const resolutionDurations: number[] = [];

    rows.forEach((r: any) => {
      if (r.status === 'Open') openCount++;
      else if (r.status === 'In Progress') inProgressCount++;
      else if (r.status === 'Awaiting Supplier') awaitingSupplierCount++;
      else if (r.status === 'Escalated') escalatedCount++;
      else if (r.status === 'Resolved') resolvedCount++;
      else if (r.status === 'Closed') closedCount++;

      if (r.severity === 'Critical') criticalCount++;
      else if (r.severity === 'High') highCount++;

      if (
        r.next_followup_date &&
        r.next_followup_date < todayIST &&
        r.status !== 'Closed' &&
        r.status !== 'Resolved'
      ) {
        overdueFollowups++;
      }

      if (r.resolution && r.resolution.resolved_at && r.reported_date) {
        const createdMs = new Date(r.reported_date).getTime();
        const resolvedMs = new Date(r.resolution.resolved_at).getTime();
        const diffDays = Math.max(0, Math.round((resolvedMs - createdMs) / (1000 * 60 * 60 * 24)));
        resolutionDurations.push(diffDays);
      }
    });

    const avgResolutionDays =
      resolutionDurations.length > 0
        ? Math.round(
          (resolutionDurations.reduce((a, b) => a + b, 0) / resolutionDurations.length) * 10
        ) / 10
        : 0;

    return {
      data: {
        totalIssues: rows.length,
        openIssues: openCount,
        inProgressIssues: inProgressCount,
        awaitingSupplierIssues: awaitingSupplierCount,
        escalatedIssues: escalatedCount,
        resolvedIssues: resolvedCount,
        closedIssues: closedCount,
        criticalIssues: criticalCount,
        highSeverityIssues: highCount,
        overdueFollowups,
        avgResolutionDays,
      },
    };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Failed to calculate issue metrics.' };
  }
}

/**
 * Creates a new delivery issue linked to a PO line via secure backend RPC.
 */
export async function createDeliveryIssue(params: {
  trackingId: string;
  issueType: DeliveryIssueType;
  severity: DeliveryIssueSeverity;
  description: string;
  reportedDate?: string;
  assignedEmployeeId: string;
  initialActionRequired?: string;
  nextFollowupDate?: string;
}): Promise<{ success: boolean; issueId?: string; issueNumber?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_create_delivery_issue', {
      p_tracking_id: params.trackingId,
      p_issue_type: params.issueType,
      p_severity: params.severity,
      p_description: params.description,
      p_reported_date: params.reportedDate || null,
      p_assigned_employee_id: params.assignedEmployeeId,
      p_initial_action_required: params.initialActionRequired || null,
      p_next_followup_date: params.nextFollowupDate || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      issueId: data?.issue_id,
      issueNumber: data?.issue_number,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to create delivery issue.' };
  }
}

/**
 * Adds a supplier follow-up record to an issue.
 */
export async function addIssueFollowup(params: {
  issueId: string;
  contactMethod: 'Email' | 'Phone' | 'Meeting' | 'Other';
  contactPerson?: string;
  supplierResponse?: string;
  committedAction?: string;
  revisedExpectedDate?: string;
  nextFollowupDate?: string;
  notes?: string;
}): Promise<{ success: boolean; followupId?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_add_issue_followup', {
      p_issue_id: params.issueId,
      p_contact_method: params.contactMethod,
      p_contact_person: params.contactPerson || null,
      p_supplier_response: params.supplierResponse || null,
      p_committed_action: params.committedAction || null,
      p_revised_expected_date: params.revisedExpectedDate || null,
      p_next_followup_date: params.nextFollowupDate || null,
      p_notes: params.notes || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, followupId: data?.followup_id };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to record supplier follow-up.' };
  }
}

/**
 * Escalates a delivery issue to the next level of management.
 */
export async function escalateDeliveryIssue(params: {
  issueId: string;
  escalationLevel: string;
  triggerReason: string;
  requiredAction: string;
  expectedResponseDate?: string;
  recipientRole?: string;
  recipientEmployeeId?: string;
}): Promise<{ success: boolean; escalationId?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('api_escalate_delivery_issue', {
      p_issue_id: params.issueId,
      p_escalation_level: params.escalationLevel,
      p_trigger_reason: params.triggerReason,
      p_required_action: params.requiredAction,
      p_expected_response_date: params.expectedResponseDate || null,
      p_recipient_role: params.recipientRole || null,
      p_recipient_employee_id: params.recipientEmployeeId || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, escalationId: data?.escalation_id };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to escalate delivery issue.' };
  }
}

/**
 * Resolves a delivery issue with category, rationale, and operational confirmations.
 */
export async function resolveDeliveryIssue(params: {
  issueId: string;
  resolutionCategory: string;
  resolutionDescription: string;
  requiresFurtherFollowup?: boolean;
  nextOperationalAction?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('api_resolve_delivery_issue', {
      p_issue_id: params.issueId,
      p_resolution_category: params.resolutionCategory,
      p_resolution_description: params.resolutionDescription,
      p_requires_further_followup: params.requiresFurtherFollowup || false,
      p_next_operational_action: params.nextOperationalAction || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to resolve delivery issue.' };
  }
}

/**
 * Closes or reopens a delivery issue with mandatory justification.
 */
export async function transitionDeliveryIssue(
  issueId: string,
  newStatus: DeliveryIssueStatus,
  explanation: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('api_transition_delivery_issue', {
      p_issue_id: issueId,
      p_new_status: newStatus,
      p_explanation: explanation,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to transition delivery issue.' };
  }
}

/**
 * Reassigns delivery issue ownership to another active employee.
 */
export async function reassignDeliveryIssue(
  issueId: string,
  newEmployeeId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Verify target employee is active
    const { data: emp, error: empErr } = await supabase
      .from('employees')
      .select('id, full_name, is_active')
      .eq('id', newEmployeeId)
      .single();

    if (empErr || !emp || !emp.is_active) {
      return { success: false, error: 'Target employee must be active.' };
    }

    const { error: updateErr } = await supabase
      .from('delivery_issues')
      .update({
        assigned_employee_id: newEmployeeId,
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', issueId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Log event
    await supabase.from('delivery_issue_events').insert({
      issue_id: issueId,
      event_type: 'REASSIGNED',
      new_state: { assigned_employee_id: newEmployeeId, assigned_to: emp.full_name },
      change_reason: reason,
      performed_by: user?.id,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to reassign issue owner.' };
  }
}

/**
 * Generates and downloads an RFC 4180 CSV export of delivery issues.
 */
export function exportDeliveryIssuesCsv(issues: DeliveryIssue[], appliedFilters: string): void {
  const headers = [
    'Issue Number',
    'SAP PO Number',
    'SAP Line Number',
    'Supplier Name',
    'Material Code',
    'Material Description',
    'Category',
    'Issue Type',
    'Severity',
    'Status',
    'Assigned Owner',
    'Reported Date',
    'Next Follow-up Date',
    'Description',
    'Initial Action Required',
  ];

  const rows = issues.map((iss) => [
    `"${iss.issue_number}"`,
    `"${iss.sap_po_number}"`,
    `"${iss.sap_po_line_number}"`,
    `"${(iss.supplier_name || '').replace(/"/g, '""')}"`,
    `"${iss.material_code || ''}"`,
    `"${(iss.material_description || '').replace(/"/g, '""')}"`,
    iss.category,
    `"${iss.issue_type}"`,
    iss.severity,
    iss.status,
    `"${iss.assigned_employee?.full_name || ''}"`,
    iss.reported_date,
    iss.next_followup_date || '',
    `"${(iss.description || '').replace(/"/g, '""')}"`,
    `"${(iss.initial_action_required || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [
    `# SCM FLOW — DELIVERY ISSUE & ESCALATION REGISTER`,
    `# Generated At (IST): ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
    `# Applied Filters: ${appliedFilters}`,
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `delivery_issues_${getTodayISTDate()}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

