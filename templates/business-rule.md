---
id: BR-000
title: <規則集名稱>
type: business-rule
knowledge_state: authoritative
status: draft             # draft | review | approved | active | deprecated | archived
owner: PM
authors: [PM]
created: YYYY-MM-DD
updated: YYYY-MM-DD
last_reviewed: YYYY-MM-DD
review_every: 90d
approved_by:
  who:
  date:
source_of_truth: self
supersedes: []
superseded_by:
related:
  - id: REQ-000
    rel: derived_from
  - path: <程式碼路徑>
    rel: implemented_in
  - path: <測試路徑>
    rel: verified_by
---

# BR-000：<規則集名稱>

> **核准後即為權威。** 如果程式碼、原型或任何人的記憶與本文件不一致，那是要回報的衝突——而不是悄悄修改任何一方的理由。

## 規則

<!-- 編號以便精確引用：BR-000#R1。每條規則一個陳述。使用「必須（MUST）/ 不得（MUST NOT）」。 -->

| # | 規則 |
|---|---|
| R1 | |
| R2 | |

## 參數

<!-- 規則使用的可調整數值。改數值就是改規則 → 記入變更歷史。 -->

| 參數 | 值 | 使用於 | 備註 |
|---|---|---|---|
| | | R1 | |

## 理由

<!-- 每條規則為什麼存在。「未知——沿用自 <來源>」是誠實的答案；猜測則不是。 -->

| 規則 | 為什麼 | 證據 |
|---|---|---|
| R1 | | FB-… / REQ-… / 法規 / 資料 |

## 適用條件

<!-- 規則何時適用？範圍：哪些使用者、門市、商品、時間區間。 -->

## 例外

| 例外 | 適用於 | 核准者 |
|---|---|---|
| | | |

## 範例

<!-- 具體的輸入 → 預期結果。這些會變成測試案例。至少包含一個邊界情境。 -->

| # | 情境 | 預期結果 | 規則 |
|---|---|---|---|
| E1 | | | R1 |

## 相關知識

| 種類 | 連結 |
|---|---|
| 需求 | REQ-… |
| ADR | ADR-… |
| API | API-… |
| 程式碼 | `<路徑>` |
| 測試 | `<路徑>` |

## 變更歷史

| 日期 | 版本 | 變更 | 原因（CR / FB） | 核准者 |
|---|---|---|---|---|
| YYYY-MM-DD | 1.0 | 初版 | REQ-… | PM |
