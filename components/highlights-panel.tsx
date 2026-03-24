"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { HIGHLIGHT_COLORS } from "@/lib/highlight-utils";
import type { Highlight } from "@/lib/highlight-utils";
import { X, Trash2 } from "lucide-react";

interface HighlightsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  highlights: Highlight[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onScrollTo: (id: string) => void;
}

export function HighlightsPanel({
  open,
  onOpenChange,
  highlights,
  onRemove,
  onClearAll,
  onScrollTo,
}: HighlightsPanelProps) {
  const byType = {
    insight: highlights.filter((h) => h.type === "insight"),
    context: highlights.filter((h) => h.type === "context"),
    action: highlights.filter((h) => h.type === "action"),
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col w-80 sm:w-96">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Highlights</SheetTitle>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">
                {highlights.length}
              </span>
              {highlights.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearAll}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Clear all
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto -mx-2 mt-4">
          {highlights.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center px-4">
              <div className="text-4xl">🎨</div>
              <p className="text-sm text-muted-foreground">
                Select text in the preview to add highlights
              </p>
            </div>
          ) : (
            <div className="space-y-6 px-2">
              {byType.insight.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <span>{HIGHLIGHT_COLORS.insight.icon}</span>
                    Key Insights ({byType.insight.length})
                  </h3>
                  <div className="space-y-2">
                    {byType.insight.map((h) => (
                      <HighlightItem
                        key={h.id}
                        highlight={h}
                        onRemove={onRemove}
                        onScrollTo={onScrollTo}
                      />
                    ))}
                  </div>
                </div>
              )}

              {byType.context.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <span>{HIGHLIGHT_COLORS.context.icon}</span>
                    Context ({byType.context.length})
                  </h3>
                  <div className="space-y-2">
                    {byType.context.map((h) => (
                      <HighlightItem
                        key={h.id}
                        highlight={h}
                        onRemove={onRemove}
                        onScrollTo={onScrollTo}
                      />
                    ))}
                  </div>
                </div>
              )}

              {byType.action.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold mb-2">
                    <span>{HIGHLIGHT_COLORS.action.icon}</span>
                    Action Items ({byType.action.length})
                  </h3>
                  <div className="space-y-2">
                    {byType.action.map((h) => (
                      <HighlightItem
                        key={h.id}
                        highlight={h}
                        onRemove={onRemove}
                        onScrollTo={onScrollTo}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function HighlightItem({
  highlight,
  onRemove,
  onScrollTo,
}: {
  highlight: Highlight;
  onRemove: (id: string) => void;
  onScrollTo: (id: string) => void;
}) {
  const truncated =
    highlight.selectedText.length > 100
      ? highlight.selectedText.slice(0, 100) + "..."
      : highlight.selectedText;

  return (
    <div
      className={`group relative rounded-md border p-3 cursor-pointer hover:bg-muted/50 transition-colors ${HIGHLIGHT_COLORS[highlight.type].border}`}
      onClick={() => onScrollTo(highlight.id)}
    >
      <p className="text-sm pr-6">{truncated}</p>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 size-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(highlight.id);
        }}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
