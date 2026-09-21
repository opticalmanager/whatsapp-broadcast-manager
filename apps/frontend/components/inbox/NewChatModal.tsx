"use client";

import React, { useState } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import { toast } from "sonner";
import {
  X,
  MessageSquarePlus,
  Phone,
  User,
  Send,
  Loader2,
  Sparkles,
  ArrowRight
} from "lucide-react";

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChatInitiated: (conversation: any) => void;
  onSendTemplateRequested: (phone: string, contactName?: string) => void;
}

export function NewChatModal({
  isOpen,
  onClose,
  onChatInitiated,
  onSendTemplateRequested,
}: NewChatModalProps) {
  const backendUrl = getBackendUrl();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [countryCode, setCountryCode] = useState("91");
  const [loading, setLoading] = useState(false);

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("broadcast_token");
    if (token) return { Authorization: `Bearer ${token}` };
    return {};
  };

  const getFullCleanPhone = (): string => {
    let clean = phoneNumber.replace(/\D/g, "");
    if (clean.length === 10) {
      clean = `${countryCode}${clean}`;
    }
    return clean;
  };

  const handleStartChat = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanPhone = getFullCleanPhone();
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error("Please enter a valid phone number (at least 10 digits).");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/v1/chat/conversations/initiate`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: cleanPhone,
          contactName: contactName.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success && json.data) {
        toast.success(`Chat initiated with +${cleanPhone}`);
        onChatInitiated(json.data);
        onClose();
      } else {
        toast.error(json.message || "Failed to initiate chat.");
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateOption = () => {
    const cleanPhone = getFullCleanPhone();
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error("Please enter a valid phone number first.");
      return;
    }
    onClose();
    onSendTemplateRequested(cleanPhone, contactName.trim() || undefined);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-md bg-white dark:bg-[#111726] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-2xs">
              <MessageSquarePlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                New WhatsApp Conversation
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Send message or template to any number
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleStartChat} className="p-5 space-y-4">
          {/* Phone Number Input with Country Code */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Recipient WhatsApp Number <span className="text-rose-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative w-24 shrink-0">
                <span className="absolute left-2.5 top-2.5 text-xs text-slate-400 font-bold pointer-events-none">+</span>
                <input
                  type="text"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="91"
                  className="w-full text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800/90 text-slate-800 dark:text-white pl-6 pr-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 text-center"
                />
              </div>
              <div className="relative flex-1">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="tel"
                  autoFocus
                  placeholder="98765 43210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full text-xs font-mono font-bold bg-slate-50 dark:bg-slate-800/90 text-slate-800 dark:text-white pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              Enter 10-digit mobile number or full international format with country code.
            </p>
          </div>

          {/* Contact Name (Optional) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Contact Name <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="e.g. Rahul Sharma"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800/90 text-slate-800 dark:text-white pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Meta Policy Callout */}
          <div className="rounded-xl p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
            <span className="font-bold">Meta WABA Rule:</span> If this is the first time messaging this number, or if they haven&apos;t messaged you in 24 hours, use an <strong>Approved Template</strong> to initiate contact.
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              <span>Open Chat Thread</span>
            </button>

            <button
              type="button"
              onClick={handleTemplateOption}
              className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Send Approved Template First</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
