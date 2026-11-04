import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, Layers, ShieldCheck, Lock } from 'lucide-react';

interface PlaceholderModulePageProps {
  title: string;
  phase: string;
  description: string;
  keyFeatures: string[];
}

export function PlaceholderModulePage({
  title,
  phase,
  description,
  keyFeatures,
}: PlaceholderModulePageProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-2 text-xs text-ink-secondary">
        <Link to="/app/dashboard" className="hover:text-forest flex items-center font-medium">
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Dashboard
        </Link>
        <span className="text-divider">/</span>
        <span className="text-ink-primary font-semibold">{title}</span>
      </div>

      <Card className="border border-divider bg-ivory-surface shadow-warm-md">
        <CardHeader className="border-b border-divider/60 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest text-sage font-bold shadow-xs">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold text-forest">
                  {title}
                </CardTitle>
                <CardDescription className="text-xs text-ink-secondary">
                  SCM Flow Enterprise Operational Module
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs py-1 px-2.5 font-mono">
              <Clock className="h-3 w-3 mr-1 text-copper" />
              {phase} Implementation
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="rounded-xl border border-sage/60 bg-sage-pale/40 p-4 text-xs text-forest">
            <h4 className="font-semibold text-sm mb-1 text-forest flex items-center">
              <ShieldCheck className="h-4 w-4 mr-1.5 text-forest" />
              Architectural Baseline Confirmed
            </h4>
            <p className="leading-relaxed text-ink-secondary">
              {description} The database schema, normalized tables, and RLS policies for this module have been formally audited and documented. Full transactional workflows and user actions will be deployed in <strong>{phase}</strong>.
            </p>
          </div>

          <div className="rounded-xl border border-copper/30 bg-copper-pale/60 p-3 text-xs text-copper-dark flex items-center space-x-2">
            <Lock className="h-4 w-4 text-copper shrink-0" />
            <span>
              <strong>Governance Policy:</strong> This module is scheduled in the product roadmap. Operational mutations are locked until {phase} execution.
            </span>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-3">
              Planned Capabilities for {phase}:
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              {keyFeatures.map((feature, idx) => (
                <li
                  key={idx}
                  className="flex items-start p-3 rounded-lg border border-divider/70 bg-ivory/50 text-ink-primary hover:bg-sage-pale/25 transition-colors"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-forest mr-2 mt-1.5 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="pt-4 border-t border-divider/60 flex justify-between items-center text-xs text-ink-secondary">
            <span>Status: Coming in a later roadmap phase</span>
            <Button asChild variant="outline" size="sm" className="text-xs">
              <Link to="/app/dashboard">Back to Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
