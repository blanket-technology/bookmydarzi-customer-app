/**

 * Payment API — /api/v1/payments/*

 * Razorpay checkout is opened on PaymentScreen.
 * Webhooks (POST /payments/webhook, POST /payments/razorpay/webhook) are backend-only.

 */

import { formatApiV1Path, request } from "../../services/api";

import { RAZORPAY_KEY_ID } from "../../constants/razorpay";

import type {

  ApiPayment,

  CreatePaymentPayload,

  PaymentStatusUpdate,

  RazorpayPaymentSession,

  ResolvedPaymentSession,

  VerifyRazorpayPayload,

} from "../types/api";

import { mapPaymentForDisplay } from "../types/api";

import type { Refund } from "../types/engagement";

import { isPaymentFailed, isPaymentSuccess } from "../utils/paymentStatus";



/**
 * Route suffixes for `request()` → resolved as `/api/v1/payments/...` via services/api.ts
 */
const PAYMENTS_PREFIX = "/payments";

/** Canonical payment API paths (under /api/v1) */
export const PAYMENT_ROUTES = {
  create: `${PAYMENTS_PREFIX}/create`,
  balance: `${PAYMENTS_PREFIX}/balance`,
  verify: `${PAYMENTS_PREFIX}/verify`,
  webhook: `${PAYMENTS_PREFIX}/webhook`,
  razorpayWebhook: `${PAYMENTS_PREFIX}/razorpay/webhook`,
  byOrderId: (orderId: number) => `${PAYMENTS_PREFIX}/order/${orderId}`,
  byPaymentId: (paymentId: number) => `${PAYMENTS_PREFIX}/${paymentId}`,
  updateStatus: (paymentId: number) => `${PAYMENTS_PREFIX}/${paymentId}/status`,
  refund: (paymentId: number) => `${PAYMENTS_PREFIX}/${paymentId}/refund`,
} as const;

function logPaymentRoute(method: string, routePath: string, extra?: unknown): void {
  if (!__DEV__) return;
  const line = `[PaymentService] ${method} ${formatApiV1Path(routePath)}`;
  if (extra !== undefined) console.log(line, extra);
  else console.log(line);
}

function isNotFoundError(err: unknown): boolean {

  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();

  return msg.includes("404") || msg.includes("not found");

}



function isActivePaymentExistsError(err: unknown): boolean {

  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();

  return (

    msg.includes("active payment") &&

    (msg.includes("exist") || msg.includes("already"))

  );

}



function isVerifyEndpointUnavailable(err: unknown): boolean {

  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();

  return (

    msg.includes("404") ||

    msg.includes("405") ||

    msg.includes("not found") ||

    msg.includes("method not allowed")

  );

}



function isForbiddenError(err: unknown): boolean {

  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();

  return msg.includes("403") || msg.includes("forbidden");

}



/** Payment already completed — do not create or reopen checkout */

export class PaymentAlreadyCompletedError extends Error {

  constructor(message = "Payment is already completed for this order.") {

    super(message);

    this.name = "PaymentAlreadyCompletedError";

  }

}



/** PATCH /payments/{id}/status is not allowed for app users (admin/webhook only). */

export class PaymentStatusForbiddenError extends Error {

  constructor(

    message = "Payment status cannot be updated from the app. Use Razorpay checkout and server verification.",

  ) {

    super(message);

    this.name = "PaymentStatusForbiddenError";

  }

}



const POLL_INTERVAL_MS = 1500;

const POLL_MAX_ATTEMPTS = 5;



export function parsePositiveId(value: unknown): number | null {

  if (value === null || value === undefined) return null;

  const n = typeof value === "number" ? value : Number(String(value).trim());

  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;

  return n;

}



export function isValidOrderId(orderId: unknown): orderId is number {

  return parsePositiveId(orderId) !== null;

}



export function isValidPaymentId(paymentId: unknown): paymentId is number {

  return parsePositiveId(paymentId) !== null;

}



function sleep(ms: number): Promise<void> {

  return new Promise((resolve) => setTimeout(resolve, ms));

}



function unwrap(raw: any): any {

  return raw?.data ?? raw?.payment ?? raw;

}



/** Flatten nested session objects from GET/POST payment responses */

function extractSessionPayload(raw: any): Record<string, unknown> {

  const data = (unwrap(raw) ?? raw) as Record<string, unknown>;

  let merged: Record<string, unknown> = { ...data };

  const sessionData =

    data.SessionData ?? data.session_data ?? data.sessionData;

  if (sessionData && typeof sessionData === "object") {

    merged = { ...merged, ...(sessionData as Record<string, unknown>) };

  }

  const nested =

    data.session ??

    data.Session ??

    data.razorpay_session ??

    data.RazorpaySession ??

    data.checkout ??

    data.Checkout;

  if (nested && typeof nested === "object") {

    merged = { ...merged, ...(nested as Record<string, unknown>) };

  }

  return merged;

}



function canReuseExistingPayment(status: string | undefined | null): boolean {

  const s = (status ?? "").toLowerCase();

  if (isPaymentSuccess(s)) return false;

  if (isPaymentFailed(s)) return false;

  return true;

}



function mapPayment(raw: any): ApiPayment {

  if (!raw) throw new Error("Invalid payment data received from server");

  const payload = extractSessionPayload(raw);

  const rawStatus = String(payload?.Status ?? payload?.status ?? "pending").toLowerCase();

  const id =

    parsePositiveId(

      payload?.payment_id ?? payload?.Id ?? payload?.id ?? payload?.PaymentId,

    ) ?? 0;

  const order_id = parsePositiveId(payload?.OrderId ?? payload?.order_id) ?? 0;

  const display = mapPaymentForDisplay(payload);



  return {

    id,

    order_id,

    amount: Number(payload?.Amount ?? payload?.amount ?? 0),

    status: rawStatus,

    payment_method:

      (payload?.Method as string) ??

      (payload?.PaymentMethod as string) ??

      (payload?.payment_method as string) ??

      undefined,

    currency: (payload?.Currency as string) ?? (payload?.currency as string) ?? "INR",

    transaction_id:

      (payload?.TransactionId as string) ?? (payload?.transaction_id as string) ?? null,

    created_at: (payload?.CreatedAt as string) ?? (payload?.created_at as string) ?? undefined,

    updated_at: (payload?.UpdatedAt as string) ?? (payload?.updated_at as string) ?? undefined,

    statusLabel: display?.statusLabel ?? null,

    amountDisplay: display?.amountDisplay ?? null,

    razorpay_order_id: String(

      payload?.razorpay_order_id ?? payload?.RazorpayOrderId ?? ""

    ).trim() || null,

    razorpay_key: String(payload?.razorpay_key ?? payload?.RazorpayKey ?? "").trim() || null,

  };

}



type SessionFieldCheck = {

  payment_id: number | null;

  razorpay_order_id: string;

  razorpay_key: string;

  amountPaise: number;

};



function readSessionFields(

  data: Record<string, unknown>,

  fallbackOrderId: number,

  amountRupeesSent?: number

): SessionFieldCheck {

  const payment_id = parsePositiveId(

    data.payment_id ?? data.PaymentId ?? data.id ?? data.Id

  );

  const razorpay_order_id = String(

    data.razorpay_order_id ?? data.RazorpayOrderId ?? data.rzp_order_id ?? ""

  ).trim();

  const razorpay_key = String(

    data.razorpay_key ??

      data.razorpay_key_id ??

      data.RazorpayKey ??

      data.key ??

      RAZORPAY_KEY_ID

  ).trim();



  let amountPaise = Number(

      data.amount_paise ??

      data.amountPaise ??

      data.AmountPaise ??

      data.razorpay_amount ??

      data.RazorpayAmount ??

      data.amount ??

      data.Amount ??

      0

  );



  const hasExplicitPaise =

    data.amount_paise != null ||

    data.amountPaise != null ||

    data.AmountPaise != null ||

    data.razorpay_amount != null ||

    data.RazorpayAmount != null;



  if (

    !hasExplicitPaise &&

    amountRupeesSent != null &&

    amountRupeesSent > 0 &&

    amountPaise === amountRupeesSent

  ) {

    amountPaise = Math.round(amountRupeesSent * 100);

  }



  if (

    !hasExplicitPaise &&

    amountPaise > 0 &&

    amountPaise < 10000 &&

    amountRupeesSent != null &&

    amountRupeesSent > 0 &&

    amountPaise === amountRupeesSent

  ) {

    amountPaise = Math.round(amountRupeesSent * 100);

  }



  void fallbackOrderId;

  return { payment_id, razorpay_order_id, razorpay_key, amountPaise };

}



function buildSessionValidationError(

  fields: SessionFieldCheck,

  context: string

): Error {

  const missing: string[] = [];

  if (fields.payment_id === null) missing.push("payment_id");

  if (!fields.razorpay_order_id) missing.push("razorpay_order_id");

  if (!fields.razorpay_key) missing.push("razorpay_key");

  if (!Number.isFinite(fields.amountPaise) || fields.amountPaise <= 0) {

    missing.push("amount (paise)");

  }



  if (__DEV__) {

    console.error(

      `[PaymentService] ${context} — missing Razorpay session fields:`,

      missing.join(", ") || "(none)",

      "\nReceived:",

      JSON.stringify(fields)

    );

  }



  if (missing.length === 0) {

    return new Error("Could not build payment session from server response.");

  }



  return new Error(

    `Payment could not be started. The server response is missing: ${missing.join(", ")}.`

  );

}



/** Map GET/POST payment payload → Razorpay SDK session */

function mapPaymentSession(

  raw: any,

  fallbackOrderId: number,

  amountRupeesSent?: number

): RazorpayPaymentSession {

  const data = extractSessionPayload(raw);

  const fields = readSessionFields(data, fallbackOrderId, amountRupeesSent);



  if (

    fields.payment_id === null ||

    !fields.razorpay_order_id ||

    !fields.razorpay_key ||

    !Number.isFinite(fields.amountPaise) ||

    fields.amountPaise <= 0

  ) {

    throw buildSessionValidationError(fields, "mapPaymentSession");

  }



  const order_id =

    parsePositiveId(data.order_id ?? data.OrderId) ?? fallbackOrderId;



  if (__DEV__) {

    console.log("[PaymentService] Razorpay session mapped:", {

      payment_id: fields.payment_id,

      order_id,

      razorpay_order_id: fields.razorpay_order_id,

      amount_paise: fields.amountPaise,

    });

  }



  return {

    payment_id: fields.payment_id,

    order_id,

    razorpay_order_id: fields.razorpay_order_id,

    razorpay_key: fields.razorpay_key,

    amount: Math.round(fields.amountPaise),

    currency: String(data.currency ?? data.Currency ?? "INR").toUpperCase(),

    status: String(data.status ?? data.Status ?? "pending").toLowerCase(),

  };

}



async function fetchPaymentRawByOrderId(orderId: number): Promise<any | null> {

  const path = PAYMENT_ROUTES.byOrderId(orderId);

  logPaymentRoute("GET", path);

  const res = await request<any>(path, { allowNotFound: true });

  if (res === null) {

    if (__DEV__) {

      console.log(

        `[PaymentService] No payment record for order ${orderId} yet (${formatApiV1Path(path)})`,

      );

    }

    return null;

  }

  const raw = unwrap(res);

  if (!raw) return null;

  const paymentId = parsePositiveId(

    raw?.payment_id ?? raw?.Id ?? raw?.id ?? raw?.PaymentId,

  );

  if (paymentId === null) return null;

  return raw;

}



async function fetchPaymentRawById(paymentId: number): Promise<any | null> {

  const path = PAYMENT_ROUTES.byPaymentId(paymentId);

  logPaymentRoute("GET", path);

  const res = await request<any>(path, { allowNotFound: true });

  if (res === null) return null;

  const raw = unwrap(res);

  if (!raw) return null;

  return raw;

}



function tryMapSessionFromRaw(

  raw: any,

  orderId: number,

  amountRupees: number,

  context: string

): RazorpayPaymentSession | null {

  try {

    return mapPaymentSession(raw, orderId, amountRupees);

  } catch (err) {

    if (__DEV__) {

      console.warn(`[PaymentService] ${context}:`, err instanceof Error ? err.message : err);

    }

    return null;

  }

}



/**

 * Pay Now: GET existing payment first; reuse active session or POST create.

 */

export async function resolvePaymentSessionForOrder(

  orderId: unknown,

  amountRupees: number

): Promise<ResolvedPaymentSession> {

  const oid = parsePositiveId(orderId);

  if (oid === null) {

    throw new Error("A valid order_id is required to start payment.");

  }

  if (!Number.isFinite(amountRupees) || amountRupees <= 0) {

    throw new Error("A valid payment amount is required.");

  }



  const existingRaw = await fetchPaymentRawByOrderId(oid);



  if (existingRaw) {

    const existing = mapPayment(existingRaw);



    if (isPaymentSuccess(existing.status)) {

      throw new PaymentAlreadyCompletedError();

    }



    if (canReuseExistingPayment(existing.status)) {

      let session = tryMapSessionFromRaw(

        existingRaw,

        oid,

        amountRupees,

        "reuse GET /payments/order"

      );



      if (!session && isValidPaymentId(existing.id)) {

        const detailRaw = await fetchPaymentRawById(existing.id);

        if (detailRaw) {

          session = tryMapSessionFromRaw(

            detailRaw,

            oid,

            amountRupees,

            "reuse GET /payments/{id}"

          );

        }

      }



      if (session) {

        if (__DEV__) {

          console.log("[PaymentService] Reusing existing active payment session");

        }

        return { session, source: "existing" };

      }



      if (__DEV__) {

        console.log(

          "[PaymentService] Active payment exists but no Razorpay session in GET response; will try POST /payments/create"

        );

      }

    }

  }



  try {

    const session = await createPaymentSession({

      order_id: oid,

      amount: amountRupees,

      payment_method: "online",

      currency: "INR",

    });

    return { session, source: "created" };

  } catch (err) {

    if (isActivePaymentExistsError(err)) {

      if (__DEV__) {

        console.log(

          "[PaymentService] POST create blocked — active payment exists; refetching GET /payments/order"

        );

      }



      const retryRaw = await fetchPaymentRawByOrderId(oid);

      if (retryRaw) {

        const retryPayment = mapPayment(retryRaw);

        if (isPaymentSuccess(retryPayment.status)) {

          throw new PaymentAlreadyCompletedError();

        }



        let session = tryMapSessionFromRaw(

          retryRaw,

          oid,

          amountRupees,

          "reuse after active-payment error"

        );



        if (!session && isValidPaymentId(retryPayment.id)) {

          const detailRaw = await fetchPaymentRawById(retryPayment.id);

          if (detailRaw) {

            session = tryMapSessionFromRaw(

              detailRaw,

              oid,

              amountRupees,

              "reuse GET /payments/{id} after active-payment error"

            );

          }

        }



        if (session) {

          return { session, source: "existing" };

        }

      }



      throw new Error(

        "An active payment already exists for this order, but checkout details could not be loaded. Please try again or contact support."

      );

    }

    throw err;

  }

}



/** POST /api/v1/payments/create — Razorpay session */

export async function createPaymentSession(

  payload: CreatePaymentPayload

): Promise<RazorpayPaymentSession> {

  const orderId = parsePositiveId(payload.order_id);

  if (orderId === null) {

    throw new Error("A valid order_id is required to create a payment.");

  }



  const body: Record<string, unknown> = {

    order_id: orderId,

    amount: payload.amount,

    currency: payload.currency ?? "INR",

    payment_method: payload.payment_method ?? "online",

  };



  const path = PAYMENT_ROUTES.create;

  logPaymentRoute("POST", path);

  const res = await request<any>(path, { method: "POST", body });

  return mapPaymentSession(res, orderId, payload.amount);

}



/**
 * POST /api/v1/payments/balance — remaining-balance Razorpay session.
 *
 * The amount is derived server-side from ORDERS.RemainingAmount; the client must
 * NOT send an amount. Requires the advance to already be paid. The resulting
 * session is verified/synced via the same /verify and /sync endpoints used for
 * the advance payment.
 */
export async function createBalancePaymentSession(
  orderId: unknown,
  method?: string,
): Promise<RazorpayPaymentSession> {
  const oid = parsePositiveId(orderId);
  if (oid === null) {
    throw new Error("A valid order_id is required to pay the remaining balance.");
  }

  const body: Record<string, unknown> = { order_id: oid };
  if (method) body.method = method;

  const path = PAYMENT_ROUTES.balance;
  logPaymentRoute("POST", path);
  const res = await request<any>(path, { method: "POST", body });
  // amount is server-derived; pass 0 so the mapper relies solely on response paise
  return mapPaymentSession(res, oid, 0);
}

/**
 * Resolve a remaining-balance session: reuse an active balance payment if the
 * server already created one, otherwise create a fresh one.
 */
export async function resolveBalancePaymentSessionForOrder(
  orderId: unknown,
): Promise<ResolvedPaymentSession> {
  const session = await createBalancePaymentSession(orderId);
  return { session, source: "created" };
}

/** POST /api/v1/payments/create (legacy mapper) */

export async function createPayment(payload: CreatePaymentPayload): Promise<ApiPayment> {

  const session = await createPaymentSession(payload);

  return {

    id: session.payment_id,

    order_id: session.order_id,

    amount: session.amount,

    status: session.status ?? "pending",

    currency: session.currency,

    payment_method: "online",

  };

}



/** GET /api/v1/payments/order/{order_id} — returns null if no payment record yet (404) */

export async function getPaymentByOrderId(orderId: unknown): Promise<ApiPayment | null> {

  const id = parsePositiveId(orderId);

  if (id === null) return null;

  const raw = await fetchPaymentRawByOrderId(id);

  if (!raw) return null;

  return mapPayment(raw);

}



/** GET /api/v1/payments/{payment_id} */

export async function getPaymentById(paymentId: unknown): Promise<ApiPayment | null> {

  const id = parsePositiveId(paymentId);

  if (id === null) return null;

  const raw = await fetchPaymentRawById(id);

  if (!raw) return null;

  return mapPayment(raw);

}



/**
 * PATCH /api/v1/payments/{payment_id}/status
 * Backend typically restricts this to admin/webhook — not for mobile checkout.
 */
export async function updatePaymentStatus(

  paymentId: unknown,

  status: PaymentStatusUpdate,

  extra?: Record<string, unknown>,

): Promise<ApiPayment | null> {

  const id = parsePositiveId(paymentId);

  if (id === null) return null;



  const body: Record<string, unknown> = { status, ...(extra ?? {}) };

  const path = PAYMENT_ROUTES.updateStatus(id);

  logPaymentRoute("PATCH", path, { status });

  try {

    const res = await request<any>(path, {

      method: "PATCH",

      body,

    });

    return mapPayment(unwrap(res));

  } catch (err) {

    if (isForbiddenError(err)) {

      throw new PaymentStatusForbiddenError();

    }

    throw err;

  }

}



/** POST /api/v1/payments/verify — Razorpay signature verification (server-side) */

export async function verifyRazorpayPayment(

  paymentId: unknown,

  payload: VerifyRazorpayPayload,

): Promise<ApiPayment | null> {

  const id = parsePositiveId(paymentId);

  if (id === null) return null;



  const body: Record<string, unknown> = {

    payment_id: id,

    razorpay_payment_id: payload.razorpay_payment_id,

    razorpay_order_id: payload.razorpay_order_id,

    razorpay_signature: payload.razorpay_signature,

  };



  const path = PAYMENT_ROUTES.verify;

  logPaymentRoute("POST", path);

  try {

    const res = await request<any>(path, { method: "POST", body });

    return mapPayment(unwrap(res));

  } catch (err) {

    if (isForbiddenError(err)) {

      throw new PaymentStatusForbiddenError(

        "Payment verification was denied. Please log in again or contact support.",

      );

    }

    if (isVerifyEndpointUnavailable(err)) {

      throw new Error(

        "Payment verification is not available on the server. Please ensure POST /api/v1/payments/verify is enabled.",

      );

    }

    throw err;

  }

}



async function pollPaymentUntilTerminal(

  orderId: number,

  paymentId: number | null

): Promise<ApiPayment | null> {

  const pollOnce = async (): Promise<ApiPayment | null> => {

    if (paymentId !== null) {

      return getPaymentById(paymentId);

    }

    return getPaymentByOrderId(orderId);

  };



  let latest = await pollOnce();

  if (!latest) return null;



  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {

    if (latest.status === "paid" || latest.status === "completed") return latest;

    await sleep(POLL_INTERVAL_MS);

    latest = await pollOnce();

    if (!latest) return null;

  }



  return latest;

}



/** After Razorpay success: verify with backend then sync status */

export async function confirmRazorpayPayment(

  paymentId: unknown,

  orderId: unknown,

  razorpayData: VerifyRazorpayPayload,

): Promise<ApiPayment | null> {

  const pid = parsePositiveId(paymentId);

  const oid = parsePositiveId(orderId);

  if (pid === null || oid === null) {

    throw new Error("Invalid payment or order reference.");

  }



  const verified = await verifyRazorpayPayment(pid, razorpayData);

  if (!verified) {

    throw new Error(

      "Payment verification failed. If amount was deducted, check My Orders or contact support.",

    );

  }



  if (isPaymentSuccess(verified.status)) {

    return verified;

  }



  const synced = await pollPaymentUntilTerminal(oid, pid);

  if (synced && isPaymentSuccess(synced.status)) {

    return synced;

  }



  if (synced && isPaymentFailed(synced.status)) {

    throw new Error("Payment failed. Please try again from My Orders.");

  }



  throw new Error(

    "Payment is still processing. Refresh My Orders in a moment.",

  );

}



/** GET /api/v1/payments/order/{order_id} */

export async function syncPaymentForOrder(orderId: unknown): Promise<ApiPayment | null> {

  return getPaymentByOrderId(orderId);

}



/**
 * GET /api/v1/payments/{payment_id}/refund — list refunds for a payment.
 * Owner (their order) or admin only. Used to show refund status to the customer.
 */
export async function getRefundsForPayment(paymentId: unknown): Promise<Refund[]> {
  const id = parsePositiveId(paymentId);
  if (id === null) return [];
  const path = PAYMENT_ROUTES.refund(id);
  logPaymentRoute("GET", path);
  const res = await request<any>(path, { allowNotFound: true });
  if (!res) return [];
  const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
  return list.map(mapRefund);
}

function mapRefund(raw: any): Refund {
  return {
    id: Number(raw?.id ?? raw?.Id ?? 0),
    refund_code: raw?.refund_code ?? raw?.RefundCode ?? null,
    payment_id: Number(raw?.payment_id ?? raw?.PaymentId ?? 0),
    order_id: raw?.order_id ?? raw?.OrderId ?? null,
    amount: Number(raw?.amount ?? raw?.Amount ?? 0),
    reason: raw?.reason ?? raw?.Reason ?? null,
    status: String(raw?.status ?? raw?.Status ?? ""),
    gateway_refund_id: raw?.gateway_refund_id ?? raw?.GatewayRefundId ?? null,
    failure_reason: raw?.failure_reason ?? raw?.FailureReason ?? null,
    created_at: String(raw?.created_at ?? raw?.CreatedAt ?? ""),
  };
}


