import React, { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Coins,
  CheckSquare,
  ShieldAlert,
  Wallet,
  TrendingUp,
  Receipt,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  ArrowUpRight,
  Download,
} from 'lucide-react';
import { formatINR } from '@/lib/formatters';

interface DepartmentBudgetLedger {
  id: string;
  department_code: string;
  department_name: string;
  allocated_budget: number;
  approved_budget: number;
  po_committed: number;
  invoiced_amount: number;
  available_balance: number;
  utilization_percent: number;
}

interface ApprovalRequestItem {
  id: string;
  request_number: string;
  type: 'Budget Allocation' | 'Purchase Requisition' | 'High-Value PO Release';
  project_code: string;
  department_name: string;
  requestor: string;
  requested_amount: number;
  required_tier: 'Level 1: HOD' | 'Level 2: SCM VP' | 'Level 3: CFO';
  submission_date: string;
  justification: string;
  status: 'pending' | 'approved' | 'rejected';
}

const INITIAL_BUDGET_LEDGERS: DepartmentBudgetLedger[] = [
  {
    id: 'b-001',
    department_code: 'SCM',
    department_name: 'Supply Chain Management',
    allocated_budget: 15000000,
    approved_budget: 12500000,
    po_committed: 9850000,
    invoiced_amount: 7240000,
    available_balance: 5150000,
    utilization_percent: 65.7,
  },
  {
    id: 'b-002',
    department_code: 'FORM',
    department_name: 'Formulations & Synthesis',
    allocated_budget: 22000000,
    approved_budget: 18000000,
    po_committed: 14500000,
    invoiced_amount: 11200000,
    available_balance: 7500000,
    utilization_percent: 65.9,
  },
  {
    id: 'b-003',
    department_code: 'QC',
    department_name: 'Quality Assurance & Control',
    allocated_budget: 7500000,
    approved_budget: 6000000,
    po_committed: 4200000,
    invoiced_amount: 3500000,
    available_balance: 3300000,
    utilization_percent: 56.0,
  },
  {
    id: 'b-004',
    department_code: 'LOG',
    department_name: 'Logistics & Warehousing',
    allocated_budget: 5000000,
    approved_budget: 4500000,
    po_committed: 2800000,
    invoiced_amount: 2150000,
    available_balance: 2200000,
    utilization_percent: 56.0,
  },
];

const INITIAL_APPROVAL_REQUESTS: ApprovalRequestItem[] = [
  {
    id: 'apr-001',
    request_number: 'REQ-2026-0089',
    type: 'Purchase Requisition',
    project_code: 'PRJ-2026-001',
    department_name: 'Supply Chain Management',
    requestor: 'Priya Sharma (EMP002)',
    requested_amount: 1850000,
    required_tier: 'Level 2: SCM VP',
    submission_date: '2026-11-02',
    justification: 'Bulk active raw material procurement (Paracetamol IP) for commercial manufacturing batch 14.',
    status: 'pending',
  },
  {
    id: 'apr-002',
    request_number: 'REQ-2026-0090',
    type: 'Budget Allocation',
    project_code: 'PRJ-2026-002',
    department_name: 'Formulations & Synthesis',
    requestor: 'Rahul Verma (EMP003)',
    requested_amount: 450000,
    required_tier: 'Level 1: HOD',
    submission_date: '2026-11-03',
    justification: 'Pilot batch sterility testing and specialized borosilicate amber vials container qualification.',
    status: 'pending',
  },
  {
    id: 'apr-003',
    request_number: 'REQ-2026-0091',
    type: 'High-Value PO Release',
    project_code: 'PRJ-2026-003',
    department_name: 'Formulations & Synthesis',
    requestor: 'Dr. Suresh Nair (HOD)',
    requested_amount: 3200000,
    required_tier: 'Level 3: CFO',
    submission_date: '2026-11-04',
    justification: 'Capital synthesis continuous compression tooling and validation equipment procurement.',
    status: 'pending',
  },
];

export function BudgetsApprovalsPage() {
  const { permissions, employee } = useAuth();

  const canViewBudgets = permissions.includes('budgets.view');
  const canViewApprovals = permissions.includes('approvals.view');

  const [activeTab, setActiveTab] = useState<'budgets' | 'approvals'>(
    canViewBudgets ? 'budgets' : 'approvals'
  );

  const [budgets] = useState<DepartmentBudgetLedger[]>(INITIAL_BUDGET_LEDGERS);
  const [requests, setRequests] = useState<ApprovalRequestItem[]>(INITIAL_APPROVAL_REQUESTS);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const stats = useMemo(() => {
    const totalAllocated = budgets.reduce((acc, curr) => acc + curr.allocated_budget, 0);
    const totalCommitted = budgets.reduce((acc, curr) => acc + curr.po_committed, 0);
    const totalInvoiced = budgets.reduce((acc, curr) => acc + curr.invoiced_amount, 0);
    const totalAvailable = budgets.reduce((acc, curr) => acc + curr.available_balance, 0);
    const pendingRequestsCount = requests.filter((r) => r.status === 'pending').length;

    return { totalAllocated, totalCommitted, totalInvoiced, totalAvailable, pendingRequestsCount };
  }, [budgets, requests]);

  const handleDecision = (requestId: string, decision: 'approved' | 'rejected') => {
    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: decision } : r))
    );
    const target = requests.find((r) => r.id === requestId);
    const msg = `Request ${target?.request_number || requestId} has been ${decision} by ${employee?.full_name || 'System Approver'}.`;
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 5000);
  };

  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (activeTab === 'budgets') {
      headers = ['Department Code', 'Department Name', 'Allocated Budget (INR)', 'Approved Budget (INR)', 'PO Committed (INR)', 'Invoiced Amount (INR)', 'Available Balance (INR)', 'Utilization %'];
      rows = budgets.map((b) => [
        b.department_code,
        b.department_name,
        b.allocated_budget,
        b.approved_budget,
        b.po_committed,
        b.invoiced_amount,
        b.available_balance,
        `${b.utilization_percent}%`,
      ]);
    } else {
      headers = ['Request Number', 'Type', 'Project', 'Department', 'Requestor', 'Requested Amount (INR)', 'Required Tier', 'Date', 'Status'];
      rows = requests.map((r) => [
        r.request_number,
        r.type,
        r.project_code,
        r.department_name,
        r.requestor,
        r.requested_amount,
        r.required_tier,
        r.submission_date,
        r.status,
      ]);
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `SCM_Flow_${activeTab === 'budgets' ? 'Departmental_Budgets' : 'Approval_Requests'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-forest flex items-center space-x-2">
            <Coins className="h-6 w-6 text-forest" />
            <span>Budgets & Multi-Tier Approval Governance</span>
          </h1>
          <p className="text-xs text-ink-secondary mt-0.5">
            Departmental capital allocations, PO expenditure commitments, and sequential threshold sign-off queues.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="border-divider text-xs"
          >
            <Download className="h-4 w-4 mr-1.5 text-forest" />
            Export CSV
          </Button>

          {/* Tab Toggle */}
          <div className="flex items-center rounded-lg bg-ivory p-1 border border-divider">
            {canViewBudgets && (
              <button
                type="button"
                onClick={() => setActiveTab('budgets')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === 'budgets'
                    ? 'bg-ivory-surface text-forest shadow-warm-sm border border-divider/60'
                    : 'text-ink-secondary hover:text-forest'
                }`}
              >
                Departmental Budgets
              </button>
            )}

            {canViewApprovals && (
              <button
                type="button"
                onClick={() => setActiveTab('approvals')}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeTab === 'approvals'
                    ? 'bg-ivory-surface text-forest shadow-warm-sm border border-divider/60'
                    : 'text-ink-secondary hover:text-forest'
                }`}
              >
                Approval Queues ({requests.filter((r) => r.status === 'pending').length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-300 p-3 text-xs text-emerald-800 flex items-center space-x-2 shadow-sm animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Security Governance Notice in Pale Copper */}
      <div className="rounded-xl border border-copper/30 bg-copper-pale/60 p-4 text-xs text-copper-dark shadow-warm-sm">
        <div className="flex items-start space-x-2.5">
          <ShieldAlert className="h-4 w-4 text-copper shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-copper-dark">
              Workflow-Based Approval Authority & Automatic Self-Approval Denial
            </div>
            <p className="leading-relaxed text-[11px] text-ink-secondary">
              Approval authority is strictly bound to workflow step assignments and is <strong>never inferred from role, department, or designation</strong>. SCM Flow enforces automatic denial of self-approval: requesters cannot approve their own PRs, POs, or budget releases.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-divider shadow-warm-xs bg-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-ink-muted">Allocated Budget</span>
              <Wallet className="h-4 w-4 text-forest" />
            </div>
            <div className="text-lg font-bold text-forest mt-1 truncate">{formatINR(stats.totalAllocated)}</div>
            <span className="text-[10px] text-ink-muted">Capital allocations</span>
          </CardContent>
        </Card>

        <Card className="border-divider shadow-warm-xs bg-forest text-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-sage-light">PO Committed</span>
              <Receipt className="h-4 w-4 text-sage" />
            </div>
            <div className="text-lg font-bold mt-1 truncate">{formatINR(stats.totalCommitted)}</div>
            <span className="text-[10px] text-sage-light">Committed PO contracts</span>
          </CardContent>
        </Card>

        <Card className="border-divider shadow-warm-xs bg-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-blue-700">Invoiced / Spent</span>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-lg font-bold text-blue-900 mt-1 truncate">{formatINR(stats.totalInvoiced)}</div>
            <span className="text-[10px] text-ink-muted">Disbursed to suppliers</span>
          </CardContent>
        </Card>

        <Card className="border-divider shadow-warm-xs bg-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-emerald-700">Available Balance</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-lg font-bold text-emerald-900 mt-1 truncate">{formatINR(stats.totalAvailable)}</div>
            <span className="text-[10px] text-ink-muted">Uncommitted capital</span>
          </CardContent>
        </Card>

        <Card className="border-divider shadow-warm-xs bg-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-amber-700">Pending Approvals</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-xl font-bold text-amber-900 mt-1">{stats.pendingRequestsCount}</div>
            <span className="text-[10px] text-ink-muted">Awaiting decision</span>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 1: DEPARTMENTAL BUDGETS */}
      {activeTab === 'budgets' && canViewBudgets && (
        <div className="space-y-4">
          <Card className="border-divider shadow-warm-sm">
            <CardHeader className="pb-3 border-b border-divider/60 bg-ivory/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-forest flex items-center space-x-2">
                    <Coins className="h-4 w-4 text-sage-dark" />
                    <span>Departmental Capital Budgets & Real-Time PO Deductions</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-ink-secondary">
                    Allocated budget ceilings, approved allocations, committed Purchase Orders, and net remaining balances in Indian Rupees (INR ₹).
                  </CardDescription>
                </div>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                  Active Financial Ledger
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-ivory/50">
                    <TableHead className="font-semibold text-xs text-forest">Department & Code</TableHead>
                    <TableHead className="font-semibold text-xs text-forest text-right">Allocated Budget</TableHead>
                    <TableHead className="font-semibold text-xs text-forest text-right">Approved Project Limit</TableHead>
                    <TableHead className="font-semibold text-xs text-forest text-right">PO Committed</TableHead>
                    <TableHead className="font-semibold text-xs text-forest text-right">Invoiced / Paid</TableHead>
                    <TableHead className="font-semibold text-xs text-forest text-right">Available Balance</TableHead>
                    <TableHead className="font-semibold text-xs text-forest text-center">Utilization</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgets.map((b) => (
                    <TableRow key={b.id} className="hover:bg-ivory/30">
                      <TableCell>
                        <div className="font-medium text-xs text-ink-primary">{b.department_name}</div>
                        <span className="inline-block font-mono text-[10px] text-forest bg-sage/20 px-1.5 py-0.2 rounded mt-0.5">
                          {b.department_code}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-ink-primary font-semibold">
                        {formatINR(b.allocated_budget)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-ink-secondary">
                        {formatINR(b.approved_budget)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-forest font-semibold">
                        {formatINR(b.po_committed)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-ink-secondary">
                        {formatINR(b.invoiced_amount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-emerald-700">
                        {formatINR(b.available_balance)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="w-24 mx-auto space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-ink-secondary">
                            <span>{b.utilization_percent}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                b.utilization_percent > 80
                                  ? 'bg-rose-500'
                                  : b.utilization_percent > 60
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${b.utilization_percent}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECTION 2: APPROVAL WORKFLOWS */}
      {activeTab === 'approvals' && canViewApprovals && (
        <div className="space-y-5">
          {/* Multi-Tier Authority Governance Table */}
          <Card className="border-divider shadow-warm-xs">
            <CardHeader className="pb-2 border-b border-divider/60 bg-ivory/30">
              <CardTitle className="text-xs font-semibold text-forest flex items-center space-x-2">
                <Layers className="h-4 w-4 text-forest" />
                <span>Configured Sequential Approval Matrix</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-divider bg-white">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-forest">Tier 1: Department Head</span>
                    <Badge variant="outline" className="text-[10px]">Level 1</Badge>
                  </div>
                  <div className="text-xs text-ink-secondary mt-1">
                    Value ceiling: <strong>Up to ₹ 5,00,000.00</strong>
                  </div>
                  <div className="text-[10px] text-ink-muted mt-0.5">
                    Authorized for pilot batch BOM allocations and routine consumables.
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-divider bg-white">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-forest">Tier 2: SCM VP / Director</span>
                    <Badge variant="outline" className="text-[10px]">Level 2</Badge>
                  </div>
                  <div className="text-xs text-ink-secondary mt-1">
                    Value ceiling: <strong>Up to ₹ 25,00,000.00</strong>
                  </div>
                  <div className="text-[10px] text-ink-muted mt-0.5">
                    Authorized for bulk API procurement and primary packaging contracts.
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-divider bg-white">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-forest">Tier 3: Chief Financial Officer</span>
                    <Badge variant="outline" className="text-[10px]">Level 3</Badge>
                  </div>
                  <div className="text-xs text-ink-secondary mt-1">
                    Value ceiling: <strong>Exceeding ₹ 25,00,000.00</strong>
                  </div>
                  <div className="text-[10px] text-ink-muted mt-0.5">
                    Authorized for annual vendor volume commitments and capital equipment.
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending Approval Requests Table */}
          <Card className="border-divider shadow-warm-sm">
            <CardHeader className="pb-3 border-b border-divider/60 bg-ivory/30">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold text-forest flex items-center space-x-2">
                    <CheckSquare className="h-4 w-4 text-sage-dark" />
                    <span>Active Approval Decision Queue</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-ink-secondary">
                    Review and authorize material requisitions and departmental budget releases.
                  </CardDescription>
                </div>
                <span className="text-xs font-mono text-ink-muted">
                  {requests.filter((r) => r.status === 'pending').length} Action Items
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-ivory/50">
                    <TableHead className="font-semibold text-xs text-forest">Request & Date</TableHead>
                    <TableHead className="font-semibold text-xs text-forest">Type & Project</TableHead>
                    <TableHead className="font-semibold text-xs text-forest">Requestor & Justification</TableHead>
                    <TableHead className="font-semibold text-xs text-forest">Required Governance Tier</TableHead>
                    <TableHead className="font-semibold text-xs text-forest text-right">Requested Amount</TableHead>
                    <TableHead className="font-semibold text-xs text-forest text-center">Status</TableHead>
                    <TableHead className="font-semibold text-xs text-forest text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id} className="hover:bg-ivory/30">
                      <TableCell>
                        <div className="font-mono font-bold text-xs text-forest">{r.request_number}</div>
                        <div className="text-[10px] text-ink-muted flex items-center space-x-1 mt-0.5">
                          <Clock className="h-3 w-3 text-sage" />
                          <span>{r.submission_date}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-xs text-ink-primary">{r.type}</div>
                        <div className="font-mono text-[10px] text-ink-muted">{r.project_code} • {r.department_name}</div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="text-xs text-ink-primary font-medium">{r.requestor}</div>
                        <div className="text-[11px] text-ink-secondary truncate">{r.justification}</div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-block text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200">
                          {r.required_tier}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-forest">
                        {formatINR(r.requested_amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.status === 'pending' && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">
                            Pending Review
                          </Badge>
                        )}
                        {r.status === 'approved' && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">
                            Approved
                          </Badge>
                        )}
                        {r.status === 'rejected' && (
                          <Badge className="bg-rose-100 text-rose-800 border-rose-300">
                            Rejected
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === 'pending' ? (
                          <div className="flex items-center justify-end space-x-1.5">
                            <Button
                              size="sm"
                              onClick={() => handleDecision(r.id, 'approved')}
                              className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px]"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDecision(r.id, 'rejected')}
                              className="h-7 px-2.5 border-rose-300 text-rose-700 hover:bg-rose-50 text-[11px]"
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-ink-muted italic">Decision Logged</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fallback messages */}
      {activeTab === 'budgets' && !canViewBudgets && (
        <div className="rounded-xl border border-divider bg-ivory-surface p-6 text-center text-xs text-ink-secondary">
          You do not have permission (<code className="font-mono">budgets.view</code>) to view departmental budget ledgers.
        </div>
      )}

      {activeTab === 'approvals' && !canViewApprovals && (
        <div className="rounded-xl border border-divider bg-ivory-surface p-6 text-center text-xs text-ink-secondary">
          You do not have permission (<code className="font-mono">approvals.view</code>) to view approval queues.
        </div>
      )}
    </div>
  );
}
