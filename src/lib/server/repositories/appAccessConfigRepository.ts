export interface AppAccessConfigRepository {
  getToken(): string | null;
  ensureToken(): string;
}
