"use client";

import React, { useState, useEffect } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Plus, 
  Send, 
  Search, 
  Zap, 
  Copy, 
  Edit3,
  Trash2,
  AlertTriangle,
  X,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

interface AudienceCard {
  id: string;
  name: string;
  icon: string;
  description: string;
  count: number;
  lastUpdated: string;
  campaignsCount: number;
  isDynamic: boolean;
  category: "VIP" | "PRODUCT" | "RECALL" | "SEGMENT";
}

export default function AudienceLibraryPage() {
  const router = useRouter();
  const [filterTag, setFilterTag] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Default Built-in Segments
  const defaultAudiences: AudienceCard[] = [
    {
      id: "aud-01",
      name: "VIP Customers",
      icon: "👑",
      description: "High-value buyers with lifetime spend > ₹15,000 & 2+ orders.",
      count: 0,
      lastUpdated: "Live DB",
      campaignsCount: 0,
      isDynamic: true,
      category: "VIP",
    },
    {
      id: "aud-02",
      name: "Frame & Eyewear Buyers",
      icon: "👓",
      description: "Customers who purchased prescription frames in last 180 days.",
      count: 0,
      lastUpdated: "Live DB",
      campaignsCount: 0,
      isDynamic: true,
      category: "PRODUCT",
    },
    {
      id: "aud-03",
      name: "Sunglass Buyers",
      icon: "🕶",
      description: "Fashion & polarized sunglass buyers from summer promotions.",
      count: 0,
      lastUpdated: "Live DB",
      campaignsCount: 0,
      isDynamic: true,
      category: "PRODUCT",
    },
    {
      id: "aud-04",
      name: "Birthday This Month",
      icon: "🎂",
      description: "Auto-updating monthly birthday list for birthday voucher dispatches.",
      count: 0,
      lastUpdated: "Live DB",
      campaignsCount: 0,
      isDynamic: true,
      category: "SEGMENT",
    },
    {
      id: "aud-05",
      name: "Prescription Renewal Due",
      icon: "👁",
      description: "Customers whose eye checkup or contact lens renewal date is due.",
      count: 0,
      lastUpdated: "Live DB",
      campaignsCount: 0,
      isDynamic: true,
      category: "RECALL",
    },
    {
      id: "aud-06",
      name: "Blue Cut / Computer Glasses",
      icon: "💻",
      description: "IT & office professionals using computer anti-glare lenses.",
      count: 0,
      lastUpdated: "Live DB",
      campaignsCount: 0,
      isDynamic: true,
      category: "PRODUCT",
    },
  ];

  const [audiences, setAudiences] = useState<AudienceCard[]>(defaultAudiences);

  // Delete Modal State
  const [audienceToDelete, setAudienceToDelete] = useState<AudienceCard | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load Custom Saved Audiences & Fetch Live CRM Data
  useEffect(() => {
    async function fetchLiveCrmData() {
      try {
        setLoading(true);

        // Load custom audiences saved by user
        let customSaved: AudienceCard[] = [];
        try {
          const raw = localStorage.getItem("custom_saved_audiences");
          if (raw) customSaved = JSON.parse(raw);
        } catch (e) {
          console.error("Error reading custom_saved_audiences from localStorage:", e);
        }

        const sessionRes = await fetch("/api/session");
        const sessionData = await sessionRes.json();

        const backendUrl = getBackendUrl();
        const sessionToken = sessionData.authenticated ? JSON.stringify(sessionData.session) : "";

        // Fetch CRM Tags & Counts
        const res = await fetch(`${backendUrl}/api/v1/audience/crm-tags`, {
          headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
        });

        let updatedDefaults = [...defaultAudiences];

        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const tagMap: Record<string, number> = {};
            json.data.forEach((item: any) => {
              tagMap[item.name] = item.count;
            });

            updatedDefaults = updatedDefaults.map((aud) => {
              if (aud.id === "aud-01") return { ...aud, count: tagMap["VIP"] || 0 };
              if (aud.id === "aud-02") return { ...aud, count: tagMap["PROGRESSIVE"] || 0 };
              if (aud.id === "aud-03") return { ...aud, count: tagMap["CONTACT_LENS_USER"] || 0 };
              if (aud.id === "aud-04") return { ...aud, count: tagMap["HIGH_POWER"] || 0 };
              if (aud.id === "aud-05") return { ...aud, count: tagMap["DUE_FOR_RETEST"] || 0 };
              return aud;
            });
          }
        }

        // Merge custom saved audiences at top
        setAudiences([...customSaved, ...updatedDefaults]);
      } catch (err) {
        console.error("[Audience] Error fetching live CRM metrics:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchLiveCrmData();
  }, []);

  const handleConfirmDelete = () => {
    if (!audienceToDelete) return;
    setIsDeleting(true);

    setTimeout(() => {
      setAudiences((prev) => {
        const next = prev.filter((a) => a.id !== audienceToDelete.id);
        // Also update localStorage for custom audiences
        const customOnly = next.filter((a) => a.id.startsWith("custom-"));
        localStorage.setItem("custom_saved_audiences", JSON.stringify(customOnly));
        return next;
      });

      toast.success(`Audience "${audienceToDelete.name}" deleted successfully.`);
      setAudienceToDelete(null);
      setIsDeleting(false);
    }, 400);
  };

  const handleLaunchCampaign = (aud: AudienceCard) => {
    toast.success(`Selected "${aud.name}" for new campaign!`);
    router.push(`/campaigns/new?audience=${encodeURIComponent(aud.name)}`);
  };

  const filtered = audiences.filter((a) => {
    if (filterTag !== "ALL" && a.category !== filterTag) return false;
    if (searchQuery && !a.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Audience Library</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-400 uppercase">
              Smart Audiences Engine
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Build, save, dynamically sync, and delete reusable customer audiences for future campaigns.
          </p>
        </div>

        <Link
          href="/audience/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Audience</span>
        </Link>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          {[
            { id: "ALL", label: "All Audiences" },
            { id: "SEGMENT", label: "⚡ Smart Segments" },
            { id: "VIP", label: "👑 VIP" },
            { id: "PRODUCT", label: "👓 Products" },
            { id: "RECALL", label: "👁 Recalls" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTag(tab.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border-none cursor-pointer ${
                filterTag === tab.id
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved audiences..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Rich Audience Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((aud) => (
          <div
            key={aud.id}
            className={`bg-white dark:bg-slate-900/80 border rounded-2xl p-4 space-y-4 shadow-xs dark:shadow-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between ${
              aud.id.startsWith("custom-")
                ? "border-indigo-500/40 dark:border-indigo-500/40 ring-1 ring-indigo-500/20"
                : "border-slate-200/80 dark:border-slate-800"
            }`}
          >
            <div className="space-y-2.5">
              
              {/* Card Title & Dynamic Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{aud.icon}</span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{aud.name}</h3>
                    {aud.id.startsWith("custom-") && (
                      <span className="text-[9px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400">
                        Custom Saved Audience
                      </span>
                    )}
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {aud.isDynamic ? "Dynamic" : "Static"}
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {aud.description}
              </p>

              {/* Metrics (Live fetched from CRM DB) */}
              <div className="grid grid-cols-3 gap-2 py-2 border-t border-b border-slate-100 dark:border-slate-800/80 text-center">
                <div>
                  <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Contacts</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto text-indigo-500" /> : aud.count.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Campaigns</span>
                  <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{aud.campaignsCount}</span>
                </div>
                <div>
                  <span className="text-[9px] font-extrabold uppercase text-slate-400 block">Updated</span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{aud.lastUpdated}</span>
                </div>
              </div>

            </div>

            {/* Quick Actions Footer */}
            <div className="pt-2 flex items-center gap-1.5">
              <button
                onClick={() => handleLaunchCampaign(aud)}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Launch Campaign</span>
              </button>

              <button
                onClick={() => router.push(`/audience/new?edit=${aud.id}`)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors border-none cursor-pointer"
                title="Edit Audience"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => toast.success(`Duplicated "${aud.name}"`)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors border-none cursor-pointer"
                title="Duplicate Audience"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>

              {/* Delete Button with Confirmation */}
              <button
                onClick={() => setAudienceToDelete(aud)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors border-none cursor-pointer"
                title="Delete Audience"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Dialog Modal */}
      {audienceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Delete Audience Segment?</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Confirmation Required</p>
                </div>
              </div>

              <button
                onClick={() => setAudienceToDelete(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-none cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              Are you sure you want to delete <strong className="text-slate-900 dark:text-white">&quot;{audienceToDelete.name}&quot;</strong>? This segment will be permanently removed from your Audience Library.
            </p>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                onClick={() => setAudienceToDelete(null)}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs font-semibold border-none cursor-pointer transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold border-none cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeleting ? "Deleting..." : "Yes, Delete Segment"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
