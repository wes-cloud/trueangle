import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { assertIsolatedBillingPreview, stripe, billingAdmin as supabaseAdmin, stripeId, syncSubscription } from "@/lib/server/billing";

async function updateInvoiceStatus(invoiceId: string, userId: string) {
  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from("invoices")
    .select("id, amount, status")
    .eq("id", invoiceId)
    .eq("user_id", userId)
    .single();

  if (invoiceError || !invoice) {
    throw new Error(invoiceError?.message || "Invoice not found.");
  }

  const { data: payments, error: paymentsError } = await supabaseAdmin
    .from("payments")
    .select("amount")
    .eq("invoice_id", invoiceId)
    .eq("user_id", userId);

  if (paymentsError) {
    throw new Error(paymentsError.message);
  }

  const totalPaid = (payments || []).reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  const invoiceAmount = Number(invoice.amount || 0);

  let nextStatus = "sent";

  if (totalPaid <= 0) {
    nextStatus = invoice.status === "draft" ? "draft" : "sent";
  } else if (totalPaid < invoiceAmount) {
    nextStatus = "partial";
  } else {
    nextStatus = "paid";
  }

  const { error: updateError } = await supabaseAdmin
    .from("invoices")
    .update({
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("user_id", userId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

async function saveInvoicePayment(session: Stripe.Checkout.Session) {
  if (session.mode !== "payment") return;

  const metadata = session.metadata || {};

  if (metadata.type !== "invoice_payment") return;

  if (session.payment_status !== "paid") {
    return;
  }

  const invoiceId = metadata.invoice_id;
  const userId = metadata.user_id;
  const paymentType = metadata.payment_type || "custom";

  if (!invoiceId || !userId) {
    throw new Error("Missing invoice payment metadata.");
  }

  const stripeCheckoutSessionId = session.id;
  const stripePaymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  const amountPaid = Number(session.amount_total || 0) / 100;

  if (!amountPaid || amountPaid <= 0) {
    throw new Error("Stripe session has no paid amount.");
  }

  const { data: existingPayment, error: existingError } = await supabaseAdmin
    .from("payments")
    .select("id")
    .eq("notes", `Stripe Checkout Session: ${stripeCheckoutSessionId}`)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (!existingPayment) {
    const { error: insertError } = await supabaseAdmin.from("payments").insert([
      {
        user_id: userId,
        invoice_id: invoiceId,
        amount: amountPaid,
        payment_date: new Date().toISOString().slice(0, 10),
        payment_method: "Stripe",
        notes: `Stripe Checkout Session: ${stripeCheckoutSessionId}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    if (insertError) {
      throw new Error(insertError.message);
    }
  }

  await updateInvoiceStatus(invoiceId, userId);

  console.log("Saved invoice payment", {
    invoiceId,
    userId,
    paymentType,
    amountPaid,
    stripeCheckoutSessionId,
    stripePaymentIntentId,
  });
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json(
      { error: "Webhook signature verification failed." },
      { status: 400 }
    );
  }

  try {
    assertIsolatedBillingPreview();
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        if (event.type === "checkout.session.completed" && session.mode === "payment") {
          await saveInvoicePayment(session);
        }
        const userId = session.metadata?.user_id;
        const id = stripeId(session.subscription);
        if (session.mode === "subscription" && userId && id) await syncSubscription(userId, id);
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed": {
        const subscription = event.data.object;
        const userId = subscription.metadata.user_id;
        if (userId) {
          await syncSubscription(userId, subscription.id,
            event.type === "customer.subscription.deleted" ? subscription : undefined);
        }
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = await stripe.invoices.retrieve(event.data.object.id);
        const details = invoice.parent?.subscription_details;
        const id = stripeId(details?.subscription);
        const userId = details?.metadata?.user_id;
        if (userId && id) await syncSubscription(userId, id);
        break;
      }
      case "customer.deleted": {
        const customerId = event.data.object.id;
        const { data, error } = await supabaseAdmin.from("subscriptions")
          .select("user_id, stripe_subscription_id").eq("stripe_customer_id", customerId).maybeSingle();
        if (error) throw error;
        if (data?.stripe_subscription_id) {
          await syncSubscription(data.user_id, data.stripe_subscription_id, undefined, customerId);
        }
        break;
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed", event.id, event.type, error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Unable to process Stripe event." }, { status: 500 });
  }
}
