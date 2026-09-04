import os


class Settings:
    app_name = os.getenv("APP_NAME", "HackWave Flood Engine API")
    app_version = os.getenv("APP_VERSION", "0.1.0")
    featherless_base_url = os.getenv("FEATHERLESS_BASE_URL", "")
    featherless_api_key = os.getenv("FEATHERLESS_API_KEY", "")
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY", "")


settings = Settings()
