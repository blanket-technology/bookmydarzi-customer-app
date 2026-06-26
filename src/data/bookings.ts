import type { Booking } from "../types";
import { TAILORS_DATA } from "./tailors";
import { SERVICES_DATA } from "./services";

export const BOOKINGS_DATA: Booking[] = [
  {
    id: "bkg_001",
    tailor: TAILORS_DATA[0],
    service: SERVICES_DATA[0],
    date: "May 12, 2026",
    time: "10:00 AM",
    status: "confirmed",
    notes: "Please bring fabric samples",
    created_at: "2026-05-01",
  },
  {
    id: "bkg_002",
    tailor: TAILORS_DATA[1],
    service: SERVICES_DATA[4],
    date: "May 18, 2026",
    time: "2:00 PM",
    status: "pending",
    notes: "Bridal consultation",
    created_at: "2026-05-03",
  },
];
