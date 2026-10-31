-- ==============================================================================
-- AQUASENSE: PostgreSQL + PostGIS Production Spatial Database Schema
-- AI-Powered Real-Time Urban Flood Intelligence & Early-Warning System for Bengaluru
-- ==============================================================================

-- Enable PostGIS spatial extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Pilot Flood Zones (BBMP Wards)
CREATE TABLE IF NOT EXISTS zones (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    ward_number INTEGER NOT NULL,
    zone_type VARCHAR(64),
    center_geometry GEOMETRY(Point, 4326) NOT NULL,
    boundary_polygon GEOMETRY(Polygon, 4326) NOT NULL,
    elevation_m NUMERIC(6, 2) NOT NULL,
    slope_degrees NUMERIC(4, 2) NOT NULL,
    impervious_ratio NUMERIC(4, 3) NOT NULL,
    drainage_vulnerability NUMERIC(4, 3) NOT NULL,
    historical_flood_frequency INTEGER DEFAULT 0,
    lake_proximity_m NUMERIC(7, 2),
    primary_lake_name VARCHAR(128),
    swd_basin VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Sensor Metadata & Registries
CREATE TABLE IF NOT EXISTS sensors (
    id VARCHAR(64) PRIMARY KEY,
    zone_id VARCHAR(64) REFERENCES zones(id) ON DELETE CASCADE,
    sensor_type VARCHAR(64) NOT NULL, -- 'rain_gauge', 'water_level_ultrasonic', 'weather_station'
    location_name VARCHAR(128),
    geometry GEOMETRY(Point, 4326) NOT NULL,
    manufacturer VARCHAR(64),
    installation_date DATE,
    calibration_offset NUMERIC(6, 3) DEFAULT 0.0,
    status VARCHAR(32) DEFAULT 'ONLINE' -- 'ONLINE', 'DEGRADED', 'ANOMALY', 'OFFLINE'
);

-- 3. Sensor Readings (Time-Series partitioned by month in production)
CREATE TABLE IF NOT EXISTS sensor_readings (
    id BIGSERIAL PRIMARY KEY,
    sensor_id VARCHAR(64) REFERENCES sensors(id) ON DELETE CASCADE,
    zone_id VARCHAR(64) REFERENCES zones(id),
    value NUMERIC(8, 3) NOT NULL,
    unit VARCHAR(16) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    is_anomaly BOOLEAN DEFAULT FALSE,
    anomaly_reason VARCHAR(256),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Rainfall Readings
CREATE TABLE IF NOT EXISTS rainfall_readings (
    id BIGSERIAL PRIMARY KEY,
    zone_id VARCHAR(64) REFERENCES zones(id),
    rain_1h_mm NUMERIC(6, 2) NOT NULL,
    rain_24h_mm NUMERIC(6, 2) NOT NULL,
    intensity_mm_h NUMERIC(6, 2) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 5. Water Level Readings (Drainage SWD)
CREATE TABLE IF NOT EXISTS water_level_readings (
    id BIGSERIAL PRIMARY KEY,
    zone_id VARCHAR(64) REFERENCES zones(id),
    water_depth_m NUMERIC(5, 3) NOT NULL,
    hydraulic_capacity_pct NUMERIC(5, 2) NOT NULL,
    rate_of_rise_m_h NUMERIC(5, 3),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 6. Weather Forecasts
CREATE TABLE IF NOT EXISTS weather_forecasts (
    id BIGSERIAL PRIMARY KEY,
    forecast_horizon_hours INTEGER NOT NULL, -- 0, 6, 12, 24, 48
    zone_id VARCHAR(64) REFERENCES zones(id),
    expected_rainfall_mm NUMERIC(6, 2) NOT NULL,
    precipitation_probability NUMERIC(4, 3) NOT NULL,
    model_source VARCHAR(64) DEFAULT 'IMD_WRF_PROPHET',
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 7. ML Flood Predictions
CREATE TABLE IF NOT EXISTS flood_predictions (
    id BIGSERIAL PRIMARY KEY,
    zone_id VARCHAR(64) REFERENCES zones(id),
    flood_probability NUMERIC(4, 3) NOT NULL,
    risk_level VARCHAR(16) NOT NULL, -- 'LOW', 'MEDIUM', 'HIGH', 'SEVERE'
    expected_window VARCHAR(64) NOT NULL,
    model_version VARCHAR(32) DEFAULT 'XGBoost-Urban-v2.1',
    confidence VARCHAR(16) DEFAULT 'High',
    feature_contributions JSONB,
    natural_explanation TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Risk History (Historical Tracking)
CREATE TABLE IF NOT EXISTS risk_history (
    id BIGSERIAL PRIMARY KEY,
    zone_id VARCHAR(64) REFERENCES zones(id),
    probability NUMERIC(4, 3) NOT NULL,
    risk_level VARCHAR(16) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 9. Satellite Observations (Sentinel-1 SAR / Sentinel-2)
CREATE TABLE IF NOT EXISTS satellite_observations (
    id VARCHAR(64) PRIMARY KEY,
    satellite_name VARCHAR(64) NOT NULL,
    acquisition_time TIMESTAMP WITH TIME ZONE NOT NULL,
    observation_type VARCHAR(64) NOT NULL,
    resolution_m INTEGER NOT NULL,
    inundation_geometry GEOMETRY(MultiPolygon, 4326),
    predicted_extent_sq_km NUMERIC(8, 2),
    observed_extent_sq_km NUMERIC(8, 2),
    spatial_iou NUMERIC(4, 3),
    classification_status VARCHAR(64) DEFAULT 'Demo Satellite Layer'
);

-- 10. Alert Management & Lifecycle
CREATE TABLE IF NOT EXISTS alerts (
    id VARCHAR(64) PRIMARY KEY,
    zone_id VARCHAR(64) REFERENCES zones(id),
    severity VARCHAR(16) NOT NULL, -- 'HIGH', 'SEVERE', 'CRITICAL'
    trigger_type VARCHAR(64) NOT NULL,
    probability NUMERIC(4, 3) NOT NULL,
    rainfall_mm NUMERIC(6, 2) NOT NULL,
    water_level_m NUMERIC(5, 3) NOT NULL,
    expected_window VARCHAR(64),
    status VARCHAR(32) DEFAULT 'ACTIVE', -- 'ACTIVE', 'ACKNOWLEDGED', 'ESCALATED', 'RESOLVED'
    acknowledged_by VARCHAR(128),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    government_message TEXT NOT NULL,
    citizen_message_en TEXT NOT NULL,
    citizen_message_kn TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_events (
    id BIGSERIAL PRIMARY KEY,
    alert_id VARCHAR(64) REFERENCES alerts(id) ON DELETE CASCADE,
    event_type VARCHAR(32) NOT NULL, -- 'CREATED', 'ACKNOWLEDGED', 'ESCALATED', 'RESOLVED'
    actor VARCHAR(128) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Critical Infrastructure
CREATE TABLE IF NOT EXISTS infrastructure (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    infrastructure_type VARCHAR(64) NOT NULL, -- 'Hospital', 'Metro Station', 'Underpass', 'School'
    zone_id VARCHAR(64) REFERENCES zones(id),
    geometry GEOMETRY(Point, 4326) NOT NULL,
    operational_status VARCHAR(64) DEFAULT 'OPERATIONAL'
);

-- 12. Road Networks & Risk
CREATE TABLE IF NOT EXISTS roads (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    road_type VARCHAR(64) NOT NULL, -- 'Arterial', 'Sub-Arterial', 'Service Road'
    geometry GEOMETRY(LineString, 4326) NOT NULL,
    current_risk_level VARCHAR(16) DEFAULT 'LOW',
    waterlogging_depth_cm NUMERIC(5, 1) DEFAULT 0.0
);

-- 13. Historical Events (Replay Log)
CREATE TABLE IF NOT EXISTS historical_events (
    id VARCHAR(64) PRIMARY KEY,
    event_name VARCHAR(128) NOT NULL,
    event_date DATE NOT NULL,
    description TEXT,
    replay_data JSONB NOT NULL
);

-- 14. What-If Scenario Runs
CREATE TABLE IF NOT EXISTS scenario_runs (
    id VARCHAR(64) PRIMARY KEY,
    rainfall_intensity_pct NUMERIC(5, 2) NOT NULL,
    duration_hours NUMERIC(4, 1) NOT NULL,
    soil_saturation_pct NUMERIC(5, 2) NOT NULL,
    drainage_capacity_pct NUMERIC(5, 2) NOT NULL,
    results_summary JSONB NOT NULL,
    executed_by VARCHAR(128),
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. Model Versions Registry
CREATE TABLE IF NOT EXISTS model_versions (
    id VARCHAR(64) PRIMARY KEY,
    model_name VARCHAR(64) NOT NULL,
    algorithm VARCHAR(64) NOT NULL,
    training_dataset VARCHAR(128),
    evaluation_status VARCHAR(64) DEFAULT 'To be populated after model evaluation',
    deployed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. Data Sources Quality Registry
CREATE TABLE IF NOT EXISTS data_sources (
    id VARCHAR(64) PRIMARY KEY,
    source_name VARCHAR(64) NOT NULL,
    feed_type VARCHAR(32) NOT NULL,
    status VARCHAR(32) DEFAULT 'ONLINE',
    latency_ms NUMERIC(6, 1),
    quality_score_pct NUMERIC(5, 2),
    last_received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 17. System Audit Events
CREATE TABLE IF NOT EXISTS system_events (
    id BIGSERIAL PRIMARY KEY,
    component VARCHAR(64) NOT NULL,
    event_level VARCHAR(16) NOT NULL, -- 'INFO', 'WARN', 'ERROR', 'CRITICAL'
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spatial Indexes for Performant Queries
CREATE INDEX IF NOT EXISTS idx_zones_geometry ON zones USING GIST (boundary_polygon);
CREATE INDEX IF NOT EXISTS idx_zones_center ON zones USING GIST (center_geometry);
CREATE INDEX IF NOT EXISTS idx_sensors_geometry ON sensors USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_infra_geometry ON infrastructure USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_roads_geometry ON roads USING GIST (geometry);
