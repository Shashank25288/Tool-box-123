import {
  FinalizedBill,
  HardwareItem,
  HardwareItemNotFoundException,
  INITIAL_CATALOG,
  InsufficientStockException,
  InvalidInputException,
  ToolBoxCounterEngine,
  getStockStatus,
  getYardForToken,
} from './toolboxEngine';

export type TestCategory = 'PDF Benchmark' | 'Engine Invariant';

export interface TestCaseResult {
  id: string;
  title: string;
  category: TestCategory;
  inputSummary: string;
  expectedSummary: string;
  actualSummary: string;
  passed: boolean;
  durationMs: number;
  failureReason?: string;
  mathTrace?: {
    subtotal: string;
    discountLabel: string;
    discountAmount: string;
    taxableBase: string;
    gstLabel: string;
    gstAmount: string;
    finalTotal: string;
    orderId?: string;
    yard?: string;
  };
  stockBefore: HardwareItem[];
  stockAfter: HardwareItem[];
  stockUnchanged: boolean;
}

export interface TestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  executedAt: string;
  totalDurationMs: number;
  results: TestCaseResult[];
}

export interface TestCaseDefinition {
  id: string;
  title: string;
  category: TestCategory;
  inputSummary: string;
  expectedSummary: string;
  execute: () => Omit<TestCaseResult, 'id' | 'title' | 'category' | 'inputSummary' | 'expectedSummary' | 'durationMs'>;
}

function stocksEqual(a: readonly HardwareItem[], b: readonly HardwareItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].id !== b[i].id || a[i].stock !== b[i].stock) {
      return false;
    }
  }
  return true;
}

function buildMathTrace(bill: FinalizedBill): TestCaseResult['mathTrace'] {
  return {
    subtotal: bill.formattedSubtotal,
    discountLabel: `${(bill.effectiveDiscountRate * 100).toFixed(0)}%`,
    discountAmount: bill.formattedDiscount,
    taxableBase: bill.formattedDiscountedSubtotal,
    gstLabel: `${(bill.effectiveGstRate * 100).toFixed(0)}%`,
    gstAmount: bill.formattedGst,
    finalTotal: bill.formattedFinalTotal,
    orderId: bill.orderId,
    yard: `${bill.yard} (Token #${bill.tokenNumber})`,
  };
}

export const TEST_DEFINITIONS: readonly TestCaseDefinition[] = [
  {
    id: 'CASE-1',
    title: 'Case 1: Retail standard bill (2 × Hammer, 1 × Drill Machine)',
    category: 'PDF Benchmark',
    inputSummary: 'Retail · 2 × Hammer (₹350) + 1 × Drill Machine (₹2,600) · 0% Disc · 18% GST',
    expectedSummary: '₹3,894.00 (Subtotal ₹3,300.00 + GST ₹594.00) · Stock Hammer=18, Drill=5',
    execute: () => {
      const engine = new ToolBoxCounterEngine(INITIAL_CATALOG);
      const stockBefore = engine.getCatalog();
      engine.addItem(101, 2);
      engine.addItem(105, 1);
      const bill = engine.completeOrder('Walk-In Retail', 'Retail');
      const stockAfter = engine.getCatalog();
      const hammerAfter = stockAfter.find((i) => i.id === 101)?.stock;
      const drillAfter = stockAfter.find((i) => i.id === 105)?.stock;

      const totalOk = bill.formattedFinalTotal === '₹3,894.00';
      const stockOk = hammerAfter === 18 && drillAfter === 5;
      const passed = totalOk && stockOk;

      return {
        actualSummary: `${bill.formattedFinalTotal} (Subtotal ${bill.formattedSubtotal} + GST ${bill.formattedGst}) · Stock Hammer=${hammerAfter}, Drill=${drillAfter}`,
        passed,
        failureReason: passed
          ? undefined
          : `Expected ₹3,894.00 with Hammer=18, Drill=5; got ${bill.formattedFinalTotal} with Hammer=${hammerAfter}, Drill=${drillAfter}.`,
        mathTrace: buildMathTrace(bill),
        stockBefore,
        stockAfter,
        stockUnchanged: stocksEqual(stockBefore, stockAfter),
      };
    },
  },
  {
    id: 'CASE-2',
    title: 'Case 2: Contractor discount bill (3 × Screwdriver Set, 2 × Screws)',
    category: 'PDF Benchmark',
    inputSummary: 'Contractor · 3 × Screwdriver Set (₹420) + 2 × Screws (₹120) · 12% Disc · 18% GST',
    expectedSummary: '₹1,557.60 (Subtotal ₹1,500.00 − ₹180.00 Disc + ₹237.60 GST)',
    execute: () => {
      const engine = new ToolBoxCounterEngine(INITIAL_CATALOG);
      const stockBefore = engine.getCatalog();
      engine.addItem(102, 3);
      engine.addItem(106, 2);
      const bill = engine.completeOrder('Apex Builders', 'Contractor');
      const stockAfter = engine.getCatalog();
      const screwSetAfter = stockAfter.find((i) => i.id === 102)?.stock;
      const screwsAfter = stockAfter.find((i) => i.id === 106)?.stock;

      const totalOk = bill.formattedFinalTotal === '₹1,557.60';
      const stockOk = screwSetAfter === 15 && screwsAfter === 48;
      const passed = totalOk && stockOk;

      return {
        actualSummary: `${bill.formattedFinalTotal} (Subtotal ${bill.formattedSubtotal} − ${bill.formattedDiscount} Disc + ${bill.formattedGst} GST)`,
        passed,
        failureReason: passed
          ? undefined
          : `Expected ₹1,557.60; got ${bill.formattedFinalTotal}.`,
        mathTrace: buildMathTrace(bill),
        stockBefore,
        stockAfter,
        stockUnchanged: stocksEqual(stockBefore, stockAfter),
      };
    },
  },
  {
    id: 'CASE-3',
    title: 'Case 3: Insufficient stock rejection (19 × Screwdriver Set)',
    category: 'PDF Benchmark',
    inputSummary: 'Retail · 19 × Screwdriver Set (ID 102, available stock = 18)',
    expectedSummary: 'InsufficientStockException thrown, catalog stock unchanged (18)',
    execute: () => {
      const engine = new ToolBoxCounterEngine(INITIAL_CATALOG);
      const stockBefore = engine.getCatalog();
      let caughtError: unknown = null;

      try {
        engine.addItem(102, 19);
      } catch (err) {
        caughtError = err;
      }

      const stockAfter = engine.getCatalog();
      const unchanged = stocksEqual(stockBefore, stockAfter);
      const isExpectedException = caughtError instanceof InsufficientStockException;
      const passed = isExpectedException && unchanged;

      return {
        actualSummary:
          caughtError instanceof InsufficientStockException
            ? `${caughtError.name} thrown, stock unchanged (${stockAfter.find((i) => i.id === 102)?.stock})`
            : `Unexpected result: ${caughtError ? String(caughtError) : 'No exception thrown'}`,
        passed,
        failureReason: passed
          ? undefined
          : `Expected InsufficientStockException with unchanged stock; got ${caughtError ? String(caughtError) : 'no error'} (unchanged=${unchanged}).`,
        stockBefore,
        stockAfter,
        stockUnchanged: unchanged,
      };
    },
  },
  {
    id: 'CASE-4',
    title: 'Case 4: Unknown item ID handling (ID 999) & continuation',
    category: 'PDF Benchmark',
    inputSummary: 'Lookup ID 999 -> catch exception -> continue with 1 × Hammer (ID 101)',
    expectedSummary: 'HardwareItemNotFoundException thrown, engine continues & bills 1 × Hammer = ₹413.00',
    execute: () => {
      const engine = new ToolBoxCounterEngine(INITIAL_CATALOG);
      const stockBefore = engine.getCatalog();
      let caughtError: unknown = null;

      try {
        engine.addItem(999, 1);
      } catch (err) {
        caughtError = err;
      }

      // Engine must keep running and process valid follow-up order
      engine.addItem(101, 1);
      const bill = engine.completeOrder('Recovery Customer', 'Retail');
      const stockAfter = engine.getCatalog();

      const isNotFound = caughtError instanceof HardwareItemNotFoundException;
      const recoveryOk = bill.formattedFinalTotal === '₹413.00';
      const passed = isNotFound && recoveryOk;

      return {
        actualSummary: isNotFound
          ? `HardwareItemNotFoundException thrown; continued cleanly -> ${bill.formattedFinalTotal}`
          : `Missing expected HardwareItemNotFoundException (${String(caughtError)})`,
        passed,
        failureReason: passed
          ? undefined
          : `Expected HardwareItemNotFoundException and recovery bill ₹413.00; got ${String(caughtError)} / ${bill.formattedFinalTotal}.`,
        mathTrace: buildMathTrace(bill),
        stockBefore,
        stockAfter,
        stockUnchanged: stocksEqual(stockBefore, stockAfter),
      };
    },
  },
  {
    id: 'EDGE-5',
    title: 'Invariant 5: Undo stack (-1) & cumulative item stock guard',
    category: 'Engine Invariant',
    inputSummary: 'Add 2 × Hammer, add 1 × Drill Machine, undo (-1), verify bill = ₹826.00; block cumulative 7 × Drill',
    expectedSummary: 'Undo removes Drill Machine (₹826.00); cumulative 4+3 Drill throws InsufficientStockException',
    execute: () => {
      const engine = new ToolBoxCounterEngine(INITIAL_CATALOG);
      const stockBefore = engine.getCatalog();

      engine.addItem(101, 2);
      engine.addItem(105, 1);
      const popped = engine.undoLastItem();
      const bill = engine.completeOrder('Undo Check', 'Retail');

      // Now test cumulative stock guard: Drill Machine stock is 6; push 4 then attempt +3 (=7)
      let cumulativeRejected = false;
      engine.addItem(105, 4);
      try {
        engine.addItem(105, 3);
      } catch (err) {
        cumulativeRejected = err instanceof InsufficientStockException;
      }
      engine.clearCurrentOrder();

      const stockAfter = engine.getCatalog();
      const passed =
        popped?.itemId === 105 &&
        bill.formattedFinalTotal === '₹826.00' &&
        cumulativeRejected &&
        stockAfter.find((i) => i.id === 105)?.stock === 6;

      return {
        actualSummary: `Popped ${popped?.itemName ?? 'none'}, billed ${bill.formattedFinalTotal}; cumulative 4+3 rejected=${cumulativeRejected}`,
        passed,
        failureReason: passed
          ? undefined
          : `Undo/cumulative stock check failed: popped=${popped?.itemId}, bill=${bill.formattedFinalTotal}, cumulativeRejected=${cumulativeRejected}.`,
        mathTrace: buildMathTrace(bill),
        stockBefore,
        stockAfter,
        stockUnchanged: stocksEqual(stockBefore, stockAfter),
      };
    },
  },
  {
    id: 'EDGE-6',
    title: 'Invariant 6: Non-numeric & negative quantity protection',
    category: 'Engine Invariant',
    inputSummary: 'Attempt qty="abc", qty="-5", qty="0", itemId="xyz"',
    expectedSummary: 'All 4 invalid inputs throw InvalidInputException; catalog stock untouched',
    execute: () => {
      const engine = new ToolBoxCounterEngine(INITIAL_CATALOG);
      const stockBefore = engine.getCatalog();
      const invalidCases: Array<[number | string, number | string]> = [
        [101, 'abc'],
        [101, -5],
        [101, 0],
        ['xyz', 2],
      ];

      let rejectedCount = 0;
      for (const [id, qty] of invalidCases) {
        try {
          engine.addItem(id, qty);
        } catch (err) {
          if (err instanceof InvalidInputException) {
            rejectedCount += 1;
          }
        }
      }

      const stockAfter = engine.getCatalog();
      const unchanged = stocksEqual(stockBefore, stockAfter);
      const passed = rejectedCount === invalidCases.length && unchanged;

      return {
        actualSummary: `${rejectedCount}/${invalidCases.length} invalid inputs safely caught; stock unchanged=${unchanged}`,
        passed,
        failureReason: passed
          ? undefined
          : `Only ${rejectedCount}/${invalidCases.length} invalid inputs threw InvalidInputException.`,
        stockBefore,
        stockAfter,
        stockUnchanged: unchanged,
      };
    },
  },
  {
    id: 'EDGE-7',
    title: 'Invariant 7: Editable discount & GST overrides calculation',
    category: 'Engine Invariant',
    inputSummary: 'Contractor · 1 × Wall Paint 4 L (₹1,450) · Discount Override 15% · GST Override 12%',
    expectedSummary: '₹1,380.40 (Subtotal ₹1,450.00 − ₹217.50 Disc = ₹1,232.50 + ₹147.90 GST)',
    execute: () => {
      const engine = new ToolBoxCounterEngine(INITIAL_CATALOG);
      const stockBefore = engine.getCatalog();
      engine.addItem(104, 1);
      const bill = engine.completeOrder('Override Test', 'Contractor', {
        discountPercent: 15,
        gstPercent: 12,
      });
      const stockAfter = engine.getCatalog();

      const passed =
        bill.formattedSubtotal === '₹1,450.00' &&
        bill.formattedDiscount === '₹217.50' &&
        bill.formattedDiscountedSubtotal === '₹1,232.50' &&
        bill.formattedGst === '₹147.90' &&
        bill.formattedFinalTotal === '₹1,380.40' &&
        bill.isDiscountOverridden &&
        bill.isGstOverridden;

      return {
        actualSummary: `${bill.formattedFinalTotal} (${bill.formattedSubtotal} − ${bill.formattedDiscount} + ${bill.formattedGst})`,
        passed,
        failureReason: passed
          ? undefined
          : `Override math mismatch: got ${bill.formattedFinalTotal} (disc=${bill.formattedDiscount}, gst=${bill.formattedGst}).`,
        mathTrace: buildMathTrace(bill),
        stockBefore,
        stockAfter,
        stockUnchanged: stocksEqual(stockBefore, stockAfter),
      };
    },
  },
  {
    id: 'EDGE-8',
    title: 'Invariant 8: Low-stock status (<10), Yard token &1 parity, & Sales Report',
    category: 'Engine Invariant',
    inputSummary: 'Check stock status (6=LOW, 18=OK), tokens 1 & 2 Yard parity, HW1/HW2 lookup & popular item',
    expectedSummary: 'Stock 6=LOW, 18=OK; Token 1=Yard 1, Token 2=Yard 2; Most popular=Hammer (3 units)',
    execute: () => {
      const engine = new ToolBoxCounterEngine(INITIAL_CATALOG);
      const stockBefore = engine.getCatalog();

      const statusLow = getStockStatus(6);
      const statusBoundaryLow = getStockStatus(9);
      const statusBoundaryOk = getStockStatus(10);
      const statusOk = getStockStatus(18);
      const yard1 = getYardForToken(1);
      const yard2 = getYardForToken(2);

      engine.addItem(101, 2);
      const bill1 = engine.completeOrder('Customer A', 'Retail');
      engine.addItem(101, 1);
      engine.addItem(106, 2);
      const bill2 = engine.completeOrder('Customer B', 'Contractor');

      const foundHw1 = engine.findBillById('hw1');
      const report = engine.getSalesReport();
      const stockAfter = engine.getCatalog();

      const passed =
        statusLow === 'LOW' &&
        statusBoundaryLow === 'LOW' &&
        statusBoundaryOk === 'OK' &&
        statusOk === 'OK' &&
        yard1 === 'Yard 1' &&
        yard2 === 'Yard 2' &&
        bill1.orderId === 'HW1' &&
        bill1.yard === 'Yard 1' &&
        bill2.orderId === 'HW2' &&
        bill2.yard === 'Yard 2' &&
        foundHw1?.orderId === 'HW1' &&
        report.totalOrders === 2 &&
        report.mostPopularItem?.itemId === 101 &&
        report.mostPopularItem?.unitsSold === 3;

      return {
        actualSummary: `Status(6=${statusLow},10=${statusBoundaryOk}) · ${bill1.orderId}→${bill1.yard}, ${bill2.orderId}→${bill2.yard} · Top=${report.mostPopularItem?.itemName} (${report.mostPopularItem?.unitsSold})`,
        passed,
        failureReason: passed
          ? undefined
          : `Status/Yard/Report check failed: report orders=${report.totalOrders}, top=${report.mostPopularItem?.itemName}.`,
        stockBefore,
        stockAfter,
        stockUnchanged: stocksEqual(stockBefore, stockAfter),
      };
    },
  },
];

export function runSingleTestCase(id: string): TestCaseResult {
  const def = TEST_DEFINITIONS.find((t) => t.id === id);
  if (!def) {
    throw new Error(`Unknown test case ID: ${id}`);
  }
  const start = performance.now();
  const outcome = def.execute();
  const durationMs = Math.max(0.01, Number((performance.now() - start).toFixed(2)));
  return {
    id: def.id,
    title: def.title,
    category: def.category,
    inputSummary: def.inputSummary,
    expectedSummary: def.expectedSummary,
    durationMs,
    ...outcome,
  };
}

export function runAllTestCases(): TestSuiteSummary {
  const suiteStart = performance.now();
  const results = TEST_DEFINITIONS.map((def) => runSingleTestCase(def.id));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  return {
    total: results.length,
    passed,
    failed,
    executedAt: new Date().toISOString(),
    totalDurationMs: Math.max(0.01, Number((performance.now() - suiteStart).toFixed(2))),
    results,
  };
}

export function buildMarkdownReport(summary: TestSuiteSummary): string {
  const failedCases = summary.results.filter((r) => !r.passed);
  const lines: string[] = [
    `# ToolBox Billing Calculation Engine — Verification Report`,
    `Executed: ${summary.executedAt}`,
    `Result: ${summary.passed}/${summary.total} Passed (${summary.failed} Failed) in ${summary.totalDurationMs} ms`,
    ``,
    `## Case Results`,
  ];

  for (const r of summary.results) {
    lines.push(
      `- [${r.passed ? 'PASS' : 'FAIL'}] ${r.id} — ${r.title}`,
      `  - Expected: ${r.expectedSummary}`,
      `  - Actual:   ${r.actualSummary}`,
    );
    if (r.failureReason) {
      lines.push(`  - Failure Reason: ${r.failureReason}`);
    }
  }

  lines.push(``, `## Failed Test Cases Summary`);
  if (failedCases.length === 0) {
    lines.push(`0 failed test cases found. All PDF benchmark cases (Cases 1–4) and engine invariant checks passed.`);
  } else {
    for (const f of failedCases) {
      lines.push(`- ${f.id}: ${f.failureReason ?? f.actualSummary}`);
    }
  }

  return lines.join('\n');
}
