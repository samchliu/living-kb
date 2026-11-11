# 負責歸屬（Ownership）

> **負責人 ≠ 撰寫者。** 負責人（Owner）對文件的正確性負責。任何人——PM、RD、QA、AI——都可以撰寫或編輯。

請先填寫這份文件。每份文件的 `owner` 欄位都必須對應到下方名冊中的某個角色。文件健康 Agent 會回報任何負責人缺失或不在此表中的文件。

---

## 團隊名冊

| 角色 | 人員 | 代理人 | 備註 |
|---|---|---|---|
| `PM` | @pm | @rd | 產品、範圍、商業規則、驗收 |
| `RD` | @rd | @pm | 架構、API、資料、實作、維運 |
| `Boss` | @boss | — | 對範圍與優先順序有最終決定權；通常是 CR 中的*決策者*，而不是文件負責人 |
| `AI` | — | — | 撰寫者與維護者，**永遠不是**負責人。見 [`policies/ai-policy.md`](policies/ai-policy.md)。 |

> 代理人是負責人不在時的備援：可以讓文件保持最新，但除非負責人明確授權，否則不應核准權威知識的變更。上方名冊是 1 PM + 1 RD 的例子（見 [`profiles/small-team`](profiles/small-team/README.md)），請依團隊實際角色增減。

---

## 知識領域

### PM／產品——*做什麼 & 為什麼*

| 領域 | 資料夾 | 文件類型 | 負責人 |
|---|---|---|---|
| 產品背景 | `docs/product/` | `PROD` | PM |
| 探索 | `docs/exploration/` | `EXP`、`PROTO`、`FB` | PM |
| 需求 | `docs/requirements/` | `REQ`、`CR` | PM |
| 商業規則 | `docs/business-rules/` | `BR` | PM |
| 驗收 | `REQ` 內的驗收條件 | — | PM |

負責：使用者問題、產品範圍、商業規則、需求決策、產品驗收。

### RD／工程——*怎麼做*

| 領域 | 資料夾 | 文件類型 | 負責人 |
|---|---|---|---|
| 架構 | `docs/architecture/` | `ARCH` | RD |
| 決策 | `docs/decisions/` | `ADR` | 決策者（通常是 RD） |
| API 與資料 | `docs/api/` | `API` | RD |
| 維運 | `docs/operations/` | `OPS` | RD / DevOps |
| 實作脈絡 | 程式碼儲存庫中的註解與 README | — | RD |

負責：架構、API、資料、技術限制、實作、技術品質。

### AI——*理解、連結、提案、驗證、偵測、摘要、維護*

AI 不擁有任何領域。它橫跨所有領域工作。見 [`policies/ai-policy.md`](policies/ai-policy.md)。

---

## 誰核准什麼

刻意保持精簡。「核准」指的是在變更該文件的 PR 上給予 approve，或負責人明確說「核准」並記錄在文件的 `approved_by` 中。

| 變更 | 核准者 |
|---|---|
| 任何探索性文件（EXP、PROTO、FB） | 不需要——PM 直接編輯 |
| 新增／變更 REQ | PM |
| 新增／變更 BR | PM（RD 審查可行性） |
| 新增／變更 ADR | ADR 中列名的決策者 |
| 新增／變更 ARCH 或 API 合約 | RD（若改變使用者可見行為，PM 也要審查） |
| OPS | RD / DevOps |
| CR 的決定 | CR 中列名的決策者（常是老闆或 PM） |
| 連結、錯字、格式、摘要、後設資料修正 | 不需要——任何人（含 AI）都可以直接做 |

---

## 負責歸屬的衛生習慣

- **每份文件恰好一個負責角色。** 不要寫「PM + RD」。如果真的需要兩者，就把文件拆開。
- **有人離開時**，當週就重新指派他的文件。健康 Agent 的 `OWNERSHIP` 檢查會找出這些文件。
- **負責人之間意見不同**（例如 PM 負責的 BR 與 RD 負責的 ADR 衝突）：負責人彼此溝通，其中一人寫 CR 或 ADR 記錄結果。AI 揭露衝突；它不負責解決衝突。

完整政策見 [`policies/ownership-policy.md`](policies/ownership-policy.md)。
