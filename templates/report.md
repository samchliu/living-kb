---
id: RPT-001
title: "<對象> <報告類型>（例：推薦 API 壓測報告）"
type: report
knowledge_state: record
status: draft
# draft    = 撰寫中
# active   = 定稿 → 執行 `npx kb seal RPT-001` 封存（內文與原始輸出檔都會被雜湊）
# deprecated = 已被新的報告取代（新報告設 supersedes: [RPT-001]）
owner: RD
authors: [RD, AI]
created: 2026-01-01
measured_on: 2026-01-01
# 量測日。若 evidence_for 的目標在這天之後變更，validate 會提醒「結果可能已不成立」。
environment: "<環境、版本、commit、資料量>"
files:
  - "_originals/RPT-001/<工具原始輸出>.json"
related:
  - id: REQ-001
    rel: evidence_for
  - id: ADR-001
    rel: evidence_for
---
# RPT-001：<報告標題>

<!-- 報告是「某個時間點量測到的事實」：壓測、資安掃描、相容性測試、效能分析。
     它是證據，不是規則。要據此改變決策 → 開 CR 或更新 ADR，用 relates_to / derived_from 引用本報告。
     工具的原始輸出（k6 / JMeter 的 json、html 報告、截圖）放 _originals/RPT-001/ 並列在 `files`。
     重新量測 = 新的 RPT，不要覆寫舊報告——兩次結果的差異本身就是知識。 -->

## 目的

<!-- 要回答什麼問題；對應哪個需求或決策的哪個條件（例如 REQ-001 的非功能需求「p95 < 300ms @ 200 rps」）。 -->

## 環境與方法

<!-- 環境、資料量、工具與腳本版本（腳本路徑）、負載模型、量測期間。寫到別人能重跑。 -->

## 結果

| 指標 | 目標 | 實測 | 是否達標 |
|---|---|---|---|
| | | | |

## 結論

<!-- 只寫數據支持的結論。推測請標示為推測。 -->

## 後續

<!-- 需要誰決定什麼：開 CR、更新 ADR、排優化任務。 -->
