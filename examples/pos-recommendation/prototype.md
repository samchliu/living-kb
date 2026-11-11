# 原型：PROTO-001 → PROTO-002 → PROTO-003

> ⚠️ **所有原型都是探索性的。** 它們是（用 AI 做成的單一 HTML 檔、資料寫死）用來*發現*需求的工具。這裡展示的任何東西都不是商業規則。規則在 [BR-001](business-rule.md)。

---

## PROTO-001：銷售儀表板 v1

```yaml
id: PROTO-001
title: 銷售儀表板 v1
type: prototype
knowledge_state: exploratory
status: archived
owner: PM
authors: [PM, AI]
confidence: hypothesis
created: 2026-06-05
updated: 2026-06-16
source_of_truth: none
superseded_by: PROTO-002
related:
  - { id: EXP-001, rel: explores }
  - { path: docs/exploration/PROTO-001/index.html, rel: relates_to }
```

**目的：** 搞清楚老闆說的「AI 推薦」是什麼意思。

| 要測試什麼 | 如何測試 |
|---|---|
| T1 他們要的是銷售預測嗎？ | 7 天銷售預測圖，放在最顯眼的位置 |
| T2 熱銷商品清單有用嗎？ | 「本週前 10 名商品」表格 |

| 刻意做假的部分 | 實際情況 |
|---|---|
| 銷售預測 | 手畫的曲線，沒有模型 |
| 資料 | 一間門市、一週，手動輸入 |

**內建假設：** P1 預測是主要價值（刻意的——這就是要測試的）· P2 以週為單位檢視（意外的）。

**回饋：** FB-001 —— 預測不重要；庫存才重要。

---

## PROTO-002：庫存清單

```yaml
id: PROTO-002
title: 以庫存為主的補貨／庫存過多清單
type: prototype
knowledge_state: exploratory
status: archived
owner: PM
authors: [PM, AI]
confidence: supported
created: 2026-06-16
updated: 2026-06-26
source_of_truth: none
supersedes: [PROTO-001]
superseded_by: PROTO-003
related:
  - { id: EXP-001, rel: explores }
  - { id: FB-001, rel: derived_from }
```

**目的：** 測試以庫存為主的檢視是否是店長會據以行動的東西。

| 要測試什麼 | 如何測試 |
|---|---|
| T1 店長會使用「補貨」與「庫存過多」清單嗎？ | 兩份清單：「快沒貨了」與「庫存太多」 |

| 刻意做假的部分 | 實際情況 |
|---|---|
| 庫存量 | 編造的數字 |
| 「AI」排序 | 手動排序 |

**內建假設：** P1 兩個類別（補貨／促銷）就夠了 · P2 店長會信任一份排序過的清單 *（已測試 → 錯誤，FB-002）*。

**回饋：** FB-002 ——「AI 為什麼推薦這個商品？」

---

## PROTO-003：附上理由的推薦卡片

```yaml
id: PROTO-003
title: 附上理由的每日推薦卡片
type: prototype
knowledge_state: exploratory
status: archived
owner: PM
authors: [PM, AI]
confidence: confirmed
created: 2026-06-26
updated: 2026-07-15
source_of_truth: none
supersedes: [PROTO-002]
related:
  - { id: EXP-001, rel: explores }
  - { id: FB-002, rel: derived_from }
  - { path: docs/exploration/PROTO-003/index.html, rel: relates_to }
```

**目的：** 測試顯示理由是否能讓店長信任並依推薦行動。

**原型檔案：** `docs/exploration/PROTO-003/index.html` —— 手機大小的頁面「03 店今日推薦」，卡片長這樣：

```text
┌──────────────────────────────────────────────┐
│ 補貨  烏龍茶 600ml                             │
│ 只剩 8 瓶——過去 30 天賣了 96 瓶                │
│ （約每天 3 瓶）。大約還夠賣 2.5 天。            │
│ [ 已處理 ]  [ 先不要 ]                          │
└──────────────────────────────────────────────┘
```

| 要測試什麼 | 如何測試 |
|---|---|
| T1 理由能提高信任嗎？ | 每張卡片都有一句附數字的理由 |
| T2 短清單就夠了嗎？ | 5 張卡片 |
| T3 店長想標記「已處理」嗎？ | 「已處理／先不要」按鈕（沒有功能） |

| 刻意做假的部分 | 實際情況 |
|---|---|
| 理由文字 | 手寫，模仿 LLM 可能產生的風格 |
| 數字 | 編造的；「30 天」區間是 PM 未經分析隨手選的 |
| 已處理／先不要 | 按鈕沒有作用 |

| # | 內建假設 | 刻意的？ | 備註 |
|---|---|---|---|
| P1 | 理由使用 **30 天**銷售區間 | **意外的** | 看起來合理；從未討論過。後來經 PM 確認成為 BR-001#R1 v1.0。 |
| P2 | 剛好 **5** 張卡片 | **意外的**——剛好塞得進手機螢幕 | 被需求探索 Agent 標示為*不是證據* |
| P3 | 排序時補貨排在促銷之前 | 刻意的 | 店長說缺貨比較痛 |

**已知限制：** 單一門市；沒有真實資料；沒有多日檢視。

**回饋：** FB-003 ——「對，這就是我要的。」

### 版本歷史

| 版本 | 日期 | 變更 | 原因 |
|---|---|---|---|
| v1 | 2026-06-26 | 初版 | FB-002 |
| v1.1 | 2026-06-28 | 理由文字縮短；先顯示庫存數字 | 03 店店長的非正式意見（記錄於 FB-003） |

> **備註（2026-09-04）：** BR-001 現在使用 14 天區間（CR-001）。本原型仍寫著「30 天」——這是刻意的。它是當時測試內容的歷史紀錄，而不是目前的行為。
