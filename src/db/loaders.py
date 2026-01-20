import pandas as pd
from sqlalchemy import text
from src.db.connection import get_sqlalchemy_engine
import yaml
from pathlib import Path


def load_config(config_file):
    """Carrega arquivo de configuração YAML"""
    with open(config_file, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)


def load_rdstation_to_raw(csv_file):
    """Carrega CSV do RD Station para raw.rd_leads"""
    print(f"\n{'='*60}")
    print(f"Importando RD Station: {Path(csv_file).name}")
    print(f"{'='*60}")
    
    config = load_config('config/sources.yml')
    rd_config = config['rdstation']
    
    df = pd.read_csv(
        csv_file,
        encoding=rd_config['encoding'],
        sep='\t',
        low_memory=False
    )
    
    print(f"✅ Arquivo lido: {len(df)} linhas")
    
    col_map = rd_config['columns']
    
    df_mapped = pd.DataFrame({
        'email': df[col_map['email']] if col_map['email'] in df.columns else None,
        'nome': df[col_map['name']] if col_map['name'] in df.columns else None,
        'telefone': df[col_map['phone']] if col_map['phone'] in df.columns else None,
        'celular': df[col_map['mobile']] if col_map['mobile'] in df.columns else None,
        'empresa': df[col_map['company']] if col_map['company'] in df.columns else None,
        'cargo': df[col_map['job_title']] if col_map['job_title'] in df.columns else None,
        'cidade': df[col_map['city']] if col_map['city'] in df.columns else None,
        'estado': df[col_map['state']] if col_map['state'] in df.columns else None,
        'pais': df[col_map['country']] if col_map['country'] in df.columns else None,
        'tags': df[col_map['tags']] if col_map['tags'] in df.columns else None,
        'estagio_funil': df[col_map['lead_stage']] if col_map['lead_stage'] in df.columns else None,
        'status_comunicacao': df[col_map['lead_status']] if col_map['lead_status'] in df.columns else None,
        'data_primeira_conversao': df[col_map['conversion_date']] if col_map['conversion_date'] in df.columns else None,
        'data_ultima_conversao': df[col_map['last_conversion']] if col_map['last_conversion'] in df.columns else None,
        'total_conversoes': df[col_map['conversion_count']] if col_map['conversion_count'] in df.columns else None,
    })
    
    engine = get_sqlalchemy_engine()
    
    df_mapped.to_sql(
        'rd_leads',
        engine,
        schema='raw',
        if_exists='append',
        index=False,
        chunksize=1000
    )
    
    print(f"✅ {len(df_mapped)} registros inseridos em raw.rd_leads")
    return len(df_mapped)


def load_hotmart_to_raw(excel_file):
    """Carrega Excel do Hotmart para raw.sales_orders"""
    print(f"\n{'='*60}")
    print(f"Importando Hotmart: {Path(excel_file).name}")
    print(f"{'='*60}")
    
    config = load_config('config/sources.yml')
    ht_config = config['hotmart']
    
    df = pd.read_excel(excel_file)
    
    print(f"✅ Arquivo lido: {len(df)} linhas")
    
    col_map = ht_config['columns']
    
    df_mapped = pd.DataFrame({
        'source': 'hotmart',
        'transaction_id': df[col_map['transaction_id']] if col_map['transaction_id'] in df.columns else None,
        'product_name': df[col_map['product_name']] if col_map['product_name'] in df.columns else None,
        'status': df[col_map['status']] if col_map['status'] in df.columns else None,
        'sale_date': df[col_map['sale_date']] if col_map['sale_date'] in df.columns else None,
        'confirmation_date': df[col_map['confirmation_date']] if col_map['confirmation_date'] in df.columns else None,
        'name': df[col_map['name']] if col_map['name'] in df.columns else None,
        'email': df[col_map['email']] if col_map['email'] in df.columns else None,
        'document': df[col_map['document']].astype(str) if col_map['document'] in df.columns else None,
        'phone': df[col_map['phone']].astype(str) if col_map['phone'] in df.columns else None,
        'ddd': df[col_map['ddd']].astype(str) if col_map['ddd'] in df.columns else None,
        'city': df[col_map['city']] if col_map['city'] in df.columns else None,
        'state': df[col_map['state']] if col_map['state'] in df.columns else None,
        'country': df[col_map['country']] if col_map['country'] in df.columns else None,
        'total_price': df[col_map['total_price']].astype(str) if col_map['total_price'] in df.columns else None,
        'payment_type': df[col_map['payment_type']] if col_map['payment_type'] in df.columns else None,
        'currency': df[col_map['currency']] if col_map['currency'] in df.columns else None,
        'producer_name': df[col_map['producer_name']] if col_map['producer_name'] in df.columns else None,
        'affiliate_name': df[col_map['affiliate_name']] if col_map['affiliate_name'] in df.columns else None,
    })
    
    engine = get_sqlalchemy_engine()
    
    df_mapped.to_sql(
        'sales_orders',
        engine,
        schema='raw',
        if_exists='append',
        index=False,
        chunksize=1000
    )
    
    print(f"✅ {len(df_mapped)} registros inseridos em raw.sales_orders")
    return len(df_mapped)


def load_doity_to_raw(folder_path):
    """Carrega múltiplos arquivos Excel da Doity para raw.sales_orders"""
    print(f"\n{'='*60}")
    print(f"Importando Doity: {folder_path}")
    print(f"{'='*60}")
    
    config = load_config('config/sources.yml')
    doity_config = config['doity']
    
    folder = Path(folder_path)
    excel_files = list(folder.glob("*.xlsx"))
    
    print(f"✅ Encontrados {len(excel_files)} arquivos")
    
    all_data = []
    
    for excel_file in excel_files:
        try:
            df = pd.read_excel(excel_file)
            print(f"  → {excel_file.name}: {len(df)} registros")
            all_data.append(df)
        except Exception as e:
            print(f"  ⚠️  Erro em {excel_file.name}: {str(e)}")
    
    # Concatena todos
    df_all = pd.concat(all_data, ignore_index=True)
    print(f"\n✅ Total consolidado: {len(df_all)} registros")
    
    col_map = doity_config['columns']
    
    # Mapeia para formato padrão
    df_mapped = pd.DataFrame({
        'source': 'doity',
        'transaction_id': df_all[col_map['purchase_id']].astype(str) if col_map['purchase_id'] in df_all.columns else None,
        'product_name': 'Evento Doity',  # Genérico por enquanto
        'status': df_all[col_map['purchase_status']] if col_map['purchase_status'] in df_all.columns else None,
        'sale_date': df_all[col_map['inscription_date']] if col_map['inscription_date'] in df_all.columns else None,
        'confirmation_date': df_all[col_map['inscription_date']] if col_map['inscription_date'] in df_all.columns else None,
        'name': df_all[col_map['name']] if col_map['name'] in df_all.columns else None,
        'email': df_all[col_map['email']] if col_map['email'] in df_all.columns else None,
        'document': None,  # Doity não tem documento
        'phone': df_all[col_map['phone']].astype(str) if col_map['phone'] in df_all.columns else None,
        'ddd': None,
        'city': None,
        'state': df_all[col_map['state']] if col_map['state'] in df_all.columns else None,
        'country': 'Brasil',
        'total_price': df_all[col_map['value']].astype(str) if col_map['value'] in df_all.columns else None,
        'payment_type': 'Doity',
        'currency': 'BRL',
        'producer_name': 'CENAT',
        'affiliate_name': None,
    })
    
    engine = get_sqlalchemy_engine()
    
    df_mapped.to_sql(
        'sales_orders',
        engine,
        schema='raw',
        if_exists='append',
        index=False,
        chunksize=1000
    )
    
    print(f"✅ {len(df_mapped)} registros inseridos em raw.sales_orders")
    return len(df_mapped)
