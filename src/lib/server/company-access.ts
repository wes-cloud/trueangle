import { hasSubscriptionAccess } from "@/lib/subscription-status";
import {
  billingAdmin, isMissingStripeResource, readSubscription, stripe, syncSubscription,
} from "./billing";

const recoverableStatuses = new Set(["trialing", "incomplete", "past_due", "unpaid", "paused"]);

export async function refreshSubscription(userId: string) {
  const subscription = await readSubscription(userId);
  if (!subscription?.stripe_subscription_id || hasSubscriptionAccess(subscription) ||
      !recoverableStatuses.has(subscription.status)) return subscription;

  const customerId = subscription.stripe_customer_id;
  let deletedCustomerId: string | undefined;
  if (customerId) {
    try {
      if ((await stripe.customers.retrieve(customerId)).deleted) deletedCustomerId = customerId;
    } catch (error) {
      if (!isMissingStripeResource(error)) throw error;
      // A missing object can indicate a bad historical link or the wrong account.
      // Keep the local row for reconciliation when Stripe cannot confirm deletion.
    }
  }
  try {
    await syncSubscription(userId, subscription.stripe_subscription_id, undefined, deletedCustomerId);
  } catch (error) {
    if (!isMissingStripeResource(error)) throw error;
    console.warn("Could not reconcile a linked Stripe subscription");
    return subscription;
  }
  return readSubscription(userId);
}

export async function getEligibleCompanyMemberships(userId: string) {
  const { data: memberships, error } = await billingAdmin.from("company_members")
    .select("company_id, role").eq("user_id", userId).in("role", ["bookkeeper", "viewer"]);
  if (error) throw error;
  if (!memberships.length) return [];

  const { data: companies, error: companiesError } = await billingAdmin.from("companies")
    .select("id, name, owner_id").in("id", memberships.map(membership => membership.company_id));
  if (companiesError) throw companiesError;
  const owners = [...new Set(companies.map(company => company.owner_id as string))];
  const accessByOwner = new Map<string, boolean>();
  await Promise.all(owners.map(async ownerId => {
    try {
      accessByOwner.set(ownerId, hasSubscriptionAccess(await refreshSubscription(ownerId)));
    } catch (error) {
      console.error("Could not verify company entitlement", error instanceof Error ? error.name : "unknown");
    }
  }));

  return companies.filter(company => accessByOwner.get(company.owner_id)).map(company => ({
    company_id: company.id,
    name: company.name || "Unnamed Company",
    role: memberships.find(membership => membership.company_id === company.id)?.role,
  }));
}
