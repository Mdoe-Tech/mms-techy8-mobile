import { apiRequest } from '@/api/client';

export type SystemAdminHikariStats = {
  activeConnections: number;
  idleConnections: number;
  maximumPoolSize: number;
  threadsAwaitingConnections: number;
  poolName?: string | null;
  jdbcUrl?: string | null;
  idleTimeoutMs?: number | null;
};

export type SystemAdminHealth = {
  dbOk: boolean | null;
  redisOk: boolean | null;
  hikari: SystemAdminHikariStats;
  raw: Record<string, unknown>;
};

export type SystemAdminWebsocketStats = {
  totalOpenConnections: number;
  associationConnections: Record<string, number>;
  raw: Record<string, unknown>;
};

export async function getSystemAdminHealth() {
  const payload = await apiRequest<Record<string, unknown>>('/super-admin/system/health');
  return normalizeHealth(payload);
}

export async function getSystemAdminWebsocketStats() {
  const payload = await apiRequest<Record<string, unknown>>('/super-admin/system/websocket');
  return normalizeWebsocket(payload);
}

function normalizeHealth(payload: Record<string, unknown> | null | undefined): SystemAdminHealth {
  const raw = payload && typeof payload === 'object' ? payload : {};
  const hikari = asRecord(raw.hikari);
  return {
    dbOk: toBoolean(raw['db.ok']),
    redisOk: toBoolean(raw['redis.ok']),
    hikari: {
      activeConnections: toNumber(hikari.activeConnections),
      idleConnections: toNumber(hikari.idleConnections),
      maximumPoolSize: toNumber(hikari.maximumPoolSize ?? hikari.maxConnections),
      threadsAwaitingConnections: toNumber(hikari.threadsAwaitingConnections),
      poolName: toText(hikari.poolName),
      jdbcUrl: toText(hikari.jdbcUrl),
      idleTimeoutMs: toNullableNumber(hikari.idleTimeoutMs),
    },
    raw,
  };
}

function normalizeWebsocket(payload: Record<string, unknown> | null | undefined): SystemAdminWebsocketStats {
  const raw = payload && typeof payload === 'object' ? payload : {};
  const associations = asRecord(raw.associationConnections);
  return {
    totalOpenConnections: toNumber(raw.totalOpenConnections ?? raw.activeConnections),
    associationConnections: Object.fromEntries(Object.entries(associations).map(([key, value]) => [key, toNumber(value)])),
    raw,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return null;
}

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toNullableNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
