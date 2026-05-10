/**
 * Ad-hoc Puppeteer script to render a Slack-style DM mockup image
 * matching the real rendering Erik shared. Originally targeted Zapier-sent
 * messages (RUSH STEVE/RUTH still come from Zapier); after the 2026-05-08
 * migration, most messages come from the NWCA Backend Alerts app via direct
 * incoming webhooks. Visual styling is identical for both senders.
 */
const puppeteer = require('puppeteer');
const path = require('path');

const OUT_DIR = 'C:/Users/erik/AppData/Local/Temp/rush-screenshots';

const HTML = `
<!DOCTYPE html>
<html>
<head>
<style>
  body {
    margin: 0;
    padding: 40px;
    background: #1a1d21;
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    color: #d1d2d3;
  }
  .slack-msg {
    max-width: 720px;
    padding: 16px 20px;
    background: transparent;
    font-size: 18px;
    line-height: 1.55;
  }
  .sender {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 6px;
    background: #dc2626;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
  }
  .sender-name {
    font-weight: 900;
    color: #fff;
    font-size: 16px;
  }
  .sender-time {
    font-size: 13px;
    color: #7b7e82;
    margin-left: 8px;
    font-weight: 400;
  }
  .bot-tag {
    font-size: 11px;
    font-weight: 700;
    color: #ababad;
    background: #3e4146;
    padding: 2px 6px;
    border-radius: 3px;
    margin-left: 6px;
  }
  .head {
    font-size: 20px;
    font-weight: 700;
    color: #fff;
    margin-bottom: 6px;
  }
  .fire { color: #ff6b35; }
  .fields {
    margin-left: 0;
    color: #d1d2d3;
  }
  .field-row { margin: 3px 0; }
  .label { color: #8b9398; margin-right: 4px; }
  .link { color: #1d9bd1; text-decoration: underline; }
  .sent-by {
    margin-top: 14px;
    font-size: 12px;
    color: #7b7e82;
    font-style: italic;
  }
</style>
</head>
<body>
  <div class="slack-msg">
    <div class="sender">
      <div class="avatar">🔥</div>
      <div>
        <span class="sender-name">NWCA RUSH Bot</span>
        <span class="bot-tag">APP</span>
        <span class="sender-time">10:42 AM</span>
      </div>
    </div>
    <div class="head"><span class="fire">🔥</span> <b>RUSH MOCKUP REQUEST</b> — Atkinson Construction</div>
    <div class="fields">
      <div class="field-row"><span class="label">Design:</span>38162.01 — Atkinson Construction</div>
      <div class="field-row"><span class="label">Type:</span>Polo</div>
      <div class="field-row"><span class="label">Location:</span>Left Chest</div>
      <div class="field-row"><span class="label">Due Date:</span>Apr 17, 2026</div>
      <div class="field-row"><span class="label">Submitted by:</span><span class="link">taneisha@nwcustomapparel.com</span></div>
      <div class="field-row" style="margin-top:8px;"><span class="label">View:</span><span class="link">https://www.teamnwca.com/mockup/53</span></div>
    </div>
    <div class="sent-by">Sent by NWCA Backend Alerts</div>
  </div>
</body>
</html>
`;

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        defaultViewport: { width: 820, height: 460 }
    });
    const page = await browser.newPage();
    await page.setContent(HTML, { waitUntil: 'networkidle2' });
    await page.screenshot({ path: path.join(OUT_DIR, '5-slack-message.png') });
    await browser.close();
    console.log('→ 5-slack-message.png');
})().catch(err => { console.error(err); process.exit(1); });
