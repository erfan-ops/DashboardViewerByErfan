"""
Filter placeholder resolution engine.

Replaces {{filter:key}} placeholders in SQL text with parameterized
predicates.  Pure business logic — no HTTP or database dependencies.

Extracted from api/dashboards.py to keep the router focused on HTTP concerns
and to make filter resolution independently testable.
"""

import json
import re
from typing import Any, Dict, List, Optional, Tuple

# Matches {{filter:key}} with optional whitespace inside braces
FILTER_PLACEHOLDER_RE = re.compile(r"\{\{\s*filter:([^\}\s]+)\s*\}\}")


def resolve_filters(
    raw_sql_text: str,
    filter_rows: List[tuple],
    provided_filters: Optional[Dict[str, Any]] = None,
) -> Tuple[str, Dict[str, Any]]:
    """
    Replace {{filter:key}} placeholders in a SQL string with parameterized
    predicates, returning (processed_sql, params_dict).

    Parameters
    ----------
    raw_sql_text : str
        The SQL template containing {{filter:key}} placeholders.
    filter_rows : list of tuples
        Each row: (filter_id, filter_key, operator_type, default_value,
                   allow_empty, logical_column, data_type)
    provided_filters : dict or None
        User-supplied filter values keyed by filter_key.

    Returns
    -------
    (processed_sql, params) where params is a dict of bind-variable values.
    """
    provided_filters = provided_filters or {}

    # Build filter metadata index by filter_key
    filter_meta: Dict[str, dict] = {}
    for fr in filter_rows:
        fid, fkey, fop, fdefault, fallow, logical_col, data_type = fr
        # Clean doubled quotes sometimes introduced by CSV exports
        if isinstance(logical_col, str):
            logical_col = logical_col.replace('""', '"')
        filter_meta[fkey] = {
            "id": fid,
            "operator": (fop or "").upper(),
            "default": fdefault,
            "allow_empty": str(fallow) in ("1", "Y", "y", "true", "TRUE"),
            "logical_column": logical_col,
            "data_type": data_type,
        }

    params: Dict[str, Any] = {}
    param_index = 0

    def _replacer(match: re.Match) -> str:
        nonlocal param_index, params
        key = match.group(1)
        meta = filter_meta.get(key)

        if not meta:
            return ""  # Unknown filter — remove placeholder

        # Resolve value: user-provided → default → handle empty
        value = provided_filters.get(key, None)
        if value is None or value == "":
            if meta["default"] not in (None, ""):
                value = meta["default"]
            elif meta["allow_empty"]:
                return ""
            else:
                return " AND 1 = 0 "

        col = meta["logical_column"]
        op = meta["operator"]
        param_index += 1
        p_name = f"p_{key}_{param_index}"

        if op in ("=", ">", "<", ">=", "<=", "<>"):
            params[p_name] = value
            return f" AND {col} {op} :{p_name} "

        elif op == "IN":
            if not isinstance(value, (list, tuple)):
                if isinstance(value, str):
                    value = [v.strip() for v in value.split(",") if v.strip() != ""]
                else:
                    value = [value]
            placeholders = []
            for i, v in enumerate(value):
                pn = f"{p_name}_{i}"
                params[pn] = v
                placeholders.append(f":{pn}")
            if not placeholders:
                return "" if meta["allow_empty"] else " AND 1 = 0 "
            return f" {col} IN ({', '.join(placeholders)}) "

        elif op == "BETWEEN":
            if isinstance(value, (list, tuple)) and len(value) == 2:
                pn1, pn2 = f"{p_name}_1", f"{p_name}_2"
                params[pn1], params[pn2] = value[0], value[1]
                return f" {col} BETWEEN :{pn1} AND :{pn2} "
            else:
                return "" if meta["allow_empty"] else " AND 1 = 0 "

        elif op == "LIKE":
            params[p_name] = value
            return f" {col} LIKE :{p_name} "

        else:
            # Unknown operator → fall back to equality
            params[p_name] = value
            return f" {col} = :{p_name} "

    processed = FILTER_PLACEHOLDER_RE.sub(_replacer, raw_sql_text)

    # Remove any unresolved placeholders as a safety measure
    if FILTER_PLACEHOLDER_RE.search(processed):
        processed = FILTER_PLACEHOLDER_RE.sub("", processed)

    return processed, params
