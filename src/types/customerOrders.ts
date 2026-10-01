// ============================================================================
// Customer orders API - GET /customer/orders/*
// ============================================================================

export interface CustomerOrderListItem {
  id: number;
  bookingId: string;
  status: string;
  statusLabel: string;
  scheduledLabel: string;
  amountPaidDisplay: string;
  serviceTitle: string;
  serviceSubtitle: string;
  /** Absolute service image URL for the card thumbnail (backend `thumbnail`). */
  thumbnail?: string | null;
  /** Backend `expected_delivery_date` (ISO YYYY-MM-DD) - when the order is
   * expected to be delivered. Absent on cancelled/legacy orders. */
  expectedDeliveryDate?: string | null;
  canPayNow?: boolean;
  paymentStatusLabel?: string;
  /** Raw backend payment_status (fully_paid | advance_paid | balance_due | payment_pending | cod_pending | payment_failed | refunded | paid). */
  paymentStatus?: string;
  /** Raw backend payment_method ("online" | "cod") - the actual gateway used, straight from the Payment row. Null only when no payment attempt exists yet. */
  paymentMethod?: string | null;
  /** Order total in rupees - always present regardless of payment state (backend's `price`/FinalAmount). */
  orderAmount?: number;
  pickupType?: string | null;
  pickupTimeSlot?: string | null;
  scheduledPickupAt?: string | null;
  /** Present only on cancelled-order list items (GET /customer/orders/cancelled). */
  cancelledAt?: string | null;
  cancelReason?: string | null;
  penaltyAmount?: number;
  refundAmount?: number;
}

/** GET /customer/orders/active|completed|cancelled - paginated envelope. */
export interface PaginatedCustomerOrders {
  items: CustomerOrderListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface CustomerOrderKeyValue {
  label: string;
  value: string;
}

export interface CustomerOrderServiceLine {
  id?: string | number;
  name: string;
  subtitle?: string;
  quantity?: number;
  priceDisplay?: string;
}

export interface CustomerOrderBillLine {
  label: string;
  value: string;
  isTotal?: boolean;
  isDiscount?: boolean;
}

export interface CustomerOrderSupportInfo {
  title: string;
  subtitle?: string;
  phone?: string;
  email?: string;
  actionLabel?: string;
}

export interface CustomerOrderSummary {
  id: number;
  bookingId: string;
  status: string;
  statusLabel: string;
  isCompleted: boolean;
  headerSubtitle?: string;
  services: CustomerOrderServiceLine[];
  billLines: CustomerOrderBillLine[];
  bookingDetails: CustomerOrderKeyValue[];
  addressLines: CustomerOrderKeyValue[];
  paymentLines: CustomerOrderKeyValue[];
  support?: CustomerOrderSupportInfo;
}

export interface CustomerOrderDetails extends CustomerOrderSummary {
  trackingSteps: CustomerOrderKeyValue[];
  notes?: string;
  tailorName?: string;
  createdAtLabel?: string;
  updatedAtLabel?: string;
}

/** GET /customer/orders/{id}/summary - nested API payload */
export interface OrderSummaryOrderBlock {
  order_code: string | null;
  status: string | null;
  completed_at: string | null;
}

export interface OrderSummaryDatesBlock {
  order_placed_at: string | null;
  expected_delivery_date: string | null;
  delivered_at: string | null;
}

export interface OrderSummaryServiceBlock {
  service_name: string | null;
  category_name: string | null;
  quantity: number | null;
}

export interface OrderSummaryBillingBlock {
  item_total: number | string | null;
  gst_amount: number | string | null;
  cgst_amount: number | string | null;
  sgst_amount: number | string | null;
  service_fee: number | string | null;
  discount: number | string | null;
  total_amount: number | string | null;
  advance_amount: number | null;
  remaining_amount: number | null;
}

export interface OrderSummaryPaymentBlock {
  payment_method: string | null;
  payment_status: string | null;
  transaction_id: string | null;
}

export interface OrderSummaryDeliveryAddressBlock {
  name: string | null;
  mobile: string | null;
  full_address: string | null;
}

export interface CustomerOrderSummaryPayload {
  orderId: number;
  order: OrderSummaryOrderBlock;
  dates: OrderSummaryDatesBlock;
  service: OrderSummaryServiceBlock;
  billing: OrderSummaryBillingBlock;
  payment: OrderSummaryPaymentBlock;
  delivery_address: OrderSummaryDeliveryAddressBlock;
}

/** Who's coming to the customer's door for pickup - only present once a
 * Bridge/employee has actually been assigned and the order has reached a
 * pickup-relevant status (see backend's _PICKUP_PARTNER_VISIBLE_FROM). */
export interface PickupPartner {
  name: string;
  photo_url: string | null;
  mobile: string | null;
  /** This Bridge employee's average customer rating, 0-5. Null if never rated yet. */
  rating: number | null;
}

/** Delivery-leg equivalent of PickupPartner - a different employee may
 * deliver than picked up (delivery broadcast), so this is never assumed
 * to be the same person as pickup_partner. */
export type DeliveryPartner = PickupPartner;

/** Return-leg equivalent of PickupPartner - who's bringing the garment
 * back after a cancellation past custody. Never assumed to be the same
 * person as pickup_partner/delivery_partner. */
export type ReturnPartner = PickupPartner;

/** Repair-pickup-leg equivalent of PickupPartner - who's collecting the
 * garment from the customer after an issue is reported, to take it back
 * to the tailor. Never assumed to be the same person as any other leg. */
export type RepairPickupPartner = PickupPartner;

/** Repair-delivery-leg equivalent of PickupPartner - who's bringing the
 * repaired garment back to the customer. Never assumed to be the same
 * person as any other leg. */
export type RepairDeliveryPartner = PickupPartner;

/** GET /customer/orders/{id}/details - nested API payload */
export interface OrderDetailsOrderBlock {
  order_code: string | null;
  order_id: number | null;
  status: string | null;
  customer_status: string | null;
  urgency_level: string | null;
  pickup_type: string | null;
  pickup_time_slot: string | null;
  scheduled_pickup_at: string | null;
  /** Reference style images the customer attached at order time. */
  image_references?: string[] | null;
  /** Free-text order notes entered at checkout. */
  customization_notes?: string | null;
  /** Voice note the customer recorded at checkout, if any. */
  voice_note_url?: string | null;
  /** The most recent post-delivery inspection-window issue report on this
   * order, if any - shown so a customer can see their own report was
   * received, not just that the status changed to "Repair In Progress". */
  latest_repair_request?: {
    issue_description: string;
    issue_photo_urls?: string[] | null;
    reported_at: string;
    resolved_at?: string | null;
  } | null;
  pickup_partner?: PickupPartner | null;
  delivery_partner?: DeliveryPartner | null;
  return_partner?: ReturnPartner | null;
  repair_pickup_partner?: RepairPickupPartner | null;
  repair_delivery_partner?: RepairDeliveryPartner | null;
  /** Backend-authoritative "can this pickup still be moved" flag - mirrors
   * the reschedule endpoint's own RESCHEDULABLE_FROM check. Optional/
   * defaults to false so older cached responses (before this field
   * existed) don't crash a strict consumer. */
  can_reschedule?: boolean;
}

export interface OrderDetailsServiceBlock {
  service_name: string | null;
  category_name: string | null;
  base_price: number | string | null;
}

export interface OrderDetailsPricingBlock {
  base_amount: number | string | null;
  discount_amount: number | string | null;
  gst_amount: number | string | null;
  cgst_amount: number | string | null;
  sgst_amount: number | string | null;
  service_fee: number | string | null;
  /** Any cancellation penalty folded into final_amount (0/null if none). */
  penalty_amount?: number | string | null;
  final_amount: number | string | null;
  advance_amount: number | null;
  remaining_amount: number | null;
}

export interface OrderDetailsPaymentBlock {
  amount: number | string | null;
  payment_method: string | null;
  payment_status: string | null;
  transaction_id: string | null;
}

export interface OrderDetailsDeliveryAddressBlock {
  name: string | null;
  mobile: string | null;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

export interface OrderDetailsMeasurementBlock {
  profile_name: string | null;
  gender: string | null;
  fit: string | null;
  neck: number | string | null;
  chest: number | string | null;
  waist: number | string | null;
  hips: number | string | null;
  shoulder: number | string | null;
  sleeve_length: number | string | null;
  inseam: number | string | null;
  height: number | string | null;
  notes: string | null;
}

export interface OrderDetailsTimelineItem {
  status: string | null;
  timestamp: string | null;
}

/** One booked service within an order (GET /customer/orders/{id}/details
 * line_items[]). A direct/buy-now order always has exactly one; a
 * cart-checkout order can have several (e.g. Men's Shirt + Kids Clothing +
 * Alteration in the same booking), each with its own measurement. */
/** One extra selected for a line item, at booking or added later by
 * Bridge/employee at pickup (e.g. Button Replacement). */
export interface OrderDetailsLineItemAddon {
  addon_id: number | null;
  name: string;
  price: number;
  note: string | null;
}

export interface OrderDetailsLineItem {
  order_item_id: number | null;
  person_name: string | null;
  service_id: number | null;
  service_name: string | null;
  category_name: string | null;
  /** Service/stitching-type photo for this line item's thumbnail. */
  image_url?: string | null;
  quantity: number;
  unit_price: number | string | null;
  line_total: number | string | null;
  /** Filled by Bridge/employee at pickup, or by Admin - never by the
   * customer. Null until staff have collected it. */
  measurement: OrderDetailsMeasurementBlock | null;
  /** Designer design brief for this item, if any - reflects back what the
   * customer submitted at booking (design style, embellishment, notes). */
  stitching_preferences?: {
    design_style?: string;
    embellishment_level?: string;
    design_notes?: string;
    reference_photo_url?: string;
  } | null;
  /** Customer's plain-text note for this specific sub-service, carried over
   * from the cart entry at checkout. */
  notes?: string | null;
  addons: OrderDetailsLineItemAddon[];
}

export interface CustomerOrderDetailsPayload {
  orderId: number;
  order: OrderDetailsOrderBlock;
  /** First/primary booked service - kept for backward compatibility.
   * Prefer `line_items` to render every service on a multi-item order. */
  service: OrderDetailsServiceBlock;
  pricing: OrderDetailsPricingBlock;
  payment: OrderDetailsPaymentBlock;
  delivery_address: OrderDetailsDeliveryAddressBlock;
  /** First/primary measurement - kept for backward compatibility. Prefer
   * `line_items[].measurement` for a multi-item order. */
  measurement: OrderDetailsMeasurementBlock;
  line_items: OrderDetailsLineItem[];
  tracking_timeline: OrderDetailsTimelineItem[];
  /** Set only when this order was cancelled postpaid (COD) with a nonzero
   * penalty still owed - that penalty is deferred to whatever order the
   * customer places next, not charged now (nothing was paid upfront on a
   * COD order). Null/undefined for every other order, including prepaid
   * cancellations (that penalty is already reflected in pricing.penalty_amount
   * / the refund, not deferred). */
  pendingPenaltyAmount?: number | null;
}
