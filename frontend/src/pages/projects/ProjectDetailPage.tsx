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
} from '@/services/projectService';
import { fetchAuditLogs } from '@/services/auditService';
import { calculateProjectDelay, calculateProjectProgress } from '@/lib/projectCalculations';
import { AuditLog, Employee, Milestone, Project, ProjectMember } from '@/types/database.types';
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
  });

  // Filter state for materials within the category drilldown
  const [materialFilterStatus, setMaterialFilterStatus] = useState<'ALL' | 'ON_TRACK' | 'DELAYED' | 'DELIVERED'>('ALL');
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');

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

  // Project Materials and Delivery Tracking Dataset
  const projectMaterials: ProjectMaterialItem[] = useMemo(() => {
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
      <div className="rounded-xl border border-divider bg-ivory-surface p-5 sm:p-6 shadow-warm-sm">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-forest bg-sage-pale px-2.5 py-0.5 rounded border border-sage/50">
                {project.project_code}
              </span>
              <Badge variant={project.status === 'active' ? 'success' : 'outline'} className="capitalize text-[11px]">
                {project.status.replace(/_/g, ' ')}
              </Badge>
              {projectKpiMetrics.delayedCount > 0 ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-800 border border-rose-200">
                  <AlertTriangle className="h-3 w-3 mr-1 text-rose-600" />
                  {projectKpiMetrics.delayedCount} Material Delays Detected
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                  Supply Commitments On Schedule
                </span>
              )}
              {isArchived && (
                <Badge variant="destructive" className="text-[10px]">Read-Only Archive</Badge>
              )}
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-forest">
                {project.name || project.title}
              </h1>
              {project.description && (
                <p className="text-xs text-ink-secondary mt-1 max-w-3xl leading-relaxed">
                  {project.description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-ink-secondary pt-1">
              <div className="flex items-center space-x-1.5">
                <Building className="h-3.5 w-3.5 text-forest/70" />
                <span>Department: <strong className="text-ink-primary">{project.department?.name || 'Supply Chain Management'}</strong></span>
              </div>
              <div className="flex items-center space-x-1.5">
                <User className="h-3.5 w-3.5 text-forest/70" />
                <span>Owner: <strong className="text-ink-primary">{project.owner?.full_name || 'Aarav Sharma (SCM Admin)'}</strong></span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Calendar className="h-3.5 w-3.5 text-forest/70" />
                <span className="font-mono">
                  {formatDateIST(project.planned_start_date)} — {formatDateIST(project.planned_end_date)}
                </span>
              </div>
            </div>
          </div>

          {/* Telemetry KPI Cards */}
          <div className="grid grid-cols-2 gap-3 shrink-0 sm:w-auto">
            <div className="rounded-lg border border-divider bg-ivory/60 p-3.5 min-w-[140px]">
              <span className="text-[10px] text-ink-secondary uppercase tracking-wider block font-semibold">
                Milestone Progress
              </span>
              <div className="text-lg font-bold font-mono text-forest mt-0.5">
                {progress.displayLabel}
              </div>
              <div className="mt-1 text-[10px] font-mono text-ink-secondary">
                {delay.displayText}
              </div>
            </div>

            <div className="rounded-lg border border-divider bg-forest text-white p-3.5 min-w-[140px]">
              <span className="text-[10px] text-sage-light uppercase tracking-wider block font-semibold">
                Supply Commitment
              </span>
              <div className="text-lg font-bold font-mono mt-0.5 truncate">
                {formatINR(projectKpiMetrics.totalCommittedValue)}
              </div>
              <div className="mt-1 text-[10px] text-sage-light">
                {projectKpiMetrics.totalMaterials} Material Demands
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs with Badges */}
      <div className="border-b border-divider">
        <nav className="flex space-x-6 text-xs font-medium">
          {[
            {
              id: 'materials',
              label: 'Materials & Delivery Execution',
              badge: `${projectKpiMetrics.totalMaterials} Items`,
              badgeClass: 'bg-forest/10 text-forest',
            },
            {
              id: 'milestones',
              label: 'Milestones Schedule',
              badge: `${milestones.length}`,
              badgeClass: 'bg-sage-pale text-forest',
            },
            {
              id: 'governance',
              label: 'Project Parameters & Governance',
              badge: null,
            },
            {
              id: 'members',
              label: 'Team Members',
              badge: `${members.filter((m) => m.status === 'active').length}`,
              badgeClass: 'bg-ivory text-ink-secondary',
            },
            {
              id: 'activity',
              label: 'Activity & Audit History',
              badge: null,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 border-b-2 transition-colors flex items-center space-x-1.5 ${
                activeTab === tab.id
                  ? 'border-forest text-forest font-semibold'
                  : 'border-transparent text-ink-secondary hover:text-forest'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-medium ${tab.badgeClass}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* TAB 1: MATERIALS & DELIVERY EXECUTION (PRIMARY SCM WORKSPACE) */}
      {activeTab === 'materials' && (
        <div className="space-y-6">
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-divider shadow-warm-xs bg-white">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-ink-muted">Total Demands</span>
                  <Boxes className="h-4 w-4 text-forest" />
                </div>
                <div className="text-xl font-bold text-forest mt-1">
                  {projectKpiMetrics.totalMaterials}
                </div>
                <span className="text-[10px] text-ink-muted">Across 4 material categories</span>
              </CardContent>
            </Card>

            <Card className="border-divider shadow-warm-xs bg-white">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-emerald-700">Fulfilled Materials</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-xl font-bold text-emerald-900 mt-1">
                  {projectKpiMetrics.deliveredCount}
                </div>
                <span className="text-[10px] text-ink-muted">Received & QC cleared</span>
              </CardContent>
            </Card>

            <Card className="border-divider shadow-warm-xs bg-white">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-blue-700">On Track in Transit</span>
                  <Truck className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-xl font-bold text-blue-900 mt-1">
                  {projectKpiMetrics.onTrackCount}
                </div>
                <span className="text-[10px] text-ink-muted">Within committed ETA</span>
              </CardContent>
            </Card>

            <Card className="border-divider shadow-warm-xs bg-white">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-rose-700">Delayed Deliveries</span>
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                </div>
                <div className="text-xl font-bold text-rose-900 mt-1">
                  {projectKpiMetrics.delayedCount}
                </div>
                <span className="text-[10px] text-ink-muted">Escalated in Phase 9</span>
              </CardContent>
            </Card>
          </div>

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

          {/* SCM Category Breakdown & Expandable Materials Table */}
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

              return (
                <Card
                  key={catSummary.category}
                  className="border-divider shadow-warm-xs overflow-hidden transition-all duration-200"
                >
                  {/* Category Header Bar (Clickable to Expand/Collapse) */}
                  <div
                    onClick={() => toggleCategoryExpand(catSummary.category)}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white hover:bg-ivory/40 cursor-pointer transition-colors border-b border-divider/60 select-none"
                  >
                    <div className="flex items-center space-x-3.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest/10 text-forest shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-sm text-forest">
                            {catSummary.label}
                          </h3>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-medium border ${catSummary.badgeClass}`}>
                            {catSummary.materials.length} Materials
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-secondary mt-0.5">
                          {catSummary.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 md:mt-0 flex flex-wrap items-center gap-4 text-xs">
                      {/* PR & PO Metrics */}
                      <div className="font-mono text-ink-secondary text-right">
                        <div>
                          <strong className="text-ink-primary">{catSummary.prCount} PRs</strong> •{' '}
                          <strong className="text-ink-primary">{catSummary.poCount} SAP POs</strong>
                        </div>
                        <div className="text-[10px] text-ink-muted">
                          Commitment: {formatINR(catSummary.totalValueINR)}
                        </div>
                      </div>

                      {/* Delivery Status & Days Deliverable Pill */}
                      <div className="min-w-[130px] text-right">
                        {catSummary.delayedCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                            <AlertTriangle className="h-3.5 w-3.5 mr-1 text-rose-600" />
                            {catSummary.delayedCount} Delayed
                          </span>
                        ) : catSummary.deliveredCount === catSummary.materials.length ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                            100% Delivered
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                            <Clock className="h-3.5 w-3.5 mr-1 text-blue-600" />
                            {catSummary.nextEtaDays !== null ? `Due in ${catSummary.nextEtaDays}d` : 'On Track'}
                          </span>
                        )}
                      </div>

                      {/* Expand / Collapse Icon */}
                      <div className="flex items-center space-x-1 text-ink-muted hover:text-forest pl-2">
                        <span className="text-[11px] font-medium hidden sm:inline">
                          {isExpanded ? 'Collapse' : 'Expand Details'}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-forest transition-transform" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-ink-muted transition-transform" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Nested Materials Table */}
                  {isExpanded && (
                    <div className="p-0 overflow-x-auto bg-ivory/20 animate-fadeIn">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-ivory/70 border-b border-divider">
                            <TableHead className="text-xs font-semibold text-forest">Material & Code</TableHead>
                            <TableHead className="text-xs font-semibold text-forest">Milestone Mapping</TableHead>
                            <TableHead className="text-xs font-semibold text-forest text-right">Demanded vs Delivered</TableHead>
                            <TableHead className="text-xs font-semibold text-forest">PR Reference</TableHead>
                            <TableHead className="text-xs font-semibold text-forest">SAP PO Reference</TableHead>
                            <TableHead className="text-xs font-semibold text-forest">Supplier</TableHead>
                            <TableHead className="text-xs font-semibold text-forest">Committed ETA</TableHead>
                            <TableHead className="text-xs font-semibold text-forest text-center">Days Deliverable</TableHead>
                            <TableHead className="text-xs font-semibold text-forest text-center">Live Status</TableHead>
                            <TableHead className="text-xs font-semibold text-forest text-right">Action</TableHead>
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
                                ? Math.round((mat.delivered_quantity / mat.required_quantity) * 100)
                                : 0;

                            return (
                              <TableRow key={mat.id} className="hover:bg-ivory/40 transition-colors">
                                {/* Material Code & Name */}
                                <TableCell>
                                  <div className="font-mono font-bold text-xs text-forest">
                                    {mat.material_code}
                                  </div>
                                  <div className="text-xs text-ink-primary font-medium max-w-[220px]">
                                    {mat.material_name}
                                  </div>
                                  {mat.cas_number && (
                                    <div className="text-[10px] text-ink-muted font-mono">
                                      CAS: {mat.cas_number}
                                    </div>
                                  )}
                                </TableCell>

                                {/* Milestone */}
                                <TableCell className="text-xs text-ink-secondary max-w-[150px]">
                                  {mat.milestone_title}
                                </TableCell>

                                {/* Demanded vs Delivered */}
                                <TableCell className="text-right">
                                  <div className="font-mono text-xs font-bold text-forest">
                                    {mat.delivered_quantity.toLocaleString()} / {mat.required_quantity.toLocaleString()} {mat.uom}
                                  </div>
                                  <div className="w-20 ml-auto mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        percentDelivered === 100
                                          ? 'bg-emerald-500'
                                          : percentDelivered > 0
                                          ? 'bg-amber-500'
                                          : 'bg-gray-300'
                                      }`}
                                      style={{ width: `${percentDelivered}%` }}
                                    />
                                  </div>
                                </TableCell>

                                {/* PR Reference */}
                                <TableCell>
                                  <div className="font-mono text-xs font-semibold text-forest">
                                    {mat.pr_number}
                                  </div>
                                  <span className="text-[10px] text-ink-muted block">
                                    {mat.pr_status}
                                  </span>
                                </TableCell>

                                {/* SAP PO Reference */}
                                <TableCell>
                                  <div className="font-mono text-xs font-bold text-forest">
                                    {mat.sap_po_number}
                                  </div>
                                  <span className="text-[10px] text-ink-muted block font-mono">
                                    Line {mat.sap_po_line}
                                  </span>
                                </TableCell>

                                {/* Supplier */}
                                <TableCell className="text-xs text-ink-primary max-w-[140px] truncate">
                                  <div>{mat.supplier_name}</div>
                                  <span className="text-[10px] text-ink-muted font-mono">
                                    {mat.supplier_code}
                                  </span>
                                </TableCell>

                                {/* Committed Date & Current ETA */}
                                <TableCell className="text-xs font-mono">
                                  <div className="text-ink-primary">
                                    {mat.current_expected_date}
                                  </div>
                                  {mat.current_expected_date !== mat.original_committed_date && (
                                    <div className="text-[10px] text-rose-600 line-through">
                                      Orig: {mat.original_committed_date}
                                    </div>
                                  )}
                                </TableCell>

                                {/* Days Deliverable */}
                                <TableCell className="text-center font-mono">
                                  {deliverable.badgeVariant === 'delivered' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      <Check className="h-3 w-3 mr-1" />
                                      {deliverable.text}
                                    </span>
                                  )}
                                  {deliverable.badgeVariant === 'on_track' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                      <Clock className="h-3 w-3 mr-1" />
                                      {deliverable.text}
                                    </span>
                                  )}
                                  {deliverable.badgeVariant === 'delayed' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      {deliverable.text}
                                    </span>
                                  )}
                                  {deliverable.badgeVariant === 'due_today' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                      <Clock className="h-3 w-3 mr-1" />
                                      Due Today
                                    </span>
                                  )}
                                </TableCell>

                                {/* Live Status */}
                                <TableCell className="text-center">
                                  {mat.delivery_status === 'DELIVERED' && (
                                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                                      Delivered
                                    </Badge>
                                  )}
                                  {mat.delivery_status === 'ON_TRACK' && (
                                    <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[10px]">
                                      On Track
                                    </Badge>
                                  )}
                                  {mat.delivery_status === 'DELAYED' && (
                                    <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px]">
                                      Delayed
                                    </Badge>
                                  )}
                                  {mat.delivery_status === 'PARTIALLY_DELIVERED' && (
                                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                                      Partial
                                    </Badge>
                                  )}
                                </TableCell>

                                {/* Quick Action */}
                                <TableCell className="text-right">
                                  {mat.delivery_status === 'DELAYED' ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => navigate('/app/deliveries/issues')}
                                      className="text-[10px] h-6 px-2 border-rose-300 text-rose-700 hover:bg-rose-50"
                                    >
                                      View Issue
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => navigate('/app/deliveries')}
                                      className="text-[10px] h-6 px-2 border-forest/30 text-forest hover:bg-forest/5"
                                    >
                                      <Truck className="h-2.5 w-2.5 mr-1" />
                                      Track
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {filteredMaterials.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={10} className="text-center py-6 text-ink-muted text-xs">
                                No materials found matching your selected status or search filter.
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
    </div>
  );
}
