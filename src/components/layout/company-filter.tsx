"use client";

import { Building2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CompanyOption = { id: string; name: string; code: string };

export function CompanyFilter({ companies }: { companies: CompanyOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedCompanyId = searchParams.get("company") ?? "all";

  function selectCompany(companyId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (companyId === "all") params.delete("company");
    else params.set("company", companyId);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border bg-card px-2">
      <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Select value={selectedCompanyId} onValueChange={selectCompany}>
        <SelectTrigger className="h-9 w-[150px] border-0 px-0 shadow-none focus:ring-0 sm:w-[190px]">
          <SelectValue placeholder="All companies" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Companies</SelectItem>
          {companies.map((company) => (
            <SelectItem key={company.id} value={company.id}>{company.code} / {company.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
