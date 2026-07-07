function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function pickPositive(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const AMOUNT_FIELD_PRIORITY = [
  "final_amount",
  "finalAmount",
  "FinalAmount",
  "order_amount",
  "orderAmount",
  "OrderAmount",
  "total_amount",
  "totalAmount",
  "TotalAmount",
  "amount",
  "Amount",
  "advance_amount",
  "AdvanceAmount",
  "booking_advance",
  "BookingAdvance",
  "total_price",
  "TotalPrice",
] as const;

function collectNestedRecords(raw: unknown): Record<string, unknown>[] {
  const root = asRecord(raw);
  const records: Record<string, unknown>[] = [root];
  const seen = new Set<Record<string, unknown>>();

  const add = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (seen.has(record)) return;
    seen.add(record);
    records.push(record);
  };

  for (const key of [
    "data",
    "Data",
    "cart",
    "Cart",
    "order",
    "Order",
    "billing",
    "Billing",
    "result",
    "Result",
  ]) {
    add(root[key]);
  }

  const data = asRecord(root.data ?? root.Data);
  add(data.order);
  add(data.Order);
  add(data.billing);
  add(data.Billing);

  const order = asRecord(root.order ?? root.Order ?? data.order ?? data.Order);
  add(order.billing);
  add(order.Billing);

  return records;
}

const ADVANCE_FIELD_PRIORITY = [
  "advance_amount",
  "AdvanceAmount",
  "booking_advance",
  "BookingAdvance",
] as const;

function resolveFromFieldList(
  raw: unknown,
  fields: readonly string[],
): number {
  const records = collectNestedRecords(raw);
  for (const field of fields) {
    for (const record of records) {
      const amount = pickPositive(record[field]);
      if (amount > 0) return amount;
    }
  }
  return 0;
}

/** Resolve first positive payable amount from a backend payload (cart or checkout). */
export function resolvePayableAmount(raw: unknown): number {
  return resolveFromFieldList(raw, AMOUNT_FIELD_PRIORITY);
}

/** Advance/booking amount only - for cart store display mapping. */
export function resolveAdvanceBookingAmount(raw: unknown): number {
  return resolveFromFieldList(raw, ADVANCE_FIELD_PRIORITY);
}

/** Resolve payable amount from cart store billing fields (pre-checkout hint only). */
export function resolvePayableAmountFromCartState(state: {
  advanceAmount: number;
  grandTotal: number;
  platformFee: number;
}): number {
  return resolvePayableAmount({
    advance_amount: state.advanceAmount,
    AdvanceAmount: state.advanceAmount,
    booking_advance: state.advanceAmount,
    BookingAdvance: state.advanceAmount,
    platform_fee: state.platformFee,
    platformFee: state.platformFee,
    final_amount: state.grandTotal,
    finalAmount: state.grandTotal,
    total_amount: state.grandTotal,
    totalAmount: state.grandTotal,
  });
}
