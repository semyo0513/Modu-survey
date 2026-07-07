// ===================================================================
// gas/ResponseService.gs — 응답 제출 + 서명 Drive 저장
// ===================================================================

/**
 * 응답 제출
 * payload: { surveyId, answers[], durationSec, deviceType, signatureBase64? }
 */
function submitResponseHandler_(payload) {
  const { surveyId, answers, durationSec, deviceType } = payload;

  if (!surveyId || !Array.isArray(answers)) {
    return { error: '잘못된 요청입니다.' };
  }

  // 설문 유효성 확인
  const surveys = sheetToObjects_('Surveys');
  const survey  = surveys.find(sv => sv.surveyId === surveyId);

  if (!survey) return { error: '설문을 찾을 수 없습니다.' };
  if (survey.status !== 'open') return { error: '마감된 설문입니다.' };

  // 기간 확인
  const now = new Date();
  if (survey.endAt && new Date(survey.endAt) < now) {
    return { error: '응답 기간이 종료된 설문입니다.' };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const responseId = generateId_('RSP');
    const ts         = now_();

    // 서명 이미지 처리
    let signatureUrl = '';
    const sigAnswer = answers.find(a => a.questionType === 'signature' && a.value);
    if (sigAnswer) {
      signatureUrl = saveSignatureImage_(surveyId, responseId, sigAnswer.value);
    }

    // Responses 시트에 헤더 행 추가
    appendRow_('Responses', [
      responseId, surveyId, ts,
      deviceType || 'unknown',
      durationSec || 0,
      signatureUrl,
    ]);

    // Answers 시트에 개별 답변 추가
    answers.forEach(ans => {
      if (ans.questionType === 'signature') return; // 서명은 별도 처리

      appendRow_('Answers', [
        generateId_('ANS'),
        responseId,
        surveyId,
        ans.questionId    || '',
        ans.questionType  || '',
        ans.value         || '',
        ans.valueRow      || '',
        ans.valueCol      || '',
        ans.textRaw       || '',
      ]);
    });

    return { success: true, responseId };

  } catch (e) {
    Logger.log('[ResponseService] 제출 오류: ' + e.message);
    return { error: '응답 저장 중 오류가 발생했습니다.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 서명 이미지를 Drive에 저장하고 URL 반환
 * @param {string} surveyId
 * @param {string} responseId
 * @param {string} base64DataUrl — "data:image/png;base64,..." 형식
 */
function saveSignatureImage_(surveyId, responseId, base64DataUrl) {
  try {
    // Base64 데이터 추출
    const base64 = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
    const imageBlob = Utilities.newBlob(
      Utilities.base64Decode(base64),
      'image/png',
      `sig_${responseId}.png`
    );

    // Drive 폴더 생성 (없으면)
    const rootFolder = DriveApp.getRootFolder();
    let surveyMineFolder, signaturesFolder, surveyFolder;

    const rootFolders = rootFolder.getFoldersByName('SurveyMine_Signatures');
    surveyMineFolder  = rootFolders.hasNext()
      ? rootFolders.next()
      : rootFolder.createFolder('SurveyMine_Signatures');

    const surveyFolders = surveyMineFolder.getFoldersByName(surveyId);
    surveyFolder = surveyFolders.hasNext()
      ? surveyFolders.next()
      : surveyMineFolder.createFolder(surveyId);

    // 파일 저장
    const file = surveyFolder.createFile(imageBlob);
    // 링크 공유 (소유자만 열람 — 기본값 유지)
    // 필요 시: file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return file.getUrl();
  } catch (e) {
    Logger.log('[ResponseService] 서명 저장 오류: ' + e.message);
    return '';
  }
}
