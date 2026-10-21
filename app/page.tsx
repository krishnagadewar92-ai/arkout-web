"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, CreditCard,
  FileText, Layers3, LockKeyhole, Menu, Monitor, Printer, QrCode,
  ShieldCheck, SlidersHorizontal, Sparkles, X, Zap,
} from "lucide-react";

const workflow = [
  {
    no: "01", title: "Connect", short: "Start with your kiosk",
    description: "Scan the QR code or enter the session PIN displayed on your terminal. You're guided into the right print flow.",
    icon: QrCode, screenTitle: "Your session is ready", screenBody: "Scan the code on your terminal, or enter the PIN shown on its screen.", screenAction: "CONNECT TO TERMINAL",
  },
  {
    no: "02", title: "Prepare", short: "Bring your document",
    description: "Upload your files and review the available settings before your document is sent for printing.",
    icon: FileText, screenTitle: "Bring your document", screenBody: "Choose your files and let the print flow prepare them for review.", screenAction: "CHOOSE DOCUMENTS",
  },
  {
    no: "03", title: "Choose", short: "Make the print yours",
    description: "Check the available colour, copy and layout options, with the displayed total visible before checkout.",
    icon: SlidersHorizontal, screenTitle: "Make it yours", screenBody: "Review the options offered by this terminal before you continue.", screenAction: "REVIEW PRINT OPTIONS",
  },
  {
    no: "04", title: "Collect", short: "Finish and get going",
    description: "Complete checkout and follow the prompts on the kiosk to collect your printed pages.",
    icon: Check, screenTitle: "Ready for the next step", screenBody: "Follow the kiosk prompts after checkout to collect your finished pages.", screenAction: "READY WHEN YOU ARE",
  },
];

const productDetails = [
  { id: "display", number: "A", title: "A focused interface", copy: "A dedicated screen brings the next step into view, so students can stay with the task instead of figuring out a complicated process.", tag: "THE INTERFACE", icon: Monitor },
  { id: "print", number: "B", title: "From digital to physical", copy: "The online flow and the printer meet at a purpose-built terminal: a familiar outcome, with a more considered path to get there.", tag: "THE OUTPUT", icon: Printer },
  { id: "control", number: "C", title: "Designed for shared spaces", copy: "A kiosk is part of a larger campus environment. The experience is designed around a clear session, visible choices and a dedicated point of use.", tag: "THE EXPERIENCE", icon: Layers3 },
];

const faqs = [
  { q: "How do I start a print job?", a: "Open the print flow, scan the QR code or enter the PIN shown on the kiosk, then follow the guided steps to upload and review your document." },
  { q: "Do I need to install an app?", a: "The print experience is designed around a browser-based session. Follow the instructions displayed for the terminal you're using." },
  { q: "Can our campus bring Arkout to students?", a: "Yes. Campus and institutional teams can contact us to discuss the space, print needs, hardware setup and possible pilot arrangements." },
];

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return <p className={"mb-5 flex items-center gap-3 font-mono text-[9px] font-semibold tracking-[.18em] " + (light ? "text-[#b7c8ff]" : "text-[#596c9f]")}><span className="h-px w-7 bg-current opacity-80" />{children}</p>;
}

export default function ArkoutLandingPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [activeDetail, setActiveDetail] = useState("display");
  const [menuOpen, setMenuOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const step = workflow[activeStep];
  const StepIcon = step.icon;
  const detail = productDetails.find((item) => item.id === activeDetail) ?? productDetails[0];
  const DetailIcon = detail.icon;

  const reveal = reducedMotion ? { initial: false, whileInView: undefined } : { initial: { opacity: 0, y: 28 }, whileInView: { opacity: 1, y: 0 } };

  return (
    <main id="top" className="overflow-clip bg-[#090a0d] font-sans text-[#f2f2f4] selection:bg-[#bdccff] selection:text-[#10131b]">
      <div className="relative z-40 flex min-h-[34px] flex-wrap items-center justify-center gap-2 bg-[#dbe4fa] px-3 py-2 text-center text-[10px] tracking-wide text-[#202a43]">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-700 ring-4 ring-emerald-800/10" />
        Campus printing, rethought for the everyday
        <span className="opacity-50">/</span>
        <a href="#experience" className="inline-flex items-center gap-1 font-semibold hover:underline">Take a closer look <ArrowRight size={12} /></a>
      </div>

      <section className="relative isolate min-h-[790px] overflow-hidden bg-[#090a0d] md:min-h-[min(900px,calc(100svh-34px))]">
        <motion.div aria-hidden="true" className="absolute -inset-2 -z-30" animate={reducedMotion ? undefined : { y: [0, -5, 0], scale: [1.015, 1.035, 1.015] }} transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}>
          <Image src="/arkout-kiosk-hero.webp" alt="Concept render of a modern self-service printing kiosk" fill priority sizes="100vw" className="object-cover object-[65%_center] opacity-90" />
        </motion.div>
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,#08090d_0%,rgba(8,9,13,.98)_21%,rgba(8,9,13,.88)_38%,rgba(8,9,13,.30)_68%,rgba(8,9,13,.05)_100%),linear-gradient(0deg,#090a0d_0%,transparent_30%,rgba(9,10,13,.25)_100%)] max-md:bg-[linear-gradient(90deg,rgba(8,9,13,.92),rgba(8,9,13,.64)_55%,rgba(8,9,13,.25)),linear-gradient(0deg,#090a0d_0%,rgba(9,10,13,.06)_50%,rgba(9,10,13,.48)_100%)]" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-[.10] [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:78px_78px] [mask-image:linear-gradient(90deg,#000,transparent_88%)]" />
        <header className="absolute left-0 right-0 top-0 z-30 border-b border-white/15 bg-black/[.08] backdrop-blur-[2px]">
          <div className="mx-auto flex min-h-[78px] w-[calc(100%-36px)] max-w-[1380px] items-center justify-between gap-4 md:w-[calc(100%-64px)]">
            <Link href="/" className="inline-flex items-center gap-2.5 text-[23px] font-semibold tracking-[-.075em] text-white" aria-label="Arkout home">
              <Image src="/arkout-logo.png" alt="" width={35} height={35} className="drop-shadow-lg" />
              <span>arkout<span className="text-[#a8bbff]">.</span></span>
            </Link>
            <nav className={(menuOpen ? "flex" : "hidden") + " absolute left-0 right-0 top-full flex-col gap-0 border-b border-white/15 bg-[#090a0d]/95 px-6 pb-5 backdrop-blur-2xl md:static md:flex md:flex-row md:items-center md:gap-9 md:border-0 md:bg-transparent md:p-0"} aria-label="Main navigation">
              <a onClick={() => setMenuOpen(false)} href="#experience" className="border-b border-white/10 py-4 text-xs text-white/70 transition hover:text-white md:border-0 md:py-0">The experience</a>
              <a onClick={() => setMenuOpen(false)} href="#product" className="border-b border-white/10 py-4 text-xs text-white/70 transition hover:text-white md:border-0 md:py-0">The product</a>
              <a onClick={() => setMenuOpen(false)} href="#campuses" className="border-b border-white/10 py-4 text-xs text-white/70 transition hover:text-white md:border-0 md:py-0">For campuses</a>
              <Link href="/print" onClick={() => setMenuOpen(false)} className="mt-4 inline-flex min-h-10 items-center justify-between gap-3 rounded-full border border-white/20 px-4 text-xs font-semibold text-white md:hidden">Start printing <ArrowUpRight size={15} /></Link>
            </nav>
            <div className="flex items-center gap-2">
              <Link href="/print" className="hidden min-h-10 items-center gap-2 rounded-full border border-white/25 bg-white/[.06] px-4 text-[11px] font-semibold text-white backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/15 sm:inline-flex">Start printing <ArrowUpRight size={15} /></Link>
              <button type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/[.05] text-white md:hidden">{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
            </div>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid w-[calc(100%-38px)] max-w-[1380px] pb-52 pt-[178px] sm:w-[calc(100%-64px)] md:min-h-[760px] md:items-center md:pb-40 md:pt-32">
          <motion.div {...reveal} transition={{ duration: reducedMotion ? 0 : .75, ease: [.2,.75,.25,1] }} viewport={{ once: true, amount: .2 }} className="max-w-[750px]">
            <p className="mb-8 flex flex-wrap items-center gap-3 text-[9px] font-bold tracking-[.18em] text-[#bdcbff] sm:text-[10px]"><span className="h-px w-7 bg-[#bdcbff]" />CAMPUS PRINTING, REIMAGINED <span className="ml-auto font-mono font-normal text-white/35 md:ml-3">01 — THE IDEA</span></p>
            <h1 className="max-w-[760px] text-[clamp(62px,9.1vw,126px)] font-medium leading-[.83] tracking-[-.092em] text-[#f6f6f7]">
              <motion.span initial={reducedMotion ? false : { opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reducedMotion ? 0 : .1, duration: reducedMotion ? 0 : .65, ease: "easeOut" }} className="block">Good work</motion.span>
              <motion.span initial={reducedMotion ? false : { opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reducedMotion ? 0 : .22, duration: reducedMotion ? 0 : .65, ease: "easeOut" }} className="block">shouldn&apos;t wait</motion.span>
              <motion.span initial={reducedMotion ? false : { opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reducedMotion ? 0 : .34, duration: reducedMotion ? 0 : .65, ease: "easeOut" }} className="block font-normal text-[#a7abb7]">in a queue.</motion.span>
            </h1>
            <p className="mt-8 max-w-[420px] text-[14px] leading-7 text-white/66 sm:text-[15px]">A more considered way to print on campus. Upload from your device, choose your options, check out, and collect your pages.</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
              <Link href="/print" className="group inline-flex min-h-12 items-center justify-center gap-4 rounded-full bg-[#f0f1f5] px-5 text-xs font-bold text-[#0b0c10] transition duration-300 hover:-translate-y-0.5 hover:bg-white">Start printing <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></Link>
              <a href="#experience" className="inline-flex items-center gap-2 text-xs text-white/75 transition hover:text-white">Explore the experience <ArrowDown size={14} /></a>
            </div>
            <div className="mt-7 flex max-w-[430px] flex-wrap items-center gap-2 text-[10px] leading-5 text-white/45"><LockKeyhole size={13} className="text-[#bdcbff]" />Session-based access <span className="mx-1 text-white/20">·</span> Clear choices before checkout</div>
          </motion.div>
        </div>

        <motion.div initial={reducedMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} whileHover={reducedMotion ? undefined : { y: -3 }} transition={{ delay: .5, duration: .65, ease: "easeOut" }} className="absolute bottom-[17%] right-[5%] z-10 hidden items-center gap-3 rounded-2xl border border-white/20 bg-[#0b0e16]/75 px-4 py-3 shadow-2xl backdrop-blur-xl sm:flex md:bottom-[19%] md:right-[7%]">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-blue-200/20 bg-blue-300/10 text-[#bdcbff]"><QrCode size={19} /></span>
          <span className="grid gap-1"><strong className="text-[11px] font-semibold text-white">Start in seconds</strong><small className="text-[9px] text-white/50">Scan or enter your PIN</small></span>
          <ArrowUpRight size={14} className="ml-3 text-white/40" />
        </motion.div>
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-3 border-t border-white/15 px-5 py-4 font-mono text-[7px] tracking-[.13em] text-white/40 sm:px-8 sm:text-[8px] md:px-10">
          <span>ARKOUT PRINTPOD / CONCEPT</span><span className="hidden sm:block">MADE FOR CAMPUS LIFE</span><a href="#experience" className="inline-flex items-center gap-2 transition hover:text-white/80">SCROLL TO EXPLORE <ArrowDown size={12} /></a>
        </div>
      </section>

      <section id="experience" className="relative bg-[#eeede7] px-5 py-20 text-[#111318] sm:px-8 md:px-[max(32px,calc((100%-1280px)/2))] md:py-32">
        <motion.div {...reveal} transition={{ duration: reducedMotion ? 0 : .7 }} viewport={{ once: true, amount: .2 }} className="flex items-center justify-between gap-4 border-b border-black/15 pb-4 font-mono text-[8px] tracking-[.14em] text-[#73767e] sm:text-[9px]"><span>THE EVERYDAY, RECONSIDERED</span><span>02 / THE EXPERIENCE</span></motion.div>
        <div className="grid gap-8 py-12 md:grid-cols-[1fr_.62fr] md:items-end md:gap-20 md:py-24">
          <motion.h2 {...reveal} transition={{ duration: reducedMotion ? 0 : .75, delay: .05 }} viewport={{ once: true, amount: .2 }} className="text-[clamp(52px,8.2vw,110px)] font-medium leading-[.88] tracking-[-.09em]">Less waiting.<br />More <em className="font-normal not-italic text-[#7a7e88]">moving.</em></motion.h2>
          <motion.div {...reveal} transition={{ duration: reducedMotion ? 0 : .7, delay: .12 }} viewport={{ once: true, amount: .2 }} className="max-w-[440px]">
            <p className="text-xl leading-snug tracking-[-.035em] text-[#262930] sm:text-[23px]">A campus day already has enough steps. Printing should feel like one less thing to figure out.</p>
            <p className="mt-5 text-[12px] leading-7 text-[#70737b] sm:text-[13px]">Arkout brings the digital workflow and the physical printer together in one guided experience: clear entry, clear options, and a clear next step.</p>
            <a href="#how-it-works" className="mt-7 inline-flex items-center gap-2 text-xs font-bold text-[#1a1c22]">See the flow <ArrowRight size={16} /></a>
          </motion.div>
        </div>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-black/10 bg-black/10 sm:grid-cols-3">
          {[
            { number: "01", title: "Start clearly", text: "A session begins at the terminal in front of you.", icon: QrCode },
            { number: "02", title: "Choose confidently", text: "Review the options and displayed total before checkout.", icon: SlidersHorizontal },
            { number: "03", title: "Get on with it", text: "Follow the kiosk prompts and collect your pages.", icon: Check },
          ].map((item, index) => {
            const Icon = item.icon;
            return <motion.article key={item.number} {...reveal} transition={{ duration: reducedMotion ? 0 : .65, delay: index * .08 }} viewport={{ once: true, amount: .2 }} className="group min-h-[206px] bg-[#f5f4ef] p-5 transition-colors hover:bg-white sm:p-7" whileHover={reducedMotion ? undefined : { y: -4 }}>
              <div className="flex items-center justify-between"><Icon size={20} className="text-[#526a9b]" strokeWidth={1.6} /><span className="font-mono text-[9px] text-[#92949b]">{item.number} / 03</span></div>
              <h3 className="mt-11 text-[20px] font-medium tracking-[-.055em]">{item.title}</h3><p className="mt-2 max-w-[250px] text-[11px] leading-6 text-[#73767d]">{item.text}</p>
            </motion.article>;
          })}
        </div>
      </section>

      <section id="how-it-works" className="bg-[#101116] px-5 py-20 sm:px-8 md:px-[max(32px,calc((100%-1280px)/2))] md:py-32">
        <div className="flex items-center justify-between gap-4 font-mono text-[8px] tracking-[.14em] text-[#aebfff] sm:text-[9px]"><span>A SHORTER ROUTE TO PAPER</span><span className="text-white/30">03 / THE FLOW</span></div>
        <div className="mt-10 grid gap-8 md:grid-cols-[.75fr_1.25fr] md:gap-16">
          <div>
            <h2 className="text-[clamp(49px,7.3vw,94px)] font-medium leading-[.9] tracking-[-.087em]">Four steps.<br /><em className="font-normal not-italic text-[#9a9da7]">Less friction.</em></h2>
            <p className="mt-6 max-w-[400px] text-[12px] leading-7 text-[#9a9ba4] sm:text-[13px]">Choose a step to explore how a campus print session moves from first touch to printed page.</p>
            <div role="tablist" aria-label="Print workflow steps" className="mt-8 flex flex-col">
              {workflow.map((item, index) => {
                const Icon = item.icon;
                const selected = activeStep === index;
                return <button key={item.no} type="button" role="tab" aria-selected={selected} aria-controls="workflow-panel" onClick={() => setActiveStep(index)} className={"group grid w-full grid-cols-[34px_1fr_24px] items-center gap-3 border-t border-white/10 px-1 py-5 text-left transition duration-300 last:border-b " + (selected ? "translate-x-1.5 text-white" : "text-white/45 hover:text-white/85")}>
                  <span className={"font-mono text-[10px] " + (selected ? "text-[#bdcbff]" : "text-white/30")}>{item.no}</span><span className="grid gap-1.5"><strong className="text-[13px] font-semibold tracking-tight">{item.title}</strong><small className="text-[10px] text-[#858791]">{item.short}</small></span><Icon size={19} className={"justify-self-end transition " + (selected ? "text-[#bdcbff]" : "text-white/35 group-hover:text-white/70")} />
                </button>;
              })}
            </div>
            <p className="mt-6 flex items-start gap-2 text-[10px] leading-5 text-[#7d7f89]"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#aebfff]" />Available options are shown by the terminal you use.</p>
          </div>

          <div id="workflow-panel" role="tabpanel" aria-live="polite" className="relative flex min-h-[440px] flex-col justify-between overflow-hidden rounded-[22px] border border-white/15 bg-[radial-gradient(ellipse_at_60%_32%,rgba(73,104,180,.24),transparent_48%),linear-gradient(145deg,#1a1c25,#111217_70%)] p-5 shadow-2xl sm:p-7">
            <div aria-hidden="true" className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-blue-200/[.09] [transform:scaleY(.65)_rotate(23deg)]" />
            <div className="relative flex items-center justify-between gap-3 font-mono text-[8px] tracking-[.13em] text-[#85899a]"><span>ARKOUT / SESSION FLOW</span><span className="inline-flex items-center gap-2 text-[#b9c8f3]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> GUIDED EXPERIENCE</span></div>
            <AnimatePresence mode="wait">
              <motion.div key={step.no} initial={reducedMotion ? false : { opacity: 0, y: 12, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={reducedMotion ? undefined : { opacity: 0, y: -8 }} transition={{ duration: reducedMotion ? 0 : .28 }} className="relative z-10 mx-auto my-8 w-full max-w-[440px] text-center">
                <div className="absolute left-1/2 top-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(76,112,194,.23),rgba(57,83,144,.05)_50%,transparent_71%)]" />
                <div className="mx-auto mb-5 grid h-[76px] w-[76px] place-items-center rounded-[24px] border border-blue-200/20 bg-gradient-to-br from-blue-200/15 to-blue-900/15 text-[#bdcbff] shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_15px_40px_rgba(46,80,151,.16)]"><StepIcon size={35} strokeWidth={1.35} /></div>
                <span className="font-mono text-[8px] tracking-[.16em] text-[#8e9fcd]">STEP {step.no} / 04</span><h3 className="mt-3 text-2xl font-medium tracking-[-.055em] text-[#f2f3f7] sm:text-3xl">{step.screenTitle}</h3><p className="mx-auto mt-3 max-w-[350px] text-[11px] leading-6 text-[#9699a6] sm:text-xs">{step.screenBody}</p>
                <div className="mx-auto mt-7 max-w-[310px] rounded-xl border border-white/10 bg-black/20 p-3 text-left">
                  <div className="flex items-center justify-between"><span className="font-mono text-[7px] tracking-[.1em] text-white/35">TERMINAL INTERFACE</span><span className="flex gap-1"><i className="h-1 w-1 rounded-full bg-white/20"/><i className="h-1 w-1 rounded-full bg-white/20"/><i className="h-1 w-1 rounded-full bg-[#a8bcff]"/></span></div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[.07]"><motion.div initial={false} animate={{ width: ((activeStep + 1) * 25) + "%" }} transition={{ duration: reducedMotion ? 0 : .35 }} className="h-full rounded-full bg-[#a8bcff]" /></div>
                  <p className="mt-3 text-center font-mono text-[8px] tracking-[.1em] text-[#b8c8fc]">{step.screenAction}</p>
                </div>
              </motion.div>
            </AnimatePresence>
            <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 font-mono text-[8px] text-[#8eaa9a]"><span className="inline-flex items-center gap-1"><Check size={13} className="text-emerald-300" />Clear prompts</span><span className="inline-flex items-center gap-1"><Check size={13} className="text-emerald-300" />Guided next step</span><span className="text-white/40">{step.no} / 04</span></div>
          </div>
        </div>
      </section>

      <section id="product" className="bg-[#e7e5df] px-5 py-20 text-[#111318] sm:px-8 md:px-[max(32px,calc((100%-1280px)/2))] md:py-32">
        <div className="grid gap-10 md:grid-cols-[.82fr_1.18fr] md:items-center md:gap-16">
          <div>
            <Eyebrow>THE PHYSICAL TOUCHPOINT</Eyebrow>
            <h2 className="text-[clamp(48px,7vw,86px)] font-medium leading-[.9] tracking-[-.09em]">Digital ease.<br /><em className="font-normal not-italic text-[#7a7e88]">Paper in hand.</em></h2>
            <p className="mt-6 max-w-[450px] text-[12px] leading-7 text-[#70737b] sm:text-[13px]">A product experience should feel connected, from the first screen to the moment the pages arrive.</p>
            <div className="mt-8 max-w-[520px] border-t border-black/15">
              {productDetails.map((item) => {
                const Icon = item.icon;
                const selected = activeDetail === item.id;
                return <button type="button" key={item.id} onClick={() => setActiveDetail(item.id)} aria-pressed={selected} className={"group flex w-full items-start gap-4 border-b border-black/15 py-4 text-left transition " + (selected ? "text-[#111318]" : "text-[#73767c] hover:text-[#272a31]")}>
                  <span className={"grid h-8 w-8 shrink-0 place-items-center rounded-full border font-mono text-[9px] transition " + (selected ? "border-[#596c9f]/40 bg-white/70 text-[#526a9b]" : "border-black/15 text-[#8a8c92]")}>{item.number}</span>
                  <span className="grid flex-1 gap-1.5"><strong className="text-[13px] font-semibold">{item.title}</strong><AnimatePresence initial={false}><motion.span key={selected ? item.copy : item.id + "-closed"} initial={reducedMotion ? false : { opacity: 0, height: 0 }} animate={{ opacity: selected ? 1 : 0, height: selected ? "auto" : 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: reducedMotion ? 0 : .22 }} className="overflow-hidden text-[11px] leading-6 text-[#70737b]">{selected ? item.copy : ""}</motion.span></AnimatePresence></span>
                  <Icon size={17} className={"mt-1 shrink-0 " + (selected ? "text-[#526a9b]" : "text-[#9a9ca2]")} />
                </button>;
              })}
            </div>
            <Link href="/print" className="mt-7 inline-flex min-h-11 items-center gap-3 rounded-full bg-[#15171d] px-5 text-[11px] font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#292c34]">Explore print options <ArrowUpRight size={15} /></Link>
          </div>
          <motion.div {...reveal} transition={{ duration: reducedMotion ? 0 : .7 }} viewport={{ once: true, amount: .15 }} className="relative min-h-[470px] overflow-hidden rounded-[18px] bg-[#080a0e] shadow-[0_35px_90px_rgba(36,43,56,.16)] sm:min-h-[610px]">
            <Image src="/arkout-kiosk-hero.webp" alt="Illustrative product concept render of the Arkout printing kiosk" fill sizes="(max-width:900px) 92vw,55vw" className="object-cover object-[68%_center] transition duration-700 hover:scale-[1.025]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-black/10" />
            <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3 py-2 font-mono text-[8px] tracking-[.1em] text-white/65 backdrop-blur-lg"><Sparkles size={12} className="text-[#bdcbff]" />{detail.tag}</div>
            <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4">
              <div><p className="font-mono text-[8px] tracking-[.14em] text-white/50">ARKOUT PRINTPOD / CONCEPT</p><h3 className="mt-2 max-w-[450px] text-3xl font-medium tracking-[-.06em] text-white sm:text-4xl">{detail.title}</h3></div>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/20 bg-white/[.08] text-white backdrop-blur-md"><DetailIcon size={19} /></span>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="bg-[#f3f2ed] px-5 py-16 text-[#111318] sm:px-8 md:px-[max(32px,calc((100%-1280px)/2))] md:py-20">
        <div className="grid gap-8 border-y border-black/10 py-8 md:grid-cols-[.65fr_1.35fr] md:items-center md:py-10">
          <div><Eyebrow>THE DESIGN PRINCIPLE</Eyebrow><p className="text-[clamp(32px,4.5vw,54px)] font-medium leading-[.96] tracking-[-.08em]">Simple on the surface.<br /><span className="text-[#81848b]">Thoughtful underneath.</span></p></div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: ShieldCheck, title: "A clear session", body: "A focused start, connected to the kiosk you're using." },
              { icon: CreditCard, title: "Review then checkout", body: "Available options and the displayed total before you confirm." },
              { icon: Zap, title: "A guided flow", body: "Prompts designed to help you know what comes next." },
            ].map((item, index) => { const Icon = item.icon; return <motion.article key={item.title} {...reveal} transition={{ duration: reducedMotion ? 0 : .55, delay: index * .07 }} viewport={{ once: true, amount: .2 }} className="rounded-xl border border-black/10 bg-white/45 p-4 transition duration-300 hover:-translate-y-1 hover:bg-white/85 sm:p-5" whileHover={reducedMotion ? undefined : { y: -4 }}><Icon size={20} strokeWidth={1.6} className="text-[#536da8]" /><h3 className="mt-8 text-[12px] font-semibold">{item.title}</h3><p className="mt-2 text-[10px] leading-6 text-[#777a82]">{item.body}</p></motion.article>; })}
          </div>
        </div>
      </section>

      <section id="campuses" className="relative isolate grid gap-4 overflow-hidden bg-[#0c0d12] px-5 py-20 sm:px-8 md:grid-cols-[1fr_.72fr] md:items-center md:px-[max(32px,calc((100%-1280px)/2))] md:py-32">
        <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-[.09] [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:76px_76px] [mask-image:linear-gradient(90deg,#000,transparent_95%)]" />
        <div>
          <Eyebrow light>FOR CAMPUSES & INSTITUTIONS</Eyebrow>
          <h2 className="text-[clamp(52px,7.5vw,94px)] font-medium leading-[.88] tracking-[-.09em] text-[#f2f2f4]">Make room for<br /><em className="font-normal not-italic text-[#999eac]">what&apos;s next.</em></h2>
          <p className="mt-6 max-w-[440px] text-[12px] leading-7 text-[#a0a2ac] sm:text-[13px]">Exploring a self-service printing experience for your campus? Let&apos;s talk about the space, student needs and what a pilot could look like.</p>
          <div className="mt-8 flex flex-wrap items-center gap-5"><a href="mailto:contact@arkout.in?subject=Arkout%20campus%20pilot" className="group inline-flex min-h-12 items-center gap-4 rounded-full bg-[#f0f1f5] px-5 text-xs font-bold text-[#0a0b0e] transition hover:-translate-y-0.5 hover:bg-white">Talk with Arkout <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></a><a href="https://wa.me/917758820337" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[11px] text-white/65 transition hover:text-white">Ask a question <ArrowRight size={15} /></a></div>
        </div>
        <div aria-hidden="true" className="relative grid min-h-[280px] place-items-center overflow-hidden sm:min-h-[350px]">
          <div className="absolute h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(104,137,219,.25),rgba(58,72,114,.08)_48%,transparent_72%)] blur-md" />
          <motion.div animate={reducedMotion ? undefined : { rotate: 360 }} transition={{ duration: 54, repeat: Infinity, ease: "linear" }} className="absolute h-[230px] w-[230px] rounded-full border border-blue-100/20 [transform:scaleY(.58)]" />
          <motion.div animate={reducedMotion ? undefined : { rotate: -360 }} transition={{ duration: 78, repeat: Infinity, ease: "linear" }} className="absolute h-[300px] w-[300px] rounded-full border border-blue-100/10 [transform:scaleY(.58)]" />
          <div className="relative flex items-end text-[150px] font-medium leading-[.8] tracking-[-.14em] text-[#eff1f8] drop-shadow-[0_0_70px_rgba(112,145,225,.35)]">a<span className="text-[#9db6ff]">.</span></div>
          <div className="absolute bottom-2 right-0 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.04] px-4 py-2.5 text-[9px] text-[#bbbfd0] backdrop-blur-xl"><Sparkles size={14} className="text-[#afc2ff]" /> A smoother campus essential</div>
        </div>
      </section>

      <section className="grid gap-8 bg-[#e7e5df] px-5 py-20 text-[#111318] sm:px-8 md:grid-cols-[.75fr_1.25fr] md:gap-16 md:px-[max(32px,calc((100%-1280px)/2))] md:py-28">
        <div><Eyebrow>A FEW GOOD QUESTIONS</Eyebrow><h2 className="text-[clamp(48px,6.5vw,79px)] font-medium leading-[.9] tracking-[-.085em]">Before you<br /><em className="font-normal not-italic text-[#7a7e88]">get printing.</em></h2></div>
        <div className="border-t border-black/15">{faqs.map((faq) => <details key={faq.q} className="group border-b border-black/15"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[12px] font-semibold text-[#262830] transition hover:text-[#526a9b] sm:text-[13px]">{faq.q}<ChevronDown size={17} className="shrink-0 transition group-open:rotate-180" /></summary><p className="max-w-[620px] pb-6 pr-8 text-[11px] leading-7 text-[#6d7078] sm:text-xs">{faq.a}</p></details>)}</div>
      </section>

      <footer className="bg-[#08090c] px-5 py-7 sm:px-8 md:px-[max(32px,calc((100%-1280px)/2))]">
        <div className="flex flex-wrap items-center gap-4 border-b border-white/10 pb-6"><Link href="/" className="inline-flex items-center gap-2.5 text-[21px] font-semibold tracking-[-.075em] text-white"><Image src="/arkout-logo.png" alt="" width={30} height={30} />arkout<span className="-ml-2 text-[#9dbbff]">.</span></Link><p className="flex-1 text-[10px] text-white/45">Good work, moving forward.</p><Link href="/print" className="inline-flex items-center gap-2 text-[10px] text-white/70 transition hover:text-white">Start printing <ArrowUpRight size={14} /></Link></div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-5 font-mono text-[8px] text-white/35"><span>© {new Date().getFullYear()} Arkout Techworks Pvt. Ltd.</span><div className="flex gap-5"><a href="#top" className="hover:text-white/80">Back to top ↑</a><a href="mailto:contact@arkout.in" className="hover:text-white/80">Contact</a><Link href="/admin" className="hover:text-white/80">Operations</Link></div><span className="hidden sm:block">Designed around the details.</span></div>
      </footer>
    </main>
  );
}
