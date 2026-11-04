import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchSapPoReferences } from '@/services/deliveryService';
import { SapPoReference } from '@/types/database.types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileText,
  ArrowLeft,
  Plus,
  RefreshCw,
  Loader2,
  AlertCircle,
  Building,
  Calendar,
  ExternalLink,
  Search,
} from 'lucide-react';
import { formatDateIST } from '@/lib/formatters';

export function SapReferencesPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();

  const [poList, setPoList] = useState<SapPoReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const canRegisterSapPo = hasPermission('sap_references.create');

  const loadReferences = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetchSapPoReferences();
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setPoList(res.data);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load SAP PO references.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReferences();
  }, []);

  const filteredPoList = poList.filter((po) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      po.sap_po_number.toLowerCase().includes(term) ||
      po.supplier_name.toLowerCase().includes(term) ||
      (po.department_name && po.department_name.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-[#5E6B61]">
        <Link to="/app/deliveries" className="hover:text-[#0B3B2E] flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Delivery Dashboard
        </Link>
        <span>/</span>
        <span className="text-[#182820] font-medium">SAP PR & PO Reference Registry</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#DEDCCF] pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#182820]">SAP Reference Register</h1>
          <p className="text-sm text-[#5E6B61] mt-0.5">
            Procurement references captured from SAP ERP. SAP PO Approval Date is maintained strictly separate from PO creation date.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadReferences}
            disabled={loading}
            className="border-[#DEDCCF] text-[#182820] hover:bg-[#F7F3EA]"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {canRegisterSapPo && (
            <Button
              size="sm"
              onClick={() => navigate('/app/deliveries/sap-references/new')}
              className="bg-[#0B3B2E] hover:bg-[#082D24] text-[#FFFEFA]"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Register SAP PO
            </Button>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-[#FFFEFA] border border-[#DEDCCF] rounded-lg p-3">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#5E6B61]" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search SAP PO Number, Supplier, Department..."
            className="pl-9 bg-[#F7F3EA] border-[#DEDCCF] text-xs h-9 text-[#182820]"
          />
        </div>
      </div>

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
            <p className="text-sm">Loading SAP references...</p>
          </div>
        ) : filteredPoList.length === 0 ? (
          <div className="py-16 text-center text-[#5E6B61] p-6">
            <FileText className="w-12 h-12 text-[#A9BE98] mx-auto mb-2" />
            <h3 className="font-semibold text-[#182820]">No SAP PO references found</h3>
            <p className="text-xs text-[#5E6B61] mt-1">
              No procurement records matching your query have been registered.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-[#F7F3EA] border-b border-[#DEDCCF]">
              <TableRow>
                <TableHead className="font-semibold text-[#182820]">SAP PO Number</TableHead>
                <TableHead className="font-semibold text-[#182820]">Supplier</TableHead>
                <TableHead className="font-semibold text-[#182820]">SAP PO Date</TableHead>
                <TableHead className="font-semibold text-[#182820]">SAP Approval Date</TableHead>
                <TableHead className="font-semibold text-[#182820]">Department / Unit</TableHead>
                <TableHead className="font-semibold text-[#182820]">Currency</TableHead>
                <TableHead className="font-semibold text-[#182820]">Registered At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-[#DEDCCF]">
              {filteredPoList.map((po) => (
                <TableRow key={po.id} className="hover:bg-[#F7F3EA]/50">
                  <TableCell className="font-mono text-xs font-bold text-[#0B3B2E]">
                    {po.sap_po_number}
                  </TableCell>
                  <TableCell className="text-xs text-[#182820] font-medium">
                    {po.supplier_name}
                  </TableCell>
                  <TableCell className="text-xs text-[#5E6B61]">
                    {po.sap_po_date ? formatDateIST(po.sap_po_date) : '—'}
                  </TableCell>
                  <TableCell className="text-xs font-semibold text-[#0B3B2E]">
                    {formatDateIST(po.sap_po_approval_date)}
                  </TableCell>
                  <TableCell className="text-xs text-[#182820]">
                    {po.department_name || '—'}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-[#5E6B61]">
                    {po.po_currency}
                  </TableCell>
                  <TableCell className="text-xs text-[#5E6B61]">
                    {formatDateIST(po.recorded_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

