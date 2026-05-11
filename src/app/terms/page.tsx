export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
          TrueAngle
        </p>

        <h1 className="mt-2 text-4xl font-black">
          Terms of Service
        </h1>

        <p className="mt-6 text-slate-700">
          TrueAngle provides tools to help contractors and small businesses
          manage estimates, invoices, expenses, transactions, mileage, and job
          profitability.
        </p>

        <h2 className="mt-8 text-xl font-semibold">
          Use of Service
        </h2>

        <p className="mt-2 text-slate-700">
          You are responsible for how you use this software, including your
          pricing, contracts, financial decisions, bookkeeping, and business
          operations.
        </p>

        <p className="mt-4 text-slate-700">
          Users are responsible for ensuring that information entered into the
          platform is accurate and lawful.
        </p>

        <h2 className="mt-8 text-xl font-semibold">
          Financial Information
        </h2>

        <p className="mt-2 text-slate-700">
          TrueAngle is not a bank, law firm, accounting firm, or financial
          advisor. The platform does not provide legal, tax, accounting, or
          financial advice.
        </p>

        <p className="mt-4 text-slate-700">
          Financial information displayed through the platform is provided for
          informational and organizational purposes only.
        </p>

        <h2 className="mt-8 text-xl font-semibold">
          Subscriptions and Billing
        </h2>

        <p className="mt-2 text-slate-700">
          Paid subscriptions are processed securely through Stripe. Users are
          responsible for maintaining valid payment information and managing
          their subscription status.
        </p>

        <h2 className="mt-8 text-xl font-semibold">
          Connected Financial Accounts
        </h2>

        <p className="mt-2 text-slate-700">
          Users may choose to connect financial accounts through Plaid.
          TrueAngle does not store online banking usernames or passwords.
          Financial account authentication is securely handled through Plaid.
        </p>

        <h2 className="mt-8 text-xl font-semibold">
          Limitation of Liability
        </h2>

        <p className="mt-2 text-slate-700">
          TrueAngle is provided on an “as is” basis without warranties of any
          kind.
        </p>

        <p className="mt-4 text-slate-700">
          TrueAngle is not responsible for business outcomes, lost profits,
          incorrect estimates, tax filings, banking issues, or decisions made
          based on the use of this platform.
        </p>

        <h2 className="mt-8 text-xl font-semibold">
          Account Termination
        </h2>

        <p className="mt-2 text-slate-700">
          TrueAngle reserves the right to suspend or terminate accounts that
          misuse the platform or violate these terms.
        </p>

        <h2 className="mt-8 text-xl font-semibold">
          Changes
        </h2>

        <p className="mt-2 text-slate-700">
          These terms may be updated over time. Continued use of the platform
          means you accept those changes.
        </p>

        <h2 className="mt-8 text-xl font-semibold">
          Contact
        </h2>

        <p className="mt-2 text-slate-700">
          For questions regarding these terms, contact:
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