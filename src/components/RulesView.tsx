import React from 'react';
import { INITIAL_CATALOG, formatINR, toPaise } from '../engine/toolboxEngine';

export const RulesView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-50">
          ToolBox Specification & Calculation Rules
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Reference rules implemented by the billing calculation engine from the hackathon problem sheet.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-100">
            Pricing & Tax Calculation Pipeline
          </h2>
          <ol className="space-y-2.5 text-sm text-slate-300 list-decimal list-inside">
            <li>
              Compute itemized line totals in integer paise (<code className="font-mono text-amber-300">unitPrice × 100 × quantity</code>) and sum recursively for the order Subtotal.
            </li>
            <li>
              Apply customer discount: <strong className="text-slate-100">Retail = 0%</strong>, <strong className="text-slate-100">Contractor = 12%</strong> (or active workbench override).
            </li>
            <li>
              Subtract rounded discount from Subtotal to obtain the Taxable Discounted Base.
            </li>
            <li>
              Apply <strong className="text-slate-100">18% GST</strong> (<code className="font-mono text-amber-300">GST = 0.18</code>, or active override) onto the discounted base and format to 2 decimal places (<code className="font-mono text-amber-300">₹X,XXX.XX</code>).
            </li>
          </ol>
        </section>

        <section className="rounded-lg border border-slate-800 bg-slate-900 p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-100">
            Validation, Stack Undo & Yard Dispatch
          </h2>
          <ul className="space-y-2.5 text-sm text-slate-300">
            <li>
              <strong className="font-mono text-red-300">HardwareItemNotFoundException</strong>: Thrown when an item ID is not in catalog <code className="font-mono">101–106</code> (e.g. <code className="font-mono">999</code>). Counter continues safely.
            </li>
            <li>
              <strong className="font-mono text-red-300">InsufficientStockException</strong>: Thrown when requested quantity (including stacked items) exceeds available stock. Rejected orders never modify stock.
            </li>
            <li>
              <strong className="text-slate-100">Undo Stack (-1)</strong>: LIFO <code className="font-mono">ItemStack</code> pops the latest pushed item without touching committed inventory.
            </li>
            <li>
              <strong className="text-slate-100">Yard Routing (<code className="font-mono">token &amp; 1</code>)</strong>: Odd tokens collect at <strong className="text-amber-300">Yard 1</strong>; even tokens collect at <strong className="text-amber-300">Yard 2</strong>.
            </li>
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-100">
            Baseline Catalog & PDF Test Expectations
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
                <th className="py-2.5 pl-5 pr-3">ID</th>
                <th className="py-2.5 px-3">Item</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Price</th>
                <th className="py-2.5 pl-3 pr-5 text-right">Initial Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {INITIAL_CATALOG.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 pl-5 pr-3 font-mono text-xs text-slate-300 tabular-nums">
                    {item.id}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-100">{item.name}</td>
                  <td className="py-2.5 px-3 text-slate-400">{item.category}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-200 tabular-nums">
                    {formatINR(toPaise(item.unitPrice))}
                  </td>
                  <td className="py-2.5 pl-3 pr-5 text-right font-mono text-slate-200 tabular-nums">
                    {item.stock}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
