"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-2xl font-black tracking-tight">
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
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
          >
            Start Free Trial
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <p className="mb-4 inline-block rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
            Built for contractors, not accountants
          </p>

          <h1 className="text-5xl font-black leading-tight tracking-tight md:text-6xl">
            Estimates, approvals, invoices, and job numbers — without the
            QuickBooks headache.
          </h1>

          <p className="mt-6 max-w-2xl text-xl font-medium leading-8 text-slate-600">
            TrueAngle helps contractors send estimates, get client approval,
            create invoices, track expenses, and see if the job actually made
            money.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/start-trial"
              className="rounded-xl bg-slate-950 px-6 py-3 text-lg font-bold text-white hover:bg-slate-800"
            >
              Start Free 14-Day Trial
            </Link>

            <Link
              href="/auth"
              className="rounded-xl border border-slate-300 px-6 py-3 text-lg font-bold text-slate-900 hover:bg-slate-50"
            >
              Sign in
            </Link>
          </div>

          <p className="mt-4 text-sm font-semibold text-slate-500">
            No fluff. No bloated accounting maze. Just the stuff contractors
            need to run jobs and get paid.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-black tracking-tight">
            Why contractors switch from QuickBooks to TrueAngle
          </h2>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <Card
              title="QuickBooks was built for accountants."
              body="TrueAngle is built for contractors who need to send the job, get it approved, track the money, and move on."
            />
            <Card
              title="Stop chasing paperwork."
              body="Send an estimate, let the client approve it, and automatically create the invoice."
            />
            <Card
              title="Know if the job made money."
              body="Track job expenses against estimates and invoices so profit is not a guessing game."
            />
            <Card
              title="Bring your bookkeeper in for free."
              body="Owners pay. Bookkeepers get access without adding another subscription cost."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-3xl font-black tracking-tight">
          The contractor workflow, cleaned up.
        </h2>

        <div className="mt-8 grid gap-5 md:grid-cols-4">
          <Step number="1" title="Create Estimate" />
          <Step number="2" title="Client Approves" />
          <Step number="3" title="Invoice Created" />
          <Step number="4" title="Track Payment" />
        </div>
      </section>

      <section className="bg-slate-950 px-6 py-20 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-black tracking-tight">
            Run the job. Know the numbers. Get paid.
          </h2>

          <p className="mt-5 text-lg font-medium text-slate-300">
            TrueAngle keeps the business side simple so contractors can stay
            focused on the work.
          </p>

          <Link
            href="/start-trial"
            className="mt-8 inline-block rounded-xl bg-white px-6 py-3 text-lg font-bold text-slate-950 hover:bg-slate-200"
          >
            Start Free Trial
          </Link>
        </div>
      </section>
    </main>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-xl font-black text-slate-950">{title}</h3>
      <p className="mt-3 text-base font-medium leading-7 text-slate-600">
        {body}
      </p>
    </div>
  );
}

function Step({ number, title }: { number: string; title: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">
        {number}
      </div>
      <h3 className="text-lg font-black text-slate-950">{title}</h3>
    </div>
  );
}