import psycopg2
from pathlib import Path
from src.db.connection import get_postgres_connection
import time


def execute_sql_file(filepath):
    """Executa arquivo SQL com logs detalhados"""
    conn = get_postgres_connection()
    cursor = conn.cursor()
    
    try:
        print(f"\n📄 Lendo arquivo: {filepath.name}")
        with open(filepath, 'r', encoding='utf-8') as f:
            sql = f.read()
        
        print(f"⏳ Executando SQL... ({len(sql)} caracteres)")
        start_time = time.time()
        
        cursor.execute(sql)
        conn.commit()
        
        elapsed = time.time() - start_time
        print(f"✅ {filepath.name} - Concluído em {elapsed:.2f}s")
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"❌ {filepath.name}: {str(e)}")
        return False
        
    finally:
        cursor.close()
        conn.close()


def execute_sql_folder(folder_path):
    """Executa todos os SQLs de uma pasta em ordem"""
    folder = Path(folder_path)
    sql_files = sorted(folder.glob("*.sql"))
    
    print(f"\n{'='*60}")
    print(f"Executando SQLs de: {folder.name}")
    print(f"Total de arquivos: {len(sql_files)}")
    print(f"{'='*60}")
    
    success_count = 0
    for sql_file in sql_files:
        if execute_sql_file(sql_file):
            success_count += 1
    
    print(f"\n✅ {success_count}/{len(sql_files)} executados com sucesso\n")
    return success_count == len(sql_files)
