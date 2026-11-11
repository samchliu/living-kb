---
id: BR-001
title: 每日推薦規則
type: business-rule
knowledge_state: authoritative
status: active
owner: PM
authors: [AI, PM, RD]
created: 2026-07-08
updated: 2026-09-04
last_reviewed: 2026-09-04
review_every: 90d
approved_by:
  who: PM
  date: 2026-09-02
source_of_truth: self
related:
  - { id: REQ-001, rel: derived_from }
  - { id: FB-002, rel: derived_from }
  - { id: FB-003, rel: derived_from }
  - { path: services/recommendation/scoring.py, rel: implemented_in }
  - { path: jobs/daily_recommendations.py, rel: implemented_in }
  - { path: sql/recommendation_window_agg.sql, rel: implemented_in }
  - { path: tests/recommendation/test_scoring.py, rel: verified_by }
  - { path: tests/e2e/recommendations.spec.ts, rel: verified_by }
---

# BR-001：每日推薦規則

> **權威。** 如果程式碼、原型或任何人的記憶與本文件不一致，那是要回報的衝突——而不是悄悄修改任何一方的理由。

## 規則

| # | 規則 |
|---|---|
| R1 | 門市的推薦**必須**依據該門市截至昨日為止、**回溯區間**內的 POS 銷售資料計算。 |
| R2 | 商品在區間內至少要賣出 **min_sales_in_window** 件，才會被納入考量。 |
| R3 | `庫存可售天數 = 現有庫存 ÷（區間內銷量 ÷ 回溯區間天數）`。若 `庫存可售天數 < restock_threshold`，商品為**補貨（RESTOCK）**；若 `庫存可售天數 > overstock_threshold`，則為**促銷（PROMOTE）**。 |
| R4 | 每間門市每天最多 **max_recommendations** 則。補貨項目排在前面（可售天數最低者優先），接著是促銷項目（可售天數最高者優先）。 |
| R5 | ERP 中標記為*停售*或*供應商無法供貨*的商品**不得**被推薦。 |
| R6 | 每則推薦**必須**附上理由，且理由至少包含一個依 R1–R3 計算出的數字事實。理由**不得**包含任何不在計算結果中的數字。 |
| R7 | POS 資料少於 **min_history** 天的門市**不得**產生推薦；App 顯示「資料還不夠」。 |
| R8 | 推薦**必須**在**門市當地時間 06:00 前**可用，使用前一日結帳後的 POS 資料與每晚的庫存快照。 |

## 參數

| 參數 | 值 | 使用於 | 備註 |
|---|---|---|---|
| `lookback_window` | **14 天** | R1、R3 | v1.1 之前為 30 天（CR-001） |
| `min_sales_in_window` | **3 件** | R2 | v1.1 之前為 5 件（CR-001）——與區間大致維持相同比例（≈ 每天 0.2 件），讓滯銷品仍有資格被列為促銷 |
| `restock_threshold` | 3 天 | R3 | |
| `overstock_threshold` | 30 天 | R3 | |
| `max_recommendations` | 5 | R4 | |
| `min_history` | 14 天 | R7 | 現在等於 `lookback_window`——一定有完整區間可用 |

## 理由

| 規則 | 為什麼 | 證據 |
|---|---|---|
| R1 | 近期銷售反映目前需求；14 天能在幾天內反應季節性暴增，同時平滑單日雜訊 | FB-004、CR-001 |
| R2 | 避免因為 1–2 筆偶然的銷售就做出推薦 | RD 分析 2026-07-10；於 CR-001 重新校準 |
| R3 | 店長思考的方式是「還有幾天會賣完」 | FB-002（「賣了 90 個、只剩 8 個」） |
| R4 | 「幾則就好」——再多就不會看。**5** 是 PM 於 2026-07-15 選定的「幾則」上限；它在 PROTO-003 中只是意外出現，**未**被當作證據。 | FB-003 I3 |
| R5 | 推薦一個訂不到的商品會摧毀信任 | PM 決定，2026-07-15 |
| R6 | 店長不理解原因就不會行動；LLM 文字不得捏造數字 | FB-002、ADR-001 |
| R7 | 在不完整區間上取平均會誤導 | RD，2026-07-10 |
| R8 | 店長在開店前查看（最早 08:00） | FB-003 I2 |

## 適用條件

適用於試點門市 03、07、11（REQ-001 範圍）。所有商品類別。每間門市每天計算一次。

## 例外

目前沒有核准的例外。*（季節性商品是未解問題——REQ-001 Q2。）*

## 範例

| # | 情境 | 預期結果 | 規則 |
|---|---|---|---|
| E1 | 14 天賣出 62 件（每天 4.4 件），庫存 12 件 → 可售 2.7 天 | 補貨 | R3 |
| E2 | 14 天賣出 7 件（每天 0.5 件），庫存 40 件 → 可售 80 天 | 促銷 | R3 |
| E3 | 14 天賣出 2 件，庫存 30 件 | 不納入考量（低於最低 3 件） | R2 |
| E4 | 9 個商品符合條件（6 個補貨、3 個促銷） | 顯示 5 個補貨、0 個促銷 | R4 |
| E5 | 商品符合補貨條件，但*供應商無法供貨* | 不顯示 | R5 |
| E6 | 門市開幕 10 天 | 「資料還不夠」 | R7 |
| E7 | LLM 理由寫「上個月大約賣了 70 件」 | 無效——數字不在計算結果中，且區間錯誤；改用範本文字 | R6 |

## 相關知識

| 種類 | 連結 |
|---|---|
| 需求 | REQ-001 |
| ADR | ADR-001（實作這些規則的策略） |
| API | API-001（提供 R3 的事實與 R6 的理由） |
| 程式碼 | `services/recommendation/scoring.py`、`jobs/daily_recommendations.py`、`sql/recommendation_window_agg.sql` |
| 測試 | `tests/recommendation/test_scoring.py`、`tests/e2e/recommendations.spec.ts` |

## 變更歷史

| 日期 | 版本 | 變更 | 原因 | 核准者 |
|---|---|---|---|---|
| 2026-07-08 | 0.1 | 由需求探索 Agent 起草候選規則（R4 被標示為原型假設） | REQ-001 草稿 | — |
| 2026-07-15 | 1.0 | 核准。區間 30 天，最低銷量 5 件。 | REQ-001 | PM |
| 2026-09-02 | 1.1 | `lookback_window` 30 → 14 天；`min_sales_in_window` 5 → 3 | CR-001（FB-004） | PM（決定者：老闆 + PM） |
