// ===================================================================
// gas/SurveyService.gs — 설문 CRUD + 문항 관리
// ===================================================================

/* ── 학교 목록 ─────────────────────────────────────────────────── */
function listSchoolsHandler_() {
  const schools = sheetToObjects_('Schools');
  return { data: schools };
}

function addSchoolHandler_(payload, userId) {
  const { schoolName, region } = payload;
  if (!schoolName) return { error: '학교명을 입력해 주세요.' };

  const existing = sheetToObjects_('Schools');
  if (existing.some(s => s.schoolName === schoolName)) {
    return { error: '이미 등록된 학교입니다.' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    appendRow_('Schools', [generateId_('SCH'), schoolName, region || '', now_()]);
  } finally {
    lock.releaseLock();
  }
  return { success: true };
}

/* ── 설문 목록 (응답자용: 특정 학교의 open 설문) ────────────────── */
function listSurveysBySchoolHandler_(payload) {
  const { schoolName } = payload;
  if (!schoolName) return { error: '학교명이 없습니다.' };

  const surveys   = sheetToObjects_('Surveys');
  const questions = sheetToObjects_('Questions');
  const now       = new Date();

  const filtered = surveys
    .filter(sv =>
      sv.schoolName === schoolName &&
      sv.status     === 'open'    &&
      (!sv.endAt || new Date(sv.endAt) >= now)
    )
    .map(sv => ({
      ...sv,
      questionCount: questions.filter(q => q.surveyId === sv.surveyId).length,
    }));

  return { data: filtered };
}

/* ── 내 설문 목록 (제작자용) ────────────────────────────────────── */
function listMySurveysHandler_(userId) {
  const surveys   = sheetToObjects_('Surveys');
  const questions = sheetToObjects_('Questions');
  const responses = sheetToObjects_('Responses');

  const mine = surveys
    .filter(sv => sv.ownerId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(sv => ({
      ...sv,
      questionCount: questions.filter(q => q.surveyId === sv.surveyId).length,
      responseCount: responses.filter(r => r.surveyId === sv.surveyId).length,
    }));

  return { data: mine };
}

/* ── 설문 생성 ──────────────────────────────────────────────────── */
function createSurveyHandler_(payload, userId) {
  const { title, description, schoolName, startAt, endAt, themeColor, allowMultiple } = payload;
  if (!title) return { error: '제목을 입력해 주세요.' };

  const surveyId = generateId_('SRV');
  const ts       = now_();

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    appendRow_('Surveys', [
      surveyId, userId, schoolName || '', title,
      description || '', 'draft',
      startAt || '', endAt || '',
      allowMultiple !== false ? 'true' : 'false',
      themeColor || '#7C3AED',
      ts, ts,
    ]);
  } finally {
    lock.releaseLock();
  }

  return { success: true, surveyId };
}

/* ── 설문 수정 ──────────────────────────────────────────────────── */
function updateSurveyHandler_(payload, userId) {
  const { surveyId, title, description, startAt, endAt, themeColor } = payload;

  const sheet  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Surveys');
  const data   = sheet.getDataRange().getValues();
  const headers= data[0];

  const svIdx  = headers.indexOf('surveyId');
  const ownIdx = headers.indexOf('ownerId');

  for (let i = 1; i < data.length; i++) {
    if (data[i][svIdx] === surveyId && data[i][ownIdx] === userId) {
      const updates = {
        title, description, startAt, endAt, themeColor,
        updatedAt: now_(),
      };
      Object.entries(updates).forEach(([key, val]) => {
        if (val !== undefined) {
          const colIdx = headers.indexOf(key);
          if (colIdx >= 0) sheet.getRange(i + 1, colIdx + 1).setValue(val);
        }
      });
      return { success: true };
    }
  }
  return { error: '설문을 찾을 수 없거나 권한이 없습니다.' };
}

/* ── 설문 상태 변경 (draft→open→closed) ─────────────────────────── */
function setSurveyStatusHandler_(payload, userId) {
  const { surveyId, status } = payload;
  if (!['draft','open','closed'].includes(status)) return { error: '올바르지 않은 상태입니다.' };

  const sheet  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Surveys');
  const data   = sheet.getDataRange().getValues();
  const headers= data[0];
  const svIdx  = headers.indexOf('surveyId');
  const ownIdx = headers.indexOf('ownerId');
  const stIdx  = headers.indexOf('status');
  const upIdx  = headers.indexOf('updatedAt');

  for (let i = 1; i < data.length; i++) {
    if (data[i][svIdx] === surveyId && data[i][ownIdx] === userId) {
      sheet.getRange(i + 1, stIdx + 1).setValue(status);
      sheet.getRange(i + 1, upIdx + 1).setValue(now_());
      return { success: true };
    }
  }
  return { error: '설문을 찾을 수 없거나 권한이 없습니다.' };
}

/* ── 응답용 설문 조회 (open 상태만) ─────────────────────────────── */
function getSurveyHandler_(payload) {
  const { surveyId } = payload;

  const surveys   = sheetToObjects_('Surveys');
  const survey    = surveys.find(sv => sv.surveyId === surveyId);

  if (!survey) return { error: '설문을 찾을 수 없습니다.' };
  if (survey.status !== 'open') return { error: '현재 응답할 수 없는 설문입니다.' };

  const questions = sheetToObjects_('Questions')
    .filter(q => q.surveyId === surveyId)
    .sort((a, b) => parseInt(a.order) - parseInt(b.order))
    .map(q => ({
      ...q,
      required: q.required === 'true' || q.required === true,
      options:  q.optionsJson  ? JSON.parse(q.optionsJson)  : [],
      grid:     q.gridJson     ? JSON.parse(q.gridJson)     : null,
      validation: q.validationJson ? JSON.parse(q.validationJson) : null,
    }));

  return { survey, questions };
}

/* ── 문항 일괄 저장 ──────────────────────────────────────────────── */
function bulkSaveQuestionsHandler_(payload, userId) {
  const { surveyId, questions } = payload;
  if (!surveyId || !Array.isArray(questions)) return { error: '잘못된 요청입니다.' };

  // 소유권 확인
  const surveys = sheetToObjects_('Surveys');
  const survey  = surveys.find(sv => sv.surveyId === surveyId && sv.ownerId === userId);
  if (!survey) return { error: '권한이 없습니다.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Questions');
    const data   = sheet.getDataRange().getValues();

    // 기존 문항 삭제 (surveyId 일치)
    const headers = data[0];
    const svIdx   = headers.indexOf('surveyId');
    const toDelete= [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][svIdx] === surveyId) toDelete.push(i + 1);
    }
    // 역순 삭제
    toDelete.reverse().forEach(rowNum => sheet.deleteRow(rowNum));

    // 새 문항 삽입
    questions.forEach(q => {
      appendRow_('Questions', [
        q.questionId || generateId_('QST'),
        surveyId,
        q.order || 1,
        q.type  || 'text',
        q.title || '',
        q.required ? 'true' : 'false',
        q.options    ? JSON.stringify(q.options)    : '',
        q.grid       ? JSON.stringify(q.grid)       : '',
        q.validation ? JSON.stringify(q.validation) : '',
      ]);
    });
  } finally {
    lock.releaseLock();
  }

  return { success: true, count: questions.length };
}

/* ── 결과 조회 (소유자 전용) ──────────────────────────────────────── */
function getResultsHandler_(payload, userId) {
  const { surveyId } = payload;

  const surveys = sheetToObjects_('Surveys');
  const survey  = surveys.find(sv => sv.surveyId === surveyId);

  if (!survey) return { error: '설문을 찾을 수 없습니다.' };
  if (survey.ownerId !== userId) return { error: '결과를 볼 권한이 없습니다.' };

  const questions = sheetToObjects_('Questions')
    .filter(q => q.surveyId === surveyId)
    .sort((a, b) => parseInt(a.order) - parseInt(b.order))
    .map(q => ({
      ...q,
      required: q.required === 'true',
      options:  q.optionsJson   ? JSON.parse(q.optionsJson)   : [],
      grid:     q.gridJson      ? JSON.parse(q.gridJson)      : null,
      validation: q.validationJson ? JSON.parse(q.validationJson) : null,
    }));

  const responses = sheetToObjects_('Responses').filter(r => r.surveyId === surveyId);
  const answers   = sheetToObjects_('Answers').filter(a => a.surveyId === surveyId);

  return { survey, questions, responses, answers };
}
