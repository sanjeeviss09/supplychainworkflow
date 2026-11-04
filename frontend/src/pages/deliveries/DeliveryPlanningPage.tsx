import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  fetchDeliveryPlanningSchedule,
  fetchDeliveryScheduleChangeHistory,
  exportDeliveryPlanningCsv,
} from '@/services/deliveryPlanningService';
import { fetchSuppliers } from '@/services/supplierService';
import { fetchEmployeesList } from '@/services/employeeService';
import {
  DeliveryCalendarDay,
  DeliveryCalendarItem,
  DeliveryPlanningResult,
  DeliveryScheduleChangeRecord,
  Employee,
  Supplier,
} from '@/types/database.types';
import { getTodayISTDate } from '@/lib/deliveryCalculations';
import { formatDateIST } from '@/lib/formatters';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  Package,
  Layers,
  CheckCircle2,
  Filter,
  Download,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldAlert,
  UserCheck,
  History,
  CalendarDays,
  LayoutGrid,
  FileSpreadsheet,
  X,
} from 'lucide-react';

export function DeliveryPlanningPage() {
  const { hasPermission, employee: currentEmployee } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [planningData, setPlanningData] = useState<DeliveryPlanningResult | null>(null);
  const [historyRecords, setHistoryRecords] = useState<DeliveryScheduleChangeRecord[]>([]);

  // Navigation & View Mode
  const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly' | 'board' | 'history'>('weekly');
  const [planningScope, setPlanningScope] = useState<'all' | 'my_schedule'>('all');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Filters
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Dropdown options
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Selected Day Details Modal (for Monthly view)
  const [selectedDayModal, setSelectedDayModal] = useState<DeliveryCalendarDay | null>(null);

  useEffect(() => {
    fetchSuppliers({ pageSize: 200 }).then((res) => {
      if (res.data) setSuppliers(res.data);
    });
    fetchEmployeesList().then((res) => {
      if (res.data) setEmployees(res.data.filter((e) => e.is_active));
    });
  }, []);

  useEffect(() => {
    loadPlanningData();
  }, [currentDate, viewMode, selectedSupplierId, selectedCategory, selectedEmployeeId, planningScope]);

  const getDateRangeForView = () => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (viewMode === 'daily') {
      // Single day
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    } else if (viewMode === 'weekly') {
      // 7-day week starting on Sunday or Monday
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
      end.setDate(start.getDate() + 6);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    } else {
      // Monthly or Board (full month)
      start.setDate(1);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }
  };

  const loadPlanningData = async () => {
    setLoading(true);
    setErrorMsg(null);
    const { startDate, endDate } = getDateRangeForView();

    const empId =
      planningScope === 'my_schedule'
        ? currentEmployee?.id || null
        : selectedEmployeeId || null;

    const res = await fetchDeliveryPlanningSchedule({
      startDate,
      endDate,
      supplierId: selectedSupplierId || null,
      category: selectedCategory || null,
      assignedEmployeeId: empId,
    });

    if (viewMode === 'history') {
      const histRes = await fetchDeliveryScheduleChangeHistory({ limit: 40 });
      setHistoryRecords(histRes.data);
    }

    setLoading(false);
    if (res.error) {
      setErrorMsg(res.error);
    } else {
      setPlanningData(res.data);
    }
  };

  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === 'daily') next.setDate(next.getDate() - 1);
    else if (viewMode === 'weekly') next.setDate(next.getDate() - 7);
    else next.setMonth(next.getMonth() - 1);
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'daily') next.setDate(next.getDate() + 1);
    else if (viewMode === 'weekly') next.setDate(next.getDate() + 7);
    else next.setMonth(next.getMonth() + 1);
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const summary = planningData?.summary;
  const canExport = hasPermission('delivery_planning.export');
  const todayIST = getTodayISTDate();

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-divider/70 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-forest inline-block" />
            <h1 className="text-2xl font-bold tracking-tight text-forest">Incoming Delivery Planning</h1>
          </div>
          <p className="mt-1 text-xs text-ink-secondary">
            Daily, weekly, and monthly incoming material schedules, UOM-grouped workload planning, and schedule revisions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Scope Toggle: All Deliveries vs My Delivery Schedule */}
          <div className="flex rounded-md shadow-sm border border-divider overflow-hidden">
            <button
              type="button"
              onClick={() => setPlanningScope('all')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                planningScope === 'all' ? 'bg-forest text-sage font-semibold' : 'bg-ivory text-ink-primary hover:bg-ivory-hover'
              }`}
            >
              All Deliveries
            </button>
            <button
              type="button"
              onClick={() => setPlanningScope('my_schedule')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                planningScope === 'my_schedule' ? 'bg-forest text-sage font-semibold' : 'bg-ivory text-ink-primary hover:bg-ivory-hover'
              }`}
            >
              My Schedule
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/deliveries/risks')}
            className="border-red-600/70 text-red-700 hover:bg-red-50 text-xs"
          >
            <ShieldAlert className="h-3.5 w-3.5 mr-1.5 text-red-600" />
            Supply Risks
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadPlanningData}
            disabled={loading}
            className="border-divider text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {canExport && planningData && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportDeliveryPlanningCsv(
                  planningData,
                  viewMode,
                  `Scope: ${planningScope} | Category: ${selectedCategory || 'All'} | Supplier: ${selectedSupplierId || 'All'}`
                )
              }
              className="border-divider text-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1.5 text-forest" />
              Export Schedule (CSV)
            </Button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Card className="border border-divider bg-ivory-surface">
          <CardContent className="p-3.5">
            <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider block">Due Today</span>
            <div className="mt-1 text-2xl font-bold text-amber-800">{summary?.due_today_count ?? 0}</div>
            <p className="text-[11px] text-ink-muted">Expected today</p>
          </CardContent>
        </Card>

        <Card className="border border-divider bg-ivory-surface">
          <CardContent className="p-3.5">
            <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider block">Next 7 Days</span>
            <div className="mt-1 text-2xl font-bold text-forest">{summary?.upcoming_7d_count ?? 0}</div>
            <p className="text-[11px] text-ink-muted">{summary?.upcoming_15d_count ?? 0} in 15 days</p>
          </CardContent>
        </Card>

        <Card className="border border-divider bg-ivory-surface">
          <CardContent className="p-3.5">
            <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider block">Overdue Lines</span>
            <div className="mt-1 text-2xl font-bold text-status-error">{summary?.overdue_count ?? 0}</div>
            <p className="text-[11px] text-ink-muted">Past original commitment</p>
          </CardContent>
        </Card>

        <Card className="border border-divider bg-ivory-surface">
          <CardContent className="p-3.5">
            <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider block">Partial Shipments</span>
            <div className="mt-1 text-2xl font-bold text-ink-primary">{summary?.partial_count ?? 0}</div>
            <p className="text-[11px] text-ink-muted">Balance outstanding</p>
          </CardContent>
        </Card>

        <Card className="border border-divider bg-ivory-surface">
          <CardContent className="p-3.5">
            <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider block">Critical Attention</span>
            <div className="mt-1 text-2xl font-bold text-copper">{summary?.critical_issue_count ?? 0}</div>
            <p className="text-[11px] text-ink-muted">Phase 9 Critical Issues</p>
          </CardContent>
        </Card>

        <Card className="border border-divider bg-ivory-surface">
          <CardContent className="p-3.5">
            <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider block">Unassigned</span>
            <div className="mt-1 text-2xl font-bold text-amber-700">{summary?.unassigned_count ?? 0}</div>
            <p className="text-[11px] text-ink-muted">Needs accountable owner</p>
          </CardContent>
        </Card>

        <Card className="border border-divider bg-ivory-surface">
          <CardContent className="p-3.5">
            <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider block">Delivered</span>
            <div className="mt-1 text-2xl font-bold text-status-success">{summary?.fully_delivered_count ?? 0}</div>
            <p className="text-[11px] text-ink-muted">In selected period</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar & View Navigation */}
      <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-divider/60 pb-3">
            {/* View Mode Tabs */}
            <div className="flex rounded-md shadow-sm border border-divider overflow-hidden">
              {(['daily', 'weekly', 'monthly', 'board', 'history'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    viewMode === m ? 'bg-forest text-sage font-bold' : 'bg-ivory text-ink-primary hover:bg-ivory-hover'
                  }`}
                >
                  {m === 'daily'
                    ? 'Daily View'
                    : m === 'weekly'
                    ? 'Weekly Grid'
                    : m === 'monthly'
                    ? 'Monthly Calendar'
                    : m === 'board'
                    ? 'Schedule Board'
                    : 'Schedule Changes'}
                </button>
              ))}
            </div>

            {/* Date Navigation Controls */}
            {viewMode !== 'history' && (
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={handlePrev} className="h-8 w-8 p-0 border-divider">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleToday} className="h-8 px-2.5 text-xs border-divider">
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={handleNext} className="h-8 w-8 p-0 border-divider">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <span className="font-semibold text-xs text-forest pl-2">
                  {currentDate.toLocaleDateString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    month: 'long',
                    year: 'numeric',
                    ...(viewMode === 'daily' ? { day: 'numeric', weekday: 'short' } : {}),
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Filter Inputs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

            <div>
              <label className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Supplier</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
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

            {planningScope === 'all' && (
              <div>
                <label className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Responsible Owner</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-divider bg-ivory px-2.5 py-1.5 text-xs text-ink-primary focus:border-forest focus:outline-none"
                >
                  <option value="">All Employees ({employees.length})</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_id})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Search Keyword</label>
              <Input
                type="text"
                placeholder="Search PO #, line, material..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mt-1 h-8 text-xs bg-ivory"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UOM-Safe Workload Aggregations Banner */}
      {planningData && planningData.uom_workload_breakdown.length > 0 && (
        <Card className="border border-divider bg-ivory-surface">
          <CardHeader className="py-2.5 px-4 border-b border-divider/60">
            <span className="text-xs font-bold text-forest uppercase tracking-wider">
              UOM-Grouped Workload Quantities (Strictly segregated by Unit of Measure)
            </span>
          </CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
              {planningData.uom_workload_breakdown.map((u) => (
                <div key={`${u.category}-${u.uom}`} className="p-2.5 rounded bg-ivory border border-divider/60 space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span className="text-forest">{u.category}</span>
                    <span className="font-mono text-ink-secondary">{u.uom}</span>
                  </div>
                  <div className="text-[11px] text-ink-muted">Lines: {u.lines_count}</div>
                  <div className="font-mono text-xs font-bold text-ink-primary">
                    Balance: {u.outstanding_qty} {u.uom}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* VIEW 1: Daily View */}
      {viewMode === 'daily' && (
        <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
          <CardHeader className="border-b border-divider/60 pb-3">
            <CardTitle className="text-base font-bold text-forest">
              Deliveries Scheduled for {currentDate.toISOString().split('T')[0]}
            </CardTitle>
            <CardDescription className="text-xs text-ink-secondary">
              Direct PO line items expected on this calendar date.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {planningData?.calendar_days[0]?.line_items.length === 0 || !planningData?.calendar_days[0] ? (
              <div className="py-12 text-center text-xs text-ink-muted">
                No material deliveries are scheduled for this date.
              </div>
            ) : (
              <div className="space-y-3">
                {planningData?.calendar_days[0]?.line_items.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-lg border border-divider bg-ivory hover:border-forest/50 transition-colors text-xs space-y-2"
                  >
                    <div className="flex justify-between items-center border-b border-divider/50 pb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-forest">
                          PO #{item.sap_po_number} / Line {item.sap_po_line_number}
                        </span>
                        <span className="rounded bg-sage-pale px-2 py-0.5 text-[10px] font-semibold text-forest border border-sage/50">
                          {item.category}
                        </span>
                        {item.has_critical_issue && (
                          <span className="rounded bg-status-error/15 px-2 py-0.5 text-[10px] font-bold text-status-error flex items-center">
                            <ShieldAlert className="h-3 w-3 mr-1" />
                            Critical Issue
                          </span>
                        )}
                      </div>
                      <span className="font-semibold text-ink-primary">{item.delivery_status}</span>
                    </div>

                    <div className="font-semibold text-ink-primary text-sm">{item.material_description}</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-ink-secondary bg-ivory-surface p-2 rounded">
                      <div>Supplier: <strong>{item.supplier_name}</strong></div>
                      <div>
                        Ordered: <strong>{item.ordered_quantity} {item.uom}</strong>
                      </div>
                      <div>
                        Delivered: <strong>{item.delivered_quantity} {item.uom}</strong>
                      </div>
                      <div>
                        Outstanding: <strong className="text-status-error">{item.outstanding_quantity} {item.uom}</strong>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1 text-[11px] text-ink-muted">
                      <span>Owner: <strong>{item.assigned_employee_name || 'Unassigned'}</strong></span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/app/deliveries/${item.id}`)}
                        className="h-6 text-xs text-forest hover:bg-forest/10"
                      >
                        <span>View Tracking</span>
                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* VIEW 2: Weekly Grid View */}
      {viewMode === 'weekly' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {(planningData?.calendar_days || []).map((day) => {
            const isToday = day.date === todayIST;
            return (
              <div
                key={day.date}
                className={`rounded-lg border p-3 text-xs space-y-2 flex flex-col min-h-[260px] ${
                  isToday ? 'border-forest bg-sage-pale/20 shadow-warm-sm' : 'border-divider bg-ivory-surface'
                }`}
              >
                <div className="flex justify-between items-center border-b border-divider/60 pb-1.5">
                  <span className={`font-mono font-bold ${isToday ? 'text-forest' : 'text-ink-primary'}`}>
                    {day.date.slice(5)}
                  </span>
                  <span className="text-[10px] text-ink-muted">
                    {new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' })}
                  </span>
                </div>

                <div className="flex justify-between text-[11px]">
                  <span className="text-ink-secondary">{day.lines_count} lines</span>
                  {day.critical_issue_count > 0 && (
                    <span className="text-status-error font-bold">{day.critical_issue_count} Critical</span>
                  )}
                </div>

                <div className="flex-1 space-y-1.5 overflow-y-auto">
                  {day.line_items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => navigate(`/app/deliveries/${item.id}`)}
                      className="p-1.5 rounded border border-divider/70 bg-ivory text-[10px] space-y-0.5 cursor-pointer hover:border-forest transition-colors"
                    >
                      <div className="font-mono font-semibold text-forest truncate">
                        PO #{item.sap_po_number}
                      </div>
                      <div className="truncate text-ink-primary font-medium">{item.material_description}</div>
                      <div className="text-ink-muted text-[9px]">
                        Bal: {item.outstanding_quantity} {item.uom}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 3: Monthly View */}
      {viewMode === 'monthly' && (
        <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="text-center font-bold text-xs text-ink-secondary py-1">
                  {d}
                </div>
              ))}
              {(planningData?.calendar_days || []).map((day) => {
                const isToday = day.date === todayIST;
                return (
                  <div
                    key={day.date}
                    onClick={() => setSelectedDayModal(day)}
                    className={`rounded border p-2 text-xs min-h-[90px] cursor-pointer hover:border-forest transition-colors ${
                      isToday ? 'border-forest bg-sage-pale/25' : 'border-divider bg-ivory'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`font-mono font-bold ${isToday ? 'text-forest' : 'text-ink-primary'}`}>
                        {day.date.slice(8)}
                      </span>
                      {day.lines_count > 0 && (
                        <span className="rounded-full bg-forest text-sage px-1.5 py-0.2 text-[9px] font-bold">
                          {day.lines_count}
                        </span>
                      )}
                    </div>
                    {day.critical_issue_count > 0 && (
                      <div className="mt-1 text-[9px] text-status-error font-bold flex items-center">
                        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                        Critical
                      </div>
                    )}
                    {day.partial_count > 0 && (
                      <div className="text-[9px] text-copper font-medium">Partials: {day.partial_count}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* VIEW 4: Schedule Board */}
      {viewMode === 'board' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Column A: Due Today */}
          <Card className="border border-amber-300 bg-ivory-surface shadow-warm-sm">
            <CardHeader className="py-3 px-4 border-b border-amber-200 bg-amber-50/50">
              <CardTitle className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Deliveries Due Today ({summary?.due_today_count ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
              {(planningData?.calendar_days || [])
                .filter((d) => d.date === todayIST)
                .flatMap((d) => d.line_items)
                .map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/app/deliveries/${item.id}`)}
                    className="p-2.5 rounded bg-ivory border border-divider text-xs cursor-pointer hover:border-forest transition-colors space-y-1"
                  >
                    <div className="flex justify-between font-mono font-semibold text-forest">
                      <span>PO #{item.sap_po_number} / {item.sap_po_line_number}</span>
                      <span className="text-amber-800">Due Today</span>
                    </div>
                    <div className="font-medium text-ink-primary">{item.material_description}</div>
                    <div className="text-[11px] text-ink-secondary">
                      Vendor: {item.supplier_name} • Bal: {item.outstanding_quantity} {item.uom}
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>

          {/* Column B: Overdue Deliveries */}
          <Card className="border border-status-error/30 bg-ivory-surface shadow-warm-sm">
            <CardHeader className="py-3 px-4 border-b border-status-error/20 bg-status-error/5">
              <CardTitle className="text-xs font-bold text-status-error uppercase tracking-wider">
                Overdue Commitments ({summary?.overdue_count ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
              {(planningData?.calendar_days || [])
                .flatMap((d) => d.line_items)
                .filter((item) => item.original_delay_days && item.original_delay_days > 0)
                .map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/app/deliveries/${item.id}`)}
                    className="p-2.5 rounded bg-ivory border border-divider text-xs cursor-pointer hover:border-forest transition-colors space-y-1"
                  >
                    <div className="flex justify-between font-mono font-semibold text-status-error">
                      <span>PO #{item.sap_po_number}</span>
                      <span>+{item.original_delay_days}d overdue</span>
                    </div>
                    <div className="font-medium text-ink-primary">{item.material_description}</div>
                    <div className="text-[11px] text-ink-secondary">
                      Vendor: {item.supplier_name} • Bal: {item.outstanding_quantity} {item.uom}
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>

          {/* Column C: Critical Attention & Escalated */}
          <Card className="border border-copper/40 bg-ivory-surface shadow-warm-sm">
            <CardHeader className="py-3 px-4 border-b border-copper/20 bg-copper/5">
              <CardTitle className="text-xs font-bold text-copper uppercase tracking-wider">
                Critical Delivery Exceptions ({summary?.critical_issue_count ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
              {(planningData?.calendar_days || [])
                .flatMap((d) => d.line_items)
                .filter((item) => item.has_critical_issue)
                .map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/app/deliveries/${item.id}`)}
                    className="p-2.5 rounded bg-ivory border border-copper/30 text-xs cursor-pointer hover:border-forest transition-colors space-y-1"
                  >
                    <div className="flex justify-between font-mono font-semibold text-copper">
                      <span>PO #{item.sap_po_number}</span>
                      <span>Critical Exception</span>
                    </div>
                    <div className="font-medium text-ink-primary">{item.material_description}</div>
                    <div className="text-[11px] text-ink-secondary">
                      Vendor: {item.supplier_name} • Bal: {item.outstanding_quantity} {item.uom}
                    </div>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* VIEW 5: Schedule Changes History */}
      {viewMode === 'history' && (
        <Card className="border border-divider bg-ivory-surface shadow-warm-sm">
          <CardHeader className="border-b border-divider/60 pb-3">
            <CardTitle className="text-base font-bold text-forest">Chronological Schedule Revisions</CardTitle>
            <CardDescription className="text-xs text-ink-secondary">
              Operational ETA updates recorded against PO line items. Original commitments remain permanent.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-divider bg-ivory/60 text-[11px] font-semibold text-ink-secondary uppercase">
                  <tr>
                    <th className="py-3 px-4">Revision Date</th>
                    <th className="py-3 px-3">SAP PO / Line</th>
                    <th className="py-3 px-4">Supplier & Material</th>
                    <th className="py-3 px-3 font-mono">Previous ETA</th>
                    <th className="py-3 px-3 font-mono">New Revised ETA</th>
                    <th className="py-3 px-4">Reason / Notes</th>
                    <th className="py-3 px-3">Changed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-divider/50">
                  {historyRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-ink-muted">
                        No schedule revisions recorded.
                      </td>
                    </tr>
                  ) : (
                    historyRecords.map((hist) => (
                      <tr key={hist.id} className="hover:bg-ivory/50">
                        <td className="py-3 px-4 font-mono text-ink-muted">{formatDateIST(hist.changed_at)}</td>
                        <td className="py-3 px-3 font-mono font-bold text-forest">
                          PO #{hist.tracking?.sap_po_number} / {hist.tracking?.sap_po_line_number}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-ink-primary">{hist.tracking?.supplier_name}</div>
                          <div className="text-[11px] text-ink-secondary truncate max-w-xs">
                            {hist.tracking?.material_description}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-ink-muted">
                          {hist.previous_date ? formatDateIST(hist.previous_date) : 'Unset'}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-forest">
                          {formatDateIST(hist.new_date)}
                        </td>
                        <td className="py-3 px-4 text-ink-primary">{hist.reason}</td>
                        <td className="py-3 px-3 text-ink-secondary">{hist.changer?.full_name || 'SCM User'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Day Details Modal (for Monthly view) */}
      {selectedDayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-xl border border-divider bg-ivory-surface shadow-warm-xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-divider px-6 py-4">
              <h3 className="text-base font-bold text-forest">
                Schedule for {selectedDayModal.date} ({selectedDayModal.lines_count} lines)
              </h3>
              <button onClick={() => setSelectedDayModal(null)} className="p-1 text-ink-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-3 flex-1 text-xs">
              {selectedDayModal.line_items.map((item) => (
                <div key={item.id} className="p-3 rounded border border-divider bg-ivory space-y-1.5">
                  <div className="flex justify-between font-mono font-bold text-forest">
                    <span>PO #{item.sap_po_number} / Line {item.sap_po_line_number}</span>
                    <span>{item.delivery_status}</span>
                  </div>
                  <div className="font-semibold text-ink-primary">{item.material_description}</div>
                  <div className="text-ink-secondary">
                    Vendor: {item.supplier_name} • Bal: {item.outstanding_quantity} {item.uom}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

