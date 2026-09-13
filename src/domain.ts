import type { Ctx } from "./bot.js";

export type TradeEvent = {
  eventId: string;
  symbol: string;
  direction: "buy" | "sell";
  entryPrice: number;
  size: number;
  openTime: string;
  closePrice?: number;
  closeTime?: string;
  pnl?: number;
  ticket?: string;
  urgent?: boolean;
};

export type Snapshot = {
  timestamp: string;
  balance: number;
  equity: number;
  openPositionsCount: number;
  winnersCount: number;
  losersCount: number;
};

export type AlertConfig = { enabled: boolean; unit: "currency" | "percent"; value: number; updatedAt: string };

type D1 = {
  prepare(sql: string): { bind(...args: unknown[]): any; run(): Promise<unknown>; first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }> };
};

type EnvCtx = Ctx & { env?: { DB?: D1 } };
export function db(ctx: Ctx): D1 | undefined {
  return (ctx as EnvCtx).env?.DB;
}

export function now(): Date { return new Date(); }

async function setup(database: D1): Promise<void> {
  await database.prepare("CREATE TABLE IF NOT EXISTS mt5_events (event_id TEXT PRIMARY KEY, symbol TEXT NOT NULL, direction TEXT NOT NULL, entry_price REAL NOT NULL, size REAL NOT NULL, open_time TEXT NOT NULL, close_price REAL, close_time TEXT, pnl REAL, ticket TEXT, urgent INTEGER NOT NULL DEFAULT 0)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS mt5_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL, balance REAL NOT NULL, equity REAL NOT NULL, open_positions_count INTEGER NOT NULL, winners_count INTEGER NOT NULL, losers_count INTEGER NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS mt5_alert (id INTEGER PRIMARY KEY CHECK (id = 1), enabled INTEGER NOT NULL, unit TEXT NOT NULL, value REAL NOT NULL, updated_at TEXT NOT NULL)").run();
  await database.prepare("CREATE TABLE IF NOT EXISTS mt5_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)").run();
}

export async function saveEvent(ctx: Ctx, event: TradeEvent): Promise<boolean> {
  const database = db(ctx); if (!database) return false;
  await setup(database);
  await database.prepare("DELETE FROM mt5_events WHERE open_time < ?").bind(new Date(now().getTime()-30*86400000).toISOString()).run();
  const result = await database.prepare("INSERT OR IGNORE INTO mt5_events (event_id,symbol,direction,entry_price,size,open_time,close_price,close_time,pnl,ticket,urgent) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
    .bind(event.eventId, event.symbol, event.direction, event.entryPrice, event.size, event.openTime, event.closePrice ?? null, event.closeTime ?? null, event.pnl ?? null, event.ticket ?? null, event.urgent ? 1 : 0).run() as { meta?: { changes?: number } };
  return (result.meta?.changes ?? 0) > 0;
}

export async function saveSnapshot(ctx: Ctx, snapshot: Snapshot): Promise<void> { const database = db(ctx); if (!database) return; await setup(database); await database.prepare("INSERT INTO mt5_snapshots (timestamp,balance,equity,open_positions_count,winners_count,losers_count) VALUES (?,?,?,?,?,?)").bind(snapshot.timestamp,snapshot.balance,snapshot.equity,snapshot.openPositionsCount,snapshot.winnersCount,snapshot.losersCount).run(); }
export async function latestSnapshot(ctx: Ctx): Promise<Snapshot | undefined> { const database=db(ctx); if (!database) return undefined; await setup(database); const x=await database.prepare("SELECT timestamp,balance,equity,open_positions_count as openPositionsCount,winners_count as winnersCount,losers_count as losersCount FROM mt5_snapshots ORDER BY id DESC LIMIT 1").first() as Snapshot | null; return x ?? undefined; }
export async function events(ctx: Ctx, since: Date = new Date(now().getTime()-30*86400000)): Promise<TradeEvent[]> { const database=db(ctx); if (!database) return []; await setup(database); const x=await database.prepare("SELECT event_id as eventId,symbol,direction,entry_price as entryPrice,size,open_time as openTime,close_price as closePrice,close_time as closeTime,pnl,ticket,urgent FROM mt5_events WHERE open_time >= ? ORDER BY open_time DESC LIMIT 1000").bind(since.toISOString()).all() as { results: TradeEvent[] }; return x.results; }
export async function getAlert(ctx: Ctx): Promise<AlertConfig | undefined> { const database=db(ctx); if(!database) return undefined; await setup(database); const x=await database.prepare("SELECT enabled,unit,value,updated_at as updatedAt FROM mt5_alert WHERE id=1").first() as {enabled:number;unit:"currency"|"percent";value:number;updatedAt:string} | null; return x ? { enabled:!!x.enabled, unit:x.unit, value:x.value, updatedAt:x.updatedAt } : undefined; }
export async function setAlert(ctx: Ctx, config: AlertConfig): Promise<void> { const database=db(ctx); if(!database) return; await setup(database); await database.prepare("INSERT INTO mt5_alert (id,enabled,unit,value,updated_at) VALUES (1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,unit=excluded.unit,value=excluded.value,updated_at=excluded.updated_at").bind(config.enabled?1:0,config.unit,config.value,config.updatedAt).run(); }
export async function exportEvents(ctx: Ctx): Promise<TradeEvent[]> { return events(ctx); }
