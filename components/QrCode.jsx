"use client";
import { useEffect, useState } from "react";

export default function QrCode({ value = "", size = 192, margin = 2, className = "" }) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function gen() {
      try {
        if (!value) { setDataUrl(""); return; }
        const mod = await import("qrcode");
        const QR = mod?.default && mod.default.toDataURL ? mod.default : mod;
        if (!QR?.toDataURL) throw new Error("qrcode module missing toDataURL");
        const url = await QR.toDataURL(String(value), {
          errorCorrectionLevel: "M",
          margin,
          width: size,
          color: { dark: "#000000", light: "#ffffff" },
        });
        if (!cancelled) setDataUrl(url);
      } catch (e) {
        // leave placeholder; best-effort
        if (process.env.NODE_ENV !== 'production') console.error('QR gen failed', e);
        if (!cancelled) setDataUrl("");
      }
    }
    gen();
    return () => { cancelled = true; };
  }, [value, size, margin]);

  if (!value) return null;
  return (
    <div className={className}>
      {dataUrl ? (
        <img src={dataUrl} alt="QR Code" width={size} height={size} />
      ) : (
        <div
          style={{ width: size, height: size }}
          className="flex items-center justify-center bg-white text-gray-500 text-xs border rounded"
        >
          Generating QR…
        </div>
      )}
    </div>
  );
}
