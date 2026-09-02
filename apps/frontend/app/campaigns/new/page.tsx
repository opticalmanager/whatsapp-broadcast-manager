"use client";

import React, { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function RedirectComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = searchParams.toString();
    router.replace(`/send-message${params ? `?${params}` : ""}`);
  }, [router, searchParams]);

  return (
    <div className="flex h-72 flex-col items-center justify-center space-y-3 text-slate-500">
      <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      <p className="text-xs font-semibold">Redirecting to Campaign Studio...</p>
    </div>
  );
}

export default function NewCampaignRedirectPage() {
  return (
    <Suspense fallback={
      <div className="flex h-72 flex-col items-center justify-center space-y-3 text-slate-500">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        <p className="text-xs font-semibold">Loading Campaign Studio...</p>
      </div>
    }>
      <RedirectComponent />
    </Suspense>
  );
}
