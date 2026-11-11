# 變更紀錄

格式依 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，版本號依 [SemVer](https://semver.org/lang/zh-TW/)。1.0 之前，次版號（0.x）可能包含不相容變更，會在此標明。

## [0.2.0] - 2026-11-11

### 新增

- `kb init [DIR] [--profile NAME] [--ci gitlab|github|none]`：一行指令建立 knowledge repo 骨架——`kb.config.yaml`、`OWNERSHIP.md`、`docs/` 各領域資料夾、`.gitignore`、CI 設定、MR／PR 範本、保護 `_originals/` 的 CODEOWNERS。絕不覆寫已存在的檔案，可重複執行。
- npm 套件改為包含 `docs/` 與 `examples/`，讓 `kb init` 複製的說明文件連結都能點開。

### 修正

- `kb … | head` 這類管線提早關閉時，不再以 EPIPE 錯誤結束。

## [0.1.0] - 2026-11-11

第一個公開版本。

- `kb` 指令（Node 18.17+，零依賴）：`validate`、`build`、`trace`、`config`、`seal`、`add-ref`。
- 三種知識狀態：探索性（EXP／PROTO／FB）、權威（PROD／REQ／CR／BR／ARCH／ADR／API／OPS）、紀錄性（REF／CLR／RPT，定稿後以 sha256 封存）。
- 確定性 build：每個需求產生功能總覽、QA 清單、AI 實作 context，另有變更紀錄與健康報告。
- `kb.config.yaml` 與可疊加的 profile：`extends`（含 `kb:<名稱>` 引用內附 profile）、合併規則、不可設定的不變式。
- 內附 profile：`small-team`、`personal`、`frontend-example`。

[0.2.0]: https://github.com/samchliu/living-kb/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/samchliu/living-kb/releases/tag/v0.1.0
