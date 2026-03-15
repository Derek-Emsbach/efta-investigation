"""ML pipeline configuration — reads from .env file or environment variables."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from ml directory
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    load_dotenv(_env_path)

# Supabase
SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY: str = os.environ["SUPABASE_SERVICE_KEY"]

# Cloudflare R2
R2_ACCOUNT_ID: str = os.environ["R2_ACCOUNT_ID"]
R2_ACCESS_KEY_ID: str = os.environ["R2_ACCESS_KEY_ID"]
R2_SECRET_ACCESS_KEY: str = os.environ["R2_SECRET_ACCESS_KEY"]
R2_BUCKET_NAME: str = os.environ.get("R2_BUCKET_NAME", "efta-documents")
R2_ENDPOINT: str = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# Anthropic
ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")

# ML settings
ML_MODELS_DIR: Path = Path(os.environ.get("ML_MODELS_DIR", str(Path(__file__).parent / "models")))
EMBEDDING_MODEL: str = os.environ.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
NER_BASE_MODEL: str = os.environ.get("NER_BASE_MODEL", "en_core_web_lg")
