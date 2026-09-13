import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { requireOwner } from "../toolkit/index.js";
import { db, getAlert, now, saveEvent, saveSnapshot, type TradeEvent } from "../domain.js";
import { notify, money } from "../handler-common.js";

type Incoming = Record<string, unknown>;
function text(v: unknown): string | undefined { return typeof v === "string" && v.trim() ? v.trim() : undefined; }
function number(v: unknown): number | undefined { return typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined; }
function eventId(input: Incoming): string { return text(input.event_id) ?? text(input.id) ?? `${text(input.ticket) ?? "no-ticket"}:${text(input.time) ?? "no-time"}:${text(input.event_type) ?? "unknown"}`; }
function parseTrade(input: Incoming): TradeEvent | undefined {
  const symbol=text(input.symbol), direction=text(input.direction)?.toLowerCase(), entryPrice=number(input.entry_price), size=number(input.size), openTime=text(input.open_time) ?? text(input.time);
  if(!symbol || (direction!=="buy" && direction!=="sell") || entryPrice===undefined || size===undefined || !openTime) return undefined;
  return {eventId:eventId(input),symbol,direction,entryPrice,size,openTime,closePrice:number(input.close_price),closeTime:text(input.close_time) ?? (text(input.event_type)==="close" ? openTime : undefined),pnl:number(input.pnl),ticket:text(input.ticket)};
}
export async function processEvent(ctx: Ctx, input: Incoming): Promise<{ok:boolean; message:string}> {
  if (!db(ctx)) return {ok:false,message:"Persistent storage isn't set up yet."};
  const kind=text(input.event_type)?.toLowerCase();
  if(kind==="account" || kind==="snapshot"){const balance=number(input.balance),equity=number(input.equity),timestamp=text(input.time) ?? now().toISOString();if(balance===undefined||equity===undefined)return {ok:false,message:"The account event is missing balance or equity."};await saveSnapshot(ctx,{timestamp,balance,equity,openPositionsCount:number(input.open_positions_count)??0,winnersCount:number(input.winners_count)??0,losersCount:number(input.losers_count)??0});await notify(ctx,`Account update\nBalance: ${money(balance)}\nEquity: ${money(equity)}`);return {ok:true,message:"Account event received."};}
  if(kind!=="open" && kind!=="close") return {ok:false,message:"The event type must be open, close, or account."};
  const trade=parseTrade(input);if(!trade)return {ok:false,message:"The trade event is missing a symbol, direction, entry price, size, or time."};
  const alert=await getAlert(ctx);let urgent=false;if(alert?.enabled&&trade.pnl!==undefined){urgent=alert.unit==="currency" ? trade.pnl<=-alert.value : trade.pnl<0 && Math.abs(trade.pnl)>=alert.value;trade.urgent=urgent;}
  const inserted=await saveEvent(ctx,trade);if(!inserted)return {ok:true,message:"Duplicate event ignored."};
  const marker=kind==="open"?"⚠️":(trade.pnl!==undefined&&trade.pnl>=0?"✅":"❌");let message=`${marker} ${trade.symbol} ${trade.direction.toUpperCase()} ${kind}`;if(trade.pnl!==undefined)message+=` · P/L ${money(trade.pnl)}`;await notify(ctx,message);if(urgent)await notify(ctx,`⚠️ Urgent loss alert\n${trade.symbol} P/L: ${money(trade.pnl ?? 0)}`);return {ok:true,message:"Trade event received."};
}

const composer=new Composer<Ctx>();
composer.command("POST",async ctx=>{await ctx.reply("EA events must be sent to the webhook endpoint.");});
composer.on("message:document",async ctx=>{if(!(await requireOwner(ctx as unknown as Parameters<typeof requireOwner>[0])))return;const document=(ctx.message as any).document as {file_size?:number;file_name?:string;mime_type?:string};if((document.file_size??0)>1024*1024){await ctx.reply("That file is too large. Upload a file smaller than 1 MB.");return;}try{const file=await ctx.getFile();const downloaded=await (file as any).download();const raw=typeof downloaded==="string"?downloaded:new TextDecoder().decode(downloaded);let records:unknown[];try{const parsed=JSON.parse(raw);records=Array.isArray(parsed)?parsed:[parsed];}catch{records=raw.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));}let accepted=0;for(const record of records){if(record&&typeof record==="object"&&(await processEvent(ctx,record as Incoming)).ok)accepted++;}await ctx.reply(`Processed ${accepted} event${accepted===1?"":"s"}.`);}catch{await ctx.reply("I couldn't read that file. Upload JSON trade records with event_type, symbol, direction, entry_price, size, and time.");}});
export default composer;
