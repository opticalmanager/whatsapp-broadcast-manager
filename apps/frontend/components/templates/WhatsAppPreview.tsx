"use client";

import React from "react";
import { CheckCheck, FileText, Image as ImageIcon, Video, Glasses } from "lucide-react";

interface WhatsAppPreviewProps {
  bodyText: string;
  mediaType: "NONE" | "IMAGE" | "DOCUMENT" | "VIDEO";
  mediaUrl?: string;
  shopName?: string;
}

export function WhatsAppPreview({
  bodyText,
  mediaType,
  mediaUrl,
  shopName = "OpticalManager Store",
}: WhatsAppPreviewProps) {
  // Replace template variables {{variable}} with sample values for live preview
  const formattedText = (bodyText || "Your template body message preview will appear here...")
    .replace(/\{\{customer_name\}\}/gi, "Rahul Mehta")
    .replace(/\{\{shop_name\}\}/gi, shopName)
    .replace(/\{\{city\}\}/gi, "Narsapur")
    .replace(/\{\{last_prescription_date\}\}/gi, "15-Jul-2025")
    .replace(/\{\{balance_due\}\}/gi, "₹1,250");

  const currentTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="w-full max-w-sm mx-auto bg-slate-950 border border-slate-800 rounded-3xl p-3 shadow-2xl select-none">
      {/* Smartphone Top Notch & Bar */}
      <div className="bg-slate-900/90 rounded-2xl p-3 space-y-3 border border-slate-800/80">
        <div className="flex items-center gap-2.5 border-b border-slate-800 pb-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
            <Glasses className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-bold text-white truncate">{shopName}</h4>
            <span className="text-[10px] text-emerald-400 font-semibold block">Online (Business Account)</span>
          </div>
        </div>

        {/* WhatsApp Chat Message Bubble */}
        <div className="bg-[#0b141a] p-3 rounded-xl space-y-2 border border-slate-800/60 shadow-inner">
          {/* Media Header Preview */}
          {mediaType === "IMAGE" && (
            <div className="rounded-lg overflow-hidden border border-slate-700/50 bg-slate-800 aspect-video relative flex items-center justify-center">
              {mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl} alt="Template Flyer Header" className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <span>Image Flyer Header Attached</span>
                </div>
              )}
            </div>
          )}

          {mediaType === "DOCUMENT" && (
            <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60 flex items-center gap-3 text-xs text-slate-200">
              <div className="w-8 h-8 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white truncate">Eyewear_Offer_Catalog.pdf</p>
                <span className="text-[10px] text-slate-400">PDF Document Attachment</span>
              </div>
            </div>
          )}

          {mediaType === "VIDEO" && (
            <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60 flex items-center gap-3 text-xs text-slate-200">
              <div className="w-8 h-8 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <Video className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white truncate">Promotional_Video.mp4</p>
                <span className="text-[10px] text-slate-400">MP4 Video Attachment</span>
              </div>
            </div>
          )}

          {/* Message Text */}
          <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
            {formattedText}
          </p>

          {/* Message Footer & Double Blue Checks */}
          <div className="flex items-center justify-end gap-1 pt-1">
            <span className="text-[9px] text-slate-400 font-mono">{currentTime}</span>
            <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
