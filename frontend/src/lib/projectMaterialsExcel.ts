import * as XLSX from 'xlsx';
import type { ProjectMaterialItem } from '@/pages/projects/ProjectDetailPage';

const PROJECT_MATERIALS_STORAGE_KEY = 'scm_flow_project_materials_v1';

const DEMO_PROJECT_IDS = new Set(['prj-001', 'prj-002', 'prj-003']);

function loadAllStoredMaterials(): Record<string, ProjectMaterialItem[]> {
  try {
    const raw = localStorage.getItem(PROJECT_MATERIALS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function loadProjectMaterials(
  projectId: string,
  defaultSeed: ProjectMaterialItem[]
): ProjectMaterialItem[] {
  const all = loadAllStoredMaterials();
  if (Array.isArray(all[projectId])) {
    return all[projectId];
  }
  if (DEMO_PROJECT_IDS.has(projectId)) {
    return defaultSeed;
  }
  return [];
}

export function saveProjectMaterials(
  projectId: string,
  items: ProjectMaterialItem[]
): void {
  try {
    const all = loadAllStoredMaterials();
    all[projectId] = items;
    localStorage.setItem(PROJECT_MATERIALS_STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.error('Failed to persist project materials:', err);
  }
}

export function downloadProjectMaterialsExcelTemplate(projectCode = 'PROJECT'): void {
  const sampleRows = [
    {
      'Material Code': 'API-FOLIC-001',
      'Material Name': 'Folic Acid IP/BP/USP Grade',
      'Category': 'API',
      'Milestone': 'API Formulation & Pilot Batch',
      'Required Qty': 250,
      'Delivered Qty': 0,
      'UOM': 'KG',
      'PR Number': 'PR-2026-0101',
      'PR Status': 'Approved',
      'SAP PO Number': '4500129100',
      'SAP PO Line': '10',
      'Supplier Name': 'Bharat Pharma Chem Ltd',
      'Supplier Code': 'SUP-001',
      'Committed ETA': '2026-12-05',
      'Expected ETA': '2026-12-05',
      'Delivery Status': 'ON_TRACK',
      'Estimated Cost INR': 325000,
      'CAS Number': '59-30-3',
      'HSN Code': '29362910',
    },
    {
      'Material Code': 'PM-BLIS-ALU',
      'Material Name': 'Alu-Alu Cold Form Blister Foil 150 Micron',
      'Category': 'PM',
      'Milestone': 'Primary Packaging Validation',
      'Required Qty': 1500,
      'Delivered Qty': 500,
      'UOM': 'KG',
      'PR Number': 'PR-2026-0102',
      'PR Status': 'Partially Ordered',
      'SAP PO Number': '4500129101',
      'SAP PO Line': '20',
      'Supplier Name': 'Apex Packaging Solutions Ltd',
      'Supplier Code': 'SUP-002',
      'Committed ETA': '2026-12-10',
      'Expected ETA': '2026-12-10',
      'Delivery Status': 'PARTIALLY_DELIVERED',
      'Estimated Cost INR': 185000,
      'CAS Number': '',
      'HSN Code': '76071190',
    },
    {
      'Material Code': 'CONS-FILT-022',
      'Material Name': '0.22um Sterile PVDF Membrane Filter',
      'Category': 'Consumables',
      'Milestone': 'QC Assay & Sterility Testing',
      'Required Qty': 100,
      'Delivered Qty': 100,
      'UOM': 'NOS',
      'PR Number': 'PR-2026-0103',
      'PR Status': 'Approved',
      'SAP PO Number': '4500129102',
      'SAP PO Line': '10',
      'Supplier Name': 'SciLab Reagents & Consumables Corp',
      'Supplier Code': 'SUP-004',
      'Committed ETA': '2026-11-20',
      'Expected ETA': '2026-11-20',
      'Delivery Status': 'DELIVERED',
      'Estimated Cost INR': 65000,
      'CAS Number': '',
      'HSN Code': '84212900',
    },
  ];

  const instructionsRows = [
    { Field: 'Material Code', Required: 'Yes', Valid_Values_or_Format: 'Unique material/product code (e.g., API-FOLIC-001)' },
    { Field: 'Material Name', Required: 'Yes', Valid_Values_or_Format: 'Full product/material description' },
    { Field: 'Category', Required: 'Yes', Valid_Values_or_Format: 'API | PM | EXE | Consumables | Other' },
    { Field: 'Milestone', Required: 'No', Valid_Values_or_Format: 'Project milestone name (e.g., Pilot Batch)' },
    { Field: 'Required Qty', Required: 'Yes', Valid_Values_or_Format: 'Positive number (e.g., 250)' },
    { Field: 'Delivered Qty', Required: 'No', Valid_Values_or_Format: 'Number (default 0)' },
    { Field: 'UOM', Required: 'No', Valid_Values_or_Format: 'KG | NOS | LITERS | UNITS | BOX (default KG)' },
    { Field: 'PR Number', Required: 'No', Valid_Values_or_Format: 'Purchase Requisition # (e.g., PR-2026-0101)' },
    { Field: 'PR Status', Required: 'No', Valid_Values_or_Format: 'Approved | Partially Ordered | Submitted' },
    { Field: 'SAP PO Number', Required: 'No', Valid_Values_or_Format: 'SAP PO # (e.g., 4500129100)' },
    { Field: 'SAP PO Line', Required: 'No', Valid_Values_or_Format: 'PO line item (default 10)' },
    { Field: 'Supplier Name', Required: 'No', Valid_Values_or_Format: 'Vendor / Supplier legal name' },
    { Field: 'Supplier Code', Required: 'No', Valid_Values_or_Format: 'Supplier master code (e.g., SUP-001)' },
    { Field: 'Committed ETA', Required: 'No', Valid_Values_or_Format: 'YYYY-MM-DD (e.g., 2026-12-05)' },
    { Field: 'Expected ETA', Required: 'No', Valid_Values_or_Format: 'YYYY-MM-DD (defaults to Committed ETA)' },
    { Field: 'Delivery Status', Required: 'No', Valid_Values_or_Format: 'ON_TRACK | DELAYED | DELIVERED | PARTIALLY_DELIVERED' },
    { Field: 'Estimated Cost INR', Required: 'No', Valid_Values_or_Format: 'Numeric INR amount (e.g., 325000)' },
    { Field: 'CAS Number', Required: 'No', Valid_Values_or_Format: 'Optional CAS registry number' },
    { Field: 'HSN Code', Required: 'No', Valid_Values_or_Format: 'Optional Indian HSN tariff code' },
  ];

  const wb = XLSX.utils.book_new();
  const wsData = XLSX.utils.json_to_sheet(sampleRows);
  wsData['!cols'] = [
    { wch: 16 },
    { wch: 36 },
    { wch: 14 },
    { wch: 28 },
    { wch: 13 },
    { wch: 13 },
    { wch: 8 },
    { wch: 15 },
    { wch: 18 },
    { wch: 15 },
    { wch: 12 },
    { wch: 30 },
    { wch: 14 },
    { wch: 15 },
    { wch: 15 },
    { wch: 20 },
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsData, 'Materials_Upload');

  const wsGuide = XLSX.utils.json_to_sheet(instructionsRows);
  wsGuide['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 52 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Instructions');

  const safeCode = projectCode.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `SCM_Flow_${safeCode}_Materials_Template.xlsx`);
}

function normalizeCategory(raw: string): ProjectMaterialItem['category'] {
  const val = (raw || '').trim().toLowerCase();
  if (val === 'api' || val.includes('active')) return 'API';
  if (val === 'pm' || val.includes('pack')) return 'PM';
  if (val === 'exe' || val.includes('excip')) return 'EXE';
  if (val.includes('consum') || val.includes('lab') || val.includes('reagent')) return 'Consumables';
  return 'Other';
}

function normalizePrStatus(raw: string): ProjectMaterialItem['pr_status'] {
  const val = (raw || '').trim().toLowerCase();
  if (val.includes('partial')) return 'Partially Ordered';
  if (val.includes('submit')) return 'Submitted';
  return 'Approved';
}

function normalizeDeliveryStatus(
  raw: string,
  reqQty: number,
  delQty: number
): ProjectMaterialItem['delivery_status'] {
  const val = (raw || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (val === 'DELIVERED') return 'DELIVERED';
  if (val === 'DELAYED') return 'DELAYED';
  if (val === 'PARTIALLY_DELIVERED' || val === 'PARTIAL') return 'PARTIALLY_DELIVERED';
  if (val === 'ON_TRACK') return 'ON_TRACK';
  if (reqQty > 0 && delQty >= reqQty) return 'DELIVERED';
  if (delQty > 0 && delQty < reqQty) return 'PARTIALLY_DELIVERED';
  return 'ON_TRACK';
}

function parseExcelDate(val: unknown, fallbackDate: string): string {
  if (val === null || val === undefined || val === '') return fallbackDate;
  if (typeof val === 'number' && val > 20000 && val < 90000) {
    // Excel serial date
    const utcDays = Math.floor(val - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return fallbackDate;
}

function pickField(row: Record<string, unknown>, candidates: string[]): unknown {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const exact = keys.find((k) => k.trim().toLowerCase() === cand.toLowerCase());
    if (exact !== undefined && row[exact] !== undefined && row[exact] !== '') {
      return row[exact];
    }
  }
  for (const cand of candidates) {
    const partial = keys.find((k) => k.trim().toLowerCase().includes(cand.toLowerCase()));
    if (partial !== undefined && row[partial] !== undefined && row[partial] !== '') {
      return row[partial];
    }
  }
  return '';
}

export async function parseProjectMaterialsFile(
  file: File
): Promise<{
  validItems: ProjectMaterialItem[];
  errors: Array<{ row: number; reason: string }>;
}> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { validItems: [], errors: [{ row: 1, reason: 'No worksheet found in uploaded file.' }] };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const validItems: ProjectMaterialItem[] = [];
  const errors: Array<{ row: number; reason: string }> = [];

  const defaultEtaDate = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2; // Excel row number (header = 1)
    const code = String(pickField(row, ['Material Code', 'Product Code', 'Code', 'SKU'])).trim();
    const name = String(pickField(row, ['Material Name', 'Product Name', 'Description', 'Name'])).trim();

    if (!code && !name) {
      return; // skip blank row
    }

    if (!code || !name) {
      errors.push({
        row: rowNum,
        reason: `Missing required ${!code ? 'Material Code' : 'Material Name'}.`,
      });
      return;
    }

    const categoryRaw = String(pickField(row, ['Category', 'Type', 'Classification']));
    const milestone = String(pickField(row, ['Milestone', 'Phase', 'Milestone Mapping'])).trim() || 'General Project Scope';
    const reqQtyRaw = Number(pickField(row, ['Required Qty', 'Demanded Qty', 'Quantity', 'Qty'])) || 0;
    const delQtyRaw = Number(pickField(row, ['Delivered Qty', 'Received Qty'])) || 0;

    if (reqQtyRaw <= 0) {
      errors.push({
        row: rowNum,
        reason: `Row "${code}": Required Qty must be greater than 0.`,
      });
      return;
    }

    const uom = String(pickField(row, ['UOM', 'Unit'])).trim().toUpperCase() || 'KG';
    const prNumber = String(pickField(row, ['PR Number', 'PR #', 'PR Reference'])).trim() || 'PR-PENDING';
    const prStatus = normalizePrStatus(String(pickField(row, ['PR Status'])));
    const sapPoNumber = String(pickField(row, ['SAP PO Number', 'SAP PO', 'PO Number', 'PO #'])).trim() || 'PO-PENDING';
    const sapPoLine = String(pickField(row, ['SAP PO Line', 'PO Line', 'Line'])).trim() || '10';
    const supplierName = String(pickField(row, ['Supplier Name', 'Supplier', 'Vendor'])).trim() || 'TBD Supplier';
    const supplierCode = String(pickField(row, ['Supplier Code', 'Vendor Code'])).trim() || 'SUP-TBD';
    const committedEta = parseExcelDate(
      pickField(row, ['Committed ETA', 'Original Committed Date', 'Committed Date']),
      defaultEtaDate
    );
    const expectedEta = parseExcelDate(
      pickField(row, ['Expected ETA', 'Current Expected Date', 'Revised ETA', 'ETA']),
      committedEta
    );
    const deliveryStatus = normalizeDeliveryStatus(
      String(pickField(row, ['Delivery Status', 'Status'])),
      reqQtyRaw,
      delQtyRaw
    );
    const costInr = Number(
      String(pickField(row, ['Estimated Cost INR', 'Cost INR', 'Estimated Cost', 'Cost', 'Value'])).replace(/[^0-9.-]/g, '')
    ) || 0;
    const casNumber = String(pickField(row, ['CAS Number', 'CAS'])).trim() || null;
    const hsnCode = String(pickField(row, ['HSN Code', 'HSN'])).trim() || undefined;

    const diffDays = Math.max(
      0,
      Math.ceil((new Date(expectedEta).getTime() - new Date(committedEta).getTime()) / 86400000)
    );

    validItems.push({
      id: `pmat-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      material_code: code.toUpperCase(),
      material_name: name,
      category: normalizeCategory(categoryRaw),
      milestone_title: milestone,
      required_quantity: reqQtyRaw,
      delivered_quantity: delQtyRaw,
      uom,
      pr_number: prNumber,
      pr_status: prStatus,
      sap_po_number: sapPoNumber,
      sap_po_line: sapPoLine,
      supplier_name: supplierName,
      supplier_code: supplierCode,
      original_committed_date: committedEta,
      current_expected_date: expectedEta,
      delivery_status: deliveryStatus,
      delay_days: deliveryStatus === 'DELAYED' ? Math.max(1, diffDays) : 0,
      estimated_cost_inr: costInr,
      cas_number: casNumber,
      hsn_code: hsnCode,
    });
  });

  return { validItems, errors };
}
