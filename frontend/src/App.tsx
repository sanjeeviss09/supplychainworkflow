import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthContext';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute, PermissionRouteGuard, PublicOnlyRoute } from '@/routes/Guards';

// Public & Auth Pages
import { LoginPage } from '@/pages/auth/LoginPage';
import { SignupPage } from '@/pages/auth/SignupPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { ForbiddenPage } from '@/pages/error/ForbiddenPage';
import { NotFoundPage } from '@/pages/error/NotFoundPage';

// Authenticated Application Pages
import { DashboardPage } from '@/pages/DashboardPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { ProjectListPage } from '@/pages/projects/ProjectListPage';
import { ProjectCreatePage } from '@/pages/projects/ProjectCreatePage';
import { ProjectDetailPage } from '@/pages/projects/ProjectDetailPage';
import { ProjectEditPage } from '@/pages/projects/ProjectEditPage';
import { ProjectMilestonesPage } from '@/pages/projects/ProjectMilestonesPage';
import { SupplierListPage } from '@/pages/suppliers/SupplierListPage';
import { SupplierCreatePage } from '@/pages/suppliers/SupplierCreatePage';
import { SupplierDetailPage } from '@/pages/suppliers/SupplierDetailPage';
import { SupplierEditPage } from '@/pages/suppliers/SupplierEditPage';
import { SupplierPerformancePage } from '@/pages/suppliers/SupplierPerformancePage';
import { DeliveryDashboardPage } from '@/pages/deliveries/DeliveryDashboardPage';
import { MyAssignedDeliveriesPage } from '@/pages/deliveries/MyAssignedDeliveriesPage';
import { SapReferencesPage } from '@/pages/deliveries/SapReferencesPage';
import { SapPoRegisterPage } from '@/pages/deliveries/SapPoRegisterPage';
import { DeliveryIssueListPage } from '@/pages/deliveries/DeliveryIssueListPage';
import { DeliveryIssueDetailPage } from '@/pages/deliveries/DeliveryIssueDetailPage';
import { DeliveryPlanningPage } from '@/pages/deliveries/DeliveryPlanningPage';
import { SupplyRiskListPage } from '@/pages/deliveries/SupplyRiskListPage';
import { SupplyRiskDetailPage } from '@/pages/deliveries/SupplyRiskDetailPage';
import { DocumentListPage } from '@/pages/documents/DocumentListPage';
import { DocumentDetailPage } from '@/pages/documents/DocumentDetailPage';
import { BudgetsApprovalsPage } from '@/pages/BudgetsApprovalsPage';
import { EmployeesPage } from '@/pages/admin/EmployeesPage';
import { EmployeeImportsPage } from '@/pages/admin/EmployeeImportsPage';
import { AuditLogsPage } from '@/pages/admin/AuditLogsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { SystemSettingsPage } from '@/pages/settings/SystemSettingsPage';
import { ScmSettingsPage } from '@/pages/settings/ScmSettingsPage';
import { PlaceholderModulePage } from '@/pages/PlaceholderModulePage';
import { useAuth } from '@/context/AuthContext';

function RootRedirect() {
  const { user, is_active } = useAuth();
  if (user && is_active) {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <Navigate to="/login" replace />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            {/* ===============================================================
                1. PUBLIC ROUTES (Auth & Status Pages)
               =============================================================== */}
            <Route element={<PublicLayout />}>
              <Route
                path="/login"
                element={
                  <PublicOnlyRoute>
                    <LoginPage />
                  </PublicOnlyRoute>
                }
              />
              <Route
                path="/signup"
                element={
                  <PublicOnlyRoute>
                    <SignupPage />
                  </PublicOnlyRoute>
                }
              />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/403" element={<ForbiddenPage />} />
              <Route path="/404" element={<NotFoundPage />} />
            </Route>

            {/* ===============================================================
                2. AUTHENTICATED APPLICATION ROUTES (/app/...)
               =============================================================== */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              {/* /app redirects directly to /app/dashboard */}
              <Route index element={<Navigate to="/app/dashboard" replace />} />

              {/* /app/dashboard (Authenticated active employee) */}
              <Route
                path="dashboard"
                element={
                  <PermissionRouteGuard routePath="/app/dashboard">
                    <DashboardPage />
                  </PermissionRouteGuard>
                }
              />

              {/* /app/profile (profile.view.self) */}
              <Route
                path="profile"
                element={
                  <PermissionRouteGuard routePath="/app/profile">
                    <ProfilePage />
                  </PermissionRouteGuard>
                }
              />

              {/* /app/projects (projects.view) */}
              <Route
                path="projects"
                element={
                  <PermissionRouteGuard routePath="/app/projects">
                    <ProjectListPage />
                  </PermissionRouteGuard>
                }
              />
              <Route
                path="projects/new"
                element={
                  <PermissionRouteGuard routePath="/app/projects/new">
                    <ProjectCreatePage />
                  </PermissionRouteGuard>
                }
              />
              <Route
                path="projects/:projectId"
                element={
                  <PermissionRouteGuard routePath="/app/projects/:projectId">
                    <ProjectDetailPage />
                  </PermissionRouteGuard>
                }
              />
              <Route
                path="projects/:projectId/edit"
                element={
                  <PermissionRouteGuard routePath="/app/projects/:projectId/edit">
                    <ProjectEditPage />
                  </PermissionRouteGuard>
                }
              />
              <Route
                path="projects/:projectId/milestones"
                element={
                  <PermissionRouteGuard routePath="/app/projects/:projectId/milestones">
                    <ProjectMilestonesPage />
                  </PermissionRouteGuard>
                }
              />

              {/* /app/materials (materials.view) */}
              <Route
                path="materials"
                element={
                  <PermissionRouteGuard routePath="/app/materials">
                    <PlaceholderModulePage
                      title="Material Requirements (BOM)"
                      phase="Phase 4"
                      description="Bill of Materials creation across approved classifications (API, EXE, PM, Consumables) with CAS and HSN master references."
                      keyFeatures={[
                        'BOM items mapped to specific project milestones',
                        '4 approved material categories (API, EXE, PM, Consumables)',
                        'Quantity requirements and needed-by date scheduler',
                        'CAS & HSN reference code catalog lookup',
                      ]}
                    />
                  </PermissionRouteGuard>
                }
              />

              {/* /app/suppliers (suppliers.view) */}
              <Route
                path="suppliers"
                element={
                  <PermissionRouteGuard routePath="/app/suppliers">
                    <SupplierListPage />
                  </PermissionRouteGuard>
                }
              />
              <Route
                path="suppliers/new"
                element={
                  <PermissionRouteGuard routePath="/app/suppliers/new">
                    <SupplierCreatePage />
                  </PermissionRouteGuard>
                }
              />
              <Route
                path="suppliers/performance"
                element={
                  <PermissionRouteGuard routePath="/app/suppliers/performance">
                    <SupplierPerformancePage />
                  </PermissionRouteGuard>
                }
              />
              <Route
                path="suppliers/:supplierId"
                element={
                  <PermissionRouteGuard routePath="/app/suppliers/:supplierId">
                    <SupplierDetailPage />
                  </PermissionRouteGuard>
                }
              />
              <Route
                path="suppliers/:supplierId/edit"
                element={
                  <PermissionRouteGuard routePath="/app/suppliers/:supplierId/edit">
                    <SupplierEditPage />
                  </PermissionRouteGuard>
                }
              />

              {/* /app/budgets-approvals (budgets.view OR approvals.view) */}
              <Route
                path="budgets-approvals"
                element={
                  <PermissionRouteGuard routePath="/app/budgets-approvals">
                    <BudgetsApprovalsPage />
                  </PermissionRouteGuard>
                }
              />

              {/* /app/procurement (procurement.view) */}
              <Route
                path="procurement"
                element={
                  <PermissionRouteGuard routePath="/app/procurement">
                    <PlaceholderModulePage
                      title="Procurement (PR & PO Execution)"
                      phase="Phase 5"
                      description="Material requisition drafting (PR), multi-split quantity allocation, vendor Purchase Order generation (PO), and order acknowledgment."
                      keyFeatures={[
                        'Consolidated multi-line PR drafting from BOM',
                        'Multi-tier sequential approval workflow routing',
                        '18% GST tax calculation and commercial terms',
                        'Digital Purchase Order issuance with acknowledgment tracking',
                      ]}
                    />
                  </PermissionRouteGuard>
                }
              />

              {/* /app/deliveries (deliveries.view OR delivery_tracking.view) */}
              <Route
                path="deliveries"
                element={
                  <PermissionRouteGuard routePath="/app/deliveries">
                    <DeliveryDashboardPage />
                  </PermissionRouteGuard>
                }
              />
              <Route
                path="deliveries/my-assigned"
                element={
                  <PermissionRouteGuard routePath="/app/deliveries/my-assigned">
                    <MyAssignedDeliveriesPage />
                  </PermissionRouteGuard>
                }
              />
              <Route
                path="deliveries/sap-references"
                element={
                  <PermissionRouteGuard routePath="/app/deliveries/sap-references">
                    <SapReferencesPage />
                  </PermissionRouteGuard>
                }
              />
              <Route
                path="deliveries/sap-references/new"
                element={
                  <PermissionRouteGuard routePath="/app/deliveries/sap-references/new">
                    <SapPoRegisterPage />
                  </PermissionRouteGuard>
                }
              />
              <Route
                path="deliveries/issues"
                element={
                  <PermissionRouteGuard routePath="/app/deliveries/issues">
                    <DeliveryIssueListPage />
                  </PermissionRouteGuard>
                }
              />
              <Route
                path="deliveries/issues/:issueId"
                element={
                  <PermissionRouteGuard routePath="/app/deliveries/issues/:issueId">
                    <DeliveryIssueDetailPage />
                  </PermissionRouteGuard>
                }
              />
              <Route
                path="deliveries/planning"
                element={
                  <PermissionRouteGuard routePath="/app/deliveries/planning">
                    <DeliveryPlanningPage />
                  </PermissionRouteGuard>
                }
              />
              <Route
                path="deliveries/risks"
                element={
                  <PermissionRouteGuard routePath="/app/deliveries/risks">
                    <SupplyRiskListPage />
                  </PermissionRouteGuard>
                }
              />
              <Route
                path="deliveries/risks/:riskId"
                element={
                  <PermissionRouteGuard routePath="/app/deliveries/risks/:riskId">
                    <SupplyRiskDetailPage />
                  </PermissionRouteGuard>
                }
              />

              {/* /app/documents (documents.view) */}
              <Route
                path="documents"
                element={
                  <PermissionRouteGuard routePath="/app/documents">
                    <DocumentListPage />
                  </PermissionRouteGuard>
                }
              />
              <Route
                path="documents/:documentId"
                element={
                  <PermissionRouteGuard routePath="/app/documents/:documentId">
                    <DocumentDetailPage />
                  </PermissionRouteGuard>
                }
              />

              {/* /app/reports (reports.view) */}
              <Route
                path="reports"
                element={
                  <PermissionRouteGuard routePath="/app/reports">
                    <PlaceholderModulePage
                      title="SCM Analytical Reports"
                      phase="Phase 7"
                      description="End-to-end supply chain operational reports, procurement cycle times, vendor on-time delivery metrics, and price variance analysis."
                      keyFeatures={[
                        'Vendor performance and on-time delivery ratings',
                        'Budget vs Actual vs Invoiced financial reconciliation',
                        'Material consumption velocity reports',
                        'Compliance and audit export reports',
                      ]}
                    />
                  </PermissionRouteGuard>
                }
              />

              {/* /app/admin/employees (employees.manage) */}
              <Route
                path="admin/employees"
                element={
                  <PermissionRouteGuard routePath="/app/admin/employees">
                    <EmployeesPage />
                  </PermissionRouteGuard>
                }
              />

              {/* /app/admin/imports (employees.import) */}
              <Route
                path="admin/imports"
                element={
                  <PermissionRouteGuard routePath="/app/admin/imports">
                    <EmployeeImportsPage />
                  </PermissionRouteGuard>
                }
              />

              {/* /app/admin/audit-log (audit.view) */}
              <Route
                path="admin/audit-log"
                element={
                  <PermissionRouteGuard routePath="/app/admin/audit-log">
                    <AuditLogsPage />
                  </PermissionRouteGuard>
                }
              />

              {/* /app/settings (settings.system.manage OR settings.scm.manage) */}
              <Route
                path="settings"
                element={
                  <PermissionRouteGuard routePath="/app/settings">
                    <SettingsPage />
                  </PermissionRouteGuard>
                }
              />

              {/* /app/settings/system (settings.system.manage) */}
              <Route
                path="settings/system"
                element={
                  <PermissionRouteGuard routePath="/app/settings/system">
                    <SystemSettingsPage />
                  </PermissionRouteGuard>
                }
              />

              {/* /app/settings/scm (settings.scm.manage) */}
              <Route
                path="settings/scm"
                element={
                  <PermissionRouteGuard routePath="/app/settings/scm">
                    <ScmSettingsPage />
                  </PermissionRouteGuard>
                }
              />
            </Route>

            {/* Root redirect to /app/dashboard or /login based on auth status */}
            <Route path="/" element={<RootRedirect />} />

            {/* Legacy path redirects for backwards compatibility */}
            <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
            <Route path="/admin/employees" element={<Navigate to="/app/admin/employees" replace />} />
            <Route path="/admin/audit-logs" element={<Navigate to="/app/admin/audit-log" replace />} />

            {/* Catch-all unknown routes -> /404 */}
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
