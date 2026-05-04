import type { Metadata } from "next";
import { SaberXPreview } from "@/components/prototype/saberx-preview";

export const metadata: Metadata = {
  title: "SaberX Preview",
  description: "Interactive SaberX product visualization."
};

export default function PreviewPage() {
  return <SaberXPreview />;
}
