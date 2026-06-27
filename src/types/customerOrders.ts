// ============================================================================
// Customer orders API — GET /customer/orders/*
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
  canPayNow?: boolean;
  paymentStatusLabel?: string;
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

/** GET /customer/orders/{id}/summary — nested API payload */
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

/** GET /customer/orders/{id}/details — nested API payload */
export interface OrderDetailsOrderBlock {
  order_code: string | null;
  order_id: number | null;
  status: string | null;
  urgency_level: string | null;
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
  final_amount: number | string | null;
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
  chest: number | string | null;
  waist: number | string | null;
}

export interface OrderDetailsTimelineItem {
  status: string | null;
  timestamp: string | null;
}

export interface CustomerOrderDetailsPayload {
  orderId: number;
  order: OrderDetailsOrderBlock;
  service: OrderDetailsServiceBlock;
  pricing: OrderDetailsPricingBlock;
  payment: OrderDetailsPaymentBlock;
  delivery_address: OrderDetailsDeliveryAddressBlock;
  measurement: OrderDetailsMeasurementBlock;
  tracking_timeline: OrderDetailsTimelineItem[];
}
