import type { Metadata } from "next";
import { HistoryView } from "@/features/history/components/history-view";

export const metadata: Metadata = { title: "Watch History • Bankai" };

export default function HistoryPage() {
  return <HistoryView />;
}
