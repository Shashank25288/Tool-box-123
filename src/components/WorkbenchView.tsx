import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  RotateCcw,
  Trash2,
  Undo2,
  X,
  XCircle,
} from 'lucide-react';
import {
  BillBreakdown,
  CustomerType,
  FinalizedBill,
  HardwareItem,
  StackEntry,
  formatINR,
  getDefaultDiscountRate,
  getStockStatus,
  toPaise,
} from '../engine/toolboxEngine';

interface WorkbenchViewProps {
  catalog: HardwareItem[];
  stackEntries: StackEntry[];
  customerName: string;
  customerType: CustomerType;
  discountOverride: string;
  gstOverride: string;
  breakdown: BillBreakdown;
  errorBanner: { type: string; message: string } | null;
  lastCompletedBill: FinalizedBill | null;
  onCustomerNameChange: (name: string) => void;
  onCustomerTypeChange: (type: CustomerType) => void;
  onDiscountOverrideChange: (val: string) => void;
  onGstOverrideChange: (val: string) => void;
  onResetRates: () => void;
  onAddItem: (rawId: number | string, rawQty: number | string) => void;
  onUndoLast: () => void;
  onClearStack: () => void;
  onCompleteOrder: () => void;
  onResetCatalog: () => void;
  onDismissError: () => void;
  onLoadPresetCase: (preset: 'case1' | 'case2' | 'case3' | 'case4') => void;
}

export const WorkbenchView: React.FC<WorkbenchViewProps> = ({
  catalog,
  stackEntries,
  customerName,
  customerType,
  discountOverride,
  gstOverride,
  breakdown,
  errorBanner,
  lastCompletedBill,
  onCustomerNameChange,
  onCustomerTypeChange,
  onDiscountOverrideChange,
  onGstOverrideChange,
  onResetRates,
  onAddItem,
  onUndoLast,
  onClearStack,
  onCompleteOrder,
  onResetCatalog,
  onDismissError,
  onLoadPresetCase,
}) => {
  const [rowQuantities, setRowQuantities] = useState<Record<number, string>>({});
  const [manualId, setManualId] = useState<string>('999');
  const [manualQty, setManualQty] = useState<string>('1');

  const stackedByItem = stackEntries.reduce<Record<number, number>>((acc, entry) => {
    acc[entry.itemId] = (acc[entry.itemId] ?? 0) + entry.quantity;
    return acc;
  }, {});

  const handleRowSubmit = (itemId: number) => {
    const qty = rowQuantities[itemId] ?? '1';
    onAddItem(itemId, qty);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddItem(manualId, manualQty);
  };

  const defaultDiscountPct = (getDefaultDiscountRate(customerType) * 100).toFixed(0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-50">
            Counter Calculation Workbench
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Add items, adjust customer discount or GST overrides, undo stack entries (-1), and verify stock-safe billing math.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400 mr-1">Quick Load PDF Case:</span>
          <button
            type="button"
            onClick={() => onLoadPresetCase('case1')}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 transition-colors hover:border-amber-500/60 hover:text-amber-300"
          >
            Case 1 (Retail)
          </button>
          <button
            type="button"
            onClick={() => onLoadPresetCase('case2')}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 transition-colors hover:border-amber-500/60 hover:text-amber-300"
          >
            Case 2 (Contractor)
          </button>
          <button
            type="button"
            onClick={() => onLoadPresetCase('case3')}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 transition-colors hover:border-red-500/60 hover:text-red-300"
          >
            Case 3 (Stock Guard)
          </button>
          <button
            type="button"
            onClick={() => onLoadPresetCase('case4')}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 transition-colors hover:border-red-500/60 hover:text-red-300"
          >
            Case 4 (ID 999)
          </button>
        </div>
      </div>

      {errorBanner && (
        <div
          role="alert"
          className="flex items-start justify-between gap-4 rounded-lg border border-red-500/50 bg-red-950/50 px-4 py-3 text-sm text-red-100"
        >
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" aria-hidden="true" />
            <div>
              <p className="font-semibold text-red-200">{errorBanner.type}</p>
              <p className="mt-0.5 text-red-100/90">{errorBanner.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismissError}
            aria-label="Dismiss error"
            className="rounded p-1 text-red-300 hover:bg-red-900/60 hover:text-red-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Catalog & Manual SKU Probe */}
        <div className="space-y-6 lg:col-span-7">
          <section className="rounded-lg border border-slate-800 bg-slate-900">
            <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-100">Hardware Catalog</h2>
                <p className="text-xs text-slate-400">
                  Stock below 10 displays LOW status · Unit prices in INR (₹)
                </p>
              </div>
              <button
                type="button"
                onClick={onResetCatalog}
                className="inline-flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 whitespace-nowrap shrink-0 transition-colors hover:border-slate-500 hover:text-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Reset Stock</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
                    <th className="py-2.5 pl-5 pr-3">ID</th>
                    <th className="py-2.5 px-3">Item & Category</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-right">Stock</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 pl-3 pr-5 text-right">Add to Order</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {catalog.map((item) => {
                    const status = getStockStatus(item.stock);
                    const inStack = stackedByItem[item.id] ?? 0;
                    const qtyVal = rowQuantities[item.id] ?? '1';
                    return (
                      <tr
                        key={item.id}
                        className="transition-colors hover:bg-slate-800/40"
                      >
                        <td className="py-3 pl-5 pr-3 font-mono text-xs text-slate-300 tabular-nums">
                          {item.id}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-100">{item.name}</div>
                          <div className="text-xs text-slate-400">
                            {item.category}
                            {inStack > 0 && (
                              <>
                                <span aria-hidden="true"> · </span>
                                <span className="font-mono text-amber-400 tabular-nums">
                                  {inStack} in order
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-200 tabular-nums">
                          {formatINR(toPaise(item.unitPrice))}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-200 tabular-nums">
                          {item.stock}
                        </td>
                        <td className="py-3 px-3">
                          {status === 'LOW' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span>LOW</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span>OK</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 pl-3 pr-5">
                          <div className="flex items-center justify-end gap-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              aria-label={`Quantity for ${item.name}`}
                              value={qtyVal}
                              onChange={(e) =>
                                setRowQuantities((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              className="w-14 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-right font-mono text-xs text-slate-100 tabular-nums focus:border-amber-500 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleRowSubmit(item.id)}
                              className="inline-flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-xs font-semibold text-amber-400 border border-slate-700 whitespace-nowrap shrink-0 transition-colors hover:border-amber-500 hover:bg-amber-500 hover:text-slate-950"
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Add</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Direct SKU & Input Validation Probe */}
          <section className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-base font-semibold text-slate-100">
              Manual SKU & Validation Entry
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Test arbitrary item IDs (e.g. 999) or invalid quantities (e.g. -5, 0, abc) directly against the engine guardrails.
            </p>
            <form
              onSubmit={handleManualSubmit}
              className="mt-4 flex flex-wrap items-end gap-3"
            >
              <div className="min-w-[130px] flex-1">
                <label
                  htmlFor="manual-sku"
                  className="block text-xs font-medium text-slate-300"
                >
                  Item ID
                </label>
                <input
                  id="manual-sku"
                  type="text"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  placeholder="e.g. 101 or 999"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="min-w-[130px] flex-1">
                <label
                  htmlFor="manual-qty"
                  className="block text-xs font-medium text-slate-300"
                >
                  Quantity
                </label>
                <input
                  id="manual-qty"
                  type="text"
                  value={manualQty}
                  onChange={(e) => setManualQty(e.target.value)}
                  placeholder="e.g. 2, -1, abc"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 focus:border-amber-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="rounded-md bg-slate-800 border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 whitespace-nowrap shrink-0 transition-colors hover:border-amber-500 hover:text-amber-300"
              >
                Validate & Push
              </button>
            </form>
          </section>
        </div>

        {/* Right Column: Calculation Engine, Overrides, Stack & Receipt */}
        <div className="space-y-6 lg:col-span-5">
          <section className="rounded-lg border border-slate-800 bg-slate-900">
            <div className="border-b border-slate-800 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-100">
                Billing Calculation & Overrides
              </h2>
              <p className="text-xs text-slate-400">
                Subtotal → Customer Discount → GST on Discounted Base
              </p>
            </div>

            <div className="space-y-5 p-5">
              {/* Customer Settings */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="customer-name"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Customer Name
                  </label>
                  <input
                    id="customer-name"
                    type="text"
                    value={customerName}
                    onChange={(e) => onCustomerNameChange(e.target.value)}
                    placeholder="Walk-In Counter"
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <span className="block text-xs font-medium text-slate-300">
                    Customer Type
                  </span>
                  <div className="mt-1 grid grid-cols-2 gap-1 rounded-md border border-slate-700 bg-slate-950 p-1">
                    {(['Retail', 'Contractor'] as CustomerType[]).map((type) => {
                      const active = customerType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => onCustomerTypeChange(type)}
                          className={`rounded py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                            active
                              ? 'bg-amber-500 text-slate-950'
                              : 'text-slate-300 hover:text-slate-100'
                          }`}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Editable Discount & GST Overrides */}
              <div className="border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-300">
                    Tax & Discount Rate Overrides
                  </span>
                  {(breakdown.isDiscountOverridden || breakdown.isGstOverridden) && (
                    <button
                      type="button"
                      onClick={onResetRates}
                      className="text-xs font-medium text-amber-400 hover:text-amber-300 underline underline-offset-2"
                    >
                      Reset to PDF Defaults
                    </button>
                  )}
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="discount-override"
                      className="flex items-center justify-between text-xs text-slate-400"
                    >
                      <span>Discount (%)</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        Default {defaultDiscountPct}%
                      </span>
                    </label>
                    <input
                      id="discount-override"
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      value={discountOverride}
                      placeholder={defaultDiscountPct}
                      onChange={(e) => onDiscountOverrideChange(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-sm text-slate-100 tabular-nums placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="gst-override"
                      className="flex items-center justify-between text-xs text-slate-400"
                    >
                      <span>GST (%)</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        Default 18%
                      </span>
                    </label>
                    <input
                      id="gst-override"
                      type="number"
                      min={0}
                      max={100}
                      step="0.5"
                      value={gstOverride}
                      placeholder="18"
                      onChange={(e) => onGstOverrideChange(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-sm text-slate-100 tabular-nums placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Active ItemStack */}
              <div className="border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-300">
                    Order ItemStack ({stackEntries.length} push{stackEntries.length === 1 ? '' : 'es'})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onUndoLast}
                      disabled={stackEntries.length === 0}
                      className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed hover:border-amber-500/70 hover:text-amber-300"
                    >
                      <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Undo (-1)</span>
                    </button>
                    <button
                      type="button"
                      onClick={onClearStack}
                      disabled={stackEntries.length === 0}
                      className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed hover:border-red-500/60 hover:text-red-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Clear</span>
                    </button>
                  </div>
                </div>

                {breakdown.lines.length === 0 ? (
                  <div className="mt-3 rounded border border-dashed border-slate-700 bg-slate-950/60 px-4 py-6 text-center text-xs text-slate-400">
                    Order stack is empty. Add items from the catalog or load a PDF test case above.
                  </div>
                ) : (
                  <div className="mt-3 divide-y divide-slate-800 rounded border border-slate-800 bg-slate-950/70">
                    {breakdown.lines.map((line) => (
                      <div
                        key={line.itemId}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-100">
                            {line.itemName}
                          </div>
                          <div className="font-mono text-xs text-slate-400 tabular-nums">
                            {line.quantity} × {formatINR(toPaise(line.unitPrice))}
                          </div>
                        </div>
                        <div className="font-mono text-sm font-medium text-slate-100 tabular-nums shrink-0">
                          {formatINR(line.lineTotalPaise)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Calculation Breakdown */}
              <div className="border-t border-slate-800 pt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">{breakdown.formattedSubtotal}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>
                    Discount ({(breakdown.effectiveDiscountRate * 100).toFixed(1).replace(/\.0$/, '')}%)
                    {breakdown.isDiscountOverridden && (
                      <span className="ml-1.5 text-xs text-amber-400">· Overridden</span>
                    )}
                  </span>
                  <span className="font-mono text-emerald-400 tabular-nums">
                    −{breakdown.formattedDiscount}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Discounted Base</span>
                  <span className="font-mono tabular-nums">
                    {breakdown.formattedDiscountedSubtotal}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>
                    GST ({(breakdown.effectiveGstRate * 100).toFixed(1).replace(/\.0$/, '')}%)
                    {breakdown.isGstOverridden && (
                      <span className="ml-1.5 text-xs text-amber-400">· Overridden</span>
                    )}
                  </span>
                  <span className="font-mono tabular-nums">+{breakdown.formattedGst}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-slate-700 pt-3">
                  <span className="text-base font-semibold text-slate-100">Final Total</span>
                  <span className="font-mono text-2xl font-bold text-amber-400 tabular-nums">
                    {breakdown.formattedFinalTotal}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onCompleteOrder}
                disabled={breakdown.lines.length === 0}
                className="w-full rounded-md bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Complete Order & Deduct Stock
              </button>
            </div>
          </section>

          {lastCompletedBill && (
            <section className="rounded-lg border border-emerald-500/40 bg-slate-900 p-5">
              <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <p className="text-xs font-medium text-emerald-400">Latest Completed Bill</p>
                  <h3 className="font-mono text-lg font-bold text-slate-50 tabular-nums">
                    {lastCompletedBill.orderId} · Token #{lastCompletedBill.tokenNumber}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Collection</div>
                  <div className="font-mono text-sm font-semibold text-amber-400">
                    {lastCompletedBill.yard}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>
                  {lastCompletedBill.customerName} · {lastCompletedBill.customerType}
                </span>
                <span className="font-mono text-base font-bold text-slate-100 tabular-nums">
                  {lastCompletedBill.formattedFinalTotal}
                </span>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
