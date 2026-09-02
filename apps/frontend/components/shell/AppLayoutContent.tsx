"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, BroadcastUser } from "@/lib/auth-context";
import { AppShell } from "./AppShell";
import { Loader2 } from "lucide-react";

const PUBLIC_ROUTES = ["/", "/welcome", "/login", "/signup", "/sso"];

interface AppLayoutContentProps {
  children: React.ReactNode;
  ssoSession?: BroadcastUser | null;
}

export function AppLayoutContent({ children, ssoSession }: AppLayoutContentProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user: authUser, isAuthenticated, isLoading } = useAuth();

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  // Strict Auth Guard: Redirect unauthenticated users from protected routes to /login
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublicRoute) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, isPublicRoute, router]);

  // If public route (e.g. /, /welcome, /login, /signup, /sso), render directly without sidebar
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // If loading authentication on a protected route, show smooth loader
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <p className="text-xs font-semibold">Verifying secure broadcast session...</p>
      </div>
    );
  }

  // If unauthenticated on protected route, return null while redirecting
  if (!isAuthenticated) {
    return null;
  }

  const user = authUser
    ? { fullName: authUser.fullName, email: authUser.email }
    : ssoSession
    ? { fullName: ssoSession.fullName, email: ssoSession.email }
    : null;

  return <AppShell user={user}>{children}</AppShell>;
}
