import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sliders, Clock, Coins, Layers, Globe, Server } from 'lucide-react';

export function ScmSettingsPage() {
  const confirmedDecisions = [
    {
      label: 'Default Currency',
      value: 'INR (₹)',
      detail: 'Standard formatting: ₹ #,##,###.## with lakh and crore separators.',
      icon: Coins,
      tag: 'Locked',
    },
    {
      label: 'Delivery Reminder Lead Time',
      value: '3 Calendar Days',
      detail: 'Automated notification worker evaluated daily at 06:00 IST.',
      icon: Clock,
      tag: 'Configurable',
    },
    {
      label: 'Default Operational Timezone',
      value: 'Asia/Kolkata (UTC+05:30)',
      detail: 'All system logs, delivery deadlines, and timestamps normalized to IST.',
      icon: Globe,
      tag: 'Locked',
    },
    {
      label: 'Deployment Target',
      value: 'Company Internal Server',
      detail: 'Private corporate network topology without direct external exposure.',
      icon: Server,
      tag: 'Enforced',
    },
  ];

  const materialCategories = [
    { code: 'API', name: 'Active Pharmaceutical Ingredient', desc: 'Core medicinal compounds and active synthesis agents.' },
    { code: 'EXE', name: 'Excipient', desc: 'Inactive substances formulating drug delivery vehicles and stabilization.' },
    { code: 'PM', name: 'Packaging Material', desc: 'Primary and secondary packaging, blister foils, vials, and cartons.' },
    { code: 'Consumables', name: 'Manufacturing Consumables', desc: 'Lab reagents, personal protective equipment, filters, and sanitizers.' },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-forest flex items-center space-x-2">
          <Sliders className="h-6 w-6 text-forest" />
          <span>SCM Business Settings</span>
        </h1>
        <p className="text-xs text-ink-secondary mt-0.5">
          Operational business configuration governing currency, reminder schedules, and material taxonomies.
        </p>
      </div>

      {/* Confirmed Architecture Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {confirmedDecisions.map((item, idx) => (
          <Card key={idx} className="hover:border-sage transition-all">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div className="flex items-center space-x-2">
                <item.icon className="h-4 w-4 text-forest" />
                <CardTitle className="text-xs font-semibold text-ink-primary">
                  {item.label}
                </CardTitle>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                {item.tag}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-base font-bold font-mono text-forest">
                {item.value}
              </div>
              <p className="text-[11px] text-ink-secondary mt-1 leading-relaxed">
                {item.detail}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Default Material Categories */}
      <Card>
        <CardHeader className="pb-3 border-b border-divider/60">
          <CardTitle className="text-sm font-semibold text-forest flex items-center space-x-2">
            <Layers className="h-4 w-4 text-sage-dark" />
            <span>Approved Material Master Classifications</span>
          </CardTitle>
          <CardDescription className="text-xs text-ink-secondary">
            Four mandatory categories defined in Phase 0 Architecture requirements.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {materialCategories.map((cat) => (
              <div
                key={cat.code}
                className="rounded-lg border border-divider/70 bg-ivory/50 p-3 hover:bg-sage-pale/25 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-forest">
                    {cat.code}
                  </span>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    Category
                  </Badge>
                </div>
                <div className="font-semibold text-xs text-ink-primary mt-1">
                  {cat.name}
                </div>
                <p className="text-[11px] text-ink-secondary mt-1 leading-relaxed">
                  {cat.desc}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
