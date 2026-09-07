// ============================================================================
// GLOBAL TYPES & INTERFACES
// ============================================================================

export interface User {
  id: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  name: string;
  email: string;
  phone_number: string;
  avatar?: string;
  address?: string;
  measurements?: Measurements;
}

export interface Measurements {
  chest?: number;
  waist?: number;
  hip?: number;
  shoulder?: number;
  sleeve?: number;
  length?: number;
  inseam?: number;
  neck?: number;
}

export interface Service {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  price_starting: number;
  duration: string;
  category: "men" | "women" | "kids" | "alteration" | "wedding";
  popular?: boolean;
}

export interface Tailor {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  reviews: number;
  experience: string;
  avatar: string;
  badge?: string;
  online?: boolean;
  price_per_hour?: number;
  completed_orders?: number;
}

export interface Order {
  id: string;
  item: string;
  status: "pending" | "in_progress" | "ready" | "delivered" | "cancelled";
  delivery_date: string;
  cloth_type: string;
  tailor: Tailor;
  price: number;
  payment_status: "paid" | "pending" | "failed";
  created_at: string;
  tracking?: OrderTracking[];
}

export interface OrderTracking {
  status: string;
  timestamp: string;
  description: string;
}

export interface Booking {
  id: string;
  tailor: Tailor;
  service: Service;
  date: string;
  time: string;
  status: "confirmed" | "pending" | "cancelled" | "completed";
  notes?: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface ChatConversation {
  id: string;
  tailor: Tailor;
  last_message: ChatMessage;
  unread_count: number;
  online: boolean;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "order" | "booking" | "payment" | "promo" | "system";
  read: boolean;
  timestamp: string;
  action_url?: string;
}

export interface Offer {
  id: string;
  title: string;
  subtitle: string;
  discount: string;
  code: string;
  valid_until: string;
  terms?: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  total_pages: number;
  total_items: number;
}

// ── Payload types used by service functions ──────────────────────────────────

export interface CreateOrderPayload {
  tailorId: string;
  serviceId: string;
  clothType: string;
  notes?: string;
}

export interface CreateBookingPayload {
  tailorId: string;
  serviceId: string;
  date: string;
  time: string;
  notes?: string;
}

export interface SendMessagePayload {
  conversationId: string;
  message: string;
  senderId: string;
}

export interface ProfileUpdatePayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  gender?: string;
  /** Form value - mapped to backend `Mobile` on PATCH. */
  phone?: string;
  /** Backend User model field (preferred on PATCH). */
  Mobile?: string;
  mobile?: string;
  phone_number?: string;
  address?: string;
  profile_image?: string;
}

export interface SearchFilters {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  onlineOnly?: boolean;
}

export interface SearchResults {
  services: Service[];
  tailors: Tailor[];
  query?: string;
  filters?: SearchFilters;
}
