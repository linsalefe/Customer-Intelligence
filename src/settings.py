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
