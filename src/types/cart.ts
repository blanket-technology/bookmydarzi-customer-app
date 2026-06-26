// ============================================================================
// Cart API types — aligned with GET /cart and POST /cart/checkout payloads
// ============================================================================

/** A single measurement field shown in the entry preview chips. */
export interface MeasurementPreviewItem {
  name: string;
  value: string;
}

/** Full measurement profile attached to a cart entry (optional, may be null). */
export interface CartEntryMeasurement {
  id: number;
  userId: number;
  profileName: string;
  gender: string | null;
  chest: number;
  waist: number;
  hips: number;
  shoulder: number;
  neck: number;
  sleeveLength: number;
  inseam: number;
  height: number;
  fitPreference: string | null;
  notes: string | null;
  isDefault: boolean;
}

/** One line in `service_entries` on the cart payload. */
export interface CartServiceEntry {
  id: number;
  serviceId: number;
  serviceName: string;
  categoryName: string | null;
  personName: string;
  gender: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  unitPriceDisplay: string;
  lineTotalDisplay: string;
  notes: string | null;
  measurementId: number | null;
  measurementRequired: boolean;
  measurement: CartEntryMeasurement | null;
  measurementPreview: MeasurementPreviewItem[];
}

/** Maps 1:1 to the `billing` object on the cart payload. */
export interface CartBilling {
  itemTotal: number;
  discount: number;
  platformFee: number;
  cgstAmount: number;
  sgstAmount: number;
  gstAmount: number;
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
  measurement_profile_id?: number;
  measurement_id?: number;
  selected_size?: string;
  selected_measurements?: Record<string, number>;
  tailor_id?: number;
  customization_notes?: string;
}

export interface UpdateCartServiceEntryPayload {
  quantity: number;
}

export interface CartCheckoutPayload {
  address_id: number;
  payment_method?: "online";
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
  measurements: MeasurementPreviewItem[];
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
  finalAmount: number;
  totalAmountDisplay: string;
  advanceAmount: number;
  advanceAmountDisplay: string;
  remainingAmount: number;
  remainingAmountDisplay: string;
  lineItems: CheckoutLineItem[];
  message: string;
}
