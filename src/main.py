import click
from pathlib import Path
from src.db.sql_runner import execute_sql_folder, execute_sql_file
from src.db.loaders import load_rdstation_to_raw, load_hotmart_to_raw
from src.db.connection import test_connection


@click.group()
def cli():
    """Customer 360 Intelligence System - CLI"""
    pass


@cli.command()
def test_db():
    """Testa conexão com banco de dados"""
    click.echo("🔌 Testando conexão...")
    success, msg = test_connection()
    if success:
        click.echo(f"✅ Conexão OK!")
        click.echo(f"📊 {msg}")
    else:
        click.echo(f"❌ Erro: {msg}")


@cli.command()
@click.option('--rdstation', type=click.Path(exists=True), help='Arquivo CSV do RD Station')
@click.option('--hotmart', type=click.Path(exists=True), help='Arquivo XLS do Hotmart')
def import_data(rdstation, hotmart):
    """Importa dados para camada RAW"""
    click.echo("\n📥 IMPORTANDO DADOS")
    
    if rdstation:
        click.echo(f"\n→ Importando RD Station...")
        load_rdstation_to_raw(rdstation)
    
    if hotmart:
        click.echo(f"\n→ Importando Hotmart...")
        load_hotmart_to_raw(hotmart)
    
    click.echo("\n✅ Importação concluída!")


@cli.command()
def build_warehouse():
    """Executa todas as transformações SQL (staging → core → metrics → mart)"""
    click.echo("\n🏗️  CONSTRUINDO WAREHOUSE")
    
    folders = [
        "sql/03_staging",
        "sql/04_identity_resolution",
        "sql/05_facts_metrics",
        "sql/06_marts_dashboard"
    ]
    
    for folder in folders:
        if Path(folder).exists():
            execute_sql_folder(folder)
    
    click.echo("\n✅ Warehouse construído!")


@cli.command()
def full_refresh():
    """Executa pipeline completo: importa dados + constrói warehouse"""
    click.echo("\n🚀 FULL REFRESH - PIPELINE COMPLETO")
    
    # 1. Importar dados
    rdstation_file = list(Path("data/landing/rdstation").glob("*.csv"))
    hotmart_files = list(Path("data/landing/hotmart").glob("*.xls*"))
    
    if rdstation_file:
        click.echo(f"\n→ Importando RD Station...")
        load_rdstation_to_raw(rdstation_file[0])
    
    if hotmart_files:
        click.echo(f"\n→ Importando Hotmart...")
        load_hotmart_to_raw(hotmart_files[0])
    
    # 2. Build warehouse
    click.echo("\n🏗️  Construindo warehouse...")
    folders = [
        "sql/03_staging",
        "sql/04_identity_resolution",
        "sql/05_facts_metrics",
        "sql/06_marts_dashboard"
    ]
    
    for folder in folders:
        if Path(folder).exists():
            execute_sql_folder(folder)
    
    click.echo("\n✅ Pipeline completo executado com sucesso!")


@cli.command()
def show_kpis():
    """Mostra KPIs principais do dashboard"""
    from src.db.connection import get_postgres_connection
    
    click.echo("\n📊 KPIS PRINCIPAIS\n")
    
    conn = get_postgres_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM mart.overview_kpis")
    result = cursor.fetchone()
    
    click.echo(f"👥 Total de Clientes: {result[0]:,}")
    click.echo(f"🛒 Compradores: {result[1]:,}")
    click.echo(f"✅ Ativos: {result[2]:,}")
    click.echo(f"❌ Inativos: {result[3]:,}")
    click.echo(f"🆕 Leads não convertidos: {result[4]:,}")
    click.echo(f"\n💰 Receita Total: R$ {result[5]:,.2f}")
    click.echo(f"🎫 Ticket Médio: R$ {result[6]:,.2f}")
    click.echo(f"💎 LTV Médio: R$ {result[7]:,.2f}")
    click.echo(f"\n📦 Total de Pedidos: {result[8]:,}")
    click.echo(f"📅 Últimos 30 dias: {result[9]:,}")
    click.echo(f"📅 Últimos 90 dias: {result[10]:,}")
    
    cursor.close()
    conn.close()


if __name__ == '__main__':
    cli()
