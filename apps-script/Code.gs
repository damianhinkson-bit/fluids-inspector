/**
 * Fluids Inspector — logging backend (Google Apps Script, bound to a Google Sheet).
 *
 * Setup:
 *  1. Create a Google Sheet → Extensions → Apps Script → paste this file.
 *  2. Run `setup` once (approve permissions). It creates the Log + Summary tabs
 *     and prints your TEACHER KEY in the execution log.
 *  3. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
 *  4. Copy the /exec URL into config.js in the GitHub repo.
 */

const HEADERS = ["Server time", "Student", "Event", "Session", "Case ID", "Case", "Question ID",
  "Question", "Type", "Her answer", "Correct answer", "Correct? (1/0)", "Attempt", "Hint used",
  "Time (s)", "Total XP", "Detail", "Client time"];
const KEYS = ["student", "event", "session", "caseId", "caseTitle", "qid", "question", "qtype",
  "chosen", "correct", "isCorrect", "attempt", "hint", "timeSec", "xp", "detail", "clientTime"];

function setup() {
  const ss = SpreadsheetApp.getActive();
  let log = ss.getSheetByName("Log") || ss.insertSheet("Log", 0);
  if (log.getLastRow() === 0) {
    log.appendRow(HEADERS);
    log.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#0b1f4d").setFontColor("#ffffff");
    log.setFrozenRows(1);
    log.setColumnWidth(8, 360);
  }
  let sum = ss.getSheetByName("Summary") || ss.insertSheet("Summary", 1);
  sum.clear();
  sum.getRange("A1").setValue("First-try accuracy by case").setFontWeight("bold");
  sum.getRange("A2").setFormula(
    "=IFERROR(QUERY(Log!A:R,\"select B, F, count(L), avg(L) where C='answer' and M=1 group by B, F " +
    "label count(L) 'Questions', avg(L) 'First-try accuracy'\",1),\"No answers yet\")");
  sum.getRange("F1").setValue("Most-missed questions (wrong answers)").setFontWeight("bold");
  sum.getRange("F2").setFormula(
    "=IFERROR(QUERY(Log!A:R,\"select B, H, count(L) where C='answer' and L=0 group by B, H " +
    "order by count(L) desc label count(L) 'Times wrong'\",1),\"No wrong answers yet\")");
  sum.getRange("D:D").setNumberFormat("0%");
  sum.setColumnWidth(7, 420);

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("TEACHER_KEY")) {
    props.setProperty("TEACHER_KEY", Math.random().toString(36).slice(2, 10));
  }
  Logger.log("TEACHER KEY (for teacher.html): " + props.getProperty("TEACHER_KEY"));
}

/** Game sends one JSON event per POST. */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActive().getSheetByName("Log");
    const row = [new Date()].concat(KEYS.map(k => {
      const v = d[k] === undefined ? "" : d[k];
      return typeof v === "string" ? v.slice(0, 500) : v;
    }));
    sheet.appendRow(row);
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Teacher dashboard reads all rows: GET ?key=YOUR_KEY */
function doGet(e) {
  const key = PropertiesService.getScriptProperties().getProperty("TEACHER_KEY");
  if (!e.parameter.key || e.parameter.key !== key) return out({ ok: false, error: "bad key" });
  const values = SpreadsheetApp.getActive().getSheetByName("Log").getDataRange().getValues();
  const rows = values.slice(1).map(r => {
    const o = { serverTime: r[0] };
    KEYS.forEach((k, i) => o[k] = r[i + 1]);
    return o;
  });
  return out({ ok: true, rows });
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
