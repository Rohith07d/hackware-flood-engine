from pydantic import BaseModel


class Settings(BaseModel):
    app_name: str = 'HackWave Flood Engine API'
    model_path: str = 'backend/models/lightgbm_model.txt'


settings = Settings()
