import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBillingUser } from "@/lib/server/billing";
import { openCheckout } from "@/lib/server/checkout";

export async function POST(request: Request) {
  if (process.env.BILLING_CHECKOUT_PAUSED === "1") {
    return NextResponse.json({ error: "Checkout is temporarily unavailable. Please try again later." }, { status: 503 });
  }
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
      const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await auth.auth.signUp({
        email, password,
        options: { emailRedirectTo: new URL("/auth", process.env.NEXT_PUBLIC_SITE_URL!).href },
      });
      if (error || !data.user) {
        return NextResponse.json({
          error: "Unable to complete account setup. Please sign in or recover access if you have an account.",
        }, { status: 400 });
      }
      if (!data.session) return NextResponse.json({ verificationRequired: true });
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
