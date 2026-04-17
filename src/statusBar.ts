import * as vscode from 'vscode';
import { TerminalDetector } from './terminalDetector';

export class StatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];

  constructor(private readonly detector: TerminalDetector) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      50,
    );
    this.item.command = 'claudeContextAdd.sendSelectionToContext';

    this.disposables.push(
      this.item,
      detector.onDidChange(() => this.update()),
      vscode.window.onDidChangeTextEditorSelection(() => this.update()),
      vscode.window.onDidChangeActiveTextEditor(() => this.update()),
    );

    this.update();
  }

  private update(): void {
    if (!this.detector.hasTarget) {
      this.item.hide();
      return;
    }

    const hasSelection =
      vscode.window.activeTextEditor !== undefined &&
      !vscode.window.activeTextEditor.selection.isEmpty;

    if (hasSelection) {
      this.item.text = '$(terminal) Claude Code $(selection)';
      this.item.tooltip = 'Selection visible to Claude Code — click to send';
    } else {
      this.item.text = '$(terminal) Claude Code';
      this.item.tooltip = 'Claude Code terminal active';
    }

    this.item.show();
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
