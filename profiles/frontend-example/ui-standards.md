# 前端 UI 與 CI 規範（範例）

<!-- 這份文件會被整份嵌入每一份 ai-context.md 的「團隊／組織規範」章節。
     寫給 AI 程式助理看：用「必須 / 不得」陳述，具體到可以檢查。
     @acme/ui、指令名稱都是範例，請換成你組織的實際內容。 -->

## UI 元件

- 必須使用內部元件庫 `@acme/ui`。版本以專案 `package.json` 為準。
- 不得直接使用其他 UI 元件庫（例如 MUI、Ant Design），也不得自刻與元件庫重複的元件。
- 顏色、間距、字級必須使用設計 token（`--acme-*` CSS 變數），不得寫死數值。
- 元件庫缺少需要的元件時：不要自行實作，列為未解問題並標示 `NEEDS CONFIRMATION (Design)`。

## CI 固定流程

| 步驟 | 指令 | 失敗時 |
|---|---|---|
| Lint | `npm run lint` | 修正，不得加 disable 註解繞過 |
| Type check | `npm run typecheck` | 修正型別，不得用 `any` 繞過 |
| Unit test | `npm test` | 修正程式或確認測試本身有誤 |
| Visual regression | `npm run test:visual` | 確認是預期變更才更新 snapshot |

## MR

- MR 描述必須列出本次實作依據的知識 ID（`REQ-…`、`BR-…`、`API-…`）。
