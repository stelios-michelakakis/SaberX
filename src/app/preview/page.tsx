import type { Metadata } from "next";
import { SaberXPreview } from "@/components/prototype/saberx-preview";

export const metadata: Metadata = {
  title: "EDF SABER Preview",
  description: "Interactive EDF SABER product visualization."
};

export default function PreviewPage() {
  return <SaberXPreview />;
}
