"use client";

import React, { useState } from "react";
import { FileText, Upload, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function MediaLibraryPage() {
  const [filterType, setFilterType] = useState<"ALL" | "IMAGE" | "DOCUMENT">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const mediaAssets = [
    { id: "m-01", name: "Summer_Festival_Banner.jpg", type: "IMAGE", size: "1.4 MB", uploadedAt: "2 days ago", url: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&auto=format&fit=crop&q=60" },
    { id: "m-02", name: "Prescription_Glasses_Catalog.pdf", type: "DOCUMENT", size: "3.2 MB", uploadedAt: "5 days ago", url: "#" },
    { id: "m-03", name: "Progressive_Lens_Offer.jpg", type: "IMAGE", size: "980 KB", uploadedAt: "1 week ago", url: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&auto=format&fit=crop&q=60" },
  ];

  const filtered = mediaAssets.filter((a) => {
    if (filterType !== "ALL" && a.type !== filterType) return false;
    if (searchQuery && !a.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Media Asset Library</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Store promotional banners, PDFs, and media files for your WhatsApp campaigns.
          </p>
        </div>

        <button
          onClick={() => toast.success("Select a file to upload to Cloudflare R2.")}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-sm shrink-0 cursor-pointer border-none"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Media Asset</span>
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          {[
            { id: "ALL", label: "All Media" },
            { id: "IMAGE", label: "Images" },
            { id: "DOCUMENT", label: "PDF Documents" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all border-none cursor-pointer ${
                filterType === tab.id
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
            placeholder="Search media..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {filtered.map((asset) => (
          <div
            key={asset.id}
            className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 space-y-3 shadow-xs dark:shadow-xl hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            {asset.type === "IMAGE" ? (
              <div className="w-full h-36 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.url} alt={asset.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
            ) : (
              <div className="w-full h-36 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-center p-4">
                <div>
                  <FileText className="w-9 h-9 text-purple-500 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[180px]">{asset.name}</p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs pt-0.5">
              <div>
                <p className="font-bold text-slate-900 dark:text-white truncate max-w-[160px]">{asset.name}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{asset.size} • {asset.uploadedAt}</p>
              </div>

              <button
                onClick={() => toast.error("Asset removed.")}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-colors border-none cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
