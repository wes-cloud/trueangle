import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://trueangle.app"
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { invoiceId, amount, paymentType } = body;

    if (!invoiceId) {
      return NextResponse.json({ error: "Missing invoice ID." }, { status: 400 });
    }

    const paymentAmount = Number(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      return NextResponse.json(
        { error: "Payment amount must be greater than 0." },
        { status: 400 }
      );
    }

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select(
        "id, user_id, customer_id, invoice_number, title, description, amount, status"
      )
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: invoiceError?.message || "Invoice not found." },
        { status: 404 }
      );
    }

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("full_name, email")
      .eq("id", invoice.customer_id)
      .maybeSingle();

    const customerEmail = customer?.email;

    if (!customerEmail) {
      return NextResponse.json(
        { error: "This customer does not have an email address saved." },
        { status: 400 }
      );
    }

    const metadata = {
      type: "invoice_payment",
      invoice_id: invoice.id,
      user_id: invoice.user_id,
      payment_type: paymentType || "deposit",
    };

    const baseUrl = getBaseUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      success_url: `${baseUrl}/invoices?invoice_id=${invoice.id}&payment=success`,
      cancel_url: `${baseUrl}/invoices?invoice_id=${invoice.id}&payment=cancelled`,
      client_reference_id: invoice.id,
      metadata,
      payment_intent_data: {
        metadata,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(paymentAmount * 100),
            product_data: {
              name: `Deposit for Invoice ${invoice.invoice_number || ""}`,
              description: invoice.title || "Invoice deposit payment",
            },
          },
        },
      ],
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a payment URL." },
        { status: 500 }
      );
    }

    const formattedAmount = formatCurrency(paymentAmount);
    const formattedTotal = formatCurrency(Number(invoice.amount || 0));
const isDeposit = paymentType === "deposit";
const requestLabel = isDeposit ? "Deposit" : "Payment";
const heading = isDeposit ? "Deposit requested" : "Payment requested";
const bodyText = isDeposit
  ? "A deposit payment has been requested for your invoice."
  : "A payment has been requested for your invoice.";
const buttonText = isDeposit ? "Pay Deposit" : "Pay Invoice";

    await resend.emails.send({
      from: "TrueAngle <estimates@trueangle.app>",
      to: [customerEmail],
      subject: `${requestLabel} request for Invoice ${invoice.invoice_number || ""}`,
      html: `
        <div style="font-family: Arial, sans-serif; background: #f1f5f9; padding: 32px;">
          <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 18px; overflow: hidden;">
            <div style="background: #020617; padding: 28px; color: white;">
              <p style="margin: 0; color: #f97316; font-weight: bold; letter-spacing: 2px; font-size: 12px;">
                TRUEANGLE PAYMENT REQUEST
              </p>
              <h1 style="margin: 8px 0 0; font-size: 28px;">
                ${heading}
              </h1>
            </div>

            <div style="padding: 28px; color: #0f172a;">
              <p>Hi ${customer.full_name || "there"},</p>

              <p>
                ${bodyText}
              </p>

              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin: 24px 0;">
                <p style="margin: 0;"><strong>Invoice #:</strong> ${
                  invoice.invoice_number || "—"
                }</p>
                <p style="margin: 10px 0 0;"><strong>Invoice Total:</strong> ${formattedTotal}</p>
                <p style="margin: 10px 0 0;"><strong>${requestLabel} Requested:</strong> ${formattedAmount}</p>
              </div>

              <a href="${session.url}" style="display: inline-block; background: #ea580c; color: white; text-decoration: none; padding: 14px 22px; border-radius: 12px; font-weight: bold;">
                ${buttonText}
              </a>

              <p style="margin-top: 28px; color: #64748b; font-size: 13px;">
                If the button does not work, copy and paste this link into your browser:
              </p>

              <p style="word-break: break-all; color: #2563eb; font-size: 13px;">
                ${session.url}
              </p>
            </div>
          </div>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      paymentUrl: session.url,
    });
  } catch (error: any) {
    console.error("send-invoice-deposit-email error", error);

    return NextResponse.json(
      { error: error?.message || "Unable to send deposit request." },
      { status: 500 }
    );
  }
}