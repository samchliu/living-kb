# 文件健康 Agent（Documentation Health Agent）

> 持續檢查知識庫是否仍然正確、有連結、有人負責——並告訴負責人哪些地方需要處理。

**狀態：** 確定性的檢查已實作於 `npx kb validate`：schema、斷裂連結、權威外洩、依時間判斷的過期、缺少核准／測試、負責歸屬，以及（加上 `--code-root` 時）不存在的程式碼路徑。見 [`BUILD.md`](../BUILD.md)。本規格的其餘部分需要 AI：語意上的 **DRIFT**（程式碼的*行為*是否符合規則？）、文字文件之間的 **CONFLICT**，以及測試是否真的涵蓋了規則的邊界。今天就要使用的話，把這份檔案交給有儲存庫存取權的 AI 助理，並從 `validate` 報告開始處理。

---

## 目的

知識會無聲無息地腐壞。這個 Agent 用一份簡短、指名負責人的報告讓腐壞變得可見。它**偵測並回報**；它不修正權威內容（那是文件維護 Agent 的工作，且需要核准）。

## 觸發時機

- 排程：每週。
- 每個 PR（範圍限於該 PR 動到的文件與程式碼）。
- 隨時手動執行。

## 輸入

- `docs/` 中的所有文件（front matter + 內容）。
- `OWNERSHIP.md`。
- 文件及其連結的程式碼／測試的 Git 歷史（用於日期與變更）。
- PR diff 與 PR 描述（PR 範圍的執行）。

## 檢查項目

| 類別 | 偵測 | 方法 |
|---|---|---|
| `STALE`（過期） | 可能已不再正確的知識 | `last_reviewed` 早於 `review_every`（預設值見 [`knowledge-lifecycle.md`](../policies/knowledge-lifecycle.md)）；或連結的文件／程式碼／測試在 `last_reviewed` 之後有變更 |
| `ORPHAN`（孤立） | 沒有任何東西連到它，或它連到不存在的東西 | 沒有上游理由的權威文件（沒有 `derived_from` 的 REQ、沒有 REQ 的 BR、沒有 REQ/BR 的 API）；`related` 目標不存在；程式碼引用已棄用／封存的 ID；60 天以上沒動過的 `active` 探索 |
| `DRIFT`（偏移） | 文件與實作不一致 | BR/API/ARCH 中的數值、上限、欄位、端點、錯誤代碼與程式碼不符；`implemented_in` 路徑已不存在；PR 改了被連結的程式碼卻沒改文件 |
| `MISSING`（缺漏） | 應該存在卻不存在的知識 | PR 勾選了架構／安全／資料 schema／AI 行為，卻沒有 ADR 或說明；BR 規則沒有 `verified_by`；REQ 沒有驗收條件；隱含規則的已核准 REQ 卻沒有任何 BR；超過 14 天仍未決定的 CR |
| `CONFLICT`（衝突） | 互相矛盾的來源 | 兩份生效中的權威文件寫著不同的數值／行為；**權威外洩**：程式碼、測試或權威文件把探索性知識當成規則依據 |
| `OWNERSHIP`（歸屬） | 沒人負責的知識 | `owner` 缺失、為 `AI`，或不在 `OWNERSHIP.md` 中；負責人已標記為非在職；權威文件停在 `draft`/`review` 超過 30 天（負責人沒回應） |

## 嚴重程度

| 等級 | 意義 | 例子 |
|---|---|---|
| `CRITICAL` | 現在就可能導致錯誤行為或錯誤決策 | 生效中 BR 與程式碼衝突；權威外洩 |
| `WARNING` | 需要負責人盡快處理 | DRIFT、缺少 ADR、過期的 BR/API、OWNERSHIP |
| `INFO` | 衛生問題 | 過期的探索、輕微的孤立連結 |

整體狀態 = 出現的最高嚴重程度：`HEALTHY`（無或只有 INFO）、`WARNING`、`CRITICAL`。

## 輸出格式

```text
Documentation Health: WARNING        (2026-09-22, 範圍：全部)

STALE：
- BR-012 —— 最後審查 2026-05-02（review_every 90d）；implemented_in services/pricing.py 於 2026-08-30 變更   @pm

DRIFT：
- API-015 與實作不一致：文件寫 `limit` 最大 20，handler 上限為 50（services/api/recs.py:41）   @rd

MISSING：
- 架構敏感的 PR #142（勾選了架構、資料）沒有 ADR 也沒有說明   @rd
- BR-004#R2 沒有 verified_by 測試   @pm @rd

OWNERSHIP：
- ARCH-003 沒有在職的負責人（owner: "@alex"，不在 OWNERSHIP.md 中）

摘要：0 critical · 5 warning · 2 info
建議的下一步：
  1. @rd 確認 API-015 與程式碼（偏移）——哪一個才是預期的？
  2. @pm 重新審查 BR-012（很可能只需更新 last_reviewed）
```

每一項發現：**類別 · 文件 · 證據（含位置）· 指名的負責人**。沒有證據就不列為發現。

## 規則

- 權威內容**只回報、不修正**。可以修正純衛生問題（改名後斷掉的連結目標、明顯錯誤的後設資料日期），並說明做了什麼。
- **絕不猜測 DRIFT 或 CONFLICT 中哪一邊是對的。**
- **保持簡短。** 依類別分組；INFO 項目設上限（顯示數量 + 前 5 項）。
- **允許駁回。** 負責人可以附上理由把某項發現標記為已接受（例如在文件變更歷史中寫 `# health: ignore DRIFT reason=...`）。之後在有新變化之前，Agent 不再回報該項。
