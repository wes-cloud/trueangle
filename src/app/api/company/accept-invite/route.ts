import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { inviteToken, email, userId } = await req.json();

    if (!inviteToken || !email || !userId) {
      return NextResponse.json(
        { error: "Missing invite token, email, or user ID." },
        { status: 400 }
      );
    }

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("company_invites")
      .select("id, company_id, email, role, status")
      .eq("invite_token", inviteToken)
      .maybeSingle();

    if (inviteError || !invite) {
      return NextResponse.json(
        { error: "Invite not found." },
        { status: 404 }
      );
    }

    if (invite.status !== "pending") {
      return NextResponse.json(
        { error: "Invite has already been used." },
        { status: 400 }
      );
    }

    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: "Invite email does not match this account." },
        { status: 403 }
      );
    }

    const { data: existingMemberships } = await supabaseAdmin
      .from("company_members")
      .select("id")
      .eq("company_id", invite.company_id)
      .eq("user_id", userId)
      .limit(1);

    if (!existingMemberships || existingMemberships.length === 0) {
      const { error: memberError } = await supabaseAdmin
        .from("company_members")
        .insert({
          company_id: invite.company_id,
          user_id: userId,
          role: invite.role || "bookkeeper",
        });

      if (memberError) {
        return NextResponse.json(
          { error: memberError.message },
          { status: 500 }
        );
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("company_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invite.id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Invite accepted.",
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}