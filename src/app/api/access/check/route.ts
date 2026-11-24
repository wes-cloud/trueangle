import { NextResponse } from "next/server";
import { billingAction, hasSubscriptionAccess } from "@/lib/subscription-status";
import { getBillingUser, readLifecycle, readSubscription } from "@/lib/server/billing";
import { getEligibleCompanyMemberships, refreshSubscription } from "@/lib/server/company-access";

export async function POST(request: Request) {
  try {
    const user = await getBillingUser(request);
    if (!user) return NextResponse.json({ allowed: false }, { status: 401 });

    let subscription = await readSubscription(user.id);
    if (hasSubscriptionAccess(subscription)) return NextResponse.json({ allowed: true });

    const companies = await getEligibleCompanyMemberships(user.id);
    if (companies.length) return NextResponse.json({ allowed: true });

    subscription = await refreshSubscription(user.id);
    if (hasSubscriptionAccess(subscription)) return NextResponse.json({ allowed: true });

    const lifecycle = await readLifecycle(user.id);
    return NextResponse.json({
      allowed: false,
      action: billingAction(subscription, lifecycle?.intro_used ?? false, lifecycle?.legacy_unverified),
    });
  } catch (error) {
    console.error("Access check failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ allowed: false }, { status: 500 });
  }
}
