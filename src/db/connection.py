import psycopg2
from sqlalchemy import create_engine
from src.settings import DATABASE_URL, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD


def get_postgres_connection():
    """Retorna conexão psycopg2"""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )


def get_sqlalchemy_engine():
    """Retorna engine SQLAlchemy"""
    return create_engine(DATABASE_URL)


def test_connection():
    """Testa conexão com banco"""
    try:
        conn = get_postgres_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        cursor.close()
        conn.close()
        return True, version[0]
    except Exception as e:
        return False, str(e)
