import { apiRoute } from "@/lib/api/handler";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Ends the session the bearer token belongs to, as signing out on the web does. */
export const POST = apiRoute({ auth: true }, async ({ request }) => {
  await getAuth().api.signOut({ headers: request.headers });
  return { signedOut: true };
});
