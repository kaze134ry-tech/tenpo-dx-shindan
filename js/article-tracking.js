/**
 * 記事ページの計測（analytics.js の後に読み込む）
 * - 記事から診断への案内のクリック：article_to_diagnosis（記事名・位置）
 * - 記事内の A8 リンクのクリック：article_affiliate_click（記事名・サービス名）
 * 既存の HTML（A8 の枠の a・img・PR ラベル・rel）は書き換えず、addEventListener で付けるだけ。
 */
(function () {
  if (typeof Analytics === "undefined") return;
  Analytics.init();

  const file = window.location.pathname.split("/").pop() || "index.html";
  const article = file.replace(/\.html$/, "") || "index";

  // 案内の位置：冒頭（intro）／記事末の枠（cta_box）／本文中（inline）
  document.querySelectorAll('a[href^="/#diagnosis"]').forEach((a) => {
    const position = a.dataset.cta || (a.closest(".cta-box") ? "cta_box" : "inline");
    a.addEventListener("click", () => Analytics.articleToDiagnosis(article, position));
  });

  // A8 の a8mat に含まれるプログラムの ID からサービス名を決める（素材のコードは変えない）
  const A8_PROGRAMS = { "81CR3E": "smaregi", "8351WQ": "paygate" };
  document.querySelectorAll('.aff-box a[href^="https://px.a8.net/"]').forEach((a) => {
    let service = "unknown";
    try {
      const mat = new URL(a.href).searchParams.get("a8mat") || "";
      service = A8_PROGRAMS[mat.split(/[+ ]/)[1]] || "unknown";
    } catch (e) {
      /* 解析できなくても計測だけ unknown で続ける */
    }
    a.addEventListener("click", () => Analytics.articleAffiliateClick(article, service));
  });
})();
