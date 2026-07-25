// Multi-page PDF generator for the cybersecurity compliance evidence report.
// Hand-rolled PDF writer (same approach as simple-pdf.ts) to avoid pdfkit font
// bundling issues on Vercel serverless. ASCII-only text (Helvetica/WinAnsi).

function esc(value: string): string {
  // Drop non-Latin1 chars that Helvetica's default encoding can't render.
  const ascii = value.replace(/[^\x20-\x7E]/g, "");
  return ascii.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function trunc(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 2) + ".." : str;
}

function buildMultiPagePdf(pageStreams: string[]): Buffer {
  const n = pageStreams.length;
  const objects: string[] = [];

  // Fixed objects: 1 Catalog, 2 Pages, 3 Font F1, 4 Font F2.
  // Then per page i: page object (5 + 2i) and content object (6 + 2i).
  const pageObjNums = pageStreams.map((_, i) => 5 + i * 2);
  const kids = pageObjNums.map((num) => `${num} 0 R`).join(" ");

  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
  objects.push(`2 0 obj << /Type /Pages /Kids [${kids}] /Count ${n} >> endobj`);
  objects.push("3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj");
  objects.push("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj");

  for (let i = 0; i < n; i++) {
    const pnum = pageObjNums[i];
    const cnum = pnum + 1;
    const stream = pageStreams[i];
    objects.push(
      `${pnum} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${cnum} 0 R >> endobj`,
    );
    objects.push(`${cnum} 0 obj << /Length ${Buffer.byteLength(stream, "utf8")} >> stream\n${stream}\nendstream endobj`);
  }

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${obj}\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  const size = objects.length + 1;
  pdf += `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

// ── Report data shape ─────────────────────────────────────────────────────────

export type ComplianceReportData = {
  organization: string;
  framework: { code: string; name: string; version: string };
  generatedAt: string;
  overall: { compliant: number; total: number; pct: number };
  statusCounts: { label: string; count: number }[];
  domains: {
    code: string;
    name: string;
    score: { compliant: number; total: number; pct: number };
    controls: {
      controlId: string;
      title: string;
      status: string;
      responsible: string;
      evidenceCount: number;
      lastAssessed: string;
    }[];
  }[];
  gaps: { controlId: string; title: string; status: string; notes: string }[];
  notAssessedCount: number;
};

const STATUS_SHORT: Record<string, string> = {
  COMPLIANT: "Compliant",
  PARTIALLY_COMPLIANT: "Partial",
  NON_COMPLIANT: "Non-Comp.",
  NOT_ASSESSED: "Not Assessed",
  NOT_APPLICABLE: "N/A",
};

// ── Layout engine (auto-paginating) ───────────────────────────────────────────

const L = 40;
const R = 555;
const TOP = 800;
const BOTTOM = 60;

export function buildComplianceReportPdf(data: ComplianceReportData): Buffer {
  const pages: string[][] = [];
  let ops: string[] = [];
  let y = TOP;

  const flush = () => {
    if (ops.length) pages.push(ops);
  };
  const newPage = () => {
    flush();
    ops = [];
    y = TOP;
  };
  const need = (space: number) => {
    if (y - space < BOTTOM) newPage();
  };
  const put = (text: string, x: number, size: number, bold = false) => {
    ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${esc(text)}) Tj ET`);
  };
  const hr = (weight = 0.5) => {
    ops.push(`${L} ${y} m ${R} ${y} l ${weight} w S`);
  };
  const seg = (x1: number, x2: number, weight = 0.5) => {
    ops.push(`${x1} ${y} m ${x2} ${y} l ${weight} w S`);
  };

  // ── Page 1: Cover ────────────────────────────────────────────────────────
  y = 720;
  put(trunc(data.organization, 60), L, 24, true);
  y -= 34;
  put("Cybersecurity Compliance Evidence Report", L, 15, true);
  y -= 24;
  hr(1.2);
  y -= 26;

  put("Framework", L, 9);
  put(`${data.framework.code} - ${data.framework.name}`, L + 110, 11, true);
  y -= 20;
  put("Version", L, 9);
  put(data.framework.version, L + 110, 11);
  y -= 20;
  put("Report Generated", L, 9);
  put(data.generatedAt, L + 110, 11);
  y -= 20;
  put("Overall Compliance", L, 9);
  put(`${data.overall.pct}%  (${data.overall.compliant} of ${data.overall.total} applicable controls)`, L + 110, 11, true);
  y -= 40;

  hr(0.5);
  y -= 18;
  put("Scope & Status Summary", L, 12, true);
  y -= 18;
  for (const s of data.statusCounts) {
    put(`${s.label}`, L + 8, 10);
    put(`${s.count}`, L + 200, 10, true);
    y -= 15;
  }

  y = 130;
  hr(0.5);
  y -= 16;
  put("CONFIDENTIAL - Prepared for cybersecurity compliance audit purposes.", L, 8);
  y -= 12;
  put("Evidence in this report is generated from live system records at the time of generation.", L, 8);
  y -= 12;
  put("Control assessments reflect self-assessed status pending independent audit verification.", L, 8);

  // ── Executive Summary: domain scores ─────────────────────────────────────
  newPage();
  put("Executive Summary - Domain Scores", L, 14, true);
  y -= 8;
  hr(1);
  y -= 20;

  const dCols = { code: L, name: L + 55, comp: L + 380, pct: L + 470 };
  const domainHeader = () => {
    put("Code", dCols.code, 8, true);
    put("Domain", dCols.name, 8, true);
    put("Compliant", dCols.comp, 8, true);
    put("Score", dCols.pct, 8, true);
    y -= 4;
    hr(0.4);
    y -= 12;
  };
  domainHeader();
  for (const d of data.domains) {
    need(16);
    if (y === TOP) domainHeader();
    put(trunc(d.code, 8), dCols.code, 9);
    put(trunc(d.name, 52), dCols.name, 9);
    put(`${d.score.compliant}/${d.score.total}`, dCols.comp, 9);
    put(`${d.score.pct}%`, dCols.pct, 9, true);
    y -= 15;
  }

  // ── Per-domain control detail ────────────────────────────────────────────
  const cCols = { id: L, title: L + 60, status: L + 262, owner: L + 340, ev: L + 430, date: L + 470 };
  const controlHeader = () => {
    put("Control", cCols.id, 7, true);
    put("Title", cCols.title, 7, true);
    put("Status", cCols.status, 7, true);
    put("Responsible", cCols.owner, 7, true);
    put("Evid.", cCols.ev, 7, true);
    put("Assessed", cCols.date, 7, true);
    y -= 4;
    hr(0.4);
    y -= 11;
  };

  for (const d of data.domains) {
    need(60);
    y -= 6;
    put(`${d.code} - ${d.name}`, L, 11, true);
    put(`${d.score.pct}% (${d.score.compliant}/${d.score.total})`, R - 90, 10, true);
    y -= 14;
    controlHeader();
    for (const c of d.controls) {
      need(14);
      if (y > TOP - 5) controlHeader();
      put(trunc(c.controlId, 12), cCols.id, 7.5);
      put(trunc(c.title, 34), cCols.title, 7.5);
      put(STATUS_SHORT[c.status] ?? c.status, cCols.status, 7.5);
      put(trunc(c.responsible, 13), cCols.owner, 7.5);
      put(String(c.evidenceCount), cCols.ev, 7.5);
      put(c.lastAssessed, cCols.date, 7.5);
      y -= 12;
    }
    y -= 6;
  }

  // ── Remediation / gaps ───────────────────────────────────────────────────
  newPage();
  put("Remediation Items - Non-Compliant & Partial Controls", L, 13, true);
  y -= 8;
  hr(1);
  y -= 18;

  if (data.gaps.length === 0) {
    put("No controls are currently marked Non-Compliant or Partially Compliant.", L, 10);
    y -= 16;
  } else {
    for (const g of data.gaps) {
      need(40);
      put(`${trunc(g.controlId, 14)}  -  ${STATUS_SHORT[g.status] ?? g.status}`, L, 9.5, true);
      y -= 13;
      put(trunc(g.title, 90), L + 8, 9);
      y -= 12;
      if (g.notes) {
        const words = g.notes.split(/\s+/);
        let lineStr = "";
        for (const w of words) {
          if ((lineStr + " " + w).length > 100) {
            put(trunc(lineStr, 100), L + 8, 8);
            y -= 10;
            need(14);
            lineStr = w;
          } else {
            lineStr = lineStr ? `${lineStr} ${w}` : w;
          }
        }
        if (lineStr) {
          put(trunc(lineStr, 100), L + 8, 8);
          y -= 10;
        }
      }
      y -= 6;
      seg(L, R, 0.3);
      y -= 10;
    }
  }

  if (data.notAssessedCount > 0) {
    need(24);
    y -= 6;
    put(`Note: ${data.notAssessedCount} control(s) remain "Not Assessed" and must be evaluated before audit submission.`, L, 8.5, true);
  }

  flush();

  // ── Footers with page numbers ────────────────────────────────────────────
  const total = pages.length;
  const footer = `${data.framework.code} Compliance Report  -  ${data.organization}  -  CONFIDENTIAL`;
  pages.forEach((pageOps, i) => {
    pageOps.push(`${L} 46 m ${R} 46 l 0.3 w S`);
    pageOps.push(`BT /F1 7 Tf ${L} 36 Td (${esc(trunc(footer, 90))}) Tj ET`);
    pageOps.push(`BT /F1 7 Tf ${R - 60} 36 Td (${esc(`Page ${i + 1} of ${total}`)}) Tj ET`);
  });

  return buildMultiPagePdf(pages.map((p) => p.join("\n")));
}
