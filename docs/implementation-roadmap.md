# SCM Flow — Phased Implementation Roadmap
**Document ID:** IRM-SCM-006  
**Version:** 1.0.0 (Phase 0 Baseline)  
**Status:** Approved for Implementation Planning  
**Delivery Model:** Phased Milestone Delivery with Enterprise Quality Gates  

---

## 1. Roadmap Overview & Timeline

The implementation of SCM Flow is structured into 9 sequential, well-bounded phases to ensure rigorous testing, data integrity, and compliance at each stage before moving downstream.

```mermaid
gantt
    title SCM Flow Implementation Timeline
    dateFormat  YYYY-MM-DD
    section Foundation
    Phase 0: Architecture & Audit (Current)        :done, p0, 2026-11-03, 2026-11-04
    Phase 1: DB Init, Auth & Master Data           :active, p1, 2026-11-05, 2026-11-12
    section Core Projects
    Phase 2: Projects, Milestones & BOM            :p2, 2026-11-13, 2026-11-20
    Phase 3: Configurable Approvals & Budget       :p3, 2026-11-21, 2026-11-28
    section Procurement & Logistics
    Phase 4: PR, PO & Supplier Confirmation        :p4, 2026-11-29, 2026-12-07
    Phase 5: Logistics & 3-Day Reminder Scheduler  :p5, 2026-12-08, 2026-12-14
    section Receiving & Accounts
    Phase 6: Goods Receipt (GRN) & QC Inspection   :p6, 2026-12-15, 2026-12-22
    Phase 7: Invoice Verification & 3-Way Match    :p7, 2026-12-23, 2026-12-30
    section Finalization
    Phase 8: Project Closure & Internal Hardening  :p8, 2026-12-31, 2027-01-08
```

---

## 2. Phase-by-Phase Detailed Breakdown

### Phase 0: Architecture, Requirements Audit & Schema Specification *(Current Phase)*
- **Primary Objective:** Establish the architectural foundation, confirm business rules, normalize the PostgreSQL database, and produce all technical design specifications.
- **Deliverables:**
  - Complete architecture, database, workflow, permissions, UI/UX, deployment, and testing specifications.
  - Executable PostgreSQL schema file (`backend/supabase/schema.sql`) ready for Supabase execution.
  - Initial frontend and backend directory structure.
- **Acceptance Criteria:** All 8 specification documents created; database design audited; assumptions and open decisions recorded; workspace clean and prepared.

---

### Phase 1: Database Initialization, Supabase Auth, Profiles & Master Data
- **Primary Objective:** Execute Supabase database migration, configure authentication, and build master data interfaces.
- **Key Deliverables:**
  - Execute `schema.sql` in Supabase; verify all tables, indexes, triggers, and RLS policies.
  - Supabase Auth integration: Sign in, password reset, session persistence.
  - Profile management and role assignment for `super_admin`, `scm_admin`, and `scm_team_user`.
  - Master Data UI:
    - **Material Masters:** Filterable catalog for API, EXE, PM, and Consumables with CAS numbers, UOM, and HSN codes.
    - **Suppliers:** Supplier registration with GSTIN, PAN, MSME status, contact persons, and rating.
    - **Departments:** Organization business unit management.
- **Acceptance Criteria:** Users can authenticate; roles determine access; master data can be created, edited, and queried.

---

### Phase 2: Project Management, Milestones & Material Requirements (BOM)
- **Primary Objective:** Build the project workspace, milestone planning, and multi-category material requirement builder.
- **Key Deliverables:**
  - Project creation form with auto-generating project code (`PRJ-YYYY-XXXX`).
  - Milestone Planner with sequence validation and budget estimation.
  - Material Requirement (BOM) Grid: Add items from material master, assign to milestones, specify required quantities and needed-by dates.
  - Real-time BOM estimated cost summary.
- **Acceptance Criteria:** Projects can be drafted with milestones; materials can be assigned with accurate total cost calculations.

---

### Phase 3: Configurable Multi-Tier Approval Engine & Budget Requests
- **Primary Objective:** Implement dynamic, multi-tier approval rules by department and amount, with immutable historical versioning.
- **Key Deliverables:**
  - Administrative Workflow Builder: Create approval chains with step orders, role assignments, and amount thresholds.
  - Workflow Versioning: Automatic snapshot of approval configuration upon submission.
  - Budget Request workflow: Draft $\to$ Submit $\to$ Multi-tier Review $\to$ Sanction.
  - Managerial Pending Approvals Queue with inline action buttons (Approve / Reject with remarks).
- **Acceptance Criteria:** Budget requests route through sequential approvers based on threshold; approved amount updates project `approved_budget`.

---

### Phase 4: Procurement Execution (PR, PO & Supplier Confirmation)
- **Primary Objective:** Enable Purchase Requisitions, multi-item consolidation, Purchase Orders, and vendor order acknowledgments.
- **Key Deliverables:**
  - PR Drafter: Select unrequisitioned materials from project BOM, allocate quantities, submit for sign-off.
  - PO Generator Wizard: Map PR items to selected supplier, calculate GST (18%) and line totals, issue PO with generated PDF.
  - Split Requisition/Order Support: Ensure a single material requirement can be split across multiple PRs and POs.
  - PO Commitment tracking: Update project `po_committed_budget`.
  - Supplier Confirmation Recorder: Capture vendor sales order #, promised dispatch date, and promised delivery date.
- **Acceptance Criteria:** Materials can be requisitioned and ordered; commitments accurately reflect on project financial gauge.

---

### Phase 5: Logistics, Delivery Tracking & 3-Day Reminder Scheduler
- **Primary Objective:** Build shipment tracking and implement the automated 3-day delivery reminder system.
- **Key Deliverables:**
  - Delivery Schedule manager supporting split shipments.
  - Shipment tracker: Transporter name, Docket/LR #, vehicle #, GST E-Way Bill #.
  - **Automated 3-Day Reminder Worker:** Background scheduler checking `delivery_schedules` daily at 06:00 IST (`Asia/Kolkata`) for deliveries due in 3 days.
  - Notification center with in-app banner alerts and email notification queue.
- **Acceptance Criteria:** Deliveries due in 3 calendar days reliably generate reminders and visual alerts in the UI.

---

### Phase 6: Goods Receipt (GRN) & Quality Control Inspection
- **Primary Objective:** Digitize physical consignment inwarding, quarantine holding, batch tracking, and QC test sign-off.
- **Key Deliverables:**
  - Gate Entry & GRN Generator: Inward challan number, vehicle number, gate entry #.
  - Batch & Lot Tracking: Capture batch #, mfg date, expiry date, COA attachment.
  - QC Inspection Module: Accept, reject, or quarantine items with inspection remarks.
  - Update `delivered_quantity` on PO items and project materials.
- **Acceptance Criteria:** Accepted items increment delivered quantities; rejected items produce documented quarantine slips.

---

### Phase 7: Invoice Verification, 3-Way Matching & Financial Ledger
- **Primary Objective:** Implement supplier invoice registration, automated 3-way matching (PO vs GRN vs Invoice), and payment authorization.
- **Key Deliverables:**
  - Vendor Invoice entry form with tax line calculation.
  - **Automated 3-Way Matching Engine:** Calculate $\Delta Q$, $\Delta P$, and $\Delta \text{Total}$.
  - Variance flagging: Automatic hold on price/quantity mismatches; SCM Admin override workflow.
  - Project financial ledger update: Reflect verified amounts in `invoiced_budget`.
- **Acceptance Criteria:** Exact matches auto-clear for payment; discrepancies require audited SCM Admin justification.

---

### Phase 8: Project Closure, Analytics Dashboard & Enterprise Hardening
- **Primary Objective:** Implement project closure audits, executive analytics, and internal server hardening.
- **Key Deliverables:**
  - Project Closure Checklist: Verify zero open POs, complete GRN reconciliation, and final budget variance calculation.
  - SCM Executive Overview Dashboard with spend velocity, KPI cards, and supplier performance metrics.
  - Comprehensive internal Docker Compose deployment configuration with Nginx reverse proxy.
  - End-to-end integration and smoke testing across complete lifecycle.
- **Acceptance Criteria:** Projects can be formally closed with audit seals; system is packaged for turnkey on-premise deployment.

---

## 3. Risk Management & Quality Gates

| Risk Category | Potential Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Financial Over-Commitment** | PO values exceed approved project budget. | Database check constraints and transactional pre-commit validation prevent PO issuance beyond `approved_budget`. |
| **Material Over-Requisitioning** | Team requisitions more material than planned in BOM. | Validation triggers reject PR line item if $\sum \text{PR Qty} > \text{Required Qty}$. |
| **Missed Delivery Reminders** | Server reboot causes cron failure. | Reminder worker uses idempotent date matching; catches up on unflagged deliveries on restart. |
| **Regulatory Non-Compliance (Pharma)** | Unverified API/EXE used without COA. | System blocks GRN QC acceptance unless Certificate of Analysis document is uploaded. |

