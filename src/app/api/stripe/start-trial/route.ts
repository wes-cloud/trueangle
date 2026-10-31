import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(request: Request) {
  try {
    const { email: rawEmail, password } = await request.json();
    const email = String(rawEmail || "").trim().toLowerCase();
    if (!email || typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Enter a valid email and password (at least 8 characters)." }, { status: 400 });
    }

    const { data: found, error: lookupError } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (lookupError) throw lookupError;
    let userId = found.users.find(u => u.email?.toLowerCase() === email)?.id;
    if (userId) {
      // Never allow a checkout for another user's email without proving ownership.
      const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { data, error } = await auth.auth.signInWithPassword({ email, password });
      if (error || data.user?.id !== userId) {
        return NextResponse.json({ error: "Unable to complete account setup with those credentials. Please sign in or recover access if you have an account." }, { status: 401 });
      }
    } else {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !data.user) return NextResponse.json({ error: "Unable to complete account setup. Please check your details or recover access." }, { status: 400 });
      userId = data.user.id;
    }

    const { data: current, error: dbError } = await admin.from("subscriptions").select("status").eq("user_id", userId).maybeSingle();
    if (dbError) throw dbError;
    if (current && ["trialing", "active", "past_due"].includes(current.status)) {
      return NextResponse.json({ error: "Unable to start another trial. Please sign in to continue." }, { status: 409 });
    }
    // Also check Stripe directly: a delayed webhook must not permit duplicate subscriptions.
    const existing = await stripe.subscriptions.search({ query: "metadata['user_id']:'" + userId + "'", limit: 20 });
    if (existing.data.some(s => ["trialing", "active", "past_due", "incomplete"].includes(s.status))) {
      return NextResponse.json({ error: "Unable to start another trial. Please sign in or contact support." }, { status: 409 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      subscription_data: { trial_period_days: 14, metadata: { user_id: userId } },
      metadata: { user_id: userId },
      allow_promotion_codes: true,
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/trial-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?trial=canceled`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Start trial failed", err);
    return NextResponse.json({ error: "Unable to start trial. Please try again or contact support." }, { status: 500 });
  }
}
