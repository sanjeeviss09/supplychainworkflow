import React, { useState, useEffect } from 'react';
import { fetchEmployeeImportBatches, fetchEmployeeImportBatchRows } from '@/services/employeeService';
import { EmployeeImportBatch, EmployeeImportRowRecord } from '@/types/database.types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { History, RefreshCw, Loader2, FileText, ChevronRight, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { formatDateIST } from '@/lib/formatters';

export function EmployeeImportsPage() {
  const [batches, setBatches] = useState<EmployeeImportBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchRows, setBatchRows] = useState<EmployeeImportRowRecord[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  const loadBatches = async () => {
    try {
      setLoading(true);
      const res = await fetchEmployeeImportBatches(50);
      if (res.data) {
        setBatches(res.data);
      }
    } catch (err) {
      console.error('Failed to load import batches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handleSelectBatch = async (batchId: string) => {
    if (selectedBatchId === batchId) {
      setSelectedBatchId(null);
      setBatchRows([]);
      return;
    }

    try {
      setSelectedBatchId(batchId);
      setLoadingRows(true);
      const res = await fetchEmployeeImportBatchRows(batchId);
      if (res.data) {
        setBatchRows(res.data);
      }
    } catch (err) {
      console.error('Failed to load batch rows:', err);
    } finally {
      setLoadingRows(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-forest flex items-center space-x-2">
            <History className="h-6 w-6 text-forest" />
            <span>Employee Import Batches</span>
          </h1>
          <p className="text-xs text-ink-secondary mt-0.5">
            Historical audit log of all verified bulk roster imports and row-level confirmation telemetry.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadBatches}
          disabled={loading}
          className="text-xs self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Batches
        </Button>
      </div>

      {/* Batches Table */}
      <div className="rounded-xl border border-divider bg-ivory-surface shadow-warm-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File Name</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Import Timestamp (IST)</TableHead>
              <TableHead>Total Rows</TableHead>
              <TableHead>Accepted</TableHead>
              <TableHead>Skipped</TableHead>
              <TableHead>Rejected</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Inspection</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-xs text-ink-secondary">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-forest" />
                  Loading import batch history...
                </TableCell>
              </TableRow>
            ) : batches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-xs text-ink-secondary">
                  No employee roster import batches recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              batches.map((batch) => (
                <React.Fragment key={batch.id}>
                  <TableRow className={selectedBatchId === batch.id ? 'bg-sage-pale/40' : 'hover:bg-sage-pale/20 transition-colors'}>
                    <TableCell className="font-semibold text-xs text-ink-primary flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-forest shrink-0" />
                      <span className="truncate max-w-[180px]">{batch.file_name}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs uppercase text-ink-secondary">
                      {batch.file_type}
                    </TableCell>
                    <TableCell className="text-xs text-ink-secondary font-mono whitespace-nowrap">
                      {formatDateIST(batch.created_at)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-ink-primary">{batch.total_rows}</TableCell>
                    <TableCell className="font-mono text-xs text-status-success font-semibold">
                      +{batch.accepted_rows}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-ink-secondary">{batch.skipped_rows}</TableCell>
                    <TableCell className="font-mono text-xs text-status-danger font-medium">
                      {batch.rejected_rows > 0 ? `-${batch.rejected_rows}` : 0}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">
                        {batch.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSelectBatch(batch.id)}
                        className="text-xs text-forest hover:text-forest-deep"
                      >
                        {selectedBatchId === batch.id ? 'Hide Rows' : 'View Rows'}
                        <ChevronRight className={`h-3 w-3 ml-1 transition-transform ${selectedBatchId === batch.id ? 'rotate-90' : ''}`} />
                      </Button>
                    </TableCell>
                  </TableRow>

                  {/* Expanded Batch Rows Panel */}
                  {selectedBatchId === batch.id && (
                    <TableRow>
                      <TableCell colSpan={9} className="p-4 bg-ivory/60 border-t border-b border-divider">
                        <div className="space-y-3">
                          <h4 className="text-xs font-semibold text-forest flex items-center space-x-1.5">
                            <span>Row-Level Import Records for {batch.file_name}</span>
                          </h4>

                          {loadingRows ? (
                            <div className="py-6 text-center text-xs text-ink-secondary">
                              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1 text-forest" />
                              Loading row items...
                            </div>
                          ) : batchRows.length === 0 ? (
                            <p className="text-xs text-ink-secondary">No rows stored for this batch.</p>
                          ) : (
                            <div className="rounded-lg border border-divider bg-ivory-surface overflow-hidden shadow-warm-sm">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Row #</TableHead>
                                    <TableHead>Employee ID</TableHead>
                                    <TableHead>Full Name</TableHead>
                                    <TableHead>Work Email</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Outcome</TableHead>
                                    <TableHead>Reason / Notes</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {batchRows.map((r) => (
                                    <TableRow key={r.id}>
                                      <TableCell className="font-mono text-xs">{r.row_number}</TableCell>
                                      <TableCell className="font-mono text-xs font-bold text-forest">
                                        {r.employee_id || '—'}
                                      </TableCell>
                                      <TableCell className="text-xs">{r.full_name || '—'}</TableCell>
                                      <TableCell className="text-xs">{r.email || '—'}</TableCell>
                                      <TableCell className="text-xs">{r.department || '—'}</TableCell>
                                      <TableCell className="text-xs font-mono">{r.assigned_role || '—'}</TableCell>
                                      <TableCell>
                                        <Badge
                                          variant={
                                            r.outcome?.startsWith('accepted')
                                              ? 'success'
                                              : r.outcome === 'rejected'
                                              ? 'destructive'
                                              : 'outline'
                                          }
                                          className="text-[10px] uppercase font-mono"
                                        >
                                          {r.outcome}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-xs text-ink-secondary max-w-xs truncate">
                                        {r.error_message || '—'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
