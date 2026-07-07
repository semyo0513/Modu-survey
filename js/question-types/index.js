/* ===================================================================
   js/question-types/index.js — 12종 문항 통합 렌더러
   =================================================================== */

const QuestionRenderer = (() => {

  /* ─ 공통 유틸 ─────────────────────────────────────────────────── */
  function _makeId(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function _wrapCard(questionIndex, question, innerHtml) {
    const required = question.required ? '<span class="required-star" aria-hidden="true">*</span>' : '';
    return `
      <div class="question-card animate-slide-in" style="animation-delay:${questionIndex * 60}ms"
           data-question-id="${question.questionId}" role="group" aria-labelledby="qt-${question.questionId}">
        <div class="question-number">문항 ${questionIndex + 1}</div>
        <div class="question-title" id="qt-${question.questionId}">
          ${question.title}${required}
        </div>
        <div class="question-body">
          ${innerHtml}
        </div>
        <div class="question-error" id="qerr-${question.questionId}"
             style="display:none;color:var(--clr-danger);font-size:var(--text-xs);margin-top:var(--sp-2)"
             role="alert">
          ⚠️ 필수 항목입니다.
        </div>
      </div>`;
  }

  /* ─ 1. radio ─────────────────────────────────────────────────── */
  function renderRadio(question) {
    const opts = question.options || [];
    const items = opts.map((opt, i) => `
      <label class="option-card" for="r_${question.questionId}_${i}" id="rc_${question.questionId}_${i}">
        <input type="radio" id="r_${question.questionId}_${i}"
               name="q_${question.questionId}" value="${opt}"
               aria-labelledby="rc_${question.questionId}_${i}" />
        <div class="option-indicator" aria-hidden="true"></div>
        <span>${opt}</span>
      </label>`).join('');
    return `<div class="option-list" style="display:flex;flex-direction:column;gap:var(--sp-2)" role="radiogroup" aria-label="${question.title}">${items}</div>`;
  }

  /* ─ 2. checkbox ──────────────────────────────────────────────── */
  function renderCheckbox(question) {
    const opts = question.options || [];
    const items = opts.map((opt, i) => `
      <label class="option-card option-check" for="c_${question.questionId}_${i}" id="cc_${question.questionId}_${i}">
        <input type="checkbox" id="c_${question.questionId}_${i}"
               name="q_${question.questionId}" value="${opt}"
               aria-labelledby="cc_${question.questionId}_${i}" />
        <div class="option-indicator" aria-hidden="true"></div>
        <span>${opt}</span>
      </label>`).join('');
    return `<div class="option-list" style="display:flex;flex-direction:column;gap:var(--sp-2)">${items}</div>`;
  }

  /* ─ 3. dropdown ──────────────────────────────────────────────── */
  function renderDropdown(question) {
    const opts = question.options || [];
    const optHtml = opts.map(opt => `<option value="${opt}">${opt}</option>`).join('');
    return `
      <select class="form-select" name="q_${question.questionId}" id="q_${question.questionId}"
              aria-label="${question.title}">
        <option value="">-- 선택해 주세요 --</option>
        ${optHtml}
      </select>`;
  }

  /* ─ 4. text ──────────────────────────────────────────────────── */
  function renderText(question) {
    const validation = question.validation || {};
    return `
      <input type="text" class="form-input" name="q_${question.questionId}"
             id="q_${question.questionId}" placeholder="${validation.placeholder || '답변을 입력하세요'}"
             ${validation.maxLength ? `maxlength="${validation.maxLength}"` : ''}
             aria-label="${question.title}" />`;
  }

  /* ─ 5. textarea ──────────────────────────────────────────────── */
  function renderTextarea(question) {
    const validation = question.validation || {};
    return `
      <textarea class="form-textarea" name="q_${question.questionId}"
                id="q_${question.questionId}" placeholder="${validation.placeholder || '자세히 작성해 주세요'}"
                rows="5"
                ${validation.maxLength ? `maxlength="${validation.maxLength}"` : ''}
                aria-label="${question.title}"></textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:var(--sp-1)">
        <span id="char-count-${question.questionId}" style="font-size:var(--text-xs);color:var(--clr-text-muted)">0자</span>
      </div>`;
  }

  /* ─ 6 & 7. grid_radio / grid_checkbox ──────────────────────── */
  function renderGrid(question, isCheckbox = false) {
    let grid;
    try { grid = typeof question.grid === 'string' ? JSON.parse(question.grid) : question.grid; }
    catch { grid = { rows: [], cols: [] }; }
    const { rows = [], cols = [] } = grid;
    const inputType = isCheckbox ? 'checkbox' : 'radio';

    // 데스크톱: 테이블
    const headerCols = cols.map(c => `<th scope="col">${c}</th>`).join('');
    const tableRows  = rows.map(row => {
      const cells = cols.map((col, ci) => {
        const inputId = `g_${question.questionId}_${row}_${ci}`;
        return `<td>
          <input class="grid-${inputType}" type="${inputType}"
                 id="${inputId}" name="g_${question.questionId}_${row}"
                 value="${col}" aria-label="${row} - ${col}" />
        </td>`;
      }).join('');
      return `<tr><td style="text-align:left;font-weight:500">${row}</td>${cells}</tr>`;
    }).join('');

    const desktopTable = `
      <div style="overflow-x:auto">
        <table class="grid-table" aria-label="${question.title}">
          <thead><tr><th></th>${headerCols}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;

    // 모바일: 카드형
    const mobileCards = rows.map(row => {
      const btns = cols.map((col, ci) => {
        const inputId = `gm_${question.questionId}_${row}_${ci}`;
        return `
          <label class="option-card ${isCheckbox ? 'option-check' : ''}" for="${inputId}" style="flex:1;min-width:80px;justify-content:center;padding:var(--sp-3)">
            <input type="${inputType}" id="${inputId}" name="gm_${question.questionId}_${row}" value="${col}" />
            <div class="option-indicator" aria-hidden="true"></div>
            <span style="font-size:var(--text-xs)">${col}</span>
          </label>`;
      }).join('');
      return `
        <div style="margin-bottom:var(--sp-4)">
          <div style="font-size:var(--text-sm);font-weight:600;margin-bottom:var(--sp-2);color:var(--clr-text-secondary)">${row}</div>
          <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2)">${btns}</div>
        </div>`;
    }).join('');

    return `${desktopTable}<div class="grid-card-list">${mobileCards}</div>`;
  }

  /* ─ 8. scale ─────────────────────────────────────────────────── */
  function renderScale(question) {
    const validation = question.validation || {};
    const min = validation.min || 1;
    const max = validation.max || 5;
    const minLabel = validation.minLabel || '';
    const maxLabel = validation.maxLabel || '';

    let buttons = '';
    for (let i = min; i <= max; i++) {
      buttons += `
        <button type="button" class="scale-btn" data-qid="${question.questionId}" data-val="${i}"
                aria-label="${i}점" aria-pressed="false">${i}</button>`;
    }

    return `
      <div>
        <div class="scale-track" role="group" aria-label="${question.title} 척도 선택">${buttons}</div>
        <input type="hidden" name="q_${question.questionId}" id="q_${question.questionId}" />
        ${(minLabel || maxLabel) ? `
          <div style="display:flex;justify-content:space-between;margin-top:var(--sp-2)">
            <span style="font-size:var(--text-xs);color:var(--clr-text-muted)">${minLabel}</span>
            <span style="font-size:var(--text-xs);color:var(--clr-text-muted)">${maxLabel}</span>
          </div>` : ''}
      </div>`;
  }

  /* ─ 9. rating ────────────────────────────────────────────────── */
  function renderRating(question) {
    const validation = question.validation || {};
    const max   = validation.max || 5;
    const emoji = validation.emoji || false;
    const symbols = emoji
      ? ['😡','😞','😐','😊','😍'].slice(0, max)
      : Array.from({ length: max }, () => '⭐');

    const stars = symbols.map((sym, i) => `
      <button type="button" class="star-btn" data-qid="${question.questionId}" data-val="${i + 1}"
              aria-label="${i + 1}점" aria-pressed="false">${sym}</button>`).join('');

    return `
      <div>
        <div class="rating-stars" role="group" aria-label="${question.title} 별점">${stars}</div>
        <input type="hidden" name="q_${question.questionId}" id="q_${question.questionId}" />
        <div id="rating-label-${question.questionId}" style="margin-top:var(--sp-2);font-size:var(--text-sm);color:var(--clr-text-muted);min-height:20px"></div>
      </div>`;
  }

  /* ─ 10. rank ─────────────────────────────────────────────────── */
  function renderRank(question) {
    const opts = question.options || [];
    const items = opts.map((opt, i) => `
      <div class="rank-item" draggable="true" data-val="${opt}"
           id="rank_${question.questionId}_${i}" aria-label="${opt}" role="listitem">
        <div class="rank-num" aria-hidden="true">${i + 1}</div>
        <span class="drag-handle" aria-hidden="true">⠿</span>
        <span style="flex:1">${opt}</span>
      </div>`).join('');

    return `
      <div>
        <div class="rank-list" id="ranklist_${question.questionId}" role="list"
             aria-label="${question.title} 순위 목록">${items}</div>
        <input type="hidden" name="q_${question.questionId}" id="q_${question.questionId}" />
        <p style="font-size:var(--text-xs);color:var(--clr-text-muted);margin-top:var(--sp-2)">
          💡 드래그하여 순위를 조정하세요
        </p>
      </div>`;
  }

  /* ─ 11. signature ────────────────────────────────────────────── */
  function renderSignature(question) {
    const canvasId = `sig_canvas_${question.questionId}`;
    return `
      <div>
        <div class="signature-wrap" id="sigwrap_${question.questionId}">
          <canvas id="${canvasId}" class="signature-canvas" width="600" height="200"
                  role="img" aria-label="서명 영역"></canvas>
          <div class="signature-hint" id="sighint_${question.questionId}" aria-hidden="true">
            <span style="font-size:2rem">✍️</span>
            <span style="font-size:var(--text-sm);color:var(--clr-text-muted)">여기에 서명하세요</span>
          </div>
          <div class="signature-toolbar">
            <span style="font-size:var(--text-xs);color:var(--clr-text-muted)">터치 또는 마우스로 서명</span>
            <button type="button" class="btn btn-ghost btn-sm" id="sigclear_${question.questionId}"
                    aria-label="서명 지우기">🗑️ 지우기</button>
          </div>
        </div>
        <input type="hidden" name="q_${question.questionId}" id="q_${question.questionId}" />
      </div>`;
  }

  /* ─ 12. date ─────────────────────────────────────────────────── */
  function renderDate(question) {
    const validation = question.validation || {};
    const type = validation.includeTime ? 'datetime-local' : 'date';
    return `
      <input type="${type}" class="form-input" name="q_${question.questionId}"
             id="q_${question.questionId}"
             ${validation.min ? `min="${validation.min}"` : ''}
             ${validation.max ? `max="${validation.max}"` : ''}
             aria-label="${question.title}" />`;
  }

  /* ─ 통합 렌더 함수 ────────────────────────────────────────────── */
  function render(question, index) {
    let inner = '';
    let options = [];
    try { options = question.options || []; } catch {}

    switch (question.type) {
      case 'radio':         inner = renderRadio(question); break;
      case 'checkbox':      inner = renderCheckbox(question); break;
      case 'dropdown':      inner = renderDropdown(question); break;
      case 'text':          inner = renderText(question); break;
      case 'textarea':      inner = renderTextarea(question); break;
      case 'grid_radio':    inner = renderGrid(question, false); break;
      case 'grid_checkbox': inner = renderGrid(question, true); break;
      case 'scale':         inner = renderScale(question); break;
      case 'rating':        inner = renderRating(question); break;
      case 'rank':          inner = renderRank(question); break;
      case 'signature':     inner = renderSignature(question); break;
      case 'date':          inner = renderDate(question); break;
      default:              inner = renderText(question);
    }

    return _wrapCard(index, question, inner);
  }

  /* ─ 바인딩 (렌더 후 이벤트 연결) ─────────────────────────────── */
  function bindEvents(container) {
    // Option cards (radio/checkbox) 시각적 선택
    container.querySelectorAll('.option-card').forEach(card => {
      const input = card.querySelector('input');
      if (!input) return;
      card.addEventListener('click', () => {
        const name = input.name;
        const isRadio = input.type === 'radio';

        if (isRadio) {
          container.querySelectorAll(`[name="${name}"]`).forEach(el => {
            el.closest('.option-card')?.classList.remove('selected');
          });
        }
        card.classList.toggle('selected', input.type === 'checkbox' ? input.checked : true);
      });
      // 초기 상태
      input.addEventListener('change', () => {
        if (input.type === 'checkbox') {
          card.classList.toggle('selected', input.checked);
        }
      });
    });

    // Textarea 글자 수 카운터
    container.querySelectorAll('textarea').forEach(ta => {
      const qid = ta.name.replace('q_', '');
      const counter = document.getElementById(`char-count-${qid}`);
      if (!counter) return;
      ta.addEventListener('input', () => {
        counter.textContent = `${ta.value.length}자`;
      });
    });

    // Scale 버튼
    container.querySelectorAll('.scale-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const qid = btn.dataset.qid;
        const val = btn.dataset.val;
        container.querySelectorAll(`.scale-btn[data-qid="${qid}"]`).forEach(b => {
          b.classList.remove('selected');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('selected');
        btn.setAttribute('aria-pressed', 'true');
        const hidden = document.getElementById(`q_${qid}`);
        if (hidden) hidden.value = val;
      });
    });

    // Rating stars
    container.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const qid = btn.dataset.qid;
        const val = parseInt(btn.dataset.val, 10);
        const stars = container.querySelectorAll(`.star-btn[data-qid="${qid}"]`);
        stars.forEach((s, i) => {
          s.classList.toggle('active', i < val);
          s.setAttribute('aria-pressed', i < val ? 'true' : 'false');
        });
        const hidden = document.getElementById(`q_${qid}`);
        if (hidden) hidden.value = val;
        const label = document.getElementById(`rating-label-${qid}`);
        if (label) label.textContent = `${val}점 선택됨`;
      });
      btn.addEventListener('mouseenter', () => {
        const qid = btn.dataset.qid;
        const val = parseInt(btn.dataset.val, 10);
        container.querySelectorAll(`.star-btn[data-qid="${qid}"]`).forEach((s, i) => {
          s.style.filter = i < val ? 'none' : 'grayscale(1) opacity(0.3)';
        });
      });
      btn.addEventListener('mouseleave', () => {
        const qid = btn.dataset.qid;
        const currentVal = parseInt(document.getElementById(`q_${qid}`)?.value || '0', 10);
        container.querySelectorAll(`.star-btn[data-qid="${qid}"]`).forEach((s, i) => {
          s.style.filter = i < currentVal ? 'none' : 'grayscale(1) opacity(0.4)';
        });
      });
    });

    // Rank drag-and-drop
    container.querySelectorAll('.rank-list').forEach(list => {
      let dragSrc = null;
      list.querySelectorAll('.rank-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
          dragSrc = item;
          item.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('dragend', () => {
          item.classList.remove('dragging');
          _updateRankNumbers(list);
          _updateRankHidden(list);
        });
        item.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (dragSrc && dragSrc !== item) {
            const rect = item.getBoundingClientRect();
            const before = e.clientY < rect.top + rect.height / 2;
            list.insertBefore(dragSrc, before ? item : item.nextSibling);
          }
        });
        // Touch support
        _addTouchDrag(item, list);
      });
    });

    // Signature pads
    container.querySelectorAll('.signature-canvas').forEach(canvas => {
      _initSignaturePad(canvas, container);
    });
  }

  function _updateRankNumbers(list) {
    list.querySelectorAll('.rank-item').forEach((item, i) => {
      const numEl = item.querySelector('.rank-num');
      if (numEl) numEl.textContent = i + 1;
    });
  }

  function _updateRankHidden(list) {
    const qid = list.id.replace('ranklist_', '');
    const hidden = document.getElementById(`q_${qid}`);
    if (!hidden) return;
    const order = [...list.querySelectorAll('.rank-item')].map(el => el.dataset.val);
    hidden.value = JSON.stringify(order);
  }

  function _addTouchDrag(item, list) {
    let startY = 0, origEl = null;
    item.addEventListener('touchstart', (e) => {
      startY = e.touches[0].clientY;
      origEl = item;
    }, { passive: true });
    item.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const y = e.touches[0].clientY;
      const sibs = [...list.querySelectorAll('.rank-item')];
      sibs.forEach(sib => {
        const rect = sib.getBoundingClientRect();
        if (sib !== origEl && y > rect.top && y < rect.bottom) {
          const before = y < rect.top + rect.height / 2;
          list.insertBefore(origEl, before ? sib : sib.nextSibling);
        }
      });
    }, { passive: false });
    item.addEventListener('touchend', () => {
      _updateRankNumbers(list);
      _updateRankHidden(list);
    });
  }

  function _initSignaturePad(canvas, container) {
    const qid = canvas.id.replace('sig_canvas_', '');
    const hint = document.getElementById(`sighint_${qid}`);
    const hidden = document.getElementById(`q_${qid}`);
    const clearBtn = document.getElementById(`sigclear_${qid}`);
    const ctx = canvas.getContext('2d');

    // 캔버스 크기를 실제 표시 크기에 맞춤
    function resize() {
      const w = canvas.offsetWidth;
      canvas.width  = w;
      canvas.height = Math.min(200, w * 0.35);
    }
    resize();
    window.addEventListener('resize', resize);

    let drawing = false;
    let hasDrawn = false;

    ctx.strokeStyle = '#e0e0ff';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const src  = e.touches ? e.touches[0] : e;
      return {
        x: (src.clientX - rect.left) * (canvas.width / rect.width),
        y: (src.clientY - rect.top)  * (canvas.height / rect.height),
      };
    }

    function startDraw(e) {
      e.preventDefault();
      drawing = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      if (!hasDrawn) {
        hasDrawn = true;
        if (hint) hint.style.display = 'none';
      }
    }

    function draw(e) {
      if (!drawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }

    function endDraw(e) {
      if (!drawing) return;
      drawing = false;
      if (hidden) hidden.value = canvas.toDataURL('image/png');
    }

    canvas.addEventListener('mousedown',  startDraw);
    canvas.addEventListener('mousemove',  draw);
    canvas.addEventListener('mouseup',    endDraw);
    canvas.addEventListener('mouseleave', endDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove',  draw,      { passive: false });
    canvas.addEventListener('touchend',   endDraw);

    clearBtn?.addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (hidden) hidden.value = '';
      if (hint) hint.style.display = '';
      hasDrawn = false;
    });
  }

  /* ─ 유효성 검사 ───────────────────────────────────────────────── */
  function validate(question) {
    if (!question.required) return true;
    const qid = question.questionId;
    let valid = false;

    switch (question.type) {
      case 'radio':
        valid = !!document.querySelector(`[name="q_${qid}"]:checked`);
        break;
      case 'checkbox':
        valid = !!document.querySelector(`[name="q_${qid}"]:checked`);
        break;
      case 'dropdown':
      case 'text':
      case 'scale':
      case 'rating':
      case 'date':
        valid = !!document.getElementById(`q_${qid}`)?.value?.trim();
        break;
      case 'textarea':
        valid = !!document.getElementById(`q_${qid}`)?.value?.trim();
        break;
      case 'grid_radio': {
        let grid;
        try { grid = typeof question.grid === 'string' ? JSON.parse(question.grid) : question.grid; }
        catch { grid = { rows: [] }; }
        valid = (grid.rows || []).every(row =>
          !!document.querySelector(`[name="g_${qid}_${row}"]:checked`) ||
          !!document.querySelector(`[name="gm_${qid}_${row}"]:checked`)
        );
        break;
      }
      case 'grid_checkbox': {
        let grid2;
        try { grid2 = typeof question.grid === 'string' ? JSON.parse(question.grid) : question.grid; }
        catch { grid2 = { rows: [] }; }
        valid = (grid2.rows || []).some(row =>
          !!document.querySelector(`[name="g_${qid}_${row}"]:checked`) ||
          !!document.querySelector(`[name="gm_${qid}_${row}"]:checked`)
        );
        break;
      }
      case 'rank':
        valid = !!document.getElementById(`q_${qid}`)?.value;
        break;
      case 'signature':
        valid = !!document.getElementById(`q_${qid}`)?.value;
        break;
      default:
        valid = true;
    }

    const errEl = document.getElementById(`qerr-${qid}`);
    if (errEl) errEl.style.display = valid ? 'none' : 'block';
    return valid;
  }

  /* ─ 값 수집 ───────────────────────────────────────────────────── */
  function collect(question) {
    const qid = question.questionId;
    const answers = [];

    switch (question.type) {
      case 'radio':
      case 'dropdown': {
        const el = document.querySelector(`[name="q_${qid}"]:checked`) || document.getElementById(`q_${qid}`);
        const val = el?.value || '';
        if (val) answers.push({ questionId: qid, questionType: question.type, value: val });
        break;
      }
      case 'checkbox': {
        document.querySelectorAll(`[name="q_${qid}"]:checked`).forEach(el => {
          answers.push({ questionId: qid, questionType: 'checkbox', value: el.value });
        });
        break;
      }
      case 'text':
      case 'textarea':
      case 'date': {
        const val = document.getElementById(`q_${qid}`)?.value || '';
        if (val) answers.push({ questionId: qid, questionType: question.type, textRaw: val, value: val });
        break;
      }
      case 'scale':
      case 'rating': {
        const val = document.getElementById(`q_${qid}`)?.value || '';
        if (val) answers.push({ questionId: qid, questionType: question.type, value: val });
        break;
      }
      case 'grid_radio':
      case 'grid_checkbox': {
        let grid;
        try { grid = typeof question.grid === 'string' ? JSON.parse(question.grid) : question.grid; }
        catch { grid = { rows: [], cols: [] }; }
        (grid.rows || []).forEach(row => {
          const selectors = [
            `[name="g_${qid}_${row}"]:checked`,
            `[name="gm_${qid}_${row}"]:checked`,
          ];
          selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
              answers.push({
                questionId: qid, questionType: question.type,
                valueRow: row, valueCol: el.value,
              });
            });
          });
        });
        break;
      }
      case 'rank': {
        const val = document.getElementById(`q_${qid}`)?.value;
        if (val) {
          try {
            JSON.parse(val).forEach((item, i) => {
              answers.push({ questionId: qid, questionType: 'rank', value: i + 1, textRaw: item });
            });
          } catch {}
        }
        break;
      }
      case 'signature': {
        const val = document.getElementById(`q_${qid}`)?.value;
        if (val) answers.push({ questionId: qid, questionType: 'signature', value: val });
        break;
      }
    }

    return answers;
  }

  /* ─ 순위 초기화 (랭크 hidden 초기값 설정) ─────────────────────── */
  function initRankDefaults(container) {
    container.querySelectorAll('.rank-list').forEach(list => {
      _updateRankHidden(list);
    });
  }

  return { render, bindEvents, validate, collect, initRankDefaults };
})();

window.QuestionRenderer = QuestionRenderer;
