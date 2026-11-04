import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  const location = useLocation();

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-divider bg-ivory-surface p-8 text-center shadow-warm-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sage-pale text-forest border border-sage/40">
          <FileQuestion className="h-8 w-8 text-forest" />
        </div>

        <span className="mt-4 inline-block font-mono text-xs font-bold uppercase tracking-wider text-ink-secondary">
          HTTP 404 • Resource Not Found
        </span>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-forest">
          Page Does Not Exist
        </h1>

        <p className="mt-2 text-xs text-ink-secondary leading-relaxed">
          The requested URL <code className="rounded bg-ivory border border-divider px-1.5 py-0.5 text-forest font-mono">{location.pathname}</code> does not match any route in the SCM Flow platform registry.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild className="w-full sm:w-auto text-xs font-semibold">
            <Link to="/app/dashboard">
              <Home className="h-3.5 w-3.5 mr-1.5" />
              Go to Dashboard
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
