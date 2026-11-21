/**
 * Compile-time stand-in for the framework's `@/lib/api-client` barrel.
 *
 * The real barrel ships with the fewbie template, not with an item, so the
 * registry cannot import it. This stub mirrors the subset items use so
 * `npm run check:types` verifies the call sites without a host checkout.
 */

export interface ApiClientStub {
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
  get<T = unknown>(path: string, params?: unknown): Promise<T>;
}

export const apiClient: ApiClientStub = {
  post: async () => {
    throw new Error("api-client harness stub: post() is not executable");
  },
  get: async () => {
    throw new Error("api-client harness stub: get() is not executable");
  },
};

export function getAccessToken(): string | null {
  return null;
}

export function setSession(_token: string, _expiresInSeconds?: number): void {}

export function clearSession(): void {}

export function onSessionExpired(_handler: () => void): () => void {
  return () => {};
}
