# MT5 Scalper Companion — Bot specification

**Archetype:** finance

**Voice:** professional and concise — write every user-facing message, button label, error, and empty state in this voice.

Telegram companion for an MT5 scalping EA that receives trade and account events, sends immediate trade open/close notifications and urgent loss alerts, posts a configurable daily account summary, and supports on-demand account/trade queries and an interactive loss-threshold configuration. Stores 30 days of detailed events and aggregated stats for command-driven reporting.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- Retail MT5 traders running the EA who want instant Telegram notifications
- EA owners who need a single admin chat to receive alerts and summaries

## Success criteria

- EA-sent trade open/close events are delivered as Telegram messages to ADMIN_CHAT_ID within 5 seconds under normal conditions
- Daily summary is posted at the configured time each day (default 23:59 server time)
- Owner can set/disable a loss threshold via /alerte and receive an urgent alert when threshold exceeded
- Commands /solde, /positions, /stats return accurate, persisted state reflecting last 30 days of events

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open the main menu and show quick action buttons (Balance, Positions, Stats, Alerts)
  - outputs: main menu keyboard
- **/solde** (command, actor: user, command: /solde) — Show current account balance and equity
  - outputs: balance, equity, timestamp
- **/positions** (command, actor: user, command: /positions) — List current open positions with symbol, direction, entry, size, unrealized P/L
  - outputs: positions list
- **/stats** (command, actor: user, command: /stats) — Show performance summary (default window: last 30 days)
  - inputs: optional date range or '30d'
  - outputs: total trades, win rate, avg win/loss, net P/L
- **/alerte** (command, actor: user, command: /alerte) — Interactive flow to set, show, or disable the loss threshold (accepts currency or percent like '50' or '5%')
  - inputs: threshold value or 'off'
  - outputs: confirmation message, stored alert config
- **Balance** (button, actor: user, callback: menu:balance) — Quick access to current balance/equity
  - outputs: balance, equity
- **Positions** (button, actor: user, callback: menu:positions) — Quick access to open positions list
  - outputs: positions list
- **Stats** (button, actor: user, callback: menu:stats) — Quick access to recent performance stats (30d default)
  - outputs: performance summary
- **EA event webhook** (command, actor: EA, command: /POST /webhook/events) — Receive trade open/close and account snapshot events as JSON from the EA
  - inputs: trade/account JSON payload
  - outputs: parsed event stored and notification posted

## Flows

### Real-time trade notification
_Trigger:_ Webhook trade open/close event

1. Receive JSON payload at webhook endpoint
2. Validate payload (required fields: symbol, direction, entry_price, size, time, event_type)
3. Deduplicate event (idempotency using event id or trade timestamp+ticket)
4. Persist event to database (30-day retention policy)
5. Format concise message with emoji marker (✅ for close profit, ❌ for close loss, ⚠️ for open if special) and P/L if available
6. Send message to ADMIN_CHAT_ID
7. If trade triggers urgent threshold check, also send high-priority urgent alert message

_Data touched:_ TradeEvent, AccountSnapshot, AlertConfiguration

### Daily summary job
_Trigger:_ Scheduled daily timer (default server 23:59 or owner-configured time)

1. Query last 24h events and rolling 30d aggregates
2. Compute balance, equity, total trades today, winners, losers, net P/L
3. Persist daily summary snapshot
4. Post formatted daily summary to ADMIN_CHAT_ID

_Data touched:_ AccountSnapshot, TradeEvent, Aggregates

### On-demand /solde and /positions
_Trigger:_ /solde or /positions command or corresponding button

1. Authenticate sender is ADMIN_CHAT_ID
2. Fetch latest account snapshot and open positions from persisted state
3. Format short, human-friendly response
4. Return message with quick action buttons (Refresh, Back to menu)

_Data touched:_ AccountSnapshot, TradeEvent

### Interactive /alerte configuration
_Trigger:_ /alerte command or Alerts -> Set Alert button

1. Bot prompts for threshold value or 'off' (use ForceReply for typed input)
2. User replies with absolute currency or percentage (e.g., '100' or '5%')
3. Validate and normalize input (store unit: 'currency' or 'percent')
4. Persist AlertConfiguration
5. Send confirmation message summarizing new setting and sample alert condition

_Data touched:_ AlertConfiguration

### Urgent loss/drawdown alert
_Trigger:_ New trade or account snapshot persisted

1. Evaluate configured AlertConfiguration against incoming P/L or account drawdown
2. If threshold exceeded, mark event urgent and send urgent alert (include last trades, current balance/equity, and P/L)
3. Log alert event and notification timestamp

_Data touched:_ TradeEvent, AccountSnapshot, AlertConfiguration

### File upload fallback parsing
_Trigger:_ Owner uploads a plain text or JSON file to bot chat

1. Accept file, validate MIME/type, limit size
2. Attempt to parse JSON or line-based trade records
3. On success, process each record identical to webhook flow (persist + notify)
4. On parse failure, reply with clear error and expected sample format

_Data touched:_ TradeEvent

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — Telegram chat id where all trade notifications, daily summaries, and urgent alerts are sent
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **TradeEvent** _(retention: persistent)_ — One trade open or close event reported by the EA
  - fields: event_id (optional string), symbol, direction (buy|sell), entry_price, size, open_time, close_price (optional), close_time (optional), pnl (optional numeric), ticket (optional)
- **AccountSnapshot** _(retention: persistent)_ — Periodic or on-demand account snapshot with balance/equity and basic counts
  - fields: timestamp, balance, equity, open_positions_count, winners_count, losers_count
- **AlertConfiguration** _(retention: persistent)_ — Owner-configured loss/drawdown alert settings
  - fields: enabled (boolean), unit (currency|percent), value (numeric), created_at, updated_at
- **Aggregates** _(retention: persistent)_ — Aggregated performance metrics for quick /stats responses (rolling 30d and lifetime)
  - fields: window (e.g., 30d), total_trades, wins, losses, avg_win, avg_loss, net_pnl, win_rate
- **AdminMeta** _(retention: persistent)_ — Owner/admin routing info for notifications and permissions
  - fields: admin_chat_id, summary_time_tz (owner timezone choice optional)

## Integrations

- **Telegram** (required) — Bot API messaging for notifications, interactive commands and file uploads
- **Webhook HTTP receiver** (required) — Accept JSON POST events from the EA (trade open/close and account snapshots)
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- Set ADMIN_CHAT_ID (required) — where all notifications and urgent alerts are sent
- Configure daily summary time (default 23:59 server time)
- Set or disable loss threshold (/alerte)
- Export last 30 days of events (downloadable JSON via bot)
- Pause/resume notifications
- Set timezone for scheduled summaries (if supported)

## Notifications

- Immediate trade open/close notification (concise text with emoji and P/L)
- Urgent loss/drawdown alert when configured threshold exceeded (high-priority message)
- Configurable daily account summary (once per day at configured time)
- Parse errors for uploaded files or malformed webhook events (reply to uploader)

## Permissions & privacy

- Stored data (trades, snapshots, alert config) is private and only sent to ADMIN_CHAT_ID
- Retention policy: detailed per-trade events retained for 30 days; aggregated metrics retained longer
- No external sharing or third-party analytics by default
- Owner must supply ADMIN_CHAT_ID; bot will only respond to that chat for account queries and sensitive controls

## Edge cases

- Duplicate events: handle idempotency by event_id or dedupe heuristics (timestamp+ticket)
- Malformed webhook payloads: respond with 400 and store failure log, send parse-failure notice to owner if configured
- Webhook authentication unspecified: reject unauthenticated requests until owner supplies an agreed auth mechanism (see missing fields)
- Large file uploads: enforce size limit and reject with clear error
- Timezones: owner may be in a different timezone than server — scheduled summary timezone must be configurable
- EA offline or delayed events: allow late-arriving events but mark them with original timestamp in UI; do not retroactively resend daily summaries (only include events with timestamp within the day)
- Threshold parsing ambiguity: accept both '50' (currency) and '5%' (percent); reject ambiguous inputs with examples
- Multiple owners/admins not supported — ignore or reject commands from non-ADMIN_CHAT_ID

## Required tests

- Webhook trade open -> ensure message posted to ADMIN_CHAT_ID and event persisted
- Webhook trade close with P/L positive/negative -> ensure emoji and P/L formatting correct and urgent alert triggers if configured
- Interactive /alerte flow: set currency and percent thresholds, validate persistence and confirmation messages
- Daily summary job at configured time -> message content matches persisted snapshots
- On-demand /solde and /positions -> returns latest persisted snapshot and open positions list
- File upload fallback: valid JSON file processed; malformed file returns helpful error
- Idempotency test: re-send same event -> no duplicate notification or double-count in aggregates
- Permission test: commands and settings rejected when sent by non-admin chat

## Assumptions

- Single admin chat receives all notifications and issues commands (owner supplies ADMIN_CHAT_ID)
- EA will POST structured JSON to the webhook endpoint or upload JSON/text files in the bot chat as a fallback
- Default daily summary time is 23:59 server time; owner may change to their timezone later
- Retention policy is 30 days for detailed events; aggregated stats can be stored longer for /stats queries
- No payments, order placement, or remote execution from Telegram are required
