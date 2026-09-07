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

/** The 4 stitching stages a tailor may set, in order - matches backend's TAILOR_ALLOWED_TARGETS. */
export type TailorStitchingStatus =
  | "stitching_started"
  | "in_progress"
  | "final_check"
  | "ready_for_dispatch";

export async function updateStitchingStatus(
  orderId: number,
  status: TailorStitchingStatus,
): Promise<any> {
  return request<any>(`/orders/${orderId}/status`, {
    method: "PATCH",
    body: { status },
  });
}

// ─── Broadcast types ──────────────────────────────────────────────────────────

export interface BroadcastOffer {
  broadcast_id: number;
  order_id: number;
  order_code: string;
  service_name: string;
  garment_count: number;
  pickup_area: string;
  status: string;
  broadcast_round: number;
  notified_at: string | null;
  expires_at: string;
  // Stitching requirements
  urgency_level: string | null;
  expected_delivery_date: string | null;
  description: string | null;
  fabric_notes: string | null;
  customization_notes: string | null;
  cloth_details: string | null;
  stitching_preferences: Record<string, string> | null;
}

// ─── Broadcast API calls ──────────────────────────────────────────────────────

export async function listBroadcastOffers(): Promise<BroadcastOffer[]> {
  const res = await request<{ broadcasts: BroadcastOffer[] }>("/tailor/orders/broadcasts");
  return (res as any).broadcasts ?? [];
}

export async function acceptBroadcast(orderId: number): Promise<any> {
  return request<any>(`/tailor/orders/${orderId}/broadcast/accept`, { method: "PATCH" });
}

export async function declineBroadcast(orderId: number): Promise<any> {
  return request<any>(`/tailor/orders/${orderId}/broadcast/decline`, { method: "PATCH" });
}

// ─── Tailor own profile ───────────────────────────────────────────────────────

export interface TailorProfile {
  Id: number;
  UserId: number;
  Specialization: string | null;
  Experience: number;
  Location: string | null;
  Bio: string | null;
  Rating: number;
  IsAvailable: boolean;
  IsOnline: boolean;
  Latitude: number | null;
  Longitude: number | null;
  PortfolioImages: string[] | null;
}

export async function getMyTailorProfile(): Promise<TailorProfile> {
  return request<TailorProfile>("/tailors/me");
}

export async function updateMyTailorProfile(data: {
  specialization?: string;
  experience?: number;
  location?: string;
  bio?: string;
  is_available?: boolean;
}): Promise<TailorProfile> {
  return request<TailorProfile>("/tailors/me", { method: "PATCH", body: data });
}

export async function updateOnlineStatus(
  isOnline: boolean,
  latitude?: number | null,
  longitude?: number | null,
): Promise<any> {
  return request<any>(`/tailors/me/online`, {
    method: "PATCH",
    body: { is_online: isOnline, latitude, longitude },
  });
}
