import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  fetchSupplierPerformanceAnalytics,
  fetchSupplierDrillDownLines,
  exportSupplierScorecardCsv,
  exportSupplierLinesDetailCsv,
} from '@/services/supplierPerformanceService';
import { fetchSuppliers } from '@/services/supplierService';
import {
  MaterialDeliveryTracking,
  Supplier,
  SupplierPerformanceAnalyticsResult,
  SupplierScorecardItem,
} from '@/types/database.types';
import {
  calculateDeliveryMetrics,
  getTodayISTDate,
} from '@/lib/deliveryCalculations';
import { formatDateIST } from '@/lib/formatters';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  TrendingUp,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Package,
  Layers,
  ArrowUpDown,
  Search,
  ExternalLink,
  ChevronRight,
  X,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';

export function SupplierPerformancePage() {
  const { hasPermission } = useAuth();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<SupplierPerformanceAnalyticsResult | null>(null);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);

  // Filters
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [datePreset, setDatePreset] = useState<'30' | '90' | 'ytd' | 'all' | 'custom'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Active Tab
  const [activeTab, setActiveTab] = useState<'scorecards' | 'categories' | 'delays'>('scorecards');

  // Drill-down Modal State
  const [selectedScorecard, setSelectedScorecard] = useState<SupplierScorecardItem | null>(null);
  const [drillDownLines, setDrillDownLines] = useState<MaterialDeliveryTracking[]>([]);
  const [drillDownLoading, setDrillDownLoading] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<keyof SupplierScorecardItem>('on_time_percentage');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  useEffect(() => {
    fetchSuppliers({ pageSize: 200 }).then((res) => {
      if (res.data) setSuppliersList(res.data);
    });
  }, []);

  useEffect(() => {
    loadPerformanceData();
  }, [selectedSupplierId, selectedCategory, startDate, endDate]);

  const loadPerformanceData = async () => {
    setLoading(true);
    setErrorMsg(null);
    const res = await fetchSupplierPerformanceAnalytics({
      supplierId: selectedSupplierId || null,
      category: selectedCategory || null,
      startDate: startDate || null,
      endDate: endDate || null,
    });
    setLoading(false);

    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setAnalytics(res.data);
    }
  };

  const handlePresetChange = (preset: '30' | '90' | 'ytd' | 'all' | 'custom') => {
    setDatePreset(preset);
    const today = new Date();
    const todayStr = getTodayISTDate();

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === '30') {
      const past = new Date(today);
      past.setDate(past.getDate() - 30);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === '90') {
      const past = new Date(today);
      past.setDate(past.getDate() - 90);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'ytd') {
      const ytd = `${today.getFullYear()}-01-01`;
      setStartDate(ytd);
      setEndDate(todayStr);
    }
  };

  const handleOpenDrillDown = async (item: SupplierScorecardItem) => {
    setSelectedScorecard(item);
    setDrillDownLoading(true);
    const res = await fetchSupplierDrillDownLines({
      supplierId: item.supplier_id,
      category: selectedCategory || null,
      startDate: startDate || null,
      endDate: endDate || null,
    });
    setDrillDownLoading(false);
    if (res.data) {
      setDrillDownLines(res.data);
    }
  };

  const filteredScorecards = (analytics?.supplier_scorecards || []).filter((s) => {
    if (!searchTerm) return true;
    return s.supplier_name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const sortedScorecards = [...filteredScorecards].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
  });

  const toggleSort = (field: keyof SupplierScorecardItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const summary = analytics?.overall_summary;
  const canExport = hasPermission('supplier_performance.export') || hasPermission('delivery_reports.export');

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-divider/70 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-forest inline-block" />
            <h1 className="text-2xl font-bold tracking-tight text-forest">Supplier Delivery Performance</h1>
          </div>
          <p className="mt-1 text-xs text-ink-secondary">
            Authoritative delivery scorecards, original-commitment delay tracking, and vendor on-time compliance.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadPerformanceData}
            disabled={loading}
            className="border-divider text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {canExport && analytics && (
            <Button
              onClick={() =>
                exportSupplierScorecardCsv(
                  analytics,
                  `Category: ${selectedCategory || 'All'} | Dates: ${startDate || 'Min'} to ${endDate || 'Max'}`
                )
              }
              size="sm"
              className="bg-forest hover:bg-forest-deep text-sage text-xs shadow-warm-sm"
            >
              <Download className="h-3.5 w-3.5 mr-1.5 text-sage" />
              Export Scorecard (CSV)
            </Button>
          )}
        </div>
      </div>

      {/* Metric Context Banner */}
      <div className="rounded-lg border border-sage/40 bg-sage-pale/40 p-3 text-xs text-forest flex items-start space-x-2.5">
        <HelpCircle className="h-4 w-4 text-forest flex-shrink-0 mt-0.5" />
        <div>
          <strong>Strict Calculation Standard:</strong> All delivery delays and on-time ratings are measured against the{' '}
          <strong>First Supplier-Confirmed Original Commitment Date</strong> in calendar days (IST). Revisions to the operational
          ETA are tracked separately and do not improve or erase supplier delay history. PO lines missing original commitment
          dates are excluded from percentage denominators and flagged separately.
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* Date Preset */}
            <div>
              <label className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Date Window</label>
              <div className="mt-1 flex rounded-md shadow-sm">
                {(['all', '30', '90', 'ytd'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePresetChange(p)}
                    className={`flex-1 border border-divider px-2.5 py-1.5 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md ${datePreset === p ? 'bg-forest text-sage border-forest' : 'bg-ivory hover:bg-ivory-hover text-ink-primary'
                      }`}
                  >
                    {p === 'all' ? 'All Time' : p === '30' ? '30 Days' : p === '90' ? '90 Days' : 'YTD'}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Range */}
            <div>
              <label className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setDatePreset('custom');
                  setStartDate(e.target.value);
                }}
                className="mt-1 h-8 text-xs bg-ivory"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setDatePreset('custom');
                  setEndDate(e.target.value);
                }}
                className="mt-1 h-8 text-xs bg-ivory"
              />
            </div>

            {/* Material Category */}
            <div>
              <label className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Material Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="mt-1 block w-full rounded-md border border-divider bg-ivory px-2.5 py-1.5 text-xs text-ink-primary focus:border-forest focus:outline-none"
              >
                <option value="">All Categories</option>
                <option value="API">API — Active Ingredients</option>
                <option value="PM">PM — Packaging Materials</option>
                <option value="EXE">EXE — Excipients</option>
                <option value="CONSUMABLE">CONSUMABLE — Consumables</option>
              </select>
            </div>

            {/* Supplier Select */}
            <div>
              <label className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Supplier</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-divider bg-ivory px-2.5 py-1.5 text-xs text-ink-primary focus:border-forest focus:outline-none"
              >
                <option value="">All Suppliers ({suppliersList.length})</option>
                {suppliersList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.legal_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* On-Time Rate */}
        <Card className="border border-divider bg-ivory-surface">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">On-Time Rate</span>
              <TrendingUp className="h-4 w-4 text-status-success" />
            </div>
            <div className="mt-2 flex items-baseline space-x-1.5">
              <span className="text-2xl font-bold tracking-tight text-forest">
                {summary ? `${summary.on_time_delivery_rate}%` : '—'}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-ink-muted">Target: ≥ 95.0%</p>
          </CardContent>
        </Card>

        {/* Total Lines */}
        <Card className="border border-divider bg-ivory-surface">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Total Lines</span>
              <Package className="h-4 w-4 text-forest" />
            </div>
            <div className="mt-2 text-2xl font-bold text-ink-primary">{summary?.total_lines ?? 0}</div>
            <p className="mt-1 text-[11px] text-ink-muted">
              {summary?.total_missing_commitment_lines ?? 0} missing commitment
            </p>
          </CardContent>
        </Card>

        {/* On-Time Completed */}
        <Card className="border border-divider bg-ivory-surface">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">On-Time</span>
              <CheckCircle2 className="h-4 w-4 text-status-success" />
            </div>
            <div className="mt-2 text-2xl font-bold text-status-success">{summary?.total_on_time_lines ?? 0}</div>
            <p className="mt-1 text-[11px] text-ink-muted">Delivered ≤ original date</p>
          </CardContent>
        </Card>

        {/* Late Completed */}
        <Card className="border border-divider bg-ivory-surface">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Late Delivered</span>
              <Clock className="h-4 w-4 text-copper" />
            </div>
            <div className="mt-2 text-2xl font-bold text-copper">{summary?.total_late_completed_lines ?? 0}</div>
            <p className="mt-1 text-[11px] text-ink-muted">Avg {summary?.avg_final_delay_days ?? 0}d delay</p>
          </CardContent>
        </Card>

        {/* Overdue Outstanding */}
        <Card className="border border-divider bg-ivory-surface">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Overdue</span>
              <AlertTriangle className="h-4 w-4 text-status-error" />
            </div>
            <div className="mt-2 text-2xl font-bold text-status-error">
              {summary?.total_overdue_outstanding_lines ?? 0}
            </div>
            <p className="mt-1 text-[11px] text-ink-muted">Avg {summary?.avg_current_delay_days ?? 0}d current</p>
          </CardContent>
        </Card>

        {/* Partial Delivery Lines */}
        <Card className="border border-divider bg-ivory-surface">
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Partials</span>
              <Layers className="h-4 w-4 text-forest" />
            </div>
            <div className="mt-2 text-2xl font-bold text-ink-primary">{summary?.total_partial_lines ?? 0}</div>
            <p className="mt-1 text-[11px] text-ink-muted">Balance outstanding</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-divider">
        <div className="flex space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('scorecards')}
            className={`pb-3 transition-colors ${activeTab === 'scorecards'
                ? 'border-b-2 border-forest text-forest font-semibold'
                : 'text-ink-secondary hover:text-ink-primary'
              }`}
          >
            Supplier Scorecards ({filteredScorecards.length})
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`pb-3 transition-colors ${activeTab === 'categories'
                ? 'border-b-2 border-forest text-forest font-semibold'
                : 'text-ink-secondary hover:text-ink-primary'
              }`}
          >
            Material Categories
          </button>
          <button
            onClick={() => setActiveTab('delays')}
            className={`pb-3 transition-colors ${activeTab === 'delays'
                ? 'border-b-2 border-forest text-forest font-semibold'
                : 'text-ink-secondary hover:text-ink-primary'
              }`}
          >
            Root Cause Delay Analysis
          </button>
        </div>
      </div>

      {/* Tab 1: Supplier Scorecards Table */}
      {activeTab === 'scorecards' && (
        <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
          <CardHeader className="flex flex-col space-y-2 pb-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 border-b border-divider/60">
            <div>
              <CardTitle className="text-base font-bold text-forest">Vendor Delivery Scorecard</CardTitle>
              <CardDescription className="text-xs text-ink-secondary">
                Ranked by on-time delivery rate against original committed delivery dates.
              </CardDescription>
            </div>
            <div className="w-full sm:w-64">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-muted" />
                <Input
                  type="text"
                  placeholder="Filter supplier..."
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
                    <th className="py-3 px-4 cursor-pointer" onClick={() => toggleSort('supplier_name')}>
                      <div className="flex items-center space-x-1">
                        <span>Supplier Name</span>
                        <ArrowUpDown className="h-3 w-3 text-ink-muted" />
                      </div>
                    </th>
                    <th className="py-3 px-3 text-right cursor-pointer" onClick={() => toggleSort('on_time_percentage')}>
                      <div className="flex items-center justify-end space-x-1">
                        <span>On-Time Rate</span>
                        <ArrowUpDown className="h-3 w-3 text-ink-muted" />
                      </div>
                    </th>
                    <th className="py-3 px-3 text-right">Total Lines</th>
                    <th className="py-3 px-3 text-right">On-Time</th>
                    <th className="py-3 px-3 text-right">Late</th>
                    <th className="py-3 px-3 text-right">Overdue</th>
                    <th className="py-3 px-3 text-right">Partials</th>
                    <th className="py-3 px-3 text-right">Avg Late Delay</th>
                    <th className="py-3 px-3 text-right">Max Delay</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider/50">
                  {sortedScorecards.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-xs text-ink-muted">
                        No supplier performance records match the current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    sortedScorecards.map((s) => {
                      const isHighPerf = s.on_time_percentage >= 90;
                      const isMidPerf = s.on_time_percentage >= 75 && s.on_time_percentage < 90;
                      const badgeBg = isHighPerf
                        ? 'bg-status-success/15 text-status-success'
                        : isMidPerf
                          ? 'bg-copper/15 text-copper'
                          : 'bg-status-error/15 text-status-error';

                      return (
                        <tr key={s.supplier_id} className="hover:bg-ivory/50 transition-colors">
                          <td className="py-3 px-4 font-semibold text-ink-primary">
                            <div>{s.supplier_name}</div>
                            {s.missing_commitment_count > 0 && (
                              <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-0.5 inline-block">
                                {s.missing_commitment_count} uncommitted lines
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${badgeBg}`}>
                              {s.evaluable_lines > 0 ? `${s.on_time_percentage}%` : 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-ink-secondary">{s.total_lines}</td>
                          <td className="py-3 px-3 text-right font-mono text-status-success font-medium">
                            {s.on_time_delivered_lines}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-copper font-medium">
                            {s.late_delivered_lines}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-status-error font-medium">
                            {s.overdue_outstanding_lines}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-ink-secondary">
                            {s.partial_delivery_lines}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-ink-secondary">
                            {s.avg_final_delay_days_late > 0 ? `${s.avg_final_delay_days_late}d` : '—'}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-ink-secondary">
                            {s.max_final_delay_days > 0 ? `${s.max_final_delay_days}d` : '—'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDrillDown(s)}
                              className="h-7 text-xs text-forest hover:bg-forest/10 hover:text-forest-deep"
                            >
                              <span>Drill Down</span>
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
      )}

      {/* Tab 2: Material Category Breakdown */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(analytics?.category_breakdown || []).map((cat) => (
            <Card key={cat.category} className="border border-divider bg-ivory-surface shadow-warm-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-forest uppercase tracking-wider">{cat.category}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${cat.on_time_percentage >= 90
                        ? 'bg-status-success/15 text-status-success'
                        : 'bg-copper/15 text-copper'
                      }`}
                  >
                    {cat.on_time_percentage}% On-Time
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-2 text-xs">
                <div className="flex justify-between py-1 border-b border-divider/50">
                  <span className="text-ink-secondary">Total PO Lines:</span>
                  <span className="font-mono font-medium">{cat.total_lines}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-divider/50">
                  <span className="text-ink-secondary">On-Time Deliveries:</span>
                  <span className="font-mono text-status-success font-medium">{cat.on_time_lines}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-divider/50">
                  <span className="text-ink-secondary">Delayed / Overdue:</span>
                  <span className="font-mono text-status-error font-medium">{cat.delayed_lines}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-ink-secondary">Missing Commitment Date:</span>
                  <span className="font-mono text-amber-700">{cat.missing_commitment_count}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tab 3: Delay Root Cause Analysis */}
      {activeTab === 'delays' && (
        <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
          <CardHeader className="pb-3 border-b border-divider/60">
            <CardTitle className="text-base font-bold text-forest">Root Cause Delay Reason Distribution</CardTitle>
            <CardDescription className="text-xs text-ink-secondary">
              Aggregated from mandatory daily delay remark logs submitted by accountable employees.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {(analytics?.delay_reasons_breakdown || []).length === 0 ? (
              <p className="text-xs text-ink-muted py-6 text-center">No delay reason logs recorded in this period.</p>
            ) : (
              <div className="space-y-3">
                {analytics?.delay_reasons_breakdown.map((dr) => (
                  <div key={dr.category} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-ink-primary">{dr.category}</span>
                      <span className="text-ink-secondary font-mono">
                        {dr.occurrences_count} updates ({dr.distinct_lines_affected} lines affected)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-ivory-hover overflow-hidden">
                      <div
                        className="h-full bg-copper rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            (dr.occurrences_count / (analytics.overall_summary.total_lines || 1)) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Drill-down PO Lines Modal */}
      {selectedScorecard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl rounded-xl border border-divider bg-ivory-surface shadow-warm-xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-divider px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-forest">{selectedScorecard.supplier_name}</h3>
                <p className="text-xs text-ink-secondary">
                  Underlying SAP Purchase Order Lines & Delivery Execution Records
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {canExport && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => exportSupplierLinesDetailCsv(drillDownLines, selectedScorecard.supplier_name)}
                    className="border-divider text-xs"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-forest" />
                    Export PO Lines (CSV)
                  </Button>
                )}
                <button
                  onClick={() => setSelectedScorecard(null)}
                  className="rounded-lg p-1.5 text-ink-muted hover:bg-ivory hover:text-ink-primary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {drillDownLoading ? (
                <div className="py-16 text-center text-xs text-ink-secondary">Loading PO line details...</div>
              ) : drillDownLines.length === 0 ? (
                <div className="py-16 text-center text-xs text-ink-muted">No PO lines found for this supplier.</div>
              ) : (
                <div className="space-y-3">
                  {drillDownLines.map((line) => {
                    const metrics = calculateDeliveryMetrics({
                      orderedQuantity: Number(line.ordered_quantity),
                      deliveredQuantity: Number(line.delivered_quantity),
                      originalCommittedDeliveryDate: line.original_committed_delivery_date,
                      currentExpectedDeliveryDate: line.current_expected_delivery_date,
                      actualCompletionDate: line.actual_completion_date,
                    });

                    return (
                      <div
                        key={line.id}
                        className="rounded-lg border border-divider bg-ivory p-4 text-xs space-y-3 hover:border-forest/40 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-divider/60 pb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-forest text-sm">
                              PO {line.sap_po_number} / Line {line.sap_po_line_number}
                            </span>
                            <span className="rounded bg-sage-pale px-2 py-0.5 text-[10px] font-semibold text-forest border border-sage/50">
                              {line.category}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${line.delivery_status === 'DELIVERED'
                                  ? 'bg-status-success/15 text-status-success'
                                  : line.delivery_status === 'DELAYED'
                                    ? 'bg-status-error/15 text-status-error'
                                    : 'bg-sage-pale text-forest'
                                }`}
                            >
                              {line.delivery_status}
                            </span>
                          </div>

                          <div className="text-[11px] text-ink-secondary">
                            Owner:{' '}
                            <strong className="text-ink-primary">
                              {line.assigned_employee?.full_name || 'Unassigned'}
                            </strong>
                          </div>
                        </div>

                        {/* Material Info */}
                        <div>
                          <div className="font-semibold text-ink-primary text-sm">{line.material_description}</div>
                          {line.material_code && (
                            <span className="font-mono text-[11px] text-ink-muted">SAP Code: {line.material_code}</span>
                          )}
                        </div>

                        {/* Quantities & Dates Grid */}
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 bg-ivory-surface p-2.5 rounded border border-divider/60">
                          <div>
                            <span className="text-[10px] text-ink-secondary block uppercase">Ordered</span>
                            <span className="font-mono font-medium">
                              {line.ordered_quantity} {line.uom}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-ink-secondary block uppercase">Delivered</span>
                            <span className="font-mono font-medium text-status-success">
                              {line.delivered_quantity} {line.uom} ({metrics.deliveryPercentage}%)
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-ink-secondary block uppercase">Original Commitment</span>
                            <span className="font-mono font-medium">
                              {line.original_committed_delivery_date
                                ? formatDateIST(line.original_committed_delivery_date)
                                : 'Missing'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-ink-secondary block uppercase">Current Revised ETA</span>
                            <span className="font-mono font-medium">
                              {line.current_expected_delivery_date
                                ? formatDateIST(line.current_expected_delivery_date)
                                : '—'}
                            </span>
                          </div>
                        </div>

                        {/* Delay Badges */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          {metrics.totalDeliveryDelayDays !== null && metrics.totalDeliveryDelayDays > 0 ? (
                            <span className="rounded bg-status-error/15 px-2 py-0.5 text-status-error font-medium">
                              Original Commitment Delay: <strong>{metrics.totalDeliveryDelayDays} calendar days</strong>
                            </span>
                          ) : metrics.totalDeliveryDelayDays === 0 ? (
                            <span className="rounded bg-status-success/15 px-2 py-0.5 text-status-success font-medium">
                              Met Original Commitment (On-Time)
                            </span>
                          ) : (
                            <span className="rounded bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 font-medium">
                              Delay Not Calculable (Missing Commitment Date)
                            </span>
                          )}

                          {metrics.currentOverdueDays > 0 && (
                            <span className="rounded bg-copper/15 px-2 py-0.5 text-copper font-medium">
                              Current ETA Overdue: {metrics.currentOverdueDays} days
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end border-t border-divider px-6 py-3">
              <Button variant="outline" size="sm" onClick={() => setSelectedScorecard(null)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

