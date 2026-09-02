"use client";

import React, { useState, useEffect } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import { Search, UserPlus, X, Loader2, Plus, Check, Phone, MapPin, Tag } from "lucide-react";
import { toast } from "sonner";
import { verifyAndFormatPhone } from "@/lib/phone-utils";

export interface CustomerContact {
  id: string;
  name: string;
  phone: string;
  city?: string;
  tag?: string;
  isCustom?: boolean;
}

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCustomer: (customer: CustomerContact) => void;
}

export function AddCustomerModal({ isOpen, onClose, onAddCustomer }: AddCustomerModalProps) {
  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CustomerContact[]>([]);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // Quick Add Form State
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [tag, setTag] = useState("");

  // Handle Search Input Change
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const backendUrl = getBackendUrl();
        const sessionRes = await fetch("/api/session");
        const sessionData = await sessionRes.json();
        const sessionToken = sessionData.authenticated ? JSON.stringify(sessionData.session) : "";

        const res = await fetch(`${backendUrl}/api/v1/audience/fetch-crm-recipients`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
          },
          body: JSON.stringify({ tag: searchQuery.trim() }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            const mapped = json.data
              .filter((c: any) =>
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.phone.includes(searchQuery)
              )
              .map((c: any) => ({
                id: c.id || `crm-${c.phone}`,
                name: c.name,
                phone: verifyAndFormatPhone(c.phone).formatted,
                city: c.city || "Main Outlet",
                tag: Array.isArray(c.tags) ? c.tags.join(", ") : "CRM Customer",
              }));
            setSearchResults(mapped);
          }
        }
      } catch (err) {
        console.error("[AddCustomerModal] Search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!isOpen) return null;

  const handleSelectSearchResult = (customer: CustomerContact) => {
    onAddCustomer(customer);
    setAddedIds((prev) => new Set(prev).add(customer.id));
    toast.success(`Added "${customer.name}" to audience!`);
  };

  const handlePhoneChange = (val: string) => {
    // Keep digits and optional leading plus
    const cleaned = val.replace(/[^0-9+]/g, "");
    setPhone(cleaned);
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) {
      toast.error("Please provide both Full Name and Phone Number.");
      return;
    }

    const verified = verifyAndFormatPhone(phone);
    if (!verified.isValid) {
      toast.error("Invalid phone number format. Please enter a valid 10-digit mobile number.");
      return;
    }

    const newCustomer: CustomerContact = {
      id: `custom-${Date.now()}`,
      name: fullName.trim(),
      phone: verified.formatted,
      city: city.trim() || "Manual Add",
      tag: tag.trim() || "Custom Added",
      isCustom: true,
    };

    onAddCustomer(newCustomer);
    toast.success(`Added "${newCustomer.name}" (${verified.formatted}) to audience!`);

    // Reset Form
    setFullName("");
    setPhone("");
    setCity("");
    setTag("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full p-5 space-y-5 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Add or Search Customer</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Search CRM contacts or add custom numbers to this audience</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors border-none cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* SECTION 1: SEARCH CRM DATABASE */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 uppercase tracking-wider">
            <Search className="w-3.5 h-3.5 text-indigo-500" />
            Search Existing CRM Database
          </label>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by customer name or phone number..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
            {isSearching && (
              <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin absolute right-3 top-3" />
            )}
          </div>

          {/* Search Results Container */}
          {searchQuery.trim() !== "" && (
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 max-h-44 overflow-y-auto space-y-1">
              {searchResults.length > 0 ? (
                searchResults.map((cust) => {
                  const isAdded = addedIds.has(cust.id);
                  return (
                    <div
                      key={cust.id}
                      className="p-2 rounded-lg bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <p className="font-bold text-slate-900 dark:text-white">{cust.name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          {cust.phone} • {cust.city}
                        </p>
                      </div>

                      <button
                        disabled={isAdded}
                        onClick={() => handleSelectSearchResult(cust)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                          isAdded
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 cursor-default"
                            : "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-600"
                        }`}
                      >
                        {isAdded ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        <span>{isAdded ? "Added" : "Add to Audience"}</span>
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-xs text-slate-400 py-3">
                  {isSearching ? "Searching CRM database..." : "No matching CRM customers found."}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="relative border-t border-slate-100 dark:border-slate-800 pt-3">
          <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 bg-white dark:bg-slate-900 text-[10px] uppercase font-bold text-slate-400">
            or quick add custom contact
          </span>
        </div>

        {/* SECTION 2: QUICK ADD FORM */}
        <form onSubmit={handleQuickAddSubmit} className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Full Name *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Phone Number (Digits only, e.g. 9876543210) *
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="e.g. 9876543210 (Auto-applies +91)"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              {phone.trim() && (
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                  Preview: {verifyAndFormatPhone(phone).formatted}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">City Outlet (Optional)</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Narsapur"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tag / Category (Optional)</label>
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="e.g. VIP Frame Buyer"
                className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold border-none cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all border-none cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Customer to Audience</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
