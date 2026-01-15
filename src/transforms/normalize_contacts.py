import re


def normalize_email(email):
    """Normaliza email (lowercase, trim)"""
    if not email or pd.isna(email):
        return None
    
    email = str(email).strip().lower()
    
    # Remove espaços
    email = re.sub(r'\s+', '', email)
    
    # Valida formato básico
    if '@' not in email or '.' not in email:
        return None
    
    return email


def normalize_phone(phone, ddd=None):
    """Normaliza telefone (apenas números)"""
    if not phone or pd.isna(phone):
        return None
    
    phone = str(phone).strip()
    
    # Remove tudo exceto números
    phone = re.sub(r'\D', '', phone)
    
    # Adiciona DDD se fornecido
    if ddd and not pd.isna(ddd):
        ddd_clean = re.sub(r'\D', '', str(ddd))
        if len(phone) <= 9:  # Telefone sem DDD
            phone = ddd_clean + phone
    
    # Remove código do país se tiver
    if phone.startswith('55') and len(phone) > 11:
        phone = phone[2:]
    
    return phone if len(phone) >= 10 else None


def normalize_name(name):
    """Normaliza nome (title case, trim)"""
    if not name or pd.isna(name):
        return None
    
    name = str(name).strip()
    
    # Remove espaços extras
    name = re.sub(r'\s+', ' ', name)
    
    # Title case
    name = name.title()
    
    return name if len(name) > 2 else None


def normalize_document(document):
    """Normaliza CPF/CNPJ (apenas números)"""
    if not document or pd.isna(document):
        return None
    
    doc = str(document).strip()
    
    # Remove tudo exceto números
    doc = re.sub(r'\D', '', doc)
    
    # Valida tamanho (CPF=11, CNPJ=14)
    if len(doc) not in [11, 14]:
        return None
    
    return doc


import pandas as pd
