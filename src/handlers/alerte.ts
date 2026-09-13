import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem, requireOwner } from "../toolkit/index.js";
import { loadState, now, parseAlert, saveState } from "../domain.js";

registerMainMenuItem({ label: "Alerts", data: "menu:alerts", order: 40 });
const composer = new Composer<Ctx>();
const prompt = "Enter a loss threshold such as 50 or 5%. Send off to disable it.";

async function begin(ctx: Ctx) {
  if (!(await requireOwner(ctx))) return;
  ctx.session.alertInput = true;
  await ctx.reply(prompt);
}
composer.command("alerte", begin);
composer.callbackQuery("menu:alerts", async (ctx) => { await ctx.answerCallbackQuery(); await begin(ctx); });
composer.on("message:text", async (ctx, next) => {
  if (!ctx.session.alertInput) return next();
  ctx.session.alertInput = false;
  if (!(await requireOwner(ctx))) return;
  const input = ctx.message.text.trim().toLowerCase();
  const state = await loadState(ctx);
  if (input === "off") {
    state.alert = state.alert ? { ...state.alert, enabled: false, updated_at: now().toISOString() } : undefined;
    await saveState(ctx, state);
    await ctx.reply("Loss alerts are disabled.");
    return;
  }
  const parsed = parseAlert(input);
  if (!parsed) { await ctx.reply("That threshold isn't valid. Use a positive amount such as 50 or a percentage such as 5%."); return; }
  const stamp = now().toISOString();
  state.alert = { enabled: true, ...parsed, created_at: state.alert?.created_at ?? stamp, updated_at: stamp };
  await saveState(ctx, state);
  await ctx.reply(`Loss alerts are set at ${parsed.value}${parsed.unit === "percent" ? "%" : ""}. I'll notify you when a loss reaches that threshold.`);
});
export default composer;
