import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ShoppingCart,
  Search,
  Filter,
  Plus,
  Download,
  Building2,
  FileCheck2,
  Truck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Receipt,
  AlertCircle,
} from 'lucide-react';
import { formatINR } from '@/lib/formatters';

export interface PurchaseRequisitionItem {
  id: string;
  pr_number: string;
  project_code: string;
  project_name: string;
  department: string;
  title: string;
  item_count: number;
  total_amount: number;
  status: 'draft' | 'submitted' | 'approved' | 'partially_ordered' | 'fully_ordered' | 'cancelled';
  requested_by: string;
  required_by_date: string;
  created_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  po_number: string;
  sap_po_number: string;
  linked_pr_number: string;
  supplier_code: string;
  supplier_name: string;
  project_code: string;
  subtotal_amount: number;
  gst_amount: number;
  total_amount: number;
  status: 'issued' | 'confirmed' | 'partially_delivered' | 'fully_delivered' | 'closed' | 'cancelled';
  delivery_terms: string;
  payment_terms: string;
  expected_delivery_date: string;
  tracking_id?: string;
  created_at: string;
}

const INITIAL_PRS: PurchaseRequisitionItem[] = [
  {
    id: 'pr-001',
    pr_number: 'PR-2026-0041',
    project_code: 'PRJ-2026-001',
    project_name: 'Oral Solid Dosage Line Expansion',
    department: 'Supply Chain Management',
    title: 'API Active Raw Material Requisition for Batch Formulation #14',
    item_count: 3,
    total_amount: 1850000,
    status: 'fully_ordered',
    requested_by: 'Dev System Administrator (AXX09)',
    required_by_date: '2026-11-20',
    created_at: '2026-10-15',
  },
  {
    id: 'pr-002',
    pr_number: 'PR-2026-0042',
    project_code: 'PRJ-2026-002',
    project_name: 'Injectable Formulation Commercialization',
    department: 'Formulations & Synthesis',
    title: 'Amber Glass Vials and Aluminum Seal Packaging Procurement',
    item_count: 2,
    total_amount: 925000,
    status: 'partially_ordered',
    requested_by: 'Priya Sharma (EMP002)',
    required_by_date: '2026-12-05',
    created_at: '2026-10-18',
  },
  {
    id: 'pr-003',
    pr_number: 'PR-2026-0043',
    project_code: 'PRJ-2026-001',
    project_name: 'Oral Solid Dosage Line Expansion',
    department: 'Quality Assurance & Control',
    title: 'Sterile PVDF Syringe Membrane Filtration Consumables',
    item_count: 4,
    total_amount: 340000,
    status: 'approved',
    requested_by: 'Rahul Verma (EMP003)',
    required_by_date: '2026-11-18',
    created_at: '2026-10-22',
  },
  {
    id: 'pr-004',
    pr_number: 'PR-2026-0044',
    project_code: 'PRJ-2026-003',
    project_name: 'Continuous Direct Compression Pilot',
    department: 'Formulations & Synthesis',
    title: 'High-Purity Metformin Synthesis Reagents & Quality Solvents',
    item_count: 5,
    total_amount: 1280000,
    status: 'submitted',
    requested_by: 'Priya Sharma (EMP002)',
    required_by_date: '2026-12-15',
    created_at: '2026-11-01',
  },
];

const INITIAL_POS: PurchaseOrderItem[] = [
  {
    id: 'po-001',
    po_number: 'PO-2026-0011',
    sap_po_number: '4500128901',
    linked_pr_number: 'PR-2026-0041',
    supplier_code: 'SUP-001',
    supplier_name: 'Bharat Pharma Chem Ltd',
    project_code: 'PRJ-2026-001',
    subtotal_amount: 900000,
    gst_amount: 162000,
    total_amount: 1062000,
    status: 'fully_delivered',
    delivery_terms: 'CIF Hyderabad Plant',
    payment_terms: 'Net 30 Days after GRN',
    expected_delivery_date: '2026-10-25',
    tracking_id: 'del-001',
    created_at: '2026-10-16',
  },
  {
    id: 'po-002',
    po_number: 'PO-2026-0012',
    sap_po_number: '4500128902',
    linked_pr_number: 'PR-2026-0042',
    supplier_code: 'SUP-002',
    supplier_name: 'Borosil Packaging Solutions',
    project_code: 'PRJ-2026-002',
    subtotal_amount: 650000,
    gst_amount: 117000,
    total_amount: 767000,
    status: 'partially_delivered',
    delivery_terms: 'Ex-Works Mumbai',
    payment_terms: 'Immediate Against Inspection',
    expected_delivery_date: '2026-11-15',
    tracking_id: 'del-002',
    created_at: '2026-10-20',
  },
  {
    id: 'po-003',
    po_number: 'PO-2026-0013',
    sap_po_number: '4500128903',
    linked_pr_number: 'PR-2026-0041',
    supplier_code: 'SUP-003',
    supplier_name: 'ZenBio Excipients Pvt Ltd',
    project_code: 'PRJ-2026-001',
    subtotal_amount: 750000,
    gst_amount: 135000,
    total_amount: 885000,
    status: 'confirmed',
    delivery_terms: 'FOB Chennai Port',
    payment_terms: 'Net 45 Days',
    expected_delivery_date: '2026-11-28',
    tracking_id: 'del-003',
    created_at: '2026-10-25',
  },
  {
    id: 'po-004',
    po_number: 'PO-2026-0014',
    sap_po_number: '4500128904',
    linked_pr_number: 'PR-2026-0043',
    supplier_code: 'SUP-004',
    supplier_name: 'SciLab Reagents & Consumables Corp',
    project_code: 'PRJ-2026-001',
    subtotal_amount: 340000,
    gst_amount: 61200,
    total_amount: 401200,
    status: 'issued',
    delivery_terms: 'DDP Bengaluru Lab',
    payment_terms: 'Advance 50%, Balance upon delivery',
    expected_delivery_date: '2026-11-10',
    tracking_id: 'del-004',
    created_at: '2026-11-02',
  },
];

export function ProcurementPage() {
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const canManage = permissions.includes('procurement.view');

  const [activeTab, setActiveTab] = useState<'pos' | 'prs'>('pos');
  const [prs, setPrs] = useState<PurchaseRequisitionItem[]>(INITIAL_PRS);
  const [pos, setPos] = useState<PurchaseOrderItem[]>(INITIAL_POS);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modal State for New PR
  const [isNewPrModalOpen, setIsNewPrModalOpen] = useState(false);
  const [prForm, setPrForm] = useState({
    title: '',
    project_code: 'PRJ-2026-001',
    department: 'Supply Chain Management',
    total_amount: 500000,
    required_by_date: '2026-12-01',
  });

  const filteredPrs = useMemo(() => {
    return prs.filter((p) => {
      const matchesSearch =
        p.pr_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.project_code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = selectedStatus === 'ALL' || p.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [prs, searchQuery, selectedStatus]);

  const filteredPos = useMemo(() => {
    return pos.filter((o) => {
      const matchesSearch =
        o.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.sap_po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.supplier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.supplier_code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = selectedStatus === 'ALL' || o.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [pos, searchQuery, selectedStatus]);

  const stats = useMemo(() => {
    const totalPrCount = prs.length;
    const totalPoCount = pos.length;
    const totalCommittedValue = pos.reduce((acc, curr) => acc + curr.total_amount, 0);
    const activeDeliveriesCount = pos.filter(
      (p) => p.status === 'confirmed' || p.status === 'partially_delivered'
    ).length;
    const deliveredCount = pos.filter((p) => p.status === 'fully_delivered').length;

    return { totalPrCount, totalPoCount, totalCommittedValue, activeDeliveriesCount, deliveredCount };
  }, [prs, pos]);

  const handleCreatePr = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prForm.title) return;

    const newPr: PurchaseRequisitionItem = {
      id: `pr-${Date.now()}`,
      pr_number: `PR-2026-${String(prs.length + 42).padStart(4, '0')}`,
      project_code: prForm.project_code,
      project_name: 'Active Pharmaceutical Project',
      department: prForm.department,
      title: prForm.title.trim(),
      item_count: 2,
      total_amount: Number(prForm.total_amount) || 0,
      status: 'submitted',
      requested_by: 'Dev System Administrator (AXX09)',
      required_by_date: prForm.required_by_date,
      created_at: new Date().toISOString().slice(0, 10),
    };

    setPrs([newPr, ...prs]);
    setIsNewPrModalOpen(false);
    setPrForm({
      title: '',
      project_code: 'PRJ-2026-001',
      department: 'Supply Chain Management',
      total_amount: 500000,
      required_by_date: '2026-12-01',
    });
  };

  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (activeTab === 'pos') {
      headers = ['PO Number', 'SAP PO Reference', 'Linked PR', 'Supplier Code', 'Supplier Name', 'Project', 'Taxable Amount (INR)', 'GST 18% (INR)', 'Total Amount (INR)', 'Delivery Terms', 'Status', 'ETA'];
      rows = filteredPos.map((o) => [
        o.po_number,
        o.sap_po_number,
        o.linked_pr_number,
        o.supplier_code,
        o.supplier_name,
        o.project_code,
        o.subtotal_amount,
        o.gst_amount,
        o.total_amount,
        o.delivery_terms,
        o.status,
        o.expected_delivery_date,
      ]);
    } else {
      headers = ['PR Number', 'Project Code', 'Department', 'Requisition Title', 'Items', 'Total Est Cost (INR)', 'Status', 'Requested By', 'Required Date'];
      rows = filteredPrs.map((p) => [
        p.pr_number,
        p.project_code,
        p.department,
        p.title,
        p.item_count,
        p.total_amount,
        p.status,
        p.requested_by,
        p.required_by_date,
      ]);
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `SCM_Flow_${activeTab === 'pos' ? 'Purchase_Orders' : 'Purchase_Requisitions'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPoStatusBadge = (status: string) => {
    switch (status) {
      case 'fully_delivered':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Fully Delivered</Badge>;
      case 'partially_delivered':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-300">Partially Delivered</Badge>;
      case 'confirmed':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Supplier Confirmed</Badge>;
      case 'issued':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-300">Issued to Vendor</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPrStatusBadge = (status: string) => {
    switch (status) {
      case 'fully_ordered':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">PO Created</Badge>;
      case 'partially_ordered':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-300">Partially Ordered</Badge>;
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Approved by HOD</Badge>;
      case 'submitted':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-300">Under Review</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-forest/10 text-forest">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-forest">
                Procurement Execution (PR & PO Management)
              </h1>
              <p className="text-xs text-ink-secondary">
                Material Purchase Requisitions (PR), multi-split quantity allocation, vendor Purchase Orders (PO) with GST and SAP references.
              </p>
            </div>
          </div>
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
          {canManage && (
            <Button
              size="sm"
              onClick={() => setIsNewPrModalOpen(true)}
              className="bg-forest hover:bg-forest-deep text-white text-xs"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create Requisition (PR)
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-divider shadow-warm-xs bg-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-ink-muted">Purchase Orders</span>
              <FileCheck2 className="h-4 w-4 text-forest" />
            </div>
            <div className="text-xl font-bold text-forest mt-1">{stats.totalPoCount}</div>
            <span className="text-[10px] text-ink-muted">Active PO documents</span>
          </CardContent>
        </Card>

        <Card className="border-divider shadow-warm-xs bg-forest text-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-sage-light">Committed PO Value</span>
              <Receipt className="h-4 w-4 text-sage" />
            </div>
            <div className="text-lg font-bold mt-1 truncate">{formatINR(stats.totalCommittedValue)}</div>
            <span className="text-[10px] text-sage-light">Includes 18% GST</span>
          </CardContent>
        </Card>

        <Card className="border-divider shadow-warm-xs bg-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-blue-700">In Active Delivery</span>
              <Truck className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-xl font-bold text-blue-900 mt-1">{stats.activeDeliveriesCount}</div>
            <span className="text-[10px] text-ink-muted">Tracked in Phase 7</span>
          </CardContent>
        </Card>

        <Card className="border-divider shadow-warm-xs bg-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-emerald-700">Fulfilled POs</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-emerald-900 mt-1">{stats.deliveredCount}</div>
            <span className="text-[10px] text-ink-muted">Delivered to site</span>
          </CardContent>
        </Card>

        <Card className="border-divider shadow-warm-xs bg-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-purple-700">Open Requisitions</span>
              <Clock className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-xl font-bold text-purple-900 mt-1">{stats.totalPrCount}</div>
            <span className="text-[10px] text-ink-muted">PR drafting & approvals</span>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-divider pb-3">
        <div className="flex items-center rounded-lg bg-ivory p-1 border border-divider">
          <button
            type="button"
            onClick={() => { setActiveTab('pos'); setSelectedStatus('ALL'); }}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'pos'
                ? 'bg-ivory-surface text-forest shadow-warm-sm border border-divider/60'
                : 'text-ink-secondary hover:text-forest'
            }`}
          >
            Purchase Orders (PO) ({pos.length})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('prs'); setSelectedStatus('ALL'); }}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'prs'
                ? 'bg-ivory-surface text-forest shadow-warm-sm border border-divider/60'
                : 'text-ink-secondary hover:text-forest'
            }`}
          >
            Material Requisitions (PR) ({prs.length})
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-muted" />
            <Input
              type="text"
              placeholder={activeTab === 'pos' ? 'Search PO #, SAP, Supplier...' : 'Search PR #, Title, Project...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-md border border-divider bg-white px-2.5 py-1 text-xs text-ink-primary shadow-sm focus:border-forest focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            {activeTab === 'pos' ? (
              <>
                <option value="issued">Issued</option>
                <option value="confirmed">Confirmed</option>
                <option value="partially_delivered">Partially Delivered</option>
                <option value="fully_delivered">Fully Delivered</option>
              </>
            ) : (
              <>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="partially_ordered">Partially Ordered</option>
                <option value="fully_ordered">Fully Ordered</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* TAB 1: PURCHASE ORDERS */}
      {activeTab === 'pos' && (
        <Card className="border-divider shadow-warm-sm">
          <CardHeader className="pb-2 border-b border-divider/60 bg-ivory/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-forest">
                  Purchase Order Register & SAP Synchronization
                </CardTitle>
                <CardDescription className="text-xs text-ink-secondary">
                  Commercial orders dispatched to vendors with GST compliance and Phase 7 tracking linkages.
                </CardDescription>
              </div>
              <span className="text-xs text-ink-muted font-mono">
                Showing {filteredPos.length} of {pos.length} orders
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-ivory/50">
                  <TableHead className="font-semibold text-xs text-forest">PO & SAP PO #</TableHead>
                  <TableHead className="font-semibold text-xs text-forest">Supplier Details</TableHead>
                  <TableHead className="font-semibold text-xs text-forest">Linked PR & Project</TableHead>
                  <TableHead className="font-semibold text-xs text-forest text-right">Taxable (Excl GST)</TableHead>
                  <TableHead className="font-semibold text-xs text-forest text-right">GST (18%)</TableHead>
                  <TableHead className="font-semibold text-xs text-forest text-right">Total Order Value</TableHead>
                  <TableHead className="font-semibold text-xs text-forest text-center">Status</TableHead>
                  <TableHead className="font-semibold text-xs text-forest text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPos.map((o) => (
                  <TableRow key={o.id} className="hover:bg-ivory/30">
                    <TableCell>
                      <div className="font-mono font-bold text-xs text-forest">{o.po_number}</div>
                      <div className="text-[11px] font-mono text-sage-dark flex items-center space-x-1 mt-0.5">
                        <span className="bg-sage/20 px-1 rounded">SAP: {o.sap_po_number}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-xs text-ink-primary">{o.supplier_name}</div>
                      <div className="text-[10px] font-mono text-ink-muted">{o.supplier_code} • {o.delivery_terms}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs text-forest">{o.linked_pr_number}</div>
                      <div className="text-[10px] text-ink-muted">{o.project_code}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-ink-secondary">
                      {formatINR(o.subtotal_amount)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-ink-secondary">
                      {formatINR(o.gst_amount)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-forest">
                      {formatINR(o.total_amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getPoStatusBadge(o.status)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate('/app/deliveries')}
                        className="text-[11px] h-7 border-forest/30 text-forest hover:bg-forest/5"
                      >
                        <Truck className="h-3 w-3 mr-1" />
                        Track Delivery
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredPos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-ink-muted text-xs">
                      No purchase orders matching your search criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: PURCHASE REQUISITIONS */}
      {activeTab === 'prs' && (
        <Card className="border-divider shadow-warm-sm">
          <CardHeader className="pb-2 border-b border-divider/60 bg-ivory/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-forest">
                  Material Purchase Requisitions (PR)
                </CardTitle>
                <CardDescription className="text-xs text-ink-secondary">
                  Internal material requests drafted from Project BOMs pending HOD and SCM sign-offs.
                </CardDescription>
              </div>
              <span className="text-xs text-ink-muted font-mono">
                Showing {filteredPrs.length} of {prs.length} requisitions
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-ivory/50">
                  <TableHead className="font-semibold text-xs text-forest">PR Number & Date</TableHead>
                  <TableHead className="font-semibold text-xs text-forest">Requisition Title</TableHead>
                  <TableHead className="font-semibold text-xs text-forest">Department & Requestor</TableHead>
                  <TableHead className="font-semibold text-xs text-forest">Project Code</TableHead>
                  <TableHead className="font-semibold text-xs text-forest text-right">Items</TableHead>
                  <TableHead className="font-semibold text-xs text-forest text-right">Estimated Cost</TableHead>
                  <TableHead className="font-semibold text-xs text-forest text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPrs.map((p) => (
                  <TableRow key={p.id} className="hover:bg-ivory/30">
                    <TableCell>
                      <div className="font-mono font-bold text-xs text-forest">{p.pr_number}</div>
                      <div className="text-[10px] text-ink-muted">{p.created_at}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-xs text-ink-primary">{p.title}</div>
                      <div className="text-[10px] text-ink-muted flex items-center space-x-1 mt-0.5">
                        <Clock className="h-3 w-3 text-sage" />
                        <span>Needed by: {p.required_by_date}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-ink-primary">{p.department}</div>
                      <div className="text-[10px] text-ink-muted">{p.requested_by}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-forest">
                      {p.project_code}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-ink-secondary">
                      {p.item_count} items
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-forest">
                      {formatINR(p.total_amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getPrStatusBadge(p.status)}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredPrs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-ink-muted text-xs">
                      No material requisitions matching your search criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* MODAL: CREATE NEW PURCHASE REQUISITION */}
      <Dialog open={isNewPrModalOpen} onOpenChange={setIsNewPrModalOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-forest flex items-center space-x-2">
              <Plus className="h-5 w-5 text-sage-dark" />
              <span>Draft Purchase Requisition (PR)</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-ink-secondary">
              Create an official material purchase requisition mapped to an active project Bill of Materials.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreatePr} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium text-ink-secondary block mb-1">
                Requisition Title / Purpose <span className="text-rose-500">*</span>
              </label>
              <Input
                required
                placeholder="e.g. Amber Vials Batch Procurement Q4"
                value={prForm.title}
                onChange={(e) => setPrForm({ ...prForm, title: e.target.value })}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink-secondary block mb-1">
                  Project Code <span className="text-rose-500">*</span>
                </label>
                <select
                  value={prForm.project_code}
                  onChange={(e) => setPrForm({ ...prForm, project_code: e.target.value })}
                  className="w-full rounded-md border border-divider bg-white px-3 py-2 text-xs text-ink-primary shadow-sm focus:border-forest focus:outline-none"
                >
                  <option value="PRJ-2026-001">PRJ-2026-001 (OSD Line)</option>
                  <option value="PRJ-2026-002">PRJ-2026-002 (Injectables)</option>
                  <option value="PRJ-2026-003">PRJ-2026-003 (Direct Compression)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-ink-secondary block mb-1">
                  Department
                </label>
                <select
                  value={prForm.department}
                  onChange={(e) => setPrForm({ ...prForm, department: e.target.value })}
                  className="w-full rounded-md border border-divider bg-white px-3 py-2 text-xs text-ink-primary shadow-sm focus:border-forest focus:outline-none"
                >
                  <option value="Supply Chain Management">Supply Chain Management</option>
                  <option value="Formulations & Synthesis">Formulations & Synthesis</option>
                  <option value="Quality Assurance & Control">Quality Assurance & Control</option>
                  <option value="Logistics & Warehousing">Logistics & Warehousing</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink-secondary block mb-1">
                  Estimated Budget (INR) <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="number"
                  min="1000"
                  value={prForm.total_amount}
                  onChange={(e) => setPrForm({ ...prForm, total_amount: Number(e.target.value) })}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink-secondary block mb-1">
                  Needed By Date <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="date"
                  required
                  value={prForm.required_by_date}
                  onChange={(e) => setPrForm({ ...prForm, required_by_date: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsNewPrModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-forest hover:bg-forest-deep text-white text-xs"
              >
                Submit Requisition
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

