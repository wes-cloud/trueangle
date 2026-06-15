import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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

    const { data: ownerMemberships } = await supabaseAdmin
      .from("company_members")
      .select("company_id, role")
      .eq("user_id", ownerUserId)
      .eq("role", "owner")
      .limit(1);

    const ownerMembership = ownerMemberships?.[0];

    if (!ownerMembership?.company_id) {
      return NextResponse.json(
        { error: "Only company owners can send invites." },
        { status: 403 }
      );
    }

    const inviteToken = crypto.randomBytes(32).toString("hex");

    const { error: inviteError } = await supabaseAdmin
      .from("company_invites")
      .insert({
        company_id: ownerMembership.company_id,
        email: email.trim().toLowerCase(),
        role: "bookkeeper",
        invite_token: inviteToken,
        status: "pending",
      });

    if (inviteError) {
      return NextResponse.json(
        { error: inviteError.message },
        { status: 500 }
      );
    }

    const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/invite/${inviteToken}`;

    return NextResponse.json({
      success: true,
      inviteUrl,
      message: "Invite created successfully.",
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}