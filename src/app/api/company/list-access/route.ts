import { NextResponse } from "next/server";
import { getBillingUser } from "@/lib/server/billing";
import { getEligibleCompanyMemberships } from "@/lib/server/company-access";

export async function POST(request: Request) {
  try {
    const user = await getBillingUser(request);
    if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
    return NextResponse.json({ companies: await getEligibleCompanyMemberships(user.id) });
  } catch (error) {
    console.error("Company access check failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Could not check company access." }, { status: 500 });
  }
}
