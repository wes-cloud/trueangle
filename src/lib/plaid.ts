import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

const plaidEnv = process.env.PLAID_ENV || "sandbox";

const configuration = new Configuration({
  basePath:
    plaidEnv === "production"
      ? PlaidEnvironments.production
      : plaidEnv === "development"
      ? PlaidEnvironments.development
      : PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID || "",
      "PLAID-SECRET": process.env.PLAID_SECRET || "",
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

export const plaidProducts = (process.env.PLAID_PRODUCTS || "transactions")
  .split(",")
  .map((p) => p.trim()) as Products[];

export const plaidCountryCodes = (process.env.PLAID_COUNTRY_CODES || "US")
  .split(",")
  .map((c) => c.trim()) as CountryCode[];