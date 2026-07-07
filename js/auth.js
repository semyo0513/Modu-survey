/* ===================================================================
   auth.js — 세션/토큰 처리
   localStorage 기반 세션 관리
   =================================================================== */

const Auth = (() => {
  const TOKEN_KEY    = 'sm_token';
  const USER_KEY     = 'sm_user';
  const EXPIRE_KEY   = 'sm_expire';
  const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

  // ── Internal ────────────────────────────────────────────────── //

  function _save(token, user) {
    localStorage.setItem(TOKEN_KEY,  token);
    localStorage.setItem(USER_KEY,   JSON.stringify(user));
    localStorage.setItem(EXPIRE_KEY, (Date.now() + TOKEN_TTL_MS).toString());
  }

  function _clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXPIRE_KEY);
  }

  function _resolvePath(path) {
    if (path.startsWith('/')) {
      const isGitHubPages = location.hostname.endsWith('github.io');
      if (isGitHubPages) {
        const pathSegments = location.pathname.split('/');
        const repoName = pathSegments[1];
        if (repoName) {
          return `/${repoName}${path}`;
        }
      }
    }
    return path;
  }

  // ── Public ──────────────────────────────────────────────────── //

  return {
    /** 경로 해결 도우미 */
    resolvePath(path) {
      return _resolvePath(path);
    },

    /** 로그인 후 세션 저장 */
    saveSession(token, user) {
      _save(token, user);
    },

    /** 현재 토큰 반환 (만료 시 null) */
    getToken() {
      const expire = parseInt(localStorage.getItem(EXPIRE_KEY) || '0', 10);
      if (Date.now() > expire) {
        _clear();
        return null;
      }
      return localStorage.getItem(TOKEN_KEY);
    },

    /** 로그인 여부 */
    isLoggedIn() {
      return !!this.getToken();
    },

    /** 현재 유저 정보 반환 */
    getUser() {
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },

    /** 세션 삭제 (로그아웃) */
    clearSession() {
      _clear();
    },

    /** 비회원 응답 이력 관리 (중복 방지) */
    markResponded(surveyId) {
      const key = `sm_resp_${surveyId}`;
      localStorage.setItem(key, Date.now().toString());
    },

    hasResponded(surveyId) {
      return !!localStorage.getItem(`sm_resp_${surveyId}`);
    },

    /** 로그인 필요 시 login 페이지로 리다이렉트 */
    requireAuth(redirectBack = false) {
      if (!this.isLoggedIn()) {
        const next = redirectBack
          ? `?next=${encodeURIComponent(location.href)}`
          : '';
        location.href = _resolvePath(`/login.html${next}`);
        return false;
      }
      return true;
    },

    /** 로그인 상태에서 접근 불가 (로그인·가입 페이지용) */
    redirectIfLoggedIn(destination = '/admin/dashboard.html') {
      if (this.isLoggedIn()) {
        location.href = _resolvePath(destination);
      }
    },
  };
})();

window.Auth = Auth;
