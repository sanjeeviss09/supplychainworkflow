import React, { useRef, useState } from 'react';
import type { ProjectMaterialItem } from '@/pages/projects/ProjectDetailPage';
import {
  downloadProjectMaterialsExcelTemplate,
  parseProjectMaterialsFile,
} from '@/lib/projectMaterialsExcel';
import { formatINR } from '@/lib/formatters';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  FileSpreadsheet,
  UploadCloud,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
} from 'lucide-react';

interface AddProjectMaterialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  milestones: Array<{ id: string; title: string }>;
  onAddMaterial: (item: ProjectMaterialItem) => void;
}

const getDefaultEta = () => {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  return d.toISOString().split('T')[0];
};

export function AddProjectMaterialModal({
  open,
  onOpenChange,
  milestones,
  onAddMaterial,
}: AddProjectMaterialModalProps) {
  const [materialCode, setMaterialCode] = useState('');
  const [materialName, setMaterialName] = useState('');
  const [category, setCategory] = useState<ProjectMaterialItem['category']>('API');
  const [milestoneTitle, setMilestoneTitle] = useState(milestones[0]?.title || 'API Formulation & Pilot Batch');
  const [requiredQty, setRequiredQty] = useState('100');
  const [deliveredQty, setDeliveredQty] = useState('0');
  const [uom, setUom] = useState('KG');
  const [prNumber, setPrNumber] = useState('');
  const [prStatus, setPrStatus] = useState<ProjectMaterialItem['pr_status']>('Approved');
  const [sapPoNumber, setSapPoNumber] = useState('');
  const [sapPoLine, setSapPoLine] = useState('10');
  const [supplierName, setSupplierName] = useState('');
  const [supplierCode, setSupplierCode] = useState('');
  const [committedEta, setCommittedEta] = useState(getDefaultEta());
  const [expectedEta, setExpectedEta] = useState(getDefaultEta());
  const [deliveryStatus, setDeliveryStatus] = useState<ProjectMaterialItem['delivery_status']>('ON_TRACK');
  const [estimatedCostInr, setEstimatedCostInr] = useState('');
  const [casNumber, setCasNumber] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [addedCountBanner, setAddedCountBanner] = useState<number>(0);

  const resetForm = () => {
    setMaterialCode('');
    setMaterialName('');
    setRequiredQty('100');
    setDeliveredQty('0');
    setPrNumber('');
    setSapPoNumber('');
    setSapPoLine('10');
    setSupplierName('');
    setSupplierCode('');
    setEstimatedCostInr('');
    setCasNumber('');
    setHsnCode('');
    setFormError(null);
  };

  const buildItem = (): ProjectMaterialItem | null => {
    setFormError(null);
    if (!materialCode.trim()) {
      setFormError('Material / Product Code is required.');
      return null;
    }
    if (!materialName.trim()) {
      setFormError('Material / Product Name is required.');
      return null;
    }
    const reqNum = Number(requiredQty);
    const delNum = Number(deliveredQty) || 0;
    if (isNaN(reqNum) || reqNum <= 0) {
      setFormError('Required Quantity must be greater than 0.');
      return null;
    }

    const delayDays =
      deliveryStatus === 'DELAYED'
        ? Math.max(
            1,
            Math.ceil(
              (new Date(expectedEta).getTime() - new Date(committedEta).getTime()) / 86400000
            )
          )
        : 0;

    return {
      id: `pmat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      material_code: materialCode.trim().toUpperCase(),
      material_name: materialName.trim(),
      category,
      milestone_title: milestoneTitle.trim() || 'General Project Scope',
      required_quantity: reqNum,
      delivered_quantity: delNum,
      uom: uom.trim().toUpperCase() || 'KG',
      pr_number: prNumber.trim() || 'PR-PENDING',
      pr_status: prStatus,
      sap_po_number: sapPoNumber.trim() || 'PO-PENDING',
      sap_po_line: sapPoLine.trim() || '10',
      supplier_name: supplierName.trim() || 'TBD Supplier',
      supplier_code: supplierCode.trim() || 'SUP-TBD',
      original_committed_date: committedEta,
      current_expected_date: expectedEta || committedEta,
      delivery_status: deliveryStatus,
      delay_days: delayDays,
      estimated_cost_inr: Number(estimatedCostInr) || 0,
      cas_number: casNumber.trim() || null,
      hsn_code: hsnCode.trim() || undefined,
    };
  };

  const handleSubmit = (e: React.FormEvent, keepOpen: boolean) => {
    e.preventDefault();
    const item = buildItem();
    if (!item) return;
    onAddMaterial(item);
    if (keepOpen) {
      setAddedCountBanner((c) => c + 1);
      resetForm();
    } else {
      setAddedCountBanner(0);
      resetForm();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setAddedCountBanner(0); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-forest flex items-center space-x-2">
            <Plus className="h-4 w-4 text-forest" />
            <span>Add Product / Material to Project</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-secondary">
            Add an individual product line item with category, quantity, PR/PO references, supplier, and ETA tracking.
          </DialogDescription>
        </DialogHeader>

        {addedCountBanner > 0 && (
          <div className="flex items-center space-x-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              <strong>{addedCountBanner}</strong> product(s) added to this project. Ready to enter the next product.
            </span>
          </div>
        )}

        {formError && (
          <div className="flex items-center space-x-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-800">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
          {/* Row 1: Code, Name, Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                Material Code <span className="text-status-danger">*</span>
              </Label>
              <Input
                value={materialCode}
                onChange={(e) => setMaterialCode(e.target.value)}
                placeholder="e.g. API-FOLIC-001"
                className="text-xs font-mono uppercase"
                required
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">
                Product / Material Name <span className="text-status-danger">*</span>
              </Label>
              <Input
                value={materialName}
                onChange={(e) => setMaterialName(e.target.value)}
                placeholder="e.g. Folic Acid IP/BP Grade"
                className="text-xs"
                required
              />
            </div>
          </div>

          {/* Row 2: Category, Milestone, Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Category *</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ProjectMaterialItem['category'])}
                className="w-full h-9 rounded-md border border-divider bg-white px-2.5 text-xs text-ink-primary focus:border-forest focus:outline-none"
              >
                <option value="API">API (Active Ingredient)</option>
                <option value="PM">PM (Packaging Material)</option>
                <option value="EXE">EXE (Excipient)</option>
                <option value="Consumables">Consumables & Lab</option>
                <option value="Other">Other Materials</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Milestone Mapping</Label>
              <Input
                value={milestoneTitle}
                onChange={(e) => setMilestoneTitle(e.target.value)}
                placeholder="e.g. Pilot Batch"
                list="project-milestone-options"
                className="text-xs"
              />
              <datalist id="project-milestone-options">
                {milestones.map((m) => (
                  <option key={m.id} value={m.title} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Estimated Cost (₹ INR)</Label>
              <Input
                type="number"
                min="0"
                value={estimatedCostInr}
                onChange={(e) => setEstimatedCostInr(e.target.value)}
                placeholder="e.g. 250000"
                className="text-xs font-mono"
              />
            </div>
          </div>

          {/* Row 3: Quantities & UOM */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                Required Qty <span className="text-status-danger">*</span>
              </Label>
              <Input
                type="number"
                min="0.01"
                step="any"
                value={requiredQty}
                onChange={(e) => setRequiredQty(e.target.value)}
                className="text-xs font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Delivered Qty</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={deliveredQty}
                onChange={(e) => setDeliveredQty(e.target.value)}
                className="text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Unit (UOM)</Label>
              <select
                value={uom}
                onChange={(e) => setUom(e.target.value)}
                className="w-full h-9 rounded-md border border-divider bg-white px-2.5 text-xs text-ink-primary focus:border-forest focus:outline-none"
              >
                <option value="KG">KG</option>
                <option value="NOS">NOS</option>
                <option value="LITERS">LITERS</option>
                <option value="UNITS">UNITS</option>
                <option value="BOX">BOX</option>
                <option value="DRUMS">DRUMS</option>
                <option value="GRAMS">GRAMS</option>
              </select>
            </div>
          </div>

          {/* Row 4: PR & SAP PO References */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">PR Number</Label>
              <Input
                value={prNumber}
                onChange={(e) => setPrNumber(e.target.value)}
                placeholder="PR-2026-0101"
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">PR Status</Label>
              <select
                value={prStatus}
                onChange={(e) => setPrStatus(e.target.value as ProjectMaterialItem['pr_status'])}
                className="w-full h-9 rounded-md border border-divider bg-white px-2 text-xs text-ink-primary focus:border-forest focus:outline-none"
              >
                <option value="Approved">Approved</option>
                <option value="Partially Ordered">Partially Ordered</option>
                <option value="Submitted">Submitted</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">SAP PO Number</Label>
              <Input
                value={sapPoNumber}
                onChange={(e) => setSapPoNumber(e.target.value)}
                placeholder="4500129100"
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">PO Line</Label>
              <Input
                value={sapPoLine}
                onChange={(e) => setSapPoLine(e.target.value)}
                placeholder="10"
                className="text-xs font-mono"
              />
            </div>
          </div>

          {/* Row 5: Supplier & ETA */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Supplier Name</Label>
              <Input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="e.g. Bharat Pharma Chem Ltd"
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Supplier Code</Label>
              <Input
                value={supplierCode}
                onChange={(e) => setSupplierCode(e.target.value)}
                placeholder="SUP-001"
                className="text-xs font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Committed ETA</Label>
              <Input
                type="date"
                value={committedEta}
                onChange={(e) => {
                  setCommittedEta(e.target.value);
                  if (!expectedEta) setExpectedEta(e.target.value);
                }}
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Expected ETA</Label>
              <Input
                type="date"
                value={expectedEta}
                onChange={(e) => setExpectedEta(e.target.value)}
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Delivery Status</Label>
              <select
                value={deliveryStatus}
                onChange={(e) =>
                  setDeliveryStatus(e.target.value as ProjectMaterialItem['delivery_status'])
                }
                className="w-full h-9 rounded-md border border-divider bg-white px-2 text-xs text-ink-primary focus:border-forest focus:outline-none"
              >
                <option value="ON_TRACK">On Track</option>
                <option value="DELAYED">Delayed</option>
                <option value="PARTIALLY_DELIVERED">Partially Delivered</option>
                <option value="DELIVERED">Delivered</option>
              </select>
            </div>
          </div>

          {/* Row 6: Optional CAS & HSN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">CAS Number (Optional)</Label>
              <Input
                value={casNumber}
                onChange={(e) => setCasNumber(e.target.value)}
                placeholder="e.g. 59-30-3"
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">HSN Code (Optional)</Label>
              <Input
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value)}
                placeholder="e.g. 29362910"
                className="text-xs font-mono"
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-divider/60 flex flex-col sm:flex-row gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Close
            </Button>
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={(e) => handleSubmit(e as any, true)}
                className="text-xs border-forest/40 text-forest hover:bg-forest/5"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add & Add Another
              </Button>
              <Button type="submit" size="sm" className="text-xs bg-forest hover:bg-forest-deep text-white">
                Add Product
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface BulkUploadProjectMaterialsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectCode: string;
  existingCount: number;
  onImportMaterials: (items: ProjectMaterialItem[], mode: 'append' | 'replace') => void;
}

export function BulkUploadProjectMaterialsModal({
  open,
  onOpenChange,
  projectCode,
  existingCount,
  onImportMaterials,
}: BulkUploadProjectMaterialsModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ProjectMaterialItem[]>([]);
  const [parseErrors, setParseErrors] = useState<Array<{ row: number; reason: string }>>([]);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');

  const handleReset = () => {
    setFileName(null);
    setParsedItems([]);
    setParseErrors([]);
  };

  const handleFileSelected = async (file: File) => {
    setParsing(true);
    setFileName(file.name);
    setParsedItems([]);
    setParseErrors([]);
    try {
      const result = await parseProjectMaterialsFile(file);
      setParsedItems(result.validItems);
      setParseErrors(result.errors);
    } catch (err: any) {
      setParseErrors([{ row: 1, reason: err?.message || 'Failed to parse uploaded Excel/CSV file.' }]);
    } finally {
      setParsing(false);
    }
  };

  const handleConfirmImport = () => {
    if (parsedItems.length === 0) return;
    onImportMaterials(parsedItems, importMode);
    handleReset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleReset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-forest flex items-center space-x-2">
            <FileSpreadsheet className="h-4 w-4 text-forest" />
            <span>Bulk Upload Products via Excel / CSV Template</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-secondary">
            Download the pre-formatted Excel template, fill in your project products/materials, and upload it to import all rows at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Download Template */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-divider bg-ivory/60 p-3.5">
            <div>
              <div className="text-xs font-bold text-forest">Step 1: Download Excel Template (.xlsx)</div>
              <p className="text-[11px] text-ink-secondary mt-0.5">
                Includes formatted headers, sample API/PM/Consumables rows, and a field instructions tab.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadProjectMaterialsExcelTemplate(projectCode)}
              className="text-xs border-forest/40 text-forest hover:bg-forest hover:text-sage shrink-0"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Download Template (.xlsx)
            </Button>
          </div>

          {/* Step 2: Upload Filled Excel/CSV */}
          <div>
            <div className="text-xs font-bold text-forest mb-1.5">Step 2: Upload Filled Excel or CSV File</div>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFileSelected(f);
              }}
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-divider bg-white px-4 py-6 text-center hover:border-forest/60 hover:bg-sage-pale/15 cursor-pointer transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelected(f);
                  e.target.value = '';
                }}
                className="hidden"
              />
              {parsing ? (
                <div className="flex items-center space-x-2 text-xs text-forest">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Parsing workbook rows...</span>
                </div>
              ) : (
                <>
                  <UploadCloud className="h-7 w-7 text-forest mb-1.5" />
                  <p className="text-xs font-semibold text-ink-primary">
                    {fileName ? `Selected: ${fileName}` : 'Click to select or drag & drop your .xlsx, .xls, or .csv file'}
                  </p>
                  <p className="text-[11px] text-ink-muted mt-0.5">
                    All valid rows will be previewed before importing into {projectCode}.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Validation Errors */}
          {parseErrors.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 space-y-1">
              <div className="text-xs font-bold text-rose-800 flex items-center space-x-1.5">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <span>{parseErrors.length} Row Warning(s) Skipped</span>
              </div>
              <ul className="list-disc pl-5 text-[11px] text-rose-700 space-y-0.5 max-h-24 overflow-y-auto">
                {parseErrors.map((err, i) => (
                  <li key={i}>
                    Row {err.row}: {err.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>{parsedItems.length} Valid Product(s) Ready to Import</span>
                </div>

                {existingCount > 0 && (
                  <div className="flex items-center space-x-3 text-[11px]">
                    <label className="flex items-center space-x-1 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'append'}
                        onChange={() => setImportMode('append')}
                        className="accent-forest"
                      />
                      <span>Append to existing ({existingCount})</span>
                    </label>
                    <label className="flex items-center space-x-1 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="accent-forest"
                      />
                      <span className="text-rose-700 font-medium">Replace existing</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="max-h-56 overflow-auto rounded-lg border border-divider bg-white">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-ivory/70 border-b border-divider text-[10px] uppercase text-ink-secondary sticky top-0">
                    <tr>
                      <th className="py-2 px-2.5">Code</th>
                      <th className="py-2 px-2.5">Product Name</th>
                      <th className="py-2 px-2.5">Category</th>
                      <th className="py-2 px-2.5">Qty</th>
                      <th className="py-2 px-2.5">PR / PO</th>
                      <th className="py-2 px-2.5">ETA</th>
                      <th className="py-2 px-2.5 text-right">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-divider/50">
                    {parsedItems.map((item) => (
                      <tr key={item.id} className="hover:bg-ivory/40">
                        <td className="py-1.5 px-2.5 font-mono font-semibold text-forest whitespace-nowrap">
                          {item.material_code}
                        </td>
                        <td className="py-1.5 px-2.5 text-ink-primary max-w-[180px] truncate">
                          {item.material_name}
                        </td>
                        <td className="py-1.5 px-2.5">
                          <Badge variant="outline" className="text-[10px]">
                            {item.category}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-2.5 font-mono whitespace-nowrap">
                          {item.required_quantity} {item.uom}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-[10px] text-ink-secondary whitespace-nowrap">
                          {item.pr_number} / {item.sap_po_number}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono whitespace-nowrap">
                          {item.current_expected_date}
                        </td>
                        <td className="py-1.5 px-2.5 font-mono text-right whitespace-nowrap">
                          {formatINR(item.estimated_cost_inr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-divider/60">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              handleReset();
              onOpenChange(false);
            }}
            className="text-xs"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={parsedItems.length === 0}
            onClick={handleConfirmImport}
            className="text-xs bg-forest hover:bg-forest-deep text-white"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Import {parsedItems.length} Product{parsedItems.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
