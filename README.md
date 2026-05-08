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

## AI 詳解功能（Gemini）

錯題回顧頁面中，每題旁邊有「AI 詳解」按鈕，點擊後會呼叫 Google Gemini API 產生該題的詳細解析。

### 設定 API Key

1. 前往 [Google AI Studio](https://aistudio.google.com/app/apikey) 登入 Google 帳號
2. 點擊 **Create API Key**，複製產生的 Key
3. 打開專案中的 `script.js`，找到檔案最上方（約第 10 行）：
   ```js
   const GEMINI_API_KEY = "";
   ```
4. 在引號內貼上你的 Key：
   ```js
   const GEMINI_API_KEY = "AIzaSy...你的Key...";
   ```
5. 儲存後重新整理瀏覽器即可使用

**注意：** API Key 請勿提交至公開的 GitHub repository。若要部署到 GitHub Pages，建議使用時再手動填入，或改用環境變數方案。

## 排行榜功能（Supabase）

考試模式交卷後，成績會自動寫入 Supabase 雲端資料庫，並在結果頁顯示全體前 10 名排行榜。

**只有「標準考試模式」的成績才會計入排行榜。** 標準考試模式定義：全科隨機抽 100 題（80 單選 + 20 複選）、使用者不可自選科別或題數。

### 步驟 1：建立 Supabase 專案

1. 前往 [supabase.com](https://supabase.com) 註冊 / 登入
2. 點擊 **New Project**，填入名稱（例如 `surgery-quiz`），設定資料庫密碼，選擇離你最近的 Region
3. 等待專案建立完成（約 1–2 分鐘）

### 步驟 2：建立資料表

進入 Supabase Dashboard → **SQL Editor**，貼上以下 SQL 並執行：

```sql
-- 建立排行榜資料表
CREATE TABLE leaderboard (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_name TEXT NOT NULL CHECK (char_length(player_name) <= 20),
  score NUMERIC(6,2) NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  single_correct_count INT NOT NULL DEFAULT 0,
  multiple_correct_count INT NOT NULL DEFAULT 0,
  unanswered_count INT NOT NULL DEFAULT 0,
  total_questions INT NOT NULL DEFAULT 100,
  mode TEXT NOT NULL DEFAULT 'exam'
);

-- 啟用 Row Level Security
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- RLS Policy：任何人可以新增一筆成績
CREATE POLICY "Anyone can insert"
  ON leaderboard FOR INSERT
  WITH CHECK (true);

-- RLS Policy：任何人可以讀取所有成績
CREATE POLICY "Anyone can read"
  ON leaderboard FOR SELECT
  USING (true);

-- 注意：刻意不開放 UPDATE 和 DELETE，
-- 讓匿名使用者無法修改或刪除已存在的資料。
```

### 步驟 3：取得公開參數

1. 進入 Supabase Dashboard → **Settings** → **API**
2. 複製 **Project URL**（格式為 `https://xxxxx.supabase.co`）
3. 複製 **anon / public** key（以 `eyJ...` 開頭的長字串）

### 步驟 4：填入前端設定

打開 `script.js`，找到檔案上方（約第 10–11 行）：

```js
const SUPABASE_URL = "";
const SUPABASE_ANON_KEY = "";
```

分別貼入你的 Project URL 和 anon key：

```js
const SUPABASE_URL = "https://xxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIs...";
```

### 安全說明

| Key 類型 | 可否放前端 | 說明 |
|---|---|---|
| **anon key**（公開） | 可以 | 受 RLS 限制，只能做 policy 允許的操作 |
| **service_role key**（機密） | 不可以 | 繞過所有 RLS，絕對不可出現在前端程式碼 |

**目前安全狀態：**

- RLS 已啟用，匿名使用者只能 INSERT 和 SELECT，無法 UPDATE/DELETE
- 風險：惡意使用者可透過瀏覽器主控台用 anon key 大量寫入假資料
- 建議後續改進：加入 rate limiting（可透過 Supabase Edge Functions 或 pg_net）、或改用需要登入的 auth 機制

## 功能特色

- 依科別、題型篩選題目
- 可設定題數上限（5–250 題）
- 隨機排序出題
- 單選 / 複選題自動識別
- 即時顯示答對答錯與正確率
- 測驗結束後依科別統計
- 錯題回顧功能
- 附圖題目可正常顯示圖片
- AI 詳解（Gemini）— 錯題一鍵生成解析
- 考試模式 — 標準全科 100 題、含倒扣計分
- 多人排行榜 — Supabase 雲端即時排名
