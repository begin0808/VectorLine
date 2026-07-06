# VectorLine（向量線條生成器）— 圖片轉雷切/雷雕專用 SVG 線稿工具

[English Version](README.md) | [繁體中文](README.zh-TW.md)

👉 **線上體驗 (Live Demo)：** [https://vector-line.vercel.app](https://vector-line.vercel.app)

![License](https://img.shields.io/badge/License-MIT-blue) ![Platform](https://img.shields.io/badge/Platform-Browser-brightgreen) ![Engine](https://img.shields.io/badge/Engine-OpenCV.js%20(WASM)-red) ![Output](https://img.shields.io/badge/Output-SVG%20%2B%20PNG%20%2B%20DXF-blueviolet) ![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local-success)

---

**VectorLine** 是一款免費、開源的網頁工具，能將照片與數位圖檔轉換為適用於**雷射切割與雕刻**的向量線稿。所有運算皆透過 [OpenCV.js](https://docs.opencv.org/)（WebAssembly）在你的瀏覽器本地執行 —— 不上傳、無伺服器、不收集任何資料。

## 功能特色

- **完全本地、保護隱私** —— 圖片絕不離開你的裝置，不上傳也不追蹤。
- **即時預覽** —— 調整任一參數即刻更新結果（含防抖處理），點陣與向量兩區可同步縮放／平移。
- **影像預處理** —— 去噪（高斯模糊）、亮度、對比控制，有效清理掃描稿與手繪線條。
- **自適應二值化** —— 依局部亮度自動調整的區塊大小（Block Size）＋臨界偏置（C Constant）門檻，並可反轉黑白以處理深色背景。
- **形態學清理** —— 去除細小噪點並填補斷裂線條。
- **背景去除**
  - **魔術棒去背** —— 點擊背景區域即可依顏色容差整片清除；可連續多點累加，並支援**上一步／下一步**與全部清除。
  - **亮部去背** —— 把亮部直接壓成純白，快速清掉淺色紙張紋理與陰影雜點。
- **三種切割模式：**
  - **輪廓模式（Outline）** —— 描出圖中每一條線（保留內部細節），忠實還原線稿。
  - **單線模式（Centerline）** —— 將線條細線化為 1px 中心骨架，雷射僅沿中線切割一次。
  - **邊緣偵測模式（Canny Edge）** —— 從照片中精準提取乾淨的素描線條畫。
- **向量優化** —— Ramer–Douglas–Peucker 節點簡化、小面積雜點過濾，並可選曲線平滑，讓切割路徑平滑、避免雷切機抖動。
- **自動分層** —— 自動將最外圈輪廓設為紅色（切割）、內部細節設為黑色（雕刻），並能偵測滿版照片。
- **實體尺寸（mm）** —— 於 SVG／DXF 中嵌入真實毫米尺寸，匯入 Beam Studio、LightBurn 等雷切軟體時即為正確比例。
- **匯出** —— 下載優化後的 **SVG**、處理後線稿的 **PNG**，或分層的 **DXF**（`CUT`／`ENGRAVE` 圖層，供 CAD 與 LightBurn 使用）。
- **原圖對比** —— 可拖曳的分隔滑桿，把原圖與處理後點陣圖疊合比較。
- **快速預設與內建技巧** —— 一鍵套用「手繪相片最佳化」／「電子圖檔最佳化」與重設，並內建疑難排解技巧視窗。
- **深淺主題** —— 深色與淺色皆為溫暖的「工坊」視覺風格。

## 技術架構

- [Vite](https://vitejs.dev/) —— 建置工具與開發伺服器
- [OpenCV.js](https://docs.opencv.org/) —— 影像處理（WebAssembly，本地打包並於 Web Worker 執行，介面不卡頓）
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
2. （可選）用魔術棒（漫填）或亮部去背移除背景。
3. 圖片讀入 OpenCV `Mat` 並轉為灰階。
4. 預處理套用亮度／對比與去噪。
5. 自適應門檻二值化產生高對比黑白線條圖。
6. （可選）形態學開／閉運算清除噪點與縫隙。
7. 依所選切割模式（輪廓／單線／Canny）產生最終線條。
8. 擷取輪廓、簡化節點（RDP）、可選平滑，並序列化為 SVG（可附毫米尺寸）—— 同一組路徑亦可產生分層的 DXF。

所有影像運算皆在 Web Worker 執行，介面保持流暢；每次運算後都會明確釋放 WebAssembly 記憶體。

## 參與貢獻

歡迎提交 Issue 與 Pull Request。本專案是為台灣創客教育社群打造的輔助工具，特別歡迎能幫助自造者與教育者的改進。

## 授權條款

採用 [MIT License](LICENSE) 授權釋出。
