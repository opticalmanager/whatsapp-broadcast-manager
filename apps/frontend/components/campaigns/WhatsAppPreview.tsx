"use client";

import React from "react";
import { Smartphone, Image as ImageIcon, FileText } from "lucide-react";
import { normalizePublicMediaUrl, isLikelyImageUrl } from "@/lib/media-url-utils";

interface WhatsAppPreviewProps {
  messageText: string;
  mediaUrl?: string | null;
  mediaType?: "NONE" | "IMAGE" | "DOCUMENT" | "VIDEO";
  customerName?: string;
}

export function WhatsAppPreview({
  messageText,
  mediaUrl,
  mediaType = "NONE",
  customerName = "Rahul Sharma",
}: WhatsAppPreviewProps) {
  const displayUrl = normalizePublicMediaUrl(mediaUrl, mediaType === "DOCUMENT" ? "DOCUMENT" : "IMAGE");
  const isImg = mediaType === "IMAGE" || isLikelyImageUrl(displayUrl);

  const formattedText = (messageText || "Type your marketing message on the left to see live preview...")
    .replace(/\{\{\s*customer_name\s*\}\}/g, customerName)
    .replace(/\{\{\s*city\s*\}\}/g, "Narsapur")
    .replace(/\{\{\s*last_prescription_date\s*\}\}/g, "14 May 2024")
    .replace(/\{\{\s*store_name\s*\}\}/g, "OpticalManager Main Store");

  const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="w-full max-w-xs mx-auto select-none">
      <div className="bg-slate-900 border-4 border-slate-800 rounded-[36px] p-2.5 shadow-2xl relative overflow-hidden">
        {/* Smartphone Camera Notch */}
        <div className="w-24 h-3.5 bg-slate-800 rounded-full mx-auto mb-2.5" />

        {/* WhatsApp Mobile Chat Header */}
        <div className="bg-emerald-800 p-2.5 rounded-t-xl flex items-center gap-2.5 text-white">
          <div className="w-7 h-7 rounded-full bg-emerald-700 flex items-center justify-center font-bold text-[11px]">
            OM
          </div>
          <div>
            <p className="text-xs font-bold leading-tight">OpticalManager Store</p>
            <p className="text-[9px] text-emerald-200">Official WhatsApp Business</p>
          </div>
        </div>

        {/* WhatsApp Mobile Chat Background */}
        <div className="bg-[#0b141a] p-3 min-h-[320px] flex flex-col justify-end rounded-b-xl space-y-2 relative">
          
          {/* Chat Message Bubble */}
          <div className="bg-[#202c33] text-slate-100 rounded-xl rounded-tr-none p-2.5 space-y-1.5 max-w-[92%] ml-auto border border-slate-700/40 shadow-sm">
            
            {/* Media Attachment Preview */}
            {isImg && (
              <div className="rounded-lg overflow-hidden bg-slate-800 border border-slate-700 max-h-36">
                {displayUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayUrl}
                    alt="Campaign Media"
                    className="w-full h-auto object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="p-4 text-center text-slate-400 space-y-1">
                    <ImageIcon className="w-6 h-6 mx-auto text-emerald-400" />
                    <p className="text-[9px]">Image Attachment</p>
                  </div>
                )}
              </div>
            )}

            {mediaType === "DOCUMENT" && (
              <div className="bg-slate-800 border border-slate-700 p-2 rounded-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400 shrink-0" />
                <div className="truncate text-xs">
                  <p className="font-bold truncate text-white text-[11px]">Prescription_Catalog.pdf</p>
                  <p className="text-[9px] text-slate-400">PDF Document • 1.2 MB</p>
                </div>
              </div>
            )}

            {/* Message Body Text */}
            <p className="text-[11px] leading-relaxed whitespace-pre-wrap break-words">
              {formattedText}
            </p>

            {/* Timestamp & Double Tick */}
            <div className="flex items-center justify-end gap-1 text-[8px] text-slate-400 pt-0.5">
              <span>{currentTime}</span>
              <span className="text-sky-400 font-bold">✓✓</span>
            </div>
          </div>

          <div className="text-center text-[8px] text-slate-500 py-0.5">
            🔒 End-to-end encrypted • OpticalManager Broadcast Engine
          </div>
        </div>

      </div>
    </div>
  );
}
