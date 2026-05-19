"use client";

import Link from "next/link";

const beforeAfterQuotes = [
  {
    before: "I was chasing receipts, guessing profit, and drowning in apps that weren’t built for construction.",
    after: "Everything’s tied to the job. I know my numbers before it’s too late.",
  },
  {
    before: "Estimates in one place, invoices in another, and expenses lost in the truck.",
    after: "Estimates, invoices, expenses, and profit all live under the same roof.",
  },
  {
    before: "I’d finish the job and just hope I made money.",
    after: "Now I can see where the money went before the job eats me alive.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <section className="relative min-h-screen overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=2400&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-black/30" />

        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <Link href="/" className="flex items-center gap-3">
<img
  src="/trueangle-logo.png"
  alt="TrueAngle"
  className="h-14 w-auto"
/>
            <div>
              <p className="text-3xl font-black uppercase tracking-tight">
                TrueAngle
              </p>
              <p className="-mt-1 text-sm font-black uppercase tracking-widest text-orange-500">
                Built for contractors
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <Link href="/auth" className="font-bold text-white/90">
              Sign in
            </Link>

            <Link
              href="/start-trial"
              className="rounded-sm bg-orange-500 px-5 py-3 font-black uppercase text-white shadow-lg shadow-black/40 hover:bg-orange-400"
            >
              Start Free Trial
            </Link>
          </div>
        </header>

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col justify-center px-6 pb-20 pt-16 md:min-h-[760px]">
          <div className="max-w-4xl">
            <p className="mb-5 inline-block bg-orange-500 px-4 py-2 text-lg font-black uppercase tracking-wide text-black">
              Built by a contractor.
            </p>

            <h1 className="max-w-4xl text-5xl font-black uppercase leading-[0.95] tracking-tight text-white drop-shadow-2xl md:text-7xl">
              QuickBooks is like lotion on blue collar hands,
              <span className="block text-orange-500">
                it doesn’t fit on the jobsite.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-xl font-medium leading-8 text-white/90">
              TrueAngle gives contractors the tools to estimate, track expenses,
              send invoices, connect bank transactions, and know their numbers —
              without the bloated accounting maze.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/start-trial"
                className="rounded-sm bg-orange-500 px-7 py-4 text-lg font-black uppercase text-white shadow-lg shadow-black/40 hover:bg-orange-400"
              >
                Start Free 14-Day Trial
              </Link>

              <Link
                href="/auth"
                className="rounded-sm border border-white/60 bg-black/30 px-7 py-4 text-lg font-black uppercase text-white backdrop-blur hover:bg-white/10"
              >
                Sign in
              </Link>
            </div>

            <p className="mt-4 text-sm font-semibold text-white/75">
              No credit card required. Cancel anytime.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[radial-gradient(circle_at_top,#2b2b2b,#080808)] px-6 py-10">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-5">
          <Feature title="Estimate with confidence" text="Create clean, professional estimates in minutes." />
          <Feature title="Get client approval" text="Send for approval and get a faster yes." />
          <Feature title="Invoices that get paid" text="Create invoices and track payment." />
          <Feature title="Track expenses by job" text="See every cost tied to the right project." />
          <Feature title="Connect your bank" text="Transactions flow in. You stay in control." />
        </div>
      </section>

      <section className="bg-stone-200 px-6 py-20 text-neutral-950">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-4xl font-black uppercase tracking-tight">
            Why contractors switch to TrueAngle
          </h2>

          <div className="mt-10 flex gap-6 overflow-x-auto pb-6">
            {beforeAfterQuotes.map((quote, index) => (
              <div
                key={index}
                className="grid min-w-[720px] gap-6 md:grid-cols-2"
              >
                <QuoteCard label="Before" text={quote.before} dark />
                <QuoteCard label="With TrueAngle" text={quote.after} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-neutral-950 px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-4xl font-black uppercase tracking-tight">
            The contractor workflow, cleaned up.
          </h2>

          <div className="mt-12 grid gap-8 md:grid-cols-4">
            <Step number="1" title="Create Estimate" text="Build it. Send it." />
            <Step number="2" title="Client Approves" text="They approve. You move forward." />
            <Step number="3" title="Invoice Created" text="Automatic invoice. No double entry." />
            <Step number="4" title="Get Paid" text="Track payment and keep cash moving." />
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-6 py-24 text-center">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=2200&q=80')",
          }}
        />
        <div className="absolute inset-0 bg-black/75" />

        <div className="relative z-10 mx-auto max-w-4xl">
          <h2 className="text-5xl font-black uppercase tracking-tight">
            Run the job. Know the numbers. Get paid.
          </h2>

          <p className="mt-5 text-xl text-white/80">
            Simple tools for contractors who build, fix, and get it done.
          </p>

          <Link
            href="/start-trial"
            className="mt-8 inline-block rounded-sm bg-orange-500 px-8 py-4 text-lg font-black uppercase text-white hover:bg-orange-400"
          >
            Start Free 14-Day Trial
          </Link>

          <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm font-bold uppercase text-white/70">
            <span>Built for contractors</span>
            <span>Easy to use</span>
            <span>Know your profit</span>
            <span>Get paid faster</span>
          </div>

          <div className="mt-8 flex justify-center gap-6 text-sm text-white/50">
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div className="border-white/10 px-4 py-4 text-center md:border-r last:border-r-0">
      <h3 className="text-lg font-black uppercase text-orange-500">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/75">{text}</p>
    </div>
  );
}

function QuoteCard({
  label,
  text,
  dark = false,
}: {
  label: string;
  text: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`rounded-sm p-8 shadow-xl ${
        dark ? "bg-neutral-950 text-white" : "bg-white text-neutral-950"
      }`}
    >
      <p
        className={`inline-block px-3 py-1 text-sm font-black uppercase ${
          dark ? "bg-white text-black" : "bg-orange-500 text-black"
        }`}
      >
        {label}
      </p>
      <p className="mt-6 text-2xl font-bold leading-9">“{text}”</p>
    </div>
  );
}

function Step({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-xl font-black text-black">
        {number}
      </div>
      <h3 className="mt-5 text-xl font-black uppercase text-orange-500">
        {title}
      </h3>
      <p className="mt-2 text-white/75">{text}</p>
    </div>
  );
}