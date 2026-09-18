import { buildSecurityTxt } from "@/lib/security-txt";
import { getSiteSettings } from "@/lib/site-settings";
import { siteOrigin } from "@/lib/site-url";

export async function GET() {
  const [settings, origin] = await Promise.all([
    getSiteSettings(),
    siteOrigin(),
  ]);
  return new Response(
    buildSecurityTxt({ contact: settings.contact.general, origin }),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=86400",
      },
    },
  );
}
