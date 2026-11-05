# SCM Flow — Deployment Guide: Vercel (Frontend) & Render (Backend)

This document describes how to deploy the **SCM Flow Enterprise** platform to **Vercel** (Frontend) and **Render** (Backend & Database).

---

## 1. Architecture Overview

```
┌─────────────────────────────────┐
│     Vercel (Frontend SPA)       │
│  React 18 + Vite + TailwindCSS  │
│     URL: https://<app>.vercel.app│
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│     Render (Backend Service)    │
│    Node.js / Express Gateway    │
│    URL: https://<api>.onrender.com
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│    Render Managed PostgreSQL    │
│     24 Tables + 12 Migrations   │
│     RLS + Triggers + Audit Logs │
└─────────────────────────────────┘
```

---

## 2. Deploying Frontend to Vercel

### Option A: Import via Vercel Dashboard (Recommended)

1. Open [vercel.com](https://vercel.com) and log in.
2. Click **Add New...** -> **Project**.
3. Select your GitHub repository: `sanjeeviss09/supplychainworkflow`.
4. Configure the Project Settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** Click `Edit` and select `frontend` (or leave as root, as `vercel.json` is configured at root as well).
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Under **Environment Variables**, add:
   | Variable | Value | Description |
   |---|---|---|
   | `VITE_SUPABASE_URL` | `https://<your-supabase-or-render-api>` | Backend or Supabase API URL |
   | `VITE_SUPABASE_ANON_KEY` | `<your-anon-key>` | Public Anon Token |
6. Click **Deploy**. Vercel will build and provide your production URL (e.g. `https://supplychainworkflow.vercel.app`).

---

## 3. Deploying Backend to Render

### Option A: 1-Click Render Blueprint (Recommended)

This repository includes a [`render.yaml`](render.yaml) blueprint that automatically provisions both the **Node.js Web Service** and the **Managed PostgreSQL Database**.

1. Log into [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** -> **Blueprint**.
3. Connect your GitHub repository: `sanjeeviss09/supplychainworkflow`.
4. Render will read `render.yaml` and show:
   - **Service:** `scm-flow-backend` (Node.js Web Service)
   - **Database:** `scm-flow-db` (PostgreSQL 16)
5. Click **Apply**.
6. Once deployed:
   - Access health check: `https://<your-backend>.onrender.com/health`
   - Access system info: `https://<your-backend>.onrender.com/api/info`

### Option B: Applying Database Schema on Render

To apply the SCM Flow database schema:
1. In the Render Dashboard, click on your PostgreSQL database `scm-flow-db`.
2. Under **Connections**, copy the **External Database URL**.
3. Run the migration script locally:
   ```bash
   cd backend
   npm install
   DATABASE_URL="<your-render-database-url>" npm run migrate
   ```
   Or use the Render Web Shell on the service:
   ```bash
   npm run migrate
   ```

---

## 4. Default Enterprise Credentials & Roles

| Role | Employee ID | Default Password | Initial Permissions |
|---|---|---|---|
| **Super Admin** | `AXX09` | `admin123` | Full access across all 12 modules |
| **SCM Admin** | `EMP-1001` | `admin123` | Department & supplier management, tracking, planning |
| **SCM Team User** | `EMP-1002` | `admin123` | Delivery execution, delay logging, issue raising |

