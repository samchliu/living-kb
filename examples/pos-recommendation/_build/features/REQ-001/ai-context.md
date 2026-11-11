<!-- 由 `kb build` 自動產生——請勿編輯。請修改來源文件後重新 build。 -->

# 實作 context：每日商品推薦 (REQ-001)

> **這是 build 產物，不是事實來源。** 若與來源文件不一致，以來源文件為準。每個段落都附有來源連結。

**來源：**[REQ-001](../../../requirement.md)@2026-09-04 · [BR-001](../../../business-rule.md)@2026-09-04 · [ADR-001](../../../adr.md)@2026-09-02 · [API-001](../../../api.md)@2026-09-04

給 AI 程式助理使用。**只由權威知識組成**——不含原型、回饋，也不含其他功能的草稿。

## 指示

- 把以下內容當作規格。以「必須（MUST）/ 不得（MUST NOT）」陳述的規則具有約束力。
- 如果既有程式碼與這裡的規則不一致，不要默默照程式碼做，也不要修改規則：以 DRIFT 回報給下方列出的負責人。
- 如果你需要的東西這裡沒有規定，不要自行發明。請提問，並指出應由哪位負責人回答。
- 在程式碼註解與測試名稱中引用知識 ID（例如 `# knowledge: BR-001`、`test_BR_001_R3_...`）。
- 下方的未解問題尚未有答案。不要猜測它們的答案。

## 範圍

<sub>來源：[REQ-001 · 範圍](../../../requirement.md) · active · 更新於 2026-09-04</sub>

### 必須（Must）
- 每間門市每日的**補貨**與**促銷**推薦清單 *（FB-001）*——規則見 BR-001
- 每則推薦都顯示**附數字的理由**，數字來自該門市自己的資料 *（FB-002）*——BR-001#R6
- 每則推薦都看得到目前庫存與庫存可售天數 *（FB-001）*
- 開店前準備好 *（FB-003）*——BR-001#R8

### 應該（Should）
- 可將推薦標記為「已處理」或「先不要」（用來衡量使用率）*（PROTO-003 T3——展示時店長主動按了這些按鈕）*

### 可以（Could）
- 依商品類別篩選

### 不在範圍內
- **銷售預測／預測圖表** *（FB-001：「比較不重要」）*
- 自動產生採購單——店長仍透過 ERP 下單
- 總部／多門市檢視（試點之後）
- 價格或折扣推薦
- 3 間試點門市以外的門市 *（FB-003，老闆）*

## 驗收條件

<sub>來源：[REQ-001 · 驗收條件](../../../requirement.md) · active · 更新於 2026-09-04</sub>

| # | 條件 | 規則 | 驗證方式 |
|---|---|---|---|
| AC1 | 假設試點門市有 ≥ 14 天的資料，當店長在 06:00 之後打開 App，則顯示今日推薦 | BR-001#R8 | e2e |
| AC2 | 清單永遠不會超過 5 則推薦 | BR-001#R4 | 單元 + e2e |
| AC3 | 每則推薦都顯示理由，且理由至少包含一個來自該門市自身資料的數字 | BR-001#R6 | 單元 + 手動 |
| AC4 | 每則推薦都顯示目前庫存與庫存可售天數，清單標題顯示所使用的資料區間（從 API 讀取，不寫死） | BR-001#R1、R3 | e2e |
| AC5 | 假設門市資料少於 14 天，App 顯示「資料還不夠」，而不是推薦 | BR-001#R7 | 單元 + e2e |
| AC6 | 已停售或供應商無法供貨的商品永遠不會出現 | BR-001#R5 | 單元 |

## 商業規則

### BR-001：每日推薦規則

#### 規則

<sub>來源：[BR-001 · 規則](../../../business-rule.md) · active · 更新於 2026-09-04</sub>

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

#### 參數

<sub>來源：[BR-001 · 參數](../../../business-rule.md) · active · 更新於 2026-09-04</sub>

| 參數 | 值 | 使用於 | 備註 |
|---|---|---|---|
| `lookback_window` | **14 天** | R1、R3 | v1.1 之前為 30 天（CR-001） |
| `min_sales_in_window` | **3 件** | R2 | v1.1 之前為 5 件（CR-001）——與區間大致維持相同比例（≈ 每天 0.2 件），讓滯銷品仍有資格被列為促銷 |
| `restock_threshold` | 3 天 | R3 | |
| `overstock_threshold` | 30 天 | R3 | |
| `max_recommendations` | 5 | R4 | |
| `min_history` | 14 天 | R7 | 現在等於 `lookback_window`——一定有完整區間可用 |

#### 範例

<sub>來源：[BR-001 · 範例](../../../business-rule.md) · active · 更新於 2026-09-04</sub>

| # | 情境 | 預期結果 | 規則 |
|---|---|---|---|
| E1 | 14 天賣出 62 件（每天 4.4 件），庫存 12 件 → 可售 2.7 天 | 補貨 | R3 |
| E2 | 14 天賣出 7 件（每天 0.5 件），庫存 40 件 → 可售 80 天 | 促銷 | R3 |
| E3 | 14 天賣出 2 件，庫存 30 件 | 不納入考量（低於最低 3 件） | R2 |
| E4 | 9 個商品符合條件（6 個補貨、3 個促銷） | 顯示 5 個補貨、0 個促銷 | R4 |
| E5 | 商品符合補貨條件，但*供應商無法供貨* | 不顯示 | R5 |
| E6 | 門市開幕 10 天 | 「資料還不夠」 | R7 |
| E7 | LLM 理由寫「上個月大約賣了 70 件」 | 無效——數字不在計算結果中，且區間錯誤；改用範本文字 | R6 |

## 約束實作的決策

### ADR-001：規則式評分 + LLM 撰寫說明文字

#### 決策

<sub>來源：[ADR-001 · 決策](../../../adr.md) · active · 更新於 2026-09-02</sub>

我們將以**基於 SQL 彙總資料的確定性規則**（BR-001）計算推薦，並**只用 LLM 來描述理由**，輸入是一組結構化的計算事實。如果生成的文字包含任何不在事實中的數字，就捨棄它，改用範本句子。

#### 後果

<sub>來源：[ADR-001 · 後果](../../../adr.md) · active · 更新於 2026-09-02</sub>

**正面**
- 每則推薦都能從資料中解釋與重現。
- BR-001 與程式碼、測試一一對應。
- 便宜：每則推薦一次小型 LLM 呼叫，每店每天最多 5 則。

**負面**
- 規則的反應速度受限於回溯區間；季節性暴增處理得不好。
- 門檻是手動調整的，不是學出來的。
- 「AI」只存在於措辭中——老闆應該知道這一點（PM 已告知，2026-07-17）。

**需要的後續行動**
- LLM 輸出的數字驗證防護（BR-001#R6）。
- 記錄「已處理」／「先不要」以衡量準確度（REQ-001 Q1）。

## 架構

_無。_

## 介面

### API-001：GET /stores/{storeId}/recommendations

#### 端點

<sub>來源：[API-001 · 端點](../../../api.md) · active · 更新於 2026-09-04</sub>

| 欄位 | 值 |
|---|---|
| Method | GET |
| Path | `/api/v1/stores/{storeId}/recommendations` |
| 驗證 | Session token；使用者必須是 `storeId` 的店長（或老闆角色） |
| 使用端 | Web app（手機瀏覽器） |
| 穩定度 | stable |

#### 請求

<sub>來源：[API-001 · 請求](../../../api.md) · active · 更新於 2026-09-04</sub>

| 參數 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| `storeId` | path | string | 是 | 例如 `S07` |
| `date` | query | `YYYY-MM-DD` | 否 | 預設為門市當地時間的今天 |

#### 回應

<sub>來源：[API-001 · 回應](../../../api.md) · active · 更新於 2026-09-04</sub>

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

#### 錯誤

<sub>來源：[API-001 · 錯誤](../../../api.md) · active · 更新於 2026-09-04</sub>

| 狀態碼 | 錯誤代碼 | 何時發生 | 用戶端應該 |
|---|---|---|---|
| 400 | `INVALID_DATE` | `date` 格式錯誤或是未來日期 | 顯示錯誤 |
| 401 | `UNAUTHENTICATED` | 沒有 session 或已過期 | 導向登入 |
| 403 | `FORBIDDEN_STORE` | 使用者不是這間門市的店長 | 顯示「無權限」 |
| 404 | `STORE_NOT_FOUND` | 不存在的 `storeId` | 顯示錯誤 |

`insufficient_data` 與 `not_generated` 是 `items` 為空的 **200** 回應——它們是正常狀態，不是錯誤。

## 程式碼與測試

| 路徑 | 關係 | 來自 |
|---|---|---|
| `jobs/daily_recommendations.py` | implemented_in | BR-001 |
| `prompts/recommendation_explanation.md` | implemented_in | ADR-001 |
| `services/recommendation/api.py` | implemented_in | API-001 |
| `services/recommendation/explain.py` | implemented_in | ADR-001 |
| `services/recommendation/scoring.py` | implemented_in | ADR-001 |
| `services/recommendation/scoring.py` | implemented_in | BR-001 |
| `sql/recommendation_window_agg.sql` | implemented_in | BR-001 |
| `tests/e2e/recommendations.spec.ts` | verified_by | BR-001 |
| `tests/e2e/recommendations.spec.ts` | verified_by | REQ-001 |
| `tests/recommendation/test_api.py` | verified_by | API-001 |
| `tests/recommendation/test_scoring.py` | verified_by | BR-001 |
| `web/src/features/recommendations/` | implemented_in | API-001 |

## 負責人（該問誰）

| 文件 | 標題 | 負責人 |
|---|---|---|
| REQ-001 | 每日商品推薦 | PM |
| BR-001 | 每日推薦規則 | PM |
| ADR-001 | 規則式評分 + LLM 撰寫說明文字 | RD |
| API-001 | GET /stores/{storeId}/recommendations | RD |

## 未解問題——不要猜測

<sub>來源：[REQ-001 · 未解問題](../../../requirement.md) · active · 更新於 2026-09-04</sub>

| # | 問題 | 負責人 | 狀態 |
|---|---|---|---|
| Q1 | 推薦要多準，店長才會持續信任它？ | PM | 未解——在試點中量測「先不要」的比例 |
| Q2 | 季節性商品是否應該另外處理？ | PM | 未解——由 FB-004 提出，見 CR-001 |
