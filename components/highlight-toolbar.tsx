"use client";

import { Button } from "@/components/ui/button";
import { HIGHLIGHT_COLORS } from "@/lib/highlight-utils";
import type { Highlight } from "@/lib/highlight-utils";

interface HighlightToolbarProps {
  position: { x: number; y: number };
  onHighlight: (type: Highlight["type"]) => void;
  onClose: () => void;
}

export function HighlightToolbar({
  position,
  onHighlight,
  onClose,
}: HighlightToolbarProps) {
  return (
    <div
      className="highlight-toolbar fixed z-50 flex gap-1 rounded-lg border bg-popover p-1 shadow-lg animate-in fade-in zoom-in-95"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent selection loss
    >
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => {
          onHighlight("insight");
          onClose();
        }}
        title="Key Insight - conclusions, answers, decisions"
      >
        <span className="text-base">{HIGHLIGHT_COLORS.insight.icon}</span>
        <span className="hidden sm:inline">{HIGHLIGHT_COLORS.insight.label}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => {
          onHighlight("context");
          onClose();
        }}
        title="Important Context - reasoning, background"
      >
        <span className="text-base">{HIGHLIGHT_COLORS.context.icon}</span>
        <span className="hidden sm:inline">{HIGHLIGHT_COLORS.context.label}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => {
          onHighlight("action");
          onClose();
        }}
        title="Action Item - todos, follow-ups"
      >
        <span className="text-base">{HIGHLIGHT_COLORS.action.icon}</span>
        <span className="hidden sm:inline">{HIGHLIGHT_COLORS.action.label}</span>
      </Button>
    </div>
  );
}
