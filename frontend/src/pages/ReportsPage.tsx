import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import {
  MOCK_DELIVERIES,
  MOCK_SUPPLIERS,
  MOCK_DELIVERY_ISSUES,
  MOCK_SUPPLY_RISKS,
  MOCK_DOCUMENTS,
} from '@/lib/mockData';
import { formatINR, formatDateIST } from '@/lib/formatters';
import { calculateDeliveryMetrics, getTodayISTDate } from '@/lib/deliveryCalculations';
import {
  BarChart3,
  Download,
  TrendingUp,
  Truck,
  AlertTriangle,
  AlertOctagon,
  FileText,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function ReportsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'deliveries' | 'suppliers' | 'issues' | 'risks' | 'documents'>('overview');

  // Filtered deliveries
  const filteredDeliveries = useMemo(() => {
    if (selectedCategory === 'all') return MOCK_DELIVERIES;
    return MOCK_DELIVERIES.filter((d) => d.category === selectedCategory);
  }, [selectedCategory]);

  // Aggregate Performance Metrics across Completed Phases
  const metrics = useMemo(() => {
    const totalDeliveries = filteredDeliveries.length;
    const deliveredCount = filteredDeliveries.filter((d) => d.delivery_status === 'DELIVERED').length;
    const overdueCount = filteredDeliveries.filter((d) => {
      const calc = calculateDeliveryMetrics({
        orderedQuantity: d.ordered_quantity,
        deliveredQuantity: d.delivered_quantity,
        originalCommittedDeliveryDate: d.original_committed_delivery_date,
        currentExpectedDeliveryDate: d.current_expected_delivery_date,
        actualCompletionDate: d.actual_completion_date,
      });
      return calc.isOverdue;
    }).length;

    const onTimeRate = totalDeliveries > 0 ? Math.round((deliveredCount / totalDeliveries) * 100) : 85;

    const totalOpenIssues = MOCK_DELIVERY_ISSUES.filter((i) => i.status !== 'Resolved' && i.status !== 'Closed').length;
    const criticalRisksCount = MOCK_SUPPLY_RISKS.filter((r) => r.risk_score >= 70).length;
    const expiringDocsCount = MOCK_DOCUMENTS.filter((doc) => doc.expiry_status === 'Expiring Soon').length;

    const totalValue = filteredDeliveries.reduce((acc, d) => acc + (d.ordered_quantity * 450), 0);

    return {
      totalDeliveries,
      deliveredCount,
      overdueCount,
      onTimeRate,
      totalOpenIssues,
      criticalRisksCount,
      expiringDocsCount,
      totalValue,
    };
  }, [filteredDeliveries]);

  // CSV Export Functionality
  const handleExportCSV = (reportType: string) => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    const today = getTodayISTDate();

    if (reportType === 'deliveries') {
      headers = ['SAP PO Number', 'PO Line', 'Material Category', 'Ordered Qty', 'Delivered Qty', 'Status', 'Current ETA', 'Original Committed Date'];
      rows = filteredDeliveries.map((d) => [
        d.sap_po_number,
        d.sap_po_line_number,
        d.category || '',
        d.ordered_quantity,
        d.delivered_quantity,
        d.delivery_status,
        d.current_expected_delivery_date || 'N/A',
        d.original_committed_delivery_date || 'N/A',
      ]);
    } else if (reportType === 'suppliers') {
      headers = ['Supplier Code', 'Legal Name', 'Display Name', 'Qualification Status', 'GSTIN'];
      rows = MOCK_SUPPLIERS.map((s) => [
        s.supplier_code,
        s.legal_name,
        s.display_name || '',
        s.qualification_status,
        s.gstin || 'N/A',
      ]);
    } else if (reportType === 'risks') {
      headers = ['Risk ID', 'Category', 'Risk Score', 'Risk Level', 'Risk Explanation', 'Status'];
      rows = MOCK_SUPPLY_RISKS.map((r) => [
        r.risk_number,
        r.category,
        r.risk_score,
        r.risk_level,
        r.risk_explanation || 'Pending',
        r.status,
      ]);
    } else {
      headers = ['Metric', 'Value', 'Calculation Timestamp', 'Baseline Standard'];
      rows = [
        ['On-Time Delivery Rate', `${metrics.onTimeRate}%`, today, 'Target: >= 92%'],
        ['Total Delivery Commitments', metrics.totalDeliveries, today, 'SAP Line Tracked'],
        ['Overdue PO Lines', metrics.overdueCount, today, 'Zero Delays Required'],
        ['Active Delivery Issues', metrics.totalOpenIssues, today, 'Phase 9 Escalated'],
        ['Critical Supply Risks', metrics.criticalRisksCount, today, 'Phase 11 Scored >= 70'],
        ['Documents Expiring Soon', metrics.expiringDocsCount, today, 'Phase 12 <= 30 Days'],
      ];
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `SCM_Flow_${reportType}_report_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-divider pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-forest">
              SCM Analytical Reports & Performance Dashboard
            </h1>
            <Badge variant="outline" className="border-forest text-forest bg-sage-pale font-mono text-xs">
              Phases 7–12 Completed
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-ink-secondary mt-1">
            Consolidated cross-module analytics: SAP delivery tracking, supplier scorecards, issue escalations, supply risks & regulatory document health.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportCSV('summary')}
            className="border-divider text-ink-primary hover:bg-ivory text-xs"
          >
            <Download className="h-3.5 w-3.5 mr-1.5 text-forest" />
            Export Executive CSV
          </Button>
          <Link to="/app/deliveries">
            <Button size="sm" className="bg-forest hover:bg-forest-deep text-white text-xs">
              <Truck className="h-3.5 w-3.5 mr-1.5" />
              Delivery Tracking
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards Row (Phases 7, 8, 9, 11, 12 Integration) */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {/* OTIF Delivery Rate */}
        <Card className="p-3.5 border border-divider bg-ivory-surface shadow-warm-xs">
          <div className="flex items-center justify-between text-ink-secondary text-xs">
            <span>On-Time Rate</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-forest mt-1.5">{metrics.onTimeRate}%</div>
          <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
            Phase 8 Target: &ge; 90%
          </p>
        </Card>

        {/* Total Deliveries Tracked */}
        <Card className="p-3.5 border border-divider bg-ivory-surface shadow-warm-xs">
          <div className="flex items-center justify-between text-ink-secondary text-xs">
            <span>Tracked Deliveries</span>
            <Truck className="h-4 w-4 text-forest" />
          </div>
          <div className="text-xl font-bold text-forest mt-1.5">{metrics.totalDeliveries}</div>
          <p className="text-[10px] text-ink-secondary mt-0.5">
            Phase 7 SAP PO Lines
          </p>
        </Card>

        {/* Overdue Deliveries */}
        <Card className="p-3.5 border border-divider bg-ivory-surface shadow-warm-xs">
          <div className="flex items-center justify-between text-ink-secondary text-xs">
            <span>Overdue Lines</span>
            <Clock className="h-4 w-4 text-copper" />
          </div>
          <div className="text-xl font-bold text-copper mt-1.5">{metrics.overdueCount}</div>
          <p className="text-[10px] text-copper font-medium mt-0.5">
            Daily Delay Tracking Active
          </p>
        </Card>

        {/* Active Issues */}
        <Card className="p-3.5 border border-divider bg-ivory-surface shadow-warm-xs">
          <div className="flex items-center justify-between text-ink-secondary text-xs">
            <span>Open Issues</span>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-xl font-bold text-amber-700 mt-1.5">{metrics.totalOpenIssues}</div>
          <p className="text-[10px] text-ink-secondary mt-0.5">
            Phase 9 Escalations
          </p>
        </Card>

        {/* Critical Supply Risks */}
        <Card className="p-3.5 border border-divider bg-ivory-surface shadow-warm-xs">
          <div className="flex items-center justify-between text-ink-secondary text-xs">
            <span>Critical Risks</span>
            <AlertOctagon className="h-4 w-4 text-red-600" />
          </div>
          <div className="text-xl font-bold text-red-700 mt-1.5">{metrics.criticalRisksCount}</div>
          <p className="text-[10px] text-red-600 font-medium mt-0.5">
            Phase 11 Score &ge; 70
          </p>
        </Card>

        {/* Expiring Documents */}
        <Card className="p-3.5 border border-divider bg-ivory-surface shadow-warm-xs">
          <div className="flex items-center justify-between text-ink-secondary text-xs">
            <span>Expiring &le; 30d</span>
            <FileText className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-forest mt-1.5">{metrics.expiringDocsCount}</div>
          <p className="text-[10px] text-ink-secondary mt-0.5">
            Phase 12 Document Vault
          </p>
        </Card>
      </div>

      {/* Navigation Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-divider pb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'overview'
                ? 'bg-forest text-white shadow-xs'
                : 'text-ink-secondary hover:text-forest hover:bg-ivory'
            }`}
          >
            Executive Overview
          </button>
          <button
            onClick={() => setActiveTab('deliveries')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'deliveries'
                ? 'bg-forest text-white shadow-xs'
                : 'text-ink-secondary hover:text-forest hover:bg-ivory'
            }`}
          >
            Delivery Performance (Phase 7)
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'suppliers'
                ? 'bg-forest text-white shadow-xs'
                : 'text-ink-secondary hover:text-forest hover:bg-ivory'
            }`}
          >
            Supplier Directory (Phase 6 & 8)
          </button>
          <button
            onClick={() => setActiveTab('issues')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'issues'
                ? 'bg-forest text-white shadow-xs'
                : 'text-ink-secondary hover:text-forest hover:bg-ivory'
            }`}
          >
            Issues & Escalations (Phase 9)
          </button>
          <button
            onClick={() => setActiveTab('risks')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'risks'
                ? 'bg-forest text-white shadow-xs'
                : 'text-ink-secondary hover:text-forest hover:bg-ivory'
            }`}
          >
            Supply Risk Matrix (Phase 11)
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'documents'
                ? 'bg-forest text-white shadow-xs'
                : 'text-ink-secondary hover:text-forest hover:bg-ivory'
            }`}
          >
            Document Vault (Phase 12)
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex items-center space-x-2 text-xs">
          <span className="text-ink-muted">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-8 rounded-md border border-divider bg-ivory px-2.5 text-xs text-ink-primary focus:outline-none focus:ring-1 focus:ring-forest"
          >
            <option value="all">All Categories</option>
            <option value="API">API (Active Pharma)</option>
            <option value="PM">PM (Packaging)</option>
            <option value="EXE">EXE (Excipients)</option>
            <option value="Consumables">Consumables</option>
          </select>
        </div>
      </div>

      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quick Module Navigation Hub */}
            <Card className="border border-divider bg-ivory-surface">
              <CardHeader className="pb-3 border-b border-divider/60">
                <CardTitle className="text-sm font-bold text-forest flex items-center justify-between">
                  <span>Operational Modules Status</span>
                  <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50">
                    Phases 7–12 Complete
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-ink-secondary">
                  Direct access to all implemented SCM Flow transactional capabilities.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Link
                    to="/app/deliveries"
                    className="p-2.5 rounded-lg border border-divider hover:border-forest hover:bg-ivory/60 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-semibold text-forest flex items-center gap-1.5">
                        <Truck className="h-3.5 w-3.5" />
                        <span>Delivery Tracking</span>
                      </div>
                      <div className="text-[10px] text-ink-muted">Phase 7: SAP PO Line Tracking</div>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-ink-muted group-hover:text-forest" />
                  </Link>

                  <Link
                    to="/app/suppliers/performance"
                    className="p-2.5 rounded-lg border border-divider hover:border-forest hover:bg-ivory/60 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-semibold text-forest flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span>Supplier Performance</span>
                      </div>
                      <div className="text-[10px] text-ink-muted">Phase 8: OTIF & Analytics</div>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-ink-muted group-hover:text-forest" />
                  </Link>

                  <Link
                    to="/app/deliveries/issues"
                    className="p-2.5 rounded-lg border border-divider hover:border-forest hover:bg-ivory/60 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-semibold text-forest flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <span>Delivery Issues</span>
                      </div>
                      <div className="text-[10px] text-ink-muted">Phase 9: Multi-tier Escalation</div>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-ink-muted group-hover:text-forest" />
                  </Link>

                  <Link
                    to="/app/deliveries/planning"
                    className="p-2.5 rounded-lg border border-divider hover:border-forest hover:bg-ivory/60 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-semibold text-forest flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-forest" />
                        <span>Delivery Planning</span>
                      </div>
                      <div className="text-[10px] text-ink-muted">Phase 10: 14-Day Calendar</div>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-ink-muted group-hover:text-forest" />
                  </Link>

                  <Link
                    to="/app/deliveries/risks"
                    className="p-2.5 rounded-lg border border-divider hover:border-forest hover:bg-ivory/60 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-semibold text-forest flex items-center gap-1.5">
                        <AlertOctagon className="h-3.5 w-3.5 text-red-600" />
                        <span>Supply Risk</span>
                      </div>
                      <div className="text-[10px] text-ink-muted">Phase 11: Criticality Scoring</div>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-ink-muted group-hover:text-forest" />
                  </Link>

                  <Link
                    to="/app/documents"
                    className="p-2.5 rounded-lg border border-divider hover:border-forest hover:bg-ivory/60 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="font-semibold text-forest flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-blue-600" />
                        <span>Document Vault</span>
                      </div>
                      <div className="text-[10px] text-ink-muted">Phase 12: Expiry & Audit Trail</div>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-ink-muted group-hover:text-forest" />
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Regulatory & Enterprise Baseline Information */}
            <Card className="border border-divider bg-ivory-surface">
              <CardHeader className="pb-3 border-b border-divider/60">
                <CardTitle className="text-sm font-bold text-forest flex items-center justify-between">
                  <span>Regulatory & Governance Baseline</span>
                  <Badge variant="outline" className="text-[10px] text-forest border-forest bg-sage-pale">
                    Audit Trail Active
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs text-ink-secondary">
                  SCM Flow enterprise compliance and financial standards.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-3 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-divider/40">
                  <span className="text-ink-secondary">Default Currency:</span>
                  <span className="font-mono font-semibold text-forest">{formatINR(metrics.totalValue)} (Tracked Value)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-divider/40">
                  <span className="text-ink-secondary">Operating Timezone:</span>
                  <span className="font-mono font-semibold text-forest">Asia/Kolkata (IST, UTC+05:30)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-divider/40">
                  <span className="text-ink-secondary">Proactive Delivery Alert:</span>
                  <span className="font-semibold text-forest">Exactly 3 Calendar Days Prior</span>
                </div>
                <div className="flex justify-between py-1 border-b border-divider/40">
                  <span className="text-ink-secondary">Approved Classifications:</span>
                  <span className="font-semibold text-forest">API, Packaging, Excipients, Consumables</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-ink-secondary">GxP / 21 CFR Part 11:</span>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> Immutable Audit Triggers Enforced
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Deliveries Summary Table */}
          <Card className="border border-divider bg-ivory-surface">
            <CardHeader className="pb-3 border-b border-divider/60 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-forest">
                  Recent Material Delivery Commitments (Phase 7)
                </CardTitle>
                <CardDescription className="text-xs text-ink-secondary">
                  Live tracking status across registered SAP PO lines.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportCSV('deliveries')}
                className="text-xs border-divider text-ink-primary hover:bg-ivory"
              >
                <Download className="h-3.5 w-3.5 mr-1.5 text-forest" />
                Export Deliveries
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-divider bg-ivory/50">
                    <TableHead className="text-xs font-semibold text-forest">SAP PO Ref</TableHead>
                    <TableHead className="text-xs font-semibold text-forest">Material Category</TableHead>
                    <TableHead className="text-xs font-semibold text-forest">Ordered / Delivered</TableHead>
                    <TableHead className="text-xs font-semibold text-forest">Promised Date</TableHead>
                    <TableHead className="text-xs font-semibold text-forest">Current ETA</TableHead>
                    <TableHead className="text-xs font-semibold text-forest">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeliveries.slice(0, 5).map((d) => (
                    <TableRow key={d.id} className="border-divider hover:bg-ivory/30">
                      <TableCell className="font-mono text-xs font-semibold text-forest">
                        {d.sap_po_number} / {d.sap_po_line_number}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {d.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-semibold text-ink-primary">{d.delivered_quantity}</span>
                        <span className="text-ink-muted"> / {d.ordered_quantity}</span>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-ink-secondary">
                        {formatDateIST(d.original_committed_delivery_date)}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-ink-secondary">
                        {formatDateIST(d.current_expected_delivery_date)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            d.delivery_status === 'DELIVERED'
                              ? 'default'
                              : d.delivery_status === 'DELAYED'
                              ? 'destructive'
                              : 'outline'
                          }
                          className="text-[10px] capitalize"
                        >
                          {d.delivery_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 2: DELIVERIES (Phase 7) */}
      {activeTab === 'deliveries' && (
        <Card className="border border-divider bg-ivory-surface">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-divider/60">
            <div>
              <CardTitle className="text-sm font-bold text-forest">
                Phase 7 — Material Delivery Tracking Full Audit
              </CardTitle>
              <CardDescription className="text-xs text-ink-secondary">
                Detailed delivery progress and delay variance against SAP procurement lines.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => handleExportCSV('deliveries')}
              className="bg-forest hover:bg-forest-deep text-white text-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download CSV
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-divider bg-ivory/50">
                  <TableHead className="text-xs font-semibold text-forest">SAP PO Reference</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Category</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Qty Ordered</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Qty Delivered</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Outstanding</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Original Date</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Current ETA</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeliveries.map((d) => (
                  <TableRow key={d.id} className="border-divider hover:bg-ivory/30">
                    <TableCell className="font-mono text-xs font-semibold text-forest">
                      {d.sap_po_number} - Line {d.sap_po_line_number}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {d.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{d.ordered_quantity}</TableCell>
                    <TableCell className="text-xs font-mono text-emerald-700 font-semibold">{d.delivered_quantity}</TableCell>
                    <TableCell className="text-xs font-mono text-copper font-semibold">
                      {d.outstanding_quantity}
                    </TableCell>
                    <TableCell className="text-xs font-mono">{formatDateIST(d.original_committed_delivery_date)}</TableCell>
                    <TableCell className="text-xs font-mono">{formatDateIST(d.current_expected_delivery_date)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          d.delivery_status === 'DELIVERED'
                            ? 'default'
                            : d.delivery_status === 'DELAYED'
                            ? 'destructive'
                            : 'outline'
                        }
                        className="text-[10px] capitalize"
                      >
                        {d.delivery_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: SUPPLIERS (Phase 6 & 8) */}
      {activeTab === 'suppliers' && (
        <Card className="border border-divider bg-ivory-surface">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-divider/60">
            <div>
              <CardTitle className="text-sm font-bold text-forest">
                Phase 6 & 8 — Supplier Directory & Qualification Status
              </CardTitle>
              <CardDescription className="text-xs text-ink-secondary">
                Registered vendors, qualification status, and compliance identifiers.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => handleExportCSV('suppliers')}
              className="bg-forest hover:bg-forest-deep text-white text-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download CSV
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-divider bg-ivory/50">
                  <TableHead className="text-xs font-semibold text-forest">Supplier Code</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Legal Name</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Display Name</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">GSTIN</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_SUPPLIERS.map((s) => (
                  <TableRow key={s.id} className="border-divider hover:bg-ivory/30">
                    <TableCell className="font-mono text-xs font-semibold text-forest">{s.supplier_code}</TableCell>
                    <TableCell className="text-xs font-medium text-ink-primary">{s.legal_name}</TableCell>
                    <TableCell className="text-xs text-ink-secondary">{s.display_name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={s.qualification_status === 'QUALIFIED' ? 'default' : 'outline'}
                        className="text-[10px] capitalize"
                      >
                        {s.qualification_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-ink-muted">{s.gstin || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: ISSUES & ESCALATIONS (Phase 9) */}
      {activeTab === 'issues' && (
        <Card className="border border-divider bg-ivory-surface">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-divider/60">
            <div>
              <CardTitle className="text-sm font-bold text-forest">
                Phase 9 — Delivery Issues & Escalation Log
              </CardTitle>
              <CardDescription className="text-xs text-ink-secondary">
                Registered delivery discrepancies, supplier follow-ups, and escalation tiers.
              </CardDescription>
            </div>
            <Link to="/app/deliveries/issues">
              <Button size="sm" className="bg-forest hover:bg-forest-deep text-white text-xs">
                Manage Issues
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-divider bg-ivory/50">
                  <TableHead className="text-xs font-semibold text-forest">Issue Number</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">PO Reference</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Issue Type</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Severity</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Description</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_DELIVERY_ISSUES.map((issue) => (
                  <TableRow key={issue.id} className="border-divider hover:bg-ivory/30">
                    <TableCell className="font-mono text-xs font-semibold text-forest">{issue.issue_number}</TableCell>
                    <TableCell className="text-xs font-mono">{issue.sap_po_number} - Line {issue.sap_po_line_number}</TableCell>
                    <TableCell className="text-xs">{issue.issue_type}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          issue.severity === 'Critical'
                            ? 'destructive'
                            : issue.severity === 'High'
                            ? 'destructive'
                            : 'outline'
                        }
                        className="text-[10px] capitalize"
                      >
                        {issue.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-ink-secondary max-w-xs truncate">
                      {issue.description}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {issue.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* TAB 5: RISKS (Phase 11) */}
      {activeTab === 'risks' && (
        <Card className="border border-divider bg-ivory-surface">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-divider/60">
            <div>
              <CardTitle className="text-sm font-bold text-forest">
                Phase 11 — Material Supply Risk & Criticality Analysis
              </CardTitle>
              <CardDescription className="text-xs text-ink-secondary">
                Quantitative supply risk scores, impact on production lines, and assigned mitigation actions.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => handleExportCSV('risks')}
              className="bg-forest hover:bg-forest-deep text-white text-xs"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download CSV
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-divider bg-ivory/50">
                  <TableHead className="text-xs font-semibold text-forest">Risk Number</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Material</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Category</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Risk Score</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Risk Level</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Explanation</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_SUPPLY_RISKS.map((risk) => (
                  <TableRow key={risk.id} className="border-divider hover:bg-ivory/30">
                    <TableCell className="font-mono text-xs font-semibold text-forest">{risk.risk_number}</TableCell>
                    <TableCell className="text-xs font-semibold">{risk.material_code}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {risk.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono font-bold text-red-700">{risk.risk_score} / 100</TableCell>
                    <TableCell>
                      <Badge
                        variant={risk.risk_level === 'Critical' || risk.risk_level === 'High' ? 'destructive' : 'outline'}
                        className="text-[10px] capitalize"
                      >
                        {risk.risk_level}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-ink-secondary max-w-xs truncate">
                      {risk.risk_explanation || 'Pending Action'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {risk.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* TAB 6: DOCUMENTS (Phase 12) */}
      {activeTab === 'documents' && (
        <Card className="border border-divider bg-ivory-surface">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-divider/60">
            <div>
              <CardTitle className="text-sm font-bold text-forest">
                Phase 12 — SCM Document Management & Expiry Tracking
              </CardTitle>
              <CardDescription className="text-xs text-ink-secondary">
                Supplier GMP certificates, CoA documents, regulatory approvals, and expiry alerts.
              </CardDescription>
            </div>
            <Link to="/app/documents">
              <Button size="sm" className="bg-forest hover:bg-forest-deep text-white text-xs">
                Open Document Vault
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-divider bg-ivory/50">
                  <TableHead className="text-xs font-semibold text-forest">Doc Number</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Title</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Group</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Verification</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Expiry Date</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-forest">Version</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_DOCUMENTS.map((doc) => (
                  <TableRow key={doc.id} className="border-divider hover:bg-ivory/30">
                    <TableCell className="font-mono text-xs font-semibold text-forest">{doc.document_number}</TableCell>
                    <TableCell className="text-xs font-medium text-forest max-w-xs truncate">{doc.title}</TableCell>
                    <TableCell className="text-xs font-mono uppercase">{doc.category_group}</TableCell>
                    <TableCell>
                      <Badge
                        variant={doc.review_status === 'Verified' ? 'default' : 'outline'}
                        className="text-[10px] capitalize"
                      >
                        {doc.review_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-ink-secondary">{formatDateIST(doc.expiry_date)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={doc.expiry_status === 'Expiring Soon' ? 'warning' : 'outline'}
                        className="text-[10px]"
                      >
                        {doc.expiry_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">v{doc.current_version_number}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
