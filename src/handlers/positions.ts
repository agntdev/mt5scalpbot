import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { requireOwner, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { loadState, money } from "../domain.js";

const composer = new Composer<Ctx>();

composer.command("positions", async (ctx) => {
  if (!(await requireOwner(ctx))) return;
  const positions = (await loadState(ctx)).snapshots.at(-1)?.positions ?? [];
  const text = positions.length === 0 ? "No open positions." : positions.map((p) => `${p.symbol} ${p.direction.toUpperCase()} · Entry ${p.entry_price} · Size ${p.size} · P/L ${money(p.unrealized_pnl)}`).join("\n");
  await ctx.reply(text, { reply_markup: inlineKeyboard([[inlineButton("Refresh", "menu:positions"), inlineButton("Back", "menu:main")]]) });
});

export default composer;
