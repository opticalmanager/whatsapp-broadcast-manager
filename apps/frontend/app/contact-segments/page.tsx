"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Users,
  Filter,
  Plus,
  Search,
  Send,
  Trash2,
  Edit2,
  Layers,
  Sparkles,
  CheckCircle2,
  Calendar,
  MapPin,
  Tag,
  Phone,
  ArrowRight,
  X,
  Check,
  Loader2,
  Download,
  AlertCircle,
  FileText,
  UserCheck,
  CheckSquare,
  Square,
  Globe,
  MoreVertical,
  ExternalLink,
  ChevronRight,
  Cake,
  Crown,
  Eye,
  CornerDownLeft,
  Smartphone,
  AlertTriangle,
  Building,
  Navigation
} from "lucide-react";
import { verifyAndFormatPhone } from "@/lib/phone-utils";

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("broadcast_token");
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

const BACKEND_URL = getBackendUrl();

interface SegmentItem {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  contactCount: number;
  filterCriteria?: {
    type?: string;
    criteria?: {
      tags?: string[];
      city?: string;
      dobMonth?: number;
      search?: string;
      countryCode?: string;
    };
    tag?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ContactItem {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  city?: string;
  dob?: string;
  tags?: string[];
  addedAt?: string;
}

interface DiscoveredLocation {
  name: string;
  count: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// Clean phone display
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

// Known localities and cities dictionary for smart extraction from addresses
const PROMINENT_LOCATIONS = [
  // Delhi NCR
  "Delhi", "New Delhi", "Rajouri Garden", "Tilak Nagar", "Karol Bagh", "Laxmi Nagar",
  "Najafgarh", "Alipur", "Vivek Vihar", "Kotwali", "Rohini", "Dwarka", "Janakpuri",
  "Pitampura", "Connaught Place", "Saket", "Hauz Khas", "Lajpat Nagar", "Noida", "Gurgaon",
  "Gurugram", "Faridabad", "Ghaziabad",
  // Maharashtra
  "Mumbai", "Navi Mumbai", "Thane", "Andheri", "Bandra", "Borivali", "Dadar", "Pune", "Nagpur", "Nashik", "Aurangabad",
  // Karnataka & South
  "Bangalore", "Bengaluru", "Indiranagar", "Koramangala", "Whitefield", "Jayanagar", "Hyderabad", "Chennai", "Kochi", "Coimbatore",
  // North & West
  "Jaipur", "Udaipur", "Jodhpur", "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Chandigarh", "Ludhiana", "Amritsar",
  "Lucknow", "Kanpur", "Varanasi", "Agra", "Dehradun", "Indore", "Bhopal", "Patna", "Kolkata", "Ranchi", "Bhubaneswar", "Guwahati",
  // Global
  "Dubai", "Abu Dhabi", "Sharjah", "Singapore", "London", "New York"
];

export default function ContactSegmentsPage() {
  const router = useRouter();

  // State
  const [segments, setSegments] = useState<SegmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTypeTab, setFilterTypeTab] = useState<"ALL" | "DYNAMIC" | "MANUAL">("ALL");

  // System available tags, discovered locations, and all contacts
  const [availableTags, setAvailableTags] = useState<string[]>(["Lead", "Interested", "Customer", "Lost", "VIP"]);
  const [discoveredLocations, setDiscoveredLocations] = useState<DiscoveredLocation[]>([]);
  const [allDbContacts, setAllDbContacts] = useState<ContactItem[]>([]);

  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<SegmentItem | null>(null);
  const [viewingMembersSegment, setViewingMembersSegment] = useState<SegmentItem | null>(null);

  // 1. Fetch all segments
  const fetchSegments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BACKEND_URL}/api/v1/audiences`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setSegments(json.data);
        }
      }
    } catch {
      toast.error("Failed to load contact segments.");
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Fetch system metadata & discover real locations from contacts
  const fetchMetadata = async () => {
    try {
      // Tags
      const tagsRes = await fetch(`${BACKEND_URL}/api/v1/contacts/tags`, { headers: getAuthHeaders() });
      if (tagsRes.ok) {
        const tagsJson = await tagsRes.json();
        if (Array.isArray(tagsJson)) {
          setAvailableTags(Array.from(new Set(["Lead", "Interested", "Customer", "Lost", "VIP", ...tagsJson])));
        }
      }

      // Contacts & Locality Discovery
      const contactsRes = await fetch(`${BACKEND_URL}/api/v1/contacts?limit=500`, { headers: getAuthHeaders() });
      if (contactsRes.ok) {
        const cJson = await contactsRes.json();
        if (cJson.success && Array.isArray(cJson.data)) {
          setAllDbContacts(cJson.data);
          
          // Discover real locations present in customer addresses
          const locCounts: Record<string, number> = {};

          cJson.data.forEach((c: any) => {
            if (!c.city) return;
            const raw = c.city.toLowerCase();

            // Match known prominent locations/cities
            PROMINENT_LOCATIONS.forEach((loc) => {
              if (raw.includes(loc.toLowerCase())) {
                locCounts[loc] = (locCounts[loc] || 0) + 1;
              }
            });

            // Also check for raw concise city names
            const cleanParts = c.city.split(/[,;\n\/-]/).map((p: string) => p.trim()).filter(Boolean);
            cleanParts.forEach((part: string) => {
              if (part.length >= 3 && part.length <= 20 && !/\d/.test(part) && !/\b(road|marg|street|block|lane|flat|floor)\b/i.test(part)) {
                const formatted = part.charAt(0).toUpperCase() + part.slice(1);
                if (!locCounts[formatted] && !PROMINENT_LOCATIONS.includes(formatted)) {
                  locCounts[formatted] = (locCounts[formatted] || 0) + 1;
                }
              }
            });
          });

          // Sort by highest contact count
          const sortedLocations: DiscoveredLocation[] = Object.entries(locCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

          setDiscoveredLocations(sortedLocations);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchSegments();
    fetchMetadata();
  }, [fetchSegments]);

  // Delete segment
  const handleDeleteSegment = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete segment "${name}"?`)) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/audiences/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        toast.success(`Segment "${name}" deleted.`);
        fetchSegments();
      } else {
        toast.error("Failed to delete segment.");
      }
    } catch {
      toast.error("Error deleting segment.");
    }
  };

  // Filtered segments list
  const filteredSegments = useMemo(() => {
    return segments.filter((s) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesDesc = s.description && s.description.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc) return false;
      }

      // Tab filter
      const isDynamic = s.filterCriteria?.type === "DYNAMIC_FILTER" || !!s.filterCriteria?.criteria;
      if (filterTypeTab === "DYNAMIC" && !isDynamic) return false;
      if (filterTypeTab === "MANUAL" && isDynamic) return false;

      return true;
    });
  }, [segments, searchQuery, filterTypeTab]);

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] max-w-full overflow-hidden bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:p-6 space-y-4">
      
      {/* 1. TOP HEADER & SUMMARY BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              Contact Segments
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
              {segments.length} Segments
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Build dynamic smart filters or custom audience lists to dispatch targeted WhatsApp campaigns
          </p>
        </div>

        {/* Primary CTA */}
        <button
          onClick={() => {
            setEditingSegment(null);
            setIsCreateModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold border-none cursor-pointer flex items-center gap-2 shadow-sm transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Contact Segment</span>
        </button>
      </div>

      {/* 2. CONTROLS BAR: SEARCH & TABS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs shrink-0">
        
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search segments..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setFilterTypeTab("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${
              filterTypeTab === "ALL"
                ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                : "bg-transparent text-slate-600 dark:text-slate-400"
            }`}
          >
            All ({segments.length})
          </button>
          <button
            onClick={() => setFilterTypeTab("DYNAMIC")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1 ${
              filterTypeTab === "DYNAMIC"
                ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                : "bg-transparent text-slate-600 dark:text-slate-400"
            }`}
          >
            <Sparkles className="w-3 h-3 text-emerald-600" />
            <span>Smart Dynamic</span>
          </button>
          <button
            onClick={() => setFilterTypeTab("MANUAL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1 ${
              filterTypeTab === "MANUAL"
                ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs"
                : "bg-transparent text-slate-600 dark:text-slate-400"
            }`}
          >
            <Users className="w-3 h-3 text-slate-500" />
            <span>Custom Lists</span>
          </button>
        </div>

      </div>

      {/* 3. SEGMENTS GRID */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-xs font-medium">Loading contact segments...</p>
          </div>
        ) : filteredSegments.length === 0 ? (
          <div className="h-80 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center text-center p-8 space-y-4 bg-white/50 dark:bg-slate-900/50">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Filter className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">No contact segments found</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                {searchQuery || filterTypeTab !== "ALL"
                  ? "No segments match your active search or filters."
                  : "Create your first segment using smart filters, tags, or contact lists to start sending targeted broadcasts."}
              </p>
            </div>
            <button
              onClick={() => {
                setEditingSegment(null);
                setIsCreateModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold border-none cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Segment</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSegments.map((segment) => {
              const isDynamic = segment.filterCriteria?.type === "DYNAMIC_FILTER" || !!segment.filterCriteria?.criteria;
              const criteria = segment.filterCriteria?.criteria;
              const tagFallback = segment.filterCriteria?.tag;

              return (
                <div
                  key={segment.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4.5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                >
                  {/* Top: Icon, Name, Type Badge */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shadow-2xs ${
                          isDynamic
                            ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                            : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50"
                        }`}>
                          {isDynamic ? <Sparkles className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                            {segment.name}
                          </h3>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            Created {new Date(segment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Type Badge */}
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                        isDynamic
                          ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}>
                        {isDynamic ? "⚡ Smart Filter" : "📋 Custom List"}
                      </span>
                    </div>

                    {/* Description */}
                    {segment.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {segment.description}
                      </p>
                    )}

                    {/* Criteria Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {criteria?.tags && criteria.tags.length > 0 && (
                        criteria.tags.map((t) => (
                          <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 text-[10px] font-bold">
                            <Tag className="w-2.5 h-2.5 text-emerald-600" />
                            <span>{t}</span>
                          </span>
                        ))
                      )}

                      {tagFallback && !criteria?.tags && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 text-[10px] font-bold">
                          <Tag className="w-2.5 h-2.5 text-emerald-600" />
                          <span>{tagFallback}</span>
                        </span>
                      )}

                      {criteria?.city && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 text-[10px] font-bold">
                          <MapPin className="w-2.5 h-2.5 text-blue-600" />
                          <span>{criteria.city}</span>
                        </span>
                      )}

                      {criteria?.dobMonth && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 text-[10px] font-bold">
                          <Cake className="w-2.5 h-2.5 text-amber-600" />
                          <span>Birthday in {MONTH_NAMES[criteria.dobMonth - 1]}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Contact Count Stat */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Contacts</span>
                    <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                      {segment.contactCount}
                    </span>
                  </div>

                  {/* Bottom Actions */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    
                    {/* View Members */}
                    <button
                      onClick={() => setViewingMembersSegment(segment)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold border-none cursor-pointer flex items-center gap-1 transition-colors"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Members</span>
                    </button>

                    {/* Launch Campaign */}
                    <button
                      onClick={() => router.push(`/send-message?audience=${segment.id}`)}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold border-none cursor-pointer flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Send className="w-3 h-3" />
                      <span>Launch Campaign</span>
                    </button>

                    {/* Edit & Delete */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingSegment(segment);
                          setIsCreateModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 border-none bg-transparent cursor-pointer transition-colors"
                        title="Edit Segment"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSegment(segment.id, segment.name)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 border-none bg-transparent cursor-pointer transition-colors"
                        title="Delete Segment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. CREATE / EDIT SEGMENT MODAL */}
      {isCreateModalOpen && (
        <CreateSegmentModal
          isOpen={isCreateModalOpen}
          initialData={editingSegment}
          availableTags={availableTags}
          discoveredLocations={discoveredLocations}
          allContacts={allDbContacts}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingSegment(null);
          }}
          onSuccess={() => {
            fetchSegments();
            fetchMetadata();
          }}
        />
      )}

      {/* 5. SLIDE-OVER MEMBERS DRAWER */}
      {viewingMembersSegment && (
        <SegmentMembersDrawer
          segment={viewingMembersSegment}
          onClose={() => setViewingMembersSegment(null)}
        />
      )}

    </div>
  );
}

/* ========================================================================= */
/* COMPONENT: INTERACTIVE PHONE CHIPS BUTTON INPUT (BULK & LIVE)             */
/* ========================================================================= */
interface PhoneChipItem {
  id: string;
  raw: string;
  formatted: string;
  isValid: boolean;
}

function PhoneChipsInput({
  chips,
  onChange,
}: {
  chips: PhoneChipItem[];
  onChange: (chips: PhoneChipItem[]) => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Helper to add numbers
  const addNumbers = (rawText: string) => {
    if (!rawText.trim()) return;

    const tokens = rawText
      .split(/[,;\n\t\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const newChips: PhoneChipItem[] = [];
    const seen = new Set(chips.map((c) => c.formatted));

    for (const tok of tokens) {
      let cleanDigits = tok.replace(/\D/g, "");
      if (cleanDigits.length === 10) cleanDigits = "91" + cleanDigits;
      if (cleanDigits.length === 11 && cleanDigits.startsWith("0")) cleanDigits = "91" + cleanDigits.slice(1);

      const verified = verifyAndFormatPhone(cleanDigits);
      const formatted = verified.formatted !== "N/A" ? verified.formatted : `+${cleanDigits || tok}`;

      if (!seen.has(formatted)) {
        seen.add(formatted);
        newChips.push({
          id: "chip_" + Math.random().toString(36).slice(2, 9),
          raw: tok,
          formatted,
          isValid: verified.isValid && cleanDigits.length >= 10,
        });
      }
    }

    if (newChips.length > 0) {
      onChange([...chips, ...newChips]);
    }
    setInputValue("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cleanDigits = val.replace(/\D/g, "");
    if (
      (cleanDigits.length === 10 && !val.includes(",")) ||
      (cleanDigits.length === 12 && cleanDigits.startsWith("91") && !val.includes(","))
    ) {
      addNumbers(val);
      return;
    }
    setInputValue(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " " || e.key === "Tab") {
      e.preventDefault();
      addNumbers(inputValue);
    } else if (e.key === "Backspace" && inputValue === "" && chips.length > 0) {
      onChange(chips.slice(0, -1));
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    if (pasted) {
      addNumbers(pasted);
      toast.success("Pasted numbers converted into button chips!");
    }
  };

  const removeChip = (id: string) => {
    onChange(chips.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-2">
      <div
        onClick={() => inputRef.current?.focus()}
        className="min-h-[7rem] max-h-48 overflow-y-auto p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2 cursor-text focus-within:border-emerald-500 transition-all shadow-inner"
      >
        {chips.map((chip) => (
          <div
            key={chip.id}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold shadow-2xs transition-all animate-in zoom-in-95 duration-150 ${
              chip.isValid
                ? "bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700"
                : "bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800"
            }`}
          >
            {chip.isValid ? (
              <Check className="w-3 h-3 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
            )}
            <span>{chip.formatted}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeChip(chip.id);
              }}
              className="w-4 h-4 rounded-full hover:bg-slate-300 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-800 border-none bg-transparent cursor-pointer ml-1"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {/* Live Input */}
        <div className="inline-flex items-center gap-1.5 flex-1 min-w-[12rem]">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={chips.length === 0 ? "Type 10-digit number or paste bulk numbers..." : "Type or paste next number..."}
            className="w-full bg-transparent text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none py-1"
          />
          {inputValue.trim() && (
            <button
              type="button"
              onClick={() => addNumbers(inputValue)}
              className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold border-none cursor-pointer flex items-center gap-1 shrink-0 shadow-xs"
            >
              <span>Add</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Chips Count & Clear Button */}
      {chips.length > 0 && (
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            <strong>{chips.length}</strong> numbers entered (
            <span className="text-emerald-600 font-bold">
              {chips.filter((c) => c.isValid).length} valid
            </span>
            {chips.some((c) => !c.isValid) && (
              <span className="text-rose-600 font-bold ml-1">
                , {chips.filter((c) => !c.isValid).length} invalid
              </span>
            )}
            )
          </span>
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[11px] font-bold text-slate-400 hover:text-rose-600 bg-transparent border-none cursor-pointer transition-colors"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}

/* ========================================================================= */
/* COMPONENT: CREATE / EDIT CONTACT SEGMENT MODAL (WITH SUBMIT MUTEX)        */
/* ========================================================================= */
function CreateSegmentModal({
  isOpen,
  initialData,
  availableTags,
  discoveredLocations,
  allContacts,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  initialData: SegmentItem | null;
  availableTags: string[];
  discoveredLocations: DiscoveredLocation[];
  allContacts: ContactItem[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [creationMode, setCreationMode] = useState<"SMART_FILTER" | "MANUAL_SELECT" | "PASTE_NUMBERS">("SMART_FILTER");

  // General fields
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [saving, setSaving] = useState(false);
  const isSubmittingRef = useRef(false); // Mutex protection against multi-clicks

  // Mode 1: Smart Filter State
  const [selectedTags, setSelectedTags] = useState<string[]>(
    initialData?.filterCriteria?.criteria?.tags || (initialData?.filterCriteria?.tag ? [initialData.filterCriteria.tag] : [])
  );
  const [selectedLocation, setSelectedLocation] = useState(initialData?.filterCriteria?.criteria?.city || "");
  const [customLocationInput, setCustomLocationInput] = useState("");
  const [selectedDobMonth, setSelectedDobMonth] = useState<number | 0>(initialData?.filterCriteria?.criteria?.dobMonth || 0);
  const [filterKeyword, setFilterKeyword] = useState(initialData?.filterCriteria?.criteria?.search || "");
  const [tagSearchQuery, setTagSearchQuery] = useState("");

  // Live filter preview count state
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewSamples, setPreviewSamples] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Mode 2: Manual Selection State
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [contactSearchQuery, setContactSearchQuery] = useState("");

  // Mode 3: Paste Numbers (Button Chips State)
  const [phoneChips, setPhoneChips] = useState<PhoneChipItem[]>([]);

  // Effective location filter value
  const effectiveLocation = selectedLocation === "CUSTOM" ? customLocationInput : selectedLocation;

  // Live filter preview debounce fetch
  useEffect(() => {
    if (creationMode !== "SMART_FILTER") return;

    const timer = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        const res = await fetch(`${BACKEND_URL}/api/v1/audiences/preview`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            filterCriteria: {
              tags: selectedTags.length > 0 ? selectedTags : undefined,
              city: effectiveLocation.trim() || undefined,
              dobMonth: selectedDobMonth > 0 ? selectedDobMonth : undefined,
              search: filterKeyword.trim() || undefined,
            },
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setPreviewCount(json.count);
            setPreviewSamples(json.sampleContacts || []);
          }
        }
      } catch {
      } finally {
        setPreviewLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [creationMode, selectedTags, effectiveLocation, selectedDobMonth, filterKeyword]);

  // Mode 2: Filter database contacts for manual selection
  const filteredDbContacts = useMemo(() => {
    if (!contactSearchQuery.trim()) return allContacts;
    const q = contactSearchQuery.toLowerCase();
    return allContacts.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        c.phone.includes(q) ||
        (c.city && c.city.toLowerCase().includes(q))
    );
  }, [allContacts, contactSearchQuery]);

  // Tags filtered by search in Mode 1
  const filteredTags = useMemo(() => {
    if (!tagSearchQuery.trim()) return availableTags;
    return availableTags.filter((t) => t.toLowerCase().includes(tagSearchQuery.toLowerCase()));
  }, [availableTags, tagSearchQuery]);

  const handleToggleSelectAllContacts = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedContactIds(new Set(filteredDbContacts.map((c) => c.id)));
    } else {
      setSelectedContactIds(new Set());
    }
  };

  const handleToggleContactOne = (id: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Submit Handler with strict Mutex Protection
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || isSubmittingRef.current) return;

    if (!name.trim()) {
      toast.error("Please enter a segment name.");
      return;
    }

    try {
      isSubmittingRef.current = true;
      setSaving(true);

      let payload: any = {
        name: name.trim(),
        description: description.trim() || undefined,
      };

      if (creationMode === "SMART_FILTER") {
        payload.type = "DYNAMIC_FILTER";
        payload.filterCriteria = {
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          city: effectiveLocation.trim() || undefined,
          dobMonth: selectedDobMonth > 0 ? selectedDobMonth : undefined,
          search: filterKeyword.trim() || undefined,
        };
      } else if (creationMode === "MANUAL_SELECT") {
        if (selectedContactIds.size === 0) {
          toast.error("Please select at least 1 contact.");
          isSubmittingRef.current = false;
          setSaving(false);
          return;
        }
        payload.type = "MANUAL_SELECT";
        payload.contactIds = Array.from(selectedContactIds);
      } else if (creationMode === "PASTE_NUMBERS") {
        const validList = phoneChips.filter((c) => c.isValid).map((c) => ({ phone: c.formatted, name: "Customer" }));
        if (validList.length === 0) {
          toast.error("Please add at least 1 valid 10-digit mobile number.");
          isSubmittingRef.current = false;
          setSaving(false);
          return;
        }
        payload.type = "PASTED_NUMBERS";
        payload.pastedContacts = validList;
      }

      const url = initialData ? `${BACKEND_URL}/api/v1/audiences/${initialData.id}` : `${BACKEND_URL}/api/v1/audiences`;
      const method = initialData ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast.success(initialData ? "Segment updated successfully!" : "Segment created successfully!");
        onSuccess();
        onClose();
      } else {
        toast.error(json.message || "Failed to save segment.");
      }
    } catch {
      toast.error("Error saving segment.");
    } finally {
      isSubmittingRef.current = false;
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full p-6 space-y-5 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {initialData ? "Edit Contact Segment" : "Create New Contact Segment"}
              </h2>
              <p className="text-xs text-slate-500">
                Segment your audience for personalized campaign broadcasts
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Mode Selection Tabs */}
        {!initialData && (
          <div className="grid grid-cols-3 gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setCreationMode("SMART_FILTER")}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                creationMode === "SMART_FILTER"
                  ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-300 font-bold shadow-xs"
                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold">Smart Filter</span>
              </div>
              <p className="text-[10px] text-slate-500 font-normal">Tags, City/Places, DOB</p>
            </button>

            <button
              type="button"
              onClick={() => setCreationMode("MANUAL_SELECT")}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                creationMode === "MANUAL_SELECT"
                  ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-300 font-bold shadow-xs"
                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Users className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold">Select Contacts</span>
              </div>
              <p className="text-[10px] text-slate-500 font-normal">Pick from DB Contacts</p>
            </button>

            <button
              type="button"
              onClick={() => setCreationMode("PASTE_NUMBERS")}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                creationMode === "PASTE_NUMBERS"
                  ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-300 font-bold shadow-xs"
                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold">Paste Numbers</span>
              </div>
              <p className="text-[10px] text-slate-500 font-normal">Interactive button chips</p>
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto pr-1">
          
          {/* Segment Name & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Segment Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Delhi VIP Buyers, July Birthdays"
                required
                disabled={saving}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 font-bold disabled:opacity-50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Description (Optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. High-value progressive lens clients"
                disabled={saving}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
              />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* MODE 1: SMART DYNAMIC FILTER                                              */}
          {/* ========================================================================= */}
          {creationMode === "SMART_FILTER" && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3.5">
              
              {/* Live Matching Counter Box */}
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {previewLoading ? "Calculating matching contacts..." : `${previewCount !== null ? previewCount : allContacts.length} Contacts match this filter`}
                  </span>
                </div>

                {previewLoading && <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />}
              </div>

              {/* Filter 1: User-Created Tags Card Grid Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Filter by User-Created Tags ({selectedTags.length} active):</span>
                  </label>

                  {/* Search within tags */}
                  {availableTags.length > 5 && (
                    <div className="relative w-36">
                      <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1.5" />
                      <input
                        type="text"
                        value={tagSearchQuery}
                        onChange={(e) => setTagSearchQuery(e.target.value)}
                        placeholder="Search tags..."
                        className="w-full pl-6 pr-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Card-style Tags Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1">
                  {filteredTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setSelectedTags((prev) =>
                            isSelected ? prev.filter((t) => t !== tag) : [...prev, tag]
                          );
                        }}
                        className={`p-2 rounded-xl text-xs font-bold transition-all border text-left cursor-pointer flex items-center justify-between gap-1 ${
                          isSelected
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-emerald-500/60"
                        }`}
                      >
                        <span className="truncate">{tag}</span>
                        {isSelected ? (
                          <Check className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <Plus className="w-3 h-3 text-slate-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filter 2: Real Discovered Locality & DOB Month */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-200 dark:border-slate-800">
                
                {/* Discovered Locality / City Selector */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Filter by City / Places (From Contacts)</span>
                  </label>
                  
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="">-- All Locations & Cities --</option>
                    {discoveredLocations.map((loc) => (
                      <option key={loc.name} value={loc.name}>
                        📍 {loc.name} ({loc.count} contact{loc.count > 1 ? "s" : ""})
                      </option>
                    ))}
                    <option value="CUSTOM">✏️ Type Custom City / Area...</option>
                  </select>

                  {selectedLocation === "CUSTOM" && (
                    <input
                      type="text"
                      value={customLocationInput}
                      onChange={(e) => setCustomLocationInput(e.target.value)}
                      placeholder="Type city, locality, or state name..."
                      className="w-full mt-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500 text-xs text-slate-900 dark:text-white focus:outline-none animate-in fade-in duration-150"
                    />
                  )}
                </div>

                {/* Birthday / DOB Month */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Cake className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Filter by Birthday Month</span>
                  </label>
                  <select
                    value={selectedDobMonth}
                    onChange={(e) => setSelectedDobMonth(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value={0}>-- Any Month --</option>
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={idx} value={idx + 1}>
                        🎂 {m}
                      </option>
                    ))}
                  </select>
                </div>

              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* MODE 2: MANUAL SELECTION FROM DATABASE CONTACTS                           */}
          {/* ========================================================================= */}
          {creationMode === "MANUAL_SELECT" && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-white">
                  {selectedContactIds.size} Contacts Selected
                </span>
                <div className="relative w-48">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={contactSearchQuery}
                    onChange={(e) => setContactSearchQuery(e.target.value)}
                    placeholder="Search contacts..."
                    className="w-full pl-8 pr-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-950 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={selectedContactIds.size === filteredDbContacts.length && filteredDbContacts.length > 0}
                          onChange={handleToggleSelectAllContacts}
                          className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Phone</th>
                      <th className="py-2 px-3">City / Address</th>
                      <th className="py-2 px-3">Tags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredDbContacts.map((c) => {
                      const isChecked = selectedContactIds.has(c.id);
                      return (
                        <tr
                          key={c.id}
                          onClick={() => handleToggleContactOne(c.id)}
                          className={`cursor-pointer transition-colors ${
                            isChecked ? "bg-emerald-50/60 dark:bg-emerald-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          }`}
                        >
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="py-2 px-3 font-semibold">{c.name || "Customer"}</td>
                          <td className="py-2 px-3 font-mono">{formatPhoneDisplay(c.phone)}</td>
                          <td className="py-2 px-3 text-slate-500 truncate max-w-xs">{c.city || "-"}</td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1 flex-wrap">
                              {(c.tags || []).slice(0, 2).map((t) => (
                                <span key={t} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-bold">
                                  {t}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODE 3: PASTE NUMBERS WITH INTERACTIVE BUTTON CHIPS                       */}
          {/* ========================================================================= */}
          {creationMode === "PASTE_NUMBERS" && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Enter or Paste Phone Numbers (Interactive Button Chips)</span>
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Type a 10-digit number or press Enter / comma / space, or paste 50+ numbers in bulk to convert them into interactive button chips.
                </p>
              </div>

              <PhoneChipsInput chips={phoneChips} onChange={setPhoneChips} />
            </div>
          )}

          {/* Bottom Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-none cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold border-none cursor-pointer flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Segment...</span>
                </>
              ) : (
                <span>{initialData ? "Update Segment" : "Create Segment 🚀"}</span>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* COMPONENT: SEGMENT MEMBERS SLIDE-OVER DRAWER                              */
/* ========================================================================= */
function SegmentMembersDrawer({
  segment,
  onClose,
}: {
  segment: SegmentItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const [members, setMembers] = useState<ContactItem[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("limit", "500");
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetch(`${BACKEND_URL}/api/v1/audiences/${segment.id}/contacts?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.contacts)) {
          setMembers(json.contacts);
          setTotalMembers(json.total || json.contacts.length);
        }
      }
    } catch {
      toast.error("Failed to load segment members.");
    } finally {
      setLoading(false);
    }
  }, [segment.id, searchQuery]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Export CSV
  const handleExportCSV = () => {
    if (members.length === 0) return;
    const header = "Name,Phone,City,DOB,Tags\n";
    const rows = members
      .map(
        (m) =>
          `"${m.name || "Customer"}","${m.phone}","${m.city || ""}","${m.dob || ""}","${(m.tags || []).join("; ")}"`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Segment_${segment.name.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully!");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full p-6 flex flex-col justify-between space-y-4 shadow-2xl animate-in slide-in-from-right duration-300">
        
        {/* Top Header */}
        <div className="space-y-3 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {segment.name} ({totalMembers})
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search & Export CSV */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search segment members..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              onClick={handleExportCSV}
              disabled={members.length === 0}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Table of Members */}
        <div className="flex-1 min-h-0 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
              <span className="text-xs">Loading members...</span>
            </div>
          ) : members.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No member contacts found</p>
              <p className="text-[11px] text-slate-400">This segment has no active matching contacts.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-950 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">City / Address</th>
                  <th className="py-2.5 px-3">Tags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                      {m.name || "Customer"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                      {formatPhoneDisplay(m.phone)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 truncate max-w-xs">
                      {m.city || m.dob ? (
                        <div className="space-y-0.5">
                          {m.city && <div>{m.city}</div>}
                          {m.dob && <div className="font-mono text-[10px]">{m.dob}</div>}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {(m.tags || []).map((t) => (
                          <span key={t} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[9px] font-bold">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Bottom Campaign CTA */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-none cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={() => router.push(`/send-message?audience=${segment.id}`)}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold border-none cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Launch Campaign to this Segment</span>
          </button>
        </div>

      </div>
    </div>
  );
}
