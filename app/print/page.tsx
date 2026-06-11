"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud, FileText, ChevronRight, Sparkles, CheckCircle2,
  Cpu, FileBox, Printer, Check, ShieldCheck
} from "lucide-react";
import Image from "next/image";

type AppStep = 'upload' | 'processing' | 'checkout' | 'success';

// --- Dynamic Script Loader (Bypasses Next.js strict errors) ---
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
  const [printData, setPrintData] = useState({ pages: 0, price: 0 });
  const [isPaying, setIsPaying] = useState(false);

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
        setPrintData({ pages: data.pages, price: data.price });

        setProgress(60);
        setLogText(`Transfer complete. Found ${data.pages} pages...`);
        
        setTimeout(() => { setProgress(85); setLogText("Calculating ink density & final pricing..."); }, 1500);
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

    // 1. Inject Razorpay Script dynamically
    const isLoaded = await loadRazorpay();
    if (!isLoaded) {
      alert("Failed to load Razorpay SDK. Check your connection.");
      setIsPaying(false);
      return;
    }

    try {
      // 2. Ask Pi for a new Order ID
      const orderRes = await fetch("https://api.arkout.in/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: printData.price }),
      });
      const order = await orderRes.json();

      if (!order.id) throw new Error("Failed to create Razorpay order");

      // 3. Configure the Payment Window
      const options = {
        // --- THIS IS THE SECURE CHANGE ---
        // It now pulls safely from Vercel's Environment Variables
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, 
        amount: order.amount,
        currency: order.currency,
        name: "Arkout Print Hub",
        description: `Terminal 01 - ${printData.pages} Pages`,
        order_id: order.id,
        handler: function (response: any) {
          console.log("Payment ID:", response.razorpay_payment_id);
          setStep('success'); 
          setIsPaying(false);
        },
        prefill: {
          name: "Arkout User",
          contact: "9999999999",
        },
        theme: {
          color: "#050505", 
        },
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
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-cyan-500/30">
      
      {/* Linear-Style Architectural Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
      
      {/* Deep Ambient Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-cyan-500/15 via-purple-500/5 to-transparent rounded-full blur-[150px] pointer-events-none z-0"></div>

      <div className="z-10 w-full max-w-2xl flex flex-col items-center">
        
        {/* Prominent Centered Branding */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-10 flex flex-col items-center"
        >
          <div className="relative w-48 h-16 mb-6">
             <Image src="/arkout-logo.png" alt="Arkout" fill unoptimized className="object-contain drop-shadow-[0_0_15px_rgba(0,229,255,0.3)]" priority />
          </div>
        </motion.div>

        {/* Dynamic State Container */}
        <div className="w-full relative group">
          <div className={`absolute -inset-[1px] rounded-[32px] opacity-50 blur-sm transition-colors duration-1000 ${
            step === 'success' ? 'bg-gradient-to-r from-emerald-500/30 via-emerald-400/30 to-emerald-500/30' : 'bg-gradient-to-r from-cyan-500/30 via-purple-500/30 to-cyan-500/30'
          }`}></div>
          
          <div className="relative bg-[#050505]/90 backdrop-blur-3xl border border-white/10 rounded-[32px] p-8 md:p-10 shadow-2xl overflow-hidden min-h-[450px] flex flex-col justify-center">
            
            <AnimatePresence mode="wait">
              
              {/* STATE 1: THE DROPZONE */}
              {step === 'upload' && (
                <motion.div
                  key="dropzone"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col w-full h-full"
                >
                  <label className="relative flex flex-col items-center justify-center w-full h-64 border border-dashed border-zinc-700/50 hover:border-cyan-500/50 rounded-2xl cursor-pointer transition-all duration-500 bg-white/[0.01] hover:bg-white/[0.03] group/zone">
                    <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/0 to-cyan-500/5 opacity-0 group-hover/zone:opacity-100 transition-opacity duration-500"></div>

                    <AnimatePresence mode="wait">
                      {!file ? (
                        <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center z-10">
                          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 text-cyan-400 mb-5 shadow-[0_0_30px_rgba(0,229,255,0.1)] group-hover/zone:scale-110 transition-transform duration-500">
                            <UploadCloud size={36} strokeWidth={1.5} />
                          </div>
                          <h3 className="text-xl font-bold tracking-tight text-white mb-2">Initialize Print Job</h3>
                          <p className="text-sm text-zinc-500 font-medium">Drag & drop your documents here</p>
                        </motion.div>
                      ) : (
                        <motion.div key="file" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center z-10">
                          <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 mb-5 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                            <FileText size={36} strokeWidth={1.5} />
                          </div>
                          <h3 className="text-xl font-bold tracking-tight text-emerald-400 mb-2 truncate max-w-[250px]">{file.name}</h3>
                          <p className="text-sm text-zinc-400 font-medium">Ready for AI Analysis</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.docx,.png,.jpg,.jpeg" />
                  </label>

                  <motion.button
                    onClick={handleOptimize}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full mt-6 py-4 px-6 rounded-xl font-bold flex items-center justify-center space-x-2 text-[15px] tracking-wide transition-all duration-300 shadow-xl ${
                      file ? "bg-white text-black hover:bg-zinc-200 shadow-[0_0_40px_rgba(255,255,255,0.2)]" : "bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed"
                    }`}
                    disabled={!file}
                  >
                    {file ? (<><Sparkles size={18} className="text-purple-600" /><span>Analyze & Optimize</span><ChevronRight size={18} /></>) : (<span>Awaiting Document</span>)}
                  </motion.button>
                </motion.div>
              )}

              {/* STATE 2: AI PROCESSING */}
              {step === 'processing' && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
                  transition={{ duration: 0.6 }}
                  className="flex flex-col items-center justify-center w-full h-full py-8 relative"
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl"></div>
                  <div className="relative z-10 flex flex-col items-center w-full">
                    
                    <div className="flex items-center space-x-6 mb-10">
                      <FileBox size={32} className="text-zinc-500" />
                      <div className="w-16 h-[2px] bg-zinc-800 relative overflow-hidden">
                        <motion.div className="absolute inset-y-0 left-0 bg-cyan-400" animate={{ width: ["0%", "100%", "0%"], left: ["0%", "0%", "100%"] }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} />
                      </div>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 shadow-[0_0_20px_rgba(112,0,255,0.2)]">
                        <Cpu size={32} strokeWidth={1.5} />
                      </motion.div>
                    </div>

                    <div className="w-full max-w-sm mb-4">
                      <div className="flex justify-between text-xs font-bold font-mono uppercase tracking-wider mb-2">
                        <span className="text-cyan-400">Arkout Engine</span>
                        <span className="text-white">{progress}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                        <motion.div className="h-full bg-gradient-to-r from-cyan-400 to-purple-500" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
                      </div>
                    </div>

                    <div className="w-full max-w-sm mt-2 text-center h-6">
                      <AnimatePresence mode="wait">
                        <motion.p key={logText} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="text-xs font-mono text-zinc-500">
                          {">"} {logText}
                        </motion.p>
                      </AnimatePresence>
                    </div>

                    {progress === 100 && (
                      <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={() => setStep('checkout')} className="mt-8 bg-white text-black px-8 py-3 rounded-xl font-bold text-sm hover:scale-105 transition-transform flex items-center gap-2 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                        Proceed to Checkout <ChevronRight size={16} />
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* STATE 3: CHECKOUT & RAZORPAY */}
              {step === 'checkout' && (
                <motion.div
                  key="checkout"
                  initial={{ opacity: 0, x: 50, filter: "blur(10px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col md:flex-row w-full h-full gap-8"
                >
                  {/* Receipt Column */}
                  <div className="flex-1 flex flex-col justify-center space-y-6">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-1">Order Summary</h3>
                      <p className="text-sm text-zinc-500">Terminal 01 • Instant Print</p>
                    </div>
                    
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 space-y-4 shadow-inner">
                      <div className="flex justify-between items-center pb-4 border-b border-white/5">
                        <span className="text-zinc-400 text-sm">Document</span>
                        <span className="text-white text-sm font-medium truncate max-w-[150px]">{file?.name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400 text-sm">Pages (AI Counted)</span>
                        <span className="text-white text-sm font-medium">{printData.pages} Pages</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400 text-sm">Format</span>
                        <span className="text-white text-sm font-medium">A4 • B&W</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-end">
                      <span className="text-zinc-400 font-medium">Total Amount</span>
                      <span className="text-4xl font-bold text-cyan-400 tracking-tight">₹{printData.price.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* SECURE PAYMENT Column */}
                  <div className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-900/40 rounded-3xl border border-white/5 relative overflow-hidden">
                    <motion.div animate={{ top: ["0%", "100%", "0%"] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} className="absolute left-0 right-0 h-[2px] bg-cyan-400/50 shadow-[0_0_20px_#00E5FF] z-10 w-full" />
                    
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-6 relative z-0 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.1)] text-emerald-400">
                      <ShieldCheck size={56} strokeWidth={1.5} />
                    </div>
                    
                    <h4 className="text-lg font-bold text-white mb-2">Secure Checkout</h4>
                    <p className="text-xs text-zinc-500 text-center font-medium mb-8">Powered by Razorpay Gateway<br/>Supports UPI, Cards, and Netbanking</p>
                    
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handlePayment}
                      disabled={isPaying}
                      className={`w-full py-4 rounded-xl font-bold text-[15px] transition-all shadow-xl flex items-center justify-center space-x-2 ${
                        isPaying 
                        ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                        : "bg-white text-black hover:bg-zinc-200 shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                      }`}
                    >
                      {isPaying ? (
                        <span className="animate-pulse">Connecting...</span>
                      ) : (
                        <><span>Pay ₹{printData.price.toFixed(2)}</span> <ChevronRight size={18} /></>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* STATE 4: SUCCESS */}
              {step === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, type: "spring" }}
                  className="flex flex-col items-center justify-center w-full h-full py-10 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", damping: 12 }}
                    className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(16,185,129,0.2)] text-emerald-400"
                  >
                    <Check size={48} strokeWidth={3} />
                  </motion.div>
                  
                  <h2 className="text-3xl font-bold text-white mb-2">Payment Verified</h2>
                  <p className="text-zinc-400 mb-10 max-w-xs">Your document is being printed at Terminal 01. Please collect your pages below.</p>
                  
                  <div className="flex items-center space-x-3 text-emerald-400 bg-emerald-500/10 px-6 py-3 rounded-full border border-emerald-500/20 mb-8">
                    <Printer size={18} className="animate-pulse" />
                    <span className="font-bold text-sm tracking-wide">PRINTING IN PROGRESS...</span>
                  </div>

                  <button onClick={resetApp} className="text-sm font-bold text-zinc-500 hover:text-white transition-colors">
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