# Profiles

> **框架 + profile + 專案設定 = 某個專案實際使用的 workflow。**

同一套知識生命週期，套到不同團隊時會有不同的「在地規則」：公司前端專案必須用內部 UI 元件庫、CI 有固定流程；個人 side project 一人兼 PM 與 RD，不需要等誰核准。這些差異放在 profile，而不是複製一份框架去改。

```text
kb 內建預設（框架 + 不變式）
  └─ <組織 repo>/profiles/frontend/profile.yaml   組織層：公司前端共通規範
       └─ <專案>/kb.config.yaml                專案層：負責人、路徑、這個專案的例外
```

## 三層各放什麼

| 層 | 放什麼 | 不放什麼 |
|---|---|---|
| **框架**（`kb` 指令、`PRINCIPLES.md`、`policies/`） | 文件類型、知識狀態、升級規則、AI 政策 | 任何特定團隊的習慣 |
| **profile**（`profiles/<名稱>/`） | 多個專案共用的規範：要注入 AI context 的規範文件、過期天數、哪些類型要核准 | 單一專案的路徑或人名 |
| **專案**（`kb.config.yaml`） | `extends`、`src`、`ownership`、這個專案特有的例外 | 應該被多個專案共用的規範（請上移到 profile） |

## 規則

1. **profile 只能收緊，不能放寬不變式。** 類型、知識狀態、關係、「AI 不能核准」等寫死在 `kb` 的程式碼（`src/model.js`），設定檔碰到這些鍵會直接報錯。`needs_approval`、`review_days` 這類「節奏」設定可以放寬（例如 `personal` profile）。
2. **規範要接進產物才有用。** 只寫一份 `ui-standards.md` 沒人會讀；用 `ai_context.include` 把它嵌進每一份 AI context，AI 實作時才看得到。
3. **profile 被引用，不被複製。** 專案用 `extends` 指向 profile（`kb:<名稱>`、共用 repo 或相對路徑）。改 profile = 所有專案下次 build 時一起生效。
4. **先有實例，再抽 profile。** 只有在第二個專案也需要同一條規則時，才把它從專案設定上移到 profile。

## 內附的 profile

| profile | 用途 |
|---|---|
| [`small-team/`](small-team/README.md) | 1 PM + 1 RD 的小型產品團隊：分工、節奏、CR 快速通道 |
| [`personal/`](personal/profile.yaml) | 個人 side project：一人團隊，放寬核准與審查節奏 |
| [`frontend-example/`](frontend-example/profile.yaml) | **範例**：前端團隊如何把 UI 元件庫與 CI 規範注入 AI context。複製到組織自己的 repo 再改 |

內附的 profile 用 `kb:<名稱>` 引用，不用寫安裝路徑：

```yaml
extends:
  - kb:small-team
```

組織自己的 profile（含內部套件名稱、內部流程）**不要**放進本 repo——放在組織的 repo，用相對路徑 extends。

用 `npx kb config` 檢查合併結果與套用順序。
