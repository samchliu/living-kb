---
id: ADR-000
title: <用幾個字描述決策>
type: adr
knowledge_state: authoritative
status: draft             # draft | review | approved(=已接受) | active | deprecated(=已被取代) | archived
owner: <決策者角色>
authors: [RD, AI]
created: YYYY-MM-DD
updated: YYYY-MM-DD
last_reviewed: YYYY-MM-DD
approved_by:
  who:                    # 決策者——絕不是 AI
  date:
source_of_truth: self
supersedes: []
superseded_by:
related:
  - id: REQ-000
    rel: decides_for
  - id: BR-000
    rel: decides_for
---

# ADR-000：<用幾個字描述決策>

> **每個重要的技術決策都應該有可追溯的理由。**
> 一旦被接受，本 ADR 不會被改寫。要改變決策，請寫一份新的 ADR 來取代它。可以在最下方追加備註。

**決策者：** <人員 / 角色>
**決策日期：** YYYY-MM-DD

## 背景（Context）

<!-- 迫使我們做決策的情況：需求、限制、事實與各方考量。連結證據。寫到讓不在場的人也能理解為什麼這件事重要。 -->

## 決策（Decision）

<!-- 一到兩句，主動語態：「我們將…」。 -->

我們將…

## 替代方案（Alternatives）

| 方案 | 摘要 | 為什麼沒選 |
|---|---|---|
| A（採用） | | — |
| B | | |
| C | | |

## 後果（Consequences）

**正面**
-

**負面**
-

**需要的後續行動**
-

## 取捨（Trade-offs）

<!-- 我們明知放棄了什麼，以及在什麼條件下會重新檢視。「重新檢視條件」讓 ADR 變成 Agent 可以監控的東西。 -->

| 我們得到 | 我們放棄 |
|---|---|
| | |

**重新檢視條件：** <條件，例如「累積 ≥ 6 個月的銷售歷史」、「p95 > 500 ms」>

## 相關知識（Related Knowledge）

| 種類 | ID | 關係 |
|---|---|---|
| 需求 | REQ-… | 本決策服務於它 |
| 商業規則 | BR-… | 本決策以它為前提 |
| 架構 | ARCH-… | 受本決策約束 |
| API | API-… | |

## 備註（只能追加）

<!-- 接受之後的帶日期備註：新證據、某次規則變更已對照本 ADR 檢查過等等。 -->

| 日期 | 備註 | 記錄者 |
|---|---|---|
