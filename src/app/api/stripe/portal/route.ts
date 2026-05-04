import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "Missing user ID." },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe customer found for this account." },
        { status: 400 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: "https://trueangle.vercel.app/settings",
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe portal error:", error);

    return NextResponse.json(
      { error: "Error creating portal session." },
      { status: 500 }
    );
  }
}