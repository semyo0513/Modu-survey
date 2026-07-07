// ===================================================================
// gas/Schema.gs — 시트 스키마 정의 + DB 자동 초기화
// ===================================================================

const SHEET_SCHEMAS = [
  {
    name: 'Users',
    headers: ['userId','email','passwordHash','salt','name','schoolName','role','createdAt','lastLoginAt','status'],
  },
  {
    name: 'Surveys',
    headers: ['surveyId','ownerId','schoolName','title','description','status','startAt','endAt','allowMultiple','themeColor','createdAt','updatedAt'],
  },
  {
    name: 'Questions',
    headers: ['questionId','surveyId','order','type','title','required','optionsJson','gridJson','validationJson'],
  },
  {
    name: 'Responses',
    headers: ['responseId','surveyId','submittedAt','deviceType','durationSec','signatureUrl'],
  },
  {
    name: 'Answers',
    headers: ['answerId','responseId','surveyId','questionId','questionType','value','valueRow','valueCol','textRaw'],
  },
  {
    name: 'Schools',
    headers: ['schoolId','schoolName','region','createdAt'],
  },
  {
    name: 'Config',
    headers: ['key','value','description'],
  },
];

/**
 * DB 자동 초기화 — 최초 실행 시 1회만 시트 생성
 * doGet/doPost 진입점에서 호출
 */
function ensureDatabase_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('DB_INITIALIZED') === 'v2') return; // 이미 초기화됨

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    SHEET_SCHEMAS.forEach(schema => {
      let sheet = ss.getSheetByName(schema.name);
      if (!sheet) sheet = ss.insertSheet(schema.name);

      // 헤더가 없을 때만 설정
      if (sheet.getLastRow() === 0) {
        const headerRange = sheet.getRange(1, 1, 1, schema.headers.length);
        headerRange
          .setValues([schema.headers])
          .setFontWeight('bold')
          .setBackground('#1a73e8')
          .setFontColor('#ffffff');
        sheet.setFrozenRows(1);

        // 열 너비 자동 조정
        sheet.autoResizeColumns(1, schema.headers.length);
      }
    });

    // Config 기본값 삽입
    const configSheet = ss.getSheetByName('Config');
    if (configSheet && configSheet.getLastRow() <= 1) {
      configSheet.getRange(2, 1, 3, 3).setValues([
        ['SESSION_TTL_HOURS', '24',   '세션 유효 시간 (시간)'],
        ['MAX_LOGIN_ATTEMPTS','5',    '최대 로그인 시도 횟수'],
        ['STOPWORDS_VERSION', '1.0',  '불용어 사전 버전'],
      ]);
    }

    props.setProperty('DB_INITIALIZED', 'v2');
    Logger.log('[Schema] DB 초기화 완료');

  } catch (e) {
    Logger.log('[Schema] 초기화 오류: ' + e.message);
    throw e;
  } finally {
    lock.releaseLock();
  }
}

/** 유틸: 시트에서 전체 데이터를 객체 배열로 반환 */
function sheetToObjects_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] !== undefined ? row[i] : '']))
  );
}

/** 유틸: 시트에 행 추가 (LockService 없음 — 호출부에서 Lock 관리) */
function appendRow_(sheetName, values) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error(`시트를 찾을 수 없습니다: ${sheetName}`);
  sheet.appendRow(values);
}

/** 유틸: 특정 열 값으로 행 찾기 */
function findRow_(sheetName, colIndex, value) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][colIndex] == value) return { row: i + 1, data: data[i], headers: data[0] };
  }
  return null;
}

/** 유틸: UUID 생성 */
function generateId_(prefix) {
  const uid = Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
  return `${prefix}-${uid}`;
}

/** 유틸: 현재 ISO 타임스탬프 */
function now_() {
  return new Date().toISOString();
}

/** 유틸: JSON 응답 생성 */
function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
