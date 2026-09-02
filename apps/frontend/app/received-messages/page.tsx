"use client";

import React, { useState, useEffect, useRef } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import { useAuth } from "@/lib/auth-context";
import {
  MessageSquare,
  Search,
  Send,
  Paperclip,
  CheckCheck,
  Trash2,
  Zap,
  ShieldCheck,
  ArrowLeft,
  X,
  ChevronDown,
  Loader2,
  RefreshCw,
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";

interface ChatConversation {
  id: string;
  organizationId: string;
  instanceId?: string;
  phone: string;
  contactName?: string;
  lastMessage?: string;
  lastMessageAt: string;
  lastMessageType: string;
  lastMessageDirection: "INCOMING" | "OUTGOING";
  unreadCount: number;
  status: "AWAITING_REPLY" | "REPLIED" | "ARCHIVED";
  tags: string[];
  isGroup: boolean;
  isBusiness: boolean;
  campaignName?: string;
  isCampaignBroadcast?: boolean;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  organizationId: string;
  instanceId?: string;
  phone: string;
  messageId?: string;
  direction: "INCOMING" | "OUTGOING";
  senderName?: string;
  messageType: string;
  content?: string;
  mediaUrl?: string;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED";
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
  campaignName?: string;
  isCampaignBroadcast?: boolean;
}

interface WhatsAppInstance {
  id: string;
  phoneNumber?: string | null;
  displayName?: string | null;
  instanceName?: string;
  status: string;
}

const AVATAR_COLORS = [
  "bg-[#800020]", // Maroon / Dark Red
  "bg-[#0f766e]", // Teal
  "bg-[#6b21a8]", // Purple
  "bg-[#1e3a8a]", // Deep Blue
  "bg-[#9a3412]", // Rust / Orange
  "bg-[#15803d]", // Green
  "bg-[#4338ca]", // Indigo
  "bg-[#9f1239]", // Rose
];

function getAvatarColor(phone: string): string {
  let hash = 0;
  for (let i = 0; i < phone.length; i++) {
    hash = phone.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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

function formatTime(isoString?: string): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateHeader(isoString?: string): string {
  if (!isoString) return "Today";
  const d = new Date(isoString);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

const QUICK_REPLIES = [
  { label: "Welcome Greeting", text: "Hello! Welcome to our optical showroom. How can we assist you today?" },
  { label: "Store Address & Timings", text: "We are open Monday to Saturday from 10:00 AM to 8:30 PM. Visit us at our main optical store." },
  { label: "Special Eyewear Offer", text: "Exclusive Offer! Get 20% off on all designer frames and branded lenses this week." },
  { label: "Eye Test Appointment", text: "Your computerized eye examination is booked. Please visit our optometrist at the scheduled time." },
  { label: "Spectacles Ready for Pickup", text: "Great news! Your customized spectacles / contact lenses are ready for pickup at our store." },
];

export default function ReceivedMessagesPage() {
  const { user } = useAuth();
  const backendUrl = getBackendUrl();

  // State
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("ALL");
  const [activeFilter, setActiveFilter] = useState<string>("awaiting_reply");
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeChat, setActiveChat] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const activeChatIdRef = useRef<string | null>(null);
  const activeChatRef = useRef<ChatConversation | null>(null);
  const sendingRef = useRef<boolean>(false);
  
  // Local Attachment State (Stored in browser memory only, not in DB)
  const [selectedFile, setSelectedFile] = useState<{ name: string; dataUrl: string; isImage: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const prevMsgCountRef = useRef<number>(0);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const isUserNearBottomRef = useRef(true);
  const shouldForceScrollRef = useRef(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("broadcast_token");
    if (token) return { Authorization: `Bearer ${token}` };
    return {};
  };

  // 1. Fetch Connected WhatsApp Instances
  const fetchInstances = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/whatsapp-numbers/instances`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setInstances(json.data);
        }
      }
    } catch {}
  };

  // 2. Fetch Conversations List
  const fetchConversations = async (showLoading = false) => {
    if (showLoading) setLoadingChats(true);
    try {
      const params = new URLSearchParams();
      if (activeFilter) params.append("filter", activeFilter);
      if (searchQuery) params.append("search", searchQuery);
      if (selectedInstanceId && selectedInstanceId !== "ALL") {
        params.append("instanceId", selectedInstanceId);
      }

      const res = await fetch(`${backendUrl}/api/v1/chat/conversations?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setConversations(json.data);
        }
      }
    } catch {}
    finally {
      if (showLoading) setLoadingChats(false);
    }
  };

  // 3. Fetch Messages for Active Chat (Strictly scoped to active chat)
  const fetchMessages = async (conversationId: string, showLoading = false) => {
    if (!conversationId) return;
    if (showLoading) setLoadingMessages(true);
    try {
      const res = await fetch(`${backendUrl}/api/v1/chat/conversations/${conversationId}/messages`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          // GUARD: Only apply messages if the user is still viewing this exact conversation!
          if (activeChatIdRef.current === conversationId) {
            setMessages(json.data);
          }
        }
      }
    } catch {}
    finally {
      if (activeChatIdRef.current === conversationId && showLoading) {
        setLoadingMessages(false);
      }
    }
  };

  // 4. WebSocket Real-Time Listener
  useEffect(() => {
    fetchInstances();
    fetchConversations(true);

    const token = typeof window !== "undefined" ? localStorage.getItem("broadcast_token") : null;
    const socket: Socket = io(`${backendUrl}/ws/whatsapp`, {
      path: "/socket.io/",
      query: { token: token || JSON.stringify(user || { role: "OWNER" }) },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("chat_message_received", (msg: ChatMessage) => {
      const curr = activeChatRef.current;
      if (curr && (msg.conversationId === curr.id || msg.phone.slice(-10) === curr.phone.slice(-10))) {
        setMessages((prev) => {
          const existingIdx = prev.findIndex(
            (m) => m.id === msg.id || (m.id.startsWith("temp_") && m.content === msg.content && m.direction === msg.direction)
          );
          if (existingIdx !== -1) {
            const updated = [...prev];
            updated[existingIdx] = msg;
            return updated;
          }
          return [...prev, msg];
        });
      }
      fetchConversations(false);
    });

    socket.on("conversation_updated", () => {
      fetchConversations(false);
    });

    // Polling fallback (Always reads activeChatRef.current, never stale closure)
    const interval = setInterval(() => {
      fetchConversations(false);
      const curr = activeChatRef.current;
      if (curr?.id) {
        fetchMessages(curr.id, false);
      }
    }, 3500);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [backendUrl, activeFilter, selectedInstanceId, searchQuery]);

  // Track user scroll position
  const handleChatScroll = () => {
    const container = chatContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    isUserNearBottomRef.current = isNearBottom;
    setShowScrollBottomBtn(!isNearBottom);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    isUserNearBottomRef.current = true;
    setShowScrollBottomBtn(false);
  };

  // Smart scroll: only scroll if user was near bottom or forced
  useEffect(() => {
    if (shouldForceScrollRef.current) {
      scrollToBottom("auto");
      shouldForceScrollRef.current = false;
      prevMsgCountRef.current = messages.length;
    } else if (messages.length > prevMsgCountRef.current && isUserNearBottomRef.current) {
      scrollToBottom("smooth");
      prevMsgCountRef.current = messages.length;
    }
  }, [messages]);

  // Handle selecting a conversation
  const handleSelectChat = async (conv: ChatConversation) => {
    shouldForceScrollRef.current = true;
    activeChatIdRef.current = conv.id;
    activeChatRef.current = conv;
    setActiveChat(conv);
    fetchMessages(conv.id, true);

    try {
      await fetch(`${backendUrl}/api/v1/chat/conversations/${conv.id}/mark-read`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      setConversations((prev) =>
        prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c))
      );
    } catch {}
  };

  // Handle File Input from Computer
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 15MB)
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File is too large. Max allowed size is 15MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const isImage = file.type.startsWith("image/");
      setSelectedFile({
        name: file.name,
        dataUrl,
        isImage,
      });
    };
    reader.readAsDataURL(file);
  };

  // Handle Send Message (Deduplication lock & Active ref sync)
  const handleSendMessage = async (customText?: string) => {
    if (sendingRef.current) return;
    const textToSend = customText || inputText.trim();
    const mediaToSend = selectedFile ? selectedFile.dataUrl : undefined;

    if (!textToSend && !mediaToSend) return;
    const currentChat = activeChatRef.current || activeChat;
    if (!currentChat) return;

    sendingRef.current = true;
    setSending(true);
    const cleanPhone = currentChat.phone.replace(/\D/g, "");

    // Optimistic message add
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversationId: currentChat.id,
      organizationId: currentChat.organizationId,
      instanceId: selectedInstanceId !== "ALL" ? selectedInstanceId : currentChat.instanceId,
      phone: cleanPhone,
      direction: "OUTGOING",
      senderName: "Agent",
      messageType: mediaToSend ? (selectedFile?.isImage ? "IMAGE" : "DOCUMENT") : "TEXT",
      content: textToSend,
      mediaUrl: mediaToSend,
      status: "SENT",
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    setSelectedFile(null);
    setShowQuickReplies(false);

    try {
      const res = await fetch(`${backendUrl}/api/v1/chat/send`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: currentChat.id,
          phone: cleanPhone,
          instanceId: selectedInstanceId !== "ALL" ? selectedInstanceId : currentChat.instanceId,
          text: textToSend,
          mediaUrl: mediaToSend,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.message) {
          setMessages((prev) => {
            const existingIdx = prev.findIndex((m) => m.id === tempId || m.id === json.message.id);
            if (existingIdx !== -1) {
              const updated = [...prev];
              updated[existingIdx] = json.message;
              return updated;
            }
            return [...prev, json.message];
          });
          fetchConversations(false);
        }
      } else {
        const err = await res.json().catch(() => ({ message: "Failed to send message" }));
        toast.error(err.message || "Failed to send message");
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    } catch {
      toast.error("Network error sending message");
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  // Handle Clear Current Chat
  const handleClearCurrentChat = async () => {
    if (!activeChat) return;
    if (!confirm(`Are you sure you want to clear chat history with ${activeChat.contactName || activeChat.phone}?`)) return;

    try {
      const res = await fetch(`${backendUrl}/api/v1/chat/conversations/${activeChat.id}/clear`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setMessages([]);
        toast.success("Chat history cleared");
        fetchConversations(false);
      }
    } catch {
      toast.error("Failed to clear chat");
    }
  };

  // Handle Clear All Chats
  const handleClearAllChats = async () => {
    if (!confirm("Are you sure you want to clear all message logs? This cannot be undone.")) return;
    try {
      const params = selectedInstanceId !== "ALL" ? `?instanceId=${selectedInstanceId}` : "";
      const res = await fetch(`${backendUrl}/api/v1/chat/clear-all${params}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setConversations([]);
        setActiveChat(null);
        setMessages([]);
        toast.success("All chats cleared");
      }
    } catch {
      toast.error("Failed to clear chats");
    }
  };

  // Find active sending WhatsApp instance details
  const activeSendingInstance = instances.find((i) => 
    selectedInstanceId !== "ALL" ? i.id === selectedInstanceId : i.id === activeChat?.instanceId
  ) || instances.find((i) => i.status === "CONNECTED") || instances[0];

  return (
    <div className="h-[calc(100vh-4rem)] w-full flex flex-col bg-white dark:bg-[#0b0f19] overflow-hidden select-none">
      
      {/* =========================================================================
          1. TOP APP HEADER BAR
          ========================================================================= */}
      <div className="h-14 px-4 bg-white dark:bg-[#111726] border-b border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0 z-10">
        
        {/* Left: WhatsApp Green Icon + Messages Title + Account Selector */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-2xs">
              <MessageSquare className="w-4 h-4" />
            </div>
            <h1 className="text-base font-extrabold text-slate-800 dark:text-white tracking-tight hidden sm:block">
              Messages
            </h1>
          </div>

          {/* Connected Device / Account Dropdown */}
          <div className="relative">
            <select
              value={selectedInstanceId}
              onChange={(e) => setSelectedInstanceId(e.target.value)}
              className="appearance-none bg-slate-100 dark:bg-slate-800/90 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs py-1.5 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer transition-all truncate max-w-[260px]"
            >
              <option value="ALL">All Connected Accounts</option>
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.displayName || inst.instanceName || "Work"} ({formatPhoneDisplay(inst.phoneNumber || "") || "No number"})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Right Action Tools: Quick replies, Clear chats, Refresh */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowQuickReplies(!showQuickReplies)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors shadow-2xs cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Quick replies</span>
          </button>

          <button
            onClick={handleClearAllChats}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition-colors shadow-2xs cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-rose-500" />
            <span className="hidden md:inline">Clear chats</span>
          </button>

          <button
            onClick={() => fetchConversations(true)}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            title="Refresh inbox"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. MAIN 2-PANE INBOX CONTAINER
          ========================================================================= */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* =======================================================================
            LEFT PANE: CONVERSATION LIST SIDEBAR
            ======================================================================= */}
        <div className={`w-full md:w-88 lg:w-96 flex flex-col bg-white dark:bg-[#111726] border-r border-slate-200/90 dark:border-slate-800 shrink-0 ${
          activeChat ? "hidden md:flex" : "flex"
        }`}>
          
          {/* Search Input Bar */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-800/80">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                placeholder="Search or start a new chat"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-white placeholder:text-slate-400 text-xs py-2 pl-9 pr-3 rounded-xl border border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden transition-all"
              />
            </div>
          </div>

          {/* Filter Tabs / Pills */}
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: "all", label: "All" },
              { id: "unread", label: "Unread" },
              { id: "groups", label: "Groups" },
              { id: "awaiting_reply", label: "Awaiting reply" },
              { id: "business", label: "Business" },
              { id: "tags", label: "Tags" },
              { id: "archived", label: "Archived" },
            ].map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#16a34a] text-white shadow-2xs"
                      : "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700/60"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Conversation List Stream */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {loadingChats && conversations.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600 mx-auto" />
                <p className="text-xs text-slate-400">Loading live conversations...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No messages found</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Incoming replies from customers will appear here in real-time as they send WhatsApp messages.
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = activeChat?.id === conv.id;
                const avatarColor = getAvatarColor(conv.phone);
                const countryCode = conv.phone.replace(/\D/g, "").slice(0, 2) || "91";

                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectChat(conv)}
                    className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-slate-100/90 dark:bg-slate-800/90 border-l-4 border-emerald-600"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    {/* Circle Avatar with Country Code Badge */}
                    <div className={`w-11 h-11 rounded-full ${avatarColor} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs`}>
                      {countryCode}
                    </div>

                    {/* Chat Information */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate">
                            {conv.contactName && conv.contactName !== "Customer" ? conv.contactName : formatPhoneDisplay(conv.phone)}
                          </h4>
                          {conv.campaignName && (
                            <span className="px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 font-bold text-[9px] truncate max-w-[100px] shrink-0">
                              📢 {conv.campaignName}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                          {formatTime(conv.lastMessageAt)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                          {conv.lastMessageDirection === "OUTGOING" && (
                            <CheckCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          <span>{conv.lastMessage || "Attachment"}</span>
                        </p>

                        {/* Unread Pill */}
                        {conv.unreadCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-[#16a34a] text-white font-extrabold text-[9px] shrink-0">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* =======================================================================
            RIGHT PANE: CHAT WIZARD / CONVERSATION VIEW
            ======================================================================= */}
        <div className={`flex-1 flex flex-col bg-slate-100/70 dark:bg-[#0c101c] relative h-full overflow-hidden ${
          !activeChat ? "hidden md:flex" : "flex"
        }`}>
          
          {!activeChat ? (
            /* ===================================================================
               EMPTY STATE
               =================================================================== */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-slate-200/80 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 shadow-inner">
                <MessageSquare className="w-10 h-10 stroke-1" />
              </div>

              <div className="space-y-1.5 max-w-md">
                <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">
                  WhatsApp Web style inbox
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Select a conversation on the left to read and reply. Messages stream live from your logged-in accounts.
                </p>
              </div>

              <div className="mt-8 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Enterprise Grade & End-to-End Encrypted Communication</span>
              </div>
            </div>
          ) : (
            /* ===================================================================
               ACTIVE CHAT VIEW (Live Chat Stream with Pinned Bottom Input Bar)
               =================================================================== */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* Active Chat Header */}
              <div className="h-14 px-4 bg-white dark:bg-[#111726] border-b border-slate-200/90 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-xs z-10">
                
                {/* Left: Back button + Avatar + Contact Details */}
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setActiveChat(null)}
                    className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div className={`w-9 h-9 rounded-full ${getAvatarColor(activeChat.phone)} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs`}>
                    {activeChat.phone.replace(/\D/g, "").slice(0, 2) || "91"}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-white truncate">
                      {activeChat.contactName && activeChat.contactName !== "Customer" ? activeChat.contactName : formatPhoneDisplay(activeChat.phone)}
                    </h3>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>
                        via {activeSendingInstance?.displayName || activeSendingInstance?.instanceName || "WhatsApp"} ({formatPhoneDisplay(activeSendingInstance?.phoneNumber || "")})
                      </span>
                    </p>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                    className="p-2 rounded-xl text-slate-500 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Quick reply templates"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleClearCurrentChat}
                    className="p-2 rounded-xl text-slate-500 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Clear chat messages"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Message History Feed Area (Scrollable flex-1) */}
              <div ref={chatContainerRef} onScroll={handleChatScroll} className="flex-1 p-4 overflow-y-auto min-h-0 space-y-3 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] bg-[size:16px_16px]">
                {loadingMessages ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No message history yet</p>
                    <p className="text-[11px] text-slate-400 max-w-xs">Type a response below to start chatting directly via your connected WhatsApp account.</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isOutgoing = msg.direction === "OUTGOING";
                    const isFirst = idx === 0 || formatDateHeader(messages[idx - 1]?.createdAt) !== formatDateHeader(msg.createdAt);

                    return (
                      <React.Fragment key={msg.id || idx}>
                        {/* Date Separator Pill */}
                        {isFirst && (
                          <div className="flex justify-center my-3">
                            <span className="px-3 py-1 rounded-full bg-slate-200/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 text-[10px] font-bold shadow-2xs uppercase tracking-wider">
                              {formatDateHeader(msg.createdAt)}
                            </span>
                          </div>
                        )}

                        {/* Message Bubble */}
                        <div className={`flex ${isOutgoing ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[78%] rounded-2xl p-3 space-y-1 shadow-2xs ${
                              isOutgoing
                                ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-white rounded-tr-xs"
                                : "bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white rounded-tl-xs border border-slate-100 dark:border-slate-800"
                            }`}
                          >
                            {/* Media Attachment Preview */}
                            {msg.mediaUrl && (
                              <div className="rounded-xl overflow-hidden mb-1.5 border border-black/5 dark:border-white/5">
                                {msg.mediaUrl.startsWith("data:image/") || /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(msg.mediaUrl) ? (
                                  <img
                                    src={msg.mediaUrl}
                                    alt="Attachment"
                                    className="max-h-60 w-full object-cover"
                                  />
                                ) : (
                                  <div className="p-3 bg-slate-100 dark:bg-slate-800 flex items-center gap-2 rounded-lg">
                                    <FileText className="w-6 h-6 text-emerald-600" />
                                    <span className="text-xs font-bold truncate">Attachment Document</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Broadcast Header (Only for campaign broadcasts) */}
                            {(msg.isCampaignBroadcast || msg.senderName?.includes('Broadcast')) && (
                              <div className="flex items-center gap-1.5 px-2 py-1 mb-1.5 rounded-md bg-purple-100/90 dark:bg-purple-950/80 text-purple-900 dark:text-purple-200 text-[10px] font-bold border border-purple-200/60 dark:border-purple-800/60">
                                <span>📢</span>
                                <span>Broadcast: {msg.campaignName || "Campaign Message"}</span>
                              </div>
                            )}

                            {/* Message Content */}
                            {msg.content && (
                              <p className="text-xs font-normal whitespace-pre-wrap leading-relaxed select-text">
                                {msg.content}
                              </p>
                            )}

                            {/* Timestamp & Double Ticks */}
                            <div className="flex items-center justify-end gap-1 pt-0.5 text-[10px] font-mono text-slate-500 dark:text-slate-300/80">
                              <span>{formatTime(msg.createdAt || msg.sentAt)}</span>
                              {isOutgoing && (
                                <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                              )}
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                {showScrollBottomBtn && (
                      <button
                        onClick={() => scrollToBottom("smooth")}
                        className="fixed bottom-24 right-8 z-30 p-2.5 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-all flex items-center gap-1.5 text-xs font-semibold"
                      >
                        <ChevronDown className="w-4 h-4 text-emerald-600" />
                        <span>Latest</span>
                      </button>
                    )}
                    <div ref={messagesEndRef} />
              </div>

              {/* Quick Replies Drawer Overlay */}
              {showQuickReplies && (
                <div className="p-3 bg-white dark:bg-[#111726] border-t border-slate-200 dark:border-slate-800 shadow-md shrink-0 animate-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Quick Reply Templates
                    </span>
                    <button
                      onClick={() => setShowQuickReplies(false)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {QUICK_REPLIES.map((qr, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setInputText(qr.text);
                          setShowQuickReplies(false);
                        }}
                        className="p-2 text-left rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200/80 dark:border-slate-700/80 transition-colors"
                      >
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
                          {qr.label}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                          {qr.text}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected File Preview Chip (if any attached from computer) */}
              {selectedFile && (
                <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 border-t border-emerald-200 dark:border-emerald-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedFile.isImage ? (
                      <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 truncate">
                      {selectedFile.name}
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                      (Ready to send)
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-slate-400 hover:text-rose-500 p-1"
                    title="Remove attached file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Pinned Bottom Interactive Chat Input Bar (Always Visible at Bottom) */}
              <div className="p-3 bg-white dark:bg-[#111726] border-t border-slate-200/90 dark:border-slate-800 flex items-end gap-2 shrink-0 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
                
                {/* Hidden File Input for Native File Selection from Computer */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,video/*,application/pdf,.doc,.docx"
                  className="hidden"
                />

                {/* Attachment Trigger */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Attach file from computer"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                {/* Message Text Input */}
                <textarea
                  rows={1}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type a message... (Press Enter to send)"
                  className="flex-1 bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-white placeholder:text-slate-400 text-xs py-2.5 px-3.5 rounded-xl border border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden resize-none max-h-24 transition-all"
                />

                {/* Send Button */}
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={sending || (!inputText.trim() && !selectedFile)}
                  className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
