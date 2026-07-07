import { request } from "../../services/api";

// ─── Types (mirrors OrderResponse from backend) ──────────────────────────────

export interface TailorOrderAddress {
  full_name?: string;
  mobile?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface TailorOrderMeasurement {
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
}

export interface TailorOrder {
  Id: number;
  OrderCode: string;
  Status: string;
  TailorId?: number | null;
  PaymentStatus?: string;
  PaymentStatusLabel?: string;
  FinalAmount?: number;
  AmountDisplay?: string;
  ServiceName?: string;
  ServiceTitle?: string;
  ServiceSubtitle?: string;
  Description?: string;
  FabricNotes?: string;
  CustomizationNotes?: string;
  ClothDetails?: string;
  UrgencyLevel?: string;
  CreatedAt: string;
  address?: TailorOrderAddress;
  measurement?: TailorOrderMeasurement;
  CustomerName?: string;
  CustomerMobile?: string;
  customer?: { name?: string; mobile?: string };
}

export interface TailorOrderListResponse {
  orders: TailorOrder[];
  total: number;
  page: number;
  limit: number;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function listMyOrders(params: {
  page?: number;
  limit?: number;
  status?: string;
} = {}): Promise<TailorOrderListResponse> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  if (params.status) q.set("status", params.status);
  const qs = q.toString();
  return request<TailorOrderListResponse>(`/orders/my-orders${qs ? `?${qs}` : ""}`);
}

export async function getTailorOrder(orderId: number): Promise<TailorOrder> {
  return request<TailorOrder>(`/orders/${orderId}`);
}

export async function updateStitchingStatus(
  orderId: number,
  status: "stitching_in_progress" | "stitching_completed"
): Promise<any> {
  return request<any>(`/orders/${orderId}/status`, {
    method: "PATCH",
    body: { status },
  });
}

export async function listQueueOrders(params: {
  page?: number;
  limit?: number;
} = {}): Promise<TailorOrderListResponse> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  const qs = q.toString();
  return request<TailorOrderListResponse>(`/tailor/orders/queue${qs ? `?${qs}` : ""}`);
}

export async function claimOrder(orderId: number): Promise<TailorOrder> {
  return request<TailorOrder>(`/tailor/orders/${orderId}/claim`, { method: "PATCH" });
}
