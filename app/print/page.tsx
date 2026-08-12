"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud, FileText, ChevronRight, Cpu, Check, 
  Palette, Layers, Maximize, Lock, XCircle, Copy, Plus, Minus, Eye
} from "lucide-react";
import Image from "next/image";

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

  // CART UPGRADE: Arrays for multiple files
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [backendFiles, setBackendFiles] = useState<{filename: string, pages: number}[]>([]);
  const [previewFile, setPreviewFile] = useState<string | null>(null);

  const [progress, setProgress] = useState(0);
  const [logText, setLogText] = useState("Initializing neural engine...");
  
  const [basePages, setBasePages] = useState(1);
  const [copies, setCopies] = useState(1);
  const [colorMode, setColorMode] = useState<'bw' | 'color'>('bw');
  const [sides, setSides] = useState<'single' | 'double'>('single');
  const [margin, setMargin] = useState<'standard' | 'none'>('standard');
  const [isPaying, setIsPaying] = useState(false);

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

  // Total pages based on copies
  const totalPages = basePages * copies;
  
  // Calculate max possible copies without exceeding 30 total pages
  const maxCopies = Math.floor(30 / (basePages > 0 ? basePages : 1));

  const handleIncrementCopies = () => {
    if (copies < maxCopies) {
      setCopies(prev => prev + 1);
    }
  };

  const handleDecrementCopies = () => {
    if (copies > 1) {
      setCopies(prev => prev - 1);
    }
  };

  const currentPrice = useMemo(() => {
    const safePages = totalPages > 0 ? totalPages : 1; 
    let pricePerPage = 1.5;
    if (colorMode === 'color') pricePerPage = margin === 'none' ? 10 : 7;
    return safePages * pricePerPage;
  }, [totalPages, colorMode, margin]);

  const verifyTerminalPin = async (pinToVerify: string) => {
    setIsVerifying(true);
    setPinError("");
    try {
      const response = await fetch("https://api.arkout.in/api/verify-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinToVerify }),
      });
      if (response.ok) {
        setStep('upload');
      } else {
        setPinError("Invalid PIN. Look at the terminal screen.");
      }
    } catch (err) {
      setPinError("Cannot connect to Arkout Terminal.");
    }
    setIsVerifying(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Append new files to any existing files
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleOptimize = async () => {
    if (selectedFiles.length === 0) return;
    setStep('processing');
    setProgress(0);
    setLogText("Connecting to Arkout local node...");

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append("files", file);
    });

    try {
      setTimeout(() => { setProgress(25); setLogText("Transmitting documents to Python backend..."); }, 400);
      const response = await fetch("https://api.arkout.in/upload", { method: "POST", body: formData });

      if (response.ok) {
        const data = await response.json();
        
        // Sum all pages from all files in the cart
        const totalDetectedPages = data.files.reduce((sum: number, f: any) => sum + (f.pages > 0 ? f.pages : 1), 0);
        
        setBackendFiles(data.files);
        setBasePages(totalDetectedPages);
        setCopies(1);
        
        setProgress(60);
        setLogText(`Transfer complete. Found ${totalDetectedPages} total pages...`);
        setTimeout(() => { setProgress(85); setLogText("Loading print configuration matrix..."); }, 1500);
        setTimeout(() => { 
            setProgress(100); 
            if(totalDetectedPages > 30) {
               setLogText(`WARNING: Cart contains ${totalDetectedPages} pages (Max is 30). Please reduce files.`);
            } else {
               setLogText("Print package optimized and ready."); 
            }
        }, 3000);
      } else {
        setLogText("> ERROR: Server rejected the transmission.");
      }
    } catch (error) {
      setLogText("> ERROR: Could not connect to Tunnel.");
    }
  };

  const handlePayment = async () => {
    setIsPaying(true);
    const isLoaded = await loadRazorpay();
    if (!isLoaded) {
      alert("Failed to load Razorpay SDK.");
      setIsPaying(false); return;
    }

    try {
      const orderRes = await fetch("https://api.arkout.in/api/create-order", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: currentPrice }),
      });
      const order = await orderRes.json();
      if (!order.id) throw new Error("Failed to create Razorpay order");

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, 
        amount: order.amount, currency: order.currency,
        name: "Arkout Print Hub", description: `Terminal 01 - ${totalPages} Pages`,
        order_id: order.id,
        handler: async function (response: any) {
          setStep('success'); setIsPaying(false);
          try {
            // MAP CART ITEMS TO BACKEND STRUCTURE
            const items = backendFiles.map(f => ({
              filename: f.filename,
              pages: f.pages,
              config: { colorMode, sides, margin, copies }
            }));

            await fetch("https://api.arkout.in/api/trigger-print", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items }), 
            });
          } catch (err) { console.error("Hardware trigger failed", err); }
        },
        prefill: { name: "Arkout User", contact: "9999999999" }, theme: { color: "#050505" },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        alert("Payment Failed: " + response.error.description);
        setIsPaying(false);
      });
      rzp.open();
    } catch (err) {
      alert("Gateway error."); setIsPaying(false);
    }
  };

  const resetApp = async () => {
    try {
      await fetch("https://api.arkout.in/api/abort", { method: "POST" });
    } catch (e) { console.error("Abort signal failed"); }
    
    setSelectedFiles([]); setBackendFiles([]); setPreviewFile(null); 
    setStep('verify'); setProgress(0); setPin("");
    setColorMode('bw'); setSides('single'); setMargin('standard'); 
    setBasePages(1); setCopies(1);
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-cyan-500/30">
      
      {/* INSTANT PREVIEW MODAL - Dark Glass UI */}
      <AnimatePresence>
        {previewFile && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-5xl h-[85vh] bg-[#050505]/95 backdrop-blur-3xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="flex justify-between items-center p-5 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20"><FileText size={18}/></div>
                  <h3 className="text-white font-bold tracking-wide">{previewFile}</h3>
                </div>
                <button onClick={() => setPreviewFile(null)} className="text-zinc-500 hover:text-white transition-colors p-1"><XCircle size={28}/></button>
              </div>
              <iframe src={`https://api.arkout.in/api/preview/${previewFile}`} className="w-full flex-1 bg-white/[0.02]" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-cyan-500/15 via-purple-500/5 to-transparent rounded-full blur-[150px] pointer-events-none z-0"></div>

      <div className="z-10 w-full max-w-3xl flex flex-col items-center">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10 flex flex-col items-center">
          <div className="relative w-56 h-24 mb-6 filter invert brightness-125 contrast-125 hue-rotate-180 drop-shadow-[0_0_15px_rgba(0,229,255,0.3)]">
             <Image src="/logo.png?v=2" alt="Arkout" fill unoptimized className="object-contain" priority />
          </div>
        </motion.div>

        <div className="w-full relative group">
          <div className={`absolute -inset-[1px] rounded-[32px] opacity-50 blur-sm transition-colors duration-1000 ${ step === 'success' ? 'bg-gradient-to-r from-emerald-500/30 via-emerald-400/30 to-emerald-500/30' : 'bg-gradient-to-r from-cyan-500/30 via-purple-500/30 to-cyan-500/30' }`}></div>
          <div className="relative bg-[#050505]/90 backdrop-blur-3xl border border-white/10 rounded-[32px] p-8 md:p-10 shadow-2xl overflow-hidden min-h-[450px] flex flex-col justify-center">
            
            <AnimatePresence mode="wait">
              
              {/* STATE 0: PROXIMITY VERIFICATION */}
              {step === 'verify' && (
                <motion.div key="verify" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: "blur(10px)" }} className="flex flex-col w-full h-full max-w-sm mx-auto items-center text-center justify-center">
                  <div className="p-5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 mb-6"><Lock size={40} /></div>
                  <h3 className="text-2xl font-bold text-white mb-2">Terminal Lock</h3>
                  <p className="text-sm text-zinc-400 mb-8">Enter the 4-digit PIN displayed on the hardware screen to verify proximity.</p>
                  
                  <input type="text" maxLength={4} placeholder="0000" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} className="w-full bg-zinc-900/50 border border-white/10 rounded-xl py-4 text-center text-3xl font-mono text-white tracking-widest focus:outline-none focus:border-cyan-500/50 transition-colors mb-4"/>
                  {pinError && <p className="text-red-400 text-sm mb-4">{pinError}</p>}
                  
                  <button onClick={() => verifyTerminalPin(pin)} disabled={pin.length !== 4 || isVerifying} className={`w-full py-4 rounded-xl font-bold flex justify-center items-center space-x-2 transition-all ${pin.length === 4 ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-zinc-500 cursor-not-allowed"}`}>
                    {isVerifying ? <span>Verifying...</span> : <span>Unlock Terminal</span>}
                  </button>
                </motion.div>
              )}

              {/* STATE 1: UPLOAD */}
              {step === 'upload' && (
                <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: "blur(10px)" }} className="flex flex-col w-full h-full max-w-xl mx-auto">
                  <label className="relative flex flex-col items-center justify-center w-full h-48 border border-dashed border-zinc-700/50 hover:border-cyan-500/50 rounded-2xl cursor-pointer transition-all duration-500 bg-white/[0.01] hover:bg-white/[0.03] group/zone mb-4">
                    <motion.div key="icon1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center z-10">
                      <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 text-cyan-400 mb-4"><UploadCloud size={28} /></div>
                      <h3 className="text-lg font-bold text-white mb-1">Add Documents</h3>
                      <p className="text-xs text-zinc-500">Click or drag & drop files here</p>
                    </motion.div>
                    <input type="file" className="hidden" multiple onChange={handleFileChange} accept=".pdf,.docx,.doc,.png,.jpg,.jpeg" />
                  </label>

                  {/* CART LIST PREVIEW */}
                  {selectedFiles.length > 0 && (
                    <div className="w-full max-h-40 overflow-y-auto pr-2 space-y-2 mb-4 scrollbar-thin scrollbar-thumb-zinc-700">
                      {selectedFiles.map((f, i) => (
                        <div key={i} className="flex justify-between items-center bg-zinc-900/50 border border-white/5 rounded-lg p-3">
                           <div className="flex items-center gap-3 overflow-hidden">
                             <FileText size={16} className="text-cyan-400 flex-shrink-0" />
                             <span className="text-sm text-zinc-300 truncate">{f.name}</span>
                           </div>
                           <button onClick={() => removeSelectedFile(i)} className="text-zinc-500 hover:text-red-400 transition-colors ml-4"><XCircle size={16}/></button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button onClick={handleOptimize} disabled={selectedFiles.length === 0} className={`w-full py-4 rounded-xl font-bold flex justify-center space-x-2 transition-all ${selectedFiles.length > 0 ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-zinc-500 cursor-not-allowed"}`}>
                    {selectedFiles.length > 0 ? (<><span>Analyze Cart ({selectedFiles.length})</span><ChevronRight size={18} /></>) : (<span>Awaiting Documents</span>)}
                  </button>
                  <button onClick={resetApp} className="mt-4 text-zinc-500 text-sm font-semibold hover:text-white transition-colors">Abort & Return</button>
                </motion.div>
              )}

              {/* STATE 2: PROCESSING */}
              {step === 'processing' && (
                <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-8">
                  <div className="flex items-center space-x-6 mb-10 text-purple-400"><Cpu size={48} className="animate-pulse" /></div>
                  <div className="w-full max-w-sm mb-4">
                    <div className="flex justify-between text-xs font-bold text-cyan-400 mb-2"><span>Arkout Engine</span><span>{progress}%</span></div>
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                      <motion.div className="h-full bg-gradient-to-r from-cyan-400 to-purple-500" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <p className="text-xs font-mono text-zinc-500 mt-2">{">"} {logText}</p>
                  {progress === 100 && basePages <= 30 && (
                    <button onClick={() => setStep('checkout')} className="mt-8 bg-white text-black px-8 py-3 rounded-xl font-bold hover:scale-105 transition-transform flex items-center gap-2">Configure Print <ChevronRight size={16} /></button>
                  )}
                  {progress === 100 && basePages > 30 && (
                     <div className="mt-6 text-center">
                        <p className="text-red-400 font-bold mb-4">Cart exceeds 30 pages limit ({basePages} pages).</p>
                        <button onClick={() => { setStep('upload'); setProgress(0); setSelectedFiles([]); }} className="bg-zinc-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-zinc-700 transition-colors">Clear Cart & Retry</button>
                     </div>
                  )}
                  <button onClick={resetApp} className="mt-8 flex items-center gap-1 text-zinc-500 text-sm font-semibold hover:text-red-400 transition-colors"><XCircle size={16}/> Cancel Print</button>
                </motion.div>
              )}

              {/* STATE 3: CHECKOUT */}
              {step === 'checkout' && (
                <motion.div key="checkout" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex flex-col md:flex-row w-full h-full gap-8">
                  <div className="flex-1 flex flex-col space-y-5">
                    
                    {/* CART PREVIEW LIST */}
                    <div className="space-y-2 mb-2">
                      <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-2"><FileText size={14}/> Documents in Cart</label>
                      <div className="max-h-32 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                        {backendFiles.map((f, i) => (
                           <div key={i} className="flex justify-between items-center bg-zinc-900/30 border border-white/5 rounded-lg p-2 px-3">
                             <div className="flex flex-col overflow-hidden">
                                <span className="text-xs text-zinc-300 truncate">{f.filename}</span>
                                <span className="text-[10px] text-zinc-500">{f.pages} pages</span>
                             </div>
                             <button onClick={() => setPreviewFile(f.filename)} className="text-cyan-400 hover:text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20 p-1.5 rounded-md transition-colors"><Eye size={16}/></button>
                           </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-2"><Palette size={14}/> Ink Type</label>
                      <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-white/5">
                        <button onClick={() => setColorMode('bw')} className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${colorMode === 'bw' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>B&W (₹1.5/pg)</button>
                        <button onClick={() => setColorMode('color')} className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${colorMode === 'color' ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Color (₹7/pg)</button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-2"><Layers size={14}/> Layout</label>
                      <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-white/5">
                        <button onClick={() => setSides('single')} className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${sides === 'single' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Single Sided</button>
                        <button onClick={() => setSides('double')} className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${sides === 'double' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Back-to-Back</button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {colorMode === 'color' && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                          <label className="text-xs text-purple-400 font-bold uppercase tracking-wider flex items-center gap-2"><Maximize size={14}/> Margin Type</label>
                          <div className="flex bg-purple-900/10 p-1 rounded-lg border border-purple-500/20">
                            <button onClick={() => setMargin('standard')} className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${margin === 'standard' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}>Standard</button>
                            <button onClick={() => setMargin('none')} className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${margin === 'none' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}>No Margin (₹10/pg)</button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-2 justify-between">
                        <span className="flex items-center gap-2"><Copy size={14}/> Cart Multiplier</span>
                        <span className="text-[10px] text-cyan-500/70">Max {maxCopies} sets</span>
                      </label>
                      <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-white/5 items-center justify-between">
                        <button onClick={handleDecrementCopies} disabled={copies <= 1} className="p-3 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"><Minus size={18}/></button>
                        <span className="font-bold text-xl">{copies}</span>
                        <button onClick={handleIncrementCopies} disabled={copies >= maxCopies} className="p-3 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"><Plus size={18}/></button>
                      </div>
                    </div>

                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-900/40 rounded-3xl border border-white/5 relative overflow-hidden">
                    <div className="w-full mb-6 pb-6 border-b border-white/5 space-y-3">
                       <div className="flex justify-between text-sm"><span className="text-zinc-400">Total base pages</span><span className="text-white font-medium">{basePages}</span></div>
                       <div className="flex justify-between text-sm"><span className="text-zinc-400">Total Output Pages</span><span className="text-cyan-400 font-bold">{totalPages} / 30</span></div>
                       <div className="flex justify-between items-end mt-4"><span className="text-zinc-400 font-medium">Total Amount</span><span className="text-4xl font-bold text-cyan-400">₹{currentPrice.toFixed(2)}</span></div>
                    </div>
                    <button onClick={handlePayment} disabled={isPaying || totalPages > 30} className={`w-full py-4 rounded-xl font-bold flex justify-center space-x-2 transition-all ${isPaying || totalPages > 30 ? "bg-zinc-800 text-zinc-500" : "bg-white text-black hover:bg-zinc-200"}`}>
                      {isPaying ? <span>Processing...</span> : <><span>Pay Securely</span> <ChevronRight size={18} /></>}
                    </button>
                    <button onClick={resetApp} className="mt-4 flex items-center gap-1 text-zinc-500 text-xs font-semibold hover:text-red-400 transition-colors"><XCircle size={14}/> Cancel & Restart</button>
                  </div>
                </motion.div>
              )}

              {/* STATE 4: SUCCESS */}
              {step === 'success' && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center py-10">
                  <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex justify-center items-center mb-6 text-emerald-400"><Check size={48} /></div>
                  <h2 className="text-3xl font-bold text-white mb-2">Payment Verified</h2>
                  <p className="text-zinc-400 mb-8">Hardware triggered. Cart is printing...</p>
                  <button onClick={resetApp} className="text-sm font-bold text-zinc-500 hover:text-white">Start New Print Job</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}
