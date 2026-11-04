import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerSapPoWithLines } from '@/services/deliveryService';
import { fetchSuppliers } from '@/services/supplierService';
import { fetchEmployeesList } from '@/services/employeeService';
import { fetchProjectsList, fetchDepartmentsList } from '@/services/projectService';
import { Department, Employee, Project, Supplier } from '@/types/database.types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  FileText,
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  Building,
  CheckCircle2,
} from 'lucide-react';
import { getTodayISTDate } from '@/lib/deliveryCalculations';

interface PoLineItemInput {
  sap_po_line_number: string;
  material_description: string;
  material_code?: string;
  category: 'API' | 'PM' | 'EXE' | 'CONSUMABLE';
  ordered_quantity: string;
  uom: string;
  assigned_employee_id: string;
  current_expected_delivery_date?: string;
  delivery_remarks?: string;
}

export function SapPoRegisterPage() {
  const navigate = useNavigate();

  const [sapPoNumber, setSapPoNumber] = useState('');
  const [sapPoDate, setSapPoDate] = useState('');
  const [sapPoApprovalDate, setSapPoApprovalDate] = useState(getTodayISTDate());
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierCode, setSupplierCode] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [plantLocation, setPlantLocation] = useState('Central Formulation Plant (Unit-1)');
  const [poCurrency, setPoCurrency] = useState('INR');
  const [remarks, setRemarks] = useState('');

  // Dropdown options
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  // Line items state
  const [lines, setLines] = useState<PoLineItemInput[]>([
    {
      sap_po_line_number: '10',
      material_description: '',
      material_code: '',
      category: 'API',
      ordered_quantity: '',
      uom: 'KG',
      assigned_employee_id: '',
      current_expected_delivery_date: '',
      delivery_remarks: '',
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchSuppliers({ pageSize: 100 }),
      fetchEmployeesList(),
      fetchProjectsList({ pageSize: 100 }),
      fetchDepartmentsList(),
    ]).then(([sRes, eRes, pRes, dRes]) => {
      if (sRes.data) setSuppliers(sRes.data);
      if (eRes.data) setEmployees(eRes.data.filter((e: Employee) => e.is_active));
      if (pRes.data) setProjects(pRes.data);
      if (dRes.data) setDepartments(dRes.data);
    });
  }, []);

  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value;
    setSelectedSupplierId(sId);
    const found = suppliers.find((s) => s.id === sId);
    if (found) {
      setSupplierName(found.legal_name);
      setSupplierCode(found.supplier_code);
    }
  };

  const handleAddLine = () => {
    const nextLineNumber = (lines.length + 1) * 10;
    setLines([
      ...lines,
      {
        sap_po_line_number: nextLineNumber.toString(),
        material_description: '',
        material_code: '',
        category: 'API',
        ordered_quantity: '',
        uom: 'KG',
        assigned_employee_id: lines[0]?.assigned_employee_id || '',
        current_expected_delivery_date: '',
        delivery_remarks: '',
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, idx) => idx !== index));
  };

  const handleLineChange = (index: number, field: keyof PoLineItemInput, value: string) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    setLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sapPoNumber.trim()) {
      setErrorMsg('SAP Purchase Order Number is required.');
      return;
    }
    if (!sapPoApprovalDate) {
      setErrorMsg('SAP PO Approval Date is required.');
      return;
    }
    if (!supplierName.trim()) {
      setErrorMsg('Supplier name is required.');
      return;
    }

    // Validate line items
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.material_description.trim()) {
        setErrorMsg(`Line ${line.sap_po_line_number}: Material description is required.`);
        return;
      }
      const qty = parseFloat(line.ordered_quantity);
      if (!qty || qty <= 0) {
        setErrorMsg(`Line ${line.sap_po_line_number}: Ordered quantity must be greater than zero.`);
        return;
      }
      if (!line.assigned_employee_id) {
        setErrorMsg(`Line ${line.sap_po_line_number}: Assigned employee is required for delivery tracking.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const payload = {
        sap_po_number: sapPoNumber.trim(),
        sap_po_date: sapPoDate || undefined,
        sap_po_approval_date: sapPoApprovalDate,
        supplier_name: supplierName.trim(),
        supplier_id: selectedSupplierId || undefined,
        supplier_code: supplierCode.trim() || undefined,
        project_id: selectedProjectId || undefined,
        department_id: selectedDeptId || undefined,
        plant_location: plantLocation.trim() || undefined,
        po_currency: poCurrency,
        remarks: remarks.trim() || undefined,
        lines: lines.map((l) => ({
          sap_po_line_number: l.sap_po_line_number.trim(),
          material_description: l.material_description.trim(),
          material_code: l.material_code?.trim() || undefined,
          category: l.category,
          ordered_quantity: parseFloat(l.ordered_quantity),
          uom: l.uom.trim(),
          assigned_employee_id: l.assigned_employee_id,
          current_expected_delivery_date: l.current_expected_delivery_date || undefined,
          original_committed_delivery_date: l.current_expected_delivery_date || undefined,
          delivery_remarks: l.delivery_remarks?.trim() || undefined,
        })),
      };

      const res = await registerSapPoWithLines(payload);
      if (!res.success) {
        throw new Error(res.error || 'Failed to register SAP PO reference.');
      }

      navigate('/app/deliveries');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to register SAP PO.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-[#5E6B61]">
        <Link to="/app/deliveries" className="hover:text-[#0B3B2E] flex items-center gap-1 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Delivery Dashboard
        </Link>
        <span>/</span>
        <span className="text-[#182820] font-medium">Register SAP PO Reference</span>
      </div>

      <Card className="bg-[#FFFEFA] border-[#DEDCCF] shadow-xs">
        <CardHeader className="border-b border-[#DEDCCF] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#E8EEDD] flex items-center justify-center text-[#0B3B2E]">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-[#182820]">
                Capture SAP Purchase Order References
              </CardTitle>
              <CardDescription className="text-sm text-[#5E6B61]">
                <strong>SAP manages procurement. SCM Flow manages delivery visibility and accountability.</strong> Record approved PO header and track line item deliveries.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6 pt-6">
            {errorMsg && (
              <div className="p-4 rounded-md bg-[#F8E8D5] border border-[#B85C1E] text-[#B85C1E] flex items-center gap-3">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="text-sm font-medium">{errorMsg}</span>
              </div>
            )}

            {/* Header Section */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#0B3B2E] border-b border-[#DEDCCF]/70 pb-2 mb-4">
                1. SAP PO Header References
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#182820]">
                    SAP PO Number <span className="text-[#B85C1E]">*</span>
                  </Label>
                  <Input
                    value={sapPoNumber}
                    onChange={(e) => setSapPoNumber(e.target.value)}
                    placeholder="e.g. 4500123456"
                    required
                    className="bg-[#F7F3EA] border-[#DEDCCF] font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#182820]">SAP PO Creation Date</Label>
                  <Input
                    type="date"
                    value={sapPoDate}
                    onChange={(e) => setSapPoDate(e.target.value)}
                    className="bg-[#F7F3EA] border-[#DEDCCF]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#182820]">
                    SAP PO Approval Date <span className="text-[#B85C1E]">* (Mandatory)</span>
                  </Label>
                  <Input
                    type="date"
                    value={sapPoApprovalDate}
                    onChange={(e) => setSapPoApprovalDate(e.target.value)}
                    required
                    className="bg-[#F7F3EA] border-[#DEDCCF]"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold text-[#182820]">
                    Select Verified Supplier <span className="text-[#5E6B61]">(or enter below)</span>
                  </Label>
                  <select
                    value={selectedSupplierId}
                    onChange={handleSupplierChange}
                    className="w-full h-10 px-3 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
                  >
                    <option value="">Choose Supplier Catalog Record...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.supplier_code} — {s.legal_name} ({s.supplier_status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#182820]">
                    Supplier Name <span className="text-[#B85C1E]">*</span>
                  </Label>
                  <Input
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="e.g. PharmaTech Ingredients Pvt Ltd"
                    required
                    className="bg-[#F7F3EA] border-[#DEDCCF]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#182820]">Project Reference</Label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full h-10 px-3 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
                  >
                    <option value="">No Project Linked (Direct Operational PO)</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.project_code} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#182820]">Department / Unit</Label>
                  <select
                    value={selectedDeptId}
                    onChange={(e) => setSelectedDeptId(e.target.value)}
                    className="w-full h-10 px-3 rounded-md bg-[#F7F3EA] border border-[#DEDCCF] text-xs text-[#182820]"
                  >
                    <option value="">Select Department...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#182820]">Plant / Delivery Location</Label>
                  <Input
                    value={plantLocation}
                    onChange={(e) => setPlantLocation(e.target.value)}
                    className="bg-[#F7F3EA] border-[#DEDCCF]"
                  />
                </div>
              </div>
            </div>

            {/* Line Items Section */}
            <div>
              <div className="flex justify-between items-center border-b border-[#DEDCCF]/70 pb-2 mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#0B3B2E]">
                  2. SAP PO Line Items & Delivery Workload Assignment
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddLine}
                  className="border-[#0B3B2E] text-[#0B3B2E] hover:bg-[#E8EEDD] h-8 text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add PO Line Item
                </Button>
              </div>

              <div className="space-y-4">
                {lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-lg bg-[#F7F3EA]/60 border border-[#DEDCCF] space-y-3 relative"
                  >
                    <div className="flex justify-between items-center border-b border-[#DEDCCF]/50 pb-2">
                      <span className="font-mono text-xs font-bold text-[#0B3B2E]">
                        PO Line #{line.sap_po_line_number}
                      </span>
                      {lines.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLine(idx)}
                          className="h-6 px-2 text-red-600 hover:text-red-800 text-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                      <div className="lg:col-span-2 space-y-1">
                        <Label className="text-xs font-semibold">Material Description *</Label>
                        <Input
                          value={line.material_description}
                          onChange={(e) => handleLineChange(idx, 'material_description', e.target.value)}
                          placeholder="e.g. Paracetamol Micronized BP"
                          required
                          className="bg-[#FFFEFA] border-[#DEDCCF] text-xs h-9"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Material Code</Label>
                        <Input
                          value={line.material_code || ''}
                          onChange={(e) => handleLineChange(idx, 'material_code', e.target.value)}
                          placeholder="API-000101"
                          className="bg-[#FFFEFA] border-[#DEDCCF] font-mono text-xs h-9"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Category *</Label>
                        <select
                          value={line.category}
                          onChange={(e) => handleLineChange(idx, 'category', e.target.value as any)}
                          className="w-full h-9 px-2 rounded-md bg-[#FFFEFA] border border-[#DEDCCF] text-xs text-[#182820]"
                        >
                          <option value="API">API</option>
                          <option value="PM">PM (Packaging)</option>
                          <option value="EXE">EXE (Excipient)</option>
                          <option value="CONSUMABLE">Consumable</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">Ordered Qty *</Label>
                        <Input
                          type="number"
                          step="any"
                          value={line.ordered_quantity}
                          onChange={(e) => handleLineChange(idx, 'ordered_quantity', e.target.value)}
                          placeholder="1000"
                          required
                          className="bg-[#FFFEFA] border-[#DEDCCF] font-mono text-xs h-9"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-semibold">UOM *</Label>
                        <Input
                          value={line.uom}
                          onChange={(e) => handleLineChange(idx, 'uom', e.target.value)}
                          placeholder="KG"
                          required
                          className="bg-[#FFFEFA] border-[#DEDCCF] text-xs h-9"
                        />
                      </div>

                      <div className="sm:col-span-2 lg:col-span-3 space-y-1">
                        <Label className="text-xs font-semibold text-[#0B3B2E]">
                          Assigned Responsible Employee * (Accountability)
                        </Label>
                        <select
                          value={line.assigned_employee_id}
                          onChange={(e) => handleLineChange(idx, 'assigned_employee_id', e.target.value)}
                          required
                          className="w-full h-9 px-3 rounded-md bg-[#FFFEFA] border border-[#0B3B2E] text-xs text-[#182820]"
                        >
                          <option value="">Select Responsible Employee...</option>
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.full_name} ({emp.department} — {emp.designation})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2 lg:col-span-3 space-y-1">
                        <Label className="text-xs font-semibold">Expected Delivery Date (ETA)</Label>
                        <Input
                          type="date"
                          value={line.current_expected_delivery_date || ''}
                          onChange={(e) => handleLineChange(idx, 'current_expected_delivery_date', e.target.value)}
                          className="bg-[#FFFEFA] border-[#DEDCCF] text-xs h-9"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>

          <div className="p-4 bg-[#F7F3EA] border-t border-[#DEDCCF] flex items-center justify-end gap-3 rounded-b-lg">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/app/deliveries')}
              disabled={submitting}
              className="border-[#DEDCCF] text-[#182820]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-[#0B3B2E] hover:bg-[#082D24] text-[#FFFEFA]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Registering SAP References...
                </>
              ) : (
                'Register SAP PO & Start Tracking'
              )}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

