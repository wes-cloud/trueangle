import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const billingAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { timeout: 20_000 });

export function assertIsolatedBillingPreview() {
  if (process.env.VERCEL_ENV !== "preview") return;
  if (!/^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY ?? "") ||
      !process.env.BILLING_SANDBOX_SUPABASE_URL ||
      process.env.BILLING_SANDBOX_SUPABASE_URL !== process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Billing preview requires Stripe test credentials and an isolated Supabase project");
  }
}

export async function getBillingUser(request: Request) {
  assertIsolatedBillingPreview();
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return null;
  const { data, error } = await billingAdmin.auth.getUser(token);
  return error ? null : data.user;
}

export type CheckoutAttempt = {
  id: string;
  customerId: string | null;
  sessionId: string | null;
  email: string;
  trial: boolean;
  price: string;
  site: string;
  expiresAt: number;
};

export type Lifecycle = {
  intro_used: boolean;
  legacy_unverified: boolean;
  revision: number;
  checkout: CheckoutAttempt | null;
};

export async function readLifecycle(userId: string): Promise<Lifecycle | null> {
  const { data, error } = await billingAdmin.from("subscription_lifecycle")
    .select("intro_used, legacy_unverified, revision, checkout").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function ensureLifecycle(userId: string) {
  const { error } = await billingAdmin.from("subscription_lifecycle")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function readSubscription(userId: string) {
  const { data, error } = await billingAdmin.from("subscriptions")
    .select("status, trial_end, stripe_customer_id, stripe_subscription_id")
    .eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export type SubscriptionRecord = NonNullable<Awaited<ReturnType<typeof readSubscription>>>;

export async function findLinkedSubscriptionUser(subscriptionId: string) {
  const { data, error } = await billingAdmin.from("subscriptions")
    .select("user_id").eq("stripe_subscription_id", subscriptionId).maybeSingle();
  if (error) throw error;
  return data?.user_id as string | undefined;
}

export async function requireSubscriptionOwner(userId: string, subscription: Stripe.Subscription) {
  const owner = subscription.metadata?.user_id ?? await findLinkedSubscriptionUser(subscription.id);
  if (owner !== userId) throw new Error("Stripe subscription ownership mismatch");
}

export function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id;
}

export function isMissingStripeResource(error: unknown) {
  return error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing";
}

export async function syncSubscription(
  userId: string,
  subscriptionId: string,
  deletedSnapshot?: Stripe.Subscription,
  deletedCustomerId?: string,
  checkoutAttemptId?: string
) {
  // A webhook may be retried after the TrueAngle account has been deleted.
  const { data, error } = await billingAdmin.auth.admin.getUserById(userId);
  if (error?.status === 404) return;
  if (error) throw error;
  if (!data.user) return;

  await ensureLifecycle(userId);

  for (let attempt = 0; attempt < 6; attempt++) {
    const lifecycle = await readLifecycle(userId);
    if (!lifecycle) return;
    let subscription: Stripe.Subscription | undefined;
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      if (!isMissingStripeResource(error)) throw error;
      if (!deletedSnapshot && !deletedCustomerId) throw error;
      subscription = deletedSnapshot;
    }
    if (subscription) await requireSubscriptionOwner(userId, subscription);

    const item = subscription?.items.data[0];
    const { data: saved, error: syncError } = await billingAdmin.rpc("sync_stripe_subscription", {
      p_user_id: userId,
      p_revision: lifecycle.revision,
      p_checkout_id: subscription?.metadata?.checkout_attempt ?? checkoutAttemptId ?? null,
      p_subscription_id: subscriptionId,
      p_customer_id: stripeId(subscription?.customer) ?? deletedCustomerId,
      p_price_id: item?.price.id ?? null,
      p_status: deletedCustomerId ? "canceled" : subscription?.status,
      p_period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
      p_trial_end: subscription?.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    });
    if (syncError) throw syncError;
    if (saved) return;
    // Another writer committed after our read. Fetch Stripe again before writing.
  }
  throw new Error("Subscription changed while synchronizing");
}
