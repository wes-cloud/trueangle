export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold">Terms of Service</h1>

        <p className="mt-6 text-slate-700">
          TrueAngle provides tools to help contractors manage estimates,
          invoices, expenses, and job profitability.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Use of Service</h2>
        <p className="mt-2 text-slate-700">
          You are responsible for how you use this software, including your
          pricing, contracts, financial decisions, and business operations.
        </p>

        <h2 className="mt-8 text-xl font-semibold">No Legal or Financial Advice</h2>
        <p className="mt-2 text-slate-700">
          TrueAngle is not a law firm or accounting service. The platform does
          not provide legal, tax, or financial advice.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Limitation of Liability</h2>
        <p className="mt-2 text-slate-700">
          TrueAngle is not responsible for business outcomes, lost profits,
          incorrect estimates, or decisions made based on the use of this tool.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Changes</h2>
        <p className="mt-2 text-slate-700">
          These terms may be updated over time. Continued use of the platform
          means you accept those changes.
        </p>

        <p className="mt-10 text-sm text-slate-500">
          Last updated: {new Date().getFullYear()}
        </p>
      </div>
    </main>
  );
}