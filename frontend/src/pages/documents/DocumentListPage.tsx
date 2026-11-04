import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FileText,
  ShieldCheck,
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
  X,
  FileSpreadsheet,
  AlertOctagon,
  AlertTriangle,
  FolderOpen,
  Layers,
  Lock,
  Tag,
  Building2,
  Package,
  Truck,
} from 'lucide-react';
import {
  DocumentCategoryConfig,
  DocumentCategoryGroup,
  DocumentDashboardMetrics,
  DocumentExpiryStatus,
  DocumentReviewStatus,
  MaterialDeliveryTracking,
  ScmDocumentRecord,
  Supplier,
} from '@/types/database.types';
import {
  fetchScmDocuments,
  fetchDocumentCategories,
  fetchDocumentMetrics,
  createScmDocument,
  exportDocumentsCsv,
} from '@/services/documentService';
import { fetchSuppliers } from '@/services/supplierService';
import { fetchActiveEmployees } from '@/services/employeeService';
import { fetchDeliveryTrackingList } from '@/services/deliveryService';

export function DocumentListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasPermission } = useAuth();

  const canExport = hasPermission('documents.export');
  const canUpload = hasPermission('documents.upload');
  const canReview = hasPermission('documents.review');

  // Query parameter initializers
  const initialGroup = searchParams.get('group') || 'ALL';
  const initialSupplier = searchParams.get('supplierId') || '';

  // State
  const [documents, setDocuments] = useState<ScmDocumentRecord[]>([]);
  const [categories, setCategories] = useState<DocumentCategoryConfig[]>([]);
  const [metrics, setMetrics] = useState<DocumentDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryGroup, setCategoryGroup] = useState<string>(initialGroup);
  const [categoryId, setCategoryId] = useState<string>('ALL');
  const [expiryStatus, setExpiryStatus] = useState<string>('ALL');
  const [reviewStatus, setReviewStatus] = useState<string>('ALL');

  // Master lists for linking
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [trackingList, setTrackingList] = useState<MaterialDeliveryTracking[]>([]);
  const [employees, setEmployees] = useState<{ id: string; full_name: string; employee_id: string }[]>([]);

  // Modal: Add Document
  const [showAddModal, setShowAddModal] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formRefNumber, setFormRefNumber] = useState('');
  const [formOwnerId, setFormOwnerId] = useState('');
  const [formIssueDate, setFormIssueDate] = useState('');
  const [formExpiryDate, setFormExpiryDate] = useState('');
  const [formIsConfidential, setFormIsConfidential] = useState(false);

  // File attributes
  const [formFileName, setFormFileName] = useState('');
  const [formFileKey, setFormFileKey] = useState('');
  const [formVersionNotes, setFormVersionNotes] = useState('');

  // Linkage targets
  const [linkSupplierId, setLinkSupplierId] = useState(initialSupplier);
  const [linkTrackingId, setLinkTrackingId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedDocs, fetchedCats, fetchedMetrics, fetchedSupps, fetchedTracks, fetchedEmps] =
        await Promise.all([
          fetchScmDocuments({
            search,
            categoryGroup,
            categoryId,
            expiryStatus,
            reviewStatus,
            supplierId: initialSupplier || undefined,
          }),
          fetchDocumentCategories(),
          fetchDocumentMetrics(),
          fetchSuppliers(),
          fetchDeliveryTrackingList(),
          fetchActiveEmployees(),
        ]);

      setDocuments(fetchedDocs);
      setCategories(fetchedCats);
      setMetrics(fetchedMetrics);
      setSuppliers(fetchedSupps?.data || []);
      setTrackingList(fetchedTracks.data || []);
      setEmployees(fetchedEmps);

      if (!formCategoryId && fetchedCats.length > 0) {
        setFormCategoryId(fetchedCats[0].id);
      }
      if (!formOwnerId && fetchedEmps.length > 0) {
        setFormOwnerId(fetchedEmps[0].id);
      }
    } catch (err) {
      console.error('Failed to load documents data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [categoryGroup, categoryId, expiryStatus, reviewStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleExport = (reportType: string) => {
    if (!canExport) return;
    exportDocumentsCsv(documents, reportType);
  };

  const handleOpenAddModal = () => {
    setFormTitle('');
    setFormDesc('');
    setFormRefNumber('');
    setFormIssueDate('');
    setFormExpiryDate('');
    setFormIsConfidential(false);
    setFormFileName('compliance_document.pdf');
    setFormFileKey(`scm/documents/${Date.now()}_doc.pdf`);
    setFormVersionNotes('Initial document registration');
    setFormError(null);
    setShowAddModal(true);
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formCategoryId || !formFileKey.trim() || !formFileName.trim()) {
      setFormError('Please enter document title, category, and file reference.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const res = await createScmDocument({
      title: formTitle,
      categoryId: formCategoryId,
      description: formDesc,
      documentReferenceNumber: formRefNumber,
      ownerEmployeeId: formOwnerId || undefined,
      issueDate: formIssueDate || undefined,
      expiryDate: formExpiryDate || undefined,
      isConfidential: formIsConfidential,
      fileName: formFileName,
      fileKey: formFileKey,
      versionNotes: formVersionNotes,
      supplierId: linkSupplierId || undefined,
      trackingId: linkTrackingId || undefined,
    });

    setIsSubmitting(false);

    if (res.success) {
      setShowAddModal(false);
      loadData();
      if (res.document_id) {
        navigate(`/app/documents/${res.document_id}`);
      }
    } else {
      setFormError(res.error || 'Failed to create document.');
    }
  };

  const getExpiryBadge = (status: DocumentExpiryStatus) => {
    switch (status) {
      case 'Expired':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'Expiring Soon':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Active':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'No Expiry Date':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'Superseded':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Archived':
        return 'bg-slate-200 text-slate-800 border-slate-400';
      default:
        return 'bg-ivory text-ink-primary border-divider';
    }
  };

  const getReviewBadge = (status: DocumentReviewStatus) => {
    switch (status) {
      case 'Verified':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
      case 'Pending Review':
        return 'bg-blue-50 text-blue-700 border-blue-300';
      case 'Review Required':
        return 'bg-amber-50 text-amber-700 border-amber-300';
      case 'Unable to Verify':
        return 'bg-red-50 text-red-700 border-red-300';
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
              Phase 12
            </span>
            <span className="text-xs text-ink-secondary">•</span>
            <span className="text-xs font-medium text-ink-secondary">Centralized Repository & Expiry Tracking</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-forest">
            SCM Document Management
          </h1>
          <p className="mt-0.5 text-xs text-ink-secondary">
            Centralized document repository with version control, validity monitoring, and automated expiry tracking across suppliers, materials, and deliveries.
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
            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('SCM_Documents_Register')}
                disabled={documents.length === 0}
                className="border-divider bg-ivory-surface hover:bg-ivory text-forest text-xs"
              >
                <Download className="h-3.5 w-3.5 mr-1.5 text-forest" />
                Export CSV
              </Button>
            </div>
          )}

          {canUpload && (
            <Button
              size="sm"
              onClick={handleOpenAddModal}
              className="bg-forest text-ivory hover:bg-forest-deep shadow-warm-sm"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Document
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total Documents */}
        <Card className="border-divider bg-ivory-surface p-3.5 shadow-warm-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-secondary">Total Documents</span>
            <FolderOpen className="h-4 w-4 text-forest" />
          </div>
          <div className="mt-2 text-2xl font-bold text-forest">{metrics?.totalDocuments ?? '—'}</div>
          <p className="text-[10px] text-ink-muted">Active and archived</p>
        </Card>

        {/* Active Valid */}
        <Card className="border-emerald-200 bg-emerald-50/50 p-3.5 shadow-warm-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800">Active & Valid</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{metrics?.activeDocuments ?? '—'}</div>
          <p className="text-[10px] text-emerald-700/80">Compliant validity</p>
        </Card>

        {/* Expiring in 90 Days */}
        <Card className="border-amber-200 bg-amber-50/50 p-3.5 shadow-warm-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">Expiring ≤ 90d</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700">{metrics?.expiringWithin90d ?? '—'}</div>
          <p className="text-[10px] text-amber-700/80">Renewal reminders sent</p>
        </Card>

        {/* Expiring in 30 Days */}
        <Card className="border-orange-200 bg-orange-50/50 p-3.5 shadow-warm-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-orange-800">Expiring ≤ 30d</span>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-orange-700">{metrics?.expiringWithin30d ?? '—'}</div>
          <p className="text-[10px] text-orange-700/80">Urgent renewal required</p>
        </Card>

        {/* Expired */}
        <Card className="border-red-200 bg-red-50/50 p-3.5 shadow-warm-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-800">Expired</span>
            <AlertOctagon className="h-4 w-4 text-red-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-red-700">{metrics?.expiredDocuments ?? '—'}</div>
          <p className="text-[10px] text-red-600/80">Past validity deadline</p>
        </Card>

        {/* Pending Review */}
        <Card className="border-blue-200 bg-blue-50/50 p-3.5 shadow-warm-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-800">Pending Review</span>
            <ShieldCheck className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-700">{metrics?.reviewPendingCount ?? '—'}</div>
          <p className="text-[10px] text-blue-700/80">Verification needed</p>
        </Card>
      </div>

      {/* Scope Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-divider pb-2 text-xs">
        {[
          { label: 'All Documents', value: 'ALL' },
          { label: 'Supplier Documents', value: 'SUPPLIER', icon: Building2 },
          { label: 'Material Documents', value: 'MATERIAL', icon: Package },
          { label: 'PO & Delivery Records', value: 'PO_DELIVERY', icon: Truck },
          { label: 'General Compliance', value: 'GENERAL', icon: Tag },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = categoryGroup === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setCategoryGroup(tab.value);
                setCategoryId('ALL');
              }}
              className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                isSelected
                  ? 'bg-forest text-ivory font-semibold shadow-warm-sm'
                  : 'bg-ivory-surface text-ink-secondary hover:bg-ivory border border-divider/60'
              }`}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <Card className="border-divider bg-ivory-surface shadow-warm-sm">
        <CardContent className="p-3.5">
          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-5">
            <div className="relative md:col-span-2">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-muted" />
              <Input
                placeholder="Search doc #, title, ref #, supplier, material..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs border-divider bg-ivory"
              />
            </div>

            <div>
              <select
                aria-label="Filter by Category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-md border border-divider bg-ivory px-2.5 py-2 text-xs font-medium text-ink-primary focus:outline-none focus:ring-1 focus:ring-forest"
              >
                <option value="ALL">All Document Types</option>
                {categories
                  .filter((c) => categoryGroup === 'ALL' || c.category_group === categoryGroup)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <select
                aria-label="Filter by Expiry Status"
                value={expiryStatus}
                onChange={(e) => setExpiryStatus(e.target.value)}
                className="w-full rounded-md border border-divider bg-ivory px-2.5 py-2 text-xs font-medium text-ink-primary focus:outline-none focus:ring-1 focus:ring-forest"
              >
                <option value="ALL">All Expiry Statuses</option>
                <option value="Active">Active (Valid)</option>
                <option value="Expiring Soon">Expiring Soon (≤ 90d)</option>
                <option value="Expired">Expired</option>
                <option value="No Expiry Date">No Expiry Date</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            <div>
              <select
                aria-label="Filter by Review Status"
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value)}
                className="w-full rounded-md border border-divider bg-ivory px-2.5 py-2 text-xs font-medium text-ink-primary focus:outline-none focus:ring-1 focus:ring-forest"
              >
                <option value="ALL">All Review Statuses</option>
                <option value="Pending Review">Pending Review</option>
                <option value="Verified">Verified</option>
                <option value="Review Required">Review Required</option>
                <option value="Unable to Verify">Unable to Verify</option>
              </select>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Document Register Table */}
      <Card className="border-divider bg-ivory-surface shadow-warm-sm">
        <CardHeader className="border-b border-divider/60 px-5 py-3.5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold text-forest">
              Document Master Register ({documents.length})
            </CardTitle>
            <span className="text-[11px] text-ink-muted">
              Centralized SCM Record Store with Version History & Verification
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-divider bg-ivory/60 text-ink-secondary">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Doc # / Version</th>
                  <th className="px-4 py-2.5 font-semibold">Title & Reference</th>
                  <th className="px-4 py-2.5 font-semibold">Category</th>
                  <th className="px-4 py-2.5 font-semibold">Linked Business Records</th>
                  <th className="px-4 py-2.5 font-semibold">Validity & Expiry</th>
                  <th className="px-4 py-2.5 font-semibold">Review Status</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider/60 text-ink-primary">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-ink-muted">
                      <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin text-forest" />
                      Loading Document Register...
                    </td>
                  </tr>
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-ink-muted">
                      <FileText className="mx-auto mb-2 h-7 w-7 text-ink-muted/50" />
                      No documents found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  documents.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() => navigate(`/app/documents/${doc.id}`)}
                      className="transition-colors hover:bg-sage-pale/20 cursor-pointer"
                    >
                      {/* Doc # & Version */}
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-semibold text-forest">{doc.document_number}</span>
                          {doc.is_confidential && (
                            <span title="Confidential Document">
                              <Lock className="h-3 w-3 text-copper" />
                            </span>
                          )}
                        </div>
                        <span className="mt-0.5 inline-block rounded bg-forest/10 px-1.5 py-0.2 text-[10px] font-bold text-forest">
                          {doc.current_version_number}
                        </span>
                      </td>

                      {/* Title & Ref # */}
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-semibold text-ink-primary line-clamp-1">{doc.title}</p>
                        {doc.document_reference_number && (
                          <p className="font-mono text-[11px] text-ink-muted">
                            Ref: {doc.document_reference_number}
                          </p>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        <span className="font-medium text-ink-primary">
                          {doc.category?.display_name || doc.category_id}
                        </span>
                        <div className="text-[10px] text-ink-muted capitalize">
                          {doc.category_group.toLowerCase().replace('_', ' ')}
                        </div>
                      </td>

                      {/* Linked Entities */}
                      <td className="px-4 py-3">
                        {!doc.links || doc.links.length === 0 ? (
                          <span className="text-[11px] text-ink-muted">General Document</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {doc.links.map((link) => (
                              <span
                                key={link.id}
                                className="inline-flex items-center space-x-1 rounded bg-ivory px-1.5 py-0.5 text-[10px] font-medium text-forest border border-divider"
                              >
                                <span>{link.link_type}:</span>
                                <span className="font-bold">{link.target_reference || 'Record'}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Expiry Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getExpiryBadge(
                            doc.expiry_status
                          )}`}
                        >
                          {doc.expiry_status}
                        </span>
                        {doc.expiry_date && (
                          <div className="mt-1 font-mono text-[10px] text-ink-muted">
                            Exp: {doc.expiry_date}
                          </div>
                        )}
                      </td>

                      {/* Review Status */}
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getReviewBadge(
                            doc.review_status
                          )}`}
                        >
                          {doc.review_status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/app/documents/${doc.id}`)}
                          className="h-7 w-7 p-0 text-ink-muted hover:text-forest"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal: Add Document */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-divider bg-ivory-surface p-6 shadow-warm-xl">
            <div className="flex items-center justify-between border-b border-divider/60 pb-3">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-forest" />
                <h3 className="text-base font-bold text-forest">Add SCM Document</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-ink-muted hover:text-ink-primary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="mt-4 space-y-4 text-xs">
              {formError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-red-700">
                  {formError}
                </div>
              )}

              {/* Title & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="formTitle" className="text-xs">
                    Document Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="formTitle"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. ISO 9001:2015 Quality Certificate or API Paracetamol Specification"
                    className="border-divider bg-ivory text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="formCategory" className="text-xs">
                    Document Category / Classification <span className="text-red-500">*</span>
                  </Label>
                  <select
                    id="formCategory"
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full rounded-md border border-divider bg-ivory p-2 text-xs font-medium text-ink-primary"
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        [{c.category_group}] {c.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="formRef" className="text-xs">
                    Document Reference # / Certificate #
                  </Label>
                  <Input
                    id="formRef"
                    value={formRefNumber}
                    onChange={(e) => setFormRefNumber(e.target.value)}
                    placeholder="e.g. 29AABCU9603R1ZM or ISO-CERT-449"
                    className="border-divider bg-ivory text-xs font-mono"
                  />
                </div>
              </div>

              {/* Validity Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="formIssueDate" className="text-xs">
                    Issue Date
                  </Label>
                  <Input
                    id="formIssueDate"
                    type="date"
                    value={formIssueDate}
                    onChange={(e) => setFormIssueDate(e.target.value)}
                    className="border-divider bg-ivory text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="formExpiryDate" className="text-xs">
                    Expiry Date (Leave blank if No Expiry)
                  </Label>
                  <Input
                    id="formExpiryDate"
                    type="date"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className="border-divider bg-ivory text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="formOwner" className="text-xs">
                    Responsible Owner
                  </Label>
                  <select
                    id="formOwner"
                    value={formOwnerId}
                    onChange={(e) => setFormOwnerId(e.target.value)}
                    className="w-full rounded-md border border-divider bg-ivory p-2 text-xs font-medium text-ink-primary"
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Associations (Supplier & PO Line) */}
              <div className="border-t border-divider/60 pt-3 space-y-3">
                <span className="font-semibold text-forest block">Link to Existing SCM Records (Optional)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="linkSupplier" className="text-xs">
                      Associated Supplier
                    </Label>
                    <select
                      id="linkSupplier"
                      value={linkSupplierId}
                      onChange={(e) => setLinkSupplierId(e.target.value)}
                      className="w-full rounded-md border border-divider bg-ivory p-2 text-xs font-medium text-ink-primary"
                    >
                      <option value="">-- No Supplier Linked --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.legal_name} ({s.supplier_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="linkTracking" className="text-xs">
                      Associated SAP PO Line
                    </Label>
                    <select
                      id="linkTracking"
                      value={linkTrackingId}
                      onChange={(e) => setLinkTrackingId(e.target.value)}
                      className="w-full rounded-md border border-divider bg-ivory p-2 text-xs font-medium text-ink-primary"
                    >
                      <option value="">-- No PO Line Linked --</option>
                      {trackingList.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.sap_po_number} (Line {t.sap_po_line_number}) — {t.material_description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* File Reference / Key */}
              <div className="border-t border-divider/60 pt-3 space-y-3">
                <span className="font-semibold text-forest block">Initial Version File Details (Version 1)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="formFileName" className="text-xs">
                      File Display Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="formFileName"
                      value={formFileName}
                      onChange={(e) => setFormFileName(e.target.value)}
                      placeholder="e.g. Paracetamol_SDS_v2026.pdf"
                      className="border-divider bg-ivory text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="formFileKey" className="text-xs">
                      Storage Key / Secure Reference <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="formFileKey"
                      value={formFileKey}
                      onChange={(e) => setFormFileKey(e.target.value)}
                      placeholder="scm/documents/paracetamol_sds.pdf"
                      className="border-divider bg-ivory text-xs font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="formVersionNotes" className="text-xs">
                    Initial Version Notes
                  </Label>
                  <textarea
                    id="formVersionNotes"
                    rows={2}
                    value={formVersionNotes}
                    onChange={(e) => setFormVersionNotes(e.target.value)}
                    placeholder="Details about this uploaded document or version notes"
                    className="w-full rounded-md border border-divider bg-ivory p-2 text-xs text-ink-primary"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="confidentialCheck"
                  checked={formIsConfidential}
                  onChange={(e) => setFormIsConfidential(e.target.checked)}
                  className="rounded border-divider text-forest focus:ring-forest"
                />
                <Label htmlFor="confidentialCheck" className="text-xs cursor-pointer">
                  Mark as Confidential (Restricted commercial/statutory record)
                </Label>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-divider/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                  className="border-divider bg-ivory"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-forest text-ivory hover:bg-forest-deep"
                >
                  {isSubmitting ? 'Registering...' : 'Register Document'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
