import { NextResponse } from "next/server";
import { getBillingUser, isMissingStripeResource, readSubscription, stripe } from "@/lib/server/billing";

export async function POST(request: Request) {
  try {
    const user = await getBillingUser(request);
    if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    const subscription = await readSubscription(user.id);
    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ error: "No billing account was found. Please contact support." }, { status: 404 });
    }

    const { recovery } = await request.json();
    const site = new URL(process.env.NEXT_PUBLIC_SITE_URL!).origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${site}/${recovery === true ? "dashboard" : "settings"}`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (isMissingStripeResource(error)) {
      return NextResponse.json({ error: "This billing account is unavailable. Refresh your dashboard for current options." }, { status: 409 });
    }
    console.error("Stripe portal failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Unable to open billing. Please try again or contact support." }, { status: 500 });
  }
}
