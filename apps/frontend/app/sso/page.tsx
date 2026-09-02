import { ShieldAlert, ArrowRight } from "lucide-react";

interface SSOPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function SSOPage({ searchParams }: SSOPageProps) {
  const params = await searchParams;
  const errorMsg = params.error || "Direct access restricted. Please launch from OpticalManager CRM.";
  const crmUrl = process.env.NEXT_PUBLIC_CRM_URL || (process.env.NODE_ENV === "development" ? "http://localhost:3000/owner" : "https://www.opticalmanager.in/owner");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 select-none">
      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center shadow-2xl backdrop-blur-xl space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-white">SSO Authentication Restricted</h1>
          <p className="text-sm text-slate-400">
            {errorMsg}
          </p>
        </div>
        <a
          href={crmUrl}
          className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/20"
        >
          <span>Return to CRM Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
