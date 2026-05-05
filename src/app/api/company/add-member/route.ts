import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { email, ownerUserId } = await req.json();

    if (!email || !ownerUserId) {
      return NextResponse.json(
        { error: "Missing email or owner user ID." },
        { status: 400 }
      );
    }

    const { data: ownerMemberships, error: ownerError } = await supabaseAdmin
      .from("company_members")
      .select("company_id, role")
      .eq("user_id", ownerUserId)
      .eq("role", "owner")
      .limit(1);

    const ownerMembership = ownerMemberships?.[0];

    if (ownerError || !ownerMembership?.company_id) {
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
      .eq("company_id", ownerMembership.company_id)
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
      .eq("company_id", ownerMembership.company_id)
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
        company_id: ownerMembership.company_id,
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