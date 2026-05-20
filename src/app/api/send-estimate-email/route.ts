import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      customerEmail,
      customerName,
      estimateNumber,
      projectName,
      approvalUrl,
      total,
      companyName,
    } = body;

    if (!customerEmail) {
      return NextResponse.json(
        { error: "Missing customer email." },
        { status: 400 }
      );
    }

    if (!approvalUrl) {
      return NextResponse.json(
        { error: "Missing approval link." },
        { status: 400 }
      );
    }

    const formattedTotal =
      typeof total === "number" ? formatCurrency(total) : total || "See estimate";

    const result = await resend.emails.send({
      from: "TrueAngle <estimates@trueangle.app>",
      to: [customerEmail],
      subject: `Estimate ${estimateNumber || ""} from ${
        companyName || "your contractor"
      }`,
      html: `
        <div style="font-family: Arial, sans-serif; background: #f1f5f9; padding: 32px;">
          <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden;">
            <div style="background: #020617; padding: 28px; color: white;">
              <p style="margin: 0; color: #f97316; font-weight: bold; letter-spacing: 2px; font-size: 12px;">
                TRUEANGLE ESTIMATE
              </p>
              <h1 style="margin: 8px 0 0; font-size: 28px;">
                Your estimate is ready
              </h1>
            </div>

            <div style="padding: 28px; color: #0f172a;">
              <p>Hi ${customerName || "there"},</p>

              <p>
                ${companyName || "Your contractor"} sent you an estimate${
                  projectName ? ` for <strong>${projectName}</strong>` : ""
                }.
              </p>

              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin: 24px 0;">
                <p style="margin: 0;"><strong>Estimate #:</strong> ${
                  estimateNumber || "—"
                }</p>
                <p style="margin: 10px 0 0;"><strong>Total:</strong> ${formattedTotal}</p>
              </div>

              <a href="${approvalUrl}" style="display: inline-block; background: #ea580c; color: white; text-decoration: none; padding: 14px 22px; border-radius: 12px; font-weight: bold;">
                Review & Approve Estimate
              </a>

              <p style="margin-top: 28px; color: #64748b; font-size: 13px;">
                If the button does not work, copy and paste this link into your browser:
              </p>

              <p style="word-break: break-all; color: #2563eb; font-size: 13px;">
                ${approvalUrl}
              </p>
            </div>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("send-estimate-email error", error);

    return NextResponse.json(
      { error: error?.message || "Unable to send estimate email." },
      { status: 500 }
    );
  }
}