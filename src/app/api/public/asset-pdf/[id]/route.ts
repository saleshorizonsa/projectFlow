import PDFDocument from "pdfkit";
import { differenceInYears } from "date-fns";
import { getPrisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const asset = await getPrisma().iTAsset.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { name: true, email: true } },
      employee: {
        select: {
          employeeId: true, name: true, department: true, jobTitle: true,
          email: true, phone: true, location: true, status: true, photoUrl: true,
        },
      },
      companies: { include: { company: { select: { name: true, code: true } } } },

      licenses: { orderBy: { expiryDate: "asc" }, select: { licenseId: true, name: true, vendor: true, expiryDate: true } },
      maintenances: {
        orderBy: { scheduledAt: "desc" },
        take: 10,
        select: { maintenanceId: true, title: true, scheduledAt: true, durationMinutes: true, status: true, responsible: { select: { name: true } } },
      },
    },
  });

  if (!asset) return new Response("Asset not found", { status: 404 });

  const pdfBuffer = await buildPdf(asset);

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${asset.assetTag}-record.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

type AssetForPdf = {
  assetTag: string;
  name: string;
  type: string;
  vendor: string;
  model: string;
  location: string;
  purchaseDate: Date;
  lifecycleYears: number;
  status: string;
  notes: string | null;
  assignedTo: { name: string; email: string | null } | null;
  employee: {
    employeeId: string; name: string; department: string; jobTitle: string;
    email: string | null; phone: string | null; location: string | null; status: string; photoUrl: string | null;
  } | null;
  companies: { company: { name: string; code: string } }[];
  licenses: { licenseId: string; name: string; vendor: string; expiryDate: Date }[];
  maintenances: { maintenanceId: string; title: string; scheduledAt: Date; durationMinutes: number; status: string; responsible: { name: string } }[];
};

// ── PDF builder ──────────────────────────────────────────────────────────────

function fmt(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function buildPdf(asset: AssetForPdf): Promise<Buffer> {
  // Pre-fetch employee photo if available
  let photoBuffer: Buffer | null = null;
  if (asset.employee?.photoUrl) {
    try {
      const res = await fetch(asset.employee.photoUrl);
      if (res.ok) photoBuffer = Buffer.from(await res.arrayBuffer());
    } catch { /* ignore */ }
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 100;
    const PRIMARY = "#1d4ed8";
    const MUTED = "#6b7280";
    const now = new Date();
    const ageYears = differenceInYears(now, asset.purchaseDate);

    // ── Header ──────────────────────────────────────────────────────────────
    doc.fillColor(PRIMARY).fontSize(18).font("Helvetica-Bold").text("Asset Record", 50, 50);
    doc.fillColor(MUTED).fontSize(9).font("Helvetica")
      .text(`Printed: ${now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`, 50, 73);

    const companyLine = asset.companies.map((l) => `${l.company.name} (${l.company.code})`).join(", ") || "No company";
    doc.fillColor(MUTED).fontSize(9).text(companyLine, 50, 73, { align: "right", width: W });

    doc.moveTo(50, 90).lineTo(50 + W, 90).strokeColor("#e5e7eb").lineWidth(1).stroke();

    doc.fillColor("#111827").fontSize(15).font("Helvetica-Bold").text(`${asset.assetTag} / ${asset.name}`, 50, 100);
    doc.fillColor(MUTED).fontSize(10).font("Helvetica").text(`${asset.vendor}  ·  ${asset.model}`, 50, 118);

    let y = 142;

    // ── Helpers ──────────────────────────────────────────────────────────────
    function section(title: string) {
      y += 10;
      doc.fillColor(PRIMARY).fontSize(11).font("Helvetica-Bold").text(title, 50, y);
      y += 14;
      doc.moveTo(50, y).lineTo(50 + W, y).strokeColor("#bfdbfe").lineWidth(0.5).stroke();
      y += 6;
    }

    function row(label: string, value: string, x = 50, colW = W) {
      const startY = y;
      doc.fillColor(MUTED).fontSize(8.5).font("Helvetica-Bold").text(label.toUpperCase(), x, startY, { width: colW / 3 });
      doc.fillColor("#111827").fontSize(9).font("Helvetica").text(value || "—", x + colW / 3, startY, { width: (colW * 2) / 3 });
      y += 14;
    }

    function twoCol(pairs: [string, string][]) {
      const half = W / 2 - 10;
      for (let i = 0; i < pairs.length; i += 2) {
        const startY = y;
        row(pairs[i][0], pairs[i][1], 50, half);
        if (pairs[i + 1]) {
          y = startY;
          row(pairs[i + 1][0], pairs[i + 1][1], 50 + half + 20, half);
        }
      }
    }

    // ── 1. Asset Details ─────────────────────────────────────────────────────
    section("1. Asset Details");
    twoCol([
      ["Asset Tag", asset.assetTag],       ["Name", asset.name],
      ["Type", fmt(asset.type)],           ["Status", fmt(asset.status)],
      ["Vendor", asset.vendor],            ["Model", asset.model],
      ["Location", asset.location],        ["Purchase Date", asset.purchaseDate.toLocaleDateString("en-GB")],
      ["Age", `${ageYears} year${ageYears !== 1 ? "s" : ""}`], ["Lifecycle", `${asset.lifecycleYears} years`],
    ]);
    if (asset.notes) row("Notes", asset.notes);

    // ── 2. Assigned Employee ─────────────────────────────────────────────────
    section("2. Assigned Employee");
    if (asset.employee) {
      const e = asset.employee;
      if (photoBuffer) {
        doc.image(photoBuffer, 50, y, { width: 56, height: 56 });
        const textX = 116;
        const textW = W - 66;
        const startY = y;
        doc.fillColor(MUTED).fontSize(8.5).font("Helvetica-Bold").text("EMPLOYEE ID", textX, startY, { width: textW / 2 });
        doc.fillColor("#111827").fontSize(9).font("Helvetica").text(e.employeeId, textX + textW / 2, startY, { width: textW / 2 });
        doc.fillColor(MUTED).fontSize(8.5).font("Helvetica-Bold").text("FULL NAME", textX, startY + 14, { width: textW / 2 });
        doc.fillColor("#111827").fontSize(9).font("Helvetica").text(e.name, textX + textW / 2, startY + 14, { width: textW / 2 });
        y += 64;
      } else {
        twoCol([["Employee ID", e.employeeId], ["Full Name", e.name]]);
      }
      twoCol([
        ["Department", e.department],      ["Job Title", e.jobTitle],
        ["Email", e.email ?? "Not captured"], ["Phone", e.phone ?? "Not captured"],
        ["Location", e.location ?? "Not captured"], ["Status", fmt(e.status)],
      ]);
    } else {
      doc.fillColor(MUTED).fontSize(9).font("Helvetica").text("No employee assigned.", 50, y);
      y += 14;
    }

    // ── 3. IT Custodian ──────────────────────────────────────────────────────
    if (asset.assignedTo) {
      section("3. IT Custodian");
      twoCol([
        ["Name", asset.assignedTo.name],
        ["Email", asset.assignedTo.email ?? "Not captured"],
      ]);
    }

    const sNum = asset.assignedTo ? 4 : 3;

    // ── 4. Software Licenses ─────────────────────────────────────────────────
    section(`${sNum}. Software Licenses`);
    if (asset.licenses.length > 0) {
      const cols = [W * 0.22, W * 0.3, W * 0.22, W * 0.14, W * 0.12];
      const headers = ["License ID", "Name", "Vendor", "Expiry", "Status"];
      doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold");
      let cx = 50;
      headers.forEach((h, i) => { doc.text(h, cx, y, { width: cols[i] }); cx += cols[i]; });
      y += 12;
      doc.moveTo(50, y).lineTo(50 + W, y).strokeColor("#e5e7eb").lineWidth(0.3).stroke();
      y += 4;
      for (const lic of asset.licenses) {
        const expired = new Date(lic.expiryDate) < now;
        cx = 50;
        [lic.licenseId, lic.name, lic.vendor, new Date(lic.expiryDate).toLocaleDateString("en-GB"), expired ? "EXPIRED" : "Active"].forEach((v, i) => {
          doc.fillColor(expired && i === 4 ? "#dc2626" : "#111827").fontSize(8.5).font("Helvetica").text(v, cx, y, { width: cols[i] });
          cx += cols[i];
        });
        y += 13;
      }
    } else {
      doc.fillColor(MUTED).fontSize(9).font("Helvetica").text("No licenses linked.", 50, y);
      y += 14;
    }

    // ── 5. Maintenance History ───────────────────────────────────────────────
    section(`${sNum + 1}. Maintenance History`);
    if (asset.maintenances.length > 0) {
      const cols = [W * 0.18, W * 0.32, W * 0.16, W * 0.16, W * 0.18];
      const headers = ["ID", "Title", "Scheduled", "Duration", "Status"];
      doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold");
      let cx = 50;
      headers.forEach((h, i) => { doc.text(h, cx, y, { width: cols[i] }); cx += cols[i]; });
      y += 12;
      doc.moveTo(50, y).lineTo(50 + W, y).strokeColor("#e5e7eb").lineWidth(0.3).stroke();
      y += 4;
      for (const m of asset.maintenances) {
        cx = 50;
        [m.maintenanceId, m.title, new Date(m.scheduledAt).toLocaleDateString("en-GB"), `${m.durationMinutes} min`, fmt(m.status)].forEach((v, i) => {
          doc.fillColor("#111827").fontSize(8.5).font("Helvetica").text(v, cx, y, { width: cols[i] });
          cx += cols[i];
        });
        y += 13;
      }
    } else {
      doc.fillColor(MUTED).fontSize(9).font("Helvetica").text("No maintenance records.", 50, y);
      y += 14;
    }

    // ── Signature blocks ─────────────────────────────────────────────────────
    y += 20;
    if (y > 680) doc.addPage();
    doc.moveTo(50, y).lineTo(50 + W, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
    y += 4;
    doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold").text("SIGNATURES", 50, y);
    y += 20;

    const sigW = (W - 40) / 3;
    const sigData = [
      { label: "Employee", sub: "I confirm receipt of this asset." },
      { label: "IT Custodian", sub: "Issued by" },
      { label: "Manager", sub: "Approved by" },
    ];
    sigData.forEach(({ label, sub }, i) => {
      const sx = 50 + i * (sigW + 20);
      doc.moveTo(sx, y + 30).lineTo(sx + sigW, y + 30).strokeColor("#374151").lineWidth(0.5).stroke();
      doc.fillColor("#111827").fontSize(8.5).font("Helvetica-Bold").text(label, sx, y + 34);
      doc.fillColor(MUTED).fontSize(7.5).font("Helvetica").text(sub, sx, y + 45);
    });

    doc.end();
  });
}
