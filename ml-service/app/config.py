from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config=SettingsConfigDict(env_file=".env",extra="ignore",case_sensitive=False)
    ml_api_key:str=""
    device:str="cpu"
    kronos_model:str="NeoQuasar/Kronos-small"
    kronos_tokenizer:str="NeoQuasar/Kronos-Tokenizer-base"
    kronos_samples:int=Field(default=10,ge=1,le=32)
    kronos_model_revision:str="901c26c1332695a2a8f243eb2f37243a37bea320"
    kronos_tokenizer_revision:str="0e0117387f39004a9016484a186a908917e22426"
    hf_token:str|None=None
    model_cache_dir:str=".model-cache"
    max_concurrency:int=Field(default=1,ge=1,le=64)
    sideways_threshold_pct:float=Field(default=0.05,ge=0)
    model_mock:bool=False
    cache_ttl_seconds:int=1800
    min_kronos_candles:int=Field(default=10,ge=2)
    confidence_low:float=Field(default=0.45,ge=0,le=1)
    confidence_high:float=Field(default=0.60,ge=0,le=1)

@lru_cache
def get_settings()->Settings:return Settings()

settings=get_settings()
