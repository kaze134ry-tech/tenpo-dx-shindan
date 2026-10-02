/**
 * 診断UIの制御ロジック（LP → 診断 → 結果の一連の流れ）
 */

const QUESTIONS = [
  {
    id: "storeCount",
    text: "運営している店舗数は？",
    options: [
      { value: "single", label: "1店舗" },
      { value: "few", label: "2〜4店舗" },
      { value: "many", label: "5店舗以上" },
    ],
  },
  {
    id: "staffCount",
    text: "従業員数（アルバイト含む）は？",
    options: [
      { value: "small", label: "1〜5人" },
      { value: "mid", label: "6〜15人" },
      { value: "large", label: "16人以上" },
    ],
  },
  {
    id: "reservationRatio",
    text: "来店客のうち、事前予約の割合は？",
    options: [
      { value: "none", label: "ほぼなし（ふらっと来店が中心）" },
      { value: "mid", label: "3割程度" },
      { value: "high", label: "5割以上" },
    ],
  },
  {
    id: "cashlessRatio",
    text: "会計時のキャッシュレス決済の比率は？",
    options: [
      { value: "low", label: "低い（現金中心）" },
      { value: "mid", label: "半々くらい" },
      { value: "high", label: "高い（ほぼキャッシュレス）" },
    ],
  },
  {
    id: "monthlyBudget",
    text: "DXツールにかけられる月額予算は？",
    options: [
      { value: "low", label: "〜5,000円程度" },
      { value: "mid", label: "5,000〜15,000円程度" },
      { value: "high", label: "15,000円以上" },
    ],
  },
  {
    id: "currentTool",
    text: "現在の会計・予約管理の状況は？",
    options: [
      { value: "none", label: "紙・手作業のみで、特に困っていない" },
      { value: "system_ok", label: "何らかのシステムを使っていて、今のところ困っていない" },
      { value: "partial", label: "一部システム化しているが、不便を感じている" },
    ],
  },
  {
    id: "priorities",
    text: "特に重視したいことは？（複数選択可）",
    multi: true,
    options: [
      { value: "cost", label: "とにかくコストを抑えたい" },
      { value: "centralization", label: "1つのサービスで一元管理したい" },
      { value: "extensibility", label: "多機能・拡張性を重視したい" },
      { value: "tryFirst", label: "まずは小さく試したい" },
    ],
  },
  {
    id: "contractLockIn",
    text: "現在利用中のサービスがある場合、契約期間の縛りや解約金は？",
    options: [
      { value: "none", label: "特にない、または何も導入していない" },
      { value: "locked", label: "契約期間中で、解約金がかかる可能性がある" },
      { value: "unknown", label: "契約内容がよくわからない" },
    ],
  },
  {
    id: "prefecture",
    text: "店舗の所在地（都道府県）は？",
    type: "select",
    options: [
      "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
      "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
      "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
      "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
      "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
      "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
      "熊本県","大分県","宮崎県","鹿児島県","沖縄県",
    ].map((name) => ({ value: name, label: name })),
  },
];

const state = { currentQuestion: 0, answers: {}, servicesData: null, subsidiesData: null };

async function loadServicesData() {
  const res = await fetch("data/services.json");
  return res.json();
}

async function loadSubsidiesData() {
  const res = await fetch("data/subsidies.json");
  return res.json();
}

const PROGRESS_KEY = "tenpoDxShindanProgress";

function saveProgress() {
  try {
    sessionStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ currentQuestion: state.currentQuestion, answers: state.answers })
    );
  } catch (e) {
    /* プライベートブラウジング等でsessionStorageが使えない場合は何もしない */
  }
}

function loadProgress() {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clearProgress() {
  try {
    sessionStorage.removeItem(PROGRESS_KEY);
  } catch (e) {
    /* noop */
  }
}

function renderQuestion() {
  const q = QUESTIONS[state.currentQuestion];
  const card = document.getElementById("question-card");
  const selected = state.answers[q.id];

  if (q.type === "select") {
    card.innerHTML = `
      <div class="q-index">質問 ${state.currentQuestion + 1} / ${QUESTIONS.length}</div>
      <h2>${q.text}</h2>
      <select class="select-input" id="select-input">
        <option value="" ${!selected ? "selected" : ""} disabled>選択してください</option>
        ${q.options
          .map(
            (opt) =>
              `<option value="${opt.value}" ${selected === opt.value ? "selected" : ""}>${opt.label}</option>`
          )
          .join("")}
      </select>
      <div class="nav-row">
        <button class="btn secondary" id="back-btn" ${state.currentQuestion === 0 ? "disabled style='visibility:hidden'" : ""}>戻る</button>
        <button class="btn" id="next-btn" ${selected ? "" : "disabled"}>次へ</button>
      </div>
    `;
    document.getElementById("select-input").addEventListener("change", (e) => {
      state.answers[q.id] = e.target.value;
      document.getElementById("next-btn").disabled = !e.target.value;
      saveProgress();
    });
    document.getElementById("back-btn").addEventListener("click", goBack);
    document.getElementById("next-btn").addEventListener("click", goNext);
    document.getElementById("progress-fill").style.width = `${((state.currentQuestion) / QUESTIONS.length) * 100}%`;
    return;
  }

  card.innerHTML = `
    <div class="q-index">質問 ${state.currentQuestion + 1} / ${QUESTIONS.length}</div>
    <h2>${q.text}</h2>
    <div class="options" id="options-container"></div>
    <div class="nav-row">
      <button class="btn secondary" id="back-btn" ${state.currentQuestion === 0 ? "disabled style='visibility:hidden'" : ""}>戻る</button>
      ${q.multi ? '<button class="btn" id="next-btn">次へ</button>' : "<span></span>"}
    </div>
  `;

  const optionsContainer = document.getElementById("options-container");
  q.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.type = "button";
    const isSelected = q.multi ? (selected || []).includes(opt.value) : selected === opt.value;
    if (isSelected) btn.classList.add("selected");
    btn.textContent = opt.label;
    btn.addEventListener("click", () => handleOptionClick(q, opt.value));
    optionsContainer.appendChild(btn);
  });

  document.getElementById("back-btn").addEventListener("click", goBack);
  if (q.multi) {
    document.getElementById("next-btn").addEventListener("click", goNext);
  }

  document.getElementById("progress-fill").style.width = `${((state.currentQuestion) / QUESTIONS.length) * 100}%`;
}

function handleOptionClick(question, value) {
  if (question.multi) {
    const current = state.answers[question.id] || [];
    state.answers[question.id] = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    renderQuestion();
  } else {
    state.answers[question.id] = value;
    goNext();
  }
  saveProgress();
}

function goNext() {
  if (state.currentQuestion < QUESTIONS.length - 1) {
    state.currentQuestion += 1;
    renderQuestion();
    saveProgress();
  } else {
    finishDiagnosis();
  }
}

function goBack() {
  if (state.currentQuestion === 0) return;
  Analytics.questionDropout(state.currentQuestion);
  state.currentQuestion -= 1;
  renderQuestion();
  saveProgress();
}

function startDiagnosis(resumed) {
  document.getElementById("lp").classList.remove("active");
  document.getElementById("lp").style.display = "none";
  document.getElementById("diagnosis").classList.add("active");
  Analytics.diagnosisStart();
  if (!resumed) {
    state.currentQuestion = 0;
    state.answers = {};
  }
  renderQuestion();
}

function priceConfidenceLabel(confidence) {
  const map = {
    official: "公式情報で確認済み",
    secondary_source: "二次情報のみ確認（要再確認）",
    inquiry_required: "料金非公開・要問い合わせ",
  };
  return map[confidence] || "";
}

function renderResult(diagnosis) {
  const container = document.getElementById("result-content");
  let html = "";

  if (diagnosis.recommendCurrentState) {
    html += `
      <div class="current-state-box">
        <span class="type-tag type-current_state">現状維持</span>
        <h2>診断結果：まずは現状維持でも問題なさそうです</h2>
        <p>${diagnosis.currentStateReason}</p>
      </div>
    `;
  }

  diagnosis.rankedConfigurations.forEach((config, index) => {
    const tco = calculateConfigurationTco(config, state.answers);
    const rankClass = index === 0 ? "rank-1" : "";
    const scorePercent = Math.min(100, Math.max(0, (config.score / 5) * 100));
    html += `
      <div class="config-card ${rankClass}">
        <span class="rank-badge">比較候補 ${index + 1}位</span>
        <span class="type-tag type-${config.key}">${config.label}</span>
        <h3>${config.label}</h3>
        <div class="score-row">
          <span class="score-label">適合度</span>
          <div class="score-bar"><div class="score-bar-fill" style="width:${scorePercent}%"></div></div>
          <span class="score-value">${config.score} / 5.0</span>
        </div>
        <p class="desc">${config.description}</p>
        <ul class="service-list">
          ${config.services
            .map(
              (s) => `
            <li>
              <span class="service-name">${s.name}</span>
              <span class="service-price-conf">（${priceConfidenceLabel(s.priceConfidence)}／確認日: ${s.priceCheckedAt}）</span>
              <br>
              <a class="official-link" href="${s.officialUrl}" target="_blank" rel="noopener nofollow sponsored"
                 onclick="Analytics.outboundClick('${s.id}', '${config.key}')">公式サイトで詳細を見る →</a>
            </li>
          `
            )
            .join("")}
        </ul>
        ${renderTcoBox(tco)}
        <div class="reasons-box">
          <details>
            <summary>この構成が上位に来た理由を見る</summary>
            <p>店舗規模・予約比率・予算感などの入力内容から、以下の観点でスコアを算出しています（各軸0〜5点、重視項目に応じて加重）。</p>
            <ul>
              <li>業種適合: ${config.breakdown.marketFit.raw}点</li>
              <li>店舗規模適合: ${config.breakdown.sizeFit.raw}点</li>
              <li>必要機能カバー: ${config.breakdown.featureCoverage.raw}点</li>
              <li>予算適合: ${config.breakdown.budgetFit.raw}点</li>
              <li>一元管理性: ${config.breakdown.centralization.raw}点</li>
              <li>拡張性: ${config.breakdown.extensibility.raw}点</li>
            </ul>
          </details>
        </div>
      </div>
    `;
  });

  html += `
    <div class="excluded-note">
      ※ 予約・シフト管理専業のサービスは、比較検討時点でアフィリエイト提携が確認できなかったため、本診断では個別に扱っていません。予約機能が必要な場合は「一元管理型」のSTORESでの代替をご検討ください。
    </div>
  `;

  html += renderContractNote(state.answers.contractLockIn);
  html += renderSubsidyBox(state.answers.prefecture, state.subsidiesData);
  html += renderRelatedArticles(diagnosis);

  container.innerHTML = html;
  Analytics.resultShown(diagnosis.rankedConfigurations[0]?.key || "current_state");
}

function renderContractNote(contractLockIn) {
  if (contractLockIn !== "locked" && contractLockIn !== "unknown") return "";
  return `
    <div class="notice-box">
      <h3>乗り換えを検討する前に確認したいこと</h3>
      <p>現在契約中のサービスに契約期間の縛りや解約金が発生する可能性がある場合、乗り換え先の費用だけでなく、現行サービスの解約条件もあわせて確認することをおすすめします。詳しくは<a href="articles/contract-term-cancellation-fee.html">こちらの記事</a>で整理しています。</p>
    </div>
  `;
}

function renderSubsidyBox(prefecture, subsidiesData) {
  if (!prefecture || !subsidiesData) return "";
  const national = subsidiesData.national;
  const prefPrograms = subsidiesData.prefectures && subsidiesData.prefectures[prefecture];

  let programsHtml = "";
  if (prefPrograms && prefPrograms.length > 0) {
    programsHtml = prefPrograms
      .map(
        (p) => `
      <div class="subsidy-program">
        <h4>${p.name}</h4>
        <p>${p.summary}</p>
        <p class="subsidy-meta">実施：${p.operator}／対象：${p.target}／確認日：${p.checkedAt}</p>
        <a href="${p.officialUrl}" target="_blank" rel="noopener nofollow">公式情報を見る →</a>
      </div>
    `
      )
      .join("");
  } else {
    programsHtml = `<p>${prefecture}独自の補助金制度は、本ツールでは未掲載です。まずは全国共通の国の制度と、お住まいの自治体の公式サイトをご確認ください。</p>`;
  }

  return `
    <div class="subsidy-box">
      <h3>お住まいの地域で使える補助金情報（参考）</h3>
      <div class="subsidy-program">
        <h4>${national.name}</h4>
        <p>${national.summary}</p>
        <p class="subsidy-meta">確認日：${national.checkedAt}</p>
        <a href="${national.officialUrl}" target="_blank" rel="noopener nofollow">公式情報を見る →</a>
      </div>
      ${programsHtml}
      <p class="subsidy-disclaimer">補助金は公募期間・要件が変更されることがあります。申請前に必ず公式サイトで最新情報をご確認ください。</p>
    </div>
  `;
}

function renderRelatedArticles(diagnosis) {
  const topKey = diagnosis.recommendCurrentState
    ? "current_state"
    : diagnosis.rankedConfigurations[0]?.key;
  const map = {
    unified: [
      ["articles/pos-reservation-separate-or-unified.html", "飲食店の予約システム、POSと別々にしていい？一体型との違い"],
      ["articles/annual-tco-simulation.html", "飲食店DXの年間コストはいくら？パターン別に試算してみた"],
    ],
    lowCostSeparate: [
      ["articles/payment-fee-comparison.html", "飲食店の決済手数料、サービスでどれくらい違う？"],
      ["articles/annual-tco-simulation.html", "飲食店DXの年間コストはいくら？パターン別に試算してみた"],
    ],
    highFunction: [
      ["articles/shift-management-dx.html", "飲食店のシフト管理、DXツールでどこまで楽になる？"],
      ["articles/annual-tco-simulation.html", "飲食店DXの年間コストはいくら？パターン別に試算してみた"],
    ],
    current_state: [
      ["articles/what-is-restaurant-dx.html", "飲食店DXとは？何から始めればいいか整理してみた"],
      ["articles/small-shop-dx-priority.html", "小規模飲食店のDX、何から手をつける？優先順位の付け方"],
    ],
  };
  const links = map[topKey] || map.current_state;
  const items = links.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join("");
  return `
    <div class="related-articles-result">
      <h3>あわせて読みたい記事</h3>
      <ul>${items}</ul>
    </div>
  `;
}

function renderTcoBox(tco) {
  if (tco.annualTotalEstimate === null) {
    return `<div class="tco-box">年間概算TCO: <strong>算出不可</strong>（構成内に料金非公開のサービスを含むため）</div>`;
  }
  const note = tco.isPartialEstimate
    ? "（一部のサービスは要問い合わせのため未算入）"
    : "";
  return `
    <div class="tco-box">
      年間概算TCO: <span class="amount">¥${tco.annualTotalEstimate.toLocaleString()}</span> ${note}
      <div style="font-size:12px; color:var(--muted); margin-top:6px;">初期費用＋月額×12＋端末費用＋決済手数料概算の合計。入力条件からの粗い推定値であり、実際の契約条件により変動します。</div>
    </div>
  `;
}

async function finishDiagnosis() {
  Analytics.diagnosisComplete();
  clearProgress();
  document.getElementById("diagnosis").classList.remove("active");
  document.getElementById("diagnosis").style.display = "none";
  document.getElementById("result").classList.add("active");

  if (!state.servicesData) {
    state.servicesData = await loadServicesData();
  }
  if (!state.subsidiesData) {
    try {
      state.subsidiesData = await loadSubsidiesData();
    } catch (e) {
      state.subsidiesData = null;
    }
  }
  const diagnosis = runDiagnosis(state.answers, state.servicesData);
  renderResult(diagnosis);
}

document.addEventListener("DOMContentLoaded", () => {
  Analytics.init();
  const startBtn = document.getElementById("start-diagnosis-btn");
  if (startBtn) startBtn.addEventListener("click", () => startDiagnosis(false));

  // 診断途中でリロードされた場合、保存済みの回答から再開する
  const saved = loadProgress();
  if (saved && typeof saved.currentQuestion === "number" && saved.answers) {
    state.currentQuestion = saved.currentQuestion;
    state.answers = saved.answers;
    startDiagnosis(true);
    return;
  }

  // 記事ページの「#diagnosis」CTAリンクから遷移してきた場合、自動的に診断を開始する
  if (window.location.hash === "#diagnosis" && startBtn) {
    startDiagnosis(false);
  }
});
