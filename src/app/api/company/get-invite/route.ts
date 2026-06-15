import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { inviteToken } = await req.json();

    if (!inviteToken) {
      return NextResponse.json(
        { error: "Missing invite token." },
        { status: 400 }
      );
    }

    const { data: invite, error } = await supabaseAdmin
      .from("company_invites")
      .select("email, status")
      .eq("invite_token", inviteToken)
      .maybeSingle();

    if (error || !invite) {
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

    return NextResponse.json({
      success: true,
      email: invite.email,
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}