import type { Metadata } from "next";
import "./globals.css";
import { cookies } from "next/headers";
import { AuthProvider, BroadcastUser } from "@/lib/auth-context";
import { AppLayoutContent } from "@/components/shell/AppLayoutContent";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "WhatsApp Broadcast Manager | 100% Cloud Bulk Messaging",
  description: "Send bulk WhatsApp messages to multiple contacts in 3 simple steps with 100% cloud delivery and smart anti-ban protection.",
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();

  // Check for CRM SSO session cookie (existing users)
  const sessionCookie = cookieStore.get("broadcasting_session")?.value;
  let ssoSession: BroadcastUser | null = null;

  if (sessionCookie) {
    try {
      const parsed = JSON.parse(sessionCookie);
      if (parsed && parsed.organizationId) {
        ssoSession = {
          sub: parsed.userId || parsed.sub || "",
          email: parsed.email || "",
          fullName: parsed.fullName || "",
          organizationId: parsed.organizationId,
          shopId: parsed.shopId || null,
          role: parsed.role || "OWNER",
        };
      }
    } catch {
      ssoSession = null;
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-slate-50 dark:bg-[#090d16] text-slate-900 dark:text-slate-100 min-h-screen antialiased flex flex-col font-sans transition-colors duration-200">
        <AuthProvider ssoSession={ssoSession}>
          <AppLayoutContent ssoSession={ssoSession}>
            {children}
          </AppLayoutContent>
        </AuthProvider>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            duration: 3000,
            style: { fontSize: "13px" },
          }}
        />
      </body>
    </html>
  );
}
