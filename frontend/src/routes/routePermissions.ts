import { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  User,
  FolderKanban,
  FileSpreadsheet,
  Building2,
  TrendingUp,
  Coins,
  ShoppingCart,
  Truck,
  CalendarClock,
  AlertTriangle,
  AlertOctagon,
  FileText,
  BarChart3,
  Users,
  History,
  Shield,
  Settings,
} from 'lucide-react';
import { PermissionId, UserRole } from '@/types/database.types';

export type PermissionRuleMode =
  | 'authenticated_active_only'
  | 'single'
  | 'any'
  | 'all';

export interface RouteConfig {
  path: string;
  title: string;
  navTitle?: string;
  requiredPermissions?: PermissionId[];
  ruleMode: PermissionRuleMode;
  inNav?: boolean;
  navOrder?: number;
  icon?: LucideIcon;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'destructive' | 'outline';
}

/**
 * Authoritative Route-to-Permission Registry for SCM Flow.
 * Enforces DEFAULT-DENY least-privilege access across route guards and role-aware navigation.
 */
export const ROUTE_REGISTRY: Record<string, RouteConfig> = {
  // Base dashboard
  '/app/dashboard': {
    path: '/app/dashboard',
    title: 'Dashboard',
    navTitle: 'Dashboard',
    ruleMode: 'authenticated_active_only',
    inNav: true,
    navOrder: 1,
    icon: LayoutDashboard,
  },
  // User profile
  '/app/profile': {
    path: '/app/profile',
    title: 'Employee Profile',
    navTitle: 'Profile',
    requiredPermissions: ['profile.view.self'],
    ruleMode: 'single',
    inNav: false,
    icon: User,
  },
  // Projects Module
  '/app/projects': {
    path: '/app/projects',
    title: 'Projects & Milestone Planning',
    navTitle: 'Projects',
    requiredPermissions: ['projects.view'],
    ruleMode: 'single',
    inNav: true,
    navOrder: 2,
    icon: FolderKanban,
  },
  '/app/projects/new': {
    path: '/app/projects/new',
    title: 'Create Project',
    requiredPermissions: ['projects.create'],
    ruleMode: 'single',
    inNav: false,
  },
  '/app/projects/:projectId': {
    path: '/app/projects/:projectId',
    title: 'Project Overview',
    requiredPermissions: ['projects.view'],
    ruleMode: 'single',
    inNav: false,
  },
  '/app/projects/:projectId/edit': {
    path: '/app/projects/:projectId/edit',
    title: 'Edit Project',
    requiredPermissions: ['projects.update'],
    ruleMode: 'single',
    inNav: false,
  },
  '/app/projects/:projectId/milestones': {
    path: '/app/projects/:projectId/milestones',
    title: 'Milestone Management',
    requiredPermissions: ['milestones.view'],
    ruleMode: 'single',
    inNav: false,
  },
  // Materials
  '/app/materials': {
    path: '/app/materials',
    title: 'Material Requirements (BOM)',
    navTitle: 'Materials',
    requiredPermissions: ['materials.view'],
    ruleMode: 'single',
    inNav: true,
    navOrder: 3,
    icon: FileSpreadsheet,
    badge: 'BOM',
    badgeVariant: 'success',
  },
  // Suppliers Module (Phase 6)
  '/app/suppliers': {
    path: '/app/suppliers',
    title: 'Supplier Catalog & Directory',
    navTitle: 'Suppliers',
    requiredPermissions: ['suppliers.view'],
    ruleMode: 'single',
    inNav: true,
    navOrder: 4,
    icon: Building2,
  },
  '/app/suppliers/new': {
    path: '/app/suppliers/new',
    title: 'Register Supplier',
    requiredPermissions: ['suppliers.create'],
    ruleMode: 'single',
    inNav: false,
  },
  '/app/suppliers/:supplierId': {
    path: '/app/suppliers/:supplierId',
    title: 'Supplier Master Details',
    requiredPermissions: ['suppliers.view'],
    ruleMode: 'single',
    inNav: false,
  },
  '/app/suppliers/:supplierId/edit': {
    path: '/app/suppliers/:supplierId/edit',
    title: 'Edit Supplier',
    requiredPermissions: ['suppliers.update'],
    ruleMode: 'single',
    inNav: false,
  },
  '/app/suppliers/performance': {
    path: '/app/suppliers/performance',
    title: 'Supplier Delivery Performance & Scorecards',
    navTitle: 'Supplier Performance',
    requiredPermissions: ['supplier_performance.view', 'suppliers.view'],
    ruleMode: 'any',
    inNav: true,
    navOrder: 4,
    icon: TrendingUp,
    badge: 'Scorecards',
    badgeVariant: 'success',
  },
  // Deliveries (Phase 7 Material Delivery Tracking)
  '/app/deliveries': {
    path: '/app/deliveries',
    title: 'Material Delivery Tracking & SAP References',
    navTitle: 'Delivery Tracking',
    requiredPermissions: ['deliveries.view', 'delivery_tracking.view'],
    ruleMode: 'any',
    inNav: true,
    navOrder: 5,
    icon: Truck,
    badge: 'SAP Tracking',
    badgeVariant: 'success',
  },
  '/app/deliveries/my-assigned': {
    path: '/app/deliveries/my-assigned',
    title: 'My Assigned Deliveries',
    requiredPermissions: ['delivery_tracking.view'],
    ruleMode: 'single',
    inNav: false,
  },
  '/app/deliveries/sap-references': {
    path: '/app/deliveries/sap-references',
    title: 'SAP PR & PO Reference Management',
    requiredPermissions: ['sap_references.view'],
    ruleMode: 'single',
    inNav: false,
  },
  '/app/deliveries/sap-references/new': {
    path: '/app/deliveries/sap-references/new',
    title: 'Register SAP PO Reference',
    requiredPermissions: ['sap_references.create'],
    ruleMode: 'single',
    inNav: false,
  },
  '/app/deliveries/reports': {
    path: '/app/deliveries/reports',
    title: 'Delivery & Delay Reporting',
    requiredPermissions: ['delivery_reports.view'],
    ruleMode: 'single',
    inNav: false,
  },
  '/app/deliveries/:trackingId': {
    path: '/app/deliveries/:trackingId',
    title: 'Material Delivery Tracking Details',
    requiredPermissions: ['delivery_tracking.view'],
    ruleMode: 'single',
    inNav: false,
  },
  // Phase 9 Delivery Issues & Escalations
  '/app/deliveries/issues': {
    path: '/app/deliveries/issues',
    title: 'Delivery Issues & Escalations',
    navTitle: 'Delivery Issues',
    requiredPermissions: ['delivery_issues.view', 'deliveries.view'],
    ruleMode: 'any',
    inNav: true,
    navOrder: 7,
    icon: AlertTriangle,
    badge: 'Escalations',
    badgeVariant: 'success',
  },
  '/app/deliveries/issues/:issueId': {
    path: '/app/deliveries/issues/:issueId',
    title: 'Delivery Issue Details',
    requiredPermissions: ['delivery_issues.view', 'deliveries.view'],
    ruleMode: 'any',
    inNav: false,
  },
  // Phase 10 Incoming Delivery Planning & Calendar
  '/app/deliveries/planning': {
    path: '/app/deliveries/planning',
    title: 'Incoming Delivery Planning & Schedule Calendar',
    navTitle: 'Delivery Planning',
    requiredPermissions: ['delivery_planning.view', 'deliveries.view'],
    ruleMode: 'any',
    inNav: true,
    navOrder: 6,
    icon: CalendarClock,
    badge: 'Schedule',
    badgeVariant: 'success',
  },
  // Phase 11 Material Supply Risk
  '/app/deliveries/risks': {
    path: '/app/deliveries/risks',
    title: 'Material Supply Risk & Criticality Management',
    navTitle: 'Supply Risks',
    requiredPermissions: ['supply_risk.view', 'deliveries.view'],
    ruleMode: 'any',
    inNav: true,
    navOrder: 8,
    icon: AlertOctagon,
    badge: 'Risks',
    badgeVariant: 'success',
  },
  '/app/deliveries/risks/:riskId': {
    path: '/app/deliveries/risks/:riskId',
    title: 'Supply Risk Assessment Details',
    requiredPermissions: ['supply_risk.view', 'deliveries.view'],
    ruleMode: 'any',
    inNav: false,
  },
  // Phase 12 Documents Module
  '/app/documents': {
    path: '/app/documents',
    title: 'SCM Document Repository & Expiry Tracking',
    navTitle: 'Document Vault',
    requiredPermissions: ['documents.view', 'suppliers.view'],
    ruleMode: 'any',
    inNav: true,
    navOrder: 9,
    icon: FileText,
    badge: 'Vault',
    badgeVariant: 'success',
  },
  '/app/documents/:documentId': {
    path: '/app/documents/:documentId',
    title: 'Document Details & Versions',
    requiredPermissions: ['documents.view', 'suppliers.view'],
    ruleMode: 'any',
    inNav: false,
  },
  // Analytical Reports (Consolidated Phases 7–12)
  '/app/reports': {
    path: '/app/reports',
    title: 'SCM Analytical Reports & Performance Dashboard',
    navTitle: 'Analytical Reports',
    requiredPermissions: ['reports.view'],
    ruleMode: 'single',
    inNav: true,
    navOrder: 10,
    icon: BarChart3,
    badge: 'Analytics',
    badgeVariant: 'success',
  },
  // Budgets & Approvals
  '/app/budgets-approvals': {
    path: '/app/budgets-approvals',
    title: 'Budgets & Approval Workflows',
    navTitle: 'Budgets & Approvals',
    requiredPermissions: ['budgets.view', 'approvals.view'],
    ruleMode: 'any',
    inNav: true,
    navOrder: 11,
    icon: Coins,
    badge: 'Governance',
    badgeVariant: 'success',
  },
  // Procurement
  '/app/procurement': {
    path: '/app/procurement',
    title: 'Procurement (PR & PO Execution)',
    navTitle: 'Procurement',
    requiredPermissions: ['procurement.view'],
    ruleMode: 'single',
    inNav: true,
    navOrder: 12,
    icon: ShoppingCart,
    badge: 'PR / PO',
    badgeVariant: 'success',
  },
  // Administration: Employee Directory
  '/app/admin/employees': {
    path: '/app/admin/employees',
    title: 'Employee Access Directory',
    navTitle: 'Employee Management',
    requiredPermissions: ['employees.manage'],
    ruleMode: 'single',
    inNav: true,
    navOrder: 14,
    icon: Users,
  },
  // Administration: Import History
  '/app/admin/imports': {
    path: '/app/admin/imports',
    title: 'Employee Import Batches',
    navTitle: 'Employee Import History',
    requiredPermissions: ['employees.import'],
    ruleMode: 'single',
    inNav: true,
    navOrder: 15,
    icon: History,
  },
  // Administration: Audit Log
  '/app/admin/audit-log': {
    path: '/app/admin/audit-log',
    title: 'Immutable Security Audit Log',
    navTitle: 'Audit Log',
    requiredPermissions: ['audit.view'],
    ruleMode: 'single',
    inNav: true,
    navOrder: 16,
    icon: Shield,
  },
  // Settings Landing (Accessible if user has ANY settings capability)
  '/app/settings': {
    path: '/app/settings',
    title: 'System & SCM Settings',
    navTitle: 'Settings',
    requiredPermissions: ['settings.system.manage', 'settings.scm.manage'],
    ruleMode: 'any',
    inNav: true,
    navOrder: 17,
    icon: Settings,
  },
  // Sub-setting: System Configuration (Super Admin)
  '/app/settings/system': {
    path: '/app/settings/system',
    title: 'System Configuration',
    requiredPermissions: ['settings.system.manage'],
    ruleMode: 'single',
    inNav: false,
  },
  // Sub-setting: SCM Configuration (SCM Admin & Super Admin)
  '/app/settings/scm': {
    path: '/app/settings/scm',
    title: 'SCM Business Configuration',
    requiredPermissions: ['settings.scm.manage'],
    ruleMode: 'single',
    inNav: false,
  },
};

/**
 * Public routes that do not require an active employee session or permission.
 */
export const PUBLIC_ROUTES: ReadonlySet<string> = new Set([
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/403',
  '/404',
]);

function resolveRouteConfig(normalizedPath: string): RouteConfig | undefined {
  if (ROUTE_REGISTRY[normalizedPath]) {
    return ROUTE_REGISTRY[normalizedPath];
  }

  // Check dynamic project sub-routes
  if (normalizedPath === '/app/projects/new') {
    return ROUTE_REGISTRY['/app/projects/new'];
  }

  if (/^\/app\/projects\/[^/]+\/edit$/.test(normalizedPath)) {
    return ROUTE_REGISTRY['/app/projects/:projectId/edit'];
  }

  if (/^\/app\/projects\/[^/]+\/milestones$/.test(normalizedPath)) {
    return ROUTE_REGISTRY['/app/projects/:projectId/milestones'];
  }

  if (/^\/app\/projects\/[^/]+$/.test(normalizedPath)) {
    return ROUTE_REGISTRY['/app/projects/:projectId'];
  }

  return undefined;
}

/**
 * Evaluates whether an authenticated active employee with given permissions is authorized for a route.
 * Follows DEFAULT-DENY principle: if the route is protected and has no valid rule, access is denied.
 */
export function canAccessRoute(
  routePath: string,
  userPermissions: PermissionId[] = [],
  isActiveEmployee: boolean = true
): boolean {
  if (!isActiveEmployee) {
    return false;
  }

  // Normalize path (strip trailing slash)
  const normalizedPath = routePath.endsWith('/') && routePath.length > 1
    ? routePath.slice(0, -1)
    : routePath;

  if (normalizedPath === '/app') {
    return true; // Redirects to /app/dashboard
  }

  const config = resolveRouteConfig(normalizedPath);
  if (!config) {
    // Unregistered protected route: default deny
    return false;
  }

  if (config.ruleMode === 'authenticated_active_only') {
    return true;
  }

  const req = config.requiredPermissions || [];
  if (req.length === 0) {
    return false;
  }

  const permSet = new Set<string>(userPermissions);

  if (config.ruleMode === 'single') {
    return permSet.has(req[0]);
  }

  if (config.ruleMode === 'any') {
    return req.some((p) => permSet.has(p));
  }

  if (config.ruleMode === 'all') {
    return req.every((p) => permSet.has(p));
  }

  return false;
}

/**
 * Returns filtered, authorized navigation items sorted by navOrder.
 */
export function getAuthorizedNavItems(
  userPermissions: PermissionId[] = [],
  isActiveEmployee: boolean = true
): RouteConfig[] {
  if (!isActiveEmployee) {
    return [];
  }

  return Object.values(ROUTE_REGISTRY)
    .filter((item) => item.inNav)
    .filter((item) => canAccessRoute(item.path, userPermissions, isActiveEmployee))
    .sort((a, b) => (a.navOrder || 99) - (b.navOrder || 99));
}

