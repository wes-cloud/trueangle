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
      return NextResponse.json(
        { error: "Missing user ID." },
        { status: 400 }
      );
    }

    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from("company_members")
      .select("company_id, role")
      .eq("user_id", userId);

    if (membershipError) {
      return NextResponse.json(
        { error: membershipError.message },
        { status: 500 }
      );
    }

    const bookkeeperMemberships = (memberships || []).filter(
      (membership) => membership.role && membership.role !== "owner"
    );

    if (bookkeeperMemberships.length === 0) {
      return NextResponse.json({ companies: [] });
    }

    const uniqueMemberships = Array.from(
      new Map(
        bookkeeperMemberships.map((membership) => [
          membership.company_id,
          membership,
        ])
      ).values()
    );

    const companyIds = uniqueMemberships
      .map((membership) => membership.company_id)
      .filter(Boolean);

    const { data: companyRows, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, name")
      .in("id", companyIds);

    if (companyError) {
      return NextResponse.json(
        { error: companyError.message },
        { status: 500 }
      );
    }

    const companies = uniqueMemberships.map((membership) => {
      const matchingCompany = companyRows?.find(
        (company) => company.id === membership.company_id
      );

      return {
        company_id: membership.company_id,
        role: membership.role,
        name: matchingCompany?.name || "Unnamed Company",
      };
    });

    return NextResponse.json({ companies });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}