import json
import re
from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.api.deps import require_any_role
from app.db.session import get_db
from app.db.models import Dashboard


router = APIRouter(prefix="/dashboards", tags=["dashboards"])


class DashboardSaveRequest(BaseModel):
    name: str
    spec: dict


class DashboardOut(BaseModel):
    id: int
    name: str
    description: str


class MyDashboardOut(BaseModel):
    id: int
    name: str
    description: str
    last_opened: str | None


class DashboardItemOut(BaseModel):
    id: int
    dashboard_id: int
    item_type: str
    display_order: int
    geometry: str
    attributes: str | None
    sql_id: int

class DashboardTabResult(BaseModel):
    tab_id: int
    tab_name: str
    display_order: int | None


class QueryResult(BaseModel):
    columns: List[str]
    rows: List[List[Any]]


class DashboardItemResult(BaseModel):
    item_id: int
    item_type: str
    display_order: int
    geometry: str | None = None
    attributes: str | None = None
    query_result: QueryResult
    tab_id: int


class DashboardFilterResult(BaseModel):
    filter_id: int
    name: str | None = None
    filter_key: str
    operator_type: str | None = None
    data_type: str
    default_value: str | None = None
    allow_empty: bool

class DashboardFilterGroupResult(BaseModel):
    group_id: int
    name: str
    position: str
    tab_id: int | None = None
    filters: List[DashboardFilterResult]
    


@router.post("/", response_model=DashboardOut)
def save_dashboard(payload: DashboardSaveRequest, db: Session = Depends(get_db), user=Depends(require_any_role("dashboard_editor", "admin"))):
    d = Dashboard(name=payload.name, spec=payload.spec, owner_id=user.id)
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


@router.get("/mine", response_model=List[MyDashboardOut])
def list_my_dashboards(db: Session = Depends(get_db), user=Depends(require_any_role("dashboard_viewer", "dashboard_editor", "admin"))):
    with db.bind.connect() as conn:  # type: ignore[attr-defined]
        # Get dashboard items
        dashboards_stmt = text("""
            SELECT d.id, d.name, d.description, TO_CHAR(udp.last_opened, 'YYYY-MM-DD"T"HH24:MI:SS') as last_opened
            from dashboards d
            inner join user_dashboard_privs udp
                on d.id = udp.dashboard_id and udp.user_id = :user_id
        """).bindparams(user_id=user.id)
        dashboards_result = conn.execute(dashboards_stmt)
        
        results = []
        for item_row in dashboards_result:
            dashboard_id = item_row[0]
            dashboard_name = item_row[1]
            dashboard_description = item_row[2]
            dashboard_last_opened = item_row[3] if item_row[3] else None
            
            results.append({
                "id": dashboard_id,
                "name": dashboard_name,
                "description": dashboard_description,
                "last_opened": dashboard_last_opened
            })
    return results


@router.get("/{dashboard_id}", response_model=DashboardOut)
def get_dashboard(dashboard_id: int, db: Session = Depends(get_db), user=Depends(require_any_role("dashboard_viewer", "dashboard_editor", "admin"))):
    d = db.get(Dashboard, dashboard_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return d


FILTER_PLACEHOLDER_RE = re.compile(r"\{\{\s*filter:([^\}\s]+)\s*\}\}")
@router.get("/{dashboard_id}/items", response_model=List[DashboardItemResult])
def get_dashboard_items(
    dashboard_id: int,
    filters: Optional[str] = Query(None, description="JSON string of filters, e.g. {\"fAmount\": 500}"),
    db: Session = Depends(get_db),
    user=Depends(require_any_role("dashboard_viewer", "dashboard_editor", "admin")),
):
    """
    GET /{dashboard_id}/items?filters={"fAmount":500}
    - filters: JSON string mapping filter_key -> value (single value or array for IN)
    """
    try:
        # parse filters JSON from query string
        provided_filters = {}
        if filters:
            try:
                provided_filters = json.loads(filters)
            except Exception:
                raise HTTPException(status_code=400, detail="invalid filters JSON")

        with db.bind.connect() as conn:  # type: ignore[attr-defined]
            # Get dashboard items
            items_stmt = text("""
                SELECT 
                    ID, 
                    ITEM_TYPE, 
                    DISPLAY_ORDER, 
                    XMLSERIALIZE(CONTENT GEOMETRY AS VARCHAR2(4000)) AS GEOMETRY,
                    XMLSERIALIZE(CONTENT ATTRIBUTES AS VARCHAR2(4000)) AS ATTRIBUTES,
                    SQL_ID,
                    TAB_ID
                FROM DASHBOARD_ITEMS 
                WHERE DASHBOARD_ID = :dashboard_id 
                ORDER BY DISPLAY_ORDER
            """).bindparams(dashboard_id=dashboard_id)
            items_result = conn.execute(items_stmt)
            
            results = []
            for item_row in items_result:
                item_id = item_row[0]
                item_type = item_row[1]
                display_order = item_row[2]
                geometry = item_row[3] if item_row[3] else None
                attributes = item_row[4] if item_row[4] else None
                sql_id = item_row[5]
                tab_id = item_row[6]
                
                # Get SQL_TEXT from SAVED_QUERIES using SQL_ID
                sql_stmt = text("SELECT SQL_TEXT FROM SAVED_QUERIES WHERE ID = :sql_id").bindparams(sql_id=sql_id)
                sql_result = conn.execute(sql_stmt)
                sql_row = sql_result.fetchone()
                
                if not sql_row or not sql_row[0]:
                    # Skip if SQL not found
                    continue
                
                raw_sql_text = sql_row[0].strip().rstrip(";")
                
                # Only handle SELECTs for now
                if not raw_sql_text.lower().lstrip().startswith("select"):
                    continue

                # --- Fetch filter metadata bound to this SQL_ID ---
                # We'll get: filter id, filter_key, operator, default, allow_empty and the logical column (where to apply)
                filters_stmt = text("""
                    SELECT f.id, f.filter_key, f.operator_type, f.default_value, f.allow_empty, b.logical_column, f.data_type
                    FROM DASHBOARD_FILTERS f
                    JOIN DASHBOARD_FILTER_BINDINGS b ON f.id = b.filter_id
                    WHERE b.sql_id = :sql_id
                """).bindparams(sql_id=sql_id)
                filter_rows = conn.execute(filters_stmt).fetchall()

                # Build a dict of filter metadata by key for quick lookup
                filter_meta = {}
                for fr in filter_rows:
                    fid, fkey, fop, fdefault, fallow, logical_col, data_type = fr
                    # clean logical_col - CSV export may have doubled quotes
                    if isinstance(logical_col, str):
                        logical_col = logical_col.replace('""', '"')
                    filter_meta[fkey] = {
                        "id": fid,
                        "operator": (fop or "").upper(),
                        "default": fdefault,
                        "allow_empty": str(fallow) in ("1", "Y", "y", "true", "TRUE"),
                        "logical_column": logical_col,
                        "data_Type": data_type
                    }

                # --- Replace filter placeholders in the SQL safely ---
                params = {}
                param_index = 0

                def filter_replacer(match: re.Match) -> str:
                    nonlocal param_index, params
                    key = match.group(1)
                    meta = filter_meta.get(key)
                    # If filter metadata not found, remove placeholder (or you can raise)
                    if not meta:
                        return ""

                    # Determine value precedence: provided -> default -> none
                    value = provided_filters.get(key, None)
                    if value is None or value == "":
                        # use default if present
                        if meta["default"] not in (None, ""):
                            value = meta["default"]
                        else:
                            # no provided value and no default
                            if meta["allow_empty"]:
                                # skip filter completely
                                return ""
                            else:
                                # not allowed to be empty -> return a predicate that yields no rows
                                # (we return a short deterministic always-false clause)
                                return " AND 1 = 0 "

                    col = meta["logical_column"]
                    # generate predicate based on operator
                    op = meta["operator"]
                    # produce unique param name
                    param_index += 1
                    p_name = f"p_{key}_{param_index}"

                    # handle common operators
                    if op in ("=", ">", "<", ">=", "<=", "<>"):
                        params[p_name] = value
                        # Keep the surrounding spaces to be safe in insertion contexts
                        return f" AND {col} {op} :{p_name} "
                    elif op == "IN":
                        # value must be array-like
                        if not isinstance(value, (list, tuple)):
                            # try to split comma string
                            if isinstance(value, str):
                                value = [v.strip() for v in value.split(",") if v.strip() != ""]
                            else:
                                value = [value]
                        # add each as param or use named list expansion (here we expand)
                        placeholders = []
                        for i, v in enumerate(value):
                            pn = f"{p_name}_{i}"
                            params[pn] = v
                            placeholders.append(f":{pn}")
                        if not placeholders:
                            # no values -> depending on allow_empty we either skip or no data
                            return "" if meta["allow_empty"] else " AND 1 = 0 "
                        return f" {col} IN ({', '.join(placeholders)}) "
                    elif op == "BETWEEN":
                        # expect list/tuple of two values
                        if isinstance(value, (list, tuple)) and len(value) == 2:
                            pn1 = f"{p_name}_1"; pn2 = f"{p_name}_2"
                            params[pn1] = value[0]; params[pn2] = value[1]
                            return f" {col} BETWEEN :{pn1} AND :{pn2} "
                        else:
                            # invalid, treat as no-data or skip
                            return "" if meta["allow_empty"] else " AND 1 = 0 "
                    elif op == "LIKE":
                        params[p_name] = value
                        return f" {col} LIKE :{p_name} "
                    else:
                        # default to equality
                        params[p_name] = value
                        return f" {col} = :{p_name} "

                # Apply replacements (this will replace placeholders everywhere they appear in the SQL)
                processed_sql = FILTER_PLACEHOLDER_RE.sub(filter_replacer, raw_sql_text)

                # Optional safety: ensure we didn't leave dangling placeholders
                if FILTER_PLACEHOLDER_RE.search(processed_sql):
                    # unresolved placeholder -> remove them (or raise)
                    processed_sql = FILTER_PLACEHOLDER_RE.sub("", processed_sql)

                # Add limit
                limit_clause = " FETCH FIRST 1000 ROWS ONLY"
                final_sql = processed_sql + limit_clause

                # Execute the SQL with params
                exec_stmt = text(final_sql)
                query_result = conn.execute(exec_stmt, params)
                columns = list(query_result.keys())
                rows = [list(r) for r in query_result]
                
                results.append({
                    "item_id": item_id,
                    "item_type": item_type,
                    "display_order": display_order,
                    "geometry": geometry,
                    "attributes": attributes,
                    "query_result": {
                        "columns": columns,
                        "rows": rows
                    },
                    "tab_id": tab_id
                })
            
            return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{dashboard_id}/tabs", response_model=List[DashboardTabResult])
def get_dashboard_tabs(dashboard_id: int, db: Session = Depends(get_db), user=Depends(require_any_role("dashboard_viewer", "dashboard_editor", "admin"))):
    try:
        with db.bind.connect() as conn:  # type: ignore[attr-defined]
            # Get dashboard tabs
            tabs_stmt = text("""
                SELECT
                    dt.ID,
                    dt.NAME_ as TAB_NAME,
                    dt.DISPLAY_ORDER
                FROM DASHBOARD_TABS dt
                WHERE dt.DASHBOARD_ID = :dashboard_id 
                ORDER BY dt.DISPLAY_ORDER
            """).bindparams(dashboard_id=dashboard_id)
            tabs_result = conn.execute(tabs_stmt)
            
            results = []
            for tab_row in tabs_result:
                tab_id = tab_row[0]
                tab_name = tab_row[1]
                display_order = tab_row[2] if tab_row[2] else None
                
                results.append({
                    "tab_id": tab_id,
                    "tab_name": tab_name,
                    "display_order": display_order,
                })
            
            return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{dashboard_id}/filter-groups")
def get_dashboard_filter_groups(
    dashboard_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_any_role("dashboard_viewer", "dashboard_editor", "admin")),
    response_model=DashboardFilterGroupResult
):
    with db.bind.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT
                    fg.id              AS group_id,
                    fg.name            AS group_name,
                    XMLSERIALIZE(CONTENT fg.position AS VARCHAR2(4000)) AS group_position,
                    fg.tab_id,
                    f.id               AS filter_id,
                    f.name             AS filter_name,
                    f.filter_key,
                    f.operator_type,
                    f.data_type,
                    f.default_value,
                    f.allow_empty
                FROM dashboard_filter_groups fg
                JOIN dashboard_filter_group_members gm
                    ON gm.group_id = fg.id
                JOIN dashboard_filters f
                    ON f.id = gm.filter_id
                WHERE fg.dashboard_id = :dashboard_id
                ORDER BY fg.id, f.id
            """),
            {"dashboard_id": dashboard_id}
        ).fetchall()

    groups = {}
    for r in rows:
        gid = r.group_id
        if gid not in groups:
            groups[gid] = {
                "group_id": gid,
                "name": r.group_name,
                "position": r.group_position,
                "tab_id": r.tab_id,
                "filters": []
            }

        groups[gid]["filters"].append({
            "filter_id": r.filter_id,
            "name": r.filter_name,
            "filter_key": r.filter_key,
            "operator_type": r.operator_type,
            "data_type": r.data_type,
            "default_value": r.default_value,
            "allow_empty": bool(r.allow_empty),
        })

    return list(groups.values())

