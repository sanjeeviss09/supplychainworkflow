import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { getAuthorizedNavItems, ROUTE_REGISTRY } from '@/routes/routePermissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LogOut,
  Menu,
  X,
  Lock,
  ChevronRight,
  AlertCircle,
  Search,
  Bell,
  HelpCircle,
  Boxes,
  ShieldCheck,
  Settings,
} from 'lucide-react';

import {
  AppNotification,
  fetchUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/services/notificationService';

export function AppLayout() {
  const { user, employee, role, permissions, is_active, logout, mustChangePassword } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (user) {
      fetchUserNotifications().then(setNotifications);
    }
  }, [user]);

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

  // Derive navigation dynamically from the centralized route permission registry
  const navItems = getAuthorizedNavItems(permissions, is_active);

  const getRoleDisplayName = (r: string | null | undefined) => {
    switch (r) {
      case 'super_admin':
        return 'Super Admin';
      case 'scm_admin':
        return 'SCM Admin';
      case 'scm_team_user':
        return 'SCM Team User';
      default:
        return 'Team Member';
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

  // Determine current page title for breadcrumb
  const currentRouteConfig = ROUTE_REGISTRY[location.pathname];
  const currentPageTitle =
    currentRouteConfig?.title ||
    location.pathname.replace('/app/', '').replace('/', ' ').replace('-', ' ');

  return (
    <div className="flex min-h-screen bg-ivory text-ink-primary font-sans antialiased">
      {/* Desktop Sidebar — Deep Forest Green */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col shrink-0 bg-forest border-r border-forest-deep text-ivory-surface shadow-warm-lg z-30">
        {/* Brand Header */}
        <div className="flex h-16 items-center px-6 border-b border-forest-deep/80 bg-forest-deep/40">
          <Link to="/app/dashboard" className="flex items-center space-x-3 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sage/20 border border-sage/40 text-sage font-bold shadow-inner group-hover:bg-sage/30 transition-all">
              <Boxes className="h-5 w-5 text-sage" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-semibold tracking-tight text-ivory-surface text-base">
                  SCM Flow
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-copper inline-block" />
              </div>
              <span className="block text-[10px] text-sage/80 font-mono tracking-wide">
                Enterprise Internal
              </span>
            </div>
          </Link>
        </div>

        {/* Dynamic Role-Aware Navigation List */}
        <nav aria-label="Main Navigation" className="flex-1 overflow-y-auto px-3.5 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-sage/70">
            Workspace Navigation
          </div>
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== '/app/dashboard' && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`group flex items-center justify-between rounded-md px-3 py-2 text-xs sm:text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-sage/20 text-white font-semibold border-l-2 border-sage shadow-sm'
                    : 'text-ivory/80 hover:bg-forest-light/60 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  {Icon && (
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        isActive
                          ? 'text-sage'
                          : 'text-ivory/60 group-hover:text-sage/90'
                      }`}
                    />
                  )}
                  <span className="truncate">{item.navTitle || item.title}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium whitespace-nowrap shrink-0 ${
                      item.badgeVariant === 'success'
                        ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-700/50'
                        : 'bg-forest-deep text-sage/90 border border-forest-light'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer Context Info */}
        <div className="p-4 border-t border-forest-deep/80 bg-forest-deep/30 text-xs text-sage/75">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-sage/60 font-semibold">Active Session</span>
            <Link
              to="/app/settings"
              className="flex items-center space-x-1 text-[10px] text-sage hover:text-white transition-colors"
              title="Platform Settings & Customization"
            >
              <Settings className="h-3 w-3" />
              <span>Settings</span>
            </Link>
          </div>
          <div className="text-[11px] font-mono text-ivory/90 truncate">
            {employee?.employee_id || 'System User'}
          </div>
          <div className="text-[10px] text-sage/60 mt-0.5">
            INR (₹) • Asia/Kolkata (IST)
          </div>
        </div>
      </aside>

      {/* Main App Container */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top Header / Utility Bar — Ivory Surface */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-divider bg-ivory-surface/95 px-4 sm:px-6 backdrop-blur shadow-warm-sm">
          {/* Mobile menu trigger */}
          <div className="flex items-center space-x-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-md text-ink-primary hover:bg-ivory hover:text-forest transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-forest text-base tracking-tight">SCM Flow</span>
            </div>
          </div>

          {/* Breadcrumbs / Page Context */}
          <div className="hidden lg:flex items-center space-x-2 text-xs text-ink-secondary">
            <Link to="/app/dashboard" className="hover:text-forest transition-colors font-medium">
              SCM Flow
            </Link>
            <ChevronRight className="h-3 w-3 text-divider" />
            <span className="font-semibold text-ink-primary capitalize">
              {currentPageTitle}
            </span>
          </div>

          {/* Center Utility Search Filter (Quick Lookup) */}
          <div className="hidden md:flex items-center max-w-xs w-full mx-4">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-muted" />
              <input
                type="text"
                placeholder="Search projects, items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-divider bg-ivory/60 placeholder:text-ink-muted focus:bg-ivory-surface focus:outline-none focus:ring-1 focus:ring-forest focus:border-forest transition-all"
              />
            </div>
          </div>

          {/* User Identification & Utility Actions */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Must Change Password Warning Pill */}
            {mustChangePassword && (
              <Link
                to="/reset-password"
                className="hidden sm:inline-flex items-center space-x-1.5 rounded-full bg-copper-pale px-3 py-1 text-xs font-medium text-copper-dark border border-copper/30 animate-pulse hover:bg-copper-pale/80 transition-colors"
              >
                <AlertCircle className="h-3.5 w-3.5 text-copper" />
                <span>Password Change Required</span>
              </Link>
            )}

            {/* Notifications Indicator & Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={handleOpenNotifications}
                className="p-1.5 rounded-md text-ink-secondary hover:text-forest hover:bg-ivory transition-colors relative"
                title="System Notifications"
                aria-label="View notifications"
              >
                <Bell className="h-4 w-4" />
                {notifications.some((n) => !n.is_read) && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-copper animate-ping" />
                )}
                {notifications.some((n) => !n.is_read) && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-copper" />
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-divider bg-ivory-surface p-4 shadow-warm-xl z-50">
                  <div className="flex items-center justify-between border-b border-divider/60 pb-2 mb-2">
                    <div className="flex items-center space-x-1.5">
                      <Bell className="h-4 w-4 text-forest" />
                      <span className="text-xs font-bold text-forest">Notifications</span>
                      <span className="rounded-full bg-forest/10 px-1.5 py-0.2 text-[10px] font-bold text-forest">
                        {notifications.filter((n) => !n.is_read).length}
                      </span>
                    </div>
                    {notifications.length > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[10px] text-forest hover:underline font-medium"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-xs text-ink-muted">
                        No notifications at this time.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={async () => {
                            if (!n.is_read) {
                              await markNotificationAsRead(n.id);
                              setNotifications((prev) =>
                                prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
                              );
                            }
                          }}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                            n.is_read
                              ? 'bg-ivory/40 border-divider/60 text-ink-secondary'
                              : 'bg-ivory border-forest/30 text-ink-primary font-medium'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-forest text-[11px]">{n.title}</span>
                            <span className="text-[10px] text-ink-muted font-mono">
                              {n.created_at?.slice(0, 10)}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-ink-secondary">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Settings Icon */}
            <Link
              to="/app/settings"
              className="p-1.5 rounded-md text-ink-secondary hover:text-forest hover:bg-ivory transition-colors"
              title="Platform & SCM Settings"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>

            {/* Profile Link Button */}
            <Link
              to="/app/profile"
              className="flex items-center space-x-2.5 rounded-lg p-1.5 hover:bg-ivory transition-colors border border-transparent hover:border-divider"
              title="View Profile & Granted Permissions"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-ivory-surface text-xs font-bold font-mono shadow-xs">
                {employee?.full_name ? employee.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="hidden md:block text-left">
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-semibold text-ink-primary leading-none">
                    {employee?.full_name || user?.email?.split('@')[0]}
                  </span>
                  <Badge variant={getRoleBadgeVariant(role) as any} className="text-[10px] py-0 px-1.5">
                    {getRoleDisplayName(role)}
                  </Badge>
                </div>
                <span className="text-[10px] text-ink-secondary font-mono">
                  {employee?.employee_id || user?.email}
                </span>
              </div>
            </Link>

            {/* Logout button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-xs text-ink-secondary hover:text-status-danger hover:border-red-300 hover:bg-rose-50"
              title="Sign Out of SCM Flow"
            >
              <LogOut className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </header>

        {/* Mobile menu drawer */}
        {mobileMenuOpen && (
          <nav aria-label="Mobile Navigation" className="lg:hidden border-b border-forest-deep bg-forest text-ivory-surface px-4 py-3 space-y-1 shadow-warm-lg">
            <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-sage/70">
              Workspace Navigation
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.path ||
                (item.path !== '/app/dashboard' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-sage/20 text-white font-semibold border-l-2 border-sage'
                      : 'text-ivory/80 hover:bg-forest-light/60 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {Icon && <Icon className="h-4 w-4 text-sage" />}
                    <span>{item.navTitle || item.title}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] bg-forest-deep text-sage px-1.5 py-0.5 rounded font-mono">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Main Content Viewport — Warm Ivory Background */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-ivory">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
