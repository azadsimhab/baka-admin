"use client";
import { useState, useRef, useEffect, useCallback, FormEvent } from "react";

type ScanLog = {
  id: string;
  productId: string;
  status: "success" | "error";
  timestamp: string;
};

type ScannerState =
  | "initializing"
  | "scanning"
  | "detected"
  | "cooldown"
  | "error";

// Short pleasant beep — 0.15s sine wave at 880Hz, generated as a base64 WAV data URI
const BEEP_DATA_URI =
  "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fal" +
  "xfbWBjcGFkd2dqfmtsgnB0h3V4jHl8kH2Ag4WDh4mHi42LjZCPkZOTlJaVl5mYmZuam5" +
  "2cnZ+en6ChoKGjpaSlp6amqKinqaqqq6ytrrCvsLKxsrSztLa1tri3uLq5ury7vL69vr/A" +
  "wcDCwcLDxMXExsfIx8jJysnLzMvNzM3Ozs/Q0NDR0tHS09TT1NXW1dbX2NfY2drZ2tvb3N" +
  "vc3d7d3t/g4ODh4uHi4+Tj5OXm5ebn5+fo6ejp6urr6+zs7e3u7u/v8PDx8fLy8/P09PX1" +
  "9vb39/j4+fn6+vv7/Pz9/f7+//8AAP/+/f38/Pv7+vr5+fj49/f29vX19PTz8/Ly8fHw8O" +
  "/v7u7t7ezs6+vq6unp6Ojn5+bm5eXk5OPj4uLh4eDg39/e3t3d3Nzb29ra2dnY2NfX1tbV" +
  "1dTU09PS0tHR0NDPz87Ozc3MzMvLysrJycjIx8fGxsXFxMTDw8LCwcHAwL+/vr69vby8u7" +
  "u6urm5uLi3t7a2tbW0tLOzsrKxsbCwr6+urq2trKyrrKuqqamop6iop6elpqWkpKOkoqOi" +
  "oaGgoJ+gnp6dnZydm5ybmpqZmZiZl5iXlpaVlZSVk5OSkpGSkJCPkI6OjY6MjIuMioqJ" +
  "iomHiIeGh4WGhYOEg4KDgYKBf4B/fn9+fH18e3x7ent6eXp5eHl4d3h3d3Z3dnV2dXR1dH" +
  "N0c3JzcnFycXBxcG9wb25vbm1ubWxtbGtsa2pramhpaGdoZ2ZnZmVmZWRlZGNkY2JjYmFi" +
  "YWBhYF9gX19eX15dXl1cXVxbXFtaW1taWVpZWFlYWVhXWFdWV1ZWVVZVVFVUVFNUUlNSUl" +
  "FSUFFRUFFQT1BPUE9OT05NTk1NTE1MS0xLS0pLSkpJSkpJSElISUhHSEdIR0hHRkdGR0ZH" +
  "RkVGRUZFRkVERUVERUREQ0RDRENEQ0JDQkNEQ0JDQkNEQ0JDQ0RDREVERUZFRkdGR0hH" +
  "SElISUpJSktKS0xLTE1MTk1OT05PUE9QUVBRUlFSU1JTVFNUVVRVVlVWV1ZXWFdYWVhZ" +
  "WllbWltcW1xdXF1eXV5fXl9gX2BhYGFiYWJjYmNkY2RlZGVmZWZnZmdoZ2hpaGlqaWpr" +
  "amtsa2xta21ubW5vbm9wb3BxcHFycXJzcnN0c3R1dHV2dXZ3dnd4d3h5eHl6eXp7ent8e3" +
  "x9fH1+fX5/fn+Af4CAf4GAgYKBgoOCg4SEhIWEhYaFhoeGh4iIiImIiYqJiouKi4yLjI2M" +
  "jY6Njo+Oj5CPkJGQkZKRkpOSk5SUlJWUlZaVlpeWl5iXmJmYmZqZmpuam5ycnJ2cnZ6d" +
  "np+en5+goKChoKGioaKjoqOko6SlpKWmpaanpqeoqKmpqKmqqquqq6ysra2urq6vsK+wsb" +
  "CxsrGys7KztLO0tbS1trW2t7a3uLe4ubi5urm6u7q7vLu8vby9vr2+v76/wL/AwcDBwsHC" +
  "w8LDxMPExcTFxsXGx8bHyMfIycjJysnKy8rLzMvMzczNzs3Oz87P0M/Q0dDR0dDS09LT1N" +
  "PU1dTW1dbW19fY2NnZ2trb29zc3d3e3t/f4ODh4eLi4+Pk5OXl5ubm";

export default function AdminDashboard() {
  const [barcode, setBarcode] = useState("");
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [scannerState, setScannerState] = useState<ScannerState>("initializing");
  const [lastDetected, setLastDetected] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const readerRef = useRef<import("@zxing/library").BrowserMultiFormatReader | null>(null);
  const mountedRef = useRef(true);
  const beepRef = useRef<HTMLAudioElement | null>(null);

  // Pre-load the beep audio element once on mount
  useEffect(() => {
    beepRef.current = new Audio(BEEP_DATA_URI);
    beepRef.current.volume = 0.6;
  }, []);

  /** Play the scanner beep sound */
  const playBeep = useCallback(() => {
    try {
      const audio = beepRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {
          /* autoplay policy — user hasn't interacted yet */
        });
      }
    } catch {
      /* Silently swallow audio errors */
    }
  }, []);

  /** Fire the induction POST request and log the result */
  const processInduction = useCallback(async (codeToScan: string) => {
    if (!codeToScan.trim()) return;
    setLoading(true);
    setBarcode(codeToScan);

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
      const response = await fetch(`${backendUrl}/api/inventory/seed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: codeToScan.trim(), quantity: 1 }),
      });

      const newLog: ScanLog = {
        id: Math.random().toString(36).substring(7),
        productId: codeToScan.trim(),
        status: response.ok ? "success" : "error",
        timestamp: new Date().toLocaleTimeString(),
      };

      setLogs((prev) => [newLog, ...prev].slice(0, 10));
    } catch {
      const errorLog: ScanLog = {
        id: Math.random().toString(36).substring(7),
        productId: codeToScan.trim(),
        status: "error",
        timestamp: new Date().toLocaleTimeString(),
      };
      setLogs((prev) => [errorLog, ...prev].slice(0, 10));
    } finally {
      setLoading(false);
      setBarcode("");
    }
  }, []);

  /**
   * Initialise & start the ZXing continuous scanner.
   * Extracted into a stable ref-based helper so the cooldown timer
   * can cleanly restart scanning without re-running the effect.
   */
  const startScanningRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    const startScanning = async () => {
      try {
        const {
          BrowserMultiFormatReader,
          DecodeHintType,
          BarcodeFormat,
        } = await import("@zxing/library");

        // Configure hints for retail barcode formats
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        // If a reader already exists from a prior cycle, reset it first
        if (readerRef.current) {
          readerRef.current.reset();
        }

        const reader = new BrowserMultiFormatReader(hints, 250);
        readerRef.current = reader;

        if (!videoRef.current || !mountedRef.current) return;

        // Prefer rear / environment camera on mobile
        const devices = await reader.listVideoInputDevices();
        const rearCamera = devices.find(
          (d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("rear") ||
            d.label.toLowerCase().includes("environment")
        );
        const selectedDeviceId =
          rearCamera?.deviceId || devices[0]?.deviceId || undefined;

        if (!mountedRef.current) return;

        await reader.decodeFromVideoDevice(
          selectedDeviceId ?? null,
          videoRef.current,
          (result, error) => {
            if (!mountedRef.current) return;

            if (result) {
              const text = result.getText();

              // ── 1. Immediately pause the scanner ──
              reader.reset();

              // ── 2. Play the beep ──
              playBeep();

              // ── 3. Update UI state ──
              setScannerState("detected");
              setLastDetected(text);

              // ── 4. Fire the induction request ──
              processInduction(text);

              // ── 5. 2.5s cooldown, then resume scanning ──
              setTimeout(() => {
                if (mountedRef.current) {
                  setLastDetected(null);
                  setScannerState("scanning");
                  // Restart the scanner after cooldown
                  startScanningRef.current?.();
                }
              }, 2500);
            } else if (error) {
              // Normal "not found" frames — keep state as scanning
              if (mountedRef.current) {
                setScannerState("scanning");
              }
            }
          }
        );

        if (mountedRef.current) {
          setScannerState("scanning");
        }
      } catch (err) {
        console.error("Scanner initialisation error:", err);
        if (mountedRef.current) {
          setScannerState("error");
        }
      }
    };

    // Store the start function so the cooldown timer can call it
    startScanningRef.current = startScanning;

    startScanning();

    return () => {
      mountedRef.current = false;
      if (readerRef.current) {
        readerRef.current.reset();
      }
      readerRef.current = null;
    };
  }, [processInduction, playBeep]);

  const handleManualScan = (e: FormEvent) => {
    e.preventDefault();
    playBeep();
    processInduction(barcode);
  };

  // ── Status bar configuration ──
  const scannerStatusConfig: Record<
    ScannerState,
    { label: string; color: string; bgClass: string; pulseClass: string }
  > = {
    initializing: {
      label: "INITIALIZING CAMERA",
      color: "text-amber-400",
      bgClass: "bg-amber-500",
      pulseClass: "animate-pulse",
    },
    scanning: {
      label: "SCANNING FOR BARCODES",
      color: "text-emerald-400",
      bgClass: "bg-emerald-500",
      pulseClass: "animate-pulse",
    },
    detected: {
      label: "BARCODE DETECTED",
      color: "text-cyan-400",
      bgClass: "bg-cyan-400",
      pulseClass: "",
    },
    cooldown: {
      label: "COOLDOWN",
      color: "text-amber-400",
      bgClass: "bg-amber-500",
      pulseClass: "",
    },
    error: {
      label: "CAMERA UNAVAILABLE",
      color: "text-red-400",
      bgClass: "bg-red-500",
      pulseClass: "",
    },
  };

  const status = scannerStatusConfig[scannerState];

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 font-sans p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        {/* ── Header ── */}
        <header className="flex justify-between items-center mb-8 pb-4 border-b border-slate-700">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Operations<span className="text-emerald-500">Hub</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Live Inventory Digitization Engine
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-800 px-3 sm:px-4 py-2 rounded-lg border border-slate-700">
            <div
              className={`w-3 h-3 rounded-full ${
                loading
                  ? "bg-amber-500 animate-pulse"
                  : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
              }`}
            />
            <span className="text-xs sm:text-sm font-bold text-slate-300">
              SYSTEM ONLINE
            </span>
          </div>
        </header>

        {/* ── Camera Viewport ── */}
        <section className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 mb-6 overflow-hidden">
          {/* Scanner status bar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 bg-slate-800/80">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-2.5 h-2.5 rounded-full ${status.bgClass} ${status.pulseClass}`}
              />
              <span
                className={`text-xs font-bold tracking-widest uppercase ${status.color}`}
              >
                {status.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg
                className="w-4 h-4 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span className="text-xs text-slate-500 font-mono">LIVE</span>
            </div>
          </div>

          {/* Video container */}
          <div className="relative bg-black aspect-[4/3] sm:aspect-video overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />

            {/* Scanning overlay — corner brackets */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-64 h-40 sm:w-80 sm:h-48">
                {/* Top-left */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-emerald-400 rounded-tl-md" />
                {/* Top-right */}
                <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-emerald-400 rounded-tr-md" />
                {/* Bottom-left */}
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl-md" />
                {/* Bottom-right */}
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br-md" />

                {/* Animated scan line */}
                {scannerState === "scanning" && (
                  <div
                    className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
                    style={{
                      animation: "scanline 2s ease-in-out infinite",
                    }}
                  />
                )}

                {/* Detection flash */}
                {scannerState === "detected" && (
                  <div className="absolute inset-0 border-2 border-cyan-400 rounded-md bg-cyan-400/10 animate-pulse" />
                )}
              </div>
            </div>

            {/* Detected barcode toast */}
            {lastDetected && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-sm border border-cyan-500/50 rounded-lg px-5 py-2.5 flex items-center gap-3 shadow-lg shadow-cyan-500/10">
                <svg
                  className="w-5 h-5 text-cyan-400 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="font-mono text-sm font-bold text-white">
                  {lastDetected}
                </span>
              </div>
            )}

            {/* Error state overlay */}
            {scannerState === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm gap-3">
                <svg
                  className="w-12 h-12 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                  <line
                    x1="2"
                    y1="2"
                    x2="22"
                    y2="22"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <p className="text-red-300 text-sm font-bold">
                  Camera access denied or unavailable
                </p>
                <p className="text-slate-500 text-xs">
                  Use the manual input below to enter barcodes
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ── Manual Input Fallback ── */}
        <section className="bg-slate-800 p-6 sm:p-8 rounded-2xl shadow-2xl border border-slate-700 mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
            Manual Entry Fallback
          </h2>
          <form onSubmit={handleManualScan} className="relative">
            <input
              ref={inputRef}
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              disabled={loading}
              placeholder="Type barcode or Product ID…"
              className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl py-4 sm:py-5 px-5 text-lg sm:text-xl font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={loading || !barcode.trim()}
              className="absolute right-3 top-3 bottom-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold px-5 sm:px-6 rounded-lg transition-colors text-sm"
            >
              INDUCT
            </button>
          </form>
        </section>

        {/* ── Recent Inductions Log ── */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
            Recent Inductions
          </h2>
          <div className="space-y-3">
            {logs.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 font-medium">
                Awaiting first scan…
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-4">
                    {log.status === "success" ? (
                      <div className="w-10 h-10 rounded-full bg-emerald-900/50 flex items-center justify-center text-emerald-500 shrink-0">
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2.5"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-red-900/50 flex items-center justify-center text-red-500 shrink-0">
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2.5"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-mono text-base sm:text-lg font-bold text-white truncate">
                        {log.productId}
                      </p>
                      <p className="text-xs font-medium text-slate-400">
                        +1 Unit Added to Live Redis Matrix
                      </p>
                    </div>
                  </div>
                  <span className="text-slate-500 text-sm font-mono shrink-0 ml-3">
                    {log.timestamp}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Scanline keyframes */}
      <style jsx>{`
        @keyframes scanline {
          0%,
          100% {
            top: 0;
            opacity: 0.3;
          }
          50% {
            top: calc(100% - 2px);
            opacity: 1;
          }
        }
      `}</style>
    </main>
  );
}