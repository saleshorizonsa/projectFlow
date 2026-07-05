import PDFDocument from "pdfkit";
import { getPrisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const employee = await getPrisma().employee.findUnique({
    where: { id },
    include: {
      companies: { include: { company: { select: { name: true, code: true } } } },
      assets: {
        orderBy: { assetTag: "asc" },
        include: { companies: { include: { company: { select: { code: true } } } } },
      },
      licenses: { orderBy: { expiryDate: "asc" }, include: { asset: { select: { assetTag: true, name: true } } } },
    },
  });

  if (!employee) return new Response("Employee not found", { status: 404 });

  let photoBuffer: Buffer | null = null;
  if (employee.photoUrl) {
    try {
      const res = await fetch(employee.photoUrl);
      if (res.ok) photoBuffer = Buffer.from(await res.arrayBuffer());
    } catch { /* ignore */ }
  }

  const pdfBuffer = await buildPdf(employee, photoBuffer);

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${employee.employeeId}-handover.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

type EmployeeForPdf = {
  employeeId: string; name: string; department: string; jobTitle: string;
  email: string | null; phone: string | null; location: string | null; status: string;
  photoUrl: string | null;
  companies: { company: { name: string; code: string } }[];
  assets: {
    assetTag: string; name: string; vendor: string; model: string; type: string; status: string;
    companies: { company: { code: string } }[];
  }[];
  licenses: {
    licenseId: string; name: string; vendor: string; expiryDate: Date;
    asset: { assetTag: string; name: string } | null;
  }[];
};

function fmt(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function buildPdf(employee: EmployeeForPdf, photoBuffer: Buffer | null): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 100;
    const PRIMARY = "#2e5090";
    const AMBER = "#c87a1c";
    const MUTED = "#6b7280";
    const now = new Date();

    // ── Header ───────────────────────────────────────────────────────────────
    doc.fillColor(PRIMARY).fontSize(18).font("Helvetica-Bold").text("Employee Handover Record", 50, 50);
    doc.fillColor(MUTED).fontSize(9).font("Helvetica")
      .text(`Printed: ${now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`, 50, 73);

    const companyLine = employee.companies.map((l) => `${l.company.name} (${l.company.code})`).join(", ") || "No company";
    doc.fillColor(MUTED).fontSize(9).text(companyLine, 50, 73, { align: "right", width: W });

    doc.moveTo(50, 90).lineTo(50 + W, 90).strokeColor("#e5e7eb").lineWidth(1).stroke();
    doc.fillColor("#111827").fontSize(15).font("Helvetica-Bold").text(employee.name, 50, 100);
    doc.fillColor(MUTED).fontSize(10).font("Helvetica").text(`${employee.employeeId}  ·  ${employee.jobTitle}  ·  ${employee.department}`, 50, 118);

    let y = 142;

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
        if (pairs[i + 1]) { y = startY; row(pairs[i + 1][0], pairs[i + 1][1], 50 + half + 20, half); }
      }
    }

    // ── 1. Employee Details ───────────────────────────────────────────────────
    section("1. Employee Details");

    if (photoBuffer) {
      doc.image(photoBuffer, 50, y, { width: 56, height: 56 });
      const tx = 116; const tw = W - 66;
      const sy = y;
      doc.fillColor(MUTED).fontSize(8.5).font("Helvetica-Bold").text("EMPLOYEE ID", tx, sy, { width: tw / 2 });
      doc.fillColor("#111827").fontSize(9).font("Helvetica").text(employee.employeeId, tx + tw / 2, sy, { width: tw / 2 });
      doc.fillColor(MUTED).fontSize(8.5).font("Helvetica-Bold").text("FULL NAME", tx, sy + 14, { width: tw / 2 });
      doc.fillColor("#111827").fontSize(9).font("Helvetica").text(employee.name, tx + tw / 2, sy + 14, { width: tw / 2 });
      y += 64;
    } else {
      twoCol([["Employee ID", employee.employeeId], ["Full Name", employee.name]]);
    }

    twoCol([
      ["Department", employee.department],       ["Job Title", employee.jobTitle],
      ["Email", employee.email ?? "Not captured"], ["Phone", employee.phone ?? "Not captured"],
      ["Location", employee.location ?? "Not captured"], ["Status", fmt(employee.status)],
    ]);
    row("Companies", companyLine);

    // ── 2. Assets Provided ────────────────────────────────────────────────────
    section("2. Assets Provided");
    if (employee.assets.length > 0) {
      const cols = [W * 0.18, W * 0.28, W * 0.18, W * 0.16, W * 0.20];
      const headers = ["Tag", "Name", "Type", "Vendor / Model", "Status"];
      doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold");
      let cx = 50;
      headers.forEach((h, i) => { doc.text(h, cx, y, { width: cols[i] }); cx += cols[i]; });
      y += 12;
      doc.moveTo(50, y).lineTo(50 + W, y).strokeColor("#e5e7eb").lineWidth(0.3).stroke();
      y += 4;
      for (const a of employee.assets) {
        cx = 50;
        [a.assetTag, a.name, fmt(a.type), `${a.vendor} / ${a.model}`, fmt(a.status)].forEach((v, i) => {
          doc.fillColor("#111827").fontSize(8.5).font("Helvetica").text(v, cx, y, { width: cols[i] });
          cx += cols[i];
        });
        y += 13;
      }
    } else {
      doc.fillColor(MUTED).fontSize(9).font("Helvetica").text("No assets assigned.", 50, y); y += 14;
    }

    // ── 3. Licenses Assigned ──────────────────────────────────────────────────
    section("3. Licenses Assigned");
    if (employee.licenses.length > 0) {
      const cols = [W * 0.20, W * 0.28, W * 0.18, W * 0.20, W * 0.14];
      const headers = ["License ID", "Name", "Vendor", "Linked Asset", "Expiry"];
      doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold");
      let cx = 50;
      headers.forEach((h, i) => { doc.text(h, cx, y, { width: cols[i] }); cx += cols[i]; });
      y += 12;
      doc.moveTo(50, y).lineTo(50 + W, y).strokeColor("#e5e7eb").lineWidth(0.3).stroke();
      y += 4;
      const nowMs = now.getTime();
      for (const lic of employee.licenses) {
        const expired = new Date(lic.expiryDate).getTime() < nowMs;
        cx = 50;
        [
          lic.licenseId,
          lic.name,
          lic.vendor,
          lic.asset ? `${lic.asset.assetTag} / ${lic.asset.name}` : "Unlinked",
          new Date(lic.expiryDate).toLocaleDateString("en-GB"),
        ].forEach((v, i) => {
          doc.fillColor(expired && i === 4 ? "#dc2626" : "#111827").fontSize(8.5).font("Helvetica").text(v, cx, y, { width: cols[i] });
          cx += cols[i];
        });
        y += 13;
      }
    } else {
      doc.fillColor(MUTED).fontSize(9).font("Helvetica").text("No licenses assigned.", 50, y); y += 14;
    }

    // ── Signature blocks ──────────────────────────────────────────────────────
    y += 20;
    if (y > 680) doc.addPage();
    doc.moveTo(50, y).lineTo(50 + W, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
    y += 4;
    doc.fillColor(MUTED).fontSize(8).font("Helvetica-Bold").text("SIGNATURES", 50, y);
    y += 20;

    const sigW = (W - 40) / 3;
    [
      { label: "Employee", sub: "I confirm the details above are accurate." },
      { label: "Line Manager", sub: "Approved by" },
      { label: "IT / HR", sub: "Clearance confirmed by" },
    ].forEach(({ label, sub }, i) => {
      const sx = 50 + i * (sigW + 20);
      doc.moveTo(sx, y + 30).lineTo(sx + sigW, y + 30).strokeColor("#374151").lineWidth(0.5).stroke();
      doc.fillColor("#111827").fontSize(8.5).font("Helvetica-Bold").text(label, sx, y + 34);
      doc.fillColor(MUTED).fontSize(7.5).font("Helvetica").text(sub, sx, y + 45);
    });

    // Footer
    const pageHeight = doc.page.height;
    doc.fillColor(AMBER).fontSize(7).font("Helvetica")
      .text("HorizonMiyaar · By Horizon Business Solutions Est. · Confidential", 50, pageHeight - 40, { align: "center", width: W });

    doc.end();
  });
}
