"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import { toast } from "sonner";
import { Users, Plus, Trash2, Megaphone, Eye, X, Tag } from "lucide-react";
import Link from "next/link";

interface Audience {
  id: string;
  name: string;
  description?: string;
  contactCount: number;
  createdAt: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("broadcast_token");
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

const backendUrl = getBackendUrl();

export default function AudiencesPage() {
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newAudienceName, setNewAudienceName] = useState("");
  const [newAudienceDescription, setNewAudienceDescription] = useState("");
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState("");
  const [creating, setCreating] = useState(false);

  const [viewingAudience, setViewingAudience] = useState<Audience | null>(null);
  const [audienceContacts, setAudienceContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  const fetchAudiences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${backendUrl}/api/v1/audiences`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch audiences");
      const data = await res.json();
      if (data.success) {
        setAudiences(data.data);
      } else {
        throw new Error(data.message || "Failed to fetch audiences");
      }
    } catch (err: any) {
      setError(err.message);
      toast.error("Failed to load audiences");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTags = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/contacts/tags`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setAvailableTags(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch tags", err);
    }
  };

  useEffect(() => {
    fetchAudiences();
  }, [fetchAudiences]);

  useEffect(() => {
    if (isCreateModalOpen) {
      fetchTags();
    }
  }, [isCreateModalOpen]);

  const handleCreateAudience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAudienceName.trim()) {
      toast.error("Audience name is required");
      return;
    }
    
    try {
      setCreating(true);
      const res = await fetch(`${backendUrl}/api/v1/audiences`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          name: newAudienceName,
          description: newAudienceDescription,
          tag: selectedTag || undefined,
        }),
      });
      
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Audience created successfully");
        setIsCreateModalOpen(false);
        setNewAudienceName("");
        setNewAudienceDescription("");
        setSelectedTag("");
        fetchAudiences();
      } else {
        throw new Error(data.message || "Failed to create audience");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this audience segment?")) return;
    try {
      const res = await fetch(`${backendUrl}/api/v1/audiences/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete audience");
      const data = await res.json();
      if (data.success) {
        toast.success("Audience deleted");
        setAudiences(audiences.filter(a => a.id !== id));
      } else {
        throw new Error(data.message || "Failed to delete audience");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleViewMembers = async (audience: Audience) => {
    setViewingAudience(audience);
    setAudienceContacts([]);
    setContactsLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/v1/audiences/${audience.id}/contacts`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch contacts");
      const data = await res.json();
      if (data.success) {
        setAudienceContacts(data.data);
      } else {
        throw new Error(data.message || "Failed to fetch contacts");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setContactsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Audience Segments</h1>
          <span className="flex h-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            {audiences.length}
          </span>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        >
          <Plus className="h-4 w-4" />
          Create Audience
        </button>
      </div>

      {error ? (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      ) : audiences.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-16 px-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
            <Users className="h-6 w-6 text-slate-400 dark:text-slate-500" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No audience segments yet</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
            Create an audience segment to group your contacts for targeted broadcast campaigns.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              Create your first audience
            </button>
            <Link
              href="/contacts"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Import contacts
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {audiences.map((audience) => (
            <div
              key={audience.id}
              className="group relative flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-slate-900 dark:text-white line-clamp-1">
                    {audience.name}
                  </h3>
                  {audience.description && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {audience.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(audience.id)}
                  className="rounded-lg p-1.5 text-slate-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                  aria-label="Delete audience"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-6 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <Users className="h-4 w-4 text-emerald-500" />
                <span className="font-medium">{audience.contactCount}</span> contacts
              </div>

              <div className="mt-auto flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => handleViewMembers(audience)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-[11px] font-medium text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View Members
                </button>
                <Link
                  href={`/campaigns/new?audience=${audience.id}`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2 text-[11px] font-medium text-indigo-700 dark:text-indigo-400 transition-colors hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
                >
                  <Megaphone className="h-3.5 w-3.5" />
                  Launch Campaign
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Create Audience Segment</h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateAudience} className="p-4 space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  value={newAudienceName}
                  onChange={(e) => setNewAudienceName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="e.g., Premium Customers"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="description"
                  value={newAudienceDescription}
                  onChange={(e) => setNewAudienceDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="What is this segment about?"
                />
              </div>

              <div>
                <label htmlFor="tag" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Auto-populate from Tag <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Tag className="h-4 w-4 text-slate-400" />
                  </div>
                  <select
                    id="tag"
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 pl-9 pr-8 text-sm text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Select a tag to filter contacts...</option>
                    {availableTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Selecting a tag will automatically add matching contacts to this audience.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newAudienceName.trim()}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed dark:focus:ring-offset-slate-900"
                >
                  {creating ? "Creating..." : "Create Audience"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Members Modal */}
      {viewingAudience && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 p-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Members: {viewingAudience.name}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{audienceContacts.length} contacts found</p>
              </div>
              <button
                onClick={() => setViewingAudience(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {contactsLoading ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-3 border-emerald-500 border-t-transparent"></div>
                </div>
              ) : audienceContacts.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center text-center">
                  <Users className="h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">No members in this audience.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {audienceContacts.map((contact) => (
                    <div key={contact.id} className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                      <span className="font-medium text-sm text-slate-900 dark:text-white line-clamp-1">{contact.name}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{contact.phone}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="border-t border-slate-100 dark:border-slate-800 p-4 flex justify-end">
              <button
                onClick={() => setViewingAudience(null)}
                className="rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
