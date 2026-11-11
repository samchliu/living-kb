# 需求（Requirements）

**知識狀態：** 權威 · **負責人：** PM · **ID 前綴：** `REQ`、`CR`

| 類型 | 範本 | 何時建立 |
|---|---|---|
| `REQ` 需求 | [`templates/requirement.md`](../../templates/requirement.md) | 探索已「足夠清楚」，PM 決定要做什麼。 |
| `CR` 變更申請 | [`templates/change-request.md`](../../templates/change-request.md) | 有人想修改**已核准**的 REQ、BR、ADR 或 API。 |

## 規則

- `REQ` 通常**源自**探索（`derived_from: EXP / PROTO / FB`）。如果不是——例如法規要求——請說明來源。
- 驗收條件必須能由「不是撰寫者的人」檢查。
- *必須一直成立的規則*寫在 `BR`，不要埋在 REQ 裡。REQ 說要做什麼；BR 說什麼必須保持為真。
- 已核准 REQ 的變更要走 `CR`（小幅釐清可以只在 REQ 的變更歷史加一行，並由 PM 核准）。絕不悄悄覆寫。
- 被否決與延後的 CR 要保留。它們回答了「這個我們不是討論過了嗎？」。
