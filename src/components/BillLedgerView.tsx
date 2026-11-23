import React, { useState } from 'react';
import { Search } from 'lucide-react';
import {
  FinalizedBill,
  SalesReport,
  formatINR,
  toPaise,
} from '../engine/toolboxEngine';

interface BillLedgerViewProps {
  orders: FinalizedBill[];
  salesReport: SalesReport;
  onGoToWorkbench: () => void;
}

export const BillLedgerView: React.FC<BillLedgerViewProps> = ({
  orders,
  salesReport,
  onGoToWorkbench,
}) => {
  const [searchId, setSearchId] = useState('');

  const query = searchId.trim().toUpperCase();
  const matchedOrders = query
    ? orders.filter((o) => o.orderId.toUpperCase().includes(query))
    : orders;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">
          Bill Lookup & Day Sales Report
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Find completed counter bills by order ID (HW1, HW2, ...) and review end-of-day sales totals.
        </p>
      </div>

      {/* End-of-Day Sales Report Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-400">Total Orders</div>
          <div className="mt-1 font-mono text-2xl font-bold text-slate-50 tabular-nums">
            {salesReport.totalOrders}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-400">Total Revenue</div>
          <div className="mt-1 font-mono text-2xl font-bold text-amber-400 tabular-nums">
            {salesReport.formattedTotalRevenue}
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="text-xs font-medium text-slate-400">Most Popular Item</div>
          <div className="mt-1 text-lg font-semibold text-slate-100">
            {salesReport.mostPopularItem
              ? `${salesReport.mostPopularItem.itemName} (${salesReport.mostPopularItem.unitsSold})`
              : 'No sales yet'}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder="Find bill by Order ID (e.g. HW1)"
            aria-label="Find bill by Order ID"
            className="w-full rounded-md border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 font-mono text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-900/60 px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-200">
            No completed orders in this session yet.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Complete an order in the Counter Workbench to mint an HW# bill and Yard collection token.
          </p>
          <button
            type="button"
            onClick={onGoToWorkbench}
            className="mt-4 rounded-md bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400"
          >
            Go to Workbench
          </button>
        </div>
      ) : matchedOrders.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900 px-6 py-8 text-center text-sm text-slate-400">
          No bill found matching &ldquo;{searchId}&rdquo;.
        </div>
      ) : (
        <div className="space-y-4">
          {matchedOrders.map((bill) => (
            <article
              key={bill.orderId}
              className="rounded-lg border border-slate-800 bg-slate-900 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
                <div>
                  <h2 className="font-mono text-base font-bold text-slate-100 tabular-nums">
                    {bill.orderId} · Token #{bill.tokenNumber} · {bill.yard}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {bill.customerName} · {bill.customerType} ·{' '}
                    {new Date(bill.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Final Total</div>
                  <div className="font-mono text-xl font-bold text-amber-400 tabular-nums">
                    {bill.formattedFinalTotal}
                  </div>
                </div>
              </div>

              <div className="mt-3 divide-y divide-slate-800/70 text-xs">
                {bill.lines.map((line) => (
                  <div
                    key={line.itemId}
                    className="flex items-center justify-between py-2 text-slate-300"
                  >
                    <span>
                      {line.itemName} ({line.quantity} × {formatINR(toPaise(line.unitPrice))})
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatINR(line.lineTotalPaise)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-end gap-6 border-t border-slate-800 pt-3 font-mono text-xs text-slate-400 tabular-nums">
                <span>Subtotal {bill.formattedSubtotal}</span>
                <span>
                  Discount ({(bill.effectiveDiscountRate * 100).toFixed(0)}%) −{bill.formattedDiscount}
                </span>
                <span>
                  GST ({(bill.effectiveGstRate * 100).toFixed(0)}%) +{bill.formattedGst}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
