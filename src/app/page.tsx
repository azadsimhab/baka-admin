"use client";
import { useState, useRef, useEffect, FormEvent } from 'react';

type ScanLog = { id: string; productId: string; status: 'success' | 'error'; timestamp: string };

export default function AdminDashboard() {
  const [barcode, setBarcode] = useState('');
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input so the hardware scanner is always ready
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleScan = async (e: FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    const currentBarcode = barcode.trim();
    setBarcode(''); // Instantly clear input for the next physical scan
    setLoading(true);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${backendUrl}/api/inventory/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Hardcoding +1 quantity per scan, mirroring standard supermarket checkout behavior
        body: JSON.stringify({ productId: currentBarcode, quantity: 1 }),
      });

      const newLog: ScanLog = {
        id: Math.random().toString(36).substring(7),
        productId: currentBarcode,
        status: response.ok ? 'success' : 'error',
        timestamp: new Date().toLocaleTimeString()
      };

      setLogs((prev) => [newLog, ...prev].slice(0, 5)); // Keep the last 5 scans visible
    } catch (error) {
      // Create the typed object first so TypeScript knows exactly what it is
      const errorLog: ScanLog = {
        id: Math.random().toString(36).substring(7),
        productId: currentBarcode,
        status: 'error',
        timestamp: new Date().toLocaleTimeString()
      };

      setLogs((prev) => [errorLog, ...prev].slice(0, 5));
    } finally {
      setLoading(false);
      // Force focus back to input after network request
      setTimeout(() => inputRef.current?.focus(), 10);
    }
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
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4">Hardware Scanner Input</h2>
          <form onSubmit={handleScan} className="relative">
            <input
              ref={inputRef}
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              disabled={loading}
              placeholder="Scan Barcode or Type Product ID..."
              className="w-full bg-slate-900 border-2 border-slate-600 rounded-xl py-6 px-6 text-2xl font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors disabled:opacity-50"
              autoComplete="off"
            />
            <button
              type="submit"
              className="absolute right-4 top-4 bottom-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 rounded-lg transition-colors"
            >
              INDUCT
            </button>
          </form>
          <p className="text-xs text-slate-500 mt-4 text-center">Cursor auto-locks to this field. Ready for continuous wedge scanning.</p>
        </section>

        {/* Live Induct Feed */}
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