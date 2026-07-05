"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { ExternalLink, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Props = {
  id: string;
  assetTag: string;
  name: string;
  type: string;
  vendor: string;
  location: string;
};

export function AssetQrButton({ id, assetTag, name, type, vendor, location }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    const url = `${window.location.origin}/api/it-assets/${id}/pdf`;
    QRCode.toDataURL(url, { width: 220, margin: 1, errorCorrectionLevel: "M" })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [id]);

  function printLabel() {
    const win = window.open("", "_blank", "width=420,height=560");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${assetTag}</title>
<style>
  body{font-family:system-ui,sans-serif;margin:0;padding:24px;display:flex;justify-content:center}
  .label{border:1px solid #ccc;border-radius:10px;padding:20px;width:220px;text-align:center}
  img{display:block;margin:0 auto 10px}
  .tag{font-size:20px;font-weight:700;letter-spacing:.5px}
  .row{font-size:11px;color:#666;margin-top:3px}
  .note{font-size:9px;color:#999;margin-top:8px}
</style></head><body>
<div class="label">
  <img src="${qrDataUrl}" width="200" height="200"/>
  <div class="tag">${assetTag}</div>
  <div class="row">${name}</div>
  <div class="row">${type.replace(/_/g, " ")} · ${vendor}</div>
  <div class="row">${location}</div>
  <div class="note">Scan to open PDF record with employee details</div>
</div>
<script>window.onload=()=>{window.print();window.close()}</script>
</body></html>`);
    win.document.close();
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Asset QR code"><QrCode className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader><DialogTitle>QR Code — {assetTag}</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center gap-3 pt-1">
          {qrDataUrl
            ? <img src={qrDataUrl} alt={`QR for ${assetTag}`} width={200} height={200} className="rounded-md border" />
            : <div className="h-[200px] w-[200px] animate-pulse rounded-md bg-muted" />}
          <p className="text-center text-xs text-muted-foreground">
            Scan to open PDF with full asset &amp; employee details
          </p>
          <div className="w-full space-y-2">
            <Button asChild variant="outline" className="w-full" size="sm">
              <Link href={`/it-maintenance/assets/${id}`} target="_blank">
                <ExternalLink className="h-4 w-4" /> View Full Record
              </Link>
            </Button>
            <Button onClick={printLabel} disabled={!qrDataUrl} className="w-full">
              Print Label
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
