"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud, FileText, ChevronRight, Sparkles,
  Cpu, FileBox, Printer, Check, ShieldCheck, 
  Palette, Layers, Maximize
} from "lucide-react";
import Image from "next/image";

type AppStep = 'upload' | 'processing' | 'checkout' | 'success';

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
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<AppStep>('upload');
  const [progress, setProgress] = useState(0);
  const [logText, setLogText] = useState("Initializing neural engine...");
  
  // Print Configuration States
  const [pages, setPages] = useState(0);
  const [colorMode, setColorMode] = useState<'bw' | 'color'>('bw');
  const [sides, setSides] = useState<'single' | 'double'>('single');
  const [margin, setMargin] = useState<'standard' | 'none'>('standard');
  const [isPaying, setIsPaying] = useState(false);

  // Auto-reset margin to standard if user switches back to B&W
  useEffect(() => {
    if (colorMode === 'bw') setMargin('standard');
  }, [colorMode]);

  // Dynamic Price Calculator
  const currentPrice = useMemo(() => {
    let pricePerPage = 1.5; // Default B&W

    if (colorMode === 'color') {
      pricePerPage = margin === 'none' ? 10 : 7;
    }

    // Calculation based on total document pages
    return pages * pricePerPage;
  }, [pages, colorMode, margin]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleOptimize = async () => {
    if (!file) return;
    
    setStep('processing');
    setProgress(0);
    setLogText("Connecting to Arkout local node...");

    const formData = new FormData();
    formData.append("file", file);

    try {
      setTimeout(() => { setProgress(25); setLogText("Transmitting document to Python backend..."); }, 400);

      const response = await fetch("https://api.arkout.in/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setPages(data.pages); // Just store the pages, we calculate price locally now

        setProgress(60);
        setLogText(`Transfer complete. Found ${data.pages} pages...`);
        
        setTimeout(() => { setProgress(85); setLogText("Loading print configuration matrix..."); }, 1500);
        setTimeout(() => { setProgress(100); setLogText("Print package optimized and ready."); }, 3000);
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
      alert("Failed to load Razorpay SDK. Check your connection.");
      setIsPaying(false);
      return;
    }

    try {
      const orderRes = await fetch("https://api.arkout.in/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: currentPrice }), // Send dynamic price
      });
      const order = await orderRes.json();

      if (!order.id) throw new Error("Failed to create Razorpay order");

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, 
        amount: order.amount,
        currency: order.currency,
        name: "Arkout Print Hub",
        description: `Terminal 01 - ${pages} Pages`,
        order_id: order.id,
        handler: async function (response: any) {
          console.log("Payment ID:", response.razorpay_payment_id);
          setStep('success'); 
          setIsPaying(false);

          try {
            const printRes = await fetch("https://api.arkout.in/api/trigger-print", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                filename: file?.name,
                config: { colorMode, sides, margin } // Send configs to Pi
              }), 
            });
            
            const printData = await printRes.json();
            if (printData.status === "success") {
              console.log("Hardware: Printer spooling up with custom settings...");
            } else {
              console.error("Hardware Error:", printData.error);
            }
          } catch (err) {
            console.error("Failed to connect to Pi print server", err);
          }
        },
        prefill: { name: "Arkout User", contact: "9999999999" },
        theme: { color: "#050505" },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        alert("Payment Failed: " + response.error.description);
        setIsPaying(false);
      });
      
      rzp.open();
    } catch (err) {
      alert("Could not connect to secure payment gateway.");
      console.error(err);
      setIsPaying(false);
    }
  };

  const resetApp = () => {
    setFile(null);
    setStep('upload');
    setProgress(0);
    setColorMode('bw');
    setSides('single');
    setMargin('standard');
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-cyan-500/30">
      
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-cyan-500/15 via-purple-500/5 to-transparent rounded-full blur-[150px] pointer-events-none z-0"></div>

      <div className="z-10 w-full max-w-3xl flex flex-col items-center">
        
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-10 flex flex-col items-center"
        >
          <div className="relative w-56 h-24 mb-6 filter invert brightness-125 contrast-125 hue-rotate-180 drop-shadow-[0_0_15px_rgba(0,229,255,0.3)]">
             <Image src="/logo.png?v=2" alt="Arkout" fill unoptimized className="object-contain" priority />
          </div>
        </motion.div>

        <div className="w-full relative group">
          <div className={`absolute -inset-[1px] rounded-[32px] opacity-50 blur-sm transition-colors duration-1000 ${
            step === 'success' ? 'bg-gradient-to-r from-emerald-500/30 via-emerald-400/30 to-emerald-500/30' : 'bg-gradient-to-r from-cyan-500/30 via-purple-500/30 to-cyan-500/30'
          }`}></div>
          
          <div className="relative bg-[#050505]/90 backdrop-blur-3xl border border-white/10 rounded-[32px] p-8 md:p-10 shadow-2xl overflow-hidden min-h-[450px] flex flex-col justify-center">
            
            <AnimatePresence mode="wait">
              
              {/* STATE 1: UPLOAD */}
              {step === 'upload' && (
                <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: "blur(10px)" }} className="flex flex-col w-full h-full max-w-xl mx-auto">
                  <label className="relative flex flex-col items-center justify-center w-full h-64 border border-dashed border-zinc-700/50 hover:border-cyan-500/50 rounded-2xl cursor-pointer transition-all duration-500 bg-white/[0.01] hover:bg-white/[0.03] group/zone">
                    <AnimatePresence mode="wait">
                      {!file ? (
                        <motion.div key="icon1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center z-10">
                          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 text-cyan-400 mb-5"><UploadCloud size={36} /></div>
                          <h3 className="text-xl font-bold text-white mb-2">Initialize Print Job</h3>
                          <p className="text-sm text-zinc-500">Drag & drop your documents here</p>
                        </motion.div>
                      ) : (
                        <motion.div key="icon2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center z-10">
                          <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 mb-5"><FileText size={36} /></div>
                          <h3 className="text-xl font-bold text-emerald-400 mb-2 truncate max-w-[250px]">{file.name}</h3>
                          <p className="text-sm text-zinc-400">Ready for AI Analysis</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.docx,.png,.jpg,.jpeg" />
                  </label>
                  <button onClick={handleOptimize} disabled={!file} className={`w-full mt-6 py-4 rounded-xl font-bold flex justify-center space-x-2 transition-all ${file ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-zinc-500 cursor-not-allowed"}`}>
                    {file ? (<><span>Analyze & Configure</span><ChevronRight size={18} /></>) : (<span>Awaiting Document</span>)}
                  </button>
                </motion.div>
              )}

              {/* STATE 2: PROCESSING */}
              {step === 'processing' && (
                <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-8">
                  <div className="flex items-center space-x-6 mb-10 text-purple-400">
                    <Cpu size={48} className="animate-pulse" />
                  </div>
                  <div className="w-full max-w-sm mb-4">
                    <div className="flex justify-between text-xs font-bold text-cyan-400 mb-2"><span>Arkout Engine</span><span>{progress}%</span></div>
                    <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                      <motion.div className="h-full bg-gradient-to-r from-cyan-400 to-purple-500" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <p className="text-xs font-mono text-zinc-500 mt-2">{">"} {logText}</p>
                  {progress === 100 && (
                    <button onClick={() => setStep('checkout')} className="mt-8 bg-white text-black px-8 py-3 rounded-xl font-bold hover:scale-105 transition-transform flex items-center gap-2">
                      Configure Print <ChevronRight size={16} />
                    </button>
                  )}
                </motion.div>
              )}

              {/* STATE 3: CHECKOUT & CONFIGURATION */}
              {step === 'checkout' && (
                <motion.div key="checkout" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex flex-col md:flex-row w-full h-full gap-8">
                  
                  {/* Configuration Panel */}
                  <div className="flex-1 flex flex-col space-y-5">
                    <h3 className="text-xl font-bold text-white mb-2">Print Configuration</h3>
                    
                    {/* Ink Selection */}
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-2"><Palette size={14}/> Ink Type</label>
                      <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-white/5">
                        <button onClick={() => setColorMode('bw')} className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${colorMode === 'bw' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>B&W (₹1.5/pg)</button>
                        <button onClick={() => setColorMode('color')} className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${colorMode === 'color' ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 text-cyan-400 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Color (₹7/pg)</button>
                      </div>
                    </div>

                    {/* Layout Selection */}
                    <div className="space-y-2">
                      <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider flex items-center gap-2"><Layers size={14}/> Layout</label>
                      <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-white/5">
                        <button onClick={() => setSides('single')} className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${sides === 'single' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Single Sided</button>
                        <button onClick={() => setSides('double')} className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${sides === 'double' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>Back-to-Back</button>
                      </div>
                    </div>

                    {/* Margin Selection (Conditional) */}
                    <AnimatePresence>
                      {colorMode === 'color' && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                          <label className="text-xs text-purple-400 font-bold uppercase tracking-wider flex items-center gap-2"><Maximize size={14}/> Margin Type</label>
                          <div className="flex bg-purple-900/10 p-1 rounded-lg border border-purple-500/20">
                            <button onClick={() => setMargin('standard')} className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${margin === 'standard' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}>Standard Margin</button>
                            <button onClick={() => setMargin('none')} className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${margin === 'none' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-zinc-500 hover:text-zinc-300'}`}>No Margin (₹10/pg)</button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Payment Panel */}
                  <div className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-900/40 rounded-3xl border border-white/5 relative overflow-hidden">
                    <div className="w-full mb-6 pb-6 border-b border-white/5 space-y-3">
                       <div className="flex justify-between text-sm"><span className="text-zinc-400">Pages Detected</span><span className="text-white font-bold">{pages}</span></div>
                       <div className="flex justify-between items-end mt-4">
                         <span className="text-zinc-400 font-medium">Total Amount</span>
                         <span className="text-4xl font-bold text-cyan-400">₹{currentPrice.toFixed(2)}</span>
                       </div>
                    </div>
                    
                    <button onClick={handlePayment} disabled={isPaying} className={`w-full py-4 rounded-xl font-bold flex justify-center space-x-2 transition-all ${isPaying ? "bg-zinc-800 text-zinc-500" : "bg-white text-black hover:bg-zinc-200"}`}>
                      {isPaying ? <span>Processing...</span> : <><span>Pay Securely</span> <ChevronRight size={18} /></>}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STATE 4: SUCCESS */}
              {step === 'success' && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center py-10">
                  <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex justify-center items-center mb-6 text-emerald-400"><Check size={48} /></div>
                  <h2 className="text-3xl font-bold text-white mb-2">Payment Verified</h2>
                  <p className="text-zinc-400 mb-8">Hardware triggered. Document is printing...</p>
                  <button onClick={resetApp} className="text-sm font-bold text-zinc-500 hover:text-white">Print Another Document</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}