"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Phone,
  User,
  MapPin,
  Calendar,
  Tag,
  Sparkles,
  Filter,
  Check,
  Loader2,
  Trash2,
  Layers,
  Search,
  Globe,
  Plus
} from "lucide-react";
import { verifyAndFormatPhone } from "@/lib/phone-utils";

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("broadcast_token");
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

const BACKEND_URL = getBackendUrl();

interface SmartContactsImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedRow {
  raw: string[];
  name: string;
  phone: string;
  formattedPhone: string;
  city?: string;
  dob?: string;
  tags?: string[];
  isValid: boolean;
  isFakeOrShort: boolean;
  isDuplicate: boolean;
  validationError?: string;
}

const COMMON_COUNTRY_CODES = [
  { code: "91", label: "+91 (India)", flag: "🇮🇳" },
  { code: "1", label: "+1 (USA/Canada)", flag: "🇺🇸" },
  { code: "44", label: "+44 (UK)", flag: "🇬🇧" },
  { code: "971", label: "+971 (UAE)", flag: "🇦🇪" },
  { code: "62", label: "+62 (Indonesia)", flag: "🇮🇩" },
  { code: "60", label: "+60 (Malaysia)", flag: "🇲🇾" },
  { code: "65", label: "+65 (Singapore)", flag: "🇸🇬" },
  { code: "61", label: "+61 (Australia)", flag: "🇦🇺" },
  { code: "92", label: "+92 (Pakistan)", flag: "🇵🇰" },
  { code: "880", label: "+880 (Bangladesh)", flag: "🇧🇩" },
];

export function SmartContactsImportWizard({
  isOpen,
  onClose,
  onSuccess,
}: SmartContactsImportWizardProps) {
  // Wizard Stage (1: Upload, 2: Map Fields, 3: Preview & Cleanse, 4: Save & Tag)
  const [currentStage, setCurrentStage] = useState<1 | 2 | 3 | 4>(1);

  // System tags fetched from DB
  const [systemSavedTags, setSystemSavedTags] = useState<string[]>(["Lead", "Interested", "Customer", "Lost"]);

  // Stage 1: Upload State
  const [uploadMethod, setUploadMethod] = useState<"FILE" | "PASTE">("FILE");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  // Stage 2: Column Headers & Mapping State
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [detectedReasons, setDetectedReasons] = useState<Record<string, string>>({});

  // Field Mappings (stores index of the CSV column, or -1 if unmapped)
  const [mappingPhone, setMappingPhone] = useState<number>(-1);
  const [mappingName, setMappingName] = useState<number>(-1);
  const [mappingCity, setMappingCity] = useState<number>(-1);
  const [mappingDob, setMappingDob] = useState<number>(-1);
  const [mappingTags, setMappingTags] = useState<number>(-1);

  // Stage 3: Cleansing & Options State
  const [selectedCountryCode, setSelectedCountryCode] = useState("91");
  const [autoAddCountryCode, setAutoAddCountryCode] = useState(true);
  const [filterOutInvalid, setFilterOutInvalid] = useState(true);
  const [filterOutDuplicates, setFilterOutDuplicates] = useState(true);
  const [previewSearchQuery, setPreviewSearchQuery] = useState("");

  // Stage 4: Multi-Tagging & Persistence State
  const [selectedSystemTags, setSelectedSystemTags] = useState<string[]>(["Lead"]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [createAudienceSegment, setCreateAudienceSegment] = useState(false);
  const [audienceSegmentName, setAudienceSegmentName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Fetch real saved system tags from backend
  useEffect(() => {
    async function fetchSystemTags() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/contacts/tags`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json) && json.length > 0) {
            setSystemSavedTags(Array.from(new Set(["Lead", "Interested", "Customer", "Lost", ...json])));
          }
        }
      } catch {}
    }
    fetchSystemTags();
  }, []);

  if (!isOpen) return null;

  // --- STAGE 1: ROBUST XLSX / CSV SPREADSHEET PARSING ---
  const handleFile = async (file: File) => {
    if (!file) return;
    setFileName(file.name);
    setFileSize(`${(file.size / 1024).toFixed(1)} KB`);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        if (!buffer) return;

        // Use SheetJS XLSX to parse ANY format (xlsx, xls, csv, tsv, txt)
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Extract 2D matrix
        const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        if (!matrix || matrix.length === 0) {
          toast.error("The selected file contains no readable data.");
          return;
        }

        // Clean and filter empty rows
        const cleanedRows = matrix
          .map((row) => row.map((cell) => (cell !== null && cell !== undefined ? String(cell).trim() : "")))
          .filter((row) => row.some((cell) => cell.length > 0));

        if (cleanedRows.length === 0) {
          toast.error("No valid non-empty rows found.");
          return;
        }

        processParsedMatrix(cleanedRows);
      } catch (err: any) {
        toast.error(`Failed to parse spreadsheet: ${err.message}`);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const handlePasteText = () => {
    if (!pasteContent.trim()) {
      toast.error("Please paste contact data first.");
      return;
    }

    const lines = pasteContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      toast.error("No content found in pasted text.");
      return;
    }

    const delimiter = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : lines[0].includes("|") ? "|" : ",";
    const matrix = lines.map((line) => line.split(delimiter).map((c) => c.replace(/^[\"'\s]+|[\"'\s]+$/g, "").trim()));

    processParsedMatrix(matrix);
  };

  const processParsedMatrix = (matrix: string[][]) => {
    const firstRow = matrix[0];
    
    // Check if first row is a header row (contains text and isn't predominantly long phone numbers)
    const isFirstRowHeader = firstRow.some((col) => {
      const clean = col.replace(/\D/g, "");
      return /[a-zA-Z]/.test(col) && clean.length < 10;
    });

    let headers: string[] = [];
    let dataRows: string[][] = [];

    if (isFirstRowHeader) {
      headers = firstRow.map((h, i) => h.trim() || `Column ${i + 1}`);
      dataRows = matrix.slice(1);
    } else {
      headers = firstRow.map((_, i) => `Column ${i + 1}`);
      dataRows = matrix;
    }

    setCsvHeaders(headers);
    setRawRows(dataRows);

    // Run Advanced Heuristic & Data Auto-Detection
    runDeepAutoDetection(headers, dataRows);

    setCurrentStage(2);
    toast.success(`Successfully loaded ${dataRows.length} contact rows!`);
  };

  // --- STAGE 2: DEEP AUTO-FIELD DETECTION SYSTEM ---
  const runDeepAutoDetection = (headers: string[], rows: string[][]) => {
    let pIdx = -1;
    let nIdx = -1;
    let cIdx = -1;
    let dIdx = -1;
    let tIdx = -1;

    const reasons: Record<string, string> = {};

    // 1. PHONE DETECTION: Score each column based on header keywords + sample data inspection
    const phoneScores: { idx: number; score: number; reason: string }[] = headers.map((h, idx) => {
      let score = 0;
      let reason = "";
      const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, "");

      // Header keyword matching
      if (["phone", "mobile", "contact", "whatsapp", "cell", "phonenumber", "mobilenumber", "contactno", "mobileno", "phno", "tel"].some((k) => cleanH.includes(k))) {
        score += 80;
        reason = `Header matched "${h}"`;
      } else if (["number", "digits", "ph", "mob"].some((k) => cleanH.includes(k))) {
        score += 40;
        reason = `Header keyword "${h}"`;
      }

      // Sample data inspection (test first 30 rows)
      const sample = rows.slice(0, 30).map((r) => (r[idx] || "").replace(/\D/g, ""));
      const validPhoneCount = sample.filter((digits) => digits.length >= 10 && digits.length <= 15).length;
      const ratio = sample.length > 0 ? validPhoneCount / sample.length : 0;

      if (ratio >= 0.5) {
        score += 100 * ratio;
        reason = reason ? `${reason} + ${Math.round(ratio * 100)}% valid phone rows` : `${Math.round(ratio * 100)}% valid phone numbers`;
      }

      return { idx, score, reason };
    });

    phoneScores.sort((a, b) => b.score - a.score);
    if (phoneScores.length > 0 && phoneScores[0].score > 30) {
      pIdx = phoneScores[0].idx;
      reasons.phone = phoneScores[0].reason;
    }

    // 2. NAME DETECTION
    headers.forEach((h, idx) => {
      if (idx === pIdx) return;
      const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (nIdx === -1) {
        if (["name", "fullname", "customername", "clientname", "patientname", "contactname", "customer", "client", "person", "buyer"].some((k) => cleanH.includes(k))) {
          nIdx = idx;
          reasons.name = `Header matched "${h}"`;
        }
      }
    });

    // 3. CITY / LOCATION DETECTION
    headers.forEach((h, idx) => {
      if (idx === pIdx || idx === nIdx) return;
      const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (cIdx === -1) {
        if (["city", "location", "town", "address", "district", "place", "state", "branch", "outlet"].some((k) => cleanH.includes(k))) {
          cIdx = idx;
          reasons.city = `Header matched "${h}"`;
        }
      }
    });

    // 4. DOB / BIRTHDAY DETECTION
    headers.forEach((h, idx) => {
      if (idx === pIdx || idx === nIdx || idx === cIdx) return;
      const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (dIdx === -1) {
        if (["dob", "birthday", "birthdate", "dateofbirth", "bday", "birth", "anniversary"].some((k) => cleanH.includes(k))) {
          dIdx = idx;
          reasons.dob = `Header matched "${h}"`;
        } else {
          // Check if data matches date format
          const sample = rows.slice(0, 15).map((r) => r[idx] || "");
          const isDate = sample.filter((val) => /\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(val)).length;
          if (isDate >= sample.length * 0.5 && sample.length > 0) {
            dIdx = idx;
            reasons.dob = "Detected Date of Birth format";
          }
        }
      }
    });

    // 5. TAGS DETECTION (From File Columns)
    headers.forEach((h, idx) => {
      if (idx === pIdx || idx === nIdx || idx === cIdx || idx === dIdx) return;
      const cleanH = h.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (tIdx === -1) {
        if (["tag", "tags", "category", "segment", "group", "label", "status", "type"].some((k) => cleanH.includes(k))) {
          tIdx = idx;
          reasons.tags = `Header matched "${h}"`;
        }
      }
    });

    // Fallback for Name if unmapped
    if (nIdx === -1 && pIdx !== -1) {
      nIdx = pIdx === 0 ? 1 : 0;
      if (nIdx >= headers.length) nIdx = -1;
    }

    setMappingPhone(pIdx);
    setMappingName(nIdx);
    setMappingCity(cIdx);
    setMappingDob(dIdx);
    setMappingTags(tIdx);
    setDetectedReasons(reasons);
  };

  // --- STAGE 3: DATA VALIDATION & CLEANSING ENGINE ---
  const isFakeNumber = (digits: string): boolean => {
    if (digits.length < 10) return true;
    const allSame = /^(\d)\1+$/.test(digits);
    if (allSame) return true;
    if (["1234567890", "0123456789", "9876543210", "0000000000", "9999999999"].includes(digits.slice(-10))) return true;
    return false;
  };

  const processedRows: ParsedRow[] = useMemo(() => {
    if (mappingPhone === -1 || rawRows.length === 0) return [];

    const seenPhones = new Set<string>();

    return rawRows.map((cols) => {
      const rawPhone = (cols[mappingPhone] || "").trim();
      const rawName = mappingName !== -1 && cols[mappingName] ? cols[mappingName].trim() : "Customer";
      const rawCity = mappingCity !== -1 && cols[mappingCity] ? cols[mappingCity].trim() : undefined;
      const rawDob = mappingDob !== -1 && cols[mappingDob] ? cols[mappingDob].trim() : undefined;
      const rawTagsStr = mappingTags !== -1 && cols[mappingTags] ? cols[mappingTags].trim() : "";
      
      // Parse real attached tags from mapped CSV column for this specific row
      const parsedTags = rawTagsStr ? rawTagsStr.split(/[,;|]/).map((t) => t.trim()).filter(Boolean) : [];

      let cleanDigits = rawPhone.replace(/\D/g, "");

      // Auto-apply country code prefix if 10 digits
      if (autoAddCountryCode && cleanDigits.length === 10) {
        cleanDigits = selectedCountryCode + cleanDigits;
      } else if (autoAddCountryCode && cleanDigits.length === 11 && cleanDigits.startsWith("0")) {
        cleanDigits = selectedCountryCode + cleanDigits.slice(1);
      }

      const verified = verifyAndFormatPhone(cleanDigits);
      const fakeCheck = isFakeNumber(cleanDigits);
      const isShort = cleanDigits.length < 10;

      let isValid = verified.isValid && !fakeCheck && !isShort;
      let errorMsg: string | undefined = undefined;

      if (isShort) {
        isValid = false;
        errorMsg = `Too short (${cleanDigits.length} digits)`;
      } else if (fakeCheck) {
        isValid = false;
        errorMsg = "Fake/Invalid pattern";
      } else if (!verified.isValid) {
        isValid = false;
        errorMsg = "Invalid mobile format";
      }

      const isDuplicate = seenPhones.has(cleanDigits.slice(-10));
      if (cleanDigits.length >= 10) {
        seenPhones.add(cleanDigits.slice(-10));
      }

      return {
        raw: cols,
        name: rawName || "Customer",
        phone: cleanDigits ? `+${cleanDigits}` : rawPhone,
        formattedPhone: verified.formatted !== "N/A" ? verified.formatted : rawPhone,
        city: rawCity,
        dob: rawDob,
        tags: parsedTags,
        isValid,
        isFakeOrShort: isShort || fakeCheck,
        isDuplicate,
        validationError: errorMsg,
      };
    });
  }, [
    rawRows,
    mappingPhone,
    mappingName,
    mappingCity,
    mappingDob,
    mappingTags,
    autoAddCountryCode,
    selectedCountryCode,
  ]);

  // Filtered rows for Stage 4 import
  const validRowsToImport = useMemo(() => {
    return processedRows.filter((r) => {
      if (filterOutInvalid && !r.isValid) return false;
      if (filterOutDuplicates && r.isDuplicate) return false;
      return true;
    });
  }, [processedRows, filterOutInvalid, filterOutDuplicates]);

  // Statistics Summary
  const stats = useMemo(() => {
    const total = processedRows.length;
    const valid = processedRows.filter((r) => r.isValid && !r.isDuplicate).length;
    const invalid = processedRows.filter((r) => !r.isValid).length;
    const duplicates = processedRows.filter((r) => r.isValid && r.isDuplicate).length;
    return { total, valid, invalid, duplicates };
  }, [processedRows]);

  // Filtered preview table rows by search
  const previewFilteredRows = useMemo(() => {
    if (!previewSearchQuery.trim()) return processedRows;
    const q = previewSearchQuery.toLowerCase();
    return processedRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        (r.city && r.city.toLowerCase().includes(q)) ||
        (r.dob && r.dob.includes(q)) ||
        (r.tags && r.tags.some((t) => t.toLowerCase().includes(q)))
    );
  }, [processedRows, previewSearchQuery]);

  // Toggle system tag selection in Stage 4
  const toggleSystemTag = (tag: string) => {
    setSelectedSystemTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomTag = () => {
    const tag = customTagInput.trim();
    if (!tag) return;
    if (!selectedSystemTags.includes(tag)) {
      setSelectedSystemTags((prev) => [...prev, tag]);
    }
    if (!systemSavedTags.includes(tag)) {
      setSystemSavedTags((prev) => [...prev, tag]);
    }
    setCustomTagInput("");
    toast.success(`Selected tag "${tag}"`);
  };

  // --- STAGE 4: DATABASE PERSISTENCE EXECUTION ---
  const handleFinalImport = async () => {
    if (validRowsToImport.length === 0) {
      toast.error("No valid contacts available to import.");
      return;
    }

    try {
      setIsImporting(true);
      setImportProgress(20);

      const contactsPayload = validRowsToImport.map((r) => {
        // Merge real row tags from file with the selected system/default tags
        const mergedTags = Array.from(new Set([...(r.tags || []), ...selectedSystemTags]));
        return {
          phone: r.phone,
          name: r.name || "Customer",
          city: r.city || undefined,
          dob: r.dob || undefined,
          tags: mergedTags,
        };
      });

      setImportProgress(50);

      const res = await fetch(`${BACKEND_URL}/api/v1/contacts/bulk-upsert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          contacts: contactsPayload,
          createAudienceName: createAudienceSegment && audienceSegmentName.trim() ? audienceSegmentName.trim() : undefined,
        }),
      });

      setImportProgress(90);

      const json = await res.json();
      if (res.ok && json.success) {
        setImportProgress(100);
        toast.success(
          `🎉 Successfully imported ${json.count} contacts to your database!` +
            (stats.invalid > 0 ? ` (${stats.invalid} invalid numbers filtered out)` : "")
        );
        onSuccess();
        onClose();
      } else {
        toast.error(json.message || "Failed to import contacts.");
      }
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const steps = [
    { num: 1, label: "Upload File", icon: Upload },
    { num: 2, label: "Map Columns", icon: Layers },
    { num: 3, label: "Cleanse & Preview", icon: Sparkles },
    { num: 4, label: "Tag & Save", icon: CheckCircle2 },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-6 space-y-5 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* TOP MODAL HEADER WITH 4-STAGE BREADCRUMBS */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 shrink-0">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Smart Contacts Import Wizard
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              4-Stage Excel / CSV ingestion with auto field detection, +91 prefixing, fake number cleansing, and database sync
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 4-STAGE STEPPER PROCESS BAR (EMERALD GREEN THEME) */}
        <div className="grid grid-cols-4 gap-2 shrink-0">
          {steps.map((step) => {
            const StepIcon = step.icon;
            const isActive = currentStage === step.num;
            const isDone = currentStage > step.num;

            return (
              <div
                key={step.num}
                onClick={() => {
                  if (isDone) setCurrentStage(step.num as any);
                }}
                className={`p-2.5 rounded-xl border text-center transition-all flex items-center justify-center gap-2 ${
                  isActive
                    ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold shadow-xs"
                    : isDone
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 cursor-pointer hover:border-emerald-500 font-semibold"
                    : "bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60"
                }`}
              >
                {isDone ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <StepIcon className="w-4 h-4 shrink-0 text-emerald-600" />
                )}
                <span className="text-xs truncate">{step.label}</span>
              </div>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* STAGE 1: FILE INGESTION (XLSX, XLS, CSV, TSV DRAG & DROP / PASTE)         */}
        {/* ========================================================================= */}
        {currentStage === 1 && (
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 max-w-sm">
              <button
                onClick={() => setUploadMethod("FILE")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 ${
                  uploadMethod === "FILE"
                    ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "bg-transparent text-slate-600 dark:text-slate-400"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Upload Excel / CSV</span>
              </button>
              <button
                onClick={() => setUploadMethod("PASTE")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 ${
                  uploadMethod === "PASTE"
                    ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "bg-transparent text-slate-600 dark:text-slate-400"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Paste Text</span>
              </button>
            </div>

            {uploadMethod === "FILE" ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragActive(true);
                }}
                onDragLeave={() => setIsDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragActive(false);
                  if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all space-y-3 ${
                  isDragActive
                    ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40"
                    : fileName
                    ? "border-emerald-500/60 bg-emerald-50/20 dark:bg-emerald-950/20"
                    : "border-slate-300 dark:border-slate-700 hover:border-emerald-500/60 dark:hover:border-emerald-500/60 bg-slate-50/50 dark:bg-slate-950/40"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt,.tsv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFile(e.target.files[0]);
                  }}
                />
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                  <Upload className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-white">
                    {fileName ? `${fileName} (${fileSize})` : "Drag & drop Excel (.xlsx, .xls) or CSV spreadsheet here"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Auto-detects columns: Phone Number, Customer Name, City, DOB, and Tags
                  </p>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-2xs hover:bg-slate-50 pointer-events-none"
                >
                  Browse Excel or CSV File
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Paste contact rows (Name, Phone, City, DOB) or direct numbers:
                </label>
                <textarea
                  rows={8}
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder={`Name, Phone, City, DOB, Tags\nRahul Sharma, 9876543210, Mumbai, 1995-05-12, VIP, Lead\nPriya Patel, +91 81234 56789, Delhi, 1998-11-20, Customer\n918178962366`}
                  className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handlePasteText}
                    disabled={!pasteContent.trim()}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold border-none cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <span>Parse Text</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 2: COLUMN AUTO-DETECTION & FIELD MAPPING (MAP COLUMNS)              */}
        {/* ========================================================================= */}
        {currentStage === 2 && (
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 text-xs">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Clean Column Headers Detected:</strong> We inspected your spreadsheet headers & data. Confirm or adjust the mappings below.
                </span>
              </div>
              <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                {rawRows.length} Rows Ready
              </span>
            </div>

            {/* MAPPING DROPDOWNS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Phone Column (Required) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Phone Number *</span>
                  </label>
                  {mappingPhone !== -1 && (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                      <Check className="w-3 h-3" /> {detectedReasons.phone || "Auto-detected"}
                    </span>
                  )}
                </div>

                <select
                  value={mappingPhone}
                  onChange={(e) => setMappingPhone(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value={-1} disabled>-- Select Phone Column --</option>
                  {csvHeaders.map((header, idx) => (
                    <option key={idx} value={idx}>
                      {header} {rawRows[0]?.[idx] ? `(e.g. ${rawRows[0][idx]})` : "(empty)"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Full Name Column */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Customer Name</span>
                  </label>
                  {mappingName !== -1 && (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                      <Check className="w-3 h-3" /> {detectedReasons.name || "Auto-detected"}
                    </span>
                  )}
                </div>

                <select
                  value={mappingName}
                  onChange={(e) => setMappingName(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value={-1}>-- None (Default: "Customer") --</option>
                  {csvHeaders.map((header, idx) => (
                    <option key={idx} value={idx}>
                      {header} {rawRows[0]?.[idx] ? `(e.g. ${rawRows[0][idx]})` : "(empty)"}
                    </option>
                  ))}
                </select>
              </div>

              {/* City Column */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>City / Location</span>
                  </label>
                  {mappingCity !== -1 && (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                      <Check className="w-3 h-3" /> {detectedReasons.city || "Auto-detected"}
                    </span>
                  )}
                </div>

                <select
                  value={mappingCity}
                  onChange={(e) => setMappingCity(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value={-1}>-- None --</option>
                  {csvHeaders.map((header, idx) => (
                    <option key={idx} value={idx}>
                      {header} {rawRows[0]?.[idx] ? `(e.g. ${rawRows[0][idx]})` : "(empty)"}
                    </option>
                  ))}
                </select>
              </div>

              {/* DOB Column */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Date of Birth (DOB)</span>
                  </label>
                  {mappingDob !== -1 && (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                      <Check className="w-3 h-3" /> {detectedReasons.dob || "Auto-detected"}
                    </span>
                  )}
                </div>

                <select
                  value={mappingDob}
                  onChange={(e) => setMappingDob(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value={-1}>-- None --</option>
                  {csvHeaders.map((header, idx) => (
                    <option key={idx} value={idx}>
                      {header} {rawRows[0]?.[idx] ? `(e.g. ${rawRows[0][idx]})` : "(empty)"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tags Column from File */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    <span>File Column with Tags (Optional, e.g. "VIP, Lead")</span>
                  </label>
                  {mappingTags !== -1 && (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                      <Check className="w-3 h-3" /> {detectedReasons.tags || "Auto-detected"}
                    </span>
                  )}
                </div>

                <select
                  value={mappingTags}
                  onChange={(e) => setMappingTags(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value={-1}>-- None (Tags will be chosen in Stage 4) --</option>
                  {csvHeaders.map((header, idx) => (
                    <option key={idx} value={idx}>
                      {header} {rawRows[0]?.[idx] ? `(e.g. ${rawRows[0][idx]})` : "(empty)"}
                    </option>
                  ))}
                </select>
              </div>

            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setCurrentStage(1)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-none cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                onClick={() => {
                  if (mappingPhone === -1) {
                    toast.error("Please select the Phone Number column.");
                    return;
                  }
                  setCurrentStage(3);
                }}
                disabled={mappingPhone === -1}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold border-none cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <span>Cleanse & Preview</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 3: DATA CLEANSE, +91 PREFIX & RED HIGHLIGHTING PREVIEW              */}
        {/* ========================================================================= */}
        {currentStage === 3 && (
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            
            {/* TOP CONTROLS: COUNTRY CODE PREFIX & FAKE NUMBER FILTER BAR */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                
                {/* Auto Country Code Prefix */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-white">
                    <input
                      type="checkbox"
                      checked={autoAddCountryCode}
                      onChange={(e) => setAutoAddCountryCode(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Auto-Prefix Country Code to 10-digit numbers:</span>
                  </label>

                  <select
                    value={selectedCountryCode}
                    onChange={(e) => setSelectedCountryCode(e.target.value)}
                    disabled={!autoAddCountryCode}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer disabled:opacity-50"
                  >
                    {COMMON_COUNTRY_CODES.map((cc) => (
                      <option key={cc.code} value={cc.code}>
                        {cc.flag} {cc.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter Toggles */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-rose-600 dark:text-rose-400">
                    <input
                      type="checkbox"
                      checked={filterOutInvalid}
                      onChange={(e) => setFilterOutInvalid(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-rose-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Filter out invalid numbers</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-amber-600 dark:text-amber-400">
                    <input
                      type="checkbox"
                      checked={filterOutDuplicates}
                      onChange={(e) => setFilterOutDuplicates(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Deduplicate</span>
                  </label>
                </div>

              </div>

              {/* STATS BADGES */}
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-center">
                <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Rows</span>
                  <span className="text-sm font-extrabold text-slate-800 dark:text-white">{stats.total}</span>
                </div>
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block uppercase">Valid Contacts</span>
                  <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">{stats.valid}</span>
                </div>
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50">
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold block uppercase">Invalid / Fake</span>
                  <span className="text-sm font-extrabold text-rose-700 dark:text-rose-300">{stats.invalid}</span>
                </div>
                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50">
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block uppercase">Duplicates</span>
                  <span className="text-sm font-extrabold text-amber-700 dark:text-amber-300">{stats.duplicates}</span>
                </div>
              </div>
            </div>

            {/* PREVIEW TABLE WITH REAL ATTACHED TAGS & RED HIGHLIGHTING */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-800 dark:text-white">
                  Preview Cleansed Contacts ({validRowsToImport.length} ready to import)
                </span>
                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={previewSearchQuery}
                    onChange={(e) => setPreviewSearchQuery(e.target.value)}
                    placeholder="Search in preview..."
                    className="w-full pl-8 pr-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-950 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Phone Number</th>
                      <th className="py-2 px-3">City</th>
                      <th className="py-2 px-3">DOB</th>
                      <th className="py-2 px-3">Attached Tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {previewFilteredRows.map((r, idx) => (
                      <tr
                        key={idx}
                        className={`transition-colors ${
                          !r.isValid
                            ? "bg-rose-50/80 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200"
                            : r.isDuplicate
                            ? "bg-amber-50/60 dark:bg-amber-950/20"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        }`}
                      >
                        {/* Status Badge */}
                        <td className="py-2 px-3">
                          {r.isValid && !r.isDuplicate ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-extrabold text-[9px] inline-flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" /> Valid
                            </span>
                          ) : !r.isValid ? (
                            <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200 font-extrabold text-[9px] inline-flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" /> {r.validationError || "Invalid"}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-extrabold text-[9px]">
                              Duplicate
                            </span>
                          )}
                        </td>

                        {/* Name */}
                        <td className="py-2 px-3 font-semibold">{r.name}</td>

                        {/* Phone (Highlighted Red if Invalid) */}
                        <td className={`py-2 px-3 font-mono font-bold ${!r.isValid ? "text-rose-600 dark:text-rose-400 underline decoration-rose-400" : ""}`}>
                          {r.phone}
                        </td>

                        {/* City */}
                        <td className="py-2 px-3 text-slate-500">{r.city || "-"}</td>

                        {/* DOB */}
                        <td className="py-2 px-3 text-slate-500 font-mono">{r.dob || "-"}</td>

                        {/* Real Attached Tags */}
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {r.tags && r.tags.length > 0 ? (
                              r.tags.map((t, ti) => (
                                <span key={ti} className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/50 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                                  {t}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 text-[10px] italic">None in file</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setCurrentStage(2)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-none cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Mapping</span>
              </button>

              <button
                onClick={() => setCurrentStage(4)}
                disabled={validRowsToImport.length === 0}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold border-none cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <span>Continue to Tag & Save ({validRowsToImport.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 4: CHOOSE FROM SYSTEM SAVED TAGS & PERSIST (SAVE & TAG)             */}
        {/* ========================================================================= */}
        {currentStage === 4 && (
          <div className="space-y-4 flex-1 overflow-y-auto pr-1">
            
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 space-y-1">
              <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Ready to Import {validRowsToImport.length} Clean Contacts</span>
              </h3>
              <p className="text-xs text-emerald-800 dark:text-emerald-300">
                All numbers have been validated, formatted, and cleansed. Choose from your saved system tags below.
              </p>
            </div>

            {/* Choose From Saved System Tags */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Choose from Saved System Tags:</span>
                </label>
                <span className="text-[10px] text-slate-400 font-semibold">{selectedSystemTags.length} selected</span>
              </div>

              {/* System Tags Pill Selector */}
              <div className="flex items-center gap-2 flex-wrap">
                {systemSavedTags.map((tag) => {
                  const isSelected = selectedSystemTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleSystemTag(tag)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-emerald-500/60"
                      }`}
                    >
                      {isSelected ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3 text-slate-400" />}
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Tag Input */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <input
                  type="text"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddCustomTag();
                  }}
                  placeholder="Add another custom tag..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustomTag}
                  disabled={!customTagInput.trim()}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-700 dark:text-slate-300 text-xs font-bold border-none cursor-pointer transition-all disabled:opacity-40"
                >
                  + Add Tag
                </button>
              </div>
            </div>

            {/* Optional Audience Segment Creation */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-white">
                <input
                  type="checkbox"
                  checked={createAudienceSegment}
                  onChange={(e) => {
                    setCreateAudienceSegment(e.target.checked);
                    if (e.target.checked && !audienceSegmentName) {
                      setAudienceSegmentName(`Imported Segment - ${new Date().toLocaleDateString()}`);
                    }
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-0 cursor-pointer"
                />
                <span>Also create an Audience Segment with these contacts</span>
              </label>

              {createAudienceSegment && (
                <div className="space-y-1 pl-6 animate-in fade-in duration-150">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Audience Segment Name</label>
                  <input
                    type="text"
                    value={audienceSegmentName}
                    onChange={(e) => setAudienceSegmentName(e.target.value)}
                    placeholder="e.g. Festival Eyewear Buyers"
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>

            {/* Progress Bar (Visible while saving) */}
            {isImporting && (
              <div className="space-y-1.5 p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <span>Saving contacts to PostgreSQL database...</span>
                  <span>{importProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setCurrentStage(3)}
                disabled={isImporting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-none cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <button
                onClick={handleFinalImport}
                disabled={isImporting || validRowsToImport.length === 0}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold border-none cursor-pointer flex items-center gap-2 shadow-md disabled:opacity-50"
              >
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Import {validRowsToImport.length} Contacts Now 🚀</span>
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
