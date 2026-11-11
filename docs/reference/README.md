# 外部參考資料（`REF`）

**知識狀態：紀錄性（record）· 原文不得更動**

別人給我們的資料：客戶的 API 串接文件（.docx）、廠商規格書（PDF）、合約附件、法規條文。我們不是作者，所以我們不能改它。

```text
docs/reference/
  REF-001.md                       登記卡：後設資料 + 我們的摘要與筆記（可編輯）
  _originals/
    REF-001/
      api-spec-v2.3.docx           原文（已封存，不得更動）
```

## 怎麼登記

```bash
npx kb add-ref ~/Downloads/api-spec-v2.3.docx --title "客戶 X API 串接文件 v2.3" --source "客戶 X"
```

這一行會：複製原檔到 `_originals/REF-nnn/` → 產生 `REF-nnn.md` → 立即封存（記錄 sha256，並把原檔設為唯讀）。

## 「不得更動」如何被保證

| 層 | 機制 |
|---|---|
| 工具 | `seal` 記錄每個原檔的 sha256；`validate` 每次比對，不符就是 `IMMUTABLE` **錯誤**，build 失敗 |
| 工具 | 已封存的紀錄若內容改變，`seal` 拒絕重新封存，除非人明確加上 `--reseal` |
| 檔案系統 | 原檔設為唯讀（僅作為減速帶；git 不保存這個權限） |
| 政策 | AI 不得修改、更名、替換原文（見 [`policies/ai-policy.md`](../../policies/ai-policy.md)） |
| 建議 | 在程式碼託管平台用 CODEOWNERS 把 `docs/reference/_originals/` 指定給負責人審查 |

## 對方給了新版本

不要覆蓋。再 `add-ref` 一次得到 `REF-002`，在 `REF-002.md` 加上 `supersedes: [REF-001]`，`REF-001` 改為 `status: deprecated`。兩版的差異，常常就是下一份 CLR 的問題來源。

## 怎麼被使用

外部資料是**證據，不是規則**。客戶文件說「欄位 A 必填」，不代表我們的系統就這樣做——要由負責人寫進權威文件（`API-…`、`BR-…`），並用 `derived_from` 指回 REF。build 會把 REF 原文連結放進 AI context 的「外部參考資料」章節，供查證細節，但規格以權威文件為準。

範本：[`templates/reference.md`](../../templates/reference.md)
