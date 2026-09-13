import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { requireOwner } from "../toolkit/index.js";
import { loadState, saveState, trimEvents, validateEvent, type AccountSnapshot, type TradeEvent } from "../domain.js";

const composer = new Composer<Ctx>();

export async function recordEvent(ctx: Ctx, payload: unknown): Promise<boolean> {
  const event = validateEvent(payload);
  if (!event) { await ctx.reply("That event is incomplete. Include symbol, direction, entry price, size, time, and event type."); return false; }
  const state = await loadState(ctx);
  if ("event_id" in event) {
    if (state.events.some((e) => e.event_id === event.event_id)) return true;
    state.events.push(event as TradeEvent);
  } else state.snapshots.push(event as AccountSnapshot);
  trimEvents(state);
  await saveState(ctx, state);
  const owner = (ctx as Ctx & { env?: Record<string, unknown> }).env;
  const admin = owner?.ADMIN_CHAT_ID ?? (typeof process !== "undefined" ? process.env.ADMIN_CHAT_ID : undefined);
  if (admin) {
    const text = "event_id" in event ? `${event.close_time ? ((event.pnl ?? 0) >= 0 ? "✅" : "❌") : "⚠️"} ${event.symbol} ${event.direction.toUpperCase()}${event.pnl === undefined ? "" : ` · P/L ${event.pnl.toFixed(2)}`}` : `Account update · Balance ${event.balance.toFixed(2)} · Equity ${event.equity.toFixed(2)}`;
    try { await ctx.api.sendMessage(String(admin), text); } catch { /* owner may have blocked the bot */ }
  }
  return true;
}

composer.command("POST", async (ctx) => {
  if (!(await requireOwner(ctx))) return;
  const raw = ctx.match?.trim();
  if (!raw) { await ctx.reply("Send the event as JSON after /POST."); return; }
  try { await recordEvent(ctx, JSON.parse(raw)); } catch { await ctx.reply("I couldn't read that JSON. Check the format and try again."); }
});

composer.on("message:document", async (ctx) => {
  if (!(await requireOwner(ctx))) return;
  const document = ctx.message.document;
  if (document.file_size && document.file_size > 2_000_000) { await ctx.reply("That file is too large. Upload a file smaller than 2 MB."); return; }
  try {
    const file = await ctx.api.getFile(document.file_id);
    const runtimeEnv = (ctx as Ctx & { env?: Record<string, unknown> }).env;
    const token = String(runtimeEnv?.BOT_TOKEN ?? (typeof process !== "undefined" ? process.env.BOT_TOKEN : ""));
    if (!file.file_path || !token) throw new Error("download unavailable");
    const response = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
    const text = await response.text();
    const parsed: unknown = JSON.parse(text);
    const records = Array.isArray(parsed) ? parsed : [parsed];
    let count = 0;
    for (const record of records) if (await recordEvent(ctx, record)) count++;
    await ctx.reply(`${count} event${count === 1 ? "" : "s"} imported.`);
  } catch { await ctx.reply("I couldn't read that file. Upload JSON containing trade events."); }
});

export default composer;
