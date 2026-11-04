import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  fetchSuppliers,
  deactivateSupplier,
  reactivateSupplier,
  SupplierFilters,
} from '@/services/supplierService';
import {
  Supplier,
  SupplierQualificationStatus,
  SupplierType,
} from '@/types/database.types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Plus,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Eye,
  Edit,
  PowerOff,
  Power,
  ShieldCheck,
  Clock,
  ExternalLink,
  TrendingUp,
} from 'lucide-react';
import { formatDateIST } from '@/lib/formatters';

export function SupplierListPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<SupplierType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'ACTIVE' | 'INACTIVE' | 'all'>('all');
  const [selectedQualStatus, setSelectedQualStatus] = useState<SupplierQualificationStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'updated_at' | 'supplier_code' | 'legal_name' | 'supplier_status' | 'qualification_status'>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Status Toggle Modal
  const [statusModalSupplier, setStatusModalSupplier] = useState<Supplier | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusModalError, setStatusModalError] = useState<string | null>(null);

  const canCreate = hasPermission('suppliers.create');
  const canUpdate = hasPermission('suppliers.update');
  const canDeactivate = hasPermission('suppliers.deactivate');
  const canReactivate = hasPermission('suppliers.reactivate');

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const filters: SupplierFilters = {
        searchTerm: searchTerm.trim() || undefined,
        supplierType: selectedType !== 'all' ? selectedType : undefined,
        supplierStatus: selectedStatus !== 'all' ? selectedStatus : undefined,
        qualificationStatus: selectedQualStatus !== 'all' ? selectedQualStatus : undefined,
        sortBy,
        sortOrder,
        page,
        pageSize,
      };

      const res = await fetchSuppliers(filters);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuppliers(res.data);
        setTotalCount(res.totalCount);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load supplier catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, [selectedType, selectedStatus, selectedQualStatus, sortBy, sortOrder, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadSuppliers();
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedType('all');
    setSelectedStatus('all');
    setSelectedQualStatus('all');
    setSortBy('updated_at');
    setSortOrder('desc');
    setPage(1);
  };

  const openStatusToggleModal = (supplier: Supplier) => {
    setStatusModalSupplier(supplier);
    setStatusReason('');
    setStatusModalError(null);
  };

  const handleStatusToggleSubmit = async () => {
    if (!statusModalSupplier) return;
    if (!statusReason.trim()) {
      setStatusModalError('Reason is mandatory.');
      return;
    }

    try {
      setStatusSubmitting(true);
      setStatusModalError(null);

      if (statusModalSupplier.supplier_status === 'ACTIVE') {
        const res = await deactivateSupplier(statusModalSupplier.id, statusReason.trim());
        if (!res.success) throw new Error(res.error || 'Failed to deactivate supplier.');
      } else {
        const res = await reactivateSupplier(statusModalSupplier.id, statusReason.trim());
        if (!res.success) throw new Error(res.error || 'Failed to reactivate supplier.');
      }

      setStatusModalSupplier(null);
      loadSuppliers();
    } catch (err: any) {
      setStatusModalError(err?.message || 'Action failed.');
    } finally {
      setStatusSubmitting(false);
    }
  };

  const getQualificationBadge = (status: SupplierQualificationStatus) => {
    switch (status) {
      case 'QUALIFIED':
        return <Badge variant="success">QUALIFIED</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="secondary">IN PROGRESS</Badge>;
      case 'NOT_STARTED':
        return <Badge variant="outline">NOT STARTED</Badge>;
      case 'NOT_QUALIFIED':
        return <Badge variant="destructive">NOT QUALIFIED</Badge>;
      case 'EXPIRED':
        return <Badge variant="destructive">EXPIRED</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#DEDCCF] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-7 h-7 text-[#0B3B2E]" />
            <h1 className="text-2xl font-bold tracking-tight text-[#182820]">Supplier Management</h1>
          </div>
          <p className="text-sm text-[#5E6B61] mt-1">
            Maintain verified vendors, contacts, registered sites, material associations, and qualification lifecycle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/app/suppliers/performance')}
            className="border-forest text-forest hover:bg-forest/10"
          >
            <TrendingUp className="w-4 h-4 mr-2 text-forest" />
            Performance & Scorecards
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadSuppliers}
            disabled={loading}
            className="border-[#DEDCCF] text-[#182820] hover:bg-[#F7F3EA]"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {canCreate && (
            <Button
              size="sm"
              onClick={() => navigate('/app/suppliers/new')}
              className="bg-[#0B3B2E] hover:bg-[#082D24] text-[#FFFEFA]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Register Supplier
            </Button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#FFFEFA] border border-[#DEDCCF] rounded-lg p-4 space-y-3 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Term */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-[#5E6B61]" />
            <Input
              type="text"
              placeholder="Search code, legal name, display name, tax ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-[#F7F3EA] border-[#DEDCCF] text-[#182820]"
            />
          </div>

          {/* Supplier Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value as SupplierType | 'all');
                setPage(1);
              }}
              className="w-full h-10 px-3 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-sm text-[#182820] focus:outline-hidden focus:ring-1 focus:ring-[#0B3B2E]"
            >
              <option value="all">All Supplier Types</option>
              <option value="MANUFACTURER">Manufacturer</option>
              <option value="DISTRIBUTOR">Distributor</option>
              <option value="TRADER">Trader</option>
              <option value="SERVICE_PROVIDER">Service Provider</option>
              <option value="OEM">OEM</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as 'ACTIVE' | 'INACTIVE' | 'all');
                setPage(1);
              }}
              className="w-full h-10 px-3 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-sm text-[#182820] focus:outline-hidden focus:ring-1 focus:ring-[#0B3B2E]"
            >
              <option value="all">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {/* Qualification Filter */}
          <div>
            <select
              value={selectedQualStatus}
              onChange={(e) => {
                setSelectedQualStatus(e.target.value as SupplierQualificationStatus | 'all');
                setPage(1);
              }}
              className="w-full h-10 px-3 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-sm text-[#182820] focus:outline-hidden focus:ring-1 focus:ring-[#0B3B2E]"
            >
              <option value="all">All Qualifications</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="NOT_STARTED">Not Started</option>
              <option value="NOT_QUALIFIED">Not Qualified</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>
        </form>

        {/* Sort & Quick Reset */}
        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-[#DEDCCF]/60 text-xs text-[#5E6B61] gap-2">
          <div className="flex items-center gap-2">
            <span>Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-7 px-2 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
            >
              <option value="updated_at">Last Updated</option>
              <option value="supplier_code">Supplier Code</option>
              <option value="legal_name">Legal Name</option>
              <option value="supplier_status">Status</option>
              <option value="qualification_status">Qualification</option>
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="h-7 px-2 text-xs text-[#5E6B61] hover:text-[#182820]"
            >
              {sortOrder === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-[#182820]">{suppliers.length}</strong> of{' '}
              <strong className="text-[#182820]">{totalCount}</strong> suppliers
            </span>
            {(searchTerm || selectedType !== 'all' || selectedStatus !== 'all' || selectedQualStatus !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-7 text-xs text-[#B85C1E] hover:text-[#9A4B17] hover:bg-[#F8E8D5]"
              >
                Reset Filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 rounded-md bg-[#F8E8D5] border border-[#B85C1E] text-[#B85C1E] flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-[#FFFEFA] border border-[#DEDCCF] rounded-lg overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#5E6B61]">
            <Loader2 className="w-8 h-8 animate-spin text-[#0B3B2E] mb-2" />
            <p className="text-sm">Loading supplier directory...</p>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center p-6">
            <Building2 className="w-12 h-12 text-[#A9BE98] mb-3" />
            <h3 className="text-lg font-semibold text-[#182820]">No suppliers found</h3>
            <p className="text-sm text-[#5E6B61] max-w-sm mt-1 mb-4">
              {searchTerm || selectedType !== 'all' || selectedStatus !== 'all' || selectedQualStatus !== 'all'
                ? 'No suppliers match the selected search and filter criteria.'
                : 'No supplier master records have been registered in the system yet.'}
            </p>
            {canCreate && (
              <Button
                onClick={() => navigate('/app/suppliers/new')}
                className="bg-[#0B3B2E] hover:bg-[#082D24] text-[#FFFEFA]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Register First Supplier
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-[#F7F3EA] border-b border-[#DEDCCF]">
              <TableRow>
                <TableHead className="font-semibold text-[#182820]">Code</TableHead>
                <TableHead className="font-semibold text-[#182820]">Legal & Display Name</TableHead>
                <TableHead className="font-semibold text-[#182820]">Type</TableHead>
                <TableHead className="font-semibold text-[#182820]">Tax / GST ID</TableHead>
                <TableHead className="font-semibold text-[#182820]">Status</TableHead>
                <TableHead className="font-semibold text-[#182820]">Qualification</TableHead>
                <TableHead className="font-semibold text-[#182820]">Updated</TableHead>
                <TableHead className="font-semibold text-[#182820] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-[#DEDCCF]">
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id} className="hover:bg-[#F7F3EA]/50 transition-colors">
                  {/* Code */}
                  <TableCell className="font-mono text-xs font-semibold text-[#0B3B2E]">
                    <Link
                      to={`/app/suppliers/${supplier.id}`}
                      className="hover:underline flex items-center gap-1 text-[#0B3B2E]"
                    >
                      {supplier.supplier_code}
                      <ExternalLink className="w-3 h-3 text-[#5E6B61]" />
                    </Link>
                  </TableCell>

                  {/* Names */}
                  <TableCell>
                    <div className="font-medium text-[#182820]">{supplier.legal_name}</div>
                    {supplier.display_name && supplier.display_name !== supplier.legal_name && (
                      <div className="text-xs text-[#5E6B61]">{supplier.display_name}</div>
                    )}
                  </TableCell>

                  {/* Supplier Type */}
                  <TableCell className="text-xs text-[#182820]">{supplier.supplier_type}</TableCell>

                  {/* Tax Identifier */}
                  <TableCell className="font-mono text-xs text-[#5E6B61]">
                    {supplier.tax_identifier || supplier.gstin || '—'}
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    {supplier.supplier_status === 'ACTIVE' ? (
                      <Badge variant="success">ACTIVE</Badge>
                    ) : (
                      <Badge variant="destructive">INACTIVE</Badge>
                    )}
                  </TableCell>

                  {/* Qualification Status */}
                  <TableCell>{getQualificationBadge(supplier.qualification_status)}</TableCell>

                  {/* Updated At */}
                  <TableCell className="text-xs text-[#5E6B61]">
                    {formatDateIST(supplier.updated_at)}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/app/suppliers/${supplier.id}`)}
                      className="h-8 px-2 text-[#5E6B61] hover:text-[#0B3B2E]"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    {canUpdate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/app/suppliers/${supplier.id}/edit`)}
                        className="h-8 px-2 text-[#5E6B61] hover:text-[#0B3B2E]"
                        title="Edit Supplier"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    {supplier.supplier_status === 'ACTIVE' && canDeactivate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openStatusToggleModal(supplier)}
                        className="h-8 px-2 text-[#B85C1E] hover:text-[#9A4B17] hover:bg-[#F8E8D5]"
                        title="Deactivate Supplier"
                      >
                        <PowerOff className="w-4 h-4" />
                      </Button>
                    )}
                    {supplier.supplier_status === 'INACTIVE' && canReactivate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openStatusToggleModal(supplier)}
                        className="h-8 px-2 text-[#0B3B2E] hover:text-[#082D24] hover:bg-[#E8EEDD]"
                        title="Reactivate Supplier"
                      >
                        <Power className="w-4 h-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination Footer */}
        {!loading && suppliers.length > 0 && (
          <div className="p-4 border-t border-[#DEDCCF] bg-[#F7F3EA]/30 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-[#5E6B61]">
            <div>
              Page <strong className="text-[#182820]">{page}</strong> of{' '}
              <strong className="text-[#182820]">{totalPages}</strong>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="h-8 text-xs border-[#DEDCCF]"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
                className="h-8 text-xs border-[#DEDCCF]"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Status Deactivate / Reactivate Confirmation Dialog */}
      <Dialog open={!!statusModalSupplier} onOpenChange={(open) => !open && setStatusModalSupplier(null)}>
        <DialogContent className="sm:max-w-md bg-[#FFFEFA] border-[#DEDCCF]">
          <DialogHeader>
            <DialogTitle className="text-[#182820]">
              {statusModalSupplier?.supplier_status === 'ACTIVE'
                ? 'Deactivate Supplier'
                : 'Reactivate Supplier'}
            </DialogTitle>
            <DialogDescription className="text-[#5E6B61]">
              {statusModalSupplier?.supplier_status === 'ACTIVE'
                ? `Deactivating ${statusModalSupplier?.supplier_code} (${statusModalSupplier?.legal_name}) prevents new material associations and purchase orders while preserving historical records.`
                : `Reactivating ${statusModalSupplier?.supplier_code} (${statusModalSupplier?.legal_name}) will restore it to active operational status.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="text-xs font-semibold text-[#182820] block">
              Reason for {statusModalSupplier?.supplier_status === 'ACTIVE' ? 'Deactivation' : 'Reactivation'}{' '}
              <span className="text-[#B85C1E]">*</span>
            </label>
            <textarea
              rows={3}
              placeholder={`Provide mandatory reason for audit trail...`}
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              className="w-full p-2.5 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-sm text-[#182820] focus:ring-1 focus:ring-[#0B3B2E]"
            />
            {statusModalError && (
              <p className="text-xs text-[#B85C1E] font-medium">{statusModalError}</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatusModalSupplier(null)}
              disabled={statusSubmitting}
              className="border-[#DEDCCF]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleStatusToggleSubmit}
              disabled={statusSubmitting}
              className={
                statusModalSupplier?.supplier_status === 'ACTIVE'
                  ? 'bg-[#B85C1E] hover:bg-[#9A4B17] text-[#FFFEFA]'
                  : 'bg-[#0B3B2E] hover:bg-[#082D24] text-[#FFFEFA]'
              }
            >
              {statusSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : statusModalSupplier?.supplier_status === 'ACTIVE' ? (
                'Confirm Deactivation'
              ) : (
                'Confirm Reactivation'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

