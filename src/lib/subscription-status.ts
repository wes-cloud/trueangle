export type BillingAction = "trial" | "reactivate" | "recover" | "pending";

export function hasSubscriptionAccess(
  subscription: { status: string; trial_end: string | null } | null
) {
  return subscription?.status === "active" || (
    subscription?.status === "trialing" &&
    (!subscription.trial_end || Date.parse(subscription.trial_end) > Date.now())
  );
}

export function isTerminalSubscription(status: string) {
  return ["canceled", "incomplete_expired", "inactive"].includes(status);
}

export function billingAction(
  subscription: { status: string; stripe_subscription_id: string | null; trial_end: string | null } | null,
  introUsed: boolean
): BillingAction {
  if (subscription?.status === "trialing" && !hasSubscriptionAccess(subscription)) {
    return "pending";
  }
  if (subscription && ["past_due", "unpaid", "incomplete", "paused"].includes(subscription.status)) {
    return "recover";
  }
  return introUsed || subscription?.stripe_subscription_id || subscription?.trial_end ||
    (subscription && subscription.status !== "inactive") ? "reactivate" : "trial";
}
