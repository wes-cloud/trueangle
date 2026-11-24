import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { isTerminalSubscription } from "@/lib/subscription-status";
import {
  billingAdmin, ensureLifecycle, isMissingStripeResource, readLifecycle,
  readSubscription, stripe, stripeId, syncSubscription, type CheckoutAttempt, type Lifecycle,
} from "./billing";

type CheckoutIntent = "trial" | "reactivate";
type CheckoutResult = { url: string } | { error: string };

async function storeCheckout(userId: string, lifecycle: Lifecycle, checkout: CheckoutAttempt) {
  const update = billingAdmin.from("subscription_lifecycle")
    .update({ checkout, revision: lifecycle.revision + 1 })
    .eq("user_id", userId).eq("revision", lifecycle.revision);
  const { data, error } = await update.select("intro_used, revision, checkout").maybeSingle();
  if (error) throw error;
  return data as Lifecycle | null;
}

async function usableCustomer(customerId: string | null | undefined) {
  if (!customerId) return null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer.deleted ? null : customer.id;
  } catch (error) {
    if (isMissingStripeResource(error)) return null;
    throw error;
  }
}

async function findSession(attempt: CheckoutAttempt) {
  if (attempt.sessionId) return stripe.checkout.sessions.retrieve(attempt.sessionId);
  if (!attempt.customerId) return null;

  // Recover a Stripe response lost before the ID could be stored in Supabase.
  for await (const session of stripe.checkout.sessions.list({
    customer: attempt.customerId,
    created: { gte: attempt.expiresAt - 3605 },
    limit: 100,
  })) {
    if (session.metadata?.checkout_attempt === attempt.id) return session;
  }
  return null;
}

async function currentStripeSubscription(userId: string, id: string, customerId: string | null, status: string) {
  const customer = await usableCustomer(customerId);
  if (!customer && customerId) {
    if (!isTerminalSubscription(status)) await syncSubscription(userId, id, undefined, customerId);
    return { terminal: true, customer: null };
  }
  const subscription = await stripe.subscriptions.retrieve(id);
  if (subscription.metadata.user_id !== userId) throw new Error("Stripe subscription ownership mismatch");
  return { terminal: isTerminalSubscription(subscription.status), customer };
}

export async function openCheckout(userId: string, email: string, intent: CheckoutIntent): Promise<CheckoutResult> {
  await ensureLifecycle(userId);
  for (let retry = 0; retry < 8; retry++) {
    let lifecycle = await readLifecycle(userId);
    if (!lifecycle) throw new Error("Missing subscription lifecycle");
    const current = await readSubscription(userId);
    let customerId: string | null = null;
    let introUsed = lifecycle.intro_used || !!current?.trial_end ||
      !!(current && current.status !== "inactive");

    if (current?.stripe_subscription_id) {
      introUsed = true;
      const existing = await currentStripeSubscription(userId, current.stripe_subscription_id, current.stripe_customer_id, current.status);
      if (!existing.terminal) return { error: "There is already a subscription for this account. Return to the dashboard for billing options." };
      customerId = existing.customer;
    } else if (!lifecycle.checkout) {
      // Legacy subscriptions may predate the local ledger. Stripe Search is
      // supplemental here, never the concurrency guard for new Checkout.
      const historical = await stripe.subscriptions.search({
        query: `metadata['user_id']:'${userId}'`,
        limit: 100,
      });
      const existing = historical.data.find(subscription => !isTerminalSubscription(subscription.status)) ??
        historical.data[0];
      if (existing) {
        await syncSubscription(userId, existing.id);
        continue;
      }
    }

    let attempt = lifecycle.checkout;
    if (attempt) {
      const session = await findSession(attempt);
      const now = Math.floor(Date.now() / 1000);
      if (session?.status === "complete") {
        const id = stripeId(session.subscription);
        if (!id) return { error: "Your payment is processing. Check the dashboard again shortly." };
        if (id !== current?.stripe_subscription_id) {
          const deletedCustomer = await usableCustomer(attempt.customerId) ? undefined : attempt.customerId ?? undefined;
          await syncSubscription(userId, id, undefined, deletedCustomer, attempt.id);
          continue;
        }
        introUsed = true;
      } else if (session?.status === "open") {
        if (now >= attempt.expiresAt) return { error: "Checkout is expiring. Please try again in a moment." };
        if (!session.url) throw new Error("Open Stripe Checkout session has no URL");
        if (intent !== (attempt.trial ? "trial" : "reactivate") || (attempt.trial && introUsed)) {
          return { error: "Your billing options changed. Return to the dashboard to continue." };
        }
        return { url: session.url };
      } else if (!session && now < attempt.expiresAt) {
        if (intent !== (attempt.trial ? "trial" : "reactivate") || (attempt.trial && introUsed)) {
          return { error: "Your billing options changed. Return to the dashboard to continue." };
        }
        if (now >= attempt.expiresAt - 1860) {
          return { error: "Checkout is still being reconciled. Please try again later." };
        }
      }

      if (session?.status === "expired" || session?.status === "complete" || now >= attempt.expiresAt) {
        customerId ??= await usableCustomer(attempt.customerId);
        attempt = null;
      }
    }

    if (!attempt) {
      const trial = !introUsed;
      if (intent !== (trial ? "trial" : "reactivate")) {
        return { error: "Your billing options changed. Return to the dashboard to continue." };
      }
      if (customerId) {
        for await (const subscription of stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 })) {
          if (!isTerminalSubscription(subscription.status)) {
            return { error: "There is already a subscription for this billing account. Contact support for help." };
          }
        }
      }
      const price = await stripe.prices.retrieve(process.env.STRIPE_PRICE_ID!);
      if (!price.active || price.currency !== "usd" || price.unit_amount !== 2900 ||
          price.recurring?.interval !== "month" || price.recurring.interval_count !== 1 ||
          price.recurring.usage_type !== "licensed") {
        throw new Error("Expected the active USD 29 monthly Stripe Price");
      }
      attempt = {
        id: randomUUID(), customerId, sessionId: null, email, trial, price: price.id,
        site: new URL(process.env.NEXT_PUBLIC_SITE_URL!).origin,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      };
      const reserved = await storeCheckout(userId, lifecycle, attempt);
      if (!reserved) continue;
      lifecycle = reserved;
    }

    if (!attempt.customerId) {
      const customer = await stripe.customers.create(
        { email: attempt.email, metadata: { user_id: userId } },
        { idempotencyKey: `trueangle-customer-${attempt.id}` }
      );
      attempt = { ...attempt, customerId: customer.id };
      const saved = await storeCheckout(userId, lifecycle, attempt);
      if (!saved) continue;
      lifecycle = saved;
    }

    if (Math.floor(Date.now() / 1000) >= attempt.expiresAt - 1860) continue;
    const metadata = { user_id: userId, checkout_attempt: attempt.id };
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      integration_identifier: "trueangle-billing-kdwyfvht",
      customer: attempt.customerId!,
      expires_at: attempt.expiresAt,
      line_items: [{ price: attempt.price, quantity: 1 }],
      payment_method_collection: "always",
      subscription_data: { metadata, ...(attempt.trial ? { trial_period_days: 14 } : {}) },
      metadata,
      ...(attempt.trial ? { allow_promotion_codes: true } : {}),
      success_url: `${attempt.site}/trial-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${attempt.site}/dashboard`,
    };
    try {
      const session = await stripe.checkout.sessions.create(params, {
        idempotencyKey: `trueangle-checkout-${attempt.id}`,
      });
      if (session.status !== "open" || !session.url) continue;
      const saved = await storeCheckout(userId, lifecycle, { ...attempt, sessionId: session.id });
      if (saved) return { url: session.url };
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "idempotency_key_in_use") {
        return { error: "Checkout is already opening. Please try again in a moment." };
      }
      throw error;
    }
  }
  return { error: "Your billing status is being updated. Please try again in a moment." };
}
