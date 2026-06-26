export interface Service {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
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
}

export interface Order {
  id: string;
  item: string;
  status: "In Progress" | "Ready" | "Delivered" | "Pending";
  deliveryDate: string;
  clothType: string;
}

export interface Offer {
  id: string;
  title: string;
  subtitle: string;
  discount: string;
  code: string;
}

export const SERVICES: Service[] = [
  { id: "1", title: "Men Suit",       description: "Bespoke tailoring",   icon: "shirt-outline",          color: "#0c6c75", bgColor: "#e0f7f8" },
  { id: "2", title: "Women Dress",    description: "Elegant designs",     icon: "woman-outline",          color: "#7C3AED", bgColor: "#EDE9FE" },
  { id: "3", title: "Blouse",         description: "Perfect fit blouse",  icon: "cut-outline",            color: "#B45309", bgColor: "#FEF3C7" },
  { id: "4", title: "Alteration",     description: "Quick alterations",   icon: "construct-outline",      color: "#065F46", bgColor: "#D1FAE5" },
  { id: "5", title: "Sherwani",       description: "Royal sherwani",      icon: "diamond-outline",        color: "#9D174D", bgColor: "#FCE7F3" },
  { id: "6", title: "Wedding",        description: "Bridal collection",   icon: "heart-outline",          color: "#C9A84C", bgColor: "#F5E6C0" },
];

export const TAILORS: Tailor[] = [
  { id: "1", name: "Arjun Sharma",   specialty: "Men's Suits",     rating: 4.9, reviews: 312, experience: "12 yrs", avatar: "AS", badge: "Top Rated" },
  { id: "2", name: "Priya Mehta",    specialty: "Bridal Wear",     rating: 4.8, reviews: 245, experience: "8 yrs",  avatar: "PM", badge: "Expert"    },
  { id: "3", name: "Ravi Kumar",     specialty: "Alterations",     rating: 4.7, reviews: 189, experience: "6 yrs",  avatar: "RK"                      },
  { id: "4", name: "Sunita Patel",   specialty: "Women's Dress",   rating: 4.9, reviews: 401, experience: "15 yrs", avatar: "SP", badge: "Top Rated" },
];

export const ORDERS: Order[] = [
  { id: "1", item: "Navy Blue Suit",    status: "In Progress", deliveryDate: "May 12, 2026", clothType: "Wool Blend"   },
  { id: "2", item: "Silk Blouse",       status: "Ready",       deliveryDate: "May 8, 2026",  clothType: "Pure Silk"    },
  { id: "3", item: "Wedding Sherwani",  status: "Pending",     deliveryDate: "May 20, 2026", clothType: "Brocade"      },
];

export const OFFERS: Offer[] = [
  { id: "1", title: "First Stitch Deal",  subtitle: "New customer exclusive",  discount: "30% OFF", code: "FIRST30"  },
  { id: "2", title: "Weekend Special",    subtitle: "Limited time offer",       discount: "20% OFF", code: "WKND20"   },
];
