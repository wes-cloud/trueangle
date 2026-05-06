export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold">Privacy Policy</h1>

        <p className="mt-6 text-slate-700">
          TrueAngle respects your privacy. This page explains what data we
          collect and how it is used.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Information We Collect</h2>
        <ul className="mt-2 list-disc pl-6 text-slate-700">
          <li>Account information (email, login details)</li>
          <li>Business data (estimates, invoices, expenses, mileage)</li>
        </ul>

        <h2 className="mt-8 text-xl font-semibold">How We Use Data</h2>
        <p className="mt-2 text-slate-700">
          Your data is used only to operate and improve the platform. We do not
          sell your data to third parties.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Data Security</h2>
        <p className="mt-2 text-slate-700">
          We take reasonable steps to protect your information, but no system is
          100% secure.
        </p>

        <h2 className="mt-8 text-xl font-semibold">Contact</h2>
        <p className="mt-2 text-slate-700">
          For privacy questions, contact: support@trueangle.app
        </p>

        <p className="mt-10 text-sm text-slate-500">
          Last updated: {new Date().getFullYear()}
        </p>
      </div>
    </main>
  );
}