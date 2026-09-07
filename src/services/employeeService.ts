import { request } from "../../services/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmployeeOrder {
  id: number;
  order_code: string;
  status: string;
  payment_status: string;
  created_at: string;
  assigned_employee_id?: number | null;
  customer_name?: string;
  customer_mobile?: string;
  tailor_name?: string;
  total_amount?: number;
  services?: string[];
  address?: string;
}

export interface EmployeeOrderListResponse {
  orders: EmployeeOrder[];
  total: number;
  page: number;
  limit: number;
}

export interface EmployeeActionResponse {
  message: string;
  warning?: string | null;
  order: any;
}

export interface TailorProfile {
  Id: number;
  UserId?: number;
  Specialization?: string;
  Experience?: number;
  Location?: string;
  Bio?: string;
  IsAvailable?: boolean;
  Rating?: number;
  user?: {
    id?: number;
    name?: string;
    email?: string;
    mobile?: string;
  };
}

export interface MeasurementInput {
  measurement_id?: number;
  profile_name?: string;
  gender?: string;
  chest?: number;
  waist?: number;
  hips?: number;
  shoulder?: number;
  neck?: number;
  sleeve_length?: number;
  inseam?: number;
  height?: number;
  fit_preference?: string;
  notes?: string;
  is_default?: boolean;
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizeOrder(raw: any): EmployeeOrder {
  const addr = raw.address ?? raw.Address ?? {};
  const addrParts = [
    addr.address_line_1 ?? addr.AddressLine1,
    addr.address_line_2 ?? addr.AddressLine2,
    addr.city ?? addr.City,
  ].filter(Boolean);
  return {
    id: raw.Id ?? raw.id,
    order_code:
      raw.OrderCode ?? raw.order_code ?? String(raw.Id ?? raw.id ?? ""),
    status: raw.Status ?? raw.status ?? "",
    payment_status: raw.PaymentStatus ?? raw.payment_status ?? "",
    assigned_employee_id:
      raw.AssignedEmployeeId ?? raw.assigned_employee_id ?? null,
    customer_name:
      addr.full_name ??
      addr.FullName ??
      raw.CustomerName ??
      raw.customer_name ??
      null,
    customer_mobile:
      addr.mobile ??
      addr.Mobile ??
      raw.CustomerMobile ??
      raw.customer_mobile ??
      null,
    address: addrParts.length ? addrParts.join(", ") : undefined,
    tailor_name: raw.TailorName ?? raw.tailor_name ?? null,
    total_amount:
      raw.FinalAmount ?? raw.final_amount ?? raw.total_amount ?? null,
    created_at: raw.CreatedAt ?? raw.created_at ?? "",
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listEmployeeOrders(params: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}): Promise<EmployeeOrderListResponse> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  if (params.status) q.set("status", params.status);
  if (params.search) q.set("search", params.search);
  const qs = q.toString();
  const data = await request<any>(`/employee/orders${qs ? `?${qs}` : ""}`);
  return {
    orders: (data.orders ?? []).map(normalizeOrder),
    total: data.total ?? 0,
    page: data.page ?? 1,
    limit: data.limit ?? 30,
  };
}

export async function getEmployeeOrder(orderId: number): Promise<any> {
  return request<any>(`/employee/orders/${orderId}`);
}

export async function getEmployeeOrderForChat(orderId: number): Promise<any> {
  return request<any>(`/employee/chat/orders/${orderId}`);
}

export async function listAllOrdersForChat(params: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<EmployeeOrderListResponse> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  if (params.search) q.set("search", params.search);
  const res = await request<any>(`/employee/chat/orders?${q.toString()}`);
  const raw = Array.isArray(res?.orders) ? res.orders : Array.isArray(res) ? res : [];
  return {
    orders: raw.map(normalizeOrder),
    total: res?.total ?? raw.length,
    page: res?.page ?? 1,
    limit: res?.limit ?? raw.length,
  };
}

/** Public endpoint - no auth required */
export async function listTailors(): Promise<TailorProfile[]> {
  return request<TailorProfile[]>("/tailors");
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function acceptOrder(
  orderId: number,
): Promise<EmployeeActionResponse> {
  return request<EmployeeActionResponse>(`/employee/orders/${orderId}/accept`, {
    method: "PATCH",
  });
}

/**
 * Pending pickup-broadcast offers for this employee (Rapido-style FCFS). The
 * order is auto-broadcast to nearby online employees when it reaches
 * order_placed; the first to accept claims the pickup. Manual acceptOrder()
 * from the queue remains a valid fallback.
 */
export async function listPickupBroadcastOffers(): Promise<any> {
  return request<any>(`/employee/pickup-broadcasts`);
}

export async function acceptPickupBroadcast(
  orderId: number,
): Promise<EmployeeActionResponse> {
  return request<EmployeeActionResponse>(
    `/employee/orders/${orderId}/pickup-broadcast/accept`,
    { method: "PATCH" },
  );
}

export async function declinePickupBroadcast(
  orderId: number,
): Promise<{ message: string }> {
  return request<{ message: string }>(
    `/employee/orders/${orderId}/pickup-broadcast/decline`,
    { method: "PATCH" },
  );
}

/**
 * @deprecated Backend docs mark this admin-only ("Not part of the employee
 * pickup flow" - app/api/v1/endpoints/employee.py). Tailor assignment now
 * happens via broadcast acceptance (see tailorService.ts's
 * listBroadcastOffers/acceptBroadcast). Employees hand off collected cloth
 * to whichever tailor accepted, via handToTailor(). Remove the employee
 * tailor-selector UI that calls this once confirmed unused.
 */
export async function assignTailor(
  orderId: number,
  tailorId: number,
): Promise<EmployeeActionResponse> {
  return request<EmployeeActionResponse>(
    `/employee/orders/${orderId}/assign-tailor`,
    { method: "PATCH", body: { tailor_id: tailorId } },
  );
}

export async function rejectOrder(
  orderId: number,
): Promise<EmployeeActionResponse> {
  return request<EmployeeActionResponse>(`/employee/orders/${orderId}/reject`, {
    method: "PATCH",
  });
}

export async function schedulePickup(
  orderId: number,
  pickupType?: "instant" | "scheduled",
  scheduledPickupAt?: string,
  pickupTimeSlot?: string,
): Promise<EmployeeActionResponse> {
  const body: Record<string, unknown> = {};
  if (pickupType) body.pickup_type = pickupType;
  if (scheduledPickupAt) body.scheduled_pickup_at = scheduledPickupAt;
  if (pickupTimeSlot) body.pickup_time_slot = pickupTimeSlot;
  return request<EmployeeActionResponse>(
    `/employee/orders/${orderId}/schedule-pickup`,
    { method: "PATCH", body: Object.keys(body).length ? body : undefined },
  );
}

export async function confirmPickup(
  orderId: number,
): Promise<EmployeeActionResponse> {
  return request<EmployeeActionResponse>(`/employee/orders/${orderId}/pickup`, {
    method: "PATCH",
  });
}

/**
 * Transitions picked_up → cloth_received_by_tailor. Requires a tailor to
 * already be assigned (via broadcast acceptance) - this is the handover
 * step, not tailor assignment itself (assign-tailor is now admin-only).
 */
export async function handToTailor(
  orderId: number,
): Promise<EmployeeActionResponse> {
  return request<EmployeeActionResponse>(
    `/employee/orders/${orderId}/hand-to-tailor`,
    { method: "PATCH" },
  );
}

export async function markOutForDelivery(
  orderId: number,
): Promise<EmployeeActionResponse> {
  return request<EmployeeActionResponse>(
    `/employee/orders/${orderId}/delivery`,
    { method: "PATCH" },
  );
}

export async function completeOrder(
  orderId: number,
): Promise<EmployeeActionResponse> {
  return request<EmployeeActionResponse>(
    `/employee/orders/${orderId}/complete`,
    { method: "PATCH" },
  );
}

export async function collectMeasurement(
  orderId: number,
  data: MeasurementInput,
): Promise<EmployeeActionResponse> {
  return request<EmployeeActionResponse>(
    `/employee/orders/${orderId}/measurement`,
    { method: "POST", body: data as unknown as Record<string, unknown> },
  );
}

export interface CollectPaymentInput {
  method: "qr" | "cash";
  amount: number;
  notes?: string;
}

export interface CollectPaymentResponse {
  message: string;
  order_id: number;
  order_code: string | null;
  amount_collected: number;
  payment_method: string;
  remaining_amount: number;
}

/**
 * Records balance payment collected at delivery. Once remaining_amount
 * reaches 0, /complete will succeed - it hard-fails otherwise, no bypass
 * (app/api/v1/endpoints/employee.py: complete_employee_order).
 */
export async function collectDeliveryPayment(
  orderId: number,
  data: CollectPaymentInput,
): Promise<CollectPaymentResponse> {
  return request<CollectPaymentResponse>(
    `/employee/orders/${orderId}/collect-payment`,
    { method: "POST", body: data as unknown as Record<string, unknown> },
  );
}
