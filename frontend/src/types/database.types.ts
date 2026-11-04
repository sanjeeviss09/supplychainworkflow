export type MaterialCategory = 'API' | 'EXE' | 'PM' | 'Consumables';
export type SupplierStatus = 'active' | 'on_hold' | 'blacklisted';
export type ProjectStatus = 'draft' | 'planned' | 'active' | 'on_hold' | 'completed' | 'archived';
export type MilestoneStatus = 'draft' | 'planned' | 'active' | 'completed' | 'delayed' | 'archived';
export type MaterialReqStatus = 'unassigned' | 'partially_requisitioned' | 'fully_requisitioned' | 'partially_ordered' | 'fully_ordered' | 'delivered';
export type ApprovalEntityType = 'budget_request' | 'purchase_requisition' | 'purchase_order' | 'project_closure';
export type ApprovalStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'cancelled';
export type ApprovalStepStatus = 'pending' | 'approved' | 'rejected' | 'skipped';
export type BudgetRequestStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type PriorityLevel = 'low' | 'normal' | 'high' | 'urgent';
export type PRStatus = 'draft' | 'submitted' | 'approved' | 'partially_ordered' | 'fully_ordered' | 'cancelled';
export type POStatus = 'draft' | 'pending_approval' | 'approved' | 'issued' | 'confirmed' | 'partially_delivered' | 'fully_delivered' | 'closed' | 'cancelled';
export type DeliveryScheduleStatus = 'scheduled' | 'reminder_dispatched' | 'in_transit' | 'delivered' | 'delayed' | 'cancelled';
export type ShipmentStatus = 'dispatched' | 'in_transit' | 'at_gate' | 'unloaded';
export type QCInspectionStatus = 'quarantine' | 'under_testing' | 'accepted' | 'partially_rejected' | 'rejected';
export type GRNStatus = 'draft' | 'submitted' | 'qc_completed' | 'closed';
export type InvoiceVerificationStatus = 'unverified' | 'matched' | 'discrepancy' | 'approved_for_payment' | 'paid' | 'rejected';
export type MatchStatus = 'exact_match' | 'tolerance_accepted' | 'discrepancy_held';
export type UserRole = 'super_admin' | 'scm_admin' | 'scm_team_user';

export type PermissionId =
  // Phase 4 Projects & Milestones Permissions
  | 'projects.view'
  | 'projects.create'
  | 'projects.update'
  | 'projects.archive'
  | 'projects.delete'
  | 'projects.view_all'
  | 'projects.manage_members'
  | 'projects.manage_owner'
  | 'milestones.view'
  | 'milestones.create'
  | 'milestones.update'
  | 'milestones.complete'
  | 'milestones.archive'
  | 'milestones.assign'
  // Phase 6 Supplier Management Permissions
  | 'suppliers.view'
  | 'suppliers.create'
  | 'suppliers.update'
  | 'suppliers.deactivate'
  | 'suppliers.reactivate'
  | 'suppliers.delete'
  | 'suppliers.view_all'
  | 'supplier_contacts.manage'
  | 'supplier_addresses.manage'
  | 'supplier_materials.view'
  | 'supplier_materials.manage'
  | 'supplier_documents.view'
  | 'supplier_documents.upload'
  | 'supplier_documents.archive'
  | 'supplier_qualification.view'
  | 'supplier_qualification.update'
  // Phase 7 SAP Reference & Material Delivery Tracking Permissions
  | 'sap_references.view'
  | 'sap_references.create'
  | 'sap_references.update'
  | 'sap_references.import'
  | 'delivery_tracking.view'
  | 'delivery_tracking.view_all'
  | 'delivery_tracking.create'
  | 'delivery_tracking.update'
  | 'delivery_tracking.cancel'
  | 'delivery_tracking.assign'
  | 'delivery_tracking.reassign'
  | 'delivery_updates.view'
  | 'delivery_updates.create'
  | 'delivery_updates.correct'
  | 'delivery_updates.override_quantity'
  | 'delivery_reports.view'
  | 'delivery_reports.export'
  | 'delivery_documents.view'
  | 'delivery_documents.upload'
  // Supplier Performance Analytics Permissions
  | 'supplier_performance.view'
  | 'supplier_performance.export'
  // Phase 9 Delivery Issues & Escalations Permissions
  | 'delivery_issues.view'
  | 'delivery_issues.create'
  | 'delivery_issues.update'
  | 'delivery_issues.reassign'
  | 'delivery_issues.escalate'
  | 'delivery_issues.resolve'
  | 'delivery_issues.close'
  | 'delivery_issues.export'
  // Phase 10 Delivery Planning & Calendar Permissions
  | 'delivery_planning.view'
  | 'delivery_planning.export'
  // Phase 11 Material Supply Risk & Criticality Permissions
  | 'supply_risk.view'
  | 'supply_risk.create'
  | 'supply_risk.update'
  | 'supply_risk.mitigate'
  | 'supply_risk.resolve'
  | 'supply_risk.export'
  // Phase 12 SCM Document Management & Expiry Tracking Permissions
  | 'documents.view'
  | 'documents.upload'
  | 'documents.update'
  | 'documents.review'
  | 'documents.archive'
  | 'documents.export'
  // Phase 3 Canonical Route & Action Permissions
  | 'profile.view.self'
  | 'materials.view'
  | 'budgets.view'
  | 'approvals.view'
  | 'procurement.view'
  | 'deliveries.view'
  | 'reports.view'
  | 'employees.manage'
  | 'employees.import'
  | 'audit.view'
  | 'settings.system.manage'
  | 'settings.scm.manage'
  // Phase 2 Operational & Granular Permissions
  | 'employees.read'
  | 'employees.write'
  | 'roles.assign'
  | 'audit.read'
  | 'settings.read'
  | 'settings.manage'
  | 'scm.projects.read'
  | 'scm.projects.write'
  | 'scm.workflows.manage'
  | 'scm.requisitions.write'
  | 'scm.orders.authorize'
  | 'scm.receiving.write'
  | 'scm.invoices.verify';

export interface Permission {
  id: PermissionId;
  module: string;
  description: string;
  created_at: string;
}

export interface RolePermission {
  id: string;
  role_id: UserRole;
  permission_id: PermissionId;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  head_user_id?: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  project_code: string;
  name: string;
  title?: string;
  description?: string | null;
  department_id: string;
  owner_employee_id: string;
  lead_user_id?: string | null;
  status: ProjectStatus;
  planned_start_date: string;
  planned_end_date: string;
  actual_completion_date?: string | null;
  currency?: string;
  version: number;
  created_by?: string;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
  archived_at?: string | null;
  archived_by?: string | null;
  department?: Department | null;
  owner?: Employee | null;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  employee_id: string;
  status: 'active' | 'removed';
  added_by: string;
  added_at: string;
  removed_by?: string | null;
  removed_at?: string | null;
  employee?: Employee | null;
}

export interface Milestone {
  id: string;
  project_id: string;
  milestone_code: string;
  title: string;
  description?: string | null;
  planned_start_date: string;
  planned_end_date: string;
  actual_completion_date?: string | null;
  status: MilestoneStatus;
  assignee_employee_id?: string | null;
  created_by?: string;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
  archived_at?: string | null;
  archived_by?: string | null;
  version: number;
  assignee?: Employee | null;
}

export interface ProjectExceptionGrant {
  id: string;
  employee_id: string;
  project_id?: string | null;
  department_id?: string | null;
  allowed_permissions: string[];
  reason: string;
  granted_by: string;
  expires_at: string;
  is_revoked: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  department_id?: string | null;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role_id: UserRole;
  assigned_by?: string | null;
  created_at: string;
}

export interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  department: string;
  designation: string;
  assigned_role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  user_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CurrentUserContext {
  authenticated: boolean;
  user_id?: string;
  employee_linked?: boolean;
  is_active?: boolean;
  role?: UserRole | null;
  must_change_password?: boolean;
  permissions?: PermissionId[];
  employee?: Employee | null;
  profile?: Profile | null;
  error?: string;
}

export interface AuditLog {
  id: number;
  table_name: string;
  record_id: string;
  action: string;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  changed_by?: string | null;
  target_employee_id?: string | null;
  outcome?: string;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export type ImportRowOutcome = 'accepted_insert' | 'accepted_update' | 'skipped' | 'rejected';

export interface ImportEmployeeRow {
  row_number?: number;
  employee_id: string;
  full_name: string;
  email: string;
  department: string;
  designation: string;
  assigned_role: string;
  outcome?: ImportRowOutcome;
  is_valid?: boolean;
  error?: string | null;
}

export interface EmployeeImportBatch {
  id: string;
  file_name: string;
  file_type: 'csv' | 'xlsx' | 'xls';
  status: 'previewed' | 'completed' | 'failed';
  total_rows: number;
  accepted_rows: number;
  skipped_rows: number;
  rejected_rows: number;
  imported_by: string;
  confirmed_at: string;
  created_at: string;
}

export interface EmployeeImportRowRecord {
  id: string;
  batch_id: string;
  row_number: number;
  employee_id?: string | null;
  full_name?: string | null;
  email?: string | null;
  department?: string | null;
  designation?: string | null;
  assigned_role?: string | null;
  outcome: ImportRowOutcome;
  error_message?: string | null;
  employee_record_id?: string | null;
  created_at: string;
}

export interface ImportPreviewResult {
  file_name: string;
  file_type: string;
  total_rows: number;
  accepted_rows: number;
  skipped_rows: number;
  rejected_rows: number;
  rows: ImportEmployeeRow[];
}

export interface BulkImportResult {
  success: boolean;
  batch_id?: string;
  total: number;
  accepted?: number;
  inserted: number;
  updated: number;
  skipped?: number;
  failed: number;
  rows?: ImportEmployeeRow[];
  errors?: Array<{ row: number; error: string }>;
}

export interface AppSetting {
  key: string;
  value: any;
  category: 'authentication' | 'access_control' | 'scm_defaults';
  description: string;
  is_public: boolean;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// PHASE 6: SUPPLIER MANAGEMENT DATA TYPES
// =============================================================================

export type SupplierType =
  | 'MANUFACTURER'
  | 'DISTRIBUTOR'
  | 'TRADER'
  | 'SERVICE_PROVIDER'
  | 'OEM'
  | 'OTHER';

export type SupplierQualificationStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'QUALIFIED'
  | 'NOT_QUALIFIED'
  | 'EXPIRED';

export type SupplierContactType =
  | 'PRIMARY'
  | 'COMMERCIAL'
  | 'QUALITY'
  | 'TECHNICAL'
  | 'OTHER';

export type SupplierAddressType =
  | 'REGISTERED'
  | 'OFFICE'
  | 'MANUFACTURING_SITE'
  | 'WAREHOUSE'
  | 'OTHER';

export type SupplierDocumentType =
  | 'REGISTRATION_CERTIFICATE'
  | 'TAX_GST_CERTIFICATE'
  | 'QUALITY_CERTIFICATION'
  | 'MANUFACTURING_LICENSE'
  | 'MSME_CERTIFICATE'
  | 'OTHER';

export type SupplierDocumentStatus = 'ACTIVE' | 'EXPIRED' | 'ARCHIVED';

export interface Supplier {
  id: string;
  supplier_code: string;
  vendor_code?: string;
  legal_name: string;
  display_name?: string | null;
  trade_name?: string | null;
  supplier_type: SupplierType;
  tax_identifier?: string | null;
  gstin?: string | null;
  website?: string | null;
  general_email?: string | null;
  email?: string | null;
  general_phone?: string | null;
  phone?: string | null;
  registered_address?: string | null;
  supplier_status: 'ACTIVE' | 'INACTIVE';
  status?: string;
  qualification_status: SupplierQualificationStatus;
  qualification_start_date?: string | null;
  qualification_expiry_date?: string | null;
  last_reviewed_date?: string | null;
  review_notes?: string | null;
  qualification_updated_by?: string | null;
  qualification_updated_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
  deactivated_by?: string | null;
  deactivated_at?: string | null;
  deactivation_reason?: string | null;
  reactivated_by?: string | null;
  reactivated_at?: string | null;
  reactivation_reason?: string | null;
}

export interface SupplierContact {
  id: string;
  supplier_id: string;
  full_name: string;
  name?: string;
  job_title?: string | null;
  designation?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string;
  contact_type: SupplierContactType;
  is_primary: boolean;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_by?: string | null;
  updated_at?: string;
}

export interface SupplierAddress {
  id: string;
  supplier_id: string;
  address_type: SupplierAddressType;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
  is_primary: boolean;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_by?: string | null;
  updated_at?: string;
}

export interface SupplierMaterial {
  id: string;
  supplier_id: string;
  material_id: string;
  material?: {
    id: string;
    material_code: string;
    name: string;
    category?: string;
    uom?: string;
  };
  supplier?: Supplier;
  supplier_part_number?: string | null;
  supplier_material_description?: string | null;
  specification_grade?: string | null;
  minimum_order_quantity?: number | null;
  lead_time_days?: number | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_by?: string | null;
  created_at: string;
  updated_by?: string | null;
  updated_at?: string;
}

export interface SupplierDocument {
  id: string;
  supplier_id: string;
  document_type: SupplierDocumentType;
  document_name: string;
  file_key: string;
  file_url?: string | null;
  file_size_bytes?: number | null;
  mime_type?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  status: SupplierDocumentStatus;
  notes?: string | null;
  uploaded_by?: string | null;
  uploaded_at: string;
  archived_by?: string | null;
  archived_at?: string | null;
}

export interface SupplierQualificationHistory {
  id: string;
  supplier_id: string;
  previous_status?: string | null;
  new_status: SupplierQualificationStatus;
  reason: string;
  changed_by: string;
  changed_at: string;
}

// =============================================================================
// PHASE 7: SAP REFERENCE & MATERIAL DELIVERY TRACKING DATA TYPES
// =============================================================================

export type DeliveryTrackingStatus =
  | 'AWAITING_PO'
  | 'PO_REGISTERED'
  | 'AWAITING_SCHEDULE'
  | 'SCHEDULED'
  | 'PARTIALLY_DELIVERED'
  | 'DELIVERED'
  | 'DELAYED'
  | 'CANCELLED';

export type DelayReasonCategory =
  | 'Supplier Manufacturing Delay'
  | 'Raw Material Shortage at Supplier'
  | 'Quality Testing / Release Pending'
  | 'Packaging Delay'
  | 'Supplier Capacity Constraint'
  | 'Transportation / Logistics Delay'
  | 'Documentation Pending'
  | 'Customs / Import Clearance Delay'
  | 'Internal Coordination Delay'
  | 'Technical Specification Clarification'
  | 'Other';

export interface SapPrReference {
  id: string;
  internal_requirement_id?: string | null;
  sap_pr_number: string;
  sap_pr_date?: string | null;
  sap_pr_item_number?: string | null;
  sap_reference_remarks?: string | null;
  recorded_by?: string | null;
  recorded_at: string;
}

export interface SapPoReference {
  id: string;
  sap_po_number: string;
  sap_po_date?: string | null;
  sap_po_approval_date: string;
  supplier_id?: string | null;
  supplier_name: string;
  supplier_code?: string | null;
  project_id?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  plant_location?: string | null;
  po_currency: string;
  sap_reference_remarks?: string | null;
  recorded_by?: string | null;
  recorded_at: string;
  updated_by?: string | null;
  updated_at: string;
  lines?: MaterialDeliveryTracking[];
}

export interface MaterialDeliveryTracking {
  id: string;
  sap_po_reference_id: string;
  sap_po_number: string;
  sap_po_line_number: string;
  material_id?: string | null;
  material_code?: string | null;
  material_description: string;
  category: 'API' | 'PM' | 'EXE' | 'CONSUMABLE' | 'Consumables';
  ordered_quantity: number;
  uom: string;
  supplier_id?: string | null;
  supplier_name: string;
  project_id?: string | null;
  department_id?: string | null;
  internal_requirement_id?: string | null;
  allocated_requirement_quantity?: number | null;
  assigned_employee_id?: string | null;
  original_committed_delivery_date?: string | null;
  current_expected_delivery_date?: string | null;
  actual_completion_date?: string | null;
  delivered_quantity: number;
  outstanding_quantity?: number;
  delivery_status: DeliveryTrackingStatus;
  cancellation_reason?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  delivery_remarks?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;

  // Joined relations
  assigned_employee?: Employee | null;
  project?: Project | null;
  department?: Department | null;
  supplier?: Supplier | null;
  material?: any | null;
  updates?: MaterialDeliveryUpdate[];
  delay_logs?: MaterialDeliveryDelayLog[];
  date_history?: DeliveryDateHistory[];
}

export interface DeliveryTrackingAssignment {
  id: string;
  tracking_id: string;
  assigned_employee_id: string;
  assigned_employee?: Employee | null;
  assigned_by: string;
  assignment_date: string;
  assignment_remarks?: string | null;
  assignment_status: 'ACTIVE' | 'REASSIGNED' | 'COMPLETED';
}

export interface DeliveryDateHistory {
  id: string;
  tracking_id: string;
  previous_date?: string | null;
  new_date: string;
  reason: string;
  source: string;
  changed_by: string;
  changed_at: string;
}

export interface MaterialDeliveryUpdate {
  id: string;
  tracking_id: string;
  delivery_quantity: number;
  actual_delivery_date: string;
  supplier_delivery_reference?: string | null;
  delivery_remarks?: string | null;
  attachment_url?: string | null;
  file_key?: string | null;
  is_overrun_override: boolean;
  override_reason?: string | null;
  is_corrected: boolean;
  correction_reason?: string | null;
  updated_by: string;
  updated_at: string;
  updater?: Employee | null;
}

export interface MaterialDeliveryDelayLog {
  id: string;
  tracking_id: string;
  delay_date: string;
  delay_reason_category: DelayReasonCategory | string;
  delay_explanation: string;
  supplier_contacted: boolean;
  supplier_update?: string | null;
  revised_expected_date?: string | null;
  corrective_action: string;
  next_followup_date: string;
  is_backfilled: boolean;
  backfill_reason?: string | null;
  supporting_document_url?: string | null;
  created_by: string;
  created_at: string;
  updated_by?: string | null;
  updated_at?: string;
  creator?: Employee | null;
}

export interface DeliveryDocument {
  id: string;
  tracking_id: string;
  delivery_update_id?: string | null;
  file_name: string;
  file_key: string;
  document_type: string;
  uploaded_by: string;
  uploaded_at: string;
}

export interface DeliveryMetrics {
  totalActivePoLines: number;
  awaitingPoReference: number;
  awaitingDeliverySchedule: number;
  upcomingDeliveries: number;
  partiallyDelivered: number;
  delayedDeliveries: number;
  fullyDelivered: number;
  cancelledTrackingRecords: number;
  delayed1To3Days: number;
  delayed4To7Days: number;
  delayed8To15Days: number;
  delayed16To30Days: number;
  delayedMoreThan30Days: number;
  dailyRemarksPending: number;
  dailyRemarksMissing: number;
  averageDelayDays: number;
  longestDelayDays: number;
}

export interface SupplierScorecardItem {
  supplier_id: string;
  supplier_name: string;
  total_lines: number;
  evaluable_lines: number;
  missing_commitment_count: number;
  on_time_delivered_lines: number;
  late_delivered_lines: number;
  overdue_outstanding_lines: number;
  partial_delivery_lines: number;
  total_outstanding_quantity: number;
  on_time_percentage: number;
  avg_final_delay_days_late: number;
  max_final_delay_days: number;
  avg_current_delay_days_overdue: number;
}

export interface SupplierCategoryBreakdown {
  category: 'API' | 'PM' | 'EXE' | 'CONSUMABLE' | string;
  total_lines: number;
  on_time_lines: number;
  delayed_lines: number;
  missing_commitment_count: number;
  on_time_percentage: number;
}

export interface SupplierDelayReasonBreakdown {
  category: string;
  occurrences_count: number;
  distinct_lines_affected: number;
}

export interface SupplierPerformanceOverallSummary {
  total_lines: number;
  total_delivered_lines: number;
  total_on_time_lines: number;
  total_late_completed_lines: number;
  total_overdue_outstanding_lines: number;
  total_partial_lines: number;
  total_missing_commitment_lines: number;
  on_time_delivery_rate: number;
  avg_final_delay_days: number;
  max_final_delay_days: number;
  avg_current_delay_days: number;
}

export interface SupplierPerformanceAnalyticsResult {
  as_of_date_ist: string;
  filters: {
    start_date?: string | null;
    end_date?: string | null;
    supplier_id?: string | null;
    category?: string | null;
  };
  overall_summary: SupplierPerformanceOverallSummary;
  supplier_scorecards: SupplierScorecardItem[];
  category_breakdown: SupplierCategoryBreakdown[];
  delay_reasons_breakdown: SupplierDelayReasonBreakdown[];
}

export type DeliveryIssueType =
  | 'Delivery Delay'
  | 'Partial Delivery'
  | 'Quantity Shortage'
  | 'Damaged Material'
  | 'Incorrect Material'
  | 'Supplier Non-Response'
  | 'ETA Revision'
  | 'Documentation Issue'
  | 'Other';

export type DeliveryIssueSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export type DeliveryIssueStatus =
  | 'Open'
  | 'In Progress'
  | 'Awaiting Supplier'
  | 'Escalated'
  | 'Resolved'
  | 'Closed';

export interface DeliveryIssue {
  id: string;
  issue_number: string;
  tracking_id: string;
  sap_po_number: string;
  sap_po_line_number: string;
  supplier_id?: string | null;
  supplier_name: string;
  material_code?: string | null;
  material_description: string;
  category: string;
  issue_type: DeliveryIssueType;
  severity: DeliveryIssueSeverity;
  status: DeliveryIssueStatus;
  description: string;
  reported_date: string;
  initial_action_required?: string | null;
  assigned_employee_id: string;
  next_followup_date?: string | null;
  created_by: string;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;

  // Joined relations
  assigned_employee?: {
    id: string;
    full_name: string;
    employee_id: string;
  } | null;
  creator?: {
    id: string;
    email?: string;
  } | null;
  tracking?: MaterialDeliveryTracking | null;
  attachments?: DeliveryIssueAttachment[];
  followups?: DeliveryIssueFollowup[];
  escalations?: DeliveryIssueEscalation[];
  resolution?: DeliveryIssueResolution | null;
  events?: DeliveryIssueEvent[];
}

export interface DeliveryIssueAttachment {
  id: string;
  issue_id: string;
  file_name: string;
  file_key: string;
  file_type?: string | null;
  file_size_bytes?: number | null;
  uploaded_by: string;
  uploaded_at: string;
}

export interface DeliveryIssueFollowup {
  id: string;
  issue_id: string;
  followup_date: string;
  contact_method: 'Email' | 'Phone' | 'Meeting' | 'Other';
  contact_person?: string | null;
  initiated_by: string;
  supplier_response?: string | null;
  committed_action?: string | null;
  revised_expected_date?: string | null;
  next_followup_date?: string | null;
  notes?: string | null;
  created_by: string;
  created_at: string;

  initiator?: {
    id: string;
    full_name: string;
    employee_id: string;
  } | null;
}

export interface DeliveryIssueEscalation {
  id: string;
  issue_id: string;
  escalation_level: string;
  trigger_reason: string;
  escalated_by: string;
  recipient_role?: string | null;
  recipient_employee_id?: string | null;
  required_action: string;
  expected_response_date?: string | null;
  escalation_outcome?: string | null;
  escalation_status: 'Escalated' | 'Acknowledged' | 'Action Taken' | 'De-escalated';
  escalated_at: string;
  resolved_at?: string | null;

  recipient_employee?: {
    id: string;
    full_name: string;
    employee_id: string;
  } | null;
}

export interface DeliveryIssueResolution {
  id: string;
  issue_id: string;
  resolution_category: string;
  resolution_description: string;
  requires_further_followup: boolean;
  next_operational_action?: string | null;
  resolved_by: string;
  resolved_at: string;
}

export interface DeliveryIssueEvent {
  id: string;
  issue_id: string;
  event_type: string;
  old_state?: Record<string, any> | null;
  new_state?: Record<string, any> | null;
  change_reason: string;
  performed_by: string;
  performed_at: string;
}

export interface DeliveryIssueMetrics {
  totalIssues: number;
  openIssues: number;
  inProgressIssues: number;
  awaitingSupplierIssues: number;
  escalatedIssues: number;
  resolvedIssues: number;
  closedIssues: number;
  criticalIssues: number;
  highSeverityIssues: number;
  overdueFollowups: number;
  avgResolutionDays: number;
}

export interface DeliveryPlanningSummary {
  total_scheduled_lines: number;
  due_today_count: number;
  upcoming_7d_count: number;
  upcoming_15d_count: number;
  upcoming_30d_count: number;
  overdue_count: number;
  partial_count: number;
  fully_delivered_count: number;
  critical_issue_count: number;
  unassigned_count: number;
}

export interface DeliveryUomWorkload {
  uom: string;
  category: string;
  lines_count: number;
  ordered_qty: number;
  delivered_qty: number;
  outstanding_qty: number;
}

export interface DeliveryCalendarItem {
  id: string;
  sap_po_number: string;
  sap_po_line_number: string;
  category: string;
  material_code?: string | null;
  material_description: string;
  supplier_name: string;
  ordered_quantity: number;
  delivered_quantity: number;
  outstanding_quantity: number;
  uom: string;
  assigned_employee_name?: string | null;
  original_committed_delivery_date?: string | null;
  current_expected_delivery_date?: string | null;
  delivery_status: DeliveryTrackingStatus;
  original_delay_days?: number | null;
  has_open_issue: boolean;
  has_critical_issue: boolean;
}

export interface DeliveryCalendarDay {
  date: string;
  lines_count: number;
  delivered_count: number;
  partial_count: number;
  critical_issue_count: number;
  line_items: DeliveryCalendarItem[];
}

export interface DeliveryPlanningResult {
  as_of_date_ist: string;
  window: {
    start_date: string;
    end_date: string;
  };
  summary: DeliveryPlanningSummary;
  uom_workload_breakdown: DeliveryUomWorkload[];
  calendar_days: DeliveryCalendarDay[];
}

export interface DeliveryScheduleChangeRecord {
  id: string;
  tracking_id: string;
  previous_date?: string | null;
  new_date: string;
  reason: string;
  source: string;
  changed_by: string;
  changed_at: string;
  changer?: {
    full_name: string;
    employee_id: string;
  } | null;
  tracking?: {
    sap_po_number: string;
    sap_po_line_number: string;
    material_description: string;
    supplier_name: string;
  } | null;
}

export type MaterialCriticalityLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type BusinessImpactLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type SupplyRiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';
export type SupplyRiskStatus =
  | 'Identified'
  | 'Under Assessment'
  | 'Mitigation Planned'
  | 'Monitoring'
  | 'Resolved'
  | 'Closed';

export interface SupplyRiskRecord {
  id: string;
  risk_number: string;
  tracking_id: string;
  sap_po_number: string;
  sap_po_line_number: string;
  supplier_id?: string | null;
  supplier_name: string;
  material_code?: string | null;
  material_description: string;
  category: string;
  material_criticality: MaterialCriticalityLevel;
  business_impact_level: BusinessImpactLevel;
  required_by_date?: string | null;
  original_committed_delivery_date?: string | null;
  current_expected_delivery_date?: string | null;
  risk_score: number;
  risk_level: SupplyRiskLevel;
  risk_explanation: string;
  risk_factors: string[];
  status: SupplyRiskStatus;
  risk_owner_id: string;
  identified_at: string;
  resolved_at?: string | null;
  closed_at?: string | null;
  created_by: string;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;

  // Joined relations
  risk_owner?: {
    id: string;
    full_name: string;
    employee_id: string;
  } | null;
  tracking?: MaterialDeliveryTracking | null;
  mitigation_actions?: RiskMitigationAction[];
  events?: SupplyRiskEvent[];
}

export interface RiskMitigationAction {
  id: string;
  risk_id: string;
  action_title: string;
  action_description: string;
  assigned_employee_id: string;
  due_date: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
  followup_remarks?: string | null;
  outcome?: string | null;
  completed_at?: string | null;
  created_by: string;
  created_at: string;

  assigned_employee?: {
    id: string;
    full_name: string;
    employee_id: string;
  } | null;
}

export interface SupplyRiskEvent {
  id: string;
  risk_id: string;
  event_type: string;
  old_state?: Record<string, any> | null;
  new_state?: Record<string, any> | null;
  change_reason: string;
  performed_by: string;
  performed_at: string;
}

export interface SupplyRiskDashboardMetrics {
  totalActiveRisks: number;
  criticalRisksCount: number;
  highRisksCount: number;
  mediumRisksCount: number;
  lowRisksCount: number;
  resolvedRisksCount: number;
  overdueActionsCount: number;
  categoryBreakdown: {
    category: string;
    activeCount: number;
    criticalCount: number;
  }[];
}

// =============================================================================
// PHASE 12: SCM DOCUMENT MANAGEMENT & EXPIRY TRACKING TYPES
// =============================================================================

export type DocumentCategoryGroup = 'SUPPLIER' | 'MATERIAL' | 'PO_DELIVERY' | 'GENERAL';

export type DocumentExpiryStatus =
  | 'Active'
  | 'Expiring Soon'
  | 'Expired'
  | 'No Expiry Date'
  | 'Review Required'
  | 'Superseded'
  | 'Archived';

export type DocumentReviewStatus =
  | 'Pending Review'
  | 'Verified'
  | 'Review Required'
  | 'Unable to Verify';

export interface DocumentCategoryConfig {
  id: string;
  category_group: DocumentCategoryGroup;
  display_name: string;
  description?: string | null;
  default_reminder_days: number[];
  is_mandatory_for_qualification: boolean;
  is_active: boolean;
  created_at: string;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: string;
  file_key: string;
  file_name: string;
  file_size_bytes?: number | null;
  mime_type?: string | null;
  file_checksum?: string | null;
  version_notes?: string | null;
  is_current: boolean;
  uploaded_by: string;
  uploaded_at: string;
  uploader?: {
    full_name: string;
    employee_id: string;
  } | null;
}

export interface DocumentLink {
  id: string;
  document_id: string;
  link_type: 'SUPPLIER' | 'MATERIAL' | 'SAP_PO' | 'PO_LINE' | 'DELIVERY_TRACKING' | 'DELIVERY_ISSUE';
  target_id: string;
  target_reference?: string | null;
  created_by: string;
  created_at: string;
}

export interface DocumentReview {
  id: string;
  document_id: string;
  version_id?: string | null;
  previous_review_status?: string | null;
  new_review_status: DocumentReviewStatus;
  remarks: string;
  reviewed_by: string;
  reviewed_at: string;
  reviewer?: {
    full_name: string;
    employee_id: string;
  } | null;
}

export interface DocumentEvent {
  id: string;
  document_id: string;
  event_type: string;
  old_state?: Record<string, any> | null;
  new_state?: Record<string, any> | null;
  change_reason: string;
  performed_by: string;
  performed_at: string;
}

export interface ScmDocumentRecord {
  id: string;
  document_number: string;
  title: string;
  description?: string | null;
  category_group: DocumentCategoryGroup;
  category_id: string;
  document_reference_number?: string | null;
  owner_employee_id?: string | null;
  current_version_id?: string | null;
  current_version_number: string;
  issue_date?: string | null;
  expiry_date?: string | null;
  expiry_status: DocumentExpiryStatus;
  review_status: DocumentReviewStatus;
  is_confidential: boolean;
  created_by: string;
  created_at: string;
  updated_by?: string | null;
  updated_at: string;
  archived_at?: string | null;
  archived_by?: string | null;
  archive_reason?: string | null;

  // Joined relations
  category?: DocumentCategoryConfig | null;
  owner?: {
    id: string;
    full_name: string;
    employee_id: string;
  } | null;
  current_version?: DocumentVersion | null;
  versions?: DocumentVersion[];
  links?: DocumentLink[];
  reviews?: DocumentReview[];
  events?: DocumentEvent[];
}

export interface DocumentDashboardMetrics {
  totalDocuments: number;
  activeDocuments: number;
  expiringWithin90d: number;
  expiringWithin30d: number;
  expiredDocuments: number;
  reviewPendingCount: number;
  archivedCount: number;
  categoryGroupCounts: {
    group: DocumentCategoryGroup;
    count: number;
  }[];
}






