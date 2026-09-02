"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Send,
  Menu,
  X, 
  Sparkles, 
  ShieldCheck, 
  Users, 
  CheckCircle2, 
  ArrowRight, 
  FileSpreadsheet, 
  Lock, 
  Check, 
  Star, 
  Clock, 
  ChevronDown,
  CheckCheck,
  FileText,
  UserX,
  Filter,
  Bot,
  Cloud,
  Smartphone,
  Layers,
  Smile,
  Zap
} from "lucide-react";
import confetti from "canvas-confetti";
import { useAuth } from "@/lib/auth-context";

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#25D366", "#10b981", "#059669", "#34d399"],
      });
    } catch {}
  };

  const faqs = [
    {
      q: "How does the cloud broadcast system work?",
      a: "WhatsApp Broadcast Manager is 100% Cloud-Based. You simply connect your WhatsApp account via QR scan, upload your contact spreadsheet, and start sending. The messages are dispatched from high-speed cloud servers, so you can safely turn off your laptop or close your browser without interrupting the broadcast."
    },
    {
      q: "How does Smart Warmup protect my WhatsApp numbers from bans?",
      a: "Our system features an automated progressive warmup ramp designed to build strong sender reputation. Fresh numbers start at 50 messages/day and gradually scale up to 500/day over 4 weeks. Combined with human typing delays (15–20s), random Spintax variations ({Hello|Hi|Greetings}), and sleep batches, your accounts remain safe."
    },
    {
      q: "Can I upload my existing Excel or CSV customer lists?",
      a: "Yes! Upload any standard Excel (.xlsx, .xls) or CSV spreadsheet. Our system automatically detects phone number columns, maps customer names, cities, and custom data fields ({{var1}} to {{var7}}), and auto-prepends country dial codes (like +91) if missing."
    },
    {
      q: "How does the Unsubscriber & Inbound STOP feature work?",
      a: "Every broadcast includes a compliance opt-out footer (_Reply STOP to unsubscribe_). When a recipient replies with 'STOP', the system instantly tags them and adds them to a strict Never-Send blacklist across all future campaigns."
    },
    {
      q: "Can I connect multiple WhatsApp numbers to send messages?",
      a: "Yes! You can connect multiple WhatsApp numbers. When you dispatch a broadcast, the system automatically distributes the recipient list across your active connected accounts to maximize daily sending capacity."
    },
    {
      q: "Do I need technical skills or Meta API approval?",
      a: "No technical setup or Meta Business API approvals required. Simply sign up, scan the QR code with your regular or WhatsApp Business app, and start sending in under 2 minutes."
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[#070b14] text-slate-900 dark:text-slate-100 font-sans selection:bg-[#25D366] selection:text-white relative overflow-x-hidden">
      
      {/* =========================================================================
          1. STICKY NAVIGATION BAR
          ========================================================================= */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/90 dark:bg-[#070b14]/90 border-b border-slate-200/80 dark:border-slate-800 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          
          {/* Logo Branding with Official Radar Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <img 
              src="/logo.png" 
              alt="WhatsApp Broadcast Manager Logo" 
              className="w-8 h-8 rounded-full shadow-xs object-cover group-hover:scale-105 transition-transform" 
            />
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">
                WhatsApp Broadcast Manager
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[9px] font-bold uppercase tracking-wider">
                CLOUD
              </span>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Features</a>
            <a href="#cloud" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">100% Cloud</a>
            <a href="#pricing" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">FAQ</a>
          </nav>

          {/* Right Action CTAs */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-all"
              >
                <span>Open Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 px-3 py-1.5 transition-colors hidden sm:block"
                >
                  Sign In
                </Link>

                <Link
                  href="/signup"
                  onClick={triggerConfetti}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span>Start Free</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>

        </div>
      </header>

      {/* =========================================================================
          2. HERO SECTION
          ========================================================================= */}
      <section className="relative z-10 pt-12 pb-16 sm:pt-16 sm:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Column: Hero Text */}
            <div className="lg:col-span-7 space-y-6 text-left">
              
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                <span>100% Cloud-Based · No Chrome Extension Needed</span>
              </div>

              {/* Clean Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-black tracking-tight text-slate-900 dark:text-white leading-[1.15]">
                Send Bulk WhatsApp to<br />
                multiple contacts in <br />
                <span className="text-[#25D366]">
                  3 simple steps
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-xl">
                Then get replies, engage, and convert — fully automated in the cloud without keeping your computer on.
              </p>

              {/* 3-Step Flow */}
              <div className="p-3 bg-slate-50 dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 max-w-xl">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[11px] font-black">1</span>
                  <span>Connect WhatsApp (QR)</span>
                </div>
                <div className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-slate-800" />
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[11px] font-black">2</span>
                  <span>Upload Excel / CSV</span>
                </div>
                <div className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-slate-800" />
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[11px] font-black">3</span>
                  <span>Add Message & Send</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-1">
                <Link
                  href="/signup"
                  onClick={triggerConfetti}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-extrabold text-sm shadow-md transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Start Broadcasting for FREE</span>
                </Link>

                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <span>Sign In to Dashboard</span>
                </Link>
              </div>

              {/* Ratings */}
              <div className="flex items-center gap-3 pt-1 text-xs text-slate-500">
                <div className="flex items-center text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-current" />
                  ))}
                </div>
                <span className="font-bold text-slate-700 dark:text-slate-200">4.9/5 Rating</span>
                <span>•</span>
                <span>Trusted by 24,000+ Businesses</span>
              </div>

            </div>

            {/* Right Column: Clean App Preview Snapshot Mockup */}
            <div className="lg:col-span-5">
              <div className="bg-slate-50 dark:bg-[#111726] p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
                
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-slate-800 dark:text-white font-mono">
                      Cloud Broadcast Dispatcher
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                    Connected: 2 Numbers
                  </span>
                </div>

                {/* Recipient Snapshot */}
                <div className="p-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-slate-800/80 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Target Recipient:</span>
                    <strong className="font-mono text-slate-800 dark:text-white">Rahul Sharma (+91 98765 43210)</strong>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Anti-Ban Delay:</span>
                    <span className="font-mono text-emerald-600 font-bold">15–20s (Human Typing Simulation)</span>
                  </div>
                </div>

                {/* Clean WhatsApp Outgoing Message Bubble */}
                <div className="p-3 bg-[#efeae2] dark:bg-[#0c1f17] rounded-2xl border border-slate-300/60 dark:border-emerald-900/60">
                  <div className="bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-white p-3 rounded-xl rounded-tr-none shadow-xs space-y-2 text-xs">
                    <p className="leading-relaxed">
                      Hello <strong>Rahul Sharma</strong>, your exclusive <strong>20% OFF</strong> voucher is ready! Visit our store or reply to claim your special discount today.
                    </p>
                    
                    {/* Italic Opt-Out Footer */}
                    <p className="text-[10px] italic text-slate-600 dark:text-slate-300 pt-1.5 border-t border-emerald-300/40">
                      _Reply STOP to unsubscribe from promotional messages._
                    </p>

                    <div className="flex justify-end items-center gap-1 text-[9px] text-slate-500 dark:text-slate-300">
                      <span>11:45 AM</span>
                      <CheckCheck className="w-3.5 h-3.5 text-sky-500 font-bold" />
                    </div>
                  </div>
                </div>

                {/* Status Bar */}
                <div className="pt-1 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Smart Warmup Shield Active</span>
                  </span>
                  <span className="font-bold text-emerald-600">100% Cloud Hosted</span>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* =========================================================================
          3. METRICS BAR
          ========================================================================= */}
      <section className="py-10 bg-slate-50/80 dark:bg-[#0c1220] border-y border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-2xl sm:text-3xl font-black text-emerald-600">99.8%</p>
              <p className="text-xs text-slate-500 font-medium mt-1">Delivery Success Rate</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black text-emerald-600">50M+</p>
              <p className="text-xs text-slate-500 font-medium mt-1">Messages Dispatched</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black text-emerald-600">500/day</p>
              <p className="text-xs text-slate-500 font-medium mt-1">Max Capacity / Number</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-black text-emerald-600">24/7</p>
              <p className="text-xs text-slate-500 font-medium mt-1">Cloud Server Dispatch</p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. CORE BENEFIT CARDS (8 FEATURES)
          ========================================================================= */}
      <section id="features" className="py-20 bg-white dark:bg-[#070b14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-14">
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              All Features You Need to Broadcast on WhatsApp
            </h3>
            <p className="text-sm text-slate-500">
              Simple, reliable, and powerful tools built for businesses to send bulk WhatsApp messages safely.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1 */}
            <div className="bg-slate-50 dark:bg-[#111726] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                <Send className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Send Bulk Messages</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                The simplest tool that sends messages in 2 clicks. Add your contacts, compose text, and click send.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-slate-50 dark:bg-[#111726] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Upload via Excel & CSV</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Upload any Excel or CSV customer spreadsheet with zero re-formatting hassles.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-slate-50 dark:bg-[#111726] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Rich Media & Polls</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Add photos, PDF brochures, documents, videos, and interactive WhatsApp polls to your broadcasts.
              </p>
            </div>

            {/* Card 4 */}
            <div className="bg-slate-50 dark:bg-[#111726] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Personalized Messages</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Customize every message dynamically with recipient name, phone, city, and custom variables.
              </p>
            </div>

            {/* Card 5 */}
            <div className="bg-slate-50 dark:bg-[#111726] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Batching & Delays</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Human typing delays (15–20s) and sleep batches ensure natural sending pacing and zero ban risk.
              </p>
            </div>

            {/* Card 6 */}
            <div className="bg-slate-50 dark:bg-[#111726] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                <Filter className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Filter & Clean Numbers</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Auto-clean raw spreadsheets, deduplicate numbers, and auto-prepend country dial codes (+91).
              </p>
            </div>

            {/* Card 7 */}
            <div className="bg-slate-50 dark:bg-[#111726] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                <UserX className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Unsubscribers List</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Auto-exclude contacts who reply STOP to keep your accounts 100% compliant and spam-free.
              </p>
            </div>

            {/* Card 8 */}
            <div className="bg-slate-50 dark:bg-[#111726] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                <Cloud className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">100% Cloud Server 24/7</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Runs completely on cloud servers. Dispatches campaigns even when your computer is shut down.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* =========================================================================
          5. 100% CLOUD & ANTI-BAN ARCHITECTURE
          ========================================================================= */}
      <section id="cloud" className="py-20 bg-slate-50/60 dark:bg-[#0c1220] border-y border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-20">
          
          {/* Cloud Advantage */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-4 text-left">
              <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                100% Cloud Server Architecture
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                No Chrome Extensions. No Laptop Battery Drain.
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Unlike fragile desktop extensions that freeze your browser and stop whenever your laptop sleeps, WhatsApp Broadcast Manager operates 24/7 on dedicated cloud servers. Connect your numbers once, upload your list, and the cloud handles the rest.
              </p>
              <div className="pt-2">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs"
                >
                  <span>Get Started Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6 bg-white dark:bg-[#111726] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg space-y-3 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="font-bold text-slate-800 dark:text-white">Smart Anti-Ban Warmup Ramp</span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
                  Automated
                </span>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg">
                <span>Week 1 (Fresh Account)</span>
                <strong className="font-mono text-emerald-600">50 msgs/day</strong>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg">
                <span>Week 2 (Progressive Build)</span>
                <strong className="font-mono text-emerald-600">100 msgs/day</strong>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg">
                <span>Week 3 (Scaling)</span>
                <strong className="font-mono text-emerald-600">250 msgs/day</strong>
              </div>
              <div className="flex justify-between p-2.5 bg-slate-50 dark:bg-slate-950 rounded-lg">
                <span>Week 4+ (Matured Account)</span>
                <strong className="font-mono text-emerald-600">500 msgs/day</strong>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* =========================================================================
          6. PRICING (UPDATED TO 1200/MONTH)
          ========================================================================= */}
      <section id="pricing" className="py-20 bg-white dark:bg-[#070b14]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-14">
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Simple & Transparent Pricing
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              Start for free or upgrade to Full Cloud Access for high-volume broadcasting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            
            {/* Free Starter */}
            <div className="bg-slate-50 dark:bg-[#111726] p-7 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Starter Free</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">₹0</span>
                  <span className="text-xs text-slate-500">/forever</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Perfect for testing broadcasts and trying out the cloud system.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 pt-2">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>1 Connected WhatsApp Number</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>500 Messages / month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Excel & CSV Spreadsheet Import</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Anti-Ban Delays & Spintax</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/signup"
                className="w-full py-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold text-xs text-center transition-colors block"
              >
                Start For Free
              </Link>
            </div>

            {/* Cloud Pro (₹1,200/Month) */}
            <div className="bg-white dark:bg-[#131b2e] p-7 rounded-3xl border-2 border-emerald-500 flex flex-col justify-between space-y-6 relative shadow-xl">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider">
                FULL CLOUD ACCESS
              </div>

              <div className="space-y-4">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Pro Unlimited</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">₹1,200</span>
                  <span className="text-xs text-slate-500">/month</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Full multi-device cloud access with unlimited broadcasts and complete anti-ban safeguards.
                </p>
                <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 pt-2">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>Multi-Device Load Balancing</strong> (5 Numbers)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><strong>Unlimited Broadcast Messages</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Smart Warmup Engine (50 → 500/day)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Inbound STOP Unsubscriber Blacklist</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>24/7 Welcome Message & Keyword Rules</span>
                  </li>
                </ul>
              </div>

              <Link
                href="/signup"
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs text-center shadow-md transition-all block"
              >
                Upgrade to Pro (₹1,200/mo)
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* =========================================================================
          7. FAQ ACCORDION
          ========================================================================= */}
      <section id="faq" className="py-20 bg-slate-50/60 dark:bg-[#070b14] border-t border-slate-200/80 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center space-y-3 mb-12">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Frequently Asked Questions
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              Clear answers to common questions about our cloud broadcast engine.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((item, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div 
                  key={idx}
                  className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs"
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 flex items-center justify-between text-left gap-4 cursor-pointer"
                  >
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                      {item.q}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transform transition-transform ${isOpen ? "rotate-180 text-emerald-600" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-0 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          8. HIGH-CONVERTING BOTTOM CTA BANNER
          ========================================================================= */}
      <section className="py-16 bg-[#25D366] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-5">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
            START USING FOR FREE
          </h2>
          <p className="text-sm sm:text-base text-emerald-100 max-w-xl mx-auto font-medium">
            Try it, send your first broadcast, and experience 100% cloud delivery without spending a single penny.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <Link
              href="/signup"
              onClick={triggerConfetti}
              className="px-7 py-3.5 rounded-xl bg-white text-emerald-800 hover:bg-slate-100 font-extrabold text-xs shadow-lg transition-all cursor-pointer"
            >
              Create Free Account Now →
            </Link>

            <Link
              href="/login"
              className="px-7 py-3.5 rounded-xl bg-black/15 hover:bg-black/25 text-white font-bold text-xs transition-all border border-white/20"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          9. FOOTER
          ========================================================================= */}
      <footer className="py-10 bg-white dark:bg-[#070b14] border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img 
              src="/logo.png" 
              alt="WhatsApp Broadcast Manager Logo" 
              className="w-6 h-6 rounded-full shadow-xs object-cover" 
            />
            <span className="font-bold text-slate-800 dark:text-white">WhatsApp Broadcast Manager</span>
          </div>

          <div className="flex items-center gap-5">
            <Link href="/login" className="hover:text-emerald-600 transition-colors">Sign In</Link>
            <Link href="/signup" className="hover:text-emerald-600 transition-colors">Sign Up</Link>
            <Link href="/dashboard" className="hover:text-emerald-600 transition-colors">Portal</Link>
            <a href="#faq" className="hover:text-emerald-600 transition-colors">FAQ</a>
          </div>

          <p>© {new Date().getFullYear()} WhatsApp Broadcast Manager. All rights reserved.</p>
        </div>
      </footer>

    </div>
  );
}
