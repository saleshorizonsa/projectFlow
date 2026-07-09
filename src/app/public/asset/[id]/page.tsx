import { notFound } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { formatEnum } from "@/lib/utils";

const NAVY = "#2e5090";
const AMBER = "#c87a1c";

export default async function PublicAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const asset = await getPrisma().iTAsset.findUnique({
    where: { id },
    include: {
      employee: {
        select: {
          employeeId: true, name: true, department: true, jobTitle: true,
          email: true, phone: true, location: true, status: true, photoUrl: true,
        },
      },
      companies: { include: { company: { select: { name: true, code: true, logoUrl: true } } } },
      licenses: { orderBy: { expiryDate: "asc" }, select: { licenseId: true, name: true, vendor: true, expiryDate: true } },
    },
  });

  if (!asset) notFound();

  const now = new Date();

  return (
    <div className="min-h-screen bg-gray-50 pb-10">

      {/* ── Brand header ── */}
      <div style={{ background: `linear-gradient(135deg, #0d1a2e 0%, ${NAVY} 100%)` }} className="px-4 py-5">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <div>
            <div className="text-base font-bold text-white mb-0.5">JASCOMiyaar</div>
            <p className="text-xs" style={{ color: "rgba(148,163,184,0.7)" }}>Asset Record — No login required</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-white">{asset.assetTag}</div>
            <div className="text-xs text-blue-300">{asset.name}</div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-5">

        {/* ── Download PDF button ── */}
        <a
          href={`/api/public/asset-pdf/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ backgroundColor: AMBER }}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-bold text-white shadow-md active:opacity-90"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h4a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          Download / View PDF
        </a>

        {/* ── Asset Details ── */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 font-semibold text-sm text-white" style={{ backgroundColor: NAVY }}>
            Asset Details
          </div>
          <div className="grid grid-cols-2 gap-px bg-gray-100">
            <Cell label="Asset Tag" value={asset.assetTag} />
            <Cell label="Name" value={asset.name} />
            <Cell label="Type" value={formatEnum(asset.type)} />
            <Cell label="Status" value={formatEnum(asset.status)} />
            <Cell label="Vendor" value={asset.vendor} />
            <Cell label="Model" value={asset.model} />
            <Cell label="Location" value={asset.location} />
            <Cell label="Purchase Date" value={new Date(asset.purchaseDate).toLocaleDateString("en-GB")} />
            <Cell label="Companies" value={asset.companies.map(l => l.company.code).join(", ") || "—"} wide />
            {asset.notes && <Cell label="Notes" value={asset.notes} wide />}
          </div>
        </div>

        {/* ── Assigned Employee ── */}
        {asset.employee ? (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 font-semibold text-sm text-white" style={{ backgroundColor: NAVY }}>
              Assigned Employee
            </div>
            {asset.employee.photoUrl && (
              <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.employee.photoUrl} alt={asset.employee.name}
                     className="h-14 w-14 rounded-full object-cover ring-2 ring-gray-200" />
                <div>
                  <div className="font-semibold">{asset.employee.name}</div>
                  <div className="text-xs text-gray-500">{asset.employee.jobTitle} · {asset.employee.department}</div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-px bg-gray-100">
              <Cell label="Employee ID" value={asset.employee.employeeId} />
              <Cell label="Name" value={asset.employee.name} />
              <Cell label="Department" value={asset.employee.department} />
              <Cell label="Job Title" value={asset.employee.jobTitle} />
              <Cell label="Email" value={asset.employee.email ?? "Not captured"} />
              <Cell label="Phone" value={asset.employee.phone ?? "Not captured"} />
              <Cell label="Location" value={asset.employee.location ?? "Not captured"} />
              <Cell label="Status" value={formatEnum(asset.employee.status)} />
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-4 py-4 text-sm text-gray-400">
            No employee assigned to this asset.
          </div>
        )}

        {/* ── Licenses ── */}
        {asset.licenses.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 font-semibold text-sm text-white" style={{ backgroundColor: NAVY }}>
              Software Licenses
            </div>
            <div className="divide-y divide-gray-100">
              {asset.licenses.map((lic) => {
                const expired = new Date(lic.expiryDate) < now;
                return (
                  <div key={lic.licenseId} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-sm font-medium">{lic.name}</div>
                      <div className="text-xs text-gray-500">{lic.licenseId} · {lic.vendor}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">{new Date(lic.expiryDate).toLocaleDateString("en-GB")}</div>
                      <span className={`text-xs font-medium ${expired ? "text-red-600" : "text-green-600"}`}>
                        {expired ? "Expired" : "Active"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <p className="text-center text-xs text-gray-400 pt-2">
          © {now.getFullYear()} Horizon Business Solutions Est. · JASCOMiyaar
        </p>
      </div>
    </div>
  );
}

function Cell({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`bg-white px-4 py-2.5 ${wide ? "col-span-2" : ""}`}>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-sm font-medium text-gray-900 break-words">{value}</div>
    </div>
  );
}
