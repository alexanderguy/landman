-- Properties: Current state of each property
CREATE TABLE IF NOT EXISTS properties (
  -- Stable identity (hash of source + source_id)
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,              -- Plugin name (e.g., 'landwatch')
  source_id TEXT NOT NULL,           -- ID from source system
  
  -- Required fields (plugins must provide)
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  
  -- Optional core attributes
  description TEXT,
  acres REAL,
  price INTEGER,
  
  -- Location
  state TEXT,
  county TEXT,
  city TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  
  -- Features (JSON for complex types)
  has_water BOOLEAN DEFAULT 0,
  water_types TEXT,                  -- JSON: ["creek", "well", "pond"]
  water_year_round BOOLEAN,
  
  has_structures BOOLEAN DEFAULT 0,
  structure_type TEXT,               -- "house", "cabin", "barn", "raw-land"
  structure_count INTEGER,
  
  utilities TEXT,                    -- JSON: {"power": true, "internet": false}
  distance_to_town_minutes INTEGER,
  terrain_tags TEXT,                 -- JSON: ["forested", "mountain"]
  
  -- Metadata
  images TEXT,                       -- JSON: array of image URLs
  raw_data TEXT,                     -- JSON: original scraped data (for debugging)
  
  -- Calculated fields
  score INTEGER,                     -- Match score (calculated by scoring engine)
  field_completeness INTEGER,        -- Count of non-null fields (for dedup canonical selection)
  
  -- Timestamps
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  last_checked TEXT NOT NULL,
  
  UNIQUE(source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_state ON properties(state);
CREATE INDEX IF NOT EXISTS idx_price ON properties(price);
CREATE INDEX IF NOT EXISTS idx_acres ON properties(acres);
CREATE INDEX IF NOT EXISTS idx_score ON properties(score DESC);
CREATE INDEX IF NOT EXISTS idx_last_seen ON properties(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_coordinates ON properties(latitude, longitude);

-- Property snapshots: Historical record of changes
CREATE TABLE IF NOT EXISTS property_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id TEXT NOT NULL,
  scraped_at TEXT NOT NULL,
  
  -- Snapshot of all fields at this point in time
  url TEXT,
  title TEXT,
  description TEXT,
  acres REAL,
  price INTEGER,
  state TEXT,
  county TEXT,
  city TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  has_water BOOLEAN,
  water_types TEXT,
  water_year_round BOOLEAN,
  has_structures BOOLEAN,
  structure_type TEXT,
  structure_count INTEGER,
  utilities TEXT,
  distance_to_town_minutes INTEGER,
  terrain_tags TEXT,
  images TEXT,
  
  -- Always preserve raw data in snapshots
  raw_data TEXT,
  
  FOREIGN KEY(property_id) REFERENCES properties(id)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_property ON property_snapshots(property_id, scraped_at DESC);

-- Cross-source deduplication
CREATE TABLE IF NOT EXISTS property_duplicates (
  canonical_id TEXT NOT NULL,       -- Most complete property
  duplicate_id TEXT NOT NULL,       -- Duplicate property
  match_method TEXT NOT NULL,       -- "mls_number", "coordinates", "manual"
  confidence REAL NOT NULL,         -- 0.0-1.0
  detected_at TEXT NOT NULL,
  
  PRIMARY KEY(canonical_id, duplicate_id),
  FOREIGN KEY(canonical_id) REFERENCES properties(id),
  FOREIGN KEY(duplicate_id) REFERENCES properties(id)
);

CREATE INDEX IF NOT EXISTS idx_duplicates_canonical ON property_duplicates(canonical_id);

-- Price history tracking
CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id TEXT NOT NULL,
  price INTEGER NOT NULL,
  recorded_at TEXT NOT NULL,
  FOREIGN KEY(property_id) REFERENCES properties(id)
);

CREATE INDEX IF NOT EXISTS idx_price_history_property ON price_history(property_id, recorded_at DESC);

-- Search run tracking
CREATE TABLE IF NOT EXISTS search_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  properties_found INTEGER,
  sources_used TEXT,                 -- JSON: ["landwatch", "zillow"]
  filters_applied TEXT,              -- JSON: which filters each source supported
  criteria_snapshot TEXT,            -- JSON: SearchCriteria
  errors TEXT                        -- JSON: any errors encountered
);

CREATE INDEX IF NOT EXISTS idx_search_runs_profile ON search_runs(profile_name);
CREATE INDEX IF NOT EXISTS idx_search_runs_completed ON search_runs(completed_at DESC);

-- Scheduled monitoring jobs
CREATE TABLE IF NOT EXISTS monitoring_jobs (
  id TEXT PRIMARY KEY,
  profile_name TEXT NOT NULL,
  schedule TEXT NOT NULL,              -- cron expression (e.g., "0 9 * * *")
  enabled BOOLEAN NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_run_at TEXT,
  next_run_at TEXT,
  notification_channels TEXT           -- JSON: ["console", "file", "email"]
);

CREATE INDEX IF NOT EXISTS idx_monitoring_jobs_profile ON monitoring_jobs(profile_name);
CREATE INDEX IF NOT EXISTS idx_monitoring_jobs_enabled ON monitoring_jobs(enabled);

-- Job execution history
CREATE TABLE IF NOT EXISTS monitoring_job_runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,                -- "running", "completed", "failed"
  error TEXT,
  new_properties INTEGER,
  price_changes INTEGER,
  total_properties INTEGER,
  
  FOREIGN KEY(job_id) REFERENCES monitoring_jobs(id)
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job ON monitoring_job_runs(job_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_runs_status ON monitoring_job_runs(status);
