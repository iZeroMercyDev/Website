import type { Metadata } from "next";
import { MyListView } from "@/features/my-list/components/my-list-view";

export const metadata: Metadata = { title: "My List • Bankai" };

export default function MyListPage() {
  return <MyListView />;
}
