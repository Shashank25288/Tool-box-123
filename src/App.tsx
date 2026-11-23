/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useRef, useState } from 'react';
import { ActiveTab, TopBar } from './components/TopBar';
import { WorkbenchView } from './components/WorkbenchView';
import { TestSuiteView } from './components/TestSuiteView';
import { BillLedgerView } from './components/BillLedgerView';
import { RulesView } from './components/RulesView';
import {
  CustomerType,
  FinalizedBill,
  ToolBoxCounterEngine,
} from './engine/toolboxEngine';
import {
  TestSuiteSummary,
  runAllTestCases,
  runSingleTestCase,
} from './engine/testSuite';

function parseOptionalRate(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function App() {
  const engineRef = useRef<ToolBoxCounterEngine>(new ToolBoxCounterEngine());
  const [, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  const [activeTab, setActiveTab] = useState<ActiveTab>('workbench');
  const [customerName, setCustomerName] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('Retail');
  const [discountOverride, setDiscountOverride] = useState('');
  const [gstOverride, setGstOverride] = useState('');
  const [errorBanner, setErrorBanner] = useState<{ type: string; message: string } | null>(
    null,
  );
  const [lastCompletedBill, setLastCompletedBill] = useState<FinalizedBill | null>(null);

  const [suiteSummary, setSuiteSummary] = useState<TestSuiteSummary>(() =>
    runAllTestCases(),
  );

  const overrides = useMemo(
    () => ({
      discountPercent: parseOptionalRate(discountOverride),
      gstPercent: parseOptionalRate(gstOverride),
    }),
    [discountOverride, gstOverride],
  );

  const engine = engineRef.current;
  const catalog = engine.getCatalog();
  const stackEntries = engine.stack.toArray();
  const breakdown = engine.previewOrder(customerType, overrides);
  const orders = engine.getOrders();
  const salesReport = engine.getSalesReport();

  const handleAddItem = (rawId: number | string, rawQty: number | string) => {
    try {
      engine.addItem(rawId, rawQty);
      setErrorBanner(null);
      bump();
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setErrorBanner({
        type: errorObj.name || 'ValidationError',
        message: errorObj.message,
      });
    }
  };

  const handleUndoLast = () => {
    engine.undoLastItem();
    setErrorBanner(null);
    bump();
  };

  const handleClearStack = () => {
    engine.clearCurrentOrder();
    setErrorBanner(null);
    bump();
  };

  const handleCompleteOrder = () => {
    try {
      const bill = engine.completeOrder(customerName, customerType, overrides);
      setLastCompletedBill(bill);
      setCustomerName('');
      setErrorBanner(null);
      bump();
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setErrorBanner({
        type: errorObj.name || 'OrderError',
        message: errorObj.message,
      });
    }
  };

  const handleResetCatalog = () => {
    engine.resetAll();
    setLastCompletedBill(null);
    setErrorBanner(null);
    bump();
  };

  const handleResetRates = () => {
    setDiscountOverride('');
    setGstOverride('');
  };

  const handleLoadPresetCase = (preset: 'case1' | 'case2' | 'case3' | 'case4') => {
    engine.resetAll();
    setDiscountOverride('');
    setGstOverride('');
    setLastCompletedBill(null);
    setErrorBanner(null);

    if (preset === 'case1') {
      setCustomerType('Retail');
      setCustomerName('Case 1 Retail');
      engine.addItem(101, 2);
      engine.addItem(105, 1);
      bump();
      return;
    }

    if (preset === 'case2') {
      setCustomerType('Contractor');
      setCustomerName('Case 2 Contractor');
      engine.addItem(102, 3);
      engine.addItem(106, 2);
      bump();
      return;
    }

    if (preset === 'case3') {
      setCustomerType('Retail');
      setCustomerName('Case 3 Stock Guard');
      bump();
      handleAddItem(102, 19);
      return;
    }

    if (preset === 'case4') {
      setCustomerType('Retail');
      setCustomerName('Case 4 Unknown SKU');
      bump();
      handleAddItem(999, 1);
    }
  };

  const handleRunAllTests = () => {
    const fresh = runAllTestCases();
    setSuiteSummary(fresh);
    setActiveTab('tests');
  };

  const handleRunSingleTest = (caseId: string) => {
    const updatedCase = runSingleTestCase(caseId);
    setSuiteSummary((prev) => {
      const results = prev.results.map((r) => (r.id === caseId ? updatedCase : r));
      const passed = results.filter((r) => r.passed).length;
      return {
        ...prev,
        passed,
        failed: results.length - passed,
        executedAt: new Date().toISOString(),
        results,
      };
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onRunAllTests={handleRunAllTests}
      />

      <main className="mx-auto w-full max-w-[1360px] flex-1 px-6 py-8">
        {activeTab === 'workbench' && (
          <WorkbenchView
            catalog={catalog}
            stackEntries={stackEntries}
            customerName={customerName}
            customerType={customerType}
            discountOverride={discountOverride}
            gstOverride={gstOverride}
            breakdown={breakdown}
            errorBanner={errorBanner}
            lastCompletedBill={lastCompletedBill}
            onCustomerNameChange={setCustomerName}
            onCustomerTypeChange={setCustomerType}
            onDiscountOverrideChange={setDiscountOverride}
            onGstOverrideChange={setGstOverride}
            onResetRates={handleResetRates}
            onAddItem={handleAddItem}
            onUndoLast={handleUndoLast}
            onClearStack={handleClearStack}
            onCompleteOrder={handleCompleteOrder}
            onResetCatalog={handleResetCatalog}
            onDismissError={() => setErrorBanner(null)}
            onLoadPresetCase={handleLoadPresetCase}
          />
        )}

        {activeTab === 'tests' && (
          <TestSuiteView
            summary={suiteSummary}
            onRunAll={handleRunAllTests}
            onRunSingle={handleRunSingleTest}
          />
        )}

        {activeTab === 'ledger' && (
          <BillLedgerView
            orders={orders}
            salesReport={salesReport}
            onGoToWorkbench={() => setActiveTab('workbench')}
          />
        )}

        {activeTab === 'rules' && <RulesView />}
      </main>
    </div>
  );
}
