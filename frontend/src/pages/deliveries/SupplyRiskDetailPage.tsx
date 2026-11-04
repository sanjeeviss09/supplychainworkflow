import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Layers,
  User,
  Plus,
  RefreshCw,
  X,
  History,
  AlertOctagon,
  FileText,
} from 'lucide-react';
import {
  RiskMitigationAction,
  SupplyRiskLevel,
  SupplyRiskRecord,
  SupplyRiskStatus,
} from '@/types/database.types';
import {
  fetchSupplyRiskById,
  transitionSupplyRisk,
  createRiskMitigationAction,
} from '@/services/supplyRiskService';
import { fetchActiveEmployees } from '@/services/employeeService';

export function SupplyRiskDetailPage() {
  const { riskId } = useParams<{ riskId: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const canMitigate = hasPermission('supply_risk.mitigate');
  const canResolve = hasPermission('supply_risk.resolve');

  const [risk, setRisk] = useState<SupplyRiskRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<{ id: string; full_name: string; employee_id: string }[]>([]);

  // Modals
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [nextStatus, setNextStatus] = useState<SupplyRiskStatus>('Resolved');
  const [statusExplanation, setStatusExplanation] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [showActionModal, setShowActionModal] = useState(false);
  const [actionTitle, setActionTitle] = useState('');
  const [actionDesc, setActionDesc] = useState('');
  const [actionEmployeeId, setActionEmployeeId] = useState('');
  const [actionDueDate, setActionDueDate] = useState('');
  const [actionPriority, setActionPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('High');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadData = async () => {
    if (!riskId) return;
    setLoading(true);
    try {
      const [fetchedRisk, fetchedEmployees] = await Promise.all([
        fetchSupplyRiskById(riskId),
        fetchActiveEmployees(),
      ]);
      setRisk(fetchedRisk);
      setEmployees(fetchedEmployees);
    } catch (err) {
      console.error('Failed to load risk detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [riskId]);

  const handleOpenStatusModal = (status: SupplyRiskStatus) => {
    setNextStatus(status);
    setStatusExplanation('');
    setStatusError(null);
    setShowStatusModal(true);
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!riskId || !statusExplanation.trim()) {
      setStatusError('Please provide an operational justification for the status change.');
      return;
    }

    setIsSubmittingStatus(true);
    setStatusError(null);

    const res = await transitionSupplyRisk({
      riskId,
      newStatus: nextStatus,
      explanation: statusExplanation,
    });

    setIsSubmittingStatus(false);

    if (res.success) {
      setShowStatusModal(false);
      loadData();
    } else {
      setStatusError(res.error || 'Failed to update risk status.');
    }
  };

  const handleOpenActionModal = () => {
    setActionTitle('');
    setActionDesc('');
    setActionEmployeeId(employees[0]?.id || '');
    const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setActionDueDate(in3Days);
    setActionPriority(risk?.risk_level === 'Critical' ? 'Critical' : 'High');
    setActionError(null);
    setShowActionModal(true);
  };

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!riskId || !actionTitle.trim() || !actionEmployeeId || !actionDueDate) {
      setActionError('Please complete all required fields.');
      return;
    }

    setIsSubmittingAction(true);
    setActionError(null);

    const res = await createRiskMitigationAction({
      riskId,
      actionTitle,
      actionDescription: actionDesc,
      assignedEmployeeId: actionEmployeeId,
      dueDate: actionDueDate,
      priority: actionPriority,
    });

    setIsSubmittingAction(false);

    if (res.success) {
      setShowActionModal(false);
      loadData();
    } else {
      setActionError(res.error || 'Failed to create mitigation action.');
    }
  };

  const getRiskLevelBadge = (level?: SupplyRiskLevel) => {
    switch (level) {
      case 'Critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'High':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
  };

  const getStatusBadge = (status?: SupplyRiskStatus) => {
    switch (status) {
      case 'Identified':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Under Assessment':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Mitigation Planned':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Monitoring':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Resolved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Closed':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      default:
        return 'bg-ivory text-ink-primary border-divider';
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center text-ink-muted">
          <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-forest" />
          <p className="text-xs">Loading Material Supply Risk Assessment...</p>
        </div>
      </div>
    );
  }

  if (!risk) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/app/deliveries/risks')}
          className="text-forest"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Supply Risks
        </Button>
        <Card className="border-divider bg-ivory-surface p-8 text-center text-ink-muted">
          <ShieldAlert className="mx-auto mb-2 h-8 w-8 text-ink-muted/50" />
          <h2 className="text-base font-bold text-ink-primary">Risk Record Not Found</h2>
          <p className="mt-1 text-xs">The requested supply risk could not be found or you do not have permission.</p>
        </Card>
      </div>
    );
  }

  const isBreached =
    risk.current_expected_delivery_date &&
    risk.required_by_date &&
    risk.current_expected_delivery_date > risk.required_by_date;

  return (
    <div className="space-y-6">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/deliveries/risks')}
            className="border-divider bg-ivory-surface hover:bg-ivory text-forest"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to Risk Register
          </Button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-forest">{risk.risk_number}</h1>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusBadge(risk.status)}`}>
                {risk.status}
              </span>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${getRiskLevelBadge(risk.risk_level)}`}>
                {risk.risk_level} Risk ({risk.risk_score}/100)
              </span>
            </div>
            <p className="text-xs text-ink-secondary mt-0.5">
              Assigned Owner: <span className="font-semibold text-ink-primary">{risk.risk_owner?.full_name || 'SCM Team'}</span> ({risk.risk_owner?.employee_id || '—'})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canMitigate && !['Resolved', 'Closed'].includes(risk.status) && (
            <Button
              size="sm"
              onClick={handleOpenActionModal}
              className="bg-forest text-ivory hover:bg-forest-deep shadow-warm-sm text-xs"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Schedule Mitigation Action
            </Button>
          )}

          {canResolve && risk.status !== 'Resolved' && risk.status !== 'Closed' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenStatusModal('Resolved')}
              className="border-status-success text-status-success hover:bg-status-success/10 text-xs"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-status-success" />
              Mark Resolved
            </Button>
          )}

          {canResolve && risk.status !== 'Closed' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenStatusModal('Closed')}
              className="border-divider bg-ivory text-ink-secondary hover:bg-ivory-muted text-xs"
            >
              Close Record
            </Button>
          )}
        </div>
      </div>

      {/* Date Comparison Alert Banner */}
      <Card
        className={`border p-4 shadow-warm-sm ${isBreached ? 'border-red-300 bg-red-50/70' : 'border-divider bg-ivory-surface'
          }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start space-x-3">
            {isBreached ? (
              <AlertOctagon className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            ) : (
              <Calendar className="h-6 w-6 text-forest flex-shrink-0 mt-0.5" />
            )}
            <div>
              <h3 className={`text-sm font-bold ${isBreached ? 'text-red-900' : 'text-forest'}`}>
                {isBreached
                  ? 'CRITICAL OPERATIONAL BREACH: Expected ETA Exceeds Required-By Date!'
                  : 'Delivery Schedule Alignment'}
              </h3>
              <p className="text-xs text-ink-secondary mt-0.5">
                {isBreached
                  ? 'Production or operations requires this material before the current vendor ETA. Immediate intervention required.'
                  : 'Operational delivery window monitored against production requirements.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="rounded border border-divider/60 bg-ivory p-2 text-center">
              <span className="block text-[10px] text-ink-muted">Committed Date</span>
              <span className="font-semibold text-ink-primary">
                {risk.original_committed_delivery_date || '—'}
              </span>
            </div>
            <div className="rounded border border-divider/60 bg-ivory p-2 text-center">
              <span className="block text-[10px] text-ink-muted">Current ETA</span>
              <span className="font-semibold text-ink-primary">
                {risk.current_expected_delivery_date || '—'}
              </span>
            </div>
            <div
              className={`rounded border p-2 text-center ${isBreached ? 'border-red-400 bg-red-100 font-bold text-red-800' : 'border-forest/40 bg-forest/10 text-forest'
                }`}
            >
              <span className="block text-[10px]">Internal Required By</span>
              <span className="font-semibold">{risk.required_by_date || 'Not specified'}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Grid: Risk Factors & Material Information */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Risk Score & Explainable Factors */}
        <Card className="border-divider bg-ivory-surface shadow-warm-sm lg:col-span-2">
          <CardHeader className="border-b border-divider/60 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-forest">
                Explainable Risk Scoring Breakdown
              </CardTitle>
              <span className="text-xs font-mono font-semibold text-ink-primary">
                Total Score: {risk.risk_score} / 100
              </span>
            </div>
            <CardDescription className="text-xs text-ink-secondary">
              {risk.risk_explanation}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-medium text-ink-secondary">
                <span>0 (Low)</span>
                <span>25 (Medium)</span>
                <span>45 (High)</span>
                <span>70+ (Critical)</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-ivory border border-divider overflow-hidden">
                <div
                  className={`h-full transition-all ${risk.risk_score >= 70
                      ? 'bg-red-600'
                      : risk.risk_score >= 45
                        ? 'bg-amber-500'
                        : risk.risk_score >= 25
                          ? 'bg-yellow-500'
                          : 'bg-emerald-500'
                    }`}
                  style={{ width: `${Math.min(100, risk.risk_score)}%` }}
                />
              </div>
            </div>

            {/* Contributing Factors List */}
            <div className="mt-4 space-y-2">
              <span className="text-xs font-semibold text-ink-primary">Identified Risk Factors:</span>
              <div className="space-y-1.5">
                {risk.risk_factors && risk.risk_factors.length > 0 ? (
                  risk.risk_factors.map((factor, idx) => (
                    <div
                      key={idx}
                      className="flex items-center space-x-2 rounded border border-divider/80 bg-ivory p-2 text-xs text-ink-primary"
                    >
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      <span>{factor}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-ink-muted">No aggravating risk factors recorded.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PO Line & Material Context */}
        <Card className="border-divider bg-ivory-surface shadow-warm-sm">
          <CardHeader className="border-b border-divider/60 pb-3">
            <CardTitle className="text-sm font-bold text-forest">SAP PO Reference</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 text-xs">
            <div>
              <span className="text-[10px] uppercase font-semibold text-ink-muted">Material</span>
              <p className="font-semibold text-ink-primary">{risk.material_description}</p>
              <div className="mt-0.5 flex items-center space-x-2 text-[11px] text-ink-secondary">
                <span className="font-mono">{risk.material_code || '—'}</span>
                <span>•</span>
                <span className="font-bold text-forest">{risk.category}</span>
              </div>
            </div>

            <div className="border-t border-divider/60 pt-2">
              <span className="text-[10px] uppercase font-semibold text-ink-muted">SAP Document</span>
              <p className="font-mono font-semibold text-forest">
                {risk.sap_po_number} / Line {risk.sap_po_line_number}
              </p>
            </div>

            <div className="border-t border-divider/60 pt-2">
              <span className="text-[10px] uppercase font-semibold text-ink-muted">Supplier</span>
              <p className="font-medium text-ink-primary">{risk.supplier_name}</p>
            </div>

            <div className="border-t border-divider/60 pt-2 grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] uppercase font-semibold text-ink-muted">Criticality</span>
                <p className="font-bold text-ink-primary">{risk.material_criticality}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-ink-muted">Impact</span>
                <p className="font-bold text-ink-primary">{risk.business_impact_level}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mitigation Actions Section */}
      <Card className="border-divider bg-ivory-surface shadow-warm-sm">
        <CardHeader className="border-b border-divider/60 pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-forest">
              Operational Mitigation Actions ({risk.mitigation_actions?.length || 0})
            </CardTitle>
            <CardDescription className="text-xs text-ink-secondary">
              Assigned tasks to eliminate supply risk or reschedule dependencies
            </CardDescription>
          </div>
          {canMitigate && !['Resolved', 'Closed'].includes(risk.status) && (
            <Button
              size="sm"
              onClick={handleOpenActionModal}
              className="bg-forest text-ivory hover:bg-forest-deep text-xs"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Action
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-divider bg-ivory/60 text-ink-secondary">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Action Title & Description</th>
                  <th className="px-4 py-2.5 font-semibold">Priority</th>
                  <th className="px-4 py-2.5 font-semibold">Assigned Owner</th>
                  <th className="px-4 py-2.5 font-semibold">Target Due Date</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider/60 text-ink-primary">
                {!risk.mitigation_actions || risk.mitigation_actions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-ink-muted">
                      <Clock className="mx-auto mb-1.5 h-6 w-6 text-ink-muted/50" />
                      No mitigation actions scheduled yet. Click "Add Action" to assign one.
                    </td>
                  </tr>
                ) : (
                  risk.mitigation_actions.map((act) => {
                    const isOverdue =
                      new Date(act.due_date).getTime() < Date.now() &&
                      ['Pending', 'In Progress'].includes(act.status);

                    return (
                      <tr key={act.id} className="hover:bg-sage-pale/20">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-ink-primary">{act.action_title}</p>
                          {act.action_description && (
                            <p className="text-[11px] text-ink-secondary line-clamp-1">
                              {act.action_description}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${act.priority === 'Critical'
                                ? 'bg-red-100 text-red-800'
                                : act.priority === 'High'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                          >
                            {act.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {act.assigned_employee?.full_name || 'SCM Employee'}
                        </td>
                        <td className="px-4 py-3 font-mono">
                          <span className={isOverdue ? 'font-bold text-red-600' : ''}>
                            {act.due_date}
                          </span>
                          {isOverdue && (
                            <span className="ml-1.5 rounded bg-red-100 px-1 py-0.2 text-[9px] font-bold text-red-700">
                              Overdue
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${act.status === 'Completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : act.status === 'In Progress'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                          >
                            {act.status}
                          </span>
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

      {/* Audit Events Trail */}
      <Card className="border-divider bg-ivory-surface shadow-warm-sm">
        <CardHeader className="border-b border-divider/60 pb-3">
          <CardTitle className="text-sm font-bold text-forest">Risk Lifecycle Audit Events</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {!risk.events || risk.events.length === 0 ? (
            <p className="text-xs text-ink-muted">No audit events recorded.</p>
          ) : (
            risk.events.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start space-x-3 rounded-lg border border-divider/60 bg-ivory p-3 text-xs"
              >
                <History className="h-4 w-4 text-forest flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-forest">{ev.event_type}</span>
                    <span className="font-mono text-[10px] text-ink-muted">{ev.performed_at}</span>
                  </div>
                  <p className="mt-1 text-ink-secondary">{ev.change_reason}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Modal: Transition Risk Status */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-divider bg-ivory-surface p-6 shadow-warm-xl">
            <div className="flex items-center justify-between border-b border-divider/60 pb-3">
              <h3 className="text-base font-bold text-forest">Transition Risk Status</h3>
              <button onClick={() => setShowStatusModal(false)} className="text-ink-muted hover:text-ink-primary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit} className="mt-4 space-y-4 text-xs">
              {statusError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-red-700">
                  {statusError}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="nextStatus" className="text-xs">
                  New Status
                </Label>
                <select
                  id="nextStatus"
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value as SupplyRiskStatus)}
                  className="w-full rounded-md border border-divider bg-ivory p-2 text-xs font-semibold text-ink-primary"
                >
                  <option value="Under Assessment">Under Assessment</option>
                  <option value="Mitigation Planned">Mitigation Planned</option>
                  <option value="Monitoring">Monitoring</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="explanation" className="text-xs">
                  Operational Justification / Resolution Summary <span className="text-red-500">*</span>
                </Label>
                <textarea
                  id="explanation"
                  rows={3}
                  value={statusExplanation}
                  onChange={(e) => setStatusExplanation(e.target.value)}
                  placeholder="Explain why this risk is being transitioned or resolved"
                  className="w-full rounded-md border border-divider bg-ivory p-2 text-xs text-ink-primary"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowStatusModal(false)}
                  className="border-divider bg-ivory"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingStatus}
                  className="bg-forest text-ivory hover:bg-forest-deep"
                >
                  {isSubmittingStatus ? 'Updating...' : 'Confirm Transition'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Mitigation Action */}
      {showActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-divider bg-ivory-surface p-6 shadow-warm-xl">
            <div className="flex items-center justify-between border-b border-divider/60 pb-3">
              <h3 className="text-base font-bold text-forest">Schedule Mitigation Action</h3>
              <button onClick={() => setShowActionModal(false)} className="text-ink-muted hover:text-ink-primary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleActionSubmit} className="mt-4 space-y-4 text-xs">
              {actionError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-red-700">
                  {actionError}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="actionTitleModal" className="text-xs">
                  Action Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="actionTitleModal"
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  placeholder="e.g. Expedite customs clearance with broker"
                  className="border-divider bg-ivory text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="actionDescModal" className="text-xs">
                  Detailed Operational Description
                </Label>
                <textarea
                  id="actionDescModal"
                  rows={2}
                  value={actionDesc}
                  onChange={(e) => setActionDesc(e.target.value)}
                  placeholder="Steps to eliminate or minimize operational delivery risk"
                  className="w-full rounded-md border border-divider bg-ivory p-2 text-xs text-ink-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="assignedEmployeeModal" className="text-xs">
                    Assigned Owner <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="assignedEmployeeModal"
                    value={actionEmployeeId}
                    onChange={(e) => setActionEmployeeId(e.target.value)}
                    className="w-full rounded-md border border-divider bg-ivory p-2 text-xs font-medium text-ink-primary"
                    required
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="actionDueDateModal" className="text-xs">
                    Target Due Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="actionDueDateModal"
                    type="date"
                    value={actionDueDate}
                    onChange={(e) => setActionDueDate(e.target.value)}
                    className="border-divider bg-ivory text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="actionPriorityModal" className="text-xs">
                  Priority
                </Label>
                <select
                  id="actionPriorityModal"
                  value={actionPriority}
                  onChange={(e) => setActionPriority(e.target.value as any)}
                  className="w-full rounded-md border border-divider bg-ivory p-2 text-xs font-medium text-ink-primary"
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowActionModal(false)}
                  className="border-divider bg-ivory"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingAction}
                  className="bg-forest text-ivory hover:bg-forest-deep"
                >
                  {isSubmittingAction ? 'Scheduling...' : 'Schedule Action'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

