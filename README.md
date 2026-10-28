# forward-team-clock

Keeps one Discord message updated (every ~10 min) with the local time of each team member.

- `clock.mjs` builds the message and edits it through a Discord webhook.
- Secrets: `WEBHOOK_URL` (the channel webhook) and `TEAM_JSON` (people, time zones, call window).
- `message_id.txt` / `last_month.txt` are written by the workflow (the monthly commit keeps the schedule from being disabled).
- Test locally: `TEAM_JSON='{...}' node clock.mjs --dry`
