/* ===================================================================
   js/mining/sentiment.js — 감성분석 모듈 (규칙 기반 간이)
   =================================================================== */

const SentimentAnalyzer = (() => {

  /**
   * 텍스트 감성 분석
   * @param {Array}  answers
   * @param {string} questionId
   * @returns {{ items, positive, negative, neutral, avgScore }}
   */
  function analyze(answers, questionId) {
    const texts = answers
      .filter(a => a.questionId === questionId && a.textRaw)
      .map(a => ({ responseId: a.responseId, text: a.textRaw }));

    const items = texts.map(({ responseId, text }) => {
      const score = scoreText(text);
      const sentiment = score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral';
      return { responseId, text, score: +score.toFixed(3), sentiment };
    });

    const positive = items.filter(i => i.sentiment === 'positive').length;
    const negative = items.filter(i => i.sentiment === 'negative').length;
    const neutral  = items.filter(i => i.sentiment === 'neutral').length;
    const avgScore = items.length
      ? +(items.reduce((s, i) => s + i.score, 0) / items.length).toFixed(3)
      : 0;

    return { items, positive, negative, neutral, total: items.length, avgScore };
  }

  /**
   * 단일 텍스트 감성 점수 계산 (-1 ~ 1)
   */
  function scoreText(text) {
    const tokens = text.replace(/[^\uAC00-\uD7A3a-zA-Z\s]/g, ' ').split(/\s+/);
    let score = 0;
    let count = 0;
    let negator = false;

    tokens.forEach(tok => {
      const t = tok.replace(/(이다|합니다|해요|이에요)$/, '');

      if (NEGATORS.has(t)) { negator = true; return; }

      if (POSITIVE_WORDS[t] !== undefined) {
        score += negator ? -POSITIVE_WORDS[t] : POSITIVE_WORDS[t];
        count++;
        negator = false;
      } else if (NEGATIVE_WORDS[t] !== undefined) {
        score += negator ? -NEGATIVE_WORDS[t] : NEGATIVE_WORDS[t];
        count++;
        negator = false;
      } else {
        negator = false;
      }
    });

    return count > 0 ? Math.max(-1, Math.min(1, score / count)) : 0;
  }

  /**
   * 시간대별 감성 추이
   * @param {Array} answers — 각 answer에 submittedAt 포함 필요
   * @param {string} questionId
   * @param {'day'|'hour'} granularity
   */
  function timeSeries(answers, questionId, granularity = 'day') {
    const analyzed = analyze(answers, questionId);
    const byTime = {};

    // answers와 analyzed를 responseId로 조인
    analyzed.items.forEach(item => {
      const ans = answers.find(a => a.responseId === item.responseId);
      if (!ans?.submittedAt) return;
      const dt  = new Date(ans.submittedAt);
      const key = granularity === 'hour'
        ? `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:00`
        : `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;

      if (!byTime[key]) byTime[key] = { positive:0, negative:0, neutral:0, scores:[] };
      byTime[key][item.sentiment]++;
      byTime[key].scores.push(item.score);
    });

    return Object.entries(byTime)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        positive: d.positive, negative: d.negative, neutral: d.neutral,
        avgScore: d.scores.length ? +(d.scores.reduce((s,v)=>s+v,0)/d.scores.length).toFixed(3) : 0,
      }));
  }

  /* ── 감성 사전 (간이) ───────────────────────────────────────── */
  const POSITIVE_WORDS = {
    '좋다':1,'좋아':1,'좋은':1,'좋았':1,'훌륭':1,'만족':1,'감사':0.8,'행복':1,
    '즐거':1,'즐겁':1,'유익':0.8,'최고':1,'훌륭하':1,'뛰어':0.8,'우수':0.8,
    '편리':0.7,'편하':0.7,'친절':0.8,'열심':0.7,'노력':0.6,'개선':0.5,
    '발전':0.7,'성장':0.7,'활발':0.7,'다양':0.5,'풍부':0.7,'깨끗':0.7,
    '깔끔':0.7,'정성':0.6,'재미':0.9,'흥미':0.8,'신나':0.9,'뿌듯':0.9,
    'good':1,'great':1,'excellent':1,'wonderful':1,'nice':0.8,'happy':1,
    'love':1,'enjoy':0.9,'helpful':0.8,'useful':0.7,'satisfied':0.8,
  };

  const NEGATIVE_WORDS = {
    '나쁘':- 1,'나빠':-1,'나쁜':-1,'불만':-1,'불편':-0.8,'힘들':-0.7,
    '어렵':-0.6,'부족':-0.7,'아쉬':-0.6,'부실':-0.8,'불량':-0.9,
    '지루':-0.8,'지겨':-0.8,'싫':-1,'싫어':-1,'싫다':-1,'실망':-0.9,
    '문제':-0.5,'개선':'0','오래':-0.3,'낡':-0.6,'낡은':-0.6,
    '소음':-0.6,'더럽':-0.9,'지저분':-0.8,'답답':-0.8,'무관심':-0.7,
    'bad':-1,'poor':-0.9,'terrible':-1,'hate':-1,'awful':-1,
    'boring':-0.8,'disappointed':-0.9,'dirty':-0.9,'noisy':-0.6,
  };

  const NEGATORS = new Set(['안','못','별로','전혀','없','아니','않','no','not','never']);

  return { analyze, scoreText, timeSeries };
})();

window.SentimentAnalyzer = SentimentAnalyzer;
