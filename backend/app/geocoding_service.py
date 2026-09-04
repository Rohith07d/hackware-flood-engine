import math
import urllib.request
import urllib.parse
import json
from typing import Dict, Any, List, Optional, Tuple

# Comprehensive catalog of Hyderabad localities, IT corridors, and river basins
HYDERABAD_LOCALITIES: Dict[str, Dict[str, Any]] = {
    # --- Major Educational Institutions & Campuses ---
    "kmit": {
        "display_name": "Keshav Memorial Institute of Technology (KMIT), Narayanguda",
        "latitude": 17.3970,
        "longitude": 78.4902,
        "bounding_box": [17.3850, 78.4800, 17.4090, 78.5020],
        "category": "Engineering Campus / Narayanguda Basin",
    },
    "keshav memorial": {
        "display_name": "Keshav Memorial Institute of Technology (KMIT), Narayanguda",
        "latitude": 17.3970,
        "longitude": 78.4902,
        "bounding_box": [17.3850, 78.4800, 17.4090, 78.5020],
        "category": "Engineering Campus / Narayanguda Basin",
    },
    "narayanguda": {
        "display_name": "Narayanguda, Hyderabad",
        "latitude": 17.3984,
        "longitude": 78.4912,
        "bounding_box": [17.3880, 78.4800, 17.4100, 78.5030],
        "category": "Central Urban Basin / Underpass Vulnerability",
    },
    "himayatnagar": {
        "display_name": "Himayatnagar, Hyderabad",
        "latitude": 17.4028,
        "longitude": 78.4877,
        "bounding_box": [17.3920, 78.4760, 17.4140, 78.4990],
        "category": "Central Commercial & Residential District",
    },
    "hyderguda": {
        "display_name": "Hyderguda, Hyderabad",
        "latitude": 17.3965,
        "longitude": 78.4850,
        "bounding_box": [17.3870, 78.4750, 17.4070, 78.4950],
        "category": "Central Commercial Corridor",
    },
    "cbit": {
        "display_name": "Chaitanya Bharathi Institute of Technology (CBIT), Gandipet",
        "latitude": 17.3910,
        "longitude": 78.3240,
        "bounding_box": [17.3750, 78.3100, 17.4050, 78.3400],
        "category": "Engineering Campus / Gandipet Catchment",
    },
    "vnr": {
        "display_name": "VNR Vignana Jyothi Institute of Engineering (VNR VJIET), Bachupally",
        "latitude": 17.5390,
        "longitude": 78.3840,
        "bounding_box": [17.5250, 78.3700, 17.5550, 78.4000],
        "category": "Engineering Campus / Bachupally Watershed",
    },
    "vasavi": {
        "display_name": "Vasavi College of Engineering, Ibrahimbagh",
        "latitude": 17.3800,
        "longitude": 78.3820,
        "bounding_box": [17.3680, 78.3700, 17.3920, 78.3950],
        "category": "Engineering Campus / Musi Catchment",
    },
    "griet": {
        "display_name": "Gokaraju Rangaraju Institute of Engineering (GRIET), Nizampet",
        "latitude": 17.5180,
        "longitude": 78.3690,
        "bounding_box": [17.5050, 78.3550, 17.5300, 78.3850],
        "category": "Engineering Campus / Nizampet Basin",
    },
    "snist": {
        "display_name": "Sreenidhi Institute of Science and Technology (SNIST), Ghatkesar",
        "latitude": 17.4550,
        "longitude": 78.6750,
        "bounding_box": [17.4400, 78.6600, 17.4700, 78.6900],
        "category": "Engineering Campus / Eastern Catchment",
    },
    "jntu": {
        "display_name": "JNTU Hyderabad (JNTUH), Kukatpally",
        "latitude": 17.4975,
        "longitude": 78.3920,
        "bounding_box": [17.4850, 78.3800, 17.5100, 78.4050],
        "category": "State Technical University / Kukatpally Basin",
    },
    "osmania university": {
        "display_name": "Osmania University (OU), Hyderabad",
        "latitude": 17.4130,
        "longitude": 78.5280,
        "bounding_box": [17.4000, 78.5150, 17.4300, 78.5450],
        "category": "Historic University Campus / Elevated Ridge",
    },
    "iiit hyderabad": {
        "display_name": "IIIT Hyderabad, Gachibowli",
        "latitude": 17.4450,
        "longitude": 78.3490,
        "bounding_box": [17.4350, 78.3400, 17.4550, 78.3600],
        "category": "Premier Research Campus / Gachibowli Plateau",
    },
    "university of hyderabad": {
        "display_name": "University of Hyderabad (HCU), Gachibowli",
        "latitude": 17.4560,
        "longitude": 78.3260,
        "bounding_box": [17.4400, 78.3100, 17.4700, 78.3450],
        "category": "Central University / Western Lake Corridor",
    },
    "bits hyderabad": {
        "display_name": "BITS Pilani Hyderabad Campus, Shamirpet",
        "latitude": 17.5440,
        "longitude": 78.5710,
        "bounding_box": [17.5300, 78.5550, 17.5600, 78.5850],
        "category": "University Campus / Northern Lakes Corridor",
    },
    "abids": {
        "display_name": "Abids, Hyderabad",
        "latitude": 17.3900,
        "longitude": 78.4735,
        "bounding_box": [17.3800, 78.4620, 17.4020, 78.4850],
        "category": "Historic Commercial District / Flyover Sector",
    },
    "koti": {
        "display_name": "Koti (Sultan Bazaar), Hyderabad",
        "latitude": 17.3850,
        "longitude": 78.4867,
        "bounding_box": [17.3750, 78.4750, 17.3960, 78.4980],
        "category": "Commercial Market / Musi River North Buffer",
    },
    "nampally": {
        "display_name": "Nampally, Hyderabad",
        "latitude": 17.3920,
        "longitude": 78.4680,
        "bounding_box": [17.3800, 78.4550, 17.4040, 78.4800],
        "category": "Major Railway Hub / Underpass Waterlogging",
    },
    "basheerbagh": {
        "display_name": "Basheerbagh, Hyderabad",
        "latitude": 17.4045,
        "longitude": 78.4785,
        "bounding_box": [17.3940, 78.4680, 17.4150, 78.4890],
        "category": "Administrative Hub / Hussain Sagar Outflow Basin",
    },
    "lakdikapul": {
        "display_name": "Lakdikapul, Hyderabad",
        "latitude": 17.4055,
        "longitude": 78.4650,
        "bounding_box": [17.3950, 78.4530, 17.4160, 78.4770],
        "category": "Transit Junction / Low-Lying Flyover Underpass",
    },
    "masab tank": {
        "display_name": "Masab Tank, Hyderabad",
        "latitude": 17.4030,
        "longitude": 78.4500,
        "bounding_box": [17.3920, 78.4380, 17.4150, 78.4620],
        "category": "Historic Tank Basin / Underpass Vulnerability",
    },
    "kphb": {
        "display_name": "KPHB Colony (Kukatpally), Hyderabad",
        "latitude": 17.4930,
        "longitude": 78.3990,
        "bounding_box": [17.4800, 78.3850, 17.5050, 78.4120],
        "category": "High-Density Residential Hub / Drainage Surcharges",
    },
    "financial district": {
        "display_name": "Financial District, Nanakramguda, Hyderabad",
        "latitude": 17.4150,
        "longitude": 78.3430,
        "bounding_box": [17.4020, 78.3300, 17.4280, 78.3580],
        "category": "Modern IT & Financial Hub",
    },
    "kokapet": {
        "display_name": "Kokapet, Hyderabad",
        "latitude": 17.3950,
        "longitude": 78.3350,
        "bounding_box": [17.3800, 78.3200, 17.4100, 78.3500],
        "category": "Western Growth Corridor / Lake Outflows",
    },
    "sr nagar": {
        "display_name": "SR Nagar (Sanjeeva Reddy Nagar), Hyderabad",
        "latitude": 17.4440,
        "longitude": 78.4430,
        "bounding_box": [17.4330, 78.4320, 17.4550, 78.4540],
        "category": "Dense Residential & Commercial District",
    },
    "malakpet": {
        "display_name": "Malakpet, Hyderabad",
        "latitude": 17.3750,
        "longitude": 78.5020,
        "bounding_box": [17.3620, 78.4900, 17.3880, 78.5150],
        "category": "Musi River Basin / Railway Underpass Inundation Zone",
    },
    "falaknuma": {
        "display_name": "Falaknuma, Hyderabad",
        "latitude": 17.3300,
        "longitude": 78.4670,
        "bounding_box": [17.3150, 78.4500, 17.3450, 78.4850],
        "category": "Southern Elevated Ridge / Old City Plateau",
    },
    "marredpally": {
        "display_name": "Marredpally, Secunderabad",
        "latitude": 17.4490,
        "longitude": 78.5080,
        "bounding_box": [17.4380, 78.4950, 17.4600, 78.5200],
        "category": "Secunderabad Cantonment Residential Sector",
    },
    "bowenpally": {
        "display_name": "Bowenpally, Secunderabad",
        "latitude": 17.4720,
        "longitude": 78.4880,
        "bounding_box": [17.4580, 78.4750, 17.4850, 78.5020],
        "category": "National Highway Junction & Low Drain Catchment",
    },
    "kompally": {
        "display_name": "Kompally, Hyderabad",
        "latitude": 17.5350,
        "longitude": 78.4850,
        "bounding_box": [17.5200, 78.4700, 17.5500, 78.5000],
        "category": "Northern Commercial Highway Corridor",
    },
    "medchal": {
        "display_name": "Medchal, Hyderabad",
        "latitude": 17.6290,
        "longitude": 78.4810,
        "bounding_box": [17.6100, 78.4650, 17.6500, 78.5000],
        "category": "Northern Outskirts / Industrial Catchment",
    },
    "sainikpuri": {
        "display_name": "Sainikpuri, Hyderabad",
        "latitude": 17.4920,
        "longitude": 78.5480,
        "bounding_box": [17.4800, 78.5350, 17.5050, 78.5600],
        "category": "Northeastern Ridge & Elevated Basin",
    },
    "ecil": {
        "display_name": "ECIL, Hyderabad",
        "latitude": 17.4730,
        "longitude": 78.5720,
        "bounding_box": [17.4600, 78.5580, 17.4860, 78.5850],
        "category": "Industrial Corridor & Drainage Confluence",
    },
    "bachupally": {
        "display_name": "Bachupally, Hyderabad",
        "latitude": 17.5340,
        "longitude": 78.3690,
        "bounding_box": [17.5200, 78.3550, 17.5500, 78.3850],
        "category": "Northwestern Watershed & Residential Sector",
    },
    "habsiguda": {
        "display_name": "Habsiguda, Hyderabad",
        "latitude": 17.4180,
        "longitude": 78.5450,
        "bounding_box": [17.4050, 78.5320, 17.4300, 78.5600],
        "category": "Eastern Urban Corridor & Stream Confluence",
    },
    "ramanthapur": {
        "display_name": "Ramanthapur, Hyderabad",
        "latitude": 17.3980,
        "longitude": 78.5380,
        "bounding_box": [17.3850, 78.5250, 17.4100, 78.5520],
        "category": "Pedda Cheruvu Lake Catchment",
    },
    "pocharam": {
        "display_name": "Pocharam (Infosys SEZ), Hyderabad",
        "latitude": 17.4700,
        "longitude": 78.6500,
        "bounding_box": [17.4550, 78.6350, 17.4850, 78.6650],
        "category": "Eastern IT Corridor / Water Shed",
    },
    "tank bund": {
        "display_name": "Tank Bund (Hussain Sagar), Hyderabad",
        "latitude": 17.4210,
        "longitude": 78.4790,
        "bounding_box": [17.4100, 78.4680, 17.4320, 78.4900],
        "category": "Lake Embankment / Sluice Discharge Arterial",
    },
    "necklace road": {
        "display_name": "Necklace Road (PVNR Marg), Hyderabad",
        "latitude": 17.4300,
        "longitude": 78.4710,
        "bounding_box": [17.4180, 78.4600, 17.4420, 78.4820],
        "category": "Lakeside Low Causeway / High Submersion Frequency",
    },
    "gandipet": {
        "display_name": "Gandipet (Osman Sagar Reservoir), Hyderabad",
        "latitude": 17.3820,
        "longitude": 78.3000,
        "bounding_box": [17.3600, 78.2800, 17.4100, 78.3250],
        "category": "Major Potable Water Reservoir / Sluice Outflow",
    },
    "himayat sagar": {
        "display_name": "Himayat Sagar Reservoir, Hyderabad",
        "latitude": 17.3180,
        "longitude": 78.3580,
        "bounding_box": [17.2950, 78.3300, 17.3400, 78.3850],
        "category": "Upstream Reservoir / Musi Flood Barrier",
    },
    # --- Standard Localities ---
    "gachibowli": {
        "display_name": "Gachibowli, Hyderabad",
        "latitude": 17.4401,
        "longitude": 78.3489,
        "bounding_box": [17.4200, 78.3300, 17.4600, 78.3700],
        "category": "IT Corridor / Low-lying Depressions",
    },
    "begumpet": {
        "display_name": "Begumpet, Hyderabad",
        "latitude": 17.4447,
        "longitude": 78.4664,
        "bounding_box": [17.4300, 78.4500, 17.4600, 78.4800],
        "category": "Hussain Sagar Outflow / High Inundation Risk",
    },
    "musi river basin": {
        "display_name": "Musi River Basin, Hyderabad",
        "latitude": 17.3700,
        "longitude": 78.4800,
        "bounding_box": [17.3500, 78.4500, 17.3900, 78.5200],
        "category": "Active River Floodplain",
    },
    "musi river": {
        "display_name": "Musi River Basin, Hyderabad",
        "latitude": 17.3700,
        "longitude": 78.4800,
        "bounding_box": [17.3500, 78.4500, 17.3900, 78.5200],
        "category": "Active River Floodplain",
    },
    "ghatkesar": {
        "display_name": "Ghatkesar, Hyderabad",
        "latitude": 17.4455,
        "longitude": 78.6844,
        "bounding_box": [17.4200, 78.6500, 17.4700, 78.7100],
        "category": "Eastern Inundation Catchment",
    },
    "madhapur": {
        "display_name": "Madhapur, Hyderabad",
        "latitude": 17.4483,
        "longitude": 78.3915,
        "bounding_box": [17.4350, 78.3750, 17.4600, 78.4050],
        "category": "Urban IT Hub / Durgam Cheruvu Catchment",
    },
    "hitec city": {
        "display_name": "HITEC City, Hyderabad",
        "latitude": 17.4435,
        "longitude": 78.3772,
        "bounding_box": [17.4300, 78.3600, 17.4550, 78.3900],
        "category": "Commercial IT Corridor",
    },
    "secunderabad": {
        "display_name": "Secunderabad, Hyderabad",
        "latitude": 17.4399,
        "longitude": 78.4983,
        "bounding_box": [17.4200, 78.4800, 17.4600, 78.5200],
        "category": "Northern Urban Transit Center",
    },
    "banjara hills": {
        "display_name": "Banjara Hills, Hyderabad",
        "latitude": 17.4156,
        "longitude": 78.4350,
        "bounding_box": [17.4000, 78.4150, 17.4300, 78.4550],
        "category": "Hilly Ridge / Moderate Runoff",
    },
    "jubilee hills": {
        "display_name": "Jubilee Hills, Hyderabad",
        "latitude": 17.4319,
        "longitude": 78.4074,
        "bounding_box": [17.4150, 78.3900, 17.4450, 78.4250],
        "category": "Elevated Rocky Ridge",
    },
    "charminar": {
        "display_name": "Charminar (Old City), Hyderabad",
        "latitude": 17.3616,
        "longitude": 78.4747,
        "bounding_box": [17.3450, 78.4600, 17.3750, 78.4900],
        "category": "Dense Historic Core / Musi South Bank",
    },
    "kukatpally": {
        "display_name": "Kukatpally, Hyderabad",
        "latitude": 17.4849,
        "longitude": 78.4138,
        "bounding_box": [17.4650, 78.3950, 17.5050, 78.4350],
        "category": "Major Residential / Lake Basin Surcharges",
    },
    "miyapur": {
        "display_name": "Miyapur, Hyderabad",
        "latitude": 17.4968,
        "longitude": 78.3546,
        "bounding_box": [17.4800, 78.3350, 17.5150, 78.3750],
        "category": "Northwestern Lake System Catchment",
    },
    "lb nagar": {
        "display_name": "LB Nagar, Hyderabad",
        "latitude": 17.3503,
        "longitude": 78.5524,
        "bounding_box": [17.3300, 78.5300, 17.3700, 78.5750],
        "category": "Southeastern Stormwater Discharge Zone",
    },
    "uppal": {
        "display_name": "Uppal, Hyderabad",
        "latitude": 17.4018,
        "longitude": 78.5602,
        "bounding_box": [17.3850, 78.5400, 17.4200, 78.5800],
        "category": "Eastern Musi Confluence Plains",
    },
    "nizampet": {
        "display_name": "Nizampet, Hyderabad",
        "latitude": 17.5169,
        "longitude": 78.3842,
        "bounding_box": [17.5000, 78.3650, 17.5300, 78.4000],
        "category": "Flood-Prone Urban Encroachment Zone",
    },
    "kondapur": {
        "display_name": "Kondapur, Hyderabad",
        "latitude": 17.4689,
        "longitude": 78.3578,
        "bounding_box": [17.4500, 78.3400, 17.4850, 78.3750],
        "category": "Elevated IT Fringe",
    },
    "manikonda": {
        "display_name": "Manikonda, Hyderabad",
        "latitude": 17.4019,
        "longitude": 78.3840,
        "bounding_box": [17.3850, 78.3650, 17.4200, 78.4050],
        "category": "Southwestern Reservoir Catchment",
    },
    "khairatabad": {
        "display_name": "Khairatabad, Hyderabad",
        "latitude": 17.4116,
        "longitude": 78.4619,
        "bounding_box": [17.3980, 78.4480, 17.4250, 78.4750],
        "category": "Hussain Sagar Inundation Shoreline",
    },
    "dilsukhnagar": {
        "display_name": "Dilsukhnagar, Hyderabad",
        "latitude": 17.3688,
        "longitude": 78.5247,
        "bounding_box": [17.3550, 78.5100, 17.3820, 78.5400],
        "category": "Dense Urban Commercial District",
    },
    "amberpet": {
        "display_name": "Amberpet, Hyderabad",
        "latitude": 17.3910,
        "longitude": 78.5180,
        "bounding_box": [17.3780, 78.5020, 17.4040, 78.5320],
        "category": "Musi River North Bank",
    },
    "tarnaka": {
        "display_name": "Tarnaka, Hyderabad",
        "latitude": 17.4283,
        "longitude": 78.5318,
        "bounding_box": [17.4150, 78.5150, 17.4420, 78.5480],
        "category": "University Ridge Zone",
    },
    "alwal": {
        "display_name": "Alwal, Hyderabad",
        "latitude": 17.5023,
        "longitude": 78.5038,
        "bounding_box": [17.4850, 78.4850, 17.5200, 78.5200],
        "category": "Northern Lake & Drainage Corridor",
    },
    "mehdipatnam": {
        "display_name": "Mehdipatnam, Hyderabad",
        "latitude": 17.3916,
        "longitude": 78.4398,
        "bounding_box": [17.3750, 78.4200, 17.4100, 78.4600],
        "category": "Southwest Transit Hub / Low-Lying Underpass Corridor",
    },
    "tolichowki": {
        "display_name": "Tolichowki, Hyderabad",
        "latitude": 17.4014,
        "longitude": 78.4116,
        "bounding_box": [17.3850, 78.3950, 17.4200, 78.4300],
        "category": "Nadeem Colony / Historical Severe Inundation Catchment",
    },
    "somajiguda": {
        "display_name": "Somajiguda, Hyderabad",
        "latitude": 17.4256,
        "longitude": 78.4583,
        "bounding_box": [17.4120, 78.4450, 17.4400, 78.4720],
        "category": "Raj Bhavan Road / Hussain Sagar Basin",
    },
    "panjagutta": {
        "display_name": "Panjagutta, Hyderabad",
        "latitude": 17.4265,
        "longitude": 78.4502,
        "bounding_box": [17.4150, 78.4380, 17.4400, 78.4650],
        "category": "Central Commercial Flyover Node",
    },
    "ameerpet": {
        "display_name": "Ameerpet, Hyderabad",
        "latitude": 17.4375,
        "longitude": 78.4482,
        "bounding_box": [17.4250, 78.4350, 17.4500, 78.4620],
        "category": "High-Density Commercial Underpass Hub",
    },
    "durgam cheruvu": {
        "display_name": "Durgam Cheruvu (Secret Lake), Hyderabad",
        "latitude": 17.4325,
        "longitude": 78.3882,
        "bounding_box": [17.4200, 78.3750, 17.4450, 78.4020],
        "category": "Major Lake Catchment & Spillway",
    },
    "hussain sagar": {
        "display_name": "Hussain Sagar Lake, Hyderabad",
        "latitude": 17.4239,
        "longitude": 78.4738,
        "bounding_box": [17.4100, 78.4600, 17.4450, 78.4900],
        "category": "Central Reservoir & Outflow Sluice Gates",
    },
    "attapur": {
        "display_name": "Attapur, Hyderabad",
        "latitude": 17.3712,
        "longitude": 78.4304,
        "bounding_box": [17.3550, 78.4150, 17.3900, 78.4480],
        "category": "Musi River Southern Floodplain Corridor",
    },
    "lingampally": {
        "display_name": "BHEL - Lingampally, Hyderabad",
        "latitude": 17.4935,
        "longitude": 78.3182,
        "bounding_box": [17.4780, 78.3000, 17.5100, 78.3350],
        "category": "Western Railway Hub / Industrial Catchment",
    },
    "chandanagar": {
        "display_name": "Chandanagar, Hyderabad",
        "latitude": 17.4932,
        "longitude": 78.3392,
        "bounding_box": [17.4780, 78.3220, 17.5100, 78.3550],
        "category": "Gangaram Cheruvu Outflow Catchment",
    },
    "malkajgiri": {
        "display_name": "Malkajgiri, Hyderabad",
        "latitude": 17.4526,
        "longitude": 78.5327,
        "bounding_box": [17.4380, 78.5150, 17.4700, 78.5500],
        "category": "Banda Cheruvu Urban Inundation Sector",
    },
    "shamshabad": {
        "display_name": "Shamshabad (Airport Zone), Hyderabad",
        "latitude": 17.2543,
        "longitude": 78.4312,
        "bounding_box": [17.2300, 78.4000, 17.2800, 78.4600],
        "category": "Southern Plateau / Airport Drainage Corridor",
    },
    "kacheguda": {
        "display_name": "Kacheguda, Hyderabad",
        "latitude": 17.3907,
        "longitude": 78.4983,
        "bounding_box": [17.3780, 78.4850, 17.4050, 78.5120],
        "category": "Railway Junction & Musi Outflow Lane",
    },
    "sanathnagar": {
        "display_name": "Sanathnagar, Hyderabad",
        "latitude": 17.4589,
        "longitude": 78.4410,
        "bounding_box": [17.4450, 78.4280, 17.4750, 78.4550],
        "category": "Industrial Catchment & Storm Drain Network",
    },
    "balanagar": {
        "display_name": "Balanagar, Hyderabad",
        "latitude": 17.4728,
        "longitude": 78.4450,
        "bounding_box": [17.4580, 78.4300, 17.4900, 78.4600],
        "category": "Northern Industrial Corridor Underpass",
    },
    "nagole": {
        "display_name": "Nagole, Hyderabad",
        "latitude": 17.3742,
        "longitude": 78.5627,
        "bounding_box": [17.3600, 78.5450, 17.3900, 78.5800],
        "category": "Eastern Musi River Confluence Plains",
    },
    "cyber towers": {
        "display_name": "Cyber Towers (HITEC City), Hyderabad",
        "latitude": 17.4504,
        "longitude": 78.3808,
        "bounding_box": [17.4380, 78.3680, 17.4620, 78.3950],
        "category": "Core IT Landmark / Shilparamam Junction",
    },
    "jubilee hills road 36": {
        "display_name": "Jubilee Hills Checkpost & Road 36, Hyderabad",
        "latitude": 17.4312,
        "longitude": 78.4118,
        "bounding_box": [17.4180, 78.3980, 17.4450, 78.4250],
        "category": "Elevated Commercial Arterial",
    },
    "chaderghat": {
        "display_name": "Chaderghat Causeway, Hyderabad",
        "latitude": 17.3820,
        "longitude": 78.4920,
        "bounding_box": [17.3700, 78.4800, 17.3950, 78.5050],
        "category": "Active River Causeway Submersion Point",
    },
    "moosarambagh": {
        "display_name": "Moosarambagh Bridge, Hyderabad",
        "latitude": 17.3765,
        "longitude": 78.5065,
        "bounding_box": [17.3650, 78.4950, 17.3900, 78.5200],
        "category": "Low Causeway Floodplain / Routine Closure Point",
    },
}

# Aliases and colloquial abbreviations for fast instant geocoding
LOCALITY_ALIASES: Dict[str, str] = {
    "kmit": "kmit",
    "k.m.i.t": "kmit",
    "kmit narayanguda": "kmit",
    "keshav memorial": "kmit",
    "keshav memorial institute": "kmit",
    "keshav memorial institute of technology": "kmit",
    "keshav memorial engineering college": "kmit",
    "keshav": "kmit",
    "narayanguda": "narayanguda",
    "narayanaguda": "narayanguda",
    "himayatnagar": "himayatnagar",
    "himayathnagar": "himayatnagar",
    "hyderguda": "hyderguda",
    "cbit": "cbit",
    "cbit gandipet": "cbit",
    "chaitanya bharathi": "cbit",
    "vnr": "vnr",
    "vnr vjiet": "vnr",
    "vjiet": "vnr",
    "vasavi": "vasavi",
    "griet": "griet",
    "snist": "snist",
    "sreenidhi": "snist",
    "jntu": "jntu",
    "jntuh": "jntu",
    "ou": "osmania university",
    "osmania": "osmania university",
    "osmania university": "osmania university",
    "iiit": "iiit hyderabad",
    "iiit-h": "iiit hyderabad",
    "iiit hyderabad": "iiit hyderabad",
    "hcu": "university of hyderabad",
    "uoh": "university of hyderabad",
    "university of hyderabad": "university of hyderabad",
    "bits": "bits hyderabad",
    "bits hyderabad": "bits hyderabad",
    "bits pilani": "bits hyderabad",
    "kphb": "kphb",
    "kukatpally housing board": "kphb",
    "hitec": "hitec city",
    "hitech city": "hitec city",
    "cyber towers": "cyber towers",
    "cybertowers": "cyber towers",
    "financial district": "financial district",
    "fd": "financial district",
    "nanakramguda": "financial district",
    "punjagutta": "panjagutta",
    "panjagutta": "panjagutta",
    "sr nagar": "sr nagar",
    "sanjeeva reddy nagar": "sr nagar",
    "masab tank": "masab tank",
    "lakdikapul": "lakdikapul",
    "tank bund": "tank bund",
    "tankbund": "tank bund",
    "necklace road": "necklace road",
    "pvnr marg": "necklace road",
    "secretariat": "basheerbagh",
    "dr br ambedkar secretariat": "basheerbagh",
    "musi": "musi river basin",
    "musi river": "musi river basin",
    "chaderghat": "chaderghat",
    "moosarambagh": "moosarambagh",
    "bhel": "lingampally",
    "lingampally": "lingampally",
    "durgam cheruvu": "durgam cheruvu",
    "secret lake": "durgam cheruvu",
    "gandipet": "gandipet",
    "osman sagar": "gandipet",
    "himayat sagar": "himayat sagar",
}


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two points in km."""
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2.0) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2)
    return 2.0 * r * math.asin(math.sqrt(a))


def clean_search_term(term: str) -> str:
    """Standardize search strings: lowercase, remove punctuation, strip excess spaces."""
    import re
    cleaned = re.sub(r"[^\w\s]", " ", (term or "").lower())
    return " ".join(cleaned.split())


class GeocodingService:
    @staticmethod
    def search_suggestions(query: str, limit: int = 8) -> List[Dict[str, Any]]:
        """
        Return fast typeahead autocomplete suggestions for Hyderabad localities,
        campuses, IT corridors, and landmarks.
        """
        q = clean_search_term(query)
        if not q:
            popular_keys = [
                "kmit", "gachibowli", "begumpet", "musi river basin", "ghatkesar",
                "cbit", "hitec city", "narayanguda", "kukatpally", "charminar"
            ]
            return [
                {
                    "name": HYDERABAD_LOCALITIES[k]["display_name"],
                    "category": HYDERABAD_LOCALITIES[k]["category"],
                    "latitude": HYDERABAD_LOCALITIES[k]["latitude"],
                    "longitude": HYDERABAD_LOCALITIES[k]["longitude"],
                }
                for k in popular_keys if k in HYDERABAD_LOCALITIES
            ]

        results = []
        seen_names = set()

        # Step 1: Check Aliases first (e.g. 'kmit' -> KMIT)
        for alias, target_key in LOCALITY_ALIASES.items():
            if q == alias or q in alias or alias in q:
                entry = HYDERABAD_LOCALITIES.get(target_key)
                if entry and entry["display_name"] not in seen_names:
                    seen_names.add(entry["display_name"])
                    results.append({
                        "name": entry["display_name"],
                        "category": entry["category"],
                        "latitude": entry["latitude"],
                        "longitude": entry["longitude"],
                    })
                    if len(results) >= limit:
                        return results

        # Step 2: Exact key or display name substring matches
        for key, entry in HYDERABAD_LOCALITIES.items():
            disp = entry["display_name"]
            cat = entry["category"]
            disp_clean = clean_search_term(disp)
            key_clean = clean_search_term(key)

            if q in key_clean or q in disp_clean or q in clean_search_term(cat):
                if disp not in seen_names:
                    seen_names.add(disp)
                    results.append({
                        "name": disp,
                        "category": cat,
                        "latitude": entry["latitude"],
                        "longitude": entry["longitude"],
                    })
            if len(results) >= limit:
                break

        # Step 3: Multi-word token overlap matching (e.g. 'keshav narayanguda' or 'kmit college')
        if len(results) < limit:
            q_tokens = set(q.split())
            for key, entry in HYDERABAD_LOCALITIES.items():
                disp = entry["display_name"]
                if disp in seen_names:
                    continue
                combined_text = f"{key} {disp} {entry['category']}".lower()
                matches = sum(1 for tok in q_tokens if tok in combined_text)
                if matches > 0 and len(q_tokens) > 0 and (matches / len(q_tokens) >= 0.5):
                    seen_names.add(disp)
                    results.append({
                        "name": disp,
                        "category": entry["category"],
                        "latitude": entry["latitude"],
                        "longitude": entry["longitude"],
                    })
                if len(results) >= limit:
                    break

        return results

    @staticmethod
    def resolve_location(
        location_name: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Authoritative resolver that converts either a named area or coordinates
        into real latitude, longitude, and bounding box.
        """
        # Case 1: Coordinate-driven lookup / map click
        if latitude is not None and longitude is not None:
            return GeocodingService._reverse_geocode(latitude, longitude, preferred_name=location_name)

        # Case 2: Named location search
        raw_name = (location_name or "Gachibowli, Hyderabad").strip()
        clean_q = clean_search_term(raw_name)

        # Step A: Direct Alias Match
        if clean_q in LOCALITY_ALIASES:
            target_key = LOCALITY_ALIASES[clean_q]
            entry = HYDERABAD_LOCALITIES[target_key]
            return {
                "location_name": entry["display_name"],
                "latitude": entry["latitude"],
                "longitude": entry["longitude"],
                "bounding_box": entry["bounding_box"],
                "category": entry["category"],
                "source": "alias_catalog_exact",
                "status": "resolved"
            }

        # Step B: Check if any alias is contained within the query
        # (e.g. "kmit engineering college", "keshav memorial hyderabad", "narayanguda circle")
        for alias, target_key in sorted(LOCALITY_ALIASES.items(), key=lambda x: len(x[0]), reverse=True):
            if len(alias) >= 3 and alias in clean_q:
                entry = HYDERABAD_LOCALITIES.get(target_key)
                if entry:
                    return {
                        "location_name": entry["display_name"],
                        "latitude": entry["latitude"],
                        "longitude": entry["longitude"],
                        "bounding_box": entry["bounding_box"],
                        "category": entry["category"],
                        "source": "alias_catalog_substring",
                        "status": "resolved"
                    }

        # Step C: Exact and Substring Match against local Hyderabad catalog
        for key, entry in HYDERABAD_LOCALITIES.items():
            key_clean = clean_search_term(key)
            disp_clean = clean_search_term(entry["display_name"])
            if key_clean == clean_q or clean_q in key_clean or key_clean in clean_q or clean_q in disp_clean:
                return {
                    "location_name": entry["display_name"],
                    "latitude": entry["latitude"],
                    "longitude": entry["longitude"],
                    "bounding_box": entry["bounding_box"],
                    "category": entry["category"],
                    "source": "local_hyderabad_catalog",
                    "status": "resolved"
                }

        # Step D: Multi-word token overlap
        q_tokens = [t for t in clean_q.split() if len(t) > 2]
        best_score = 0
        best_entry = None
        for key, entry in HYDERABAD_LOCALITIES.items():
            combined_text = f"{key} {entry['display_name']} {entry['category']}".lower()
            score = sum(1 for tok in q_tokens if tok in combined_text)
            if score > best_score:
                best_score = score
                best_entry = entry

        if best_entry and best_score >= max(1, len(q_tokens) // 2):
            return {
                "location_name": best_entry["display_name"],
                "latitude": best_entry["latitude"],
                "longitude": best_entry["longitude"],
                "bounding_box": best_entry["bounding_box"],
                "category": best_entry["category"],
                "source": "local_token_match",
                "status": "resolved"
            }

        # Step E: OSM Nominatim Geocoding Fallback with Hyderabad Bounding Box
        osm_result = GeocodingService._query_nominatim(raw_name)
        if osm_result:
            return osm_result

        # Step F: Safe Central Hyderabad Reference (Tank Bund / Secretariat)
        # Never silently return Gachibowli coordinates for an uncataloged central area!
        central_entry = {
            "display_name": f"{raw_name}, Central Hyderabad",
            "latitude": 17.4065,
            "longitude": 78.4725,
            "bounding_box": [17.3900, 78.4550, 17.4250, 78.4900],
            "category": "Central Urban Sector (Approximate Geocoding)",
        }
        return {
            "location_name": central_entry["display_name"],
            "latitude": central_entry["latitude"],
            "longitude": central_entry["longitude"],
            "bounding_box": central_entry["bounding_box"],
            "category": central_entry["category"],
            "source": "central_hyderabad_fallback",
            "status": "resolved"
        }

    @staticmethod
    def _reverse_geocode(lat: float, lon: float, preferred_name: Optional[str] = None) -> Dict[str, Any]:
        """Find the closest neighborhood or locality in Hyderabad."""
        closest_name = None
        min_dist = float("inf")
        closest_entry = None

        for name, entry in HYDERABAD_LOCALITIES.items():
            dist = haversine_distance_km(lat, lon, entry["latitude"], entry["longitude"])
            if dist < min_dist:
                min_dist = dist
                closest_name = entry["display_name"]
                closest_entry = entry

        delta = 0.02
        bbox = [
            round(lat - delta, 4),
            round(lon - delta, 4),
            round(lat + delta, 4),
            round(lon + delta, 4),
        ]

        if min_dist <= 2.5 and closest_entry:
            disp_name = preferred_name or closest_entry["display_name"]
            category = closest_entry["category"]
        else:
            disp_name = preferred_name or f"Sector ({round(lat, 4)}, {round(lon, 4)}), Hyderabad"
            category = "Point Sector Analysis"

        return {
            "location_name": disp_name,
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
            "bounding_box": bbox,
            "category": category,
            "source": "coordinate_reverse_lookup",
            "status": "resolved"
        }

    @staticmethod
    def _query_nominatim(query: str) -> Optional[Dict[str, Any]]:
        """Query OSM Nominatim API with safe timeout, bounded viewbox, and error handling."""
        try:
            # Clean up query
            q_clean = query.strip()
            if "hyderabad" not in q_clean.lower():
                full_query = f"{q_clean}, Hyderabad, Telangana, India"
            else:
                full_query = f"{q_clean}, India"

            encoded_query = urllib.parse.quote(full_query)
            # Bound search to Hyderabad metropolitan area (viewbox: west,south,east,north)
            url = (
                f"https://nominatim.openstreetmap.org/search?"
                f"q={encoded_query}&format=json&limit=1"
                f"&viewbox=78.10,17.10,78.80,17.70&bounded=0"
            )
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "FloodCast-GeospatialEngine/2.0 (contact: support@floodcast.internal)"
                }
            )
            with urllib.request.urlopen(req, timeout=3.5) as resp:
                data = json.loads(resp.read().decode())
                if data and len(data) > 0:
                    first = data[0]
                    lat = float(first["lat"])
                    lon = float(first["lon"])
                    # Check that coordinates are genuinely within Hyderabad metro bounds
                    if 17.15 <= lat <= 17.65 and 78.15 <= lon <= 78.75:
                        bb = first.get("boundingbox", [lat - 0.015, lat + 0.015, lon - 0.015, lon + 0.015])
                        south, north, west, east = float(bb[0]), float(bb[1]), float(bb[2]), float(bb[3])
                        return {
                            "location_name": first.get("display_name", query).split(",")[0] + ", Hyderabad",
                            "latitude": lat,
                            "longitude": lon,
                            "bounding_box": [south, west, north, east],
                            "category": first.get("type", "Urban Landmark"),
                            "source": "osm_nominatim",
                            "status": "resolved"
                        }
        except Exception as exc:
            print(f"[GeocodingService] Nominatim lookup exception for '{query}': {exc}")
        return None


geocoding_service = GeocodingService()

