import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env
load_dotenv()

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
LANDING_DIR = DATA_DIR / "landing"
PROCESSED_DIR = DATA_DIR / "processed"
SQL_DIR = BASE_DIR / "sql"
CONFIG_DIR = BASE_DIR / "config"

# Database
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "customer360")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Business Rules
ACTIVE_DAYS_THRESHOLD = int(os.getenv("ACTIVE_DAYS_THRESHOLD", "90"))

# Communication Channels
COMTELE_API_KEY = os.getenv("COMTELE_API_KEY", "")
RDSTATION_API_KEY = os.getenv("RDSTATION_API_KEY", "")
EVOLUTION_API_URL = os.getenv("EVOLUTION_API_URL", "")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "")
EVOLUTION_INSTANCE_NAME = os.getenv("EVOLUTION_INSTANCE_NAME", "")

# Ponte Mensageria (Servidor A / cenat-mensage) — contrato HTTP.
# SERVICE_TOKEN / WEBHOOK_SECRET DEVEM ser identicos aos do .env do Servidor A,
# senao a ponte falha calada (envio 401 no Mensage; relay 403 aqui).
MENSAGE_BASE_URL = os.getenv("MENSAGE_BASE_URL", "https://cenat.whatsflow.cloud")
SERVICE_TOKEN = os.getenv("SERVICE_TOKEN", "")
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")
OFFICIAL_CHANNEL_ID = int(os.getenv("OFFICIAL_CHANNEL_ID", "6"))
# id do canal Evolution no Mensage (disparo nao-oficial). Sem default: se vazio,
# o disparo nao-oficial falha claro em vez de mandar pro canal errado.
UNOFFICIAL_CHANNEL_ID = os.getenv("UNOFFICIAL_CHANNEL_ID", "")
