<!-- 由 `kb build` 自動產生——請勿編輯。請修改來源文件後重新 build。 -->

# 功能總覽：每日商品推薦 (REQ-001)

> **這是 build 產物，不是事實來源。** 若與來源文件不一致，以來源文件為準。每個段落都附有來源連結。

**來源：**[REQ-001](../../../requirement.md)@2026-09-04 · [EXP-001](../../../exploration.md)@2026-07-15 · [PROTO-003](../../../prototype.md)@2026-07-15 · [FB-001](../../../feedback.md)@2026-06-09 · [FB-002](../../../feedback.md)@2026-06-19 · [FB-003](../../../feedback.md)@2026-07-01 · [FB-004](../../../feedback.md)@2026-08-26 · [CR-001](../../../impact-analysis.md)@2026-09-16 · [BR-001](../../../business-rule.md)@2026-09-04 · [ADR-001](../../../adr.md)@2026-09-02 · [API-001](../../../api.md)@2026-09-04

## 1. 做什麼、為什麼

### 問題

<sub>來源：[REQ-001 · 問題](../../../requirement.md) · active · 更新於 2026-09-04</sub>

店長都是在客人問起時才發現商品缺貨，要到商品過期或需要出清時才發現庫存過多。POS 與庫存資料都存在，但在忙碌的早上太原始、無法直接行動。*（FB-001、FB-002）*

### 目標

<sub>來源：[REQ-001 · 目標](../../../requirement.md) · active · 更新於 2026-09-04</sub>

每位試點門市店長每天早上開店前，都能拿到一份簡短、值得信任的清單，告訴他該補什麼、該推什麼。

成功指標（試點，8 週）：店長每 7 天中至少有 4 天打開清單；≥ 50% 的推薦被標記為「已處理」。*（目標由 PM 設定，尚未驗證。）*

### 使用者

<sub>來源：[REQ-001 · 使用者](../../../requirement.md) · active · 更新於 2026-09-04</sub>

| 使用者 | 需要 |
|---|---|
| 店長（試點：03、07、11 店） | 知道今天要補什麼貨、推什麼商品，以及原因 |
| 老闆 | 看到資料真的有被使用（使用率數字） |

### 範圍

<sub>來源：[REQ-001 · 範圍](../../../requirement.md) · active · 更新於 2026-09-04</sub>

#### 必須（Must）
- 每間門市每日的**補貨**與**促銷**推薦清單 *（FB-001）*——規則見 BR-001
- 每則推薦都顯示**附數字的理由**，數字來自該門市自己的資料 *（FB-002）*——BR-001#R6
- 每則推薦都看得到目前庫存與庫存可售天數 *（FB-001）*
- 開店前準備好 *（FB-003）*——BR-001#R8

#### 應該（Should）
- 可將推薦標記為「已處理」或「先不要」（用來衡量使用率）*（PROTO-003 T3——展示時店長主動按了這些按鈕）*

#### 可以（Could）
- 依商品類別篩選

#### 不在範圍內
- **銷售預測／預測圖表** *（FB-001：「比較不重要」）*
- 自動產生採購單——店長仍透過 ERP 下單
- 總部／多門市檢視（試點之後）
- 價格或折扣推薦
- 3 間試點門市以外的門市 *（FB-003，老闆）*

### 限制

<sub>來源：[REQ-001 · 限制](../../../requirement.md) · active · 更新於 2026-09-04</sub>

- 試點須於 2026 年 8 月中上線（老闆）。
- 庫存資料來自 ERP 每晚的快照（約 02:00）。沒有即時庫存。
- 店長使用手機；必須能在小螢幕上使用。

## 2. 驗收條件

<sub>來源：[REQ-001 · 驗收條件](../../../requirement.md) · active · 更新於 2026-09-04</sub>

| # | 條件 | 規則 | 驗證方式 |
|---|---|---|---|
| AC1 | 假設試點門市有 ≥ 14 天的資料，當店長在 06:00 之後打開 App，則顯示今日推薦 | BR-001#R8 | e2e |
| AC2 | 清單永遠不會超過 5 則推薦 | BR-001#R4 | 單元 + e2e |
| AC3 | 每則推薦都顯示理由，且理由至少包含一個來自該門市自身資料的數字 | BR-001#R6 | 單元 + 手動 |
| AC4 | 每則推薦都顯示目前庫存與庫存可售天數，清單標題顯示所使用的資料區間（從 API 讀取，不寫死） | BR-001#R1、R3 | e2e |
| AC5 | 假設門市資料少於 14 天，App 顯示「資料還不夠」，而不是推薦 | BR-001#R7 | 單元 + e2e |
| AC6 | 已停售或供應商無法供貨的商品永遠不會出現 | BR-001#R5 | 單元 |

## 3. 商業規則

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

#### 理由

<sub>來源：[BR-001 · 理由](../../../business-rule.md) · active · 更新於 2026-09-04</sub>

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

## 4. 技術決策

### ADR-001：規則式評分 + LLM 撰寫說明文字

#### 決策

<sub>來源：[ADR-001 · 決策](../../../adr.md) · active · 更新於 2026-09-02</sub>

我們將以**基於 SQL 彙總資料的確定性規則**（BR-001）計算推薦，並**只用 LLM 來描述理由**，輸入是一組結構化的計算事實。如果生成的文字包含任何不在事實中的數字，就捨棄它，改用範本句子。

#### 取捨

<sub>來源：[ADR-001 · 取捨](../../../adr.md) · active · 更新於 2026-09-02</sub>

| 我們得到 | 我們放棄 |
|---|---|
| 可解釋性、可測試性、上線速度 | 預測準確度、對季節性的自動適應 |

**重新檢視條件：** 累積 ≥ 12 個月歷史資料且涵蓋 ≥ 10 間門市，**或**店長反覆回報推薦太慢或錯誤。

## 5. 架構

_無。_

## 6. 介面

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

## 7. 實作與測試

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

## 8. 目前狀態

### 未解問題

<sub>來源：[REQ-001 · 未解問題](../../../requirement.md) · active · 更新於 2026-09-04</sub>

| # | 問題 | 負責人 | 狀態 |
|---|---|---|---|
| Q1 | 推薦要多準，店長才會持續信任它？ | PM | 未解——在試點中量測「先不要」的比例 |
| Q2 | 季節性商品是否應該另外處理？ | PM | 未解——由 FB-004 提出，見 CR-001 |

### 變更申請

| 文件 | 標題 | 狀態 | 更新日 |
|---|---|---|---|
| [CR-001](../../../impact-analysis.md) | 將推薦區間從 30 天改為 14 天 | archived | 2026-09-16 |

### 健康檢查結果

_無。_

## 9. 背景（探索性知識）

> 這些文件記錄了這個功能是如何被發現的。它們是**證據，不是規則**——本來就可能過時或錯誤。請不要依據它們實作。

| 文件 | 類型 | 標題 | 狀態 | 信心程度 |
|---|---|---|---|---|
| [EXP-001](../../../exploration.md) | exploration | POS 資料分析與 AI 商品推薦 | archived | confirmed |
| [PROTO-003](../../../prototype.md) | prototype | 附上理由的每日推薦卡片 | archived | confirmed |
| [FB-001](../../../feedback.md) | feedback | 老闆與店長對 PROTO-001 的回饋 | archived | supported |
| [FB-002](../../../feedback.md) | feedback | 03 店店長對 PROTO-002 的回饋——需要理由 | archived | supported |
| [FB-003](../../../feedback.md) | feedback | 老闆與店長確認 PROTO-003 | archived | supported |
| [FB-004](../../../feedback.md) | feedback | 試點門市——推薦跟不上需求暴增 | archived | supported |

## 10. 變更紀錄（所有來源）

| 日期 | 文件 | 版本 | 變更 |
|---|---|---|---|
| 2026-09-04 | REQ-001 | 1.1 | AC4：清單標題顯示資料區間，從 API 讀取（原為「依據最近 30 天」）；新增 Q2 (CR-001) |
| 2026-09-04 | API-001 |  | 註明 `data_window.days` 為 UI 必須顯示的值；範例更新為 14 天；`reason.facts` 新增 `window_days` |
| 2026-09-02 | BR-001 | 1.1 | `lookback_window` 30 → 14 天；`min_sales_in_window` 5 → 3 (CR-001（FB-004）) |
| 2026-09-02 | ADR-001 |  | 已對照 **CR-001**（區間 30 → 14 天）重新檢查。決策仍然成立：這次變更是 BR-001 的參數，不是策略變更。prompt 原本寫死「30 天」；現在改為接收 `window_days` 作為事實。 |
| 2026-09-02 | ADR-001 |  | **重新檢視條件部分觸發：** FB-004 是一份正式環境回報，指出季節性暴增時推薦太慢。一份回報、一種商品類型——尚未達到「反覆」。持續觀察；季節性處理由 REQ-001 Q2 追蹤。 |
| 2026-07-20 | API-001 |  | 初版 |
| 2026-07-15 | REQ-001 | 1.0 | PM 編修：明確決定清單數量（BR-001#R4）；加入試點範圍；預測移至不在範圍內 (FB-003) |
| 2026-07-15 | BR-001 | 1.0 | 核准。區間 30 天，最低銷量 5 件。 (REQ-001) |
| 2026-07-08 | REQ-001 | 0.1 | 由需求探索 Agent 起草候選版本 (EXP-001) |
| 2026-07-08 | BR-001 | 0.1 | 由需求探索 Agent 起草候選規則（R4 被標示為原型假設） (REQ-001 草稿) |
