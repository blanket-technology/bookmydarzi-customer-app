import { request } from "../../services/api";

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  users: { total: number; active: number };
  orders: {
    total: number;
    today: number;
    pending: number;
    pending_assignment: number;
    pending_pickup: number;
    out_for_delivery: number;
    delivered: number;
    cancelled: number;
    by_status: Record<string, number>;
  };
  tailors: { active: number; available: number; busy: number };
  revenue: {
    total: number;
    today: number;
    this_week: number;
    this_month: number;
    online: number;
    cod: number;
  };
  payments: { successful: number };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return request<DashboardStats>("/admin/dashboard");
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export interface AdminOrder {
  id: number;
  order_code: string;
  status: string;
  payment_status: string;
  created_at: string;
  customer_name?: string;
  customer_mobile?: string;
  tailor_name?: string;
  total_amount?: number;
  services?: string[];
}

export interface AdminOrderListResponse {
  orders: AdminOrder[];
  total: number;
  page: number;
  limit: number;
}

export async function listOrders(params: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}): Promise<AdminOrderListResponse> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  if (params.status) q.set("status", params.status);
  if (params.search) q.set("search", params.search);
  const qs = q.toString();
  return request<AdminOrderListResponse>(`/admin/orders${qs ? `?${qs}` : ""}`);
}

export async function getOrderDetail(orderId: number): Promise<any> {
  return request<any>(`/orders/${orderId}`);
}

export async function cancelOrder(
  orderId: number,
  reason: string
): Promise<any> {
  return request<any>(`/admin/orders/${orderId}/cancel`, {
    method: "PATCH",
    body: { reason },
  });
}

export async function updateOrderStatus(
  orderId: number,
  status: string,
  message?: string
): Promise<any> {
  return request<any>(`/admin/orders/${orderId}/status`, {
    method: "PATCH",
    body: { status, message },
  });
}

export async function assignTailor(
  orderId: number,
  tailorId: number
): Promise<any> {
  return request<any>(`/admin/orders/${orderId}/assign-tailor`, {
    method: "PATCH",
    body: { tailor_id: tailorId },
  });
}

// ─── Tailors list (for assign-tailor picker) ─────────────────────────────────

export interface AdminTailor {
  id: number;
  full_name: string;
  location?: string;
  is_available: boolean;
  rating?: number;
  active_orders?: number;
}

export async function listTailors(): Promise<AdminTailor[]> {
  const res = await request<any>("/admin/tailors");
  if (Array.isArray(res)) return res;
  return res?.tailors ?? [];
}
