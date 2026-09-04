"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import { toast } from "sonner";
import {
  List,
  LayoutGrid,
  Search,
  Plus,
  Tag,
  Upload,
  UserPlus,
  Trash2,
  Edit2,
  X,
  Check,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  Loader2,
  Phone,
  MapPin,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
  CheckSquare,
  Square,
  MoreVertical,
  CheckCircle2
} from "lucide-react";
import { verifyAndFormatPhone } from "@/lib/phone-utils";
import { SmartContactsImportWizard } from "@/components/audience/SmartContactsImportWizard";

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("broadcast_token");
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

const BACKEND_URL = getBackendUrl();

interface Contact {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  city?: string;
  dob?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  serialNumber?: number;
}

export function normalizeTags(rawTags: any): string[] {
  if (!rawTags) return [];
  if (Array.isArray(rawTags)) return rawTags.filter(Boolean).map(String);
  if (typeof rawTags === "string") {
    try {
      const parsed = JSON.parse(rawTags);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
      if (typeof parsed === "string") return [parsed];
    } catch {}
    const clean = rawTags.replace(/^\{|\}$/g, "");
    return clean.split(/[,;|]/).map((t: string) => t.trim().replace(/^"|"$/g, "")).filter(Boolean);
  }
  return [];
}

const AVATAR_COLORS = [
  "bg-[#16a34a]", // Emerald Green
  "bg-[#0f766e]", // Teal
  "bg-[#2563eb]", // Blue
  "bg-[#ea580c]", // Orange
  "bg-[#0891b2]", // Cyan
  "bg-[#800020]", // Maroon
  "bg-[#4f46e5]", // Indigo
  "bg-[#ca8a04]", // Olive Yellow
];

function getAvatarColor(phone: string): string {
  let hash = 0;
  for (let i = 0; i < phone.length; i++) {
    hash = phone.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getCountryCode(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  if (clean.startsWith("91") && clean.length >= 12) return "91";
  if (clean.startsWith("62") && clean.length >= 11) return "62";
  if (clean.startsWith("20") && clean.length >= 11) return "20";
  if (clean.startsWith("55") && clean.length >= 11) return "55";
  if (clean.startsWith("1") && clean.length >= 11) return "1";
  if (clean.startsWith("44") && clean.length >= 11) return "44";
  if (clean.startsWith("971") && clean.length >= 12) return "97";
  if (clean.startsWith("92") && clean.length >= 12) return "92";
  if (clean.length === 10) return "91";
  return clean.slice(0, 2) || "91";
}

function formatPhoneDisplay(rawPhone: string): string {
  if (!rawPhone) return "";
  const clean = rawPhone.replace(/\D/g, "");
  if (clean.length === 12 && clean.startsWith("91")) {
    return `+91 ${clean.slice(2, 7)} ${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return `+${clean}`;
}

export default function ContactsManagerPage() {
  // Main State
  const [viewMode, setViewMode] = useState<"LIST" | "KANBAN">("LIST");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [availableTags, setAvailableTags] = useState<string[]>(["Lead", "Interested", "Customer", "Lost"]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilterTag, setSelectedFilterTag] = useState("ALL");

  // Selection state for Bulk Tagging & Deleting
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());

  // New Tag Input on Header
  const [newTagInput, setNewTagInput] = useState("");

  // Inline tag adder state
  const [addingTagContactId, setAddingTagContactId] = useState<string | null>(null);
  const [inlineTagInput, setInlineTagInput] = useState("");

  // Modals State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Drag-and-drop state for Kanban
  const [draggedContactId, setDraggedContactId] = useState<string | null>(null);

  // 1. Fetch Tags
  const fetchTags = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/contacts/tags`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) {
          setAvailableTags(Array.from(new Set(["Lead", "Interested", "Customer", "Lost", ...json])));
        }
      }
    } catch {}
  };

  // 2. Fetch Contacts List
  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("limit", "500");
      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      if (selectedFilterTag && selectedFilterTag !== "ALL") params.append("tag", selectedFilterTag);

      const res = await fetch(`${BACKEND_URL}/api/v1/contacts?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const cleanContacts = json.data.map((c: any) => ({
            ...c,
            tags: normalizeTags(c.tags),
          }));
          setContacts(cleanContacts);
          setTotalContacts(json.total || cleanContacts.length);
        }
      }
    } catch (err) {
      toast.error("Failed to load contacts.");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedFilterTag]);

  useEffect(() => {
    fetchTags();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchContacts();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchContacts]);

  // Handle Select All Checkbox
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(contacts.map((c) => c.id));
      setSelectedContactIds(allIds);
    } else {
      setSelectedContactIds(new Set());
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Create Tag Action
  const handleCreateTag = async () => {
    const tag = newTagInput.trim();
    if (!tag) {
      toast.error("Please enter a tag name.");
      return;
    }

    if (!availableTags.includes(tag)) {
      setAvailableTags((prev) => [...prev, tag]);
    }

    // If contacts are currently selected, apply this tag to all selected!
    if (selectedContactIds.size > 0) {
      try {
        const res = await fetch(`${BACKEND_URL}/api/v1/contacts/bulk-tag`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            contactIds: Array.from(selectedContactIds),
            tag,
          }),
        });
        if (res.ok) {
          toast.success(`Applied tag "${tag}" to ${selectedContactIds.size} selected contact(s)!`);
          setSelectedContactIds(new Set());
          fetchContacts();
        }
      } catch {
        toast.error("Failed to apply tag.");
      }
    } else {
      toast.success(`Created tag "${tag}". Check contacts to apply it!`);
    }

    setNewTagInput("");
  };

  // Bulk Apply Selected Tag from Floating Bar
  const handleBulkApplyTag = async (tagToApply: string) => {
    if (!tagToApply || selectedContactIds.size === 0) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/contacts/bulk-tag`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          contactIds: Array.from(selectedContactIds),
          tag: tagToApply,
        }),
      });
      if (res.ok) {
        toast.success(`Applied tag "${tagToApply}" to ${selectedContactIds.size} contact(s)!`);
        setSelectedContactIds(new Set());
        fetchContacts();
        fetchTags();
      }
    } catch {
      toast.error("Failed to apply tag.");
    }
  };

  // Add Inline Tag to Single Contact
  const handleAddInlineTag = async (contactId: string) => {
    const tag = inlineTagInput.trim();
    if (!tag) {
      setAddingTagContactId(null);
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/contacts/bulk-tag`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          contactIds: [contactId],
          tag,
        }),
      });
      if (res.ok) {
        toast.success(`Added tag "${tag}".`);
        setInlineTagInput("");
        setAddingTagContactId(null);
        fetchContacts();
        fetchTags();
      }
    } catch {
      toast.error("Failed to add tag.");
    }
  };

  // Bulk Delete Contacts
  const handleBulkDelete = async () => {
    if (selectedContactIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedContactIds.size} contact(s)?`)) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/contacts/bulk-delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          contactIds: Array.from(selectedContactIds),
        }),
      });
      if (res.ok) {
        toast.success(`Deleted ${selectedContactIds.size} contact(s).`);
        setSelectedContactIds(new Set());
        fetchContacts();
      }
    } catch {
      toast.error("Failed to delete contacts.");
    }
  };

  // Single Delete Contact
  const handleDeleteContact = async (id: string, name?: string) => {
    if (!confirm(`Delete contact "${name || "Customer"}"?`)) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/contacts/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        toast.success("Contact deleted.");
        fetchContacts();
      }
    } catch {
      toast.error("Failed to delete contact.");
    }
  };

  // Remove Tag from Contact
  const handleRemoveTag = async (contactId: string, tagToRemove: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/contacts/bulk-remove-tag`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          contactIds: [contactId],
          tag: tagToRemove,
        }),
      });
      if (res.ok) {
        toast.success(`Removed tag "${tagToRemove}".`);
        fetchContacts();
      }
    } catch {}
  };

  // Kanban Drag-and-Drop Handlers
  const handleDragStart = (e: React.DragEvent, contactId: string) => {
    setDraggedContactId(contactId);
    e.dataTransfer.setData("text/plain", contactId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetColumnTag: string) => {
    e.preventDefault();
    const contactId = e.dataTransfer.getData("text/plain") || draggedContactId;
    if (!contactId) return;

    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;

    const currentTags = normalizeTags(contact.tags);
    const oldTag = currentTags[0] || "Untagged";
    if (oldTag === targetColumnTag) return;

    // Optimistic UI update
    setContacts((prev) =>
      prev.map((c) => {
        if (c.id === contactId) {
          const filtered = normalizeTags(c.tags).filter((t) => t !== oldTag);
          return {
            ...c,
            tags: targetColumnTag === "Untagged" ? filtered : Array.from(new Set([...filtered, targetColumnTag])),
          };
        }
        return c;
      })
    );

    toast.success(`Moved "${contact.name || formatPhoneDisplay(contact.phone)}" to ${targetColumnTag}!`);

    try {
      await fetch(`${BACKEND_URL}/api/v1/contacts/${contactId}/tag`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          newTag: targetColumnTag,
          oldTag,
        }),
      });
      fetchTags();
    } catch {
      toast.error("Failed to update contact tag in database.");
      fetchContacts();
    } finally {
      setDraggedContactId(null);
    }
  };

  // Group contacts by Kanban columns safely with normalizeTags
  const kanbanColumns = useMemo(() => {
    const defaultCols = ["Lead", "Interested", "Customer", "Lost"];
    const customCols = availableTags.filter((t) => !defaultCols.includes(t) && t !== "Untagged");
    const allCols = [...defaultCols, ...customCols, "Untagged"];

    const map: Record<string, Contact[]> = {};
    allCols.forEach((col) => {
      map[col] = [];
    });

    contacts.forEach((c) => {
      const tagsList = normalizeTags(c.tags);
      if (tagsList.length === 0) {
        map["Untagged"].push({ ...c, tags: [] });
      } else {
        tagsList.forEach((tag) => {
          if (!map[tag]) {
            map[tag] = [];
            if (!allCols.includes(tag)) {
              allCols.splice(allCols.length - 1, 0, tag);
            }
          }
          map[tag].push({ ...c, tags: tagsList });
        });
      }
    });

    return { allCols, map };
  }, [contacts, availableTags]);

  const getTagDotColor = (tag: string) => {
    switch (tag.toLowerCase()) {
      case "lead":
        return "bg-blue-500";
      case "interested":
        return "bg-amber-500";
      case "customer":
        return "bg-emerald-500";
      case "lost":
        return "bg-slate-400";
      case "untagged":
        return "bg-slate-300 dark:bg-slate-700";
      default:
        return "bg-emerald-600";
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] max-w-full overflow-hidden bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 space-y-4">
      
      {/* 1. TOP HEADER BAR: TITLE & LIST/KANBAN TOGGLE SWITCH */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Contacts
          </h1>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
            {totalContacts}
          </span>
        </div>

        {/* LIST / KANBAN TOGGLE (Matching Screenshot media_1788223299001.png) */}
        <div className="flex items-center p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <button
            onClick={() => setViewMode("LIST")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border-none ${
              viewMode === "LIST"
                ? "bg-[#dcfce7] text-[#15803d] shadow-xs"
                : "bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>List</span>
          </button>
          <button
            onClick={() => setViewMode("KANBAN")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border-none ${
              viewMode === "KANBAN"
                ? "bg-[#dcfce7] text-[#15803d] shadow-xs"
                : "bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Kanban</span>
          </button>
        </div>
      </div>

      {/* 2. CONTROLS BAR: SEARCH, TAG FILTER, IMPORT, ADD, & CREATE TAG */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs shrink-0">
        
        {/* Left Side: Search & Filter by tag */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 min-w-0">
          
          {/* Search Box */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or number..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Filter by Tag Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">Filter by tag:</span>
            <div className="relative">
              <select
                value={selectedFilterTag}
                onChange={(e) => setSelectedFilterTag(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">All tags</option>
                {availableTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Right Side: Import, Add Contact, & Create Tag */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800/50 cursor-pointer flex items-center gap-1.5 transition-all shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Import CSV / Excel</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-1.5 transition-all"
          >
            <UserPlus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Add Contact</span>
          </button>

          {/* New Tag Input + Create Tag Button (Matching Screenshot media_1788223299001.png) */}
          <div className="flex items-center gap-1.5 pl-2 sm:border-l border-slate-200 dark:border-slate-800">
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateTag();
              }}
              placeholder="New tag..."
              className="w-28 sm:w-32 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleCreateTag}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-1 shadow-2xs transition-all shrink-0"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Create tag</span>
            </button>
          </div>

        </div>
      </div>

      {/* 3. BULK SELECTION ACTION FLOATING BANNER */}
      {selectedContactIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 bg-emerald-700 text-white px-4 py-2.5 rounded-2xl shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 shrink-0">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4" />
            <span className="text-xs font-bold">{selectedContactIds.size} contact(s) selected</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-emerald-800/80 px-2.5 py-1 rounded-xl">
              <span className="text-[11px] font-medium">Apply Tag:</span>
              <select
                onChange={(e) => {
                  if (e.target.value) handleBulkApplyTag(e.target.value);
                }}
                defaultValue=""
                className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="" disabled className="text-slate-900">Select tag...</option>
                {availableTags.map((tag) => (
                  <option key={tag} value={tag} className="text-slate-900">{tag}</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleBulkDelete}
              className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>

            <button
              onClick={() => setSelectedContactIds(new Set())}
              className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold border-none cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* 4. MAIN VIEW AREA (LIST VIEW vs KANBAN VIEW) */}
      <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col">
        
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-xs font-medium">Loading contacts database...</p>
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <UserPlus className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">No contacts found</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                {searchQuery || selectedFilterTag !== "ALL"
                  ? "Try clearing your filters or search terms."
                  : "Import your customer Excel / CSV or add your first contact to get started."}
              </p>
            </div>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold border-none cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
            >
              <Upload className="w-4 h-4" />
              <span>Import Contacts Spreadsheet</span>
            </button>
          </div>
        ) : viewMode === "LIST" ? (
          
          /* ========================================================= */
          /* LIST VIEW: EXACTLY AS IN SCREENSHOT media_1788223299001.png */
          /* ========================================================= */
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 z-10">
                <tr className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedContactIds.size === contacts.length && contacts.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3 w-14 text-center">#</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">City</th>
                  <th className="py-3 px-4">DOB</th>
                  <th className="py-3 px-4">Tags</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {contacts.map((c, index) => {
                  const countryCode = getCountryCode(c.phone);
                  const avatarColor = getAvatarColor(c.phone);
                  const isChecked = selectedContactIds.has(c.id);
                  const contactTags = normalizeTags(c.tags);
                  const sNo = c.serialNumber != null ? c.serialNumber : index + 1;

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        isChecked ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectOne(c.id)}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Serial Number */}
                      <td className="py-3 px-3 text-center">
                        <span className="font-mono font-bold text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60">
                          #{sNo}
                        </span>
                      </td>

                      {/* Name with Country Code Circle Badge */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${avatarColor} text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 shadow-2xs`}>
                            {countryCode}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {c.name || "Customer"}
                            </span>
                            {c.email && (
                              <span className="text-[10px] text-slate-400 block">{c.email}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {formatPhoneDisplay(c.phone)}
                      </td>

                      {/* City */}
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {c.city ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{c.city}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* DOB */}
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {c.dob ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{c.dob}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Tags (Multi-Tag Support) */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {contactTags.length > 0 ? (
                            contactTags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-[10px] group"
                              >
                                <Tag className="w-2.5 h-2.5 text-slate-400" />
                                <span>{tag}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveTag(c.id, tag);
                                  }}
                                  className="w-3 h-3 rounded-full hover:bg-slate-300 dark:hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-slate-700 border-none cursor-pointer ml-0.5"
                                  title="Remove tag"
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">No tags</span>
                          )}

                          {/* Quick Inline Tag Adder */}
                          {addingTagContactId === c.id ? (
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="text"
                                value={inlineTagInput}
                                onChange={(e) => setInlineTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleAddInlineTag(c.id);
                                  if (e.key === "Escape") setAddingTagContactId(null);
                                }}
                                placeholder="Tag..."
                                autoFocus
                                className="w-16 px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-emerald-500 text-[10px] focus:outline-none"
                              />
                              <button
                                onClick={() => handleAddInlineTag(c.id)}
                                className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold border-none cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setAddingTagContactId(c.id);
                                setInlineTagInput("");
                              }}
                              className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-600 text-slate-400 border border-slate-200 dark:border-slate-700 text-[10px] font-bold cursor-pointer transition-colors"
                              title="Add another tag"
                            >
                              + Tag
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingContact(c)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors border-none cursor-pointer"
                            title="Edit Contact"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteContact(c.id, c.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors border-none cursor-pointer"
                            title="Delete Contact"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (

          /* ============================================================= */
          /* KANBAN VIEW: EXACTLY AS IN SCREENSHOT media_1788223658716.png */
          /* ============================================================= */
          <div className="flex-1 overflow-x-auto p-4 flex items-start gap-4">
            {kanbanColumns.allCols.map((colName) => {
              const colContacts = kanbanColumns.map[colName] || [];
              const dotColor = getTagDotColor(colName);

              return (
                <div
                  key={colName}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, colName)}
                  className="w-72 shrink-0 bg-slate-50/90 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col max-h-full overflow-hidden shadow-2xs"
                >
                  {/* Column Header */}
                  <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                      <h3 className="text-xs font-bold text-slate-800 dark:text-white capitalize">
                        {colName}
                      </h3>
                    </div>
                    <span className="text-xs font-bold font-mono text-slate-400">
                      {colContacts.length}
                    </span>
                  </div>

                  {/* Column Cards Container */}
                  <div className="p-3 overflow-y-auto space-y-2.5 flex-1 min-h-[16rem]">
                    {colContacts.length === 0 ? (
                      <div className="h-40 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center text-center p-4">
                        <p className="text-[11px] text-slate-400 font-medium">Drop contacts here</p>
                      </div>
                    ) : (
                      colContacts.map((c) => {
                        const countryCode = getCountryCode(c.phone);
                        const avatarColor = getAvatarColor(c.phone);
                        const contactTags = normalizeTags(c.tags);

                        return (
                          <div
                            key={c.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, c.id)}
                            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing space-y-2 group"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-7 h-7 rounded-full ${avatarColor} text-white font-black text-[10px] flex items-center justify-center shrink-0`}>
                                  {countryCode}
                                </div>
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {c.serialNumber ? <span className="font-mono text-[10px] text-slate-400 mr-1.5 font-bold">#{c.serialNumber}</span> : null}
                                  {c.name || "Customer"}
                                </h4>
                              </div>

                              <button
                                onClick={() => setEditingContact(c)}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white border-none bg-transparent cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>

                            <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{formatPhoneDisplay(c.phone)}</span>
                            </div>

                            {/* Tags Chips in Kanban */}
                            {contactTags.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                {contactTags.map((t, ti) => (
                                  <span key={ti} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-bold text-slate-600 dark:text-slate-300">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}

                            {(c.city || c.dob) && (
                              <div className="flex items-center gap-3 text-[10px] text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-1.5">
                                {c.city && (
                                  <span className="flex items-center gap-1 truncate">
                                    <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                    <span>{c.city}</span>
                                  </span>
                                )}
                                {c.dob && (
                                  <span className="flex items-center gap-1 truncate font-mono">
                                    <Calendar className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                    <span>{c.dob}</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. 4-STAGE SMART CONTACTS IMPORT WIZARD */}
      {isImportModalOpen && (
        <SmartContactsImportWizard
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            fetchContacts();
            fetchTags();
          }}
        />
      )}

      {/* 6. ADD SINGLE CONTACT MODAL */}
      {isAddModalOpen && (
        <AddSingleContactModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          availableTags={availableTags}
          onSuccess={() => {
            fetchContacts();
            fetchTags();
          }}
        />
      )}

      {/* 7. EDIT CONTACT MODAL */}
      {editingContact && (
        <EditContactModal
          contact={editingContact}
          availableTags={availableTags}
          onClose={() => setEditingContact(null)}
          onSuccess={() => {
            fetchContacts();
            fetchTags();
          }}
        />
      )}

    </div>
  );
}

/* ========================================================================= */
/* COMPONENT: ADD SINGLE CONTACT MODAL                                       */
/* ========================================================================= */
function AddSingleContactModal({
  isOpen,
  onClose,
  availableTags,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  availableTags: string[];
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [tagsInput, setTagsInput] = useState("Lead");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast.error("Phone number is required.");
      return;
    }

    const verified = verifyAndFormatPhone(phone);
    if (!verified.isValid) {
      toast.error("Please enter a valid 10-15 digit mobile number.");
      return;
    }

    const parsedTags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);

    try {
      setSaving(true);
      const res = await fetch(`${BACKEND_URL}/api/v1/contacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          phone: verified.formatted,
          name: name.trim() || "Customer",
          city: city.trim() || undefined,
          dob: dob.trim() || undefined,
          email: email.trim() || undefined,
          tags: parsedTags.length > 0 ? parsedTags : ["Lead"],
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success("Contact saved successfully!");
        onSuccess();
        onClose();
      } else {
        toast.error(json.message || "Failed to save contact.");
      }
    } catch {
      toast.error("Error saving contact.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Add New Contact</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Gaurav Sharma"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Phone Number *</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 81789 62366 or 9876543210"
              required
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Delhi, Mumbai"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Date of Birth (DOB)</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tags (Supports multiple, comma-separated)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. Lead, VIP, Designer Frames"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-none cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold border-none cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Contact</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* COMPONENT: EDIT CONTACT MODAL                                             */
/* ========================================================================= */
function EditContactModal({
  contact,
  availableTags,
  onClose,
  onSuccess,
}: {
  contact: Contact;
  availableTags: string[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(contact.name || "");
  const [phone, setPhone] = useState(contact.phone || "");
  const [city, setCity] = useState(contact.city || "");
  const [dob, setDob] = useState(contact.dob || "");
  const [email, setEmail] = useState(contact.email || "");
  const [tagsInput, setTagsInput] = useState(normalizeTags(contact.tags).join(", "));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const tagsList = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      const res = await fetch(`${BACKEND_URL}/api/v1/contacts/${contact.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          city: city.trim() || undefined,
          dob: dob.trim() || undefined,
          email: email.trim() || undefined,
          tags: tagsList,
        }),
      });

      if (res.ok) {
        toast.success("Contact updated successfully!");
        onSuccess();
        onClose();
      } else {
        toast.error("Failed to update contact.");
      }
    } catch {
      toast.error("Error updating contact.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Edit Contact</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">DOB</label>
              <input
                type="text"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tags (comma-separated, multi-tag)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. Lead, VIP, Progressive Lens"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-none cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold border-none cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Update Contact</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
