export type CustomerType = 'Retail' | 'Contractor';
export type StockStatus = 'LOW' | 'OK';
export type YardLocation = 'Yard 1' | 'Yard 2';

export interface HardwareItem {
  readonly id: number;
  readonly name: string;
  readonly category: string;
  readonly unitPrice: number; // in INR (₹)
  stock: number;
}

export interface OrderLine {
  readonly itemId: number;
  readonly itemName: string;
  readonly category: string;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly lineTotalPaise: number;
}

export interface CalculationOverrides {
  discountPercent?: number | null;
  gstPercent?: number | null;
}

export interface BillBreakdown {
  customerType: CustomerType;
  lines: OrderLine[];
  subtotalPaise: number;
  defaultDiscountRate: number;
  effectiveDiscountRate: number;
  isDiscountOverridden: boolean;
  discountPaise: number;
  discountedSubtotalPaise: number;
  defaultGstRate: number;
  effectiveGstRate: number;
  isGstOverridden: boolean;
  gstPaise: number;
  finalTotalPaise: number;
  formattedSubtotal: string;
  formattedDiscount: string;
  formattedDiscountedSubtotal: string;
  formattedGst: string;
  formattedFinalTotal: string;
}

export interface FinalizedBill extends BillBreakdown {
  orderId: string;
  tokenNumber: number;
  yard: YardLocation;
  customerName: string;
  createdAt: string;
}

export interface SalesReport {
  totalOrders: number;
  totalRevenuePaise: number;
  formattedTotalRevenue: string;
  mostPopularItem: {
    itemId: number;
    itemName: string;
    unitsSold: number;
  } | null;
}

export const DEFAULT_GST_RATE = 0.18;
export const RETAIL_DISCOUNT_RATE = 0;
export const CONTRACTOR_DISCOUNT_RATE = 0.12;
export const LOW_STOCK_THRESHOLD = 10;

export const INITIAL_CATALOG: readonly HardwareItem[] = [
  { id: 101, name: 'Hammer', category: 'Tool', unitPrice: 350, stock: 20 },
  { id: 102, name: 'Screwdriver Set', category: 'Tool', unitPrice: 420, stock: 18 },
  { id: 103, name: 'PVC Pipe 3 m', category: 'Plumbing', unitPrice: 280, stock: 40 },
  { id: 104, name: 'Wall Paint 4 L', category: 'Paint', unitPrice: 1450, stock: 15 },
  { id: 105, name: 'Drill Machine', category: 'Power Tool', unitPrice: 2600, stock: 6 },
  { id: 106, name: 'Screws (box of 100)', category: 'Fittings', unitPrice: 120, stock: 50 },
];

export class HardwareItemNotFoundException extends Error {
  public readonly itemId: number | string;

  constructor(itemId: number | string) {
    super(`HardwareItemNotFoundException: Item id ${itemId} does not exist in catalog.`);
    this.name = 'HardwareItemNotFoundException';
    this.itemId = itemId;
  }
}

export class InsufficientStockException extends Error {
  public readonly itemId: number;
  public readonly itemName: string;
  public readonly requestedQty: number;
  public readonly availableStock: number;

  constructor(
    itemId: number,
    itemName: string,
    requestedQty: number,
    availableStock: number,
  ) {
    super(
      `InsufficientStockException: Requested ${requestedQty} × ${itemName} (ID ${itemId}), but only ${availableStock} in stock. Stock unchanged.`,
    );
    this.name = 'InsufficientStockException';
    this.itemId = itemId;
    this.itemName = itemName;
    this.requestedQty = requestedQty;
    this.availableStock = availableStock;
  }
}

export class InvalidInputException extends Error {
  public readonly field: string;
  public readonly rawValue: string;

  constructor(field: string, rawValue: string, reason: string) {
    super(`InvalidInputException (${field}): ${reason}`);
    this.name = 'InvalidInputException';
    this.field = field;
    this.rawValue = rawValue;
  }
}

export interface StackEntry {
  readonly itemId: number;
  readonly itemName: string;
  readonly category: string;
  readonly unitPrice: number;
  readonly quantity: number;
}

/**
 * Custom LIFO stack matching the ToolBox Unit III ItemStack requirement
 * to support undoing the last added item (-1).
 */
export class ItemStack {
  private entries: StackEntry[] = [];

  push(entry: StackEntry): void {
    this.entries = [...this.entries, entry];
  }

  pop(): StackEntry | undefined {
    if (this.entries.length === 0) {
      return undefined;
    }
    const popped = this.entries[this.entries.length - 1];
    this.entries = this.entries.slice(0, -1);
    return popped;
  }

  peek(): StackEntry | undefined {
    return this.entries[this.entries.length - 1];
  }

  size(): number {
    return this.entries.length;
  }

  toArray(): StackEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }
}

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function roundPaise(value: number): number {
  return Math.round(value + Number.EPSILON);
}

export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function getStockStatus(stock: number): StockStatus {
  return stock < LOW_STOCK_THRESHOLD ? 'LOW' : 'OK';
}

export function getYardForToken(token: number): YardLocation {
  return (token & 1) === 1 ? 'Yard 1' : 'Yard 2';
}

export function getDefaultDiscountRate(customerType: CustomerType): number {
  return customerType === 'Contractor' ? CONTRACTOR_DISCOUNT_RATE : RETAIL_DISCOUNT_RATE;
}

/**
 * Recursive subtotal calculation in paise (mirrors Unit III recursive subtotal rule).
 */
export function computeRecursiveSubtotalPaise(lines: readonly OrderLine[], index = 0): number {
  if (index >= lines.length) {
    return 0;
  }
  return lines[index].lineTotalPaise + computeRecursiveSubtotalPaise(lines, index + 1);
}

/**
 * Pure calculation pipeline:
 * Subtotal -> minus discount (Retail 0%, Contractor 12%, or override) -> plus 18% GST (or override) -> 2 decimals.
 */
export function calculateBillBreakdown(
  stackEntries: readonly StackEntry[],
  customerType: CustomerType,
  overrides?: CalculationOverrides,
): BillBreakdown {
  // Aggregate duplicate item IDs cleanly while preserving insertion order
  const aggregatedMap = new Map<number, OrderLine>();
  for (const entry of stackEntries) {
    const existing = aggregatedMap.get(entry.itemId);
    const unitPaise = toPaise(entry.unitPrice);
    if (existing) {
      const nextQty = existing.quantity + entry.quantity;
      aggregatedMap.set(entry.itemId, {
        ...existing,
        quantity: nextQty,
        lineTotalPaise: unitPaise * nextQty,
      });
    } else {
      aggregatedMap.set(entry.itemId, {
        itemId: entry.itemId,
        itemName: entry.itemName,
        category: entry.category,
        unitPrice: entry.unitPrice,
        quantity: entry.quantity,
        lineTotalPaise: unitPaise * entry.quantity,
      });
    }
  }

  const lines = Array.from(aggregatedMap.values());
  const subtotalPaise = computeRecursiveSubtotalPaise(lines);

  const defaultDiscountRate = getDefaultDiscountRate(customerType);
  const hasDiscountOverride =
    overrides?.discountPercent !== undefined &&
    overrides.discountPercent !== null &&
    Number.isFinite(overrides.discountPercent);
  const clampedDiscountPercent = hasDiscountOverride
    ? Math.min(100, Math.max(0, overrides!.discountPercent!))
    : defaultDiscountRate * 100;
  const effectiveDiscountRate = clampedDiscountPercent / 100;
  const isDiscountOverridden =
    hasDiscountOverride && Math.abs(effectiveDiscountRate - defaultDiscountRate) > 1e-9;

  const discountPaise = roundPaise(subtotalPaise * effectiveDiscountRate);
  const discountedSubtotalPaise = subtotalPaise - discountPaise;

  const defaultGstRate = DEFAULT_GST_RATE;
  const hasGstOverride =
    overrides?.gstPercent !== undefined &&
    overrides.gstPercent !== null &&
    Number.isFinite(overrides.gstPercent);
  const clampedGstPercent = hasGstOverride
    ? Math.min(100, Math.max(0, overrides!.gstPercent!))
    : defaultGstRate * 100;
  const effectiveGstRate = clampedGstPercent / 100;
  const isGstOverridden =
    hasGstOverride && Math.abs(effectiveGstRate - defaultGstRate) > 1e-9;

  const gstPaise = roundPaise(discountedSubtotalPaise * effectiveGstRate);
  const finalTotalPaise = discountedSubtotalPaise + gstPaise;

  return {
    customerType,
    lines,
    subtotalPaise,
    defaultDiscountRate,
    effectiveDiscountRate,
    isDiscountOverridden,
    discountPaise,
    discountedSubtotalPaise,
    defaultGstRate,
    effectiveGstRate,
    isGstOverridden,
    gstPaise,
    finalTotalPaise,
    formattedSubtotal: formatINR(subtotalPaise),
    formattedDiscount: formatINR(discountPaise),
    formattedDiscountedSubtotal: formatINR(discountedSubtotalPaise),
    formattedGst: formatINR(gstPaise),
    formattedFinalTotal: formatINR(finalTotalPaise),
  };
}

export function parseStrictPositiveInteger(
  raw: number | string,
  fieldLabel: string,
): number {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || !Number.isInteger(raw) || raw <= 0) {
      throw new InvalidInputException(
        fieldLabel,
        String(raw),
        `${fieldLabel} must be a positive whole number (received "${raw}").`,
      );
    }
    return raw;
  }

  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new InvalidInputException(
      fieldLabel,
      raw,
      `${fieldLabel} must be a valid whole number (received "${raw || 'empty'}").`,
    );
  }

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new InvalidInputException(
      fieldLabel,
      raw,
      `${fieldLabel} must be greater than zero (received "${trimmed}").`,
    );
  }
  return parsed;
}

export function parseStrictItemId(raw: number | string): number {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || !Number.isInteger(raw)) {
      throw new InvalidInputException(
        'Item ID',
        String(raw),
        `Item ID must be an integer (received "${raw}").`,
      );
    }
    return raw;
  }

  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new InvalidInputException(
      'Item ID',
      raw,
      `Item ID must be numeric (received "${raw || 'empty'}").`,
    );
  }
  return Number.parseInt(trimmed, 10);
}

/**
 * Stateful ToolBox Counter Engine using fixed-order array storage for catalog and orders,
 * an ItemStack for LIFO undo (-1), atomic stock checks, and sequential HW# / token counters.
 */
export class ToolBoxCounterEngine {
  private catalog: HardwareItem[];
  private orders: FinalizedBill[] = [];
  private orderCounter = 0;
  private tokenCounter = 0;
  public readonly stack = new ItemStack();

  constructor(seedCatalog: readonly HardwareItem[] = INITIAL_CATALOG) {
    this.catalog = seedCatalog.map((item) => ({ ...item }));
  }

  getCatalog(): HardwareItem[] {
    return this.catalog.map((item) => ({ ...item }));
  }

  getItemById(itemId: number): HardwareItem {
    for (let i = 0; i < this.catalog.length; i += 1) {
      if (this.catalog[i].id === itemId) {
        return { ...this.catalog[i] };
      }
    }
    throw new HardwareItemNotFoundException(itemId);
  }

  getReservedQtyInStack(itemId: number): number {
    const entries = this.stack.toArray();
    let total = 0;
    for (let i = 0; i < entries.length; i += 1) {
      if (entries[i].itemId === itemId) {
        total += entries[i].quantity;
      }
    }
    return total;
  }

  /**
   * Validates item existence, positive integer quantity, and available stock
   * (including already-stacked units). Throws typed exceptions without modifying stock.
   */
  addItem(rawItemId: number | string, rawQuantity: number | string): StackEntry {
    const itemId = parseStrictItemId(rawItemId);
    const quantity = parseStrictPositiveInteger(rawQuantity, 'Quantity');
    const item = this.getItemById(itemId);

    const alreadyInStack = this.getReservedQtyInStack(itemId);
    const totalRequested = alreadyInStack + quantity;
    if (totalRequested > item.stock) {
      throw new InsufficientStockException(
        item.id,
        item.name,
        totalRequested,
        item.stock,
      );
    }

    const entry: StackEntry = {
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      unitPrice: item.unitPrice,
      quantity,
    };
    this.stack.push(entry);
    return entry;
  }

  undoLastItem(): StackEntry | undefined {
    return this.stack.pop();
  }

  clearCurrentOrder(): void {
    this.stack.clear();
  }

  previewOrder(
    customerType: CustomerType,
    overrides?: CalculationOverrides,
  ): BillBreakdown {
    return calculateBillBreakdown(this.stack.toArray(), customerType, overrides);
  }

  /**
   * Atomically validates all stacked items against catalog stock, calculates totals,
   * deducts stock, assigns HW# and Yard token, and archives the finalized bill.
   */
  completeOrder(
    customerName: string,
    customerType: CustomerType,
    overrides?: CalculationOverrides,
  ): FinalizedBill {
    const entries = this.stack.toArray();
    if (entries.length === 0) {
      throw new InvalidInputException(
        'Order',
        '0 items',
        'Cannot complete an empty order. Add at least one hardware item first.',
      );
    }

    const breakdown = calculateBillBreakdown(entries, customerType, overrides);

    // Pre-validate every aggregated line before mutating any stock
    for (let i = 0; i < breakdown.lines.length; i += 1) {
      const line = breakdown.lines[i];
      const item = this.getItemById(line.itemId);
      if (line.quantity > item.stock) {
        throw new InsufficientStockException(
          item.id,
          item.name,
          line.quantity,
          item.stock,
        );
      }
    }

    // Deduct stock atomically
    for (let i = 0; i < breakdown.lines.length; i += 1) {
      const line = breakdown.lines[i];
      for (let j = 0; j < this.catalog.length; j += 1) {
        if (this.catalog[j].id === line.itemId) {
          this.catalog[j].stock -= line.quantity;
          break;
        }
      }
    }

    this.orderCounter += 1;
    this.tokenCounter += 1;

    const cleanName = customerName.trim() || `${customerType} Walk-In`;
    const bill: FinalizedBill = {
      ...breakdown,
      orderId: `HW${this.orderCounter}`,
      tokenNumber: this.tokenCounter,
      yard: getYardForToken(this.tokenCounter),
      customerName: cleanName,
      createdAt: new Date().toISOString(),
    };

    this.orders = [...this.orders, bill];
    this.stack.clear();
    return bill;
  }

  getOrders(): FinalizedBill[] {
    return [...this.orders];
  }

  findBillById(orderId: string): FinalizedBill | undefined {
    const normalized = orderId.trim().toUpperCase();
    for (let i = 0; i < this.orders.length; i += 1) {
      if (this.orders[i].orderId.toUpperCase() === normalized) {
        return this.orders[i];
      }
    }
    return undefined;
  }

  getSalesReport(): SalesReport {
    let totalRevenuePaise = 0;
    const itemTotals = new Map<number, { itemId: number; itemName: string; unitsSold: number }>();

    for (let i = 0; i < this.orders.length; i += 1) {
      const order = this.orders[i];
      totalRevenuePaise += order.finalTotalPaise;
      for (let j = 0; j < order.lines.length; j += 1) {
        const line = order.lines[j];
        const prev = itemTotals.get(line.itemId);
        if (prev) {
          prev.unitsSold += line.quantity;
        } else {
          itemTotals.set(line.itemId, {
            itemId: line.itemId,
            itemName: line.itemName,
            unitsSold: line.quantity,
          });
        }
      }
    }

    let mostPopularItem: SalesReport['mostPopularItem'] = null;
    for (const record of itemTotals.values()) {
      if (!mostPopularItem || record.unitsSold > mostPopularItem.unitsSold) {
        mostPopularItem = { ...record };
      }
    }

    return {
      totalOrders: this.orders.length,
      totalRevenuePaise,
      formattedTotalRevenue: formatINR(totalRevenuePaise),
      mostPopularItem,
    };
  }

  resetAll(): void {
    this.catalog = INITIAL_CATALOG.map((item) => ({ ...item }));
    this.orders = [];
    this.orderCounter = 0;
    this.tokenCounter = 0;
    this.stack.clear();
  }
}
