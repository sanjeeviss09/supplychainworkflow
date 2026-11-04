import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  fetchDeliveryTrackingList,
  recordMaterialDelivery,
  submitDailyDelayRemark,
  DeliveryFilters,
} from '@/services/deliveryService';
import {
  DelayReasonCategory,
  DeliveryTrackingStatus,
  MaterialDeliveryTracking,
} from '@/types/database.types';
import { calculateDeliveryMetrics, getTodayISTDate } from '@/lib/deliveryCalculations';
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
import { Label } from '@/components/ui/label';
import {
  Truck,
  ArrowLeft,
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Eye,
  MessageSquareWarning,
  CheckCircle2,
  Clock,
  Calendar,
} from 'lucide-react';
import { formatDateIST } from '@/lib/formatters';

export function MyAssignedDeliveriesPage() {
  const { employee: currentEmployee } = useAuth();
  const navigate = useNavigate();

  const [assignedList, setAssignedList] = useState<MaterialDeliveryTracking[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [filterMode, setFilterMode] = useState<'all' | 'due_today' | 'delayed' | 'partial' | 'completed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Quick Action Modals
  const [deliveryModalRecord, setDeliveryModalRecord] = useState<MaterialDeliveryTracking | null>(null);
  const [deliveredQty, setDeliveredQty] = useState('');
  const [actualDate, setActualDate] = useState(getTodayISTDate());
  const [challanRef, setChallanRef] = useState('');
  const [deliveryRemarks, setDeliveryRemarks] = useState('');
  const [deliverySubmitting, setDeliverySubmitting] = useState(false);
  const [deliveryModalError, setDeliveryModalError] = useState<string | null>(null);

  const [delayModalRecord, setDelayModalRecord] = useState<MaterialDeliveryTracking | null>(null);
  const [delayReasonCat, setDelayReasonCat] = useState<DelayReasonCategory>('Supplier Manufacturing Delay');
  const [delayExplanation, setDelayExplanation] = useState('');
  const [supplierContacted, setSupplierContacted] = useState(true);
  const [supplierUpdate, setSupplierUpdate] = useState('');
  const [revisedDate, setRevisedDate] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [nextFollowupDate, setNextFollowupDate] = useState(getTodayISTDate());
  const [delaySubmitting, setDelaySubmitting] = useState(false);
  const [delayModalError, setDelayModalError] = useState<string | null>(null);

  const todayIST = getTodayISTDate();

  const loadAssigned = async () => {
    if (!currentEmployee?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      const filters: DeliveryFilters = {
        assignedEmployeeId: currentEmployee.id,
        searchTerm: searchTerm.trim() || undefined,
        dueTodayOnly: filterMode === 'due_today',
        delayedOnly: filterMode === 'delayed',
        partialOnly: filterMode === 'partial',
        pageSize: 100,
      };

      if (filterMode === 'completed') {
        filters.status = 'DELIVERED';
      }

      const res = await fetchDeliveryTrackingList(filters);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setAssignedList(res.data);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load assigned deliveries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssigned();
  }, [currentEmployee?.id, filterMode]);

  const handleQuickDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryModalRecord) return;

    const qty = parseFloat(deliveredQty);
    if (!qty || qty <= 0) {
      setDeliveryModalError('Delivered quantity must be greater than zero.');
      return;
    }

    try {
      setDeliverySubmitting(true);
      setDeliveryModalError(null);

      const res = await recordMaterialDelivery({
        tracking_id: deliveryModalRecord.id,
        delivery_quantity: qty,
        actual_delivery_date: actualDate,
        supplier_delivery_reference: challanRef.trim() || undefined,
        delivery_remarks: deliveryRemarks.trim() || undefined,
      });

      if (!res.success) throw new Error(res.error || 'Failed to record delivery.');

      setDeliveryModalRecord(null);
      loadAssigned();
    } catch (err: any) {
      setDeliveryModalError(err?.message || 'Failed to save delivery shipment.');
    } finally {
      setDeliverySubmitting(false);
    }
  };

  const handleQuickDelayRemarkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delayModalRecord) return;

    if (!delayExplanation.trim()) {
      setDelayModalError('Delay explanation cannot be blank.');
      return;
    }
    if (!correctiveAction.trim()) {
      setDelayModalError('Corrective action plan is required.');
      return;
    }

    try {
      setDelaySubmitting(true);
      setDelayModalError(null);

      const res = await submitDailyDelayRemark({
        tracking_id: delayModalRecord.id,
        delay_date: todayIST,
        delay_reason_category: delayReasonCat,
        delay_explanation: delayExplanation.trim(),
        supplier_contacted: supplierContacted,
        supplier_update: supplierUpdate.trim() || undefined,
        revised_expected_date: revisedDate || undefined,
        corrective_action: correctiveAction.trim(),
        next_followup_date: nextFollowupDate,
      });

      if (!res.success) throw new Error(res.error || 'Failed to submit delay remark.');

      setDelayModalRecord(null);
      loadAssigned();
    } catch (err: any) {
      setDelayModalError(err?.message || 'Failed to submit daily delay remark.');
    } finally {
      setDelaySubmitting(false);
    }
  };

  // Compute summary stats
  const totalAssigned = assignedList.length;
  let dueTodayCount = 0;
  let delayedCount = 0;
  let partialCount = 0;
  let completedCount = 0;

  for (const item of assignedList) {
    const m = calculateDeliveryMetrics({
      orderedQuantity: Number(item.ordered_quantity),
      deliveredQuantity: Number(item.delivered_quantity),
      originalCommittedDeliveryDate: item.original_committed_delivery_date,
      currentExpectedDeliveryDate: item.current_expected_delivery_date,
      actualCompletionDate: item.actual_completion_date,
      isCancelled: item.delivery_status === 'CANCELLED',
      referenceDateIST: todayIST,
    });

    if (m.calculatedStatus === 'DELIVERED') completedCount++;
    else if (m.calculatedStatus === 'DELAYED') delayedCount++;
    else if (m.calculatedStatus === 'PARTIALLY_DELIVERED') partialCount++;

    if (item.current_expected_delivery_date === todayIST && m.calculatedStatus !== 'DELIVERED') {
      dueTodayCount++;
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-[#5E6B61]">
        <Link to="/app/deliveries" className="hover:text-[#0B3B2E] flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Delivery Dashboard
        </Link>
        <span>/</span>
        <span className="text-[#182820] font-medium">My Assigned Deliveries</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#DEDCCF] pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#182820]">My Assigned Deliveries</h1>
          <p className="text-sm text-[#5E6B61] mt-0.5">
            Personal delivery workbench for <strong className="text-[#182820]">{currentEmployee?.full_name || 'Assigned User'}</strong>. Enter shipment arrivals and mandatory daily delay remarks.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadAssigned}
          disabled={loading}
          className="border-[#DEDCCF] text-[#182820] hover:bg-[#F7F3EA]"
        >
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-[#FFFEFA] border border-[#DEDCCF] rounded-lg p-3 text-center shadow-xs">
          <span className="text-xs text-[#5E6B61] block font-medium">Total Assigned</span>
          <span className="text-xl font-bold text-[#182820]">{totalAssigned}</span>
        </div>
        <div className="bg-[#FFFEFA] border border-[#A9BE98] rounded-lg p-3 text-center shadow-xs">
          <span className="text-xs text-[#0B3B2E] block font-semibold">Due Today ({todayIST})</span>
          <span className="text-xl font-bold text-[#0B3B2E]">{dueTodayCount}</span>
        </div>
        <div className="bg-[#FFFEFA] border border-red-200 bg-red-50/50 rounded-lg p-3 text-center shadow-xs">
          <span className="text-xs text-red-700 block font-bold">Delayed Lines</span>
          <span className="text-xl font-bold text-red-700">{delayedCount}</span>
        </div>
        <div className="bg-[#FFFEFA] border border-[#DEDCCF] rounded-lg p-3 text-center shadow-xs">
          <span className="text-xs text-[#B85C1E] block font-medium">Partially Delivered</span>
          <span className="text-xl font-bold text-[#B85C1E]">{partialCount}</span>
        </div>
        <div className="bg-[#FFFEFA] border border-[#DEDCCF] rounded-lg p-3 text-center shadow-xs">
          <span className="text-xs text-[#5E6B61] block font-medium">Completed</span>
          <span className="text-xl font-bold text-[#182820]">{completedCount}</span>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex border-b border-[#DEDCCF] gap-1 overflow-x-auto text-xs font-semibold">
        {[
          { key: 'all', label: `All Assigned (${totalAssigned})` },
          { key: 'due_today', label: `Due Today (${dueTodayCount})` },
          { key: 'delayed', label: `Delayed (${delayedCount})` },
          { key: 'partial', label: `Partially Delivered (${partialCount})` },
          { key: 'completed', label: `Completed (${completedCount})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterMode(tab.key as any)}
            className={`py-2 px-3 border-b-2 whitespace-nowrap transition-colors ${
              filterMode === tab.key
                ? 'border-[#0B3B2E] text-[#0B3B2E] bg-[#FFFEFA]'
                : 'border-transparent text-[#5E6B61] hover:text-[#182820]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="p-4 rounded-md bg-[#F8E8D5] border border-[#B85C1E] text-[#B85C1E] flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#FFFEFA] border border-[#DEDCCF] rounded-lg overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-[#5E6B61]">
            <Loader2 className="w-8 h-8 animate-spin text-[#0B3B2E] mb-2" />
            <p className="text-sm">Loading your assigned delivery tracking records...</p>
          </div>
        ) : assignedList.length === 0 ? (
          <div className="py-16 text-center text-[#5E6B61] p-6">
            <Truck className="w-12 h-12 text-[#A9BE98] mx-auto mb-2" />
            <h3 className="font-semibold text-[#182820]">No assigned deliveries found</h3>
            <p className="text-xs text-[#5E6B61] mt-1">
              You currently have no material deliveries matching this filter.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-[#F7F3EA] border-b border-[#DEDCCF]">
              <TableRow>
                <TableHead className="font-semibold text-[#182820]">SAP PO # & Line</TableHead>
                <TableHead className="font-semibold text-[#182820]">Material & Category</TableHead>
                <TableHead className="font-semibold text-[#182820]">Supplier</TableHead>
                <TableHead className="font-semibold text-[#182820]">Ordered Qty</TableHead>
                <TableHead className="font-semibold text-[#182820]">Delivered / Outstanding</TableHead>
                <TableHead className="font-semibold text-[#182820]">Expected Date</TableHead>
                <TableHead className="font-semibold text-[#182820]">Delay</TableHead>
                <TableHead className="font-semibold text-[#182820] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-[#DEDCCF]">
              {assignedList.map((t) => {
                const m = calculateDeliveryMetrics({
                  orderedQuantity: Number(t.ordered_quantity),
                  deliveredQuantity: Number(t.delivered_quantity),
                  originalCommittedDeliveryDate: t.original_committed_delivery_date,
                  currentExpectedDeliveryDate: t.current_expected_delivery_date,
                  actualCompletionDate: t.actual_completion_date,
                  isCancelled: t.delivery_status === 'CANCELLED',
                  referenceDateIST: todayIST,
                });

                return (
                  <TableRow key={t.id} className="hover:bg-[#F7F3EA]/50">
                    <TableCell>
                      <Link
                        to={`/app/deliveries/${t.id}`}
                        className="font-mono text-xs font-bold text-[#0B3B2E] hover:underline"
                      >
                        {t.sap_po_number} / L{t.sap_po_line_number}
                      </Link>
                    </TableCell>

                    <TableCell>
                      <div className="font-medium text-xs text-[#182820]">{t.material_description}</div>
                      <Badge variant="outline" className="text-[10px] px-1 py-0 mt-0.5">
                        {t.category}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs text-[#182820]">{t.supplier_name}</TableCell>

                    <TableCell className="font-mono text-xs font-semibold">
                      {t.ordered_quantity} {t.uom}
                    </TableCell>

                    <TableCell>
                      <div className="font-mono text-xs">
                        {t.delivered_quantity} / {m.outstandingQuantity} {t.uom}
                      </div>
                      <div className="w-20 bg-[#E8EEDD] rounded-full h-1.5 mt-1 overflow-hidden">
                        <div className="bg-[#0B3B2E] h-1.5 rounded-full" style={{ width: `${m.deliveryPercentage}%` }} />
                      </div>
                    </TableCell>

                    <TableCell className="text-xs">
                      {t.current_expected_delivery_date ? (
                        <span className={m.isOverdue ? 'text-red-700 font-bold' : 'text-[#182820]'}>
                          {formatDateIST(t.current_expected_delivery_date)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>

                    <TableCell className="font-mono text-xs">
                      {m.totalDeliveryDelayDays !== null && m.totalDeliveryDelayDays > 0 ? (
                        <span className="text-red-700 font-bold">+{m.totalDeliveryDelayDays}d</span>
                      ) : m.totalDeliveryDelayDays === 0 ? (
                        <span className="text-[#5E6B61]">0d</span>
                      ) : (
                        <span className="text-amber-700 text-[10px]">Uncommitted</span>
                      )}
                    </TableCell>

                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/app/deliveries/${t.id}`)}
                        className="h-8 px-2 text-[#5E6B61]"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>

                      {t.delivery_status !== 'DELIVERED' && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setDeliveryModalRecord(t);
                            setDeliveredQty('');
                            setActualDate(todayIST);
                            setChallanRef('');
                            setDeliveryRemarks('');
                            setDeliveryModalError(null);
                          }}
                          className="h-7 text-xs bg-[#0B3B2E] text-white"
                        >
                          <Truck className="w-3.5 h-3.5 mr-1" />
                          Update Delivery
                        </Button>
                      )}

                      {m.isOverdue && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setDelayModalRecord(t);
                            setDelayExplanation('');
                            setCorrectiveAction('');
                            setSupplierContacted(true);
                            setSupplierUpdate('');
                            setRevisedDate('');
                            setNextFollowupDate(todayIST);
                            setDelayModalError(null);
                          }}
                          className="h-7 text-xs bg-red-700 hover:bg-red-800 text-white"
                        >
                          <MessageSquareWarning className="w-3.5 h-3.5 mr-1" />
                          Daily Remark
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Record Delivery Modal */}
      <Dialog open={!!deliveryModalRecord} onOpenChange={(open) => !open && setDeliveryModalRecord(null)}>
        <DialogContent className="sm:max-w-md bg-[#FFFEFA] border-[#DEDCCF]">
          <DialogHeader>
            <DialogTitle className="text-[#182820]">Record Material Delivery</DialogTitle>
            <DialogDescription className="text-xs text-[#5E6B61]">
              PO #{deliveryModalRecord?.sap_po_number} / Line {deliveryModalRecord?.sap_po_line_number} —{' '}
              {deliveryModalRecord?.material_description}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleQuickDeliverySubmit} className="space-y-3 py-2">
            {deliveryModalError && <p className="text-xs text-red-600 font-medium">{deliveryModalError}</p>}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Delivered Qty *</Label>
                <Input
                  type="number"
                  step="any"
                  value={deliveredQty}
                  onChange={(e) => setDeliveredQty(e.target.value)}
                  placeholder="e.g. 500"
                  required
                  className="bg-[#F7F3EA] border-[#DEDCCF]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Actual Arrival Date *</Label>
                <Input
                  type="date"
                  value={actualDate}
                  onChange={(e) => setActualDate(e.target.value)}
                  required
                  className="bg-[#F7F3EA] border-[#DEDCCF]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Supplier Challan / LR Docket #</Label>
              <Input
                value={challanRef}
                onChange={(e) => setChallanRef(e.target.value)}
                placeholder="e.g. CH-2026-9812"
                className="bg-[#F7F3EA] border-[#DEDCCF]"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Delivery Remarks</Label>
              <textarea
                rows={2}
                value={deliveryRemarks}
                onChange={(e) => setDeliveryRemarks(e.target.value)}
                placeholder="Physical condition, batch notes, or storage destination..."
                className="w-full p-2 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDeliveryModalRecord(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={deliverySubmitting} className="bg-[#0B3B2E] text-white">
                {deliverySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record Delivery'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Daily Delay Remark Modal */}
      <Dialog open={!!delayModalRecord} onOpenChange={(open) => !open && setDelayModalRecord(null)}>
        <DialogContent className="sm:max-w-md bg-[#FFFEFA] border-[#DEDCCF]">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-1.5">
              <MessageSquareWarning className="w-5 h-5 text-red-600" />
              Mandatory Daily Delay Remark ({todayIST})
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5E6B61]">
              PO #{delayModalRecord?.sap_po_number} / Line {delayModalRecord?.sap_po_line_number} —{' '}
              {delayModalRecord?.material_description}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleQuickDelayRemarkSubmit} className="space-y-3 py-2">
            {delayModalError && <p className="text-xs text-red-600 font-medium">{delayModalError}</p>}

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Delay Reason *</Label>
              <select
                value={delayReasonCat}
                onChange={(e) => setDelayReasonCat(e.target.value as DelayReasonCategory)}
                className="w-full h-9 px-3 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
              >
                <option value="Supplier Manufacturing Delay">Supplier Manufacturing Delay</option>
                <option value="Raw Material Shortage at Supplier">Raw Material Shortage at Supplier</option>
                <option value="Quality Testing / Release Pending">Quality Testing / Release Pending</option>
                <option value="Packaging Delay">Packaging Delay</option>
                <option value="Supplier Capacity Constraint">Supplier Capacity Constraint</option>
                <option value="Transportation / Logistics Delay">Transportation / Logistics Delay</option>
                <option value="Documentation Pending">Documentation Pending</option>
                <option value="Customs / Import Clearance Delay">Customs / Import Clearance Delay</option>
                <option value="Internal Coordination Delay">Internal Coordination Delay</option>
                <option value="Technical Specification Clarification">Technical Specification Clarification</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Delay Explanation * (Mandatory)</Label>
              <textarea
                rows={2}
                value={delayExplanation}
                onChange={(e) => setDelayExplanation(e.target.value)}
                placeholder="Specific cause why material has not arrived..."
                required
                className="w-full p-2 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="suppContactedMy"
                checked={supplierContacted}
                onChange={(e) => setSupplierContacted(e.target.checked)}
                className="rounded border-[#DEDCCF] text-[#0B3B2E]"
              />
              <Label htmlFor="suppContactedMy" className="text-xs font-medium cursor-pointer">
                Supplier was contacted regarding this delay
              </Label>
            </div>

            {supplierContacted && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Supplier Communication Update *</Label>
                <Input
                  value={supplierUpdate}
                  onChange={(e) => setSupplierUpdate(e.target.value)}
                  placeholder="e.g. Supplier confirmed dispatch scheduled for tomorrow morning"
                  required
                  className="bg-[#F7F3EA] border-[#DEDCCF] text-xs"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Revised Expected Date</Label>
                <Input
                  type="date"
                  value={revisedDate}
                  onChange={(e) => setRevisedDate(e.target.value)}
                  className="bg-[#F7F3EA] border-[#DEDCCF] text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Next Follow-up Date *</Label>
                <Input
                  type="date"
                  value={nextFollowupDate}
                  onChange={(e) => setNextFollowupDate(e.target.value)}
                  required
                  className="bg-[#F7F3EA] border-[#DEDCCF] text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Corrective Action Taken *</Label>
              <textarea
                rows={2}
                value={correctiveAction}
                onChange={(e) => setCorrectiveAction(e.target.value)}
                placeholder="Steps taken to expedite delivery..."
                required
                className="w-full p-2 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDelayModalRecord(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={delaySubmitting} className="bg-red-700 hover:bg-red-800 text-white">
                {delaySubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Delay Remark'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

