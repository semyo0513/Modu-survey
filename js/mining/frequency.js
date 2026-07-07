/* ===================================================================
   js/mining/frequency.js — 빈도분석 모듈
   =================================================================== */

const FrequencyAnalyzer = (() => {

  /** 선택형 빈도 분석 */
  function analyzeChoices(answers, questionId) {
    const freq = {};
    answers
      .filter(a => a.questionId === questionId && a.value)
      .forEach(a => { freq[a.value] = (freq[a.value] || 0) + 1; });

    const total  = Object.values(freq).reduce((s, v) => s + v, 0);
    const sorted = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count, pct: total ? +(count / total * 100).toFixed(1) : 0 }));

    return { items: sorted, total };
  }

  /** 서술형 n-gram 빈도 분석 */
  function analyzeText(answers, questionId, opts = {}) {
    const { topN = 30, minLen = 2, stopWords = DEFAULT_STOP_WORDS } = opts;
    const texts = answers
      .filter(a => a.questionId === questionId && a.textRaw)
      .map(a => String(a.textRaw));

    const tokenFreq = {};
    texts.forEach(text => {
      const tokens = tokenize(text);
      tokens.forEach(tok => {
        if (tok.length < minLen) return;
        if (stopWords.has(tok)) return;
        tokenFreq[tok] = (tokenFreq[tok] || 0) + 1;
      });
    });

    const sorted = Object.entries(tokenFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([word, count]) => ({ word, count }));

    return { items: sorted, totalTexts: texts.length };
  }

  /** 척도/숫자형 기술통계 */
  function analyzeNumeric(answers, questionId) {
    const values = answers
      .filter(a => a.questionId === questionId && a.value !== '')
      .map(a => parseFloat(a.value))
      .filter(v => !isNaN(v));

    if (values.length === 0) return null;

    const n    = values.length;
    const sum  = values.reduce((s, v) => s + v, 0);
    const mean = sum / n;
    const sorted = [...values].sort((a, b) => a - b);
    const median = n % 2 === 0
      ? (sorted[n/2-1] + sorted[n/2]) / 2
      : sorted[Math.floor(n/2)];
    const variance = values.reduce((s, v) => s + (v - mean)**2, 0) / n;
    const std  = Math.sqrt(variance);

    // 빈도 분포
    const freq = {};
    values.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
    const dist = Object.entries(freq)
      .sort((a, b) => +a[0] - +b[0])
      .map(([label, count]) => ({ label: +label, count, pct: +(count / n * 100).toFixed(1) }));

    return { n, mean: +mean.toFixed(2), median: +median.toFixed(2), std: +std.toFixed(2), min: sorted[0], max: sorted[n-1], dist };
  }

  /** 그리드 행별 평균 */
  function analyzeGrid(answers, questionId, rows, colScores) {
    const result = {};
    rows.forEach(row => {
      const rowAnswers = answers.filter(a => a.questionId === questionId && a.valueRow === row);
      const scores = rowAnswers.map(a => {
        const colIdx = colScores ? (colScores.indexOf ? colScores.indexOf(a.valueCol) : -1) : -1;
        return colIdx >= 0 ? colScores[colIdx] : parseFloat(a.valueCol) || 0;
      }).filter(s => !isNaN(s));
      const mean = scores.length ? scores.reduce((s, v) => s+v, 0) / scores.length : 0;

      // 열별 빈도
      const colFreq = {};
      rowAnswers.forEach(a => { colFreq[a.valueCol] = (colFreq[a.valueCol] || 0) + 1; });

      result[row] = {
        n: rowAnswers.length,
        mean: +mean.toFixed(2),
        colFreq,
        scores,
      };
    });
    return result;
  }

  /* ── 간이 형태소 토크나이저 (한국어 공백분리 + 어미 제거) ─── */
  function tokenize(text) {
    return String(text || '')
      .replace(/[^\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\u0041-\u007A\u0061-\u007A0-9\s]/g, ' ')
      .split(/\s+/)
      .map(t => t.replace(/(이다|이에요|합니다|해요|었어|이야|인데|에요|이요|고요|죠|요|을|를|이|가|은|는|의|도|와|과|에|서|로|으로|랑|이랑|하고|에서|에게|까지|부터|보다|처럼|만큼|같이|마다)$/, ''))
      .filter(t => t.length >= 2);
  }

  const DEFAULT_STOP_WORDS = new Set([
    '그리고','그런데','하지만','그래서','때문에','정말','매우','너무','조금','좀',
    '이것','저것','그것','여기','거기','저기','이거','저거','그거',
    '있다','없다','하다','되다','이다','같다','많다','크다','좋다',
    'the','and','or','of','in','to','a','is','for','that','this','with',
  ]);

  return { analyzeChoices, analyzeText, analyzeNumeric, analyzeGrid, tokenize };
})();

window.FrequencyAnalyzer = FrequencyAnalyzer;
