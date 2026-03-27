// ===== 設定 =====

/** 自動返信メールの件名 */
const REPLY_SUBJECT = 'お問い合わせありがとうございます';

/** 自動返信メールの本文 */
const REPLY_BODY = [
  'お問い合わせいただきありがとうございます。',
  '',
  '内容を確認の上、担当者より改めてご連絡いたします。',
  'しばらくお待ちくださいますようお願い申し上げます。',
  '',
  '※このメールは自動送信です。',
].join('\n');

/** 件名または本文にいずれかのキーワードが含まれる場合に自動返信する */
const MATCH_KEYWORDS = [
  'お問い合わせ',
  '資料請求',
  '健康診断',
];

/** 全チェック済みスレッドに付与するラベル名（再チェック防止用） */
const LABEL_CHECKED = '自動返信/確認済み';

/** 返信送信済みスレッドに付与するラベル名（運用確認用） */
const LABEL_REPLIED = '自動返信/返信済み';

/** 1回の実行で処理する最大スレッド数 */
const BATCH_SIZE = 50;

/** 実行時間の上限（ミリ秒）— 30分制限に5分マージン */
const TIME_LIMIT_MS = 25 * 60 * 1000;

// ===== メイン処理 =====

/**
 * メイン関数 — トリガーから呼び出される
 * ラベル未付与の受信メールを検索し、条件に一致する初回メールに自動返信する
 */
function processAutoReply() {
  const startTime = Date.now();
  const checkedLabel = getOrCreateLabel(LABEL_CHECKED);
  const repliedLabel = getOrCreateLabel(LABEL_REPLIED);
  const myEmail = Session.getActiveUser().getEmail();

  if (!myEmail) {
    Logger.log('警告: 実行ユーザーのメールアドレスを取得できません。自分自身チェックをスキップします。');
  }

  // 確認済みラベル未付与 かつ 受信トレイ のスレッドを検索
  const sanitizedLabel = LABEL_CHECKED.replace(/"/g, '\\"');
  const query = `in:inbox -label:"${sanitizedLabel}"`;

  let start = 0;
  while (Date.now() - startTime < TIME_LIMIT_MS) {
    const threads = GmailApp.search(query, start, BATCH_SIZE);
    if (threads.length === 0) break;

    for (const thread of threads) {
      // 実行時間チェック
      if (Date.now() - startTime >= TIME_LIMIT_MS) {
        Logger.log('実行時間上限に達したため中断します。残りは次回実行で処理します。');
        return;
      }

      // 初回メールのみ（スレッド内メッセージが1件）
      if (thread.getMessageCount() !== 1) {
        thread.addLabel(checkedLabel);
        continue;
      }

      const message = thread.getMessages()[0];
      const senderEmail = extractEmail(message.getFrom());

      // 自分自身が送信したメールはスキップ
      if (myEmail && senderEmail.toLowerCase() === myEmail.toLowerCase()) {
        thread.addLabel(checkedLabel);
        continue;
      }

      // キーワードマッチ判定
      if (!matchesKeywords(message)) {
        thread.addLabel(checkedLabel);
        continue;
      }

      // 自動返信送信
      try {
        sendReply(message);
      } catch (e) {
        Logger.log('返信送信エラー (threadId: %s, subject: %s): %s', thread.getId(), message.getSubject(), e);
        continue;
      }

      // 送信成功 → 両方のラベルを付与
      thread.addLabel(checkedLabel);
      thread.addLabel(repliedLabel);
      Logger.log('自動返信送信: to=%s, subject=%s', senderEmail, message.getSubject());
    }

    start += threads.length;
    if (threads.length < BATCH_SIZE) break;
  }
}

/**
 * From ヘッダからメールアドレスのみを抽出する
 * "山田 太郎 <taro@example.com>" → "taro@example.com"
 * @param {string} from
 * @returns {string}
 */
function extractEmail(from) {
  const match = from.match(/<([^>]+)>/);
  return match ? match[1] : from.trim();
}

/**
 * メッセージの件名または本文にキーワード（いずれか）が含まれるか判定
 * @param {GmailMessage} message
 * @returns {boolean}
 */
function matchesKeywords(message) {
  const subject = message.getSubject().toLowerCase();
  const body = message.getPlainBody().toLowerCase();

  return MATCH_KEYWORDS.some(function(keyword) {
    const kw = keyword.toLowerCase();
    return subject.indexOf(kw) !== -1 || body.indexOf(kw) !== -1;
  });
}

/**
 * 送信元アドレスに自動返信メールを送信
 * @param {GmailMessage} message 返信対象の受信メッセージ
 */
function sendReply(message) {
  const to = extractEmail(message.getFrom());
  GmailApp.sendEmail(to, REPLY_SUBJECT, REPLY_BODY);
}

/**
 * 指定名のラベルを取得（存在しなければ作成）
 * @param {string} labelName
 * @returns {GmailLabel}
 */
function getOrCreateLabel(labelName) {
  let label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    label = GmailApp.createLabel(labelName);
  }
  return label;
}

// ===== トリガー管理 =====

/**
 * 5分間隔の時間ベーストリガーを設置
 * GASエディタから手動で1回実行する
 */
function setupTrigger() {
  // 既存の同名トリガーを削除してから設置（重複防止）
  removeTrigger();
  ScriptApp.newTrigger('processAutoReply')
    .timeBased()
    .everyMinutes(5)
    .create();
  Logger.log('トリガーを設置しました（5分間隔）');
}

/**
 * processAutoReply のトリガーをすべて削除
 */
function removeTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'processAutoReply') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
  Logger.log('トリガーを削除しました');
}
