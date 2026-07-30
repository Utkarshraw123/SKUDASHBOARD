-- Identity & configuration
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('supervisor','manager','admin')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS operators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS machines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checklist_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE (code, version)
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES checklist_templates(id),
  sort_order INTEGER NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  critical INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

-- Operational data
CREATE TABLE IF NOT EXISTS readiness_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  template_id INTEGER NOT NULL REFERENCES checklist_templates(id),
  start_completed_by INTEGER REFERENCES users(id),
  start_completed_at TEXT,
  start_cross_check_by INTEGER REFERENCES users(id),
  end_completed_by INTEGER REFERENCES users(id),
  end_completed_at TEXT,
  end_cross_check_by INTEGER REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','started','closed'))
);

CREATE TABLE IF NOT EXISTS readiness_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  readiness_day_id INTEGER NOT NULL REFERENCES readiness_days(id),
  item_id INTEGER NOT NULL REFERENCES checklist_items(id),
  phase TEXT NOT NULL CHECK (phase IN ('start','end')),
  result TEXT NOT NULL CHECK (result IN ('confirm','deny')),
  comment TEXT,
  checked_by INTEGER NOT NULL REFERENCES users(id),
  checked_at TEXT NOT NULL,
  UNIQUE (readiness_day_id, item_id, phase)
);

CREATE TABLE IF NOT EXISTS runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  shift TEXT NOT NULL,
  machine_id INTEGER NOT NULL REFERENCES machines(id),
  operator_id INTEGER NOT NULL REFERENCES operators(id),
  product_sku TEXT NOT NULL,
  product_desc TEXT NOT NULL,
  planned_qty REAL,
  actual_qty REAL,
  start_time TEXT,
  end_time TEXT,
  downtime_min REAL,
  comments TEXT,
  logged_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  void INTEGER NOT NULL DEFAULT 0,
  void_reason TEXT,
  voided_by INTEGER REFERENCES users(id),
  voided_at TEXT
);

-- Accountability
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create','update','void')),
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  changed_by INTEGER NOT NULL REFERENCES users(id),
  changed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_runs_date ON runs(date);
CREATE INDEX IF NOT EXISTS idx_runs_operator ON runs(operator_id);
CREATE INDEX IF NOT EXISTS idx_checks_day ON readiness_checks(readiness_day_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
