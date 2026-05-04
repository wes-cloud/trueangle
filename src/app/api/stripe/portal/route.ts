import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  try {
    const { customerId } = await req.json();

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: "https://trueangle.vercel.app/dashboard",
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: "Error creating portal session" },
      { status: 500 }
    );
  }
}