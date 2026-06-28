function esc(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function trunc(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 2) + ".." : str;
}

function buildPdfBuffer(contentStream: string, useBold = false): Buffer {
  const fontDict = useBold
    ? "<< /F1 4 0 R /F2 5 0 R >>"
    : "<< /F1 4 0 R >>";
  const objects = useBold
    ? [
        "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
        "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
        `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font ${fontDict} >> /Contents 6 0 R >> endobj`,
        "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
        "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj",
        `6 0 obj << /Length ${Buffer.byteLength(contentStream, "utf8")} >> stream\n${contentStream}\nendstream endobj`,
      ]
    : [
        "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
        "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
        `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font ${fontDict} >> /Contents 5 0 R >> endobj`,
        "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
        `5 0 obj << /Length ${Buffer.byteLength(contentStream, "utf8")} >> stream\n${contentStream}\nendstream endobj`,
      ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${obj}\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

// Legacy helper kept for other report routes
function line(text: string, x: number, y: number, size = 10) {
  return `BT /F1 ${size} Tf ${x} ${y} Td (${esc(text)}) Tj ET`;
}

export function buildSimplePdf(title: string, lines: string[]) {
  const contentLines = [
    line(title, 50, 790, 16),
    line(`Generated: ${new Date().toLocaleString()}`, 50, 768, 9),
    ...lines.slice(0, 44).map((item, index) => line(item, 50, 735 - index * 15, 10)),
  ];
  return buildPdfBuffer(contentLines.join("\n"), false);
}

export function buildEmployeeAssetPdf(data: {
  companyNames: string[];
  employeeId: string;
  name: string;
  department: string;
  jobTitle: string;
  email: string;
  phone: string;
  location: string;
  status: string;
  companyCodes: string;
  assets: Array<{ assetTag: string; name: string; type: string; vendorModel: string; status: string }>;
  licenses: Array<{ licenseId: string; name: string; vendor: string; expiry: string }>;
  generatedAt: string;
}): Buffer {
  const ops: string[] = [];
  const L = 40;
  const R = 555;
  let y = 805;

  const put = (text: string, x: number, cy: number, size: number, bold = false) => {
    ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${cy} Td (${esc(text)}) Tj ET`);
  };

  const hr = (cy: number, weight = 0.5) => {
    ops.push(`${L} ${cy} m ${R} ${cy} l ${weight} w S`);
  };

  const hrseg = (x1: number, cy: number, x2: number, weight = 0.5) => {
    ops.push(`${x1} ${cy} m ${x2} ${cy} l ${weight} w S`);
  };

  // ── Header ────────────────────────────────────────────────────────────
  const header = trunc(data.companyNames.join(" / ") || "Company", 72);
  put(header, L, y, 13, true);
  y -= 20;
  hr(y, 1.2);
  y -= 13;

  put("Employee Asset & License Handover Record", L, y, 11, true);
  y -= 13;
  put(`Generated: ${data.generatedAt}`, L, y, 8);
  y -= 11;
  hr(y, 0.5);
  y -= 15;

  // ── Employee Info ─────────────────────────────────────────────────────
  const C1 = L;
  const C2 = 308;

  const infoRows: [string, string, string, string][] = [
    ["Employee ID / Name", `${data.employeeId} / ${data.name}`, "Department", data.department],
    ["Job Title", data.jobTitle, "Status", data.status],
    ["Email", data.email, "Phone", data.phone],
    ["Location", data.location, "Companies", data.companyCodes],
  ];

  for (const [l1, v1, l2, v2] of infoRows) {
    put(l1, C1, y, 7);
    put(trunc(v1, 36), C1, y - 10, 9);
    put(l2, C2, y, 7);
    put(trunc(v2, 36), C2, y - 10, 9);
    y -= 24;
  }

  y -= 4;
  hr(y, 0.5);
  y -= 15;

  // ── Assets Table ──────────────────────────────────────────────────────
  // Columns: Tag(75) | Name(205) | Type(90) | Vendor/Model(95) | Status(50)
  const A = [L, L + 75, L + 280, L + 375, L + 475];

  put("Assets Provided", L, y, 11, true);
  y -= 14;
  put("Asset Tag", A[0], y, 8, true);
  put("Name", A[1], y, 8, true);
  put("Type", A[2], y, 8, true);
  put("Vendor / Model", A[3], y, 8, true);
  put("Status", A[4], y, 8, true);
  y -= 4;
  hr(y, 0.3);
  y -= 12;

  if (data.assets.length === 0) {
    put("No assets assigned.", L, y, 9);
    y -= 13;
  } else {
    const MAX = 14;
    for (const a of data.assets.slice(0, MAX)) {
      put(trunc(a.assetTag, 11), A[0], y, 9);
      put(trunc(a.name, 29), A[1], y, 9);
      put(trunc(a.type, 13), A[2], y, 9);
      put(trunc(a.vendorModel, 14), A[3], y, 9);
      put(trunc(a.status, 10), A[4], y, 9);
      y -= 13;
    }
    if (data.assets.length > MAX) {
      put(`...and ${data.assets.length - MAX} more`, L, y, 8);
      y -= 12;
    }
  }

  y -= 5;
  hr(y, 0.5);
  y -= 15;

  // ── Licenses Table ────────────────────────────────────────────────────
  // Columns: ID(100) | Name(215) | Vendor(120) | Expiry(80)
  const LC = [L, L + 100, L + 320, L + 445];

  put("Licenses Assigned", L, y, 11, true);
  y -= 14;
  put("License ID", LC[0], y, 8, true);
  put("Name", LC[1], y, 8, true);
  put("Vendor", LC[2], y, 8, true);
  put("Expiry", LC[3], y, 8, true);
  y -= 4;
  hr(y, 0.3);
  y -= 12;

  if (data.licenses.length === 0) {
    put("No licenses assigned.", L, y, 9);
    y -= 13;
  } else {
    const MAX = 12;
    for (const lic of data.licenses.slice(0, MAX)) {
      put(trunc(lic.licenseId, 14), LC[0], y, 9);
      put(trunc(lic.name, 30), LC[1], y, 9);
      put(trunc(lic.vendor, 17), LC[2], y, 9);
      put(trunc(lic.expiry, 12), LC[3], y, 9);
      y -= 13;
    }
    if (data.licenses.length > MAX) {
      put(`...and ${data.licenses.length - MAX} more`, L, y, 8);
      y -= 12;
    }
  }

  // ── Signatures ────────────────────────────────────────────────────────
  const sigY = 68;
  hrseg(L, sigY + 30, 265, 0.5);
  put("Employee Signature", L, sigY + 14, 8);
  put("Date: _______________", L, sigY + 2, 8);

  hrseg(310, sigY + 30, 555, 0.5);
  put("IT / Admin Signature", 310, sigY + 14, 8);
  put("Date: _______________", 310, sigY + 2, 8);

  return buildPdfBuffer(ops.join("\n"), true);
}
