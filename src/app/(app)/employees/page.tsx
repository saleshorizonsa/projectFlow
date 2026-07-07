import { EmployeeForm } from "@/components/employees/employee-form";
import { EmployeeTable } from "@/components/employees/employee-table";
import { CsvImportDialog } from "@/components/csv-import/csv-import-dialog";
import { safeDecryptField } from "@/lib/encrypt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Clock, Download, XCircle } from "lucide-react";
import { auth } from "@/lib/auth";
import { selectedCompanyId, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";
import { formatEnum } from "@/lib/utils";

export default async function EmployeesPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const session = await auth();
  const companyId = await selectedCompanyId(searchParams);
  const [employees, companies, policyAcks] = await Promise.all([
    getPrisma().employee.findMany({
      where: companyId ? { companies: { some: { companyId } } } : {},
      include: {
        companies: { include: { company: true }, orderBy: { company: { name: "asc" } } },
        assets: { orderBy: { assetTag: "asc" } },
        licenseAssignments: { include: { license: { select: { id: true, licenseId: true, name: true, vendor: true, expiryDate: true } } }, orderBy: { assignedAt: "asc" } },
        _count: { select: { supportTickets: { where: { status: { notIn: ["RESOLVED", "CLOSED"] } } } } },
      },
      orderBy: { name: "asc" },
    }),
    getPrisma().company.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getPrisma().policyAcknowledgement.findMany({
      where: companyId ? { employee: { companies: { some: { companyId } } } } : {},
      include: {
        policy: { select: { id: true, title: true, category: true, status: true } },
        employee: { select: { id: true, name: true, employeeId: true, department: true } },
      },
      orderBy: { sentAt: "desc" },
    }),
  ]);
  const companyOptions = companies.map((company) => ({ id: company.id, name: company.name, code: company.code }));
  const rows = employees.map((employee) => ({
    id: employee.id,
    employeeId: employee.employeeId,
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    department: employee.department,
    jobTitle: employee.jobTitle,
    location: employee.location,
    status: employee.status,
    ipAddress: employee.ipAddress,
    vpnUserId: employee.vpnUserId,
    vpnPassword: safeDecryptField(employee.vpnPassword),
    leaveStartDate: employee.leaveStartDate ? employee.leaveStartDate.toISOString().split("T")[0] : null,
    leaveReturnDate: employee.leaveReturnDate ? employee.leaveReturnDate.toISOString().split("T")[0] : null,
    leaveReason: employee.leaveReason,
    exitDate: employee.exitDate ? employee.exitDate.toISOString().split("T")[0] : null,
    offboardingNotes: employee.offboardingNotes,
    companies: employee.companies.map((link) => ({ id: link.company.id, name: link.company.name, code: link.company.code })),
    assets: employee.assets.map((asset) => ({ id: asset.id, assetTag: asset.assetTag, name: asset.name, type: asset.type })),
    licenses: employee.licenseAssignments.map((a) => ({ id: a.license.id, licenseId: a.license.licenseId, name: a.license.name, vendor: a.license.vendor, assignedAt: a.assignedAt.toISOString() })),
    openTickets: employee._count.supportTickets,
    photoUrl: employee.photoUrl,
  }));
  const canManage = session?.user.role === "ADMIN" || session?.user.role === "PROJECT_MANAGER";
  const activeEmployees = rows.filter((employee) => employee.status === "ACTIVE").length;
  const onLeaveEmployees = rows.filter((employee) => employee.status === "ON_LEAVE").length;
  const assignedAssets = rows.reduce((total, employee) => total + employee.assets.length, 0);
  const assignedLicenses = rows.reduce((total, employee) => total + employee.licenses.length, 0);
  const departments = new Set(rows.map((employee) => employee.department).filter(Boolean)).size;
  const assetRows = rows.flatMap((employee) => employee.assets.map((asset) => ({ ...asset, employee })));
  const licenseRows = rows.flatMap((employee) => employee.licenses.map((license) => ({ ...license, employee })));

  // Policy acknowledgement stats per employee
  const policyStatsByEmployee = new Map<string, { acknowledged: number; pending: number; declined: number; lastAcknowledgedAt: Date | null }>();
  for (const ack of policyAcks) {
    const existing = policyStatsByEmployee.get(ack.employeeId) ?? { acknowledged: 0, pending: 0, declined: 0, lastAcknowledgedAt: null };
    if (ack.status === "ACKNOWLEDGED") {
      existing.acknowledged++;
      if (ack.acknowledgedAt && (!existing.lastAcknowledgedAt || ack.acknowledgedAt > existing.lastAcknowledgedAt)) {
        existing.lastAcknowledgedAt = ack.acknowledgedAt;
      }
    } else if (ack.status === "DECLINED") {
      existing.declined++;
    } else {
      existing.pending++;
    }
    policyStatsByEmployee.set(ack.employeeId, existing);
  }
  const policyRows = rows
    .filter((e) => policyStatsByEmployee.has(e.id))
    .map((e) => ({ ...e, policyStats: policyStatsByEmployee.get(e.id)! }));
  const totalPoliciesPending = policyAcks.filter((a) => a.status === "PENDING").length;
  const totalPoliciesDeclined = policyAcks.filter((a) => a.status === "DECLINED").length;

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-primary/10 via-background to-background">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Employee Management</CardTitle>
              <CardDescription>Maintain employees by company and connect issued assets, licenses, and IT support records.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="w-fit">{companyId ? "Company filtered" : "All group companies"}</Badge>
              <Button variant="outline" size="sm" asChild>
                <a href="/api/employees/export" download><Download className="mr-1.5 h-4 w-4" />Export CSV</a>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric title="Employees" value={rows.length} tone="track" />
        <Metric title="Active" value={activeEmployees} tone="ok" />
        <Metric title="On Leave" value={onLeaveEmployees} tone={onLeaveEmployees ? "warning" : "ok"} />
        <Metric title="Assets Issued" value={assignedAssets} tone={assignedAssets ? "track" : "review"} />
        <Metric title="Licenses Assigned" value={assignedLicenses} tone={assignedLicenses ? "track" : "review"} />
      </section>

      <Tabs defaultValue="directory" className="space-y-4">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto min-w-max justify-start">
            <TabsTrigger value="directory">Directory</TabsTrigger>
            {canManage && <TabsTrigger value="create">Add Employee</TabsTrigger>}
            {canManage && <TabsTrigger value="import">Import CSV</TabsTrigger>}
            <TabsTrigger value="assets">Asset Custody</TabsTrigger>
            <TabsTrigger value="licenses">Licenses</TabsTrigger>
            <TabsTrigger value="policies" className="relative">
              Policies
              {totalPoliciesPending > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white leading-none">{totalPoliciesPending}</span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="directory" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Employee Directory</CardTitle>
              <CardDescription>{departments} department(s), {companyOptions.length} available company profile(s).</CardDescription>
            </CardHeader>
          </Card>
          <EmployeeTable employees={rows} companies={companyOptions} canManage={canManage} />
        </TabsContent>

        {canManage && (
          <TabsContent value="create">
            <EmployeeForm companies={companyOptions} />
          </TabsContent>
        )}

        {canManage && (
          <TabsContent value="import">
            <div className="flex flex-col items-start gap-4">
              <p className="text-sm text-muted-foreground">Bulk-import employees from a CSV file. Download the template, fill it in, and upload.</p>
              <CsvImportDialog type="employee" companies={companyOptions} buttonLabel="Import Employees from CSV" buttonVariant="default" />
            </div>
          </TabsContent>
        )}

        <TabsContent value="assets">
          <Card>
            <CardHeader>
              <CardTitle>Asset Custody</CardTitle>
              <CardDescription>Employees with laptops, servers, applications, or other assigned IT assets.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[520px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Asset</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Companies</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assetRows.map((row) => (
                      <TableRow key={`${row.employee.id}-${row.id}`}>
                        <TableCell>
                          <div className="font-medium">{row.employee.employeeId} / {row.employee.name}</div>
                          <div className="text-xs text-muted-foreground">{row.employee.department} / {row.employee.jobTitle}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{row.assetTag}</div>
                          <div className="text-xs text-muted-foreground">{row.name}</div>
                        </TableCell>
                        <TableCell><Badge variant="secondary">{formatEnum(row.type)}</Badge></TableCell>
                        <TableCell><CompanyBadges companies={row.employee.companies} /></TableCell>
                      </TableRow>
                    ))}
                    {assetRows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No assigned employee assets found.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="licenses">
          <Card>
            <CardHeader>
              <CardTitle>License Assignments</CardTitle>
              <CardDescription>Employee software licenses and subscriptions issued through IT Maintenance.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[520px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>License</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Companies</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {licenseRows.map((row) => (
                      <TableRow key={`${row.employee.id}-${row.id}`}>
                        <TableCell>
                          <div className="font-medium">{row.employee.employeeId} / {row.employee.name}</div>
                          <div className="text-xs text-muted-foreground">{row.employee.department} / {row.employee.jobTitle}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{row.licenseId}</div>
                          <div className="text-xs text-muted-foreground">{row.name}</div>
                        </TableCell>
                        <TableCell>{row.vendor}</TableCell>
                        <TableCell><CompanyBadges companies={row.employee.companies} /></TableCell>
                      </TableRow>
                    ))}
                    {licenseRows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No assigned employee licenses found.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="policies">
          <Card>
            <CardHeader className="border-b bg-gradient-to-r from-violet-50 to-transparent pb-3 dark:from-violet-950/20">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-violet-600" /> Policy Acknowledgement Status
              </CardTitle>
              <CardDescription>
                {policyAcks.length} policy assignments across {policyStatsByEmployee.size} employee(s).
                {totalPoliciesPending > 0 && <> <span className="font-medium text-amber-600">{totalPoliciesPending} pending</span>.</>}
                {totalPoliciesDeclined > 0 && <> <span className="font-medium text-destructive">{totalPoliciesDeclined} declined</span>.</>}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[520px] overflow-auto rounded-b-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-center">
                        <span className="flex items-center justify-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />Signed</span>
                      </TableHead>
                      <TableHead className="text-center">
                        <span className="flex items-center justify-center gap-1"><Clock className="h-3.5 w-3.5 text-amber-500" />Pending</span>
                      </TableHead>
                      <TableHead className="text-center">
                        <span className="flex items-center justify-center gap-1"><XCircle className="h-3.5 w-3.5 text-destructive" />Declined</span>
                      </TableHead>
                      <TableHead>Last Acknowledged</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {policyRows.map((row) => {
                      const { acknowledged, pending, declined, lastAcknowledgedAt } = row.policyStats;
                      const total = acknowledged + pending + declined;
                      const allSigned = pending === 0 && declined === 0;
                      const hasDeclined = declined > 0;
                      const hasPending = pending > 0;
                      return (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="font-medium">{row.employeeId} / {row.name}</div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{row.department ?? "—"}</TableCell>
                          <TableCell className="text-center">
                            <span className="font-semibold text-emerald-600">{acknowledged}</span>
                            <span className="text-xs text-muted-foreground">/{total}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            {pending > 0
                              ? <Badge variant="warning" className="tabular-nums">{pending}</Badge>
                              : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            {declined > 0
                              ? <Badge variant="destructive" className="tabular-nums">{declined}</Badge>
                              : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-sm">
                            {lastAcknowledgedAt
                              ? lastAcknowledgedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                              : <span className="text-muted-foreground">Never</span>}
                          </TableCell>
                          <TableCell>
                            {allSigned
                              ? <Badge variant="success">Compliant</Badge>
                              : hasDeclined
                                ? <Badge variant="destructive">Action Required</Badge>
                                : hasPending
                                  ? <Badge variant="warning">Pending</Badge>
                                  : <Badge variant="secondary">—</Badge>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {policyRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                          No policy acknowledgements found. Send policies to employees from the Policies module.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ title, value, tone }: { title: string; value: number; tone: "ok" | "review" | "track" | "warning" }) {
  const variant = tone === "ok" ? "success" : tone === "review" ? "secondary" : tone === "warning" ? "warning" : "secondary";
  const label = tone === "ok" ? "OK" : tone === "review" ? "Review" : tone === "warning" ? "On Leave" : "Track";
  return (
    <Card>
      <CardHeader className="space-y-0 pb-2">
        <CardTitle className="truncate text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between gap-3">
        <div className="text-3xl font-semibold leading-none">{value}</div>
        <Badge variant={variant}>{label}</Badge>
      </CardContent>
    </Card>
  );
}

function CompanyBadges({ companies }: { companies: { id: string; name: string; code: string }[] }) {
  return (
    <div className="flex max-w-72 flex-wrap gap-1">
      {companies.map((company) => <Badge key={company.id} variant="outline">{company.code}</Badge>)}
    </div>
  );
}

