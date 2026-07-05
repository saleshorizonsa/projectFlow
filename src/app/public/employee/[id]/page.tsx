import { notFound } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { formatEnum } from "@/lib/utils";

const NAVY = "#2e5090";
const AMBER = "#c87a1c";

export default async function PublicEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const employee = await getPrisma().employee.findUnique({
    where: { id },
    include: {
      companies: { include: { company: { select: { name: true, code: true } } } },
      assets: {
        orderBy: { assetTag: "asc" },
        select: { id: true, assetTag: true, name: true, vendor: true, model: true, type: true, status: true },
      },
      licenses: {
        orderBy: { expiryDate: "asc" },
        include: { asset: { select: { assetTag: true, name: true } } },
      },
    },
  });

  if (!employee) notFound();

  const now = new Date();

  return (
    <div className="min-h-screen bg-gray-50 pb-10">

      {/* ── Brand header ── */}
      <div style={{ background: `linear-gradient(135deg, #0d1a2e 0%, ${NAVY} 100%)` }} className="px-4 py-5">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/Logo with Tagline.jpg" alt="HorizonMiyaar" className="h-9 w-auto object-contain mb-1"
                 style={{ filter: "brightness(1.15)" }} />
            <p className="text-xs" style={{ color: "rgba(200,160,80,0.7)" }}>Employee Handover Record — No login required</p>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-white">{employee.name}</div>
            <div className="text-xs text-blue-300">{employee.employeeId}</div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-5">

        {/* ── Download PDF button ── */}
        <a
          href={`/api/public/employee-pdf/${id}`}
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

        {/* ── Employee details ── */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 font-semibold text-sm text-white" style={{ backgroundColor: NAVY }}>
            Employee Details
          </div>
          {employee.photoUrl && (
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={employee.photoUrl} alt={employee.name}
                   className="h-14 w-14 rounded-full object-cover ring-2 ring-gray-200" />
              <div>
                <div className="font-semibold">{employee.name}</div>
                <div className="text-xs text-gray-500">{employee.jobTitle} · {employee.department}</div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-px bg-gray-100">
            <Cell label="Employee ID" value={employee.employeeId} />
            <Cell label="Status" value={formatEnum(employee.status)} />
            <Cell label="Department" value={employee.department} />
            <Cell label="Job Title" value={employee.jobTitle} />
            <Cell label="Email" value={employee.email ?? "Not captured"} />
            <Cell label="Phone" value={employee.phone ?? "Not captured"} />
            <Cell label="Location" value={employee.location ?? "Not captured"} />
            <Cell label="Companies" value={employee.companies.map(l => `${l.company.name} (${l.company.code})`).join(", ") || "—"} />
          </div>
        </div>

        {/* ── Assets ── */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 font-semibold text-sm text-white" style={{ backgroundColor: NAVY }}>
            Assets Provided ({employee.assets.length})
          </div>
          {employee.assets.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {employee.assets.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">{a.assetTag} — {a.name}</div>
                    <div className="text-xs text-gray-500">{a.vendor} / {a.model} · {formatEnum(a.type)}</div>
                  </div>
                  <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded px-2 py-0.5">
                    {formatEnum(a.status)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-3 text-sm text-gray-400">No assets assigned.</p>
          )}
        </div>

        {/* ── Licenses ── */}
        {employee.licenses.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 font-semibold text-sm text-white" style={{ backgroundColor: NAVY }}>
              Licenses Assigned ({employee.licenses.length})
            </div>
            <div className="divide-y divide-gray-100">
              {employee.licenses.map((lic) => {
                const expired = new Date(lic.expiryDate) < now;
                return (
                  <div key={lic.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-sm font-medium">{lic.name}</div>
                      <div className="text-xs text-gray-500">
                        {lic.licenseId} · {lic.vendor}
                        {lic.asset && <> · {lic.asset.assetTag}</>}
                      </div>
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

        {/* ── Signature blocks ── */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 font-semibold text-sm text-white" style={{ backgroundColor: NAVY }}>
            Signatures
          </div>
          <div className="grid grid-cols-3 divide-x divide-gray-100 px-4 py-6 gap-2">
            {["Employee", "Line Manager", "IT / HR"].map((label) => (
              <div key={label} className="text-center">
                <div className="border-b border-gray-300 mb-2 pb-8" />
                <div className="text-xs font-medium text-gray-700">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <p className="text-center text-xs text-gray-400 pt-2">
          © {now.getFullYear()} Horizon Business Solutions Est. · HorizonMiyaar
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
