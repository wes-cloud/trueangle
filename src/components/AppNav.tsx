"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AppNavProps = {
  onSignOut?: () => void | Promise<void>;
};

const navGroups = [
  {
    label: "Dashboard",
    icon: "📊",
    href: "/dashboard",
  },
  {
    label: "Sales",
    icon: "🧾",
    items: [
      { href: "/estimates", label: "Estimates" },
      { href: "/estimates/new", label: "Create Estimate" },
      { href: "/invoices", label: "Invoices" },
    ],
  },
  {
    label: "Money",
    icon: "💰",
    items: [
      { href: "/expenses", label: "Expenses" },
      { href: "/banking/transactions", label: "Banking" },
      { href: "/mileage", label: "Mileage" },
    ],
  },
  {
    label: "Customers",
    icon: "👥",
    href: "/customers",
  },
  {
    label: "Reports",
    icon: "📈",
    href: "/reports",
  },
  {
    label: "Settings",
    icon: "⚙️",
    href: "/settings",
  },
];

export default function AppNav({ onSignOut }: AppNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [companyName, setCompanyName] = useState("My Company");

  useEffect(() => {
    async function loadCompanyName() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("company_settings")
        .select("company_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.company_name) {
        setCompanyName(data.company_name);
      }
    }

    loadCompanyName();
  }, []);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function groupIsActive(items?: { href: string; label: string }[]) {
    if (!items) return false;
    return items.some((item) => isActive(item.href));
  }

async function handleSignOutClick() {
  if (onSignOut) {
    await onSignOut();
  } else {
    await supabase.auth.signOut();
  }

  window.location.href = "/";


    router.push("/");
    router.refresh();
  }

  return (
    <header className="mx-auto mb-6 max-w-6xl rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
<Link
  href="/"
  className="flex items-center gap-3"
>
  <Image
    src="/trueangle-logo.png"
    alt="TrueAngle logo"
    width={42}
    height={42}
    className="rounded-xl"
  />

  <span className="text-2xl font-black tracking-tight text-slate-950">
    TrueAngle
  </span>
</Link>

        <div className="flex items-center gap-3">
          <p className="hidden max-w-[240px] truncate text-sm font-semibold text-slate-800 sm:block">
            {companyName}
          </p>

          <button
            type="button"
            onClick={handleSignOutClick}
            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
          >
            Sign Out
          </button>
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-2 px-4 py-3">
        {navGroups.map((group) => {
          if ("href" in group && group.href) {
            const active = isActive(group.href);

            return (
              <Link
                key={group.label}
                href={group.href}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-slate-950 text-white"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <span>{group.icon}</span>
                <span>{group.label}</span>
              </Link>
            );
          }

          const active = groupIsActive(group.items);

          return (
            <div key={group.label} className="group relative">
              <button
                type="button"
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-slate-950 text-white"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <span>{group.icon}</span>
                <span>{group.label}</span>
                <span className="text-xs">▼</span>
              </button>

              <div className="invisible absolute left-0 top-full z-50 min-w-48 pt-2 opacity-0 transition group-hover:visible group-hover:opacity-100">
                <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  {group.items?.map((item) => {
                    const itemActive = isActive(item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block rounded-lg px-3 py-2 text-sm font-semibold transition ${
                          itemActive
                            ? "bg-slate-950 text-white"
                            : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>
    </header>
    
  );
}