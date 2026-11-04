import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Boxes, Lock } from 'lucide-react';

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-ivory text-ink-primary font-sans antialiased selection:bg-sage/40 selection:text-ink-primary">
      {/* Top Banner — Forest Green Accent */}
      <header className="border-b border-divider bg-ivory-surface/90 px-6 py-4 backdrop-blur shadow-warm-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/login" className="flex items-center space-x-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest text-sage font-bold shadow-warm-sm group-hover:bg-forest-deep transition-colors">
              <Boxes className="h-5 w-5 text-sage" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h1 className="text-base font-bold tracking-tight text-forest">SCM Flow</h1>
                <span className="h-1.5 w-1.5 rounded-full bg-copper inline-block" />
              </div>
              <p className="text-xs text-ink-secondary">Enterprise Supply Chain Platform</p>
            </div>
          </Link>
          <div className="flex items-center space-x-2 text-xs text-ink-secondary bg-ivory px-3 py-1.5 rounded-full border border-divider">
            <Lock className="h-3.5 w-3.5 text-status-success" />
            <span className="font-medium">Internal Corporate Gateway</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-divider bg-ivory-surface/80 px-6 py-4 text-center text-xs text-ink-secondary">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-ink-secondary font-medium">© 2026 SCM Flow Enterprise • Company Internal Server</p>
          <div className="flex items-center space-x-3 text-ink-muted">
            <span className="font-mono">Currency: INR (₹)</span>
            <span>•</span>
            <span className="font-mono">Timezone: Asia/Kolkata (IST)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
