---
id: CR-000
title: <用幾個字描述要求的變更>
type: change-request
knowledge_state: authoritative   # 決定之後即為一份決策紀錄
status: draft             # draft → review（已完成影響分析）→ approved | archived（否決／延後／完成）
owner: PM
authors: [PM, AI]
created: YYYY-MM-DD
updated: YYYY-MM-DD
source_of_truth: self
related:
  - id: <被變更的 REQ/BR/ADR/API>
    rel: changes
  - id: <觸發的 FB>
    rel: derived_from
---

# CR-000：<用幾個字描述要求的變更>

> **不要試圖阻止變更。讓變更的成本與影響清楚可見。**

## 要求的變更（Requested Change）

<!-- 盡可能逐字記錄。誰提出、何時提出。 -->

> 「…」
> —— <誰>，<日期>

## 原因（Reason）

<!-- 為什麼要改。連結證據（FB、指標）。若原因不明，就寫明——並去問。 -->

## 影響（Impact）

<!-- 由影響分析 Agent 填寫，PM 與 RD 審查。沒有影響就明確寫「無」，不要留白。 -->

| 領域 | 影響程度 | 說明 | 受影響的知識 / 程式碼 |
|---|---|---|---|
| 產品影響（Product） | 無 / 低 / 中 / 高 | | REQ-… |
| 前端影響（Frontend） | | | |
| 後端影響（Backend） | | | |
| AI / Agent 影響 | | prompt、模型行為、生成文字 | |
| 資料影響（Data） | | 查詢、schema、回填、歷史資料 | |
| 測試影響（Testing） | | | |
| 文件影響（Documentation） | | | BR-…、ADR-…、API-… |

**風險／副作用：**
-

**未解問題：**
-

## 估算（Estimate）

| 工作 | 規模 | 誰 |
|---|---|---|
| | S / M / L 或工時 | |
| **合計** | | |

## 決定（Decision）

- [ ] 核准
- [ ] 附條件核准：…
- [ ] 延後至：…
- [ ] 否決——原因：…

**決策者（Decision Maker）：** <人員>
**日期：** YYYY-MM-DD

## 後續行動（Follow-up）

<!-- 決定之後需要的具體更新。文件維護 Agent 可以起草文件更新。 -->

| 行動 | 負責人 | 完成 |
|---|---|---|
| 更新 BR-…（變更歷史 v…） | PM | [ ] |
| 更新 ADR-… 備註／新 ADR | RD | [ ] |
| 程式碼 + 測試 | RD | [ ] |
| 通知 <利害關係人> | PM | [ ] |
