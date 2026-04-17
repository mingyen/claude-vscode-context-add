# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run build        # Build once (with sourcemaps, for development)
npm run build:prod   # Build minified (for packaging)
npm run watch        # Build on save
npm test             # Run tests (vitest, no vscode dependency)
npm run test:watch   # Run tests in watch mode
npm run package      # Produce .vsix file for local install
```

To test in VS Code: press `F5` (uses `.vscode/launch.json` → runs `npm: build` then launches Extension Development Host).

Single test file: `npx vitest run src/__tests__/matching.test.ts`

## Architecture

The extension has five modules wired together in `extension.ts`:

**`TerminalDetector`** (`terminalDetector.ts`) — Finds and tracks the Claude Code terminal. Auto-detects by name via `matchesClaudeTerminalName`. Supports manual designation via `designate()`. Polls for 30s after terminal opens because Claude Code sets its title asynchronously. Exposes `target` (best current terminal) and fires `onDidChange` events.

**`ContextSender`** (`contextSender.ts`) — Sends `@`-references to the terminal using `terminal.sendText(..., false)` (no Enter). Resolves paths relative to terminal's CWD via VS Code shell integration (`terminal.shellIntegration.cwd`, available VS Code 1.93+), falling back to `terminal.creationOptions.cwd`, then first workspace folder.

**`PanelSender`** (`panelSender.ts`) — Sends `@`-references to the Claude Code VS Code extension panel (sidebar or editor tab). Uses `claude-vscode.insertAtMention` command from the official `anthropic.claude-code` extension. Because `insertAtMention` reads `vscode.window.activeTextEditor`, `addFiles()` temporarily opens each file to make it the active editor. The CC webview only processes messages when `isVisible.value` is true, so only the currently visible panel receives the insert.

**`StatusBar`** (`statusBar.ts`) — Shows a status bar item when a Claude terminal is active. Changes icon when text is selected; clicking sends the selection.

**`matching.ts`** — Pure utility functions (no vscode dependency → unit-testable with vitest):
- `matchesClaudeTerminalName(name, customPatterns)` — matches "Claude Code", names containing "claude", bare semver strings like `1.0.32`, and user-configured regex patterns
- `toRelativePath(fileFsPath, workspaceFolderFsPaths[])` — returns shortest relative path or absolute path if outside all workspace folders
- `formatLineRef(filePath, start, end)` — formats `@path:line` or `@path:start-end`

## Target Routing (`extension.ts`)

`resolveTarget(detector)` determines where to send references based on `claudeContextAdd.target`:
- `"terminal"` — use terminal only (error if none found)
- `"panel"` — use Claude Code VS Code extension panel only
- `"auto"` (default) — terminal first, fall back to panel if no terminal found

## Key Design Decisions

- `terminal.sendText(text, false)` with `false` sends without newline — intentional so the user reviews before submitting
- Path resolution for terminal checks terminal CWD first (most accurate for multi-root workspaces)
- Path resolution for panel uses `vscode.workspace.asRelativePath` (what the CC extension expects)
- `PanelSender.addFiles()` opens files as preview tabs (`preview: true`) to avoid polluting the tab bar
- Only `matching.ts` is unit-tested; the rest requires the vscode host environment
- The extension bundles with esbuild (`--external:vscode`) since vscode is provided at runtime
- Terminal commands (`setAsClaudeTerminal`, `selectTerminal`) are hidden from command palette when `target === "panel"` via `when` conditions
