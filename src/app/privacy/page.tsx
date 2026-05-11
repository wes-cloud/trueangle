export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
          TrueAngle
        </p>

        <h1 className="mt-2 text-4xl font-black">Privacy Policy</h1>

        <p className="mt-6 text-slate-700">
          TrueAngle respects your privacy. This page explains what data we
          collect, how it is used, and how we help protect your information.
        </p>

        <h2 className="mt-8 text-xl font-semibold">
          Information We Collect
        </h2>

        <ul className="mt-2 list-disc pl-6 text-slate-700 space-y-2">
          <li>Account information (email, login details)</li>
          <li>
            Business data (estimates, invoices, expenses, mileage, and
            transactions)
          </li>
          <li>
            Financial account metadata and transaction data provided through
            Plaid
          </li>
        </ul>

        <p className="mt-4 text-slate-700">
          TrueAngle does not store online banking usernames or passwords.
          Financial account authentication is securely handled by Plaid.
        </p>

        <h2 className="mt-8 text-xl font-semibold">
          How We Use Data
        </h2>

        <p className="mt-2 text-slate-700">
          Your data is used only to operate, maintain, and improve the platform.
          This includes tracking job profitability, expenses, invoices,
          transactions, and related business insights.
        </p>

        <p className="mt-4 text-slate-700">
          We do not sell your data to third parties.
        </p>

        <h2 className="mt-8 text-xl font-semibold">
          Third-Party Services
        </h2>

        <p className="mt-2 text-slate-700">
          TrueAngle uses trusted third-party providers including Plaid, Stripe,
          Supabase, and Vercel to provide banking connectivity, payments,
          authentication, hosting, and infrastructure services.
        </p>

        <h2 className="mt-8 text-xl font-semibold">
          Data Security
        </h2>

        <p className="mt-2 text-slate-700">
          We use secure cloud infrastructure providers, encrypted connections,
          and modern authentication methods to help protect your information.
          Access to production systems is restricted and protected using
          multi-factor authentication.
        </p>

        <p className="mt-4 text-slate-700">
          While we take reasonable steps to protect your information, no system
          can guarantee absolute security.
        </p>

        <h2 className="mt-8 text-xl font-semibold">
          Data Retention and Deletion
        </h2>

        <p className="mt-2 text-slate-700">
          User data is retained only as necessary to provide platform
          functionality. Users may request account or data deletion by
          contacting support.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Contact</h2>

        <p className="mt-2 text-slate-700">
          For privacy questions or data requests, contact:
        </p>

        <p className="mt-2 font-semibold text-slate-900">
          support@trueangle.app
        </p>

        <p className="mt-10 text-sm text-slate-500">
          Last updated: {new Date().getFullYear()}
        </p>
      </div>
    </main>
  );
}