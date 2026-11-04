import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Shield, Briefcase, Mail, Building, KeyRound, CheckCircle2 } from 'lucide-react';

export function ProfilePage() {
  const { employee, user, role, permissions, is_active } = useAuth();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-forest flex items-center space-x-2">
          <User className="h-6 w-6 text-forest" />
          <span>Employee Profile & Authorization</span>
        </h1>
        <p className="text-xs text-ink-secondary mt-0.5">
          Identity, corporate HR linkage, assigned organizational role, and granted granular permissions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="md:col-span-1 border-divider bg-ivory-surface">
          <CardContent className="pt-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-forest text-sage text-2xl font-bold font-mono shadow-warm-sm">
              {employee?.full_name ? employee.full_name.charAt(0).toUpperCase() : 'U'}
            </div>
            <h2 className="mt-4 text-base font-bold text-forest">
              {employee?.full_name || 'System User'}
            </h2>
            <p className="text-xs font-mono text-ink-secondary">{employee?.employee_id || 'AXX09'}</p>
            <div className="mt-3 flex justify-center">
              <Badge variant="secondary" className="capitalize font-semibold text-xs">
                {role?.replace(/_/g, ' ') || 'Unassigned'}
              </Badge>
            </div>

            <div className="mt-6 border-t border-divider/60 pt-4 text-left space-y-2.5 text-xs text-ink-secondary">
              <div className="flex items-center space-x-2">
                <Mail className="h-3.5 w-3.5 text-ink-muted shrink-0" />
                <span className="truncate">{employee?.email || user?.email}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Building className="h-3.5 w-3.5 text-ink-muted shrink-0" />
                <span className="truncate">{employee?.department || 'Operations'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Briefcase className="h-3.5 w-3.5 text-ink-muted shrink-0" />
                <span className="truncate">{employee?.designation || 'Staff'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-status-success shrink-0" />
                <span>Status: <strong className="text-status-success font-semibold">{is_active ? 'Active' : 'Inactive'}</strong></span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Granted Permissions Card */}
        <Card className="md:col-span-2 border-divider bg-ivory-surface">
          <CardHeader className="pb-3 border-b border-divider/60">
            <CardTitle className="text-sm font-semibold text-forest flex items-center space-x-2">
              <Shield className="h-4 w-4 text-sage-dark" />
              <span>Granted Granular Permissions</span>
            </CardTitle>
            <CardDescription className="text-xs text-ink-secondary">
              Resolved server-side from PostgreSQL <code className="font-mono text-[11px] text-forest">public.role_permissions</code>. Client cannot elevate these capabilities.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {permissions && permissions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {permissions.map((perm) => (
                  <span
                    key={perm}
                    className="inline-flex items-center rounded-md bg-sage-pale/60 px-2.5 py-1 text-xs font-mono text-forest border border-sage/50"
                  >
                    <KeyRound className="h-3 w-3 mr-1.5 text-forest" />
                    {perm}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-ink-secondary py-4 text-center">
                No granular permissions currently assigned.
              </div>
            )}

            <div className="mt-6 rounded-xl border border-divider bg-ivory p-3.5 text-xs text-ink-secondary">
              <p className="font-semibold text-forest mb-1">
                Authorization Architecture Note:
              </p>
              <p className="text-[11px] leading-relaxed">
                Approval authority is not inferred from your role or department. Approval actions must be granted through an authorized workflow step and enforce default denial of self-approval.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
