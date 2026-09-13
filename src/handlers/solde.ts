import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { requireOwner, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { formatSnapshot, loadState } from "../domain.js";

const composer = new Composer<Ctx>();

composer.command("solde", async (ctx) => {
  if (!(await requireOwner(ctx))) return;
  await ctx.reply(formatSnapshot((await loadState(ctx)).snapshots.at(-1)), { reply_markup: inlineKeyboard([[inlineButton("Refresh", "menu:balance"), inlineButton("Back", "menu:main")]]) });
});

export default composer;
