// ===================================================================
// gas/Auth.gs — 회원 인증 (가입, 로그인, 토큰 세션)
// ===================================================================

/**
 * 회원가입
 * payload: { email, password, name, schoolName }
 */
function signupHandler_(payload) {
  const { email, password, name, schoolName } = payload;

  if (!email || !password || !name || !schoolName) {
    return { error: '필수 항목을 모두 입력해 주세요.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: '올바른 이메일 형식이 아닙니다.' };
  }
  if (password.length < 8) {
    return { error: '비밀번호는 8자 이상이어야 합니다.' };
  }

  // 이메일 중복 체크
  const users = sheetToObjects_('Users');
  if (users.some(u => u.email === email)) {
    return { error: '이미 사용 중인 이메일입니다.' };
  }

  // 비밀번호 해싱 (salt + SHA-256)
  const salt         = Utilities.getUuid();
  const passwordHash = hashPassword_(password, salt);
  const userId       = generateId_('USR');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    appendRow_('Users', [
      userId, email, passwordHash, salt, name, schoolName,
      'creator', now_(), '', 'active',
    ]);
  } finally {
    lock.releaseLock();
  }

  return { success: true, message: '가입이 완료되었습니다.' };
}

/**
 * 로그인
 * payload: { email, password }
 */
function loginHandler_(payload) {
  const { email, password } = payload;

  if (!email || !password) {
    return { error: '이메일과 비밀번호를 입력해 주세요.' };
  }

  const users = sheetToObjects_('Users');
  const user  = users.find(u => u.email === email && u.status === 'active');

  if (!user) {
    return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
  }

  const inputHash = hashPassword_(password, user.salt);
  if (inputHash !== user.passwordHash) {
    return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
  }

  // 토큰 발급 (CacheService — TTL 24h)
  const token = Utilities.getUuid();
  const cache = CacheService.getScriptCache();
  cache.put(`token:${token}`, JSON.stringify({ userId: user.userId, email: user.email }), 86400);

  // lastLoginAt 갱신
  updateUserLoginTime_(user.userId);

  return {
    success: true,
    token,
    user: {
      userId:     user.userId,
      email:      user.email,
      name:       user.name,
      schoolName: user.schoolName,
      role:       user.role,
    },
  };
}

/**
 * 로그아웃
 * token 필수
 */
function logoutHandler_(token) {
  if (!token) return { success: true };
  const cache = CacheService.getScriptCache();
  cache.remove(`token:${token}`);
  return { success: true };
}

/**
 * 토큰 검증 → 유저 정보 반환
 * @returns {Object|null} 유저 정보 또는 null
 */
function verifyToken_(token) {
  if (!token) return null;
  const cache = CacheService.getScriptCache();
  const raw   = cache.get(`token:${token}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* ── 내부 헬퍼 ─────────────────────────────────────────────────── */

function hashPassword_(password, salt) {
  const combined = salt + password;
  const bytes    = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    combined,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function updateUserLoginTime_(userId) {
  const sheet   = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const uidIdx  = headers.indexOf('userId');
  const loginIdx= headers.indexOf('lastLoginAt');

  for (let i = 1; i < data.length; i++) {
    if (data[i][uidIdx] === userId) {
      sheet.getRange(i + 1, loginIdx + 1).setValue(now_());
      break;
    }
  }
}
