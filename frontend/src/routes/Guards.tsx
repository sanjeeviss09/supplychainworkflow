import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { canAccessRoute } from './routePermissions';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Ensures the user is authenticated, has an active linked employee record,
 * and is not pending forced password rotation.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, employee, is_active, isLoading, mustChangePassword } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ivory">
        <div className="flex flex-col items-center space-y-3 text-ink-secondary">
          <Loader2 className="h-8 w-8 animate-spin text-forest" />
          <p className="text-xs font-medium">Verifying Employee Session & Permissions...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Inactive employee or unlinked account
  if (employee && is_active === false) {
    return <Navigate to="/login" state={{ from: location, error: 'Your employee account is inactive.' }} replace />;
  }

  // Force first-time password change
  if (mustChangePassword && location.pathname !== '/reset-password') {
    return <Navigate to="/reset-password" replace />;
  }

  return <>{children}</>;
}

interface PermissionRouteGuardProps {
  children: React.ReactNode;
  routePath?: string;
}

/**
 * Route guard that validates the user's effective permissions against the centralized route registry.
 * If unauthorized, immediately redirects to /403 without rendering or querying backend records.
 */
export function PermissionRouteGuard({ children, routePath }: PermissionRouteGuardProps) {
  const { permissions, is_active, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-forest" />
      </div>
    );
  }

  const targetPath = routePath || location.pathname;
  const isAuthorized = canAccessRoute(targetPath, permissions, is_active);

  if (!isAuthorized) {
    return <Navigate to="/403" state={{ from: location, deniedPath: targetPath }} replace />;
  }

  return <>{children}</>;
}

/**
 * Restricts public auth routes (e.g., /login, /signup) from authenticated active users,
 * redirecting them directly to /app/dashboard.
 */
export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, is_active } = useAuth();

  if (user && is_active) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <>{children}</>;
}
