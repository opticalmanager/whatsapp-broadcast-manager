"use client";

import React, { useState } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import { X, Plus, Sparkles, Image as ImageIcon, FileText, Video, MessageSquare, Loader2 } from "lucide-react";
import { WhatsAppPreview } from "./WhatsAppPreview";
import { toast } from "sonner";

interface TemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newTemplate: any) => void;
}

export function TemplateEditorModal({ isOpen, onClose, onSuccess }: TemplateEditorModalProps) {
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [mediaType, setMediaType] = useState<"NONE" | "IMAGE" | "DOCUMENT" | "VIDEO">("NONE");
  const [mediaUrl, setMediaUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const variableChips = [
    { label: "+ Customer Name", value: "{{customer_name}}" },
    { label: "+ Shop Name", value: "{{shop_name}}" },
    { label: "+ City", value: "{{city}}" },
    { label: "+ Last Prescription Date", value: "{{last_prescription_date}}" },
    { label: "+ Balance Due", value: "{{balance_due}}" },
  ];

  const handleInsertVariable = (val: string) => {
    setBodyText((prev) => `${prev} ${val}`.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !bodyText.trim()) {
      toast.error("Please fill in template title and message body.");
      return;
    }

    try {
      setIsSubmitting(true);
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/v1/templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer demo-token",
        },
        body: JSON.stringify({
          title,
          bodyText,
          mediaType,
          mediaUrl: mediaUrl || undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success("WhatsApp template created successfully!");
        onSuccess(json.data);
        onClose();
        setTitle("");
        setBodyText("");
        setMediaType("NONE");
        setMediaUrl("");
      } else {
        toast.error(json.message || "Failed to create template.");
      }
    } catch (err: any) {
      console.error("Template creation error:", err);
      toast.error("Failed to connect to backend service.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full p-6 space-y-6 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Create WhatsApp Template</h2>
              <p className="text-xs text-slate-400">Design variable-injected marketing & recall messages.</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors border-none cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Editor Form (Left) & Smartphone Live Preview (Right) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Form Controls */}
          <form onSubmit={handleSubmit} className="md:col-span-7 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Template Title
              </label>
              <input
                type="text"
                placeholder="e.g. Festival Offer Spectacle Frame Discount"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors"
                required
              />
            </div>

            {/* Media Type Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Media Header Type
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { type: "NONE", label: "Text Only", icon: MessageSquare },
                  { type: "IMAGE", label: "Image Flyer", icon: ImageIcon },
                  { type: "DOCUMENT", label: "PDF File", icon: FileText },
                  { type: "VIDEO", label: "Video Clip", icon: Video },
                ].map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setMediaType(item.type as any)}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      mediaType === item.type
                        ? "bg-purple-500/10 border-purple-500 text-purple-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="text-[11px]">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {mediaType !== "NONE" && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Media Asset URL
                </label>
                <input
                  type="url"
                  placeholder="https://assets.opticalmanager.in/media/flyer.jpg"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500 transition-colors font-mono"
                />
              </div>
            )}

            {/* Body Textarea & Variable Quick Tags */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Message Body Content
                </label>
                <span className="text-[11px] text-slate-400">{bodyText.length} characters</span>
              </div>
              <textarea
                rows={5}
                placeholder="Write your promotional or recall message here..."
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors resize-none"
                required
              />

              {/* Variable Quick Chips */}
              <div className="mt-2 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-400 block">
                  Insert Variables:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {variableChips.map((chip) => (
                    <button
                      key={chip.value}
                      type="button"
                      onClick={() => handleInsertVariable(chip.value)}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-purple-900/40 text-purple-300 text-[11px] font-mono transition-colors border border-slate-700/60 cursor-pointer"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer border-none"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all shadow-lg shadow-purple-600/20 cursor-pointer border-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Save Template</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Live Smartphone Preview */}
          <div className="md:col-span-5 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 text-center">
              Live Smartphone Preview
            </h3>
            <WhatsAppPreview bodyText={bodyText} mediaType={mediaType} mediaUrl={mediaUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}
