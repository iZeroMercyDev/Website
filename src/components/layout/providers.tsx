"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { useAuthStore } from "@/store/auth-store";

/**
 * Keeps the login saved in the browser in sync with the server session cookie.
 * Someone who logged in before sessions existed is asked to sign in again.
 * (Does nothing while the server runs in legacy mode.)
 */
function SessionCheck() {
  const currentUser = useAuthStore((s) => s.currentUser);

  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { sessionsEnabled?: boolean; user?: { username: string } | null }) => {
        if (cancelled || !d.sessionsEnabled) return;
        if (!d.user) useAuthStore.setState({ currentUser: null, avatar: null });
        else if (d.user.username !== currentUser) useAuthStore.setState({ currentUser: d.user.username });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      themes={["dark", "light", "anilist"]}
    >
      <SessionCheck />
      {children}
    </ThemeProvider>
  );
}
