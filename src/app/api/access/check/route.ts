import { NextResponse } from "next/server";
import { billingAction, hasSubscriptionAccess } from "@/lib/subscription-status";
import { billingAdmin, getBillingUser, isMissingStripeResource, readLifecycle, readSubscription, stripe, syncSubscription } from "@/lib/server/billing";

export async function POST(request: Request) {
  try {
    const user = await getBillingUser(request);
    if (!user) return NextResponse.json({ allowed: false }, { status: 401 });

    let subscription = await readSubscription(user.id);
    if (hasSubscriptionAccess(subscription)) return NextResponse.json({ allowed: true });

    // Keep company member access independent of the member's own subscription.
    const { data: membership, error } = await billingAdmin.from("company_members")
      .select("role").eq("user_id", user.id).neq("role", "owner").limit(1).maybeSingle();
    if (error) throw error;
    if (membership) return NextResponse.json({ allowed: true });

    if (subscription?.stripe_subscription_id &&
        (subscription.status === "trialing" || subscription.status === "incomplete" ||
         subscription.status === "past_due" || subscription.status === "unpaid" || subscription.status === "paused")) {
      const customerId = subscription.stripe_customer_id;
      let deletedCustomerId: string | undefined;
      if (customerId) {
        try {
          if ((await stripe.customers.retrieve(customerId)).deleted) deletedCustomerId = customerId;
        } catch (error) {
          if (!isMissingStripeResource(error)) throw error;
          deletedCustomerId = customerId;
        }
      }
      await syncSubscription(user.id, subscription.stripe_subscription_id, undefined, deletedCustomerId);
      subscription = await readSubscription(user.id);
      if (hasSubscriptionAccess(subscription)) return NextResponse.json({ allowed: true });
    }

    const lifecycle = await readLifecycle(user.id);
    return NextResponse.json({
      allowed: false,
      action: billingAction(subscription, lifecycle?.intro_used ?? false),
    });
  } catch (error) {
    console.error("Access check failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ allowed: false }, { status: 500 });
  }
}
