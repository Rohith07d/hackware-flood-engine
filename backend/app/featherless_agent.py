from openai import OpenAI

from .config import settings


class FeatherlessAgent:
    def __init__(self) -> None:
        self.client = OpenAI(
            api_key=settings.featherless_api_key,
            base_url=settings.featherless_base_url,
        )
