---
id: REQ-000
title: <需求名稱>
type: requirement
knowledge_state: authoritative
status: draft             # draft | review | approved | active | deprecated | archived
owner: PM
authors: [PM, AI]
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
  - id: EXP-000
    rel: derived_from
  - id: PROTO-000
    rel: derived_from
  - id: FB-000
    rel: derived_from
---

# REQ-000：<需求名稱>

## 問題

<!-- 用使用者的語言描述使用者的問題。連結證據。 -->

## 目標

<!-- 成功是什麼樣子。盡可能可量測。 -->

## 使用者

| 使用者 | 需要 |
|---|---|
| | |

## 範圍

### 必須（Must）
-

### 應該（Should）
-

### 可以（Could）
-

### 不在範圍內（Out of scope）
<!-- 明確寫出來。大部分的範圍爭論都是在這裡被避免的。 -->
-

## 驗收條件

<!-- 能由非撰寫者檢查。Given / When / Then 很好用。引用 BR 規則，而不是重寫一遍。 -->

| # | 條件 | 規則 | 驗證方式 |
|---|---|---|---|
| AC1 | 假設（Given）…，當（When）…，則（Then）… | BR-… | 測試路徑 / 手動 |

## 限制

<!-- 目前已知的截止日期、預算、平台、法規、資料可取得性、技術限制。 -->

-

## 未解問題

<!-- 細節層級的問題沒關係。如果有問題會改變範圍，代表你升級得太早了。 -->

| # | 問題 | 負責人 | 狀態 |
|---|---|---|---|
| Q1 | | | |

## 相關知識

| 種類 | ID | 備註 |
|---|---|---|
| 探索 | EXP-… | 這個需求從哪裡來 |
| 原型 | PROTO-… | 利害關係人確認的那個版本 |
| 商業規則 | BR-… | 本需求依賴的規則 |
| 決策 | ADR-… | |
| API | API-… | |

## 變更歷史

<!-- 只能追加。核准後的每次變更都加一列，並記錄核准者。 -->

| 日期 | 版本 | 變更 | 原因（FB / CR） | 核准者 |
|---|---|---|---|---|
| YYYY-MM-DD | 1.0 | 首次核准版本 | EXP-… | PM |
