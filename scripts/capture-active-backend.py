#!/usr/bin/env python3
"""Create a restricted, read-only capture of Arkout's active backend for review.

Does not edit the source, DB, uploads, unit file, or restart services. Copies only the
specified Python source, records SHA-256 + route inventory, and queries non-secret systemd
properties. It never reads .env contents or dumps database/customer data. The copied source
may contain hard-coded secrets and must be reviewed before sharing.
"""
from __future__ import annotations
import argparse, ast, hashlib, json, shutil, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

def sha256(path: Path) -> str:
    h=hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda:f.read(1024*1024), b""):
            h.update(block)
    return h.hexdigest()

def inventory(source: Path) -> dict:
    try:
        tree=ast.parse(source.read_text(encoding="utf-8"), filename=str(source))
    except Exception as exc:
        return {"ast_parse_ok":False,"ast_parse_error_type":type(exc).__name__,"routes":[]}
    routes=[]
    for node in ast.walk(tree):
        if not isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)): continue
        for dec in node.decorator_list:
            if not (isinstance(dec,ast.Call) and isinstance(dec.func,ast.Attribute)): continue
            if dec.func.attr not in {"route","get","post","put","delete","patch"}: continue
            paths=[a.value for a in dec.args[:1] if isinstance(a,ast.Constant) and isinstance(a.value,str)]
            methods=[]
            for kw in dec.keywords:
                if kw.arg=="methods" and isinstance(kw.value,(ast.List,ast.Tuple)):
                    methods=[x.value for x in kw.value.elts if isinstance(x,ast.Constant) and isinstance(x.value,str)]
            routes.append({"function":node.name,"decorator":dec.func.attr,"paths":paths,"methods":methods,"line":node.lineno})
    routes.sort(key=lambda x:(x["line"],x["function"]))
    return {"ast_parse_ok":True,"routes":routes}

def systemd(service: str) -> dict:
    props=["WorkingDirectory","User","FragmentPath","ActiveState","SubState","MainPID"]
    try:
        proc=subprocess.run(["systemctl","show",service,*(f"--property={x}" for x in props)],capture_output=True,text=True,timeout=5,check=False)
        result={"command_exit_code":proc.returncode}
        for line in proc.stdout.splitlines():
            if "=" in line:
                k,v=line.split("=",1); result[k]=v
        if proc.returncode: result["query_note"]="systemctl query failed; inspect service manually without sharing env contents"
        return result
    except Exception as exc: return {"query_note":f"systemctl query failed ({type(exc).__name__})"}

def main() -> int:
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source",default="/home/arkout/printpod-kiosk/printpod_local/app.py")
    p.add_argument("--service",default="arkout-backend.service")
    p.add_argument("--destination",default="/home/arkout/printpod-kiosk/reliability-captures")
    a=p.parse_args(); src=Path(a.source).resolve(strict=True)
    if not src.is_file() or src.suffix!=".py":
        print("ERROR: source must be an existing Python file",file=sys.stderr); return 2
    stamp=datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    root=Path(a.destination).expanduser(); root.mkdir(mode=0o700,parents=True,exist_ok=True)
    try: root.chmod(0o700)
    except OSError: pass
    out=root/f"active-backend-{stamp}"; out.mkdir(mode=0o700)
    copy=out/"active_app.py"; shutil.copy2(src,copy); copy.chmod(0o600)
    meta={"captured_at_utc":datetime.now(timezone.utc).isoformat(),"service_name":a.service,
          "source_path":str(src),"source_size_bytes":src.stat().st_size,"source_mtime_ns":src.stat().st_mtime_ns,
          "source_sha256":sha256(src),"captured_copy":copy.name,"captured_copy_sha256":sha256(copy),
          "service":systemd(a.service),"static_inventory":inventory(copy),
          "safety_note":"Source copy is sensitive. This tool does not read .env contents, DB data, uploads or restart/modify services."}
    metadata=out/"metadata.json"; metadata.write_text(json.dumps(meta,indent=2)+"\n",encoding="utf-8"); metadata.chmod(0o600)
    print(f"CAPTURE_DIR={out}")
    print(f"SOURCE_SHA256={meta['source_sha256']}")
    print(f"SOURCE_BYTES={meta['source_size_bytes']}")
    print(f"SERVICE_ACTIVE={meta['service'].get('ActiveState','unknown')}")
    print(f"AST_PARSE_OK={meta['static_inventory'].get('ast_parse_ok',False)}")
    print("NO_SERVICE_RESTARTED=YES")
    print("SOURCE_OR_DATABASE_MODIFIED=NO")
    print("WARNING=Capture may contain hard-coded secrets; review/redact before sharing.")
    return 0

if __name__=="__main__": raise SystemExit(main())
