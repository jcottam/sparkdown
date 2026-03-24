"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { marked } from "marked";
import matter from "gray-matter";
import { createHighlighter, type Highlighter } from "shiki";
import { toast } from "sonner";
import mermaid from "mermaid";
import katex from "katex";
// html2pdf will be dynamically imported on client-side only
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sun,
  Moon,
  Copy,
  Download,
  Trash2,
  ExternalLink,
  Eye,
  FileText,
  Plus,
  List,
  HelpCircle,
  Info,
  ArrowUpDown,
  Columns,
  Edit,
  FileDown,
  Highlighter as HighlighterIcon,
  Type,
  Heading1,
  Heading2,
  Heading3,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Minus,
  Table,
  Sigma,
  GitBranch,
  Save,
} from "lucide-react";
import {
  THEMES,
  SHIKI_EXPORT_CSS,
  KATEX_CSS,
  MERMAID_SCRIPT,
  PDF_PRINT_CSS,
} from "@/lib/themes";
import { HighlightToolbar } from "@/components/highlight-toolbar";
import { HighlightsPanel } from "@/components/highlights-panel";
import { HighlightSummary } from "@/components/highlight-summary";
import {
  type Highlight,
  createTextFragment,
  saveHighlights,
  loadHighlights,
  clearHighlights,
  applyHighlightsToDOM,
} from "@/lib/highlight-utils";

marked.setOptions({ gfm: true, breaks: true });

interface SavedDocument {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

type PaneLayout = "split" | "editor-only" | "preview-only";

interface SlashCommand {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  keywords: string[];
  execute: (lineText: string) => { replacement: string; cursorOffset: number };
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "paragraph",
    label: "Paragraph",
    icon: Type,
    group: "Style",
    keywords: ["paragraph", "text", "plain"],
    execute: (lineText) => {
      const stripped = lineText.replace(
        /^(#{1,6}\s|>\s|- \[[ x]\]\s|- |\d+\.\s)/,
        "",
      );
      return { replacement: stripped || "", cursorOffset: -1 };
    },
  },
  {
    id: "h1",
    label: "Heading 1",
    icon: Heading1,
    group: "Style",
    keywords: ["heading", "h1", "title"],
    execute: () => ({ replacement: "# ", cursorOffset: -1 }),
  },
  {
    id: "h2",
    label: "Heading 2",
    icon: Heading2,
    group: "Style",
    keywords: ["heading", "h2", "subtitle"],
    execute: () => ({ replacement: "## ", cursorOffset: -1 }),
  },
  {
    id: "h3",
    label: "Heading 3",
    icon: Heading3,
    group: "Style",
    keywords: ["heading", "h3"],
    execute: () => ({ replacement: "### ", cursorOffset: -1 }),
  },
  {
    id: "bullet",
    label: "Bullet List",
    icon: List,
    group: "Style",
    keywords: ["bullet", "list", "unordered", "ul"],
    execute: () => ({ replacement: "- ", cursorOffset: -1 }),
  },
  {
    id: "numbered",
    label: "Numbered List",
    icon: ListOrdered,
    group: "Style",
    keywords: ["numbered", "list", "ordered", "ol"],
    execute: () => ({ replacement: "1. ", cursorOffset: -1 }),
  },
  {
    id: "task",
    label: "Task List",
    icon: ListChecks,
    group: "Style",
    keywords: ["task", "todo", "checkbox", "check"],
    execute: () => ({ replacement: "- [ ] ", cursorOffset: -1 }),
  },
  {
    id: "blockquote",
    label: "Blockquote",
    icon: Quote,
    group: "Style",
    keywords: ["blockquote", "quote"],
    execute: () => ({ replacement: "> ", cursorOffset: -1 }),
  },
  {
    id: "code",
    label: "Code Block",
    icon: Code,
    group: "Style",
    keywords: ["code", "block", "fence", "snippet"],
    execute: () => ({ replacement: "```\n\n```", cursorOffset: 4 }),
  },
  {
    id: "hr",
    label: "Horizontal Rule",
    icon: Minus,
    group: "Insert",
    keywords: ["horizontal", "rule", "divider", "line", "hr"],
    execute: () => ({ replacement: "---\n", cursorOffset: -1 }),
  },
  {
    id: "table",
    label: "Table",
    icon: Table,
    group: "Insert",
    keywords: ["table", "grid"],
    execute: () => ({
      replacement:
        "| Column 1 | Column 2 |\n| -------- | -------- |\n| Cell     | Cell     |",
      cursorOffset: -1,
    }),
  },
  {
    id: "math",
    label: "Math Block",
    icon: Sigma,
    group: "Insert",
    keywords: ["math", "latex", "katex", "equation"],
    execute: () => ({ replacement: "$$\n\n$$", cursorOffset: 3 }),
  },
  {
    id: "mermaid",
    label: "Mermaid Diagram",
    icon: GitBranch,
    group: "Insert",
    keywords: ["mermaid", "diagram", "chart", "flow", "graph"],
    execute: () => ({
      replacement: "```mermaid\ngraph TD\n    A --> B\n```",
      cursorOffset: 21,
    }),
  },
];

const SHIKI_LANGS = [
  "javascript",
  "typescript",
  "python",
  "html",
  "css",
  "bash",
  "json",
  "yaml",
  "markdown",
  "sql",
  "go",
  "rust",
  "java",
  "c",
  "cpp",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "diff",
  "xml",
  "jsx",
  "tsx",
  "vue",
  "astro",
  "text",
];

function scopeThemeCSS(css: string): string {
  function scopeSelector(sel: string): string {
    sel = sel.trim();
    if (!sel) return sel;
    if (sel === "body") return ".markdown-preview";
    if (sel.startsWith(".markdown-body")) return `.markdown-preview ${sel}`;
    return `.markdown-preview ${sel}`;
  }

  return css.replace(
    /([^{}@][^{}]*?)(\{)/g,
    (_match, selectors: string, brace: string) => {
      const scoped = selectors.split(",").map(scopeSelector).join(", ");
      return scoped + brace;
    },
  );
}

function formatDate(d: unknown): string {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(String(d));
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function relativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function readDocuments(): SavedDocument[] {
  try {
    const raw = localStorage.getItem("md-documents");
    if (raw) return JSON.parse(raw);
  } catch {
    // no-op
  }
  return [];
}

function writeDocuments(docs: SavedDocument[]) {
  localStorage.setItem("md-documents", JSON.stringify(docs));
}

function extractTitleFromContent(raw: string): string {
  try {
    const { data, content } = matter(raw);
    if (data.title) return String(data.title);
    const match = content.match(/^#\s+(.+)/m);
    if (match) return match[1];
  } catch {
    const match = raw.match(/^#\s+(.+)/m);
    if (match) return match[1];
  }
  return "Untitled";
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countChars(text: string): number {
  return text.length;
}

function countLines(text: string): number {
  return text.split("\n").length;
}

function extractToc(markdown: string): TocItem[] {
  const headings: TocItem[] = [];
  const lines = markdown.split("\n");

  lines.forEach((line) => {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");
      headings.push({ id, text, level });
    }
  });

  return headings;
}

export default function MarkdownConverter() {
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState("");
  const [renderedHtml, setRenderedHtml] = useState("");
  const [dark, setDark] = useState(false);

  const [showFrontmatter, setShowFrontmatter] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [showDocSheet, setShowDocSheet] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showToc, setShowToc] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [scrollSync, setScrollSync] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Feature 2: Themes
  const [selectedTheme, setSelectedTheme] = useState("github");

  // Feature 3: Pane layouts
  const [paneLayout, setPaneLayout] = useState<PaneLayout>("split");

  // Highlights system
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [showHighlightsPanel, setShowHighlightsPanel] = useState(false);
  const [highlightToolbar, setHighlightToolbar] = useState<{
    visible: boolean;
    position: { x: number; y: number };
    selection: Selection | null;
  }>({ visible: false, position: { x: 0, y: 0 }, selection: null });

  // Slash command menu
  const [slashMenu, setSlashMenu] = useState<{
    position: { top: number; left: number };
    filter: string;
    selectedIndex: number;
    triggerStart: number;
  } | null>(null);

  const highlighterRef = useRef<Highlighter | null>(null);
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const isScrollingFromEditor = useRef(false);
  const isScrollingFromPreview = useRef(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let frontmatterData: Record<string, any> | null = null;
  let markdownContent = input;
  try {
    const { data, content } = matter(input);
    if (Object.keys(data).length > 0) frontmatterData = data;
    markdownContent = content;
  } catch {
    // no-op
  }

  const toc = extractToc(markdownContent);
  const wordCount = countWords(input);
  const charCount = countChars(input);
  const lineCount = countLines(input);

  const currentTheme = THEMES.find((t) => t.id === selectedTheme) || THEMES[0];

  const renderMermaid = useCallback(async (html: string): Promise<string> => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    const mermaidBlocks = tempDiv.querySelectorAll("pre code.language-mermaid");

    for (let i = 0; i < mermaidBlocks.length; i++) {
      const block = mermaidBlocks[i];
      const code = block.textContent || "";

      try {
        const { svg } = await mermaid.render(
          `mermaid-${Date.now()}-${i}`,
          code,
        );
        const wrapper = document.createElement("div");
        wrapper.className = "mermaid-diagram";
        wrapper.innerHTML = svg;
        block.parentElement?.replaceWith(wrapper);
      } catch (err) {
        console.error("Mermaid render error:", err);
        // Keep the original code block on error
      }
    }

    return tempDiv.innerHTML;
  }, []);

  const renderMath = useCallback((html: string): string => {
    // Replace block math $$...$$
    html = html.replace(/\$\$([\s\S]+?)\$\$/g, (match, tex) => {
      try {
        return katex.renderToString(tex.trim(), {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        return match;
      }
    });

    // Replace inline math $...$
    html = html.replace(/\$([^$\n]+?)\$/g, (match, tex) => {
      try {
        return katex.renderToString(tex.trim(), {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        return match;
      }
    });

    return html;
  }, []);

  const renderMarkdown = useCallback(
    async (content: string) => {
      if (!content) {
        setRenderedHtml("");
        return;
      }

      let html = await marked.parse(content);

      // Apply syntax highlighting
      const hl = highlighterRef.current;
      if (hl) {
        html = html.replace(
          /<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g,
          (_: string, lang: string, code: string) => {
            if (lang === "mermaid") {
              // Skip mermaid blocks for now, will handle separately
              return `<pre><code class="language-mermaid">${code}</code></pre>`;
            }
            const decoded = code
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'");
            try {
              return hl.codeToHtml(decoded, {
                lang: lang || "text",
                themes: { light: "github-light", dark: "github-dark" },
              });
            } catch {
              return `<pre><code class="language-${lang}">${code}</code></pre>`;
            }
          },
        );
      }

      // Apply math rendering
      html = renderMath(html);

      // Apply mermaid rendering
      html = await renderMermaid(html);

      // Add IDs to headings for TOC links
      html = html.replace(/<h([1-6])>(.+?)<\/h\1>/g, (match, level, text) => {
        const plainText = text.replace(/<[^>]+>/g, "");
        const id = plainText
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-");
        return `<h${level} id="${id}">${text}</h${level}>`;
      });

      setRenderedHtml(html);
    },
    [renderMath, renderMermaid],
  );

  useEffect(() => {
    if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
    renderTimerRef.current = setTimeout(() => {
      renderMarkdown(markdownContent);
    }, 50);
    return () => {
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
    };
  }, [markdownContent, renderMarkdown]);

  // Initialize on mount
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") {
      setDark(stored === "dark");
    } else {
      setDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    }

    // Initialize mermaid
    mermaid.initialize({ startOnLoad: false, theme: "neutral" });

    // Load documents with legacy migration
    let docs = readDocuments();
    let docId = localStorage.getItem("md-active-doc-id");

    if (docs.length === 0) {
      const legacyContent = localStorage.getItem("md-content");
      const newDoc: SavedDocument = {
        id: crypto.randomUUID(),
        title: legacyContent
          ? extractTitleFromContent(legacyContent)
          : "Untitled",
        content: legacyContent || "",
        updatedAt: Date.now(),
      };
      docs = [newDoc];
      docId = newDoc.id;
      writeDocuments(docs);
      localStorage.setItem("md-active-doc-id", docId);
      localStorage.removeItem("md-content");
    }

    setDocuments(docs);

    if (docId && docs.find((d) => d.id === docId)) {
      setActiveDocId(docId);
      const doc = docs.find((d) => d.id === docId)!;
      setInput(doc.content);
    } else if (docs.length > 0) {
      setActiveDocId(docs[0].id);
      setInput(docs[0].content);
      localStorage.setItem("md-active-doc-id", docs[0].id);
    }

    const savedScrollSync = localStorage.getItem("md-scroll-sync");
    if (savedScrollSync === "false") setScrollSync(false);

    const savedAutoSave = localStorage.getItem("md-auto-save");
    if (savedAutoSave === "false") setAutoSave(false);

    // Feature 2: Load selected theme
    const savedTheme = localStorage.getItem("md-selected-theme");
    if (savedTheme && THEMES.find((t) => t.id === savedTheme)) {
      setSelectedTheme(savedTheme);
    }

    // Feature 3: Load pane layout
    const savedLayout = localStorage.getItem("md-pane-layout");
    if (
      savedLayout &&
      ["split", "editor-only", "preview-only"].includes(savedLayout)
    ) {
      setPaneLayout(savedLayout as PaneLayout);
    }

    createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: SHIKI_LANGS,
    }).then((h) => {
      highlighterRef.current = h;
    });

    // Load highlights from localStorage
    const savedHighlights = loadHighlights();
    if (savedHighlights.length > 0) {
      setHighlights(savedHighlights);
    }

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("theme")) {
        setDark(e.matches);
      }
    };
    mql.addEventListener("change", handler);
    setMounted(true);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Apply highlights to rendered HTML
  useEffect(() => {
    if (!previewRef.current || !renderedHtml) return;

    // Small delay to ensure DOM is updated
    const timer = setTimeout(() => {
      if (previewRef.current) {
        applyHighlightsToDOM(previewRef.current, highlights);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [renderedHtml, highlights]);

  // Save highlights to localStorage when they change
  useEffect(() => {
    if (mounted) {
      saveHighlights(highlights);
    }
  }, [highlights, mounted]);

  // Handle text selection in preview for highlight toolbar
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    function handleSelectionChange() {
      if (!preview) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setHighlightToolbar({
          visible: false,
          position: { x: 0, y: 0 },
          selection: null,
        });
        return;
      }

      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;

      // Check if selection is within preview
      const isInPreview = preview.contains(
        container.nodeType === Node.TEXT_NODE
          ? container.parentNode
          : container,
      );
      if (!isInPreview) {
        setHighlightToolbar({
          visible: false,
          position: { x: 0, y: 0 },
          selection: null,
        });
        return;
      }

      // Don't show toolbar if selecting within existing highlight or toolbar
      const parentElement =
        container.nodeType === Node.TEXT_NODE
          ? container.parentElement
          : (container as HTMLElement);
      if (
        parentElement?.closest(
          ".highlight-mark, .highlight-toolbar, .highlight-summary",
        )
      ) {
        return;
      }

      const rect = range.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();

      // Position toolbar above selection (or below if not enough space)
      const toolbarHeight = 50;
      const spaceAbove = rect.top - previewRect.top;
      const spaceBelow = previewRect.bottom - rect.bottom;

      let y = rect.top + window.scrollY - toolbarHeight - 8;
      if (spaceAbove < toolbarHeight + 16 && spaceBelow > toolbarHeight + 16) {
        y = rect.bottom + window.scrollY + 8;
      }

      const x = rect.left + rect.width / 2 - 100; // Center toolbar

      setHighlightToolbar({
        visible: true,
        position: { x, y },
        selection,
      });
    }

    function handleMouseUp() {
      // Delay to allow selection to complete
      setTimeout(handleSelectionChange, 10);
    }

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest(".highlight-toolbar")) {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
          // Selection still active, keep toolbar
          return;
        }
        setHighlightToolbar({
          visible: false,
          position: { x: 0, y: 0 },
          selection: null,
        });
      }
    }

    preview.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      preview.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle clicks on existing highlights to remove them
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview) return;

    function handleHighlightClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const highlightMark = target.closest(".highlight-mark") as HTMLElement;

      if (highlightMark) {
        const highlightId = highlightMark.dataset.highlightId;
        if (highlightId) {
          // Show confirmation or just remove
          if (confirm("Remove this highlight?")) {
            removeHighlight(highlightId);
          }
        }
      }
    }

    preview.addEventListener("click", handleHighlightClick);
    return () => preview.removeEventListener("click", handleHighlightClick);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+S - Save
      if (isMod && e.key === "s") {
        e.preventDefault();
        saveCurrentDocument();
        toast("Saved to browser");
      }

      // Cmd/Ctrl+Shift+C - Copy HTML
      if (isMod && e.shiftKey && e.key === "C") {
        e.preventDefault();
        copyHTML();
      }

      // Cmd/Ctrl+D - Download HTML
      if (isMod && e.key === "d") {
        e.preventDefault();
        downloadHTML();
      }

      // Feature 1: Cmd/Ctrl+Shift+D - Download PDF
      if (isMod && e.shiftKey && e.key === "D") {
        e.preventDefault();
        downloadPDF();
      }

      // Feature 3: Cmd/Ctrl+1/2/3 - Pane layouts
      if (isMod && e.key === "1") {
        e.preventDefault();
        changePaneLayout("split");
      }
      if (isMod && e.key === "2") {
        e.preventDefault();
        changePaneLayout("editor-only");
      }
      if (isMod && e.key === "3") {
        e.preventDefault();
        changePaneLayout("preview-only");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, activeDocId, renderedHtml, dark, selectedTheme, paneLayout]);

  // Dismiss slash menu on click outside
  useEffect(() => {
    if (!slashMenu) return;
    function handleMouseDown(e: MouseEvent) {
      if (
        slashMenuRef.current &&
        !slashMenuRef.current.contains(e.target as Node)
      ) {
        setSlashMenu(null);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [slashMenu]);

  // Scroll selected slash menu item into view
  useEffect(() => {
    if (!slashMenu || !slashMenuRef.current) return;
    const selected = slashMenuRef.current.querySelector(
      '[data-selected="true"]',
    );
    selected?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slashMenu?.selectedIndex]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    if (highlighterRef.current && markdownContent) {
      renderMarkdown(markdownContent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlighterRef.current]);

  // Scroll sync — depends on paneLayout and mounted so listeners
  // attach after the editor/preview DOM nodes actually exist.
  useEffect(() => {
    if (!scrollSync || !mounted) return;

    const editor = editorRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;

    let editorTimeout: ReturnType<typeof setTimeout>;
    let previewTimeout: ReturnType<typeof setTimeout>;

    const handleEditorScroll = () => {
      if (isScrollingFromPreview.current) return;

      clearTimeout(editorTimeout);
      isScrollingFromEditor.current = true;

      const scrollPercentage =
        editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
      const targetScroll =
        scrollPercentage * (preview.scrollHeight - preview.clientHeight);
      preview.scrollTop = targetScroll;

      editorTimeout = setTimeout(() => {
        isScrollingFromEditor.current = false;
      }, 100);
    };

    const handlePreviewScroll = () => {
      if (isScrollingFromEditor.current) return;

      clearTimeout(previewTimeout);
      isScrollingFromPreview.current = true;

      const scrollPercentage =
        preview.scrollTop / (preview.scrollHeight - preview.clientHeight);
      const targetScroll =
        scrollPercentage * (editor.scrollHeight - editor.clientHeight);
      editor.scrollTop = targetScroll;

      previewTimeout = setTimeout(() => {
        isScrollingFromPreview.current = false;
      }, 100);
    };

    editor.addEventListener("scroll", handleEditorScroll);
    preview.addEventListener("scroll", handlePreviewScroll);

    return () => {
      editor.removeEventListener("scroll", handleEditorScroll);
      preview.removeEventListener("scroll", handlePreviewScroll);
      clearTimeout(editorTimeout);
      clearTimeout(previewTimeout);
    };
  }, [scrollSync, mounted, paneLayout]);

  // --- Slash command helpers ---

  const getCaretCoordinates = useCallback(() => {
    const textarea = editorRef.current;
    const mirror = mirrorRef.current;
    if (!textarea || !mirror) return { top: 0, left: 0 };

    const style = window.getComputedStyle(textarea);
    const properties = [
      "fontFamily",
      "fontSize",
      "fontWeight",
      "letterSpacing",
      "lineHeight",
      "paddingTop",
      "paddingLeft",
      "paddingRight",
      "borderTopWidth",
      "borderLeftWidth",
      "boxSizing",
      "whiteSpace",
      "wordWrap",
      "overflowWrap",
      "tabSize",
      "wordSpacing",
    ] as const;
    properties.forEach((prop) => {
      mirror.style.setProperty(
        prop.replace(/([A-Z])/g, "-$1").toLowerCase(),
        style.getPropertyValue(prop.replace(/([A-Z])/g, "-$1").toLowerCase()),
      );
    });
    mirror.style.width = `${textarea.clientWidth}px`;
    mirror.style.overflowWrap = "break-word";
    mirror.style.whiteSpace = "pre-wrap";

    const textBeforeCursor = textarea.value.substring(
      0,
      textarea.selectionStart,
    );
    mirror.textContent = textBeforeCursor;

    const span = document.createElement("span");
    span.textContent = "\u200b";
    mirror.appendChild(span);

    const textareaRect = textarea.getBoundingClientRect();
    const spanRect = span.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();

    return {
      top:
        textareaRect.top +
        (spanRect.top - mirrorRect.top) -
        textarea.scrollTop +
        parseInt(style.lineHeight || "20", 10),
      left:
        textareaRect.left +
        (spanRect.left - mirrorRect.left) -
        textarea.scrollLeft,
    };
  }, []);

  const filteredCommands = useMemo(
    () =>
      slashMenu
        ? SLASH_COMMANDS.filter((cmd) => {
            if (!slashMenu.filter) return true;
            const q = slashMenu.filter.toLowerCase();
            return (
              cmd.label.toLowerCase().includes(q) ||
              cmd.keywords.some((k) => k.includes(q))
            );
          })
        : [],
    [slashMenu],
  );

  const groupedCommands = filteredCommands.reduce<
    Record<string, SlashCommand[]>
  >((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = [];
    acc[cmd.group].push(cmd);
    return acc;
  }, {});

  const executeSlashCommand = useCallback(
    (command: SlashCommand) => {
      const textarea = editorRef.current;
      if (!textarea || !slashMenu) return;

      const text = input;
      const cursorPos = textarea.selectionStart;
      const lineStart = text.lastIndexOf("\n", slashMenu.triggerStart - 1) + 1;
      const lineEnd = text.indexOf("\n", cursorPos);
      const actualLineEnd = lineEnd === -1 ? text.length : lineEnd;
      const currentLineText = text.substring(lineStart, actualLineEnd);

      const { replacement, cursorOffset } = command.execute(currentLineText);

      const newText =
        text.substring(0, lineStart) +
        replacement +
        text.substring(actualLineEnd);

      setInput(newText);
      setSlashMenu(null);

      requestAnimationFrame(() => {
        textarea.focus();
        const newCursorPos =
          cursorOffset === -1
            ? lineStart + replacement.length
            : lineStart + cursorOffset;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    },
    [input, slashMenu],
  );

  const handleEditorChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursorPos = e.target.selectionStart;
      setInput(newValue);

      const lineStart = newValue.lastIndexOf("\n", cursorPos - 1) + 1;
      const lineBeforeCursor = newValue.substring(lineStart, cursorPos);

      const slashMatch = lineBeforeCursor.match(/^\s*\/(\S*)$/);

      if (slashMatch) {
        const pos = getCaretCoordinates();
        setSlashMenu({
          position: pos,
          filter: slashMatch[1],
          selectedIndex: 0,
          triggerStart: lineStart,
        });
      } else if (slashMenu) {
        setSlashMenu(null);
      }
    },
    [slashMenu, getCaretCoordinates],
  );

  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (slashMenu) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashMenu((prev) =>
            prev
              ? {
                  ...prev,
                  selectedIndex: Math.min(
                    prev.selectedIndex + 1,
                    filteredCommands.length - 1,
                  ),
                }
              : null,
          );
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashMenu((prev) =>
            prev
              ? {
                  ...prev,
                  selectedIndex: Math.max(prev.selectedIndex - 1, 0),
                }
              : null,
          );
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          if (filteredCommands.length > 0) {
            executeSlashCommand(
              filteredCommands[slashMenu.selectedIndex] || filteredCommands[0],
            );
          }
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSlashMenu(null);
          return;
        }
      }

      if (e.key === "Enter") {
        const textarea = e.currentTarget;
        const { selectionStart } = textarea;
        const text = textarea.value;
        const lineStart = text.lastIndexOf("\n", selectionStart - 1) + 1;
        const currentLine = text.substring(lineStart, selectionStart);

        const bulletMatch = currentLine.match(/^(\s*)([-*+])\s(.*)$/);
        const orderedMatch = currentLine.match(/^(\s*)(\d+)\.\s(.*)$/);
        const taskMatch = currentLine.match(/^(\s*)- \[[ x]\]\s(.*)$/);

        let continuation: string | null = null;

        if (taskMatch) {
          if (taskMatch[2].trim() === "") {
            e.preventDefault();
            const newText =
              text.substring(0, lineStart) + text.substring(selectionStart);
            setInput(newText);
            requestAnimationFrame(() => {
              textarea.setSelectionRange(lineStart, lineStart);
            });
            return;
          }
          continuation = `\n${taskMatch[1]}- [ ] `;
        } else if (bulletMatch) {
          if (bulletMatch[3].trim() === "") {
            e.preventDefault();
            const newText =
              text.substring(0, lineStart) + text.substring(selectionStart);
            setInput(newText);
            requestAnimationFrame(() => {
              textarea.setSelectionRange(lineStart, lineStart);
            });
            return;
          }
          continuation = `\n${bulletMatch[1]}${bulletMatch[2]} `;
        } else if (orderedMatch) {
          if (orderedMatch[3].trim() === "") {
            e.preventDefault();
            const newText =
              text.substring(0, lineStart) + text.substring(selectionStart);
            setInput(newText);
            requestAnimationFrame(() => {
              textarea.setSelectionRange(lineStart, lineStart);
            });
            return;
          }
          const nextNum = parseInt(orderedMatch[2], 10) + 1;
          continuation = `\n${orderedMatch[1]}${nextNum}. `;
        }

        if (continuation) {
          e.preventDefault();
          const newText =
            text.substring(0, selectionStart) +
            continuation +
            text.substring(selectionStart);
          setInput(newText);
          const newPos = selectionStart + continuation.length;
          requestAnimationFrame(() => {
            textarea.setSelectionRange(newPos, newPos);
          });
          return;
        }
      }

      if (e.key === "Tab") {
        e.preventDefault();
        document.execCommand("insertText", false, "  ");
      }
    },
    [slashMenu, filteredCommands, executeSlashCommand],
  );

  // --- Document helpers ---

  function saveCurrentDocument() {
    if (!activeDocId) return;
    setDocuments((prev) => {
      const existing = prev.find((d) => d.id === activeDocId);
      if (existing && existing.content === input) {
        return prev;
      }
      const updated = prev.map((doc) =>
        doc.id === activeDocId
          ? {
              ...doc,
              content: input,
              title: extractTitleFromContent(input),
              updatedAt: Date.now(),
            }
          : doc,
      );
      writeDocuments(updated);
      return updated;
    });
  }

  useEffect(() => {
    if (!activeDocId || !autoSave) return;
    setIsSaving(true);
    const timer = setTimeout(() => {
      setDocuments((prev) => {
        const existing = prev.find((d) => d.id === activeDocId);
        if (existing && existing.content === input) {
          setIsSaving(false);
          return prev;
        }
        const updated = prev.map((doc) =>
          doc.id === activeDocId
            ? {
                ...doc,
                content: input,
                title: extractTitleFromContent(input),
                updatedAt: Date.now(),
              }
            : doc,
        );
        writeDocuments(updated);
        setIsSaving(false);
        return updated;
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [input, activeDocId, autoSave]);

  function createNewDocument() {
    saveCurrentDocument();
    const newDoc: SavedDocument = {
      id: crypto.randomUUID(),
      title: "Untitled",
      content: "",
      updatedAt: Date.now(),
    };
    setDocuments((prev) => {
      const updated = [newDoc, ...prev];
      writeDocuments(updated);
      return updated;
    });
    setActiveDocId(newDoc.id);
    localStorage.setItem("md-active-doc-id", newDoc.id);
    setInput("");
    setShowDocSheet(false);
    toast("New document created");
  }

  function switchDocument(id: string) {
    if (id === activeDocId) {
      setShowDocSheet(false);
      return;
    }
    saveCurrentDocument();
    const doc = documents.find((d) => d.id === id);
    if (!doc) return;
    setActiveDocId(id);
    localStorage.setItem("md-active-doc-id", id);
    setInput(doc.content);
    setShowDocSheet(false);
  }

  function deleteDocument(id: string) {
    setDocuments((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      if (updated.length === 0) {
        const newDoc: SavedDocument = {
          id: crypto.randomUUID(),
          title: "Untitled",
          content: "",
          updatedAt: Date.now(),
        };
        const withNew = [newDoc];
        writeDocuments(withNew);
        setActiveDocId(newDoc.id);
        localStorage.setItem("md-active-doc-id", newDoc.id);
        setInput("");
        return withNew;
      }
      writeDocuments(updated);
      if (id === activeDocId) {
        const next = updated[0];
        setActiveDocId(next.id);
        localStorage.setItem("md-active-doc-id", next.id);
        setInput(next.content);
      }
      return updated;
    });
    toast("Document deleted");
  }

  // --- Highlight helpers ---

  function addHighlight(type: Highlight["type"]) {
    const selection = highlightToolbar.selection;
    if (!selection || selection.isCollapsed) return;

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    // Get selection position in the full rendered text
    const range = selection.getRangeAt(0);
    const preClone = previewRef.current?.cloneNode(true) as HTMLElement;
    if (!preClone) return;

    // Get full text content
    const fullText = preClone.textContent || "";

    // Find approximate position (this is a simplified approach)
    // For production, you'd want more robust text location
    const beforeRange = range.cloneRange();
    beforeRange.selectNodeContents(previewRef.current!);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    const selectionStart = beforeRange.toString().length;

    const textFragment = createTextFragment(
      fullText,
      selectedText,
      selectionStart,
    );

    const newHighlight: Highlight = {
      id: crypto.randomUUID(),
      type,
      selectedText,
      textFragment,
      createdAt: Date.now(),
    };

    setHighlights((prev) => [...prev, newHighlight]);

    // Clear selection and toolbar
    selection.removeAllRanges();
    setHighlightToolbar({
      visible: false,
      position: { x: 0, y: 0 },
      selection: null,
    });

    toast(`Added ${type} highlight`);
  }

  function removeHighlight(id: string) {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    toast("Highlight removed");
  }

  function clearAllHighlights() {
    if (highlights.length === 0) return;

    if (confirm(`Remove all ${highlights.length} highlights?`)) {
      setHighlights([]);
      clearHighlights();
      toast("All highlights cleared");
    }
  }

  function scrollToHighlight(id: string) {
    const preview = previewRef.current;
    if (!preview) return;

    const mark = preview.querySelector(`[data-highlight-id="${id}"]`);
    if (mark) {
      mark.scrollIntoView({ behavior: "smooth", block: "center" });

      // Flash effect
      mark.classList.add("ring-2", "ring-primary");
      setTimeout(() => {
        mark.classList.remove("ring-2", "ring-primary");
      }, 1500);
    }
  }

  // --- Other helpers ---

  function toggleTheme() {
    setDark((prev) => {
      const next = !prev;
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  }

  function toggleScrollSync() {
    const next = !scrollSync;
    setScrollSync(next);
    localStorage.setItem("md-scroll-sync", String(next));
    toast(next ? "Scroll sync enabled" : "Scroll sync disabled");
  }

  function toggleAutoSave() {
    const next = !autoSave;
    setAutoSave(next);
    localStorage.setItem("md-auto-save", String(next));
    toast(next ? "Auto-save enabled" : "Auto-save disabled");
  }

  function extractTitle(): string {
    if (frontmatterData?.title) return String(frontmatterData.title);
    return (markdownContent.match(/^#\s+(.+)/m) || [])[1] || "Untitled";
  }

  function getFullHTML(): string {
    const currentThemeCSS = currentTheme[dark ? "dark" : "light"];
    const hasMermaid = renderedHtml.includes('class="mermaid-diagram"');
    const hasMath = renderedHtml.includes('class="katex');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${extractTitle()}</title>
${hasMath ? KATEX_CSS : ""}
<style>
${currentThemeCSS}
${SHIKI_EXPORT_CSS}
${PDF_PRINT_CSS}
</style>
</head>
<body>
<div class="markdown-body">
${renderedHtml}
</div>
${hasMermaid ? MERMAID_SCRIPT : ""}
</body>
</html>`;
  }

  function copyHTML() {
    navigator.clipboard
      .writeText(getFullHTML())
      .then(() => toast("HTML copied to clipboard"));
  }

  function downloadHTML() {
    const blob = new Blob([getFullHTML()], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${
      extractTitle()
        .replace(/[^a-zA-Z0-9-_ ]/g, "")
        .trim() || "document"
    }.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Downloaded ${extractTitle()}.html`);
  }

  // Feature 1: PDF Export
  async function downloadPDF() {
    const title =
      extractTitle()
        .replace(/[^a-zA-Z0-9-_ ]/g, "")
        .trim() || "document";

    // Detect iOS/mobile — html2pdf.js struggles on iOS Safari due to html2canvas limitations
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isMobile = isIOS || /Android/i.test(navigator.userAgent);

    if (isMobile) {
      // Mobile fallback: open full page view and trigger print dialog (Save as PDF)
      toast("Opening print view — use 'Save as PDF' in the print dialog");
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(getFullHTML());
        w.document.close();
        setTimeout(() => w.print(), 500);
      } else {
        toast.error("Pop-up blocked — allow pop-ups and try again");
      }
      return;
    }

    const element = document.createElement("div");
    element.innerHTML = `<div class="markdown-body">${renderedHtml}</div>`;

    // Inject theme styles
    const style = document.createElement("style");
    style.textContent = currentTheme[dark ? "dark" : "light"];
    element.insertBefore(style, element.firstChild);

    const opt = {
      margin: 15,
      filename: `${title}.pdf`,
      image: { type: "jpeg" as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] },
    };

    toast("Generating PDF...");

    try {
      // Dynamic import to avoid SSR issues
      const html2pdf = (await import("html2pdf.js")).default;

      await html2pdf().set(opt).from(element).save();

      toast(`Downloaded ${title}.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
      // Fallback to print dialog on desktop too
      toast("PDF generation failed — opening print view instead");
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(getFullHTML());
        w.document.close();
        setTimeout(() => w.print(), 500);
      }
    }
  }

  function openPreview() {
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(getFullHTML());
      w.document.close();
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave() {
    setDragging(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (
      !file.name.endsWith(".md") &&
      !file.name.endsWith(".markdown") &&
      !file.name.endsWith(".txt") &&
      file.type !== "text/markdown" &&
      file.type !== "text/plain"
    ) {
      toast("Please drop a .md or .txt file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setInput(ev.target?.result as string);
      toast(`Loaded ${file.name}`);
    };
    reader.readAsText(file);
  }

  function scrollToHeading(id: string) {
    const preview = previewRef.current;
    if (!preview) return;

    const heading = preview.querySelector(`#${CSS.escape(id)}`);
    if (heading) {
      const headingTop = (heading as HTMLElement).offsetTop;
      preview.scrollTo({ top: headingTop, behavior: "smooth" });
    }
  }

  // Feature 2: Theme selector
  function changeTheme(themeId: string) {
    setSelectedTheme(themeId);
    localStorage.setItem("md-selected-theme", themeId);
    const theme = THEMES.find((t) => t.id === themeId);
    if (theme) {
      toast(`Theme: ${theme.name}`);
    }
  }

  // Feature 3: Pane layout
  function changePaneLayout(layout: PaneLayout) {
    setPaneLayout(layout);
    localStorage.setItem("md-pane-layout", layout);
    const labels = {
      split: "Split view",
      "editor-only": "Editor only",
      "preview-only": "Preview only",
    };
    toast(labels[layout]);
  }

  const activeDoc = documents.find((d) => d.id === activeDocId);

  if (!mounted) {
    return <div className="flex h-screen flex-col overflow-hidden" />;
  }

  const isMac =
    typeof navigator !== "undefined" &&
    navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const modKey = isMac ? "⌘" : "Ctrl";

  const showEditor = paneLayout === "split" || paneLayout === "editor-only";
  const showPreview = paneLayout === "split" || paneLayout === "preview-only";

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        {/* Unified toolbar */}
        <header className="flex h-10 items-center justify-between border-b border-border/60 bg-muted/30 px-2 sm:px-3 no-print">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setShowDocSheet(true)}
                >
                  <FileText className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Documents</TooltipContent>
            </Tooltip>
            <div className="mx-0.5 h-4 w-px bg-border/50" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={paneLayout === "split" ? "default" : "ghost"}
                  size="xs"
                  onClick={() => changePaneLayout("split")}
                >
                  <Columns className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Split ({modKey}+1)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={paneLayout === "editor-only" ? "default" : "ghost"}
                  size="xs"
                  onClick={() => changePaneLayout("editor-only")}
                >
                  <Edit className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editor ({modKey}+2)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={paneLayout === "preview-only" ? "default" : "ghost"}
                  size="xs"
                  onClick={() => changePaneLayout("preview-only")}
                >
                  <Eye className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Preview ({modKey}+3)</TooltipContent>
            </Tooltip>
            <div className="mx-0.5 h-4 w-px bg-border/50" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={scrollSync ? "default" : "ghost"}
                  size="xs"
                  onClick={toggleScrollSync}
                >
                  <ArrowUpDown className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Scroll sync</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={autoSave ? "default" : "ghost"}
                  size="xs"
                  onClick={toggleAutoSave}
                >
                  <Save className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Auto-save</TooltipContent>
            </Tooltip>
          </div>

          <button
            onClick={() => setShowDocSheet(true)}
            className="text-xs font-medium truncate max-w-72 sm:max-w-96 lg:max-w-xl hover:text-foreground/70 transition-colors"
          >
            {extractTitle()}
          </button>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="xs" onClick={toggleTheme}>
                  {dark ? (
                    <Sun className="size-3.5" />
                  ) : (
                    <Moon className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {dark ? "Light mode" : "Dark mode"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setShowShortcuts(true)}
                >
                  <HelpCircle className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Keyboard shortcuts</TooltipContent>
            </Tooltip>
            <Button variant="ghost" size="xs" asChild>
              <a
                href="https://github.com/jcottam/sparkdown"
                target="_blank"
                rel="noopener noreferrer"
              >
                <svg
                  viewBox="0 0 16 16"
                  className="size-3.5 fill-current"
                  aria-label="GitHub"
                >
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                </svg>
              </a>
            </Button>
          </div>
        </header>

        {/* Main content */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Editor pane */}
          {showEditor && (
            <div
              className={`flex min-h-0 flex-col border-b md:border-b-0 md:border-r transition-all duration-300 ${
                paneLayout === "editor-only" ? "flex-1" : "flex-1"
              }`}
            >
              <div className="flex h-8 items-center justify-between border-b bg-muted/50 text-muted-foreground px-2 no-print">
                <span className="text-xs">
                  {wordCount} words · {charCount} chars · {lineCount} lines
                </span>
                <span className="text-xs">
                  {autoSave && isSaving ? (
                    <span className="text-muted-foreground/70">Saving...</span>
                  ) : activeDoc ? (
                    relativeTime(activeDoc.updatedAt)
                  ) : null}
                </span>
              </div>
              <div
                className="relative min-h-0 flex-1"
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                <textarea
                  ref={editorRef}
                  value={input}
                  onChange={handleEditorChange}
                  onKeyDown={handleEditorKeyDown}
                  placeholder={`# Hello World\n\nStart typing your markdown here...\n\n\`\`\`javascript\nfunction hello() {\n  console.log('Syntax highlighting!');\n}\n\`\`\``}
                  className="h-full w-full resize-none overflow-y-auto bg-transparent p-4 font-mono text-sm outline-none placeholder:text-muted-foreground/50"
                  spellCheck={false}
                />

                {/* Hidden mirror for caret position calculation */}
                <div
                  ref={mirrorRef}
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    visibility: "hidden",
                    height: "auto",
                    width: "auto",
                    overflow: "hidden",
                    pointerEvents: "none",
                  }}
                />

                {/* Slash command menu */}
                {slashMenu && filteredCommands.length > 0 && (
                  <div
                    ref={slashMenuRef}
                    className="fixed z-50 min-w-[220px] max-h-[320px] overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
                    style={{
                      top: slashMenu.position.top,
                      left: slashMenu.position.left,
                    }}
                  >
                    {Object.entries(groupedCommands).map(
                      ([group, commands]) => (
                        <div key={group}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            {group}
                          </div>
                          {commands.map((cmd) => {
                            const globalIndex = filteredCommands.indexOf(cmd);
                            const Icon = cmd.icon;
                            return (
                              <button
                                key={cmd.id}
                                data-selected={
                                  globalIndex === slashMenu.selectedIndex
                                    ? "true"
                                    : undefined
                                }
                                className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors ${
                                  globalIndex === slashMenu.selectedIndex
                                    ? "bg-accent text-accent-foreground"
                                    : "text-popover-foreground hover:bg-accent/50"
                                }`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  executeSlashCommand(cmd);
                                }}
                                onMouseEnter={() =>
                                  setSlashMenu((prev) =>
                                    prev
                                      ? { ...prev, selectedIndex: globalIndex }
                                      : null,
                                  )
                                }
                              >
                                <Icon className="size-4 shrink-0 text-muted-foreground" />
                                <span>{cmd.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      ),
                    )}
                  </div>
                )}

                {dragging && (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/10 backdrop-blur-sm">
                    <p className="text-lg font-medium text-primary">
                      Drop .md file here
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preview pane */}
          {showPreview && (
            <div
              className={`flex min-h-0 min-w-0 flex-col transition-all duration-300 ${
                paneLayout === "preview-only" ? "flex-1" : "flex-1"
              }`}
            >
              <div className="flex h-8 items-center justify-between border-b bg-muted/50 text-muted-foreground px-2 no-print">
                <div className="flex items-center gap-1">
                  <Select value={selectedTheme} onValueChange={changeTheme}>
                    <SelectTrigger className="h-6 w-28 border-0 bg-transparent text-xs shadow-none focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {THEMES.map((theme) => (
                        <SelectItem
                          key={theme.id}
                          value={theme.id}
                          className="text-xs"
                        >
                          {theme.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-0.5">
                  {frontmatterData && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setShowFrontmatter(true)}
                        >
                          <Info className="size-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Details</TooltipContent>
                    </Tooltip>
                  )}
                  {toc.length >= 2 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setShowToc(true)}
                        >
                          <List className="size-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Table of Contents</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={showHighlightsPanel ? "default" : "ghost"}
                        size="xs"
                        onClick={() =>
                          setShowHighlightsPanel(!showHighlightsPanel)
                        }
                        className="relative"
                      >
                        <HighlighterIcon className="size-3" />
                        {highlights.length > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">
                            {highlights.length}
                          </span>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Highlights</TooltipContent>
                  </Tooltip>
                  <div className="mx-0.5 h-3.5 w-px bg-border/50" />
                  <Popover>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="xs">
                            <Download className="size-3" />
                          </Button>
                        </PopoverTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Export</TooltipContent>
                    </Tooltip>
                    <PopoverContent align="end" className="w-44 p-1">
                      <button
                        onClick={copyHTML}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
                      >
                        <Copy className="size-3" /> Copy HTML{" "}
                        <kbd className="ml-auto text-[10px] text-muted-foreground">
                          {modKey}⇧C
                        </kbd>
                      </button>
                      <button
                        onClick={downloadHTML}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
                      >
                        <Download className="size-3" /> Download HTML{" "}
                        <kbd className="ml-auto text-[10px] text-muted-foreground">
                          {modKey}D
                        </kbd>
                      </button>
                      <button
                        onClick={downloadPDF}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
                      >
                        <FileDown className="size-3" /> Download PDF{" "}
                        <kbd className="ml-auto text-[10px] text-muted-foreground">
                          {modKey}⇧D
                        </kbd>
                      </button>
                      <div className="my-0.5 h-px bg-border" />
                      <button
                        onClick={openPreview}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
                      >
                        <ExternalLink className="size-3" /> Open in new tab
                      </button>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Frontmatter dialog */}
              <Dialog open={showFrontmatter} onOpenChange={setShowFrontmatter}>
                <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
                  <DialogHeader className="px-5 pt-5 pb-4">
                    <DialogTitle className="text-base leading-snug">
                      {frontmatterData?.title
                        ? String(frontmatterData.title)
                        : "Document Details"}
                    </DialogTitle>
                    {frontmatterData?.description && (
                      <DialogDescription className="text-sm leading-relaxed mt-1">
                        {String(frontmatterData.description)}
                      </DialogDescription>
                    )}
                  </DialogHeader>
                  {frontmatterData && (
                    <div className="border-t">
                      {frontmatterData.author && (
                        <div className="flex items-baseline justify-between px-5 py-3 border-b border-border/50">
                          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Author</span>
                          <span className="text-sm">{String(frontmatterData.author)}</span>
                        </div>
                      )}
                      {(frontmatterData.pubDate || frontmatterData.date) && (
                        <div className="flex items-baseline justify-between px-5 py-3 border-b border-border/50">
                          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Date</span>
                          <span className="text-sm">
                            {formatDate(frontmatterData.pubDate || frontmatterData.date)}
                          </span>
                        </div>
                      )}
                      {Object.entries(frontmatterData)
                        .filter(
                          ([key]) =>
                            !["title", "author", "pubDate", "date", "description", "tags"].includes(key),
                        )
                        .map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-baseline justify-between px-5 py-3 border-b border-border/50"
                          >
                            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{key}</span>
                            <span className="text-sm">{String(value)}</span>
                          </div>
                        ))}
                      {Array.isArray(frontmatterData.tags) && frontmatterData.tags.length > 0 && (
                        <div className="px-5 py-3">
                          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tags</span>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {(frontmatterData.tags as string[]).map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              {/* HTML preview */}
              <div
                ref={previewRef}
                className="markdown-preview min-h-0 flex-1 overflow-y-auto overflow-x-hidden wrap-break-word p-4"
              >
                {/* Highlight Summary */}
                <HighlightSummary highlights={highlights} />

                {/* Rendered content */}
                <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
              </div>

              {/* Inject theme CSS scoped to preview pane */}
              <style
                dangerouslySetInnerHTML={{
                  __html: scopeThemeCSS(currentTheme[dark ? "dark" : "light"]),
                }}
              />
            </div>
          )}
        </div>

        {/* TOC Sheet */}
        <Sheet open={showToc} onOpenChange={setShowToc}>
          <SheetContent side="right" className="flex flex-col gap-0">
            <SheetHeader className="pr-10">
              <SheetTitle className="flex items-center gap-1.5"><List className="size-4" />Contents</SheetTitle>
              <SheetDescription className="sr-only">
                {toc.length} heading{toc.length !== 1 ? "s" : ""}
              </SheetDescription>
            </SheetHeader>
            <nav className="flex-1 overflow-y-auto border-t">
              {toc.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    scrollToHeading(item.id);
                    setShowToc(false);
                  }}
                  className={`block w-full border-b border-border/40 px-4 py-2 text-left transition-colors hover:bg-muted/50 ${
                    item.level === 1
                      ? "text-[13px] font-medium text-foreground"
                      : "text-[13px] text-muted-foreground"
                  }`}
                  style={{ paddingLeft: `${(item.level - 1) * 14 + 16}px` }}
                >
                  {item.text}
                </button>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        {/* Documents Sheet */}
        <Sheet open={showDocSheet} onOpenChange={setShowDocSheet}>
          <SheetContent side="left" className="flex flex-col gap-0">
            <SheetHeader className="pr-10">
              <SheetTitle className="flex items-center gap-1.5">
                <FileText className="size-4" />
                Documents
              </SheetTitle>
              <SheetDescription className="sr-only">
                {documents.length} document{documents.length !== 1 ? "s" : ""}{" "}
                saved
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-3">
              <Button
                variant="outline"
                size="xs"
                className="w-full"
                onClick={createNewDocument}
              >
                <Plus className="size-3" />
                New document
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto border-t">
              {documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center px-4">
                  <FileText className="size-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    No documents yet
                  </p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {documents
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .map((doc) => (
                      <div
                        key={doc.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => switchDocument(doc.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            switchDocument(doc.id);
                          }
                        }}
                        className={`group flex cursor-pointer items-center justify-between border-b border-border/40 px-4 py-2.5 text-left transition-colors ${
                          doc.id === activeDocId
                            ? "bg-accent/50 border-l-2 border-l-primary"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium">
                            {doc.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {relativeTime(doc.updatedAt)} ·{" "}
                            {countWords(doc.content)} words
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDeleteId(doc.id);
                          }}
                        >
                          <Trash2 className="size-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Delete confirmation */}
        <AlertDialog
          open={pendingDeleteId !== null}
          onOpenChange={(open: boolean) => {
            if (!open) setPendingDeleteId(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete document?</AlertDialogTitle>
              <AlertDialogDescription>
                This document will be permanently deleted from your browser
                storage. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  if (pendingDeleteId) {
                    deleteDocument(pendingDeleteId);
                    setPendingDeleteId(null);
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Keyboard shortcuts dialog */}
        <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Keyboard Shortcuts</DialogTitle>
              <DialogDescription>
                Speed up your workflow with these shortcuts
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Save to browser</span>
                <kbd className="rounded bg-muted px-2 py-1 font-mono text-xs">
                  {modKey}+S
                </kbd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Copy HTML</span>
                <kbd className="rounded bg-muted px-2 py-1 font-mono text-xs">
                  {modKey}+Shift+C
                </kbd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Download HTML</span>
                <kbd className="rounded bg-muted px-2 py-1 font-mono text-xs">
                  {modKey}+D
                </kbd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Download PDF</span>
                <kbd className="rounded bg-muted px-2 py-1 font-mono text-xs">
                  {modKey}+Shift+D
                </kbd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Split view</span>
                <kbd className="rounded bg-muted px-2 py-1 font-mono text-xs">
                  {modKey}+1
                </kbd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Editor only</span>
                <kbd className="rounded bg-muted px-2 py-1 font-mono text-xs">
                  {modKey}+2
                </kbd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Preview only</span>
                <kbd className="rounded bg-muted px-2 py-1 font-mono text-xs">
                  {modKey}+3
                </kbd>
              </div>
            </div>
            <DialogClose asChild>
              <Button variant="outline" className="mt-2">
                Close
              </Button>
            </DialogClose>
          </DialogContent>
        </Dialog>

        {/* Highlight Toolbar */}
        {highlightToolbar.visible && (
          <HighlightToolbar
            position={highlightToolbar.position}
            onHighlight={addHighlight}
            onClose={() =>
              setHighlightToolbar({
                visible: false,
                position: { x: 0, y: 0 },
                selection: null,
              })
            }
          />
        )}

        {/* Highlights Panel */}
        <HighlightsPanel
          open={showHighlightsPanel}
          onOpenChange={setShowHighlightsPanel}
          highlights={highlights}
          onRemove={removeHighlight}
          onClearAll={clearAllHighlights}
          onScrollTo={scrollToHighlight}
        />
      </div>
    </TooltipProvider>
  );
}
