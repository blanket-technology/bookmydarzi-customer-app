// ============================================================================
// Backend-aligned types for customer engagement features:
// notifications, wishlist, support, order-scoped chat, refunds.
// Field names mirror the FastAPI response schemas (snake_case).
// ============================================================================

// ── Notifications (/api/v1/notifications) ───────────────────────────────────

export type NotificationType =
  | "order"
  | "payment"
  | "chat"
  | "support"
  | "promo"
  | "system"
  | string;

export interface AppNotification {
  id: number;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, unknown> | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationListResult {
  notifications: AppNotification[];
  total: number;
  unread_count: number;
  page: number;
  limit: number;
}

export type DevicePlatform = "android" | "ios" | "web";

export interface DeviceTokenResult {
  id: number;
  platform: string;
  is_active: boolean;
  created_at: string;
}

// ── Wishlist (/api/v1/wishlist) ─────────────────────────────────────────────

export type WishlistItemType = "service" | "tailor";

export interface WishlistItem {
  id: number;
  item_type: WishlistItemType;
  service_id?: number | null;
  tailor_id?: number | null;
  name?: string | null;
  image_url?: string | null;
  price?: number | null;
  created_at: string;
}

export interface WishlistCheckResult {
  is_wishlisted: boolean;
  wishlist_id?: number | null;
}

export interface WishlistAddPayload {
  item_type: WishlistItemType;
  service_id?: number;
  tailor_id?: number;
}

// ── Support (/api/v1/support) ───────────────────────────────────────────────

export type SupportCategory =
  | "order"
  | "payment"
  | "delivery"
  | "account"
  | "general";

export type SupportTicketStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "closed";

export interface SupportTicketMessage {
  id: number;
  sender_id: number;
  sender_role: string;
  message: string;
  created_at: string;
}

export interface SupportTicket {
  id: number;
  ticket_code?: string | null;
  user_id: number;
  order_id?: number | null;
  subject: string;
  category: SupportCategory;
  status: SupportTicketStatus;
  priority: string;
  created_at: string;
  updated_at?: string | null;
  messages: SupportTicketMessage[];
}

export interface SupportTicketListItem {
  id: number;
  ticket_code?: string | null;
  subject: string;
  category: SupportCategory;
  status: SupportTicketStatus;
  order_id?: number | null;
  created_at: string;
  updated_at?: string | null;
}

export interface SupportTicketCreatePayload {
  subject: string;
  message: string;
  category?: SupportCategory;
  order_id?: number;
}

export interface FAQ {
  id: number;
  question: string;
  answer: string;
  category: string;
}

// ── Order-scoped chat (/api/v1/chat) ────────────────────────────────────────

export type ChatSenderRole = "user" | "customer" | "tailor" | "staff" | "admin" | string;

export interface OrderChatMessage {
  id: number;
  order_id: number;
  sender_id: number;
  sender_role: ChatSenderRole;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface OrderChatThread {
  order_id: number;
  messages: OrderChatMessage[];
  total: number;
  unread_count: number;
}

// ── Refunds (/api/v1/payments/{id}/refund) ──────────────────────────────────

export interface Refund {
  id: number;
  refund_code?: string | null;
  payment_id: number;
  order_id?: number | null;
  amount: number;
  reason?: string | null;
  status: string;
  gateway_refund_id?: string | null;
  failure_reason?: string | null;
  created_at: string;
}
