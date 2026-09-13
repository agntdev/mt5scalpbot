import { Composer } from "grammy"; import type { Ctx } from "../bot.js"; import { actions,owner,statsText } from "../handler-common.js";
const composer=new Composer<Ctx>(); composer.command("stats",async ctx=>{if(!(await owner(ctx)))return;await ctx.reply(await statsText(ctx),{reply_markup:actions});}); export default composer;
