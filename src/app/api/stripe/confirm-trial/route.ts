import { NextResponse } from "next/server";
import { getBillingUser, stripe, stripeId, syncSubscription } from "@/lib/server/billing";

export async function POST(request: Request) {
  try {
    const user = await getBillingUser(request);
    if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    const { session_id: sessionId } = await request.json();
    if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
      return NextResponse.json({ error: "Invalid checkout session." }, { status: 400 });
    }
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const subscriptionId = stripeId(session.subscription);
    if (session.status !== "complete" || session.mode !== "subscription" ||
        session.metadata?.user_id !== user.id || !subscriptionId) {
      return NextResponse.json({ error: "Checkout is not complete for this account." }, { status: 409 });
    }
    await syncSubscription(user.id, subscriptionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Checkout sync failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Unable to finish subscription setup." }, { status: 500 });
  }
}
