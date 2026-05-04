"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AppNav from "@/components/AppNav";

type AuthUser = {
  id: string;
  email?: string | null;
};

type CompanySettings = {
  id: string;
  user_id: string;
  company_id?: string | null;
  company_name: string | null;
  website_url?: string | null;
  logo_url: string | null;
  logo_storage_path?: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
  license_number: string | null;
  default_terms: string | null;
};

export default function SettingsPage() {
  const [authLoading, setAuthLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoStoragePath, setLogoStoragePath] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [taxId, setTaxId] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [defaultTerms, setDefaultTerms] = useState("");

  const [message, setMessage] = useState("");

  function clearForm() {
    setSettingsId(null);
    setCompanyId(null);
    setCompanyName("");
    setWebsiteUrl("");
    setLogoUrl("");
    setLogoStoragePath("");
    setLogoFile(null);
    setPhone("");
    setEmail("");
    setAddress("");
    setTaxId("");
    setLicenseNumber("");
    setDefaultTerms("");
  }

  async function handleManageSubscription() {
    try {
      setMessage("Opening billing portal...");

      const res = await fetch("/api/stripe/portal", {
        method: "POST",
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setMessage(data.error || "Could not open billing portal.");
    } catch (err) {
      console.error(err);
      setMessage("Something went wrong opening billing.");
    }
  }

  async function getOrCreateCompany(currentUser: AuthUser) {
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (membership?.company_id) {
      return membership.company_id as string;
    }

    const { data: newCompany, error: companyError } = await supabase
      .from("companies")
      .insert({
        owner_id: currentUser.id,
        name: "My Company",
      })
      .select("id")
      .single();

    if (companyError || !newCompany) {
      throw new Error(companyError?.message || "Could not create company.");
    }

    const { error: memberError } = await supabase
      .from("company_members")
      .insert({
        company_id: newCompany.id,
        user_id: currentUser.id,
        role: "owner",
      });

    if (memberError) {
      throw new Error(memberError.message);
    }

    return newCompany.id as string;
  }

  async function loadSettings(currentUser: AuthUser) {
    try {
      const currentCompanyId = await getOrCreateCompany(currentUser);
      setCompanyId(currentCompanyId);

      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (error) {
        setMessage(`Error loading settings: ${error.message}`);
        return;
      }

      if (!data) {
        return;
      }

      const settings = data as CompanySettings;

      setSettingsId(settings.id);
      setCompanyName(settings.company_name || "");
      setWebsiteUrl(settings.website_url || "");
      setLogoUrl(settings.logo_url || "");
      setLogoStoragePath(settings.logo_storage_path || "");
      setPhone(settings.phone || "");
      setEmail(settings.email || "");
      setAddress(settings.address || "");
      setTaxId(settings.tax_id || "");
      setLicenseNumber(settings.license_number || "");
      setDefaultTerms(settings.default_terms || "");
    } catch (err) {
      const error = err as Error;
      setMessage(`Error loading company: ${error.message}`);
    }
  }

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        setMessage(error.message);
        setAuthLoading(false);
        return;
      }

      const safeUser = user
        ? {
            id: user.id,
            email: user.email ?? null,
          }
        : null;

      setUser(safeUser);

      if (safeUser) {
        await loadSettings(safeUser);
      }

      setAuthLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user
        ? {
            id: session.user.id,
            email: session.user.email ?? null,
          }
        : null;

      setUser(nextUser);

      if (nextUser) {
        await loadSettings(nextUser);
      } else {
        clearForm();
      }

      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function uploadLogoFile(currentCompanyId: string) {
    if (!logoFile) {
      return {
        publicUrl: logoUrl || null,
        storagePath: logoStoragePath || null,
      };
    }

    const fileExt = logoFile.name.split(".").pop()?.toLowerCase() || "file";
    const safeFileName = `company-logo-${Date.now()}.${fileExt}`;
    const storagePath = `${currentCompanyId}/${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("company-logos")
      .upload(storagePath, logoFile, {
        upsert: true,
      });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data } = supabase.storage
      .from("company-logos")
      .getPublicUrl(storagePath);

    return {
      publicUrl: data.publicUrl,
      storagePath,
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (!user) {
      setMessage("You must be signed in.");
      return;
    }

    setSaving(true);
    setMessage("Saving settings...");

    try {
      const currentCompanyId = companyId || (await getOrCreateCompany(user));
      setCompanyId(currentCompanyId);

      let uploadedLogo = {
        publicUrl: logoUrl || null,
        storagePath: logoStoragePath || null,
      };

      if (logoFile) {
        uploadedLogo = await uploadLogoFile(currentCompanyId);
      }

      const payload = {
        user_id: user.id,
        company_id: currentCompanyId,
        company_name: companyName.trim() || null,
        website_url: websiteUrl.trim() || null,
        logo_url: uploadedLogo.publicUrl,
        logo_storage_path: uploadedLogo.storagePath,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        tax_id: taxId.trim() || null,
        license_number: licenseNumber.trim() || null,
        default_terms: defaultTerms.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (settingsId) {
        const { error } = await supabase
          .from("company_settings")
          .update(payload)
          .eq("id", settingsId)
          .eq("user_id", user.id);

        if (error) {
          throw new Error(error.message);
        }
      } else {
        const { data, error } = await supabase
          .from("company_settings")
          .insert([payload])
          .select()
          .single();

        if (error) {
          throw new Error(error.message);
        }

        setSettingsId((data as CompanySettings).id);
      }

      await supabase
        .from("companies")
        .update({
          name: companyName.trim() || "My Company",
          website_url: websiteUrl.trim() || null,
          logo_url: uploadedLogo.publicUrl,
          logo_storage_path: uploadedLogo.storagePath,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentCompanyId);

      setLogoUrl(uploadedLogo.publicUrl || "");
      setLogoStoragePath(uploadedLogo.storagePath || "");
      setLogoFile(null);
      setMessage("Settings saved successfully.");
    } catch (err) {
      const error = err as Error;
      setMessage(`Error saving settings: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMessage(`Sign out error: ${error.message}`);
      return;
    }

    setUser(null);
    clearForm();
    setMessage("Signed out.");
  }

  const logoIsImage =
    logoUrl &&
    !logoUrl.toLowerCase().includes(".pdf") &&
    (logoUrl.toLowerCase().includes(".png") ||
      logoUrl.toLowerCase().includes(".jpg") ||
      logoUrl.toLowerCase().includes(".jpeg") ||
      logoUrl.toLowerCase().includes(".webp") ||
      logoUrl.toLowerCase().includes(".svg"));

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow">
          <p className="text-slate-900">Loading...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow">
          <h1 className="text-3xl font-bold text-slate-950">Settings</h1>
          <p className="mt-3 text-slate-700">
            You need to sign in from the dashboard first.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
      <AppNav onSignOut={handleSignOut} />

      <div className="mx-auto max-w-5xl space-y-8">
        <section className="rounded-2xl bg-white p-8 shadow">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                TrueAngle
              </p>
              <h1 className="text-3xl font-bold text-slate-950">
                Company Settings
              </h1>
              <p className="mt-1 text-sm text-slate-700">
                Estimating and budgeting for tradesmen, built by tradesmen.
              </p>
              <p className="mt-2 text-sm text-slate-700">
                Signed in as {user.email || "User"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800">
              These details will be used on your company profile, estimates,
              invoices, and future PDFs.
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-8 shadow">
          <h2 className="text-xl font-bold text-slate-950">Billing</h2>

          <p className="mt-2 text-sm text-slate-700">
            You're on a free trial. Billing starts automatically unless you
            cancel.
          </p>

          <div className="mt-6">
            <button
              type="button"
              onClick={handleManageSubscription}
              className="rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white hover:bg-slate-800"
            >
              Manage Subscription
            </button>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-8 shadow">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-950">
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Your Company Name"
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-950 placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-950">
                  Website
                </label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://yourcompany.com"
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-950 placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <label className="mb-2 block text-sm font-semibold text-slate-950">
                Logo / Company File
              </label>

              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.svg"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                className="block w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900"
              />

              <p className="mt-2 text-sm text-slate-700">
                Upload a logo image. Accepted files: PNG, JPG, JPEG, WEBP, or
                SVG.
              </p>

              {logoFile && (
                <p className="mt-2 text-sm font-medium text-slate-900">
                  Selected file: {logoFile.name}
                </p>
              )}

              {logoUrl && (
                <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
                  <p className="mb-3 text-sm font-semibold text-slate-950">
                    Current Upload
                  </p>

                  {logoIsImage ? (
                    <img
                      src={logoUrl}
                      alt="Company logo preview"
                      className="max-h-28 rounded border border-slate-200 bg-white p-2"
                    />
                  ) : (
                    <a
                      href={logoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-slate-950 underline"
                    >
                      View uploaded company file
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-950">
                  Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(360) 555-5555"
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-950 placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-950">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@yourcompany.com"
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-950 placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-950">
                  Tax ID / EIN
                </label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="12-3456789"
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-950 placeholder:text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-950">
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St, Mount Vernon, WA"
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-950 placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-950">
                License Number
              </label>
              <input
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="CONTRACTOR-LICENSE-123"
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-950 placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-950">
                Default Terms / Footer Text
              </label>
              <textarea
                value={defaultTerms}
                onChange={(e) => setDefaultTerms(e.target.value)}
                placeholder="Payment due upon completion. Estimates valid for 30 days..."
                className="min-h-[140px] w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-950 placeholder:text-slate-500"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-slate-950 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>

              {message && (
                <p className="text-sm font-medium text-slate-900">{message}</p>
              )}
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}