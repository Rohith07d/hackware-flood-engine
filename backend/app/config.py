import os


class Settings:
    app_name = os.getenv("APP_NAME", "HackWave Flood Engine API")
    app_version = os.getenv("APP_VERSION", "0.1.0")
    featherless_base_url = os.getenv("FEATHERLESS_BASE_URL", "")
    featherless_api_key = os.getenv("FEATHERLESS_API_KEY", "")
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY", "")
    usgs_nwis_iv_url = os.getenv(
        "USGS_NWIS_IV_URL",
        "https://waterservices.usgs.gov/nwis/iv/",
    )
    usgs_site_id = os.getenv("USGS_SITE_ID", "")
    usgs_timeout_seconds = float(os.getenv("USGS_TIMEOUT_SECONDS", "15"))


settings = Settings()
