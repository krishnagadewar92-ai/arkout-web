"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud, FileText, ChevronRight, Cpu, Check, 
  Palette, Layers, Maximize, Lock, XCircle, Copy, Plus, Minus
} from "lucide-react";
import Image from "next/image";
import { useTerminalSession } from "../../hooks/useTerminalSession"; // Imported Hook!

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

  const [files, setFiles] = useState<File[]>([]);
  const [uploadedFilenames, setUploadedFilenames] = useState<string[]>([]); // New state to track actual server files
  const [progress, setProgress] = useState(0);
  const [logText, setLogText] = useState("Initializing neural engine...");

  const [basePages, setBasePages] = useState(1);
  const [copies, setCopies] = useState(1);
  const [colorMode, setColorMode] = useState<'bw' | 'color'>('bw');
  const [sides, setSides] = useState<'single' | 'double'>('single');
  const [margin, setMargin] = useState<'standard' | 'none'>('standard');
  const [isPaying, setIsPaying] = useState(false);

  // Initialize the session hook using the pin as the session ID
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
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(selectedFiles);
    }
  };

  const handleOptimize = async () => {
    if (files.length === 0) return;
    setStep('processing');
    setProgress(0);
    setLogText("Connecting to Arkout local node...");

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    try {
      setTimeout(() => { setProgress(25); setLogText("Transmitting documents to Python backend..."); }, 400);
      const response = await fetch("https://api.arkout.in/upload", { method: "POST", body: formData });

      if (response.ok) {
        const data = await response.json();
        
        // Use total_pages from backend
        const detectedPages = data.total_pages > 0 ? data.total_pages : 1;
        setBasePages(detectedPages);

        // Save exactly what the server processed (this fixes the iPhone rename issue)
        if (data.files && Array.isArray(data.files)) {
            setUploadedFilenames(data.files.map((f: any) => f.filename));
        }

        setCopies(1);
        setProgress(60);
        setLogText(`Transfer complete. Found ${detectedPages} pages...`);
        
        setTimeout(() => { setProgress(85); setLogText("Loading print configuration matrix..."); }, 1500);
        setTimeout(() => { 
            setProgress(100); 
            if(detectedPages > 30) {
               setLogText(`WARNING: Document is ${detectedPages} pages (Max is 30). You can only print the first 30 pages.`);
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
            // LOOP THROUGH THE ACTUAL SERVER FILENAMES TO TRIGGER PRINT!
            for (const serverFilename of uploadedFilenames) {
                await fetch("https://api.arkout.in/api/trigger-print", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ filename: serverFilename, config: { colorMode, sides, margin, copies } }), 
                });
            }
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
      await fetch("https://api.arkout.in/api/abort", { 
        method: "POST", 
        body: JSON.stringify({ session_id: pin }) 
      });
    } catch (e) { console.error("Abort signal failed"); }

    setFiles([]); 
    setUploadedFilenames([]);
    setStep('verify'); setProgress(0); setPin("");
    setColorMode('bw'); setSides('single'); setMargin('standard'); 
    setBasePages(1); setCopies(1);
  };

  // Block the UI immediately if the session is locked out by someone else
  if (!isSessionValid) {
    return (
      <main className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center font-sans">
        <XCircle size={64} className="text-red-500 mb-6" />
        <h1 className="text-2xl font-bold text-white mb-2">Session Grabbed</h1>
        <p className="text-zinc-400">{errorMessage}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-cyan-500/30">
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

              {/* STATE 1: UPLOAD (.heic included in accept attribute!) */}
              {step === 'upload' && (
                <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: "blur(10px)" }} className="flex flex-col w-full h-full max-w-xl mx-auto">
                  <label className="relative flex flex-col items-center justify-center w-full min-h-[16rem] p-6 border border-white/10 rounded-2xl cursor-pointer transition-all duration-300 bg-white/[0.02] backdrop-blur-md hover:bg-white/[0.05] hover:border-white/20 group/zone shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
                    <AnimatePresence mode="wait">
                      {files.length === 0 ? (
                        <motion.div key="icon1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center z-10">
                          <div className="p-4 rounded-xl border border-white/10 bg-black/50 text-zinc-300 mb-5 shadow-inner">
                            <UploadCloud size={32} />
                          </div>
                          <h3 className="text-lg font-semibold text-white mb-1 tracking-tight">Initialize Print Job</h3>
                          <p className="text-sm text-zinc-500 font-medium text-center">Tap to select documents<br/>(PDF, JPG, PNG, HEIC)</p>
                        </motion.div>
                      ) : (
                        <motion.div key="icon2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col w-full gap-3 z-10 overflow-y-auto max-h-[200px] pr-2 custom-scrollbar">
                          {files.map((f, i) => (
                            <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-black/40 border border-white/5 backdrop-blur-sm">
                              <FileText size={20} className="text-zinc-400 flex-shrink-0" />
                              <span className="text-sm font-medium text-zinc-200 truncate">{f.name}</span>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <input type="file" multiple className="hidden" onChange={handleFileChange} accept=".pdf,.docx,.png,.jpg,.jpeg,.heic" />
                  </label>

                  <button onClick={handleOptimize} disabled={files.length === 0} className={`w-full mt-6 py-4 rounded-xl font-bold flex justify-center space-x-2 transition-all ${files.length > 0 ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-zinc-500 cursor-not-allowed"}`}>
                    {files.length > 0 ? (<><span>Analyze & Configure</span><ChevronRight size={18} /></>) : (<span>Awaiting Documents</span>)}
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
                        <p className="text-red-400 font-bold mb-4">Document exceeds 30 pages limit ({basePages} pages).</p>
                        <button onClick={resetApp} className="bg-zinc-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-zinc-700 transition-colors">Upload Smaller File</button>
                     </div>
                  )}
                  <button onClick={resetApp} className="mt-8 flex items-center gap-1 text-zinc-500 text-sm font-semibold hover:text-red-400 transition-colors"><XCircle size={16}/> Cancel Print</button>
                </motion.div>
              )}

              {/* STATE 3: CHECKOUT */}
              {step === 'checkout' && (
                <motion.div key="checkout" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex flex-col md:flex-row w-full h-full gap-8">
                  <div className="flex-1 flex flex-col space-y-5">
                    <h3 className="text-xl font-bold text-white mb-2">Print Configuration</h3>

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
                        <span className="flex items-center gap-2"><Copy size={14}/> Number of Copies</span>
                        <span className="text-[10px] text-cyan-500/70">Max {Math.floor(30 / basePages)} allowed</span>
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
                       <div className="flex justify-between text-sm"><span className="text-zinc-400">Pages per copy</span><span className="text-white font-medium">{basePages}</span></div>
                       <div className="flex justify-between text-sm"><span className="text-zinc-400">Total Print Pages</span><span className="text-cyan-400 font-bold">{totalPages} / 30</span></div>
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
