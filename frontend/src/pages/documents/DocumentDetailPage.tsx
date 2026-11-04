import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  FileText,
  ShieldCheck,
  Calendar,
  Clock,
  History,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Lock,
  Plus,
  RefreshCw,
  X,
  Building2,
  Package,
  Truck,
  ExternalLink,
  Layers,
  FileCheck,
  Archive,
  Download,
} from 'lucide-react';
import {
  DocumentExpiryStatus,
  DocumentReviewStatus,
  DocumentVersion,
  ScmDocumentRecord,
} from '@/types/database.types';
import {
  fetchScmDocumentById,
  createDocumentVersion,
  reviewScmDocument,
  archiveScmDocument,
} from '@/services/documentService';

export function DocumentDetailPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const canUpload = hasPermission('documents.upload');
  const canReview = hasPermission('documents.review');
  const canArchive = hasPermission('documents.archive');

  const [document, setDocument] = useState<ScmDocumentRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionFileName, setVersionFileName] = useState('');
  const [versionFileKey, setVersionFileKey] = useState('');
  const [versionNotes, setVersionNotes] = useState('');
  const [isSubmittingVersion, setIsSubmittingVersion] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [newReviewStatus, setNewReviewStatus] = useState<DocumentReviewStatus>('Verified');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [isSubmittingArchive, setIsSubmittingArchive] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const loadDocument = async () => {
    if (!documentId) return;
    setLoading(true);
    try {
      const doc = await fetchScmDocumentById(documentId);
      setDocument(doc);
    } catch (err) {
      console.error('Failed to load document:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocument();
  }, [documentId]);

  const handleOpenVersionModal = () => {
    if (!document) return;
    const nextVerNum = (document.versions?.length || 1) + 1;
    setVersionFileName(`${document.title.replace(/\s+/g, '_')}_v${nextVerNum}.pdf`);
    setVersionFileKey(`scm/documents/${Date.now()}_v${nextVerNum}.pdf`);
    setVersionNotes(`Revised version V${nextVerNum}`);
    setVersionError(null);
    setShowVersionModal(true);
  };

  const handleVersionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId || !versionFileName.trim() || !versionFileKey.trim()) {
      setVersionError('Please enter file name and storage key.');
      return;
    }

    setIsSubmittingVersion(true);
    setVersionError(null);

    const res = await createDocumentVersion({
      documentId,
      fileName: versionFileName,
      fileKey: versionFileKey,
      versionNotes,
    });

    setIsSubmittingVersion(false);

    if (res.success) {
      setShowVersionModal(false);
      loadDocument();
    } else {
      setVersionError(res.error || 'Failed to upload new version.');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId || !reviewRemarks.trim()) {
      setReviewError('Verification remarks are required.');
      return;
    }

    setIsSubmittingReview(true);
    setReviewError(null);

    const res = await reviewScmDocument({
      documentId,
      newReviewStatus,
      remarks: reviewRemarks,
    });

    setIsSubmittingReview(false);

    if (res.success) {
      setShowReviewModal(false);
      loadDocument();
    } else {
      setReviewError(res.error || 'Failed to record document review.');
    }
  };

  const handleArchiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId || !archiveReason.trim()) {
      setArchiveError('Archive reason is required.');
      return;
    }

    setIsSubmittingArchive(true);
    setArchiveError(null);

    const res = await archiveScmDocument(documentId, archiveReason);
    setIsSubmittingArchive(false);

    if (res.success) {
      setShowArchiveModal(false);
      loadDocument();
    } else {
      setArchiveError(res.error || 'Failed to archive document.');
    }
  };

  const getExpiryBadge = (status?: DocumentExpiryStatus) => {
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

  const getReviewBadge = (status?: DocumentReviewStatus) => {
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

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center text-ink-muted">
          <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-forest" />
          <p className="text-xs">Loading Document Record...</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/app/documents')}
          className="text-forest"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Documents
        </Button>
        <Card className="border-divider bg-ivory-surface p-8 text-center text-ink-muted">
          <FileText className="mx-auto mb-2 h-8 w-8 text-ink-muted/50" />
          <h2 className="text-base font-bold text-ink-primary">Document Not Found</h2>
          <p className="mt-1 text-xs">The requested document could not be found or you do not have permission.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/documents')}
            className="border-divider bg-ivory-surface hover:bg-ivory text-forest"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to Documents
          </Button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-forest">{document.title}</h1>
              <span className="rounded bg-forest/10 px-2 py-0.5 font-mono text-xs font-semibold text-forest">
                {document.document_number}
              </span>
              <span className="rounded bg-sage-pale px-2 py-0.5 text-xs font-bold text-forest">
                {document.current_version_number}
              </span>
              {document.is_confidential && (
                <span className="flex items-center space-x-1 rounded bg-copper-pale px-2 py-0.5 text-xs font-semibold text-copper">
                  <Lock className="h-3 w-3" />
                  <span>Confidential</span>
                </span>
              )}
            </div>
            <p className="text-xs text-ink-secondary mt-0.5">
              Category: <span className="font-semibold text-ink-primary">{document.category?.display_name || document.category_id}</span> • Scope: <span className="font-medium capitalize">{document.category_group.toLowerCase().replace('_', ' ')}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canUpload && document.expiry_status !== 'Archived' && (
            <Button
              size="sm"
              onClick={handleOpenVersionModal}
              className="bg-forest text-ivory hover:bg-forest-deep shadow-warm-sm text-xs"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Upload New Version
            </Button>
          )}

          {canReview && document.expiry_status !== 'Archived' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setReviewRemarks('');
                setReviewError(null);
                setShowReviewModal(true);
              }}
              className="border-forest text-forest hover:bg-forest/10 text-xs"
            >
              <FileCheck className="mr-1.5 h-3.5 w-3.5 text-forest" />
              Conduct Review
            </Button>
          )}

          {canArchive && document.expiry_status !== 'Archived' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setArchiveReason('');
                setArchiveError(null);
                setShowArchiveModal(true);
              }}
              className="border-divider bg-ivory text-ink-secondary hover:bg-ivory-muted text-xs"
            >
              <Archive className="mr-1.5 h-3.5 w-3.5 text-ink-muted" />
              Archive
            </Button>
          )}
        </div>
      </div>

      {/* Validity Banner */}
      <Card
        className={`border p-4 shadow-warm-sm ${document.expiry_status === 'Expired'
            ? 'border-red-300 bg-red-50/70'
            : document.expiry_status === 'Expiring Soon'
              ? 'border-amber-300 bg-amber-50/70'
              : 'border-divider bg-ivory-surface'
          }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start space-x-3">
            {document.expiry_status === 'Expired' ? (
              <AlertOctagon className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            ) : document.expiry_status === 'Expiring Soon' ? (
              <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <h3
                className={`text-sm font-bold ${document.expiry_status === 'Expired'
                    ? 'text-red-900'
                    : document.expiry_status === 'Expiring Soon'
                      ? 'text-amber-900'
                      : 'text-forest'
                  }`}
              >
                {document.expiry_status === 'Expired'
                  ? 'DOCUMENT HAS EXPIRED'
                  : document.expiry_status === 'Expiring Soon'
                    ? 'DOCUMENT EXPIRING SOON'
                    : 'DOCUMENT COMPLIANT & ACTIVE'}
              </h3>
              <p className="text-xs text-ink-secondary mt-0.5">
                {document.expiry_date
                  ? `Validity expires on ${document.expiry_date} (Asia/Kolkata timezone).`
                  : 'Perpetual validity document (No expiry date registered).'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="rounded border border-divider/60 bg-ivory p-2 text-center">
              <span className="block text-[10px] text-ink-muted">Validity Status</span>
              <span className={`inline-block rounded-full border px-2 py-0.5 font-bold ${getExpiryBadge(document.expiry_status)}`}>
                {document.expiry_status}
              </span>
            </div>
            <div className="rounded border border-divider/60 bg-ivory p-2 text-center">
              <span className="block text-[10px] text-ink-muted">Verification Status</span>
              <span className={`inline-block rounded-full border px-2 py-0.5 font-bold ${getReviewBadge(document.review_status)}`}>
                {document.review_status}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Grid: Document Metadata & Linked Records */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Metadata Details */}
        <Card className="border-divider bg-ivory-surface shadow-warm-sm lg:col-span-2">
          <CardHeader className="border-b border-divider/60 pb-3">
            <CardTitle className="text-sm font-bold text-forest">Document Details & Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            {document.description && (
              <div>
                <span className="text-[10px] uppercase font-semibold text-ink-muted">Description / Scope</span>
                <p className="mt-0.5 text-ink-primary text-xs leading-relaxed">{document.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-divider/60 pt-3">
              <div>
                <span className="text-[10px] uppercase font-semibold text-ink-muted">Reference / Cert #</span>
                <p className="font-mono font-semibold text-ink-primary">
                  {document.document_reference_number || '—'}
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-ink-muted">Issue Date</span>
                <p className="font-mono font-medium text-ink-primary">{document.issue_date || '—'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-ink-muted">Expiry Date</span>
                <p className="font-mono font-medium text-ink-primary">{document.expiry_date || 'No Expiry'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-divider/60 pt-3">
              <div>
                <span className="text-[10px] uppercase font-semibold text-ink-muted">Owner Employee</span>
                <p className="font-medium text-ink-primary">
                  {document.owner?.full_name || 'SCM Team'} ({document.owner?.employee_id || '—'})
                </p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-ink-muted">Registered On</span>
                <p className="font-mono text-ink-primary">{document.created_at?.slice(0, 10)}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-ink-muted">Confidential Record</span>
                <p className="font-semibold text-forest">{document.is_confidential ? 'Yes (Restricted)' : 'No (Standard)'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Linked SCM Records */}
        <Card className="border-divider bg-ivory-surface shadow-warm-sm">
          <CardHeader className="border-b border-divider/60 pb-3">
            <CardTitle className="text-sm font-bold text-forest">Linked SCM Records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 text-xs">
            {!document.links || document.links.length === 0 ? (
              <p className="text-ink-muted">No specific business entities linked to this document.</p>
            ) : (
              document.links.map((link) => (
                <div
                  key={link.id}
                  className="rounded-lg border border-divider/60 bg-ivory p-2.5 flex items-start space-x-2.5"
                >
                  {link.link_type === 'SUPPLIER' ? (
                    <Building2 className="h-4 w-4 text-forest flex-shrink-0 mt-0.5" />
                  ) : link.link_type === 'MATERIAL' ? (
                    <Package className="h-4 w-4 text-forest flex-shrink-0 mt-0.5" />
                  ) : (
                    <Truck className="h-4 w-4 text-forest flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-mono text-[10px] uppercase font-bold text-forest block">
                      {link.link_type}
                    </span>
                    <span className="font-semibold text-ink-primary">
                      {link.target_reference || 'Linked Record'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Version History Table */}
      <Card className="border-divider bg-ivory-surface shadow-warm-sm">
        <CardHeader className="border-b border-divider/60 pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-forest">
              Document Versions ({document.versions?.length || 0})
            </CardTitle>
            <CardDescription className="text-xs text-ink-secondary">
              Immutably preserved file versions, uploads, and revision notes
            </CardDescription>
          </div>
          {canUpload && document.expiry_status !== 'Archived' && (
            <Button
              size="sm"
              onClick={handleOpenVersionModal}
              className="bg-forest text-ivory hover:bg-forest-deep text-xs"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Upload Version
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-divider bg-ivory/60 text-ink-secondary">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Version</th>
                  <th className="px-4 py-2.5 font-semibold">File Name</th>
                  <th className="px-4 py-2.5 font-semibold">Storage Key / Path</th>
                  <th className="px-4 py-2.5 font-semibold">Uploaded Date</th>
                  <th className="px-4 py-2.5 font-semibold">Version Notes</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider/60 text-ink-primary">
                {!document.versions || document.versions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-ink-muted">
                      No versions recorded.
                    </td>
                  </tr>
                ) : (
                  document.versions.map((ver) => (
                    <tr key={ver.id} className="hover:bg-sage-pale/20">
                      <td className="px-4 py-3 font-bold text-forest">
                        <span className="rounded bg-forest/10 px-2 py-0.5">{ver.version_number}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink-primary">{ver.file_name}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-ink-muted">{ver.file_key}</td>
                      <td className="px-4 py-3 font-mono text-ink-secondary">
                        {ver.uploaded_at?.slice(0, 10)}
                      </td>
                      <td className="px-4 py-3 text-ink-secondary">{ver.version_notes || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {ver.is_current ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                            Current Version
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                            Superseded
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Review Verification History */}
      <Card className="border-divider bg-ivory-surface shadow-warm-sm">
        <CardHeader className="border-b border-divider/60 pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-forest">
            Verification & Review History ({document.reviews?.length || 0})
          </CardTitle>
          {canReview && document.expiry_status !== 'Archived' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setReviewRemarks('');
                setReviewError(null);
                setShowReviewModal(true);
              }}
              className="border-forest text-forest hover:bg-forest/10 text-xs"
            >
              <FileCheck className="mr-1 h-3.5 w-3.5" />
              Add Review
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3 pt-4 text-xs">
          {!document.reviews || document.reviews.length === 0 ? (
            <p className="text-ink-muted">No review records yet. Document is currently {document.review_status}.</p>
          ) : (
            document.reviews.map((rev) => (
              <div
                key={rev.id}
                className="flex items-start justify-between rounded-lg border border-divider/60 bg-ivory p-3"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${getReviewBadge(rev.new_review_status)}`}>
                      {rev.new_review_status}
                    </span>
                    <span className="text-ink-muted text-[11px] font-mono">
                      {rev.reviewed_at?.slice(0, 10)}
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-ink-primary">{rev.remarks}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Audit Events Trail */}
      <Card className="border-divider bg-ivory-surface shadow-warm-sm">
        <CardHeader className="border-b border-divider/60 pb-3">
          <CardTitle className="text-sm font-bold text-forest">Document Lifecycle Audit Trail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {!document.events || document.events.length === 0 ? (
            <p className="text-xs text-ink-muted">No events recorded.</p>
          ) : (
            document.events.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start space-x-3 rounded-lg border border-divider/60 bg-ivory p-3 text-xs"
              >
                <History className="h-4 w-4 text-forest flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-forest">{ev.event_type}</span>
                    <span className="font-mono text-[10px] text-ink-muted">{ev.performed_at}</span>
                  </div>
                  <p className="mt-1 text-ink-secondary">{ev.change_reason}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Modal: Upload New Version */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-divider bg-ivory-surface p-6 shadow-warm-xl">
            <div className="flex items-center justify-between border-b border-divider/60 pb-3">
              <h3 className="text-base font-bold text-forest">Upload New Document Version</h3>
              <button onClick={() => setShowVersionModal(false)} className="text-ink-muted hover:text-ink-primary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleVersionSubmit} className="mt-4 space-y-4 text-xs">
              {versionError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-red-700">
                  {versionError}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="verFileName" className="text-xs">
                  File Display Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="verFileName"
                  value={versionFileName}
                  onChange={(e) => setVersionFileName(e.target.value)}
                  className="border-divider bg-ivory text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="verFileKey" className="text-xs">
                  Storage Key / Path <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="verFileKey"
                  value={versionFileKey}
                  onChange={(e) => setVersionFileKey(e.target.value)}
                  className="border-divider bg-ivory text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="verNotes" className="text-xs">
                  Version Revision Notes
                </Label>
                <textarea
                  id="verNotes"
                  rows={3}
                  value={versionNotes}
                  onChange={(e) => setVersionNotes(e.target.value)}
                  placeholder="What changed in this revision?"
                  className="w-full rounded-md border border-divider bg-ivory p-2 text-xs text-ink-primary"
                />
              </div>

              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                Note: Uploading a revised version preserves the previous file and resets the review status to Pending Review.
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVersionModal(false)}
                  className="border-divider bg-ivory"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingVersion}
                  className="bg-forest text-ivory hover:bg-forest-deep"
                >
                  {isSubmittingVersion ? 'Uploading...' : 'Upload Version'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Conduct Review */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-divider bg-ivory-surface p-6 shadow-warm-xl">
            <div className="flex items-center justify-between border-b border-divider/60 pb-3">
              <h3 className="text-base font-bold text-forest">Conduct Document Review</h3>
              <button onClick={() => setShowReviewModal(false)} className="text-ink-muted hover:text-ink-primary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="mt-4 space-y-4 text-xs">
              {reviewError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-red-700">
                  {reviewError}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="reviewStatusSelect" className="text-xs">
                  Verification Status
                </Label>
                <select
                  id="reviewStatusSelect"
                  value={newReviewStatus}
                  onChange={(e) => setNewReviewStatus(e.target.value as DocumentReviewStatus)}
                  className="w-full rounded-md border border-divider bg-ivory p-2 text-xs font-semibold text-ink-primary"
                >
                  <option value="Verified">Verified (Compliant)</option>
                  <option value="Review Required">Review Required (Action Needed)</option>
                  <option value="Unable to Verify">Unable to Verify (Discrepancy)</option>
                  <option value="Pending Review">Pending Review</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="revRemarks" className="text-xs">
                  Verification Remarks <span className="text-red-500">*</span>
                </Label>
                <textarea
                  id="revRemarks"
                  rows={3}
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  placeholder="Record verification observations, certificate checks, or discrepancies"
                  className="w-full rounded-md border border-divider bg-ivory p-2 text-xs text-ink-primary"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReviewModal(false)}
                  className="border-divider bg-ivory"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingReview}
                  className="bg-forest text-ivory hover:bg-forest-deep"
                >
                  {isSubmittingReview ? 'Submitting...' : 'Record Review'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Archive Document */}
      {showArchiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-divider bg-ivory-surface p-6 shadow-warm-xl">
            <div className="flex items-center justify-between border-b border-divider/60 pb-3">
              <h3 className="text-base font-bold text-forest">Archive Document</h3>
              <button onClick={() => setShowArchiveModal(false)} className="text-ink-muted hover:text-ink-primary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleArchiveSubmit} className="mt-4 space-y-4 text-xs">
              {archiveError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-2.5 text-red-700">
                  {archiveError}
                </div>
              )}

              <p className="text-ink-secondary">
                Archived documents remain in historical audit records but are removed from active compliance registers.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="archReason" className="text-xs">
                  Archive Justification <span className="text-red-500">*</span>
                </Label>
                <textarea
                  id="archReason"
                  rows={3}
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="Why is this document being archived?"
                  className="w-full rounded-md border border-divider bg-ivory p-2 text-xs text-ink-primary"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowArchiveModal(false)}
                  className="border-divider bg-ivory"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingArchive}
                  className="bg-status-danger text-white hover:bg-red-700"
                >
                  {isSubmittingArchive ? 'Archiving...' : 'Confirm Archive'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

