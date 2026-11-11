# 架構（Architecture）

**知識狀態：** 權威 · **負責人：** RD · **ID 前綴：** `ARCH` · **範本：** [`templates/architecture.md`](../../templates/architecture.md)

系統如何組合在一起：元件、資料流、介面，以及它所設計的品質屬性（效能、安全、失效處理）。

## 規則

- 描述**現在的**系統。計畫中的變更放在草稿段落，或另一份 `status: draft` 的 ARCH。
- 架構說明*是什麼*；ADR 說明*為什麼*。每個重要的結構選擇都要連到解釋它的 ADR（`governed_by`）。
- 偏好每個邊界區域一份 ARCH（例如 `ARCH-001-recommendation-pipeline`），而不是一份巨大的系統文件。
- 小團隊可能只需要一到兩份 ARCH。這樣就好。
- AI 可以更新圖表與元件清單以符合程式碼，但**以提案形式**交給 RD 審查。ARCH 與程式碼不一致會被回報為 `DRIFT`——程式碼是目前*行為*的事實，但 ARCH 可能代表*預期*的設計，只有 RD 能決定哪一邊是錯的。
