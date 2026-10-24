/** How customers reach the shop, shown on the contact page and in the footer. */
export const SHOP_PHONE = "+216 55 143 901";
export const SHOP_PHONE_HREF = `tel:${SHOP_PHONE.replace(/\s/g, "")}`;

export const SOCIAL_LINKS = [
  {
    network: "instagram",
    label: "Instagram",
    handle: "@kwik_tunisie",
    href: "https://www.instagram.com/kwik_tunisie/",
  },
  {
    network: "facebook",
    label: "Facebook",
    handle: "Facebook",
    href: "https://www.facebook.com/profile.php?id=61591807260828",
  },
] as const;

export type SocialNetwork = (typeof SOCIAL_LINKS)[number]["network"];
