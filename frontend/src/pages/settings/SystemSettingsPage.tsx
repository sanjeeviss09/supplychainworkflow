import React, { useState, useEffect } from 'react';
import { fetchAppSettings } from '@/services/settingsService';
import { AppSetting } from '@/types/database.types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Server, Loader2 } from 'lucide-react';

export function SystemSettingsPage() {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppSettings()
      .then((res) => {
        if (res.data) setSettings(res.data);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-forest flex items-center space-x-2">
          <Shield className="h-6 w-6 text-forest" />
          <span>System Configuration</span>
        </h1>
        <p className="text-xs text-ink-secondary mt-0.5">
          Master authentication parameters, access governance rules, and database-level security policies.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-ink-secondary">Security Model</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base font-bold font-mono text-forest">
              Default-Deny
            </div>
            <p className="text-[11px] text-ink-muted mt-1">PostgreSQL RLS Active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-ink-secondary">Password Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base font-bold font-mono text-ink-primary">
              Min 6 Chars
            </div>
            <p className="text-[11px] text-ink-muted mt-1">Enforced First-Time Rotation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-ink-secondary">Deployment Target</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base font-bold font-mono text-ink-primary">
              Internal Server
            </div>
            <p className="text-[11px] text-ink-muted mt-1">No Public Internet Access</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 border-b border-divider/60">
          <CardTitle className="text-sm font-semibold text-forest flex items-center space-x-2">
            <Server className="h-4 w-4 text-sage-dark" />
            <span>Database App Settings (public.app_settings)</span>
          </CardTitle>
          <CardDescription className="text-xs text-ink-secondary">
            Real configuration keys loaded securely from PostgreSQL.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {loading ? (
            <div className="py-8 text-center text-xs text-ink-secondary">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-forest" />
              Loading database settings...
            </div>
          ) : settings.length === 0 ? (
            <div className="py-6 text-center text-xs text-ink-secondary">
              No application settings records found.
            </div>
          ) : (
            <div className="divide-y divide-divider/60">
              {settings.map((item) => (
                <div key={item.key} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-semibold text-ink-primary block">
                      {item.key}
                    </span>
                    <span className="text-[11px] text-ink-secondary">
                      {item.description || 'System setting'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-xs bg-ivory px-2 py-1 rounded border border-divider text-forest">
                      {typeof item.value === 'object' ? JSON.stringify(item.value) : String(item.value)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
