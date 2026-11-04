import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Shield, Sliders, ArrowRight } from 'lucide-react';

export function SettingsPage() {
  const { permissions } = useAuth();

  const canManageSystem = permissions.includes('settings.system.manage');
  const canManageScm = permissions.includes('settings.scm.manage');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-forest flex items-center space-x-2">
          <Settings className="h-6 w-6 text-forest" />
          <span>Platform & SCM Settings</span>
        </h1>
        <p className="text-xs text-ink-secondary mt-0.5">
          Select an authorized configuration category to review or adjust platform parameters.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* System Settings Card */}
        {canManageSystem && (
          <Card className="hover:border-sage transition-all">
            <CardHeader className="pb-3 border-b border-divider/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center space-x-2 text-forest">
                  <Shield className="h-5 w-5 text-forest" />
                  <span>System Configuration</span>
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-ink-secondary">
                Global platform parameters, authentication controls, and security policies. Restricted to Super Admin.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Button asChild size="sm" className="w-full text-xs">
                <Link to="/app/settings/system">
                  <span>Manage System Settings</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* SCM Business Settings Card */}
        {canManageScm && (
          <Card className="hover:border-sage transition-all">
            <CardHeader className="pb-3 border-b border-divider/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center space-x-2 text-forest">
                  <Sliders className="h-5 w-5 text-forest" />
                  <span>SCM Business Settings</span>
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-ink-secondary">
                Default currency (INR ₹), 3-day delivery reminder scheduler, material categories, and operational timezones.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Button asChild size="sm" className="w-full text-xs">
                <Link to="/app/settings/scm">
                  <span>Manage SCM Settings</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
