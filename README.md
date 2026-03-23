# Markdown → HTML

Markdown on the left, styled HTML on the right. Copy to clipboard or download a `.html` file. Browser-only: no server, no tracking.

**Live:** [johnryancottam.com/tools/markdown-to-html](https://johnryancottam.com/tools/markdown-to-html)

## Features

- **Live preview** — real-time rendering as you type with debounced updates
- **GitHub-flavored Markdown** — tables, task lists, fenced code blocks, and more (via [marked](https://github.com/markedjs/marked))
- **Syntax highlighting** — 25+ languages powered by [Shiki](https://shiki.style/) with dual light/dark themes
- **Frontmatter support** — YAML frontmatter (title, author, date, tags) parsed and displayed via [gray-matter](https://github.com/jonschlinkert/gray-matter)
- **Copy HTML** — one click to copy a fully self-contained HTML page to your clipboard
- **Download .html** — save the rendered page as a file
- **Open full page** — preview in a new browser tab
- **Import from URL** — fetch markdown from GitHub file URLs, Gists, or raw URLs
- **Multi-document management** — create, switch, and delete documents stored in browser localStorage
- **Auto-save** — optional auto-save with manual save and `Cmd+S` / `Ctrl+S` support
- **Drag-and-drop** — drop `.md` or `.txt` files directly into the editor
- **Custom themes** — apply themes via JSON URL (compatible with [tweakcn](https://tweakcn.com/editor/theme))
- **Dark mode** — automatic (system preference) or manual toggle, with theme persistence
- **Download markdown** — export the raw markdown as a `.md` file
- **Responsive** — split-pane layout on desktop, stacked on mobile

## Tech Stack

- [Next.js](https://nextjs.org/) 16 (App Router)
- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) 4
- [shadcn/ui](https://ui.shadcn.com/) (Dialog, Sheet, AlertDialog, Button, Input)
- [marked](https://github.com/markedjs/marked) for GFM parsing
- [Shiki](https://shiki.style/) for syntax highlighting
- [gray-matter](https://github.com/jonschlinkert/gray-matter) for YAML frontmatter
- [Lucide React](https://lucide.dev/) for icons
- [Sonner](https://sonner.emilkowal.dev/) for toast notifications

## Development

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Build

```bash
pnpm build
```

## License

[MIT](LICENSE)

---

Built by [John Ryan Cottam](https://johnryancottam.com)
