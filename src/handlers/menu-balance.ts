import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem, requireOwner } from "../toolkit/index.js";
import { formatSnapshot, loadState } from "../domain.js";

registerMainMenuItem({ label: "Balance", data: "menu:balance", order: 10 });
const composer = new Composer<Ctx>();

composer.callbackQuery("menu:balance", async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await requireOwner(ctx))) return;
  const state = await loadState(ctx);
  await ctx.reply(formatSnapshot(state.snapshots.at(-1)), { reply_markup: inlineKeyboard([[inlineButton("↻ Refresh", "menu:balance"), inlineButton("Back", "menu:main")]]) });
});

export default composer;
