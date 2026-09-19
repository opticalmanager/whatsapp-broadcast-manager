"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { getBackendUrl } from "@/lib/backend-url";
import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { 
  Send, 
  Upload, 
  Download, 
  Plus, 
  Trash2, 
  FileSpreadsheet, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  HelpCircle, 
  Layers, 
  Smartphone, 
  Globe, 
  Image as ImageIcon,
  Video,
  MessageSquare,
  MapPin,
  Paperclip,
  Calendar,
  ChevronDown,
  Check,
  Loader2,
  FileText,
  Search,
  Users,
  Clock,
  Settings2,
  Info,
  PhoneCall,
  ExternalLink,
  CornerDownLeft,
  Copy,
  Zap,
  ShieldCheck
} from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

interface ContactRow {
  id: string;
  name: string;
  number: string;
  city?: string;
  tag?: string;
  var1?: string;
  var2?: string;
  var3?: string;
  var4?: string;
  var5?: string;
  var6?: string;
  var7?: string;
}

interface AudienceSegment {
  id: string;
  name: string;
  description?: string;
  contactCount: number;
}

// High-Performance Client-Side Smart Image Compression (Max 1280px HD, Quality 0.82)
async function compressImageFile(
  file: File,
  maxDimension = 1280,
  quality = 0.82
): Promise<{ file: File; base64: string; originalKB: number; compressedKB: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);
      }

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), { type: "image/jpeg" });
            const reader2 = new FileReader();
            reader2.onload = () => {
              const originalKB = Math.round(file.size / 1024);
              const compressedKB = Math.round(compressedFile.size / 1024);
              resolve({
                file: compressedFile,
                base64: reader2.result as string,
                originalKB,
                compressedKB,
              });
            };
            reader2.readAsDataURL(compressedFile);
          } else {
            resolve({
              file,
              base64: img.src,
              originalKB: Math.round(file.size / 1024),
              compressedKB: Math.round(file.size / 1024),
            });
          }
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CampaignsStudioPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500 font-medium">Loading Campaign Studio...</div>}>
      <CampaignsStudioInner />
    </Suspense>
  );
}

function CampaignsStudioInner() {
  const { user: authUser, getAuthHeaders, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateParam = searchParams.get("template");
  const audienceParam = searchParams.get("audience");
  const backendUrl = getBackendUrl();

  // Left Panel - 1. Campaign Name
  const [campaignName, setCampaignName] = useState<string>(() => {
    const d = new Date();
    const formatted = d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    return `Campaign ${formatted}, ${time}`;
  });

  // Channel Type State (WABA vs BAILEYS)
  const [channelType, setChannelType] = useState<"WABA" | "BAILEYS">("WABA");
  const [wabaConfig, setWabaConfig] = useState<{
    status: string;
    verifiedName?: string;
    displayPhoneNumber?: string;
    qualityRating?: string;
    messagingTier?: string;
    phoneNumberId?: string;
  } | null>(null);
  const [wabaLoading, setWabaLoading] = useState<boolean>(true);
  const [selectedMetaTemplateId, setSelectedMetaTemplateId] = useState<string>("");
  const [metaVariableMappings, setMetaVariableMappings] = useState<Record<string, string>>({});
  const [metaHeaderMediaUrl, setMetaHeaderMediaUrl] = useState<string>("");
  const [metaStaticValues, setMetaStaticValues] = useState<Record<string, string>>({});

  // Left Panel - 2. Recipients Tabs
  const [recipientTab, setRecipientTab] = useState<"CSV" | "Paste" | "Groups" | "Contacts">("Paste");
  
  // 1. Paste Tab State (Starts CLEAN)
  const [pasteRawText, setPasteRawText] = useState<string>("");
  
  // 2. CSV Tab State (Starts CLEAN)
  const [csvContacts, setCsvContacts] = useState<ContactRow[]>([]);
  
  // 3. Groups (Audiences) Tab State
  const [savedAudiences, setSavedAudiences] = useState<AudienceSegment[]>([]);
  const [selectedAudienceIds, setSelectedAudienceIds] = useState<string[]>([]);

  // 4. Contacts Tab State
  const [allDbContacts, setAllDbContacts] = useState<any[]>([]);
  const [contactsSearch, setContactsSearch] = useState<string>("");
  const [selectedDbContactIds, setSelectedDbContactIds] = useState<string[]>([]);
  const [contactsLoading, setContactsLoading] = useState<boolean>(false);
  const [contactsSerialFrom, setContactsSerialFrom] = useState<string>("");
  const [contactsSerialTo, setContactsSerialTo] = useState<string>("");

  const handleApplyContactsSerialRange = () => {
    const from = parseInt(contactsSerialFrom, 10);
    const to = parseInt(contactsSerialTo, 10);
    if (isNaN(from) || isNaN(to)) {
      toast.error("Please enter valid serial numbers for From and To.");
      return;
    }
    if (from < 1 || to < from) {
      toast.error("From serial must be at least 1 and To serial must be greater than or equal to From.");
      return;
    }

    const matchingIds: string[] = [];
    allDbContacts.forEach((c, index) => {
      const sNo = c.serialNumber != null ? c.serialNumber : index + 1;
      if (sNo >= from && sNo <= to) {
        matchingIds.push(c.id);
      }
    });

    if (matchingIds.length === 0) {
      toast.error(`No contacts found in serial range #${from} to #${to}.`);
      return;
    }

    setSelectedDbContactIds(matchingIds);
    toast.success(`Selected ${matchingIds.length} contact(s) from serial #${from} to #${to}.`);
  };

  // Template & WABA State
  const [dbTemplates, setDbTemplates] = useState<any[]>([]);
  const [compressionStats, setCompressionStats] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modals State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [rawSheetData, setRawSheetData] = useState<any[][]>([]);
  const [headerRowIdx, setHeaderRowIdx] = useState<number>(0);
  const [columnMapping, setColumnMapping] = useState<any>({
    name: -1, phone: -1, city: -1, tag: -1, var1: -1, var2: -1, var3: -1, var4: -1
  });
  const [validatedRows, setValidatedRows] = useState<any[]>([]);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);

  const [isCountryCodeModalOpen, setIsCountryCodeModalOpen] = useState(false);
  const [countryCodeInput, setCountryCodeInput] = useState("91");

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [scheduledTime, setScheduledTime] = useState("10:00");
  const [scheduledDateTime, setScheduledDateTime] = useState("");
  const [sending, setSending] = useState(false);

  // ==========================================
  // 1. DATA FETCHING
  // ==========================================

  useEffect(() => {
    async function loadInitialData() {
      if (!isAuthenticated) return;
      const headers = getAuthHeaders();

      // 0. Load Meta WABA Configuration
      try {
        setWabaLoading(true);
        const wabaRes = await fetch(`${backendUrl}/api/v1/waba/config`, { headers });
        if (wabaRes.ok) {
          const wabaJson = await wabaRes.json();
          if (wabaJson.success && wabaJson.data) {
            setWabaConfig(wabaJson.data);
            setChannelType("WABA");
          }
        }
      } catch {} finally {
        setWabaLoading(false);
      }

      // 0. Load DB Templates from PostgreSQL
      try {
        const tRes = await fetch(`${backendUrl}/api/v1/templates`, { headers });
        if (tRes.ok) {
          const tJson = await tRes.json();
          if (tJson.success && Array.isArray(tJson.data)) {
            setDbTemplates(tJson.data);
            const approved = tJson.data.filter(
              (t: any) => t.metaStatus === "APPROVED" || t.meta_status === "APPROVED" || Boolean(t.metaTemplateName)
            );
            if (approved.length > 0 && !templateParam) {
              setSelectedMetaTemplateId(approved[0].id);
            }
          }
        }
      } catch {}

      // 2. Load Saved Audiences
      try {
        const res = await fetch(`${backendUrl}/api/v1/audiences`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setSavedAudiences(json.data);
          }
        }
      } catch {}

      // 3. Load DB Contacts
      try {
        setContactsLoading(true);
        const res = await fetch(`${backendUrl}/api/v1/contacts?limit=10000`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setAllDbContacts(json.data);
          }
        }
      } catch {} finally {
        setContactsLoading(false);
      }

      // 4. Handle Template Query Param
      if (templateParam) {
        try {
          const tRes = await fetch(`${backendUrl}/api/v1/templates/${templateParam}`, { headers });
          if (tRes.ok) {
            const tJson = await tRes.json();
            const tpl = tJson.data || tJson;
            if (tpl) {
              setSelectedMetaTemplateId(tpl.id);
              if (tpl.mediaUrl) {
                setMetaHeaderMediaUrl(tpl.mediaUrl);
              }
              toast.success(`Loaded Meta template: "${tpl.title || tpl.metaTemplateName}"`);
            }
          }
        } catch {}
      }

      // 5. Handle Audience Query Param
      if (audienceParam) {
        setRecipientTab("Groups");
        setSelectedAudienceIds([audienceParam]);
      }
    }

    loadInitialData();
  }, [isAuthenticated, templateParam, audienceParam]);



  // Filter DB templates for Meta-Approved templates
  const metaApprovedTemplates = useMemo(() => {
    return dbTemplates.filter(
      (t) => t.metaStatus === "APPROVED" || (t as any).meta_status === "APPROVED" || Boolean(t.metaTemplateName)
    );
  }, [dbTemplates]);

  // Selected Meta Template
  const selectedMetaTemplate = useMemo(() => {
    if (!selectedMetaTemplateId) {
      if (metaApprovedTemplates.length > 0) return metaApprovedTemplates[0];
      return null;
    }
    return dbTemplates.find((t) => t.id === selectedMetaTemplateId) || metaApprovedTemplates[0] || null;
  }, [selectedMetaTemplateId, dbTemplates, metaApprovedTemplates]);

  // Positional variable tokens in selected Meta template (e.g. {{1}}, {{2}})
  const templateVariableTokens = useMemo(() => {
    if (!selectedMetaTemplate || !selectedMetaTemplate.bodyText) return [];
    const matches = selectedMetaTemplate.bodyText.match(/\{\{(\d+)\}\}/g) || [];
    const uniqueKeys: string[] = Array.from(new Set<string>(matches.map((m: string) => m.replace(/\D/g, ""))))
      .sort((a: string, b: string) => parseInt(a, 10) - parseInt(b, 10));
    return uniqueKeys;
  }, [selectedMetaTemplate]);

  // Parsed sample values from template
  const parsedSampleValues = useMemo(() => {
    if (!selectedMetaTemplate) return {};
    const raw = selectedMetaTemplate.sampleValues || (selectedMetaTemplate as any).sample_values;
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }, [selectedMetaTemplate]);

  // Parsed buttons from template
  const parsedMetaButtons = useMemo(() => {
    if (!selectedMetaTemplate?.buttons) return [];
    if (Array.isArray(selectedMetaTemplate.buttons)) return selectedMetaTemplate.buttons;
    try {
      return JSON.parse(selectedMetaTemplate.buttons);
    } catch {
      return [];
    }
  }, [selectedMetaTemplate]);

  // Available CSV Columns from uploaded sheet
  const availableCsvColumns = useMemo(() => {
    if (rawSheetData && rawSheetData[headerRowIdx] && Array.isArray(rawSheetData[headerRowIdx])) {
      return rawSheetData[headerRowIdx].map((h) => String(h || "").trim()).filter(Boolean);
    }
    return [];
  }, [rawSheetData, headerRowIdx]);

  // Auto-sync variable mappings when template changes
  useEffect(() => {
    if (templateVariableTokens.length > 0) {
      setMetaVariableMappings((prev) => {
        const next = { ...prev };
        templateVariableTokens.forEach((k, idx) => {
          if (!next[k]) {
            if (idx === 0) next[k] = "name";
            else if (idx === 1) next[k] = "city";
            else next[k] = `var${idx}`;
          }
        });
        return next;
      });
    }
  }, [templateVariableTokens]);

  // Auto-sync header media URL when template changes
  useEffect(() => {
    if (selectedMetaTemplate) {
      const hType = (selectedMetaTemplate.headerType || "").toUpperCase();
      if (["IMAGE", "VIDEO", "DOCUMENT"].includes(hType)) {
        setMetaHeaderMediaUrl(selectedMetaTemplate.headerContent || selectedMetaTemplate.mediaUrl || "");
      } else {
        setMetaHeaderMediaUrl("");
      }
    }
  }, [selectedMetaTemplate]);



  // ==========================================
  // 2. RECIPIENTS COMPUTATION
  // ==========================================

  const parsedPastedNumbers = useMemo(() => {
    if (!pasteRawText.trim()) return [];
    const lines = pasteRawText.split(/[\n,;]+/);
    const valid: Array<{ phone: string; name: string }> = [];
    const seen = new Set<string>();

    lines.forEach((l, idx) => {
      const clean = l.replace(/\D/g, "");
      if (clean.length >= 10 && clean.length <= 15 && !seen.has(clean)) {
        seen.add(clean);
        valid.push({
          phone: clean.startsWith("0") ? "91" + clean.slice(1) : clean.length === 10 ? "91" + clean : clean,
          name: `Recipient ${idx + 1}`
        });
      }
    });
    return valid;
  }, [pasteRawText]);

  const audienceSelectedCount = useMemo(() => {
    return savedAudiences
      .filter((a) => selectedAudienceIds.includes(a.id))
      .reduce((sum, a) => sum + (Number(a.contactCount) || 0), 0);
  }, [savedAudiences, selectedAudienceIds]);

  const totalRecipientsCount = useMemo(() => {
    if (recipientTab === "Paste") return parsedPastedNumbers.length;
    if (recipientTab === "CSV") return csvContacts.length;
    if (recipientTab === "Groups") return audienceSelectedCount;
    if (recipientTab === "Contacts") return selectedDbContactIds.length;
    return 0;
  }, [recipientTab, parsedPastedNumbers, csvContacts, audienceSelectedCount, selectedDbContactIds]);



  // Real Sample Recipient for Dynamic Variable Preview
  const sampleRecipientData = useMemo(() => {
    if (recipientTab === "Paste" && parsedPastedNumbers.length > 0) {
      return {
        name: parsedPastedNumbers[0].name || "Valued Customer",
        phone: "+" + parsedPastedNumbers[0].phone.replace(/\D/g, ""),
        city: "Main City",
        var1: "Sample 1",
        var2: "Sample 2",
      };
    }
    if (recipientTab === "CSV" && csvContacts.length > 0) {
      const c = csvContacts[0];
      return {
        name: c.name || "Valued Customer",
        phone: c.number ? (c.number.startsWith("+") ? c.number : "+" + c.number.replace(/\D/g, "")) : "+91 98765 43210",
        city: c.city || "Main City",
        var1: c.var1 || "Sample 1",
        var2: c.var2 || "Sample 2",
      };
    }
    if (recipientTab === "Contacts" && selectedDbContactIds.length > 0) {
      const contact = allDbContacts.find((c) => selectedDbContactIds.includes(c.id));
      if (contact) {
        return {
          name: contact.name || "Valued Customer",
          phone: contact.phone ? (contact.phone.startsWith("+") ? contact.phone : "+" + contact.phone.replace(/\D/g, "")) : "+91 98765 43210",
          city: contact.city || "Main City",
          var1: "Sample 1",
          var2: "Sample 2",
        };
      }
    }
    return {
      name: "Rahul Sharma",
      phone: "+91 98765 43210",
      city: "Mumbai",
      var1: "Sample 1",
      var2: "Sample 2",
    };
  }, [recipientTab, parsedPastedNumbers, csvContacts, selectedDbContactIds, allDbContacts]);

  // Preview Meta Parameter resolver for real-time visualization with real recipient data
  const previewResolvedText = useMemo(() => {
    if (!selectedMetaTemplate || !selectedMetaTemplate.bodyText) return "";
    let resolved = selectedMetaTemplate.bodyText;

    templateVariableTokens.forEach((k) => {
      const mapping = metaVariableMappings[k] || (k === "1" ? "name" : k === "2" ? "city" : `var${k}`);
      let val = "";
      if (mapping === "name") {
        val = sampleRecipientData.name && !sampleRecipientData.name.startsWith("Recipient") && sampleRecipientData.name !== "Customer" && sampleRecipientData.name !== "Valued Customer" ? sampleRecipientData.name : "Rahul Sharma";
      } else if (mapping === "phone") {
        val = sampleRecipientData.phone || "+91 98765 43210";
      } else if (mapping === "city") {
        val = sampleRecipientData.city || "Mumbai";
      } else if (mapping === "var1") {
        val = sampleRecipientData.var1 || "Sample 1";
      } else if (mapping === "var2") {
        val = sampleRecipientData.var2 || "Sample 2";
      } else if (mapping.startsWith("static:")) {
        val = metaStaticValues[k] || mapping.replace("static:", "") || `Value ${k}`;
      } else if (availableCsvColumns.includes(mapping)) {
        if (csvContacts.length > 0) {
          const firstRow = csvContacts[0] as any;
          val = firstRow[mapping] || firstRow.name || `[${mapping}]`;
        } else {
          val = `[${mapping}]`;
        }
      } else {
        val = (sampleRecipientData as any)[mapping] || parsedSampleValues[k] || `[Value ${k}]`;
      }
      resolved = resolved.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), val);
    });

    if (selectedMetaTemplate.footerText) {
      resolved = resolved.trim() + "\n\n" + `_${selectedMetaTemplate.footerText}_`;
    }
    return resolved;
  }, [
    selectedMetaTemplate,
    templateVariableTokens,
    metaVariableMappings,
    metaStaticValues,
    availableCsvColumns,
    csvContacts,
    parsedSampleValues,
    sampleRecipientData
  ]);

  // Smart File Upload Handling with High-Speed Compression for Header Media
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setCompressionStats(null);
    setIsUploadingMedia(true);

    try {
      let finalBase64 = "";
      let mimeType = file.type || "image/jpeg";
      let filename = file.name;
      let displaySize = (file.size / 1024).toFixed(1) + " KB";

      if (file.type.startsWith("image/")) {
        const compressed = await compressImageFile(file);
        finalBase64 = compressed.base64;
        mimeType = "image/jpeg";
        filename = file.name.replace(/\.[^/.]+$/, ".jpg");
        displaySize = compressed.compressedKB + " KB";
        const savedPct = Math.max(0, Math.round((1 - compressed.compressedKB / Math.max(compressed.originalKB, 1)) * 100));
        setCompressionStats(`⚡ Compressed: ${compressed.originalKB} KB → ${compressed.compressedKB} KB (${savedPct}% saved)`);
      } else {
        finalBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      let finalMediaUrl = finalBase64;

      // Upload to backend endpoint for permanent public URL
      try {
        const res = await fetch(`${backendUrl}/api/v1/media/upload-direct`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            filename,
            mimeType,
            base64Data: finalBase64,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data?.fileUrl) {
            finalMediaUrl = json.data.fileUrl;
          }
        }
      } catch {}

      setMetaHeaderMediaUrl(finalMediaUrl);
      toast.success(`Header media uploaded (${displaySize})`);
    } catch {
      toast.error("Failed to process header media file.");
    } finally {
      setIsUploadingMedia(false);
      if (e.target) e.target.value = "";
    }
  };

  // Paste Utilities
  const handlePasteRemoveDuplicates = () => {
    const lines = pasteRawText.split(/[\n,;]+/);
    const seen = new Set<string>();
    const deduped: string[] = [];
    lines.forEach((l) => {
      const clean = l.trim();
      if (clean && !seen.has(clean)) {
        seen.add(clean);
        deduped.push(clean);
      }
    });
    setPasteRawText(deduped.join("\n"));
    toast.success(`Removed duplicate numbers.`);
  };

  const handleInsertCountryCodeToPaste = () => {
    const code = countryCodeInput.trim().replace(/\D/g, "") || "91";
    const lines = pasteRawText.split(/[\n,;]+/);
    const modified = lines.map((l) => {
      const digits = l.replace(/\D/g, "");
      if (digits.length === 10) return code + digits;
      if (digits.length === 11 && digits.startsWith("0")) return code + digits.slice(1);
      return l;
    });
    setPasteRawText(modified.join("\n"));
    setIsCountryCodeModalOpen(false);
    toast.success(`Prepended +${code} to 10-digit numbers.`);
  };

  // ==========================================
  // 4. 4-STEP CSV IMPORT WIZARD LOGIC
  // ==========================================

  const handleFileDropOrSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.SheetNames[0];
        const jsonSheet: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1 });

        if (!jsonSheet || jsonSheet.length === 0) {
          toast.error("Uploaded file is empty.");
          return;
        }

        setRawSheetData(jsonSheet);
        setHeaderRowIdx(0);
        autoDetectColumns(jsonSheet, 0);
        setWizardStep(2);
      } catch (err: any) {
        toast.error("Failed to parse file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const autoDetectColumns = (sheet: any[][], headerIdx: number) => {
    if (!sheet[headerIdx]) return;
    const headers = sheet[headerIdx].map((h: any) =>
      String(h || "").trim().toLowerCase().replace(/[\s_-]/g, "")
    );

    const mapping: any = {
      name: -1, phone: -1, city: -1, tag: -1, var1: -1, var2: -1, var3: -1, var4: -1
    };

    headers.forEach((h: string, idx: number) => {
      if (mapping.phone === -1 && ["phone", "mobile", "contact", "number", "phonenumber", "whatsapp", "tel", "cell"].includes(h)) {
        mapping.phone = idx;
      } else if (mapping.name === -1 && ["name", "fullname", "customername", "clientname", "patientname", "first"].includes(h)) {
        mapping.name = idx;
      } else if (mapping.city === -1 && ["city", "location", "town", "district"].includes(h)) {
        mapping.city = idx;
      } else if (mapping.tag === -1 && ["tag", "tags", "category", "group"].includes(h)) {
        mapping.tag = idx;
      } else if (mapping.var1 === -1 && h.includes("var1")) mapping.var1 = idx;
      else if (mapping.var2 === -1 && h.includes("var2")) mapping.var2 = idx;
    });

    if (mapping.phone === -1) {
      for (let c = 0; c < headers.length; c++) {
        const sampleVal = String(sheet[headerIdx + 1]?.[c] || "").replace(/\D/g, "");
        if (sampleVal.length >= 10 && sampleVal.length <= 15) {
          mapping.phone = c;
          break;
        }
      }
    }

    setColumnMapping(mapping);
  };

  const processAndValidateData = () => {
    if (columnMapping.phone === -1) {
      toast.error("Please match a column to 'Phone Number'.");
      return;
    }

    const dataRows = rawSheetData.slice(headerRowIdx + 1);
    const validated: any[] = [];

    dataRows.forEach((r, idx) => {
      if (!r || r.length === 0 || r.every((cell) => cell === undefined || cell === "")) return;
      const rawPhone = String(r[columnMapping.phone] || "").trim();
      const rawName = columnMapping.name !== -1 ? String(r[columnMapping.name] || "").trim() : "";
      const rawCity = columnMapping.city !== -1 ? String(r[columnMapping.city] || "").trim() : "";
      const v1 = columnMapping.var1 !== -1 ? String(r[columnMapping.var1] || "").trim() : "";
      const v2 = columnMapping.var2 !== -1 ? String(r[columnMapping.var2] || "").trim() : "";

      const cleanNum = rawPhone.replace(/\D/g, "");
      let isValid = cleanNum.length >= 10 && cleanNum.length <= 15;
      let errorMsg = !cleanNum ? "Missing number" : cleanNum.length < 10 ? "Less than 10 digits" : "";

      validated.push({
        row: {
          id: `csv_${idx}_${Date.now()}`,
          name: rawName || "Customer",
          number: cleanNum || rawPhone,
          city: rawCity,
          var1: v1,
          var2: v2
        },
        valid: isValid,
        errorMsg,
        selected: isValid
      });
    });

    setValidatedRows(validated);
    setWizardStep(4);
  };

  const handleConfirmImport = () => {
    const selected = validatedRows.filter((item) => item.selected && item.valid).map((item) => item.row);
    if (selected.length === 0) {
      toast.error("No valid rows selected.");
      return;
    }
    setCsvContacts((prev) => [...prev, ...selected]);
    setIsWizardOpen(false);
    toast.success(`Imported ${selected.length} contacts from file!`);
  };

  // ==========================================
  // 5. CAMPAIGN DISPATCH
  // ==========================================

  const handleStartCampaign = async (scheduleIso?: string) => {
    if (!campaignName.trim()) {
      toast.error("Please enter a campaign name.");
      return;
    }

    if (totalRecipientsCount === 0) {
      toast.error("Please add at least one recipient (via CSV, paste numbers, groups, or contacts).");
      return;
    }

    if (!wabaConfig || wabaConfig.status !== "CONNECTED") {
      toast.error("Meta WhatsApp Cloud API is not connected. Please configure your credentials in Settings.");
      return;
    }
    if (!selectedMetaTemplate) {
      toast.error("Please select an approved Meta template for WhatsApp Cloud API broadcasts.");
      return;
    }

    let finalRecipients: Array<{ id: string; phone: string; name?: string; variables?: any }> = [];

    if (recipientTab === "Paste") {
      finalRecipients = parsedPastedNumbers.map((p, idx) => ({
        id: `pst_${idx}_${Date.now()}`,
        phone: p.phone,
        name: p.name,
        variables: { name: p.name, customer_name: p.name }
      }));
    } else if (recipientTab === "CSV") {
      finalRecipients = csvContacts.map((c) => ({
        id: c.id,
        phone: c.number,
        name: c.name,
        variables: { name: c.name, customer_name: c.name, city: c.city || "", var1: c.var1 || "", var2: c.var2 || "" }
      }));
    } else if (recipientTab === "Contacts") {
      finalRecipients = allDbContacts
        .filter((c) => selectedDbContactIds.includes(c.id))
        .map((c) => ({
          id: c.id,
          phone: c.phone,
          name: c.name,
          variables: { name: c.name, customer_name: c.name, city: c.city || "" }
        }));
    } else if (recipientTab === "Groups") {
      if (selectedAudienceIds.length === 0) {
        toast.error("Please select at least one contact segment.");
        return;
      }

      // Fetch actual real contacts for all selected segments from backend
      const headers = { ...getAuthHeaders(), "Content-Type": "application/json" };
      const fetchedContacts: any[] = [];

      for (const audId of selectedAudienceIds) {
        try {
          const res = await fetch(`${backendUrl}/api/v1/audiences/${audId}/contacts`, { headers });
          if (res.ok) {
            const json = await res.json();
            const list = json.data || json.contacts || (Array.isArray(json) ? json : []);
            if (Array.isArray(list)) {
              fetchedContacts.push(...list);
            }
          }
        } catch (err) {
          console.error("Error fetching segment contacts:", err);
        }
      }

      // Deduplicate contacts by 10-digit phone number
      const seenPhones = new Set<string>();
      finalRecipients = [];

      for (const c of fetchedContacts) {
        const rawPhone = String(c.phone || c.number || "").replace(/\D/g, "");
        const phone10 = rawPhone.slice(-10);
        if (phone10.length === 10 && !seenPhones.has(phone10)) {
          seenPhones.add(phone10);
          finalRecipients.push({
            id: c.id || `seg_${Date.now()}_${finalRecipients.length}`,
            phone: rawPhone.length === 10 ? "91" + rawPhone : rawPhone,
            name: c.name || "Customer",
            variables: {
              name: c.name || "Customer",
              customer_name: c.name || "Customer",
              phone: rawPhone,
              city: c.city || "",
              var1: c.var1 || "",
              var2: c.var2 || "",
            }
          });
        }
      }

      if (finalRecipients.length === 0) {
        toast.error("The selected contact segment has 0 contacts. Please select a segment with contacts or add members first.");
        return;
      }
    }

    try {
      setSending(true);
      const headers = { ...getAuthHeaders(), "Content-Type": "application/json" };
      
      // In WABA mode, resolve variable mappings into effective recipient variables
      const effectiveRecipients = finalRecipients.map((rec) => {
        const vars: Record<string, string> = { ...(rec.variables || {}) };
        templateVariableTokens.forEach((k) => {
          const mappedField = metaVariableMappings[k] || (k === "1" ? "name" : k === "2" ? "city" : `var${k}`);
          if (mappedField === "name") {
            vars[k] = rec.name || "Customer";
          } else if (mappedField === "phone") {
            vars[k] = rec.phone || "";
          } else if (mappedField === "city") {
            vars[k] = (rec.variables?.city) || "";
          } else if (mappedField === "var1") {
            vars[k] = (rec.variables?.var1) || "";
          } else if (mappedField === "var2") {
            vars[k] = (rec.variables?.var2) || "";
          } else if (mappedField.startsWith("static:")) {
            vars[k] = metaStaticValues[k] || mappedField.replace("static:", "");
          } else if ((rec as any)[mappedField]) {
            vars[k] = String((rec as any)[mappedField]);
          } else if (rec.variables && rec.variables[mappedField]) {
            vars[k] = String(rec.variables[mappedField]);
          } else {
            vars[k] = vars[k] || "";
          }
        });
        return {
          id: rec.id,
          phone: rec.phone,
          name: rec.name,
          variables: vars,
        };
      });

      const payload = {
        name: campaignName.trim(),
        channelType: "WABA",
        templateId: selectedMetaTemplate?.id,
        metaTemplateName: selectedMetaTemplate?.metaTemplateName || selectedMetaTemplate?.title,
        metaTemplateLanguage: selectedMetaTemplate?.language || "en_US",
        variableMappings: metaVariableMappings,
        headerMediaUrl: metaHeaderMediaUrl.trim() || undefined,
        recipients: effectiveRecipients,
        targetAudienceType: recipientTab,
        audienceNames: recipientTab === "Groups" ? savedAudiences.filter((a) => selectedAudienceIds.includes(a.id)).map((a) => a.name) : undefined,
        scheduledAt: scheduleIso || undefined,
      };

      const res = await fetch(`${backendUrl}/api/v1/campaigns`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        if (scheduleIso) {
          toast.success(`Campaign "${campaignName}" successfully scheduled for ${new Date(scheduleIso).toLocaleString()}!`);
          setIsScheduleModalOpen(false);
        } else {
          toast.success(`⚡ Meta Cloud API campaign "${campaignName}" launched across ${totalRecipientsCount} recipients!`);
          setTimeout(() => router.push("/campaigns"), 600);
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        toast.error(errJson.message || "Failed to launch campaign. Check connection.");
      }
    } catch {
      toast.error("Network error while dispatching campaign.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-600" />
            <span>New Broadcast Campaign</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-black border border-emerald-200 dark:border-emerald-800">
              ⚡ Meta Cloud API
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Compose and launch high-throughput WhatsApp broadcasts via official Meta WhatsApp Cloud API.
          </p>
        </div>
        {wabaConfig?.status === "CONNECTED" && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{wabaConfig.verifiedName || "WABA Connected"} ({wabaConfig.displayPhoneNumber})</span>
          </div>
        )}
      </div>

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* =========================================================================
            LEFT PANEL: Campaign Form, Recipients, Template, Message Composer (7 cols)
            ========================================================================= */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Section 1: Campaign Name & Recipients Selection */}
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-5">
            
            {/* Campaign Name */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Campaign name
              </label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g. Festival Offer Broadcast"
                className="w-full mt-1.5 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Recipients Section with 4 Navigation Tabs */}
            <div className="space-y-3">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                RECIPIENTS
              </label>

              {/* Tab Navigation Pill Bar */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl max-w-md">
                <button
                  type="button"
                  onClick={() => setRecipientTab("CSV")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    recipientTab === "CSV"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientTab("Paste")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    recipientTab === "Paste"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Paste
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientTab("Groups")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    recipientTab === "Groups"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Groups
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientTab("Contacts")}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    recipientTab === "Contacts"
                      ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Contacts
                </button>
              </div>

              {/* 1. PASTE TAB CONTENT */}
              {recipientTab === "Paste" && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Paste Numbers
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCountryCodeModalOpen(true)}
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Insert Country Code (+91)</span>
                    </button>
                  </div>

                  <textarea
                    rows={4}
                    value={pasteRawText}
                    onChange={(e) => setPasteRawText(e.target.value)}
                    placeholder="+919876543210&#10;9876543211&#10;+91 98765 43212 (one per line or comma-separated)"
                    className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{parsedPastedNumbers.length} valid numbers parsed</span>
                    {parsedPastedNumbers.length > 0 && (
                      <button
                        type="button"
                        onClick={handlePasteRemoveDuplicates}
                        className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                      >
                        Remove duplicates
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 2. CSV TAB CONTENT */}
              {recipientTab === "CSV" && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Imported Contacts ({csvContacts.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setWizardStep(1);
                        setIsWizardOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-2xs cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{csvContacts.length === 0 ? "Launch 4-Step Import Wizard" : "Re-Import File"}</span>
                    </button>
                  </div>

                  {csvContacts.length === 0 ? (
                    <div 
                      onClick={() => { setWizardStep(1); setIsWizardOpen(true); }}
                      className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-500 transition-colors"
                    >
                      <FileSpreadsheet className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Click to upload Excel / CSV File</p>
                      <p className="text-[11px] text-slate-400">Supports .xlsx, .xls, .csv with automatic column matching</p>
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 uppercase font-bold sticky top-0">
                          <tr>
                            <th className="p-2">Name</th>
                            <th className="p-2">Phone</th>
                            <th className="p-2">Variable 1</th>
                            <th className="p-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {csvContacts.map((c) => (
                            <tr key={c.id}>
                              <td className="p-2 font-medium">{c.name}</td>
                              <td className="p-2 font-mono font-bold text-emerald-600">{c.number}</td>
                              <td className="p-2 text-slate-400">{c.var1 || "-"}</td>
                              <td className="p-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => setCsvContacts((prev) => prev.filter((item) => item.id !== c.id))}
                                  className="text-rose-500 hover:text-rose-700"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 3. GROUPS TAB CONTENT */}
              {recipientTab === "Groups" && (
                <div className="space-y-3 pt-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Select Saved Audiences
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto">
                    {savedAudiences.length === 0 ? (
                      <div className="col-span-2 p-4 text-center text-xs text-slate-400 border border-slate-200 dark:border-slate-800 rounded-xl">
                        No saved audiences found.
                      </div>
                    ) : (
                      savedAudiences.map((aud) => {
                        const isSelected = selectedAudienceIds.includes(aud.id);
                        return (
                          <div
                            key={aud.id}
                            onClick={() => {
                              setSelectedAudienceIds((prev) =>
                                isSelected ? prev.filter((id) => id !== aud.id) : [...prev, aud.id]
                              );
                            }}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                              isSelected
                                ? "bg-emerald-50 border-emerald-400 dark:bg-emerald-950/40 dark:border-emerald-700"
                                : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                            }`}
                          >
                            <div>
                              <p className="text-xs font-bold text-slate-800 dark:text-white">{aud.name}</p>
                              <p className="text-[10px] text-slate-500">{aud.contactCount || 0} contacts</p>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* 4. CONTACTS TAB CONTENT */}
              {recipientTab === "Contacts" && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={contactsSearch}
                        onChange={(e) => setContactsSearch(e.target.value)}
                        placeholder="Search contacts by name, phone..."
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedDbContactIds.length === allDbContacts.length) {
                          setSelectedDbContactIds([]);
                        } else {
                          setSelectedDbContactIds(allDbContacts.map((c) => c.id));
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {selectedDbContactIds.length === allDbContacts.length && allDbContacts.length > 0 ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  {/* Serial Range Selection: Exactly as requested ("under serach bar show from and to (uner that user can add serial number then it get slected and then sent capign to them)") */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
                        Select by Serial Range:
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({selectedDbContactIds.length} of {allDbContacts.length} selected)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-slate-400 font-semibold">From #</span>
                        <input
                          type="number"
                          min="1"
                          placeholder="1"
                          value={contactsSerialFrom}
                          onChange={(e) => setContactsSerialFrom(e.target.value)}
                          className="w-14 bg-transparent text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-slate-400 font-semibold">To #</span>
                        <input
                          type="number"
                          min="1"
                          placeholder={String(allDbContacts.length || 100)}
                          value={contactsSerialTo}
                          onChange={(e) => setContactsSerialTo(e.target.value)}
                          className="w-14 bg-transparent text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyContactsSerialRange}
                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        Select Range
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setContactsSerialFrom("");
                          setContactsSerialTo("");
                          setSelectedDbContactIds([]);
                        }}
                        className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-slate-100 dark:bg-slate-950 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="p-2.5 w-8"></th>
                          <th className="p-2.5 w-12 text-center">#</th>
                          <th className="p-2.5">Name</th>
                          <th className="p-2.5">Phone</th>
                          <th className="p-2.5">City</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {allDbContacts
                          .filter((c) => (c.name || "").toLowerCase().includes(contactsSearch.toLowerCase()) || (c.phone || "").includes(contactsSearch))
                          .map((c, idx) => {
                            const isSelected = selectedDbContactIds.includes(c.id);
                            const sNo = c.serialNumber != null ? c.serialNumber : idx + 1;
                            return (
                              <tr
                                key={c.id}
                                onClick={() => {
                                  setSelectedDbContactIds((prev) =>
                                    isSelected ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                                  );
                                }}
                                className={`cursor-pointer transition-colors ${
                                  isSelected ? "bg-emerald-50/60 dark:bg-emerald-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-900/50"
                                }`}
                              >
                                <td className="p-2.5 w-8">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    className="rounded text-emerald-600 cursor-pointer"
                                  />
                                </td>
                                <td className="p-2.5 w-12 text-center font-mono font-bold text-[11px] text-slate-500 dark:text-slate-400">
                                  #{sNo}
                                </td>
                                <td className="p-2.5 font-bold text-slate-800 dark:text-white">{c.name || "Customer"}</td>
                                <td className="p-2.5 font-mono text-slate-500">{c.phone}</td>
                                <td className="p-2.5 text-slate-400">{c.city || "-"}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

          </div>

          {/* WABA Account Warning Banner if not connected */}
          {wabaConfig?.status !== "CONNECTED" && (
            <div className="p-4 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="font-bold text-amber-900 dark:text-amber-200">
                    Meta WhatsApp Cloud API Not Configured
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                    Configure your Meta Phone Number ID and Permanent Access Token in Settings to send campaigns.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push("/settings")}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shrink-0 cursor-pointer shadow-2xs"
              >
                Configure in Settings
              </button>
            </div>
          )}

          {/* Section 2: Approved Meta Template Selection */}
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Select Approved Meta Template (Mandatory for Cloud API)</span>
              </label>
              <button
                type="button"
                onClick={() => router.push("/templates")}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>Template Studio</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {metaApprovedTemplates.length === 0 ? (
              <div className="p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  No Meta-Approved Templates Found
                </p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  WhatsApp Cloud API requires Meta-approved templates to initiate outbound broadcasts.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/templates")}
                  className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Template in Studio</span>
                </button>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedMetaTemplate?.id || ""}
                  onChange={(e) => setSelectedMetaTemplateId(e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 pr-8 cursor-pointer"
                >
                  {metaApprovedTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} [{t.category}] ({t.language || "en_US"}) • ✓ APPROVED
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            )}

            {/* Template Summary Header */}
            {selectedMetaTemplate && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px]">
                      {selectedMetaTemplate.metaTemplateName || selectedMetaTemplate.title}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold">
                      ✓ APPROVED
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                      {selectedMetaTemplate.category || "MARKETING"}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-mono">
                      {selectedMetaTemplate.language || "en_US"}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 leading-relaxed">
                  {selectedMetaTemplate.bodyText}
                </p>
              </div>
            )}
          </div>

          {/* Section 3: Template Configuration & Parameter Mapping Card */}
          {selectedMetaTemplate && (
            <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-2xs space-y-5">
              
              {/* Header Media URL if headerType is IMAGE / VIDEO / DOCUMENT */}
              {["IMAGE", "VIDEO", "DOCUMENT"].includes((selectedMetaTemplate.headerType || "").toUpperCase()) && (
                <div className="space-y-2 p-3.5 bg-slate-50 dark:bg-slate-950/70 rounded-xl border border-slate-200 dark:border-slate-800">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <span>Header {selectedMetaTemplate.headerType} Media URL:</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={metaHeaderMediaUrl}
                      onChange={(e) => setMetaHeaderMediaUrl(e.target.value)}
                      placeholder="Enter public media URL (https://...jpg, .png, .mp4, .pdf)"
                      className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono"
                    />
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept={
                        (selectedMetaTemplate.headerType || "").toUpperCase() === "VIDEO"
                          ? "video/mp4,video/3gpp"
                          : (selectedMetaTemplate.headerType || "").toUpperCase() === "DOCUMENT"
                          ? "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          : "image/jpeg,image/png,image/webp"
                      }
                      onChange={handleFileUpload}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingMedia}
                      className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      {isUploadingMedia ? (
                        <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                      ) : (
                        <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                      <span>{isUploadingMedia ? "Uploading..." : "Upload"}</span>
                    </button>
                  </div>
                  {compressionStats && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                      {compressionStats}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400">
                    Direct HTTPS link to the {selectedMetaTemplate.headerType.toLowerCase()} asset that will appear at the top of the WhatsApp message.
                  </p>
                </div>
              )}

              {/* Dynamic Parameter Mapping Card */}
              {templateVariableTokens.length > 0 ? (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span>Dynamic Parameter Mapping ({templateVariableTokens.length} Tokens)</span>
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Positional parameters map into Meta components
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {templateVariableTokens.map((tok) => {
                      const currentMapping = metaVariableMappings[tok] || (tok === "1" ? "name" : tok === "2" ? "city" : `var${tok}`);
                      const isStatic = currentMapping.startsWith("static:") || currentMapping === "static";
                      const sampleVal = parsedSampleValues[tok] || `Sample ${tok}`;

                      return (
                        <div
                          key={tok}
                          className="p-3 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-mono font-extrabold text-xs">
                                {"{{" + tok + "}}"}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                Sample: <span className="italic font-semibold text-slate-700 dark:text-slate-300">"{sampleVal}"</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-2 flex-1 max-w-sm justify-end">
                              <span className="text-[11px] text-slate-400 font-semibold whitespace-nowrap">Map to:</span>
                              <select
                                value={isStatic ? "static" : currentMapping}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === "static") {
                                    setMetaVariableMappings((prev) => ({ ...prev, [tok]: "static:" }));
                                  } else {
                                    setMetaVariableMappings((prev) => ({ ...prev, [tok]: val }));
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              >
                                <optgroup label="Standard CRM Fields">
                                  <option value="name">Customer Name</option>
                                  <option value="phone">Phone Number</option>
                                  <option value="city">City / Location</option>
                                  <option value="var1">Custom Variable 1</option>
                                  <option value="var2">Custom Variable 2</option>
                                </optgroup>
                                {availableCsvColumns.length > 0 && (
                                  <optgroup label="CSV File Columns">
                                    {availableCsvColumns.map((col) => (
                                      <option key={col} value={col}>
                                        Column: {col}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                                <optgroup label="Custom Static Value">
                                  <option value="static">Static Custom Text</option>
                                </optgroup>
                              </select>
                            </div>
                          </div>

                          {/* Static Text Input if static selected */}
                          {isStatic && (
                            <div className="pt-1">
                              <input
                                type="text"
                                value={metaStaticValues[tok] || currentMapping.replace("static:", "")}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMetaStaticValues((prev) => ({ ...prev, [tok]: val }));
                                  setMetaVariableMappings((prev) => ({ ...prev, [tok]: `static:${val}` }));
                                }}
                                placeholder={`Enter static text for {{${tok}}} (e.g. 20% OFF or Dhaba Opticals)`}
                                className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-500">
                  This template does not require any dynamic body variables. It will be dispatched exactly as written to all recipients.
                </div>
              )}

              {/* Buttons Preview Pill */}
              {parsedMetaButtons.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Interactive Buttons Attached:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {parsedMetaButtons.map((b: any, i: number) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-1.5"
                      >
                        {b.type === "PHONE_NUMBER" ? <PhoneCall className="w-3 h-3" /> : b.type === "URL" ? <ExternalLink className="w-3 h-3" /> : <CornerDownLeft className="w-3 h-3" />}
                        <span>{b.text || b.displayText}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* =========================================================================
            RIGHT PANEL: Live Preview & Launch Campaign (5 cols)
            ========================================================================= */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* 1. Live WhatsApp Message Preview Bubble (Real-Time Media + Text) */}
          <div className="p-4 bg-[#efeae2] dark:bg-[#0b141a] border border-slate-300/80 dark:border-emerald-950 rounded-2xl shadow-inner min-h-[160px] flex flex-col justify-center select-none">
            {!selectedMetaTemplate ? (
              <p className="text-xs text-center text-slate-400 italic">
                Select an approved Meta template to view preview
              </p>
            ) : (() => {
              const isMediaHeader = ["IMAGE", "VIDEO", "DOCUMENT"].includes((selectedMetaTemplate.headerType || "").toUpperCase());
              const headerMedia = metaHeaderMediaUrl.trim() || selectedMetaTemplate.headerContent || selectedMetaTemplate.mediaUrl || "";

              return (
                <div className="max-w-xs ml-auto w-full bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-white p-3 rounded-2xl rounded-tr-xs shadow-xs space-y-2.5">
                  {/* Header */}
                  {selectedMetaTemplate.headerType === "TEXT" && selectedMetaTemplate.headerContent && (
                    <p className="text-xs font-black text-slate-900 dark:text-white pb-1 border-b border-black/5 dark:border-white/10">
                      {selectedMetaTemplate.headerContent}
                    </p>
                  )}

                  {isMediaHeader && (
                    <div className="rounded-xl overflow-hidden bg-black/10 border border-black/10 max-h-52 shadow-2xs">
                      {selectedMetaTemplate.headerType === "VIDEO" ? (
                        <div className="p-4 bg-black/20 flex items-center justify-center gap-2 text-xs font-bold">
                          <Video className="w-5 h-5 text-emerald-600" />
                          <span>Video Header</span>
                        </div>
                      ) : selectedMetaTemplate.headerType === "DOCUMENT" ? (
                        <div className="p-3 bg-white/80 dark:bg-black/30 rounded-lg flex items-center gap-2.5 text-xs font-bold">
                          <FileText className="w-5 h-5 text-red-500 shrink-0" />
                          <span className="truncate">Document Attachment</span>
                        </div>
                      ) : (
                        <img
                          src={headerMedia || "/placeholder-image.jpg"}
                          alt="Template Header"
                          className="w-full h-auto object-cover max-h-52 rounded-lg"
                          onError={(e) => { (e.target as any).style.display = "none"; }}
                        />
                      )}
                    </div>
                  )}

                  {/* Body with substituted parameters */}
                  <p className="text-xs whitespace-pre-line leading-relaxed font-normal px-0.5">
                    {previewResolvedText || selectedMetaTemplate.bodyText}
                  </p>

                  {/* Action Buttons */}
                  {parsedMetaButtons.length > 0 && (
                    <div className="pt-2 space-y-1.5 border-t border-black/5 dark:border-white/10">
                      {parsedMetaButtons.map((btn: any, idx: number) => (
                        <div
                          key={idx}
                          className="w-full py-1.5 px-3 bg-white/90 dark:bg-black/40 rounded-xl text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-600/20 flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          {btn.type === "PHONE_NUMBER" ? (
                            <PhoneCall className="w-3.5 h-3.5" />
                          ) : btn.type === "URL" ? (
                            <ExternalLink className="w-3.5 h-3.5" />
                          ) : (
                            <CornerDownLeft className="w-3.5 h-3.5" />
                          )}
                          <span>{btn.text || btn.displayText || "Button"}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-300 pt-0.5">
                    <span className="font-mono flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-bold">
                      <ShieldCheck className="w-3 h-3" /> Meta Cloud API
                    </span>
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 2. Meta WhatsApp Cloud API Channel Status Card */}
          <div className="bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Meta WhatsApp Cloud API</span>
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold text-[9px] uppercase border border-emerald-300 dark:border-emerald-700">
                Official Channel
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl space-y-1.5 border border-slate-200/60 dark:border-slate-800 text-xs">
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span className="text-[11px]">Dispatch Number:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {wabaConfig?.displayPhoneNumber || "Verified Number"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span className="text-[11px]">Meta Quality Rating:</span>
                <span className="font-bold text-emerald-600">{wabaConfig?.qualityRating || "GREEN (High)"}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span className="text-[11px]">Messaging Tier:</span>
                <span className="font-bold">{wabaConfig?.messagingTier || "1,000 / day"}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span className="text-[11px]">Audience Count:</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">{totalRecipientsCount} Recipients</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <p>• <strong>5 Parallel Async Workers:</strong> Dispatches directly to Meta Graph API v20.0.</p>
              <p>• <strong>Zero Phone Dependency:</strong> Zero phone socket drops, zero WhatsApp Web QR issues.</p>
              <p>• <strong>Live Webhook Tracking:</strong> Real-time status receipts (SENT ➔ DELIVERED ➔ READ).</p>
            </div>
          </div>

          {/* 3. Action Buttons: Launch Broadcast & Schedule */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              disabled={sending || totalRecipientsCount === 0 || !selectedMetaTemplate}
              onClick={() => handleStartCampaign()}
              className="flex-1 py-3.5 px-5 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-extrabold shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Dispatching Broadcast...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Launch Meta Cloud API Broadcast</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(true)}
              className="py-3.5 px-5 rounded-xl bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold shadow-2xs flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              <Calendar className="w-4 h-4" />
              <span>Schedule</span>
            </button>
          </div>

        </div>

      </div>

      {/* =========================================================================
          INSERT COUNTRY CODE MODAL
          ========================================================================= */}
      {isCountryCodeModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#111726] rounded-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 animate-in zoom-in-95">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-600" />
              <span>Insert Country Code</span>
            </h3>
            <p className="text-xs text-slate-500">
              Prepend country code to all 10-digit phone numbers in the paste box:
            </p>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Country Dial Code
              </label>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-sm font-bold text-slate-500">+</span>
                <input
                  type="text"
                  value={countryCodeInput}
                  onChange={(e) => setCountryCodeInput(e.target.value)}
                  placeholder="91"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCountryCodeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInsertCountryCodeToPaste}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs"
              >
                Apply Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          INDUSTRY-GRADE SCHEDULE CAMPAIGN MODAL
          ========================================================================= */}
      {isScheduleModalOpen && (() => {
        const todayStr = new Date().toISOString().split("T")[0];
        const selectedDateTimeObj = new Date(`${scheduledDate}T${scheduledTime || "10:00"}:00`);
        const isValidDate = !isNaN(selectedDateTimeObj.getTime());
        const isPast = isValidDate && selectedDateTimeObj.getTime() < Date.now();

        // Check if selected time is within safe delivery window (10:00 - 19:00)
        const hour = parseInt((scheduledTime || "10:00").split(":")[0], 10);
        const isOptimalHours = hour >= 10 && hour < 19;

        // Quick Preset Helpers
        const applyPreset = (preset: "15m" | "1h" | "tomorrow_10am" | "tomorrow_2pm" | "next_mon_10am") => {
          const now = new Date();
          if (preset === "15m") {
            const d = new Date(now.getTime() + 15 * 60 * 1000);
            setScheduledDate(d.toISOString().split("T")[0]);
            setScheduledTime(d.toTimeString().slice(0, 5));
          } else if (preset === "1h") {
            const d = new Date(now.getTime() + 60 * 60 * 1000);
            setScheduledDate(d.toISOString().split("T")[0]);
            setScheduledTime(d.toTimeString().slice(0, 5));
          } else if (preset === "tomorrow_10am") {
            const d = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            setScheduledDate(d.toISOString().split("T")[0]);
            setScheduledTime("10:00");
          } else if (preset === "tomorrow_2pm") {
            const d = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            setScheduledDate(d.toISOString().split("T")[0]);
            setScheduledTime("14:00");
          } else if (preset === "next_mon_10am") {
            const d = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            while (d.getDay() !== 1) {
              d.setDate(d.getDate() + 1);
            }
            setScheduledDate(d.toISOString().split("T")[0]);
            setScheduledTime("10:00");
          }
        };

        // Formatted date string for preview
        const formattedDateDisplay = isValidDate
          ? selectedDateTimeObj.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "";

        const formattedTimeDisplay = isValidDate
          ? selectedDateTimeObj.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })
          : "";

        // Relative time calculation
        const getRelativeTimeString = () => {
          if (!isValidDate) return "";
          const diffMs = selectedDateTimeObj.getTime() - Date.now();
          if (diffMs <= 0) return "Right now";
          const diffMins = Math.round(diffMs / (1000 * 60));
          if (diffMins < 60) return `in ${diffMins} minutes`;
          const diffHours = Math.floor(diffMins / 60);
          const remMins = diffMins % 60;
          if (diffHours < 24) return `in ${diffHours}h ${remMins}m`;
          const diffDays = Math.floor(diffHours / 24);
          return `in ${diffDays} day${diffDays > 1 ? "s" : ""} (${diffHours % 24}h)`;
        };

        const handleConfirmSchedule = () => {
          if (!isValidDate || isPast) {
            toast.error("Please select a valid future date and time");
            return;
          }
          setIsScheduleModalOpen(false);
          handleStartCampaign(selectedDateTimeObj.toISOString());
        };

        return (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white dark:bg-[#111726] rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95">
              
              {/* Modal Header */}
              <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-xs shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      Schedule Broadcast
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Set automated launch time with smart delivery window pacing
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                
                {/* 1. Quick Presets Bar */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Quick Time Presets
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyPreset("15m")}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-transparent hover:border-emerald-300 dark:hover:border-emerald-700"
                    >
                      ⚡ In 15 Mins
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("1h")}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-transparent hover:border-emerald-300 dark:hover:border-emerald-700"
                    >
                      🕒 In 1 Hour
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("tomorrow_10am")}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-transparent hover:border-emerald-300 dark:hover:border-emerald-700"
                    >
                      🌅 Tomorrow 10:00 AM
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("tomorrow_2pm")}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-transparent hover:border-emerald-300 dark:hover:border-emerald-700"
                    >
                      ☀️ Tomorrow 02:00 PM
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("next_mon_10am")}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer border border-transparent hover:border-emerald-300 dark:hover:border-emerald-700"
                    >
                      📅 Next Mon 10:00 AM
                    </button>
                  </div>
                </div>

                {/* 2. Custom Date & Time Picker */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  
                  {/* Date Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Select Date</span>
                    </label>
                    <input
                      type="date"
                      min={todayStr}
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                    />
                  </div>

                  {/* Time Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Select Time</span>
                    </label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                    />
                  </div>

                </div>

                {/* 3. Delivery Window & Optimal Hours Advisory */}
                <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                  isOptimalHours
                    ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300"
                    : "bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300"
                }`}>
                  {isOptimalHours ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5 text-[11px] leading-relaxed font-medium">
                    {isOptimalHours ? (
                      <p>
                        <strong>✓ Active Business Hours:</strong> This launch time aligns with peak WhatsApp read hours (10:00 AM – 07:00 PM), maximizing conversions and preventing spam flags.
                      </p>
                    ) : (
                      <p>
                        <strong>⚠️ Outside Business Hours:</strong> Sending late at night may cause lower reply rates. The automated delivery window engine may hold dispatch until 10:00 AM next morning for safety.
                      </p>
                    )}
                  </div>
                </div>

                {/* 4. Live Schedule Summary Banner */}
                {isValidDate && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        Target Schedule:
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {getRelativeTimeString()}
                      </span>
                    </div>

                    <div className="text-sm font-black text-slate-900 dark:text-white">
                      {formattedDateDisplay} at {formattedTimeDisplay}
                    </div>

                    <div className="pt-1 flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-slate-800">
                      <span>👥 {totalRecipientsCount} Recipients</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">⚡ Meta Cloud API</span>
                    </div>
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50/80 dark:bg-[#0e1320] border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!isValidDate || isPast || sending}
                  onClick={handleConfirmSchedule}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2"
                >
                  {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm & Schedule Broadcast</span>
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          4-STEP CSV IMPORT WIZARD MODAL
          ========================================================================= */}
      {isWizardOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#111726] rounded-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="px-6 py-4 bg-slate-50/80 dark:bg-[#0e1320] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                    wizardStep > 1 ? "bg-emerald-600 text-white" : "border-2 border-emerald-600 text-emerald-600 font-black"
                  }`}>
                    {wizardStep > 1 ? <Check className="w-3.5 h-3.5" /> : "1"}
                  </span>
                  <span className={wizardStep === 1 ? "font-bold text-slate-900 dark:text-white" : "text-slate-500"}>
                    Upload Excel File
                  </span>
                </div>
                <div className="w-8 h-px bg-slate-300 dark:bg-slate-700" />
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                    wizardStep > 2 ? "bg-emerald-600 text-white" : wizardStep === 2 ? "border-2 border-emerald-600 text-emerald-600 font-black" : "border border-slate-300 text-slate-400"
                  }`}>
                    {wizardStep > 2 ? <Check className="w-3.5 h-3.5" /> : "2"}
                  </span>
                  <span className={wizardStep === 2 ? "font-bold text-slate-900 dark:text-white" : "text-slate-500"}>
                    Select header row
                  </span>
                </div>
                <div className="w-8 h-px bg-slate-300 dark:bg-slate-700" />
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                    wizardStep > 3 ? "bg-emerald-600 text-white" : wizardStep === 3 ? "border-2 border-emerald-600 text-emerald-600 font-black" : "border border-slate-300 text-slate-400"
                  }`}>
                    {wizardStep > 3 ? <Check className="w-3.5 h-3.5" /> : "3"}
                  </span>
                  <span className={wizardStep === 3 ? "font-bold text-slate-900 dark:text-white" : "text-slate-500"}>
                    Match Columns
                  </span>
                </div>
                <div className="w-8 h-px bg-slate-300 dark:bg-slate-700" />
                <div className="flex items-center gap-2">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                    wizardStep === 4 ? "border-2 border-emerald-600 text-emerald-600 font-black" : "border border-slate-300 text-slate-400"
                  }`}>
                    4
                  </span>
                  <span className={wizardStep === 4 ? "font-bold text-slate-900 dark:text-white" : "text-slate-500"}>
                    Validate data
                  </span>
                </div>
              </div>

              <button onClick={() => setIsWizardOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Upload Excel File</h3>
                  <div 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files?.[0]) handleFileDropOrSelect(e.dataTransfer.files[0]);
                    }}
                    className="border-2 border-dashed border-indigo-300 dark:border-indigo-800/60 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 hover:border-emerald-500 transition-colors"
                  >
                    <FileSpreadsheet className="w-12 h-12 text-emerald-600" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Upload .xlsx, .xls or .csv file</p>
                    <label className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer">
                      <span>Select file</span>
                      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFileDropOrSelect(e.target.files[0]); }} />
                    </label>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Select header row</h3>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs text-left">
                      <tbody>
                        {rawSheetData.slice(0, 6).map((row, rIdx) => (
                          <tr 
                            key={rIdx}
                            onClick={() => { setHeaderRowIdx(rIdx); autoDetectColumns(rawSheetData, rIdx); }}
                            className={`cursor-pointer transition-colors ${headerRowIdx === rIdx ? "bg-indigo-50/80 dark:bg-indigo-950/40 font-bold" : "hover:bg-slate-50"}`}
                          >
                            <td className="p-3 w-10 text-center">
                              <input type="radio" name="headerRow" checked={headerRowIdx === rIdx} onChange={() => { setHeaderRowIdx(rIdx); autoDetectColumns(rawSheetData, rIdx); }} />
                            </td>
                            {row.map((cell: any, cIdx: number) => (
                              <td key={cIdx} className="p-3 border-l border-slate-200 dark:border-slate-800 whitespace-nowrap">{String(cell || "")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setWizardStep(1)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600">Back</button>
                    <button onClick={() => setWizardStep(3)} className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">Next: Match Columns</button>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-5">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Match Columns</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 space-y-1.5">
                      <label className="text-xs font-bold text-emerald-800 dark:text-emerald-300">* Phone Number (Mandatory)</label>
                      <select
                        value={columnMapping.phone}
                        onChange={(e) => setColumnMapping({ ...columnMapping, phone: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-emerald-300 rounded-lg text-xs"
                      >
                        <option value={-1}>-- Select Column --</option>
                        {rawSheetData[headerRowIdx]?.map((h: any, idx: number) => (
                          <option key={idx} value={idx}>Column {idx + 1}: {String(h || "")}</option>
                        ))}
                      </select>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Name (Optional)</label>
                      <select
                        value={columnMapping.name}
                        onChange={(e) => setColumnMapping({ ...columnMapping, name: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 rounded-lg text-xs"
                      >
                        <option value={-1}>-- Ignore --</option>
                        {rawSheetData[headerRowIdx]?.map((h: any, idx: number) => (
                          <option key={idx} value={idx}>Column {idx + 1}: {String(h || "")}</option>
                        ))}
                      </select>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">City / Location</label>
                      <select
                        value={columnMapping.city}
                        onChange={(e) => setColumnMapping({ ...columnMapping, city: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 rounded-lg text-xs"
                      >
                        <option value={-1}>-- Ignore --</option>
                        {rawSheetData[headerRowIdx]?.map((h: any, idx: number) => (
                          <option key={idx} value={idx}>Column {idx + 1}: {String(h || "")}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setWizardStep(2)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600">Back</button>
                    <button onClick={processAndValidateData} className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold">Next: Validate</button>
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Validate data</h3>
                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={showOnlyErrors} onChange={(e) => setShowOnlyErrors(e.target.checked)} />
                      <span>Show only rows with errors</span>
                    </label>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-72">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 border-b text-[10px] uppercase font-bold text-slate-500">
                        <tr>
                          <th className="p-3 w-8"><input type="checkbox" checked={validatedRows.every((r) => r.selected)} onChange={(e) => setValidatedRows(validatedRows.map((r) => ({ ...r, selected: e.target.checked })))} /></th>
                          <th className="p-3">NAME</th>
                          <th className="p-3">PHONE</th>
                          <th className="p-3">STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {validatedRows.filter((item) => (showOnlyErrors ? !item.valid : true)).map((item, idx) => (
                          <tr key={idx} className={item.valid ? "" : "bg-rose-50 dark:bg-rose-950/20"}>
                            <td className="p-3"><input type="checkbox" checked={item.selected} onChange={(e) => setValidatedRows(validatedRows.map((r, i) => i === idx ? { ...r, selected: e.target.checked } : r))} /></td>
                            <td className="p-3 font-medium">{item.row.name}</td>
                            <td className="p-3 font-mono font-bold">{item.row.number}</td>
                            <td className="p-3">
                              {item.valid ? <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">Valid</span> : <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">{item.errorMsg}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <button onClick={() => setWizardStep(3)} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600">Back</button>
                    <button onClick={handleConfirmImport} className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold">Confirm</button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
