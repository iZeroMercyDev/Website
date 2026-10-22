import type { Metadata } from "next";
import { AuthModal } from "@/features/auth/components/auth-modal";

export const metadata: Metadata = { title: "Log In • Bankai" };

export default function LoginPage() {
  return <AuthModal mode="login" />;
}
