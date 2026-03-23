import type { Metadata } from "next";
import MarkdownConverter from "@/components/markdown-converter";

export const metadata: Metadata = {
  title: "Markdown → HTML",
  description:
    "Markdown on the left, styled HTML on the right. Copy to clipboard or download a .html file. Browser-only: no server, no tracking.",
};

export default function Page() {
  return <MarkdownConverter />;
}
