export const GET_LOGIN_THROTTLE_SQL = `SELECT failures, window_started_at FROM auth_login_throttle WHERE key = ?`;

export const RECORD_LOGIN_FAILURE_SQL = `
  INSERT INTO auth_login_throttle (key, failures, window_started_at) VALUES (?, 1, ?)
  ON CONFLICT (key) DO UPDATE SET
    failures = CASE WHEN auth_login_throttle.window_started_at <= ? THEN 1 ELSE auth_login_throttle.failures + 1 END,
    window_started_at = CASE
      WHEN auth_login_throttle.window_started_at <= ? THEN excluded.window_started_at
      ELSE auth_login_throttle.window_started_at
    END
`;

export const CLEAR_LOGIN_THROTTLE_SQL = `DELETE FROM auth_login_throttle WHERE key = ?`;

export const PRUNE_LOGIN_THROTTLE_SQL = `DELETE FROM auth_login_throttle WHERE window_started_at <= ?`;
