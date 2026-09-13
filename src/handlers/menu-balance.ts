import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem } from "../toolkit/index.js";
import { actions, balanceText, owner } from "../handler-common.js";
registerMainMenuItem({ label: "Balance", data: "menu:balance", order: 10 });
const composer=new Composer<Ctx>();
async function show(ctx: Ctx) { if(!(await owner(ctx))) return; await ctx.reply(await balanceText(ctx),{reply_markup:actions}); }
composer.callbackQuery("menu:balance",async ctx=>{await ctx.answerCallbackQuery();await show(ctx);});
composer.callbackQuery("menu:refresh",async ctx=>{await ctx.answerCallbackQuery();await show(ctx);});
export default composer;
