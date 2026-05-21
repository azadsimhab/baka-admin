"use client";
import { useState, useRef, useEffect, FormEvent } from 'react';

type ScanLog = { id: string; productId: string; status: 'success' | 'error'; timestamp: string };

export default function AdminDashboard() {
  const [barcode, setBarcode] = useState('');
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!cameraActive) {
      inputRef.current?.focus();
    }
  }, [cameraActive]);

  useEffect(() => {
    if (cameraActive) {
      // Dynamic import to prevent Next.js Server-Side Rendering (SSR) crashes
      import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
        const scanner = new Html5QrcodeScanner("reader", { qrbox: { width: 250, height: 150 }, fps: 10 }, false);

        scanner.render(
          (decodedText) => {
            scanner.clear();
            setCameraActive(false);
            processInduction(decodedText);
          },
          (error) => { /* Ignore standard scan feed background errors */ }
        );

        return () => {
          scanner.clear().catch(e => console.error("Scanner clear error", e));
        };
      });
    }
  }, [cameraActive]);

  const processInduction = async (codeToScan: string) => {
    if (!codeToScan.trim()) return;
    setLoading(true);
    setBarcode(codeToScan);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${backendUrl}/api/inventory/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: codeToScan.trim(), quantity: 1 }),
      });

      const newLog: ScanLog = {
        id: Math.random().toString(36).substring(7),
        productId: codeToScan.trim(),
        status: response.ok ? 'success' : 'error',
        timestamp: new Date().toLocaleTimeString()
      };

      setLogs((prev) => [newLog, ...prev].slice(0, 5));
    } catch (error) {
      const errorLog: ScanLog = {
        id: Math.random().toString(36).substring(7),
        productId: codeToScan.trim(),
        status: 'error',
        timestamp: new Date().toLocaleTimeString()
      };
      setLogs((prev) => [errorLog, ...prev].slice(0, 5));
    } finally {
      setLoading(false);
      setBarcode('');
      inputRef.current?.focus();
    }
  };

  const handleManualScan = (e: FormEvent) => {
    e.preventDefault();
    processInduction(barcode);
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 font-sans p-6">
      <div className="max-w-2xl mx-auto">

        <header className="flex justify-between items-center mb-10 pb-4 border-b border-slate-700">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Operations<span className="text-emerald-500">Hub</span></h1>
            <p className="text-slate-400 text-sm mt-1">Live Inventory Digitization Engine</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
            <div className={`w-3 h-3 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'}`}></div>
            <span className="text-sm font-bold text-slate-300">SYSTEM ONLINE</span>
          </div>
        </header>

        <section className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 mb-8">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">Scanner Input</h2>

          {cameraActive ? (
            <div className="mb-6 border-2 border-emerald-500 rounded-xl overflow-hidden bg-black">
              <div id="reader" className="w-full bg-white text-black"></div>
              <button onClick={() => setCameraActive(false)} className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold text-sm tracking-widest uppercase">Cancel Camera</button>
            </div>
          ) : (
            <button onClick={() => setCameraActive(true)} type="button" className="w-full mb-6 bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-colors shadow-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              ACTIVATE MOBILE CAMERA
            </button>
          )}

          <form onSubmit={handleManualScan} className="relative">
            <input
              ref={inputRef}
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              disabled={loading || cameraActive}
              placeholder="Or type Product ID..."
              className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl py-5 px-5 text-xl font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
              autoComplete="off"
            />
            <button type="submit" disabled={loading || cameraActive} className="absolute right-3 top-3 bottom-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white font-bold px-6 rounded-lg transition-colors">
              INDUCT
            </button>
          </form>
        </section>

        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">Recent Inductions</h2>
          <div className="space-y-3">
            {logs.length === 0 ? (
              <div className="text-center py-10 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 font-medium">
                Awaiting first scan...
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
                  <div className="flex items-center gap-4">
                    {log.status === 'success' ? (
                      <div className="w-10 h-10 rounded-full bg-emerald-900/50 flex items-center justify-center text-emerald-500">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-red-900/50 flex items-center justify-center text-red-500">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </div>
                    )}
                    <div>
                      <p className="font-mono text-lg font-bold text-white">{log.productId}</p>
                      <p className="text-xs font-medium text-slate-400">+1 Unit Added to Live Redis Matrix</p>
                    </div>
                  </div>
                  <span className="text-slate-500 text-sm font-mono">{log.timestamp}</span>
                </div>
              ))
            )}
          </div>
        </section>

      </div>
    </main>
  );
}