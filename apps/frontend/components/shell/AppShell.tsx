"use client";

import React, { useState, useEffect } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard,
  Clock,
  Send,
  Smile,
  Bot,
  FileText,
  BookUser,
  UserX,
  Filter,
  UsersRound,
  FileBarChart,
  MessageSquare,
  Settings,
  ChevronDown,
  Sun,
  Moon,
  ShieldCheck,
  Smartphone,
  Wrench
} from "lucide-react";
import { WhatsAppDrawer } from "./WhatsAppDrawer";
import { useAuth } from "@/lib/auth-context";

interface AppShellProps {
  children: React.ReactNode;
  user: {
    fullName: string;
    email: string;
  } | null;
}

export function AppShell({ children, user: ssoUser }: AppShellProps) {
  const pathname = usePathname();
  const { user: authUser, logout, getAuthHeaders, isAuthenticated } = useAuth();

  const resolvedUser = (authUser ? { fullName: authUser.fullName, email: authUser.email } : null) || ssoUser;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [connectedDevicesCount, setConnectedDevicesCount] = useState<number>(0);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = (localStorage.getItem("theme") as "light" | "dark") || "light";
    setTheme(savedTheme);
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  useEffect(() => {
    async function checkInstances() {
      try {
        const backendUrl = getBackendUrl();
        const headers = getAuthHeaders();
        const res = await fetch(`${backendUrl}/api/v1/whatsapp-numbers/instances`, { headers });

        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const count = json.data.filter((d: any) => d.status === "CONNECTED").length;
            setConnectedDevicesCount(count);
          } else {
            setConnectedDevicesCount(0);
          }
        }
      } catch {
        // Quiet fallback
      }
    }

    if (isAuthenticated) {
      checkInstances();
      const interval = setInterval(checkInstances, 4000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, getAuthHeaders]);

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Devices", href: "/devices", icon: Clock },
    { label: "Campaigns", href: "/campaigns", icon: Send },
    { label: "Welcome Message", href: "/welcome-message", icon: Smile },
    { label: "Auto Reply", href: "/auto-reply", icon: Bot },
    { label: "Templates", href: "/templates", icon: FileText },
    { label: "Contacts", href: "/contacts", icon: BookUser },
    { label: "Unsubscribers", href: "/unsubscribers", icon: UserX },
    { label: "Contact Segments", href: "/contact-segments", icon: Filter },
    { label: "Tools", href: "/tools", icon: Wrench },
    { label: "Received Messages", href: "/received-messages", icon: MessageSquare },
    { label: "Setting", href: "/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#edf2f7] dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased select-none">
      
      {/* Top Application Header Bar */}
      <header className="h-14 bg-white dark:bg-[#0f1523] border-b border-slate-300/80 dark:border-slate-800/90 px-6 flex items-center justify-between sticky top-0 z-40 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        
        {/* Left Clean Branding */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-xs">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.634.075-1.745-.386-1.423-.59-2.34-2.033-2.41-2.128-.071-.095-.572-.76-.572-1.448 0-.687.362-1.026.49-1.168.129-.142.28-.178.373-.178.094 0 .188.002.27.006.088.004.204-.033.319.243.12.288.409 1.002.445 1.076.036.074.06.16.012.256-.048.096-.072.155-.144.238-.073.083-.153.185-.219.249-.073.072-.149.15-.064.296.085.145.378.623.81 1.008.558.497 1.029.65 1.174.722.146.073.232.064.318-.036.087-.1.373-.435.474-.585.1-.15.201-.125.337-.075.136.05 1.007.474 1.18.56.173.087.288.13.33.203.043.074.043.43-.101.835z"/>
              </svg>
            </div>
            <h1 className="font-bold text-sm tracking-tight text-slate-900 dark:text-white">
              WhatsApp Broadcast
            </h1>
          </Link>
        </div>

        {/* Right Action Icons & Live WhatsApp Multi-Instance Status */}
        <div className="flex items-center gap-3.5">
          
          {/* WhatsApp Multi-Device Dynamic Status Indicator */}
          <Link
            href="/devices"
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer shadow-xs ${
              connectedDevicesCount > 0
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-700 dark:text-emerald-300"
                : "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:border-amber-700 dark:text-amber-300"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${connectedDevicesCount > 0 ? "bg-emerald-500 shadow-xs" : "bg-amber-500 animate-ping"}`} />
            <span>
              {connectedDevicesCount === 0
                ? "Pair Device (QR)"
                : connectedDevicesCount === 1
                ? "1 Device Connected"
                : `${connectedDevicesCount} Devices Connected`}
            </span>
          </Link>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-800 flex items-center justify-center text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Toggle Theme"
          >
            {theme === "light" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
          </button>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2.5 p-1 pl-2.5 rounded-xl border border-slate-300/80 dark:border-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors cursor-pointer bg-white dark:bg-slate-900"
            >
              <div className="text-right hidden sm:block">
                <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">
                  {resolvedUser?.fullName || "Gaurav Tiwari"}
                </p>
                <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium leading-tight">
                  {resolvedUser?.email || "gauravtiwari8178@gmail.com"}
                </p>
              </div>
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {resolvedUser?.fullName ? resolvedUser.fullName.charAt(0).toUpperCase() : "G"}
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400 mr-1" />
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-2.5 py-2 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                    {resolvedUser?.fullName || "Gaurav Tiwari"}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {resolvedUser?.email || "gauravtiwari8178@gmail.com"}
                  </p>
                </div>
                <div className="py-1">
                  <Link
                    href="/devices"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>WhatsApp Devices</span>
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400" />
                    <span>Settings & Anti-Ban</span>
                  </Link>
                </div>
                <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Frame (Sidebar + Page Body) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Clean Navigation Sidebar */}
        <aside className="w-60 bg-white dark:bg-[#0f1523] border-r border-slate-300/80 dark:border-slate-800/90 flex flex-col justify-between py-4 px-3 shrink-0 overflow-y-auto shadow-[1px_0_3px_rgba(0,0,0,0.03)]">
          <div className="space-y-1">
            
            {/* Clean Navigation Menu Items */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href === "/devices" && pathname === "/numbers") || (item.href === "/send-message" && pathname.startsWith("/campaigns")) || (item.href === "/auto-reply" && pathname.startsWith("/auto-repl"));
                
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all ${
                      isActive
                        ? "bg-[#e6f4ea] text-[#137333] border border-[#ceead6] dark:bg-emerald-950/70 dark:border-emerald-800/80 dark:text-emerald-300 font-bold shadow-2xs"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white font-medium"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#137333] dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Bottom Security Footer */}
          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800">
            <div className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
                  Anti-Ban Guard
                </span>
              </div>
              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                ACTIVE
              </span>
            </div>
          </div>
        </aside>

        {/* Page Main Content Body with Warm Elevated Background */}
        <main className={`flex-1 bg-[#edf2f7] dark:bg-[#0b0f19] ${
          pathname === "/received-messages"
            ? "p-0 overflow-hidden flex flex-col"
            : "p-6 lg:p-8 overflow-y-auto"
        }`}>
          {children}
        </main>
      </div>

      {/* Slide-Over WhatsApp Pairing Drawer */}
      <WhatsAppDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
}
