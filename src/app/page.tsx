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

      <section className="px-6 py-16">
  <div className="mx-auto max-w-4xl">
    <h2 className="text-2xl font-bold text-center">
      Why contractors switch to TrueAngle
    </h2>

    <div className="mt-10 grid gap-6 md:grid-cols-2">
      
      <div className="rounded-2xl border p-6">
        <p className="text-sm font-semibold text-slate-500">Before</p>
        <p className="mt-2 font-medium text-slate-800">
          Estimates in one place, receipts somewhere else, invoices in another app.
        </p>
      </div>

      <div className="rounded-2xl border p-6 bg-slate-50">
        <p className="text-sm font-semibold text-slate-500">With TrueAngle</p>
        <p className="mt-2 font-medium text-slate-900">
          Estimates, expenses, invoices, and profit — all tied to the same job.
        </p>
      </div>

      <div className="rounded-2xl border p-6">
        <p className="text-sm font-semibold text-slate-500">Before</p>
        <p className="mt-2 font-medium text-slate-800">
          You finish a job and hope you made money.
        </p>
      </div>

      <div className="rounded-2xl border p-6 bg-slate-50">
        <p className="text-sm font-semibold text-slate-500">With TrueAngle</p>
        <p className="mt-2 font-medium text-slate-900">
          You know your profit before the job is even done.
        </p>
      </div>

      <div className="rounded-2xl border p-6">
        <p className="text-sm font-semibold text-slate-500">Before</p>
        <p className="mt-2 font-medium text-slate-800">
          Mileage, materials, and labor costs slip through the cracks.
        </p>
      </div>

      <div className="rounded-2xl border p-6 bg-slate-50">
        <p className="text-sm font-semibold text-slate-500">With TrueAngle</p>
        <p className="mt-2 font-medium text-slate-900">
          Every cost is tracked, tied to the job, and accounted for.
        </p>
      </div>

      <div className="rounded-2xl border p-6">
        <p className="text-sm font-semibold text-slate-500">Before</p>
        <p className="mt-2 font-medium text-slate-800">
          You spend time chasing numbers instead of running jobs.
        </p>
      </div>

      <div className="rounded-2xl border p-6 bg-slate-50">
        <p className="text-sm font-semibold text-slate-500">With TrueAngle</p>
        <p className="mt-2 font-medium text-slate-900">
          Your numbers are already there when you need them.
        </p>
      </div>

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