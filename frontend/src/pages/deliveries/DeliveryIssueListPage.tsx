import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  fetchDeliveryIssues,
  fetchDeliveryIssueMetrics,
  createDeliveryIssue,
  exportDeliveryIssuesCsv,
} from '@/services/deliveryIssueService';
import { fetchDeliveryTrackingList } from '@/services/deliveryService';
import { fetchSuppliers } from '@/services/supplierService';
import { fetchEmployeesList } from '@/services/employeeService';
import {
  DeliveryIssue,
  DeliveryIssueMetrics,
  DeliveryIssueSeverity,
  DeliveryIssueStatus,
  DeliveryIssueType,
  Employee,
  MaterialDeliveryTracking,
  Supplier,
} from '@/types/database.types';
import { getTodayISTDate } from '@/lib/deliveryCalculations';
import { formatDateIST } from '@/lib/formatters';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertTriangle,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Download,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  X,
  FileSpreadsheet,
  ChevronRight,
  ShieldAlert,
  HelpCircle,
  Eye,
  Calendar,
} from 'lucide-react';

export function DeliveryIssueListPage() {
  const { hasPermission, employee: currentEmployee } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [issues, setIssues] = useState<DeliveryIssue[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [metrics, setMetrics] = useState<DeliveryIssueMetrics | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [viewScope, setViewScope] = useState<'all' | 'my_assigned'>('all');
  const [overdueFollowupOnly, setOverdueFollowupOnly] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Suppliers & Employees dropdown options
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [availableTracking, setAvailableTracking] = useState<MaterialDeliveryTracking[]>([]);
  const [selectedTrackingId, setSelectedTrackingId] = useState('');
  const [selectedTracking, setSelectedTracking] = useState<MaterialDeliveryTracking | null>(null);
  const [newIssueType, setNewIssueType] = useState<DeliveryIssueType>('Delivery Delay');
  const [newSeverity, setNewSeverity] = useState<DeliveryIssueSeverity>('Medium');
  const [newDescription, setNewDescription] = useState('');
  const [newReportedDate, setNewReportedDate] = useState(getTodayISTDate());
  const [newAssignedEmployeeId, setNewAssignedEmployeeId] = useState(currentEmployee?.id || '');
  const [newInitialAction, setNewInitialAction] = useState('');
  const [newNextFollowupDate, setNewNextFollowupDate] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    fetchSuppliers({ pageSize: 200 }).then((res) => {
      if (res.data) setSuppliers(res.data);
    });
    fetchEmployeesList().then((res) => {
      if (res.data) setEmployees(res.data.filter((e) => e.is_active));
    });
    fetchDeliveryTrackingList({ pageSize: 300 }).then((res) => {
      if (res.data) setAvailableTracking(res.data);
    });
  }, []);

  useEffect(() => {
    loadIssues();
    loadMetrics();
  }, [
    searchTerm,
    statusFilter,
    severityFilter,
    categoryFilter,
    supplierFilter,
    viewScope,
    overdueFollowupOnly,
    page,
  ]);

  const loadIssues = async () => {
    setLoading(true);
    setErrorMsg(null);
    const assignedId = viewScope === 'my_assigned' ? currentEmployee?.id : undefined;

    const res = await fetchDeliveryIssues({
      searchTerm,
      status: statusFilter,
      severity: severityFilter,
      category: categoryFilter,
      supplierId: supplierFilter || undefined,
      assignedEmployeeId: assignedId,
      overdueFollowupOnly,
      page,
      pageSize,
    });

    setLoading(false);
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setIssues(res.data);
      setTotalCount(res.totalCount);
    }
  };

  const loadMetrics = async () => {
    const res = await fetchDeliveryIssueMetrics();
    if (res.data) {
      setMetrics(res.data);
    }
  };

  const handleTrackingSelect = (trackingId: string) => {
    setSelectedTrackingId(trackingId);
    const found = availableTracking.find((t) => t.id === trackingId);
    if (found) {
      setSelectedTracking(found);
      setNewAssignedEmployeeId(found.assigned_employee_id || currentEmployee?.id || '');
    } else {
      setSelectedTracking(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!selectedTrackingId) {
      setCreateError('Please select an active SAP PO line tracking record.');
      return;
    }
    if (!newDescription.trim()) {
      setCreateError('Issue description is mandatory.');
      return;
    }
    if (!newAssignedEmployeeId) {
      setCreateError('Assigned issue owner is mandatory.');
      return;
    }

    setCreateSubmitting(true);
    const res = await createDeliveryIssue({
      trackingId: selectedTrackingId,
      issueType: newIssueType,
      severity: newSeverity,
      description: newDescription,
      reportedDate: newReportedDate,
      assignedEmployeeId: newAssignedEmployeeId,
      initialActionRequired: newInitialAction || undefined,
      nextFollowupDate: newNextFollowupDate || undefined,
    });
    setCreateSubmitting(false);

    if (res.error) {
      setCreateError(res.error);
    } else {
      setIsCreateModalOpen(false);
      resetCreateForm();
      loadIssues();
      loadMetrics();
      if (res.issueId) {
        navigate(`/app/deliveries/issues/${res.issueId}`);
      }
    }
  };

  const resetCreateForm = () => {
    setSelectedTrackingId('');
    setSelectedTracking(null);
    setNewIssueType('Delivery Delay');
    setNewSeverity('Medium');
    setNewDescription('');
    setNewReportedDate(getTodayISTDate());
    setNewAssignedEmployeeId(currentEmployee?.id || '');
    setNewInitialAction('');
    setNewNextFollowupDate('');
    setCreateError(null);
  };

  const canCreate = hasPermission('delivery_issues.create');
  const canExport = hasPermission('delivery_issues.export');

  const todayIST = getTodayISTDate();

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-divider/70 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-copper inline-block" />
            <h1 className="text-2xl font-bold tracking-tight text-forest">Delivery Issues & Escalations</h1>
          </div>
          <p className="mt-1 text-xs text-ink-secondary">
            Log, track, follow up, and escalate supplier delivery exceptions, delays, and shortages at SAP PO-line level.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadIssues();
              loadMetrics();
            }}
            disabled={loading}
            className="border-divider text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {canExport && issues.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportDeliveryIssuesCsv(
                  issues,
                  `Status: ${statusFilter} | Severity: ${severityFilter} | Category: ${categoryFilter}`
                )
              }
              className="border-divider text-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1.5 text-forest" />
              Export (CSV)
            </Button>
          )}

          {canCreate && (
            <Button
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-forest hover:bg-forest-deep text-sage text-xs shadow-warm-sm"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5 text-sage" />
              Log Delivery Issue
            </Button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="border border-divider bg-ivory-surface">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Total Issues</span>
              <AlertCircle className="h-4 w-4 text-forest" />
            </div>
            <div className="mt-2 text-2xl font-bold text-ink-primary">{metrics?.totalIssues ?? 0}</div>
            <p className="mt-1 text-[11px] text-ink-muted">Registered all-time</p>
          </CardContent>
        </Card>

        <Card className="border border-divider bg-ivory-surface">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Open & Active</span>
              <Clock className="h-4 w-4 text-amber-700" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-700">
              {(metrics?.openIssues ?? 0) + (metrics?.inProgressIssues ?? 0)}
            </div>
            <p className="mt-1 text-[11px] text-ink-muted">{metrics?.inProgressIssues ?? 0} in progress</p>
          </CardContent>
        </Card>

        <Card className="border border-divider bg-ivory-surface">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Escalated</span>
              <ShieldAlert className="h-4 w-4 text-copper" />
            </div>
            <div className="mt-2 text-2xl font-bold text-copper">{metrics?.escalatedIssues ?? 0}</div>
            <p className="mt-1 text-[11px] text-ink-muted">Management attention</p>
          </CardContent>
        </Card>

        <Card className="border border-divider bg-ivory-surface">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Critical Severity</span>
              <AlertTriangle className="h-4 w-4 text-status-error" />
            </div>
            <div className="mt-2 text-2xl font-bold text-status-error">{metrics?.criticalIssues ?? 0}</div>
            <p className="mt-1 text-[11px] text-ink-muted">{metrics?.highSeverityIssues ?? 0} high severity</p>
          </CardContent>
        </Card>

        <Card className="border border-divider bg-ivory-surface">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Overdue Follow-ups</span>
              <Clock className="h-4 w-4 text-status-error" />
            </div>
            <div className="mt-2 text-2xl font-bold text-status-error">{metrics?.overdueFollowups ?? 0}</div>
            <p className="mt-1 text-[11px] text-ink-muted">Past scheduled date</p>
          </CardContent>
        </Card>

        <Card className="border border-divider bg-ivory-surface">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Resolved</span>
              <CheckCircle2 className="h-4 w-4 text-status-success" />
            </div>
            <div className="mt-2 text-2xl font-bold text-status-success">{metrics?.resolvedIssues ?? 0}</div>
            <p className="mt-1 text-[11px] text-ink-muted">Avg {metrics?.avgResolutionDays ?? 0}d to resolve</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {/* View Scope (All vs My Assigned) */}
            <div>
              <label className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Workbench Scope</label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <button
                  type="button"
                  onClick={() => setViewScope('all')}
                  className={`flex-1 border border-divider px-2.5 py-1.5 text-xs font-medium rounded-l-md transition-colors ${viewScope === 'all' ? 'bg-forest text-sage border-forest' : 'bg-ivory text-ink-primary'
                    }`}
                >
                  All Issues
                </button>
                <button
                  type="button"
                  onClick={() => setViewScope('my_assigned')}
                  className={`flex-1 border border-divider px-2.5 py-1.5 text-xs font-medium rounded-r-md transition-colors ${viewScope === 'my_assigned' ? 'bg-forest text-sage border-forest' : 'bg-ivory text-ink-primary'
                    }`}
                >
                  My Assigned
                </button>
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 block w-full rounded-md border border-divider bg-ivory px-2.5 py-1.5 text-xs text-ink-primary focus:border-forest focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Awaiting Supplier">Awaiting Supplier</option>
                <option value="Escalated">Escalated</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            {/* Severity Filter */}
            <div>
              <label className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Severity</label>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="mt-1 block w-full rounded-md border border-divider bg-ivory px-2.5 py-1.5 text-xs text-ink-primary focus:border-forest focus:outline-none"
              >
                <option value="all">All Severities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            {/* Material Category */}
            <div>
              <label className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="mt-1 block w-full rounded-md border border-divider bg-ivory px-2.5 py-1.5 text-xs text-ink-primary focus:border-forest focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="API">API</option>
                <option value="PM">PM</option>
                <option value="EXE">EXE</option>
                <option value="CONSUMABLE">CONSUMABLE</option>
              </select>
            </div>

            {/* Supplier Select */}
            <div>
              <label className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Supplier</label>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="mt-1 block w-full rounded-md border border-divider bg-ivory px-2.5 py-1.5 text-xs text-ink-primary focus:border-forest focus:outline-none"
              >
                <option value="">All Suppliers ({suppliers.length})</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.legal_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Overdue Checkbox */}
            <div className="flex items-end pb-1.5">
              <label className="flex items-center space-x-2 text-xs text-ink-primary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={overdueFollowupOnly}
                  onChange={(e) => setOverdueFollowupOnly(e.target.checked)}
                  className="rounded border-divider text-forest focus:ring-forest"
                />
                <span className="font-medium text-status-error">Overdue Follow-ups Only</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Issues Register Table */}
      <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
        <CardHeader className="flex flex-col space-y-2 pb-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 border-b border-divider/60">
          <div>
            <CardTitle className="text-base font-bold text-forest">Issue Register ({totalCount})</CardTitle>
            <CardDescription className="text-xs text-ink-secondary">
              Tracked delivery exceptions linked to SAP PO reference lines.
            </CardDescription>
          </div>
          <div className="w-full sm:w-64">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-muted" />
              <Input
                type="text"
                placeholder="Search issue #, PO #, item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs bg-ivory"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-divider bg-ivory/60 text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Issue ID</th>
                  <th className="py-3 px-3">SAP PO / Line</th>
                  <th className="py-3 px-4">Supplier & Material</th>
                  <th className="py-3 px-3">Issue Type</th>
                  <th className="py-3 px-3 text-center">Severity</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3">Assigned Owner</th>
                  <th className="py-3 px-3">Next Follow-up</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider/50">
                {issues.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs text-ink-muted">
                      No delivery issues match the selected filters.
                    </td>
                  </tr>
                ) : (
                  issues.map((iss) => {
                    const isFollowupOverdue =
                      iss.next_followup_date &&
                      iss.next_followup_date < todayIST &&
                      iss.status !== 'Closed' &&
                      iss.status !== 'Resolved';

                    const sevColor =
                      iss.severity === 'Critical'
                        ? 'bg-status-error/15 text-status-error border-status-error/30'
                        : iss.severity === 'High'
                          ? 'bg-copper/15 text-copper border-copper/30'
                          : iss.severity === 'Medium'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-sage-pale text-forest border-sage/50';

                    const statusColor =
                      iss.status === 'Resolved' || iss.status === 'Closed'
                        ? 'bg-status-success/15 text-status-success'
                        : iss.status === 'Escalated'
                          ? 'bg-copper/15 text-copper font-bold'
                          : iss.status === 'Awaiting Supplier'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-sage-pale text-forest';

                    return (
                      <tr key={iss.id} className="hover:bg-ivory/50 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-forest">
                          <div>{iss.issue_number}</div>
                          <span className="text-[10px] text-ink-muted font-normal">
                            {formatDateIST(iss.reported_date)}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono">
                          <div>{iss.sap_po_number}</div>
                          <span className="text-[10px] text-ink-muted">Line {iss.sap_po_line_number}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-ink-primary">{iss.supplier_name}</div>
                          <div className="text-[11px] text-ink-secondary truncate max-w-xs">
                            {iss.material_description}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="rounded bg-ivory-hover px-2 py-0.5 text-[11px] font-medium text-ink-primary border border-divider">
                            {iss.issue_type}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${sevColor}`}>
                            {iss.severity}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusColor}`}>
                            {iss.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-ink-secondary">
                          <div className="font-medium text-ink-primary">
                            {iss.assigned_employee?.full_name || 'Unassigned'}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {iss.next_followup_date ? (
                            <span
                              className={`font-mono text-[11px] ${isFollowupOverdue ? 'text-status-error font-bold' : 'text-ink-secondary'
                                }`}
                            >
                              {formatDateIST(iss.next_followup_date)}
                              {isFollowupOverdue && <span className="block text-[9px] uppercase">Overdue</span>}
                            </span>
                          ) : (
                            <span className="text-ink-muted italic">Not set</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/app/deliveries/issues/${iss.id}`)}
                            className="h-7 text-xs text-forest hover:bg-forest/10 hover:text-forest-deep"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create Delivery Issue Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-xl border border-divider bg-ivory-surface shadow-warm-xl flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between border-b border-divider px-6 py-4">
              <div className="flex items-center space-x-2">
                <span className="h-2 w-2 rounded-full bg-copper inline-block" />
                <h3 className="text-lg font-bold text-forest">Log New Delivery Issue</h3>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  resetCreateForm();
                }}
                className="rounded-lg p-1.5 text-ink-muted hover:bg-ivory hover:text-ink-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {createError && (
                <div className="rounded-md bg-status-error/10 border border-status-error/30 p-3 text-xs text-status-error font-medium">
                  {createError}
                </div>
              )}

              {/* 1. Select PO Line Tracking Record */}
              <div className="space-y-1.5">
                <Label htmlFor="trackingSelect">Target SAP PO Line Item *</Label>
                <select
                  id="trackingSelect"
                  value={selectedTrackingId}
                  onChange={(e) => handleTrackingSelect(e.target.value)}
                  required
                  className="w-full rounded-md border border-divider bg-ivory px-3 py-2 text-xs text-ink-primary focus:border-forest focus:outline-none font-mono"
                >
                  <option value="">Select PO Line...</option>
                  {availableTracking.map((t) => (
                    <option key={t.id} value={t.id}>
                      PO #{t.sap_po_number} / Line {t.sap_po_line_number} — {t.supplier_name} ({t.material_description})
                    </option>
                  ))}
                </select>
              </div>

              {/* Auto-populated Summary Card */}
              {selectedTracking && (
                <div className="rounded-lg border border-divider bg-ivory p-3 text-xs space-y-2">
                  <div className="flex justify-between font-medium">
                    <span className="text-forest font-bold">
                      PO {selectedTracking.sap_po_number} / Line {selectedTracking.sap_po_line_number}
                    </span>
                    <span className="text-ink-secondary">Category: {selectedTracking.category}</span>
                  </div>
                  <div className="text-ink-primary font-semibold">{selectedTracking.material_description}</div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-ink-secondary pt-1 border-t border-divider/50">
                    <div>Supplier: <strong>{selectedTracking.supplier_name}</strong></div>
                    <div>
                      Ordered: {selectedTracking.ordered_quantity} {selectedTracking.uom} | Delivered:{' '}
                      {selectedTracking.delivered_quantity} {selectedTracking.uom}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Issue Type & Severity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="issueType">Issue Type *</Label>
                  <select
                    id="issueType"
                    value={newIssueType}
                    onChange={(e) => setNewIssueType(e.target.value as DeliveryIssueType)}
                    required
                    className="w-full rounded-md border border-divider bg-ivory px-3 py-2 text-xs text-ink-primary focus:border-forest focus:outline-none"
                  >
                    <option value="Delivery Delay">Delivery Delay</option>
                    <option value="Partial Delivery">Partial Delivery</option>
                    <option value="Quantity Shortage">Quantity Shortage</option>
                    <option value="Damaged Material">Damaged Material</option>
                    <option value="Incorrect Material">Incorrect Material</option>
                    <option value="Supplier Non-Response">Supplier Non-Response</option>
                    <option value="ETA Revision">ETA Revision</option>
                    <option value="Documentation Issue">Documentation Issue</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="severity">Severity Level *</Label>
                  <select
                    id="severity"
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as DeliveryIssueSeverity)}
                    required
                    className="w-full rounded-md border border-divider bg-ivory px-3 py-2 text-xs text-ink-primary focus:border-forest focus:outline-none"
                  >
                    <option value="Low">Low — Minor operational variance</option>
                    <option value="Medium">Medium — Delivery delayed within safety buffer</option>
                    <option value="High">High — Production batch or milestone at risk</option>
                    <option value="Critical">Critical — Severe shortage or damaged batch</option>
                  </select>
                </div>
              </div>

              {/* 3. Description */}
              <div className="space-y-1.5">
                <Label htmlFor="description">Issue Description & Exception Summary *</Label>
                <textarea
                  id="description"
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  required
                  placeholder="Detail the delivery problem, discrepancy, vendor response, or defect observed..."
                  className="w-full rounded-md border border-divider bg-ivory px-3 py-2 text-xs text-ink-primary focus:border-forest focus:outline-none"
                />
              </div>

              {/* 4. Assigned Owner & Next Follow-up Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="assignedEmployee">Assigned Issue Owner *</Label>
                  <select
                    id="assignedEmployee"
                    value={newAssignedEmployeeId}
                    onChange={(e) => setNewAssignedEmployeeId(e.target.value)}
                    required
                    className="w-full rounded-md border border-divider bg-ivory px-3 py-2 text-xs text-ink-primary focus:border-forest focus:outline-none"
                  >
                    <option value="">Select Employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="nextFollowup">Next Follow-up Date</Label>
                  <Input
                    id="nextFollowup"
                    type="date"
                    value={newNextFollowupDate}
                    onChange={(e) => setNewNextFollowupDate(e.target.value)}
                    className="h-8 text-xs bg-ivory"
                  />
                </div>
              </div>

              {/* 5. Initial Action Required */}
              <div className="space-y-1.5">
                <Label htmlFor="initialAction">Initial Action Required</Label>
                <Input
                  id="initialAction"
                  type="text"
                  placeholder="e.g. Call supplier dispatch lead for revised courier LR slip"
                  value={newInitialAction}
                  onChange={(e) => setNewInitialAction(e.target.value)}
                  className="h-8 text-xs bg-ivory"
                />
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-divider">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    resetCreateForm();
                  }}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createSubmitting}
                  className="bg-forest hover:bg-forest-deep text-sage text-xs"
                >
                  {createSubmitting ? 'Registering...' : 'Register Delivery Issue'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

