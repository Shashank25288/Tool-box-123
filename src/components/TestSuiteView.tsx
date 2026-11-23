import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Play,
  XCircle,
} from 'lucide-react';
import {
  TestSuiteSummary,
  buildMarkdownReport,
} from '../engine/testSuite';

interface TestSuiteViewProps {
  summary: TestSuiteSummary;
  onRunAll: () => void;
  onRunSingle: (caseId: string) => void;
}

type CaseFilter = 'all' | 'pdf' | 'invariants' | 'failed';

export const TestSuiteView: React.FC<TestSuiteViewProps> = ({
  summary,
  onRunAll,
  onRunSingle,
}) => {
  const [filter, setFilter] = useState<CaseFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>('CASE-3');
  const [copied, setCopied] = useState(false);

  const filteredResults = summary.results.filter((r) => {
    if (filter === 'pdf') return r.category === 'PDF Benchmark';
    if (filter === 'invariants') return r.category === 'Engine Invariant';
    if (filter === 'failed') return !r.passed;
    return true;
  });

  const failedResults = summary.results.filter((r) => !r.passed);
  const reportText = buildMarkdownReport(summary);

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">
            Billing Engine Verification Suite
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Executes PDF test cases 1–4 and engine invariants against isolated catalog instances with zero side effects.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCopyReport}
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 whitespace-nowrap shrink-0 transition-colors hover:border-slate-500 hover:text-slate-50"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{copied ? 'Copied Report' : 'Copy Summary Report'}</span>
          </button>
          <button
            type="button"
            onClick={onRunAll}
            className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 whitespace-nowrap shrink-0 transition-colors hover:bg-amber-400"
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
            <span>Re-run Suite</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-400">Total Cases</div>
          <div className="mt-1 font-mono text-2xl font-bold text-slate-50 tabular-nums">
            {summary.total}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-400">Passed</div>
          <div className="mt-1 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
            {summary.passed}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-400">Failed</div>
          <div
            className={`mt-1 font-mono text-2xl font-bold tabular-nums ${
              summary.failed > 0 ? 'text-red-400' : 'text-slate-200'
            }`}
          >
            {summary.failed}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-400">Suite Runtime</div>
          <div className="mt-1 font-mono text-2xl font-bold text-amber-400 tabular-nums">
            {summary.totalDurationMs.toFixed(2)} ms
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900 p-1">
          {(
            [
              { id: 'all', label: `All (${summary.total})` },
              {
                id: 'pdf',
                label: `PDF Cases (${summary.results.filter((r) => r.category === 'PDF Benchmark').length})`,
              },
              {
                id: 'invariants',
                label: `Invariants (${summary.results.filter((r) => r.category === 'Engine Invariant').length})`,
              },
              { id: 'failed', label: `Failed (${summary.failed})` },
            ] as Array<{ id: CaseFilter; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === tab.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-slate-300 hover:text-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <span className="font-mono text-xs text-slate-400 tabular-nums">
          Last executed {new Date(summary.executedAt).toLocaleTimeString()}
        </span>
      </div>

      {/* Test Case Table */}
      <section className="rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">
        {filteredResults.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-400">
            No test cases match the selected filter ({filter === 'failed' ? '0 failed cases' : 'empty'}).
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredResults.map((result) => {
              const isExpanded = expandedId === result.id;
              return (
                <div key={result.id} className="bg-slate-900">
                  <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-800/40 transition-colors">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : result.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      <span className="font-mono text-xs font-semibold text-amber-400 shrink-0 tabular-nums">
                        {result.id}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-100">
                          {result.title}
                        </div>
                        <div className="truncate text-xs text-slate-400">
                          {result.category} · {result.inputSummary}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-4 shrink-0">
                      <span className="font-mono text-xs text-slate-400 tabular-nums">
                        {result.durationMs.toFixed(2)} ms
                      </span>
                      {result.passed ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          <span>PASS</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400">
                          <XCircle className="h-4 w-4" aria-hidden="true" />
                          <span>FAIL</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onRunSingle(result.id)}
                        className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 whitespace-nowrap transition-colors hover:border-amber-500 hover:text-amber-300"
                      >
                        Run
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-800/80 bg-slate-950/60 px-5 py-4 text-xs space-y-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <div className="font-medium text-slate-400">Expected Outcome</div>
                          <div className="mt-1 font-mono text-slate-200">
                            {result.expectedSummary}
                          </div>
                        </div>
                        <div>
                          <div className="font-medium text-slate-400">Actual Outcome</div>
                          <div
                            className={`mt-1 font-mono ${
                              result.passed ? 'text-emerald-300' : 'text-red-300'
                            }`}
                          >
                            {result.actualSummary}
                          </div>
                        </div>
                      </div>

                      {result.mathTrace && (
                        <div className="border-t border-slate-800 pt-3">
                          <div className="font-medium text-slate-400 mb-2">
                            Calculation Breakdown Trace
                          </div>
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 font-mono tabular-nums">
                            <div>
                              <span className="block text-[11px] text-slate-500">Subtotal</span>
                              <span className="text-slate-200">{result.mathTrace.subtotal}</span>
                            </div>
                            <div>
                              <span className="block text-[11px] text-slate-500">
                                Discount ({result.mathTrace.discountLabel})
                              </span>
                              <span className="text-emerald-400">
                                −{result.mathTrace.discountAmount}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[11px] text-slate-500">Taxable Base</span>
                              <span className="text-slate-200">{result.mathTrace.taxableBase}</span>
                            </div>
                            <div>
                              <span className="block text-[11px] text-slate-500">
                                GST ({result.mathTrace.gstLabel})
                              </span>
                              <span className="text-slate-200">+{result.mathTrace.gstAmount}</span>
                            </div>
                            <div>
                              <span className="block text-[11px] text-slate-500">Final Total</span>
                              <span className="font-semibold text-amber-400">
                                {result.mathTrace.finalTotal}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[11px] text-slate-500">Dispatch</span>
                              <span className="text-slate-200">
                                {result.mathTrace.orderId} · {result.mathTrace.yard}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="border-t border-slate-800 pt-3 flex flex-wrap items-center justify-between gap-2 text-slate-400">
                        <span>
                          Stock Mutation Status:{' '}
                          <strong className="font-mono text-slate-200">
                            {result.stockUnchanged ? 'UNCHANGED (Safe)' : 'DECREMENTED (Committed)'}
                          </strong>
                        </span>
                        <span className="font-mono text-[11px] tabular-nums">
                          {result.stockAfter
                            .map((s) => `${s.id}:${s.stock}`)
                            .join(' · ')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Failure Summary Report Panel */}
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Failed Test Cases Summary Report
            </h2>
            <p className="text-xs text-slate-400">
              Review log for any assertion mismatches or exception discrepancies
            </p>
          </div>
          <span
            className={`font-mono text-xs font-semibold ${
              failedResults.length === 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {failedResults.length} Failed
          </span>
        </div>

        {failedResults.length === 0 ? (
          <div className="mt-4 flex items-start gap-3 text-sm text-slate-300">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
            <div>
              <p className="font-medium text-slate-100">
                All {summary.total} verification checks passed with 0 failures.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Cases 1 and 2 match ₹3,894.00 and ₹1,557.60 exactly; Case 3 rejects 19 × Screwdriver Set with InsufficientStockException while keeping stock at 18; Case 4 catches ID 999 with HardwareItemNotFoundException and continues without interruption.
              </p>
            </div>
          </div>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {failedResults.map((fail) => (
              <li
                key={fail.id}
                className="rounded border border-red-500/40 bg-red-950/30 p-3 text-red-100"
              >
                <div className="font-mono text-xs font-semibold text-red-300">
                  {fail.id} — {fail.title}
                </div>
                <p className="mt-1 text-xs text-red-200">{fail.failureReason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
