export const CONTACT = {
  whatsappDisplay: "(11) 94816-9215",
  whatsappNumber: "5511948169215",
  businessEmail: "neisegon@gmail.com",
  initialAnalyst: "Indiamara Camargo",
  instagramUrl: "https://www.instagram.com/centralprecatoriosbr/",
  instagramHandle: "@centralprecatoriosbr",
} as const;

export function whatsappUrl(message: string) {
  return `https://wa.me/${CONTACT.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
