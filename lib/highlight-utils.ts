// Highlight system utilities

export interface Highlight {
  id: string;
  type: "insight" | "context" | "action";
  selectedText: string;
  textFragment: string; // surrounding context for re-location
  note?: string;
  createdAt: number;
}

export const HIGHLIGHT_COLORS = {
  insight: {
    bg: "bg-emerald-200/60 dark:bg-emerald-500/30",
    border: "border-l-2 border-emerald-500",
    label: "Key Insight",
    icon: "🟢",
  },
  context: {
    bg: "bg-amber-200/60 dark:bg-amber-500/30",
    border: "border-l-2 border-amber-500",
    label: "Important Context",
    icon: "🟡",
  },
  action: {
    bg: "bg-rose-200/60 dark:bg-rose-500/30",
    border: "border-l-2 border-rose-500",
    label: "Action Item",
    icon: "🔴",
  },
} as const;

/**
 * Generate a text fragment for re-locating highlights
 * Includes 30 chars before and after for context matching
 */
export function createTextFragment(
  fullText: string,
  selectedText: string,
  selectionStart: number
): string {
  const before = fullText.slice(Math.max(0, selectionStart - 30), selectionStart);
  const after = fullText.slice(
    selectionStart + selectedText.length,
    selectionStart + selectedText.length + 30
  );
  return `${before}|||${selectedText}|||${after}`;
}

/**
 * Find the position of a highlight in text using its fragment
 */
export function locateHighlight(fullText: string, fragment: string): number {
  const [before, selected, after] = fragment.split("|||");
  
  // Try exact match with context
  const withContext = `${before}${selected}${after}`;
  let pos = fullText.indexOf(withContext);
  if (pos >= 0) {
    return pos + before.length;
  }
  
  // Fallback: try just the selected text
  pos = fullText.indexOf(selected);
  return pos;
}

/**
 * Save highlights to localStorage
 */
export function saveHighlights(highlights: Highlight[]): void {
  try {
    localStorage.setItem("sd-highlights", JSON.stringify(highlights));
  } catch (err) {
    console.error("Failed to save highlights:", err);
  }
}

/**
 * Load highlights from localStorage
 */
export function loadHighlights(): Highlight[] {
  try {
    const stored = localStorage.getItem("sd-highlights");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error("Failed to load highlights:", err);
  }
  return [];
}

/**
 * Clear all highlights from localStorage
 */
export function clearHighlights(): void {
  localStorage.removeItem("sd-highlights");
}

/**
 * Apply highlights to rendered HTML
 * Walks the DOM and wraps matching text nodes with <mark> elements
 */
export function applyHighlightsToDOM(
  container: HTMLElement,
  highlights: Highlight[]
): void {
  if (highlights.length === 0) return;

  // Get all text content to build a map
  const textNodes: { node: Text; offset: number }[] = [];
  let currentOffset = 0;

  function collectTextNodes(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      textNodes.push({
        node: node as Text,
        offset: currentOffset,
      });
      currentOffset += (node as Text).length;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Skip already-highlighted content and certain elements
      const el = node as HTMLElement;
      if (
        el.tagName === "MARK" ||
        el.tagName === "SCRIPT" ||
        el.tagName === "STYLE" ||
        el.classList.contains("highlight-toolbar") ||
        el.classList.contains("highlight-summary")
      ) {
        return;
      }
      node.childNodes.forEach(collectTextNodes);
    }
  }

  collectTextNodes(container);

  // Build full text from text nodes
  const fullText = textNodes.map((tn) => tn.node.textContent).join("");

  // Sort highlights by position (using text fragment to locate)
  const positionedHighlights = highlights
    .map((h) => ({
      highlight: h,
      position: locateHighlight(fullText, h.textFragment),
    }))
    .filter((ph) => ph.position >= 0)
    .sort((a, b) => b.position - a.position); // Process from end to start

  // Apply each highlight
  positionedHighlights.forEach(({ highlight, position }) => {
    const endPosition = position + highlight.selectedText.length;

    // Find the text nodes that contain this range
    let startNode: Text | null = null;
    let startOffset = 0;
    let endNode: Text | null = null;
    let endOffset = 0;

    for (const { node, offset } of textNodes) {
      const nodeEnd = offset + node.length;

      if (!startNode && position >= offset && position < nodeEnd) {
        startNode = node;
        startOffset = position - offset;
      }

      if (endPosition >= offset && endPosition <= nodeEnd) {
        endNode = node;
        endOffset = endPosition - offset;
        break;
      }
    }

    if (!startNode || !endNode) return;

    try {
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);

      const mark = document.createElement("mark");
      mark.className = `highlight-mark highlight-${highlight.type} ${
        HIGHLIGHT_COLORS[highlight.type].bg
      } ${HIGHLIGHT_COLORS[highlight.type].border} px-0.5 rounded-sm cursor-pointer transition-all hover:brightness-95`;
      mark.dataset.highlightId = highlight.id;
      mark.dataset.highlightType = highlight.type;

      range.surroundContents(mark);
    } catch (err) {
      // Range spans multiple nodes or invalid - skip this highlight
      console.warn("Failed to apply highlight:", err);
    }
  });
}

/**
 * Generate a plain-text summary from highlights
 */
export function generateSummary(highlights: Highlight[]): string {
  if (highlights.length === 0) return "";

  const byType = {
    insight: highlights.filter((h) => h.type === "insight"),
    context: highlights.filter((h) => h.type === "context"),
    action: highlights.filter((h) => h.type === "action"),
  };

  let summary = `📋 Summary (from ${highlights.length} highlight${
    highlights.length !== 1 ? "s" : ""
  })\n\n`;

  if (byType.insight.length > 0) {
    summary += "**Key Insights:**\n";
    byType.insight.forEach((h) => {
      const text = h.selectedText.length > 200
        ? h.selectedText.slice(0, 200) + "..."
        : h.selectedText;
      summary += `• "${text}"\n`;
    });
    summary += "\n";
  }

  if (byType.context.length > 0) {
    summary += "**Context:**\n";
    byType.context.forEach((h) => {
      const text = h.selectedText.length > 200
        ? h.selectedText.slice(0, 200) + "..."
        : h.selectedText;
      summary += `• "${text}"\n`;
    });
    summary += "\n";
  }

  if (byType.action.length > 0) {
    summary += "**Action Items:**\n";
    byType.action.forEach((h) => {
      const text = h.selectedText.length > 200
        ? h.selectedText.slice(0, 200) + "..."
        : h.selectedText;
      summary += `• "${text}"\n`;
    });
    summary += "\n";
  }

  return summary.trim();
}
