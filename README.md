# Claude Code Context Add

A VS Code extension that bridges your editor and [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI. Right-click files or selections to send them as `@`-references directly into your Claude Code terminal or the Claude Code VS Code extension panel.

> **Forked from [claude-code-context-plus](https://github.com/jeffycyang/claude-vscode-context-plus) by [@jeffycyang](https://github.com/jeffycyang)**, licensed under MIT.
> Added support for the Claude Code VS Code extension panel (sidebar / editor tab), target configuration, and bug fixes.

## Features

### Add files to context

Right-click a file in the explorer or editor tab and select **"Add to Claude Code"**. Sends `@path/to/file` to the Claude Code terminal. Supports multi-select.

![Add file to Claude Code context menu](resources/add-file-context-menu.png)

### Send selections

Select code in the editor, right-click, and choose **"Send Selection to Claude Code"**. Sends `@path/to/file:startLine-endLine` so Claude knows exactly what you're pointing at.

![Send selection to Claude Code context menu](resources/send-selection-context-menu.png)

### Result in terminal or panel

References are typed into the Claude Code input without pressing Enter, so you stay in control — works with both the terminal and the Claude Code VS Code extension panel (sidebar or editor tab).

![Terminal showing @ reference](resources/terminal-reference.png)

### More features

- **Claude Code VS Code extension panel support** — In addition to the terminal, supports sending references directly to the Claude Code VS Code extension (sidebar or editor tab). Auto-detects which is available.
- **Target configuration** — Choose between `auto` (terminal first, panel as fallback), `terminal`, or `panel` via the `claudeContextAdd.target` setting.
- **Multi-root workspace support** — Correctly resolves paths in multi-root workspaces. Files in the terminal's folder use relative paths; files in other folders use absolute paths.
- **Auto-detect Claude Code terminals** — Automatically finds terminals named "Claude Code" or matching version patterns (e.g. `1.0.32`). Configurable with custom regex patterns.
- **Manual terminal designation** — Use the command palette to manually designate any terminal as your Claude Code target.
- **Status bar indicator** — Shows when a Claude Code terminal is active. Displays a selection icon when you have text selected, and clicking it sends the selection.

## Keyboard Shortcuts

| Action | Mac | Windows/Linux |
|---|---|---|
| Add current file to context | `Cmd+Shift+.` | `Ctrl+Shift+.` |
| Send selection to context | `Cmd+L` | `Ctrl+Shift+,` |

## Commands

All commands are available via the command palette (`Cmd+Shift+P`):

- **Add to Claude Code** — Send file(s) as `@`-references
- **Send Selection to Claude Code** — Send selected code with line numbers
- **Set as Claude Code Terminal** — Manually designate a terminal
- **Select Claude Code Terminal** — Choose between multiple Claude Code terminals

## Configuration

| Setting | Type | Default | Description |
|---|---|---|---|
| `claudeContextAdd.target` | `"auto"\|"terminal"\|"panel"` | `"auto"` | Where to send references: terminal, Claude Code VS Code extension panel, or auto-detect |
| `claudeContextAdd.terminalNamePatterns` | `string[]` | `[]` | Additional regex patterns to match terminal names as Claude Code terminals |

## How It Works

References are inserted without pressing Enter, so you stay in control. For files it sends `@relative/path`, and for selections it sends `@relative/path:startLine-endLine`.

**Terminal mode:** Paths are resolved relative to the Claude Code terminal's working directory. In multi-root workspaces, files in the terminal's folder get short relative paths while files in other workspace folders get absolute paths.

**Panel mode:** Paths are resolved relative to the workspace root via VS Code's built-in `asRelativePath`. The extension auto-detects which Claude Code VS Code extension panel (sidebar or editor tab) is currently visible and inserts there.

<details>
<summary>Development</summary>

```bash
npm install
npm run build        # Build once
npm run watch        # Build on save
npm test             # Run tests
```

To test in VS Code, press `F5` to launch the Extension Development Host.

### Building & Installing Locally

```bash
npm run package      # Produces claude-code-context-add-0.1.0.vsix
code --install-extension claude-code-context-add-0.1.0.vsix
```

</details>

## License

MIT
