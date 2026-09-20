import React from 'react';
import { Printer, Shield, Zap, MapPin, Mail, MessageCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function ArkoutLandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100">
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 bg-white/80 border-b border-slate-200 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* Arkout Logo */}
          <img 
            src="/WhatsApp Image 2026-09-20 at 11.39.34 PM.jpeg" 
            alt="Arkout Logo" 
            className="w-10 h-10 rounded-full shadow-sm object-cover"
          />
          <span className="text-xl font-bold tracking-tight text-slate-900">
            ARKOUT
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-blue-600 transition-colors">How it Works</a>
          <a href="#campuses" className="hover:text-blue-600 transition-colors">Campuses</a>
          <a href="#contact" className="hover:text-blue-600 transition-colors">Contact</a>
        </div>
        <a 
          href="/print" 
          className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm shadow-blue-200 transition-all flex items-center gap-2"
        >
          Start Printing <ArrowRight className="w-4 h-4" />
        </a>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 pt-24 pb-32 max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full">
          <span className="flex w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
          Now live at Pemraj Sarda College
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-6 leading-tight">
          Modernize Campus Printing. <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">
            Zero Maintenance Required.
          </span>
        </h1>
        <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-600 mb-10 leading-relaxed">
          Arkout is the fully autonomous, secure, and self-sustaining print kiosk designed for modern universities. No paper-jam tickets. No IT overhead.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a 
            href="/print" 
            className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all flex items-center justify-center gap-2"
          >
            Open Web Simulator <ArrowRight className="w-5 h-5" />
          </a>
          <a 
            href="#contact" 
            className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
          >
            Partner with Us
          </a>
        </div>
      </section>

      {/* Trust Ticker */}
      <div className="border-y border-slate-200 bg-white py-6 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap justify-center gap-8 md:gap-16 text-sm font-semibold text-slate-500">
          <span className="flex items-center gap-2"><Shield className="w-4 h-4"/> Military-Grade Security</span>
          <span className="flex items-center gap-2"><Zap className="w-4 h-4"/> Zero IT Overhead</span>
          <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> 45,000+ Prints Processed</span>
        </div>
      </div>

      {/* Features Grid (B2B Focus) */}
      <section id="features" className="px-6 py-24 max-w-6xl mx-auto">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Engineered for Institutions</h2>
          <p className="text-slate-600 max-w-2xl mx-auto">We built Arkout to completely remove the administrative burden of campus printing facilities.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Autonomous Operation</h3>
            <p className="text-slate-600 leading-relaxed">
              Hardware runs entirely on its own. No ink refill requests, no paper-jam support tickets for your staff to manage.
            </p>
          </div>
          <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Zero-Trace Security</h3>
            <p className="text-slate-600 leading-relaxed">
              Documents are encrypted in transit and permanently wiped from our servers the exact millisecond printing is complete.
            </p>
          </div>
          <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6">
              <Printer className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Resource Optimization</h3>
            <p className="text-slate-600 leading-relaxed">
              AI automatically detects and removes blank pages, optimizing ink and paper usage while saving students money.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="px-6 py-24 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Let's Bring Arkout to Your Campus</h2>
          <p className="text-slate-600">Have questions about deployment, hardware specs, or pricing? Reach out to our team directly.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Email Option */}
          <a 
            href="mailto:contact@arkout.in" 
            className="flex flex-col items-center justify-center p-10 bg-slate-50 border border-slate-200 rounded-3xl hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
          >
            <div className="w-16 h-16 bg-white shadow-sm border border-slate-200 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Mail className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Email Us</h3>
            <p className="text-slate-500 mb-4">For formal proposals and inquiries</p>
            <span className="text-lg font-semibold text-blue-600">contact@arkout.in</span>
          </a>

          {/* WhatsApp Option */}
          <div className="flex flex-col items-center justify-center p-10 bg-slate-50 border border-slate-200 rounded-3xl">
            <div className="w-16 h-16 bg-[#25D366]/10 text-[#25D366] rounded-2xl flex items-center justify-center mb-6">
              <MessageCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">WhatsApp</h3>
            <p className="text-slate-500 mb-6 text-center">Scan the code below for instant support</p>
            <img 
              src="/WhatsApp Image 2026-09-20 at 11.42.45 PM.jpeg" 
              alt="Arkout WhatsApp QR Code" 
              className="w-40 h-40 rounded-xl shadow-sm border border-slate-200"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 text-sm">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <img 
              src="/WhatsApp Image 2026-09-20 at 11.39.34 PM.jpeg" 
              alt="Arkout Logo" 
              className="w-8 h-8 rounded-full opacity-80"
            />
            <span className="text-white font-semibold tracking-wide">ARKOUT</span>
          </div>
          <p>© {new Date().getFullYear()} Arkout Digital Printing. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
