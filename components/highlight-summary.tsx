"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateSummary } from "@/lib/highlight-utils";
import type { Highlight } from "@/lib/highlight-utils";

interface HighlightSummaryProps {
  highlights: Highlight[];
}

export function HighlightSummary({ highlights }: HighlightSummaryProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (highlights.length === 0) return null;

  const summary = generateSummary(highlights);

  return (
    <div className="highlight-summary mb-6 rounded-lg border bg-muted/30 overflow-hidden no-print">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        <h3 className="text-sm font-semibold">
          📋 Summary (from {highlights.length} highlight
          {highlights.length !== 1 ? "s" : ""})
        </h3>
        <Button variant="ghost" size="sm" className="h-auto p-0">
          {collapsed ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronUp className="size-4" />
          )}
        </Button>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 prose prose-sm dark:prose-invert max-w-none">
          {summary.split("\n\n").map((section, i) => {
            // Parse markdown-style headers and bullets
            if (section.startsWith("**") && section.endsWith("**")) {
              const title = section.slice(2, -2);
              return (
                <h4 key={i} className="font-semibold mt-3 mb-1">
                  {title}
                </h4>
              );
            } else if (section.startsWith("•")) {
              const items = section
                .split("\n")
                .filter((line) => line.startsWith("•"));
              return (
                <ul key={i} className="list-none space-y-1 ml-0">
                  {items.map((item, j) => (
                    <li key={j} className="text-sm">
                      {item}
                    </li>
                  ))}
                </ul>
              );
            }
            return null;
          })}
        </div>
      )}
    </div>
  );
}
