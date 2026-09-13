import { Composer } from "grammy"; import type { Ctx } from "../bot.js"; import { registerMainMenuItem } from "../toolkit/index.js"; import { actions, owner, positionsText } from "../handler-common.js";
registerMainMenuItem({label:"Positions",data:"menu:positions",order:20}); const composer=new Composer<Ctx>();
composer.callbackQuery("menu:positions",async ctx=>{await ctx.answerCallbackQuery();if(!(await owner(ctx)))return;await ctx.reply(await positionsText(ctx),{reply_markup:actions});}); export default composer;
