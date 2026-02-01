import ast
import json
import re
import zipfile
from pathlib import Path
from uuid import UUID
from fastapi import UploadFile
from app.core.logger import logger

UPLOAD_DIR = Path("/app/uploads/roasts")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def save_alog_file_from_bytes(roast_id: UUID, content: bytes) -> str:
    """Save .alog content to disk for a roast; return relative path."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_path = UPLOAD_DIR / f"{roast_id}.alog"
    with open(file_path, "wb") as f:
        f.write(content)
    relative_path = f"/uploads/roasts/{roast_id}.alog"
    logger.info("Saved profile file", roast_id=str(roast_id), path=str(file_path))
    return relative_path


async def save_alog_file(roast_id: UUID, file: UploadFile) -> str:
    """Save .alog file for a roast and return the file path."""
    content = await file.read()
    return save_alog_file_from_bytes(roast_id, content)


async def get_alog_file(roast_id: UUID) -> Path | None:
    """Get .alog file path for a roast."""
    for ext in [".alog", ".ALOG"]:
        file_path = UPLOAD_DIR / f"{roast_id}{ext}"
        if file_path.exists():
            return file_path
    return None


def _parse_python_dict(content: str) -> dict:
    """
    Parse Python dict literal format (as used by Artisan .alog files).
    
    Handles:
    - Python True/False/None
    - Escaped unicode strings (\\xNN, \\uNNNN)
    - Single-quoted strings
    """
    try:
        # Try ast.literal_eval first (handles Python literals)
        return ast.literal_eval(content)
    except (ValueError, SyntaxError):
        pass
    
    # Fallback: convert Python dict to JSON and parse
    # Replace Python booleans/None with JSON equivalents
    json_content = content
    json_content = re.sub(r'\bTrue\b', 'true', json_content)
    json_content = re.sub(r'\bFalse\b', 'false', json_content)
    json_content = re.sub(r'\bNone\b', 'null', json_content)
    
    # Replace single quotes with double quotes (careful with nested quotes)
    # This is a simplified approach - may not work for all edge cases
    json_content = json_content.replace("'", '"')
    
    return json.loads(json_content)


def read_and_parse_alog(file_path: Path) -> dict:
    """
    Read .alog file and return parsed dict.
    
    Supports:
    - ZIP archive with JSON inside
    - Raw JSON
    - Python dict literal format (Artisan native format)
    """
    with open(file_path, "rb") as f:
        head = f.read(2)
        f.seek(0)
        raw = f.read()
    
    # Check if it's a ZIP file
    if head == b"PK":
        with zipfile.ZipFile(file_path, "r") as z:
            for name in z.namelist():
                if name.endswith(".json") or name.endswith(".JSON"):
                    with z.open(name) as member:
                        content = member.read().decode("utf-8", errors="replace")
                        try:
                            return json.loads(content)
                        except json.JSONDecodeError:
                            return _parse_python_dict(content)
            # no .json found, try first file
            if z.namelist():
                with z.open(z.namelist()[0]) as member:
                    content = member.read().decode("utf-8", errors="replace")
                    try:
                        return json.loads(content)
                    except json.JSONDecodeError:
                        return _parse_python_dict(content)
        raise ValueError("Empty or invalid zip")
    
    # Raw file (JSON or Python dict)
    content = raw.decode("utf-8", errors="replace")
    
    # Try JSON first
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass
    
    # Try Python dict literal
    return _parse_python_dict(content)


def compute_computed_from_telemetry_arrays(
    timex: list,
    temp1: list,
    temp2: list | None = None,
) -> dict:
    """
    Build 'computed' from raw timex/temp1/temp2 (no timeindex).
    Used when profile data comes from DB telemetry without .alog file.
    
    NOTE: In Artisan .alog format:
    - temp1 = ET (Environmental/Exhaust Temperature)
    - temp2 = BT (Bean Temperature)
    """
    # BT comes from temp2, ET comes from temp1
    bt_arr = temp2 if temp2 else []
    et_arr = temp1 if temp1 else []
    
    if not timex or not bt_arr or len(timex) < 2 or len(bt_arr) < 2:
        return {}
    
    n = min(len(timex), len(bt_arr))
    charge_time = float(timex[0])
    charge_bt = float(bt_arr[0]) if bt_arr[0] is not None else None
    last_time = float(timex[n - 1])
    last_bt = float(bt_arr[n - 1]) if bt_arr[n - 1] is not None else None
    totaltime = last_time - charge_time if last_time >= charge_time else None
    
    computed = {}
    if charge_bt is not None:
        computed["CHARGE_BT"] = charge_bt
    if last_bt is not None:
        computed["DROP_BT"] = last_bt
    if totaltime is not None and totaltime >= 0:
        computed["DROP_time"] = totaltime
        computed["totaltime"] = totaltime
    if et_arr and len(et_arr) > 0 and et_arr[0] is not None:
        computed["CHARGE_ET"] = float(et_arr[0])
    if et_arr and n > 0 and n <= len(et_arr) and et_arr[n - 1] is not None:
        computed["DROP_ET"] = float(et_arr[n - 1])
    
    # TP: min BT in first ~2 min of samples
    search_end = min(120, n - 1)  # first 120 samples (~2 min at 1 Hz)
    if search_end > 1:
        min_idx = 0
        for i in range(1, search_end):
            if i < len(bt_arr) and bt_arr[i] is not None:
                if bt_arr[min_idx] is None or bt_arr[i] < bt_arr[min_idx]:
                    min_idx = i
        if min_idx > 0 and bt_arr[min_idx] is not None:
            computed["TP_time"] = float(timex[min_idx]) - charge_time
            computed["TP_BT"] = float(bt_arr[min_idx])
            if et_arr and min_idx < len(et_arr) and et_arr[min_idx] is not None:
                computed["TP_ET"] = float(et_arr[min_idx])
    return computed


# Artisan timeindex: [0]=CHARGE, [1]=DRY END, [2]=FC START, [3]=FC END, [4]=SC START, [5]=SC END, [6]=DROP, [7]=COOL END
# Indices are into timex/temp1/temp2. -1 or 0 can mean "not set".
def compute_computed_from_timeindex(data: dict) -> dict:
    """
    Build or supplement 'computed' from .alog timeindex + timex + temp1/temp2
    when the file has no or partial computed (so detail page can show phases).
    
    NOTE: In Artisan .alog format:
    - temp1 = ET (Environmental/Exhaust Temperature)
    - temp2 = BT (Bean Temperature)
    """
    timex = data.get("timex") or []
    temp1 = data.get("temp1") or []  # ET
    temp2 = data.get("temp2") or []  # BT
    
    # Use clearer variable names
    et_arr = temp1  # temp1 = ET
    bt_arr = temp2  # temp2 = BT
    
    timeindex = data.get("timeindex")
    if not isinstance(timeindex, (list, tuple)) or len(timeindex) < 7:
        return data
    n = len(timex)
    if n == 0 or (not bt_arr or len(bt_arr) < n):
        return data

    charge_idx = timeindex[0] if isinstance(timeindex[0], (int, float)) else -1
    if charge_idx < 0 or charge_idx >= n:
        charge_idx = 0
    charge_time = float(timex[charge_idx]) if charge_idx < len(timex) else 0.0

    def safe_idx(slot: int):
        """Return timeindex[slot] if valid, else None."""
        if slot < 0 or slot >= len(timeindex):
            return None
        idx = timeindex[slot]
        if idx is None or (isinstance(idx, (int, float)) and (idx < 0 or idx >= n)):
            return None
        return int(idx)

    def safe_time(slot: int):
        """Return timex[timeindex[slot]] (absolute time in seconds)."""
        idx = safe_idx(slot)
        if idx is None or idx >= len(timex):
            return None
        return float(timex[idx])

    def safe_temp(tarr: list, slot: int):
        """Return tarr[timeindex[slot]]."""
        idx = safe_idx(slot)
        if idx is None or idx >= len(tarr):
            return None
        return float(tarr[idx])

    computed = dict(data.get("computed") or {})

    def set_if_missing(key: str, value):
        if value is not None and key not in computed:
            computed[key] = value

    # CHARGE - BT from temp2, ET from temp1
    if bt_arr:
        set_if_missing("CHARGE_BT", safe_temp(bt_arr, 0))
    if et_arr:
        set_if_missing("CHARGE_ET", safe_temp(et_arr, 0))

    # TP (turnaround): min BT in first ~2 min after charge
    if "TP_time" not in computed or "TP_BT" not in computed:
        search_end = min(charge_idx + 120, n)  # ~2 min of samples
        if search_end > charge_idx and bt_arr:
            min_idx = charge_idx
            for i in range(charge_idx + 1, search_end):
                if i < len(bt_arr) and bt_arr[i] is not None and (bt_arr[min_idx] is None or bt_arr[i] < bt_arr[min_idx]):
                    min_idx = i
            if min_idx > charge_idx and bt_arr[min_idx] is not None:
                computed.setdefault("TP_time", float(timex[min_idx]) - charge_time)
                computed.setdefault("TP_BT", float(bt_arr[min_idx]))
                if et_arr and min_idx < len(et_arr) and et_arr[min_idx] is not None:
                    computed.setdefault("TP_ET", float(et_arr[min_idx]))

    # DRY END [1]
    t1 = safe_time(1)
    if t1 is not None and "DRY_time" not in computed:
        computed["DRY_time"] = t1 - charge_time
    set_if_missing("DRY_BT", safe_temp(bt_arr, 1))
    if et_arr:
        set_if_missing("DRY_ET", safe_temp(et_arr, 1))

    # FC START [2]
    t2 = safe_time(2)
    if t2 is not None and "FCs_time" not in computed:
        computed["FCs_time"] = t2 - charge_time
    set_if_missing("FCs_BT", safe_temp(bt_arr, 2))
    if et_arr:
        set_if_missing("FCs_ET", safe_temp(et_arr, 2))

    # FC END [3]
    t3 = safe_time(3)
    if t3 is not None and "FCe_time" not in computed:
        computed["FCe_time"] = t3 - charge_time
    set_if_missing("FCe_BT", safe_temp(bt_arr, 3))
    if et_arr:
        set_if_missing("FCe_ET", safe_temp(et_arr, 3))

    # SC START [4], SC END [5] - optional
    t4 = safe_time(4)
    if t4 is not None and "SCs_time" not in computed:
        computed["SCs_time"] = t4 - charge_time
    set_if_missing("SCs_BT", safe_temp(bt_arr, 4))
    t5 = safe_time(5)
    if t5 is not None and "SCe_time" not in computed:
        computed["SCe_time"] = t5 - charge_time
    set_if_missing("SCe_BT", safe_temp(bt_arr, 5))

    # DROP [6]
    t6 = safe_time(6)
    if t6 is not None:
        if "DROP_time" not in computed:
            computed["DROP_time"] = t6 - charge_time
        if "totaltime" not in computed:
            computed["totaltime"] = t6 - charge_time
    set_if_missing("DROP_BT", safe_temp(bt_arr, 6))
    if et_arr:
        set_if_missing("DROP_ET", safe_temp(et_arr, 6))

    # Phases (Artisan: dry = DRY, mid = FCs-DRY, finish = DROP-FCs)
    dry_t = computed.get("DRY_time")
    fcs_t = computed.get("FCs_time")
    drop_t = computed.get("DROP_time") or computed.get("totaltime")
    if dry_t is not None and "dryphasetime" not in computed:
        computed["dryphasetime"] = dry_t
    if fcs_t is not None and dry_t is not None and "midphasetime" not in computed:
        computed["midphasetime"] = fcs_t - dry_t
    if drop_t is not None and fcs_t is not None and "finishphasetime" not in computed:
        computed["finishphasetime"] = drop_t - fcs_t

    data = dict(data)
    data["computed"] = computed
    return data


def ensure_artisan_background_profile(data: dict) -> dict:
    """
    Add missing keys so Artisan loadbackground() does not KeyError.
    Use after building profile from DB or .alog for GET .../profile/data (reference background).
    """
    out = dict(data)
    n = len(out.get("timex") or [])
    # Extra device arrays: list of arrays, same length as timex
    if "extratimex" not in out:
        out["extratimex"] = []
    if "extratemp1" not in out:
        out["extratemp1"] = []
    if "extratemp2" not in out:
        out["extratemp2"] = []
    if "extraname1" not in out:
        out["extraname1"] = []
    if "extraname2" not in out:
        out["extraname2"] = []
    # Special events
    if "specialevents" not in out:
        out["specialevents"] = []
    if "specialeventstype" not in out:
        out["specialeventstype"] = []
    if "specialeventsvalue" not in out:
        out["specialeventsvalue"] = []
    if "specialeventsStrings" not in out:
        out["specialeventsStrings"] = []
    # Flavors (4 values 0-10)
    if "flavors" not in out:
        out["flavors"] = [5.0, 5.0, 5.0, 5.0]
    # Batch
    if "roastbatchnr" not in out:
        out["roastbatchnr"] = 0
    if "roastbatchprefix" not in out:
        out["roastbatchprefix"] = ""
    if "roastbatchpos" not in out:
        out["roastbatchpos"] = 1
    # Weight: [green_kg, roasted_kg, unit]
    if "weight" not in out:
        out["weight"] = [0.0, 0.0, "g"]
    # timeindex: 8 slots
    if "timeindex" not in out or not out["timeindex"]:
        out["timeindex"] = [-1] * 8
    elif len(out["timeindex"]) < 8:
        out["timeindex"] = list(out["timeindex"]) + [-1] * (8 - len(out["timeindex"]))
    if "title" not in out:
        out["title"] = ""
    if "mode" not in out:
        out["mode"] = "C"
    if "computed" not in out:
        out["computed"] = {}
    return out
