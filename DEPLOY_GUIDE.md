# 🚀 Customer 360 - Guia de Deploy e Manutenção

## Dados do Servidor

| Item | Valor |
|------|-------|
| **Domínio** | `https://cenatdata.online` |
| **IP** | `100.24.2.187` |
| **SSH** | `ssh -i ~/Downloads/LightsailDefaultKey-us-east-1.pem ubuntu@100.24.2.187` |
| **Frontend** | `https://cenatdata.online` (porta 3001 interna) |
| **API** | `https://cenatdata.online/api` (porta 8001 interna) |
| **Login** | `admin@cenat.com` / `admin123` |
| **DB Produção** | `postgres:5432` (interno Docker) / `localhost:5433` (externo) |

## Métricas Atuais (Fev/2026)

| Métrica | Valor |
|---------|-------|
| Compradores | 39.834 |
| Ativos (365 dias) | 19.156 |
| Inativos | 20.678 |
| Receita Total | R$ 6.9M |
| Ticket Médio | R$ 89 |
| LTV Médio | R$ 174 |
| Total Pedidos | 77.719 |

## Regras de Negócio

- **Cliente Ativo**: Comprou nos últimos **365 dias** (12 meses)
- **Cliente Inativo**: Não compra há mais de 365 dias
- **Conversão de Moeda**: Valores em USD, COP, EUR, etc. são convertidos para BRL

---

## 1. Alterar Código e Subir para o Servidor

### Passo 1: Faça as alterações no Mac (VSCode)

Edite os arquivos normalmente no seu projeto local.

### Passo 2: Commit e Push (Mac)

```bash
cd ~/Customer-Intelligence
git add .
git commit -m "descrição da mudança"
git push
```

### Passo 3: Pull no Servidor

```bash
# Conectar no servidor
ssh -i ~/Downloads/LightsailDefaultKey-us-east-1.pem ubuntu@100.24.2.187

# Puxar as mudanças
cd ~/Customer-Intelligence
git pull
```

### Passo 4: Rebuild do serviço alterado

**Se mudou código da API** (qualquer arquivo em `src/`):

```bash
cd ~/Customer-Intelligence/docker
docker rm -f customer360_api
docker-compose -f docker-compose.prod.yml build --no-cache api
docker run -d --name customer360_api \
  --network docker_default \
  -p 8001:8001 \
  -e DB_HOST=postgres \
  -e DB_PORT=5432 \
  -e DB_NAME=customer360 \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  docker_api
```

**Se mudou código do Frontend** (qualquer arquivo em `frontend/`):

```bash
cd ~/Customer-Intelligence/docker
docker rm -f customer360_front
docker-compose -f docker-compose.prod.yml build --no-cache frontend
docker run -d --name customer360_front \
  --network docker_default \
  -p 3001:3000 \
  docker_frontend
```

**Se mudou os dois:**

```bash
cd ~/Customer-Intelligence/docker
docker rm -f customer360_api customer360_front
docker-compose -f docker-compose.prod.yml build --no-cache api frontend
docker run -d --name customer360_api \
  --network docker_default \
  -p 8001:8001 \
  -e DB_HOST=postgres \
  -e DB_PORT=5432 \
  -e DB_NAME=customer360 \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  docker_api
docker run -d --name customer360_front \
  --network docker_default \
  -p 3001:3000 \
  docker_frontend
```

### Passo 5: Verificar

```bash
docker ps
docker logs customer360_api --tail 5
docker logs customer360_front --tail 5
```

---

## 2. Importar Novos Dados

### Fontes de Dados

| Fonte | Formato | Pasta Local |
|-------|---------|-------------|
| RD Station | CSV (UTF-16, tab) | `data/landing/rdstation/` |
| Hotmart | XLS/XLSX | `data/landing/hotmart/` |
| Doity | XLSX (múltiplos) | `data/landing/doity/` |

### Importar Dados da Doity (96 arquivos de eventos)

No **Mac**, coloque os arquivos `.xlsx` em `data/landing/doity/` e rode:

```bash
cd ~/Desktop/Customer-Intelligence
python3 -c "
import pandas as pd
from pathlib import Path
from sqlalchemy import create_engine

engine = create_engine('postgresql://postgres:postgres@localhost:5433/customer360')

doity_folder = Path('data/landing/doity')
xlsx_files = list(doity_folder.glob('*.xlsx'))
print(f'Encontrados {len(xlsx_files)} arquivos')

total = 0

def get_col(df, options):
    for opt in options:
        if opt in df.columns:
            return df[opt]
    return None

for f in xlsx_files:
    try:
        df = pd.read_excel(f)
        phone = get_col(df, ['Telefone', 'Telefone do comprador', 'Se quiser, você pode receber a confirmação da sua inscrição pelo WhatsApp. Basta informar seu telefone'])
        state = get_col(df, ['Em qual estado você mora?', 'Qual estado você mora?', 'Estado'])
        
        df_mapped = pd.DataFrame({
            'source': 'doity',
            'transaction_id': df['Nº compra'].astype(str) if 'Nº compra' in df.columns else None,
            'product_name': df['Evento'] if 'Evento' in df.columns else f.stem,
            'status': df['Situação da compra'] if 'Situação da compra' in df.columns else None,
            'sale_date': df['Data da inscrição'].astype(str) if 'Data da inscrição' in df.columns else None,
            'confirmation_date': df['Data da inscrição'].astype(str) if 'Data da inscrição' in df.columns else None,
            'name': df['Nome'] if 'Nome' in df.columns else None,
            'email': df['E-mail'] if 'E-mail' in df.columns else None,
            'document': None,
            'phone': phone.astype(str) if phone is not None else None,
            'ddd': None,
            'city': None,
            'state': state if state is not None else None,
            'country': 'Brasil',
            'total_price': df['Valor'].astype(str) if 'Valor' in df.columns else None,
            'payment_type': 'Doity',
            'currency': 'BRL',
            'producer_name': 'CENAT',
            'affiliate_name': None
        })
        
        df_mapped.to_sql('sales_orders', engine, schema='raw', if_exists='append', index=False)
        total += len(df_mapped)
        print(f'✓ {len(df_mapped):>5} | {f.stem[:55]}')
    except Exception as e:
        print(f'✗ ERRO | {f.stem[:55]} | {str(e)[:40]}')

print(f'\nTotal importado: {total:,} registros')
"
```

### Opção A: Importar via Mac (recomendado para volumes grandes)

#### 2.1. Importar localmente no Mac

```bash
# Coloque os arquivos em data/landing/
cp ~/Downloads/novo_rdstation.csv data/landing/rdstation/
cp ~/Downloads/novo_hotmart.xls data/landing/hotmart/

# Rode o pipeline local
python -m src.main full-refresh
```

#### 2.2. Exportar o banco atualizado

```bash
docker exec customer360_db pg_dump -U postgres -d customer360 \
  --schema=core --schema=metrics --schema=stg --schema=raw \
  --no-owner --no-acl --inserts --column-inserts \
  > ~/Desktop/customer360_dump_inserts.sql
```

#### 2.3. Enviar para o servidor

```bash
scp -i ~/Downloads/LightsailDefaultKey-us-east-1.pem \
  ~/Desktop/customer360_dump_inserts.sql ubuntu@100.24.2.187:~/
```

#### 2.4. Importar no servidor

```bash
# Conectar no servidor
ssh -i ~/Downloads/LightsailDefaultKey-us-east-1.pem ubuntu@100.24.2.187

# Limpar tabelas existentes
docker exec customer360_db psql -U postgres -d customer360 -c "
DROP TABLE IF EXISTS metrics.customer_summary CASCADE;
DROP TABLE IF EXISTS core.orders CASCADE;
DROP TABLE IF EXISTS core.suspected_duplicates CASCADE;
DROP TABLE IF EXISTS core.customer CASCADE;
DROP TABLE IF EXISTS stg.orders_unified CASCADE;
DROP TABLE IF EXISTS stg.contacts CASCADE;
DROP TABLE IF EXISTS stg.exchange_rates CASCADE;
DROP TABLE IF EXISTS raw.sales_orders CASCADE;
DROP TABLE IF EXISTS raw.rd_leads CASCADE;
DROP TABLE IF EXISTS raw.hotmart_events CASCADE;
"

# Importar dump
docker cp ~/customer360_dump_inserts.sql customer360_db:/tmp/dump.sql
docker exec customer360_db psql -U postgres -d customer360 -f /tmp/dump.sql 2>&1 | tail -10
```

#### 2.5. Recriar as views mart e aplicar correções

```bash
docker exec customer360_db psql -U postgres -d customer360 -c "
-- Corrigir conversão de moeda (valores não-BRL)
UPDATE core.orders o
SET total_price = o.total_price * COALESCE(e.rate_to_brl, 1)
FROM stg.exchange_rates e
WHERE o.currency = e.currency
AND o.currency != 'BRL'
AND o.total_price > 1000;

-- Recalcular métricas com critério de 365 dias
TRUNCATE metrics.customer_summary;

INSERT INTO metrics.customer_summary
SELECT 
    c.customer_id,
    COALESCE(COUNT(o.order_id), 0),
    COALESCE(SUM(o.total_price), 0),
    COALESCE(AVG(o.total_price), 0),
    MIN(o.sale_date)::date,
    MAX(o.sale_date)::date,
    COALESCE(CURRENT_DATE - MAX(o.sale_date)::date, 9999),
    CASE WHEN MAX(o.sale_date)::date >= CURRENT_DATE - INTERVAL '365 days' THEN true ELSE false END,
    CASE 
        WHEN MAX(o.sale_date) IS NULL THEN 'Nunca comprou'
        WHEN CURRENT_DATE - MAX(o.sale_date)::date <= 30 THEN '0-30 dias'
        WHEN CURRENT_DATE - MAX(o.sale_date)::date <= 60 THEN '31-60 dias'
        WHEN CURRENT_DATE - MAX(o.sale_date)::date <= 90 THEN '61-90 dias'
        WHEN CURRENT_DATE - MAX(o.sale_date)::date <= 180 THEN '91-180 dias'
        ELSE '180+ dias'
    END
FROM core.customer c
LEFT JOIN core.orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id;

CREATE OR REPLACE VIEW mart.overview_kpis AS
SELECT
    (SELECT COUNT(*) FROM metrics.customer_summary WHERE total_orders > 0) as total_compradores,
    (SELECT COUNT(*) FROM metrics.customer_summary WHERE is_active) as clientes_ativos,
    (SELECT COUNT(*) FROM metrics.customer_summary WHERE NOT is_active AND total_orders > 0) as clientes_inativos,
    (SELECT ROUND(SUM(total_price), 2) FROM core.orders) as receita_total,
    (SELECT ROUND(AVG(total_price), 2) FROM core.orders) as ticket_medio,
    (SELECT ROUND(AVG(total_revenue), 2) FROM metrics.customer_summary WHERE total_orders > 0) as ltv_medio,
    (SELECT COUNT(*) FROM core.orders) as total_pedidos,
    (SELECT COUNT(*) FROM core.orders WHERE sale_date >= CURRENT_DATE - INTERVAL '30 days') as pedidos_ultimos_30_dias,
    (SELECT COUNT(*) FROM core.orders WHERE sale_date >= CURRENT_DATE - INTERVAL '90 days') as pedidos_ultimos_90_dias,
    (SELECT MIN(sale_date)::date FROM core.orders) as primeira_venda,
    (SELECT MAX(sale_date)::date FROM core.orders) as ultima_venda;

CREATE OR REPLACE VIEW mart.active_inactive AS
SELECT c.customer_id, c.email_master, c.name_master, c.phone_master, c.city, c.state,
    m.total_orders, m.total_revenue, m.avg_ticket, m.first_purchase_date, m.last_purchase_date, 
    m.days_since_last_purchase, m.is_active, m.recency_band,
    CASE WHEN m.is_active THEN 'Ativo' WHEN m.total_orders > 0 THEN 'Inativo' ELSE 'Lead' END as customer_segment
FROM core.customer c INNER JOIN metrics.customer_summary m ON c.customer_id = m.customer_id;

CREATE OR REPLACE VIEW mart.reactivation_list AS
SELECT c.customer_id, c.email_master, c.name_master, c.phone_master, c.city, c.state,
    m.total_orders, m.total_revenue as ltv, m.last_purchase_date, m.days_since_last_purchase, m.recency_band,
    CASE WHEN m.days_since_last_purchase BETWEEN 366 AND 545 THEN 100 WHEN m.days_since_last_purchase BETWEEN 546 AND 730 THEN 80 WHEN m.days_since_last_purchase > 730 THEN 60 ELSE 0 END +
    CASE WHEN m.total_orders >= 5 THEN 50 WHEN m.total_orders >= 3 THEN 30 WHEN m.total_orders >= 2 THEN 20 ELSE 10 END +
    CASE WHEN m.total_revenue >= 1000 THEN 50 WHEN m.total_revenue >= 500 THEN 30 WHEN m.total_revenue >= 200 THEN 20 ELSE 10 END as reactivation_score
FROM core.customer c INNER JOIN metrics.customer_summary m ON c.customer_id = m.customer_id
WHERE m.is_active = false AND m.total_orders > 0 ORDER BY reactivation_score DESC, m.total_revenue DESC;

CREATE OR REPLACE VIEW mart.top_customers AS
SELECT c.customer_id, c.email_master, c.name_master, c.phone_master, c.city, c.state,
    m.total_orders, m.total_revenue, m.avg_ticket, m.first_purchase_date, m.last_purchase_date, m.is_active,
    RANK() OVER (ORDER BY m.total_revenue DESC) as rank_revenue, RANK() OVER (ORDER BY m.total_orders DESC) as rank_frequency
FROM core.customer c INNER JOIN metrics.customer_summary m ON c.customer_id = m.customer_id WHERE m.total_orders > 0;

CREATE OR REPLACE VIEW mart.revenue_timeseries AS
SELECT DATE_TRUNC('month', o.sale_date) as mes, COUNT(DISTINCT o.customer_id) as clientes_unicos, COUNT(*) as total_pedidos,
    SUM(o.total_price) as receita_total, AVG(o.total_price) as ticket_medio,
    COUNT(DISTINCT CASE WHEN DATE_TRUNC('month', o.sale_date) = DATE_TRUNC('month', f.first_purchase) THEN o.customer_id END) as novos_clientes
FROM core.orders o LEFT JOIN (SELECT customer_id, MIN(sale_date) as first_purchase FROM core.orders GROUP BY customer_id) f ON o.customer_id = f.customer_id
GROUP BY DATE_TRUNC('month', o.sale_date) ORDER BY mes;

CREATE OR REPLACE VIEW mart.cohort_analysis AS
SELECT DATE_TRUNC('month', f.first_purchase)::date as cohort_month,
    (EXTRACT(YEAR FROM DATE_TRUNC('month', o.sale_date)) - EXTRACT(YEAR FROM DATE_TRUNC('month', f.first_purchase))) * 12 +
    (EXTRACT(MONTH FROM DATE_TRUNC('month', o.sale_date)) - EXTRACT(MONTH FROM DATE_TRUNC('month', f.first_purchase))) as months_since,
    COUNT(DISTINCT o.customer_id) as customers, SUM(o.total_price) as revenue
FROM core.orders o INNER JOIN (SELECT customer_id, MIN(sale_date) as first_purchase FROM core.orders GROUP BY customer_id) f ON o.customer_id = f.customer_id
GROUP BY cohort_month, months_since ORDER BY cohort_month, months_since;

SELECT * FROM mart.overview_kpis;
"
```

#### 2.6. Recriar usuário admin (se necessário)

```bash
docker exec customer360_api python -c "
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
print(pwd_context.hash('admin123'))
"
# Copie o hash gerado e rode:
docker exec customer360_db psql -U postgres -d customer360 -c "
INSERT INTO core.users (name, email, password_hash, role)
VALUES ('Admin CENAT', 'admin@cenat.com', 'COLE_O_HASH_AQUI', 'admin')
ON CONFLICT (email) DO NOTHING;
"
```

#### 2.7. Verificar

```bash
docker exec customer360_db psql -U postgres -d customer360 -c "SELECT * FROM mart.overview_kpis;"
```

---

## 3. Comandos Rápidos de Verificação

```bash
# Ver containers rodando
docker ps

# Ver logs da API
docker logs customer360_api --tail 20

# Ver logs do Frontend
docker logs customer360_front --tail 20

# Ver KPIs no banco
docker exec customer360_db psql -U postgres -d customer360 -c "SELECT * FROM mart.overview_kpis;"

# Ver contagem de registros
docker exec customer360_db psql -U postgres -d customer360 -c "
SELECT 'customers' as tab, COUNT(*) FROM core.customer
UNION ALL SELECT 'orders', COUNT(*) FROM core.orders
UNION ALL SELECT 'metrics', COUNT(*) FROM metrics.customer_summary;
"

# Reiniciar um container
docker restart customer360_api
docker restart customer360_front
docker restart customer360_db
```

---

## 4. Troubleshooting

### Container não sobe

```bash
docker logs customer360_api --tail 30
```

### CORS bloqueando requests

Verificar se o IP está na lista de origins em `src/webhook_api/app.py`:

```python
allow_origins=["http://localhost:3001", "http://100.24.2.187:3001"],
```

Após editar, rebuild a API (ver Seção 1, Passo 4).

### Erro "ContainerConfig" no docker-compose

Usar `docker run` manualmente em vez de `docker-compose up`:

```bash
docker rm -f customer360_api
docker run -d --name customer360_api \
  --network docker_default \
  -p 8001:8001 \
  -e DB_HOST=postgres \
  -e DB_PORT=5432 \
  -e DB_NAME=customer360 \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  docker_api
```

### Login não funciona após reimportar dados

Recriar o hash do admin (ver Seção 2.6).

### Dados duplicados após importação

Sempre fazer DROP das tabelas antes de importar novamente (ver Seção 2.4).

### Servidor desligou / reiniciou

```bash
ssh -i ~/Downloads/LightsailDefaultKey-us-east-1.pem ubuntu@100.24.2.187
docker ps -a
docker start customer360_db
docker start customer360_api
docker start customer360_front
```

---

## 5. Estrutura de Arquivos Importante

| Arquivo | O que faz |
|---------|-----------|
| `src/webhook_api/app.py` | API principal + CORS |
| `src/webhook_api/dashboard_router.py` | Endpoints do dashboard |
| `src/webhook_api/auth_router.py` | Login/autenticação |
| `src/webhook_api/users_router.py` | CRUD de usuários |
| `src/auth/security.py` | JWT + hash de senha |
| `frontend/src/lib/api.ts` | URL da API no frontend |
| `frontend/src/app/*/page.tsx` | Páginas do dashboard |
| `docker/docker-compose.prod.yml` | Docker produção |
| `docker/Dockerfile.api` | Build da API |
| `docker/Dockerfile.frontend` | Build do Frontend |
| `requirements.txt` | Dependências Python |

---

## 6. Checklist de Deploy Completo

- [ ] Alterações feitas localmente e testadas
- [ ] `git add . && git commit -m "..." && git push`
- [ ] No servidor: `git pull`
- [ ] Rebuild do serviço alterado (API e/ou Frontend)
- [ ] `docker ps` — 3 containers rodando
- [ ] Testar no navegador: `http://100.24.2.187:3001`
- [ ] Login funcionando
- [ ] Dashboard com dados corretos