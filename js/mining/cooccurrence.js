/* ===================================================================
   js/mining/cooccurrence.js — 연관어분석 모듈 (동시출현 + PMI)
   =================================================================== */

const CooccurrenceAnalyzer = (() => {

  /**
   * 서술형 텍스트에서 동시출현 행렬 계산
   * @param {Array} answers
   * @param {string} questionId
   * @param {Object} opts
   */
  function analyze(answers, questionId, opts = {}) {
    const {
      topN       = 40,
      minCount   = 2,
      windowSize = 5,    // 공동 출현 윈도우 크기
      stopWords  = DEFAULT_STOP_WORDS,
      minWordLen = 2,
    } = opts;

    const texts = answers
      .filter(a => a.questionId === questionId && a.textRaw)
      .map(a => a.textRaw);

    if (texts.length === 0) return { nodes: [], edges: [], vocab: {} };

    // 1. 전체 단어 빈도 (어휘 사전)
    const termFreq = {};
    const docTerms = [];

    texts.forEach(text => {
      const tokens = _tokenize(text)
        .filter(t => t.length >= minWordLen && !stopWords.has(t));
      docTerms.push(tokens);
      tokens.forEach(t => { termFreq[t] = (termFreq[t] || 0) + 1; });
    });

    // 상위 N 단어만 사용
    const topWords = Object.entries(termFreq)
      .filter(([, cnt]) => cnt >= minCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([w]) => w);

    const wordSet = new Set(topWords);

    // 2. 동시출현 행렬 (sliding window)
    const cooc = {};

    docTerms.forEach(tokens => {
      const filtered = tokens.filter(t => wordSet.has(t));
      for (let i = 0; i < filtered.length; i++) {
        for (let j = i + 1; j < Math.min(i + windowSize, filtered.length); j++) {
          if (filtered[i] === filtered[j]) continue;
          const key = [filtered[i], filtered[j]].sort().join('|||');
          cooc[key] = (cooc[key] || 0) + 1;
        }
      }
    });

    // 3. PMI(Pointwise Mutual Information) 계산
    const N = texts.length;
    const edges = Object.entries(cooc)
      .map(([key, cnt]) => {
        const [w1, w2] = key.split('|||');
        const p_w1 = termFreq[w1] / N;
        const p_w2 = termFreq[w2] / N;
        const p_joint = cnt / N;
        const pmi = p_joint > 0 ? Math.log2(p_joint / (p_w1 * p_w2)) : 0;
        return { source: w1, target: w2, count: cnt, pmi: +pmi.toFixed(3) };
      })
      .filter(e => e.count >= minCount)
      .sort((a, b) => b.pmi - a.pmi);

    // 4. 노드 (엣지에 포함된 단어만)
    const nodeSet = new Set();
    edges.forEach(e => { nodeSet.add(e.source); nodeSet.add(e.target); });

    const nodes = [...nodeSet].map(word => ({
      id:    word,
      label: word,
      value: termFreq[word] || 1,   // 크기 비례
      freq:  termFreq[word] || 0,
    }));

    return { nodes, edges, vocab: termFreq };
  }

  /**
   * vis-network 형식으로 변환
   */
  function toVisNetwork(analysisResult, opts = {}) {
    const { maxEdges = 60, colorPrimary = '#7C3AED', colorAccent = '#06B6D4' } = opts;
    const { nodes, edges } = analysisResult;

    const maxFreq = Math.max(...nodes.map(n => n.freq), 1);

    const visNodes = nodes.map(n => ({
      id:    n.id,
      label: n.label,
      title: `${n.label}\n출현 ${n.freq}회`,
      value: n.freq,
      color: {
        background: _interpolateColor(colorAccent, colorPrimary, n.freq / maxFreq),
        border:     colorPrimary,
        highlight:  { background: colorPrimary, border: '#fff' },
      },
      font:  { color: '#fff', size: 13 + Math.floor(n.freq / maxFreq * 8) },
    }));

    const maxPmi = Math.max(...edges.map(e => e.pmi), 1);

    const visEdges = edges.slice(0, maxEdges).map((e, i) => ({
      id:     i,
      from:   e.source,
      to:     e.target,
      title:  `PMI: ${e.pmi}, 동시출현: ${e.count}`,
      width:  1 + Math.min(5, e.count),
      color:  { color: `hsla(248,90%,66%,${0.2 + (e.pmi / maxPmi) * 0.6})`, highlight: colorPrimary },
    }));

    return { visNodes, visEdges };
  }

  /* ── 내부 헬퍼 ────────────────────────────────────────────── */
  function _tokenize(text) {
    return text
      .replace(/[^\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318Fa-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .map(t => t.replace(/(이다|이에요|합니다|해요|었어|이야|인데|에요|이요|고요|죠|요|을|를|이|가|은|는|의|도|와|과|에|서|로|으로|랑|이랑|하고|에서|에게|까지|부터|보다|처럼|만큼|같이|마다)$/, ''))
      .filter(t => t.length >= 2);
  }

  function _interpolateColor(c1, c2, t) {
    const parse = hex => [
      parseInt(hex.slice(1,3),16),
      parseInt(hex.slice(3,5),16),
      parseInt(hex.slice(5,7),16),
    ];
    const [r1,g1,b1] = parse(c1);
    const [r2,g2,b2] = parse(c2);
    const r = Math.round(r1 + (r2-r1)*t);
    const g = Math.round(g1 + (g2-g1)*t);
    const b = Math.round(b1 + (b2-b1)*t);
    return `rgb(${r},${g},${b})`;
  }

  const DEFAULT_STOP_WORDS = new Set([
    '그리고','그런데','하지만','그래서','때문에','정말','매우','너무','조금','좀',
    '이것','저것','그것','여기','거기','저기','이거','저거','그거',
    '있다','없다','하다','되다','이다','같다','많다','크다','좋다','있어','없어',
    '생각','것이','것은','것을','것도','수가','수는','수를','수도',
    'the','and','or','of','in','to','a','is','for','that','this','with',
  ]);

  return { analyze, toVisNetwork };
})();

window.CooccurrenceAnalyzer = CooccurrenceAnalyzer;
