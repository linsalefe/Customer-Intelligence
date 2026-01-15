import pandas as pd
from pathlib import Path


def inspect_csv(filepath):
    """Inspeciona arquivo CSV"""
    print(f"\n{'='*60}")
    print(f"Arquivo: {filepath.name}")
    print(f"{'='*60}")
    
    # Tenta diferentes encodings incluindo UTF-16
    encodings = ['utf-16', 'utf-16-le', 'utf-8', 'latin-1', 'iso-8859-1', 'cp1252']
    separators = ['\t', ',', ';']
    df = None
    used_enc = None
    used_sep = None
    
    for enc in encodings:
        for sep in separators:
            try:
                df = pd.read_csv(filepath, nrows=5, encoding=enc, sep=sep)
                if len(df.columns) > 5:  # CSV válido tem múltiplas colunas
                    used_enc = enc
                    used_sep = sep
                    print(f"✅ Encoding: {enc} | Separador: '{sep}'")
                    break
            except:
                continue
        if df is not None:
            break
    
    if df is None:
        print("❌ Não conseguiu ler o arquivo")
        return None
    
    try:
        total_rows = len(pd.read_csv(filepath, encoding=used_enc, sep=used_sep))
        print(f"\nLinhas totais: {total_rows}")
    except:
        print("\nLinhas totais: (não foi possível contar)")
    
    print(f"Colunas: {len(df.columns)}")
    print(f"\nPrimeiras 10 colunas:")
    for i, col in enumerate(df.columns[:10], 1):
        print(f"{i}. {col}")
    
    print(f"\nPrimeiras 2 linhas:")
    print(df.head(2).to_string())
    
    return df, used_enc, used_sep


def inspect_excel(filepath):
    """Inspeciona arquivo Excel"""
    print(f"\n{'='*60}")
    print(f"Arquivo: {filepath.name}")
    print(f"{'='*60}")
    
    df = pd.read_excel(filepath, nrows=5)
    
    print(f"\nLinhas totais: {len(pd.read_excel(filepath))}")
    print(f"Colunas: {len(df.columns)}")
    print(f"\nNomes das colunas:")
    for i, col in enumerate(df.columns, 1):
        print(f"{i}. {col}")
    
    print(f"\nPrimeiras 3 linhas:")
    print(df.head(3).to_string())
    
    return df
