-- PostgreSQL Schema for Time Tracker

CREATE TABLE IF NOT EXISTS visits (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) NOT NULL,
    duration_seconds INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries on domains
CREATE INDEX idx_domain ON visits(domain);
