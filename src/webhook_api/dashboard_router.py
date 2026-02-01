from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from src.db.connection import get_sqlalchemy_engine
from src.webhook_api.auth_router import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def row_to_dict(row, keys):
    return dict(zip(keys, row))


@router.get("/kpis")
def get_kpis(user: dict = Depends(get_current_user)):
    engine = get_sqlalchemy_engine()
    with engine.connect() as conn:
        result = conn.execute(text("SELECT * FROM mart.overview_kpis"))
        row = result.fetchone()
        keys = result.keys()
    return row_to_dict(row, keys)


@router.get("/active-inactive")
def get_active_inactive(
    segment: str = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0),
    user: dict = Depends(get_current_user)
):
    engine = get_sqlalchemy_engine()
    query = "SELECT * FROM mart.active_inactive WHERE total_orders > 0"
    params = {}

    if segment:
        query += " AND customer_segment = :segment"
        params["segment"] = segment

    query += " ORDER BY total_revenue DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit
    params["offset"] = offset

    with engine.connect() as conn:
        result = conn.execute(text(query), params)
        keys = list(result.keys())
        rows = [row_to_dict(r, keys) for r in result.fetchall()]

    return {"data": rows, "limit": limit, "offset": offset}


@router.get("/reactivation")
def get_reactivation(
    min_score: int = Query(0),
    limit: int = Query(50, le=500),
    offset: int = Query(0),
    user: dict = Depends(get_current_user)
):
    engine = get_sqlalchemy_engine()
    query = """
        SELECT * FROM mart.reactivation_list
        WHERE reactivation_score >= :min_score
        ORDER BY reactivation_score DESC, ltv DESC
        LIMIT :limit OFFSET :offset
    """
    with engine.connect() as conn:
        result = conn.execute(text(query), {"min_score": min_score, "limit": limit, "offset": offset})
        keys = list(result.keys())
        rows = [row_to_dict(r, keys) for r in result.fetchall()]

    return {"data": rows, "limit": limit, "offset": offset}


@router.get("/top-customers")
def get_top_customers(
    limit: int = Query(30, le=100),
    user: dict = Depends(get_current_user)
):
    engine = get_sqlalchemy_engine()
    query = """
        SELECT * FROM mart.top_customers
        WHERE rank_revenue <= :limit
        ORDER BY rank_revenue
    """
    with engine.connect() as conn:
        result = conn.execute(text(query), {"limit": limit})
        keys = list(result.keys())
        rows = [row_to_dict(r, keys) for r in result.fetchall()]

    return {"data": rows}


@router.get("/revenue-timeseries")
def get_revenue_timeseries(
    months: int = Query(12, le=60),
    user: dict = Depends(get_current_user)
):
    engine = get_sqlalchemy_engine()
    query = """
        SELECT 
            TO_CHAR(mes, 'YYYY-MM') as mes,
            clientes_unicos,
            total_pedidos,
            ROUND(receita_total::numeric, 2) as receita_total,
            ROUND(ticket_medio::numeric, 2) as ticket_medio,
            novos_clientes
        FROM mart.revenue_timeseries
        WHERE mes >= CURRENT_DATE - MAKE_INTERVAL(months => :months)
        ORDER BY mes
    """
    with engine.connect() as conn:
        result = conn.execute(text(query), {"months": months})
        keys = list(result.keys())
        rows = [row_to_dict(r, keys) for r in result.fetchall()]

    return {"data": rows}


@router.get("/cohort")
def get_cohort(
    months: int = Query(12, le=36),
    user: dict = Depends(get_current_user)
):
    engine = get_sqlalchemy_engine()
    query = """
        SELECT cohort_month, months_since::int, customers, ROUND(revenue::numeric, 2) as revenue
        FROM mart.cohort_analysis
        WHERE cohort_month >= TO_CHAR(CURRENT_DATE - MAKE_INTERVAL(months => :months), 'YYYY-MM')
        ORDER BY cohort_month, months_since
    """
    with engine.connect() as conn:
        result = conn.execute(text(query), {"months": months})
        keys = list(result.keys())
        rows = [dict(zip(keys, r)) for r in result.fetchall()]
    return {"data": rows}


@router.get("/customer/{customer_id}/orders")
def get_customer_orders(
    customer_id: int,
    user: dict = Depends(get_current_user)
):
    engine = get_sqlalchemy_engine()
    
    # Dados do cliente
    customer_query = """
        SELECT c.customer_id, c.email_master, c.name_master, c.phone_master, 
               c.city, c.state, m.total_orders, m.total_revenue, m.avg_ticket,
               m.first_purchase_date, m.last_purchase_date, m.days_since_last_purchase,
               m.is_active, m.recency_band
        FROM core.customer c
        LEFT JOIN metrics.customer_summary m ON c.customer_id = m.customer_id
        WHERE c.customer_id = :customer_id
    """
    
    # Pedidos do cliente
    orders_query = """
        SELECT order_id, product_name, sale_date::date as sale_date, 
               total_price, original_price, original_currency,
               payment_type, source
        FROM core.orders
        WHERE customer_id = :customer_id
        ORDER BY sale_date DESC
    """
    
    with engine.connect() as conn:
        cust_result = conn.execute(text(customer_query), {"customer_id": customer_id})
        cust_keys = list(cust_result.keys())
        cust_row = cust_result.fetchone()
        
        if not cust_row:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Cliente não encontrado")
        
        orders_result = conn.execute(text(orders_query), {"customer_id": customer_id})
        orders_keys = list(orders_result.keys())
        orders_rows = [dict(zip(orders_keys, r)) for r in orders_result.fetchall()]
    
    return {
        "customer": dict(zip(cust_keys, cust_row)),
        "orders": orders_rows
    }
