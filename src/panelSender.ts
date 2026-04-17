import * as vscode from 'vscode';

const CLAUDE_EXT_ID = 'anthropic.claude-code';
const INSERT_CMD = 'claude-vscode.insertAtMention';


/**
 * Sends @-references to the Claude Code VS Code extension.
 *
 * CC's webview JS gates every insert with `if (this.isVisible.value)`, so only
 * *visible* panels process the message. We use this to route correctly:
 *
 *   1. If a CC editor-tab panel is the active tab in any editor group (visible):
 *      close the auxiliary bar so the CC sidebar won't also receive the insert,
 *      then call insertAtMention → editor panel(s) only.
 *
 *   2. If no CC editor-tab panel is visible (all are background tabs or not open):
 *      call insertAtMention directly → sidebar receives if it is visible;
 *      background editor-tab panels have isVisible=false and are silently skipped.
 */
export class PanelSender {
  static isAvailable(): boolean {
    return !!vscode.extensions.getExtension(CLAUDE_EXT_ID);
  }

  async addFiles(uris: vscode.Uri[]): Promise<void> {
    if (uris.length === 0) return;

    for (const uri of uris) {
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, {
        preview: true,
        preserveFocus: false,
      });
      await vscode.commands.executeCommand(INSERT_CMD);
    }
  }

  async sendSelection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
      vscode.window.showWarningMessage('No text selected.');
      return;
    }
    await vscode.commands.executeCommand(INSERT_CMD);
  }
}

