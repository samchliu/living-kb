# 維運（Operations）

**知識狀態：** 權威 · **負責人：** RD / DevOps · **ID 前綴：** `OPS`

系統如何部署、觀測與復原——以及正式環境正在教我們什麼。

典型內容：

| 文件 | 內容 |
|---|---|
| `OPS-001-deploy.md` | 如何部署與回滾 |
| `OPS-002-runbook-<component>.md` | 告警、代表的意義、該怎麼處理 |
| `OPS-003-slo.md` | 服務水準與量測方式 |
| `OPS-004-scheduled-jobs.md` | 排程／批次工作、時程、失敗時的行為 |

沒有專用範本：使用 [`templates/metadata.yaml`](../../templates/metadata.yaml) 的通用後設資料標頭。

## 讓迴圈閉合

正式環境是知識的來源，而不只是終點。當事故、指標或使用者抱怨揭露了關於產品的某件事時，在 `docs/exploration/` 寫一份 `source: production` 的 `FB` 文件，並連結到受影響的 REQ / BR。這則回饋就是下一輪探索迴圈的入口。
