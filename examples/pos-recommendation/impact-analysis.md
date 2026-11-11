---
id: CR-001
title: 將推薦區間從 30 天改為 14 天
type: change-request
knowledge_state: authoritative
status: archived
owner: PM
authors: [PM, AI, RD]
created: 2026-08-28
updated: 2026-09-16
source_of_truth: self
related:
  - { id: BR-001, rel: changes }
  - { id: REQ-001, rel: changes }
  - { id: API-001, rel: changes }
  - { id: ADR-001, rel: relates_to }
  - { id: FB-004, rel: derived_from }
---

# CR-001：將推薦區間從 30 天改為 14 天

本檔案展示上線後完整的變更生命週期：

1. 變更申請
2. 可追溯性：與被變更事物相連的一切
3. 影響分析（影響分析 Agent）
4. 決定
5. 知識更新（文件維護 Agent）
6. 事後健康檢查（文件健康 Agent）

> **不要試圖阻止變更。讓變更的成本與影響清楚可見。**

---

## 1. 要求的變更

> 「把推薦區間從 30 天改成 14 天。」
> —— 老闆，2026-08-28，傳給 PM 的訊息

## 原因

正式環境回饋 **FB-004**：07 店的月餅禮盒在系統建議補貨之前就賣完了。30 天平均掩蓋了需求暴增（每天約 1 盒 → 約 9 盒）。RD 的數據顯示，14 天區間大約可以提早一天觸發補貨。

---

## 2. 可追溯性

*可追溯性 Agent，2026-08-28。問題：「如果 BR-001#R1（回溯區間）改了，會影響什麼？」*

```text
BR-001#R1  lookback_window = 30d                        active · 負責人 PM
├── derived_from ▲ REQ-001  每日商品推薦
│                  └── derived_from ▲ PROTO-003（P1：30 天區間是原型中意外出現的假設）
├── decided_by     ADR-001  規則式評分 + LLM 說明文字         （背景以 BR-001 現狀為前提）
├── implemented_by API-001  GET /stores/{id}/recommendations   （data_window、範例）
│                  └── implemented_in  web/src/features/recommendations/  （推薦 UI）
├── implemented_in services/recommendation/scoring.py           （RecommendationService）
│                  sql/recommendation_window_agg.sql
│                  jobs/daily_recommendations.py
└── verified_by    tests/recommendation/test_scoring.py
                   tests/e2e/recommendations.spec.ts

相互作用的規則（同一份文件）：BR-001#R2（區間內最低銷量）、#R3（庫存可售天數）、#R7（最低歷史天數）
```

注意上游的軌跡：30 天這個值最初來自一個**意外出現的原型假設**（PROTO-003 P1），PM 在核准 BR-001 v1.0 時確認了它，但從未分析過。這對決策很有幫助：沒有強烈的理由非得維持 30 天。

---

## 3. 影響分析

*影響分析 Agent，2026-08-29。PM 與 RD 於 2026-08-30 審查。`[explicit]` = 透過知識連結找到；`[inferred]` = 透過搜尋程式碼／prompt／文案找到。*

**重述變更：** BR-001 參數 `lookback_window`：30 天 → 14 天。

| 領域 | 影響程度 | 說明 | 受影響的知識 / 程式碼 |
|---|---|---|---|
| 產品影響 | **中** | 推薦對暴增的反應更快（FB-004），但對雜訊也更敏感：14 天內一筆大量訂單就會大幅影響平均。推薦組合會改變——見「相互作用的規則」。 | REQ-001、BR-001 |
| 前端影響 | 低 | 清單標題文案寫著**「依據最近 30 天」**——寫死的。`[inferred]` `web/src/features/recommendations/copy.ts:12`。建議改為從 API 讀取 `data_window.days`，下次變更就不需要改前端。 | API-001、REQ-001#AC4 |
| 後端影響 | 低 | `lookback_window` 是 `scoring.py:18` 中的常數（`WINDOW_DAYS = 30`）`[explicit]`。SQL 使用參數 `[explicit]`。改一行 + 設定。 | BR-001、`scoring.py`、`recommendation_window_agg.sql` |
| AI / Agent 影響 | 低 | prompt 字面寫著**「過去 30 天的銷售」** `[inferred]` `prompts/recommendation_explanation.md:7`。如果不改，LLM 會寫出「30 天」但事實是 14 天的 → R6 數字防護會拒絕它，導致**每一則**推薦都退回範本文字。修正：把 `window_days` 作為事實傳入。LLM 評測集中有 12 筆預期輸出提到「30 天」`[inferred]` `evals/explanations/*.json`。 | ADR-001、BR-001#R6 |
| 資料影響 | 低 | 彙總表 `sales_daily_agg` 保留 90 天；不需遷移或回填。歷史推薦是以 30 天計算的——儲存的結果中已有 `data_window` 記錄這一點，因此前後比較分析仍然正確。查詢掃描的資料列約減少 50%。 | ARCH（尚無）、API-001 |
| 測試影響 | 中 | 9 個單元測試使用 30 天的測試資料 `[explicit]` `test_scoring.py`。E2E 斷言標題文案為「30 天」`[inferred]`。若 R2 門檻有改，需要為重新校準的門檻**新增測試**。 | BR-001 測試 |
| 文件影響 | 低 | BR-001 參數 + 變更歷史；REQ-001 AC4（提到「最近 30 天」）；API-001 範例與 `data_window` 註記；ADR-001 追加備註。PROTO-003 提到 30 天——**維持原樣**（探索性歷史）。 | BR-001、REQ-001、API-001、ADR-001 |

### 相互作用的規則——真正重要的發現

**BR-001#R2** 要求*區間內*至少賣出 **5** 件。這個門檻是針對 30 天校準的（≈ 每天 0.17 件）。改成 14 天後，同樣的 5 件代表 ≈ 每天 0.36 件。

每天銷量約在 0.17 到 0.36 件之間的商品，會**完全不再被納入考量**。而這些滯銷品，正好就是**促銷（庫存過多）**的候選商品。

以試點門市最近 14 天的資料重跑（RD，2026-08-30）：

| 情境 | 每店每日補貨推薦數 | 每店每日促銷推薦數 |
|---|---|---|
| 目前（30 天，最低 5 件） | 2.9 | 1.8 |
| 照原要求（14 天，最低 5 件） | 3.6 | **0.4** |
| 14 天，最低 3 件 | 3.6 | 1.6 |

照字面執行這個變更，會修好 FB-004 的問題，卻幾乎消滅了庫存過多的推薦——這是沒有人要求的行為改變。**這是 PM 要決定的商業問題**，不是技術問題；Agent 不替人選擇。

**BR-001#R7**（最低歷史 14 天）：與 14 天區間一致。`[inferred]` 檢查時，Agent 發現了一個**既有的偏移**：對於有 14–29 天歷史的門市，`scoring.py:41` 除以 30 而不是實際可用天數，低估了銷量。BR-001 沒有定義這個情況。改為 14 天區間後，這個情況就不會再出現。記錄備查（RD）。

### 效能

彙總查詢：掃描的資料列約減少 50%；每日排程工作時間預期略為縮短。API 不受影響（預先計算）。未發現風險。

### 風險／副作用

- 低銷量商品的推薦雜訊變多（單筆大量購買就可能觸發補貨）。
- 店長可能會注意到清單一夜之間改變 → PM 需通知試點店長。
- 季節性處理只解決了一部分；正式的解法可能是另一條規則（REQ-001 Q2）。

### 未解問題（給決策者）

1. `min_sales_in_window` 是否要跟著區間一起改？（PM）——*見上表*
2. 適用於所有商品類別，還是只適用於季節性商品？（PM／老闆）
3. 區間是否要能依門市設定？*（Agent 註：沒有人要求；會增加複雜度。僅為完整性而列出。）*

## 估算

| 工作 | 規模 | 誰 |
|---|---|---|
| 後端常數 + 設定、prompt 加入 `window_days` 事實 | S（2 小時） | RD |
| 前端：標題讀取 `data_window.days` | S（1 小時） | RD |
| 測試：測試資料 + 新的 R2 邊界測試 + 評測集 | M（3 小時） | RD |
| 文件：BR-001、REQ-001、API-001、ADR-001 備註 | S（0.5 小時，AI 起草） | PM、RD |
| 通知試點店長 | S | PM |
| **合計** | **≈ 1 天** | 信心程度：中 |

---

## 4. 決定

- [ ] 核准
- [x] **附條件核准：**
  - `lookback_window` 30 → **14 天**（依要求）
  - `min_sales_in_window` 5 → **3**（PM，為了保留促銷推薦）
  - UI 從 API 讀取區間，不再寫死文案
  - 所有類別；季節性專屬處理保留為 REQ-001 Q2 未解問題
- [ ] 延後
- [ ] 否決

**決策者：** 老闆（區間）、PM（最低銷量門檻）
**日期：** 2026-09-02
**紀錄方式：** 老闆看過重跑結果表後在訊息中核准（「好，改 14 天，然後庫存太多的那些也要留著」）。門檻數值由 PM 決定。

## 後續行動

| 行動 | 負責人 | 完成 |
|---|---|---|
| BR-001 v1.1（R1、R2 參數；理由；變更歷史） | PM | [x] 2026-09-04 |
| REQ-001 v1.1（AC4 措辭；Q2） | PM | [x] 2026-09-04 |
| API-001 變更歷史；`window_days` 事實 | RD | [x] 2026-09-04 |
| ADR-001 追加備註 | RD | [x] 2026-09-02 |
| 程式碼、prompt、UI、測試、評測集——PR #87 | RD | [x] 2026-09-08 |
| 1.1 版發布 | RD | [x] 2026-09-09 |
| 通知試點店長這次變更 | PM | [x] 2026-09-09 |

---

## 5. 知識更新

*文件維護 Agent 於 2026-09-02 起草更新；負責人於 2026-09-04 核准。*

```text
文件更新：CR-001（區間 30 → 14 天，最低銷量 5 → 3）

已更新（已核准）：
  BR-001   v1.0 → v1.1  R1/R2 參數、理由、範例 E1–E3、變更歷史                   PM ✔ 2026-09-04
  REQ-001  v1.0 → v1.1  AC4：標題顯示從 API 取得的區間；Q2 季節性                  PM ✔ 2026-09-04
  API-001  註明 data_window.days 為顯示值；範例 → 14 天；                           RD ✔ 2026-09-04
           reason.facts 新增 window_days（新增欄位，非破壞性）
已追加（只能追加，已通知負責人）：
  ADR-001  備註：已對照 CR-001 重新檢查，決策仍成立
           備註：重新檢視條件部分觸發（FB-004）                                    RD ✔ 2026-09-02
連結：
  CR-001 → changes → BR-001、REQ-001、API-001
  CR-001 → derived_from → FB-004
刻意未變更：
  PROTO-003  仍寫著「30 天」——探索性歷史，不是目前行為
  EXP-001    已封存；不重新開啟（問題已經清楚；這只是參數變更）
已回報、未修正：
  DRIFT（既有）：scoring.py:41 對 14–29 天歷史的門市除以 30 → v1.1 之後已不適用   @rd
```

PR #87 在描述中引用了相關知識：

```text
## 相關知識（Related Knowledge）
- 需求：REQ-001（AC4）
- 商業規則：BR-001#R1、#R2
- ADR：ADR-001（僅備註）
- API：API-001（新增欄位）
- 變更申請：CR-001

## 文件影響（Documentation Impact）
[ ] 無文件影響
[x] 已更新需求
[x] 已更新商業規則
[ ] 已更新架構
[x] 已新增／更新 ADR
[x] 已更新 API
[ ] 已更新維運文件

## 變更影響（Change Impact）
[x] UI  [x] API  [ ] 資料  [ ] 架構  [ ] 安全  [ ] 效能  [x] AI / Agent 行為

## 測試（Testing）
[x] 單元  [ ] 整合  [x] E2E  [ ] 手動
```

---

## 6. 事後健康檢查

*文件健康 Agent，每週執行，2026-09-16。*

```text
Documentation Health: WARNING        (2026-09-16, 範圍：全部)

MISSING：
- BR-001#R2（min_sales_in_window = 3）沒有邊界測試。PR #87 更新了 14 天區間的
  測試資料，但沒有新增 2 件 vs 3 件的測試。
  證據：grep "BR-001" tests/ → 沒有針對 R2 命名的測試；test_scoring.py 沒有 2 或 3 件的案例   @rd

STALE：
- （無）

DRIFT：
- （無）—— scoring.py WINDOW_DAYS 讀取設定 lookback_window=14；prompt 接收 window_days；
  UI 文案讀取 data_window.days。既有的 /30 偏移已解決。

CONFLICT：
- （無）

OWNERSHIP：
- （無）

INFO：
- ADR-001 有一個觀察中的項目（重新檢視條件部分觸發，2026-09-02）。建議再累積
  4 週試點資料後重新檢視。   @rd
- CR-001 所有後續行動已完成 → 設為 status: archived。   （已套用：衛生修正）

摘要：0 critical · 1 warning · 2 info
```

RD 於 2026-09-17 新增了 `test_BR_001_R2_min_sales_boundary`。知識迴圈閉合——直到下一則回饋出現。
