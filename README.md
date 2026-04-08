# 外科專科考題練習

純靜態網頁測驗系統，涵蓋外科各科別單選與複選題，可直接部署至 GitHub Pages。

## 專案結構

```
外專考題_quiz/
├── index.html        # 主頁面
├── style.css         # 樣式表
├── script.js         # 應用邏輯
├── questions.json    # 題庫（2967 題）
├── images/           # 題目附圖（21 張）
└── README.md
```

## 本機預覽

因為 `fetch()` 需要 HTTP 伺服器，不能直接雙擊 `index.html` 開啟。請用以下任一方式：

```bash
# 方法一：Python
cd 外專考題_quiz
python3 -m http.server 8000
# 開啟 http://localhost:8000

# 方法二：Node.js
npx serve .

# 方法三：VS Code Live Server 擴充套件
# 右鍵 index.html → Open with Live Server
```

## 部署到 GitHub Pages

### 步驟 1：建立 GitHub Repository

到 [github.com/new](https://github.com/new) 建立一個新的 repository（例如 `surgery-quiz`），**不要**勾選 README 或 .gitignore。

### 步驟 2：初始化並推送

在 `外專考題_quiz` 資料夾內執行：

```bash
cd 外專考題_quiz

git init
git add .
git commit -m "Initial commit: surgery quiz for GitHub Pages"

# 將 <your-username> 替換為你的 GitHub 帳號
# 將 <repo-name> 替換為你建立的 repository 名稱
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

### 步驟 3：啟用 GitHub Pages

1. 前往 repository 的 **Settings** → **Pages**
2. Source 選擇 **Deploy from a branch**
3. Branch 選擇 **main**，資料夾選 **/ (root)**
4. 按 **Save**

等待約 1-2 分鐘，網站會部署在：
`https://<your-username>.github.io/<repo-name>/`

## 功能特色

- 依科別、題型篩選題目
- 可設定題數上限（5–100 題）
- 隨機排序出題
- 單選 / 複選題自動識別
- 即時顯示答對答錯與正確率
- 測驗結束後依科別統計
- 錯題回顧功能
- 附圖題目可正常顯示圖片
