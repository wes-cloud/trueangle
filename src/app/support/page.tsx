export default function SupportPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold">Support</h1>

        <p className="mt-6 text-slate-700">
          Need help or ran into an issue? Reach out and we’ll get back to you.
        </p>

        <p className="mt-4 text-slate-700">
          Email: <strong>support@trueangle.app</strong>
        </p>

        <p className="mt-4 text-sm text-slate-600">
          Typical response time: 24–48 hours.
        </p>

        <div className="mt-8 rounded-xl border p-5 bg-slate-50">
          <p className="font-semibold">When you email support, include:</p>
          <ul className="mt-2 list-disc pl-6 text-slate-700">
            <li>What you were trying to do</li>
            <li>What went wrong</li>
            <li>What page you were on</li>
            <li>A screenshot (if possible)</li>
          </ul>
        </div>
      </div>
    </main>
  );
}