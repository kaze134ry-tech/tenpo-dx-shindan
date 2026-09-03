/**
 * 飲食店DX構成診断 — ルールベースFit Scoreエンジン
 *
 * 中立性の原則:
 * - ASP成果報酬額はスコア計算に一切使用しない
 * - 「料金データ信頼度」はスコアに含めない（別途メタ情報として表示）
 * - 対応できない条件では無理に推薦しない
 */

// 3つの構成候補の基礎プロファイル（0〜5点、6軸）
// 軸: marketFit(業種適合) / sizeFit(店舗規模適合) / featureCoverage(必要機能カバー) /
//     budgetFit(予算適合・回答に応じて動的算出) / centralization(一元管理性) / extensibility(拡張性)
const CONFIGURATIONS = {
  unified: {
    key: "unified",
    label: "一元管理型",
    serviceIds: ["stores"],
    baseProfile: { marketFit: 4, featureCoverage: 4, centralization: 5, extensibility: 3 },
    description:
      "POS・予約・決済を1つのサービス（STORES）でまとめて管理する構成。導入・運用の手間を最小化したい店舗向け。",
  },
  lowCostSeparate: {
    key: "lowCostSeparate",
    label: "低コスト分離型",
    serviceIds: ["airregi", "airpay"],
    baseProfile: { marketFit: 4, featureCoverage: 3, centralization: 2, extensibility: 2 },
    description:
      "レジ（Airレジ）と決済（AirPay）を無料アプリの組み合わせで導入する構成。初期費用・月額固定費を最小限に抑えたい店舗向け。予約管理機能は含まない。",
  },
  highFunction: {
    key: "highFunction",
    label: "高機能型",
    serviceIds: ["smaregi", "paygate"],
    baseProfile: { marketFit: 4, featureCoverage: 4, centralization: 3, extensibility: 5 },
    description:
      "多機能POS（スマレジ）と決済端末（PAYGATE）を組み合わせる構成。複数店舗管理・在庫管理・顧客管理など拡張性を重視する店舗向け。",
  },
};

// 重視項目と、対応するスコア軸のウェイト加算（選択時）
const PRIORITY_AXIS_MAP = {
  cost: "budgetFit",
  centralization: "centralization",
  extensibility: "extensibility",
  tryFirst: "budgetFit",
};

/**
 * 「現状維持」を返すべきか判定する。
 * 条件: 1店舗 かつ 少人数(1〜5人) かつ 予約ほぼなし かつ
 *       現在システム導入済み(困っていない) かつ 高機能を重視していない
 */
function shouldRecommendCurrentState(answers) {
  const isSingleStore = answers.storeCount === "single";
  const isSmallStaff = answers.staffCount === "small";
  const barelyReservation = answers.reservationRatio === "none";
  const alreadySatisfied = answers.currentTool === "system_ok";
  const noExtensibilityNeed = !(answers.priorities || []).includes("extensibility");

  return isSingleStore && isSmallStaff && barelyReservation && alreadySatisfied && noExtensibilityNeed;
}

function budgetFitScore(configKey, monthlyBudgetAnswer) {
  // 月額予算の回答: "low"(〜5,000円) / "mid"(5,000〜15,000円) / "high"(15,000円以上)
  const table = {
    unified: { low: 3, mid: 4, high: 4 },
    lowCostSeparate: { low: 5, mid: 4, high: 3 },
    highFunction: { low: 1, mid: 3, high: 5 },
  };
  return table[configKey][monthlyBudgetAnswer] ?? 3;
}

function sizeFitScore(configKey, storeCountAnswer) {
  // "single" / "few"(2〜4) / "many"(5以上)
  const table = {
    unified: { single: 4, few: 4, many: 4 },
    lowCostSeparate: { single: 5, few: 3, many: 2 },
    highFunction: { single: 3, few: 4, many: 5 },
  };
  return table[configKey][storeCountAnswer] ?? 3;
}

function reservationFitAdjustment(configKey, reservationAnswer) {
  // 予約比率が高いほど、予約非対応の低コスト分離型は不利、STORES(一元管理型)は有利
  if (reservationAnswer === "none") return 0;
  const bump = reservationAnswer === "high" ? 2 : 1;
  if (configKey === "unified") return bump;
  if (configKey === "lowCostSeparate") return -bump;
  return 0;
}

/**
 * メインのFit Score計算。
 * 戻り値: 3構成の { key, label, score, breakdown, description } を降順で返す。
 */
function calculateFitScores(answers) {
  const results = Object.values(CONFIGURATIONS).map((config) => {
    const budgetFit = budgetFitScore(config.key, answers.monthlyBudget);
    const sizeFit = sizeFitScore(config.key, answers.storeCount);
    const reservationAdj = reservationFitAdjustment(config.key, answers.reservationRatio);

    const axisScores = {
      marketFit: config.baseProfile.marketFit,
      sizeFit,
      featureCoverage: config.baseProfile.featureCoverage,
      budgetFit,
      centralization: config.baseProfile.centralization,
      extensibility: config.baseProfile.extensibility,
    };

    // 重視項目によるウェイト加算（選択された軸を1.3倍）
    const priorities = answers.priorities || [];
    const weightedAxisScores = {};
    let total = 0;
    let weightSum = 0;
    for (const [axis, score] of Object.entries(axisScores)) {
      const isPrioritized = priorities.some((p) => PRIORITY_AXIS_MAP[p] === axis);
      const weight = isPrioritized ? 1.3 : 1.0;
      weightedAxisScores[axis] = { raw: score, weight };
      total += score * weight;
      weightSum += weight;
    }

    let finalScore = total / weightSum + reservationAdj * 0.3;
    finalScore = Math.max(0, Math.min(5, finalScore));

    return {
      key: config.key,
      label: config.label,
      serviceIds: config.serviceIds,
      description: config.description,
      score: Math.round(finalScore * 10) / 10,
      breakdown: weightedAxisScores,
      reservationAdjustment: reservationAdj,
    };
  });

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * 診断のメインエントリポイント。
 * 「現状維持」条件を満たす場合はそれを先頭に、既存3構成はランキングとして返す。
 */
function runDiagnosis(answers, servicesData) {
  const recommendCurrentState = shouldRecommendCurrentState(answers);
  const rankedConfigs = calculateFitScores(answers);

  const servicesById = {};
  for (const s of servicesData.services) servicesById[s.id] = s;

  const enriched = rankedConfigs.map((r) => ({
    ...r,
    services: r.serviceIds.map((id) => servicesById[id]).filter(Boolean),
  }));

  return {
    recommendCurrentState,
    currentStateReason: recommendCurrentState
      ? "店舗数・人員規模・予約状況・現在の運用状況から、現状の体制で大きな支障がないと考えられます。無理に新しいサービスを導入する前に、まずは困りごとが明確になった時点で再検討することをおすすめします。"
      : null,
    rankedConfigurations: enriched,
    priceCheckedAt: servicesData.priceCheckedAt,
    disclaimer:
      "本診断は入力内容に基づく比較候補の提示であり、「最適」を断定するものではありません。料金は各社公式情報を基にした確認日時点のものです。最終的な導入判断の前に、必ず公式サイトで最新の料金・条件をご確認ください。",
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { runDiagnosis, calculateFitScores, shouldRecommendCurrentState, CONFIGURATIONS };
}
