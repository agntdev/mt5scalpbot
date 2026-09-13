import type { Context } from "grammy";
import { adminChatId } from "./toolkit/index.js";

export interface TradeEvent {
  event_id: string;
  symbol: string;
  direction: "buy" | "sell";
  entry_price: number;
  size: number;
  open_time: string;
  close_price?: number;
  close_time?: string;
  pnl?: number;
  ticket?: string;
}
export interface AccountSnapshot {
  timestamp: string;
  balance: number;
  equity: number;
  open_positions_count: number;
  winners_count: number;
  losers_count: number;
  positions?: Position[];
}
export interface Position {
  symbol: string;
  direction: "buy" | "sell";
  entry_price: number;
  size: number;
  unrealized_pnl?: number;
}
export interface AlertConfiguration { enabled: boolean; unit: "currency" | "percent"; value: number; created_at: string; updated_at: string }
export interface BotState { events: TradeEvent[]; snapshots: AccountSnapshot[]; alert?: AlertConfiguration; lastSummary?: string }

export const now = (): Date => new Date();
const empty = (): BotState => ({ events: [], snapshots: [] });
type AnyCtx = Context & { env?: Record<string, unknown>; session?: { localState?: BotState } };

function db(ctx: AnyCtx): any { return ctx.env?.DB as any; }
function key(ctx: AnyCtx): string { return `mt5:${adminChatId(ctx) ?? ctx.chat?.id ?? "unconfigured"}`; }

export async function loadState(ctx: AnyCtx): Promise<BotState> {
  const d = db(ctx);
  if (d?.prepare) {
    const row = await d.prepare("SELECT value FROM mt5_state WHERE id = ?").bind(key(ctx)).first();
    if (row?.value) return JSON.parse(String(row.value)) as BotState;
  }
  return ctx.session?.localState ?? empty();
}
export async function saveState(ctx: AnyCtx, state: BotState): Promise<void> {
  const d = db(ctx);
  if (d?.prepare) {
    await d.prepare("CREATE TABLE IF NOT EXISTS mt5_state (id TEXT PRIMARY KEY, value TEXT NOT NULL)").run();
    await d.prepare("INSERT INTO mt5_state (id, value) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value").bind(key(ctx), JSON.stringify(state)).run();
  }
  if (ctx.session) ctx.session.localState = state;
}
export function trimEvents(state: BotState, at = now()): void {
  const cutoff = at.getTime() - 30 * 24 * 60 * 60 * 1000;
  state.events = state.events.filter((e) => Date.parse(e.close_time ?? e.open_time) >= cutoff);
}
export function isAdmin(ctx: AnyCtx): boolean { return adminChatId(ctx) !== undefined && String(ctx.chat?.id ?? ctx.from?.id) === adminChatId(ctx); }
export function money(value: number | undefined): string { return value === undefined ? "—" : value.toFixed(2); }
export function formatSnapshot(snapshot: AccountSnapshot | undefined): string {
  if (!snapshot) return "No account snapshot is available yet.";
  return `Balance: ${money(snapshot.balance)}\nEquity: ${money(snapshot.equity)}\nUpdated: ${snapshot.timestamp}`;
}
export function parseAlert(value: string): { unit: "currency" | "percent"; value: number } | undefined {
  const input = value.trim();
  if (/^\d+(?:\.\d+)?%$/.test(input)) { const n = Number(input.slice(0, -1)); return n > 0 ? { unit: "percent", value: n } : undefined; }
  if (/^\d+(?:\.\d+)?$/.test(input)) { const n = Number(input); return n > 0 ? { unit: "currency", value: n } : undefined; }
  return undefined;
}

export function validateEvent(input: unknown): TradeEvent | AccountSnapshot | undefined {
  if (!input || typeof input !== "object") return undefined;
  const item = input as Record<string, unknown>;
  if (item.event_type === "account" || item.event_type === "account_snapshot") {
    if (typeof item.time !== "string" || typeof item.balance !== "number" || typeof item.equity !== "number") return undefined;
    return { timestamp: item.time, balance: item.balance, equity: item.equity, open_positions_count: Number(item.open_positions_count ?? 0), winners_count: Number(item.winners_count ?? 0), losers_count: Number(item.losers_count ?? 0), positions: Array.isArray(item.positions) ? item.positions as Position[] : [] };
  }
  if (item.event_type !== "open" && item.event_type !== "close") return undefined;
  if (typeof item.symbol !== "string" || (item.direction !== "buy" && item.direction !== "sell") || typeof item.entry_price !== "number" || typeof item.size !== "number" || typeof item.time !== "string") return undefined;
  const id = typeof item.event_id === "string" ? item.event_id : `${item.ticket ?? item.symbol}:${item.time}`;
  return { event_id: id, symbol: item.symbol, direction: item.direction, entry_price: item.entry_price, size: item.size, open_time: item.time, close_price: typeof item.close_price === "number" ? item.close_price : undefined, close_time: typeof item.close_time === "string" ? item.close_time : item.event_type === "close" ? item.time : undefined, pnl: typeof item.pnl === "number" ? item.pnl : undefined, ticket: typeof item.ticket === "string" || typeof item.ticket === "number" ? String(item.ticket) : undefined };
}
