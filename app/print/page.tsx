"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud, FileText, ChevronRight, Cpu, Check, 
  Palette, Layers, Maximize, Lock, XCircle, Copy, Plus, Minus, Sparkles
} from "lucide-react";
import Image from "next/image";
import { useTerminalSession } from "../../hooks/useTerminalSession"; 

type AppStep = 'verify' | 'upload' | 'processing' | 'checkout' | 'success';

const loadRazorpay = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function Home() {
  const [step, setStep] = useState<AppStep>('verify');
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  
  const [apiBaseUrl, setApiBaseUrl] = useState("https://api.arkout.in");

  const [files, setFiles] = useState<File[]>([]);
  const [uploadedFilenames, setUploadedFilenames] = useState<string[]>([]); 
  const [progress, setProgress] = useState(0);
  const [logText, setLogText] = useState("Initializing neural engine...");

  const [basePages, setBasePages] = useState(1);
  const [copies, setCopies] = useState(1);
  const [colorMode, setColorMode] = useState<'bw' | 'color'>('bw');
  const [sides, setSides] = useState<'single' | 'double'>('single');
  const [margin, setMargin] = useState<'standard' | 'none'>('standard');
  const [isPaying, setIsPaying] = useState(false);

  const { isSessionValid, errorMessage } = useTerminalSession(pin);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlPin = urlParams.get('pin');
    if (urlPin) {
      setPin(urlPin);
      verifyTerminalPin(urlPin);
    }
  }, []);

  useEffect(() => {
    if (colorMode === 'bw') setMargin('standard');
  }, [colorMode]);

  const totalPages = basePages * copies;
  const maxCopies = Math.floor(30 / basePages);

  const handleIncrementCopies = () => { if (copies < maxCopies) setCopies(prev => prev + 1); };
  const handleDecrementCopies = () => { if (copies > 1) setCopies(prev => prev - 1); };

  const currentPrice = useMemo(() => {
    const safePages = totalPages > 0 ? totalPages : 1; 
    let pricePerPage = 1.5;
    if (colorMode === 'color') pricePerPage = margin === 'none' ? 10 : 7;
    return safePages * pricePerPage;
  }, [totalPages, colorMode, margin]);

  const verifyTerminalPin = async (pinToVerify: string) => {
    setIsVerifying(true);
    setPinError("");
    
    let targetUrl = "https://api.arkout.in"; 
    if (pinToVerify.length === 6 && pinToVerify.startsWith("02")) {
        targetUrl = process.env.NEXT_PUBLIC_TERMINAL_02_URL || "https://api2.arkout.in";
    } else if (pinToVerify.length !== 4) {
        setPinError("Invalid PIN format.");
        setIsVerifying(false);
        return;
    }

    setApiBaseUrl(targetUrl);

    try {
      const response = await fetch(`${targetUrl}/api/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinToVerify }),
      });
      if (response.ok) {
        setStep('upload');
      } else {
        setPinError("Invalid PIN. Check the kiosk screen.");
      }
    } catch (err) {
      setPinError("Cannot connect to Terminal node.");
    }
    setIsVerifying(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const handleOptimize = async () => {
    if (files.length === 0) return;
    setStep('processing');
    setProgress(0);
    setLogText("Establishing secure node bridge...");

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      setTimeout(() => { setProgress(25); setLogText("Analyzing document structure & pages..."); }, 400);
      
      const response = await fetch(`${apiBaseUrl}/upload`, { method: "POST", body: formData });

      if (response.ok) {
        const data = await response.json();
        const detectedPages = data.total_pages > 0 ? data.total_pages : 1;
        setBasePages(detectedPages);

        if (data.files && Array.isArray(data.files)) {
            setUploadedFilenames(data.files.map((f: any) => f.filename));
        }

        setCopies(1);
        setProgress(60);
        setLogText(`Analysis complete. Found ${detectedPages} pages.`);
        
        setTimeout(() => { setProgress(85); setLogText("Preparing print configuration options..."); }, 1200);
        setTimeout(() => { setProgress(100); setLogText("Ready."); }, 2200);
      } else {
        setLogText("Error: Server rejected the package.");
      }
    } catch (error) {
      setLogText("Error: Tunnel connection lost.");
    }
  };

  const handlePayment = async () => {
    setIsPaying(true);
    const isLoaded = await loadRazorpay();
    if (!isLoaded) {
      alert("Failed to load payment gateway.");
      setIsPaying(false); return;
    }

    try {
      const orderRes = await fetch(`${apiBaseUrl}/api/create-order`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: currentPrice }),
      });
      const order = await orderRes.json();
      if (!order.id) throw new Error("Order creation failed");

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, 
        amount: order.amount, currency: order.currency,
        name: "Arkout Print Hub", description: `Secure Print - ${totalPages} Pages`,
        order_id: order.id,
        handler: async function (response: any) {
          setStep('success'); setIsPaying(false);
          try {
            for (const serverFilename of uploadedFilenames) {
                await fetch(`${apiBaseUrl}/api/trigger-print`, {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ filename: serverFilename, config: { colorMode, sides, margin, copies } }), 
                });
            }
          } catch (err) { console.error("Hardware trigger failed", err); }
        },
        prefill: { name: "Arkout User", contact: "9999999999" }, theme: { color: "#000000" },
      };
      const rzp = new (window as any).Razorpay(options);
      
      // --- NEW: Tell the Kiosk to show "Confirming Payment" right before the paywall opens ---
      fetch(`${apiBaseUrl}/api/set-state`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "payment" })
      }).catch(() => {});

      rzp.on("payment.failed", function (response: any) {
        alert("Payment Failed: " + response.error.description);
        setIsPaying(false);
        // --- NEW: If payment fails/cancels, revert kiosk back to processing state ---
        fetch(`${apiBaseUrl}/api/set-state`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "processing" })
        }).catch(() => {});
      });

      rzp.open();
    } catch (err) {
      alert("Gateway error."); setIsPaying(false);
    }
  };

  const resetApp = async () => {
    try {
      await fetch(`${apiBaseUrl}/api/abort`, { method: "POST", body: JSON.stringify({ session_id: pin }) });
    } catch (e) { console.error("Abort failed"); }

    setFiles([]); setUploadedFilenames([]);
    setStep('verify'); setProgress(0); setPin("");
    setColorMode('bw'); setSides('single'); setMargin('standard'); 
    setBasePages(1); setCopies(1);
    setApiBaseUrl("https://api.arkout.in");
  };

  if (!isSessionValid) {
    return (
      <main className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center font-sans text-white">
        <XCircle size={64} className="text-red-500 mb-6" />
        <h1 className="text-2xl font-semibold mb-2">Session Grabbed</h1>
        <p className="text-zinc-400">{errorMessage}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full relative overflow-hidden font-sans text-white flex flex-col items-center justify-center p-4 md:p-6 bg-zinc-950">
      
      {/* --- BACKGROUND ADVERTISEMENT LAYER (Dynamically Blurs when active) --- */}
      <div className={`absolute inset-0 transition-all duration-700 ease-in-out z-0 flex items-center justify-center overflow-hidden pointer-events-none ${step !== 'verify' ? 'blur-3xl scale-105 opacity-40' : 'blur-none opacity-100'}`}>
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-900/20 via-black to-purple-900/20 z-10"></div>
        {/* Simulated Advertisement Content / Poster Loop */}
        <div className="relative z-0 flex flex-col items-center text-center p-12 max-w-4xl">
          <span className="px-4 py-1.5 rounded-full bg-white/10 text-cyan-400 text-xs font-medium tracking-widest uppercase mb-4 backdrop-blur-md">Sponsored • Arkout Ecosystem</span>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-500 mb-6">
            The Future of Autonomous Printing.
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl">
            Lightning-fast cloud routing, enterprise security, and zero friction. Scan your terminal QR code to begin.
          </p>
        </div>
      </div>

      {/* --- APPLE GLASS INTERFACE OVERLAY --- */}
      <div className="z-10 w-full max-w-2xl flex flex-col items-center">
        
        {/* Minimalist Apple Header Branding */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.08] backdrop-blur-xl border border-white/10 text-xs font-medium text-zinc-300 mb-3 shadow-sm">
            <Sparkles size={12} className="text-cyan-400" /> Arkout Secure Kiosk Node
          </div>
        </motion.div>

        {/* Main Cupertino Glass Card */}
        <div className="w-full relative">
          <div className="absolute -inset-[1px] rounded-[36px] bg-gradient-to-b from-white/20 to-white/5 opacity-50 blur-[2px]"></div>
          
          <div className="relative bg-zinc-900/75 backdrop-blur-2xl border border-white/15 rounded-[34px] p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden min-h-[420px] flex flex-col justify-between">

            <AnimatePresence mode="wait">

              {/* STEP 0: PIN VERIFICATION */}
              {step === 'verify' && (
                <motion.div key="verify" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, filter: "blur(10px)" }} className="flex flex-col w-full max-w-sm mx-auto items-center text-center justify-center my-auto">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/10 to-white/[0.02] border border-white/15 flex items-center text-cyan-400 justify-center mb-5 shadow-inner">
                    <Lock size={28} />
                  </div>
                  <h3 className="text-2xl font-semibold tracking-tight text-white mb-2">Terminal Authentication</h3>
                  <p className="text-sm text-zinc-400 mb-6 leading-relaxed">Enter the 4 or 6-digit PIN visible on the kiosk screen to establish a secure session.</p>

                  <input 
                    type="text" 
                    maxLength={6} 
                    placeholder="••••" 
                    value={pin} 
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} 
                    className="w-full bg-black/40 border border-white/15 rounded-2xl py-4 text-center text-3xl font-mono text-white tracking-[0.3em] focus:outline-none focus:border-cyan-400/80 focus:ring-4 focus:ring-cyan-500/20 transition-all mb-4 shadow-inner"
                  />
                  {pinError && <p className="text-red-400 text-xs font-medium mb-4">{pinError}</p>}

                  <button 
                    onClick={() => verifyTerminalPin(pin)} 
                    disabled={(pin.length !== 4 && pin.length !== 6) || isVerifying} 
                    className={`w-full py-4 rounded-2xl font-semibold text-sm tracking-wide flex justify-center items-center space-x-2 transition-all duration-300 ${(pin.length === 4 || pin.length === 6) ? "bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.2)]" : "bg-white/5 text-zinc-600 border border-white/5 cursor-not-allowed"}`}
                  >
                    {isVerifying ? <span>Verifying Node...</span> : <span>Continue</span>}
                  </button>
                </motion.div>
              )}

              {/* STEP 1: FILE DROP ZONE */}
              {step === 'upload' && (
                <motion.div key="upload" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, filter: "blur(10px)" }} className="flex flex-col w-full max-w-lg mx-auto my-auto">
                  <h3 className="text-xl font-semibold tracking-tight mb-2">Select Documents</h3>
                  <p className="text-sm text-zinc-400 mb-6">Upload PDFs, images, or documents for instant local rendering.</p>

                  <label className="relative flex flex-col items-center justify-center w-full min-h-[14rem] p-6 border border-dashed border-white/20 rounded-3xl cursor-pointer transition-all duration-300 bg-black/30 hover:bg-black/50 hover:border-cyan-400/50 group">
                    {files.length === 0 ? (
                      <div className="flex flex-col items-center z-10">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-zinc-300 mb-4 group-hover:scale-105 transition-transform">
                          <UploadCloud size={28} />
                        </div>
                        <span className="text-sm font-medium text-white mb-1">Click to browse or drop files</span>
                        <span className="text-xs text-zinc-500">Supports PDF, PNG, JPG, HEIC</span>
                      </div>
                    ) : (
                      <div className="flex flex-col w-full gap-2.5 z-10 max-h-[160px] overflow-y-auto pr-1">
                        {files.map((f, i) => (
                          <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                            <FileText size={18} className="text-cyan-400 flex-shrink-0" />
                            <span className="text-xs font-medium text-zinc-200 truncate">{f.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <input type="file" multiple className="hidden" onChange={handleFileChange} accept=".pdf,.docx,.png,.jpg,.jpeg,.heic" />
                  </label>

                  <div className="flex gap-3 mt-6">
                    <button onClick={resetApp} className="px-5 py-4 rounded-2xl font-semibold text-xs bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-all">Back</button>
                    <button onClick={handleOptimize} disabled={files.length === 0} className={`flex-1 py-4 rounded-2xl font-semibold text-sm flex justify-center items-center gap-2 transition-all ${files.length > 0 ? "bg-white text-black hover:bg-zinc-200 shadow-lg" : "bg-white/5 text-zinc-600 cursor-not-allowed"}`}>
                      <span>Process Package</span> <ChevronRight size={16} />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: PROCESSING ANIMATION */}
              {step === 'processing' && (
                <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center my-auto py-6">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-6">
                    <Cpu size={32} className="animate-pulse" />
                  </div>
                  <div className="w-full max-w-sm mb-6">
                    <div className="flex justify-between text-xs font-medium text-zinc-400 mb-2">
                      <span>Secure Pipeline</span>
                      <span className="text-cyan-400 font-mono">{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden border border-white/10">
                      <motion.div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <p className="text-xs font-mono text-zinc-400 mb-8">{logText}</p>
                  
                  {progress === 100 && basePages <= 30 && (
                    <button onClick={() => setStep('checkout')} className="w-full max-w-xs py-4 rounded-2xl font-semibold text-sm bg-white text-black hover:bg-zinc-200 transition-all shadow-lg flex items-center justify-center gap-2">
                      Configure Print <ChevronRight size={16} />
                    </button>
                  )}
                  {progress === 100 && basePages > 30 && (
                    <div className="text-center">
                      <p className="text-red-400 text-xs mb-4 font-medium">Exceeds 30-page limit ({basePages} pages).</p>
                      <button onClick={resetApp} className="px-6 py-3 rounded-xl bg-white/10 text-white text-xs font-medium">Restart</button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* STEP 3: CHECKOUT & CONFIG */}
              {step === 'checkout' && (
                <motion.div key="checkout" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex flex-col md:flex-row w-full gap-6 my-auto">
                  <div className="flex-1 flex flex-col space-y-4">
                    <h3 className="text-lg font-semibold tracking-tight">Print Layout</h3>

                    {/* Ink Mode */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">Color Profile</label>
                      <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10">
                        <button onClick={() => setColorMode('bw')} className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${colorMode === 'bw' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400'}`}>B&W (₹1.5)</button>
                        <button onClick={() => setColorMode('color')} className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${colorMode === 'color' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-zinc-400'}`}>Color (₹7)</button>
                      </div>
                    </div>

                    {/* Layout Mode */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">Sides</label>
                      <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10">
                        <button onClick={() => setSides('single')} className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${sides === 'single' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400'}`}>Single</button>
                        <button onClick={() => setSides('double')} className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${sides === 'double' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400'}`}>Double</button>
                      </div>
                    </div>

                    {/* Copies */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider flex justify-between">
                        <span>Copies</span>
                        <span className="text-cyan-400">Max {maxCopies}</span>
                      </label>
                      <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10 items-center justify-between px-3">
                        <button onClick={handleDecrementCopies} disabled={copies <= 1} className="p-2 text-zinc-400 hover:text-white disabled:opacity-30"><Minus size={16}/></button>
                        <span className="font-semibold text-sm">{copies}</span>
                        <button onClick={handleIncrementCopies} disabled={copies >= maxCopies} className="p-2 text-zinc-400 hover:text-white disabled:opacity-30"><Plus size={16}/></button>
                      </div>
                    </div>
                  </div>

                  {/* Summary Pane */}
                  <div className="flex-1 flex flex-col justify-between p-6 bg-black/40 rounded-3xl border border-white/10">
                    <div className="space-y-2.5">
                      <div className="flex justify-between text-xs text-zinc-400"><span>Pages / Copy</span><span className="text-white">{basePages}</span></div>
                      <div className="flex justify-between text-xs text-zinc-400"><span>Total Sheets</span><span className="text-cyan-400 font-semibold">{totalPages}</span></div>
                      <div className="pt-3 border-t border-white/10 flex justify-between items-baseline">
                        <span className="text-xs text-zinc-400 font-medium">Total Amount</span>
                        <span className="text-3xl font-bold tracking-tight text-white">₹{currentPrice.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-4">
                      <button onClick={handlePayment} disabled={isPaying || totalPages > 30} className="w-full py-4 rounded-2xl font-semibold text-sm bg-white text-black hover:bg-zinc-200 transition-all shadow-lg flex justify-center items-center gap-2">
                        {isPaying ? <span>Authorizing...</span> : <><span>Pay via UPI / Card</span> <ChevronRight size={16} /></>}
                      </button>
                      <button onClick={resetApp} className="w-full py-2 text-zinc-500 text-xs hover:text-red-400 transition-colors">Cancel Session</button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 4: SUCCESS */}
              {step === 'success' && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center my-auto py-8">
                  <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/30 rounded-3xl flex items-center justify-center text-emerald-400 mb-6 shadow-lg">
                    <Check size={36} />
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight mb-2">Payment Confirmed</h2>
                  <p className="text-sm text-zinc-400 mb-8">Hardware triggered successfully. Collecting your prints...</p>
                  <button onClick={resetApp} className="px-8 py-3.5 rounded-2xl font-semibold text-xs bg-white text-black hover:bg-zinc-200 transition-all">
                    Print Another Document
                  </button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}
