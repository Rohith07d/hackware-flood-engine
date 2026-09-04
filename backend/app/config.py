import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory or parent
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)


class Settings:
    # App Settings
    app_name: str = os.getenv("APP_NAME", "HackWave Flood Engine API")
    app_version: str = os.getenv("APP_VERSION", "0.1.0")
    debug: bool = os.getenv("DEBUG", "true").lower() in ("true", "1", "yes")
    environment: str = os.getenv("ENVIRONMENT", "development")
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))

    # Featherless AI / OpenAI LLM Config
    featherless_base_url: str = os.getenv("FEATHERLESS_BASE_URL", "https://api.featherless.ai/v1")
    featherless_api_key: str = os.getenv("FEATHERLESS_API_KEY", "")
    featherless_model: str = os.getenv("FEATHERLESS_MODEL", "meta-llama/Meta-Llama-3.1-8B-Instruct")

    # Supabase Config
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_key: str = os.getenv("SUPABASE_SERVICE_KEY", "")

    # Storage Paths
    base_dir: Path = Path(__file__).resolve().parent.parent
    model_dir: Path = base_dir / "models"
    data_dir: Path = base_dir / "data"
    model_path: Path = base_dir / os.getenv("MODEL_PATH", "models/flood_lgbm_model.txt")


settings = Settings()
