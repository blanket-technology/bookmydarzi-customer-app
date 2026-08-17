// ============================================================================
// Cart API types - aligned with GET /cart and POST /cart/checkout payloads
// ============================================================================

/** Designer-stitching design brief - only meaningful for Designer/premium
 * service lines, collected in the quality-picker sheet before add-to-cart. */
export interface StitchingPreferences {
  design_style?: "traditional" | "contemporary" | "fusion" | "custom";
  embellishment_level?: "none" | "light" | "heavy";
  design_notes?: string;
  reference_photo_url?: string;
}

/** One line in `service_entries` on the cart payload. Measurement is never
 * supplied or shown by the customer - it's collected later by Bridge/employee
 * at pickup or by Admin. */
export interface CartServiceEntry {
  id: number;
  serviceId: number;
  serviceName: string;
  categoryName: string | null;
  imageUrl: string | null;
  personName: string;
  gender: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  unitPriceDisplay: string;
  lineTotalDisplay: string;
  notes: string | null;
  stitchingPreferences: StitchingPreferences | null;
}

/** Maps 1:1 to the `billing` object on the cart payload. */
export interface CartBilling {
  itemTotal: number;
  discount: number;
  platformFee: number;
  cgstAmount: number;
  sgstAmount: number;
  gstAmount: number;
  /** Preview of any pending cancellation penalty, already folded into totalAmount. */
  penaltyAmount: number;
  totalAmount: number;
  advanceAmount: number;
  remainingAmount: number;
  itemTotalDisplay: string;
  platformFeeDisplay: string;
  cgstDisplay: string;
  sgstDisplay: string;
  gstDisplay: string;
  totalAmountDisplay: string;
  advanceAmountDisplay: string;
  remainingAmountDisplay: string;
}

const EMPTY_BILLING: CartBilling = {
  itemTotal: 0,
  discount: 0,
  platformFee: 0,
  cgstAmount: 0,
  sgstAmount: 0,
  gstAmount: 0,
  penaltyAmount: 0,
  totalAmount: 0,
  advanceAmount: 0,
  remainingAmount: 0,
  itemTotalDisplay: "₹0",
  platformFeeDisplay: "₹0",
  cgstDisplay: "₹0",
  sgstDisplay: "₹0",
  gstDisplay: "₹0",
  totalAmountDisplay: "₹0",
  advanceAmountDisplay: "₹0",
  remainingAmountDisplay: "₹0",
};

/** Full cart payload, e.g. response of GET /cart. */
export interface ApiCart {
  id: number;
  customerId: number;
  status: string;
  address: unknown | null;
  totalAmount: number;
  totalAmountDisplay: string;
  billing: CartBilling;
  entries: CartServiceEntry[];
  itemCount: number;
}

export const EMPTY_CART: ApiCart = {
  id: 0,
  customerId: 0,
  status: "",
  address: null,
  totalAmount: 0,
  totalAmountDisplay: "₹0",
  billing: EMPTY_BILLING,
  entries: [],
  itemCount: 0,
};

export interface AddCartServiceEntryPayload {
  service_id: number;
  quantity?: number;
  tailor_id?: number;
  customization_notes?: string;
  stitching_preferences?: StitchingPreferences;
}

export interface UpdateCartServiceEntryPayload {
  quantity: number;
}

export interface CartCheckoutPayload {
  address_id: number;
  payment_method?: "online" | "cod";
  pickup_type?: "instant" | "scheduled";
  offer_id?: number;
  scheduled_pickup_at?: string;
  pickup_time_slot?: string;
  /** Order-level free-text notes (maps to backend customization_notes). */
  customization_notes?: string;
  /** Reference style image URLs (maps to backend image_references). */
  image_references?: string[];
}

/** One line in `line_items` on the checkout response. */
export interface CheckoutLineItem {
  personName: string;
  serviceName: string;
  categoryName: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  price: number;
  priceDisplay: string;
}

/** Maps 1:1 to the POST /cart/checkout response. */
export interface CartCheckoutResult {
  orderId: number;
  orderCode: string;
  status: string;
  paymentId: number;
  action: string;
  subtotal: number;
  discount: number;
  platformFee: number;
  cgstAmount: number;
  sgstAmount: number;
  gstAmount: number;
  /** Any pending cancellation penalty already folded into finalAmount. */
  penaltyAmount: number;
  finalAmount: number;
  totalAmountDisplay: string;
  advanceAmount: number;
  advanceAmountDisplay: string;
  remainingAmount: number;
  remainingAmountDisplay: string;
  lineItems: CheckoutLineItem[];
  message: string;
}
