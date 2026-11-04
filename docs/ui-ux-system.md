# SCM Flow — UI/UX Design System & Component Architecture
**Document ID:** UIX-SCM-005  
**Version:** 2.0.0 (Approved Forest Green, Warm Ivory, Sage & Copper Visual Identity)  
**Status:** Implemented Production Baseline  
**Stack Baseline:** React 18+, Vite, TypeScript, Tailwind CSS v3, Radix UI, Lucide Icons  

---

## 1. Design Language & Visual Principles

SCM Flow utilizes a calm, premium, enterprise interface characterized by high operational clarity, scannability, and information density:
- **Navigation Shell:** Deep forest green sidebar (`#0B3B2E` / `#082D24`) with white typography and a restrained sage active highlight (`#A9BE98`).
- **Main Viewport Canvas:** Warm ivory (`#F7F3EA`).
- **Cards & Surfaces:** Ivory/white surfaces (`#FFFEFA`) with warm stone dividers (`#DEDCCF`) and subtle warm drop shadows (`rgba(24, 40, 32, 0.05)`).
- **Accent & Highlight States:** Restrained copper (`#B85C1E`) for urgent alerts, deadline warnings, and key action highlights. Pale copper (`#F8E8D5`) for warning surfaces.

---

## 2. Approved Design Tokens & Color Palette

| Token Name | Color Role | Hex Value | Application |
| :--- | :--- | :--- | :--- |
| `forest` | Brand Primary | `#0B3B2E` | Sidebar background, primary brand headers, primary buttons |
| `forest-deep` | Pressed / Dark Accent | `#082D24` | Sidebar active background, button pressed states |
| `ivory` | Page Canvas | `#F7F3EA` | Body viewport background, table alt rows |
| `ivory-surface` | Card / Dialog Surface | `#FFFEFA` | Elevated cards, dialog modals, dropdowns |
| `sage` | Secondary Accent | `#A9BE98` | Active navigation indicator, secondary buttons, subtle badges |
| `sage-pale` | Subtle Surface | `#E8EEDD` | Secondary button backgrounds, table hover states |
| `copper` | Attention Accent | `#B85C1E` | Priority badges, project delay indicators, urgent action items |
| `copper-pale` | Warning Surface | `#F8E8D5` | Warning alerts, temporary credentials highlight |
| `ink-primary` | Primary Text | `#182820` | Headings, labels, high-contrast readable text |
| `ink-secondary` | Secondary Text | `#5E6B61` | Captions, subtitles, table headers, descriptions |
| `divider` | Border / Separator | `#DEDCCF` | Card strokes, input borders, table borders |
| `status-success` | Success Status | `#2F7D4A` | Completed projects, active accounts, verified batches |
| `status-warning` | Warning Status | `#A85A12` | Delays, pending reviews, password rotation required |
| `status-danger` | Destructive Status | `#B42318` | Rejections, validation errors, hard denials |

---

## 3. Responsive Breakpoints

| Breakpoint | Viewport Width | Target Devices & Behavior |
| :--- | :---: | :--- |
| `xs` | 0–479px | Small mobile viewports; single column cards, collapsible menu drawer. |
| `sm` | 480–767px | Large phones; stacked inputs, touch-friendly 36px+ tap targets. |
| `md` | 768–1023px | Tablets; compact navigation, 2-column card grids. |
| `lg` | 1024–1279px | Laptops; expanded persistent sidebar, tabular layouts. |
| `xl` | 1280–1535px | Standard desktop; multi-column operational dashboards. |
| `2xl` | 1536px+ | Wide monitors; max-width bounded content containers. |
| `destructive`| `text-rose-700 bg-rose-50 border-rose-200` | `#BE123C` | QC Rejected, Price Discrepancy |
| `category-api`| `text-purple-700 bg-purple-50 border-purple-200` | `#7E22CE` | API Material Pill Badge |
| `category-exe`| `text-sky-700 bg-sky-50 border-sky-200` | `#0369A1` | Excipient (EXE) Material Pill |
| `category-pm` | `text-teal-700 bg-teal-50 border-teal-200` | `#0F766E` | Packaging Material (PM) Pill |
| `category-con`| `text-slate-700 bg-slate-100 border-slate-300` | `#334155` | Consumables Pill |

---

## 3. Global Navigation & Layout Architecture

The application layout uses an enterprise **Two-Tier App Shell**:

```
+-----------------------------------------------------------------------------------------+
| [=] SCM FLOW   [ Project: PRJ-2026-001 v ]     [Search Cmd+K]    (Bell 3)  [User Avatar] |
+---------------+-------------------------------------------------------------------------+
| [Dashboard]   | Breadcrumbs: Projects > PRJ-2026-001 > Material Requirements (BOM)      |
| [Projects]    +-------------------------------------------------------------------------+
| [Requisitions]|  [ + New Requisition ]  [ Export Excel ]               [ Filter Columns ]|
| [Orders]      +-------------------------------------------------------------------------+
| [Logistics 3*]|  DATA TABLE (Material Code | Category | Required Qty | PR Qty | Status)  |
| [Goods Rcpt]  |  [ MAT-API-01 ] [ API ] [ 500.000 KG ] [ 300.000 KG ] [ Partially Req ]|
| [Invoices]    |  [ MAT-EXE-04 ] [ EXE ] [ 200.000 KG ] [ 200.000 KG ] [ Fully Req    ] |
| [Suppliers]   +-------------------------------------------------------------------------+
| [Approvals 2*]|  Pagination: Showing 1-20 of 142 items          [ < Prev 1 2 3 Next > ] |
| [Settings]    +-------------------------------------------------------------------------+
| [Collapse <]  |  * Logistics has an active alert badge: 2 shipments due within 3 days. |
+---------------+-------------------------------------------------------------------------+
```

### 3.1 Primary Navigation Items & Role Scoping
- **Dashboard:** Executive KPI pulse, spend velocity, 3-day reminder ticker.
- **Projects:** Project workspace, WBS milestones, BOM planning, and financial ledger.
- **Requisitions (PR):** PR workbench, line item consolidation, draft submissions.
- **Orders (PO):** Purchase order generation, vendor issuance, acknowledgment tracking.
- **Logistics & Deliveries:** Dispatch monitoring, tracking numbers, **3-Day Reminder Queue**.
- **Goods Receipt (GRN):** Inward gate entry, quarantine sampling, batch COA sign-off.
- **Invoices & 3-Way Match:** Bill registration, discrepancy analysis, finance sign-off.
- **Suppliers:** Master vendor directory, MSME tracking, compliance status.
- **Approvals (Managerial):** Unified pending queue with dynamic multi-tier authorization controls.
- **Settings & Audit (Super Admin):** Workflow rule builder, user management, audit logs.

### 3.2 Global Command Palette (`Cmd + K` / `Ctrl + K`)
Instant keyboard navigation across the entire enterprise system:
- Quick jump to Project by Code or Title (`PRJ-2026-001`).
- Quick jump to PO by Number (`PO-2026-014`).
- Quick jump to Supplier by Legal Name or GSTIN.
- Quick action: "Create New PR", "Record Gate Entry", "Approve Pending Requests".

---

## 4. Key Page Layouts & UX Patterns

### 4.1 SCM Executive Overview Dashboard
- **Metric Row (KPI Cards):**
  - **Active Projects Count:** Total projects active, completed this quarter.
  - **Approved vs Committed Spend:** Bar with percentage consumption.
  - **3-Day Upcoming Deliveries:** Amber warning card with count of shipments due within 72 hours.
  - **Pending Approvals Queue:** Actionable count requiring current user's review.
- **3-Day Delivery Watchlist Widget:**
  - Compact table listing PO #, Supplier, Material, Promised Delivery Date, and Transporter Contact.
  - Quick action: "Send WhatsApp / Email Ping", "Mark Delayed", "Record Gate Arrival".
- **Spend Velocity Chart:**
  - Monthly time-series comparing Sanctioned Budget vs PO Commitments vs Invoiced Actuals.

### 4.2 Project Workspace (Multi-Tab Master View)
A unified workspace containing tabs:
1. **Overview:** Project metadata, lead contact, schedule progress bar, budget gauge.
2. **Milestones:** Interactive Gantt/timeline and dependency sequence.
3. **Material Requirements (BOM):** Tabular list of materials (API, EXE, PM, Consumables) with split indicators.
4. **Budget & Approvals:** History of budget requests, approval chain progress, variance ledger.
5. **Procurement Pipeline:** Unified view linking BOM line $\to$ PR $\to$ PO $\to$ GRN $\to$ Invoice.
6. **Documents:** Repository of drawings, specs, contracts, and certificates.
7. **Audit Trail:** Chronological record of every field change, author, and timestamp.

---

## 5. High-Density Data Table Architecture

Built on **TanStack Table** with **shadcn/ui** components:

```typescript
// Component: src/components/tables/DataTable.tsx
// Features:
// - Column reordering, visibility toggle, and pinning
// - Multi-column sorting (Shift+Click)
// - Global fuzzy search + column-specific faceted filters (Category, Status, Date Range)
// - Row selection with persistent state across pagination
// - Bulk action toolbar (e.g. "Create Consolidated PR from 5 selected materials")
// - Export to Excel (.xlsx) and CSV
```

---

## 6. Form Architecture & Validation (React Hook Form + Zod)

All data entry forms follow strict patterns:
1. **Schema-First Design:** Form shape and constraints are defined in Zod schemas (`src/features/*/schemas.ts`).
2. **Real-time Client Validation:** Immediate feedback on invalid GSTIN, negative quantities, or milestone date misalignments.
3. **Dirty State & Unsaved Changes Guard:** Browser prompt prevents navigation if form is dirty.
4. **Multi-Step Wizards:** Complex processes (e.g., PO Drafting, Project Initiation) broken into logical 3-step wizards with stepper indicators:
   - Step 1: Header & Commercial Terms.
   - Step 2: Line Items Allocation & Split Distribution.
   - Step 3: Summary, Budget Impact Preview & Final Submission.

---

## 7. Slide-Over Detail Drawers (Sheets)

To maintain context, clicking any row in a data table opens a right-side Slide-Over Sheet (600px width on desktop) showing:
- Entity Header (Code, Status, Creation Date).
- Quick Action Buttons (Edit, Download PDF, View History).
- Tabbed Details (General, Linked Items, Attached Documents, Approval Timeline).
- Keyboard shortcut `Esc` smoothly closes drawer.

---

## 8. Notification & 3-Day Reminder User Experience

- **Notification Center Drawer:** Accessible via header bell icon with unread badge counter.
- **Visual Callout Banners:** When a user opens a PO or Project with a shipment due in 3 days, a sticky amber alert bar renders:
  > **Delivery Alert:** Consignment of 500 KG API (Paracetamol IP) from Apex Chemicals is scheduled for delivery on **17 Nov 2026** (in 3 days). Contact transporter: +91 98765 43210.

