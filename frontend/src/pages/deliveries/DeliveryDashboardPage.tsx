import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  fetchDeliveryTrackingList,
  fetchDeliveryDashboardMetrics,
  recordMaterialDelivery,
  submitDailyDelayRemark,
  DeliveryFilters,
} from '@/services/deliveryService';
import {
  DelayReasonCategory,
  DeliveryMetrics,
  DeliveryTrackingStatus,
  MaterialDeliveryTracking,
} from '@/types/database.types';
import { calculateDeliveryMetrics, getTodayISTDate } from '@/lib/deliveryCalculations';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Truck,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  FileSpreadsheet,
  Users,
  Eye,
  Building,
  FolderKanban,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  BarChart3,
  CalendarClock,
  MessageSquareWarning,
  ShieldAlert,
  FileText,
} from 'lucide-react';
import { formatDateIST } from '@/lib/formatters';

export function DeliveryDashboardPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const [trackingList, setTrackingList] = useState<MaterialDeliveryTracking[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<DeliveryMetrics | null>(null);

  // Active view filter tab
  const [viewTab, setViewTab] = useState<'all' | 'delayed' | 'partial' | 'upcoming' | 'awaiting_schedule' | 'completed' | 'cancelled'>('all');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<DeliveryTrackingStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'sap_po_number' | 'current_expected_delivery_date' | 'delivery_status' | 'ordered_quantity' | 'updated_at'>('current_expected_delivery_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Quick Action Modals
  const [deliveryModalRecord, setDeliveryModalRecord] = useState<MaterialDeliveryTracking | null>(null);
  const [deliveredQty, setDeliveredQty] = useState('');
  const [actualDate, setActualDate] = useState(getTodayISTDate());
  const [challanRef, setChallanRef] = useState('');
  const [deliveryRemarks, setDeliveryRemarks] = useState('');
  const [deliverySubmitting, setDeliverySubmitting] = useState(false);
  const [deliveryModalError, setDeliveryModalError] = useState<string | null>(null);

  const [delayModalRecord, setDelayModalRecord] = useState<MaterialDeliveryTracking | null>(null);
  const [delayReasonCat, setDelayReasonCat] = useState<DelayReasonCategory>('Supplier Manufacturing Delay');
  const [delayExplanation, setDelayExplanation] = useState('');
  const [supplierContacted, setSupplierContacted] = useState(true);
  const [supplierUpdate, setSupplierUpdate] = useState('');
  const [revisedDate, setRevisedDate] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [nextFollowupDate, setNextFollowupDate] = useState(getTodayISTDate());
  const [delaySubmitting, setDelaySubmitting] = useState(false);
  const [delayModalError, setDelayModalError] = useState<string | null>(null);

  // Permissions
  const canRegisterSapPo = hasPermission('sap_references.create');
  const canViewReports = hasPermission('delivery_reports.view');
  const canRecordDelivery = hasPermission('delivery_updates.create');
  const canUpdateTracking = hasPermission('delivery_tracking.update');

  const todayIST = getTodayISTDate();

  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const filters: DeliveryFilters = {
        searchTerm: searchTerm.trim() || undefined,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        delayedOnly: viewTab === 'delayed',
        partialOnly: viewTab === 'partial',
        upcomingOnly: viewTab === 'upcoming',
        sortBy,
        sortOrder,
        page,
        pageSize,
      };

      if (viewTab === 'awaiting_schedule') {
        filters.status = 'AWAITING_SCHEDULE';
      } else if (viewTab === 'completed') {
        filters.status = 'DELIVERED';
      } else if (viewTab === 'cancelled') {
        filters.status = 'CANCELLED';
      }

      const [listRes, metricsRes] = await Promise.all([
        fetchDeliveryTrackingList(filters),
        fetchDeliveryDashboardMetrics(),
      ]);

      if (listRes.error) {
        setErrorMsg(listRes.error);
      } else {
        setTrackingList(listRes.data);
        setTotalCount(listRes.totalCount);
      }

      if (metricsRes.data) {
        setMetrics(metricsRes.data);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load delivery tracking dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [viewTab, categoryFilter, statusFilter, sortBy, sortOrder, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadData();
  };

  const handleQuickDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryModalRecord) return;

    const qty = parseFloat(deliveredQty);
    if (!qty || qty <= 0) {
      setDeliveryModalError('Delivered quantity must be greater than zero.');
      return;
    }

    try {
      setDeliverySubmitting(true);
      setDeliveryModalError(null);

      const res = await recordMaterialDelivery({
        tracking_id: deliveryModalRecord.id,
        delivery_quantity: qty,
        actual_delivery_date: actualDate,
        supplier_delivery_reference: challanRef.trim() || undefined,
        delivery_remarks: deliveryRemarks.trim() || undefined,
      });

      if (!res.success) throw new Error(res.error || 'Failed to record delivery.');

      setDeliveryModalRecord(null);
      loadData();
    } catch (err: any) {
      setDeliveryModalError(err?.message || 'Failed to save delivery shipment.');
    } finally {
      setDeliverySubmitting(false);
    }
  };

  const handleQuickDelayRemarkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delayModalRecord) return;

    if (!delayExplanation.trim()) {
      setDelayModalError('Delay explanation cannot be blank.');
      return;
    }
    if (!correctiveAction.trim()) {
      setDelayModalError('Corrective action plan is required.');
      return;
    }
    if (!nextFollowupDate) {
      setDelayModalError('Next follow-up date is required.');
      return;
    }
    if (supplierContacted && !supplierUpdate.trim()) {
      setDelayModalError('Supplier communication update is required.');
      return;
    }

    try {
      setDelaySubmitting(true);
      setDelayModalError(null);

      const res = await submitDailyDelayRemark({
        tracking_id: delayModalRecord.id,
        delay_date: todayIST,
        delay_reason_category: delayReasonCat,
        delay_explanation: delayExplanation.trim(),
        supplier_contacted: supplierContacted,
        supplier_update: supplierUpdate.trim() || undefined,
        revised_expected_date: revisedDate || undefined,
        corrective_action: correctiveAction.trim(),
        next_followup_date: nextFollowupDate,
      });

      if (!res.success) throw new Error(res.error || 'Failed to submit delay remark.');

      setDelayModalRecord(null);
      loadData();
    } catch (err: any) {
      setDelayModalError(err?.message || 'Failed to submit daily delay remark.');
    } finally {
      setDelaySubmitting(false);
    }
  };

  const getStatusBadge = (status: DeliveryTrackingStatus) => {
    switch (status) {
      case 'DELIVERED':
        return <Badge variant="success">DELIVERED</Badge>;
      case 'DELAYED':
        return <Badge variant="destructive">DELAYED</Badge>;
      case 'PARTIALLY_DELIVERED':
        return <Badge variant="secondary">PARTIAL DELIVERY</Badge>;
      case 'SCHEDULED':
        return <Badge variant="outline">SCHEDULED</Badge>;
      case 'AWAITING_SCHEDULE':
        return <Badge variant="secondary">AWAITING SCHEDULE</Badge>;
      case 'AWAITING_PO':
        return <Badge variant="outline">AWAITING PO</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">CANCELLED</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#DEDCCF] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-7 h-7 text-[#0B3B2E]" />
            <h1 className="text-2xl font-bold tracking-tight text-[#182820]">
              SAP Procurement Reference & Material Delivery Tracking
            </h1>
          </div>
          <p className="text-sm text-[#5E6B61] mt-1">
            <strong>SAP manages procurement. SCM Flow manages delivery visibility and accountability.</strong> Live tracking across API, PM, EXE, and Consumables.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="border-[#DEDCCF] text-[#182820] hover:bg-[#F7F3EA]"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/deliveries/my-assigned')}
            className="border-[#0B3B2E] text-[#0B3B2E] hover:bg-[#E8EEDD]"
          >
            <Users className="w-4 h-4 mr-1.5" />
            My Assigned Deliveries
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/deliveries/planning')}
            className="border-forest text-forest hover:bg-forest/10"
          >
            <Calendar className="w-4 h-4 mr-1.5" />
            Planning & Calendar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/deliveries/risks')}
            className="border-red-600/70 text-red-700 hover:bg-red-50"
          >
            <ShieldAlert className="w-4 h-4 mr-1.5 text-red-600" />
            Supply Risks
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/deliveries/issues')}
            className="border-copper text-copper hover:bg-copper/10"
          >
            <ShieldAlert className="w-4 h-4 mr-1.5" />
            Delivery Issues & Escalations
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/documents?group=PO_DELIVERY')}
            className="border-divider text-forest hover:bg-forest/10"
          >
            <FileText className="w-4 h-4 mr-1.5" />
            Delivery Documents
          </Button>

          {canViewReports && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/app/deliveries/reports')}
              className="border-[#DEDCCF] text-[#182820] hover:bg-[#F7F3EA]"
            >
              <BarChart3 className="w-4 h-4 mr-1.5" />
              Reports & Exports
            </Button>
          )}

          {canRegisterSapPo && (
            <Button
              size="sm"
              onClick={() => navigate('/app/deliveries/sap-references/new')}
              className="bg-[#0B3B2E] hover:bg-[#082D24] text-[#FFFEFA]"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Register SAP PO
            </Button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-[#FFFEFA] border border-[#DEDCCF] rounded-lg p-3 text-center shadow-xs">
          <span className="text-xs text-[#5E6B61] block font-medium">Active PO Lines</span>
          <span className="text-xl font-bold text-[#182820]">{metrics?.totalActivePoLines ?? '—'}</span>
        </div>

        <div className="bg-[#FFFEFA] border border-[#DEDCCF] rounded-lg p-3 text-center shadow-xs">
          <span className="text-xs text-[#5E6B61] block font-medium">Awaiting Schedule</span>
          <span className="text-xl font-bold text-[#5E6B61]">{metrics?.awaitingDeliverySchedule ?? '—'}</span>
        </div>

        <div className="bg-[#FFFEFA] border border-[#DEDCCF] rounded-lg p-3 text-center shadow-xs">
          <span className="text-xs text-[#5E6B61] block font-medium">Upcoming</span>
          <span className="text-xl font-bold text-[#0B3B2E]">{metrics?.upcomingDeliveries ?? '—'}</span>
        </div>

        <div className="bg-[#FFFEFA] border border-[#DEDCCF] rounded-lg p-3 text-center shadow-xs">
          <span className="text-xs text-[#5E6B61] block font-medium">Partially Arrived</span>
          <span className="text-xl font-bold text-[#B85C1E]">{metrics?.partiallyDelivered ?? '—'}</span>
        </div>

        <div className="bg-[#FFFEFA] border border-red-200 bg-red-50/50 rounded-lg p-3 text-center shadow-xs">
          <span className="text-xs text-red-700 block font-bold">Delayed</span>
          <span className="text-xl font-bold text-red-700">{metrics?.delayedDeliveries ?? '—'}</span>
        </div>

        <div className="bg-[#FFFEFA] border border-[#A9BE98] bg-[#E8EEDD]/30 rounded-lg p-3 text-center shadow-xs">
          <span className="text-xs text-[#0B3B2E] block font-bold">Fully Delivered</span>
          <span className="text-xl font-bold text-[#0B3B2E]">{metrics?.fullyDelivered ?? '—'}</span>
        </div>

        <div className="bg-[#FFFEFA] border border-amber-200 bg-amber-50/50 rounded-lg p-3 text-center shadow-xs">
          <span className="text-xs text-amber-800 block font-bold">Remarks Pending</span>
          <span className="text-xl font-bold text-amber-800">{metrics?.dailyRemarksPending ?? '—'}</span>
        </div>

        <div className="bg-[#FFFEFA] border border-[#DEDCCF] rounded-lg p-3 text-center shadow-xs">
          <span className="text-xs text-[#5E6B61] block font-medium">Avg Delay</span>
          <span className="text-xl font-bold text-[#182820]">
            {metrics ? `${metrics.averageDelayDays}d` : '—'}
          </span>
        </div>
      </div>

      {/* Delay Period Breakdown Banner */}
      {metrics && metrics.delayedDeliveries > 0 && (
        <div className="p-4 bg-[#FFFEFA] border border-[#DEDCCF] rounded-lg shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-[#182820]">
            <div className="flex items-center gap-1.5 text-red-700">
              <MessageSquareWarning className="w-4 h-4" />
              <span>Delay Aging Breakdown ({metrics.delayedDeliveries} lines overdue):</span>
            </div>
            <span className="text-[#5E6B61]">Longest delay: <strong className="text-red-700">{metrics.longestDelayDays} days</strong></span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <div className="p-2 bg-amber-50 rounded border border-amber-200 text-center">
              <span className="text-[#5E6B61] block">1–3 Days</span>
              <strong className="text-amber-800">{metrics.delayed1To3Days}</strong>
            </div>
            <div className="p-2 bg-orange-50 rounded border border-orange-200 text-center">
              <span className="text-[#5E6B61] block">4–7 Days</span>
              <strong className="text-orange-800">{metrics.delayed4To7Days}</strong>
            </div>
            <div className="p-2 bg-red-50 rounded border border-red-200 text-center">
              <span className="text-[#5E6B61] block">8–15 Days</span>
              <strong className="text-red-700">{metrics.delayed8To15Days}</strong>
            </div>
            <div className="p-2 bg-red-100 rounded border border-red-300 text-center">
              <span className="text-[#5E6B61] block">16–30 Days</span>
              <strong className="text-red-800">{metrics.delayed16To30Days}</strong>
            </div>
            <div className="p-2 bg-red-200 rounded border border-red-400 text-center col-span-2 sm:col-span-1">
              <span className="text-red-950 block">&gt; 30 Days</span>
              <strong className="text-red-950">{metrics.delayedMoreThan30Days}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Sub-Tabs & Filter Bar */}
      <div className="space-y-4">
        {/* Quick View Filter Tabs */}
        <div className="flex border-b border-[#DEDCCF] gap-1 overflow-x-auto text-xs font-semibold">
          {[
            { key: 'all', label: 'All Tracking Records' },
            { key: 'delayed', label: `Delayed (${metrics?.delayedDeliveries || 0})` },
            { key: 'partial', label: `Partially Delivered (${metrics?.partiallyDelivered || 0})` },
            { key: 'upcoming', label: `Upcoming (${metrics?.upcomingDeliveries || 0})` },
            { key: 'awaiting_schedule', label: `Awaiting Schedule (${metrics?.awaitingDeliverySchedule || 0})` },
            { key: 'completed', label: `Completed (${metrics?.fullyDelivered || 0})` },
            { key: 'cancelled', label: `Cancelled (${metrics?.cancelledTrackingRecords || 0})` },
          ].map((tab) => {
            const isActive = viewTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setViewTab(tab.key as any);
                  setPage(1);
                }}
                className={`py-2.5 px-3.5 border-b-2 font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-[#0B3B2E] text-[#0B3B2E] bg-[#FFFEFA]'
                    : 'border-transparent text-[#5E6B61] hover:text-[#182820] hover:border-[#DEDCCF]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search & Select Filters */}
        <div className="bg-[#FFFEFA] border border-[#DEDCCF] rounded-lg p-3 space-y-3 shadow-xs">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#5E6B61]" />
              <Input
                type="text"
                placeholder="Search PO #, Material, Supplier..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-[#F7F3EA] border-[#DEDCCF] text-[#182820] text-xs h-9"
              />
            </div>

            <div>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full h-9 px-3 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
              >
                <option value="all">All Categories (API, PM, EXE, Consumables)</option>
                <option value="API">API — Active Pharmaceutical Ingredient</option>
                <option value="PM">PM — Packaging Materials</option>
                <option value="EXE">EXE — Excipients</option>
                <option value="CONSUMABLE">Consumables</option>
              </select>
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as any);
                  setPage(1);
                }}
                className="w-full h-9 px-3 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
              >
                <option value="all">All Statuses</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="PARTIALLY_DELIVERED">Partially Delivered</option>
                <option value="DELAYED">Delayed / Overdue</option>
                <option value="DELIVERED">Delivered</option>
                <option value="AWAITING_SCHEDULE">Awaiting Schedule</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full h-9 px-2 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
              >
                <option value="current_expected_delivery_date">Expected Date</option>
                <option value="sap_po_number">SAP PO #</option>
                <option value="delivery_status">Status</option>
                <option value="ordered_quantity">Quantity</option>
                <option value="updated_at">Last Updated</option>
              </select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="h-9 px-2 text-xs text-[#5E6B61]"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-md bg-[#F8E8D5] border border-[#B85C1E] text-[#B85C1E] flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Main Material Delivery Tracking Table */}
      <div className="bg-[#FFFEFA] border border-[#DEDCCF] rounded-lg overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#5E6B61]">
            <Loader2 className="w-8 h-8 animate-spin text-[#0B3B2E] mb-2" />
            <p className="text-sm">Evaluating delivery commitments and delay days...</p>
          </div>
        ) : trackingList.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center p-6">
            <Truck className="w-12 h-12 text-[#A9BE98] mb-3" />
            <h3 className="text-lg font-semibold text-[#182820]">No material delivery tracking records</h3>
            <p className="text-sm text-[#5E6B61] max-w-sm mt-1 mb-4">
              {viewTab !== 'all' || categoryFilter !== 'all' || statusFilter !== 'all'
                ? 'No PO lines match the selected filters.'
                : 'No SAP Purchase Order line references have been recorded yet.'}
            </p>
            {canRegisterSapPo && (
              <Button
                onClick={() => navigate('/app/deliveries/sap-references/new')}
                className="bg-[#0B3B2E] hover:bg-[#082D24] text-[#FFFEFA]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Register First SAP PO
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-[#F7F3EA] border-b border-[#DEDCCF]">
              <TableRow>
                <TableHead className="font-semibold text-[#182820]">SAP PO # & Line</TableHead>
                <TableHead className="font-semibold text-[#182820]">Material & Category</TableHead>
                <TableHead className="font-semibold text-[#182820]">Supplier</TableHead>
                <TableHead className="font-semibold text-[#182820]">Ordered Qty</TableHead>
                <TableHead className="font-semibold text-[#182820]">Delivered / Outstanding</TableHead>
                <TableHead className="font-semibold text-[#182820]">Expected Date</TableHead>
                <TableHead className="font-semibold text-[#182820]">Delay Days</TableHead>
                <TableHead className="font-semibold text-[#182820]">Status</TableHead>
                <TableHead className="font-semibold text-[#182820]">Assigned To</TableHead>
                <TableHead className="font-semibold text-[#182820] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-[#DEDCCF]">
              {trackingList.map((t) => {
                const metrics = calculateDeliveryMetrics({
                  orderedQuantity: Number(t.ordered_quantity),
                  deliveredQuantity: Number(t.delivered_quantity),
                  originalCommittedDeliveryDate: t.original_committed_delivery_date,
                  currentExpectedDeliveryDate: t.current_expected_delivery_date,
                  actualCompletionDate: t.actual_completion_date,
                  isCancelled: t.delivery_status === 'CANCELLED',
                  referenceDateIST: todayIST,
                });

                return (
                  <TableRow key={t.id} className="hover:bg-[#F7F3EA]/50 transition-colors">
                    {/* SAP PO Reference */}
                    <TableCell>
                      <Link
                        to={`/app/deliveries/${t.id}`}
                        className="font-mono text-xs font-bold text-[#0B3B2E] hover:underline flex items-center gap-1"
                      >
                        {t.sap_po_number}
                        <span className="text-[#5E6B61] font-normal">/ L{t.sap_po_line_number}</span>
                      </Link>
                      {t.project && (
                        <div className="text-[11px] text-[#5E6B61] truncate max-w-[120px]">
                          {t.project.project_code}
                        </div>
                      )}
                    </TableCell>

                    {/* Material */}
                    <TableCell>
                      <div className="font-medium text-xs text-[#182820] max-w-[180px] truncate">
                        {t.material_description}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {t.category}
                        </Badge>
                        {t.material_code && (
                          <span className="font-mono text-[10px] text-[#5E6B61]">{t.material_code}</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Supplier */}
                    <TableCell className="text-xs text-[#182820] max-w-[140px] truncate">
                      {t.supplier_name}
                    </TableCell>

                    {/* Ordered Qty */}
                    <TableCell className="font-mono text-xs font-semibold text-[#182820]">
                      {t.ordered_quantity} {t.uom}
                    </TableCell>

                    {/* Delivered / Outstanding Progress */}
                    <TableCell>
                      <div className="text-xs font-mono font-medium text-[#182820]">
                        <span>{t.delivered_quantity}</span>
                        <span className="text-[#5E6B61]"> / {metrics.outstandingQuantity} {t.uom}</span>
                      </div>
                      <div className="w-24 bg-[#E8EEDD] rounded-full h-1.5 mt-1 overflow-hidden">
                        <div
                          className="bg-[#0B3B2E] h-1.5 rounded-full"
                          style={{ width: `${metrics.deliveryPercentage}%` }}
                        />
                      </div>
                    </TableCell>

                    {/* Expected Date */}
                    <TableCell className="text-xs">
                      {t.current_expected_delivery_date ? (
                        <span className={metrics.isOverdue ? 'text-red-700 font-semibold' : 'text-[#182820]'}>
                          {formatDateIST(t.current_expected_delivery_date)}
                        </span>
                      ) : (
                        <span className="text-[#5E6B61] italic">Not scheduled</span>
                      )}
                    </TableCell>

                    {/* Delay Days */}
                    <TableCell className="font-mono text-xs">
                      {metrics.totalDeliveryDelayDays !== null && metrics.totalDeliveryDelayDays > 0 ? (
                        <span className="text-red-700 font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                          +{metrics.totalDeliveryDelayDays}d
                        </span>
                      ) : metrics.totalDeliveryDelayDays === 0 ? (
                        <span className="text-[#5E6B61]">0d</span>
                      ) : (
                        <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">
                          Uncommitted
                        </span>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell>{getStatusBadge(metrics.calculatedStatus)}</TableCell>

                    {/* Assigned Employee */}
                    <TableCell className="text-xs text-[#182820]">
                      {t.assigned_employee ? (
                        <span className="truncate block max-w-[110px]">{t.assigned_employee.full_name}</span>
                      ) : (
                        <span className="text-[#B85C1E] italic text-[11px]">Unassigned</span>
                      )}
                    </TableCell>

                    {/* Row Actions */}
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/app/deliveries/${t.id}`)}
                        className="h-8 px-2 text-[#5E6B61] hover:text-[#0B3B2E]"
                        title="View Full Delivery Timeline"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>

                      {t.delivery_status !== 'DELIVERED' && t.delivery_status !== 'CANCELLED' && canRecordDelivery && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeliveryModalRecord(t);
                            setDeliveredQty('');
                            setActualDate(todayIST);
                            setChallanRef('');
                            setDeliveryRemarks('');
                            setDeliveryModalError(null);
                          }}
                          className="h-8 px-2 text-[#0B3B2E] hover:bg-[#E8EEDD]"
                          title="Record Delivery Arrival"
                        >
                          <Truck className="w-4 h-4" />
                        </Button>
                      )}

                      {metrics.isOverdue && canUpdateTracking && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDelayModalRecord(t);
                            setDelayExplanation('');
                            setCorrectiveAction('');
                            setSupplierContacted(true);
                            setSupplierUpdate('');
                            setRevisedDate('');
                            setNextFollowupDate(todayIST);
                            setDelayModalError(null);
                          }}
                          className="h-8 px-2 text-amber-700 hover:bg-amber-50"
                          title="Submit Mandatory Daily Delay Remark"
                        >
                          <MessageSquareWarning className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Pagination Footer */}
        {!loading && trackingList.length > 0 && (
          <div className="p-4 border-t border-[#DEDCCF] bg-[#F7F3EA]/30 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-[#5E6B61]">
            <div>
              Showing page <strong className="text-[#182820]">{page}</strong> of{' '}
              <strong className="text-[#182820]">{totalPages}</strong> ({totalCount} total PO lines)
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="h-8 text-xs border-[#DEDCCF]"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
                className="h-8 text-xs border-[#DEDCCF]"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          QUICK ACTION MODALS
         ========================================================================= */}

      {/* 1. Quick Record Delivery Shipment Modal */}
      <Dialog open={!!deliveryModalRecord} onOpenChange={(open) => !open && setDeliveryModalRecord(null)}>
        <DialogContent className="sm:max-w-md bg-[#FFFEFA] border-[#DEDCCF]">
          <DialogHeader>
            <DialogTitle className="text-[#182820]">Record Material Delivery</DialogTitle>
            <DialogDescription className="text-xs text-[#5E6B61]">
              PO #{deliveryModalRecord?.sap_po_number} / Line {deliveryModalRecord?.sap_po_line_number} —{' '}
              {deliveryModalRecord?.material_description}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleQuickDeliverySubmit} className="space-y-3 py-2">
            {deliveryModalError && <p className="text-xs text-red-600 font-medium">{deliveryModalError}</p>}
            <div className="p-2.5 bg-[#F7F3EA] rounded-md text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[#5E6B61]">Ordered Quantity:</span>
                <span className="font-mono font-bold text-[#182820]">
                  {deliveryModalRecord?.ordered_quantity} {deliveryModalRecord?.uom}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5E6B61]">Previously Delivered:</span>
                <span className="font-mono text-[#182820]">
                  {deliveryModalRecord?.delivered_quantity} {deliveryModalRecord?.uom}
                </span>
              </div>
              <div className="flex justify-between font-semibold border-t border-[#DEDCCF] pt-1">
                <span className="text-[#0B3B2E]">Current Outstanding:</span>
                <span className="font-mono text-[#0B3B2E]">
                  {Math.max(
                    0,
                    Number(deliveryModalRecord?.ordered_quantity || 0) -
                      Number(deliveryModalRecord?.delivered_quantity || 0)
                  )}{' '}
                  {deliveryModalRecord?.uom}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Delivered Qty *</Label>
                <Input
                  type="number"
                  step="any"
                  value={deliveredQty}
                  onChange={(e) => setDeliveredQty(e.target.value)}
                  placeholder="e.g. 500"
                  required
                  className="bg-[#F7F3EA] border-[#DEDCCF]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Actual Arrival Date *</Label>
                <Input
                  type="date"
                  value={actualDate}
                  onChange={(e) => setActualDate(e.target.value)}
                  required
                  className="bg-[#F7F3EA] border-[#DEDCCF]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Supplier Challan / LR Docket #</Label>
              <Input
                value={challanRef}
                onChange={(e) => setChallanRef(e.target.value)}
                placeholder="e.g. CH-2026-9812"
                className="bg-[#F7F3EA] border-[#DEDCCF]"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Delivery Remarks</Label>
              <textarea
                rows={2}
                value={deliveryRemarks}
                onChange={(e) => setDeliveryRemarks(e.target.value)}
                placeholder="Physical condition, batch notes, or storage destination..."
                className="w-full p-2 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDeliveryModalRecord(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={deliverySubmitting} className="bg-[#0B3B2E] text-white">
                {deliverySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record Delivery'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 2. Quick Submit Daily Delay Remark Modal */}
      <Dialog open={!!delayModalRecord} onOpenChange={(open) => !open && setDelayModalRecord(null)}>
        <DialogContent className="sm:max-w-md bg-[#FFFEFA] border-[#DEDCCF]">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-1.5">
              <MessageSquareWarning className="w-5 h-5 text-red-600" />
              Mandatory Daily Delay Remark ({todayIST})
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5E6B61]">
              SAP PO #{delayModalRecord?.sap_po_number} / Line {delayModalRecord?.sap_po_line_number} —{' '}
              {delayModalRecord?.material_description}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleQuickDelayRemarkSubmit} className="space-y-3 py-2">
            {delayModalError && <p className="text-xs text-red-600 font-medium">{delayModalError}</p>}

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Primary Delay Reason *</Label>
              <select
                value={delayReasonCat}
                onChange={(e) => setDelayReasonCat(e.target.value as DelayReasonCategory)}
                className="w-full h-9 px-3 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
              >
                <option value="Supplier Manufacturing Delay">Supplier Manufacturing Delay</option>
                <option value="Raw Material Shortage at Supplier">Raw Material Shortage at Supplier</option>
                <option value="Quality Testing / Release Pending">Quality Testing / Release Pending</option>
                <option value="Packaging Delay">Packaging Delay</option>
                <option value="Supplier Capacity Constraint">Supplier Capacity Constraint</option>
                <option value="Transportation / Logistics Delay">Transportation / Logistics Delay</option>
                <option value="Documentation Pending">Documentation Pending</option>
                <option value="Customs / Import Clearance Delay">Customs / Import Clearance Delay</option>
                <option value="Internal Coordination Delay">Internal Coordination Delay</option>
                <option value="Technical Specification Clarification">Technical Specification Clarification</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Delay Explanation * (Mandatory)</Label>
              <textarea
                rows={2}
                value={delayExplanation}
                onChange={(e) => setDelayExplanation(e.target.value)}
                placeholder="Specific cause why material has not arrived..."
                required
                className="w-full p-2 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="suppContacted"
                checked={supplierContacted}
                onChange={(e) => setSupplierContacted(e.target.checked)}
                className="rounded border-[#DEDCCF] text-[#0B3B2E]"
              />
              <Label htmlFor="suppContacted" className="text-xs font-medium cursor-pointer">
                Supplier was contacted regarding this delay
              </Label>
            </div>

            {supplierContacted && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Supplier Communication Update *</Label>
                <Input
                  value={supplierUpdate}
                  onChange={(e) => setSupplierUpdate(e.target.value)}
                  placeholder="e.g. Supplier confirmed dispatch scheduled for tomorrow morning"
                  required
                  className="bg-[#F7F3EA] border-[#DEDCCF] text-xs"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Revised Expected Date</Label>
                <Input
                  type="date"
                  value={revisedDate}
                  onChange={(e) => setRevisedDate(e.target.value)}
                  className="bg-[#F7F3EA] border-[#DEDCCF] text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Next Follow-up Date *</Label>
                <Input
                  type="date"
                  value={nextFollowupDate}
                  onChange={(e) => setNextFollowupDate(e.target.value)}
                  required
                  className="bg-[#F7F3EA] border-[#DEDCCF] text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Corrective Action Taken *</Label>
              <textarea
                rows={2}
                value={correctiveAction}
                onChange={(e) => setCorrectiveAction(e.target.value)}
                placeholder="Steps taken to expedite delivery..."
                required
                className="w-full p-2 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDelayModalRecord(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={delaySubmitting} className="bg-red-700 hover:bg-red-800 text-white">
                {delaySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Delay Remark'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

