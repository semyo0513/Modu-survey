/* ===================================================================
   api.js — GAS 통신 래퍼 (토큰 관리 포함)
   모든 API 호출은 이 모듈을 통해 단일화
   =================================================================== */

const API = (() => {
  // GAS Web App URL
  const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx5EPYE4FOgK6rMmeQOddy2PTo1FPQLMwhC6FBOI9MtkMpMu_lJb6qP6lQU8txmNPaXcg/exec';

  /** 공통 POST 요청 */
  async function _post(action, payload = {}, token = null) {
    const body = { action, payload };
    if (token) body.token = token;

    try {
      const res = await fetch(WEB_APP_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      if (json.error) throw new Error(json.error);
      return json;
    } catch (err) {
      console.error(`[API] ${action} failed:`, err.message);
      throw err;
    }
  }

  /** 현재 저장된 토큰 가져오기 */
  function _getToken() {
    return Auth.getToken();
  }

  // ── Public API Methods ──────────────────────────────────────── //

  return {
    // ─ Auth ─
    signup(email, password, name, schoolName) {
      return _post('auth.signup', { email, password, name, schoolName });
    },
    login(email, password) {
      return _post('auth.login', { email, password });
    },
    logout() {
      return _post('auth.logout', {}, _getToken());
    },

    // ─ Schools ─
    listSchools() {
      return _post('schools.list', {});
    },
    addSchool(schoolName, region) {
      return _post('schools.add', { schoolName, region }, _getToken());
    },

    // ─ Surveys ─
    listSurveysBySchool(schoolName) {
      return _post('surveys.listBySchool', { schoolName });
    },
    listMySurveys() {
      return _post('surveys.listMine', {}, _getToken());
    },
    createSurvey(data) {
      return _post('surveys.create', data, _getToken());
    },
    updateSurvey(surveyId, data) {
      return _post('surveys.update', { surveyId, ...data }, _getToken());
    },
    setSurveyStatus(surveyId, status) {
      return _post('surveys.setStatus', { surveyId, status }, _getToken());
    },
    getSurvey(surveyId) {
      return _post('survey.get', { surveyId });
    },

    // ─ Questions ─
    bulkSaveQuestions(surveyId, questions) {
      return _post('questions.bulkSave', { surveyId, questions }, _getToken());
    },

    // ─ Responses ─
    submitResponse(surveyId, answers, meta = {}) {
      return _post('response.submit', { surveyId, answers, ...meta });
    },

    // ─ Results ─
    getResults(surveyId) {
      return _post('results.get', { surveyId }, _getToken());
    },
    exportCsv(surveyId) {
      return _post('results.exportCsv', { surveyId }, _getToken());
    },
  };
})();

window.API = API;
