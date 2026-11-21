import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  fetchProjectById,
  fetchProjectMembers,
  fetchProjectMilestones,
  addProjectMember,
  removeProjectMember,
  changeProjectOwner,
  archiveProject,
  fetchEligibleEmployees,
  saveProjectAttachments,
} from '@/services/projectService';
import { ProjectAttachmentUploader } from '@/components/projects/ProjectAttachmentUploader';
import {
  AddProjectMaterialModal,
  BulkUploadProjectMaterialsModal,
} from '@/components/projects/ProjectMaterialsModals';
import {
  loadProjectMaterials,
  saveProjectMaterials,
  downloadProjectMaterialsExcelTemplate,
} from '@/lib/projectMaterialsExcel';
import { fetchAuditLogs } from '@/services/auditService';
import { calculateProjectDelay, calculateProjectProgress } from '@/lib/projectCalculations';
import { AuditLog, Employee, Milestone, Project, ProjectAttachment, ProjectMember } from '@/types/database.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  FolderKanban,
  ArrowLeft,
  Edit,
  Archive,
  Users,
  CheckCircle2,
  Clock,
  Building,
  User,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  FlaskConical,
  Package,
  Layers,
  ChevronDown,
  ChevronRight,
  Truck,
  ExternalLink,
  Search,
  Filter,
  Receipt,
  Wallet,
  TrendingUp,
  Boxes,
  Check,
  XCircle,
  Download,
  Upload,
} from 'lucide-react';
import { formatDateIST, formatINR } from '@/lib/formatters';

export interface ProjectMaterialItem {
  id: string;
  material_code: string;
  material_name: string;
  category: 'API' | 'PM' | 'EXE' | 'Consumables' | 'Other';
  milestone_title: string;
  required_quantity: number;
  delivered_quantity: number;
  uom: string;
  pr_number: string;
  pr_status: 'Approved' | 'Partially Ordered' | 'Submitted';
  sap_po_number: string;
  sap_po_line: string;
  supplier_name: string;
  supplier_code: string;
  original_committed_date: string;
  current_expected_date: string;
  delivery_status: 'DELIVERED' | 'ON_TRACK' | 'DELAYED' | 'PARTIALLY_DELIVERED';
  delay_days: number;
  estimated_cost_inr: number;
  cas_number?: string | null;
  hsn_code?: string;
  tracking_id?: string;
}

export interface MaterialCategorySummary {
  category: 'API' | 'PM' | 'EXE' | 'Consumables' | 'Other';
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeClass: string;
  materials: ProjectMaterialItem[];
  totalRequiredQty: number;
  totalDeliveredQty: number;
  uom: string;
  prCount: number;
  poCount: number;
  totalValueINR: number;
  onTrackCount: number;
  delayedCount: number;
  deliveredCount: number;
  nextEtaDays: number | null;
  overallHealth: 'On Track' | 'Delayed' | 'Delivered' | 'Attention Required';
}

function getDaysDeliverable(currentEta: string, status: string, originalDate: string) {
  if (status === 'DELIVERED') {
    return {
      text: 'Delivered',
      days: 0,
      badgeVariant: 'delivered' as const,
      explanation: 'Completed and cleared QC inspection.',
    };
  }

  const today = new Date('2026-11-05');
  const target = new Date(currentEta);
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (status === 'DELAYED' || diffDays < 0) {
    const overdueDays = Math.max(1, Math.abs(diffDays));
    return {
      text: `${overdueDays}d Overdue`,
      days: diffDays,
      badgeVariant: 'delayed' as const,
      explanation: `Exceeded original delivery commitment by ${overdueDays} days.`,
    };
  }

  if (diffDays === 0) {
    return {
      text: 'Due Today',
      days: 0,
      badgeVariant: 'due_today' as const,
      explanation: 'Scheduled for gate arrival today.',
    };
  }

  return {
    text: `In ${diffDays} days`,
    days: diffDays,
    badgeVariant: 'on_track' as const,
    explanation: `Estimated delivery on track within ${diffDays} days.`,
  };
}

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditLog[]>([]);
  const [eligibleEmployees, setEligibleEmployees] = useState<Employee[]>([]);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'materials' | 'milestones' | 'governance' | 'members' | 'activity'>('materials');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Category Table Expansion State (Set of expanded categories)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    API: true,
    PM: true,
    EXE: false,
    Consumables: false,
    Other: true,
  });

  // Filter state for materials within the category drilldown
  const [materialFilterStatus, setMaterialFilterStatus] = useState<'ALL' | 'ON_TRACK' | 'DELAYED' | 'DELIVERED'>('ALL');
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');

  // Add Product One-by-One & Excel Bulk Upload Modal State
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [materialToast, setMaterialToast] = useState<string | null>(null);

  // Modals for Owner and Member Management
  const [selectedNewOwner, setSelectedNewOwner] = useState('');
  const [selectedNewMember, setSelectedNewMember] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showChangeOwner, setShowChangeOwner] = useState(false);

  const canUpdate = hasPermission('projects.update');
  const canArchive = hasPermission('projects.archive');
  const canManageOwner = hasPermission('projects.manage_owner');
  const canManageMembers = hasPermission('projects.manage_members');
  const canCreateMilestone = hasPermission('milestones.create');

  const loadData = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setErrorMsg(null);

      const [projRes, memRes, mlsRes] = await Promise.all([
        fetchProjectById(projectId),
        fetchProjectMembers(projectId),
        fetchProjectMilestones(projectId),
      ]);

      if (projRes.error) {
        setErrorMsg(projRes.error);
      } else if (projRes.data) {
        setProject(projRes.data);
      }

      if (memRes.data) setMembers(memRes.data);
      if (mlsRes.data) setMilestones(mlsRes.data);

      fetchEligibleEmployees().then((res) => {
        if (res.data) setEligibleEmployees(res.data);
      });

      fetchAuditLogs(50).then((res) => {
        if (res.data) {
          const filtered = res.data.filter((log) => log.record_id === projectId);
          setAuditEvents(filtered);
        }
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load project details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  // Default Demo Project Materials Seed (used for demo projects prj-001..003)
  const defaultDemoMaterials: ProjectMaterialItem[] = useMemo(() => {
    return [
      {
        id: 'pmat-001',
        material_code: 'API-PARA-001',
        material_name: 'Paracetamol IP/BP (Micronized Grade)',
        category: 'API',
        milestone_title: 'API Formulation & Pilot Batch',
        required_quantity: 1000,
        delivered_quantity: 1000,
        uom: 'KG',
        pr_number: 'PR-2026-0041',
        pr_status: 'Approved',
        sap_po_number: '4500128901',
        sap_po_line: '10',
        supplier_name: 'Bharat Pharma Chem Ltd',
        supplier_code: 'SUP-001',
        original_committed_date: '2026-10-25',
        current_expected_date: '2026-10-25',
        delivery_status: 'DELIVERED',
        delay_days: 0,
        estimated_cost_inr: 450000,
        cas_number: '103-90-2',
        hsn_code: '29242990',
        tracking_id: 'del-001',
      },
      {
        id: 'pmat-002',
        material_code: 'API-METF-500',
        material_name: 'Metformin Hydrochloride BP/USP',
        category: 'API',
        milestone_title: 'API Formulation & Pilot Batch',
        required_quantity: 800,
        delivered_quantity: 0,
        uom: 'KG',
        pr_number: 'PR-2026-0041',
        pr_status: 'Approved',
        sap_po_number: '4500128907',
        sap_po_line: '10',
        supplier_name: 'Bharat Pharma Chem Ltd',
        supplier_code: 'SUP-001',
        original_committed_date: '2026-11-20',
        current_expected_date: '2026-11-20',
        delivery_status: 'ON_TRACK',
        delay_days: 0,
        estimated_cost_inr: 416000,
        cas_number: '1115-70-4',
        hsn_code: '29252990',
        tracking_id: 'del-007',
      },
      {
        id: 'pmat-003',
        material_code: 'PM-VIAL-010',
        material_name: 'Amber Glass Injection Vials 10ml (Type I Borosilicate)',
        category: 'PM',
        milestone_title: 'Primary Packaging Sterility Validation',
        required_quantity: 50000,
        delivered_quantity: 35000,
        uom: 'NOS',
        pr_number: 'PR-2026-0042',
        pr_status: 'Partially Ordered',
        sap_po_number: '4500128902',
        sap_po_line: '20',
        supplier_name: 'Apex Packaging Solutions Ltd',
        supplier_code: 'SUP-002',
        original_committed_date: '2026-11-01',
        current_expected_date: '2026-11-12',
        delivery_status: 'DELAYED',
        delay_days: 11,
        estimated_cost_inr: 650000,
        cas_number: null,
        hsn_code: '70109000',
        tracking_id: 'del-002',
      },
      {
        id: 'pmat-004',
        material_code: 'PM-ALU-SEAL',
        material_name: '20mm Aluminum Flip-Off Sterile Vial Seals',
        category: 'PM',
        milestone_title: 'Primary Packaging Sterility Validation',
        required_quantity: 50000,
        delivered_quantity: 0,
        uom: 'NOS',
        pr_number: 'PR-2026-0042',
        pr_status: 'Partially Ordered',
        sap_po_number: '4500128905',
        sap_po_line: '10',
        supplier_name: 'Borosil Packaging Solutions',
        supplier_code: 'SUP-002',
        original_committed_date: '2026-11-18',
        current_expected_date: '2026-11-18',
        delivery_status: 'ON_TRACK',
        delay_days: 0,
        estimated_cost_inr: 175000,
        cas_number: null,
        hsn_code: '83099020',
        tracking_id: 'del-005',
      },
      {
        id: 'pmat-005',
        material_code: 'EXE-MCC-102',
        material_name: 'Microcrystalline Cellulose PH-102 NF/EP',
        category: 'EXE',
        milestone_title: 'Excipient Binder Formulation Trial',
        required_quantity: 500,
        delivered_quantity: 0,
        uom: 'KG',
        pr_number: 'PR-2026-0041',
        pr_status: 'Approved',
        sap_po_number: '4500128903',
        sap_po_line: '10',
        supplier_name: 'ZenBio Excipients Pvt Ltd',
        supplier_code: 'SUP-003',
        original_committed_date: '2026-11-28',
        current_expected_date: '2026-11-28',
        delivery_status: 'ON_TRACK',
        delay_days: 0,
        estimated_cost_inr: 160000,
        cas_number: '9004-34-6',
        hsn_code: '39129090',
        tracking_id: 'del-003',
      },
      {
        id: 'pmat-006',
        material_code: 'EXE-STEA-005',
        material_name: 'Magnesium Stearate Pharma Grade Vegetable Origin',
        category: 'EXE',
        milestone_title: 'Excipient Binder Formulation Trial',
        required_quantity: 100,
        delivered_quantity: 100,
        uom: 'KG',
        pr_number: 'PR-2026-0041',
        pr_status: 'Approved',
        sap_po_number: '4500128908',
        sap_po_line: '10',
        supplier_name: 'ZenBio Excipients Pvt Ltd',
        supplier_code: 'SUP-003',
        original_committed_date: '2026-10-28',
        current_expected_date: '2026-10-28',
        delivery_status: 'DELIVERED',
        delay_days: 0,
        estimated_cost_inr: 85000,
        cas_number: '557-04-0',
        hsn_code: '29157090',
        tracking_id: 'del-008',
      },
      {
        id: 'pmat-007',
        material_code: 'CON-FILT-022',
        material_name: 'Sterile PVDF Syringe Membrane Filters 0.22 um',
        category: 'Consumables',
        milestone_title: 'In-process Quality Assay Verification',
        required_quantity: 500,
        delivered_quantity: 500,
        uom: 'NOS',
        pr_number: 'PR-2026-0043',
        pr_status: 'Approved',
        sap_po_number: '4500128904',
        sap_po_line: '30',
        supplier_name: 'SciLab Reagents & Consumables Corp',
        supplier_code: 'SUP-004',
        original_committed_date: '2026-10-30',
        current_expected_date: '2026-10-30',
        delivery_status: 'DELIVERED',
        delay_days: 0,
        estimated_cost_inr: 90000,
        cas_number: null,
        hsn_code: '84212900',
        tracking_id: 'del-004',
      },
      {
        id: 'pmat-008',
        material_code: 'CON-HPLC-COL',
        material_name: 'C18 Reverse Phase HPLC Analytical Column 250 x 4.6mm',
        category: 'Consumables',
        milestone_title: 'In-process Quality Assay Verification',
        required_quantity: 5,
        delivered_quantity: 0,
        uom: 'NOS',
        pr_number: 'PR-2026-0043',
        pr_status: 'Approved',
        sap_po_number: '4500128906',
        sap_po_line: '10',
        supplier_name: 'SciLab Reagents & Consumables Corp',
        supplier_code: 'SUP-004',
        original_committed_date: '2026-11-03',
        current_expected_date: '2026-11-10',
        delivery_status: 'DELAYED',
        delay_days: 7,
        estimated_cost_inr: 125000,
        cas_number: null,
        hsn_code: '90279090',
        tracking_id: 'del-006',
      },
    ];
  }, []);

  const [projectMaterials, setProjectMaterials] = useState<ProjectMaterialItem[]>([]);

  useEffect(() => {
    if (!projectId) return;
    setProjectMaterials(loadProjectMaterials(projectId, defaultDemoMaterials));
  }, [projectId, defaultDemoMaterials]);

  const showToast = (msg: string) => {
    setMaterialToast(msg);
    setTimeout(() => setMaterialToast(null), 4000);
  };

  const handleAddSingleMaterial = (newItem: ProjectMaterialItem) => {
    if (!projectId) return;
    const next = [newItem, ...projectMaterials];
    setProjectMaterials(next);
    saveProjectMaterials(projectId, next);
    setExpandedCategories((prev) => ({ ...prev, [newItem.category]: true }));
    showToast(`Added "${newItem.material_code} — ${newItem.material_name}" to ${newItem.category}.`);
  };

  const handleBulkImportMaterials = (items: ProjectMaterialItem[], mode: 'append' | 'replace') => {
    if (!projectId) return;
    const next = mode === 'replace' ? items : [...items, ...projectMaterials];
    setProjectMaterials(next);
    saveProjectMaterials(projectId, next);
    const expandedPatch: Record<string, boolean> = {};
    items.forEach((it) => {
      expandedPatch[it.category] = true;
    });
    setExpandedCategories((prev) => ({ ...prev, ...expandedPatch }));
    showToast(`Imported ${items.length} product(s) from Excel/CSV into project.`);
  };

  const handleRemoveMaterial = (matId: string, matCode: string) => {
    if (!projectId) return;
    if (!window.confirm(`Remove material "${matCode}" from this project?`)) return;
    const next = projectMaterials.filter((m) => m.id !== matId);
    setProjectMaterials(next);
    saveProjectMaterials(projectId, next);
    showToast(`Removed "${matCode}" from project.`);
  };

  // Category Summaries Computation
  const categorySummaries: MaterialCategorySummary[] = useMemo(() => {
    const categories: Array<{
      category: 'API' | 'PM' | 'EXE' | 'Consumables' | 'Other';
      label: string;
      description: string;
      icon: React.ComponentType<{ className?: string }>;
      badgeClass: string;
      defaultUom: string;
    }> = [
      {
        category: 'API',
        label: 'Active Ingredients (API)',
        description: 'Active pharmaceutical substances & bulk actives for manufacturing',
        icon: FlaskConical,
        badgeClass: 'bg-purple-100 text-purple-900 border-purple-200',
        defaultUom: 'KG',
      },
      {
        category: 'PM',
        label: 'Packaging Materials (PM)',
        description: 'Type I borosilicate amber vials, flip-off seals & blister foil rolls',
        icon: Package,
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-200',
        defaultUom: 'NOS',
      },
      {
        category: 'EXE',
        label: 'Excipients (EXE)',
        description: 'Pharma binders, disintegrants, lubricants & compression aids',
        icon: Layers,
        badgeClass: 'bg-blue-100 text-blue-900 border-blue-200',
        defaultUom: 'KG',
      },
      {
        category: 'Consumables',
        label: 'Consumables & Lab Reagents',
        description: 'Sterile membrane filters, HPLC columns, analytical assay solvents',
        icon: FileSpreadsheet,
        badgeClass: 'bg-teal-100 text-teal-900 border-teal-200',
        defaultUom: 'NOS',
      },
      ...(projectMaterials.some((m) => m.category === 'Other')
        ? [
            {
              category: 'Other' as const,
              label: 'Other Project Materials',
              description: 'Custom equipment, utilities & auxiliary supply items',
              icon: Boxes,
              badgeClass: 'bg-slate-100 text-slate-900 border-slate-200',
              defaultUom: 'UNITS',
            },
          ]
        : []),
    ];

    return categories.map((cat) => {
      const mats = projectMaterials.filter((m) => m.category === cat.category);
      const totalRequiredQty = mats.reduce((acc, curr) => acc + curr.required_quantity, 0);
      const totalDeliveredQty = mats.reduce((acc, curr) => acc + curr.delivered_quantity, 0);
      const totalValueINR = mats.reduce((acc, curr) => acc + curr.estimated_cost_inr, 0);

      const prSet = new Set(mats.map((m) => m.pr_number));
      const poSet = new Set(mats.map((m) => m.sap_po_number));

      const onTrackCount = mats.filter((m) => m.delivery_status === 'ON_TRACK').length;
      const delayedCount = mats.filter((m) => m.delivery_status === 'DELAYED').length;
      const deliveredCount = mats.filter((m) => m.delivery_status === 'DELIVERED').length;

      let nextEtaDays: number | null = null;
      const pendingDates = mats
        .filter((m) => m.delivery_status !== 'DELIVERED')
        .map((m) => new Date(m.current_expected_date).getTime());
      if (pendingDates.length > 0) {
        const minDate = Math.min(...pendingDates);
        nextEtaDays = Math.ceil((minDate - new Date('2026-11-05').getTime()) / (1000 * 60 * 60 * 24));
      }

      let overallHealth: 'On Track' | 'Delayed' | 'Delivered' | 'Attention Required' = 'On Track';
      if (delayedCount > 0) {
        overallHealth = 'Delayed';
      } else if (deliveredCount === mats.length && mats.length > 0) {
        overallHealth = 'Delivered';
      } else if (onTrackCount > 0) {
        overallHealth = 'On Track';
      }

      return {
        category: cat.category,
        label: cat.label,
        description: cat.description,
        icon: cat.icon,
        badgeClass: cat.badgeClass,
        materials: mats,
        totalRequiredQty,
        totalDeliveredQty,
        uom: cat.defaultUom,
        prCount: prSet.size,
        poCount: poSet.size,
        totalValueINR,
        onTrackCount,
        delayedCount,
        deliveredCount,
        nextEtaDays,
        overallHealth,
      };
    });
  }, [projectMaterials]);

  // Overall Project Delivery Metrics
  const projectKpiMetrics = useMemo(() => {
    const totalMaterials = projectMaterials.length;
    const deliveredCount = projectMaterials.filter((m) => m.delivery_status === 'DELIVERED').length;
    const delayedCount = projectMaterials.filter((m) => m.delivery_status === 'DELAYED').length;
    const onTrackCount = projectMaterials.filter((m) => m.delivery_status === 'ON_TRACK').length;
    const totalCommittedValue = projectMaterials.reduce((acc, curr) => acc + curr.estimated_cost_inr, 0);

    const onTimeRate = totalMaterials > 0 ? Math.round(((deliveredCount + onTrackCount) / totalMaterials) * 100) : 100;

    return {
      totalMaterials,
      deliveredCount,
      delayedCount,
      onTrackCount,
      totalCommittedValue,
      onTimeRate,
    };
  }, [projectMaterials]);

  const toggleCategoryExpand = (cat: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const handleArchive = async () => {
    if (!projectId || !project) return;
    const confirmed = window.confirm(
      `Are you sure you want to archive project "${project.project_code}: ${project.name}"? Archived projects become read-only while preserving all milestone and member history.`
    );
    if (!confirmed) return;

    setActionLoading(true);
    const res = await archiveProject(projectId, 'Archived by authorized user from project detail');
    setActionLoading(false);

    if (res.error) {
      alert(`Archive failed: ${res.error}`);
    } else {
      loadData();
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !selectedNewMember) return;

    setActionLoading(true);
    const res = await addProjectMember(projectId, selectedNewMember);
    setActionLoading(false);

    if (res.error) {
      alert(`Failed to add member: ${res.error}`);
    } else {
      setShowAddMember(false);
      setSelectedNewMember('');
      loadData();
    }
  };

  const handleRemoveMember = async (employeeId: string, memberName: string) => {
    if (!projectId) return;
    const confirmed = window.confirm(
      `Remove ${memberName} from this project? Their project scope will be revoked immediately while preserving membership history.`
    );
    if (!confirmed) return;

    setActionLoading(true);
    const res = await removeProjectMember(projectId, employeeId);
    setActionLoading(false);

    if (res.error) {
      alert(`Failed to remove member: ${res.error}`);
    } else {
      loadData();
    }
  };

  const handleChangeOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !selectedNewOwner) return;

    setActionLoading(true);
    const res = await changeProjectOwner(projectId, selectedNewOwner);
    setActionLoading(false);

    if (res.error) {
      alert(`Failed to reassign owner: ${res.error}`);
    } else {
      setShowChangeOwner(false);
      setSelectedNewOwner('');
      loadData();
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-forest" />
      </div>
    );
  }

  if (errorMsg || !project) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Button asChild variant="outline" size="sm" className="text-xs">
          <Link to="/app/projects">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back to Projects
          </Link>
        </Button>
        <div className="rounded-xl border border-red-300 bg-rose-50 p-6 text-center text-xs text-status-danger shadow-warm-sm">
          <AlertCircle className="h-6 w-6 text-status-danger mx-auto mb-2" />
          <h3 className="font-semibold text-sm">Unable to Load Project</h3>
          <p className="mt-1 text-[11px]">
            {errorMsg || 'Project not found or access denied by departmental scope.'}
          </p>
        </div>
      </div>
    );
  }

  const delay = calculateProjectDelay(project.planned_end_date, project.actual_completion_date, project.status);
  const progress = calculateProjectProgress(milestones);
  const isArchived = project.status === 'archived';

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-2 text-xs text-ink-secondary">
          <Link to="/app/projects" className="hover:text-forest flex items-center font-medium">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Projects
          </Link>
          <span className="text-divider">/</span>
          <span className="font-mono text-ink-primary font-semibold">{project.project_code}</span>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {canUpdate && !isArchived && (
            <Button asChild size="sm" variant="outline" className="text-xs border-divider">
              <Link to={`/app/projects/${project.id}/edit`}>
                <Edit className="h-3.5 w-3.5 mr-1.5 text-forest" />
                Edit Project
              </Link>
            </Button>
          )}

          {canArchive && !isArchived && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleArchive}
              disabled={actionLoading}
              className="text-xs border-copper/30 text-copper-dark hover:border-copper/50 hover:bg-copper-pale/40"
            >
              <Archive className="h-3.5 w-3.5 mr-1.5" />
              Archive
            </Button>
          )}
        </div>
      </div>

      {/* Modern Executive Project Header Card */}
      <div className="rounded-2xl border border-divider bg-white p-5 sm:p-6 shadow-warm-sm">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-3 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-forest bg-sage-pale px-2.5 py-0.5 rounded-md border border-sage/40">
                {project.project_code}
              </span>
              <Badge variant={project.status === 'active' ? 'success' : 'outline'} className="capitalize">
                {project.status.replace(/_/g, ' ')}
              </Badge>
              {projectKpiMetrics.delayedCount > 0 ? (
                <span className="inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  <AlertTriangle className="h-3 w-3 mr-1 text-rose-600" />
                  {projectKpiMetrics.delayedCount} Material {projectKpiMetrics.delayedCount === 1 ? 'Delay' : 'Delays'}
                </span>
              ) : (
                <span className="inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                  All Commitments On Schedule
                </span>
              )}
              {isArchived && (
                <Badge variant="destructive">Read-Only Archive</Badge>
              )}
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-primary">
                {project.name || project.title}
              </h1>
              {project.description && (
                <p className="text-xs text-ink-secondary mt-1 max-w-3xl leading-relaxed">
                  {project.description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-secondary pt-1">
              <div className="flex items-center space-x-1.5">
                <Building className="h-3.5 w-3.5 text-forest/70" />
                <span>Unit: <strong className="text-ink-primary font-semibold">{project.department?.name || 'Supply Chain Management'}</strong></span>
              </div>
              <div className="flex items-center space-x-1.5">
                <User className="h-3.5 w-3.5 text-forest/70" />
                <span>Owner: <strong className="text-ink-primary font-semibold">{project.owner?.full_name || 'Aarav Sharma (SCM Admin)'}</strong></span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Calendar className="h-3.5 w-3.5 text-forest/70" />
                <span className="font-mono text-[11px] bg-ivory px-2 py-0.5 rounded border border-divider/70">
                  {formatDateIST(project.planned_start_date)} — {formatDateIST(project.planned_end_date)}
                </span>
              </div>
            </div>
          </div>

          {/* Telemetry KPI Cards */}
          <div className="grid grid-cols-2 gap-3 shrink-0 sm:w-auto">
            <div className="rounded-xl border border-divider bg-ivory/70 p-4 min-w-[160px]">
              <span className="text-[10px] text-ink-secondary uppercase tracking-wider block font-semibold">
                Milestone Progress
              </span>
              <div className="text-xl font-bold font-mono text-forest mt-1">
                {progress.displayLabel}
              </div>
              <div className="mt-1.5 text-[11px] font-medium text-ink-secondary">
                {delay.displayText}
              </div>
            </div>

            <div className="rounded-xl bg-gradient-to-br from-forest-deep to-forest text-white p-4 min-w-[175px] shadow-warm-sm">
              <span className="text-[10px] text-emerald-200/80 uppercase tracking-wider block font-semibold">
                Supply Commitment
              </span>
              <div className="text-xl font-bold font-mono mt-1 truncate">
                {formatINR(projectKpiMetrics.totalCommittedValue)}
              </div>
              <div className="mt-1.5 text-[11px] text-emerald-200/90">
                {projectKpiMetrics.totalMaterials} Active Material Demands
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-divider overflow-x-auto">
        <nav className="flex space-x-6 text-xs font-medium min-w-max">
          {[
            {
              id: 'materials',
              label: 'Materials & Execution',
              badge: `${projectKpiMetrics.totalMaterials}`,
              badgeClass: 'bg-forest/10 text-forest',
            },
            {
              id: 'milestones',
              label: 'Milestones',
              badge: `${milestones.length}`,
              badgeClass: 'bg-sage-pale text-forest',
            },
            {
              id: 'governance',
              label: 'Governance & Attachments',
              badge: project.attachments?.length ? `${project.attachments.length}` : null,
              badgeClass: 'bg-ivory text-ink-secondary',
            },
            {
              id: 'members',
              label: 'Team Members',
              badge: `${members.filter((m) => m.status === 'active').length}`,
              badgeClass: 'bg-ivory text-ink-secondary',
            },
            {
              id: 'activity',
              label: 'Audit History',
              badge: null,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 border-b-2 transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-forest text-forest font-semibold'
                  : 'border-transparent text-ink-secondary hover:text-forest'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-semibold ${tab.badgeClass}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* TAB 1: MATERIALS & DELIVERY EXECUTION (PRIMARY SCM WORKSPACE) */}
      {activeTab === 'materials' && (
        <div className="space-y-5">
          {/* Interactive KPI Summary Cards (Click to Filter) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <button
              type="button"
              onClick={() => setMaterialFilterStatus('ALL')}
              className={`text-left rounded-xl transition-all ${
                materialFilterStatus === 'ALL' ? 'ring-2 ring-forest/70 shadow-warm-sm' : 'hover:shadow-warm-sm'
              }`}
            >
              <Card className="border-divider bg-white h-full">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">Total Demands</span>
                    <div className="p-2 rounded-lg bg-sage-pale text-forest">
                      <Boxes className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold font-mono text-ink-primary mt-2">
                    {projectKpiMetrics.totalMaterials}
                  </div>
                  <span className="text-[11px] text-ink-muted">Across {categorySummaries.length} categories</span>
                </CardContent>
              </Card>
            </button>

            <button
              type="button"
              onClick={() => setMaterialFilterStatus(materialFilterStatus === 'DELIVERED' ? 'ALL' : 'DELIVERED')}
              className={`text-left rounded-xl transition-all ${
                materialFilterStatus === 'DELIVERED' ? 'ring-2 ring-emerald-500 shadow-warm-sm' : 'hover:shadow-warm-sm'
              }`}
            >
              <Card className="border-divider bg-white h-full">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Fulfilled</span>
                    <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-700 mt-2">
                    {projectKpiMetrics.deliveredCount}
                  </div>
                  <span className="text-[11px] text-ink-muted">Received & QC cleared</span>
                </CardContent>
              </Card>
            </button>

            <button
              type="button"
              onClick={() => setMaterialFilterStatus(materialFilterStatus === 'ON_TRACK' ? 'ALL' : 'ON_TRACK')}
              className={`text-left rounded-xl transition-all ${
                materialFilterStatus === 'ON_TRACK' ? 'ring-2 ring-blue-500 shadow-warm-sm' : 'hover:shadow-warm-sm'
              }`}
            >
              <Card className="border-divider bg-white h-full">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">On Track</span>
                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                      <Truck className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold font-mono text-blue-700 mt-2">
                    {projectKpiMetrics.onTrackCount}
                  </div>
                  <span className="text-[11px] text-ink-muted">In transit within ETA</span>
                </CardContent>
              </Card>
            </button>

            <button
              type="button"
              onClick={() => setMaterialFilterStatus(materialFilterStatus === 'DELAYED' ? 'ALL' : 'DELAYED')}
              className={`text-left rounded-xl transition-all ${
                materialFilterStatus === 'DELAYED' ? 'ring-2 ring-rose-500 shadow-warm-sm' : 'hover:shadow-warm-sm'
              }`}
            >
              <Card className="border-divider bg-white h-full">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Delayed</span>
                    <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold font-mono text-rose-700 mt-2">
                    {projectKpiMetrics.delayedCount}
                  </div>
                  <span className="text-[11px] text-ink-muted">Requires supplier follow-up</span>
                </CardContent>
              </Card>
            </button>
          </div>

          {/* Product & BOM Management Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-divider shadow-warm-xs">
            <div>
              <h3 className="text-sm font-bold text-forest">Project Products & Material Requirements</h3>
              <p className="text-[11px] text-ink-secondary">
                Add products one-by-one or download the Excel template to bulk upload your project BOM.
              </p>
            </div>
            {!isArchived && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowAddMaterialModal(true)}
                  className="h-8 text-xs bg-forest hover:bg-forest-deep text-white shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Product
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadProjectMaterialsExcelTemplate(project.project_code)}
                  className="h-8 text-xs border-forest/30 text-forest hover:bg-forest/5"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Excel Template
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkUploadModal(true)}
                  className="h-8 text-xs border-forest/30 text-forest hover:bg-forest/5"
                >
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  Upload Excel / CSV
                </Button>
              </div>
            )}
          </div>

          {materialToast && (
            <div className="flex items-center space-x-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs text-emerald-900 shadow-xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{materialToast}</span>
            </div>
          )}

          {/* Empty state when project has no products yet */}
          {projectMaterials.length === 0 && (
            <Card className="border-2 border-dashed border-divider bg-ivory/40">
              <CardContent className="py-10 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-forest/10 text-forest">
                  <Boxes className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-forest">No products added to {project.project_code} yet</h4>
                  <p className="text-xs text-ink-secondary mt-1 max-w-md mx-auto">
                    Add API, Packaging, Excipients, or Consumables one-by-one, or download the Excel template and bulk upload all items at once.
                  </p>
                </div>
                {!isArchived && (
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setShowAddMaterialModal(true)}
                      className="text-xs bg-forest hover:bg-forest-deep text-white"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add First Product
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => downloadProjectMaterialsExcelTemplate(project.project_code)}
                      className="text-xs border-forest/30 text-forest"
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Download Excel Template (.xlsx)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowBulkUploadModal(true)}
                      className="text-xs border-forest/30 text-forest"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1" />
                      Upload Excel / CSV
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-ivory/50 p-3 rounded-lg border border-divider">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-semibold text-forest mr-2 flex items-center">
                <Filter className="h-3.5 w-3.5 mr-1 text-forest" />
                Filter Materials:
              </span>
              {[
                { id: 'ALL', label: 'All Items' },
                { id: 'DELAYED', label: `Delayed (${projectKpiMetrics.delayedCount})` },
                { id: 'ON_TRACK', label: `On Track (${projectKpiMetrics.onTrackCount})` },
                { id: 'DELIVERED', label: `Delivered (${projectKpiMetrics.deliveredCount})` },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setMaterialFilterStatus(pill.id as any)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    materialFilterStatus === pill.id
                      ? 'bg-forest text-white shadow-xs'
                      : 'bg-white text-ink-secondary hover:bg-forest/5 border border-divider'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-muted" />
              <Input
                type="text"
                placeholder="Search material code, description..."
                value={materialSearchQuery}
                onChange={(e) => setMaterialSearchQuery(e.target.value)}
                className="pl-8 text-xs h-8 bg-white"
              />
            </div>
          </div>

          {/* SCM Category Breakdown & Expandable Materials Table — Redesigned 6-Column Zero-Wrap Layout */}
          <div className="space-y-4">
            {categorySummaries.map((catSummary) => {
              const Icon = catSummary.icon;
              const isExpanded = !!expandedCategories[catSummary.category];

              // Filter category materials according to current status filter and search query
              const filteredMaterials = catSummary.materials.filter((m) => {
                const matchesStatus =
                  materialFilterStatus === 'ALL' ||
                  (materialFilterStatus === 'DELAYED' && m.delivery_status === 'DELAYED') ||
                  (materialFilterStatus === 'ON_TRACK' && m.delivery_status === 'ON_TRACK') ||
                  (materialFilterStatus === 'DELIVERED' && m.delivery_status === 'DELIVERED');

                const matchesSearch =
                  !materialSearchQuery.trim() ||
                  m.material_code.toLowerCase().includes(materialSearchQuery.toLowerCase()) ||
                  m.material_name.toLowerCase().includes(materialSearchQuery.toLowerCase()) ||
                  m.sap_po_number.includes(materialSearchQuery) ||
                  m.supplier_name.toLowerCase().includes(materialSearchQuery.toLowerCase());

                return matchesStatus && matchesSearch;
              });

              if (filteredMaterials.length === 0 && materialFilterStatus !== 'ALL') {
                return null;
              }

              const accentBorder =
                catSummary.category === 'API'
                  ? 'border-l-purple-500'
                  : catSummary.category === 'PM'
                    ? 'border-l-amber-500'
                    : catSummary.category === 'EXE'
                      ? 'border-l-blue-500'
                      : catSummary.category === 'Consumables'
                        ? 'border-l-teal-500'
                        : 'border-l-slate-500';

              const iconTone =
                catSummary.category === 'API'
                  ? 'bg-purple-50 text-purple-700 border-purple-200/70'
                  : catSummary.category === 'PM'
                    ? 'bg-amber-50 text-amber-700 border-amber-200/70'
                    : catSummary.category === 'EXE'
                      ? 'bg-blue-50 text-blue-700 border-blue-200/70'
                      : catSummary.category === 'Consumables'
                        ? 'bg-teal-50 text-teal-700 border-teal-200/70'
                        : 'bg-slate-100 text-slate-700 border-slate-200';

              return (
                <Card
                  key={catSummary.category}
                  className={`border border-divider border-l-4 ${accentBorder} shadow-warm-sm overflow-hidden transition-all duration-200`}
                >
                  {/* Category Header Bar (Clickable to Expand/Collapse) */}
                  <div
                    onClick={() => toggleCategoryExpand(catSummary.category)}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-5 py-4 bg-white hover:bg-ivory/60 cursor-pointer transition-colors select-none"
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl border shrink-0 ${iconTone}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold text-sm text-ink-primary tracking-tight">
                            {catSummary.label}
                          </h3>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${catSummary.badgeClass}`}>
                            {catSummary.materials.length} {catSummary.materials.length === 1 ? 'Item' : 'Items'}
                          </span>
                        </div>
                        <p className="text-xs text-ink-secondary mt-0.5 truncate">
                          {catSummary.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 md:gap-5 text-xs shrink-0">
                      {/* PR, PO & Commitment Pill */}
                      <div className="flex items-center space-x-3 rounded-lg bg-ivory px-3 py-1.5 border border-divider/80">
                        <div className="text-right">
                          <div className="font-mono text-[11px] font-semibold text-ink-primary whitespace-nowrap">
                            {catSummary.prCount} PR · {catSummary.poCount} SAP PO
                          </div>
                          <div className="text-[11px] font-mono text-forest font-bold whitespace-nowrap">
                            {formatINR(catSummary.totalValueINR)}
                          </div>
                        </div>
                      </div>

                      {/* Delivery Health Pill */}
                      <div>
                        {catSummary.materials.length === 0 ? (
                          <span className="inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-medium bg-ivory text-ink-muted border border-divider">
                            No items
                          </span>
                        ) : catSummary.delayedCount > 0 ? (
                          <span className="inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="h-3.5 w-3.5 mr-1 text-rose-600 shrink-0" />
                            {catSummary.delayedCount} Delayed
                          </span>
                        ) : catSummary.deliveredCount === catSummary.materials.length ? (
                          <span className="inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600 shrink-0" />
                            100% Delivered
                          </span>
                        ) : (
                          <span className="inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <Clock className="h-3.5 w-3.5 mr-1 text-blue-600 shrink-0" />
                            {catSummary.nextEtaDays !== null ? `Due in ${catSummary.nextEtaDays}d` : 'On Track'}
                          </span>
                        )}
                      </div>

                      {/* Expand / Collapse Trigger */}
                      <div className="flex items-center space-x-1 text-ink-secondary hover:text-forest font-medium">
                        <span className="text-xs hidden sm:inline">
                          {isExpanded ? 'Hide' : 'Show'}
                        </span>
                        <div className="p-1 rounded-md bg-ivory border border-divider/70">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-forest" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-ink-secondary" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Nested Materials Table — Clean 6-Column Zero-Wrap Architecture */}
                  {isExpanded && (
                    <div className="border-t border-divider bg-white animate-fadeIn">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-ivory/80 hover:bg-ivory/80">
                            <TableHead className="min-w-[240px]">Product / Material</TableHead>
                            <TableHead className="w-[155px]">Fulfillment</TableHead>
                            <TableHead className="w-[175px]">PR & SAP PO</TableHead>
                            <TableHead className="w-[180px]">Supplier</TableHead>
                            <TableHead className="w-[190px]">ETA & Deliverable</TableHead>
                            <TableHead className="w-[175px] text-right">Status & Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredMaterials.map((mat) => {
                            const deliverable = getDaysDeliverable(
                              mat.current_expected_date,
                              mat.delivery_status,
                              mat.original_committed_date
                            );

                            const percentDelivered =
                              mat.required_quantity > 0
                                ? Math.min(100, Math.round((mat.delivered_quantity / mat.required_quantity) * 100))
                                : 0;

                            return (
                              <TableRow key={mat.id} className="group hover:bg-ivory/50 transition-colors">
                                {/* Col 1: Product / Material + Code + Milestone */}
                                <TableCell>
                                  <div className="space-y-1">
                                    <div className="font-semibold text-[13px] text-ink-primary leading-snug">
                                      {mat.material_name}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                      <span className="font-mono font-semibold text-forest bg-sage-pale/70 px-1.5 py-0.5 rounded border border-sage/30 whitespace-nowrap">
                                        {mat.material_code}
                                      </span>
                                      {mat.cas_number && (
                                        <span className="font-mono text-ink-muted whitespace-nowrap">
                                          CAS {mat.cas_number}
                                        </span>
                                      )}
                                      <span className="text-divider">·</span>
                                      <span className="text-ink-secondary truncate max-w-[180px]" title={mat.milestone_title}>
                                        {mat.milestone_title}
                                      </span>
                                    </div>
                                  </div>
                                </TableCell>

                                {/* Col 2: Fulfillment Qty & Progress */}
                                <TableCell>
                                  <div className="space-y-1.5">
                                    <div className="flex items-baseline justify-between gap-2 whitespace-nowrap">
                                      <span className="font-mono text-xs font-bold text-ink-primary">
                                        {mat.delivered_quantity.toLocaleString()} / {mat.required_quantity.toLocaleString()}{' '}
                                        <span className="text-[10px] font-semibold text-ink-muted">{mat.uom}</span>
                                      </span>
                                      <span className="font-mono text-[10px] font-semibold text-ink-muted">
                                        {percentDelivered}%
                                      </span>
                                    </div>
                                    <div className="w-full h-1.5 bg-ivory-muted rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${
                                          percentDelivered === 100
                                            ? 'bg-emerald-500'
                                            : percentDelivered > 0
                                              ? 'bg-amber-500'
                                              : 'bg-slate-300'
                                        }`}
                                        style={{ width: `${percentDelivered}%` }}
                                      />
                                    </div>
                                  </div>
                                </TableCell>

                                {/* Col 3: PR & SAP PO */}
                                <TableCell>
                                  <div className="space-y-1 whitespace-nowrap">
                                    <div className="flex items-center space-x-1.5">
                                      <span className="font-mono text-xs font-semibold text-forest">
                                        {mat.pr_number}
                                      </span>
                                      <span className="text-[10px] text-ink-muted bg-ivory px-1.5 py-0.5 rounded border border-divider/70">
                                        {mat.pr_status}
                                      </span>
                                    </div>
                                    <div className="font-mono text-[11px] text-ink-secondary">
                                      PO <span className="font-semibold text-ink-primary">{mat.sap_po_number}</span> · L{mat.sap_po_line}
                                    </div>
                                  </div>
                                </TableCell>

                                {/* Col 4: Supplier */}
                                <TableCell>
                                  <div className="max-w-[170px]">
                                    <div
                                      className="text-xs font-medium text-ink-primary truncate"
                                      title={mat.supplier_name}
                                    >
                                      {mat.supplier_name}
                                    </div>
                                    <div className="text-[11px] font-mono text-ink-muted mt-0.5">
                                      {mat.supplier_code}
                                    </div>
                                  </div>
                                </TableCell>

                                {/* Col 5: ETA & Single-Line Days Deliverable */}
                                <TableCell>
                                  <div className="space-y-1.5 whitespace-nowrap">
                                    <div className="flex items-center space-x-1.5 font-mono text-xs">
                                      <span className="font-semibold text-ink-primary">
                                        {mat.current_expected_date}
                                      </span>
                                      {mat.current_expected_date !== mat.original_committed_date && (
                                        <span className="text-[10px] text-rose-500 line-through">
                                          {mat.original_committed_date}
                                        </span>
                                      )}
                                    </div>
                                    <div>
                                      {deliverable.badgeVariant === 'delivered' && (
                                        <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                          <Check className="h-3 w-3 mr-1 shrink-0" />
                                          {deliverable.text}
                                        </span>
                                      )}
                                      {deliverable.badgeVariant === 'on_track' && (
                                        <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                          <Clock className="h-3 w-3 mr-1 shrink-0" />
                                          {deliverable.text}
                                        </span>
                                      )}
                                      {deliverable.badgeVariant === 'delayed' && (
                                        <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                          <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
                                          {deliverable.text}
                                        </span>
                                      )}
                                      {deliverable.badgeVariant === 'due_today' && (
                                        <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                          <Clock className="h-3 w-3 mr-1 shrink-0" />
                                          Due Today
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>

                                {/* Col 6: Live Status & Always-Visible Action */}
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                                    {mat.delivery_status === 'DELIVERED' && (
                                      <Badge variant="success">Delivered</Badge>
                                    )}
                                    {mat.delivery_status === 'ON_TRACK' && (
                                      <Badge className="bg-blue-50 text-blue-700 border-blue-200">On Track</Badge>
                                    )}
                                    {mat.delivery_status === 'DELAYED' && (
                                      <Badge variant="destructive">Delayed</Badge>
                                    )}
                                    {mat.delivery_status === 'PARTIALLY_DELIVERED' && (
                                      <Badge variant="warning">Partial</Badge>
                                    )}

                                    {mat.delivery_status === 'DELAYED' ? (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => navigate('/app/deliveries/issues')}
                                        className="h-7 px-2.5 text-[11px] border-rose-200 text-rose-700 hover:bg-rose-50"
                                      >
                                        Issue
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => navigate('/app/deliveries')}
                                        className="h-7 px-2.5 text-[11px] border-divider text-forest hover:bg-sage-pale/50"
                                      >
                                        <Truck className="h-3 w-3 mr-1" />
                                        Track
                                      </Button>
                                    )}

                                    {!isArchived && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveMaterial(mat.id, mat.material_code)}
                                        className="p-1.5 rounded-md text-ink-muted opacity-70 group-hover:opacity-100 hover:text-status-danger hover:bg-rose-50 transition-all"
                                        title={`Remove ${mat.material_code}`}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {filteredMaterials.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-ink-muted text-xs">
                                No materials in {catSummary.label} matching your filter.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: MILESTONES SCHEDULE */}
      {activeTab === 'milestones' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-forest">
                Project Milestones & Delivery Schedule Alignment
              </h3>
              <p className="text-xs text-ink-secondary">
                Sequential Work Breakdown Structure (WBS) with assignee responsibilities.
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="text-xs border-divider">
              <Link to={`/app/projects/${project.id}/milestones`}>
                Manage Milestones View
              </Link>
            </Button>
          </div>

          {milestones.length === 0 ? (
            <div className="rounded-xl border border-dashed border-divider bg-ivory-surface p-8 text-center text-xs text-ink-secondary">
              <Clock className="h-6 w-6 text-sage mx-auto mb-2" />
              <p className="font-semibold text-ink-primary">No milestones scheduled</p>
              <p className="text-[11px] text-ink-muted mt-0.5">This project is valid with no milestones.</p>
              {canCreateMilestone && !isArchived && (
                <Button asChild size="sm" variant="outline" className="mt-3 text-xs">
                  <Link to={`/app/projects/${project.id}/milestones`}>
                    <Plus className="h-3 w-3 mr-1" />
                    Schedule First Milestone
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-divider/60 rounded-xl border border-divider bg-ivory-surface shadow-warm-sm overflow-hidden">
              {milestones.map((m) => {
                const mDelay = calculateProjectDelay(m.planned_end_date, m.actual_completion_date, m.status);
                return (
                  <div key={m.id} className="p-4 flex items-center justify-between text-xs hover:bg-sage-pale/20 transition-colors">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-forest">{m.milestone_code}</span>
                        <span className="font-semibold text-ink-primary">{m.title}</span>
                        <Badge variant={m.status === 'completed' ? 'success' : 'outline'} className="text-[10px]">
                          {m.status}
                        </Badge>
                      </div>
                      <p className="text-ink-secondary mt-1 font-mono text-[11px]">
                        Planned: {formatDateIST(m.planned_start_date)} to {formatDateIST(m.planned_end_date)}
                        {m.actual_completion_date && ` • Completed: ${formatDateIST(m.actual_completion_date)}`}
                        {m.assignee && ` • Assignee: ${m.assignee.full_name}`}
                      </p>
                    </div>

                    <div>
                      {mDelay.isLateOrOverdue ? (
                        <span className="text-copper-dark font-mono text-[11px] font-semibold bg-copper-pale/60 px-2 py-0.5 rounded border border-copper/30">
                          ⚠️ {mDelay.displayText}
                        </span>
                      ) : (
                        <span className="text-ink-secondary font-mono text-[11px]">
                          {mDelay.displayText}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PROJECT PARAMETERS & GOVERNANCE */}
      {activeTab === 'governance' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-divider shadow-warm-sm">
            <CardHeader className="pb-3 border-b border-divider/60 bg-ivory/30">
              <CardTitle className="text-sm font-semibold text-forest">Project Parameters & Concurrency</CardTitle>
              <CardDescription className="text-xs text-ink-secondary">
                Authoritative parameters and optimistic lock versioning.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-divider/40">
                <span className="text-ink-secondary">Project Code</span>
                <span className="font-mono font-semibold text-forest">{project.project_code}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-divider/40">
                <span className="text-ink-secondary">Status</span>
                <Badge variant={project.status === 'active' ? 'success' : 'outline'} className="capitalize text-[10px]">
                  {project.status.replace(/_/g, ' ')}
                </Badge>
              </div>
              <div className="flex justify-between py-1 border-b border-divider/40">
                <span className="text-ink-secondary">Planned Start Date</span>
                <span className="font-mono">{formatDateIST(project.planned_start_date)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-divider/40">
                <span className="text-ink-secondary">Planned End Date</span>
                <span className="font-mono">{formatDateIST(project.planned_end_date)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-divider/40">
                <span className="text-ink-secondary">Actual Completion Date</span>
                <span className="font-mono">{project.actual_completion_date ? formatDateIST(project.actual_completion_date) : '—'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-ink-secondary">Version / Concurrency Counter</span>
                <span className="font-mono text-ink-muted">v{project.version}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-divider shadow-warm-sm">
            <CardHeader className="pb-3 border-b border-divider/60 bg-ivory/30">
              <CardTitle className="text-sm font-semibold text-forest">Governance & Authoritative Ownership</CardTitle>
              <CardDescription className="text-xs text-ink-secondary">
                Departmental stewardship and assignment authority.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              <div className="flex justify-between py-1 border-b border-divider/40">
                <span className="text-ink-secondary">Department / Unit</span>
                <span className="font-semibold text-forest">{project.department?.name || 'Supply Chain Management'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-divider/40">
                <span className="text-ink-secondary">Authoritative Owner</span>
                <div className="text-right">
                  <span className="font-semibold text-ink-primary block">{project.owner?.full_name || 'Aarav Sharma (SCM Admin)'}</span>
                  <span className="font-mono text-[10px] text-ink-muted">{project.owner?.employee_id || 'EMP-1001'}</span>
                </div>
              </div>

              {canManageOwner && !isArchived && (
                <div className="pt-2">
                  {!showChangeOwner ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowChangeOwner(true)}
                      className="text-xs w-full border-divider"
                    >
                      Reassign Authoritative Owner
                    </Button>
                  ) : (
                    <form onSubmit={handleChangeOwner} className="space-y-2 p-3 bg-ivory rounded-lg border border-divider">
                      <Label htmlFor="newOwnerSelect" className="text-xs font-semibold text-forest">Select New Owner</Label>
                      <select
                        id="newOwnerSelect"
                        value={selectedNewOwner}
                        onChange={(e) => setSelectedNewOwner(e.target.value)}
                        className="w-full h-8 rounded border border-divider text-xs bg-ivory-surface px-2 font-mono text-ink-primary focus:border-forest"
                        required
                      >
                        <option value="">Choose an active employee...</option>
                        {eligibleEmployees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.full_name} ({e.employee_id} • {e.department})
                          </option>
                        ))}
                      </select>
                      <div className="flex justify-end space-x-2 pt-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setShowChangeOwner(false)} className="text-xs">
                          Cancel
                        </Button>
                        <Button type="submit" size="sm" disabled={actionLoading || !selectedNewOwner} className="text-xs bg-forest text-white">
                          Confirm Reassignment
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Project Documents & Attachments Card */}
          <Card className="border-divider shadow-warm-sm md:col-span-2">
            <CardHeader className="pb-3 border-b border-divider/60 bg-ivory/30">
              <CardTitle className="text-sm font-semibold text-forest">
                Project Reference Documents & Attachments ({project.attachments?.length || 0})
              </CardTitle>
              <CardDescription className="text-xs text-ink-secondary">
                Upload or download scope specifications, PDFs, Word documents, Excel BOMs, and regulatory files linked to this project.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <ProjectAttachmentUploader
                attachments={project.attachments || []}
                onChange={(next: ProjectAttachment[]) => {
                  saveProjectAttachments(project.id, next);
                  setProject({ ...project, attachments: next });
                }}
                readOnly={isArchived}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 4: TEAM MEMBERS */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-forest">
              Project Team Membership
            </h3>
            {canManageMembers && !isArchived && (
              <Button size="sm" onClick={() => setShowAddMember(true)} className="text-xs bg-forest hover:bg-forest-deep text-white">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Member
              </Button>
            )}
          </div>

          {showAddMember && (
            <Card className="border-sage bg-sage-pale/40 p-4">
              <form onSubmit={handleAddMember} className="space-y-3">
                <h4 className="text-xs font-semibold text-forest">
                  Add Active Employee to Project Scope
                </h4>
                <select
                  value={selectedNewMember}
                  onChange={(e) => setSelectedNewMember(e.target.value)}
                  className="w-full h-8 rounded border border-divider text-xs bg-ivory-surface px-2 font-mono text-ink-primary focus:border-forest"
                  required
                >
                  <option value="">Select active employee...</option>
                  {eligibleEmployees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_id} • {e.department} • {e.designation})
                    </option>
                  ))}
                </select>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddMember(false)} className="text-xs">
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={actionLoading || !selectedNewMember} className="text-xs bg-forest text-white">
                    Add Team Member
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <div className="divide-y divide-divider/60 rounded-xl border border-divider bg-ivory-surface shadow-warm-sm overflow-hidden">
            <div className="p-3.5 flex items-center justify-between text-xs bg-sage-pale/30">
              <div className="flex items-center space-x-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-ivory-surface font-bold text-[10px]">
                  OW
                </div>
                <div>
                  <span className="font-semibold text-forest">
                    {project.owner?.full_name || 'Owner Unassigned'}
                  </span>
                  <span className="text-[11px] text-ink-secondary block font-mono">
                    {project.owner?.employee_id} • {project.owner?.designation} • {project.owner?.department}
                  </span>
                </div>
              </div>
              <Badge variant="outline" className="text-forest border-sage/60 font-mono text-[10px] bg-ivory-surface">
                Authoritative Owner
              </Badge>
            </div>

            {members.map((member) => (
              <div key={member.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-sage-pale/20 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ivory text-forest border border-divider font-bold text-[10px]">
                    {member.employee?.full_name ? member.employee.full_name.charAt(0).toUpperCase() : 'M'}
                  </div>
                  <div>
                    <span className="font-semibold text-ink-primary">
                      {member.employee?.full_name}
                    </span>
                    <span className="text-[11px] text-ink-secondary block font-mono">
                      {member.employee?.employee_id} • {member.employee?.designation} • Added {formatDateIST(member.added_at)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Badge variant={member.status === 'active' ? 'success' : 'outline'} className="text-[10px] uppercase">
                    {member.status}
                  </Badge>

                  {canManageMembers && member.status === 'active' && !isArchived && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.employee_id, member.employee?.full_name || 'Member')}
                      disabled={actionLoading}
                      className="text-xs text-status-danger hover:text-red-700 h-7 px-2"
                      title="Remove Member"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: ACTIVITY & AUDIT HISTORY */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-forest">
            Immutable Audit Trail for {project.project_code}
          </h3>

          {auditEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-divider bg-ivory-surface p-8 text-center text-xs text-ink-secondary">
              No audit events logged specifically for this project ID.
            </div>
          ) : (
            <div className="space-y-2.5">
              {auditEvents.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-divider/70 bg-ivory-surface p-3 text-xs shadow-warm-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-forest">
                      {log.action}
                    </span>
                    <span className="font-mono text-[11px] text-ink-secondary">
                      {formatDateIST(log.created_at)}
                    </span>
                  </div>
                  {log.new_values && (
                    <pre className="mt-1 text-[11px] bg-ivory p-2 rounded text-ink-primary font-mono overflow-x-auto border border-divider/60">
                      {JSON.stringify(log.new_values, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Add Product One-by-One Modal */}
      <AddProjectMaterialModal
        open={showAddMaterialModal}
        onOpenChange={setShowAddMaterialModal}
        milestones={milestones.map((m) => ({ id: m.id, title: m.title }))}
        onAddMaterial={handleAddSingleMaterial}
      />

      {/* Bulk Upload Excel / CSV Template Modal */}
      <BulkUploadProjectMaterialsModal
        open={showBulkUploadModal}
        onOpenChange={setShowBulkUploadModal}
        projectCode={project.project_code}
        existingCount={projectMaterials.length}
        onImportMaterials={handleBulkImportMaterials}
      />
    </div>
  );
}
