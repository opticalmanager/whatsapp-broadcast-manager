"use client";

import React, { useState, useEffect } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import { toast } from "sonner";
import {
  X,
  FileText,
  Send,
  Loader2,
  CheckCircle2,
  Image as ImageIcon,
  Sparkles,
  ExternalLink,
  MessageSquare
} from "lucide-react";

interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: string;
  text?: string;
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
  example?: any;
}

interface TemplateRecord {
  id: string;
  meta_template_name?: string;
  title: string;
  language?: string;
  category?: string;
  header_type?: string;
  header_content?: string;
  body_text: string;
  footer_text?: string;
  buttons?: any;
  components?: TemplateComponent[];
  media_url?: string;
}

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  phone: string;
  contactName?: string;
  onSuccess: () => void;
}

export function TemplateModal({
  isOpen,
  onClose,
  phone,
  contactName,
  onSuccess,
}: TemplateModalProps) {
  const backendUrl = getBackendUrl();
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateRecord | null>(null);
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [bodyVariables, setBodyVariables] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("broadcast_token");
    if (token) return { Authorization: `Bearer ${token}` };
    return {};
  };

  useEffect(() => {
    if (!isOpen) {
      setSelectedTemplate(null);
      setHeaderMediaUrl("");
      setBodyVariables({});
      return;
    }

    async function loadTemplates() {
      setLoading(true);
      try {
        const res = await fetch(`${backendUrl}/api/v1/templates`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            // Filter to approved / usable templates
            const approved = json.data.filter(
              (t: any) =>
                t.meta_status === "APPROVED" ||
                Boolean(t.meta_template_name) ||
                t.meta_template_id
            );
            setTemplates(approved.length > 0 ? approved : json.data);
            if (approved.length > 0) {
              selectTemplate(approved[0]);
            } else if (json.data.length > 0) {
              selectTemplate(json.data[0]);
            }
          }
        }
      } catch {
        toast.error("Failed to load approved Meta templates.");
      } finally {
        setLoading(false);
      }
    }

    loadTemplates();
  }, [isOpen, backendUrl]);

  const selectTemplate = (t: TemplateRecord) => {
    setSelectedTemplate(t);
    setHeaderMediaUrl(t.media_url || "");

    // Extract dynamic variables from body text (e.g. {{1}}, {{2}})
    const matches = (t.body_text || "").match(/\{\{(\d+)\}\}/g) || [];
    const initialVars: Record<string, string> = {};
    matches.forEach((m, idx) => {
      const varIndex = m.replace(/\D/g, "");
      if (idx === 0 && contactName && contactName !== "Customer") {
        initialVars[varIndex] = contactName;
      } else {
        initialVars[varIndex] = "";
      }
    });
    setBodyVariables(initialVars);
  };

  const handleSend = async () => {
    if (!selectedTemplate) return;
    const templateName = selectedTemplate.meta_template_name || selectedTemplate.title;
    if (!templateName) {
      toast.error("Invalid template selected.");
      return;
    }

    // Validate required header media URL
    const headerType = (selectedTemplate.header_type || "").toUpperCase();
    if ((headerType === "IMAGE" || headerType === "VIDEO" || headerType === "DOCUMENT") && !headerMediaUrl.trim()) {
      toast.error(`Please provide a media URL for the ${headerType} header.`);
      return;
    }

    // Build components according to Meta specification
    const components: any[] = [];

    // Header component
    if (headerType === "IMAGE" || headerType === "VIDEO" || headerType === "DOCUMENT") {
      components.push({
        type: "header",
        parameters: [
          {
            type: headerType.toLowerCase(),
            [headerType.toLowerCase()]: {
              link: headerMediaUrl.trim(),
            },
          },
        ],
      });
    }

    // Body parameters
    const varKeys = Object.keys(bodyVariables).sort((a, b) => Number(a) - Number(b));
    if (varKeys.length > 0) {
      const bodyParams = varKeys.map((k) => ({
        type: "text",
        text: bodyVariables[k].trim() || "-",
      }));
      components.push({
        type: "body",
        parameters: bodyParams,
      });
    }

    setSending(true);
    try {
      const res = await fetch(`${backendUrl}/api/v1/chat/send-template`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: phone.replace(/\D/g, ""),
          templateName,
          languageCode: selectedTemplate.language || "en_US",
          components,
          contactName,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(`Template "${templateName}" sent successfully!`);
        onSuccess();
        onClose();
      } else {
        toast.error(json.message || "Failed to send template via Meta Cloud API.");
      }
    } catch (err: any) {
      toast.error(`Error sending template: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-xl bg-white dark:bg-[#111726] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                Send Approved Meta Template
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                To: <span className="font-semibold text-slate-700 dark:text-slate-300">+{phone.replace(/\D/g, "")}</span>
                {contactName && contactName !== "Customer" && ` (${contactName})`}
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

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <p className="text-xs text-slate-500">Loading approved templates...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No approved templates found</p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Please create and sync pre-approved templates in the Templates tab before sending outside the 24h customer window.
              </p>
            </div>
          ) : (
            <>
              {/* Template Selector Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Select Meta Template
                </label>
                <select
                  value={selectedTemplate?.id || ""}
                  onChange={(e) => {
                    const found = templates.find((t) => t.id === e.target.value);
                    if (found) selectTemplate(found);
                  }}
                  className="w-full text-xs font-semibold bg-slate-50 dark:bg-slate-800/90 text-slate-800 dark:text-white px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.meta_template_name || t.title} ({t.category || "MARKETING"} - {t.language || "en_US"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Preview Card */}
              {selectedTemplate && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Live Template Preview
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                      {selectedTemplate.category || "APPROVED"}
                    </span>
                  </div>

                  {/* Header Preview / Media Input */}
                  {(selectedTemplate.header_type === "IMAGE" || selectedTemplate.header_type === "VIDEO") && (
                    <div className="space-y-1.5 pt-1">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        Header Image URL <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="url"
                        placeholder="https://images.unsplash.com/... or hosted image"
                        value={headerMediaUrl}
                        onChange={(e) => setHeaderMediaUrl(e.target.value)}
                        className="w-full text-xs bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white placeholder:text-slate-400"
                      />
                      {headerMediaUrl && (
                        <div className="h-28 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 mt-1">
                          <img src={headerMediaUrl} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Body Text Preview */}
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {selectedTemplate.body_text}
                  </div>

                  {/* Dynamic Variables Inputs */}
                  {Object.keys(bodyVariables).length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/50">
                      <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block">
                        Template Dynamic Variables:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {Object.keys(bodyVariables)
                          .sort((a, b) => Number(a) - Number(b))
                          .map((key) => (
                            <div key={key} className="space-y-1">
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                Variable {`{{${key}}}`}
                              </span>
                              <input
                                type="text"
                                placeholder={`Value for {{${key}}}`}
                                value={bodyVariables[key]}
                                onChange={(e) =>
                                  setBodyVariables({ ...bodyVariables, [key]: e.target.value })
                                }
                                className="w-full text-xs bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white"
                              />
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 shrink-0">
          <p className="text-[11px] text-slate-400">
            Approved Meta templates re-initiate a 24-hour window.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={sending}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !selectedTemplate}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>{sending ? "Sending..." : "Send Template"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
