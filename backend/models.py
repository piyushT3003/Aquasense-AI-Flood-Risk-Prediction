"""
AQUASENSE - Data Models (Pydantic)
"""
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from datetime import datetime

class ZoneCoordinates(BaseModel):
    lat: float
    lng: float

class ZoneGeoJSON(BaseModel):
    type: str = "Polygon"
    coordinates: List[List[List[float]]]

class ZoneBase(BaseModel):
    id: str
    name: str
    ward_number: int
    zone_type: str  # "Commercial/Tech", "Residential Basin", "Transit Interchange", etc.
    center: ZoneCoordinates
    elevation_m: float
    slope_degrees: float
    impervious_ratio: float
    drainage_vulnerability: float  # 0.0 - 1.0 (higher = worse drainage)
    historical_flood_frequency: int  # count of flood events in past 10 years
    lake_proximity_m: float
    primary_lake_name: str
    critical_infrastructure_count: int

class SensorReading(BaseModel):
    sensor_id: str
    sensor_type: str  # "rain_gauge", "water_level_ultrasonic", "weather_station", "soil_moisture"
    zone_id: str
    location_name: str
    value: float
    unit: str
    timestamp: str
    status: str  # "ONLINE", "ANOMALY", "DEGRADED", "OFFLINE"
    is_anomaly: bool = False
    anomaly_reason: Optional[str] = None

class FeatureContribution(BaseModel):
    feature_name: str
    display_name: str
    importance_score: float  # SHAP value
    direction: str  # "increases_risk", "decreases_risk"
    current_value_formatted: str

class FloodPrediction(BaseModel):
    zone_id: str
    zone_name: str
    ward_number: int
    flood_probability: float  # 0.0 to 1.0
    risk_level: str  # "LOW", "MEDIUM", "HIGH", "SEVERE"
    expected_window_hours: str  # e.g., "Next 3-6 hours"
    rainfall_1h_mm: float
    rainfall_24h_mm: float
    water_level_m: float
    soil_saturation_pct: float
    prediction_confidence: str  # "High", "Moderate"
    feature_contributions: List[FeatureContribution]
    natural_explanation: str
    data_freshness_seconds: int
    last_updated: str
    risk_score: float = 0.0                 # banded 0-1 index for colours/ranking
    forecast_6h_mm: float = 0.0
    peak_probability_24h: float = 0.0
    peak_level_24h: str = "LOW"
    peak_in_h: int = 0
    hours_to_high: Optional[int] = None
    hours_to_severe: Optional[int] = None
    trajectory: List[float] = []            # risk score, now .. +48 h
    trajectory_probability: List[float] = []
    observed_flooding: bool = False
    drain_load_pct: float = 0.0

class AlertItem(BaseModel):
    id: str
    zone_id: str
    zone_name: str
    ward_number: int
    severity: str  # "HIGH", "SEVERE", "CRITICAL"
    trigger_type: str  # "FORECAST_THREAT", "RISK_TRANSITION", "RAPID_RATE_OF_RISE", "OBSERVED_FLOODING"
    probability: float
    rainfall_mm: float
    water_level_m: float
    expected_window: str
    timestamp: str
    status: str  # "ACTIVE", "ACKNOWLEDGED", "ESCALATED", "RESOLVED"
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[str] = None
    resolved_by: Optional[str] = None
    lead_time_h: Optional[int] = None
    top_driver: Optional[str] = None
    government_message: str
    citizen_message_en: str
    citizen_message_kn: str

class WhatIfRequest(BaseModel):
    rainfall_intensity_mm_h: float = Field(45.0, ge=0, le=150)   # storm intensity
    duration_hours: float = Field(3.0, ge=0.5, le=12)
    antecedent_rainfall_mm: float = Field(40.0, ge=0, le=250)   # rain in the 3 days before
    drainage_capacity_pct: float = Field(100.0, ge=20, le=120)   # 100 = drains as built
    lake_fill_pct: float = Field(80.0, ge=40, le=120)            # lakes' fill before the storm

class WhatIfResponse(BaseModel):
    scenario_id: str
    baseline_affected_area_sq_km: float = 0.0
    scenario_affected_area_sq_km: float = 0.0
    drains_overflowing: int = 0
    baseline_high_risk_zones: int
    baseline_severe_risk_zones: int
    scenario_high_risk_zones: int
    scenario_severe_risk_zones: int
    delta_affected_area_sq_km: float
    zone_deltas: List[Dict[str, Any]]
    summary_insight: str

class GenAIQueryRequest(BaseModel):
    query: str
    role: str = "Disaster Management Officer"
    gemini_api_key: Optional[str] = None   # optional key from the Settings page

class GenAIQueryResponse(BaseModel):
    query: str
    answer: str
    data_sources_consulted: List[str]
    confidence_level: str
    relevant_zones: List[str]
    timestamp: str

class SystemHealthItem(BaseModel):
    component: str
    status: str  # "ONLINE", "DEGRADED", "OFFLINE"
    latency_ms: float
    records_processed: int
    last_heartbeat: str
    details: str

class SatelliteObservation(BaseModel):
    satellite_name: str  # "Sentinel-1 SAR C-band"
    acquisition_time: str
    observation_type: str  # "Synthetic Aperture Radar Inundation Extent"
    resolution_m: int
    affected_zones: List[str]
    predicted_extent_sq_km: float
    observed_extent_sq_km: float
    spatial_iou: float  # Intersection over Union
    classification_status: str  # "Demo Satellite Layer"
