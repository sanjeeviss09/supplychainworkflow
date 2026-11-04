import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins, CheckSquare, ShieldAlert, Clock } from 'lucide-react';

export function BudgetsApprovalsPage() {
  const { permissions } = useAuth();

  const canViewBudgets = permissions.includes('budgets.view');
  const canViewApprovals = permissions.includes('approvals.view');

  // Select initial tab based on authorized permissions
  const [activeTab, setActiveTab] = useState<'budgets' | 'approvals'>(
    canViewBudgets ? 'budgets' : 'approvals'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-forest flex items-center space-x-2">
            <Coins className="h-6 w-6 text-forest" />
            <span>Budgets & Approval Governance</span>
          </h1>
          <p className="text-xs text-ink-secondary mt-0.5">
            Departmental capital allocations, multi-tier approval workflows, and expenditure ceilings.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center rounded-lg bg-ivory p-1 border border-divider">
          {canViewBudgets && (
            <button
              type="button"
              onClick={() => setActiveTab('budgets')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'budgets'
                  ? 'bg-ivory-surface text-forest shadow-warm-sm border border-divider/60'
                  : 'text-ink-secondary hover:text-forest'
              }`}
            >
              Departmental Budgets
            </button>
          )}

          {canViewApprovals && (
            <button
              type="button"
              onClick={() => setActiveTab('approvals')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === 'approvals'
                  ? 'bg-ivory-surface text-forest shadow-warm-sm border border-divider/60'
                  : 'text-ink-secondary hover:text-forest'
              }`}
            >
              Approval Workflows
            </button>
          )}
        </div>
      </div>

      {/* Security Governance Notice in Pale Copper */}
      <div className="rounded-xl border border-copper/30 bg-copper-pale/60 p-4 text-xs text-copper-dark shadow-warm-sm">
        <div className="flex items-start space-x-2.5">
          <ShieldAlert className="h-4 w-4 text-copper shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-copper-dark">
              Workflow-Based Approval Authority & Self-Approval Denial
            </div>
            <p className="leading-relaxed text-[11px] text-ink-secondary">
              Approval authority is strictly bound to workflow step assignments and is <strong>never inferred from role, department, or designation</strong>. SCM Flow enforces automatic denial of self-approval: requesters cannot approve their own PRs, POs, or budget releases.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 1: DEPARTMENTAL BUDGETS */}
      {activeTab === 'budgets' && canViewBudgets && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-divider/60">
              <div>
                <CardTitle className="text-sm font-semibold text-forest flex items-center space-x-2">
                  <Coins className="h-4 w-4 text-sage-dark" />
                  <span>Departmental Capital Budgets (INR ₹)</span>
                </CardTitle>
                <CardDescription className="text-xs text-ink-secondary">
                  Requested vs Approved Budget vs PO Commitments vs Invoiced totals.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                Phase 5 Roadmap
              </Badge>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="rounded-xl border border-dashed border-divider bg-ivory/50 p-8 text-center">
                <Clock className="h-8 w-8 text-sage mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-forest">
                  Budget Ledger Module Coming in Phase 5
                </h3>
                <p className="mt-1 text-xs text-ink-secondary max-w-md mx-auto leading-relaxed">
                  Budget ceiling configurations, multi-departmental cap tracking, and real-time PO commitment deductions will activate in Phase 5. In accordance with platform design principles, no speculative financial figures are rendered prior to module initialization.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECTION 2: APPROVAL WORKFLOWS */}
      {activeTab === 'approvals' && canViewApprovals && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-divider/60">
              <div>
                <CardTitle className="text-sm font-semibold text-forest flex items-center space-x-2">
                  <CheckSquare className="h-4 w-4 text-sage-dark" />
                  <span>Active Approval Steps & Assigned Queues</span>
                </CardTitle>
                <CardDescription className="text-xs text-ink-secondary">
                  Multi-tier sequential approval engine with immutable historical version snapshots.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                Phase 5 Roadmap
              </Badge>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="rounded-xl border border-dashed border-divider bg-ivory/50 p-8 text-center">
                <Clock className="h-8 w-8 text-sage mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-forest">
                  Approval Engine Activation in Phase 5
                </h3>
                <p className="mt-1 text-xs text-ink-secondary max-w-md mx-auto leading-relaxed">
                  Pending requisition approvals, sequential step progression, and amount threshold delegations will be processed here once the Phase 5 approval workflow engine is operational.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fallback messages */}
      {activeTab === 'budgets' && !canViewBudgets && (
        <div className="rounded-xl border border-divider bg-ivory-surface p-6 text-center text-xs text-ink-secondary">
          You do not have permission (<code className="font-mono">budgets.view</code>) to view departmental budget ledgers.
        </div>
      )}

      {activeTab === 'approvals' && !canViewApprovals && (
        <div className="rounded-xl border border-divider bg-ivory-surface p-6 text-center text-xs text-ink-secondary">
          You do not have permission (<code className="font-mono">approvals.view</code>) to view approval queues.
        </div>
      )}
    </div>
  );
}
