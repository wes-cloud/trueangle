import { NextResponse } from "next/server";
import { billingAdmin as supabaseAdmin, getBillingUser } from "@/lib/server/billing";
import crypto from "crypto";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

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

    const ownedCompanies = supabaseAdmin.from("companies").select("id, name").eq("owner_id", user.id);
    if (typeof companyId === "string" && companyId) ownedCompanies.eq("id", companyId);
    const { data: company, error: ownerError } = await ownedCompanies.order("created_at").limit(1).maybeSingle();
    if (ownerError) throw ownerError;

    if (!company) {
      return NextResponse.json(
        { error: "Only company owners can send invites." },
        { status: 403 }
      );
    }

    const companyName = company.name || "a contractor";

    const inviteToken = crypto.randomBytes(32).toString("hex");
    const cleanedEmail = email.trim().toLowerCase();

    const { error: inviteError } = await supabaseAdmin
      .from("company_invites")
      .insert({
        company_id: company.id,
        email: cleanedEmail,
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

    const { error: emailError } = await resend.emails.send({
      from: "TrueAngle <noreply@trueangle.app>",
      to: cleanedEmail,
      subject: `${companyName} invited you to TrueAngle`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a;">
          <h1 style="font-size: 28px; margin-bottom: 12px;">You've been invited to TrueAngle</h1>

          <p style="font-size: 16px; line-height: 1.5;">
            ${companyName} invited you to help with their contractor bookkeeping inside TrueAngle.
          </p>

          <p style="font-size: 16px; line-height: 1.5;">
            Your bookkeeper account is free. You’ll be able to help review expenses,
            reports, bank transactions, and bookkeeping workflow without needing your own paid subscription.
          </p>

          <div style="margin: 28px 0;">
            <a
              href="${inviteUrl}"
              style="background: #020617; color: white; padding: 14px 20px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;"
            >
              Accept Invite
            </a>
          </div>

          <p style="font-size: 14px; color: #475569;">
            If the button doesn’t work, copy and paste this link into your browser:
          </p>

          <p style="font-size: 14px; word-break: break-all; color: #475569;">
            ${inviteUrl}
          </p>

          <p style="font-size: 14px; color: #64748b; margin-top: 28px;">
            If you weren’t expecting this invite, you can ignore this email.
          </p>
        </div>
      `,
    });

    if (emailError) {
      return NextResponse.json(
        {
          error: emailError.message,
          inviteUrl,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      inviteUrl,
      message: "Invite email sent successfully.",
    });
  } catch (err) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
