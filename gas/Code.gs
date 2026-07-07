// ===================================================================
// gas/Code.gs — 메인 라우터 (doGet / doPost)
// ===================================================================

/**
 * GET 요청 처리 — 헬스 체크용
 */
function doGet(e) {
  ensureDatabase_();
  return jsonResponse_({
    status:  'ok',
    service: 'SurveyMine GAS API',
    version: '2.0',
    time:    now_(),
  });
}

/**
 * POST 요청 처리 — 모든 API 액션의 진입점
 * Body: JSON.stringify({ action, token?, payload })
 */
function doPost(e) {
  ensureDatabase_();

  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch {
    return jsonResponse_({ error: '요청 형식이 올바르지 않습니다.' });
  }

  const { action, token, payload = {} } = body;

  try {
    switch (action) {

      /* ── 인증 ─────────────────────────────── */
      case 'auth.signup':
        return jsonResponse_(signupHandler_(payload));

      case 'auth.login':
        return jsonResponse_(loginHandler_(payload));

      case 'auth.logout': {
        return jsonResponse_(logoutHandler_(token));
      }

      /* ── 학교 ─────────────────────────────── */
      case 'schools.list':
        return jsonResponse_(listSchoolsHandler_());

      case 'schools.add': {
        const user = requireAuth_(token);
        if (user.error) return jsonResponse_(user);
        return jsonResponse_(addSchoolHandler_(payload, user.userId));
      }

      /* ── 설문 (공개) ───────────────────────── */
      case 'surveys.listBySchool':
        return jsonResponse_(listSurveysBySchoolHandler_(payload));

      case 'survey.get':
        return jsonResponse_(getSurveyHandler_(payload));

      /* ── 설문 (인증 필요) ─────────────────── */
      case 'surveys.listMine': {
        const user = requireAuth_(token);
        if (user.error) return jsonResponse_(user);
        return jsonResponse_(listMySurveysHandler_(user.userId));
      }

      case 'surveys.create': {
        const user = requireAuth_(token);
        if (user.error) return jsonResponse_(user);
        return jsonResponse_(createSurveyHandler_(payload, user.userId));
      }

      case 'surveys.update': {
        const user = requireAuth_(token);
        if (user.error) return jsonResponse_(user);
        return jsonResponse_(updateSurveyHandler_(payload, user.userId));
      }

      case 'surveys.setStatus': {
        const user = requireAuth_(token);
        if (user.error) return jsonResponse_(user);
        return jsonResponse_(setSurveyStatusHandler_(payload, user.userId));
      }

      case 'questions.bulkSave': {
        const user = requireAuth_(token);
        if (user.error) return jsonResponse_(user);
        return jsonResponse_(bulkSaveQuestionsHandler_(payload, user.userId));
      }

      /* ── 응답 (비회원 허용) ────────────────── */
      case 'response.submit':
        return jsonResponse_(submitResponseHandler_(payload));

      /* ── 결과 (소유자 전용) ────────────────── */
      case 'results.get': {
        const user = requireAuth_(token);
        if (user.error) return jsonResponse_(user);
        return jsonResponse_(getResultsHandler_(payload, user.userId));
      }

      case 'results.exportCsv': {
        const user = requireAuth_(token);
        if (user.error) return jsonResponse_(user);
        return jsonResponse_(exportCsvHandler_(payload, user.userId));
      }

      default:
        return jsonResponse_({ error: `알 수 없는 액션: ${action}` });
    }

  } catch (err) {
    Logger.log(`[Code] 오류 (${action}): ${err.message}\n${err.stack}`);
    return jsonResponse_({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
  }
}

/* ── 인증 헬퍼 ────────────────────────────────────────────────── */
function requireAuth_(token) {
  const user = verifyToken_(token);
  if (!user) return { error: '로그인이 필요합니다. 다시 로그인해 주세요.' };
  return user;
}

/* ── CSV 내보내기 ─────────────────────────────────────────────── */
function exportCsvHandler_(payload, userId) {
  const result = getResultsHandler_(payload, userId);
  if (result.error) return result;

  const { answers } = result;
  const headers = ['answerId','responseId','surveyId','questionId','questionType','value','valueRow','valueCol','textRaw'];

  const rows = answers.map(a =>
    headers.map(h => `"${(a[h] || '').toString().replace(/"/g, '""')}"`).join(',')
  );

  const csv = [headers.join(','), ...rows].join('\n');
  return { success: true, csv, filename: `SurveyMine_${payload.surveyId}_${now_().split('T')[0]}.csv` };
}
