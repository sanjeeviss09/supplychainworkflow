import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  fetchSupplierById,
  deactivateSupplier,
  reactivateSupplier,
  deleteSupplier,
  checkSupplierDependencyCounts,
  fetchSupplierContacts,
  manageSupplierContact,
  fetchSupplierAddresses,
  manageSupplierAddress,
  fetchSupplierMaterials,
  fetchAvailableMaterials,
  manageSupplierMaterial,
  fetchSupplierDocuments,
  uploadSupplierDocument,
  archiveSupplierDocument,
  fetchSupplierQualificationHistory,
  updateSupplierQualification,
} from '@/services/supplierService';
import {
  Supplier,
  SupplierAddress,
  SupplierContact,
  SupplierDocument,
  SupplierMaterial,
  SupplierQualificationHistory,
  SupplierQualificationStatus,
  SupplierType,
} from '@/types/database.types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Building2,
  ArrowLeft,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Edit,
  PowerOff,
  Power,
  Trash2,
  Users,
  MapPin,
  Boxes,
  FileText,
  ShieldCheck,
  History,
  Plus,
  ExternalLink,
  CheckCircle2,
  Clock,
  Archive,
  Phone,
  Mail,
  Globe,
} from 'lucide-react';
import { formatDateIST } from '@/lib/formatters';

export function SupplierDetailPage() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'contacts' | 'addresses' | 'materials' | 'documents' | 'qualification' | 'audit'
  >('overview');

  // Sub-entity data
  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [addresses, setAddresses] = useState<SupplierAddress[]>([]);
  const [materials, setMaterials] = useState<SupplierMaterial[]>([]);
  const [availableMaterials, setAvailableMaterials] = useState<any[]>([]);
  const [documents, setDocuments] = useState<SupplierDocument[]>([]);
  const [qualHistory, setQualHistory] = useState<SupplierQualificationHistory[]>([]);
  const [depCounts, setDepCounts] = useState<{ total: number; contacts: number; addresses: number; materials: number; documents: number; qualificationHistory: number }>({
    total: 0,
    contacts: 0,
    addresses: 0,
    materials: 0,
    documents: 0,
    qualificationHistory: 0,
  });

  // Modal States
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusReason, setStatusReason] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Contact Modal
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactFullName, setContactFullName] = useState('');
  const [contactJobTitle, setContactJobTitle] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactType, setContactType] = useState('PRIMARY');
  const [contactIsPrimary, setContactIsPrimary] = useState(false);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  // Address Modal
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addrType, setAddrType] = useState('REGISTERED');
  const [addrLine1, setAddrLine1] = useState('');
  const [addrLine2, setAddrLine2] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrPostalCode, setAddrPostalCode] = useState('');
  const [addrCountry, setAddrCountry] = useState('India');
  const [addrIsPrimary, setAddrIsPrimary] = useState(false);
  const [addressSubmitting, setAddressSubmitting] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);

  // Material Association Modal
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [selectedMatId, setSelectedMatId] = useState('');
  const [supplierPartNum, setSupplierPartNum] = useState('');
  const [supplierMatDesc, setSupplierMatDesc] = useState('');
  const [specGrade, setSpecGrade] = useState('');
  const [moq, setMoq] = useState<string>('');
  const [leadTime, setLeadTime] = useState<string>('');
  const [materialSubmitting, setMaterialSubmitting] = useState(false);
  const [materialError, setMaterialError] = useState<string | null>(null);

  // Document Upload Modal
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docType, setDocType] = useState('QUALITY_CERTIFICATION');
  const [docName, setDocName] = useState('');
  const [docFileKey, setDocFileKey] = useState('');
  const [docIssueDate, setDocIssueDate] = useState('');
  const [docExpiryDate, setDocExpiryDate] = useState('');
  const [docNotes, setDocNotes] = useState('');
  const [docSubmitting, setDocSubmitting] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  // Qualification Update Modal
  const [qualModalOpen, setQualModalOpen] = useState(false);
  const [newQualStatus, setNewQualStatus] = useState<SupplierQualificationStatus>('QUALIFIED');
  const [qualStartDate, setQualStartDate] = useState('');
  const [qualExpiryDate, setQualExpiryDate] = useState('');
  const [qualReviewNotes, setQualReviewNotes] = useState('');
  const [qualSubmitting, setQualSubmitting] = useState(false);
  const [qualError, setQualError] = useState<string | null>(null);

  // Permissions
  const canUpdate = hasPermission('suppliers.update');
  const canDeactivate = hasPermission('suppliers.deactivate');
  const canReactivate = hasPermission('suppliers.reactivate');
  const canDelete = hasPermission('suppliers.delete');
  const canManageContacts = hasPermission('supplier_contacts.manage');
  const canManageAddresses = hasPermission('supplier_addresses.manage');
  const canManageMaterials = hasPermission('supplier_materials.manage');
  const canUploadDocs = hasPermission('supplier_documents.upload');
  const canArchiveDocs = hasPermission('supplier_documents.archive');
  const canUpdateQual = hasPermission('supplier_qualification.update');

  const loadAll = async () => {
    if (!supplierId) return;
    try {
      setLoading(true);
      setErrorMsg(null);

      const [sRes, cRes, aRes, mRes, dRes, qRes, deps] = await Promise.all([
        fetchSupplierById(supplierId),
        fetchSupplierContacts(supplierId),
        fetchSupplierAddresses(supplierId),
        fetchSupplierMaterials(supplierId),
        fetchSupplierDocuments(supplierId),
        fetchSupplierQualificationHistory(supplierId),
        checkSupplierDependencyCounts(supplierId),
      ]);

      if (sRes.error || !sRes.data) {
        setErrorMsg(sRes.error || 'Supplier record not found.');
      } else {
        setSupplier(sRes.data);
      }

      setContacts(cRes.data);
      setAddresses(aRes.data);
      setMaterials(mRes.data);
      setDocuments(dRes.data);
      setQualHistory(qRes.data);
      setDepCounts(deps);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load supplier details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [supplierId]);

  // Open Material Association Modal
  const handleOpenMaterialModal = async () => {
    if (!supplierId) return;
    setMaterialError(null);
    setSelectedMatId('');
    setSupplierPartNum('');
    setSupplierMatDesc('');
    setSpecGrade('');
    setMoq('');
    setLeadTime('');
    setMaterialModalOpen(true);

    const res = await fetchAvailableMaterials(supplierId);
    setAvailableMaterials(res.data);
  };

  // Submit Contact
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !contactFullName.trim()) return;

    try {
      setContactSubmitting(true);
      setContactError(null);

      const res = await manageSupplierContact(supplierId, {
        full_name: contactFullName.trim(),
        job_title: contactJobTitle.trim() || undefined,
        email: contactEmail.trim() || undefined,
        phone: contactPhone.trim() || undefined,
        contact_type: contactType,
        is_primary: contactIsPrimary,
        is_active: true,
      });

      if (!res.success) throw new Error(res.error || 'Failed to save contact.');

      setContactModalOpen(false);
      const cRes = await fetchSupplierContacts(supplierId);
      setContacts(cRes.data);
    } catch (err: any) {
      setContactError(err?.message || 'Failed to create contact.');
    } finally {
      setContactSubmitting(false);
    }
  };

  // Submit Address
  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !addrLine1.trim() || !addrCity.trim() || !addrState.trim() || !addrPostalCode.trim()) return;

    try {
      setAddressSubmitting(true);
      setAddressError(null);

      const res = await manageSupplierAddress(supplierId, {
        address_type: addrType,
        address_line1: addrLine1.trim(),
        address_line2: addrLine2.trim() || undefined,
        city: addrCity.trim(),
        state_province: addrState.trim(),
        postal_code: addrPostalCode.trim(),
        country: addrCountry.trim() || 'India',
        is_primary: addrIsPrimary,
        is_active: true,
      });

      if (!res.success) throw new Error(res.error || 'Failed to save address.');

      setAddressModalOpen(false);
      const aRes = await fetchSupplierAddresses(supplierId);
      setAddresses(aRes.data);
    } catch (err: any) {
      setAddressError(err?.message || 'Failed to create address.');
    } finally {
      setAddressSubmitting(false);
    }
  };

  // Submit Material Association
  const handleMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !selectedMatId) return;

    const parsedMoq = moq.trim() ? parseFloat(moq) : null;
    const parsedLead = leadTime.trim() ? parseInt(leadTime, 10) : null;

    if (parsedMoq !== null && parsedMoq <= 0) {
      setMaterialError('Minimum Order Quantity must be greater than zero.');
      return;
    }
    if (parsedLead !== null && parsedLead < 0) {
      setMaterialError('Lead time in days must be a non-negative integer.');
      return;
    }

    try {
      setMaterialSubmitting(true);
      setMaterialError(null);

      const res = await manageSupplierMaterial(supplierId, {
        material_id: selectedMatId,
        supplier_part_number: supplierPartNum.trim() || undefined,
        supplier_material_description: supplierMatDesc.trim() || undefined,
        specification_grade: specGrade.trim() || undefined,
        minimum_order_quantity: parsedMoq,
        lead_time_days: parsedLead,
        status: 'ACTIVE',
      });

      if (!res.success) throw new Error(res.error || 'Failed to save material association.');

      setMaterialModalOpen(false);
      const mRes = await fetchSupplierMaterials(supplierId);
      setMaterials(mRes.data);
    } catch (err: any) {
      setMaterialError(err?.message || 'Failed to associate material.');
    } finally {
      setMaterialSubmitting(false);
    }
  };

  // Submit Document
  const handleDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !docName.trim() || !docFileKey.trim()) return;

    try {
      setDocSubmitting(true);
      setDocError(null);

      const res = await uploadSupplierDocument(supplierId, {
        document_type: docType,
        document_name: docName.trim(),
        file_key: docFileKey.trim(),
        issue_date: docIssueDate || undefined,
        expiry_date: docExpiryDate || undefined,
        notes: docNotes.trim() || undefined,
      });

      if (!res.success) throw new Error(res.error || 'Failed to upload document.');

      setDocModalOpen(false);
      const dRes = await fetchSupplierDocuments(supplierId);
      setDocuments(dRes.data);
    } catch (err: any) {
      setDocError(err?.message || 'Failed to upload document.');
    } finally {
      setDocSubmitting(false);
    }
  };

  // Submit Qualification Update
  const handleQualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) return;

    if ((newQualStatus === 'NOT_QUALIFIED' || newQualStatus === 'EXPIRED') && !qualReviewNotes.trim()) {
      setQualError(`Review note/reason is mandatory when setting qualification to ${newQualStatus}.`);
      return;
    }

    try {
      setQualSubmitting(true);
      setQualError(null);

      const res = await updateSupplierQualification(supplierId, {
        new_status: newQualStatus,
        review_notes: qualReviewNotes.trim(),
        qualification_start_date: qualStartDate || undefined,
        qualification_expiry_date: qualExpiryDate || undefined,
      });

      if (!res.success) throw new Error(res.error || 'Failed to update qualification status.');

      setQualModalOpen(false);
      loadAll();
    } catch (err: any) {
      setQualError(err?.message || 'Failed to update qualification.');
    } finally {
      setQualSubmitting(false);
    }
  };

  // Status Deactivation / Reactivation Handler
  const handleStatusToggle = async () => {
    if (!supplierId || !supplier || !statusReason.trim()) return;

    try {
      setStatusSubmitting(true);

      if (supplier.supplier_status === 'ACTIVE') {
        const res = await deactivateSupplier(supplierId, statusReason.trim());
        if (!res.success) throw new Error(res.error || 'Failed to deactivate.');
      } else {
        const res = await reactivateSupplier(supplierId, statusReason.trim());
        if (!res.success) throw new Error(res.error || 'Failed to reactivate.');
      }

      setStatusModalOpen(false);
      loadAll();
    } catch (err: any) {
      alert(err?.message || 'Failed to change status.');
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Delete Handler
  const handleDeleteSupplier = async () => {
    if (!supplierId) return;
    try {
      setDeleteSubmitting(true);
      setDeleteError(null);

      const res = await deleteSupplier(supplierId);
      if (!res.success) {
        setDeleteError(res.error || 'Failed to delete supplier.');
        return;
      }

      navigate('/app/suppliers');
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete supplier.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-[#5E6B61]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0B3B2E] mb-2" />
        <p className="text-sm">Loading supplier master record...</p>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-[#B85C1E] mx-auto" />
        <h2 className="text-lg font-bold text-[#182820]">Supplier Record Not Found</h2>
        <p className="text-sm text-[#5E6B61]">{errorMsg || 'The requested supplier record does not exist.'}</p>
        <Button onClick={() => navigate('/app/suppliers')} variant="outline" className="border-[#DEDCCF]">
          Return to Supplier Directory
        </Button>
      </div>
    );
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const isQualificationOverdue =
    supplier.qualification_expiry_date && supplier.qualification_expiry_date < todayStr;

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-[#5E6B61]">
        <Link to="/app/suppliers" className="hover:text-[#0B3B2E] flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Supplier Directory
        </Link>
        <span>/</span>
        <span className="font-mono text-[#0B3B2E]">{supplier.supplier_code}</span>
        <span>/</span>
        <span className="text-[#182820] font-medium">{supplier.legal_name}</span>
      </div>

      {/* Overdue Qualification Alert Banner */}
      {isQualificationOverdue && (
        <div className="p-4 rounded-lg bg-[#F8E8D5] border border-[#B85C1E] text-[#B85C1E] flex items-start gap-3 shadow-xs">
          <Clock className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-bold">Qualification Overdue: </span>
            This supplier’s qualification expired on {formatDateIST(supplier.qualification_expiry_date!)}. A renewed review is required to verify quality accreditation.
          </div>
        </div>
      )}

      {/* Supplier Master Hero Header */}
      <div className="bg-[#FFFEFA] border border-[#DEDCCF] rounded-lg p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#DEDCCF]/70 pb-5">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#E8EEDD] flex items-center justify-center text-[#0B3B2E] shrink-0 mt-1">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-bold text-sm bg-[#E8EEDD] text-[#0B3B2E] px-2 py-0.5 rounded">
                  {supplier.supplier_code}
                </span>
                <Badge variant="outline">{supplier.supplier_type}</Badge>
                {supplier.supplier_status === 'ACTIVE' ? (
                  <Badge variant="success">ACTIVE</Badge>
                ) : (
                  <Badge variant="destructive">INACTIVE</Badge>
                )}
                {supplier.qualification_status === 'QUALIFIED' ? (
                  <Badge variant="success">QUALIFIED</Badge>
                ) : supplier.qualification_status === 'IN_PROGRESS' ? (
                  <Badge variant="secondary">IN PROGRESS</Badge>
                ) : supplier.qualification_status === 'EXPIRED' ? (
                  <Badge variant="destructive">EXPIRED</Badge>
                ) : supplier.qualification_status === 'NOT_QUALIFIED' ? (
                  <Badge variant="destructive">NOT QUALIFIED</Badge>
                ) : (
                  <Badge variant="outline">NOT STARTED</Badge>
                )}
              </div>
              <h1 className="text-2xl font-bold text-[#182820] mt-1.5">{supplier.legal_name}</h1>
              {supplier.display_name && supplier.display_name !== supplier.legal_name && (
                <p className="text-sm text-[#5E6B61] mt-0.5">Trade Name: {supplier.display_name}</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {canUpdate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/app/suppliers/${supplier.id}/edit`)}
                className="border-[#DEDCCF] text-[#182820] hover:bg-[#F7F3EA]"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}

            {supplier.supplier_status === 'ACTIVE' && canDeactivate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusReason('');
                  setStatusModalOpen(true);
                }}
                className="border-[#B85C1E] text-[#B85C1E] hover:bg-[#F8E8D5]"
              >
                <PowerOff className="w-4 h-4 mr-2" />
                Deactivate
              </Button>
            )}

            {supplier.supplier_status === 'INACTIVE' && canReactivate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusReason('');
                  setStatusModalOpen(true);
                }}
                className="border-[#0B3B2E] text-[#0B3B2E] hover:bg-[#E8EEDD]"
              >
                <Power className="w-4 h-4 mr-2" />
                Reactivate
              </Button>
            )}

            {canDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteModalOpen(true);
                }}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* Quick Contact & Tax Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-[#5E6B61]">
          <div>
            <span className="font-semibold text-[#182820] block">Tax / GST ID:</span>
            <span className="font-mono text-sm text-[#182820]">
              {supplier.tax_identifier || supplier.gstin || '—'}
            </span>
          </div>
          <div>
            <span className="font-semibold text-[#182820] block">General Email:</span>
            <span className="text-[#182820] truncate block">
              {supplier.general_email || supplier.email || '—'}
            </span>
          </div>
          <div>
            <span className="font-semibold text-[#182820] block">Phone:</span>
            <span className="text-[#182820]">{supplier.general_phone || supplier.phone || '—'}</span>
          </div>
          <div>
            <span className="font-semibold text-[#182820] block">Website:</span>
            {supplier.website ? (
              <a
                href={supplier.website}
                target="_blank"
                rel="noreferrer"
                className="text-[#0B3B2E] hover:underline flex items-center gap-1"
              >
                {supplier.website.replace(/^https?:\/\//, '')}
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              '—'
            )}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-[#DEDCCF] gap-2 overflow-x-auto text-sm font-medium">
        {[
          { key: 'overview', label: 'Overview', icon: Building2 },
          { key: 'contacts', label: `Contacts (${contacts.length})`, icon: Users },
          { key: 'addresses', label: `Addresses (${addresses.length})`, icon: MapPin },
          { key: 'materials', label: `Materials (${materials.length})`, icon: Boxes },
          { key: 'documents', label: `Documents (${documents.length})`, icon: FileText },
          { key: 'qualification', label: 'Qualification', icon: ShieldCheck },
          { key: 'audit', label: 'Audit History', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-[#0B3B2E] text-[#0B3B2E] font-semibold bg-[#FFFEFA]'
                  : 'border-transparent text-[#5E6B61] hover:text-[#182820] hover:border-[#DEDCCF]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT */}

      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-[#FFFEFA] border-[#DEDCCF]">
            <CardHeader className="pb-3 border-b border-[#DEDCCF]">
              <CardTitle className="text-base font-bold text-[#182820]">Registration & Entity Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#DEDCCF]/40">
                <span className="text-[#5E6B61]">Supplier Code</span>
                <span className="font-mono font-semibold text-[#0B3B2E]">{supplier.supplier_code}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#DEDCCF]/40">
                <span className="text-[#5E6B61]">Legal Entity Name</span>
                <span className="font-semibold text-[#182820]">{supplier.legal_name}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#DEDCCF]/40">
                <span className="text-[#5E6B61]">Trade Name</span>
                <span className="text-[#182820]">{supplier.display_name || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#DEDCCF]/40">
                <span className="text-[#5E6B61]">Classification</span>
                <span className="text-[#182820]">{supplier.supplier_type}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#DEDCCF]/40">
                <span className="text-[#5E6B61]">Tax / GST Number</span>
                <span className="font-mono text-[#182820]">{supplier.tax_identifier || supplier.gstin || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#DEDCCF]/40">
                <span className="text-[#5E6B61]">Registered Address</span>
                <span className="text-[#182820] text-right max-w-xs">{supplier.registered_address || '—'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#DEDCCF]/40">
                <span className="text-[#5E6B61]">Created At</span>
                <span className="text-[#182820]">{formatDateIST(supplier.created_at)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#5E6B61]">Last Updated At</span>
                <span className="text-[#182820]">{formatDateIST(supplier.updated_at)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#FFFEFA] border-[#DEDCCF]">
            <CardHeader className="pb-3 border-b border-[#DEDCCF]">
              <CardTitle className="text-base font-bold text-[#182820]">Operational & Deactivation State</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-xs">
              <div className="flex justify-between py-1.5 border-b border-[#DEDCCF]/40">
                <span className="text-[#5E6B61]">Supplier Status</span>
                {supplier.supplier_status === 'ACTIVE' ? (
                  <Badge variant="success">ACTIVE</Badge>
                ) : (
                  <Badge variant="destructive">INACTIVE</Badge>
                )}
              </div>
              {supplier.supplier_status === 'INACTIVE' && (
                <div className="p-3 rounded-md bg-[#F8E8D5] border border-[#B85C1E] text-[#B85C1E] space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <PowerOff className="w-4 h-4" />
                    Deactivation Recorded
                  </div>
                  <div className="text-xs">
                    <strong>Reason:</strong> {supplier.deactivation_reason || 'No reason specified'}
                  </div>
                  {supplier.deactivated_at && (
                    <div className="text-xs text-[#5E6B61]">
                      Deactivated at: {formatDateIST(supplier.deactivated_at)}
                    </div>
                  )}
                </div>
              )}
              {supplier.reactivation_reason && (
                <div className="p-3 rounded-md bg-[#E8EEDD] border border-[#A9BE98] text-[#0B3B2E] space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Last Reactivation Log
                  </div>
                  <div className="text-xs">
                    <strong>Reason:</strong> {supplier.reactivation_reason}
                  </div>
                  {supplier.reactivated_at && (
                    <div className="text-xs text-[#5E6B61]">
                      Reactivated at: {formatDateIST(supplier.reactivated_at)}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2">
                <div className="text-xs font-bold text-[#182820] mb-2">Associated Entity Counts:</div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2.5 bg-[#F7F3EA] rounded-md border border-[#DEDCCF]">
                    <div className="text-lg font-bold text-[#0B3B2E]">{depCounts.contacts}</div>
                    <div className="text-xs text-[#5E6B61]">Contacts</div>
                  </div>
                  <div className="p-2.5 bg-[#F7F3EA] rounded-md border border-[#DEDCCF]">
                    <div className="text-lg font-bold text-[#0B3B2E]">{depCounts.addresses}</div>
                    <div className="text-xs text-[#5E6B61]">Addresses</div>
                  </div>
                  <div className="p-2.5 bg-[#F7F3EA] rounded-md border border-[#DEDCCF]">
                    <div className="text-lg font-bold text-[#0B3B2E]">{depCounts.materials}</div>
                    <div className="text-xs text-[#5E6B61]">Material Links</div>
                  </div>
                  <div className="p-2.5 bg-[#F7F3EA] rounded-md border border-[#DEDCCF]">
                    <div className="text-lg font-bold text-[#0B3B2E]">{depCounts.documents}</div>
                    <div className="text-xs text-[#5E6B61]">Documents</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2. CONTACTS TAB */}
      {activeTab === 'contacts' && (
        <Card className="bg-[#FFFEFA] border-[#DEDCCF]">
          <CardHeader className="flex flex-row justify-between items-center pb-3 border-b border-[#DEDCCF]">
            <div>
              <CardTitle className="text-base font-bold text-[#182820]">Supplier Contacts</CardTitle>
              <CardDescription className="text-xs text-[#5E6B61]">
                Manage supplier representatives. Exactly one active primary contact is enforced per supplier.
              </CardDescription>
            </div>
            {canManageContacts && (
              <Button
                size="sm"
                onClick={() => {
                  setContactError(null);
                  setContactFullName('');
                  setContactJobTitle('');
                  setContactEmail('');
                  setContactPhone('');
                  setContactType('PRIMARY');
                  setContactIsPrimary(contacts.length === 0);
                  setContactModalOpen(true);
                }}
                className="bg-[#0B3B2E] hover:bg-[#082D24] text-[#FFFEFA]"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Contact
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {contacts.length === 0 ? (
              <div className="p-10 text-center text-[#5E6B61]">
                <Users className="w-10 h-10 text-[#A9BE98] mx-auto mb-2" />
                <p className="text-sm">No contacts registered for this supplier.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-[#F7F3EA] border-b border-[#DEDCCF]">
                  <TableRow>
                    <TableHead className="text-[#182820] font-semibold">Name & Title</TableHead>
                    <TableHead className="text-[#182820] font-semibold">Role / Type</TableHead>
                    <TableHead className="text-[#182820] font-semibold">Email</TableHead>
                    <TableHead className="text-[#182820] font-semibold">Phone</TableHead>
                    <TableHead className="text-[#182820] font-semibold">Primary Flag</TableHead>
                    <TableHead className="text-[#182820] font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-[#DEDCCF]">
                  {contacts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-semibold text-[#182820]">{c.full_name || c.name}</div>
                        {c.job_title && <div className="text-xs text-[#5E6B61]">{c.job_title}</div>}
                      </TableCell>
                      <TableCell className="text-xs text-[#182820]">{c.contact_type}</TableCell>
                      <TableCell className="text-xs text-[#5E6B61]">{c.email || '—'}</TableCell>
                      <TableCell className="text-xs text-[#5E6B61]">{c.phone || c.mobile || '—'}</TableCell>
                      <TableCell>
                        {c.is_primary ? (
                          <Badge variant="success">PRIMARY CONTACT</Badge>
                        ) : (
                          <span className="text-xs text-[#5E6B61]">Secondary</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.is_active ? (
                          <Badge variant="outline">ACTIVE</Badge>
                        ) : (
                          <Badge variant="secondary">INACTIVE</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* 3. ADDRESSES TAB */}
      {activeTab === 'addresses' && (
        <Card className="bg-[#FFFEFA] border-[#DEDCCF]">
          <CardHeader className="flex flex-row justify-between items-center pb-3 border-b border-[#DEDCCF]">
            <div>
              <CardTitle className="text-base font-bold text-[#182820]">Supplier Addresses & Sites</CardTitle>
              <CardDescription className="text-xs text-[#5E6B61]">
                Registered offices, manufacturing facilities, and warehouses. One active primary address allowed per address type.
              </CardDescription>
            </div>
            {canManageAddresses && (
              <Button
                size="sm"
                onClick={() => {
                  setAddressError(null);
                  setAddrType('REGISTERED');
                  setAddrLine1('');
                  setAddrLine2('');
                  setAddrCity('');
                  setAddrState('');
                  setAddrPostalCode('');
                  setAddrCountry('India');
                  setAddrIsPrimary(false);
                  setAddressModalOpen(true);
                }}
                className="bg-[#0B3B2E] hover:bg-[#082D24] text-[#FFFEFA]"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Address
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {addresses.length === 0 ? (
              <div className="p-10 text-center text-[#5E6B61]">
                <MapPin className="w-10 h-10 text-[#A9BE98] mx-auto mb-2" />
                <p className="text-sm">No structured addresses registered yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-[#F7F3EA] border-b border-[#DEDCCF]">
                  <TableRow>
                    <TableHead className="text-[#182820] font-semibold">Type</TableHead>
                    <TableHead className="text-[#182820] font-semibold">Address Lines</TableHead>
                    <TableHead className="text-[#182820] font-semibold">City & State</TableHead>
                    <TableHead className="text-[#182820] font-semibold">Postal Code</TableHead>
                    <TableHead className="text-[#182820] font-semibold">Country</TableHead>
                    <TableHead className="text-[#182820] font-semibold">Primary Flag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-[#DEDCCF]">
                  {addresses.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-semibold text-xs text-[#0B3B2E]">{a.address_type}</TableCell>
                      <TableCell className="text-xs text-[#182820]">
                        <div>{a.address_line1}</div>
                        {a.address_line2 && <div className="text-[#5E6B61]">{a.address_line2}</div>}
                      </TableCell>
                      <TableCell className="text-xs text-[#182820]">
                        {a.city}, {a.state_province}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[#5E6B61]">{a.postal_code}</TableCell>
                      <TableCell className="text-xs text-[#182820]">{a.country}</TableCell>
                      <TableCell>
                        {a.is_primary ? (
                          <Badge variant="success">PRIMARY FOR TYPE</Badge>
                        ) : (
                          <span className="text-xs text-[#5E6B61]">Secondary</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* 4. MATERIALS TAB */}
      {activeTab === 'materials' && (
        <Card className="bg-[#FFFEFA] border-[#DEDCCF]">
          <CardHeader className="flex flex-row justify-between items-center pb-3 border-b border-[#DEDCCF]">
            <div>
              <CardTitle className="text-base font-bold text-[#182820]">Supplier-Material Catalog Links</CardTitle>
              <CardDescription className="text-xs text-[#5E6B61]">
                Materials associated from the Phase 5 Material Catalog with MOQ, lead times, and specifications.
              </CardDescription>
            </div>
            {canManageMaterials && (
              <Button
                size="sm"
                onClick={handleOpenMaterialModal}
                disabled={supplier.supplier_status === 'INACTIVE'}
                className="bg-[#0B3B2E] hover:bg-[#082D24] text-[#FFFEFA]"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Associate Material
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {supplier.supplier_status === 'INACTIVE' && (
              <div className="p-3 bg-[#F8E8D5] border-b border-[#B85C1E] text-[#B85C1E] text-xs font-medium">
                Note: This supplier is inactive. Creating new material associations is restricted until reactivated.
              </div>
            )}
            {materials.length === 0 ? (
              <div className="p-10 text-center text-[#5E6B61]">
                <Boxes className="w-10 h-10 text-[#A9BE98] mx-auto mb-2" />
                <p className="text-sm">No materials linked to this supplier yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-[#F7F3EA] border-b border-[#DEDCCF]">
                  <TableRow>
                    <TableHead className="text-[#182820] font-semibold">Material Code & Name</TableHead>
                    <TableHead className="text-[#182820] font-semibold">Category / UOM</TableHead>
                    <TableHead className="text-[#182820] font-semibold">Supplier Ref / Part #</TableHead>
                    <TableHead className="text-[#182820] font-semibold">Grade / Spec</TableHead>
                    <TableHead className="text-[#182820] font-semibold">MOQ</TableHead>
                    <TableHead className="text-[#182820] font-semibold">Lead Time (Days)</TableHead>
                    <TableHead className="text-[#182820] font-semibold">Association Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-[#DEDCCF]">
                  {materials.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="font-mono text-xs font-semibold text-[#0B3B2E]">
                          {m.material?.material_code || 'MAT'}
                        </div>
                        <div className="text-sm font-medium text-[#182820]">{m.material?.name || 'Material Item'}</div>
                      </TableCell>
                      <TableCell className="text-xs text-[#5E6B61]">
                        {m.material?.category || '—'} / {m.material?.uom || '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[#182820]">
                        {m.supplier_part_number || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-[#5E6B61]">{m.specification_grade || '—'}</TableCell>
                      <TableCell className="font-mono text-xs text-[#182820]">
                        {m.minimum_order_quantity !== null && m.minimum_order_quantity !== undefined
                          ? m.minimum_order_quantity
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-[#182820]">
                        {m.lead_time_days !== null && m.lead_time_days !== undefined
                          ? `${m.lead_time_days} days`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {m.status === 'ACTIVE' ? (
                          <Badge variant="success">ACTIVE</Badge>
                        ) : (
                          <Badge variant="secondary">INACTIVE</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* 5. DOCUMENTS TAB */}
      {activeTab === 'documents' && (
        <Card className="bg-[#FFFEFA] border-[#DEDCCF]">
          <CardHeader className="flex flex-row justify-between items-center pb-3 border-b border-[#DEDCCF]">
            <div>
              <CardTitle className="text-base font-bold text-[#182820]">Supplier Compliance & Quality Documents</CardTitle>
              <CardDescription className="text-xs text-[#5E6B61]">
                Confidential certifications, registration files, and tax records with automatic expiry tracking.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/app/documents?supplierId=${supplier.id}`)}
                className="border-divider text-xs text-forest hover:bg-forest/10"
              >
                <FileText className="w-3.5 h-3.5 mr-1.5 text-forest" />
                Open Central Repository
              </Button>
              {canUploadDocs && (
                <Button
                  size="sm"
                  onClick={() => {
                    setDocError(null);
                    setDocType('QUALITY_CERTIFICATION');
                    setDocName('');
                    setDocFileKey('');
                    setDocIssueDate('');
                    setDocExpiryDate('');
                    setDocNotes('');
                    setDocModalOpen(true);
                  }}
                  className="bg-[#0B3B2E] hover:bg-[#082D24] text-[#FFFEFA]"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Upload Document
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {documents.length === 0 ? (
              <div className="p-10 text-center text-[#5E6B61]">
                <FileText className="w-10 h-10 text-[#A9BE98] mx-auto mb-2" />
                <p className="text-sm">No compliance documents attached.</p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-[#F7F3EA] border-b border-[#DEDCCF]">
                  <TableRow>
                    <TableHead className="text-[#182820] font-semibold">Document Name</TableHead>
                    <TableHead className="text-[#182820] font-semibold">Document Type</TableHead>
                    <TableHead className="text-[#182820] font-semibold">Issue Date</TableHead>
                    <TableHead className="text-[#182820] font-semibold">Expiry Date</TableHead>
                    <TableHead className="text-[#182820] font-semibold">Status</TableHead>
                    <TableHead className="text-[#182820] font-semibold">Uploaded</TableHead>
                    <TableHead className="text-[#182820] font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-[#DEDCCF]">
                  {documents.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="font-semibold text-sm text-[#182820]">{d.document_name}</div>
                        {d.notes && <div className="text-xs text-[#5E6B61]">{d.notes}</div>}
                      </TableCell>
                      <TableCell className="text-xs text-[#0B3B2E] font-medium">{d.document_type}</TableCell>
                      <TableCell className="text-xs text-[#5E6B61]">
                        {d.issue_date ? formatDateIST(d.issue_date) : '—'}
                      </TableCell>
                      <TableCell className="text-xs font-semibold">
                        {d.expiry_date ? (
                          <span className={d.status === 'EXPIRED' ? 'text-[#B85C1E]' : 'text-[#182820]'}>
                            {formatDateIST(d.expiry_date)}
                          </span>
                        ) : (
                          'No Expiry'
                        )}
                      </TableCell>
                      <TableCell>
                        {d.status === 'ACTIVE' ? (
                          <Badge variant="success">VALID</Badge>
                        ) : d.status === 'EXPIRED' ? (
                          <Badge variant="destructive">EXPIRED</Badge>
                        ) : (
                          <Badge variant="secondary">ARCHIVED</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-[#5E6B61]">{formatDateIST(d.uploaded_at)}</TableCell>
                      <TableCell className="text-right">
                        {d.status !== 'ARCHIVED' && canArchiveDocs && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              const reason = prompt('Reason for archiving this document?');
                              if (reason !== null) {
                                await archiveSupplierDocument(d.id, reason);
                                const dRes = await fetchSupplierDocuments(supplier.id);
                                setDocuments(dRes.data);
                              }
                            }}
                            className="h-8 text-xs text-[#5E6B61] hover:text-[#B85C1E]"
                          >
                            <Archive className="w-3.5 h-3.5 mr-1" />
                            Archive
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* 6. QUALIFICATION TAB */}
      {activeTab === 'qualification' && (
        <div className="space-y-6">
          <Card className="bg-[#FFFEFA] border-[#DEDCCF]">
            <CardHeader className="flex flex-row justify-between items-center pb-3 border-b border-[#DEDCCF]">
              <div>
                <CardTitle className="text-base font-bold text-[#182820]">Qualification Status & Accreditation</CardTitle>
                <CardDescription className="text-xs text-[#5E6B61]">
                  Independent qualification lifecycle. Updating to NOT_QUALIFIED or EXPIRED requires mandatory review notes.
                </CardDescription>
              </div>
              {canUpdateQual && (
                <Button
                  size="sm"
                  onClick={() => {
                    setQualError(null);
                    setNewQualStatus(supplier.qualification_status);
                    setQualStartDate(supplier.qualification_start_date || '');
                    setQualExpiryDate(supplier.qualification_expiry_date || '');
                    setQualReviewNotes('');
                    setQualModalOpen(true);
                  }}
                  className="bg-[#0B3B2E] hover:bg-[#082D24] text-[#FFFEFA]"
                >
                  <ShieldCheck className="w-4 h-4 mr-1.5" />
                  Update Qualification
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-lg bg-[#F7F3EA] border border-[#DEDCCF]">
                <div>
                  <span className="text-xs text-[#5E6B61] block">Current Status:</span>
                  <div className="mt-1">
                    {supplier.qualification_status === 'QUALIFIED' ? (
                      <Badge variant="success">QUALIFIED</Badge>
                    ) : supplier.qualification_status === 'IN_PROGRESS' ? (
                      <Badge variant="secondary">IN PROGRESS</Badge>
                    ) : supplier.qualification_status === 'EXPIRED' ? (
                      <Badge variant="destructive">EXPIRED</Badge>
                    ) : supplier.qualification_status === 'NOT_QUALIFIED' ? (
                      <Badge variant="destructive">NOT QUALIFIED</Badge>
                    ) : (
                      <Badge variant="outline">NOT STARTED</Badge>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-xs text-[#5E6B61] block">Qualification Start Date:</span>
                  <span className="text-sm font-semibold text-[#182820]">
                    {supplier.qualification_start_date ? formatDateIST(supplier.qualification_start_date) : '—'}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-[#5E6B61] block">Accreditation Expiry:</span>
                  <span className={`text-sm font-semibold ${isQualificationOverdue ? 'text-[#B85C1E]' : 'text-[#182820]'}`}>
                    {supplier.qualification_expiry_date ? formatDateIST(supplier.qualification_expiry_date) : '—'}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-[#5E6B61] block">Last Reviewed Date:</span>
                  <span className="text-sm font-semibold text-[#182820]">
                    {supplier.last_reviewed_date ? formatDateIST(supplier.last_reviewed_date) : '—'}
                  </span>
                </div>
              </div>

              {supplier.review_notes && (
                <div className="p-3 bg-[#FFFEFA] border border-[#DEDCCF] rounded-md text-xs">
                  <span className="font-semibold text-[#182820] block mb-1">Latest Reviewer Notes:</span>
                  <p className="text-[#5E6B61]">{supplier.review_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Qualification History Log */}
          <Card className="bg-[#FFFEFA] border-[#DEDCCF]">
            <CardHeader className="pb-3 border-b border-[#DEDCCF]">
              <CardTitle className="text-base font-bold text-[#182820]">Qualification Transition History</CardTitle>
              <CardDescription className="text-xs text-[#5E6B61]">
                Immutable historical record of all qualification status evaluations.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {qualHistory.length === 0 ? (
                <div className="p-6 text-center text-[#5E6B61] text-xs">
                  No historical status transitions recorded.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-[#F7F3EA] border-b border-[#DEDCCF]">
                    <TableRow>
                      <TableHead className="text-[#182820] font-semibold">Transition</TableHead>
                      <TableHead className="text-[#182820] font-semibold">Mandatory Reason / Notes</TableHead>
                      <TableHead className="text-[#182820] font-semibold">Evaluated At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-[#DEDCCF]">
                    {qualHistory.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-xs">
                          <span className="text-[#5E6B61]">{h.previous_status || 'INITIAL'}</span>
                          <span className="mx-2 font-bold text-[#0B3B2E]">→</span>
                          <span className="font-bold text-[#182820]">{h.new_status}</span>
                        </TableCell>
                        <TableCell className="text-xs text-[#182820]">{h.reason}</TableCell>
                        <TableCell className="text-xs text-[#5E6B61]">{formatDateIST(h.changed_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 7. AUDIT HISTORY TAB */}
      {activeTab === 'audit' && (
        <Card className="bg-[#FFFEFA] border-[#DEDCCF]">
          <CardHeader className="pb-3 border-b border-[#DEDCCF]">
            <CardTitle className="text-base font-bold text-[#182820]">Immutable Security Audit Trail</CardTitle>
            <CardDescription className="text-xs text-[#5E6B61]">
              Cryptographically verified audit log events for this vendor record. Ordinary users cannot alter these entries.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 text-center text-[#5E6B61]">
            <p className="text-sm">
              All supplier creation, updates, deactivations, reactivations, document uploads, and qualification changes are logged to the platform security ledger.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/app/admin/audit-log')}
              className="mt-4 border-[#DEDCCF] text-[#0B3B2E]"
            >
              Open Global Audit Log Viewer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* =========================================================================
          MODALS & DIALOGS
         ========================================================================= */}

      {/* Deactivate / Reactivate Modal */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#FFFEFA] border-[#DEDCCF]">
          <DialogHeader>
            <DialogTitle className="text-[#182820]">
              {supplier.supplier_status === 'ACTIVE' ? 'Deactivate Supplier' : 'Reactivate Supplier'}
            </DialogTitle>
            <DialogDescription className="text-[#5E6B61]">
              {supplier.supplier_status === 'ACTIVE'
                ? `Deactivating ${supplier.supplier_code} (${supplier.legal_name}) prevents operational purchase orders and new material associations.`
                : `Reactivating ${supplier.supplier_code} (${supplier.legal_name}) will restore it to active operational status.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="statusReason" className="text-xs font-semibold text-[#182820]">
              Reason for {supplier.supplier_status === 'ACTIVE' ? 'Deactivation' : 'Reactivation'}{' '}
              <span className="text-[#B85C1E]">*</span>
            </Label>
            <textarea
              id="statusReason"
              rows={3}
              placeholder="Mandatory reason for audit trail..."
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              className="w-full p-2.5 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-sm text-[#182820] focus:ring-1 focus:ring-[#0B3B2E]"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setStatusModalOpen(false)} className="border-[#DEDCCF]">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleStatusToggle}
              disabled={statusSubmitting || !statusReason.trim()}
              className={
                supplier.supplier_status === 'ACTIVE'
                  ? 'bg-[#B85C1E] hover:bg-[#9A4B17] text-[#FFFEFA]'
                  : 'bg-[#0B3B2E] hover:bg-[#082D24] text-[#FFFEFA]'
              }
            >
              {statusSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : supplier.supplier_status === 'ACTIVE' ? (
                'Confirm Deactivation'
              ) : (
                'Confirm Reactivation'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal (Permanent deletion safeguard check) */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#FFFEFA] border-[#DEDCCF]">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Delete Supplier Record
            </DialogTitle>
            <DialogDescription className="text-[#5E6B61]">
              Permanent deletion is strictly permitted only if the supplier has zero dependent records and has never been referenced.
            </DialogDescription>
          </DialogHeader>

          {depCounts.total > 0 ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800 space-y-2">
              <span className="font-bold">Permanent deletion is blocked:</span>
              <p>
                This supplier has <strong>{depCounts.total}</strong> dependent records ({depCounts.contacts} contacts, {depCounts.addresses} addresses, {depCounts.materials} material links, {depCounts.documents} documents).
              </p>
              <p className="font-semibold">
                Please use Deactivation instead to preserve data integrity and historical compliance.
              </p>
            </div>
          ) : (
            <p className="text-sm text-[#182820]">
              Are you sure you want to permanently delete supplier <strong>{supplier.supplier_code}</strong>? This action cannot be undone.
            </p>
          )}

          {deleteError && <p className="text-xs text-red-600 font-medium">{deleteError}</p>}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDeleteModalOpen(false)} className="border-[#DEDCCF]">
              Cancel
            </Button>
            {depCounts.total === 0 && (
              <Button
                size="sm"
                onClick={handleDeleteSupplier}
                disabled={deleteSubmitting}
                className="bg-red-700 hover:bg-red-800 text-white"
              >
                {deleteSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Permanently Delete'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contact Modal */}
      <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#FFFEFA] border-[#DEDCCF]">
          <DialogHeader>
            <DialogTitle className="text-[#182820]">Add Supplier Contact</DialogTitle>
            <DialogDescription className="text-xs text-[#5E6B61]">
              Add representative contact details. Setting as primary will automatically demote existing primary contacts.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleContactSubmit} className="space-y-3 py-2">
            {contactError && <p className="text-xs text-[#B85C1E] font-medium">{contactError}</p>}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Full Name *</Label>
              <Input
                value={contactFullName}
                onChange={(e) => setContactFullName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                required
                className="bg-[#F7F3EA] border-[#DEDCCF]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Job Title</Label>
              <Input
                value={contactJobTitle}
                onChange={(e) => setContactJobTitle(e.target.value)}
                placeholder="e.g. Head of Commercial Sales"
                className="bg-[#F7F3EA] border-[#DEDCCF]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Email</Label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contact@supplier.com"
                  className="bg-[#F7F3EA] border-[#DEDCCF]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Phone</Label>
                <Input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="bg-[#F7F3EA] border-[#DEDCCF]"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Contact Type</Label>
              <select
                value={contactType}
                onChange={(e) => setContactType(e.target.value)}
                className="w-full h-9 px-3 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
              >
                <option value="PRIMARY">Primary</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="QUALITY">Quality</option>
                <option value="TECHNICAL">Technical</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="isPrimary"
                checked={contactIsPrimary}
                onChange={(e) => setContactIsPrimary(e.target.checked)}
                className="rounded border-[#DEDCCF] text-[#0B3B2E] focus:ring-[#0B3B2E]"
              />
              <Label htmlFor="isPrimary" className="text-xs font-medium cursor-pointer">
                Designate as Active Primary Contact
              </Label>
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setContactModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={contactSubmitting} className="bg-[#0B3B2E] text-white">
                {contactSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Contact'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Address Modal */}
      <Dialog open={addressModalOpen} onOpenChange={setAddressModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#FFFEFA] border-[#DEDCCF]">
          <DialogHeader>
            <DialogTitle className="text-[#182820]">Add Supplier Address</DialogTitle>
            <DialogDescription className="text-xs text-[#5E6B61]">
              Add physical facility or registered site address.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddressSubmit} className="space-y-3 py-2">
            {addressError && <p className="text-xs text-[#B85C1E] font-medium">{addressError}</p>}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Address Type *</Label>
              <select
                value={addrType}
                onChange={(e) => setAddrType(e.target.value)}
                className="w-full h-9 px-3 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
              >
                <option value="REGISTERED">Registered Corporate Office</option>
                <option value="OFFICE">Operational Office</option>
                <option value="MANUFACTURING_SITE">Manufacturing Plant / Site</option>
                <option value="WAREHOUSE">Warehouse / Logistics Depot</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Address Line 1 *</Label>
              <Input
                value={addrLine1}
                onChange={(e) => setAddrLine1(e.target.value)}
                placeholder="Street address or plot number"
                required
                className="bg-[#F7F3EA] border-[#DEDCCF]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Address Line 2</Label>
              <Input
                value={addrLine2}
                onChange={(e) => setAddrLine2(e.target.value)}
                placeholder="Suite, building, industrial area"
                className="bg-[#F7F3EA] border-[#DEDCCF]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">City *</Label>
                <Input
                  value={addrCity}
                  onChange={(e) => setAddrCity(e.target.value)}
                  placeholder="e.g. Mumbai"
                  required
                  className="bg-[#F7F3EA] border-[#DEDCCF]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">State / Province *</Label>
                <Input
                  value={addrState}
                  onChange={(e) => setAddrState(e.target.value)}
                  placeholder="e.g. Maharashtra"
                  required
                  className="bg-[#F7F3EA] border-[#DEDCCF]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Postal Code *</Label>
                <Input
                  value={addrPostalCode}
                  onChange={(e) => setAddrPostalCode(e.target.value)}
                  placeholder="e.g. 400001"
                  required
                  className="bg-[#F7F3EA] border-[#DEDCCF]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Country *</Label>
                <Input
                  value={addrCountry}
                  onChange={(e) => setAddrCountry(e.target.value)}
                  placeholder="e.g. India"
                  required
                  className="bg-[#F7F3EA] border-[#DEDCCF]"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="isPrimaryAddr"
                checked={addrIsPrimary}
                onChange={(e) => setAddrIsPrimary(e.target.checked)}
                className="rounded border-[#DEDCCF] text-[#0B3B2E] focus:ring-[#0B3B2E]"
              />
              <Label htmlFor="isPrimaryAddr" className="text-xs font-medium cursor-pointer">
                Primary Address for this Site Type
              </Label>
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setAddressModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={addressSubmitting} className="bg-[#0B3B2E] text-white">
                {addressSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Address'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Material Association Modal */}
      <Dialog open={materialModalOpen} onOpenChange={setMaterialModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#FFFEFA] border-[#DEDCCF]">
          <DialogHeader>
            <DialogTitle className="text-[#182820]">Associate Material with Supplier</DialogTitle>
            <DialogDescription className="text-xs text-[#5E6B61]">
              Link an active material from the Material Catalog to this supplier with commercial parameters.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleMaterialSubmit} className="space-y-3 py-2">
            {materialError && <p className="text-xs text-[#B85C1E] font-medium">{materialError}</p>}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Material *</Label>
              <select
                value={selectedMatId}
                onChange={(e) => setSelectedMatId(e.target.value)}
                required
                className="w-full h-9 px-3 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
              >
                <option value="">Select Catalog Material...</option>
                {availableMaterials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.material_code} — {m.name} ({m.category})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Supplier Part #</Label>
                <Input
                  value={supplierPartNum}
                  onChange={(e) => setSupplierPartNum(e.target.value)}
                  placeholder="Vendor reference"
                  className="bg-[#F7F3EA] border-[#DEDCCF]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Specification / Grade</Label>
                <Input
                  value={specGrade}
                  onChange={(e) => setSpecGrade(e.target.value)}
                  placeholder="e.g. USP / BP grade"
                  className="bg-[#F7F3EA] border-[#DEDCCF]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Min Order Qty (MOQ &gt; 0)</Label>
                <Input
                  type="number"
                  step="any"
                  value={moq}
                  onChange={(e) => setMoq(e.target.value)}
                  placeholder="e.g. 50"
                  className="bg-[#F7F3EA] border-[#DEDCCF]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Lead Time (Days &gt;= 0)</Label>
                <Input
                  type="number"
                  value={leadTime}
                  onChange={(e) => setLeadTime(e.target.value)}
                  placeholder="e.g. 14"
                  className="bg-[#F7F3EA] border-[#DEDCCF]"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Supplier Material Description</Label>
              <textarea
                rows={2}
                value={supplierMatDesc}
                onChange={(e) => setSupplierMatDesc(e.target.value)}
                placeholder="Vendor custom description..."
                className="w-full p-2 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
              />
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setMaterialModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={materialSubmitting} className="bg-[#0B3B2E] text-white">
                {materialSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Link Material'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Upload Document Modal */}
      <Dialog open={docModalOpen} onOpenChange={setDocModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#FFFEFA] border-[#DEDCCF]">
          <DialogHeader>
            <DialogTitle className="text-[#182820]">Upload Compliance Document</DialogTitle>
            <DialogDescription className="text-xs text-[#5E6B61]">
              Attach confidential supplier certificate, license, or tax compliance record.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDocSubmit} className="space-y-3 py-2">
            {docError && <p className="text-xs text-[#B85C1E] font-medium">{docError}</p>}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Document Type *</Label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full h-9 px-3 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
              >
                <option value="QUALITY_CERTIFICATION">Quality Certification (ISO / GMP)</option>
                <option value="MANUFACTURING_LICENSE">Manufacturing License</option>
                <option value="REGISTRATION_CERTIFICATE">Incorporation / Registration Certificate</option>
                <option value="TAX_GST_CERTIFICATE">GST / Tax Registration Certificate</option>
                <option value="MSME_CERTIFICATE">MSME / Udyam Certificate</option>
                <option value="OTHER">Other Compliance Document</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Document Title *</Label>
              <Input
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="e.g. ISO 9001:2015 Quality Certificate"
                required
                className="bg-[#F7F3EA] border-[#DEDCCF]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Storage File Key / Reference *</Label>
              <Input
                value={docFileKey}
                onChange={(e) => setDocFileKey(e.target.value)}
                placeholder="suppliers/docs/iso9001_cert_2026.pdf"
                required
                className="bg-[#F7F3EA] border-[#DEDCCF] font-mono text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Issue Date</Label>
                <Input
                  type="date"
                  value={docIssueDate}
                  onChange={(e) => setDocIssueDate(e.target.value)}
                  className="bg-[#F7F3EA] border-[#DEDCCF]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Expiry Date</Label>
                <Input
                  type="date"
                  value={docExpiryDate}
                  onChange={(e) => setDocExpiryDate(e.target.value)}
                  className="bg-[#F7F3EA] border-[#DEDCCF]"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Notes / Scope Description</Label>
              <textarea
                rows={2}
                value={docNotes}
                onChange={(e) => setDocNotes(e.target.value)}
                placeholder="Audit observations or issuing body..."
                className="w-full p-2 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
              />
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setDocModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={docSubmitting} className="bg-[#0B3B2E] text-white">
                {docSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record Document'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Update Qualification Modal */}
      <Dialog open={qualModalOpen} onOpenChange={setQualModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#FFFEFA] border-[#DEDCCF]">
          <DialogHeader>
            <DialogTitle className="text-[#182820]">Update Supplier Qualification</DialogTitle>
            <DialogDescription className="text-xs text-[#5E6B61]">
              Record formal evaluation transition. Changing to NOT_QUALIFIED or EXPIRED mandates review notes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleQualSubmit} className="space-y-3 py-2">
            {qualError && <p className="text-xs text-[#B85C1E] font-medium">{qualError}</p>}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">New Qualification Status *</Label>
              <select
                value={newQualStatus}
                onChange={(e) => setNewQualStatus(e.target.value as SupplierQualificationStatus)}
                className="w-full h-9 px-3 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
              >
                <option value="NOT_STARTED">NOT_STARTED</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="QUALIFIED">QUALIFIED</option>
                <option value="NOT_QUALIFIED">NOT_QUALIFIED</option>
                <option value="EXPIRED">EXPIRED</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Accreditation Start Date</Label>
                <Input
                  type="date"
                  value={qualStartDate}
                  onChange={(e) => setQualStartDate(e.target.value)}
                  className="bg-[#F7F3EA] border-[#DEDCCF]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Accreditation Expiry Date</Label>
                <Input
                  type="date"
                  value={qualExpiryDate}
                  onChange={(e) => setQualExpiryDate(e.target.value)}
                  className="bg-[#F7F3EA] border-[#DEDCCF]"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                Review Notes & Evaluation Reason{' '}
                {(newQualStatus === 'NOT_QUALIFIED' || newQualStatus === 'EXPIRED') && (
                  <span className="text-[#B85C1E]">* (Mandatory)</span>
                )}
              </Label>
              <textarea
                rows={3}
                value={qualReviewNotes}
                onChange={(e) => setQualReviewNotes(e.target.value)}
                placeholder="Audit findings, accreditation summary, or justification..."
                required={newQualStatus === 'NOT_QUALIFIED' || newQualStatus === 'EXPIRED'}
                className="w-full p-2 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
              />
            </div>
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setQualModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={qualSubmitting} className="bg-[#0B3B2E] text-white">
                {qualSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Status Update'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

