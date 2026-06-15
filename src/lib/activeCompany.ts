const ACTIVE_COMPANY_KEY = "trueangle_active_company_id";

export function getActiveCompanyId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_COMPANY_KEY);
}

export function setActiveCompanyId(companyId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_COMPANY_KEY, companyId);
}

export function clearActiveCompanyId() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACTIVE_COMPANY_KEY);
}