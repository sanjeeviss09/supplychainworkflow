# SCM Flow — Enterprise Supply Chain Management System
**Phase 0: Architecture, Requirements Audit & Database Schema Specification**

---

## 1. Project Overview

**SCM Flow** is an enterprise-grade Supply Chain and Project Procurement Management System designed for capital and operational procurement workflows (specifically tailored for pharmaceutical, chemical, and advanced manufacturing operations).

It enforces strict compliance across the full 11-stage SCM lifecycle:
$$\text{Project Creation} \to \text{Milestone Planning} \to \text{Material BOM} \to \text{Budget Approval} \to \text{PR} \to \text{PO} \to \text{Supplier Confirmation} \to \text{Delivery Tracking} \to \text{GRN} \to \text{Invoice 3-Way Match} \to \text{Project Closure}$$

---

## 2. Confirmed Configuration Baseline

- **Base Currency:** Indian Rupee (`INR` / `₹`) with Indian numbering format (`₹ 1,00,000.00`).
- **Default Timezone:** `Asia/Kolkata` (IST, UTC+05:30).
- **Proactive Delivery Reminder:** Exactly **3 Calendar Days** prior to promised delivery date.
- **Material Categories:**
  - `API`: Active Pharmaceutical Ingredient
  - `EXE`: Excipient
  - `PM`: Packaging Material
  - `Consumables`: Consumables & Lab Reagents
- **Roles:**
  - `super_admin`: Super Admin
  - `scm_admin`: SCM Admin
  - `scm_team_user`: SCM Team User
- **Deployment Target:** Internal Enterprise Server (Docker Compose + Nginx).

---

## 3. Project Directory Structure

```
B:\SCM/
├── backend/
│   └── supabase/
│       ├── migrations/
│       │   └── 20261103000000_scm_initial_schema.sql  # Versioned migration
│       └── schema.sql                                  # Standalone copy-paste SQL
├── docs/
│   ├── architecture.md           # System topology, layers & ADRs
│   ├── database-design.md        # 3NF ER diagram, table specs & RLS
│   ├── business-workflows.md     # 11-stage lifecycle, split rules & 3-way match
│   ├── permissions-matrix.md     # Role & entity CRUD permissions, state transitions
│   ├── ui-ux-system.md           # Tokens, navigation, high-density tables & forms
│   ├── implementation-roadmap.md # Phased delivery plan & quality gates
│   ├── deployment.md             # On-premise Docker, Nginx, SSL & pg_cron
│   └── testing-strategy.md       # Vitest, Playwright, pgTAP & financial tests
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/           # shadcn/ui primitives & layouts
│   │   ├── features/             # Domain feature packages
│   │   ├── hooks/                # Reusable React hooks
│   │   ├── lib/                  # Supabase client, Indian Rupee formatters
│   │   ├── pages/                # Route views
│   │   ├── types/                # TypeScript database contracts
│   │   ├── App.tsx               # Root application component
│   │   ├── index.css             # Tailwind design tokens
│   │   └── main.tsx              # DOM entrypoint
│   ├── package.json              # React 18, Vite, Tailwind, TanStack Query
│   ├── tailwind.config.js        # Design tokens configuration
│   ├── tsconfig.json             # TypeScript compiler settings
│   └── vite.config.ts            # Vite bundler configuration
└── README.md
```

---

## 4. How to Paste the SQL into Supabase

1. Open your **Supabase Dashboard** (Cloud or Local/Self-hosted instance at `http://<internal-ip>:8000`).
2. Navigate to **SQL Editor** in the left navigation sidebar.
3. Click **New Query**.
4. Open the file [`backend/supabase/schema.sql`](backend/supabase/schema.sql) in your code editor.
5. Copy the entire contents of `backend/supabase/schema.sql`.
6. Paste into the Supabase SQL Editor and click **Run**.
7. The script will automatically:
   - Create all custom ENUM types (`material_category`, `project_status`, `po_status`, etc.).
   - Create all 24 normalized tables with primary keys, foreign keys, and constraints.
   - Set up automatic `updated_at` triggers and tamper-evident `audit_logs` triggers.
   - Create performance indexes (including the 3-day reminder scheduler index).
   - Enable Row Level Security (RLS) on all tables with explicit role-based policies.
   - Seed the 3 roles (`super_admin`, `scm_admin`, `scm_team_user`) and initial departments.

