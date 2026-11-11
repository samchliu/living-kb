# 公司前端 UI 與 CI 規範

<!-- 這份文件會被整份嵌入每一份 ai-context.md 的「團隊／組織規範」章節。
     寫給 AI 程式助理看：用「必須 / 不得」陳述，具體到可以檢查。TODO 處請填入實際內容。 -->

## UI 元件

- 必須使用內部元件庫 `TODO: @company/ui`。版本以專案 `package.json` 為準。
- 不得直接使用第三方 UI 元件庫（TODO: 例如 MUI、Ant Design）或自刻與元件庫重複的元件。
- 顏色、間距、字級必須使用設計 token（TODO: token 套件或 CSS 變數前綴），不得寫死數值。
- 元件庫缺少需要的元件時：不要自行實作，列為未解問題並標示 `NEEDS CONFIRMATION (TODO: 設計系統負責人)`。

## CI 固定流程

| 步驟 | 指令 | 失敗時 |
|---|---|---|
| TODO: Lint | `TODO` | 修正，不得加 disable 註解繞過 |
| TODO: Type check | `TODO` | 修正型別，不得用 `any` 繞過 |
| TODO: Unit test | `TODO` | — |
| TODO: Visual regression | `TODO` | 確認是預期變更才更新 snapshot |

## PR

- PR 描述必須列出本次實作依據的知識 ID（`REQ-…`、`BR-…`、`API-…`）。
