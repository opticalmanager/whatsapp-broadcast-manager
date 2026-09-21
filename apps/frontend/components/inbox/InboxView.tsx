"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { getBackendUrl } from "@/lib/backend-url";
import { useAuth } from "@/lib/auth-context";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import {
  Search,
  MessageSquare,
  MessageSquarePlus,
  Send,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Check,
  CheckCheck,
  Reply,
  X,
  Zap,
  Trash2,
  RefreshCw,
  ChevronDown,
  ArrowLeft,
  Loader2,
  Sparkles,
  ShieldCheck,
  Clock,
  AlertCircle
} from "lucide-react";
import { TemplateModal } from "./TemplateModal";
import { NewChatModal } from "./NewChatModal";

export interface ChatConversation {
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
  status: "AWAITING_REPLY" | "REPLIED" | "ARCHIVED" | "OPEN";
  tags: string[];
  isGroup: boolean;
  isBusiness: boolean;
  campaignName?: string;
  customerWindowExpiresAt?: string;
  isWindowActive?: boolean;
}

export interface ChatMessage {
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
  mediaMimeType?: string;
  mediaFilename?: string;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED";
  campaignName?: string;
  isCampaignBroadcast?: boolean;
  quotedMessageId?: string;
  quotedContent?: string;
  quotedSender?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  createdAt: string;
}

const QUICK_REPLIES = [
  { label: "Welcome Greeting", text: "Hello! Welcome to our store. How can we assist you today?" },
  { label: "Business Hours", text: "We are open Monday to Saturday from 10:00 AM to 8:30 PM. Feel free to visit us!" },
  { label: "Order Ready", text: "Great news! Your customized order is ready for pickup at our store." },
  { label: "Appointment Confirmation", text: "Your appointment has been successfully scheduled. See you soon!" },
  { label: "Special Offer", text: "Exclusive Offer! Enjoy special discounts on all premium items this week." },
];

function formatPhoneDisplay(rawPhone?: string): string {
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

function getAvatarColor(phone?: string): string {
  const colors = [
    "bg-emerald-600",
    "bg-teal-600",
    "bg-cyan-600",
    "bg-blue-600",
    "bg-indigo-600",
    "bg-violet-600",
    "bg-rose-600",
    "bg-amber-600",
  ];
  if (!phone) return colors[0];
  const hash = phone.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export function InboxView() {
  const { user } = useAuth();
  const backendUrl = getBackendUrl();

  // WABA configuration state
  const [wabaConfig, setWabaConfig] = useState<{
    status: string;
    displayPhoneNumber?: string;
    verifiedName?: string;
    phoneNumberId?: string;
  } | null>(null);

  // Conversations & Active Chat State
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeChat, setActiveChat] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // Loading States
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [sending, setSending] = useState(false);

  // Input & Reply States
  const [inputText, setInputText] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ name: string; dataUrl: string; isImage: boolean } | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  // Modal States
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateTarget, setTemplateTarget] = useState<{ phone: string; contactName?: string }>({
    phone: "",
  });

  // Refs for tracking and scroll management
  const activeChatIdRef = useRef<string | null>(null);
  const activeChatRef = useRef<ChatConversation | null>(null);
  const sendingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const isUserNearBottomRef = useRef(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("broadcast_token");
    if (token) return { Authorization: `Bearer ${token}` };
    return {};
  };

  // 1. Fetch WABA Configuration
  const fetchWabaConfig = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/waba/config`, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setWabaConfig(json.data);
        }
      }
    } catch {}
  }, [backendUrl]);

  // 2. Fetch Conversations
  const fetchConversations = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoadingChats(true);
      try {
        const params = new URLSearchParams();
        if (activeFilter && activeFilter !== "all") params.append("filter", activeFilter);
        if (searchQuery) params.append("search", searchQuery);

        const res = await fetch(`${backendUrl}/api/v1/chat/conversations?${params.toString()}`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            setConversations(json.data);

            // Update activeChat reference if it exists in the updated list
            if (activeChatIdRef.current) {
              const updatedActive = json.data.find((c: ChatConversation) => c.id === activeChatIdRef.current);
              if (updatedActive) {
                setActiveChat(updatedActive);
                activeChatRef.current = updatedActive;
              }
            }
          }
        }
      } catch {}
      finally {
        if (showLoading) setLoadingChats(false);
      }
    },
    [backendUrl, activeFilter, searchQuery]
  );

  // 3. Fetch Initial Messages (Latest 30 messages per industry norms)
  const fetchMessages = useCallback(
    async (conversationId: string, showLoading = false) => {
      if (!conversationId) return;
      if (showLoading) setLoadingMessages(true);
      try {
        const res = await fetch(`${backendUrl}/api/v1/chat/conversations/${conversationId}/messages?limit=30`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            if (activeChatIdRef.current === conversationId) {
              // Deduplicate
              const seenIds = new Set<string>();
              const deduped: ChatMessage[] = [];
              for (const m of json.data) {
                const key = m.id || m.messageId;
                if (key && seenIds.has(key)) continue;
                if (key) seenIds.add(key);
                deduped.push(m);
              }

              setMessages(deduped);
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
    },
    [backendUrl]
  );

  // 4. Load Older Messages (Pagination on Scroll Up)
  const handleLoadOlderMessages = async () => {
    if (!activeChat || loadingOlder || messages.length === 0) return;
    setLoadingOlder(true);
    const container = chatContainerRef.current;
    const prevScrollHeight = container?.scrollHeight || 0;

    try {
      const oldestTimestamp = messages[0]?.createdAt;
      const res = await fetch(
        `${backendUrl}/api/v1/chat/conversations/${activeChat.id}/messages?limit=30&before=${encodeURIComponent(
          oldestTimestamp
        )}`,
        { headers: getAuthHeaders() }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const existingIds = new Set(messages.map((m) => m.id || m.messageId));
          const newBatch = json.data.filter((m: ChatMessage) => !existingIds.has(m.id || m.messageId));

          setMessages((prev) => [...newBatch, ...prev]);
          setHasMoreOlder(Boolean(json.hasMore));

          // Preserve scroll offset after prepending items
          requestAnimationFrame(() => {
            if (container) {
              const newScrollHeight = container.scrollHeight;
              container.scrollTop = newScrollHeight - prevScrollHeight;
            }
          });
        } else {
          setHasMoreOlder(false);
        }
      }
    } catch {}
    finally {
      setLoadingOlder(false);
    }
  };

  // 5. Setup WebSocket listener & Polling Fallback
  useEffect(() => {
    fetchWabaConfig();
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
          const idx = prev.findIndex((m) => (m.id && m.id === msg.id) || (msg.messageId && m.messageId === msg.messageId));
          if (idx !== -1) {
            const updated = [...prev];
            updated[idx] = msg;
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

    // Fallback sync polling every 3.5s
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
  }, [backendUrl, fetchConversations, fetchMessages, fetchWabaConfig, user]);

  // Track scroll position
  const handleChatScroll = () => {
    const container = chatContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    isUserNearBottomRef.current = isNearBottom;
    setShowScrollBottomBtn(!isNearBottom);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    isUserNearBottomRef.current = true;
    setShowScrollBottomBtn(false);
  };

  useEffect(() => {
    if (isUserNearBottomRef.current) {
      scrollToBottom("smooth");
    }
  }, [messages]);

  // Select a conversation
  const handleSelectChat = async (conv: ChatConversation) => {
    activeChatIdRef.current = conv.id;
    activeChatRef.current = conv;
    setActiveChat(conv);
    setReplyingTo(null);
    setSelectedFile(null);
    setInputText("");
    fetchMessages(conv.id, true);

    // Mark as read
    try {
      await fetch(`${backendUrl}/api/v1/chat/conversations/${conv.id}/mark-read`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c)));
    } catch {}
  };

  // Handle File Input
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

  // Send Message
  const handleSendMessage = async (customText?: string) => {
    if (sendingRef.current) return;
    const textToSend = customText || inputText.trim();
    const mediaToSend = selectedFile ? selectedFile.dataUrl : undefined;

    if (!textToSend && !mediaToSend) return;
    const currentChat = activeChatRef.current || activeChat;
    if (!currentChat) return;

    sendingRef.current = true;
    setSending(true);

    const replyTarget = replyingTo;
    const cleanPhone = currentChat.phone.replace(/\D/g, "");

    // Optimistic UI bubble
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversationId: currentChat.id,
      organizationId: currentChat.organizationId,
      phone: cleanPhone,
      direction: "OUTGOING",
      senderName: "Agent",
      messageType: mediaToSend ? (selectedFile?.isImage ? "IMAGE" : "DOCUMENT") : "TEXT",
      content: textToSend,
      mediaUrl: mediaToSend,
      status: "SENT",
      quotedMessageId: replyTarget?.messageId || replyTarget?.id,
      quotedContent: replyTarget?.content,
      quotedSender: replyTarget?.senderName,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    setSelectedFile(null);
    setReplyingTo(null);
    scrollToBottom("smooth");

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
          text: textToSend,
          mediaUrl: mediaToSend,
          messageType: mediaToSend ? (selectedFile?.isImage ? "IMAGE" : "DOCUMENT") : "TEXT",
          quotedMessageId: replyTarget?.messageId || replyTarget?.id,
          quotedContent: replyTarget?.content,
          quotedSender: replyTarget?.senderName,
          contactName: currentChat.contactName,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const errMsg = json.message || "Failed to deliver message via Meta WABA";
        toast.error(errMsg);
        // Mark optimistic message as failed
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "FAILED" } : m))
        );
      } else if (json.message) {
        // Replace temp optimistic message with real DB record
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? json.message : m))
        );
      }
      fetchConversations(false);
    } catch (err: any) {
      toast.error(`Network error: ${err.message}`);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "FAILED" } : m))
      );
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  // Clear current chat
  const handleClearCurrentChat = async () => {
    if (!activeChat) return;
    if (!confirm(`Clear all messages for ${activeChat.contactName || activeChat.phone}?`)) return;

    try {
      const res = await fetch(`${backendUrl}/api/v1/chat/conversations/${activeChat.id}/clear`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setMessages([]);
        fetchConversations(false);
        toast.success("Chat messages cleared.");
      }
    } catch {
      toast.error("Failed to clear chat.");
    }
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] w-full flex bg-[#f0f2f5] dark:bg-[#0c1317] overflow-hidden select-none">
      
      {/* =======================================================================
          LEFT PANEL: CONVERSATION LIST & SEARCH
          ======================================================================= */}
      <div
        className={`w-full md:w-96 lg:w-[420px] flex flex-col bg-white dark:bg-[#111b21] border-r border-[#e9edef] dark:border-[#202c33] shrink-0 z-20 ${
          activeChat ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Top Header */}
        <div className="h-16 px-4 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-[#e9edef] dark:border-[#202c33] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#00a884] text-white flex items-center justify-center font-bold shadow-xs">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[#111b21] dark:text-[#e9edef] tracking-tight truncate">
                Inbox
              </h2>
              <div className="flex items-center gap-1.5 text-[11px]">
                {wabaConfig?.status === "CONNECTED" ? (
                  <span className="text-[#00a884] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-pulse" />
                    <span>⚡ {formatPhoneDisplay(wabaConfig.displayPhoneNumber || wabaConfig.verifiedName || "WABA Connected")}</span>
                  </span>
                ) : (
                  <span className="text-slate-400">Official WhatsApp Cloud</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* New Chat Button */}
            <button
              onClick={() => setIsNewChatOpen(true)}
              className="p-2 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="New chat / Send to new number"
            >
              <MessageSquarePlus className="w-5 h-5 text-[#00a884]" />
            </button>

            {/* Refresh */}
            <button
              onClick={() => fetchConversations(true)}
              className="p-2 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Refresh conversations"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-2.5 bg-white dark:bg-[#111b21] border-b border-[#f0f2f5] dark:border-[#202c33]">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-[#54656f] dark:text-[#aebac1] absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Search or start a new chat"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f0f2f5] dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] placeholder:text-[#54656f] dark:placeholder:text-[#aebac1] text-xs py-2 pl-9 pr-3 rounded-lg border-none focus:outline-hidden"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-3 py-2 border-b border-[#e9edef] dark:border-[#202c33] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: "all", label: "All" },
            { id: "unread", label: "Unread" },
            { id: "campaigns", label: "Campaigns" },
            { id: "awaiting_reply", label: "Awaiting Reply" },
          ].map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#00a884] text-white shadow-2xs"
                    : "bg-[#f0f2f5] dark:bg-[#202c33] text-[#54656f] dark:text-[#aebac1] hover:bg-[#e9edef] dark:hover:bg-[#2a3942]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Conversation List Feed */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#f0f2f5] dark:divide-[#202c33]/50">
          {loadingChats && conversations.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#00a884] mx-auto" />
              <p className="text-xs text-slate-400">Loading live conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#f0f2f5] dark:bg-[#202c33] flex items-center justify-center mx-auto text-slate-400">
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No chats found</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                Click the &ldquo;+&rdquo; button above to start a conversation with any number, or launch a campaign to reach your audience.
              </p>
              <button
                onClick={() => setIsNewChatOpen(true)}
                className="mt-2 px-3.5 py-1.5 rounded-xl bg-[#00a884] text-white text-xs font-bold hover:bg-[#02906f] transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <MessageSquarePlus className="w-4 h-4" />
                <span>New Conversation</span>
              </button>
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = activeChat?.id === conv.id;
              const avatarColor = getAvatarColor(conv.phone);
              const initials = (conv.contactName && conv.contactName !== "Customer"
                ? conv.contactName.slice(0, 2).toUpperCase()
                : conv.phone.replace(/\D/g, "").slice(-2)
              ) || "WA";

              return (
                <div
                  key={conv.id}
                  onClick={() => handleSelectChat(conv)}
                  className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-[#f0f2f5] dark:bg-[#2a3942] border-l-4 border-[#00a884]"
                      : "hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]/60"
                  }`}
                >
                  {/* Circle Avatar */}
                  <div
                    className={`w-11 h-11 rounded-full ${avatarColor} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs`}
                  >
                    {initials}
                  </div>

                  {/* Chat Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h4 className="text-xs font-bold text-[#111b21] dark:text-[#e9edef] truncate">
                          {conv.contactName && conv.contactName !== "Customer"
                            ? conv.contactName
                            : formatPhoneDisplay(conv.phone)}
                        </h4>
                        {conv.campaignName && (
                          <span className="px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 font-bold text-[9px] truncate max-w-[110px] shrink-0">
                            📢 {conv.campaignName}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#667781] dark:text-[#8696a0] shrink-0">
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-[#667781] dark:text-[#8696a0] truncate flex items-center gap-1">
                        {conv.lastMessageDirection === "OUTGOING" && (
                          <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb] shrink-0" />
                        )}
                        <span className="truncate">{conv.lastMessage || "Media attachment"}</span>
                      </p>

                      {/* Unread Pill */}
                      {conv.unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-[#00a884] text-white font-bold text-[10px] shrink-0">
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
          RIGHT PANEL: ACTIVE CHAT THREAD VIEW
          ======================================================================= */}
      <div
        className={`flex-1 flex flex-col bg-[#efeae2] dark:bg-[#0b141a] relative h-full overflow-hidden ${
          !activeChat ? "hidden md:flex" : "flex"
        }`}
      >
        {!activeChat ? (
          /* WhatsApp Web Empty State */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-[#f0f2f5] dark:bg-[#111b21]">
            <div className="w-24 h-24 rounded-full bg-slate-200/80 dark:bg-slate-800/80 flex items-center justify-center text-[#00a884] shadow-inner">
              <MessageSquare className="w-12 h-12 stroke-1" />
            </div>

            <div className="space-y-2 max-w-md">
              <h2 className="text-xl font-bold text-[#111b21] dark:text-[#e9edef] tracking-tight">
                WhatsApp Web for Business
              </h2>
              <p className="text-xs text-[#667781] dark:text-[#8696a0] leading-relaxed">
                Send and receive messages seamlessly through your Official Meta Cloud API (WABA).
                Select a conversation on the left or click New Chat to message any number.
              </p>
            </div>

            <button
              onClick={() => setIsNewChatOpen(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-[#00a884] hover:bg-[#02906f] text-white text-xs font-bold shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span>Start New Conversation</span>
            </button>

            <div className="mt-8 flex items-center gap-1.5 text-[11px] font-semibold text-[#8696a0]">
              <ShieldCheck className="w-4 h-4 text-[#00a884]" />
              <span>Official WhatsApp Business Cloud API &bull; End-to-End Enterprise Delivery</span>
            </div>
          </div>
        ) : (
          /* Active Chat View */
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            
            {/* 1. Chat Header */}
            <div className="h-16 px-4 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-[#e9edef] dark:border-[#202c33] flex items-center justify-between shrink-0 shadow-xs z-10">
              {/* Left: Back button + Avatar + Details */}
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setActiveChat(null)}
                  className="md:hidden p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[#54656f] dark:text-[#aebac1]"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div
                  className={`w-10 h-10 rounded-full ${getAvatarColor(
                    activeChat.phone
                  )} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs`}
                >
                  {(activeChat.contactName && activeChat.contactName !== "Customer"
                    ? activeChat.contactName.slice(0, 2).toUpperCase()
                    : activeChat.phone.replace(/\D/g, "").slice(-2)
                  ) || "WA"}
                </div>

                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[#111b21] dark:text-[#e9edef] truncate">
                    {activeChat.contactName && activeChat.contactName !== "Customer"
                      ? activeChat.contactName
                      : formatPhoneDisplay(activeChat.phone)}
                  </h3>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="font-mono text-[#667781] dark:text-[#8696a0]">
                      {formatPhoneDisplay(activeChat.phone)}
                    </span>
                    
                    {/* 24-Hour Customer Service Window Badge */}
                    {activeChat.isWindowActive ? (
                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>24h Care Window Active</span>
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>24h Window Expired</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-1.5">
                {/* Send Approved Template Button */}
                <button
                  onClick={() => {
                    setTemplateTarget({ phone: activeChat.phone, contactName: activeChat.contactName });
                    setIsTemplateModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#111b21] border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#202c33] transition-colors shadow-2xs cursor-pointer"
                  title="Send pre-approved Meta template"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#00a884]" />
                  <span className="hidden sm:inline">Send Template</span>
                </button>

                {/* Quick Replies */}
                <button
                  onClick={() => setShowQuickReplies(!showQuickReplies)}
                  className="p-2 rounded-xl text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="Quick replies"
                >
                  <Zap className="w-4 h-4 text-amber-500" />
                </button>

                {/* Clear Chat */}
                <button
                  onClick={handleClearCurrentChat}
                  className="p-2 rounded-xl text-[#54656f] dark:text-[#aebac1] hover:text-rose-500 hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                  title="Clear chat messages"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 24h Window Expired Alert Banner */}
            {!activeChat.isWindowActive && (
              <div className="px-4 py-2 bg-amber-50 dark:bg-[#1f1b13] border-b border-amber-200/80 dark:border-amber-900/50 flex items-center justify-between gap-2 shrink-0 z-10 text-xs text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="truncate">
                    <strong>24-Hour Window Closed:</strong> Free text messages may be rejected by Meta. Send an approved template to re-engage this contact.
                  </span>
                </div>
                <button
                  onClick={() => {
                    setTemplateTarget({ phone: activeChat.phone, contactName: activeChat.contactName });
                    setIsTemplateModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shrink-0 cursor-pointer shadow-2xs"
                >
                  Send Template
                </button>
              </div>
            )}

            {/* 2. Message History Stream */}
            <div
              ref={chatContainerRef}
              onScroll={handleChatScroll}
              className="flex-1 p-4 overflow-y-auto min-h-0 space-y-3 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] bg-[size:16px_16px]"
            >
              {loadingMessages ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[#00a884]" />
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-white dark:bg-[#202c33] flex items-center justify-center text-slate-400 shadow-xs">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No message history yet</p>
                  <p className="text-[11px] text-slate-400 max-w-xs">
                    Type a message below to chat directly with +{activeChat.phone.replace(/\D/g, "")} via Meta Cloud API.
                  </p>
                </div>
              ) : (
                <>
                  {/* Load Earlier Messages Button */}
                  {hasMoreOlder && (
                    <div className="flex justify-center my-2">
                      <button
                        onClick={handleLoadOlderMessages}
                        disabled={loadingOlder}
                        className="px-3.5 py-1.5 rounded-full bg-white dark:bg-[#202c33] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold shadow-2xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {loadingOlder ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00a884]" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5 text-[#00a884]" />
                        )}
                        <span>Load earlier messages</span>
                      </button>
                    </div>
                  )}

                  {messages.map((msg, idx) => {
                    const isOutgoing = msg.direction === "OUTGOING";
                    const isFirst =
                      idx === 0 || formatDateHeader(messages[idx - 1]?.createdAt) !== formatDateHeader(msg.createdAt);

                    return (
                      <React.Fragment key={msg.id || idx}>
                        {/* Date Pill */}
                        {isFirst && (
                          <div className="flex justify-center my-3">
                            <span className="px-3 py-1 rounded-full bg-white/90 dark:bg-[#182229]/90 text-[#54656f] dark:text-[#8696a0] text-[10px] font-bold shadow-2xs uppercase tracking-wider">
                              {formatDateHeader(msg.createdAt)}
                            </span>
                          </div>
                        )}

                        {/* Message Bubble */}
                        <div className={`flex items-end gap-1.5 group ${isOutgoing ? "justify-end" : "justify-start"}`}>
                          {!isOutgoing && (
                            <button
                              onClick={() => setReplyingTo(msg)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-white/80 dark:bg-[#202c33] text-[#54656f] dark:text-[#aebac1] hover:text-[#00a884] cursor-pointer shadow-2xs mb-1"
                              title="Reply to message"
                            >
                              <Reply className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <div
                            className={`max-w-[78%] rounded-2xl p-3 space-y-1 shadow-2xs relative ${
                              isOutgoing
                                ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-[#111b21] dark:text-[#e9edef] rounded-tr-xs"
                                : "bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] rounded-tl-xs"
                            }`}
                          >
                            {/* Quoted Message */}
                            {(msg.quotedContent || msg.quotedMessageId) && (
                              <div className="mb-1.5 px-2.5 py-1.5 rounded-lg bg-black/5 dark:bg-black/30 border-l-4 border-[#00a884] text-xs flex flex-col select-none">
                                <span className="font-bold text-[#00a884] dark:text-[#25d366] text-[11px]">
                                  {msg.quotedSender || (isOutgoing ? "Customer" : "You")}
                                </span>
                                <span className="line-clamp-2 text-[#54656f] dark:text-[#aebac1] text-[11px] mt-0.5">
                                  {msg.quotedContent || "Referenced message"}
                                </span>
                              </div>
                            )}

                            {/* Campaign Broadcast Banner */}
                            {(msg.isCampaignBroadcast || msg.campaignName) && (
                              <div className="flex items-center gap-1.5 px-2 py-1 mb-1 rounded-md bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-200 text-[10px] font-bold border border-purple-200/60 dark:border-purple-800/60">
                                <span>📢</span>
                                <span>Campaign Broadcast: {msg.campaignName || "Campaign Message"}</span>
                              </div>
                            )}

                            {/* Media Preview */}
                            {msg.mediaUrl && (
                              <div className="rounded-xl overflow-hidden mb-1.5 border border-black/5 dark:border-white/5">
                                {msg.mediaUrl.startsWith("data:image/") ||
                                /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(msg.mediaUrl) ? (
                                  <img src={msg.mediaUrl} alt="Attachment" className="max-h-64 w-full object-cover" />
                                ) : (
                                  <div className="p-3 bg-white/50 dark:bg-black/20 flex items-center gap-2 rounded-lg">
                                    <FileText className="w-6 h-6 text-[#00a884]" />
                                    <span className="text-xs font-bold truncate">Attachment Document</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Message Text */}
                            {msg.content && (
                              <p className="text-xs font-normal whitespace-pre-wrap leading-relaxed select-text">
                                {msg.content}
                              </p>
                            )}

                            {/* Timestamp & Status Checkmarks */}
                            <div className="flex items-center justify-end gap-1 pt-0.5 text-[10px] font-mono text-[#667781] dark:text-[#8696a0]">
                              <span>{formatTime(msg.createdAt || msg.sentAt)}</span>
                              {isOutgoing && (
                                <span>
                                  {msg.status === "READ" ? (
                                    <span title="Read">
                                      <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                                    </span>
                                  ) : msg.status === "DELIVERED" ? (
                                    <span title="Delivered">
                                      <CheckCheck className="w-3.5 h-3.5 text-[#667781] dark:text-[#8696a0]" />
                                    </span>
                                  ) : msg.status === "FAILED" ? (
                                    <span className="text-rose-500 font-bold text-[10px]" title="Delivery failed">
                                      !
                                    </span>
                                  ) : (
                                    <span title="Sent">
                                      <Check className="w-3.5 h-3.5 text-[#667781] dark:text-[#8696a0]" />
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          {isOutgoing && (
                            <button
                              onClick={() => setReplyingTo(msg)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-white/80 dark:bg-[#202c33] text-[#54656f] dark:text-[#aebac1] hover:text-[#00a884] cursor-pointer shadow-2xs mb-1"
                              title="Reply to message"
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

              {/* Jump to bottom button */}
              {showScrollBottomBtn && (
                <button
                  onClick={() => scrollToBottom("smooth")}
                  className="fixed bottom-24 right-8 z-30 p-2.5 rounded-full bg-white dark:bg-[#202c33] text-[#111b21] dark:text-[#e9edef] shadow-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4 text-[#00a884]" />
                  <span>Latest</span>
                </button>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Replies Drawer */}
            {showQuickReplies && (
              <div className="p-3 bg-white dark:bg-[#111b21] border-t border-[#e9edef] dark:border-[#202c33] shadow-md shrink-0 animate-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Quick Reply Templates
                  </span>
                  <button onClick={() => setShowQuickReplies(false)} className="text-slate-400 hover:text-slate-600 p-1">
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
                      className="p-2 text-left rounded-xl bg-[#f0f2f5] dark:bg-[#202c33] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200/80 dark:border-slate-700/80 transition-colors"
                    >
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
                        {qr.label}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">{qr.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Replying Banner */}
            {replyingTo && (
              <div className="px-3.5 py-2 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-[#e9edef] dark:border-[#202c33] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0 border-l-4 border-[#00a884] pl-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#00a884]">
                      Replying to{" "}
                      {replyingTo.direction === "OUTGOING"
                        ? "You"
                        : activeChat?.contactName || formatPhoneDisplay(activeChat?.phone)}
                    </p>
                    <p className="text-[11px] text-[#667781] dark:text-[#8696a0] truncate max-w-md">
                      {replyingTo.content || (replyingTo.mediaUrl ? "📷 Attachment" : "Message")}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Attached File Preview Chip */}
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
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Pinned Bottom Interactive Input Bar */}
            <div className="p-3 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-[#e9edef] dark:border-[#202c33] flex items-end gap-2 shrink-0 z-10">
              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Attachment Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Attach file (image or PDF)"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {/* Quick Replies Toggle */}
              <button
                type="button"
                onClick={() => setShowQuickReplies(!showQuickReplies)}
                className="p-2.5 rounded-full text-[#54656f] dark:text-[#aebac1] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Quick replies"
              >
                <Zap className="w-5 h-5 text-amber-500" />
              </button>

              {/* Textarea Input */}
              <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-xl px-3.5 py-2 shadow-2xs flex items-center min-h-[42px]">
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
                  placeholder="Type a message (Enter to send, Shift+Enter for newline)"
                  className="w-full bg-transparent text-[#111b21] dark:text-[#e9edef] placeholder:text-[#54656f] dark:placeholder:text-[#aebac1] text-xs resize-none focus:outline-hidden max-h-24 leading-relaxed"
                />
              </div>

              {/* Send Button */}
              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={sending || (!inputText.trim() && !selectedFile)}
                className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#02906f] text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =======================================================================
          MODALS
          ======================================================================= */}
      {/* 1. New Chat Modal */}
      <NewChatModal
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)}
        onChatInitiated={(newConv) => {
          handleSelectChat(newConv);
          fetchConversations(false);
        }}
        onSendTemplateRequested={(phone, contactName) => {
          setTemplateTarget({ phone, contactName });
          setIsTemplateModalOpen(true);
        }}
      />

      {/* 2. Template Selector Modal */}
      <TemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        phone={templateTarget.phone}
        contactName={templateTarget.contactName}
        onSuccess={() => {
          if (activeChat) {
            fetchMessages(activeChat.id, false);
          }
          fetchConversations(false);
        }}
      />
    </div>
  );
}
