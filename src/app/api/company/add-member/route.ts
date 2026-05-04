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
        { error: "Missing email or owner user ID" },
        { status: 400 }
      );
    }

    // 1. Find owner’s company
    const { data: ownerMembership, error: ownerError } =
      await supabaseAdmin
        .from("company_members")
        .select("company_id, role")
        .eq("user_id", ownerUserId)
        .maybeSingle();

    if (ownerError || !ownerMembership?.company_id) {
      return NextResponse.json(
        { error: "Owner not associated with a company" },
        { status: 400 }
      );
    }

    if (ownerMembership.role !== "owner") {
      return NextResponse.json(
        { error: "Only owners can add users" },
        { status: 403 }
      );
    }

    // 2. Find user by email
    const { data: users, error: userLookupError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (userLookupError) {
      return NextResponse.json(
        { error: "Error looking up users" },
        { status: 500 }
      );
    }

    const matchedUser = users.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (!matchedUser) {
      return NextResponse.json(
        { error: "User not found. They must sign up first." },
        { status: 404 }
      );
    }

    // 3. Check if already in company
    const { data: existing } = await supabaseAdmin
      .from("company_members")
      .select("id")
      .eq("company_id", ownerMembership.company_id)
      .eq("user_id", matchedUser.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "User already added to company" },
        { status: 400 }
      );
    }

    // 4. Enforce 1 bookkeeper max (for now)
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

    // 5. Insert new bookkeeper
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
      message: "Bookkeeper added successfully",
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}