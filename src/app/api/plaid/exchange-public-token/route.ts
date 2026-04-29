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

    const { error: itemError } = await supabaseAdmin.from("plaid_items").upsert(
      {
        user_id,
        plaid_item_id: itemId,
        access_token: accessToken,
        institution_id: metadata?.institution?.institution_id || null,
        institution_name: metadata?.institution?.name || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "plaid_item_id" }
    );

    if (itemError) {
      console.error("plaid_items upsert error", itemError);
      return NextResponse.json(
        { error: `Unable to save Plaid item: ${itemError.message}` },
        { status: 500 }
      );
    }

    if (Array.isArray(metadata?.accounts) && metadata.accounts.length > 0) {
      const accountRows = metadata.accounts.map((account: any) => ({
        user_id,
        plaid_item_id: itemId,
        plaid_account_id: account.id,
        name: account.name || null,
        official_name: account.official_name || null,
        mask: account.mask || null,
        type: account.type || null,
        subtype: account.subtype || null,
        updated_at: new Date().toISOString(),
      }));

      const { error: accountError } = await supabaseAdmin
        .from("plaid_accounts")
        .upsert(accountRows, { onConflict: "plaid_account_id" });

      if (accountError) {
        console.error("plaid_accounts upsert error", accountError);
        return NextResponse.json(
          { error: `Unable to save Plaid accounts: ${accountError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, item_id: itemId });
  } catch (error: any) {
    console.error("exchange-public-token error", error);
    return NextResponse.json(
      {
        error:
          error?.response?.data?.error_message ||
          error?.message ||
          "Unable to exchange public token.",
      },
      { status: 500 }
    );
  }
}