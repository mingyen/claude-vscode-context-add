# Security Review — claude-code-context-add

**審查日期**：2026-05-08  
**審查版本**：1.0.0  
**審查方法**：原始碼審閱 + package.json 權限審閱 + Workspace Trust 設定驗證

---

## 1. 原始碼審閱

整個 extension 程式量小，審閱範圍：

- `src/extension.ts` — 指令註冊、target 路由
- `src/terminalDetector.ts` — 終端偵測
- `src/contextSender.ts` — 寫入終端的「危險出口」
- `src/panelSender.ts` — 委派給官方擴充套件
- `src/matching.ts` — 純函式（路徑、名稱、清理）
- `src/statusBar.ts` — UI

### 風險面（Sink 分析）

唯一會將資料送出的地方：

- `contextSender.ts` 的 `terminal.sendText(...)` — 寫入本機終端
- `panelSender.ts` 的 `vscode.commands.executeCommand('claude-vscode.insertAtMention')` — 委派給官方 Claude Code 擴充套件

**確認不存在以下高風險操作：**

| 類別 | 結論 |
|---|---|
| 網路呼叫（`fetch` / `http` / `axios` / WebSocket） | ✅ 無 |
| `child_process` / `exec` / `spawn` | ✅ 無 |
| `eval` / `Function` 動態程式碼 | ✅ 無 |
| 檔案寫入（`fs.write*` / `writeFile`） | ✅ 無 |
| 讀取使用者所選以外的檔案內容 | ✅ 無（panel 模式開啟的 URI 為使用者明確點選的目標） |

選取內容（程式碼本身）從未離開 VS Code；只送出「`@路徑:行號`」引用字串給**本機**的 Claude Code。

### 已實作的安全控制

| 風險 | 控制措施 | 實作位置 |
|---|---|---|
| 惡意檔名含 `\n` / `\r` → PTY 解讀為 Enter，觸發命令注入 | `sanitizePathForTerminal()` 剝除 `\x00-\x08`, `\x0a-\x1f`, `\x7f` | `src/matching.ts:53` |
| `terminal.sendText` 自動附加換行 | 第二參數明確傳 `false` | `src/contextSender.ts:22` |
| 自訂 regex 拋例外 → extension 崩潰 | `try/catch` 包住 `new RegExp` | `src/matching.ts:11` |
| 攻擊者重新命名 terminal 接收引用 | 需使用者主動觸發；`sendText` 不按 Enter，使用者送出前仍可檢視 | 設計保護 |

### 仍存在的小問題（非阻擋性）

1. **Unicode 行分隔符未過濾** — `sanitizePathForTerminal` 只處理 ASCII C0 控制字元。`U+2028` (LS) / `U+2029` (PS) / `U+0085` (NEL) 在某些 shell 下理論上可能被當換行。實務風險極低，可選擇在 regex 中加上 `\u0085\u2028\u2029`。

2. **`terminalNamePatterns` 接受任意 regex** — 可能被惡意設定觸發 ReDoS，但屬使用者自身 settings.json，威脅模型上為自傷，且 supply chain 上不構成威脅。

3. **`internalRepository` 欄位殘留 `package.json`** — `http://git.domob-inc.cn/...` 是 HTTP 內部 URL，非安全漏洞，但發佈前應移除（資訊洩露 / 發佈衛生）。

4. **`matchesClaudeTerminalName` 啟發式過寬** — 任何名稱含 "claude" 或符合 bare semver `\d+\.\d+\.\d+` 均判定為 Claude 終端。攻擊需使用者主動觸發，影響輕微；可視需要收緊判斷條件或改為 designate 機制。

5. **`require('path')` 在 `matching.ts:23`** — CommonJS require 而非 ES import，純風格問題，無安全影響。

---

## 2. Extension 權限審閱（package.json）

| 類別 | 實際取得 | 評估 |
|---|---|---|
| `activationEvents` | `onStartupFinished` | 標準啟動，無高權限觸發 |
| `commands` | 5 個自定義指令 | 全部使用者操作驅動 |
| `menus` | explorer/editor context、editor title、commandPalette | 標準 UX 範圍 |
| `keybindings` | `Cmd+Shift+.` / `Cmd+L` | ⚠️ `Cmd+L` 在 macOS 會覆蓋「展開選取至整行」預設行為，非安全問題但影響 UX |
| `configuration` | 2 個設定 | 無敏感資料 |
| `authentication` / `secretStorage` / `debuggers` / `languages` | 無 | ✅ 無高權限 API |

**Runtime dependencies = 0**。所有 devDependencies 僅在 build/test 使用，最終以 esbuild bundle 進 `dist/extension.js`，supply chain 表面極小。

---

## 3. Workspace Trust / Restricted Mode

`package.json` 已正確宣告：

```json
"capabilities": {
  "untrustedWorkspaces": {
    "supported": "limited",
    "description": "In untrusted workspaces, file paths from the workspace are sanitized before being sent to the Claude Code terminal to prevent injection of control characters. All commands remain available."
  }
}
```

- `supported: "limited"` 是合理選擇 — 在 untrusted workspace 仍可運作，並靠 `sanitizePathForTerminal` 緩解惡意檔名注入。
- 惡意檔名換行注入（剛 clone 的不熟 repo 最危險）已在 `contextSender.ts` 封堵。
- VS Code 開啟未信任工作區時會向使用者顯示此 description。

---

## 整體結論

**此 extension 在安全性上屬可接受範圍，未發現 OWASP Top 10 等級的漏洞。**

| 項目 | 狀態 |
|---|---|
| 無網路、無檔案寫入、無 shell 執行、無動態程式碼 | ✅ |
| 唯一危險 sink（`terminal.sendText`）已正確 sanitize | ✅ |
| Workspace Trust 宣告與實作一致 | ✅ |
| 零 runtime dependencies，supply chain 表面極小 | ✅ |
| 使用者主動觸發；`sendText(..., false)` 不按 Enter，保留最後審視機會 | ✅ |

### 可選硬化項目（建議但非必要）

- [ ] 將 `\u0085\u2028\u2029` 加入 `sanitizePathForTerminal` 的 regex
- [ ] 發佈前移除 `package.json` 中的 `internalRepository` 欄位
- [ ] 收緊 `matchesClaudeTerminalName`（移除 bare semver 啟發式，或改為 require designate）
