"""
AQUASENSE - Geospatial Seed Data for Bengaluru 18 Pilot Zones, Lakes, Drains, and Infrastructure
"""

PILOT_ZONES = [
    {
        "id": "zone-1",
        "name": "Bellandur",
        "ward_number": 150,
        "zone_type": "Tech Corridor / Lake Outlet",
        "center": {"lat": 12.9304, "lng": 77.6784},
        "elevation_m": 880.5,
        "slope_degrees": 1.2,
        "impervious_ratio": 0.88,
        "drainage_vulnerability": 0.92,
        "historical_flood_frequency": 14,
        "lake_proximity_m": 120.0,
        "primary_lake_name": "Bellandur Lake",
        "critical_infrastructure_count": 8,
        "baseline_rain_mm": 64.0,
        "baseline_water_level_m": 2.4,
        "baseline_soil_sat": 82.0,
        "swd_basin": "Koramangala-Challaghatta (KC) Valley",
        "boundary_polygon": [
            [77.6650, 12.9380], [77.6920, 12.9380], [77.6950, 12.9220],
            [77.6680, 12.9210], [77.6650, 12.9380]
        ]
    },
    {
        "id": "zone-2",
        "name": "Silk Board Junction",
        "ward_number": 173,
        "zone_type": "Major Arterial Transit Hub",
        "center": {"lat": 12.9177, "lng": 77.6238},
        "elevation_m": 874.0,
        "slope_degrees": 0.8,
        "impervious_ratio": 0.94,
        "drainage_vulnerability": 0.95,
        "historical_flood_frequency": 18,
        "lake_proximity_m": 350.0,
        "primary_lake_name": "Madiwala Lake",
        "critical_infrastructure_count": 9,
        "baseline_rain_mm": 58.0,
        "baseline_water_level_m": 2.1,
        "baseline_soil_sat": 78.0,
        "swd_basin": "Madiwala / KC Valley",
        "boundary_polygon": [
            [77.6150, 12.9250], [77.6320, 12.9250], [77.6330, 12.9110],
            [77.6140, 12.9100], [77.6150, 12.9250]
        ]
    },
    {
        "id": "zone-3",
        "name": "Koramangala 4th Block",
        "ward_number": 151,
        "zone_type": "Dense Commercial / Residential",
        "center": {"lat": 12.9352, "lng": 77.6245},
        "elevation_m": 878.0,
        "slope_degrees": 1.1,
        "impervious_ratio": 0.89,
        "drainage_vulnerability": 0.88,
        "historical_flood_frequency": 16,
        "lake_proximity_m": 600.0,
        "primary_lake_name": "Agara Lake / SWD Channel",
        "critical_infrastructure_count": 7,
        "baseline_rain_mm": 52.0,
        "baseline_water_level_m": 1.8,
        "baseline_soil_sat": 74.0,
        "swd_basin": "KC Valley Primary Drain",
        "boundary_polygon": [
            [77.6180, 12.9420], [77.6340, 12.9420], [77.6350, 12.9280],
            [77.6190, 12.9270], [77.6180, 12.9420]
        ]
    },
    {
        "id": "zone-4",
        "name": "HSR Layout Sector 6 & 7",
        "ward_number": 174,
        "zone_type": "Planned Residential Basin",
        "center": {"lat": 12.9116, "lng": 77.6389},
        "elevation_m": 883.0,
        "slope_degrees": 1.4,
        "impervious_ratio": 0.82,
        "drainage_vulnerability": 0.81,
        "historical_flood_frequency": 11,
        "lake_proximity_m": 400.0,
        "primary_lake_name": "Agara Lake",
        "critical_infrastructure_count": 6,
        "baseline_rain_mm": 49.0,
        "baseline_water_level_m": 1.5,
        "baseline_soil_sat": 70.0,
        "swd_basin": "Agara Downstream Drain",
        "boundary_polygon": [
            [77.6290, 12.9190], [77.6490, 12.9190], [77.6500, 12.9040],
            [77.6300, 12.9030], [77.6290, 12.9190]
        ]
    },
    {
        "id": "zone-5",
        "name": "Rainbow Drive Layout",
        "ward_number": 149,
        "zone_type": "Low-Lying Enclosed Valley",
        "center": {"lat": 12.9160, "lng": 77.7080},
        "elevation_m": 870.0,
        "slope_degrees": 0.6,
        "impervious_ratio": 0.79,
        "drainage_vulnerability": 0.96,
        "historical_flood_frequency": 12,
        "lake_proximity_m": 300.0,
        "primary_lake_name": "Halanayakanahalli Lake",
        "critical_infrastructure_count": 4,
        "baseline_rain_mm": 61.0,
        "baseline_water_level_m": 2.3,
        "baseline_soil_sat": 84.0,
        "swd_basin": "Sarjapur Valley Outlet",
        "boundary_polygon": [
            [77.6980, 12.9230], [77.7170, 12.9230], [77.7180, 12.9090],
            [77.6990, 12.9080], [77.6980, 12.9230]
        ]
    },
    {
        "id": "zone-6",
        "name": "EcoSpace Outer Ring Road",
        "ward_number": 150,
        "zone_type": "High-Value IT Park Corridor",
        "center": {"lat": 12.9260, "lng": 77.6840},
        "elevation_m": 879.0,
        "slope_degrees": 0.9,
        "impervious_ratio": 0.92,
        "drainage_vulnerability": 0.91,
        "historical_flood_frequency": 13,
        "lake_proximity_m": 210.0,
        "primary_lake_name": "Bellandur Wetland Fringe",
        "critical_infrastructure_count": 8,
        "baseline_rain_mm": 60.0,
        "baseline_water_level_m": 2.2,
        "baseline_soil_sat": 80.0,
        "swd_basin": "ORR Storm Drain Culvert",
        "boundary_polygon": [
            [77.6760, 12.9320], [77.6930, 12.9320], [77.6940, 12.9200],
            [77.6770, 12.9190], [77.6760, 12.9320]
        ]
    },
    {
        "id": "zone-7",
        "name": "Manyata Tech Park",
        "ward_number": 6,
        "zone_type": "North IT Corridor / Nagawara Valley",
        "center": {"lat": 13.0475, "lng": 77.6214},
        "elevation_m": 892.0,
        "slope_degrees": 1.0,
        "impervious_ratio": 0.91,
        "drainage_vulnerability": 0.85,
        "historical_flood_frequency": 9,
        "lake_proximity_m": 280.0,
        "primary_lake_name": "Nagawara Lake",
        "critical_infrastructure_count": 7,
        "baseline_rain_mm": 44.0,
        "baseline_water_level_m": 1.4,
        "baseline_soil_sat": 68.0,
        "swd_basin": "Hebbal-Nagawara Drain",
        "boundary_polygon": [
            [77.6110, 13.0560], [77.6320, 13.0560], [77.6330, 13.0390],
            [77.6120, 13.0380], [77.6110, 13.0560]
        ]
    },
    {
        "id": "zone-8",
        "name": "Hebbal Flyover Junction",
        "ward_number": 7,
        "zone_type": "Airport Expressway Node",
        "center": {"lat": 13.0358, "lng": 77.5970},
        "elevation_m": 898.0,
        "slope_degrees": 1.3,
        "impervious_ratio": 0.89,
        "drainage_vulnerability": 0.79,
        "historical_flood_frequency": 8,
        "lake_proximity_m": 150.0,
        "primary_lake_name": "Hebbal Lake",
        "critical_infrastructure_count": 6,
        "baseline_rain_mm": 41.0,
        "baseline_water_level_m": 1.2,
        "baseline_soil_sat": 65.0,
        "swd_basin": "Hebbal Lake Spillway",
        "boundary_polygon": [
            [77.5870, 13.0440], [77.6070, 13.0440], [77.6080, 13.0280],
            [77.5880, 13.0270], [77.5870, 13.0440]
        ]
    },
    {
        "id": "zone-9",
        "name": "Mahadevapura ORR",
        "ward_number": 82,
        "zone_type": "Industrial & Tech Corridor",
        "center": {"lat": 12.9915, "lng": 77.6975},
        "elevation_m": 886.0,
        "slope_degrees": 1.2,
        "impervious_ratio": 0.85,
        "drainage_vulnerability": 0.84,
        "historical_flood_frequency": 10,
        "lake_proximity_m": 450.0,
        "primary_lake_name": "Mahadevapura Kere",
        "critical_infrastructure_count": 7,
        "baseline_rain_mm": 48.0,
        "baseline_water_level_m": 1.6,
        "baseline_soil_sat": 72.0,
        "swd_basin": "K.R. Puram Catchment",
        "boundary_polygon": [
            [77.6870, 13.0000], [77.7080, 13.0000], [77.7090, 12.9830],
            [77.6880, 12.9820], [77.6870, 13.0000]
        ]
    },
    {
        "id": "zone-10",
        "name": "Whitefield Kadugodi",
        "ward_number": 84,
        "zone_type": "ITPL Tech & Railway Corridor",
        "center": {"lat": 12.9698, "lng": 77.7499},
        "elevation_m": 895.0,
        "slope_degrees": 1.5,
        "impervious_ratio": 0.81,
        "drainage_vulnerability": 0.76,
        "historical_flood_frequency": 7,
        "lake_proximity_m": 500.0,
        "primary_lake_name": "Kundalahalli Lake",
        "critical_infrastructure_count": 8,
        "baseline_rain_mm": 38.0,
        "baseline_water_level_m": 1.1,
        "baseline_soil_sat": 63.0,
        "swd_basin": "Channasandra Outfall",
        "boundary_polygon": [
            [77.7390, 12.9790], [77.7610, 12.9790], [77.7620, 12.9610],
            [77.7400, 12.9600], [77.7390, 12.9790]
        ]
    },
    {
        "id": "zone-11",
        "name": "Marathahalli Underpass",
        "ward_number": 85,
        "zone_type": "Critical Road Depression",
        "center": {"lat": 12.9562, "lng": 77.7011},
        "elevation_m": 876.0,
        "slope_degrees": 2.2,
        "impervious_ratio": 0.95,
        "drainage_vulnerability": 0.94,
        "historical_flood_frequency": 17,
        "lake_proximity_m": 350.0,
        "primary_lake_name": "Marathahalli Kere",
        "critical_infrastructure_count": 6,
        "baseline_rain_mm": 55.0,
        "baseline_water_level_m": 2.0,
        "baseline_soil_sat": 76.0,
        "swd_basin": "Spice Garden SWD Sump",
        "boundary_polygon": [
            [77.6920, 12.9640], [77.7110, 12.9640], [77.7120, 12.9480],
            [77.6930, 12.9470], [77.6920, 12.9640]
        ]
    },
    {
        "id": "zone-12",
        "name": "Varthur Kodi",
        "ward_number": 149,
        "zone_type": "Downstream Drainage Sump",
        "center": {"lat": 12.9406, "lng": 77.7466},
        "elevation_m": 868.0,
        "slope_degrees": 0.7,
        "impervious_ratio": 0.75,
        "drainage_vulnerability": 0.93,
        "historical_flood_frequency": 15,
        "lake_proximity_m": 80.0,
        "primary_lake_name": "Varthur Lake",
        "critical_infrastructure_count": 5,
        "baseline_rain_mm": 57.0,
        "baseline_water_level_m": 2.2,
        "baseline_soil_sat": 85.0,
        "swd_basin": "Varthur Lake Outflow Spillway",
        "boundary_polygon": [
            [77.7360, 12.9490], [77.7570, 12.9490], [77.7580, 12.9320],
            [77.7370, 12.9310], [77.7360, 12.9490]
        ]
    },
    {
        "id": "zone-13",
        "name": "Bommanahalli Garvebhavipalya",
        "ward_number": 175,
        "zone_type": "Dense Mixed Residential",
        "center": {"lat": 12.8984, "lng": 77.6293},
        "elevation_m": 885.0,
        "slope_degrees": 1.0,
        "impervious_ratio": 0.90,
        "drainage_vulnerability": 0.87,
        "historical_flood_frequency": 12,
        "lake_proximity_m": 420.0,
        "primary_lake_name": "Begur Lake",
        "critical_infrastructure_count": 6,
        "baseline_rain_mm": 47.0,
        "baseline_water_level_m": 1.7,
        "baseline_soil_sat": 71.0,
        "swd_basin": "Hosur Road Primary Culvert",
        "boundary_polygon": [
            [77.6190, 12.9060], [77.6400, 12.9060], [77.6410, 12.8900],
            [77.6200, 12.8890], [77.6190, 12.9060]
        ]
    },
    {
        "id": "zone-14",
        "name": "Bannerghatta Road Bilekahalli",
        "ward_number": 188,
        "zone_type": "South Arterial Corridor",
        "center": {"lat": 12.8988, "lng": 77.5992},
        "elevation_m": 894.0,
        "slope_degrees": 1.3,
        "impervious_ratio": 0.86,
        "drainage_vulnerability": 0.83,
        "historical_flood_frequency": 9,
        "lake_proximity_m": 350.0,
        "primary_lake_name": "Hulimavu Lake",
        "critical_infrastructure_count": 5,
        "baseline_rain_mm": 42.0,
        "baseline_water_level_m": 1.3,
        "baseline_soil_sat": 66.0,
        "swd_basin": "Hulimavu Overflow Canal",
        "boundary_polygon": [
            [77.5890, 12.9070], [77.6090, 12.9070], [77.6100, 12.8910],
            [77.5900, 12.8900], [77.5890, 12.9070]
        ]
    },
    {
        "id": "zone-15",
        "name": "Nayandahalli Mysore Road",
        "ward_number": 131,
        "zone_type": "Transit Interchange / Valley Basin",
        "center": {"lat": 12.9431, "lng": 77.5218},
        "elevation_m": 862.0,
        "slope_degrees": 0.9,
        "impervious_ratio": 0.87,
        "drainage_vulnerability": 0.90,
        "historical_flood_frequency": 14,
        "lake_proximity_m": 290.0,
        "primary_lake_name": "Nayandahalli Kere",
        "critical_infrastructure_count": 7,
        "baseline_rain_mm": 51.0,
        "baseline_water_level_m": 1.9,
        "baseline_soil_sat": 75.0,
        "swd_basin": "Vrishabhavathi River Basin",
        "boundary_polygon": [
            [77.5120, 12.9510], [77.5320, 12.9510], [77.5330, 12.9350],
            [77.5130, 12.9340], [77.5120, 12.9510]
        ]
    },
    {
        "id": "zone-16",
        "name": "Majestic Okalipuram",
        "ward_number": 95,
        "zone_type": "Central Terminal & Underpass",
        "center": {"lat": 12.9781, "lng": 77.5726},
        "elevation_m": 905.0,
        "slope_degrees": 1.8,
        "impervious_ratio": 0.96,
        "drainage_vulnerability": 0.89,
        "historical_flood_frequency": 15,
        "lake_proximity_m": 900.0,
        "primary_lake_name": "Dharmambudhi Historical Tank",
        "critical_infrastructure_count": 10,
        "baseline_rain_mm": 48.0,
        "baseline_water_level_m": 1.8,
        "baseline_soil_sat": 73.0,
        "swd_basin": "City Railway Culvert Complex",
        "boundary_polygon": [
            [77.5630, 12.9860], [77.5820, 12.9860], [77.5830, 12.9700],
            [77.5640, 12.9690], [77.5630, 12.9860]
        ]
    },
    {
        "id": "zone-17",
        "name": "Shivajinagar Cantonment",
        "ward_number": 92,
        "zone_type": "Heritage Commercial / High Density",
        "center": {"lat": 12.9857, "lng": 77.6057},
        "elevation_m": 915.0,
        "slope_degrees": 1.4,
        "impervious_ratio": 0.95,
        "drainage_vulnerability": 0.86,
        "historical_flood_frequency": 11,
        "lake_proximity_m": 650.0,
        "primary_lake_name": "Ulsoor Lake",
        "critical_infrastructure_count": 8,
        "baseline_rain_mm": 45.0,
        "baseline_water_level_m": 1.5,
        "baseline_soil_sat": 69.0,
        "swd_basin": "Ulsoor Inflow Drain",
        "boundary_polygon": [
            [77.5960, 12.9940], [77.6160, 12.9940], [77.6170, 12.9770],
            [77.5970, 12.9760], [77.5960, 12.9940]
        ]
    },
    {
        "id": "zone-18",
        "name": "Rajajinagar 1st Block",
        "ward_number": 10,
        "zone_type": "West Ridge-to-Valley Residential",
        "center": {"lat": 12.9912, "lng": 77.5540},
        "elevation_m": 925.0,
        "slope_degrees": 2.5,
        "impervious_ratio": 0.88,
        "drainage_vulnerability": 0.74,
        "historical_flood_frequency": 6,
        "lake_proximity_m": 800.0,
        "primary_lake_name": "Sankey Tank Catchment",
        "critical_infrastructure_count": 6,
        "baseline_rain_mm": 35.0,
        "baseline_water_level_m": 1.0,
        "baseline_soil_sat": 60.0,
        "swd_basin": "Bashyam Circle SWD",
        "boundary_polygon": [
            [77.5440, 13.0000], [77.5640, 13.0000], [77.5650, 12.9830],
            [77.5450, 12.9820], [77.5440, 13.0000]
        ]
    }
]

BENGALURU_LAKES = [
    {
        "id": "lake-1",
        "name": "Bellandur Lake",
        "area_acres": 910,
        "capacity_mcm": 17.5,
        "current_full_pct": 92.4,
        "status": "CRITICAL_SPILLWAY_AT_CAPACITY",
        "coords": [
            [77.660, 12.945], [77.685, 12.940], [77.690, 12.925],
            [77.670, 12.920], [77.655, 12.935], [77.660, 12.945]
        ]
    },
    {
        "id": "lake-2",
        "name": "Varthur Lake",
        "area_acres": 440,
        "capacity_mcm": 8.2,
        "current_full_pct": 89.1,
        "status": "NEAR_FULL",
        "coords": [
            [77.730, 12.945], [77.750, 12.950], [77.760, 12.935],
            [77.740, 12.930], [77.730, 12.945]
        ]
    },
    {
        "id": "lake-3",
        "name": "Agara Lake",
        "area_acres": 140,
        "capacity_mcm": 2.9,
        "current_full_pct": 84.6,
        "status": "ELEVATED",
        "coords": [
            [77.640, 12.925], [77.652, 12.922], [77.650, 12.915],
            [77.638, 12.918], [77.640, 12.925]
        ]
    },
    {
        "id": "lake-4",
        "name": "Madiwala Lake",
        "area_acres": 270,
        "capacity_mcm": 4.6,
        "current_full_pct": 88.0,
        "status": "NEAR_FULL",
        "coords": [
            [77.610, 12.915], [77.625, 12.918], [77.624, 12.905],
            [77.608, 12.906], [77.610, 12.915]
        ]
    },
    {
        "id": "lake-5",
        "name": "Hebbal Lake",
        "area_acres": 150,
        "capacity_mcm": 3.1,
        "current_full_pct": 76.5,
        "status": "CONTROLLED",
        "coords": [
            [77.585, 13.045], [77.600, 13.042], [77.598, 13.032],
            [77.583, 13.035], [77.585, 13.045]
        ]
    },
    {
        "id": "lake-6",
        "name": "Ulsoor Lake",
        "area_acres": 120,
        "capacity_mcm": 2.4,
        "current_full_pct": 72.0,
        "status": "NORMAL",
        "coords": [
            [77.615, 12.986], [77.626, 12.984], [77.624, 12.976],
            [77.614, 12.978], [77.615, 12.986]
        ]
    }
]

PRIMARY_STORMWATER_DRAINS = [
    {
        "name": "Koramangala-Challaghatta (KC) Valley Primary SWD",
        "length_km": 28.5,
        "vulnerability": "SEVERE",
        "status": "HIGH_SILTATION_BOTTLENECK",
        "path": [
            [77.605, 12.955], [77.625, 12.935], [77.650, 12.925],
            [77.675, 12.930], [77.740, 12.940]
        ]
    },
    {
        "name": "Vrishabhavathi Valley Trunk Drain",
        "length_km": 32.0,
        "vulnerability": "HIGH",
        "status": "ELEVATED_RUNOFF",
        "path": [
            [77.545, 12.985], [77.530, 12.960], [77.520, 12.940],
            [77.505, 12.910], [77.490, 12.870]
        ]
    },
    {
        "name": "Hebbal Valley Outfall Canal",
        "length_km": 19.2,
        "vulnerability": "MEDIUM",
        "status": "FLOWING_NORMAL",
        "path": [
            [77.575, 13.020], [77.595, 13.035], [77.620, 13.045],
            [77.660, 13.060]
        ]
    }
]

CRITICAL_INFRASTRUCTURE = [
    {"name": "Sakra World Hospital", "type": "Hospital", "zone_id": "zone-1", "coords": [77.683, 12.929], "status": "ACCESS_WARNING"},
    {"name": "Manipal Hospital Old Airport Rd", "type": "Hospital", "zone_id": "zone-3", "coords": [77.652, 12.958], "status": "OPEN"},
    {"name": "St. John's Medical College Hospital", "type": "Hospital", "zone_id": "zone-2", "coords": [77.621, 12.931], "status": "OPEN"},
    {"name": "Aster CMI Hospital Hebbal", "type": "Hospital", "zone_id": "zone-8", "coords": [77.593, 13.054], "status": "OPEN"},
    {"name": "Silk Board Metro Interchange", "type": "Metro Station", "zone_id": "zone-2", "coords": [77.624, 12.918], "status": "HIGH_PUDDLE_RISK"},
    {"name": "Majestic Transit Terminal", "type": "Metro / Bus Terminal", "zone_id": "zone-16", "coords": [77.571, 12.977], "status": "OPERATIONAL"},
    {"name": "Marathahalli Kalamandir Underpass", "type": "Underpass", "zone_id": "zone-11", "coords": [77.701, 12.956], "status": "WATERLOGGED_CLOSED"},
    {"name": "Okalipuram Railway Underpass", "type": "Underpass", "zone_id": "zone-16", "coords": [77.568, 12.981], "status": "PUMP_ACTIVE"},
    {"name": "Windsor Manor Underpass", "type": "Underpass", "zone_id": "zone-17", "coords": [77.587, 12.998], "status": "CLEAR"},
    {"name": "Outer Ring Road (EcoSpace stretch)", "type": "Major Arterial Road", "zone_id": "zone-6", "coords": [77.684, 12.926], "status": "TRAFFIC_RESTRICTED"}
]

HISTORICAL_DELUGE_2022 = {
    "event_name": "Bengaluru Deluge - September 2022",
    "description": "Unprecedented urban cloudburst delivering 131.6 mm of rain within 6 hours across East & South Bengaluru, inundating Outer Ring Road tech corridors and low-lying layouts.",
    "timesteps": [
        {
            "step": "T-24h",
            "label": "24 Hours Before Peak",
            "rainfall_accum_mm": 28.0,
            "soil_saturation_pct": 65,
            "high_risk_zones": 3,
            "severe_risk_zones": 0,
            "notes": "Antecedent monsoon showers saturated topsoil in Bellandur & KC Valley catchments."
        },
        {
            "step": "T-12h",
            "label": "12 Hours Before Peak",
            "rainfall_accum_mm": 54.0,
            "soil_saturation_pct": 78,
            "high_risk_zones": 6,
            "severe_risk_zones": 1,
            "notes": "Lakes reached 90% full capacity; stormwater channels showed elevated baseline discharge."
        },
        {
            "step": "T-6h",
            "label": "6 Hours Before Peak",
            "rainfall_accum_mm": 89.0,
            "soil_saturation_pct": 91,
            "high_risk_zones": 10,
            "severe_risk_zones": 4,
            "notes": "Cloudburst intensified over Bellandur, Marathahalli, and Silk Board. Rain gauge alarms triggered."
        },
        {
            "step": "EVENT",
            "label": "Peak Inundation Crisis",
            "rainfall_accum_mm": 131.6,
            "soil_saturation_pct": 99,
            "high_risk_zones": 14,
            "severe_risk_zones": 8,
            "notes": "Bellandur lake spilled over; EcoSpace ORR, Rainbow Drive, and Silk Board submerged under 2-4 ft water."
        },
        {
            "step": "RECOVERY",
            "label": "Post-Crisis Drainage & Recovery",
            "rainfall_accum_mm": 134.0,
            "soil_saturation_pct": 82,
            "high_risk_zones": 4,
            "severe_risk_zones": 1,
            "notes": "Emergency de-watering pumps and breach repairs enabled slow channel drawdown over 36 hours."
        }
    ]
}
