"use client";

import { motion } from "framer-motion";
import { ChevronRight, Zap, Shield, Clock, Smartphone, Cloud, FileText, Lock } from "lucide-react";
import Image from "next/image";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#050505] text-white selection:bg-cyan-500/30 overflow-x-hidden font-sans">
      
      {/* Background Architectural Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none fixed"></div>
      
      {/* Deep Ambient Space Glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1000px] h-[800px] bg-gradient-to-b from-cyan-500/15 via-purple-500/5 to-transparent rounded-full blur-[150px] pointer-events-none fixed"></div>

      {/* Glassmorphic Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-[#050505]/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="relative w-32 h-10">
            {/* FIX: Added 'sizes' to kill the terminal warning */}
            <Image src="/logo.png" alt="Arkout" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-contain" priority />
          </div>
          <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-zinc-400">
            <span className="hover:text-white cursor-pointer transition-colors">How it Works</span>
            <span className="hover:text-white cursor-pointer transition-colors">Features</span>
            <span className="hover:text-white cursor-pointer transition-colors">Campuses</span>
          </div>
          
          <a 
            href="/print" 
            className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-bold hover:scale-105 transition-transform flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
          >
            Launch Hub <ChevronRight size={16} />
          </a>
        </div>
      </nav>

      {/* 1. HERO SECTION */}
      <section className="relative pt-48 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center text-center z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="inline-flex items-center space-x-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full mb-8 backdrop-blur-md"
        >
          <Zap size={14} className="text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-zinc-300">The Future of Campus Printing</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.1 }}
          className="text-6xl md:text-8xl font-extrabold tracking-tighter mb-8 leading-[1.1]"
        >
          Print without <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500">waiting.</span>
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
          className="text-lg md:text-xl text-zinc-400 max-w-2xl mb-12 font-medium"
        >
          Arkout is the world’s first autonomous print station. Scan the code, drop your files, pay with UPI, and collect your documents in under 30 seconds.
        </motion.p>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <a 
            href="/print" 
            className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white px-8 py-4 rounded-full text-lg font-bold hover:opacity-90 transition-opacity flex items-center gap-2 shadow-[0_0_40px_rgba(0,229,255,0.3)]"
          >
            Try the Web Simulator
          </a>
        </motion.div>
      </section>

      {/* 2. TRUST TICKER (Infinite Scroll) */}
      <section className="w-full border-y border-white/5 bg-[#0A0A0A] py-6 overflow-hidden relative z-10">
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#050505] to-transparent z-10"></div>
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#050505] to-transparent z-10"></div>
        <div className="flex whitespace-nowrap overflow-hidden">
          <motion.div 
            animate={{ x: ["0%", "-50%"] }} transition={{ duration: 20, ease: "linear", repeat: Infinity }}
            className="flex items-center space-x-16 text-sm font-bold uppercase tracking-widest text-zinc-500"
          >
            <span className="flex items-center gap-2"><Clock size={16} className="text-cyan-400"/> Zero Queues</span>
            <span className="flex items-center gap-2"><Zap size={16} className="text-purple-400"/> 45,000+ Prints This Month</span>
            <span className="flex items-center gap-2"><Shield size={16} className="text-emerald-400"/> Military-Grade File Security</span>
            <span>Deployed at 12 Campuses</span>
            <span className="flex items-center gap-2"><Clock size={16} className="text-cyan-400"/> Zero Queues</span>
            <span className="flex items-center gap-2"><Zap size={16} className="text-purple-400"/> 45,000+ Prints This Month</span>
            <span className="flex items-center gap-2"><Shield size={16} className="text-emerald-400"/> Military-Grade File Security</span>
            <span>Deployed at 12 Campuses</span>
          </motion.div>
        </div>
      </section>

      {/* 3. BENTO BOX FEATURES GRID */}
      <section className="py-32 px-6 max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">The Arkout Advantage</h2>
          <p className="text-zinc-400 text-lg">Designed to eliminate friction from campus printing.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[250px]">
          
          <motion.div 
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
            className="md:col-span-2 bg-[#0A0A0A]/80 border border-white/10 rounded-[32px] p-8 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-colors"></div>
            <FileText size={32} className="text-purple-400 mb-6" />
            <h3 className="text-2xl font-bold mb-2">AI Page Optimization</h3>
            <p className="text-zinc-400 max-w-md">Our neural engine automatically detects blank pages, calculates ink density, and guarantees you only pay for what you actually print.</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-[#0A0A0A]/80 border border-white/10 rounded-[32px] p-8 relative overflow-hidden group"
          >
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/20 transition-colors"></div>
            <Smartphone size={32} className="text-cyan-400 mb-6" />
            <h3 className="text-xl font-bold mb-2">Scan & Pay</h3>
            <p className="text-zinc-400 text-sm">Lightning-fast QR generation compatible with GPay, PhonePe, and Paytm.</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-[#0A0A0A]/80 border border-white/10 rounded-[32px] p-8 relative overflow-hidden group"
          >
            <Cloud size={32} className="text-emerald-400 mb-6" />
            <h3 className="text-xl font-bold mb-2">Cloud Agnostic</h3>
            <p className="text-zinc-400 text-sm">Upload seamlessly from your local storage, WhatsApp, or Google Drive.</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.3 }}
            className="md:col-span-2 bg-[#0A0A0A]/80 border border-white/10 rounded-[32px] p-8 relative overflow-hidden group"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-cyan-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <Lock size={32} className="text-zinc-300 mb-6" />
            <h3 className="text-2xl font-bold mb-2">Zero-Trace Security</h3>
            <p className="text-zinc-400 max-w-md">Your exams, assignments, and personal documents are automatically permanently wiped from our local hardware the exact millisecond your print is complete.</p>
          </motion.div>

        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-zinc-600 text-sm font-medium z-10 relative">
        &copy; 2026 arkout.in • Engineered in Pune, India
      </footer>

    </main>
  );
}