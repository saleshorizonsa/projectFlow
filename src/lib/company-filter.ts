export type CompanySearchParams = {
  company?: string;
};

export async function selectedCompanyId(searchParams?: Promise<CompanySearchParams> | CompanySearchParams) {
  const params = searchParams && "then" in searchParams ? await searchParams : searchParams;
  const companyId = params?.company;
  return companyId && companyId !== "all" ? companyId : undefined;
}

export function projectCompanyWhere(companyId?: string) {
  return companyId ? { companies: { some: { companyId } } } : {};
}

export function relatedProjectCompanyWhere(companyId?: string) {
  return companyId ? { project: projectCompanyWhere(companyId) } : {};
}

export function assetCompanyWhere(companyId?: string) {
  return companyId ? { companies: { some: { companyId } } } : {};
}

export function relatedAssetCompanyWhere(companyId?: string) {
  return companyId ? { asset: assetCompanyWhere(companyId) } : {};
}

export function userCompanyWhere(companyId?: string) {
  return companyId ? { OR: [{ companies: { some: { companyId } } }, { role: { name: "ADMIN" as const } }] } : {};
}
