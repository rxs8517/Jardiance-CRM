/**
 * JARDIANCE CRM Re-engagement — event collector (Google Apps Script web app)
 *
 * Receives batched events from index.html (POST) and serves them to dashboard.html (GET).
 * Data lands in the "Events" tab of the Google Sheet this script is bound to.
 *
 * Setup: see TRACKING.md in the repo.
 *   Script Properties → ADMIN_KEY = <any passphrase>   (required for "Restart tracking")
 *
 * Endpoints
 *   POST  <url>                         body: JSON array of events (text/plain)
 *   GET   <url>?action=events           → { ok, since, events:[...] }
 *   GET   <url>?action=reset&key=KEY    → archives the Events tab and starts from zero
 *   GET   <url>?action=ping             → { ok:true }
 */

const SHEET = 'Events';
const HEAD = ['ts', 'received', 'uid', 'sid', 'event', 'segment', 'channel', 'crm', 'page', 'data'];
const MAX_BATCH = 200;      // events accepted per POST
const MAX_RETURN = 20000;   // most recent events returned to the dashboard

function ss_() {
  // Bound script (Extensions → Apps Script): uses its sheet. Standalone script: set Script Property SHEET_ID.
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  const ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
  if (!ss) throw new Error('No spreadsheet: create the script from the Sheet (Extensions → Apps Script) or set Script Property SHEET_ID');
  return ss;
}

function sheet_() {
  const ss = ss_();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(HEAD);
    sh.setFrozenRows(1);
    sh.getRange('A:B').setNumberFormat('@'); // keep ISO timestamps as text
  }
  return sh;
}

function clip_(v, n) { return String(v == null ? '' : v).slice(0, n || 64); }

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    let body = JSON.parse((e && e.postData && e.postData.contents) || '[]');
    if (!Array.isArray(body)) body = [body];
    const now = new Date().toISOString();
    const rows = body.slice(0, MAX_BATCH)
      .filter(x => x && x.event && x.uid)
      .map(x => [
        clip_(x.ts || now, 40), now, clip_(x.uid), clip_(x.sid), clip_(x.event, 48),
        clip_(x.segment, 8), clip_(x.channel, 8), clip_(x.crm, 12), clip_(x.page, 64),
        JSON.stringify(x.data || {}).slice(0, 1500)
      ]);
    if (rows.length) {
      const sh = sheet_();
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEAD.length).setValues(rows);
    }
    return json_({ ok: true, n: rows.length });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  try { return doGet_(e); } catch (err) { return json_({ ok: false, error: String(err && err.message || err) }); }
}

function doGet_(e) {
  const p = (e && e.parameter) || {};
  const action = p.action || 'events';
  const props = PropertiesService.getScriptProperties();

  if (action === 'ping') return json_({ ok: true, sheet: ss_().getName(), rows: Math.max(0, sheet_().getLastRow() - 1) });

  if (action === 'reset') {
    const key = props.getProperty('ADMIN_KEY');
    if (!key || p.key !== key) return json_({ ok: false, error: 'Invalid admin key' });
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const ss = ss_();
      const sh = sheet_();
      const n = sh.getLastRow() - 1;
      let archived = 0;
      if (n > 0) {
        const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
        sh.copyTo(ss).setName('Archive ' + stamp);
        sh.deleteRows(2, n);
        archived = n;
      }
      const since = new Date().toISOString();
      props.setProperty('SINCE', since);
      return json_({ ok: true, since, archived });
    } finally {
      lock.releaseLock();
    }
  }

  // action === 'events'
  const sh = sheet_();
  const last = sh.getLastRow();
  const n = Math.min(last - 1, MAX_RETURN);
  const vals = n > 0 ? sh.getRange(last - n + 1, 1, n, HEAD.length).getValues() : [];
  const iso = v => (v instanceof Date ? v.toISOString() : String(v));
  const events = vals.map(r => {
    let data = {};
    try { data = JSON.parse(r[9] || '{}'); } catch (x) {}
    return { ts: iso(r[0]), uid: r[2], sid: r[3], event: r[4], segment: r[5], channel: r[6], crm: r[7], page: r[8], data };
  });
  return json_({ ok: true, since: props.getProperty('SINCE') || '', total: last - 1, events });
}
