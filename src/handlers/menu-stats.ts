import { Composer } from "grammy"; import type { Ctx } from "../bot.js"; import { registerMainMenuItem } from "../toolkit/index.js"; import { actions, owner, statsText } from "../handler-common.js";
registerMainMenuItem({label:"Stats",data:"menu:stats",order:30}); const composer=new Composer<Ctx>();
composer.callbackQuery("menu:stats",async ctx=>{await ctx.answerCallbackQuery();if(!(await owner(ctx)))return;await ctx.reply(await statsText(ctx),{reply_markup:actions});}); export default composer;
