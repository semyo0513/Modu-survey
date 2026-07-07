/* ===================================================================
   js/mining/crosstab.js — 교차분석 모듈 (교차표 + 카이제곱 검정)
   =================================================================== */

const CrosstabAnalyzer = (() => {

  /**
   * 두 선택형 문항의 교차표 생성
   * @param {Array}  answers
   * @param {string} qidRow    — 행 문항 ID
   * @param {string} qidCol    — 열 문항 ID
   * @param {Array}  rowLabels — 행 레이블 (optional, 자동 추출)
   * @param {Array}  colLabels — 열 레이블 (optional)
   */
  function buildCrosstab(answers, qidRow, qidCol, rowLabels, colLabels) {
    // 응답자별 매핑: responseId → {row값, col값}
    const respMap = {};

    answers.forEach(a => {
      if (!respMap[a.responseId]) respMap[a.responseId] = {};
      if (a.questionId === qidRow) respMap[a.responseId].rowVal = a.value || a.textRaw;
      if (a.questionId === qidCol) respMap[a.responseId].colVal = a.value || a.textRaw;
    });

    const pairs = Object.values(respMap).filter(r => r.rowVal && r.colVal);

    // 레이블 자동 추출
    const rows = rowLabels || [...new Set(pairs.map(p => p.rowVal))].sort();
    const cols = colLabels || [...new Set(pairs.map(p => p.colVal))].sort();

    // 교차표 행렬 (counts)
    const matrix = rows.map(() => cols.map(() => 0));
    pairs.forEach(({ rowVal, colVal }) => {
      const ri = rows.indexOf(rowVal);
      const ci = cols.indexOf(colVal);
      if (ri >= 0 && ci >= 0) matrix[ri][ci]++;
    });

    // 행/열 합계
    const rowTotals = matrix.map(row => row.reduce((s, v) => s + v, 0));
    const colTotals = cols.map((_, ci) => matrix.reduce((s, row) => s + row[ci], 0));
    const grandTotal = rowTotals.reduce((s, v) => s + v, 0);

    // 카이제곱 검정
    const chi2result = chiSquareTest(matrix, rowTotals, colTotals, grandTotal);

    // 셀별 행 퍼센트
    const matrixPct = matrix.map((row, ri) =>
      row.map(cell => rowTotals[ri] ? +(cell / rowTotals[ri] * 100).toFixed(1) : 0)
    );

    return {
      rows, cols, matrix, matrixPct,
      rowTotals, colTotals, grandTotal,
      chi2: chi2result,
      n: pairs.length,
    };
  }

  /**
   * 카이제곱 검정
   */
  function chiSquareTest(observed, rowTotals, colTotals, N) {
    if (N === 0) return { chi2: 0, df: 0, pValue: 1, significant: false };

    let chi2 = 0;
    const df = (observed.length - 1) * (observed[0].length - 1);

    observed.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        const expected = (rowTotals[ri] * colTotals[ci]) / N;
        if (expected > 0) chi2 += (cell - expected) ** 2 / expected;
      });
    });

    // p-value 근사 (chi2 분포 CDF 역함수 간이 계산)
    const pValue = _chi2pvalue(chi2, df);

    return {
      chi2:        +chi2.toFixed(3),
      df,
      pValue:      +pValue.toFixed(4),
      significant: pValue < 0.05,
      level:       pValue < 0.001 ? '***' : pValue < 0.01 ? '**' : pValue < 0.05 ? '*' : 'ns',
    };
  }

  /**
   * 장바구니 분석 (복수선택 문항 대상)
   * @param {Array}  answers
   * @param {string} qid        — checkbox 문항 ID
   * @param {number} minSupport — 최소 지지도 (0~1)
   * @param {number} minConf    — 최소 신뢰도 (0~1)
   */
  function basketAnalysis(answers, qid, minSupport = 0.05, minConf = 0.3) {
    // 응답자별 선택 집합
    const baskets = {};
    answers
      .filter(a => a.questionId === qid && a.value)
      .forEach(a => {
        if (!baskets[a.responseId]) baskets[a.responseId] = new Set();
        baskets[a.responseId].add(a.value);
      });

    const transactions = Object.values(baskets);
    const N = transactions.length;
    if (N === 0) return [];

    // 개별 지지도
    const itemFreq = {};
    transactions.forEach(basket => basket.forEach(item => {
      itemFreq[item] = (itemFreq[item] || 0) + 1;
    }));

    const itemSupport = {};
    Object.entries(itemFreq).forEach(([item, cnt]) => {
      itemSupport[item] = cnt / N;
    });

    // 2-itemset 연관 규칙
    const rules = [];
    const items = Object.keys(itemFreq);

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const A = items[i], B = items[j];
        const coCount = transactions.filter(b => b.has(A) && b.has(B)).length;
        const support  = coCount / N;

        if (support < minSupport) continue;

        const confAB = coCount / itemFreq[A];
        const confBA = coCount / itemFreq[B];
        const liftAB = confAB / itemSupport[B];
        const liftBA = confBA / itemSupport[A];

        if (confAB >= minConf) {
          rules.push({ antecedent: A, consequent: B, support: +support.toFixed(3), confidence: +confAB.toFixed(3), lift: +liftAB.toFixed(3) });
        }
        if (confBA >= minConf) {
          rules.push({ antecedent: B, consequent: A, support: +support.toFixed(3), confidence: +confBA.toFixed(3), lift: +liftBA.toFixed(3) });
        }
      }
    }

    return rules.sort((a, b) => b.lift - a.lift);
  }

  /* ── 카이제곱 p-value 간이 계산 ─────────────────────────────── */
  function _chi2pvalue(x, df) {
    if (x <= 0 || df <= 0) return 1;
    // 감마함수 기반 불완전 감마함수 근사
    return 1 - _gammainc(df / 2, x / 2);
  }

  function _gammainc(a, x) {
    // 수치적분 근사 (series expansion)
    if (x < 0) return 0;
    if (x === 0) return 0;
    let sum = 1 / a;
    let term = 1 / a;
    for (let k = 1; k < 100; k++) {
      term *= x / (a + k);
      sum  += term;
      if (Math.abs(term) < 1e-10) break;
    }
    return Math.min(1, sum * Math.exp(-x + a * Math.log(x)) / _gamma(a));
  }

  function _gamma(n) {
    // Stirling 근사
    if (n < 0.5) return Math.PI / (Math.sin(Math.PI * n) * _gamma(1 - n));
    n -= 1;
    let x = 0.99999999999980993;
    const p = [676.5203681218851,-1259.1392167224028,771.32342877765313,
               -176.61502916214059,12.507343278686905,-0.13857109526572012,
               9.9843695780195716e-6,1.5056327351493116e-7];
    p.forEach((c, i) => { x += c / (n + i + 1); });
    const t = n + p.length - 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, n + 0.5) * Math.exp(-t) * x;
  }

  return { buildCrosstab, chiSquareTest, basketAnalysis };
})();

window.CrosstabAnalyzer = CrosstabAnalyzer;
