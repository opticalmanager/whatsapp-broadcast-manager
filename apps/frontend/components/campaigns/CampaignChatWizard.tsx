"use client";

import React, { useState, useEffect, useRef } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import { useAuth } from "@/lib/auth-context";
import {
  MessageSquare,
  Search,
  Send,
  Paperclip,
  Check,
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
  MessageCircle,
  Vote,
  Sparkles,
  Reply,
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
  quotedMessageId?: string;
  quotedContent?: string;
  quotedSender?: string;
}

interface WhatsAppInstance {
  id: string;
  phoneNumber?: string | null;
  displayName?: string | null;
  instanceName?: string;
  status: string;
}

interface CampaignChatWizardProps {
  campaignId: string;
  campaignName: string;
  campaignMessageText?: string;
  campaignMediaUrl?: string;
}

const AVATAR_COLORS = [
  "bg-[#800020]", // Maroon
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
  { label: "Thank you for responding!", text: "Thank you for your response! How can our optical team assist you today?" },
  { label: "Book Eye Examination", text: "We have reserved an eye exam slot for you. Please let us know your preferred time." },
  { label: "Offer Details & Pricing", text: "Our campaign offer includes 20% off on premium frames & anti-glare lenses this week." },
  { label: "Store Location & Timings", text: "We are open Monday to Saturday from 10:00 AM to 8:30 PM. Visit our main showroom." },
  { label: "Spectacles Order Update", text: "Your customized prescription eyewear is ready for trial and collection at the store." },
];

export function CampaignChatWizard({
  campaignId,
  campaignName,
  campaignMessageText,
  campaignMediaUrl,
}: CampaignChatWizardProps) {
  const { user } = useAuth();
  const backendUrl = getBackendUrl();

  // State
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("ALL");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeChat, setActiveChat] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  // Replying / Tagging State
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

  // Pagination & Load Older Messages State
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Local File Upload from Computer
  const [selectedFile, setSelectedFile] = useState<{ name: string; dataUrl: string; isImage: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const activeChatIdRef = useRef<string | null>(null);
  const activeChatRef = useRef<ChatConversation | null>(null);
  const sendingRef = useRef<boolean>(false);
  const prevMsgCountRef = useRef<number>(0);

  // 2. Fetch Conversations specifically for this Campaign (Silent background sync)
  const fetchConversations = async (showLoading = false) => {
    if (showLoading && conversations.length === 0) setLoadingChats(true);
    try {
      const params = new URLSearchParams();
      params.append("campaignId", campaignId);
      if (activeFilter && activeFilter !== "all") params.append("filter", activeFilter);
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
          setConversations((prev) => {
            if (
              prev.length === json.data.length &&
              prev.every((c, idx) => c.id === json.data[idx]?.id && c.lastMessageAt === json.data[idx]?.lastMessageAt && c.unreadCount === json.data[idx]?.unreadCount)
            ) {
              return prev;
            }
            return json.data;
          });

          // Auto-select first conversation only on initial load if none selected
          if (json.data.length > 0 && !activeChatIdRef.current) {
            const first = json.data[0];
            activeChatIdRef.current = first.id;
            activeChatRef.current = first;
            setActiveChat(first);
            fetchMessages(first.id, true);
          }
        }
      }
    } catch {}
    finally {
      if (showLoading) setLoadingChats(false);
    }
  };

  // 3. Fetch Message History for Active Conversation (Scoped to latest 30 messages for low server load)
  const fetchMessages = async (conversationId: string, showLoading = false) => {
    if (!conversationId) return;
    if (showLoading) setLoadingMessages(true);
    try {
      const res = await fetch(`${backendUrl}/api/v1/chat/conversations/${conversationId}/messages?limit=30&campaignId=${campaignId}`, {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          // GUARD: Only apply messages if the user is still viewing this exact conversation!
          if (activeChatIdRef.current === conversationId) {
            setMessages(json.data);
            setHasMoreOlder(Boolean(json.hasMore));
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

  // 3b. Load Earlier Messages on demand
  const handleLoadOlderMessages = async () => {
    if (!activeChat || loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const oldestDate = messages[0]?.createdAt;
      const res = await fetch(
        `${backendUrl}/api/v1/chat/conversations/${activeChat.id}/messages?limit=30&before=${encodeURIComponent(oldestDate)}&campaignId=${campaignId}`,
        { headers: getAuthHeaders() }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const existingIds = new Set(messages.map((m) => m.id));
          const newBatch = json.data.filter((m: ChatMessage) => !existingIds.has(m.id));
          setMessages((prev) => [...newBatch, ...prev]);
          setHasMoreOlder(Boolean(json.hasMore));
        } else {
          setHasMoreOlder(false);
        }
      }
    } catch {}
    finally {
      setLoadingOlder(false);
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

    // Auto-poll fallback (Always reads activeChatRef.current, never stale closure)
    const interval = setInterval(() => {
      fetchConversations(false);
      const curr = activeChatRef.current;
      if (curr?.id) {
        fetchMessages(curr.id, false);
      }
    }, 4000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, [backendUrl, campaignId, activeFilter, selectedInstanceId, searchQuery]);

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

  // Handle selecting a chat
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

  // Handle Local File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

  // Handle Send Message (Smart multi-number instance routing & Deduplication lock)
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

    // Determine best sending instance: use original recipient instance, or dropdown selection, or first connected
    const targetInstanceId = 
      selectedInstanceId !== "ALL" 
        ? selectedInstanceId 
        : currentChat.instanceId || instances.find((i) => i.status === "CONNECTED")?.id;

    const replyTarget = replyingTo;

    // Optimistic message add
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversationId: currentChat.id,
      organizationId: currentChat.organizationId,
      instanceId: targetInstanceId,
      phone: cleanPhone,
      direction: "OUTGOING",
      senderName: "Agent",
      messageType: mediaToSend ? (selectedFile?.isImage ? "IMAGE" : "DOCUMENT") : "TEXT",
      content: textToSend,
      mediaUrl: mediaToSend,
      status: "SENT",
      quotedMessageId: replyTarget ? (replyTarget.messageId || replyTarget.id) : undefined,
      quotedContent: replyTarget ? (replyTarget.content || (replyTarget.mediaUrl ? "Attachment" : undefined)) : undefined,
      quotedSender: replyTarget ? (replyTarget.direction === "OUTGOING" ? "You" : (currentChat.contactName || "Customer")) : undefined,
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    setSelectedFile(null);
    setReplyingTo(null);
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
          instanceId: targetInstanceId,
          text: textToSend,
          mediaUrl: mediaToSend,
          quotedMessageId: replyTarget ? (replyTarget.messageId || replyTarget.id) : undefined,
          quotedContent: replyTarget ? (replyTarget.content || (replyTarget.mediaUrl ? "Attachment" : undefined)) : undefined,
          quotedSender: replyTarget ? (replyTarget.direction === "OUTGOING" ? "You" : (currentChat.contactName || "Customer")) : undefined,
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

  // Find sending account display info
  const activeSendingInstance = instances.find((i) => 
    selectedInstanceId !== "ALL" ? i.id === selectedInstanceId : i.id === activeChat?.instanceId
  ) || instances.find((i) => i.status === "CONNECTED") || instances[0];

  return (
    <div className="bg-white dark:bg-[#111726] border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden flex flex-col h-[640px] select-none">
      
      {/* =========================================================================
          1. HEADER BAR: Title, Multi-Account Dropdown, Quick replies, Refresh
          ========================================================================= */}
      <div className="h-14 px-4 bg-slate-50/90 dark:bg-[#0f1523] border-b border-slate-200/90 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
        
        {/* Left: WhatsApp Icon + Section Title + Multi-Number Account Selector */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-2xs shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                Customer Replies to this Campaign
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">
                {conversations.length} {conversations.length === 1 ? "active response" : "active responses"}
              </span>
            </div>
          </div>

          {/* Multi-Number Sending Accounts Filter */}
          <div className="relative hidden sm:block">
            <select
              value={selectedInstanceId}
              onChange={(e) => setSelectedInstanceId(e.target.value)}
              className="appearance-none bg-white dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs py-1.5 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-1 focus:ring-emerald-500 cursor-pointer transition-all truncate max-w-[240px]"
            >
              <option value="ALL">All Campaign Accounts</option>
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.displayName || inst.instanceName || "Work"} ({formatPhoneDisplay(inst.phoneNumber || "") || "No number"})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowQuickReplies(!showQuickReplies)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors shadow-2xs cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden md:inline">Quick replies</span>
          </button>

          <button
            onClick={() => fetchConversations(true)}
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors cursor-pointer"
            title="Refresh campaign inbox"
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
            LEFT PANE: CONVERSATION LIST FOR THIS CAMPAIGN
            ======================================================================= */}
        <div className={`w-full md:w-80 lg:w-88 flex flex-col bg-white dark:bg-[#111726] border-r border-slate-200/90 dark:border-slate-800 shrink-0 ${
          activeChat ? "hidden md:flex" : "flex"
        }`}>
          
          {/* Search Bar */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-800/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search replies in this broadcast"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-white placeholder:text-slate-400 text-xs py-1.5 pl-8 pr-3 rounded-xl border border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden transition-all"
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: "all", label: "All Replies" },
              { id: "awaiting_reply", label: "Awaiting Reply" },
              { id: "unread", label: "Unread" },
            ].map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
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

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {loadingChats && conversations.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600 mx-auto" />
                <p className="text-xs text-slate-400">Loading campaign replies...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No customer replies yet</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                  When recipients reply or click interactive buttons in this campaign, their chats will appear here live.
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
                    className={`px-3.5 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-slate-100/90 dark:bg-slate-800/90 border-l-4 border-emerald-600"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    {/* Circle Avatar */}
                    <div className={`w-10 h-10 rounded-full ${avatarColor} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs`}>
                      {countryCode}
                    </div>

                    {/* Chat Item Details */}
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
                          <span>{conv.lastMessage || "Reply message"}</span>
                        </p>

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
            RIGHT PANE: INTERACTIVE CHAT WIZARD & CONVERSATION FEED
            ======================================================================= */}
        <div className={`flex-1 flex flex-col bg-slate-100/70 dark:bg-[#0c101c] relative h-full overflow-hidden ${
          !activeChat ? "hidden md:flex" : "flex"
        }`}>
          
          {!activeChat ? (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-200/80 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 shadow-inner">
                <MessageSquare className="w-8 h-8 stroke-1" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h4 className="text-base font-bold text-slate-800 dark:text-white">
                  Campaign Response Wizard
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Select a responding customer from the left list to read their response and reply directly.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Responses routed securely via original campaign sender account</span>
              </div>
            </div>
          ) : (
            /* Active Chat View */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* Header */}
              <div className="h-12 px-4 bg-white dark:bg-[#111726] border-b border-slate-200/90 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-xs z-10">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={() => setActiveChat(null)}
                    className="md:hidden p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div className={`w-8 h-8 rounded-full ${getAvatarColor(activeChat.phone)} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs`}>
                    {activeChat.phone.replace(/\D/g, "").slice(0, 2) || "91"}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate">
                      {activeChat.contactName && activeChat.contactName !== "Customer" ? activeChat.contactName : formatPhoneDisplay(activeChat.phone)}
                    </h4>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>
                        via {activeSendingInstance?.displayName || activeSendingInstance?.instanceName || "WhatsApp"} ({formatPhoneDisplay(activeSendingInstance?.phoneNumber || "")})
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowQuickReplies(!showQuickReplies)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Quick reply templates"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Message Feed Area */}
              <div ref={chatContainerRef} onScroll={handleChatScroll} className="flex-1 p-3.5 overflow-y-auto min-h-0 space-y-3 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] bg-[size:16px_16px]">
                {loadingMessages ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <MessageSquare className="w-6 h-6 text-slate-400" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No message history</p>
                    <p className="text-[11px] text-slate-400">Type a response below to reply directly to this customer.</p>
                  </div>
                ) : (
                  <>
                    {/* Load Earlier Messages Banner */}
                    {hasMoreOlder && (
                      <div className="flex justify-center my-2">
                        <button
                          onClick={handleLoadOlderMessages}
                          disabled={loadingOlder}
                          className="px-3.5 py-1.5 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold shadow-2xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {loadingOlder ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                          <span>Load earlier messages</span>
                        </button>
                      </div>
                    )}

                    {messages.map((msg, idx) => {
                      const isOutgoing = msg.direction === "OUTGOING";
                      const isFirst = idx === 0 || formatDateHeader(messages[idx - 1]?.createdAt) !== formatDateHeader(msg.createdAt);

                      return (
                        <React.Fragment key={msg.id || idx}>
                          {isFirst && (
                            <div className="flex justify-center my-2">
                              <span className="px-2.5 py-0.5 rounded-full bg-slate-200/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 text-[9px] font-bold uppercase tracking-wider">
                                {formatDateHeader(msg.createdAt)}
                              </span>
                            </div>
                          )}

                          <div className={`flex items-end gap-1.5 group ${isOutgoing ? "justify-end" : "justify-start"}`}>
                            {!isOutgoing && (
                              <button
                                onClick={() => setReplyingTo(msg)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 hover:text-emerald-600 cursor-pointer shadow-2xs mb-1"
                                title="Reply to this message"
                              >
                                <Reply className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <div
                              className={`max-w-[80%] rounded-2xl p-2.5 space-y-1 shadow-2xs relative ${
                                isOutgoing
                                  ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-white rounded-tr-xs"
                                  : "bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white rounded-tl-xs border border-slate-100 dark:border-slate-800"
                              }`}
                            >
                              {/* Quoted / Tagged Message Banner */}
                              {(msg.quotedContent || msg.quotedMessageId) && (
                                <div className="mb-1.5 px-2.5 py-1.5 rounded-lg bg-black/5 dark:bg-black/30 border-l-4 border-emerald-500 text-xs flex flex-col select-none">
                                  <span className="font-bold text-emerald-700 dark:text-emerald-400 text-[11px]">
                                    {msg.quotedSender || (isOutgoing ? "Customer" : "You")}
                                  </span>
                                  <span className="line-clamp-2 text-slate-700 dark:text-slate-300 text-[11px] mt-0.5">
                                    {msg.quotedContent || "Referenced message"}
                                  </span>
                                </div>
                              )}

                              {msg.mediaUrl && (
                                <div className="rounded-xl overflow-hidden mb-1 border border-black/5 dark:border-white/5">
                                  {msg.mediaUrl.startsWith("data:image/") || /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(msg.mediaUrl) ? (
                                    <img
                                      src={msg.mediaUrl}
                                      alt="Attachment"
                                      className="max-h-52 w-full object-cover"
                                    />
                                  ) : (
                                    <div className="p-2.5 bg-slate-100 dark:bg-slate-800 flex items-center gap-2 rounded-lg">
                                      <FileText className="w-5 h-5 text-emerald-600" />
                                      <span className="text-xs font-bold truncate">Attachment Document</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {msg.campaignName && (
                                <div className="flex items-center gap-1 px-1.5 py-0.5 mb-1 rounded bg-purple-100/80 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200 text-[9px] font-bold w-fit">
                                  <span>📢</span>
                                  <span>{msg.campaignName}</span>
                                </div>
                              )}
                              {msg.content && (
                                <p className="text-xs font-normal whitespace-pre-wrap leading-relaxed select-text">
                                  {msg.content}
                                </p>
                              )}

                              <div className="flex items-center justify-end gap-1 pt-0.5 text-[9px] font-mono text-slate-500 dark:text-slate-300/80">
                                <span>{formatTime(msg.createdAt || msg.sentAt)}</span>
                                {isOutgoing && (
                                  <span>
                                    {msg.status === "READ" ? (
                                      <span title="Read"><CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" /></span>
                                    ) : msg.status === "DELIVERED" ? (
                                      <span title="Delivered"><CheckCheck className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400" /></span>
                                    ) : msg.status === "FAILED" ? (
                                      <span className="text-rose-500 font-bold text-[10px]" title="Failed to deliver">!</span>
                                    ) : (
                                      <span title="Sent"><Check className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400" /></span>
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>

                            {isOutgoing && (
                              <button
                                onClick={() => setReplyingTo(msg)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 hover:text-emerald-600 cursor-pointer shadow-2xs mb-1"
                                title="Reply to this message"
                              >
                                <Reply className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </>
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

              {/* Quick Replies Drawer */}
              {showQuickReplies && (
                <div className="p-2.5 bg-white dark:bg-[#111726] border-t border-slate-200 dark:border-slate-800 shadow-md shrink-0 animate-in slide-in-from-bottom-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Quick Reply Templates
                    </span>
                    <button
                      onClick={() => setShowQuickReplies(false)}
                      className="text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                    {QUICK_REPLIES.map((qr, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setInputText(qr.text);
                          setShowQuickReplies(false);
                        }}
                        className="p-1.5 text-left rounded-lg bg-slate-50 dark:bg-slate-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200/80 dark:border-slate-700/80 transition-colors"
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

              {/* Replying Banner */}
              {replyingTo && (
                <div className="px-3.5 py-2 bg-slate-100 dark:bg-[#1a2234] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 animate-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-2 min-w-0 border-l-4 border-emerald-500 pl-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Replying to {replyingTo.direction === "OUTGOING" ? "You" : (activeChat?.contactName && activeChat.contactName !== "Customer" ? activeChat.contactName : formatPhoneDisplay(activeChat?.phone || ""))}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-md">
                        {replyingTo.content || (replyingTo.mediaUrl ? "📷 Attachment" : "Message")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Selected File Chip */}
              {selectedFile && (
                <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border-t border-emerald-200 dark:border-emerald-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedFile.isImage ? (
                      <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 truncate">
                      {selectedFile.name}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-slate-400 hover:text-rose-500 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Pinned Bottom Input Bar */}
              <div className="p-2.5 bg-white dark:bg-[#111726] border-t border-slate-200/90 dark:border-slate-800 flex items-end gap-2 shrink-0 z-10">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,video/*,application/pdf,.doc,.docx"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Attach file from computer"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

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
                  placeholder="Reply to customer... (Press Enter to send)"
                  className="flex-1 bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-white placeholder:text-slate-400 text-xs py-2 px-3 rounded-xl border border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden resize-none max-h-20 transition-all"
                />

                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={sending || (!inputText.trim() && !selectedFile)}
                  className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
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
