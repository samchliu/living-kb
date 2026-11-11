---
id: API-000
title: <METHOD /path>
type: api
knowledge_state: authoritative
status: draft             # draft | review | approved | active | deprecated | archived
owner: RD
authors: [RD, AI]
created: YYYY-MM-DD
updated: YYYY-MM-DD
last_reviewed: YYYY-MM-DD
review_every: 90d
approved_by:
  who:
  date:
source_of_truth: self     # 若有 OpenAPI / schema 檔案，填它的路徑
related:
  - id: REQ-000
    rel: implements
  - id: BR-000
    rel: implements
  - id: ARCH-000
    rel: governed_by
  - path: <handler 路徑>
    rel: implemented_in
  - path: <合約測試路徑>
    rel: verified_by
---

# API-000：`<METHOD /path>`

## 端點

| 欄位 | 值 |
|---|---|
| Method | GET / POST / … |
| Path | `/…` |
| 驗證 | |
| 使用端 | Web app / 行動 App / 合作夥伴 |
| 穩定度 | experimental / stable / deprecated |

## 目的

<!-- 服務哪個需求，一到兩句。 -->

## 請求（Request）

| 參數 | 位置 | 型別 | 必填 | 說明 |
|---|---|---|---|---|
| | path / query / body | | | |

```json
{}
```

## 回應（Response）

| 欄位 | 型別 | 說明 | 規則 |
|---|---|---|---|
| | | | BR-…#R… |

```json
{}
```

## 錯誤

| 狀態碼 | 錯誤代碼 | 何時發生 | 用戶端應該 |
|---|---|---|---|
| 400 | | | |
| 404 | | | |

## 執行的商業規則

| 規則 | 在哪裡執行 |
|---|---|
| BR-…#R… | 伺服器 / 用戶端 / 兩者 |

## 效能預期

| 指標 | 目標 |
|---|---|
| p95 延遲 | |
| 流量限制 | |
| 回應大小 | |

## 相關知識

| 種類 | 連結 |
|---|---|
| 需求 | REQ-… |
| 架構 | ARCH-… |
| 實作 | `<路徑>` |
| 測試 | `<路徑>` |

## 變更歷史

| 日期 | 變更 | 破壞性？ | 核准者 |
|---|---|---|---|
| YYYY-MM-DD | 初版 | — | RD |
