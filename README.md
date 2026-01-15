# Customer 360 Intelligence System

Sistema de inteligência de clientes com deduplicação, métricas e dashboard.

## Status do Projeto

✅ Estrutura criada
✅ PostgreSQL configurado (Docker, porta 5433)
✅ Ambiente Python configurado
✅ Arquivos de dados identificados:
- RD Station: 42.327 leads
- Hotmart: 13.013 vendas

## Arquitetura
```
raw → stg → core → metrics → mart
```

## Configuração

### 1. Pré-requisitos
- Python 3.11+
- Docker
- PostgreSQL (via Docker)

### 2. Instalação
```bash
# Clonar o repositório
git clone <repo>
cd Customer-Intelligence

# Criar ambiente virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependências
pip install -r requirements.txt

# Subir PostgreSQL
cd docker && docker-compose up -d && cd ..
```

### 3. Conexão com Banco
```python
from src.db.connection import test_connection
success, msg = test_connection()
```

## Estrutura de Dados

### Fontes
- **RD Station**: Leads (UTF-16, tab-separated)
- **Hotmart**: Vendas (Excel)
- **Doit**: (a configurar)

### Schemas PostgreSQL
- `raw`: Dados brutos
- `stg`: Staging (normalizado)
- `core`: Customer 360
- `metrics`: Agregações
- `mart`: Views para BI
- `audit`: Qualidade

## Próximos Passos

1. [ ] Criar tabelas raw
2. [ ] ETL Python (importar dados)
3. [ ] Transformações SQL (staging)
4. [ ] Identity Resolution (dedup)
5. [ ] Métricas (RFM, ativo/inativo)
6. [ ] Marts para Dashboard

## Comandos Úteis
```bash
# Ativar ambiente
source venv/bin/activate

# Ver logs do PostgreSQL
docker logs customer360_db

# Acessar PostgreSQL
docker exec -it customer360_db psql -U postgres -d customer360
```
