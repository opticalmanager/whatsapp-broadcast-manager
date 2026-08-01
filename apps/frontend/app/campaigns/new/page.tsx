"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Send, 
  Smartphone, 
  Users, 
  FileText, 
  Zap, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Loader2,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

export default function NewCampaignWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [whatsappNumberId, setWhatsappNumberId] = useState("num-01");
  const [selectedTag, setSelectedTag] = useState("DUE_FOR_RETEST");
  const [selectedTemplateId, setSelectedTemplateId] = useState("tmpl-001");
  const [messageText, setMessageText] = useState(
    "Hello {{customer_name}}! 🕶️ Celebrate this festival with 20% OFF on all premium titanium spectacle frames at {{shop_name}}."
  );

  const handleLaunch = async () => {
    if (!name.trim()) {
      toast.error("Please enter a campaign name.");
      return;
    }

    try {
      setIsSubmitting(true);
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
      const res = await fetch(`${backendUrl}/api/v1/campaigns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer demo-token",
        },
        body: JSON.stringify({
          shopId: "shop-main",
          whatsappNumberId,
          name,
          targetAudienceType: `CRM Tag: ${selectedTag}`,
          templateId: selectedTemplateId,
          recipients: [
            { id: "crm-c1", phone: "9876543210", name: "Rahul Mehta" },
            { id: "crm-c2", phone: "9123456789", name: "Ananya Rao" },
          ],
          messageText,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success("Campaign launched and enqueued to BullMQ successfully!");
        router.push("/campaigns");
      } else {
        toast.error(json.message || "Failed to launch campaign.");
      }
    } catch (err: any) {
      console.error("Campaign launch error:", err);
      toast.error("Error connecting to backend service.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 select-none">
      {/* Top Header */}
      <div className="border-b border-slate-800/80 pb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          Campaign Creation Wizard
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure campaign settings, customer audience criteria, and human throttling rules.
        </p>
      </div>

      {/* Stepper Progress Bar */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { step: 1, label: "1. Setup & Outlet" },
          { step: 2, label: "2. Target Audience" },
          { step: 3, label: "3. Template & Text" },
          { step: 4, label: "4. Review & Launch" },
        ].map((item) => (
          <div
            key={item.step}
            className={`p-3 rounded-xl text-xs font-bold border transition-all text-center ${
              currentStep === item.step
                ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                : currentStep > item.step
                ? "bg-slate-900 border-slate-800 text-slate-300"
                : "bg-slate-950 border-slate-900 text-slate-600"
            }`}
          >
            {item.label}
          </div>
        ))}
      </div>

      {/* Wizard Steps Content */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white tracking-tight">Step 1: Campaign Details & Store Outlet</h2>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Campaign Name
              </label>
              <input
                type="text"
                placeholder="e.g. August Eye Exam Recall Broadcast"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Sending WhatsApp Number
              </label>
              <select
                value={whatsappNumberId}
                onChange={(e) => setWhatsappNumberId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="num-01">Main Branch - Narsapur (+91 98765 43210)</option>
                <option value="num-02">City Outlet Branch (+91 91234 56789)</option>
              </select>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white tracking-tight">Step 2: Select Customer Audience</h2>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                CRM Customer Segment Tag
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { tag: "DUE_FOR_RETEST", label: "Prescription Expiry (Tested 11+ Mo Ago)", count: 64 },
                  { tag: "VIP", label: "VIP High Value Customers", count: 42 },
                  { tag: "PROGRESSIVE", label: "Progressive Lens Users", count: 128 },
                  { tag: "CONTACT_LENS_USER", label: "Contact Lens Patients", count: 85 },
                ].map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => setSelectedTag(item.tag)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                      selectedTag === item.tag
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    <p className="font-bold text-sm text-white">{item.label}</p>
                    <span className="text-xs text-slate-400 mt-1 block">{item.count} Matching Patients in CRM</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white tracking-tight">Step 3: Choose Template & Message Content</h2>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                Message Content Body
              </label>
              <textarea
                rows={5}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors resize-none font-sans"
              />
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white tracking-tight">Step 4: Review Throttling & Launch</h2>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs text-slate-300">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Campaign Name:</span>
                <span className="font-bold text-white">{name || "Untitled Campaign"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Audience:</span>
                <span className="font-bold text-emerald-400">CRM Tag: {selectedTag}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Human Throttling:</span>
                <span className="font-bold text-purple-400">8s - 20s Random Delay + Typing Simulation</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Business Hours:</span>
                <span className="font-bold text-white">09:00 AM - 08:00 PM Window Enforced</span>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 1))}
            disabled={currentStep === 1}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer border-none"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => Math.min(prev + 1, 4))}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all cursor-pointer border-none shadow-lg shadow-emerald-600/20"
            >
              <span>Next Step</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLaunch}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all cursor-pointer border-none shadow-xl shadow-emerald-500/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enqueuing to BullMQ...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Launch Campaign Now</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
