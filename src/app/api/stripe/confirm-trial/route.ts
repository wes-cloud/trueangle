import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(request: Request) {
  try {
    const bearer = request.headers.get("authorization") || "";
    if (!bearer.startsWith("Bearer ")) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { data: auth, error: authError } = await admin.auth.getUser(bearer.slice(7));
    if (authError || !auth.user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    const { session_id: sessionId } = await request.json();
    if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) return NextResponse.json({ error: "Invalid checkout session" }, { status: 400 });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status !== "complete" || session.mode !== "subscription" || session.metadata?.user_id !== auth.user.id || !session.subscription) {
      return NextResponse.json({ error: "Checkout is not complete for this account" }, { status: 409 });
    }
    const subscription = await stripe.subscriptions.retrieve(typeof session.subscription === "string" ? session.subscription : session.subscription.id);
    if (subscription.metadata.user_id !== auth.user.id) return NextResponse.json({ error: "Subscription owner mismatch" }, { status: 403 });
    const { error } = await admin.from("subscriptions").upsert({
      user_id: auth.user.id,
      stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      stripe_subscription_id: subscription.id,
      stripe_price_id: subscription.items.data[0]?.price.id || null,
      status: subscription.status,
      current_period_end: subscription.items.data[0]?.current_period_end ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString() : null,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Checkout sync failed", error);
    return NextResponse.json({ error: "Unable to finish subscription setup" }, { status: 500 });
  }
}
