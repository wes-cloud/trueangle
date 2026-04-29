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
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: "Missing user_id." }, { status: 400 });
    }

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("plaid_items")
      .select("plaid_item_id, access_token")
      .eq("user_id", user_id);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: "No Plaid items found for this user." },
        { status: 400 }
      );
    }

    for (const item of items) {
      let cursor: string | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const syncResponse = await plaidClient.transactionsSync({
          access_token: item.access_token,
          cursor,
        });

        const added = syncResponse.data.added || [];

        if (added.length > 0) {
          const rows = added.map((txn: any) => ({
            user_id,
            plaid_item_id: item.plaid_item_id,
            plaid_account_id: txn.account_id || null,
            plaid_transaction_id: txn.transaction_id,
            name: txn.name || null,
            merchant_name: txn.merchant_name || null,
            amount: txn.amount || 0,
            iso_currency_code: txn.iso_currency_code || null,
            category: txn.personal_finance_category?.detailed || null,
            authorized_date: txn.authorized_date || null,
            posted_date: txn.date || null,
            pending: txn.pending || false,
            raw_json: txn,
            updated_at: new Date().toISOString(),
          }));

          const { error: txnError } = await supabaseAdmin
            .from("plaid_transactions")
            .upsert(rows, { onConflict: "plaid_transaction_id" });

          if (txnError) {
            console.error("plaid_transactions upsert error", txnError);
            return NextResponse.json(
              { error: `Unable to save transactions: ${txnError.message}` },
              { status: 500 }
            );
          }
        }

        hasMore = syncResponse.data.has_more;
        cursor = syncResponse.data.next_cursor;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("sync-transactions error", error);
    return NextResponse.json(
      {
        error:
          error?.response?.data?.error_message ||
          error?.message ||
          "Unable to sync transactions.",
      },
      { status: 500 }
    );
  }
}