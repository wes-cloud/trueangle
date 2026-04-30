"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* HERO */}
      <section className="px-6 py-20 text-center max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-black leading-tight">
          Know exactly how much profit you made on every job
        </h1>

        <p className="mt-6 text-lg text-slate-600">
          Track expenses, invoices, and real profit in one simple dashboard —
          built for contractors.
        </p>

        <div className="mt-8">
          <Link
            href="/start-trial"
            className="inline-block bg-slate-900 text-white px-6 py-3 rounded-xl text-lg font-semibold hover:bg-slate-800 transition"
          >
            Start Free 14-Day Trial
          </Link>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="bg-slate-50 py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold">
            Most contractors don’t actually know their numbers
          </h2>

          <div className="mt-6 text-slate-700 space-y-3">
            <p>• You finish jobs but don’t know if you made money</p>
            <p>• Expenses are scattered across apps and receipts</p>
            <p>• Bank deposits don’t match what you expected</p>
          </div>

          <p className="mt-6 font-semibold">
            You’re working hard — but guessing your profit.
          </p>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold">
            TrueAngle shows you your real numbers — instantly
          </h2>

          <div className="mt-6 text-slate-700 space-y-3">
            <p>• See real profit (not just revenue)</p>
            <p>• Track every expense in one place</p>
            <p>• Match invoices to bank deposits automatically</p>
            <p>• Stop guessing and start making better decisions</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900 text-white py-20 px-6 text-center">
        <h2 className="text-3xl font-bold">
          Run your business with confidence
        </h2>

        <p className="mt-4 text-slate-300">
          Know your numbers. Price jobs better. Keep more money.
        </p>

        <Link
          href="/start-trial"
          className="mt-8 inline-block bg-white text-slate-900 px-6 py-3 rounded-xl text-lg font-semibold hover:bg-slate-200 transition"
        >
          Start Free Trial
        </Link>
      </section>
    </main>
  );
}