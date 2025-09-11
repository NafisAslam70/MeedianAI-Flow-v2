"use client";
import { useEffect, useState } from "react";

export default function QrCode({ value = "", size = 192, margin = 2, className = "" }) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    async function gen() {
      try {
        if (!value) { setDataUrl(""); return; }
        const QR = (await import("qrcode")).default;
        const url = await QR.toDataURL(String(value), {
          errorCorrectionLevel: "M",
          margin,
          width: size,
          color: { dark: "#000000", light: "#ffffff" },
        });
        if (!cancelled) setDataUrl(url);
      } catch {
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

