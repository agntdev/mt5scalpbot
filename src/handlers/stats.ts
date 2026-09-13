import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { requireOwner, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { loadState, now, money } from "../domain.js";

const composer = new Composer<Ctx>();

composer.command("stats", async (ctx) => {
  if (!(await requireOwner(ctx))) return;
  const events = (await loadState(ctx)).events.filter((e) => Date.parse(e.close_time ?? e.open_time) >= now().getTime() - 30 * 86400000 && e.pnl !== undefined);
  const wins = events.filter((e) => (e.pnl ?? 0) > 0), losses = events.filter((e) => (e.pnl ?? 0) < 0);
  const net = events.reduce((s, e) => s + (e.pnl ?? 0), 0);
  await ctx.reply(events.length ? `Last 30 days\nTrades: ${events.length}\nWin rate: ${((wins.length / events.length) * 100).toFixed(1)}%\nAverage win: ${money(wins.length ? wins.reduce((s, e) => s + (e.pnl ?? 0), 0) / wins.length : undefined)}\nAverage loss: ${money(losses.length ? losses.reduce((s, e) => s + (e.pnl ?? 0), 0) / losses.length : undefined)}\nNet P/L: ${money(net)}` : "No completed trades in the last 30 days.", { reply_markup: inlineKeyboard([[inlineButton("Refresh", "menu:stats"), inlineButton("Back", "menu:main")]]) });
});

export default composer;
