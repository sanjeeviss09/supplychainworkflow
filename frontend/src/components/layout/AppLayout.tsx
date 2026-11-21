import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { getAuthorizedNavItems, ROUTE_REGISTRY, RouteConfig } from '@/routes/routePermissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LogOut,
  Menu,
  X,
  ChevronRight,
  AlertCircle,
  Search,
  Bell,
  Boxes,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Home,
} from 'lucide-react';
import {
  AppNotification,
  fetchUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/services/notificationService';

interface NavGroup {
  label: string;
  paths: string[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    paths: ['/app/dashboard'],
  },
  {
    label: 'Planning & Master',
    paths: ['/app/projects', '/app/materials', '/app/suppliers', '/app/suppliers/performance'],
  },
  {
    label: 'Delivery & Risk',
    paths: [
      '/app/deliveries',
      '/app/deliveries/planning',
      '/app/deliveries/issues',
      '/app/deliveries/risks',
    ],
  },
  {
    label: 'Procurement & Vault',
    paths: ['/app/procurement', '/app/budgets-approvals', '/app/documents', '/app/reports'],
  },
  {
    label: 'Administration',
    paths: ['/app/admin/employees', '/app/admin/imports', '/app/admin/audit-log', '/app/settings'],
  },
];

export function AppLayout() {
  const { user, employee, role, permissions, is_active, logout, mustChangePassword } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const searchRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (user) {
      fetchUserNotifications().then(setNotifications);
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenNotifications = async () => {
    const nextState = !notificationsOpen;
    setNotificationsOpen(nextState);
    if (nextState) {
      const items = await fetchUserNotifications();
      setNotifications(items);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItems = useMemo(
    () => getAuthorizedNavItems(permissions, is_active),
    [permissions, is_active]
  );

  // Organize authorized nav items into clean sections
  const groupedNav = useMemo(() => {
    const byPath = new Map<string, RouteConfig>();
    navItems.forEach((item) => byPath.set(item.path, item));

    const assigned = new Set<string>();
    const sections = NAV_GROUPS.map((group) => {
      const items = group.paths
        .map((p) => byPath.get(p))
        .filter((x): x is RouteConfig => Boolean(x));
      items.forEach((i) => assigned.add(i.path));
      return { label: group.label, items };
    }).filter((s) => s.items.length > 0);

    const remaining = navItems.filter((i) => !assigned.has(i.path));
    if (remaining.length > 0) {
      sections.push({ label: 'Modules', items: remaining });
    }
    return sections;
  }, [navItems]);

  // Quick-jump global search matches
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return navItems.slice(0, 6);
    return navItems
      .filter(
        (item) =>
          (item.navTitle || item.title).toLowerCase().includes(q) ||
          item.title.toLowerCase().includes(q) ||
          item.path.toLowerCase().includes(q)
      )
      .slice(0, 7);
  }, [searchQuery, navItems]);

  const getRoleDisplayName = (r: string | null | undefined) => {
    switch (r) {
      case 'super_admin':
        return 'Super Admin';
      case 'scm_admin':
        return 'SCM Admin';
      case 'scm_team_user':
        return 'SCM User';
      default:
        return 'Member';
    }
  };

  const getRoleBadgeVariant = (r: string | null | undefined) => {
    switch (r) {
      case 'super_admin':
        return 'super_admin';
      case 'scm_admin':
        return 'scm_admin';
      default:
        return 'scm_team_user';
    }
  };

  const currentRouteConfig = ROUTE_REGISTRY[location.pathname];
  const currentPageTitle =
    currentRouteConfig?.navTitle ||
    currentRouteConfig?.title ||
    location.pathname
      .replace('/app/', '')
      .split('/')[0]
      .replace(/-/g, ' ');

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const isNavActive = (path: string) => {
    if (path === '/app/dashboard') return location.pathname === '/app/dashboard';
    if (path === '/app/deliveries') {
      return (
        location.pathname === '/app/deliveries' ||
        (location.pathname.startsWith('/app/deliveries/') &&
          !location.pathname.startsWith('/app/deliveries/issues') &&
          !location.pathname.startsWith('/app/deliveries/planning') &&
          !location.pathname.startsWith('/app/deliveries/risks'))
      );
    }
    if (path === '/app/suppliers') {
      return (
        location.pathname === '/app/suppliers' ||
        (location.pathname.startsWith('/app/suppliers/') &&
          !location.pathname.startsWith('/app/suppliers/performance'))
      );
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <div className="flex min-h-screen bg-ivory text-ink-primary font-sans antialiased">
      {/* Desktop Sidebar — Refined Deep Emerald Rail */}
      <aside
        className={`hidden lg:flex lg:flex-col shrink-0 bg-gradient-to-b from-forest via-forest to-forest-deep text-white border-r border-forest-deep/80 shadow-warm-lg z-30 transition-all duration-200 ${
          sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-[252px]'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
          <Link to="/app/dashboard" className="flex items-center space-x-2.5 group min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 border border-emerald-300/25 text-emerald-300 shadow-inner group-hover:bg-emerald-400/25 transition-all">
              <Boxes className="h-5 w-5" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold tracking-tight text-white text-[15px] truncate">
                    SCM Flow
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                </div>
                <span className="block text-[10px] text-emerald-200/70 font-medium tracking-wide truncate">
                  Pharma Supply Chain
                </span>
              </div>
            )}
          </Link>

          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="p-1.5 rounded-lg text-emerald-200/60 hover:text-white hover:bg-white/10 transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Grouped Navigation */}
        <nav
          aria-label="Main Navigation"
          className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5"
        >
          {groupedNav.map((group) => (
            <div key={group.label} className="space-y-1">
              {!sidebarCollapsed && (
                <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-200/45">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => {
                const active = isNavActive(item.path);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={sidebarCollapsed ? item.navTitle || item.title : undefined}
                    className={`group flex items-center ${
                      sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-3'
                    } py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                      active
                        ? 'bg-white/12 text-white font-semibold shadow-xs ring-1 ring-white/10'
                        : 'text-emerald-100/75 hover:bg-white/[0.07] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      {Icon && (
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            active
                              ? 'text-emerald-300'
                              : 'text-emerald-200/55 group-hover:text-emerald-300'
                          }`}
                        />
                      )}
                      {!sidebarCollapsed && (
                        <span className="truncate">{item.navTitle || item.title}</span>
                      )}
                    </div>
                    {!sidebarCollapsed && active && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-white/10 bg-black/15">
          {sidebarCollapsed ? (
            <Link
              to="/app/settings"
              className="flex items-center justify-center p-2 rounded-lg text-emerald-200/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
          ) : (
            <div className="rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2.5 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="inline-flex items-center space-x-1.5 text-[10px] font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>Workspace Active</span>
                </span>
                <Link
                  to="/app/settings"
                  className="text-[10px] text-emerald-200/75 hover:text-white transition-colors font-medium"
                >
                  Configure
                </Link>
              </div>
              <div className="text-[11px] font-mono text-white/90 truncate">
                {employee?.employee_id || 'System User'}
              </div>
              <div className="text-[10px] text-emerald-200/55 mt-0.5">
                INR (₹) · Asia/Kolkata (IST)
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Crisp Elevated Top Utility Bar */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-divider bg-white/90 px-4 sm:px-6 backdrop-blur-md">
          {/* Mobile menu trigger */}
          <div className="flex items-center space-x-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-ink-primary hover:bg-ivory hover:text-forest transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/app/dashboard" className="flex items-center space-x-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-forest text-emerald-300">
                <Boxes className="h-4 w-4" />
              </div>
              <span className="font-bold text-forest text-sm tracking-tight">SCM Flow</span>
            </Link>
          </div>

          {/* Breadcrumb Context */}
          <div className="hidden lg:flex items-center space-x-2 text-xs">
            <Link
              to="/app/dashboard"
              className="flex items-center space-x-1.5 text-ink-muted hover:text-forest transition-colors font-medium"
            >
              <Home className="h-3.5 w-3.5" />
              <span>SCM Flow</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-divider" />
            <span className="font-semibold text-ink-primary capitalize">
              {currentPageTitle}
            </span>
          </div>

          {/* Functional Quick-Jump Search */}
          <div ref={searchRef} className="hidden md:block relative max-w-sm w-full mx-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Jump to module, projects, issues, settings..."
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchResults.length > 0) {
                  navigate(searchResults[0].path);
                  setSearchQuery('');
                  setSearchFocused(false);
                }
                if (e.key === 'Escape') {
                  setSearchFocused(false);
                }
              }}
              className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-divider bg-ivory/70 placeholder:text-ink-muted focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest/15 focus:border-forest transition-all"
            />

            {searchFocused && (
              <div className="absolute left-0 right-0 mt-1.5 rounded-xl border border-divider bg-white shadow-warm-xl py-1.5 z-50 animate-fadeIn">
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Quick Navigation
                </div>
                {searchResults.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-ink-muted text-center">
                    No matching modules found.
                  </div>
                ) : (
                  searchResults.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => {
                          navigate(item.path);
                          setSearchQuery('');
                          setSearchFocused(false);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-ivory transition-colors"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          {Icon && <Icon className="h-3.5 w-3.5 text-forest shrink-0" />}
                          <span className="font-medium text-ink-primary truncate">
                            {item.navTitle || item.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-ink-muted shrink-0">
                          {item.path}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Right Utility Controls */}
          <div className="flex items-center space-x-1.5 sm:space-x-2.5">
            {mustChangePassword && (
              <Link
                to="/reset-password"
                className="hidden sm:inline-flex items-center space-x-1.5 rounded-full bg-copper-pale px-3 py-1 text-xs font-semibold text-copper-dark border border-copper/30 hover:bg-copper-pale/80 transition-colors"
              >
                <AlertCircle className="h-3.5 w-3.5 text-copper" />
                <span>Update Password</span>
              </Link>
            )}

            {/* Quick Create Project Button */}
            {permissions.includes('projects.create') && (
              <Button
                asChild
                size="sm"
                className="hidden xl:inline-flex h-8 bg-forest hover:bg-forest-hover text-white text-xs px-3"
              >
                <Link to="/app/projects/new">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  New Project
                </Link>
              </Button>
            )}

            {/* Notifications */}
            <div ref={notifRef} className="relative">
              <button
                type="button"
                onClick={handleOpenNotifications}
                className="p-2 rounded-lg text-ink-secondary hover:text-forest hover:bg-ivory transition-colors relative"
                title="System Notifications"
                aria-label="View notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-copper ring-2 ring-white" />
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-divider bg-white p-4 shadow-warm-xl z-50 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-divider/70 pb-2.5 mb-2.5">
                    <div className="flex items-center space-x-2">
                      <Bell className="h-4 w-4 text-forest" />
                      <span className="text-xs font-bold text-ink-primary">Notifications</span>
                      <span className="rounded-full bg-sage-pale px-2 py-0.5 text-[10px] font-bold text-forest">
                        {unreadCount}
                      </span>
                    </div>
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-[11px] font-semibold text-forest hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-xs text-ink-muted">
                        You are all caught up.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={async () => {
                            if (!n.is_read) {
                              await markNotificationAsRead(n.id);
                              setNotifications((prev) =>
                                prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
                              );
                            }
                            if (n.related_entity_type === 'delivery_issue') {
                              navigate(n.related_entity_id ? `/app/deliveries/issues/${n.related_entity_id}` : '/app/deliveries/issues');
                              setNotificationsOpen(false);
                            } else if (n.related_entity_type === 'project') {
                              navigate(n.related_entity_id ? `/app/projects/${n.related_entity_id}` : '/app/projects');
                              setNotificationsOpen(false);
                            } else if (n.related_entity_type === 'document') {
                              navigate(n.related_entity_id ? `/app/documents/${n.related_entity_id}` : '/app/documents');
                              setNotificationsOpen(false);
                            } else if (n.related_entity_type === 'delivery') {
                              navigate('/app/deliveries');
                              setNotificationsOpen(false);
                            }
                          }}
                          className={`rounded-lg border p-2.5 text-xs cursor-pointer transition-colors ${
                            n.is_read
                              ? 'bg-ivory/40 border-divider/50 text-ink-secondary'
                              : 'bg-sage-pale/40 border-forest/20 text-ink-primary'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-forest text-[11px] truncate">
                              {n.title}
                            </span>
                            <span className="text-[10px] text-ink-muted font-mono shrink-0">
                              {n.created_at?.slice(0, 10)}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-ink-secondary">
                            {n.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Settings Icon */}
            <Link
              to="/app/settings"
              className="p-2 rounded-lg text-ink-secondary hover:text-forest hover:bg-ivory transition-colors"
              title="Platform & SCM Settings"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>

            <div className="h-5 w-px bg-divider mx-1 hidden sm:block" />

            {/* User Profile Pill */}
            <Link
              to="/app/profile"
              className="flex items-center space-x-2.5 rounded-lg px-2 py-1.5 hover:bg-ivory transition-colors"
              title="View Profile & Granted Permissions"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-forest to-forest-light text-white text-xs font-bold shadow-xs">
                {employee?.full_name ? employee.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="hidden md:block text-left">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-semibold text-ink-primary leading-none">
                    {employee?.full_name || user?.email?.split('@')[0]}
                  </span>
                  <Badge
                    variant={getRoleBadgeVariant(role) as any}
                    className="text-[10px] py-0 px-1.5"
                  >
                    {getRoleDisplayName(role)}
                  </Badge>
                </div>
                <span className="text-[10px] text-ink-muted font-mono">
                  {employee?.employee_id || user?.email}
                </span>
              </div>
            </Link>

            {/* Sign Out */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="h-8 text-xs text-ink-secondary hover:text-status-danger hover:bg-rose-50 px-2.5"
              title="Sign Out of SCM Flow"
            >
              <LogOut className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile Navigation"
            className="lg:hidden border-b border-forest-deep bg-forest text-white px-4 py-3 space-y-3 shadow-warm-lg max-h-[75vh] overflow-y-auto"
          >
            {groupedNav.map((group) => (
              <div key={group.label} className="space-y-1">
                <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-200/55">
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isNavActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center space-x-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? 'bg-white/15 text-white font-semibold'
                          : 'text-emerald-100/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {Icon && <Icon className="h-4 w-4 text-emerald-300" />}
                      <span>{item.navTitle || item.title}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        )}

        {/* Main Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 bg-ivory">
          <div className="max-w-[1440px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
