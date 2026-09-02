"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Save, 
  Send, 
  Zap, 
  ShieldCheck, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Building2, 
  PieChart,
  Wifi,
  Filter,
  UserPlus,
  Users,
  Trash2,
  CheckSquare,
  Square,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  PhoneCall
} from "lucide-react";
import { toast } from "sonner";
import { AddCustomerModal, CustomerContact } from "@/components/audience/AddCustomerModal";
import { verifyAndFormatPhone } from "@/lib/phone-utils";

interface ShopOutlet {
  id: string;
  name: string;
  phone?: string;
  city?: string;
}

export default function NotionAudienceBuilderPage() {
  const router = useRouter();

  // Dynamic Stores & User Session State
  const [storeOutlets, setStoreOutlets] = useState<ShopOutlet[]>([]);
  const [sessionShopName, setSessionShopName] = useState("Main Outlet");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Blank Slate Initial State with Light Placeholders
  const [audienceName, setAudienceName] = useState("");
  const [audienceDescription, setAudienceDescription] = useState("");
  const [refreshMode, setRefreshMode] = useState<"DYNAMIC" | "STATIC">("DYNAMIC");

  // Multi-Store Chips (Default to "ALL" selected)
  const [selectedStores, setSelectedStores] = useState<string[]>(["ALL"]);

  // Filters (Start Empty)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedCustomerTypes, setSelectedCustomerTypes] = useState<string[]>([]);
  const [prescriptionStatus, setPrescriptionStatus] = useState<string[]>([]);

  // Spending Range Slider
  const [minSpend, setMinSpend] = useState(0);
  const [maxAge, setMaxAge] = useState(70);

  // Custom Added & Real CRM Customers List
  const [customCustomers, setCustomCustomers] = useState<CustomerContact[]>([]);
  const [realCrmCustomers, setRealCrmCustomers] = useState<CustomerContact[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [loadingCrm, setLoadingCrm] = useState(false);

  // Section Accordion Toggle State
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    products: true,
    customerType: true,
    prescription: true,
    spending: true,
  });

  // Fetch real user session & real store outlets dynamically from CRM Backend API
  useEffect(() => {
    async function initSessionAndShops() {
      try {
        const sessionRes = await fetch("/api/session");
        const sessionData = await sessionRes.json();
        const backendUrl = getBackendUrl();

        let sessionToken = "";
        if (sessionData.authenticated && sessionData.session) {
          sessionToken = JSON.stringify(sessionData.session);
          if (sessionData.session.shopName) {
            setSessionShopName(sessionData.session.shopName);
          }
        }

        // 1. Fetch Real Shops from DB
        const res = await fetch(`${backendUrl}/api/v1/audience/shops`, {
          headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {},
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            setStoreOutlets(json.data);
            if (json.data[0]?.name) {
              setSessionShopName(json.data[0].name);
            }
          }
        }

        // 2. Fetch Real CRM Customers from DB
        setLoadingCrm(true);
        const crmRes = await fetch(`${backendUrl}/api/v1/audience/fetch-crm-recipients`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
          },
          body: JSON.stringify({}),
        });

        if (crmRes.ok) {
          const crmJson = await crmRes.json();
          if (crmJson.success && Array.isArray(crmJson.data)) {
            const mapped = crmJson.data.map((c: any) => ({
              id: c.id,
              name: c.name,
              phone: verifyAndFormatPhone(c.phone).formatted,
              city: c.city || c.shopName || "Main Outlet",
              tag: Array.isArray(c.tags) ? c.tags.join(", ") : "VIP, Frames, Progressive Lens",
            }));
            setRealCrmCustomers(mapped);
          }
        }
      } catch (err) {
        console.error("[AudienceBuilder] Error initializing session/shops:", err);
      } finally {
        setLoadingCrm(false);
      }
    }

    initSessionAndShops();
  }, []);

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleStore = (storeId: string) => {
    if (storeId === "ALL") {
      setSelectedStores(selectedStores.includes("ALL") ? [] : ["ALL"]);
    } else {
      const current = selectedStores.filter((s) => s !== "ALL");
      if (current.includes(storeId)) {
        const next = current.filter((s) => s !== storeId);
        setSelectedStores(next);
      } else {
        setSelectedStores([...current, storeId]);
      }
    }
  };

  const toggleItem = (list: string[], item: string, setter: (val: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter((i) => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  // Add custom customer from modal
  const handleAddCustomCustomer = (newCustomer: CustomerContact) => {
    const formattedCustomer = {
      ...newCustomer,
      phone: verifyAndFormatPhone(newCustomer.phone).formatted,
    };
    setCustomCustomers((prev) => [formattedCustomer, ...prev.filter((c) => c.id !== newCustomer.id)]);
    setSelectedCustomerIds((prev) => new Set(prev).add(newCustomer.id));
  };

  // Remove customer from table
  const handleRemoveCustomer = (customerId: string) => {
    setCustomCustomers((prev) => prev.filter((c) => c.id !== customerId));
    setRealCrmCustomers((prev) => prev.filter((c) => c.id !== customerId));
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      next.delete(customerId);
      return next;
    });
  };

  // AUTO-LOAD ALL REAL CRM CUSTOMERS BY DEFAULT
  const displayCustomers = useMemo(() => {
    const list: CustomerContact[] = [...customCustomers];

    realCrmCustomers.forEach((rc) => {
      let matches = true;

      if (selectedProducts.length > 0) {
        const custTagStr = (rc.tag || "").toLowerCase();
        const hasProductMatch = selectedProducts.some((p) => {
          const pLower = p.toLowerCase();
          if (pLower.includes("frame")) return custTagStr.includes("frame");
          if (pLower.includes("sunglass")) return custTagStr.includes("sunglass");
          if (pLower.includes("contact")) return custTagStr.includes("contact");
          if (pLower.includes("lens")) return custTagStr.includes("lens");
          if (pLower.includes("progressive")) return custTagStr.includes("progressive");
          if (pLower.includes("blue")) return custTagStr.includes("blue");
          return custTagStr.includes(pLower);
        });
        if (!hasProductMatch) matches = false;
      }

      if (selectedCustomerTypes.length > 0) {
        const custTagStr = (rc.tag || "").toLowerCase();
        const hasTypeMatch = selectedCustomerTypes.some((t) => custTagStr.includes(t.toLowerCase()));
        if (!hasTypeMatch) matches = false;
      }

      if (matches && !list.some((c) => c.id === rc.id)) {
        list.push(rc);
      }
    });

    return list;
  }, [customCustomers, realCrmCustomers, selectedProducts, selectedCustomerTypes]);

  // Sync selection automatically on filter/display changes (ALL CHECKED BY DEFAULT)
  useEffect(() => {
    if (displayCustomers.length > 0) {
      setSelectedCustomerIds(new Set(displayCustomers.map((c) => c.id)));
    } else {
      setSelectedCustomerIds(new Set());
    }
  }, [displayCustomers]);

  // Master Checkbox Select / Deselect All
  const isAllSelected = displayCustomers.length > 0 && selectedCustomerIds.size === displayCustomers.length;
  
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedCustomerIds(new Set());
    } else {
      setSelectedCustomerIds(new Set(displayCustomers.map((c) => c.id)));
    }
  };

  const handleToggleRow = (id: string) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Final Target Contacts Count (STRICTLY SELECTED CHECKBOXES COUNT)
  const selectedCustomersList = useMemo(() => {
    return displayCustomers.filter((c) => selectedCustomerIds.has(c.id));
  }, [displayCustomers, selectedCustomerIds]);

  const calculatedCount = selectedCustomersList.length;

  // VERIFIED VS DEFECTIVE PHONE NUMBERS METRICS FOR RIGHT SIDE CARD
  const phoneMetrics = useMemo(() => {
    let verifiedCount = 0;
    let defectiveCount = 0;

    selectedCustomersList.forEach((c) => {
      const v = verifyAndFormatPhone(c.phone);
      if (v.isValid) {
        verifiedCount++;
      } else {
        defectiveCount++;
      }
    });

    const total = selectedCustomersList.length;
    const verifiedPercent = total > 0 ? Math.round((verifiedCount / total) * 100) : 0;
    const defectivePercent = total > 0 ? 100 - verifiedPercent : 0;

    return {
      verifiedCount,
      defectiveCount,
      total,
      verifiedPercent,
      defectivePercent,
    };
  }, [selectedCustomersList]);

  // SAVE AUDIENCE TO PERSISTENT STORAGE
  const handleSaveAudience = (andLaunch = false) => {
    if (calculatedCount === 0) {
      toast.error("Please select at least one customer or filter to save the audience.");
      return;
    }
    const finalName = audienceName.trim() || "Custom Segment Audience";
    const finalDesc = audienceDescription.trim() || `Targeting ${calculatedCount} selected contacts from live store database`;

    const newAudienceCard = {
      id: `custom-aud-${Date.now()}`,
      name: finalName,
      icon: "🎯",
      description: finalDesc,
      count: calculatedCount,
      lastUpdated: "Just now",
      campaignsCount: 0,
      isDynamic: refreshMode === "DYNAMIC",
      category: "SEGMENT" as const,
      recipients: selectedCustomersList.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        city: (c as any).city || (c as any).shopName || "Main Branch",
        shopName: (c as any).shopName || (c as any).city || "Main Branch",
        segmentName: finalName,
      })),
    };

    try {
      const stored = localStorage.getItem("custom_saved_audiences");
      const list = stored ? JSON.parse(stored) : [];
      list.unshift(newAudienceCard);
      localStorage.setItem("custom_saved_audiences", JSON.stringify(list));
    } catch (e) {
      console.error("Error saving audience to localStorage:", e);
    }

    toast.success(`Audience "${finalName}" saved with ${calculatedCount} contacts!`);
    if (andLaunch) {
      router.push(`/campaigns/new?audience=${encodeURIComponent(finalName)}`);
    } else {
      router.push("/audience");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto select-none">
      
      {/* Notion-Style Top Action Header Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-16 z-30 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link
            href="/audience"
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={audienceName}
                onChange={(e) => setAudienceName(e.target.value)}
                placeholder="e.g. High Value Frame Buyers"
                className="text-base font-extrabold text-slate-900 dark:text-white bg-transparent border-b border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:outline-none px-1 py-0.5 placeholder-slate-400 dark:placeholder-slate-500 w-64 md:w-80"
              />
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border flex items-center gap-1 ${
                refreshMode === "DYNAMIC" 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                  : "bg-indigo-500/10 border-indigo-500/20 text-indigo-700 dark:text-indigo-400"
              }`}>
                <Zap className="w-3 h-3" />
                {refreshMode}
              </span>
            </div>
            <input
              type="text"
              value={audienceDescription}
              onChange={(e) => setAudienceDescription(e.target.value)}
              placeholder="e.g. Target customers with purchases > ₹5,000 in last 90 days"
              className="text-xs text-slate-500 dark:text-slate-400 bg-transparent focus:outline-none w-full"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSaveAudience(false)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-semibold text-xs transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Audience</span>
          </button>

          <button
            onClick={() => handleSaveAudience(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all border-none cursor-pointer shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Save & Use in Campaign 🚀</span>
          </button>
        </div>
      </div>

      {/* Main Workspace (2/3 Filters + 1/3 Live Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Filter Sections & Selected Customers Table (2/3 Width) */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Section 1: Refresh Mode & Store Selection */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">1. Refresh Mode & Store Outlets</h3>

            {/* Refresh Mode Selector */}
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setRefreshMode("DYNAMIC")}
                className={`p-3.5 rounded-xl border cursor-pointer space-y-1 transition-all ${
                  refreshMode === "DYNAMIC"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-white font-bold"
                    : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-emerald-500" />
                    ⚡ Dynamic Audience (Recommended)
                  </span>
                  {refreshMode === "DYNAMIC" && <Check className="w-4 h-4 text-emerald-500" />}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Auto-updates automatically whenever CRM data or dates change.
                </p>
              </div>

              <div
                onClick={() => setRefreshMode("STATIC")}
                className={`p-3.5 rounded-xl border cursor-pointer space-y-1 transition-all ${
                  refreshMode === "STATIC"
                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-white font-bold"
                    : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                    🧊 Static Snapshot Audience
                  </span>
                  {refreshMode === "STATIC" && <Check className="w-4 h-4 text-indigo-500" />}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Freezes exact list of contacts at creation time.
                </p>
              </div>
            </div>

            {/* Store Selection Chips (ALWAYS INCLUDES "All Outlets" CHIP + REAL STORES) */}
            <div className="space-y-1.5 pt-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Store Selection (Your Live Store Outlets)</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => toggleStore("ALL")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedStores.includes("ALL") || selectedStores.length === 0
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <Building2 className="w-3 h-3" />
                  <span>All Outlets</span>
                </button>

                {storeOutlets.map((st) => {
                  const isSel = selectedStores.includes(st.id);
                  return (
                    <button
                      key={st.id}
                      onClick={() => toggleStore(st.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSel
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <Building2 className="w-3 h-3" />
                      <span>{st.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 2: Products Purchased */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
            <div
              onClick={() => toggleSection("products")}
              className="flex items-center justify-between cursor-pointer"
            >
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                2. Products Purchased Filters
              </h3>
              {openSections.products ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>

            {openSections.products && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2">
                {[
                  "Frames", "Sunglasses", "Contact Lens", "Prescription Lens", 
                  "Progressive Lens", "Blue Cut", "Computer Glasses", "Kids Frames", 
                  "Premium Frames", "Accessories"
                ].map((item) => {
                  const isChecked = selectedProducts.includes(item);
                  return (
                    <button
                      key={item}
                      onClick={() => toggleItem(selectedProducts, item, setSelectedProducts)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-left flex items-center justify-between ${
                        isChecked
                          ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-400 font-bold"
                          : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <span>{item}</span>
                      {isChecked && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 3: Customer Type & Prescription Status */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
            <div
              onClick={() => toggleSection("customerType")}
              className="flex items-center justify-between cursor-pointer"
            >
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                3. Customer Type & Prescription Status
              </h3>
              {openSections.customerType ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>

            {openSections.customerType && (
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Customer Category</label>
                  <div className="flex flex-wrap gap-2">
                    {["VIP", "Premium", "Regular", "New", "Returning", "High Spending", "Inactive"].map((type) => {
                      const isChecked = selectedCustomerTypes.includes(type);
                      return (
                        <button
                          key={type}
                          onClick={() => toggleItem(selectedCustomerTypes, type, setSelectedCustomerTypes)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            isChecked
                              ? "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-400 font-bold"
                              : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Prescription Status</label>
                  <div className="flex flex-wrap gap-2">
                    {["Prescription Due", "Renewal Due", "High Power", "Progressive", "Reading", "Distance"].map((p) => {
                      const isChecked = prescriptionStatus.includes(p);
                      return (
                        <button
                          key={p}
                          onClick={() => toggleItem(prescriptionStatus, p, setPrescriptionStatus)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            isChecked
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-bold"
                              : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: SELECTED CUSTOMERS INTERACTIVE TABLE */}
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-500" />
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    4. Included Audience Contacts ({selectedCustomerIds.size} / {displayCustomers.length} Selected)
                  </h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Toggle individual customer checkboxes to include or exclude from campaign</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {displayCustomers.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition-colors border-none cursor-pointer flex items-center gap-1"
                  >
                    {isAllSelected ? <CheckSquare className="w-3.5 h-3.5 text-indigo-500" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{isAllSelected ? "Deselect All" : "Select All"}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition-all border-none cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Add / Search Customer</span>
                </button>
              </div>
            </div>

            {/* Scrollable Table */}
            {loadingCrm ? (
              <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                <Loader2 className="w-5 h-5 mx-auto text-indigo-500 animate-spin" />
                <p>Querying real store customer database...</p>
              </div>
            ) : displayCustomers.length > 0 ? (
              <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-950 text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={handleToggleSelectAll}
                          className="w-3.5 h-3.5 rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-3">Customer Name</th>
                      <th className="py-2.5 px-3">Phone Number</th>
                      <th className="py-2.5 px-3">Outlet / City</th>
                      <th className="py-2.5 px-3">Tag Segment</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 bg-white dark:bg-slate-900/60">
                    {displayCustomers.map((cust) => {
                      const isChecked = selectedCustomerIds.has(cust.id);
                      const phoneInfo = verifyAndFormatPhone(cust.phone);

                      return (
                        <tr
                          key={cust.id}
                          className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40 ${
                            isChecked ? "" : "opacity-50 bg-slate-50/50 dark:bg-slate-950/40"
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleRow(cust.id)}
                              className="w-3.5 h-3.5 rounded bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{cust.name}</span>
                            {cust.isCustom && (
                              <span className="px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                Custom
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-800 dark:text-slate-200">{phoneInfo.formatted}</span>
                              {phoneInfo.isValid ? (
                                <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded-full border border-emerald-500/20">
                                  Verified
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded-full border border-rose-500/20">
                                  Defective
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{cust.city || sessionShopName}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-400">
                              {cust.tag || "CRM Customer"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomer(cust.id)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors border-none cursor-pointer"
                              title="Remove from List"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500 space-y-2 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <Users className="w-7 h-7 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="font-semibold">No contacts in current selection list.</p>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-3 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-500 transition-colors inline-flex items-center gap-1 cursor-pointer border-none"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add or Search Customer</span>
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Sticky Live Audience Preview Panel (1/3 Width) */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-5 shadow-xs dark:shadow-xl sticky top-36">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Live Audience Preview
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Real-time</span>
            </div>

            {/* Calculated Operational Metrics (STRICTLY SYNCED WITH CHECKBOX COUNT) */}
            <div className="space-y-3">
              <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Included Contacts</span>
                {calculatedCount > 0 ? (
                  <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <span>{calculatedCount.toLocaleString()}</span>
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Contacts Selected</span>
                  </p>
                ) : (
                  <div className="py-2 space-y-1">
                    <p className="text-xl font-bold text-slate-400 dark:text-slate-500">0 Contacts</p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Filter className="w-3 h-3 text-indigo-400" />
                      Select stores, filters, or add custom contacts
                    </p>
                  </div>
                )}
              </div>

              {/* RICH VERIFIED VS DEFECTIVE PHONE METRICS CARD */}
              <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <PhoneCall className="w-3 h-3 text-emerald-500" />
                    Phone Verification Quality
                  </span>
                  <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {phoneMetrics.verifiedPercent}% Valid
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                  <div
                    style={{ width: `${phoneMetrics.verifiedPercent}%` }}
                    className="h-full bg-emerald-500 transition-all duration-300"
                    title={`${phoneMetrics.verifiedCount} Verified`}
                  />
                  <div
                    style={{ width: `${phoneMetrics.defectivePercent}%` }}
                    className="h-full bg-amber-500 transition-all duration-300"
                    title={`${phoneMetrics.defectiveCount} Defective`}
                  />
                </div>

                {/* Metric Badges Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5 text-center space-y-0.5">
                    <div className="flex items-center justify-center gap-1 text-emerald-700 dark:text-emerald-400 font-extrabold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verified (+91)</span>
                    </div>
                    <p className="text-base font-black text-emerald-700 dark:text-emerald-400">
                      {phoneMetrics.verifiedCount}
                    </p>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-center space-y-0.5">
                    <div className="flex items-center justify-center gap-1 text-amber-700 dark:text-amber-400 font-extrabold text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Defective</span>
                    </div>
                    <p className="text-base font-black text-amber-700 dark:text-amber-400">
                      {phoneMetrics.defectiveCount}
                    </p>
                  </div>
                </div>
              </div>

              {/* Operational Status */}
              <div className="space-y-2 text-xs">
                <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-1">
                  <span className="text-[9px] font-extrabold uppercase text-slate-400">Store WhatsApp Dispatch Engine</span>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5" />
                    <span>🟢 Active Outlet Stream ({sessionShopName})</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Primary Actions */}
            <div className="pt-2 space-y-2">
              <button
                onClick={() => handleSaveAudience(true)}
                disabled={calculatedCount === 0}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Save & Create Campaign</span>
              </button>

              <button
                onClick={() => handleSaveAudience(false)}
                disabled={calculatedCount === 0}
                className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-800 dark:text-white text-xs font-semibold transition-all border-none cursor-pointer"
              >
                Save to Audience Library
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* Quick Add & Search Customer Modal */}
      <AddCustomerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddCustomer={handleAddCustomCustomer}
      />

    </div>
  );
}
