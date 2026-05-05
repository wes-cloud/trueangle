import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ allowed: false });
    }

    const { data: ownSubscription } = await supabaseAdmin
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();

    if (
      ownSubscription?.status === "trialing" ||
      ownSubscription?.status === "active"
    ) {
      return NextResponse.json({ allowed: true, role: "owner" });
    }

    const { data: memberships } = await supabaseAdmin
      .from("company_members")
      .select("company_id, role")
      .eq("user_id", userId)
      .limit(1);

    const membership = memberships?.[0];

    if (!membership?.company_id) {
      return NextResponse.json({ allowed: false });
    }

    const { data: owners } = await supabaseAdmin
      .from("company_members")
      .select("user_id")
      .eq("company_id", membership.company_id)
      .eq("role", "owner")
      .limit(1);

    const ownerUserId = owners?.[0]?.user_id;

    if (!ownerUserId) {
      return NextResponse.json({ allowed: false });
    }

    const { data: ownerSubscription } = await supabaseAdmin
      .from("subscriptions")
      .select("status")
      .eq("user_id", ownerUserId)
      .maybeSingle();

    const allowed =
      ownerSubscription?.status === "trialing" ||
      ownerSubscription?.status === "active";

    return NextResponse.json({
      allowed,
      role: membership.role,
      companyId: membership.company_id,
    });
  } catch (error) {
    console.error("Access check error:", error);
    return NextResponse.json({ allowed: false }, { status: 500 });
  }
}