import { Composer } from "grammy"; import type { Ctx } from "../bot.js"; import { actions,balanceText,owner } from "../handler-common.js";
const composer=new Composer<Ctx>(); composer.command("solde",async ctx=>{if(!(await owner(ctx)))return;await ctx.reply(await balanceText(ctx),{reply_markup:actions});}); export default composer;
