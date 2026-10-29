import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Subscription = {
  status: string | null;
  trial_end: string | null;
  current_period_end: string | null;
};

function accessFor(subscription: Subscription | null) {
  if (!subscription) return { allowed: false, reason: "no_subscription" };
  if (subscription.status === "active") {
    return { allowed: true, reason: "active" };
  }
  if (subscription.status === "trialing") {
    const end = subscription.trial_end ? Date.parse(subscription.trial_end) : NaN;
    if (Number.isFinite(end) && end > Date.now()) {
      return {
        allowed: true,
        reason: "trialing",
        trialEnd: subscription.trial_end,
        daysRemaining: Math.ceil((end - Date.now()) / 86400000),
      };
    }
    return { allowed: false, reason: "trial_expired", trialEnd: subscription.trial_end };
  }
  return { allowed: false, reason: "subscription_inactive" };
}

export async function POST(req: Request) {
  try {
    const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return NextResponse.json({ allowed: false, error: "Unauthorized" }, { status: 401 });

    const authClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ allowed: false, error: "Unauthorized" }, { status: 401 });
    }

    // Explicit, server-only developer allowlist. Never trust a userId in request JSON.
    const developerIds = (process.env.TRUEANGLE_DEVELOPER_USER_IDS || "")
      .split(",").map((id) => id.trim()).filter(Boolean);
    if (developerIds.includes(user.id)) {
      return NextResponse.json({ allowed: true, reason: "developer" });
    }

    const { data: ownSubscription, error: ownError } = await supabaseAdmin
      .from("subscriptions")
      .select("status, trial_end, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();
    if (ownError) throw ownError;

    const ownAccess = accessFor(ownSubscription);
    if (ownAccess.allowed) return NextResponse.json({ ...ownAccess, role: "owner" });

    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from("company_members")
      .select("company_id, role")
      .eq("user_id", user.id);
    if (membershipError) throw membershipError;

    // Bookkeepers retain free access to their assigned company.
    const bookkeeper = memberships?.find((m) => m.role === "bookkeeper");
    if (bookkeeper) {
      return NextResponse.json({ allowed: true, reason: "bookkeeper", role: "bookkeeper", companyId: bookkeeper.company_id });
    }

    const ownerCompanyIds = (memberships || []).filter((m) => m.role === "owner").map((m) => m.company_id);
    if (ownerCompanyIds.length) {
      const { data: owners, error: ownersError } = await supabaseAdmin
        .from("company_members").select("user_id, company_id")
        .in("company_id", ownerCompanyIds).eq("role", "owner");
      if (ownersError) throw ownersError;
      for (const owner of owners || []) {
        if (owner.user_id === user.id) continue;
        const { data: subscription, error } = await supabaseAdmin
          .from("subscriptions").select("status, trial_end, current_period_end")
          .eq("user_id", owner.user_id).maybeSingle();
        if (error) throw error;
        const access = accessFor(subscription);
        if (access.allowed) {
          return NextResponse.json({ ...access, role: "owner", companyId: owner.company_id });
        }
      }
    }
    return NextResponse.json(ownAccess);
  } catch (error) {
    console.error("Access check error:", error);
    return NextResponse.json({ allowed: false, error: "Access check failed" }, { status: 500 });
  }
}
