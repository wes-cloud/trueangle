"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-black tracking-tight">
            TrueAngle
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-xl border border-white/20 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
            >
              Dashboard
            </Link>

            <Link
              href="/start-trial"
              className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-200"
            >
              Start Free Trial
            </Link>
          </div>
        </header>

        {/* Hero */}
        <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-amber-400">
              Built by tradesmen
            </p>

            <h1 className="mt-5 max-w-4xl text-5xl font-black leading-tight tracking-tight md:text-7xl">
              Know what you actually made on the job.
            </h1>

            <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-slate-300">
              TrueAngle helps contractors track estimates, invoices, expenses,
              bank deposits, and real profit without needing a damn accounting
              degree.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/start-trial"
                className="rounded-2xl bg-amber-400 px-6 py-4 text-center text-base font-black text-slate-950 hover:bg-amber-300"
              >
                Start 14-Day Free Trial
              </Link>

              <Link
                href="/dashboard"
                className="rounded-2xl border border-white/20 px-6 py-4 text-center text-base font-black text-white hover:bg-white/10"
              >
                Go to Dashboard
              </Link>
            </div>

            <p className="mt-4 text-sm font-semibold text-slate-400">
              $29/month after trial. Cancel anytime.
            </p>

            <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-lg font-black text-white">
                “I built this because everything else sucks.”
              </p>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-300">
                Most business apps feel like they were built by someone who has
                never had sawdust in their truck or mud on their boots.
                TrueAngle is different.
              </p>
            </div>
          </div>

          {/* Demo Card */}
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl">
            <div className="rounded-[1.5rem] bg-white p-6 text-slate-950">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <p className="text-sm font-bold text-slate-500">
                    Job Profit
                  </p>
                  <p className="text-3xl font-black">$8,420</p>
                </div>

                <div className="rounded-full bg-green-100 px-3 py-1 text-sm font-black text-green-700">
                  Profitable
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <MetricRow label="Invoice Payments" value="$14,800" />
                <MetricRow label="Expenses" value="$6,380" />
                <MetricRow label="Real Profit" value="$8,420" strong />
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <section className="grid gap-4 pb-10 md:grid-cols-3">
          <FeatureCard
            title="Built for contractors"
            text="Track jobs, customers, expenses, invoices, and deposits in one place."
          />
          <FeatureCard
            title="Real profit"
            text="See income minus expenses without guessing where the money went."
          />
          <FeatureCard
            title="Simple pricing"
            text="Start free for 14 days, then $29/month. No nonsense."
          />
        </section>
      </section>
    </main>
  );
}

function MetricRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
      <span className="text-sm font-bold text-slate-600">{label}</span>
      <span
        className={`text-sm ${
          strong ? "font-black text-green-700" : "font-black text-slate-950"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-black">{title}</h2>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-300">
        {text}
      </p>
    </div>
  );
}