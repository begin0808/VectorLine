# VectorLine（向量線條生成器）

> 一鍵將任意圖片轉換為乾淨、可直接雷切的 SVG 線條路徑 —— 全程在瀏覽器本地完成。

**VectorLine** 是一款免費、開源的網頁工具，能將照片與數位圖檔轉換為適用於**雷射切割與雕刻**的向量線稿。所有運算皆透過 [OpenCV.js](https://docs.opencv.org/)（WebAssembly）在你的瀏覽器本地執行 —— 不上傳、無伺服器、不收集任何資料。

🌐 **線上體驗：** [vector-line.vercel.app](https://vector-line.vercel.app)

For the English version, see [README.md](README.md).

---

## 功能特色

- **完全本地、保護隱私** —— 圖片絕不離開你的裝置，不上傳也不追蹤。
- **即時預覽** —— 調整任一參數即刻更新結果（含防抖處理）。
- **影像預處理** —— 去噪（高斯模糊）、亮度、對比控制，有效清理掃描稿與手繪線條。
- **自適應二值化** —— 依局部亮度自動調整的區塊大小（Block Size）＋臨界偏置（C Constant）門檻，並可反轉黑白以處理深色背景。
- **形態學清理** —— 去除細小噪點並填補斷裂線條。
- **三種切割模式：**
  - **輪廓模式（Outline）** —— 追蹤形狀外框邊緣，適合實心色塊與向量雕刻。
  - **單線模式（Centerline）** —— 將線條細線化為 1px 中心骨架，雷射僅沿中線切割一次。
  - **邊緣偵測模式（Canny Edge）** —— 從照片中精準提取乾淨的素描線條畫。
- **向量優化** —— Ramer–Douglas–Peucker 節點簡化與小面積雜點過濾，讓切割路徑平滑、避免雷切機抖動。
- **實體尺寸（mm）** —— 於 SVG 中嵌入真實毫米尺寸，匯入 Beam Studio 等雷切軟體時即為正確比例。
- **匯出** —— 下載優化後的 SVG，或處理後線稿的 PNG。
- **快速預設** —— 一鍵套用「手繪相片最佳化」與「電子圖檔最佳化」，並可重設為預設值。

## 技術架構

- [Vite](https://vitejs.dev/) —— 建置工具與開發伺服器
- [OpenCV.js 4.13](https://docs.opencv.org/) —— 影像處理（WebAssembly，由 CDN 載入）
- 原生 JavaScript、HTML 與 CSS —— 無框架、無執行時相依套件

## 快速開始

```bash
# 安裝相依套件
npm install

# 啟動開發伺服器（開啟 http://localhost:3000）
npm run dev

# 建置正式版（輸出至 dist/）
npm run build

# 預覽正式版建置結果
npm run preview
```

## 運作原理

1. 拖曳或選取圖片（PNG / JPG / WebP）。
2. 圖片讀入 OpenCV `Mat` 並轉為灰階。
3. 預處理套用亮度／對比與去噪。
4. 自適應門檻二值化產生高對比黑白線條圖。
5. （可選）形態學開／閉運算清除噪點與縫隙。
6. 依所選切割模式（輪廓／單線／Canny）產生最終線條。
7. 擷取輪廓、簡化節點（RDP），並序列化為 SVG —— 可選擇附上毫米尺寸供雷切軟體使用。

所有處理皆於瀏覽器端完成；每次運算後都會明確釋放 WebAssembly 記憶體。

## 參與貢獻

歡迎提交 Issue 與 Pull Request。本專案是為台灣創客教育社群打造的輔助工具，特別歡迎能幫助自造者與教育者的改進。

## 授權條款

採用 [MIT License](LICENSE) 授權釋出。
