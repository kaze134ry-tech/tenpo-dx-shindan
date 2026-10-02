/**
 * GA4イベント計測（最小限）
 * 計測対象: 診断開始 / 各質問離脱 / 診断完了 / 結果別表示 / 外部送客クリック /
 *           記事から診断への案内のクリック / 記事内の A8 リンクのクリック
 *
 * GA4測定IDは実際の取得後に GA_MEASUREMENT_ID を差し替えること。
 * 未設定の間はコンソールログのみ出力し、エラーにはしない。
 */
const GA_MEASUREMENT_ID = "G-6B56CP7WW1";

function loadGoogleAnalytics() {
  if (GA_MEASUREMENT_ID.includes("XXXXXXXXXX")) {
    console.info("[analytics] GA_MEASUREMENT_ID 未設定のため計測をスキップします（開発中の表示）。");
    return;
  }
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID);
}

function trackEvent(eventName, params = {}) {
  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  } else {
    console.info(`[analytics:dev] ${eventName}`, params);
  }
}

// 計測イベント一覧（doc記載の6種）
const Analytics = {
  init: loadGoogleAnalytics,
  diagnosisStart: () => trackEvent("diagnosis_start"),
  questionDropout: (questionIndex) => trackEvent("question_dropout", { question_index: questionIndex }),
  diagnosisComplete: () => trackEvent("diagnosis_complete"),
  resultShown: (configKey) => trackEvent("result_shown", { config_key: configKey }),
  outboundClick: (serviceId, configKey) => trackEvent("outbound_click", { service_id: serviceId, config_key: configKey }),
  articleToDiagnosis: (article, position) => trackEvent("article_to_diagnosis", { article, position }),
  articleAffiliateClick: (article, service) => trackEvent("article_affiliate_click", { article, service }),
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Analytics };
}
