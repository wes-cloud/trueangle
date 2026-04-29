import { NextResponse } from "next/server";
import { plaidClient, plaidCountryCodes, plaidProducts } from "@/lib/plaid";

export async function POST() {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: crypto.randomUUID(),
      },
      client_name: "WW Contracting",
      products: plaidProducts,
      country_codes: plaidCountryCodes,
      language: "en",
      transactions: {
        days_requested: 90,
      },
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error("create-link-token error", error);
    return NextResponse.json(
      { error: "Unable to create Plaid link token." },
      { status: 500 }
    );
  }
}