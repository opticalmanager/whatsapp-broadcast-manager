import { InboxView } from "@/components/inbox/InboxView";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inbox | WhatsApp Broadcast Manager",
  description: "Live 2-way WhatsApp chat and campaign management via Official Meta Cloud API (WABA)",
};

export default function InboxPage() {
  return <InboxView />;
}
