"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* HEADER */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-xl font-black">
          TrueAngle
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/auth"
            className="text-sm font-semibold text-slate-700 hover:text-slate-950"
          >
            Sign in
          </Link>

          <Link
            href="/start-trial"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Start Free Trial
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h1 className="text-4xl font-black leading-tight md:text-5xl">
          Know exactly if you’re making money on your jobs
        </h1>

        <p className="mt-6 text-lg text-slate-600">
          Track expenses, invoices, and real profit in one place — without the guesswork.
        </p>

        <div className="mt-8">
          <Link
            href="/start-trial"
            className="inline-block rounded-xl bg-slate-900 px-6 py-3 text-lg font-semibold text-white transition hover:bg-slate-800"
          >
            Start Free 14-Day Trial
          </Link>
        </div>
      </section>

      {/* PROBLEM */}
      <section className="bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold">
            Most contractors don’t actually know their numbers
          </h2>

          <div className="mt-6 space-y-3 text-slate-700">
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
      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold">
            TrueAngle shows you your real numbers — instantly
          </h2>

          <div className="mt-6 space-y-3 text-slate-700">
            <p>• See real profit — not just money coming in </p>
            <p>• Keep all your expenses in one place </p>
            <p>• Match invoices to bank deposits automatically</p>
            <p>• Stop guessing and start making better decisions</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-900 px-6 py-20 text-center text-white">
        <h2 className="text-3xl font-bold">Run your business with confidence</h2>

        <p className="mt-4 text-slate-300">
          Know your numbers. Price jobs better. Keep more money.
        </p>

        <Link
          href="/start-trial"
          className="mt-8 inline-block rounded-xl bg-white px-6 py-3 text-lg font-semibold text-slate-900 transition hover:bg-slate-200"
        >
          Start Free Trial
        </Link>
      </section>
    </main>
  );
}