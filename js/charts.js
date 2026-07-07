/* ===================================================================
   js/charts.js — Chart.js 기반 차트 렌더링 공통 모듈
   =================================================================== */

const Charts = (() => {

  /* ── 공통 테마 ──────────────────────────────────────────────── */
  const THEME = {
    primary:  '#7C3AED',
    accent:   '#06B6D4',
    success:  '#10B981',
    warning:  '#F59E0B',
    danger:   '#EF4444',
    info:     '#3B82F6',
    text:     '#B8C0D4',
    grid:     'rgba(100,120,180,0.1)',
    bg:       'rgba(0,0,0,0)',
  };

  const PALETTE = [
    '#7C3AED','#06B6D4','#10B981','#F59E0B','#EF4444',
    '#3B82F6','#8B5CF6','#EC4899','#14B8A6','#F97316',
    '#6366F1','#84CC16','#22D3EE','#FB923C','#A855F7',
  ];

  const BASE_OPTIONS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { color: THEME.text, font: { family: "'Pretendard','Inter',sans-serif", size: 12 } },
      },
      tooltip: {
        backgroundColor: 'rgba(18,20,32,0.95)',
        titleColor: '#fff',
        bodyColor:  THEME.text,
        borderColor: 'rgba(124,58,237,0.3)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        ticks:  { color: THEME.text, font: { size: 11 } },
        grid:   { color: THEME.grid },
        border: { color: 'transparent' },
      },
      y: {
        ticks:  { color: THEME.text, font: { size: 11 } },
        grid:   { color: THEME.grid },
        border: { color: 'transparent' },
        beginAtZero: true,
      },
    },
  };

  function _checkChartLoaded(canvasId) {
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js is not loaded.');
      const canvas = document.getElementById(canvasId);
      if (canvas) {
        const parent = canvas.parentElement;
        if (parent) {
          parent.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--clr-text-muted);font-size:var(--text-sm);padding:1rem;text-align:center;border:1px solid var(--clr-border);border-radius:var(--radius-md)">📊 차트 라이브러리(Chart.js)를 로드할 수 없습니다.<br/>방화벽이나 인터넷 연결을 확인해 주세요.</div>`;
        }
      }
      return false;
    }
    return true;
  }

  /* ── 막대 차트 (빈도분석) ───────────────────────────────────── */
  function renderBar(canvasId, { labels, values, title = '', unit = '건' }) {
    if (!_checkChartLoaded(canvasId)) return null;
    _destroy(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;

    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: title,
          data:  values,
          backgroundColor: PALETTE.map(c => c + 'BB'),
          borderColor:     PALETTE,
          borderWidth:     2,
          borderRadius:    8,
          borderSkipped:   false,
        }],
      },
      options: {
        ...BASE_OPTIONS,
        plugins: {
          ...BASE_OPTIONS.plugins,
          legend: { display: false },
          tooltip: {
            ...BASE_OPTIONS.plugins.tooltip,
            callbacks: {
              label: ctx => ` ${ctx.parsed.y}${unit} (${values.length ? ((ctx.parsed.y / values.reduce((a,b)=>a+b,0))*100).toFixed(1) : 0}%)`,
            },
          },
        },
        animation: { duration: 600, easing: 'easeOutQuart' },
      },
    });
  }

  /* ── 도넛 차트 ──────────────────────────────────────────────── */
  function renderDoughnut(canvasId, { labels, values, title = '' }) {
    if (!_checkChartLoaded(canvasId)) return null;
    _destroy(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;

    return new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: PALETTE.map(c => c + 'CC'),
          borderColor:     PALETTE,
          borderWidth:     2,
          hoverOffset:     8,
        }],
      },
      options: {
        ...BASE_OPTIONS,
        scales: {},
        cutout: '62%',
        plugins: {
          ...BASE_OPTIONS.plugins,
          tooltip: {
            ...BASE_OPTIONS.plugins.tooltip,
            callbacks: {
              label: ctx => {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                return ` ${ctx.label}: ${ctx.parsed} (${total ? ((ctx.parsed/total)*100).toFixed(1):0}%)`;
              },
            },
          },
        },
        animation: { animateRotate: true, duration: 700 },
      },
    });
  }

  /* ── 파레토 차트 (막대 + 누적 라인) ────────────────────────── */
  function renderPareto(canvasId, { labels, values, title = '' }) {
    if (!_checkChartLoaded(canvasId)) return null;
    _destroy(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;

    const total   = values.reduce((s, v) => s + v, 0);
    let cumSum = 0;
    const cumPcts = values.map(v => { cumSum += v; return total ? +(cumSum/total*100).toFixed(1) : 0; });

    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: '빈도',
            data:  values,
            backgroundColor: PALETTE.map(c => c + 'BB'),
            borderColor:     PALETTE,
            borderWidth: 2, borderRadius: 6, yAxisID: 'y',
          },
          {
            type: 'line',
            label: '누적 %',
            data:  cumPcts,
            borderColor:     THEME.accent,
            backgroundColor: THEME.accent + '22',
            pointBackgroundColor: THEME.accent,
            pointRadius: 4, tension: 0.3, yAxisID: 'y2',
          },
        ],
      },
      options: {
        ...BASE_OPTIONS,
        scales: {
          ...BASE_OPTIONS.scales,
          y:  { ...BASE_OPTIONS.scales.y, position: 'left', title:{ display:true, text:'빈도', color:THEME.text } },
          y2: { position:'right', min:0, max:100, ticks:{ color:THEME.text, callback: v => v+'%' }, grid:{ display:false } },
        },
      },
    });
  }

  /* ── 라인 차트 (추이) ───────────────────────────────────────── */
  function renderLine(canvasId, { labels, datasets, title = '' }) {
    if (!_checkChartLoaded(canvasId)) return null;
    _destroy(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((ds, i) => ({
          label:               ds.label,
          data:                ds.data,
          borderColor:         PALETTE[i],
          backgroundColor:     PALETTE[i] + '22',
          pointBackgroundColor:PALETTE[i],
          fill:                true, tension: 0.4, pointRadius: 4,
        })),
      },
      options: {
        ...BASE_OPTIONS,
        plugins: { ...BASE_OPTIONS.plugins },
        animation: { duration: 600 },
      },
    });
  }

  /* ── 히트맵 (그리드 결과) ───────────────────────────────────── */
  function renderHeatmap(containerId, { rows, cols, matrix, maxVal }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const max = maxVal || Math.max(...matrix.flat(), 1);

    let html = `<div style="overflow-x:auto"><table style="border-collapse:collapse;width:100%;font-size:var(--text-xs)">`;
    html += `<thead><tr><th style="padding:var(--sp-2) var(--sp-3);text-align:left;color:var(--clr-text-muted)"></th>`;
    cols.forEach(col => {
      html += `<th style="padding:var(--sp-2) var(--sp-3);color:var(--clr-text-secondary);font-weight:600">${col}</th>`;
    });
    html += `</tr></thead><tbody>`;

    rows.forEach((row, ri) => {
      html += `<tr><td style="padding:var(--sp-2) var(--sp-3);font-weight:600;color:var(--clr-text-primary);white-space:nowrap">${row}</td>`;
      cols.forEach((_, ci) => {
        const val  = matrix[ri][ci];
        const heat = max > 0 ? val / max : 0;
        const bg   = _heatColor(heat);
        const text = heat > 0.5 ? '#fff' : 'var(--clr-text-primary)';
        html += `<td style="padding:var(--sp-2) var(--sp-3);text-align:center;background:${bg};color:${text};border-radius:4px;transition:all 0.2s;cursor:default" title="${row} × ${cols[ci]}: ${val}">${val}</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
  }

  /* ── 워드클라우드 데이터 → wordcloud2.js 형식 ───────────────── */
  function prepareWordCloud(freqItems, opts = {}) {
    const { maxSize = 60, minSize = 12 } = opts;
    if (!freqItems.length) return [];
    const maxCnt = freqItems[0].count;
    return freqItems.map(({ word, count }) => [
      word,
      Math.round(minSize + (count / maxCnt) * (maxSize - minSize)),
    ]);
  }

  /* ── 감성 도넛 ──────────────────────────────────────────────── */
  function renderSentimentDoughnut(canvasId, { positive, negative, neutral }) {
    return renderDoughnut(canvasId, {
      labels: ['긍정 😊', '부정 😢', '중립 😐'],
      values: [positive, negative, neutral],
    });
    // 색상 오버라이드는 데이터에서
  }

  /* ── 교차표 히트맵 ──────────────────────────────────────────── */
  function renderCrosstabHeatmap(containerId, crosstab) {
    renderHeatmap(containerId, {
      rows:   crosstab.rows,
      cols:   crosstab.cols,
      matrix: crosstab.matrix,
    });
  }

  /* ── 응답 추이 라인 ─────────────────────────────────────────── */
  function renderResponseTrend(canvasId, responses) {
    if (!responses.length) return;

    const byDay = {};
    responses.forEach(r => {
      const d = (r.submittedAt || '').split('T')[0];
      if (!d) return;
      byDay[d] = (byDay[d] || 0) + 1;
    });

    const sorted = Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b));

    return renderLine(canvasId, {
      labels:   sorted.map(([d]) => d),
      datasets: [{ label: '일별 응답 수', data: sorted.map(([,v]) => v) }],
    });
  }

  /* ── 내부 헬퍼 ──────────────────────────────────────────────── */
  const _instances = {};

  function _destroy(canvasId) {
    if (_instances[canvasId]) {
      _instances[canvasId].destroy();
      delete _instances[canvasId];
    }
  }

  function _heatColor(t) {
    // 파란색(0) → 보라색(0.5) → 빨간색(1)
    const r = Math.round(t < 0.5 ? 124 + (t*2)*100 : 224 - (t-0.5)*2*200);
    const g = Math.round(t < 0.5 ? 58  - (t*2)*40  : 18 );
    const b = Math.round(t < 0.5 ? 237 - (t*2)*180 : 57 );
    return `rgba(${r},${g},${b},${0.4 + t*0.5})`;
  }

  return {
    renderBar,
    renderDoughnut,
    renderPareto,
    renderLine,
    renderHeatmap,
    renderCrosstabHeatmap,
    renderSentimentDoughnut,
    renderResponseTrend,
    prepareWordCloud,
    PALETTE,
    THEME,
  };
})();

window.Charts = Charts;
