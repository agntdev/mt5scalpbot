import { Composer } from "grammy"; import type { Ctx } from "../bot.js"; import { actions,owner,positionsText } from "../handler-common.js";
const composer=new Composer<Ctx>(); composer.command("positions",async ctx=>{if(!(await owner(ctx)))return;await ctx.reply(await positionsText(ctx),{reply_markup:actions});}); export default composer;
