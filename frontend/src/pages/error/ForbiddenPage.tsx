import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ArrowLeft, Home, Lock } from 'lucide-react';

export function ForbiddenPage() {
  const { employee, role } = useAuth();
  const location = useLocation();
  const attemptedPath = (location.state as any)?.from?.pathname || (location.state as any)?.deniedPath || 'this resource';

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-divider bg-ivory-surface p-8 text-center shadow-warm-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-copper-pale text-copper border border-copper/30">
          <ShieldAlert className="h-8 w-8 text-copper" />
        </div>

        <span className="mt-4 inline-block font-mono text-xs font-bold uppercase tracking-wider text-copper-dark">
          HTTP 403 • Authorization Denied
        </span>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-forest">
          Access Restricted
        </h1>

        <p className="mt-3 text-xs leading-relaxed text-ink-secondary">
          You are authenticated as <strong className="font-mono text-ink-primary">{employee?.full_name || 'Active Employee'}</strong> (<span className="font-mono">{employee?.employee_id || 'ID'}</span>) with role <span className="font-semibold text-forest capitalize">{role?.replace(/_/g, ' ') || 'Unassigned'}</span>.
        </p>

        <div className="mt-4 rounded-xl border border-divider bg-ivory p-3.5 text-left text-xs font-mono">
          <div className="flex items-center space-x-2 text-ink-secondary mb-1">
            <Lock className="h-3 w-3 text-copper shrink-0" />
            <span>Target Route:</span>
            <span className="text-forest font-semibold">{attemptedPath}</span>
          </div>
          <p className="text-[11px] text-ink-muted">
            SCM Flow enforces strict default-deny and least-privilege route authorization. Your account has not been granted the required capability or workflow approval authority.
          </p>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild className="w-full sm:w-auto text-xs font-semibold">
            <Link to="/app/dashboard">
              <Home className="h-3.5 w-3.5 mr-1.5" />
              Return to Dashboard
            </Link>
          </Button>

          <Button asChild variant="outline" className="w-full sm:w-auto text-xs" onClick={() => window.history.back()}>
            <button type="button">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Go Back
            </button>
          </Button>
        </div>
      </div>
    </div>
  );
}
