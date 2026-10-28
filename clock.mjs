// Team clock: keeps one Discord message updated with everyone's local time.
// Secrets: WEBHOOK_URL (Discord webhook), TEAM_JSON (people + call window).
// The id of the message is stored in message_id.txt (committed by the workflow).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ID_FILE = 'message_id.txt';
const MONTH_FILE = 'last_month.txt'; // one commit a month keeps the schedule alive

const team = JSON.parse(process.env.TEAM_JSON);
const url = process.env.WEBHOOK_URL;
const now = new Date();

function offsetMin(tz, date) {
  const s = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
    .formatToParts(date).find(p => p.type === 'timeZoneName').value; // "GMT+09:00"
  const m = s.match(/GMT([+-])(\d{2}):(\d{2})/);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

function localTime(tz) {
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(now);
  return { time, day };
}

const hh = h => String(((h % 24) + 24) % 24).padStart(2, '0') + ':00';

function render() {
  const lines = ['## :clock3: Team clock'];
  for (const p of team.people) {
    const { time, day } = localTime(p.tz);
    lines.push(`${p.flag} **${p.names}** · ${p.city} · **${time}** · ${day}`);
  }
  const c = team.calls;
  if (c) {
    const diff = (offsetMin(c.otherTz, now) - offsetMin(c.tz, now)) / 60;
    lines.push('');
    lines.push(`${c.otherLabel} is ${diff}h ahead of ${c.label}`);
    lines.push(`Good for calls: ${hh(c.from)}–${hh(c.to)} ${c.label} = ${hh(c.from + diff)}–${hh(c.to + diff)} ${c.otherLabel}`);
  }
  lines.push(`-# updated <t:${Math.floor(now.getTime() / 1000)}:R>`);
  return lines.join('\n');
}

async function send(content) {
  const body = JSON.stringify({ content, allowed_mentions: { parse: [] } });
  const headers = { 'Content-Type': 'application/json' };
  const id = existsSync(ID_FILE) ? readFileSync(ID_FILE, 'utf8').trim() : '';
  if (id) {
    const r = await fetch(`${url}/messages/${id}`, { method: 'PATCH', headers, body });
    if (r.ok) return;
    if (r.status !== 404) throw new Error(`edit failed: ${r.status} ${await r.text()}`);
  }
  // no message yet (or it was deleted): post a new one and remember its id
  const r = await fetch(`${url}?wait=true`, { method: 'POST', headers, body });
  if (!r.ok) throw new Error(`post failed: ${r.status} ${await r.text()}`);
  writeFileSync(ID_FILE, (await r.json()).id + '\n');
}

const content = render();
if (process.argv.includes('--dry')) {
  console.log(content);
} else {
  await send(content);
  const month = now.toISOString().slice(0, 7);
  if (!existsSync(MONTH_FILE) || readFileSync(MONTH_FILE, 'utf8').trim() !== month) writeFileSync(MONTH_FILE, month + '\n');
}
