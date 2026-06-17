import { SupportTicketDesk } from "@/components/support/support-ticket-desk";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { assetCompanyWhere, selectedCompanyId, userCompanyWhere, type CompanySearchParams } from "@/lib/company-filter";
import { getPrisma } from "@/lib/prisma";

export default async function SupportTicketsPage({ searchParams }: { searchParams?: Promise<CompanySearchParams> }) {
  const prisma = getPrisma();
  const companyId = await selectedCompanyId(searchParams);
  const [tickets, companies, employees, assets, licenses, users] = await Promise.all([
    prisma.supportTicket.findMany({
      where: companyId ? { companyId } : {},
      include: {
        company: true,
        employee: true,
        asset: true,
        license: true,
        assignedTo: true,
        events: { include: { author: true }, orderBy: { createdAt: "desc" }, take: 4 },
      },
      orderBy: [{ status: "asc" }, { priority: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.company.findMany({ where: companyId ? { id: companyId, active: true } : { active: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ where: companyId ? { companies: { some: { companyId } } } : {}, include: { companies: { include: { company: true } } }, orderBy: { name: "asc" } }),
    prisma.iTAsset.findMany({ where: assetCompanyWhere(companyId), include: { companies: { include: { company: true } } }, orderBy: { name: "asc" } }),
    prisma.iTLicense.findMany({ where: companyId ? { OR: [{ asset: assetCompanyWhere(companyId) }, { employee: { companies: { some: { companyId } } } }, { assetId: null, employeeId: null }] } : {}, include: { asset: true, employee: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: userCompanyWhere(companyId), orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Support Ticket Register</CardTitle>
          <CardDescription>Triage, assign, update status, add action notes, and close support tickets.</CardDescription>
        </CardHeader>
      </Card>
      <SupportTicketDesk
        tickets={tickets.map((ticket) => ({
          id: ticket.id,
          ticketNo: ticket.ticketNo,
          title: ticket.title,
          description: ticket.description,
          companyId: ticket.companyId,
          companyName: ticket.company.name,
          companyCode: ticket.company.code,
          employeeId: ticket.employeeId,
          employeeName: ticket.employee ? `${ticket.employee.employeeId} / ${ticket.employee.name}` : null,
          assetId: ticket.assetId,
          assetName: ticket.asset ? `${ticket.asset.assetTag} / ${ticket.asset.name}` : null,
          licenseId: ticket.licenseId,
          licenseName: ticket.license ? ticket.license.name : null,
          category: ticket.category,
          priority: ticket.priority,
          status: ticket.status,
          source: ticket.source,
          requesterName: ticket.requesterName,
          requesterPhone: ticket.requesterPhone,
          assignedToId: ticket.assignedToId,
          assignedToName: ticket.assignedTo?.name ?? null,
          firstResponseDueAt: ticket.firstResponseDueAt?.toISOString() ?? null,
          resolveDueAt: ticket.resolveDueAt?.toISOString() ?? null,
          respondedAt: ticket.respondedAt?.toISOString() ?? null,
          slaBreached: ticket.slaBreached,
          createdAt: ticket.createdAt.toISOString(),
          updatedAt: ticket.updatedAt.toISOString(),
          events: ticket.events.map((event) => ({
            id: event.id,
            body: event.body,
            direction: event.direction,
            source: event.source,
            authorName: event.author?.name ?? null,
            createdAt: event.createdAt.toISOString(),
          })),
        }))}
        companies={companies.map((company) => ({ id: company.id, name: company.name, code: company.code }))}
        employees={employees.map((employee) => ({ id: employee.id, name: `${employee.employeeId} / ${employee.name}`, companyIds: employee.companies.map((link) => link.companyId) }))}
        assets={assets.map((asset) => ({ id: asset.id, name: `${asset.assetTag} / ${asset.name}`, companyIds: asset.companies.map((link) => link.companyId) }))}
        licenses={licenses.map((license) => ({ id: license.id, name: license.asset ? `${license.name} / ${license.asset.assetTag}` : license.employee ? `${license.name} / ${license.employee.employeeId}` : license.name }))}
        users={users.map((user) => ({ id: user.id, name: user.name }))}
        showForm={false}
      />
    </div>
  );
}
