# 自然探索・蟲森物語｜LINE AI 小幫手

一個以 Cloudflare Workers 部署的 LINE 自然知識問答機器人。使用者傳送文字訊息後，Worker 驗證 LINE webhook、呼叫 Gemini 產生繁體中文回答，再透過 LINE Reply API 回覆。服務運作不依賴個人電腦持續開機。

## 專案流程

`LINE 使用者 → Messaging API webhook → Cloudflare Worker → Gemini 3.5 Flash-Lite → LINE Reply API → 使用者`

## 已實作功能

- 使用 Channel secret 驗證 `x-line-signature`，拒絕未通過驗證的 webhook。
- 僅處理一對一聊天中的文字訊息；忽略其他事件類型。
- 以自然、生態與昆蟲知識為主要回答範圍，使用繁體中文及適合 LINE 的純文字格式。
- 對 Gemini 額度不足、API 錯誤或空白答案提供友善的備援訊息。
- 使用 Cloudflare Workers 的 Secrets 保存憑證；程式碼不包含金鑰值。
- `GET /` 提供簡單的運作狀態文字。

## 設定概要

1. 在 Cloudflare Workers 建立 Worker，將 [`worker.js`](worker.js) 作為程式碼並部署。
2. 在 Worker 的 Production「Runtime variables and secrets」新增以下 **Secret**，不要放入程式碼或 GitHub：

   | 名稱 | 用途 |
   | --- | --- |
   | `LINE_CHANNEL_SECRET` | 驗證 LINE webhook 簽章 |
   | `LINE_CHANNEL_ACCESS_TOKEN` | 呼叫 LINE Reply API |
   | `GEMINI_API_KEY` | 呼叫 Gemini API |

3. 在 LINE Developers 的 Messaging API 設定 webhook URL：`https://<你的 Worker 網域>/webhook`，開啟「Use webhook」並執行 Verify。
4. 在 LINE 官方帳號的一對一聊天視窗傳送自然知識問題，確認收到回覆。

> 本資料夾是供 GitHub 展示與備份的公開版原始碼。發布前請核對它與 Cloudflare 線上 `worker.js` 的最新版一致；GitHub 本身不是此機器人的執行主機。

## 測試紀錄

2026-10-07 以既有 LINE 官方帳號完成實際對話測試：鍬形蟲與獨角仙的差異、冰天使、蚱蜢的食物，均有收到回覆。曾遇到 Gemini 模型端點 404，改用 `gemini-3.5-flash-lite` 後恢復；也修正了 LINE 顯示 Markdown `**` 符號及昆蟲分類不準確的問題。

## 限制與注意事項

- 雲端部署讓服務不依賴本機，但不保證全年無休或每題必定成功；仍受 Cloudflare、Gemini、LINE 的可用性及用量限制影響。
- 測試時 Google AI Studio 專案顯示 Gemini 3.5 Flash-Lite Free tier 為每分鐘 15 次請求、每日 500 次請求。這是當時專案畫面顯示的限制，日後以官方儀表板為準。
- AI 回答可能出錯；涉及物種辨識或專業知識時應再查證。此版本沒有圖片辨識、對話記憶或群組聊天功能。
- 使用 Gemini Free tier 時，請勿在聊天中輸入個人敏感資料；若公開招募使用者，應清楚說明訊息會送至第三方 AI 服務處理。
- Cloudflare 的成功請求數只表示 Worker 接到請求，不代表 Gemini 一定產生回答或 LINE 一定成功送達；異常時應檢查 Worker 的 Observability 記錄。

## 安全與公開檢查

- 公開前再次檢查程式碼、README、Git 歷史及截圖，確定沒有 API Key、Channel secret、access token 或私人對話資料。
- 不要上傳 Google AI Studio 金鑰詳情視窗、Cloudflare Secret 值或未遮蔽的管理介面截圖。
- 若憑證意外外洩，應立即在原服務重新核發並更新 Cloudflare Secrets。

## 技術

JavaScript、Cloudflare Workers、LINE Messaging API、Gemini API。
