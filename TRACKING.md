# JARDIANCE CRM Re-engagement — Tracking

| File | What it does |
|---|---|
| `index.html` | Patient experience. Sends every interaction as an anonymous event. |
| `dashboard.html` | Users per segment (S1–S7), journey funnel, channel split, top interactions, full interaction log, **Restart** button. |
| `config.js` | Shared setting: the collector URL. Empty = track in this browser only. |
| `apps-script/Code.gs` | Free collector: a Google Sheet + Apps Script web app that stores events from every phone. |

Live URLs once pushed:
- Experience: `https://rxs8517.github.io/Jardiance-CRM/` (add `#email`, `#sms`, `#email-had`, `#sms-none` … to tag the link)
- Dashboard: `https://rxs8517.github.io/Jardiance-CRM/dashboard.html`

## Works right away (no setup): local mode
With `endpoint` empty, both pages share one browser's storage. Open the experience in one tab and the dashboard in another on the same device. The dashboard updates live. Use **Demo tools → Restart as a new user** to simulate many users.

## Track every user's phone: connect the Google Sheet collector (about 5 minutes)
1. Create a new Google Sheet (e.g. "JARDIANCE re-engagement events").
2. In the sheet: **Extensions → Apps Script**. Replace the editor contents with `apps-script/Code.gs` and save.
3. **Project Settings (gear) → Script Properties → Add property**: `ADMIN_KEY` = a passphrase of your choice. The dashboard asks for this before it will restart tracking.
4. **Deploy → New deployment → Type: Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy, authorize, and copy the **Web app URL** (ends in `/exec`).
5. Put the URL in `config.js`:
   ```js
   window.JRD_TRACKING = { endpoint: 'https://script.google.com/macros/s/XXXX/exec' };
   ```
   Commit and push. GitHub Pages republishes in a minute or so.

The dashboard header then shows **Live · all users (Google Sheet)**. Every event is also a row in the sheet's `Events` tab.

> To test a collector before committing, use **Data source** in the dashboard header. That override applies only to the browser you set it in.
> After editing `Code.gs`, use **Deploy → Manage deployments → Edit → New version**, or the URL keeps serving the old code.

## Restart tracking
**Restart** in the dashboard sets every count back to zero.
- Collector mode: requires `ADMIN_KEY`. Current rows are copied to an `Archive yyyy-MM-dd HH:mm` tab, then `Events` is cleared. Nothing is lost.
- Local mode: clears this browser's event log.

**Restart as a new user** (in the experience's Demo tools) is different. It gives the phone a new anonymous ID so you can walk through as another person. Both users are kept in the counts.

## How users are counted
- **User** = one anonymous ID per browser (random, stored on the device). **Session** = one page load.
- **Segment** = the segment the questions (or a demo jump) put the user in. Someone who later signs up for a savings card stays in their original "No savings card" segment and shows under **Enrolled**. That makes enrollment a conversion of that segment.
- **Not yet segmented** = opened the link but left before finishing the questions.
- **Interactions** = everything except page views, session starts and segment assignments.

## What is sent
`ts, uid, sid, event, segment, channel (email/sms), crm, page, data` (click target, answer value, reminder settings).
No names, phone numbers or free text are sent. The first name and mobile number on the savings sign-up screen never leave the device. Answers about conditions are tied only to the random ID.

## Limits
Apps Script suits pilots and demos: low thousands of users and tens of thousands of events, with a 10-second dashboard refresh. For the full 1.1M-record campaign, point `endpoint` at EZScript's production analytics pipeline. The event format stays the same.

Anyone with the `/exec` URL can post events to it, so treat the numbers as demo/pilot data.
