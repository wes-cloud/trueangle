import { NextResponse } from "next/server";
import { billingAdmin, getBillingUser } from "@/lib/server/billing";
import { openCheckout } from "@/lib/server/checkout";

export async function POST(request: Request) {
  try {
    const { email: rawEmail, password, intent } = await request.json();
    let user = await getBillingUser(request);
    if (!user) {
      if (request.headers.has("authorization") || intent !== "trial") {
        return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
      }
      const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
      if (!email || typeof password !== "string" || password.length < 8) {
        return NextResponse.json({ error: "Enter a valid email and password (at least 8 characters)." }, { status: 400 });
      }
      const { data, error } = await billingAdmin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) {
        return NextResponse.json({
          error: "Unable to complete account setup. Please sign in or recover access if you have an account.",
        }, { status: 400 });
      }
      user = data.user;
    }
    if (!user.email || (intent !== "trial" && intent !== "reactivate")) {
      return NextResponse.json({ error: "Choose a subscription option to continue." }, { status: 400 });
    }
    const result = await openCheckout(user.id, user.email, intent);
    return NextResponse.json(result, { status: "error" in result ? 409 : 200 });
  } catch (error) {
    console.error("Subscription checkout failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Unable to open checkout. Please try again or contact support." }, { status: 500 });
  }
}
