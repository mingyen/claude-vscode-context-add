import * as vscode from 'vscode';
import { TerminalDetector } from './terminalDetector';
import { ContextSender } from './contextSender';
import { StatusBar } from './statusBar';
import { PanelSender } from './panelSender';

type Target = 'auto' | 'terminal' | 'panel';

function getTarget(): Target {
  const cfg = vscode.workspace.getConfiguration('claudeContextAdd');
  return cfg.get<Target>('target', 'auto');
}

function resolveTarget(
  detector: TerminalDetector,
): 'terminal' | 'panel' | 'none' {
  const t = getTarget();
  if (t === 'terminal') return detector.hasTarget ? 'terminal' : 'none';
  if (t === 'panel') return PanelSender.isAvailable() ? 'panel' : 'none';
  // auto: terminal first, panel as fallback
  if (detector.hasTarget) return 'terminal';
  if (PanelSender.isAvailable()) return 'panel';
  return 'none';
}

export function activate(context: vscode.ExtensionContext) {
  const detector = new TerminalDetector();
  const sender = new ContextSender(detector);
  const statusBar = new StatusBar(detector);
  const panelSender = new PanelSender();

  context.subscriptions.push(detector, statusBar);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeContextAdd.addFileToContext',
      async (uri?: vscode.Uri, uris?: vscode.Uri[]) => {
        // When invoked from explorer context menu, `uri` is the right-clicked
        // item and `uris` is all selected items (if multi-select).
        // When invoked from editor title context or keybinding, fall back to active editor.
        const targets =
          uris && uris.length > 0
            ? uris
            : uri
              ? [uri]
              : vscode.window.activeTextEditor
                ? [vscode.window.activeTextEditor.document.uri]
                : [];

        if (targets.length === 0) {
          vscode.window.showWarningMessage('No file to add.');
          return;
        }

        switch (resolveTarget(detector)) {
          case 'terminal': sender.addFiles(targets); break;
          case 'panel': await panelSender.addFiles(targets); break;
          default: vscode.window.showWarningMessage(
            'No Claude Code target found. Open a terminal or install the Claude Code extension.',
          );
        }
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeContextAdd.sendSelectionToContext',
      async () => {
        switch (resolveTarget(detector)) {
          case 'terminal': sender.sendSelection(); break;
          case 'panel': await panelSender.sendSelection(); break;
          default: vscode.window.showWarningMessage(
            'No Claude Code target found. Open a terminal or install the Claude Code extension.',
          );
        }
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeContextAdd.setAsClaudeTerminal',
      async () => {
        const active = vscode.window.activeTerminal;
        const terminals = vscode.window.terminals;

        if (terminals.length === 0) {
          vscode.window.showWarningMessage('No terminals open.');
          return;
        }

        // If there's a focused terminal, offer to designate it directly
        if (terminals.length === 1 && active) {
          detector.designate(active);
          vscode.window.showInformationMessage(
            `"${active.name}" set as Claude Code terminal.`,
          );
          return;
        }

        const items = terminals.map((t) => ({
          label: t.name,
          terminal: t,
          description: t === active ? '(active)' : undefined,
        }));

        const picked = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select terminal to designate as Claude Code',
        });

        if (picked) {
          detector.designate(picked.terminal);
          vscode.window.showInformationMessage(
            `"${picked.terminal.name}" set as Claude Code terminal.`,
          );
        }
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeContextAdd.selectTerminal',
      async () => {
        const claudeTerminals = detector.getClaudeTerminals();

        if (claudeTerminals.length === 0) {
          vscode.window.showWarningMessage(
            'No Claude Code terminals found.',
          );
          return;
        }

        if (claudeTerminals.length === 1) {
          vscode.window.showInformationMessage(
            `Only one Claude Code terminal: "${claudeTerminals[0].name}"`,
          );
          return;
        }

        const items = claudeTerminals.map((t) => ({
          label: t.name,
          terminal: t,
          description: t === detector.target ? '(current target)' : undefined,
        }));

        const picked = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select which Claude Code terminal to target',
        });

        if (picked) {
          detector.designate(picked.terminal);
        }
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeContextAdd.selectTarget',
      async () => {
        const current = vscode.workspace
          .getConfiguration('claudeContextAdd')
          .get<string>('target', 'auto');

        const items: vscode.QuickPickItem[] = [
          {
            label: 'auto',
            description: 'Terminal first, fall back to Claude Code extension panel',
            detail: current === 'auto' ? '$(check) current' : undefined,
          },
          {
            label: 'terminal',
            description: 'Always send to the Claude Code terminal',
            detail: current === 'terminal' ? '$(check) current' : undefined,
          },
          {
            label: 'panel',
            description: 'Always send to the Claude Code VS Code extension panel',
            detail: current === 'panel' ? '$(check) current' : undefined,
          },
        ];

        const picked = await vscode.window.showQuickPick(items, {
          placeHolder: `Current: ${current} — select new target mode`,
        });

        if (picked) {
          await vscode.workspace
            .getConfiguration('claudeContextAdd')
            .update('target', picked.label, vscode.ConfigurationTarget.Global);
          vscode.window.showInformationMessage(
            `Claude Code Context Add: target set to "${picked.label}"`,
          );
        }
      },
    ),
  );
}

export function deactivate() {}
