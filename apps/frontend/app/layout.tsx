import type { Metadata } from "next";
import "./globals.css";
import { cookies } from "next/headers";
import { BroadcastSession } from "@/lib/sso-verification";
import Link from "next/link";
import { 
  Radio, 
  Smartphone, 
  Send, 
  FileText, 
  Image as ImageIcon, 
  Settings, 
  ExternalLink,
  ShieldCheck
} from "lucide-react";

export const metadata: Metadata = {
  title: "OpticalManager Broadcast | Marketing Automation SaaS",
  description: "Dedicated WhatsApp marketing automation & multi-number engine for Optical Stores",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("broadcasting_session")?.value;
  let session: BroadcastSession | null = null;

  if (sessionCookie) {
    try {
      session = JSON.parse(sessionCookie);
    } catch {
      session = null;
    }
  }

  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased flex flex-col font-sans">
        {session ? (
          <div className="flex h-screen w-full overflow-hidden select-none">
            {/* Sidebar Component */}
            <aside className="w-64 bg-slate-900/90 border-r border-slate-800/80 flex flex-col justify-between p-4 shrink-0">
              <div className="space-y-6">
                {/* Branding */}
                <div className="flex items-center gap-3 px-2 py-1">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                    <Radio className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h1 className="font-extrabold text-sm tracking-tight text-white leading-tight">
                      OpticalManager
                    </h1>
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">
                      Broadcast Engine
                    </span>
                  </div>
                </div>

                {/* Owner Identity Badge */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      Store Owner
                    </span>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <p className="text-xs font-bold text-slate-200 truncate">{session.fullName}</p>
                  <p className="text-[11px] text-slate-400 truncate">{session.email}</p>
                </div>

                {/* Navigation Items */}
                <nav className="space-y-1.5">
                  <Link
                    href="/"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all group"
                  >
                    <Radio className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span>Dashboard</span>
                  </Link>

                  <Link
                    href="/numbers"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all group"
                  >
                    <Smartphone className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                    <span>WhatsApp Numbers</span>
                  </Link>

                  <Link
                    href="/campaigns"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all group"
                  >
                    <Send className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                    <span>Campaigns</span>
                  </Link>

                  <Link
                    href="/templates"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all group"
                  >
                    <FileText className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                    <span>Templates</span>
                  </Link>

                  <Link
                    href="/settings"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all group"
                  >
                    <Settings className="w-4 h-4 text-slate-400 group-hover:scale-110 transition-transform" />
                    <span>Sending Rules</span>
                  </Link>
                </nav>
              </div>

              {/* Bottom Return Link */}
              <div className="pt-4 border-t border-slate-800/80">
                <a
                  href="https://www.opticalmanager.in/owner"
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all border border-slate-700/40 group"
                >
                  <span>Return to CRM</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                </a>
              </div>
            </aside>

            {/* Main Workspace Area */}
            <main className="flex-1 overflow-y-auto bg-slate-950 p-8">
              {children}
            </main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
