import { NextResponse } from "next/server";
import { billingAdmin as supabaseAdmin, getBillingUser } from "@/lib/server/billing";

export async function POST(req: Request) {
  try {
    const user = await getBillingUser(req);
    if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });

    const { email, companyId } = await req.json();

    if (typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    const ownedCompanies = supabaseAdmin.from("companies").select("id").eq("owner_id", user.id);
    if (typeof companyId === "string" && companyId) ownedCompanies.eq("id", companyId);
    const { data: company, error: ownerError } = await ownedCompanies.order("created_at").limit(1).maybeSingle();
    if (ownerError) throw ownerError;

    if (!company) {
      return NextResponse.json(
        { error: "Owner not associated with a company." },
        { status: 400 }
      );
    }

    const { data: users, error: userLookupError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (userLookupError) {
      return NextResponse.json(
        { error: "Error looking up users." },
        { status: 500 }
      );
    }

    const matchedUser = users.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!matchedUser) {
      return NextResponse.json(
        { error: "User not found. They must create a free account first." },
        { status: 404 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from("company_members")
      .select("id")
      .eq("company_id", company.id)
      .eq("user_id", matchedUser.id)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "User is already added to this company." },
        { status: 400 }
      );
    }

    const { data: existingBookkeepers } = await supabaseAdmin
      .from("company_members")
      .select("id")
      .eq("company_id", company.id)
      .eq("role", "bookkeeper");

    if ((existingBookkeepers?.length || 0) >= 1) {
      return NextResponse.json(
        { error: "You already have a bookkeeper. Limit is 1 for now." },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabaseAdmin
      .from("company_members")
      .insert({
        company_id: company.id,
        user_id: matchedUser.id,
        role: "bookkeeper",
      });

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Bookkeeper added successfully.",
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
