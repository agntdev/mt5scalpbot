import type { Ctx } from "./bot.js";
import { adminChatId, requireOwner, inlineButton, inlineKeyboard } from "./toolkit/index.js";
import { events, latestSnapshot, type TradeEvent } from "./domain.js";
export const actions=inlineKeyboard([[inlineButton("Refresh","menu:refresh"),inlineButton("⬅️ Menu","menu:main")]]);
export async function owner(ctx:Ctx):Promise<boolean>{return requireOwner(ctx as unknown as Parameters<typeof requireOwner>[0]);}
export function ownerId(ctx:Ctx):string|undefined{return adminChatId(ctx as unknown as Parameters<typeof adminChatId>[0]);}
export function money(value:number):string{return Number.isFinite(value)?value.toFixed(2):"—";}
export async function balanceText(ctx:Ctx):Promise<string>{const x=await latestSnapshot(ctx);if(!x)return "No account snapshot is available yet.";return `Balance: ${money(x.balance)}\nEquity: ${money(x.equity)}\nUpdated: ${x.timestamp}`;}
export async function positionsText(ctx:Ctx):Promise<string>{const list=(await events(ctx)).filter(e=>e.closeTime===undefined);if(!list.length)return "No open positions are available.";return list.map(e=>`${e.symbol} ${e.direction.toUpperCase()} · entry ${money(e.entryPrice)} · size ${e.size} · P/L ${money(e.pnl??0)}`).join("\n");}
export async function statsText(ctx:Ctx):Promise<string>{const list=(await events(ctx)).filter(e=>e.closeTime!==undefined&&e.pnl!==undefined);if(!list.length)return "No completed trades in the last 30 days.";const wins=list.filter(e=>(e.pnl??0)>0),losses=list.filter(e=>(e.pnl??0)<0),net=list.reduce((a,e)=>a+(e.pnl??0),0),avg=(xs:TradeEvent[])=>xs.length?xs.reduce((a,e)=>a+(e.pnl??0),0)/xs.length:0;return `Last 30 days\nTrades: ${list.length}\nWin rate: ${((wins.length/list.length)*100).toFixed(1)}%\nAverage win: ${money(avg(wins))}\nAverage loss: ${money(avg(losses))}\nNet P/L: ${money(net)}`;}
export async function notify(ctx:Ctx,text:string):Promise<void>{const id=ownerId(ctx);if(!id)return;try{await ctx.api.sendMessage(id,text);}catch{/* A blocked chat must not stop event processing. */}}
