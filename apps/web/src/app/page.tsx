import type { Metadata } from "next";
import Landing from "@/components/landing/Landing";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: "کودک‌بوک — آموزش زبان فارسی به کودکان با قصه و بازی",
  description:
    "نرم‌افزار آموزش فارسی برای کودکان ۳ تا ۱۰ سال خانواده‌های ایرانی خارج از کشور: الفبا، صداکشی، واژگان با مرور هوشمند، تمرین گفتار و داستان‌های شخصی با هوش مصنوعی و صدای گوینده. شروع رایگان.",
  alternates: {
    canonical: `${SITE_URL}/`,
  },
  openGraph: {
    title: "کودک‌بوک — فارسی برای کودکان",
    description: "کودک شما فارسی را با قصه و بازی یاد می‌گیرد — روزی ۱۰ دقیقه.",
    type: "website",
    locale: "fa_IR",
    url: "/",
    // Reuses the app icon — a real 1200×630 hero shot would read better in
    // link previews, but this closes the "no image at all" gap for free.
    images: [
      {
        url: "/og/koodakbook-og.png",
        width: 512,
        height: 512,
        alt: "کودک‌بوک",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "کودک‌بوک — فارسی برای کودکان",
    description: "کودک شما فارسی را با قصه و بازی یاد می‌گیرد — روزی ۱۰ دقیقه.",
    images: ["/og/koodakbook-og.png"],
  },
};

/**
 * Public marketing landing — the root of the site. Always renders the
 * landing page, regardless of session state: koodakbook.eu.cc must stay a
 * normal marketing page you can land on and share, not bounce straight into
 * the app just because a browser has a stored session. (Previously a
 * <SessionRedirect/> component sent logged-in visitors straight to
 * /parent/dashboard or /child/home — removed on request; app users still
 * reach the app via /login or their own bookmarked app URL.)
 */
export default function RootPage() {
  return <Landing />;
}
