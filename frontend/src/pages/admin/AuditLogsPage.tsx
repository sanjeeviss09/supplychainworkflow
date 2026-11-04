import React, { useState, useEffect } from 'react';
import { AuditLog } from '@/types/database.types';
import { fetchAuditLogs as loadAuditLogsFromService } from '@/services/auditService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, RefreshCw, Loader2 } from 'lucide-react';
import { formatDateIST } from '@/lib/formatters';

export function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [outcomeFilter, setOutcomeFilter] = useState<string>('ALL');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data } = await loadAuditLogsFromService({
        limit: 150,
        outcome: outcomeFilter !== 'ALL' ? (outcomeFilter as AuditLog['outcome']) : undefined,
      });
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [outcomeFilter]);

  const getActionBadge = (action: string) => {
    if (action.includes('DEACTIVATED') || action.includes('DELETE') || action.includes('DENIED') || action.includes('FAILED')) {
      return <Badge variant="destructive">{action}</Badge>;
    }
    if (action.includes('ACTIVATED') || action.includes('PROVISIONED') || action.includes('MATCH') || action.includes('SUCCESS')) {
      return <Badge variant="success">{action}</Badge>;
    }
    if (action.includes('ROLE_CHANGED') || action.includes('IMPORT')) {
      return <Badge variant="copper">{action}</Badge>;
    }
    return <Badge variant="outline">{action}</Badge>;
  };

  const getOutcomeBadge = (outcome?: string) => {
    if (outcome === 'FAILURE') return <Badge variant="destructive">FAILURE</Badge>;
    if (outcome === 'DENIED') return <Badge variant="warning">DENIED</Badge>;
    return <Badge variant="success">{outcome || 'SUCCESS'}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-forest flex items-center space-x-2">
            <Shield className="h-6 w-6 text-forest" />
            <span>Immutable Security Audit Log</span>
          </h1>
          <p className="text-xs text-ink-secondary mt-0.5">
            Append-only, secret-sanitized ledger capturing authentication, employee provisioning, imports, role changes, and security events.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <select
            aria-label="Filter by outcome"
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="h-9 rounded-md border border-divider bg-ivory-surface px-2.5 text-xs text-ink-primary focus:outline-none focus:border-forest"
          >
            <option value="ALL">All Outcomes</option>
            <option value="SUCCESS">Success Only</option>
            <option value="FAILURE">Failure Only</option>
            <option value="DENIED">Denied Only</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Log
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-divider bg-ivory-surface shadow-warm-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event ID</TableHead>
              <TableHead>Timestamp (IST)</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Affected Employee</TableHead>
              <TableHead>Sanitized Event Payload</TableHead>
              <TableHead>Actor UUID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-xs text-ink-secondary">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-forest" />
                  Reading tamper-evident security records...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-xs text-ink-secondary">
                  No security audit events recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} className="hover:bg-sage-pale/20 transition-colors">
                  <TableCell className="font-mono text-xs text-ink-muted">
                    #{log.id}
                  </TableCell>
                  <TableCell className="text-xs text-ink-secondary font-mono whitespace-nowrap">
                    {formatDateIST(log.created_at)}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-forest">
                    {log.table_name}
                  </TableCell>
                  <TableCell>
                    {getActionBadge(log.action)}
                  </TableCell>
                  <TableCell>
                    {getOutcomeBadge(log.outcome)}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-ink-primary">
                    {log.target_employee_id || '—'}
                  </TableCell>
                  <TableCell className="text-xs max-w-xs truncate text-ink-secondary">
                    {log.new_values ? (
                      <code className="text-[11px] bg-ivory border border-divider px-1.5 py-0.5 rounded text-ink-primary font-mono">
                        {JSON.stringify(log.new_values)}
                      </code>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-ink-muted truncate max-w-[120px]">
                    {log.changed_by || 'system_trigger'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
