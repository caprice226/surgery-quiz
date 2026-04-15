/* ===== 外科專科考題練習 ===== */
(function () {
  "use strict";

  // ---------- 路徑設定 ----------
  const JSON_PATH = "questions.json";
  const IMAGE_BASE = "";

  // ---------- Gemini API 設定 ----------
  // 請在此填入你的 Gemini API Key（取得方式見 README.md）
  const GEMINI_API_KEY = "AIzaSyAffGqBeba5FnK2MOkxHg7LLb6R-N4QQtI";
  const GEMINI_MODEL = "gemini-2.0-flash";

  // ---------- 全域狀態 ----------
  let allQuestions = [];
  let quizQuestions = [];
  let currentIndex = 0;
  let correctCount = 0;
  let answeredCount = 0;
  let userAnswers = []; // [{selected: [...], correct: bool, score, ...}]
  let totalScore = 0;

  // 篩選狀態
  let selectedSpecs = new Set();
  let selectedType = "all";

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const startScreen = $("#start-screen");
  const quizScreen = $("#quiz-screen");
  const resultScreen = $("#result-screen");

  // ---------- 載入題庫 ----------
  async function loadQuestions() {
    try {
      const res = await fetch(JSON_PATH);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      allQuestions = await res.json();
      initStartScreen();
    } catch (err) {
      startScreen.innerHTML = `<div class="card"><h2>載入失敗</h2><p>無法讀取 questions.json：${err.message}</p><p>請確認資料夾結構是否正確，詳見 README.md。</p></div>`;
    }
  }

  // ---------- 起始畫面 ----------
  function initStartScreen() {
    const specs = [...new Set(allQuestions.map((q) => q.specialty))].sort();
    $("#total-count").textContent = allQuestions.length;
    $("#spec-count").textContent = specs.length;

    // 科別 chips
    const specList = $("#specialty-list");

    // 全選 / 取消全選
    const allChip = document.createElement("button");
    allChip.className = "chip";
    allChip.textContent = "全選";
    allChip.addEventListener("click", () => {
      const allSelected = selectedSpecs.size === specs.length;
      specs.forEach((s) => (allSelected ? selectedSpecs.delete(s) : selectedSpecs.add(s)));
      updateSpecChips();
      updateStartInfo();
    });
    specList.appendChild(allChip);

    specs.forEach((s) => {
      const btn = document.createElement("button");
      btn.className = "chip";
      btn.textContent = s;
      btn.dataset.spec = s;
      btn.addEventListener("click", () => {
        selectedSpecs.has(s) ? selectedSpecs.delete(s) : selectedSpecs.add(s);
        updateSpecChips();
        updateStartInfo();
      });
      specList.appendChild(btn);
    });

    // 題型 chips
    $$('[data-type]').forEach((btn) => {
      btn.addEventListener("click", () => {
        $$('[data-type]').forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        selectedType = btn.dataset.type;
        updateStartInfo();
      });
    });

    // 題數 slider
    const slider = $("#question-limit");
    const limitDisp = $("#limit-display");
    slider.addEventListener("input", () => {
      limitDisp.textContent = slider.value;
    });

    // 開始
    $("#start-btn").addEventListener("click", startQuiz);
    updateStartInfo();
  }

  function updateSpecChips() {
    $$("#specialty-list .chip[data-spec]").forEach((btn) => {
      btn.classList.toggle("active", selectedSpecs.has(btn.dataset.spec));
    });
    // 全選 chip 狀態
    const allChip = $("#specialty-list .chip:first-child");
    const specs = [...new Set(allQuestions.map((q) => q.specialty))];
    if (selectedSpecs.size === specs.length) {
      allChip.classList.add("active");
      allChip.textContent = "取消全選";
    } else {
      allChip.classList.remove("active");
      allChip.textContent = "全選";
    }
  }

  function getFilteredQuestions() {
    return allQuestions.filter((q) => {
      if (!selectedSpecs.has(q.specialty)) return false;
      if (selectedType !== "all" && q.question_type !== selectedType) return false;
      return true;
    });
  }

  function updateStartInfo() {
    const filtered = getFilteredQuestions();
    const info = $("#selected-info");
    const btn = $("#start-btn");
    const slider = $("#question-limit");
    const limitDisp = $("#limit-display");

    if (selectedSpecs.size === 0) {
      info.textContent = "請至少選擇一個科別";
      btn.disabled = true;
    } else {
      let limit = parseInt(slider.value);
      const available = filtered.length;
      // 可用題數向下取整到 5 的倍數（至少 5）
      const maxAllowed = Math.max(5, Math.floor(available / 5) * 5);

      if (limit > available) {
        // 自動調整 slider 到可用最大題數（取 5 的倍數）
        const adjusted = Math.min(limit, maxAllowed);
        slider.value = adjusted;
        limitDisp.textContent = adjusted;
        limit = adjusted;
        info.textContent = `目前條件下可用題數不足，已自動調整為 ${Math.min(adjusted, available)} 題（共 ${available} 題可用）`;
      } else {
        const actual = Math.min(limit, available);
        info.textContent = `已選 ${selectedSpecs.size} 科，共 ${available} 題可用，本次作答 ${actual} 題`;
      }
      btn.disabled = available === 0;
    }
  }

  // ---------- 開始測驗 ----------
  function startQuiz() {
    let filtered = getFilteredQuestions();
    const limit = parseInt($("#question-limit").value);
    const shuffle = $("#shuffle-toggle").checked;

    if (shuffle) filtered = shuffleArray([...filtered]);
    quizQuestions = filtered.slice(0, limit);
    currentIndex = 0;
    correctCount = 0;
    answeredCount = 0;
    userAnswers = [];
    totalScore = 0;

    startScreen.classList.add("hidden");
    quizScreen.classList.remove("hidden");
    resultScreen.classList.add("hidden");

    renderQuestion();
  }

  // ---------- 顯示題目 ----------
  function renderQuestion() {
    const q = quizQuestions[currentIndex];
    const isMultiple = q.question_type === "複選題";

    // Meta
    $("#q-specialty").textContent = q.specialty;
    $("#q-type").textContent = q.question_type;
    $("#q-number").textContent = `第 ${q.question_number} 題`;
    $("#q-source").textContent = q.source_file;

    // Progress
    $("#progress-text").textContent = `${currentIndex + 1} / ${quizQuestions.length}`;
    $("#score-text").textContent = `正確 ${correctCount} / 已答 ${answeredCount}`;
    $("#progress-fill").style.width = `${((currentIndex) / quizQuestions.length) * 100}%`;

    // Images — 路徑轉換：相對於 外專考題_md
    const imgContainer = $("#question-images");
    imgContainer.innerHTML = "";
    if (q.image_paths && q.image_paths.length > 0) {
      q.image_paths.forEach((p) => {
        const img = document.createElement("img");
        img.src = IMAGE_BASE + p;
        img.alt = "題目附圖";
        img.onerror = function () {
          this.alt = "圖片載入失敗：" + p;
          this.style.border = "2px dashed #dc2626";
          this.style.padding = "20px";
          this.style.background = "#fee2e2";
        };
        imgContainer.appendChild(img);
      });
    }

    // Question text (strip markdown image syntax for display)
    let text = q.question_text.replace(/!\[[^\]]*\]\([^)]+\)/g, "").trim();
    $("#question-text").textContent = text;

    // Options
    const optCont = $("#options-container");
    optCont.innerHTML = "";

    if (isMultiple) {
      // 複選提示
      const hint = document.createElement("p");
      hint.style.cssText = "font-size:.85rem;color:#64748b;margin-bottom:8px;";
      hint.textContent = "（複選題，可選擇多個答案）";
      optCont.appendChild(hint);
    }

    q.options.forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.dataset.label = opt.label;
      btn.innerHTML = `<span class="option-label">${opt.label}</span><span>${opt.text}</span>`;
      btn.addEventListener("click", () => toggleOption(btn, isMultiple));
      optCont.appendChild(btn);
    });

    // Buttons
    const submitBtn = $("#submit-btn");
    const nextBtn = $("#next-btn");
    submitBtn.classList.remove("hidden");
    submitBtn.disabled = true;
    submitBtn.onclick = () => submitAnswer(q);
    nextBtn.classList.add("hidden");

    // Feedback
    const fb = $("#answer-feedback");
    fb.classList.add("hidden");
    fb.classList.remove("correct", "wrong");
  }

  function toggleOption(btn, isMultiple) {
    if (btn.classList.contains("locked")) return;

    if (!isMultiple) {
      // 單選：取消其他
      $$(".option-btn").forEach((b) => b.classList.remove("selected"));
    }
    btn.classList.toggle("selected");
    $("#submit-btn").disabled = $$(".option-btn.selected").length === 0;
  }

  // ---------- 計分輔助 ----------
  function calcQuestionScore(q, selectedLabels, correctLabels) {
    const perQ = 100 / quizQuestions.length;
    const isMultiple = q.question_type === "複選題";

    if (selectedLabels.length === 0) return { score: 0, k: isMultiple ? 5 : null };

    if (!isMultiple) {
      // 單選題
      const isCorrect =
        selectedLabels.length === correctLabels.length &&
        selectedLabels.every((l, i) => l === correctLabels[i]);
      return { score: isCorrect ? perQ : 0, k: null };
    }

    // 複選題：固定 5 個選項 A-E
    const allLabels = ["A", "B", "C", "D", "E"];
    let k = 0;
    allLabels.forEach((label) => {
      const userSelected = selectedLabels.includes(label);
      const isAnswer = correctLabels.includes(label);
      if (userSelected !== isAnswer) k++;
    });

    const ratio = Math.max(0, (5 - 2 * k) / 5);
    return { score: perQ * ratio, k };
  }

  // ---------- 提交答案 ----------
  function submitAnswer(q) {
    const selectedBtns = $$(".option-btn.selected");
    const selectedLabels = [...selectedBtns].map((b) => b.dataset.label).sort();
    const correctLabels = q.answer ? q.answer.split("").filter((c) => /[A-E]/.test(c)).sort() : [];

    const isCorrect =
      selectedLabels.length === correctLabels.length &&
      selectedLabels.every((l, i) => l === correctLabels[i]);

    const { score, k } = calcQuestionScore(q, selectedLabels, correctLabels);
    const roundedScore = Math.round(score * 100) / 100;

    answeredCount++;
    if (isCorrect) correctCount++;
    totalScore += roundedScore;

    userAnswers.push({
      question: q,
      selected: selectedLabels,
      correctLabels,
      isCorrect,
      score: roundedScore,
      k,
    });

    // Lock & highlight
    $$(".option-btn").forEach((btn) => {
      btn.classList.add("locked");
      const label = btn.dataset.label;
      const isSelected = selectedLabels.includes(label);
      const isAnswer = correctLabels.includes(label);

      if (isAnswer && isSelected) btn.classList.add("correct");
      else if (isAnswer && !isSelected) btn.classList.add("missed");
      else if (!isAnswer && isSelected) btn.classList.add("wrong");
    });

    // Feedback
    const fb = $("#answer-feedback");
    fb.classList.remove("hidden");
    if (isCorrect) {
      fb.className = "feedback correct";
      fb.textContent = "正確！";
    } else {
      fb.className = "feedback wrong";
      fb.textContent = `錯誤。正確答案：${correctLabels.join("")}`;
    }

    // Update score
    $("#score-text").textContent = `正確 ${correctCount} / 已答 ${answeredCount}`;

    // Buttons
    $("#submit-btn").classList.add("hidden");
    const nextBtn = $("#next-btn");
    nextBtn.classList.remove("hidden");

    if (currentIndex >= quizQuestions.length - 1) {
      nextBtn.textContent = "查看結果";
      nextBtn.onclick = showResults;
    } else {
      nextBtn.textContent = "下一題";
      nextBtn.onclick = () => {
        currentIndex++;
        renderQuestion();
      };
    }
  }

  // ---------- 結算畫面 ----------
  function showResults() {
    quizScreen.classList.add("hidden");
    resultScreen.classList.remove("hidden");

    const finalScore = Math.round(totalScore * 100) / 100;
    const perQ = Math.round((100 / quizQuestions.length) * 100) / 100;

    $("#final-score").textContent = finalScore.toFixed(2);
    $("#result-summary").textContent = `共 ${answeredCount} 題｜每題滿分 ${perQ.toFixed(2)} 分｜總分 ${finalScore.toFixed(2)} / 100`;

    // Stats by specialty
    const specStats = {};
    userAnswers.forEach((a) => {
      const s = a.question.specialty;
      if (!specStats[s]) specStats[s] = { total: 0, correct: 0, score: 0 };
      specStats[s].total++;
      if (a.isCorrect) specStats[s].correct++;
      specStats[s].score += a.score;
    });

    const detailDiv = $("#result-details");
    detailDiv.innerHTML = "";
    Object.entries(specStats)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([spec, st]) => {
        const box = document.createElement("div");
        box.className = "stat-box";
        const rate = Math.round((st.correct / st.total) * 100);
        const specScore = Math.round(st.score * 100) / 100;
        box.innerHTML = `<div class="stat-num">${rate}%</div><div class="stat-label">${spec}<br>${st.correct}/${st.total}｜${specScore.toFixed(2)} 分</div>`;
        detailDiv.appendChild(box);
      });

    // Per-question score table
    renderScoreTable();

    // Review
    const reviewBtn = $("#review-btn");
    const reviewSection = $("#review-section");
    reviewSection.classList.add("hidden");

    reviewBtn.onclick = () => {
      reviewSection.classList.toggle("hidden");
      renderReview();
    };

    $("#restart-btn").onclick = () => {
      resultScreen.classList.add("hidden");
      startScreen.classList.remove("hidden");
      reviewSection.classList.add("hidden");
    };
  }

  // ---------- 每題得分明細表 ----------
  function renderScoreTable() {
    const container = $("#score-table-container");
    if (!container) return;
    container.innerHTML = "";

    const perQ = Math.round((100 / quizQuestions.length) * 100) / 100;

    let html = `<table class="score-table"><thead><tr>
      <th>#</th><th>科別</th><th>題型</th><th>滿分</th><th>得分</th>
      <th>正確答案</th><th>你的答案</th><th>k 值</th>
    </tr></thead><tbody>`;

    userAnswers.forEach((a, i) => {
      const q = a.question;
      const rowClass = a.isCorrect ? "" : "row-wrong";
      const kDisplay = a.k !== null ? a.k : "—";
      html += `<tr class="${rowClass}">
        <td>${i + 1}</td>
        <td>${escapeHtml(q.specialty)}</td>
        <td>${q.question_type}</td>
        <td>${perQ.toFixed(2)}</td>
        <td>${a.score.toFixed(2)}</td>
        <td>${a.correctLabels.join("")}</td>
        <td>${a.selected.length > 0 ? a.selected.join("") : "未作答"}</td>
        <td>${kDisplay}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  function renderReview() {
    const container = $("#review-container");
    if (container.children.length > 0) return; // already rendered
    container.innerHTML = "";

    const wrongOnes = userAnswers.filter((a) => !a.isCorrect);
    if (wrongOnes.length === 0) {
      container.innerHTML = "<p>全部答對，沒有錯題！</p>";
      return;
    }

    wrongOnes.forEach((a, idx) => {
      const q = a.question;
      const div = document.createElement("div");
      div.className = "review-item";

      let imgsHtml = "";
      if (q.image_paths && q.image_paths.length > 0) {
        imgsHtml = q.image_paths
          .map((p) => `<img src="${IMAGE_BASE}${p}" alt="附圖" style="max-width:100%;max-height:200px;border-radius:6px;margin-bottom:8px;">`)
          .join("");
      }

      const text = q.question_text.replace(/!\[[^\]]*\]\([^)]+\)/g, "").trim();

      div.innerHTML = `
        <div class="question-meta" style="margin-bottom:8px;">
          <span class="badge">${q.specialty}</span>
          <span class="badge dim">第 ${q.question_number} 題</span>
        </div>
        ${imgsHtml}
        <p class="question-text">${escapeHtml(text)}</p>
        ${q.options.map((o) => {
          const isCorrect = a.correctLabels.includes(o.label);
          const isWrong = a.selected.includes(o.label) && !isCorrect;
          let cls = "";
          if (isCorrect) cls = "correct-ans";
          else if (isWrong) cls = "your-ans";
          return `<p class="review-answer ${cls}">${o.label}. ${escapeHtml(o.text)} ${isCorrect ? " ✓" : ""}${isWrong ? " ✗" : ""}</p>`;
        }).join("")}
        <p class="review-answer correct-ans" style="margin-top:8px;">正確答案：${a.correctLabels.join("")}　｜　你的答案：${a.selected.join("")}　｜　得分：${a.score.toFixed(2)}${a.k !== null ? "　｜　k=" + a.k : ""}</p>
        <div class="ai-explain-wrap">
          <button class="btn-ai-explain" data-idx="${idx}">AI 詳解</button>
          <div class="ai-explain-content hidden" id="ai-explain-${idx}"></div>
        </div>
      `;
      container.appendChild(div);
    });

    // 綁定 AI 詳解按鈕事件
    container.querySelectorAll(".btn-ai-explain").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx);
        const contentDiv = container.querySelector(`#ai-explain-${idx}`);
        // 已經生成過 → 展開/收合
        if (contentDiv.dataset.loaded === "true") {
          contentDiv.classList.toggle("hidden");
          btn.textContent = contentDiv.classList.contains("hidden") ? "AI 詳解" : "收合詳解";
          return;
        }
        // 尚未生成 → 呼叫 API
        const wrongIdx = idx;
        const a = wrongOnes[wrongIdx];
        fetchAIExplanation(a, btn, contentDiv);
      });
    });
  }

  // ---------- Gemini AI 詳解 ----------
  async function fetchAIExplanation(a, btn, contentDiv) {
    // 檢查 API Key
    if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === "") {
      contentDiv.classList.remove("hidden");
      contentDiv.innerHTML = `<p class="ai-explain-warning">尚未設定 Gemini API Key。請開啟 <code>script.js</code>，在檔案最上方找到 <code>GEMINI_API_KEY</code> 變數，填入你的 API Key。<br>取得方式請參閱 README.md。</p>`;
      contentDiv.dataset.loaded = "true";
      btn.textContent = "收合詳解";
      return;
    }

    const q = a.question;
    const text = q.question_text.replace(/!\[[^\]]*\]\([^)]+\)/g, "").trim();
    const optionsText = q.options.map((o) => `${o.label}. ${o.text}`).join("\n");
    const hasImage = q.image_paths && q.image_paths.length > 0;

    const prompt = `你是一位外科專科考試的教學助教。請針對以下錯題提供詳細解析，使用繁體中文回答。

【科別】${q.specialty}
【題型】${q.question_type}
【題目】${text}
【選項】
${optionsText}
【正確答案】${a.correctLabels.join("")}
【使用者作答】${a.selected.join("") || "未作答"}
${hasImage ? "【備註】本題含有附圖，請依題目文字描述進行解析。" : ""}

請依照以下結構回答：
1. **為什麼正解正確**：說明正確答案的醫學依據
2. **為什麼我選錯**：分析使用者選擇的答案為何不對
3. **其他選項為何不適合**：逐一說明其餘選項的問題
4. **核心觀念**：歸納這題考的關鍵知識點

請簡潔但完整，適合考前複習使用。`;

    // 載入中狀態
    btn.disabled = true;
    btn.textContent = "生成中…";
    contentDiv.classList.remove("hidden");
    contentDiv.innerHTML = `<div class="ai-loading"><span class="ai-spinner"></span> 正在向 Gemini 請求解析…</div>`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData?.error?.message || `HTTP ${res.status}`;
        throw new Error(errMsg);
      }

      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "（未收到回應內容）";

      // 簡易 Markdown → HTML（粗體、換行）
      const html = escapeHtml(reply)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>");

      contentDiv.innerHTML = `<div class="ai-explain-body">${html}</div>`;
      contentDiv.dataset.loaded = "true";
      btn.disabled = false;
      btn.textContent = "收合詳解";
    } catch (err) {
      contentDiv.innerHTML = `<p class="ai-explain-error">解析請求失敗：${escapeHtml(err.message)}<br>請確認 API Key 是否正確，以及網路連線是否正常。</p>`;
      btn.disabled = false;
      btn.textContent = "重試 AI 詳解";
      // 允許重試：不標記為 loaded
      contentDiv.dataset.loaded = "";
    }
  }

  // ---------- Helpers ----------
  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Init ----------
  loadQuestions();
})();
