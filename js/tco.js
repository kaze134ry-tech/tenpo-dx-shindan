/**
 * 年間TCO（概算）計算モジュール
 *
 * 年間TCO = 初期費用 + 月額×12 + 端末/機器費用 + 決済手数料概算
 * サービスごとに課金体系（無料アプリ＋端末費用型／月額定額型／月額+決済手数料型／要問い合わせ型）が
 * 異なるため、共通フォーマットに正規化して算出する。
 *
 * 「要問い合わせ」項目は0円として合算せず、明示的に注記を付けて返す。
 */

function estimateAnnualCashlessSales(answers) {
  // ユーザーの回答（キャッシュレス比率・店舗規模）から、決済手数料計算用の
  // 「年間キャッシュレス決済額」を粗く仮定する。実額はヒアリングが必要なため
  // レンジで示し、結果画面でも「概算」であることを明示する。
  const baseAnnualSalesByStoreCount = { single: 12000000, few: 40000000, many: 100000000 };
  const cashlessRatioMap = { low: 0.3, mid: 0.6, high: 0.9 };
  const baseSales = baseAnnualSalesByStoreCount[answers.storeCount] ?? 12000000;
  const ratio = cashlessRatioMap[answers.cashlessRatio] ?? 0.5;
  return baseSales * ratio;
}

function calculateServiceAnnualTco(service, answers) {
  const notes = [];
  let initial = service.initialFee ?? 0;
  let monthly = service.monthlyFee ?? 0;
  let hardware = service.hardwareCostMin ?? 0;
  let paymentFeeYen = 0;

  if (service.billingType === "inquiry") {
    return {
      serviceId: service.id,
      annualTotal: null,
      breakdown: null,
      note: "料金が公式非公開のため、年間TCOは算出できません（要問い合わせ）。",
    };
  }

  if (service.hardwareCostNote) {
    notes.push(`端末/機器費用: ${service.hardwareCostNote}`);
  }

  if (service.paymentFeePctMin != null) {
    const estimatedCashlessSales = estimateAnnualCashlessSales(answers);
    const feePct = (service.paymentFeePctMin + (service.paymentFeePctMax ?? service.paymentFeePctMin)) / 2 / 100;
    paymentFeeYen = Math.round(estimatedCashlessSales * feePct);
    notes.push(
      `決済手数料概算: 想定年間キャッシュレス決済額×${(feePct * 100).toFixed(2)}%（入力条件からの粗い推定値）`
    );
  }

  const annualTotal = initial + monthly * 12 + hardware + paymentFeeYen;

  return {
    serviceId: service.id,
    annualTotal,
    breakdown: { initial, monthlyAnnualized: monthly * 12, hardware, paymentFeeYen },
    note: notes.join(" / ") || null,
  };
}

function calculateConfigurationTco(configuration, answers) {
  const perService = configuration.services.map((s) => calculateServiceAnnualTco(s, answers));
  const hasInquiryOnly = perService.every((p) => p.annualTotal === null);
  const total = perService.reduce((sum, p) => sum + (p.annualTotal ?? 0), 0);

  return {
    perService,
    annualTotalEstimate: hasInquiryOnly ? null : total,
    isPartialEstimate: perService.some((p) => p.annualTotal === null),
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { calculateServiceAnnualTco, calculateConfigurationTco };
}
