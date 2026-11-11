---
id: API-001
title: GET /stores/{storeId}/recommendations
type: api
knowledge_state: authoritative
status: active
owner: RD
authors: [RD, AI]
created: 2026-07-18
updated: 2026-09-04
last_reviewed: 2026-09-04
review_every: 90d
approved_by:
  who: RD
  date: 2026-07-20
source_of_truth: self
related:
  - { id: REQ-001, rel: implements }
  - { id: BR-001, rel: implements }
  - { id: ADR-001, rel: governed_by }
  - { path: services/recommendation/api.py, rel: implemented_in }
  - { path: web/src/features/recommendations/, rel: implemented_in }
  - { path: tests/recommendation/test_api.py, rel: verified_by }
---

# API-001：`GET /api/v1/stores/{storeId}/recommendations`

## 端點

| 欄位 | 值 |
|---|---|
| Method | GET |
| Path | `/api/v1/stores/{storeId}/recommendations` |
| 驗證 | Session token；使用者必須是 `storeId` 的店長（或老闆角色） |
| 使用端 | Web app（手機瀏覽器） |
| 穩定度 | stable |

## 目的

回傳某間門市今日預先計算好的推薦（REQ-001）。唯讀；計算在每日排程工作中完成（BR-001#R8）。

## 請求

| 參數 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `storeId` | path | string | 是 | 例如 `S07` |
| `date` | query | `YYYY-MM-DD` | 否 | 預設為門市當地時間的今天 |

## 回應

| 欄位 | 型別 | 說明 | 規則 |
|---|---|---|---|
| `status` | `ready` \| `insufficient_data` \| `not_generated` | | R7、R8 |
| `data_window` | `{from, to, days}` | 實際使用的區間。**UI 必須顯示這個值，而不是寫死的數字。** | R1 |
| `items[]` | array，≤ 5 | 已排序 | R4 |
| `items[].type` | `restock` \| `promote` | | R3 |
| `items[].stock_on_hand` | int | 來自每晚快照 | R3 |
| `items[].avg_daily_sales` | number | 區間銷量 ÷ 區間天數 | R3 |
| `items[].days_of_cover` | number | 庫存可售天數 | R3 |
| `items[].reason.facts` | object | 文字唯一可以使用的數字 | R6 |
| `items[].reason.text` | string | LLM 撰寫或範本備援 | R6 |
| `items[].reason.source` | `llm` \| `template` | | ADR-001 |

```json
{
  "store_id": "S07",
  "date": "2026-09-10",
  "status": "ready",
  "data_window": { "from": "2026-08-27", "to": "2026-09-09", "days": 14 },
  "generated_at": "2026-09-10T05:12:44+08:00",
  "items": [
    {
      "rank": 1,
      "product_id": "P-88231",
      "product_name": "奶黃月餅禮盒（6 入）",
      "type": "restock",
      "stock_on_hand": 12,
      "avg_daily_sales": 4.4,
      "days_of_cover": 2.7,
      "reason": {
        "facts": { "units_sold_in_window": 62, "window_days": 14, "stock_on_hand": 12, "days_of_cover": 2.7 },
        "text": "過去 14 天賣出 62 盒，目前剩 12 盒——大約還夠賣 2.7 天。",
        "source": "llm"
      }
    }
  ]
}
```

## 錯誤

| 狀態碼 | 錯誤代碼 | 何時發生 | 用戶端應該 |
|---|---|---|---|
| 400 | `INVALID_DATE` | `date` 格式錯誤或是未來日期 | 顯示錯誤 |
| 401 | `UNAUTHENTICATED` | 沒有 session 或已過期 | 導向登入 |
| 403 | `FORBIDDEN_STORE` | 使用者不是這間門市的店長 | 顯示「無權限」 |
| 404 | `STORE_NOT_FOUND` | 不存在的 `storeId` | 顯示錯誤 |

`insufficient_data` 與 `not_generated` 是 `items` 為空的 **200** 回應——它們是正常狀態，不是錯誤。

## 執行的商業規則

| 規則 | 在哪裡執行 |
|---|---|
| BR-001#R1–R5、R7 | 每日排程工作（伺服器）；API 只讀取 |
| BR-001#R4 | 排程工作**與** API（API 防禦性地截斷為 5 筆） |
| BR-001#R6 | 排程工作（數字驗證防護、範本備援） |

## 效能預期

| 指標 | 目標 |
|---|---|
| p95 延遲 | < 300 ms（讀取預先計算的結果） |
| 回應大小 | < 10 KB |

## 變更歷史

| 日期 | 變更 | 破壞性？ | 核准者 |
|---|---|---|---|
| 2026-07-20 | 初版 | — | RD |
| 2026-09-04 | 註明 `data_window.days` 為 UI 必須顯示的值；範例更新為 14 天；`reason.facts` 新增 `window_days` | 否（新增欄位） | RD —— CR-001 |
