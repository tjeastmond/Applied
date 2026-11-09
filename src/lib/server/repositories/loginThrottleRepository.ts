export type LoginThrottleRecord = {
  failures: number;
  windowStartedAt: number;
};

export interface LoginThrottleRepository {
  get(key: string): Promise<LoginThrottleRecord | null> | LoginThrottleRecord | null;
  /** Count one failure; starts a new window when the current one began at or before `windowCutoff`. */
  recordFailure(key: string, now: number, windowCutoff: number): Promise<void> | void;
  clear(key: string): Promise<void> | void;
  pruneExpired(windowCutoff: number): Promise<void> | void;
}
