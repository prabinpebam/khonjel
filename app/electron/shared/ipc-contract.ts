/**
 * The typed IPC contract — the single source of truth for channel names, payload/response
 * TYPES, the contract version, and the structured error model. Imported by the renderer `ipc`
 * adapter, the main-process dispatch/handlers, and the preload allow-list.
 *
 * This file is PURE (no electron, node, zod, or DOM imports) so it is safe to bundle into the
 * renderer and to import from tests. Runtime validation schemas live next to it in
 * `ipc-schemas.ts` (main + tests only, keeping zod out of the renderer bundle).
 *
 * See docs/product-spec/04-architecture-and-delivery/backend/08-ipc-and-ports-contracts.md.
 */
import type { Platform, Profile } from "../../src/services/ports";

/** Bumped only on breaking channel changes; preload sends it, main rejects mismatches. */
export const CONTRACT_VERSION = 1;

/** Request/response channels (invoke). One namespace per port. Phase 0 = the seam proof. */
export const CHANNELS = {
  profileGet: "profile:get",
  systemGetAppVersion: "system:getAppVersion",
  systemGetPlatform: "system:getPlatform",
} as const;

export type Channel = (typeof CHANNELS)[keyof typeof CHANNELS];

/** Per-channel request argument tuples and response types. */
export interface ChannelContract {
  "profile:get": { request: []; response: Profile };
  "system:getAppVersion": { request: []; response: string };
  "system:getPlatform": { request: []; response: Platform };
}

export type RequestOf<C extends Channel> = ChannelContract[C]["request"];
export type ResponseOf<C extends Channel> = ChannelContract[C]["response"];

/** Structured error model carried across IPC (handlers never throw raw across the boundary). */
export type IpcErrorCode =
  | "unauthorized"
  | "provider_error"
  | "model_unavailable"
  | "offline"
  | "validation"
  | "cancelled"
  | "not_found"
  | "conflict"
  | "internal";

export interface IpcError {
  readonly __ipcError: true;
  code: IpcErrorCode;
  message: string;
  detail?: unknown;
}

export function ipcError(code: IpcErrorCode, message: string, detail?: unknown): IpcError {
  return { __ipcError: true, code, message, detail };
}

export function isIpcError(value: unknown): value is IpcError {
  return typeof value === "object" && value !== null && (value as { __ipcError?: unknown }).__ipcError === true;
}
