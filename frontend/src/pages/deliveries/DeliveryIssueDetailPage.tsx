import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  fetchDeliveryIssueById,
  addIssueFollowup,
  escalateDeliveryIssue,
  resolveDeliveryIssue,
  transitionDeliveryIssue,
  reassignDeliveryIssue,
} from '@/services/deliveryIssueService';
import { fetchEmployeesList } from '@/services/employeeService';
import {
  DeliveryIssue,
  DeliveryIssueStatus,
  Employee,
} from '@/types/database.types';
import { calculateDeliveryMetrics, getTodayISTDate } from '@/lib/deliveryCalculations';
import { formatDateIST } from '@/lib/formatters';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  Clock,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Phone,
  Mail,
  Users,
  Calendar,
  MessageSquare,
  History,
  X,
  ExternalLink,
  ChevronRight,
  UserCheck,
} from 'lucide-react';

export function DeliveryIssueDetailPage() {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const { hasPermission, employee: currentEmployee } = useAuth();

  const [issue, setIssue] = useState<DeliveryIssue | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'followups' | 'escalations' | 'resolution' | 'audit'>('followups');

  // Modals state
  const [isFollowupModalOpen, setIsFollowupModalOpen] = useState(false);
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
  const [transitionTargetStatus, setTransitionTargetStatus] = useState<DeliveryIssueStatus>('Closed');

  // Follow-up form
  const [fuContactMethod, setFuContactMethod] = useState<'Email' | 'Phone' | 'Meeting' | 'Other'>('Phone');
  const [fuContactPerson, setFuContactPerson] = useState('');
  const [fuSupplierResponse, setFuSupplierResponse] = useState('');
  const [fuCommittedAction, setFuCommittedAction] = useState('');
  const [fuRevisedDate, setFuRevisedDate] = useState('');
  const [fuNextFollowupDate, setFuNextFollowupDate] = useState('');
  const [fuNotes, setFuNotes] = useState('');
  const [fuSubmitting, setFuSubmitting] = useState(false);
  const [fuError, setFuError] = useState<string | null>(null);

  // Escalate form
  const [escLevel, setEscLevel] = useState('Level 1 - SCM Lead');
  const [escTriggerReason, setEscTriggerReason] = useState('');
  const [escRequiredAction, setEscRequiredAction] = useState('');
  const [escExpectedResponseDate, setEscExpectedResponseDate] = useState('');
  const [escRecipientEmployeeId, setEscRecipientEmployeeId] = useState('');
  const [escSubmitting, setEscSubmitting] = useState(false);
  const [escError, setEscError] = useState<string | null>(null);

  // Resolve form
  const [resCategory, setResCategory] = useState('Full quantity delivered');
  const [resDescription, setResDescription] = useState('');
  const [resRequiresFollowup, setResRequiresFollowup] = useState(false);
  const [resNextAction, setResNextAction] = useState('');
  const [resSubmitting, setResSubmitting] = useState(false);
  const [resError, setResError] = useState<string | null>(null);

  // Reassign form
  const [reassignTargetId, setReassignTargetId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [reassignSubmitting, setReassignSubmitting] = useState(false);
  const [reassignError, setReassignError] = useState<string | null>(null);

  // Transition form
  const [transitionReason, setTransitionReason] = useState('');
  const [transitionSubmitting, setTransitionSubmitting] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  useEffect(() => {
    fetchEmployeesList().then((res) => {
      if (res.data) setEmployees(res.data.filter((e) => e.is_active));
    });
  }, []);

  useEffect(() => {
    if (issueId) {
      loadIssue();
    }
  }, [issueId]);

  const loadIssue = async () => {
    if (!issueId) return;
    setLoading(true);
    setErrorMsg(null);
    const res = await fetchDeliveryIssueById(issueId);
    setLoading(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setIssue(res.data);
    }
  };

  const handleFollowupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueId) return;
    setFuError(null);
    setFuSubmitting(true);

    const res = await addIssueFollowup({
      issueId,
      contactMethod: fuContactMethod,
      contactPerson: fuContactPerson || undefined,
      supplierResponse: fuSupplierResponse || undefined,
      committedAction: fuCommittedAction || undefined,
      revisedExpectedDate: fuRevisedDate || undefined,
      nextFollowupDate: fuNextFollowupDate || undefined,
      notes: fuNotes || undefined,
    });
    setFuSubmitting(false);

    if (res.error) {
      setFuError(res.error);
    } else {
      setIsFollowupModalOpen(false);
      setFuContactPerson('');
      setFuSupplierResponse('');
      setFuCommittedAction('');
      setFuRevisedDate('');
      setFuNextFollowupDate('');
      setFuNotes('');
      loadIssue();
    }
  };

  const handleEscalateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueId) return;
    setEscError(null);

    if (!escTriggerReason.trim() || !escRequiredAction.trim()) {
      setEscError('Trigger reason and required action are mandatory.');
      return;
    }

    setEscSubmitting(true);
    const res = await escalateDeliveryIssue({
      issueId,
      escalationLevel: escLevel,
      triggerReason: escTriggerReason,
      requiredAction: escRequiredAction,
      expectedResponseDate: escExpectedResponseDate || undefined,
      recipientEmployeeId: escRecipientEmployeeId || undefined,
    });
    setEscSubmitting(false);

    if (res.error) {
      setEscError(res.error);
    } else {
      setIsEscalateModalOpen(false);
      setEscTriggerReason('');
      setEscRequiredAction('');
      setEscExpectedResponseDate('');
      loadIssue();
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueId) return;
    setResError(null);

    if (!resDescription.trim()) {
      setResError('Resolution explanation is mandatory.');
      return;
    }

    setResSubmitting(true);
    const res = await resolveDeliveryIssue({
      issueId,
      resolutionCategory: resCategory,
      resolutionDescription: resDescription,
      requiresFurtherFollowup: resRequiresFollowup,
      nextOperationalAction: resNextAction || undefined,
    });
    setResSubmitting(false);

    if (res.error) {
      setResError(res.error);
    } else {
      setIsResolveModalOpen(false);
      setResDescription('');
      setResNextAction('');
      loadIssue();
    }
  };

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueId || !reassignTargetId) return;
    setReassignError(null);

    if (!reassignReason.trim()) {
      setReassignError('Reassignment rationale is mandatory.');
      return;
    }

    setReassignSubmitting(true);
    const res = await reassignDeliveryIssue(issueId, reassignTargetId, reassignReason);
    setReassignSubmitting(false);

    if (res.error) {
      setReassignError(res.error);
    } else {
      setIsReassignModalOpen(false);
      setReassignReason('');
      loadIssue();
    }
  };

  const handleTransitionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueId) return;
    setTransitionError(null);

    if (!transitionReason.trim()) {
      setTransitionError('Reason for status transition is mandatory.');
      return;
    }

    setTransitionSubmitting(true);
    const res = await transitionDeliveryIssue(issueId, transitionTargetStatus, transitionReason);
    setTransitionSubmitting(false);

    if (res.error) {
      setTransitionError(res.error);
    } else {
      setIsTransitionModalOpen(false);
      setTransitionReason('');
      loadIssue();
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-xs text-ink-secondary">Loading issue details...</div>;
  }

  if (errorMsg || !issue) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/app/deliveries/issues')} className="text-xs">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Back to Issues
        </Button>
        <Card className="border-status-error/30 bg-status-error/5">
          <CardContent className="p-6 text-center text-xs text-status-error font-medium">
            {errorMsg || 'Delivery issue not found.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  const trackingMetrics = issue.tracking
    ? calculateDeliveryMetrics({
      orderedQuantity: Number(issue.tracking.ordered_quantity),
      deliveredQuantity: Number(issue.tracking.delivered_quantity),
      originalCommittedDeliveryDate: issue.tracking.original_committed_delivery_date,
      currentExpectedDeliveryDate: issue.tracking.current_expected_delivery_date,
      actualCompletionDate: issue.tracking.actual_completion_date,
    })
    : null;

  const canUpdate = hasPermission('delivery_issues.update');
  const canEscalate = hasPermission('delivery_issues.escalate');
  const canResolve = hasPermission('delivery_issues.resolve');
  const canClose = hasPermission('delivery_issues.close');
  const canReassign = hasPermission('delivery_issues.reassign');

  const sevColor =
    issue.severity === 'Critical'
      ? 'bg-status-error/15 text-status-error border-status-error/30'
      : issue.severity === 'High'
        ? 'bg-copper/15 text-copper border-copper/30'
        : issue.severity === 'Medium'
          ? 'bg-amber-100 text-amber-800 border-amber-200'
          : 'bg-sage-pale text-forest border-sage/50';

  const statusColor =
    issue.status === 'Resolved' || issue.status === 'Closed'
      ? 'bg-status-success/15 text-status-success'
      : issue.status === 'Escalated'
        ? 'bg-copper/15 text-copper font-bold'
        : issue.status === 'Awaiting Supplier'
          ? 'bg-amber-100 text-amber-900'
          : 'bg-sage-pale text-forest';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-divider/70 pb-5">
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/deliveries/issues')}
            className="border-divider text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Issue Register
          </Button>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-forest">{issue.issue_number}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${sevColor}`}>
                {issue.severity}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor}`}>
                {issue.status}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-ink-secondary">
              Reported on {formatDateIST(issue.reported_date)} by system user
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canUpdate && issue.status !== 'Closed' && (
            <Button
              size="sm"
              onClick={() => setIsFollowupModalOpen(true)}
              className="bg-forest hover:bg-forest-deep text-sage text-xs shadow-warm-sm"
            >
              <Phone className="h-3.5 w-3.5 mr-1.5" />
              Log Follow-up
            </Button>
          )}

          {canEscalate && issue.status !== 'Closed' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEscalateModalOpen(true)}
              className="border-copper text-copper hover:bg-copper/10 text-xs"
            >
              <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
              Escalate
            </Button>
          )}

          {canResolve && issue.status !== 'Closed' && issue.status !== 'Resolved' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsResolveModalOpen(true)}
              className="border-status-success text-status-success hover:bg-status-success/10 text-xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Resolve
            </Button>
          )}

          {canClose && issue.status === 'Resolved' && (
            <Button
              size="sm"
              onClick={() => {
                setTransitionTargetStatus('Closed');
                setIsTransitionModalOpen(true);
              }}
              className="bg-status-success hover:bg-status-success/90 text-white text-xs"
            >
              Confirm Closure
            </Button>
          )}

          {(issue.status === 'Closed' || issue.status === 'Resolved') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTransitionTargetStatus('In Progress');
                setIsTransitionModalOpen(true);
              }}
              className="border-amber-700 text-amber-700 hover:bg-amber-50 text-xs"
            >
              Reopen Issue
            </Button>
          )}
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: Issue Description & Metadata */}
        <Card className="border border-divider bg-ivory-surface shadow-warm-sm lg:col-span-2">
          <CardHeader className="pb-3 border-b border-divider/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-forest uppercase tracking-wider">{issue.issue_type}</span>
              <span className="text-xs text-ink-secondary">Category: <strong>{issue.category}</strong></span>
            </div>
            <CardTitle className="text-base font-bold text-ink-primary mt-1">{issue.material_description}</CardTitle>
            <CardDescription className="text-xs text-ink-secondary">
              Vendor: <strong className="text-forest">{issue.supplier_name}</strong> • SAP Code: {issue.material_code || 'N/A'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div>
              <span className="text-[11px] font-semibold text-ink-secondary uppercase block mb-1">Issue Description</span>
              <p className="rounded-md bg-ivory p-3 text-xs text-ink-primary whitespace-pre-wrap border border-divider/50">
                {issue.description}
              </p>
            </div>

            {issue.initial_action_required && (
              <div>
                <span className="text-[11px] font-semibold text-ink-secondary uppercase block mb-1">
                  Initial Action Required
                </span>
                <p className="text-xs text-ink-primary">{issue.initial_action_required}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-divider/50 text-xs">
              <div>
                <span className="text-ink-secondary block text-[11px]">Assigned Issue Owner:</span>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="font-semibold text-forest">
                    {issue.assigned_employee?.full_name || 'Unassigned'}
                  </span>
                  {canReassign && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsReassignModalOpen(true)}
                      className="h-6 px-1.5 text-[11px] text-forest hover:bg-forest/10"
                    >
                      Reassign
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <span className="text-ink-secondary block text-[11px]">Next Follow-up Scheduled:</span>
                <span className="font-mono font-medium mt-0.5 block">
                  {issue.next_followup_date ? formatDateIST(issue.next_followup_date) : 'None scheduled'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Linked PO Line & Delivery Status */}
        <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
          <CardHeader className="pb-3 border-b border-divider/60">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-forest">Linked SAP PO Line</CardTitle>
              {issue.tracking_id && (
                <Link
                  to={`/app/deliveries/${issue.tracking_id}`}
                  className="text-[11px] text-forest hover:underline flex items-center font-medium"
                >
                  <span>Tracking</span>
                  <ExternalLink className="h-3 w-3 ml-0.5" />
                </Link>
              )}
            </div>
            <CardDescription className="text-xs font-mono">
              PO #{issue.sap_po_number} / Line {issue.sap_po_line_number}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            {issue.tracking ? (
              <>
                <div className="flex justify-between py-1 border-b border-divider/50">
                  <span className="text-ink-secondary">Delivery Status:</span>
                  <span className="font-semibold">{issue.tracking.delivery_status}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-divider/50">
                  <span className="text-ink-secondary">Ordered Quantity:</span>
                  <span className="font-mono font-medium">
                    {issue.tracking.ordered_quantity} {issue.tracking.uom}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-divider/50">
                  <span className="text-ink-secondary">Delivered Quantity:</span>
                  <span className="font-mono font-medium text-status-success">
                    {issue.tracking.delivered_quantity} {issue.tracking.uom}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-divider/50">
                  <span className="text-ink-secondary">Outstanding Balance:</span>
                  <span className="font-mono font-medium text-status-error">
                    {trackingMetrics?.outstandingQuantity ?? 0} {issue.tracking.uom}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-divider/50">
                  <span className="text-ink-secondary">Original Commitment:</span>
                  <span className="font-mono">
                    {issue.tracking.original_committed_delivery_date
                      ? formatDateIST(issue.tracking.original_committed_delivery_date)
                      : 'Missing'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-ink-secondary">Current Revised ETA:</span>
                  <span className="font-mono">
                    {issue.tracking.current_expected_delivery_date
                      ? formatDateIST(issue.tracking.current_expected_delivery_date)
                      : '—'}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-ink-muted">PO line record not loaded.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-divider">
        <div className="flex space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('followups')}
            className={`pb-3 transition-colors ${activeTab === 'followups'
                ? 'border-b-2 border-forest text-forest font-semibold'
                : 'text-ink-secondary hover:text-ink-primary'
              }`}
          >
            Follow-up Timeline ({issue.followups?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('escalations')}
            className={`pb-3 transition-colors ${activeTab === 'escalations'
                ? 'border-b-2 border-forest text-forest font-semibold'
                : 'text-ink-secondary hover:text-ink-primary'
              }`}
          >
            Escalation History ({issue.escalations?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('resolution')}
            className={`pb-3 transition-colors ${activeTab === 'resolution'
                ? 'border-b-2 border-forest text-forest font-semibold'
                : 'text-ink-secondary hover:text-ink-primary'
              }`}
          >
            Resolution Details
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 transition-colors ${activeTab === 'audit'
                ? 'border-b-2 border-forest text-forest font-semibold'
                : 'text-ink-secondary hover:text-ink-primary'
              }`}
          >
            Audit Trail ({issue.events?.length || 0})
          </button>
        </div>
      </div>

      {/* Tab 1: Follow-up Timeline */}
      {activeTab === 'followups' && (
        <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
          <CardContent className="p-4 space-y-4">
            {(issue.followups || []).length === 0 ? (
              <div className="py-12 text-center text-xs text-ink-muted">
                No supplier follow-ups recorded yet. Click "Log Follow-up" above to document supplier interaction.
              </div>
            ) : (
              <div className="space-y-3">
                {issue.followups?.map((fu) => (
                  <div key={fu.id} className="rounded-lg border border-divider bg-ivory p-3.5 text-xs space-y-2">
                    <div className="flex justify-between items-center border-b border-divider/50 pb-2">
                      <div className="flex items-center space-x-2">
                        <span className="rounded bg-sage-pale px-2 py-0.5 text-[11px] font-semibold text-forest border border-sage/50">
                          {fu.contact_method}
                        </span>
                        <span className="text-ink-secondary text-[11px]">
                          with <strong>{fu.contact_person || 'Supplier Contact'}</strong>
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-ink-muted">
                        {formatDateIST(fu.followup_date)}
                      </span>
                    </div>

                    {fu.supplier_response && (
                      <div>
                        <span className="text-[10px] text-ink-secondary uppercase block font-semibold">
                          Supplier Response
                        </span>
                        <p className="text-ink-primary whitespace-pre-wrap">{fu.supplier_response}</p>
                      </div>
                    )}

                    {fu.committed_action && (
                      <div>
                        <span className="text-[10px] text-ink-secondary uppercase block font-semibold">
                          Committed Recovery Action
                        </span>
                        <p className="text-forest font-medium">{fu.committed_action}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-4 pt-2 border-t border-divider/40 text-[11px] text-ink-secondary">
                      {fu.revised_expected_date && (
                        <div>
                          Revised ETA: <strong>{formatDateIST(fu.revised_expected_date)}</strong>
                        </div>
                      )}
                      {fu.next_followup_date && (
                        <div>
                          Next Follow-up: <strong>{formatDateIST(fu.next_followup_date)}</strong>
                        </div>
                      )}
                      <div>
                        Logged by: <strong>{fu.initiator?.full_name || 'SCM Employee'}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Escalations */}
      {activeTab === 'escalations' && (
        <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
          <CardContent className="p-4 space-y-4">
            {(issue.escalations || []).length === 0 ? (
              <div className="py-12 text-center text-xs text-ink-muted">
                No escalations triggered for this delivery issue.
              </div>
            ) : (
              <div className="space-y-3">
                {issue.escalations?.map((esc) => (
                  <div key={esc.id} className="rounded-lg border border-copper/30 bg-ivory p-3.5 text-xs space-y-2">
                    <div className="flex justify-between items-center border-b border-divider/50 pb-2">
                      <span className="rounded bg-copper/15 px-2 py-0.5 text-xs font-bold text-copper">
                        {esc.escalation_level}
                      </span>
                      <span className="font-mono text-[11px] text-ink-muted">
                        {formatDateIST(esc.escalated_at)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-ink-secondary uppercase block font-semibold">
                        Trigger Rationale
                      </span>
                      <p className="text-ink-primary font-medium">{esc.trigger_reason}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-ink-secondary uppercase block font-semibold">
                        Required Action from Leadership
                      </span>
                      <p className="text-ink-primary">{esc.required_action}</p>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-divider/40 text-[11px] text-ink-secondary">
                      <span>Status: <strong className="text-copper">{esc.escalation_status}</strong></span>
                      {esc.expected_response_date && (
                        <span>Target Response: <strong>{formatDateIST(esc.expected_response_date)}</strong></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Resolution */}
      {activeTab === 'resolution' && (
        <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
          <CardContent className="p-5">
            {issue.resolution ? (
              <div className="space-y-3 text-xs">
                <div className="rounded-lg bg-status-success/10 border border-status-success/30 p-3 text-status-success font-semibold flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  <span>Category: {issue.resolution.resolution_category}</span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-ink-secondary uppercase block mb-1">
                    Resolution Explanation
                  </span>
                  <p className="rounded bg-ivory p-3 border border-divider/60 whitespace-pre-wrap">
                    {issue.resolution.resolution_description}
                  </p>
                </div>
                {issue.resolution.next_operational_action && (
                  <div>
                    <span className="text-[11px] font-semibold text-ink-secondary uppercase block mb-1">
                      Next Operational Action
                    </span>
                    <p>{issue.resolution.next_operational_action}</p>
                  </div>
                )}
                <div className="text-[11px] text-ink-muted pt-2 border-t border-divider/50">
                  Resolved at: {formatDateIST(issue.resolution.resolved_at)}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-ink-muted">
                Issue is currently unresolved. Click "Resolve" above once the delivery discrepancy has been addressed.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 4: Audit Trail */}
      {activeTab === 'audit' && (
        <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
          <CardContent className="p-4 space-y-3">
            {(issue.events || []).length === 0 ? (
              <div className="py-12 text-center text-xs text-ink-muted">No audit events recorded.</div>
            ) : (
              <div className="divide-y divide-divider/50 text-xs">
                {issue.events?.map((ev) => (
                  <div key={ev.id} className="py-2.5 flex justify-between items-start">
                    <div>
                      <span className="font-bold text-forest">{ev.event_type}</span>: {ev.change_reason}
                    </div>
                    <span className="font-mono text-[11px] text-ink-muted flex-shrink-0 ml-4">
                      {new Date(ev.performed_at).toLocaleTimeString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal: Log Follow-up */}
      {isFollowupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-divider bg-ivory-surface shadow-warm-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-divider px-6 py-4">
              <h3 className="text-base font-bold text-forest">Log Supplier Follow-up</h3>
              <button
                onClick={() => setIsFollowupModalOpen(false)}
                className="rounded-lg p-1 text-ink-muted hover:bg-ivory"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleFollowupSubmit} className="p-6 space-y-3.5 overflow-y-auto text-xs">
              {fuError && <div className="text-status-error font-medium">{fuError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Contact Method *</Label>
                  <select
                    value={fuContactMethod}
                    onChange={(e) => setFuContactMethod(e.target.value as any)}
                    className="mt-1 block w-full rounded border border-divider bg-ivory px-2.5 py-1.5"
                  >
                    <option value="Phone">Phone</option>
                    <option value="Email">Email</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <Label>Supplier Contact Person</Label>
                  <Input
                    type="text"
                    value={fuContactPerson}
                    onChange={(e) => setFuContactPerson(e.target.value)}
                    placeholder="e.g. Rajesh Kumar"
                    className="mt-1 h-8 text-xs bg-ivory"
                  />
                </div>
              </div>

              <div>
                <Label>Supplier Response / Reason Given</Label>
                <textarea
                  rows={2}
                  value={fuSupplierResponse}
                  onChange={(e) => setFuSupplierResponse(e.target.value)}
                  placeholder="Summary of what the vendor stated..."
                  className="mt-1 block w-full rounded border border-divider bg-ivory p-2"
                />
              </div>

              <div>
                <Label>Committed Recovery Action</Label>
                <Input
                  type="text"
                  value={fuCommittedAction}
                  onChange={(e) => setFuCommittedAction(e.target.value)}
                  placeholder="e.g. Express air courier dispatch by tomorrow morning"
                  className="mt-1 h-8 text-xs bg-ivory"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Revised Expected Delivery Date</Label>
                  <Input
                    type="date"
                    value={fuRevisedDate}
                    onChange={(e) => setFuRevisedDate(e.target.value)}
                    className="mt-1 h-8 text-xs bg-ivory"
                  />
                </div>
                <div>
                  <Label>Next Follow-up Date</Label>
                  <Input
                    type="date"
                    value={fuNextFollowupDate}
                    onChange={(e) => setFuNextFollowupDate(e.target.value)}
                    className="mt-1 h-8 text-xs bg-ivory"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-divider">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsFollowupModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={fuSubmitting} className="bg-forest text-sage">
                  {fuSubmitting ? 'Saving...' : 'Record Follow-up'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Escalate */}
      {isEscalateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-divider bg-ivory-surface shadow-warm-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-divider px-6 py-4">
              <h3 className="text-base font-bold text-copper">Escalate Delivery Issue</h3>
              <button onClick={() => setIsEscalateModalOpen(false)} className="p-1 text-ink-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleEscalateSubmit} className="p-6 space-y-3.5 text-xs">
              {escError && <div className="text-status-error font-medium">{escError}</div>}
              <div>
                <Label>Escalation Level *</Label>
                <select
                  value={escLevel}
                  onChange={(e) => setEscLevel(e.target.value)}
                  className="mt-1 block w-full rounded border border-divider bg-ivory px-2.5 py-1.5"
                >
                  <option value="Level 1 - SCM Lead">Level 1 - SCM Lead</option>
                  <option value="Level 2 - Procurement Head">Level 2 - Procurement Head</option>
                  <option value="Level 3 - Plant/Executive Leadership">Level 3 - Plant/Executive Leadership</option>
                </select>
              </div>

              <div>
                <Label>Trigger Reason *</Label>
                <textarea
                  rows={2}
                  required
                  value={escTriggerReason}
                  onChange={(e) => setEscTriggerReason(e.target.value)}
                  placeholder="e.g. Vendor uncontactable for 3 days; batch schedule affected"
                  className="mt-1 block w-full rounded border border-divider bg-ivory p-2"
                />
              </div>

              <div>
                <Label>Required Action from Recipient *</Label>
                <Input
                  type="text"
                  required
                  value={escRequiredAction}
                  onChange={(e) => setEscRequiredAction(e.target.value)}
                  placeholder="e.g. Commercial escalation to vendor managing director"
                  className="mt-1 h-8 text-xs bg-ivory"
                />
              </div>

              <div>
                <Label>Target Expected Response Date</Label>
                <Input
                  type="date"
                  value={escExpectedResponseDate}
                  onChange={(e) => setEscExpectedResponseDate(e.target.value)}
                  className="mt-1 h-8 text-xs bg-ivory"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-divider">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsEscalateModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={escSubmitting} className="bg-copper text-white">
                  {escSubmitting ? 'Escalating...' : 'Submit Escalation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Resolve */}
      {isResolveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-divider bg-ivory-surface shadow-warm-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-divider px-6 py-4">
              <h3 className="text-base font-bold text-status-success">Resolve Delivery Issue</h3>
              <button onClick={() => setIsResolveModalOpen(false)} className="p-1 text-ink-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleResolveSubmit} className="p-6 space-y-3.5 text-xs">
              {resError && <div className="text-status-error font-medium">{resError}</div>}
              <div>
                <Label>Resolution Category *</Label>
                <select
                  value={resCategory}
                  onChange={(e) => setResCategory(e.target.value)}
                  className="mt-1 block w-full rounded border border-divider bg-ivory px-2.5 py-1.5"
                >
                  <option value="Full quantity delivered">Full quantity delivered</option>
                  <option value="Supplier provided confirmed recovery plan">Supplier provided confirmed recovery plan</option>
                  <option value="Supplier corrected delivery information">Supplier corrected delivery information</option>
                  <option value="Incorrect material discrepancy addressed through responsible external process">
                    Incorrect material discrepancy addressed through responsible external process
                  </option>
                  <option value="Damaged material issue referred to relevant quality process">
                    Damaged material issue referred to relevant quality process
                  </option>
                  <option value="Other documented resolution">Other documented resolution</option>
                </select>
              </div>

              <div>
                <Label>Resolution Explanation & Evidence Summary *</Label>
                <textarea
                  rows={3}
                  required
                  value={resDescription}
                  onChange={(e) => setResDescription(e.target.value)}
                  placeholder="Detail how the issue was resolved..."
                  className="mt-1 block w-full rounded border border-divider bg-ivory p-2"
                />
              </div>

              <div>
                <Label>Next Operational Action (if any)</Label>
                <Input
                  type="text"
                  value={resNextAction}
                  onChange={(e) => setResNextAction(e.target.value)}
                  placeholder="e.g. Awaiting final quality test release note"
                  className="mt-1 h-8 text-xs bg-ivory"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-divider">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsResolveModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={resSubmitting} className="bg-status-success text-white">
                  {resSubmitting ? 'Resolving...' : 'Confirm Resolution'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reassign Owner */}
      {isReassignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-divider bg-ivory-surface shadow-warm-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-forest">Reassign Issue Owner</h3>
            <form onSubmit={handleReassignSubmit} className="space-y-3 text-xs">
              {reassignError && <div className="text-status-error">{reassignError}</div>}
              <div>
                <Label>New Accountable Owner *</Label>
                <select
                  value={reassignTargetId}
                  onChange={(e) => setReassignTargetId(e.target.value)}
                  required
                  className="mt-1 block w-full rounded border border-divider bg-ivory p-2"
                >
                  <option value="">Select Employee...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Reassignment Rationale *</Label>
                <textarea
                  rows={2}
                  required
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="Explain why issue responsibility is being transferred..."
                  className="mt-1 block w-full rounded border border-divider bg-ivory p-2"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsReassignModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={reassignSubmitting} className="bg-forest text-sage">
                  Reassign
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Transition / Reopen */}
      {isTransitionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-divider bg-ivory-surface shadow-warm-xl p-6 space-y-4">
            <h3 className="text-base font-bold text-forest">
              {transitionTargetStatus === 'Closed' ? 'Confirm Issue Closure' : 'Reopen Delivery Issue'}
            </h3>
            <form onSubmit={handleTransitionSubmit} className="space-y-3 text-xs">
              {transitionError && <div className="text-status-error">{transitionError}</div>}
              <div>
                <Label>Reason / Documentation *</Label>
                <textarea
                  rows={3}
                  required
                  value={transitionReason}
                  onChange={(e) => setTransitionReason(e.target.value)}
                  placeholder={
                    transitionTargetStatus === 'Closed'
                      ? 'Confirm that all delivery discrepancies are resolved and no further follow-up is pending...'
                      : 'State why this previously closed/resolved delivery issue is being reopened...'
                  }
                  className="mt-1 block w-full rounded border border-divider bg-ivory p-2"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsTransitionModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={transitionSubmitting} className="bg-forest text-sage">
                  Confirm
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

