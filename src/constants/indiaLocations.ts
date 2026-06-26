/** Default service city for Darzi delivery. */
export const DEFAULT_CITY = "Noida";
export const DEFAULT_STATE = "Uttar Pradesh";

/**
 * All cities / localities currently served — Delhi NCR + Noida / Greater Noida.
 * Compared case-insensitively so "delhi", "Delhi", "DELHI" all match.
 */
export const SERVICE_CITIES = new Set([
  // Delhi UT
  "delhi",
  "new delhi",
  "central delhi",
  "north delhi",
  "south delhi",
  "east delhi",
  "west delhi",
  "north west delhi",
  "south west delhi",
  "north east delhi",
  "dwarka",
  "rohini",
  "saket",
  "janakpuri",
  "pitampura",
  "preet vihar",
  "lajpat nagar",
  "karol bagh",
  "connaught place",
  // Haryana — NCR
  "gurugram",
  "gurgaon",
  "faridabad",
  "ballabhgarh",
  // Uttar Pradesh — NCR
  "noida",
  "greater noida",
  "ghaziabad",
  "loni",
  "indirapuram",
]);

/** Major cities grouped by Indian state / UT (alphabetical within each state). */
export const INDIA_STATE_CITIES: Record<string, string[]> = {
  "Andaman and Nicobar Islands": ["Port Blair"],
  "Andhra Pradesh": [
    "Amaravati",
    "Guntur",
    "Kakinada",
    "Kurnool",
    "Nellore",
    "Tirupati",
    "Vijayawada",
    "Visakhapatnam",
  ],
  "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat", "Tawang"],
  Assam: ["Dibrugarh", "Guwahati", "Jorhat", "Silchar", "Tezpur"],
  Bihar: ["Bhagalpur", "Gaya", "Muzaffarpur", "Patna", "Purnia"],
  Chandigarh: ["Chandigarh"],
  Chhattisgarh: ["Bhilai", "Bilaspur", "Durg", "Korba", "Raipur"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Daman", "Diu", "Silvassa"],
  Delhi: [
    "Central Delhi",
    "Delhi",
    "Dwarka",
    "East Delhi",
    "Janakpuri",
    "Karol Bagh",
    "Lajpat Nagar",
    "New Delhi",
    "North Delhi",
    "North West Delhi",
    "Pitampura",
    "Rohini",
    "Saket",
    "South Delhi",
    "South West Delhi",
    "West Delhi",
  ],
  Goa: ["Margao", "Panaji", "Vasco da Gama"],
  Gujarat: [
    "Ahmedabad",
    "Gandhinagar",
    "Jamnagar",
    "Rajkot",
    "Surat",
    "Vadodara",
  ],
  Haryana: ["Ballabhgarh", "Faridabad", "Gurugram", "Gurgaon", "Hisar", "Karnal", "Panipat", "Rohtak"],
  "Himachal Pradesh": ["Dharamshala", "Kullu", "Manali", "Shimla", "Solan"],
  "Jammu and Kashmir": ["Anantnag", "Baramulla", "Jammu", "Srinagar"],
  Jharkhand: ["Bokaro", "Dhanbad", "Jamshedpur", "Ranchi"],
  Karnataka: [
    "Belagavi",
    "Bengaluru",
    "Hubballi",
    "Mangaluru",
    "Mysuru",
    "Udupi",
  ],
  Kerala: [
    "Kochi",
    "Kozhikode",
    "Malappuram",
    "Thiruvananthapuram",
    "Thrissur",
  ],
  Ladakh: ["Kargil", "Leh"],
  Lakshadweep: ["Kavaratti"],
  "Madhya Pradesh": ["Bhopal", "Gwalior", "Indore", "Jabalpur", "Ujjain"],
  Maharashtra: [
    "Aurangabad",
    "Kolhapur",
    "Mumbai",
    "Nagpur",
    "Nashik",
    "Pune",
    "Thane",
  ],
  Manipur: ["Imphal"],
  Meghalaya: ["Shillong", "Tura"],
  Mizoram: ["Aizawl", "Lunglei"],
  Nagaland: ["Dimapur", "Kohima"],
  Odisha: ["Bhubaneswar", "Cuttack", "Puri", "Rourkela", "Sambalpur"],
  Puducherry: ["Karaikal", "Puducherry", "Yanam"],
  Punjab: ["Amritsar", "Bathinda", "Jalandhar", "Ludhiana", "Mohali", "Patiala"],
  Rajasthan: [
    "Ajmer",
    "Bikaner",
    "Jaipur",
    "Jodhpur",
    "Kota",
    "Udaipur",
  ],
  Sikkim: ["Gangtok", "Namchi"],
  "Tamil Nadu": [
    "Chennai",
    "Coimbatore",
    "Madurai",
    "Salem",
    "Tiruchirappalli",
    "Tirunelveli",
  ],
  Telangana: ["Hyderabad", "Karimnagar", "Nizamabad", "Warangal"],
  Tripura: ["Agartala", "Udaipur"],
  "Uttar Pradesh": [
    "Agra",
    "Aligarh",
    "Ghaziabad",
    "Gorakhpur",
    "Greater Noida",
    "Indirapuram",
    "Kanpur",
    "Loni",
    "Lucknow",
    "Meerut",
    "Noida",
    "Prayagraj",
    "Varanasi",
  ],
  Uttarakhand: ["Dehradun", "Haridwar", "Haldwani", "Nainital", "Rishikesh"],
  "West Bengal": [
    "Asansol",
    "Durgapur",
    "Howrah",
    "Kolkata",
    "Siliguri",
  ],
};

export const INDIA_STATES = Object.keys(INDIA_STATE_CITIES).sort((a, b) =>
  a.localeCompare(b),
);

export function isServiceCity(city: string): boolean {
  return SERVICE_CITIES.has(city.trim().toLowerCase());
}

export function findStateForCity(cityName: string): string | null {
  const needle = cityName.trim().toLowerCase();
  if (!needle) return null;
  for (const [stateName, cities] of Object.entries(INDIA_STATE_CITIES)) {
    if (cities.some((c) => c.toLowerCase() === needle)) return stateName;
  }
  return null;
}

export function getCitiesForState(stateName: string): string[] {
  return [...(INDIA_STATE_CITIES[stateName] ?? [])].sort((a, b) =>
    a.localeCompare(b),
  );
}

/** Ensures a custom saved city still appears in the picker list. */
export function withCustomOption(options: string[], current: string): string[] {
  const trimmed = current.trim();
  if (!trimmed) return options;
  if (options.some((o) => o.toLowerCase() === trimmed.toLowerCase())) {
    return options;
  }
  return [trimmed, ...options];
}
