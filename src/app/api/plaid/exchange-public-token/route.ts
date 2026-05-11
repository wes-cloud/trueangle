import { NextRequest, NextResponse } from "next/server";
import { plaidClient } from "@/lib/plaid";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { public_token, metadata, user_id } = body;

    if (!public_token || !user_id) {
      return NextResponse.json(
        { error: "Missing public_token or user_id." },
        { status: 400 }
      );
    }

    const exchange = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = exchange.data.access_token;
    const itemId = exchange.data.item_id;

    const { error } = await supabaseAdmin.from("plaid_items").upsert(
      {
        user_id,
        plaid_item_id: itemId,
        access_token: accessToken,
        institution_name: metadata?.institution?.name || null,
        institution_id: metadata?.institution?.institution_id || null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "plaid_item_id",
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, plaid_item_id: itemId });
  } catch (error: any) {
    console.error("exchange-public-token error", error?.response?.data || error);
    return NextResponse.json(
      {
        error:
          error?.response?.data?.error_message ||
          error?.message ||
          "Unable to exchange Plaid public token.",
      },
      { status: 500 }
    );
  }
}