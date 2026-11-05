import React, { useState, useMemo } from 'react';
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
  FileSpreadsheet,
  Search,
  Filter,
  Plus,
  Download,
  Layers,
  FlaskConical,
  Package,
  Boxes,
  CheckCircle2,
  Clock,
  Check,
} from 'lucide-react';
import { formatINR } from '@/lib/formatters';

export interface MaterialMasterItem {
  id: string;
  material_code: string;
  material_name: string;
  category: 'API' | 'EXE' | 'PM' | 'Consumables';
  cas_number?: string | null;
  uom: string;
  hsn_code: string;
  standard_pack_size: string;
  storage_condition: string;
  is_active: boolean;
  lead_time_days: number;
}

export interface ProjectBomItem {
  id: string;
  project_code: string;
  project_name: string;
  milestone_title: string;
  material_code: string;
  material_name: string;
  category: 'API' | 'EXE' | 'PM' | 'Consumables';
  required_quantity: number;
  uom: string;
  needed_by_date: string;
  estimated_unit_price: number;
  total_estimated_cost: number;
  status: 'unassigned' | 'partially_requisitioned' | 'fully_requisitioned' | 'ordered' | 'delivered';
}

const INITIAL_MATERIALS: MaterialMasterItem[] = [
  {
    id: 'mat-001',
    material_code: 'API-PARA-001',
    material_name: 'Paracetamol IP/BP (Micronized Grade)',
    category: 'API',
    cas_number: '103-90-2',
    uom: 'KG',
    hsn_code: '29242990',
    standard_pack_size: '25 KG HDPE Drum',
    storage_condition: 'Below 25°C, Dry Area',
    is_active: true,
    lead_time_days: 14,
  },
  {
    id: 'mat-002',
    material_code: 'API-METF-500',
    material_name: 'Metformin Hydrochloride BP/USP',
    category: 'API',
    cas_number: '1115-70-4',
    uom: 'KG',
    hsn_code: '29252990',
    standard_pack_size: '50 KG Fiber Drum',
    storage_condition: 'Controlled Room Temperature',
    is_active: true,
    lead_time_days: 21,
  },
  {
    id: 'mat-003',
    material_code: 'EXE-MCC-102',
    material_name: 'Microcrystalline Cellulose PH-102 NF/EP',
    category: 'EXE',
    cas_number: '9004-34-6',
    uom: 'KG',
    hsn_code: '39129090',
    standard_pack_size: '20 KG Multi-wall Bag',
    storage_condition: 'Ambient (15-30°C)',
    is_active: true,
    lead_time_days: 7,
  },
  {
    id: 'mat-004',
    material_code: 'EXE-STEA-005',
    material_name: 'Magnesium Stearate Pharma Grade Vegetable Origin',
    category: 'EXE',
    cas_number: '557-04-0',
    uom: 'KG',
    hsn_code: '29157090',
    standard_pack_size: '25 KG Kraft Paper Bag',
    storage_condition: 'Cool & Ventilated',
    is_active: true,
    lead_time_days: 10,
  },
  {
    id: 'mat-005',
    material_code: 'PM-VIAL-010',
    material_name: 'Amber Glass Injection Vials 10ml (Type I Borosilicate)',
    category: 'PM',
    cas_number: null,
    uom: 'PCS',
    hsn_code: '70109000',
    standard_pack_size: '1000 PCS Box',
    storage_condition: 'Dust-free clean warehouse',
    is_active: true,
    lead_time_days: 30,
  },
  {
    id: 'mat-006',
    material_code: 'PM-BLIS-PVC',
    material_name: 'Alu-PVC Pharmaceutical Blister Foil 250 Micron',
    category: 'PM',
    cas_number: null,
    uom: 'ROLL',
    hsn_code: '76071999',
    standard_pack_size: '500 M Roll',
    storage_condition: 'Dry, Air-conditioned',
    is_active: true,
    lead_time_days: 15,
  },
  {
    id: 'mat-007',
    material_code: 'CON-FILT-022',
    material_name: 'Sterile PVDF Syringe Membrane Filters 0.22 um',
    category: 'Consumables',
    cas_number: null,
    uom: 'PCS',
    hsn_code: '84212900',
    standard_pack_size: '100 PCS Pack',
    storage_condition: 'Ambient',
    is_active: true,
    lead_time_days: 5,
  },
  {
    id: 'mat-008',
    material_code: 'CON-HPLC-COL',
    material_name: 'C18 Reverse Phase HPLC Analytical Column 250 x 4.6mm',
    category: 'Consumables',
    cas_number: null,
    uom: 'PCS',
    hsn_code: '90279090',
    standard_pack_size: 'Single Unit Case',
    storage_condition: 'Room Temp with end plugs',
    is_active: true,
    lead_time_days: 12,
  },
];

const INITIAL_PROJECT_BOMS: ProjectBomItem[] = [
  {
    id: 'bom-001',
    project_code: 'PRJ-2026-001',
    project_name: 'Oral Solid Dosage Line Expansion',
    milestone_title: 'API Pre-formulation Pilot Batch',
    material_code: 'API-PARA-001',
    material_name: 'Paracetamol IP/BP (Micronized Grade)',
    category: 'API',
    required_quantity: 1200,
    uom: 'KG',
    needed_by_date: '2026-11-20',
    estimated_unit_price: 450,
    total_estimated_cost: 540000,
    status: 'fully_requisitioned',
  },
  {
    id: 'bom-002',
    project_code: 'PRJ-2026-001',
    project_name: 'Oral Solid Dosage Line Expansion',
    milestone_title: 'Excipient Binder Formulation Trial',
    material_code: 'EXE-MCC-102',
    material_name: 'Microcrystalline Cellulose PH-102 NF/EP',
    category: 'EXE',
    required_quantity: 500,
    uom: 'KG',
    needed_by_date: '2026-11-25',
    estimated_unit_price: 320,
    total_estimated_cost: 160000,
    status: 'ordered',
  },
  {
    id: 'bom-003',
    project_code: 'PRJ-2026-002',
    project_name: 'Injectable Formulation Commercialization',
    milestone_title: 'Primary Packaging Sterility Validation',
    material_code: 'PM-VIAL-010',
    material_name: 'Amber Glass Injection Vials 10ml (Type I Borosilicate)',
    category: 'PM',
    required_quantity: 50000,
    uom: 'PCS',
    needed_by_date: '2026-12-05',
    estimated_unit_price: 13,
    total_estimated_cost: 650000,
    status: 'partially_requisitioned',
  },
  {
    id: 'bom-004',
    project_code: 'PRJ-2026-001',
    project_name: 'Oral Solid Dosage Line Expansion',
    milestone_title: 'In-process Quality Assay Verification',
    material_code: 'CON-FILT-022',
    material_name: 'Sterile PVDF Syringe Membrane Filters 0.22 um',
    category: 'Consumables',
    required_quantity: 500,
    uom: 'PCS',
    needed_by_date: '2026-11-18',
    estimated_unit_price: 180,
    total_estimated_cost: 90000,
    status: 'delivered',
  },
  {
    id: 'bom-005',
    project_code: 'PRJ-2026-003',
    project_name: 'Continuous Direct Compression Pilot',
    milestone_title: 'Raw Material Dispensing Trial',
    material_code: 'API-METF-500',
    material_name: 'Metformin Hydrochloride BP/USP',
    category: 'API',
    required_quantity: 800,
    uom: 'KG',
    needed_by_date: '2026-12-15',
    estimated_unit_price: 520,
    total_estimated_cost: 416000,
    status: 'unassigned',
  },
];

export function MaterialsPage() {
  const { permissions } = useAuth();
  const canManage = permissions.includes('materials.view');

  const [activeTab, setActiveTab] = useState<'catalog' | 'bom'>('catalog');
  const [materials, setMaterials] = useState<MaterialMasterItem[]>(INITIAL_MATERIALS);
  const [boms] = useState<ProjectBomItem[]>(INITIAL_PROJECT_BOMS);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modal State for New Material
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    material_code: '',
    material_name: '',
    category: 'API' as 'API' | 'EXE' | 'PM' | 'Consumables',
    cas_number: '',
    uom: 'KG',
    hsn_code: '',
    standard_pack_size: '',
    storage_condition: '',
    lead_time_days: 14,
  });

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchesSearch =
        m.material_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.material_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.cas_number && m.cas_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        m.hsn_code.includes(searchQuery);

      const matchesCategory = selectedCategory === 'ALL' || m.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [materials, searchQuery, selectedCategory]);

  const filteredBoms = useMemo(() => {
    return boms.filter((b) => {
      const matchesSearch =
        b.project_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.material_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.material_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'ALL' || b.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [boms, searchQuery, selectedCategory]);

  const stats = useMemo(() => {
    const totalMaterials = materials.length;
    const apiCount = materials.filter((m) => m.category === 'API').length;
    const exeCount = materials.filter((m) => m.category === 'EXE').length;
    const pmCount = materials.filter((m) => m.category === 'PM').length;
    const consumablesCount = materials.filter((m) => m.category === 'Consumables').length;
    const totalBomValue = boms.reduce((acc, curr) => acc + curr.total_estimated_cost, 0);

    return { totalMaterials, apiCount, exeCount, pmCount, consumablesCount, totalBomValue };
  }, [materials, boms]);

  const handleCreateMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.material_code || !formData.material_name) return;

    const newItem: MaterialMasterItem = {
      id: `mat-${Date.now()}`,
      material_code: formData.material_code.trim().toUpperCase(),
      material_name: formData.material_name.trim(),
      category: formData.category,
      cas_number: formData.cas_number.trim() || null,
      uom: formData.uom,
      hsn_code: formData.hsn_code.trim() || '29000000',
      standard_pack_size: formData.standard_pack_size.trim() || 'Standard Pack',
      storage_condition: formData.storage_condition.trim() || 'Room Temperature',
      is_active: true,
      lead_time_days: Number(formData.lead_time_days) || 14,
    };

    setMaterials([newItem, ...materials]);
    setIsAddModalOpen(false);
    setFormData({
      material_code: '',
      material_name: '',
      category: 'API',
      cas_number: '',
      uom: 'KG',
      hsn_code: '',
      standard_pack_size: '',
      storage_condition: '',
      lead_time_days: 14,
    });
  };

  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    if (activeTab === 'catalog') {
      headers = ['Material Code', 'Material Name', 'Category', 'CAS Number', 'UOM', 'HSN Code', 'Pack Size', 'Lead Time (Days)', 'Status'];
      rows = filteredMaterials.map((m) => [
        m.material_code,
        m.material_name,
        m.category,
        m.cas_number || 'N/A',
        m.uom,
        m.hsn_code,
        m.standard_pack_size,
        m.lead_time_days,
        m.is_active ? 'Active' : 'Inactive',
      ]);
    } else {
      headers = ['Project Code', 'Milestone', 'Material Code', 'Material Name', 'Category', 'Required Qty', 'UOM', 'Needed Date', 'Est Unit Price (INR)', 'Total Est Cost (INR)', 'Status'];
      rows = filteredBoms.map((b) => [
        b.project_code,
        b.milestone_title,
        b.material_code,
        b.material_name,
        b.category,
        b.required_quantity,
        b.uom,
        b.needed_by_date,
        b.estimated_unit_price,
        b.total_estimated_cost,
        b.status,
      ]);
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `SCM_Flow_${activeTab === 'catalog' ? 'Material_Master' : 'Project_BOM'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'API':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'EXE':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PM':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Consumables':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Delivered</Badge>;
      case 'ordered':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">PO Ordered</Badge>;
      case 'fully_requisitioned':
        return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300">PR Approved</Badge>;
      case 'partially_requisitioned':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-300">Partial PR</Badge>;
      default:
        return <Badge variant="outline" className="text-gray-600">Unassigned</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-forest/10 text-forest">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-forest">
                Materials Master & Project Requirements (BOM)
              </h1>
              <p className="text-xs text-ink-secondary">
                Comprehensive pharmaceutical material classification, CAS/HSN master catalog, and Bill of Materials planning.
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
              onClick={() => setIsAddModalOpen(true)}
              className="bg-forest hover:bg-forest-deep text-white text-xs"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Register Material
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="border-divider shadow-warm-xs bg-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-ink-muted">Master Materials</span>
              <Boxes className="h-4 w-4 text-forest" />
            </div>
            <div className="text-xl font-bold text-forest mt-1">{stats.totalMaterials}</div>
            <span className="text-[10px] text-ink-muted">Catalog items</span>
          </CardContent>
        </Card>

        <Card className="border-divider shadow-warm-xs bg-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-purple-700">API Actives</span>
              <FlaskConical className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-xl font-bold text-purple-900 mt-1">{stats.apiCount}</div>
            <span className="text-[10px] text-ink-muted">Pharmaceutical</span>
          </CardContent>
        </Card>

        <Card className="border-divider shadow-warm-xs bg-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-blue-700">Excipients</span>
              <Layers className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-xl font-bold text-blue-900 mt-1">{stats.exeCount}</div>
            <span className="text-[10px] text-ink-muted">Binders & Disintegrants</span>
          </CardContent>
        </Card>

        <Card className="border-divider shadow-warm-xs bg-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-amber-700">Packaging (PM)</span>
              <Package className="h-4 w-4 text-amber-600" />
            </div>
            <div className="text-xl font-bold text-amber-900 mt-1">{stats.pmCount}</div>
            <span className="text-[10px] text-ink-muted">Vials, Blisters, Cartons</span>
          </CardContent>
        </Card>

        <Card className="border-divider shadow-warm-xs bg-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-teal-700">Consumables</span>
              <CheckCircle2 className="h-4 w-4 text-teal-600" />
            </div>
            <div className="text-xl font-bold text-teal-900 mt-1">{stats.consumablesCount}</div>
            <span className="text-[10px] text-ink-muted">Lab Reagents & Filters</span>
          </CardContent>
        </Card>

        <Card className="border-divider shadow-warm-xs bg-forest text-white">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-sage-light">Total BOM Value</span>
              <span className="text-[10px] font-mono bg-forest-light px-1.5 py-0.5 rounded text-white">BOM</span>
            </div>
            <div className="text-lg font-bold mt-1 truncate">{formatINR(stats.totalBomValue)}</div>
            <span className="text-[10px] text-sage-light">Active Project Demands</span>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-divider pb-3">
        <div className="flex items-center rounded-lg bg-ivory p-1 border border-divider">
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'catalog'
                ? 'bg-ivory-surface text-forest shadow-warm-sm border border-divider/60'
                : 'text-ink-secondary hover:text-forest'
            }`}
          >
            Material Master Catalog ({materials.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('bom')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'bom'
                ? 'bg-ivory-surface text-forest shadow-warm-sm border border-divider/60'
                : 'text-ink-secondary hover:text-forest'
            }`}
          >
            Project BOM Requirements ({boms.length})
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center space-x-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-muted" />
            <Input
              type="text"
              placeholder="Search code, name, CAS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-md border border-divider bg-white px-2.5 py-1 text-xs text-ink-primary shadow-sm focus:border-forest focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="API">API — Actives</option>
            <option value="EXE">EXE — Excipients</option>
            <option value="PM">PM — Packaging</option>
            <option value="Consumables">Consumables & Lab</option>
          </select>
        </div>
      </div>

      {/* TAB 1: MATERIAL MASTER CATALOG */}
      {activeTab === 'catalog' && (
        <Card className="border-divider shadow-warm-sm">
          <CardHeader className="pb-2 border-b border-divider/60 bg-ivory/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-forest">
                  Approved Material Master Catalog
                </CardTitle>
                <CardDescription className="text-xs text-ink-secondary">
                  Canonical master items with chemical registry numbers (CAS), Indian HSN codes, and storage controls.
                </CardDescription>
              </div>
              <span className="text-xs text-ink-muted font-mono">
                Showing {filteredMaterials.length} of {materials.length} records
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-ivory/50">
                  <TableHead className="font-semibold text-xs text-forest">Code & Category</TableHead>
                  <TableHead className="font-semibold text-xs text-forest">Material Name</TableHead>
                  <TableHead className="font-semibold text-xs text-forest">CAS Number</TableHead>
                  <TableHead className="font-semibold text-xs text-forest">HSN / GST Code</TableHead>
                  <TableHead className="font-semibold text-xs text-forest">UOM</TableHead>
                  <TableHead className="font-semibold text-xs text-forest">Packaging & Storage</TableHead>
                  <TableHead className="font-semibold text-xs text-forest text-right">Lead Time</TableHead>
                  <TableHead className="font-semibold text-xs text-forest text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaterials.map((m) => (
                  <TableRow key={m.id} className="hover:bg-ivory/30">
                    <TableCell>
                      <div className="font-mono font-semibold text-xs text-forest">{m.material_code}</div>
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium border mt-0.5 ${getCategoryBadgeClass(m.category)}`}>
                        {m.category}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-xs text-ink-primary">{m.material_name}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-ink-secondary">
                      {m.cas_number || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-ink-secondary">
                      {m.hsn_code}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-forest">
                      {m.uom}
                    </TableCell>
                    <TableCell className="text-xs text-ink-secondary">
                      <div>{m.standard_pack_size}</div>
                      <div className="text-[10px] text-ink-muted">{m.storage_condition}</div>
                    </TableCell>
                    <TableCell className="text-right text-xs font-mono text-ink-secondary">
                      {m.lead_time_days} days
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800">
                        <Check className="h-3 w-3 mr-0.5" />
                        Active
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredMaterials.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-ink-muted text-xs">
                      No materials matching your search criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: PROJECT BOM REQUIREMENTS */}
      {activeTab === 'bom' && (
        <Card className="border-divider shadow-warm-sm">
          <CardHeader className="pb-2 border-b border-divider/60 bg-ivory/30">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-forest">
                  Project Material Requirements (Bill of Materials)
                </CardTitle>
                <CardDescription className="text-xs text-ink-secondary">
                  Milestone-level material demand schedules with procurement allocation status.
                </CardDescription>
              </div>
              <span className="text-xs text-ink-muted font-mono">
                Showing {filteredBoms.length} requirements
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-ivory/50">
                  <TableHead className="font-semibold text-xs text-forest">Project & Milestone</TableHead>
                  <TableHead className="font-semibold text-xs text-forest">Material & Category</TableHead>
                  <TableHead className="font-semibold text-xs text-forest text-right">Required Qty</TableHead>
                  <TableHead className="font-semibold text-xs text-forest">Needed By</TableHead>
                  <TableHead className="font-semibold text-xs text-forest text-right">Est. Unit Price</TableHead>
                  <TableHead className="font-semibold text-xs text-forest text-right">Total Est. Cost</TableHead>
                  <TableHead className="font-semibold text-xs text-forest text-center">Procurement Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBoms.map((b) => (
                  <TableRow key={b.id} className="hover:bg-ivory/30">
                    <TableCell>
                      <div className="font-mono font-semibold text-xs text-forest">{b.project_code}</div>
                      <div className="text-xs text-ink-primary font-medium">{b.project_name}</div>
                      <div className="text-[10px] text-ink-muted mt-0.5">Milestone: {b.milestone_title}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs font-semibold text-forest">{b.material_code}</div>
                      <div className="text-xs text-ink-primary">{b.material_name}</div>
                      <span className={`inline-block text-[10px] px-1.5 py-0.2 rounded font-medium border mt-0.5 ${getCategoryBadgeClass(b.category)}`}>
                        {b.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-forest">
                      {b.required_quantity.toLocaleString()} {b.uom}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-ink-secondary">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3 text-sage" />
                        <span>{b.needed_by_date}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-ink-secondary">
                      {formatINR(b.estimated_unit_price)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-forest">
                      {formatINR(b.total_estimated_cost)}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(b.status)}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredBoms.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-ink-muted text-xs">
                      No project BOM requirements matching your search criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* MODAL: REGISTER NEW MATERIAL MASTER */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-forest flex items-center space-x-2">
              <Plus className="h-5 w-5 text-sage-dark" />
              <span>Register New Master Material</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-ink-secondary">
              Add a verified material specification to the enterprise catalog for Bill of Materials and Procurement linkage.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateMaterial} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink-secondary block mb-1">
                  Material Code <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g. API-AMOX-500"
                  value={formData.material_code}
                  onChange={(e) => setFormData({ ...formData, material_code: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink-secondary block mb-1">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  className="w-full rounded-md border border-divider bg-white px-3 py-2 text-xs text-ink-primary shadow-sm focus:border-forest focus:outline-none"
                >
                  <option value="API">API — Active Pharmaceutical</option>
                  <option value="EXE">EXE — Excipient</option>
                  <option value="PM">PM — Packaging Material</option>
                  <option value="Consumables">Consumables & Reagents</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink-secondary block mb-1">
                Material Description / Chemical Name <span className="text-rose-500">*</span>
              </label>
              <Input
                required
                placeholder="e.g. Amoxicillin Trihydrate Compacted IP"
                value={formData.material_name}
                onChange={(e) => setFormData({ ...formData, material_name: e.target.value })}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-ink-secondary block mb-1">
                  CAS Registry #
                </label>
                <Input
                  placeholder="e.g. 61336-70-7"
                  value={formData.cas_number}
                  onChange={(e) => setFormData({ ...formData, cas_number: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink-secondary block mb-1">
                  HSN / Tax Code
                </label>
                <Input
                  placeholder="e.g. 29411010"
                  value={formData.hsn_code}
                  onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink-secondary block mb-1">
                  Unit of Measure
                </label>
                <select
                  value={formData.uom}
                  onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                  className="w-full rounded-md border border-divider bg-white px-3 py-2 text-xs text-ink-primary shadow-sm focus:border-forest focus:outline-none"
                >
                  <option value="KG">KG — Kilograms</option>
                  <option value="G">G — Grams</option>
                  <option value="L">L — Liters</option>
                  <option value="MT">MT — Metric Tons</option>
                  <option value="PCS">PCS — Pieces</option>
                  <option value="ROLL">ROLL — Rolls</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-ink-secondary block mb-1">
                  Standard Pack Specification
                </label>
                <Input
                  placeholder="e.g. 25 KG Fiber Drum"
                  value={formData.standard_pack_size}
                  onChange={(e) => setFormData({ ...formData, standard_pack_size: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink-secondary block mb-1">
                  Lead Time (Days)
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formData.lead_time_days}
                  onChange={(e) => setFormData({ ...formData, lead_time_days: Number(e.target.value) })}
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-forest hover:bg-forest-deep text-white text-xs"
              >
                Save Material Master
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
