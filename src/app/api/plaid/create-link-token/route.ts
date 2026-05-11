import { NextRequest, NextResponse } from "next/server";
import { plaidClient, plaidCountryCodes, plaidProducts } from "@/lib/plaid";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.user_id || crypto.randomUUID();

    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: userId,
      },
      client_name: "TrueAngle",
      products: plaidProducts,
      country_codes: plaidCountryCodes,
      language: "en",
      transactions: {
        days_requested: 90,
      },
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error: any) {
    console.error("create-link-token error", error?.response?.data || error);
    return NextResponse.json(
      {
        error:
          error?.response?.data?.error_message ||
          error?.message ||
          "Unable to create Plaid link token.",
      },
      { status: 500 }
    );
  }
}