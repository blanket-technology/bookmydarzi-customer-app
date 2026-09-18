// Fallback body copy for a tier that has no real description set in the
// catalog yet. Mirrors bookmydarzi-web-final's lib/services/fallbackDescription.ts
// exactly, so the customer app and website never show identical-looking
// generic text for a tier that hasn't had a real description written yet -
// a stopgap until real descriptions are added in the admin panel, not a
// replacement for them.
export function fallbackTierDescription(params: {
  name: string;
  basePrice: number;
  estimatedDeliveryDays: number;
}): string {
  const { name, basePrice, estimatedDeliveryDays } = params;
  const lower = name.toLowerCase();
  const days = `${estimatedDeliveryDays} day${estimatedDeliveryDays === 1 ? "" : "s"}`;
  const price = `₹${basePrice.toLocaleString("en-IN")}`;

  if (basePrice <= 49) {
    return `A quick, precise fix - ${lower} starts at ${price} and is typically ready in ${days}.`;
  }
  if (basePrice <= 99) {
    return `${name} done right: picked up from your door, handled by a verified tailor, and delivered back in ${days} for ${price}.`;
  }
  return `A more involved job - ${lower} is priced at ${price} and takes about ${days}, with the fabric collected and returned to your door.`;
}
