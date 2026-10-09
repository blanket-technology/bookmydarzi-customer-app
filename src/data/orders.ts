import type { Order } from "../types";
import { TAILORS_DATA } from "./tailors";

export const ORDERS_DATA: Order[] = [
  {
    id: "ord_001",
    item: "Navy Blue Suit",
    status: "in_progress",
    delivery_date: "May 15, 2026",
    cloth_type: "Wool Blend",
    tailor: TAILORS_DATA[0],
    price: 6500,
    payment_status: "paid",
    created_at: "2026-05-01",
    tracking: [
      { status: "Order Placed", timestamp: "May 1, 10:00 AM", description: "Your order has been confirmed" },
      { status: "Measurements Taken", timestamp: "May 2, 2:00 PM", description: "Tailor visited for measurements" },
      { status: "Cutting Started", timestamp: "May 4, 11:00 AM", description: "Fabric cutting in progress" },
      { status: "Stitching In Progress", timestamp: "May 6, 9:00 AM", description: "Currently being stitched" },
    ],
  },
  {
    id: "ord_002",
    item: "Silk Blouse",
    status: "ready",
    delivery_date: "May 8, 2026",
    cloth_type: "Pure Silk",
    tailor: TAILORS_DATA[3],
    price: 1200,
    payment_status: "paid",
    created_at: "2026-04-28",
    tracking: [
      { status: "Order Placed", timestamp: "Apr 28, 10:00 AM", description: "Your order has been confirmed" },
      { status: "Stitching Complete", timestamp: "May 5, 3:00 PM", description: "Your item is ready for pickup" },
    ],
  },
  {
    id: "ord_003",
    item: "Wedding Sherwani",
    status: "pending",
    delivery_date: "May 25, 2026",
    cloth_type: "Brocade",
    tailor: TAILORS_DATA[4],
    price: 14000,
    payment_status: "pending",
    created_at: "2026-05-05",
    tracking: [
      { status: "Order Placed", timestamp: "May 5, 4:00 PM", description: "Awaiting tailor confirmation" },
    ],
  },
];
