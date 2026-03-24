-- pg_stat_statements Setup Script
-- This script enables the pg_stat_statements extension to track query performance
-- Run this once in production to enable query performance monitoring

-- Enable pg_stat_statements extension (requires superuser or extension already created)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create a view to easily get top 10 slowest queries
-- This helps identify queries that need optimization
CREATE OR REPLACE VIEW top_slow_queries AS
SELECT 
    query,
    calls,
    mean_exec_time AS avg_time_ms,
    total_exec_time AS total_time_ms,
    rows,
    (mean_exec_time * calls) AS total_impact
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Create a view for queries with most total time impact
CREATE OR REPLACE VIEW most_resource_intensive_queries AS
SELECT 
    query,
    calls,
    mean_exec_time AS avg_time_ms,
    total_exec_time AS total_time_ms,
    rows,
    shared_blks_hit,
    shared_blks_read,
    shared_blks_written,
    temp_blks_read,
    temp_blks_written
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY total_exec_time DESC
LIMIT 10;

-- Create a view for queries with most I/O impact
CREATE OR REPLACE VIEW highest_io_queries AS
SELECT 
    query,
    calls,
    shared_blks_hit,
    shared_blks_read,
    shared_blks_written,
    temp_blks_read,
    temp_blks_written,
    (shared_blks_read + temp_blks_read) AS total_blocks_read
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY (shared_blks_read + temp_blks_read) DESC
LIMIT 10;

-- Function to reset statistics (for testing or periodic monitoring)
CREATE OR REPLACE FUNCTION reset_query_stats()
RETURNS void
LANGUAGE sql
AS $$
    SELECT pg_stat_statements_reset();
$$;

-- Function to get query statistics for a specific table
CREATE OR REPLACE FUNCTION get_table_query_stats(p_table_name TEXT)
RETURNS TABLE (
    query TEXT,
    calls BIGINT,
    avg_time_ms DOUBLE PRECISION,
    total_time_ms DOUBLE PRECISION,
    rows BIGINT
)
LANGUAGE sql
AS $$
    SELECT 
        query,
        calls,
        mean_exec_time AS avg_time_ms,
        total_exec_time AS total_time_ms,
        rows
    FROM pg_stat_statements
    WHERE query LIKE '%' || p_table_name || '%'
      AND query NOT LIKE '%pg_stat_statements%'
    ORDER BY mean_exec_time DESC
    LIMIT 10;
$$;
