import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const { data: existingUsers, error: listUsersError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (listUsersError) {
      return NextResponse.json(
        { error: listUsersError.message },
        { status: 500 }
      );
    }

    const existingUser = existingUsers.users.find(
      (user) => user.email?.toLowerCase() === email
    );

    let userId = existingUser?.id;

    if (!userId) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (error || !data.user) {
        return NextResponse.json(
          { error: error?.message || "Could not create user." },
          { status: 500 }
        );
      }

      userId = data.user.id;
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          user_id: userId,
        },
      },
      metadata: {
        user_id: userId,
      },
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?trial=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?trial=canceled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const error = err as Error;

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}