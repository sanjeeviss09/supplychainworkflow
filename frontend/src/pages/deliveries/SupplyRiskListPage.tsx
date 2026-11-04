import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertTriangle,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  X,
  FileSpreadsheet,
  AlertOctagon,
  Layers,
} from 'lucide-react';
import {
  BusinessImpactLevel,
  MaterialCriticalityLevel,
  MaterialDeliveryTracking,
  SupplyRiskDashboardMetrics,
  SupplyRiskLevel,
  SupplyRiskRecord,
  SupplyRiskStatus,
} from '@/types/database.types';
import {
  fetchSupplyRisks,
  fetchSupplyRiskMetrics,
  exportSupplyRiskCsv,
  updatePoLineCriticalityAndRequiredDate,
  createRiskMitigationAction,
} from '@/services/supplyRiskService';
import { fetchDeliveryTrackingList } from '@/services/deliveryService';
import { fetchActiveEmployees } from '@/services/employeeService';

export function SupplyRiskListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = useAuth();

  const canExport = hasPermission('supply_risk.export');
  const canUpdate = hasPermission('supply_risk.update') || hasPermission('supply_risk.create');
  const canMitigate = hasPermission('supply_risk.mitigate');

  // State
  const [risks, setRisks] = useState<SupplyRiskRecord[]>([]);
  const [metrics, setMetrics] = useState<SupplyRiskDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [riskLevelFilter, setRiskLevelFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [criticalityFilter, setCriticalityFilter] = useState('ALL');

  // Modals
  const [showCriticalityModal, setShowCriticalityModal] = useState(false);
  const [showMitigationModal, setShowMitigationModal] = useState(false);
  const [selectedRiskForAction, setSelectedRiskForAction] = useState<SupplyRiskRecord | null>(null);

  // Form states
  const [trackingList, setTrackingList] = useState<MaterialDeliveryTracking[]>([]);
  const [employees, setEmployees] = useState<{ id: string; full_name: string; employee_id: string }[]>([]);
  const [formTrackingId, setFormTrackingId] = useState('');
  const [formCriticality, setFormCriticality] = useState<MaterialCriticalityLevel>('High');
  const [formImpact, setFormImpact] = useState<BusinessImpactLevel>('High');
  const [formRequiredDate, setFormRequiredDate] = useState('');
  const [formReason, setFormReason] = useState('');
  const [isSubmittingCriticality, setIsSubmittingCriticality] = useState(false);
  const [criticalityError, setCriticalityError] = useState<string | null>(null);

  // Mitigation form state
  const [actionTitle, setActionTitle] = useState('');
  const [actionDesc, setActionDesc] = useState('');
  const [actionEmployeeId, setActionEmployeeId] = useState('');
  const [actionDueDate, setActionDueDate] = useState('');
  const [actionPriority, setActionPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('High');
  const [isSubmittingMitigation, setIsSubmittingMitigation] = useState(false);
  const [mitigationError, setMitigationError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedRisks, fetchedMetrics, fetchedTrackings, fetchedEmployees] = await Promise.all([
        fetchSupplyRisks({
          status: statusFilter,
          riskLevel: riskLevelFilter,
          category: categoryFilter,
          criticality: criticalityFilter,
          search,
        }),
        fetchSupplyRiskMetrics(),
        fetchDeliveryTrackingList(),
        fetchActiveEmployees(),
      ]);

      setRisks(fetchedRisks);
      setMetrics(fetchedMetrics);
      setTrackingList(fetchedTrackings?.data || []);
      setEmployees(fetchedEmployees);
    } catch (err) {
      console.error('Failed to load supply risk data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, riskLevelFilter, categoryFilter, criticalityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleExport = () => {
    if (!canExport) return;
    exportSupplyRiskCsv(risks);
  };

  const handleOpenMitigationModal = (risk: SupplyRiskRecord) => {
    setSelectedRiskForAction(risk);
    setActionTitle('');
    setActionDesc('');
    setActionEmployeeId(employees[0]?.id || '');
    const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setActionDueDate(in3Days);
    setActionPriority(risk.risk_level === 'Critical' ? 'Critical' : 'High');
    setMitigationError(null);
    setShowMitigationModal(true);
  };

  const handleSubmitCriticality = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTrackingId) {
      setCriticalityError('Please select a PO Line tracking item.');
      return;
    }

    setIsSubmittingCriticality(true);
    setCriticalityError(null);

    const res = await updatePoLineCriticalityAndRequiredDate({
      trackingId: formTrackingId,
      criticality: formCriticality,
      businessImpact: formImpact,
      requiredByDate: formRequiredDate || null,
      reason: formReason || null,
    });

    setIsSubmittingCriticality(false);

    if (res.success) {
      setShowCriticalityModal(false);
      setFormTrackingId('');
      setFormRequiredDate('');
      setFormReason('');
      loadData();
      if (res.risk_id) {
        navigate(`/app/deliveries/risks/${res.risk_id}`);
      }
    } else {
      setCriticalityError(res.error || 'Failed to update criticality.');
    }
  };

  const handleSubmitMitigation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRiskForAction || !actionTitle.trim() || !actionEmployeeId || !actionDueDate) {
      setMitigationError('Please complete all required fields.');
      return;
    }

    setIsSubmittingMitigation(true);
    setMitigationError(null);

    const res = await createRiskMitigationAction({
      riskId: selectedRiskForAction.id,
      actionTitle,
      actionDescription: actionDesc,
      assignedEmployeeId: actionEmployeeId,
      dueDate: actionDueDate,
      priority: actionPriority,
    });

    setIsSubmittingMitigation(false);

    if (res.success) {
      setShowMitigationModal(false);
      loadData();
    } else {
      setMitigationError(res.error || 'Failed to schedule mitigation action.');
    }
  };

  const getRiskLevelBadge = (level: SupplyRiskLevel) => {
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

  const getStatusBadge = (status: SupplyRiskStatus) => {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <span className="rounded bg-forest/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-forest border border-forest/20">
              Phase 11
            </span>
            <span className="text-xs text-ink-secondary">•</span>
            <span className="text-xs font-medium text-ink-secondary">Real-Time Risk Scoring</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-forest">
            Material Supply Risk & Criticality Management
          </h1>
          <p className="mt-0.5 text-xs text-ink-secondary">
            Identify incoming delivery risks, assess operational impact, and assign mitigation actions against SAP PO lines.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="border-divider bg-ivory-surface hover:bg-ivory"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {canExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={risks.length === 0}
              className="border-divider bg-ivory-surface hover:bg-ivory text-forest"
            >
              <Download className="h-3.5 w-3.5 mr-1.5 text-forest" />
              Export CSV
            </Button>
          )}

          {canUpdate && (
            <Button
              size="sm"
              onClick={() => {
                setShowCriticalityModal(true);
                setCriticalityError(null);
              }}
              className="bg-forest text-ivory hover:bg-forest-deep shadow-warm-sm"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Assess Line Risk
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total Active */}
        <Card className="border-divider bg-ivory-surface p-3.5 shadow-warm-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-secondary">Active Risks</span>
            <ShieldAlert className="h-4 w-4 text-forest" />
          </div>
          <div className="mt-2 text-2xl font-bold text-forest">
            {metrics?.totalActiveRisks ?? '—'}
          </div>
          <p className="text-[10px] text-ink-muted">Identified or Monitoring</p>
        </Card>

        {/* Critical */}
        <Card className="border-red-200 bg-red-50/50 p-3.5 shadow-warm-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-800">Critical Risks</span>
            <AlertOctagon className="h-4 w-4 text-red-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-red-700">
            {metrics?.criticalRisksCount ?? '—'}
          </div>
          <p className="text-[10px] text-red-600/80">Score ≥ 70 / 100</p>
        </Card>

        {/* High */}
        <Card className="border-amber-200 bg-amber-50/50 p-3.5 shadow-warm-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">High Risks</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700">
            {metrics?.highRisksCount ?? '—'}
          </div>
          <p className="text-[10px] text-amber-700/80">Score 45 – 69</p>
        </Card>

        {/* Medium & Low */}
        <Card className="border-divider bg-ivory-surface p-3.5 shadow-warm-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-secondary">Medium / Low</span>
            <TrendingUp className="h-4 w-4 text-sage-dark" />
          </div>
          <div className="mt-2 text-2xl font-bold text-ink-primary">
            {(metrics?.mediumRisksCount || 0) + (metrics?.lowRisksCount || 0)}
          </div>
          <p className="text-[10px] text-ink-muted">Controlled exposure</p>
        </Card>

        {/* Overdue Mitigation Actions */}
        <Card className="border-red-200 bg-ivory-surface p-3.5 shadow-warm-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-secondary">Overdue Actions</span>
            <Clock className="h-4 w-4 text-status-danger" />
          </div>
          <div className="mt-2 text-2xl font-bold text-status-danger">
            {metrics?.overdueActionsCount ?? '—'}
          </div>
          <p className="text-[10px] text-ink-muted">Past scheduled due date</p>
        </Card>

        {/* Resolved */}
        <Card className="border-divider bg-ivory-surface p-3.5 shadow-warm-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-secondary">Resolved Risks</span>
            <CheckCircle2 className="h-4 w-4 text-status-success" />
          </div>
          <div className="mt-2 text-2xl font-bold text-status-success">
            {metrics?.resolvedRisksCount ?? '—'}
          </div>
          <p className="text-[10px] text-ink-muted">Mitigated or Closed</p>
        </Card>
      </div>

      {/* Category Breakdown Bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-divider bg-ivory-surface p-2 text-xs">
        <span className="font-semibold text-ink-secondary px-2">Category Breakdown:</span>
        {metrics?.categoryBreakdown.map((cb) => (
          <button
            key={cb.category}
            onClick={() => setCategoryFilter(categoryFilter === cb.category ? 'ALL' : cb.category)}
            className={`flex items-center space-x-1.5 rounded-full px-3 py-1 font-medium transition-colors ${
              categoryFilter === cb.category
                ? 'bg-forest text-ivory'
                : 'bg-ivory text-ink-secondary hover:bg-sage-pale/50 border border-divider/60'
            }`}
          >
            <span>{cb.category}</span>
            <span className="rounded-full bg-forest/20 px-1.5 py-0.2 text-[10px] font-bold">
              {cb.activeCount}
            </span>
            {cb.criticalCount > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.2 text-[9px] text-white">
                {cb.criticalCount} crit
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters & Search */}
      <Card className="border-divider bg-ivory-surface shadow-warm-sm">
        <CardContent className="p-3.5">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-5">
            <div className="relative md:col-span-2">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-muted" />
              <Input
                placeholder="Search PO #, line, material, supplier, risk #..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs border-divider bg-ivory"
              />
            </div>

            <div>
              <select
                aria-label="Filter by Risk Level"
                value={riskLevelFilter}
                onChange={(e) => setRiskLevelFilter(e.target.value)}
                className="w-full rounded-md border border-divider bg-ivory px-2.5 py-2 text-xs font-medium text-ink-primary focus:outline-none focus:ring-1 focus:ring-forest"
              >
                <option value="ALL">All Risk Levels</option>
                <option value="Critical">Critical (Score ≥ 70)</option>
                <option value="High">High (Score 45–69)</option>
                <option value="Medium">Medium (Score 25–44)</option>
                <option value="Low">Low (Score &lt; 25)</option>
              </select>
            </div>

            <div>
              <select
                aria-label="Filter by Risk Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-md border border-divider bg-ivory px-2.5 py-2 text-xs font-medium text-ink-primary focus:outline-none focus:ring-1 focus:ring-forest"
              >
                <option value="ALL">All Statuses</option>
                <option value="Identified">Identified</option>
                <option value="Under Assessment">Under Assessment</option>
                <option value="Mitigation Planned">Mitigation Planned</option>
                <option value="Monitoring">Monitoring</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div>
              <select
                aria-label="Filter by Material Criticality"
                value={criticalityFilter}
                onChange={(e) => setCriticalityFilter(e.target.value)}
                className="w-full rounded-md border border-divider bg-ivory px-2.5 py-2 text-xs font-medium text-ink-primary focus:outline-none focus:ring-1 focus:ring-forest"
              >
                <option value="ALL">All Criticalities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Risk Register Table */}
      <Card className="border-divider bg-ivory-surface shadow-warm-sm">
        <CardHeader className="border-b border-divider/60 px-5 py-3.5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-forest">
              Supply Risk Register ({risks.length})
            </CardTitle>
            <span className="text-[11px] text-ink-muted">
              Auto-scored based on Material Criticality, Business Impact, and Delivery Schedule
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-divider bg-ivory/60 text-ink-secondary">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Risk # / Status</th>
                  <th className="px-4 py-2.5 font-semibold">Material / Category</th>
                  <th className="px-4 py-2.5 font-semibold">SAP Reference</th>
                  <th className="px-4 py-2.5 font-semibold">Supplier</th>
                  <th className="px-4 py-2.5 font-semibold">Delivery Dates (Committed / ETA / Required)</th>
                  <th className="px-4 py-2.5 font-semibold">Risk Score & Level</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider/60 text-ink-primary">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-ink-muted">
                      <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-forest" />
                      Loading Supply Risk Register...
                    </td>
                  </tr>
                ) : risks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-ink-muted">
                      <ShieldAlert className="mx-auto mb-2 h-7 w-7 text-ink-muted/60" />
                      No supply risks matching the selected filters.
                    </td>
                  </tr>
                ) : (
                  risks.map((risk) => {
                    const isBreached =
                      risk.current_expected_delivery_date &&
                      risk.required_by_date &&
                      risk.current_expected_delivery_date > risk.required_by_date;

                    return (
                      <tr
                        key={risk.id}
                        className="transition-colors hover:bg-sage-pale/20 cursor-pointer"
                        onClick={() => navigate(`/app/deliveries/risks/${risk.id}`)}
                      >
                        {/* Risk Number & Status */}
                        <td className="px-4 py-3">
                          <div className="font-mono font-semibold text-forest">
                            {risk.risk_number}
                          </div>
                          <span
                            className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusBadge(
                              risk.status
                            )}`}
                          >
                            {risk.status}
                          </span>
                        </td>

                        {/* Material & Criticality */}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-ink-primary line-clamp-1">
                            {risk.material_description}
                          </div>
                          <div className="mt-0.5 flex items-center space-x-1.5 text-[11px] text-ink-secondary">
                            <span className="font-mono text-ink-muted">{risk.material_code || '—'}</span>
                            <span>•</span>
                            <span className="font-semibold text-forest">{risk.category}</span>
                            <span>•</span>
                            <span className="text-[10px] rounded bg-ivory px-1.5 py-0.2 border border-divider">
                              Crit: {risk.material_criticality}
                            </span>
                          </div>
                        </td>

                        {/* SAP Reference */}
                        <td className="px-4 py-3 font-mono">
                          <div className="font-semibold text-forest">{risk.sap_po_number}</div>
                          <div className="text-[11px] text-ink-muted">Line {risk.sap_po_line_number}</div>
                        </td>

                        {/* Supplier */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-ink-primary line-clamp-1">
                            {risk.supplier_name}
                          </div>
                        </td>

                        {/* 3 Dates Comparison */}
                        <td className="px-4 py-3 font-mono text-[11px]">
                          <div className="text-ink-secondary">
                            Committed: {risk.original_committed_delivery_date || '—'}
                          </div>
                          <div className="text-ink-primary font-medium">
                            ETA: {risk.current_expected_delivery_date || '—'}
                          </div>
                          <div className="flex items-center space-x-1 mt-0.5">
                            <span className="font-semibold text-forest">
                              Req: {risk.required_by_date || 'Not specified'}
                            </span>
                            {isBreached && (
                              <span className="rounded bg-red-100 px-1 py-0.2 text-[9px] font-bold text-red-700">
                                Breached!
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Risk Score & Level */}
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${getRiskLevelBadge(
                                risk.risk_level
                              )}`}
                            >
                              {risk.risk_level} ({risk.risk_score})
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-24 rounded-full bg-ivory border border-divider overflow-hidden">
                            <div
                              className={`h-full ${
                                risk.risk_score >= 70
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
                        </td>

                        {/* Actions */}
                        <td
                          className="px-4 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end space-x-1">
                            {canMitigate && !['Resolved', 'Closed'].includes(risk.status) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenMitigationModal(risk)}
                                className="h-7 border-divider bg-ivory text-[11px] hover:bg-sage-pale/60 text-forest"
                              >
                                Plan Action
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/app/deliveries/risks/${risk.id}`)}
                              className="h-7 w-7 p-0 text-ink-muted hover:text-forest"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Modal: Assess Line Risk / Criticality */}
      {showCriticalityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-divider bg-ivory-surface p-6 shadow-warm-xl">
            <div className="flex items-center justify-between border-b border-divider/60 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="h-5 w-5 text-forest" />
                <h3 className="text-base font-bold text-forest">Assess Material Supply Risk</h3>
              </div>
              <button
                onClick={() => setShowCriticalityModal(false)}
                className="text-ink-muted hover:text-ink-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCriticality} className="mt-4 space-y-4 text-xs">
              {criticalityError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-red-700">
                  {criticalityError}
                </div>
              )}

              {/* PO Line Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="lineSelect" className="text-xs">
                  Target SAP PO Line Item <span className="text-red-500">*</span>
                </Label>
                <select
                  id="lineSelect"
                  value={formTrackingId}
                  onChange={(e) => setFormTrackingId(e.target.value)}
                  className="w-full rounded-md border border-divider bg-ivory p-2 text-xs font-medium text-ink-primary focus:outline-none focus:ring-1 focus:ring-forest"
                  required
                >
                  <option value="">-- Select SAP PO & Line --</option>
                  {trackingList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.sap_po_number} (Line {t.sap_po_line_number}) — {t.material_description} [{t.category}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Criticality & Impact */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="criticalitySelect" className="text-xs">
                    Material Criticality
                  </Label>
                  <select
                    id="criticalitySelect"
                    value={formCriticality}
                    onChange={(e) => setFormCriticality(e.target.value as MaterialCriticalityLevel)}
                    className="w-full rounded-md border border-divider bg-ivory p-2 text-xs font-medium text-ink-primary"
                  >
                    <option value="Critical">Critical (+35 pts)</option>
                    <option value="High">High (+25 pts)</option>
                    <option value="Medium">Medium (+15 pts)</option>
                    <option value="Low">Low (+5 pts)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="impactSelect" className="text-xs">
                    Business Impact Level
                  </Label>
                  <select
                    id="impactSelect"
                    value={formImpact}
                    onChange={(e) => setFormImpact(e.target.value as BusinessImpactLevel)}
                    className="w-full rounded-md border border-divider bg-ivory p-2 text-xs font-medium text-ink-primary"
                  >
                    <option value="Critical">Critical (+30 pts)</option>
                    <option value="High">High (+20 pts)</option>
                    <option value="Medium">Medium (+10 pts)</option>
                    <option value="Low">Low (+0 pts)</option>
                  </select>
                </div>
              </div>

              {/* Internal Required-by Date */}
              <div className="space-y-1.5">
                <Label htmlFor="reqDate" className="text-xs">
                  Internal Operational Required-by Date
                </Label>
                <Input
                  id="reqDate"
                  type="date"
                  value={formRequiredDate}
                  onChange={(e) => setFormRequiredDate(e.target.value)}
                  className="border-divider bg-ivory text-xs"
                />
                <p className="text-[10px] text-ink-muted">
                  The date operations or batch formulation requires this material. If ETA exceeds this, an alert breach is triggered.
                </p>
              </div>

              {/* Reason / Remarks */}
              <div className="space-y-1.5">
                <Label htmlFor="formReason" className="text-xs">
                  Operational Justification / Reason
                </Label>
                <textarea
                  id="formReason"
                  rows={2}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="e.g. Essential batch formulation date set for production line 2"
                  className="w-full rounded-md border border-divider bg-ivory p-2 text-xs text-ink-primary focus:outline-none focus:ring-1 focus:ring-forest"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCriticalityModal(false)}
                  className="border-divider bg-ivory"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingCriticality}
                  className="bg-forest text-ivory hover:bg-forest-deep"
                >
                  {isSubmittingCriticality ? 'Evaluating Risk...' : 'Evaluate & Save'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Schedule Mitigation Action */}
      {showMitigationModal && selectedRiskForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-divider bg-ivory-surface p-6 shadow-warm-xl">
            <div className="flex items-center justify-between border-b border-divider/60 pb-3">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-forest" />
                <div>
                  <h3 className="text-base font-bold text-forest">Schedule Mitigation Action</h3>
                  <p className="text-[11px] text-ink-secondary">
                    {selectedRiskForAction.risk_number} — {selectedRiskForAction.material_description}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMitigationModal(false)}
                className="text-ink-muted hover:text-ink-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitMitigation} className="mt-4 space-y-4 text-xs">
              {mitigationError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-red-700">
                  {mitigationError}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="actionTitle" className="text-xs">
                  Action Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="actionTitle"
                  value={actionTitle}
                  onChange={(e) => setActionTitle(e.target.value)}
                  placeholder="e.g. Expedite customs clearance with broker"
                  className="border-divider bg-ivory text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="actionDesc" className="text-xs">
                  Detailed Operational Description
                </Label>
                <textarea
                  id="actionDesc"
                  rows={2}
                  value={actionDesc}
                  onChange={(e) => setActionDesc(e.target.value)}
                  placeholder="Steps to be taken to eliminate or minimize operational risk"
                  className="w-full rounded-md border border-divider bg-ivory p-2 text-xs text-ink-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="assignedEmployee" className="text-xs">
                    Assigned Owner <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="assignedEmployee"
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
                  <Label htmlFor="actionDueDate" className="text-xs">
                    Target Due Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="actionDueDate"
                    type="date"
                    value={actionDueDate}
                    onChange={(e) => setActionDueDate(e.target.value)}
                    className="border-divider bg-ivory text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="actionPriority" className="text-xs">
                  Action Priority
                </Label>
                <select
                  id="actionPriority"
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
                  onClick={() => setShowMitigationModal(false)}
                  className="border-divider bg-ivory"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingMitigation}
                  className="bg-forest text-ivory hover:bg-forest-deep"
                >
                  {isSubmittingMitigation ? 'Assigning...' : 'Assign Action'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
