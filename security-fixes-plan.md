# 修補計畫：終端注入與 Workspace Trust 缺口

## Context（修改原因）

先前的安全審查在過濾假陽性時被推翻，但複審發現兩個真實問題：

1. **路徑換行注入**：`src/contextSender.ts` 的 `terminal.sendText(' ' + refs + ' ', false)` 第二個參數 `false` 只會抑制「結尾」自動換行，**不會過濾字串中嵌入的 `\n` / `\r`**。Unix 檔案系統允許檔名包含換行字元，因此惡意 repo 可植入帶換行的檔名（例如 `evil\n; rm -rf ~\n.txt`），使用者一旦右鍵「Add to Claude Code」，嵌入的換行會被 PTY 視為 Enter，導致命令注入。
2. **缺少 Workspace Trust 宣告**：`package.json` 沒有 `capabilities.untrustedWorkspaces` 欄位。VS Code 對未宣告的擴充套件預設給予完整信任，意味著上述攻擊在不可信工作區（剛 clone 的不熟 repo）也能觸發——而這正是攻擊最可能發生的場景。

預期成果：清理嵌入路徑中的控制字元、明確宣告本擴充套件對 untrusted workspace 的支援等級，並補上單元測試。`PanelSender` 不受影響（它委派給官方擴充套件 `claude-vscode.insertAtMention`，不直接傳遞路徑字串）。

## 變更檔案

| 檔案 | 變更摘要 |
|---|---|
| `src/matching.ts` | 新增 `sanitizePathForTerminal(path)` 純函式 |
| `src/contextSender.ts` | 在送出前清理路徑，避免嵌入控制字元 |
| `src/__tests__/matching.test.ts` | 補上 `sanitizePathForTerminal` 的測試 |
| `package.json` | 加上 `capabilities.untrustedWorkspaces` 宣告 |

## 詳細步驟

### 1. `src/matching.ts` — 新增清理函式

於檔案末端追加（純函式，無 vscode 相依，可走 vitest）：

```ts
/**
 * Strip characters that would break out of a terminal paste buffer.
 * Newlines (\n, \r) are interpreted as Enter by the PTY even when
 * terminal.sendText(..., false) is used, which suppresses only the
 * trailing newline appended by VS Code.
 *
 * Returns the cleaned path; callers should compare against the input
 * to detect when sanitization actually stripped something so they can
 * surface a warning.
 */
export function sanitizePathForTerminal(path: string): string {
  // Strip CR, LF, and other C0 control characters that terminals interpret.
  // Tabs (\x09) are kept as they are valid path characters and harmless in shells.
  return path.replace(/[\x00-\x08\x0a-\x1f\x7f]/g, '');
}
```

### 2. `src/contextSender.ts` — 清理 + 警告

修改 `addFiles()`（約第 8–18 行）：

```ts
addFiles(uris: vscode.Uri[]): void {
  const terminal = this.requireTerminal();
  if (!terminal) return;

  const workspacePaths = this.getTerminalWorkspacePaths(terminal);
  const rawRefs = uris.map((uri) => toRelativePath(uri.fsPath, workspacePaths));
  const safeRefs = rawRefs.map((p) => sanitizePathForTerminal(p));
  const stripped = rawRefs.some((p, i) => p !== safeRefs[i]);

  if (stripped) {
    vscode.window.showWarningMessage(
      'Removed unsafe characters (newlines/control codes) from one or more file paths before sending to terminal.',
    );
  }

  const refs = safeRefs.map((p) => `@${p}`).join(' ');
  terminal.sendText(' ' + refs + ' ', false);
  terminal.show(false);
}
```

修改 `sendSelection()`（約第 20–39 行）—— 同樣於計算 `filePath` 後呼叫 `sanitizePathForTerminal`，若被改動就警告並使用 sanitize 過的版本。

匯入區段更新：
```ts
import { toRelativePath, formatLineRef, sanitizePathForTerminal } from './matching';
```

### 3. `src/__tests__/matching.test.ts` — 新增測試

於檔尾新增 describe 區塊：

```ts
describe('sanitizePathForTerminal', () => {
  it('passes normal paths through unchanged', () => {
    expect(sanitizePathForTerminal('src/index.ts')).toBe('src/index.ts');
    expect(sanitizePathForTerminal('/abs/path/to/file.ts')).toBe('/abs/path/to/file.ts');
  });

  it('strips embedded LF', () => {
    expect(sanitizePathForTerminal('evil\n; rm -rf ~\n.txt'))
      .toBe('evil; rm -rf ~.txt');
  });

  it('strips embedded CR', () => {
    expect(sanitizePathForTerminal('foo\rbar.ts')).toBe('foobar.ts');
  });

  it('strips other C0 control characters', () => {
    expect(sanitizePathForTerminal('a\x00b\x07c.ts')).toBe('abc.ts');
  });

  it('preserves tab characters', () => {
    expect(sanitizePathForTerminal('a\tb.ts')).toBe('a\tb.ts');
  });
});
```

並更新檔頂的 import：
```ts
import {
  matchesClaudeTerminalName,
  toRelativePath,
  formatLineRef,
  sanitizePathForTerminal,
} from '../matching';
```

### 4. `package.json` — 宣告 Workspace Trust

於 `contributes` 區塊**外層**（與 `contributes` 同層、`activationEvents` 後）加上：

```json
"capabilities": {
  "untrustedWorkspaces": {
    "supported": "limited",
    "description": "In untrusted workspaces, file paths from the workspace are sanitized before being sent to the Claude Code terminal to prevent injection of control characters. All commands remain available."
  }
}
```

選用 `"limited"` 而非 `false`，理由：經第 1–3 步清理後，嵌入控制字元的攻擊面已封堵，沒必要在不可信工作區完全停用功能（避免 UX 倒退）。`description` 會顯示在 VS Code 的 Workspace Trust 提示中。

## 驗證方式

1. **單元測試**
   ```bash
   npm test
   ```
   應看到 `sanitizePathForTerminal` 5 個新案例全綠，原有測試不被影響。

2. **建置**
   ```bash
   npm run build
   ```
   確認 esbuild 無錯誤、`dist/extension.js` 產生。

3. **手動冒煙測試**（macOS / Linux）
   - 於測試 repo 建立含換行檔名的檔案：
     ```bash
     touch "$(printf 'evil\n; echo PWNED\n.txt')"
     ```
   - `npm run launch` 開啟 Extension Host
   - 在 VS Code Explorer 右鍵此檔案 → "Add to Claude Code"
   - 預期：跳出警告訊息「Removed unsafe characters…」，且終端緩衝中不含真正的換行（不會自動執行 `echo PWNED`）

4. **Workspace Trust 驗證**
   - 開啟一個尚未信任的 workspace
   - VS Code 設定頁的 Extensions 區塊應顯示本擴充套件的 untrusted workspace description
   - 命令仍可用、但路徑會被清理

## 不在此次範圍

- ReDoS（`terminalNamePatterns` 自訂正規表達式）—屬於審查指引硬性排除的 DoS 類別。
- 將 `internalRepository` 欄位從 `package.json` 移除—屬於發佈衛生問題，與本安全修補正交，可另開 PR 處理。
- Semver 終端名稱過度匹配（`VERSION_PATTERN`）—僅是邏輯啟發式問題，路徑清理已封住對應的注入面，不需在此一併處理。
