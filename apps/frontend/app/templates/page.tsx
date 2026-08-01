"use client";

import React, { useState } from "react";
import { Plus, FileText, Sparkles, Trash2, Image as ImageIcon, Video, MessageSquare } from "lucide-react";
import { TemplateEditorModal } from "@/components/templates/TemplateEditorModal";
import { toast } from "sonner";

interface TemplateItem {
  id: string;
  title: string;
  bodyText: string;
  mediaType: "NONE" | "IMAGE" | "DOCUMENT" | "VIDEO";
  mediaUrl?: string;
  variables: Array<{ key: string; description: string }>;
  createdAt: string;
}

export default function WhatsAppTemplatesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([
    {
      id: "tmpl-001",
      title: "Festival Discount Special Offer",
      bodyText: "Hello {{customer_name}}! 🕶️ Celebrate this festival with 20% OFF on all premium titanium spectacle frames at {{shop_name}}. Visit us in {{city}} today!",
      mediaType: "IMAGE",
      mediaUrl: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&auto=format&fit=crop&q=80",
      variables: [
        { key: "{{customer_name}}", description: "Customer Name" },
        { key: "{{shop_name}}", description: "Shop Name" },
        { key: "{{city}}", description: "City" },
      ],
      createdAt: "2026-07-28",
    },
    {
      id: "tmpl-002",
      title: "Annual Eye Test Recall Reminder",
      bodyText: "Hi {{customer_name}}, it has been 12 months since your last eye exam on {{last_prescription_date}}. Book your eye refraction test today at {{shop_name}} to ensure crystal clear vision!",
      mediaType: "NONE",
      variables: [
        { key: "{{customer_name}}", description: "Customer Name" },
        { key: "{{last_prescription_date}}", description: "Last Tested Date" },
        { key: "{{shop_name}}", description: "Shop Name" },
      ],
      createdAt: "2026-07-30",
    },
  ]);

  const handleDeleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    toast.success("Template deleted successfully.");
  };

  const handleTemplateCreated = (newTmpl: any) => {
    setTemplates((prev) => [newTmpl, ...prev]);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">
              WhatsApp Message Templates
            </h1>
            <span className="bg-purple-500/10 border border-purple-500/20 text-purple-400 font-extrabold text-[10px] uppercase px-2 py-0.5 rounded-full tracking-wider">
              Variable Engine
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Create reusable marketing flyers, recall reminders, and promotional message templates with dynamic customer tags.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all shadow-lg shadow-purple-600/20 cursor-pointer border-none"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Template</span>
        </button>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map((tmpl) => (
          <div
            key={tmpl.id}
            className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl relative group flex flex-col justify-between"
          >
            <div className="space-y-3">
              {/* Header Badge */}
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold text-white text-base tracking-tight leading-snug">{tmpl.title}</h3>
                <span className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-purple-500/10 border border-purple-500/20 text-purple-300 flex items-center gap-1">
                  {tmpl.mediaType === "IMAGE" && <ImageIcon className="w-3 h-3 text-purple-400" />}
                  {tmpl.mediaType === "DOCUMENT" && <FileText className="w-3 h-3 text-purple-400" />}
                  {tmpl.mediaType === "VIDEO" && <Video className="w-3 h-3 text-purple-400" />}
                  {tmpl.mediaType === "NONE" && <MessageSquare className="w-3 h-3 text-purple-400" />}
                  {tmpl.mediaType}
                </span>
              </div>

              {/* Body Text */}
              <p className="text-xs text-slate-300 bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl leading-relaxed whitespace-pre-wrap font-sans">
                {tmpl.bodyText}
              </p>

              {/* Variables Chips */}
              <div className="space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  Detected Variables:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {tmpl.variables.map((v) => (
                    <span
                      key={v.key}
                      className="px-2 py-0.5 rounded-md bg-slate-800 text-purple-300 text-[10px] font-mono border border-slate-700/60"
                    >
                      {v.key}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Created: {tmpl.createdAt}</span>
              <button
                onClick={() => handleDeleteTemplate(tmpl.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors border-none cursor-pointer"
                title="Delete Template"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Template Editor Modal */}
      <TemplateEditorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleTemplateCreated}
      />
    </div>
  );
}
