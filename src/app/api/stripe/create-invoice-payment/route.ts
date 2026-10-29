import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RequestBody = {
  invoiceId: string;
  amount: number;
  paymentType?: "deposit" | "balance" | "custom";
};

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://trueangle.app"
  );
}

async function authorizeInvoice(request: Request, invoiceId: string) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return false;
  const authClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user) return false;
  const { data: invoice } = await supabaseAdmin.from("invoices").select("user_id, company_id").eq("id", invoiceId).maybeSingle();
  if (!invoice) return false;
  if (invoice.user_id === user.id) return true;
  if (!invoice.company_id) return false;
  const { data: membership } = await supabaseAdmin.from("company_members").select("role").eq("company_id", invoice.company_id).eq("user_id", user.id).maybeSingle();
  return membership?.role === "owner" || membership?.role === "bookkeeper";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;

    const invoiceId = body.invoiceId;
    const amount = Number(body.amount);
    const paymentType = body.paymentType || "custom";

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Missing invoiceId." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount * 100)) {
      return NextResponse.json(
        { error: "Payment amount must be greater than 0." },
        { status: 400 }
      );
    }

    if (!(await authorizeInvoice(request, invoiceId))) {
      return NextResponse.json({ error: "Unauthorized invoice access." }, { status: 403 });
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

    const { data: existingPayments, error: paymentsError } = await supabaseAdmin
      .from("payments")
      .select("amount")
      .eq("invoice_id", invoiceId)
      .eq("user_id", invoice.user_id);

    if (paymentsError) {
      return NextResponse.json(
        { error: paymentsError.message },
        { status: 500 }
      );
    }

    const paidTotal = (existingPayments || []).reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0
    );

    const invoiceAmount = Number(invoice.amount || 0);
    const balanceDue = Math.max(invoiceAmount - paidTotal, 0);

    if (balanceDue <= 0) {
      return NextResponse.json(
        { error: "This invoice is already paid." },
        { status: 400 }
      );
    }

    if (amount > balanceDue) {
      return NextResponse.json(
        {
          error: `Payment amount cannot exceed balance due of ${balanceDue.toFixed(
            2
          )}.`,
        },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl();

    const metadata = {
      type: "invoice_payment",
      invoice_id: invoice.id,
      user_id: invoice.user_id,
      payment_type: paymentType,
    };

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
            unit_amount: Math.round(amount * 100),
            product_data: {
              name:
                invoice.invoice_number ||
                invoice.title ||
                "TrueAngle Invoice Payment",
              description:
                paymentType === "deposit"
                  ? "Invoice deposit payment"
                  : paymentType === "balance"
                    ? "Invoice balance payment"
                    : "Invoice payment",
            },
          },
        },
      ],
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const error = err as Error;

    return NextResponse.json(
      { error: error.message || "Unable to create payment link." },
      { status: 500 }
    );
  }
}