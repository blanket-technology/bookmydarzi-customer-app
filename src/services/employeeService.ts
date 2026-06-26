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
    order_code: raw.OrderCode ?? raw.order_code ?? String(raw.Id ?? raw.id ?? ""),
    status: raw.Status ?? raw.status ?? "",
    payment_status: raw.PaymentStatus ?? raw.payment_status ?? "",
    assigned_employee_id: raw.AssignedEmployeeId ?? raw.assigned_employee_id ?? null,
    customer_name: addr.full_name ?? addr.FullName ?? raw.CustomerName ?? raw.customer_name ?? null,
    customer_mobile: addr.mobile ?? addr.Mobile ?? raw.CustomerMobile ?? raw.customer_mobile ?? null,
    address: addrParts.length ? addrParts.join(", ") : null,
    tailor_name: raw.TailorName ?? raw.tailor_name ?? null,
    total_amount: raw.FinalAmount ?? raw.final_amount ?? raw.total_amount ?? null,
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

/** Public endpoint — no auth required */
export async function listTailors(): Promise<TailorProfile[]> {
  return request<TailorProfile[]>("/tailors");
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function acceptOrder(
  orderId: number
): Promise<EmployeeActionResponse> {
  return request<EmployeeActionResponse>(`/employee/orders/${orderId}/accept`, {
    method: "PATCH",
  });
}

export async function assignTailor(
  orderId: number,
  tailorId: number
): Promise<EmployeeActionResponse> {
  return request<EmployeeActionResponse>(
    `/employee/orders/${orderId}/assign-tailor`,
    { method: "PATCH", body: { tailor_id: tailorId } }
  );
}

export async function schedulePickup(
  orderId: number
): Promise<EmployeeActionResponse> {
  return request<EmployeeActionResponse>(
    `/employee/orders/${orderId}/schedule-pickup`,
    { method: "PATCH" }
  );
}

export async function confirmPickup(
  orderId: number
): Promise<EmployeeActionResponse> {
  return request<EmployeeActionResponse>(
    `/employee/orders/${orderId}/pickup`,
    { method: "PATCH" }
  );
}

export async function startStitching(
  orderId: number
): Promise<EmployeeActionResponse> {
  return request<EmployeeActionResponse>(
    `/employee/orders/${orderId}/start-stitching`,
    { method: "PATCH" }
  );
}

export async function completeStitching(
  orderId: number
): Promise<EmployeeActionResponse> {
  return request<EmployeeActionResponse>(
    `/employee/orders/${orderId}/complete-stitching`,
    { method: "PATCH" }
  );
}

export async function markOutForDelivery(
  orderId: number
): Promise<EmployeeActionResponse> {
  return request<EmployeeActionResponse>(
    `/employee/orders/${orderId}/delivery`,
    { method: "PATCH" }
  );
}

export async function completeOrder(
  orderId: number
): Promise<EmployeeActionResponse> {
  return request<EmployeeActionResponse>(
    `/employee/orders/${orderId}/complete`,
    { method: "PATCH" }
  );
}

export async function collectMeasurement(
  orderId: number,
  data: MeasurementInput
): Promise<EmployeeActionResponse> {
  return request<EmployeeActionResponse>(
    `/employee/orders/${orderId}/measurement`,
    { method: "POST", body: data as unknown as Record<string, unknown> }
  );
}
