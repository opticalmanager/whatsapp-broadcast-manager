"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Radio, 
  Sparkles, 
  Send, 
  ShieldCheck, 
  Zap, 
  Users, 
  CheckCircle2, 
  TrendingUp, 
  Smartphone, 
  Eye, 
  ArrowRight, 
  ChevronRight, 
  FileSpreadsheet, 
  Lock, 
  Database, 
  Server, 
  Check, 
  Star, 
  Clock, 
  Play, 
  Cpu, 
  ChevronDown,
  ExternalLink,
  Sliders,
  CheckCheck
} from "lucide-react";
import confetti from "canvas-confetti";
import { useAuth } from "@/lib/auth-context";

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  
  // Interactive Simulator State
  const [simCustomerName, setSimCustomerName] = useState("Rahul Sharma");
  const [simPowerDue, setSimPowerDue] = useState("-2.50 D (1 Year Ago)");
  const [simDiscountCode, setSimDiscountCode] = useState("VISION25");
  const [simDelaySpeed, setSimDelaySpeed] = useState(12);
  const [simMediaType, setSimMediaType] = useState<"TEXT" | "IMAGE" | "PDF">("IMAGE");
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStep, setSimStep] = useState<"IDLE" | "TYPING" | "SENT" | "DELIVERED" | "READ">("READ");
  const [simQueueProgress, setSimQueueProgress] = useState(100);

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#10b981", "#6366f1", "#38bdf8", "#ec4899"],
      });
    } catch {}
  };

  const runSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimStep("TYPING");
    setSimQueueProgress(15);

    setTimeout(() => {
      setSimStep("SENT");
      setSimQueueProgress(50);
    }, 1200);

    setTimeout(() => {
      setSimStep("DELIVERED");
      setSimQueueProgress(85);
    }, 2400);

    setTimeout(() => {
      setSimStep("READ");
      setSimQueueProgress(100);
      setIsSimulating(false);
      triggerConfetti();
    }, 3800);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white relative overflow-x-hidden">
      
      {/* Dynamic Background Glow Mesh */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-tr from-emerald-600/15 via-indigo-600/15 to-sky-500/10 blur-[130px] rounded-full" />
        <div className="absolute top-[40%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[700px] h-[500px] bg-emerald-600/10 blur-[150px] rounded-full" />
      </div>

      {/* Sticky Glassmorphic Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-[1px] shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-white">OpticalManager</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-wider border border-emerald-500/30">
                  PRO
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium block -mt-0.5">
                WhatsApp Broadcast Engine
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-300">
            <a href="#simulator" className="hover:text-emerald-400 transition-colors">Live Simulator</a>
            <a href="#features" className="hover:text-emerald-400 transition-colors">Features</a>
            <a href="#architecture" className="hover:text-emerald-400 transition-colors">Anti-Ban Engine</a>
            <a href="#pricing" className="hover:text-emerald-400 transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-emerald-400 transition-colors">FAQ</a>
          </nav>

          {/* Right Action Group */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Open Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 transition-colors hidden sm:block"
                >
                  Sign In
                </Link>

                <Link
                  href="/signup"
                  onClick={triggerConfetti}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Get Started Free</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-16 pb-20 px-4 sm:px-6 max-w-7xl mx-auto text-center space-y-8">
        
        {/* Floating Announcement Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-slate-300 text-xs shadow-xl backdrop-blur-md hover:border-emerald-500/50 transition-all cursor-pointer">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-emerald-400">Next-Gen Release 3.0</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300">Dedicated Supabase Cloud & 99.4% Anti-Ban Engine</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        </div>

        {/* Main Headline */}
        <div className="space-y-4 max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.1]">
            The High-Throughput <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 bg-clip-text text-transparent">
              WhatsApp Broadcast Engine
            </span>
          </h1>
          <p className="text-sm sm:text-lg text-slate-400 max-w-2xl mx-auto font-normal leading-relaxed">
            Import permanent CSV customer phonebooks, generate rich dynamic vouchers & prescription recalls, and dispatch safely with randomized human jitter delays. Zero Meta per-message taxes.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
            >
              <Sparkles className="w-4 h-4" />
              <span>Go to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <Link
              href="/signup"
              onClick={triggerConfetti}
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
            >
              <Sparkles className="w-4 h-4" />
              <span>Launch Free Broadcast</span>
            </Link>
          )}

          <a
            href="#simulator"
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-slate-200 font-semibold text-sm transition-all flex items-center justify-center gap-2"
          >
            <Play className="w-3.5 h-3.5 text-emerald-400" />
            <span>Try Live Simulator</span>
          </a>
        </div>

        {/* Social Proof Avatars */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs text-slate-400">
          <div className="flex -space-x-2">
            {["RK", "AP", "VS", "NM", "SP"].map((initials, i) => (
              <div
                key={i}
                className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500 border-2 border-slate-950 flex items-center justify-center text-[10px] font-bold text-white shadow"
              >
                {initials}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
              ))}
            </div>
            <span className="font-bold text-slate-200">4.9/5</span>
            <span>from 450+ Optical Stores & Retail Brands</span>
          </div>
        </div>

        {/* Tech Badges */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-slate-400">
          <span className="px-3 py-1 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center gap-1.5">
            <Database className="w-3 h-3 text-emerald-400" /> Dedicated Supabase DB
          </span>
          <span className="px-3 py-1 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-amber-400" /> BullMQ Safe Throttle Queue
          </span>
          <span className="px-3 py-1 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center gap-1.5">
            <CheckCheck className="w-3 h-3 text-sky-400" /> Real-time Blue Ticks
          </span>
          <span className="px-3 py-1 rounded-lg bg-slate-900/60 border border-slate-800 flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-purple-400" /> Multi-Device Resilient Sockets
          </span>
        </div>

      </section>

      {/* SHOWSTOPPER: Interactive Live WhatsApp Simulator */}
      <section id="simulator" className="relative z-10 py-16 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="text-center space-y-3 mb-10">
          <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            Interactive Testbed
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            See How the Broadcast Engine Works in Real-Time
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Test custom recipient variables, adjust human delay jitter speeds, and watch real-time simulated WhatsApp delivery with double blue ticks.
          </p>
        </div>

        {/* Live Simulator Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Controls Pane (6 Cols) */}
          <div className="lg:col-span-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Campaign Variable Injector</h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Safe Dispatch Active
              </span>
            </div>

            {/* Variable Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">Recipient Name</label>
                <input
                  type="text"
                  value={simCustomerName}
                  onChange={(e) => setSimCustomerName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">Recall Reason</label>
                <input
                  type="text"
                  value={simPowerDue}
                  onChange={(e) => setSimPowerDue(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">Voucher Code</label>
                <input
                  type="text"
                  value={simDiscountCode}
                  onChange={(e) => setSimDiscountCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">Attachment Format</label>
                <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  {(["TEXT", "IMAGE", "PDF"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setSimMediaType(t)}
                      className={"py-1 text-[10px] font-bold rounded-lg transition-all " + (simMediaType === t ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:text-white")}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Jitter Slider */}
            <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" /> Human Delay Jitter:
                </span>
                <span className="font-mono text-emerald-400 font-bold">{simDelaySpeed}s - {simDelaySpeed + 6}s (Randomized)</span>
              </div>
              <input
                type="range"
                min="5"
                max="25"
                value={simDelaySpeed}
                onChange={(e) => setSimDelaySpeed(parseInt(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <p className="text-[10px] text-slate-500">
                Randomized delays mimic natural human typing cadence, preventing WhatsApp spam heuristic triggers.
              </p>
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-3">
              <button
                onClick={runSimulation}
                disabled={isSimulating}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSimulating ? "Simulating Live Dispatch..." : "Trigger Live Dispatch Test"}</span>
              </button>

              <Link
                href="/campaigns/new"
                className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <span>Full Wizard</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            {/* Simulated Live Queue Progress */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Queue Status (148 Recipients)</span>
                <span className="text-emerald-400 font-mono font-bold">{simQueueProgress}% Complete</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: simQueueProgress + "%" }}
                />
              </div>
            </div>
          </div>

          {/* Right Phone Mockup Pane (6 Cols) */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="w-full max-w-[340px] bg-slate-950 border-[6px] border-slate-800 rounded-[38px] overflow-hidden shadow-2xl relative shadow-emerald-500/10">
              
              {/* Phone Top Notch */}
              <div className="bg-[#0b141a] px-4 py-2 flex items-center justify-between border-b border-slate-800/60 text-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center text-xs font-bold">
                    OM
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-white leading-tight">Vision Craft Optical</p>
                    <p className="text-[9px] text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Online • Verified Store
                    </p>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">10:42 AM</div>
              </div>

              {/* Chat Message Stream */}
              <div className="bg-[#0c1317] p-3 space-y-3 min-h-[380px] flex flex-col justify-end text-xs">
                
                {/* Outgoing Message Bubble */}
                <div className="bg-[#005c4b] text-slate-100 rounded-2xl rounded-tr-none p-3 space-y-2 shadow-md max-w-[90%] self-end">
                  
                  {/* Media Attachment Preview if selected */}
                  {simMediaType === "IMAGE" && (
                    <div className="rounded-xl overflow-hidden bg-slate-900 relative border border-emerald-500/20">
                      <div className="h-28 bg-gradient-to-tr from-slate-900 via-indigo-950 to-emerald-950 flex flex-col items-center justify-center p-3 text-center">
                        <Sparkles className="w-6 h-6 text-amber-400 mb-1" />
                        <span className="text-[11px] font-bold text-white">Summer Eyewear Festival</span>
                        <span className="text-[9px] text-emerald-400 font-mono">25% OFF On Blue-Cut Lenses</span>
                      </div>
                    </div>
                  )}

                  {simMediaType === "PDF" && (
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-black/30 border border-emerald-500/20">
                      <FileSpreadsheet className="w-6 h-6 text-rose-400" />
                      <div>
                        <p className="text-[10px] font-bold text-white">Eye_Prescription_Recall.pdf</p>
                        <p className="text-[8px] text-slate-300">1.2 MB • Tap to open voucher</p>
                      </div>
                    </div>
                  )}

                  {/* Body Text with Dynamic Variables */}
                  <p className="text-[11px] leading-relaxed text-slate-100 whitespace-pre-line">
                    Hello <strong className="text-amber-300">{simCustomerName}</strong>! 👋{"\n\n"}
                    Your annual eye checkup is due ({simPowerDue}). Upgrade your prescription lenses today with 20% instant store credit.{"\n\n"}
                    Use VIP Code: <span className="bg-black/40 px-1.5 py-0.5 rounded font-mono font-bold text-emerald-300">{simDiscountCode}</span>
                  </p>

                  {/* Status Indicator & Ticks */}
                  <div className="flex items-center justify-end gap-1 text-[9px] text-emerald-200/80 pt-0.5">
                    <span>Just now</span>
                    {simStep === "TYPING" && <span className="text-amber-300 italic font-mono">typing...</span>}
                    {simStep === "SENT" && <Check className="w-3.5 h-3.5 text-slate-300" />}
                    {simStep === "DELIVERED" && <CheckCheck className="w-3.5 h-3.5 text-slate-300" />}
                    {simStep === "READ" && <CheckCheck className="w-3.5 h-3.5 text-sky-400 font-bold" />}
                  </div>
                </div>

                {/* Simulated Customer Reply */}
                {simStep === "READ" && (
                  <div className="bg-[#202c33] text-slate-100 rounded-2xl rounded-tl-none p-2.5 shadow-md max-w-[80%] self-start animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-0.5">
                    <p className="text-[11px]">
                      Thanks! Can I book an appointment for tomorrow at 5 PM?
                    </p>
                    <span className="text-[8px] text-slate-400 block text-right">10:43 AM</span>
                  </div>
                )}

              </div>

              {/* Chat Bottom Bar */}
              <div className="bg-[#1f2c34] px-3 py-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800">
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-400" /> End-to-End Encrypted
                </span>
                <span className="text-emerald-400 font-bold">100% Native Direct</span>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* BENTO GRID: Core Superpowers */}
      <section id="features" className="relative z-10 py-16 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="text-center space-y-3 mb-12">
          <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            Enterprise Grade Architecture
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Built for Massive Scale, Zero Ban Risk
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Everything you need to run high-converting retail WhatsApp marketing on autopilot.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Card 1: Dedicated Supabase DB */}
          <div className="md:col-span-2 bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 hover:border-emerald-500/40 transition-all group">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                Dedicated Supabase Cloud & Permanent CSV Phonebook
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Independent database storage with smart CSV/Excel parsing. Upload once, tag customers (e.g. VIP, Sunglasses, Progressive Lenses), and launch repeated campaigns without ever polluting or bloating your CRM tables.
              </p>
            </div>
            <div className="pt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400">✓ Auto-Deduplication</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400">✓ Indian +91 Auto Normalization</span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400">✓ Dynamic Tag Queries</span>
            </div>
          </div>

          {/* Card 2: Anti-Ban Human Jitter */}
          <div className="bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 hover:border-emerald-500/40 transition-all group">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                Humanized Anti-Ban Engine
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Smart warm-up tiers, simulated typing indicators, randomized 8s-20s pauses, and dynamic text variation prevent bot detection triggers.
              </p>
            </div>
            <span className="inline-block text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              99.4% Delivery Success Rate
            </span>
          </div>

          {/* Card 3: Instant QR Pairing */}
          <div className="bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 hover:border-emerald-500/40 transition-all group">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white group-hover:text-sky-400 transition-colors">
                1-Click QR Pairing
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Scan via WhatsApp Linked Devices in 3 seconds. Redis multi-key persistent auth keeps your socket connected 24/7 without session drops.
              </p>
            </div>
          </div>

          {/* Card 4: Real-time Blue Ticks & Audits */}
          <div className="bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 hover:border-emerald-500/40 transition-all group">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">
                Real-Time Blue Tick Receipts
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Know exactly who read your message, when they opened it, and live recipient status breakdowns (Delivered vs Read vs Failed).
              </p>
            </div>
          </div>

          {/* Card 5: Dual Auth Flexibility */}
          <div className="bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 hover:border-emerald-500/40 transition-all group">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-white group-hover:text-teal-400 transition-colors">
                Dual Auth Flexibility
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Log in via standalone email + password or 1-click seamless SSO from your OpticalManager CRM dashboard. Unified sessions everywhere.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* TECH ARCHITECTURE PIPELINE */}
      <section id="architecture" className="relative z-10 py-16 px-4 sm:px-6 max-w-7xl mx-auto border-t border-slate-900">
        <div className="text-center space-y-3 mb-12">
          <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            System Architecture
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            How Safe Dispatches Travel to Customer Phones
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            From CSV upload to end-user WhatsApp delivery in 4 resilient pipeline stages.
          </p>
        </div>

        {/* 4 Steps Architecture Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-emerald-400">01. INGESTION</span>
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            </div>
            <h4 className="text-sm font-bold text-white">CSV & Segment Parser</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Validates phone numbers, injects customer variables, and saves audience records to dedicated Supabase PostgreSQL.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-amber-400">02. THROTTLING</span>
              <Server className="w-4 h-4 text-amber-400" />
            </div>
            <h4 className="text-sm font-bold text-white">BullMQ Worker Queue</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Buffers messages in Redis. Enforces warm-up limits, randomized sleep intervals, and dynamic throughput controls.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-sky-400">03. DISPATCH</span>
              <Cpu className="w-4 h-4 text-sky-400" />
            </div>
            <h4 className="text-sm font-bold text-white">WhatsApp Multi-Device Node</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Establishes direct WebSocket session with WhatsApp servers. Emulates real browser/phone behavior with typing events.
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-purple-400">04. TELEMETRY</span>
              <CheckCheck className="w-4 h-4 text-purple-400" />
            </div>
            <h4 className="text-sm font-bold text-white">Real-Time Blue Ticks</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Listens for message receipt acknowledgments. Streams delivery and read timestamps back to your dashboard in real-time.
            </p>
          </div>

        </div>
      </section>

      {/* PRICING CALCULATOR */}
      <section id="pricing" className="relative z-10 py-16 px-4 sm:px-6 max-w-7xl mx-auto border-t border-slate-900">
        <div className="text-center space-y-3 mb-10">
          <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            Simple, Transparent Pricing
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Calculate Your Store Savings
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Unlike official Meta APIs charging ₹0.80 per conversation, you pay a flat SaaS fee for unlimited broadcasts.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
          
          {/* Starter Plan */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-white">Starter Free</h3>
                <p className="text-xs text-slate-400">For single stores testing WhatsApp marketing.</p>
              </div>
              <div>
                <span className="text-3xl font-black text-white">₹0</span>
                <span className="text-xs text-slate-500"> / month</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> 500 Broadcasts / Month
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> 1 Linked WhatsApp Number
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Permanent CSV Storage
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Standard Human Throttling
                </li>
              </ul>
            </div>
            <Link
              href="/signup"
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs text-center transition-colors block"
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro Growth (Highlighted) */}
          <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950/40 border-2 border-emerald-500/80 rounded-3xl p-6 sm:p-8 space-y-6 flex flex-col justify-between shadow-2xl shadow-emerald-500/10 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow">
              Most Popular For Optical Stores
            </div>
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-white">Pro Growth</h3>
                <p className="text-xs text-emerald-300/80">High volume campaigns with zero ban risk.</p>
              </div>
              <div>
                <span className="text-3xl font-black text-white">₹1,499</span>
                <span className="text-xs text-slate-400"> / month</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-200">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Unlimited Contacts & Audiences
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Multi-Number Round Robin
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Dynamic Prescriptions & Images
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Live Blue Tick Read Receipts
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Priority 24/7 WhatsApp Support
                </li>
              </ul>
            </div>
            <Link
              href="/signup"
              onClick={triggerConfetti}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs text-center shadow-lg shadow-emerald-500/25 transition-all block"
            >
              Start 14-Day Free Pro Trial
            </Link>
          </div>

          {/* Enterprise */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-bold text-white">Chain Enterprise</h3>
                <p className="text-xs text-slate-400">For multi-branch optical retail chains.</p>
              </div>
              <div>
                <span className="text-3xl font-black text-white">₹3,999</span>
                <span className="text-xs text-slate-500"> / month</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> 10+ Store Outlets Linked
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Custom CRM Webhook Sync
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Automated Birthday & Recall AI
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" /> Dedicated Account Manager
                </li>
              </ul>
            </div>
            <Link
              href="/signup"
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs text-center transition-colors block"
            >
              Contact Enterprise
            </Link>
          </div>

        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="relative z-10 py-16 px-4 sm:px-6 max-w-4xl mx-auto border-t border-slate-900">
        <div className="text-center space-y-3 mb-10">
          <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            Got Questions?
          </span>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {[
            {
              q: "Will my WhatsApp number get banned for broadcasting?",
              a: "No. Our engine uses dynamic anti-ban human jitter (8s - 20s randomized delays), tiered warm-up dispatch limits, and browser session emulation. It mimics natural human conversation rhythms rather than bot spam patterns.",
            },
            {
              q: "Can I use this without OpticalManager CRM?",
              a: "Yes! The Broadcast Manager now features a complete standalone architecture. You can sign up with any email, upload your CSV contact list, create custom audience segments, and run broadcasts independently.",
            },
            {
              q: "How does the permanent CSV Phonebook work?",
              a: "When you upload CSV or Excel files, contacts are stored in your dedicated Supabase database with smart auto-deduplication and phone normalization. Your contacts stay saved forever, so you can reuse them across multiple campaigns.",
            },
            {
              q: "How do real-time Blue Ticks (Read Receipts) work?",
              a: "The engine receives WebSocket receipts directly from WhatsApp servers when a recipient opens your chat. We capture these read events in real-time and update your campaign dashboard instantly.",
            },
            {
              q: "Do I have to pay Meta API per-conversation fees?",
              a: "Zero Meta conversation fees. You connect via WhatsApp Linked Devices (Web QR code), allowing you to broadcast freely without per-message charges.",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 transition-all"
            >
              <button
                onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                className="w-full flex items-center justify-between text-left text-xs sm:text-sm font-bold text-white border-none cursor-pointer bg-transparent"
              >
                <span>{item.q}</span>
                <ChevronDown
                  className={"w-4 h-4 text-slate-400 transition-transform duration-200 " + (activeFaq === idx ? "rotate-180 text-emerald-400" : "")}
                />
              </button>
              {activeFaq === idx && (
                <p className="text-xs text-slate-400 pt-2.5 leading-relaxed">
                  {item.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CALL TO ACTION FOOTER BANNER */}
      <section className="relative z-10 py-16 px-4 sm:px-6 max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-indigo-950 border border-emerald-500/30 rounded-3xl p-8 sm:p-12 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
          
          <div className="space-y-3 max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Ready to Supercharge Your Store's WhatsApp Marketing?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Create your account in 30 seconds. Upload your first CSV and launch your first broadcast today.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              onClick={triggerConfetti}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-sm shadow-xl shadow-emerald-500/30 transition-all hover:scale-105"
            >
              Get Started Free Today
            </Link>

            <Link
              href="/login"
              className="px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-sm transition-all"
            >
              Sign In to Account
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-slate-900 py-10 px-4 sm:px-6 max-w-7xl mx-auto text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-500" />
          <span className="font-bold text-slate-300">OpticalManager Broadcast Engine</span>
          <span>© 2026. All rights reserved.</span>
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            All Systems Operational (99.99%)
          </span>
          <Link href="/login" className="hover:text-slate-300">Login</Link>
          <Link href="/signup" className="hover:text-slate-300">Sign Up</Link>
          <a href="https://www.opticalmanager.in" className="hover:text-slate-300">CRM Platform</a>
        </div>
      </footer>

    </div>
  );
}
