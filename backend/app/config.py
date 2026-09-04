import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory or parent
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings:
    # App Settings
    app_name: str = os.getenv("APP_NAME", "HackWave Flood Engine API")
    app_version: str = os.getenv("APP_VERSION", "1.0.0")
    debug: bool = os.getenv("DEBUG", "true").lower() in ("true", "1", "yes")
    environment: str = os.getenv("ENVIRONMENT", "development")
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))

    # Featherless AI / OpenAI LLM Config
    featherless_base_url: str = os.getenv("FEATHERLESS_BASE_URL", "https://api.featherless.ai/v1")
    featherless_api_key: str = os.getenv("FEATHERLESS_API_KEY", "rc_6575f5e3814f5cee4b889742f845123c03ef64e56904e09ee92e0449577aceea")
    featherless_model: str = os.getenv("FEATHERLESS_MODEL", "Qwen/Qwen2.5-72B-Instruct")

    # Supabase Config
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_key: str = os.getenv("SUPABASE_SERVICE_KEY", "")

    # Storage Paths
    base_dir: Path = Path(__file__).resolve().parent.parent
    model_dir: Path = base_dir / "models"
    data_dir: Path = base_dir / "data"
    model_path: Path = base_dir / os.getenv("MODEL_PATH", "models/lgb_flood_model.txt")


settings = Settings()
