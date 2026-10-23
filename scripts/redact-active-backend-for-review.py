#!/usr/bin/env python3
"""Create a best-effort secret-redacted REVIEW COPY of a captured Arkout backend.

The original capture is not modified. The result is NOT executable/deployable.
Inspect the result for custom secrets before sharing: automated redaction is not perfect.
"""
from __future__ import annotations
import argparse, ast, re
from pathlib import Path

SENSITIVE = re.compile(
    r"(?i)(token|secret|password|passwd|api.?key|credential|auth|bot.?token|"
    r"client.?secret|private.?key|access.?key|signature|razorpay.*key|twilio.*auth|"
    r"webhook|dsn|connection.?string|smtp.?pass|sid|.*key.*)$"
)
PATTERNS = [
    re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]{12,}"),
    re.compile(r"(?i)\b(?:rzp|sk|pk)_(?:live|test)_[A-Za-z0-9]{8,}\b"),
    re.compile(r"(?i)\b(?:whsec_|xox[baprs]-|gh[pousr]_|github_pat_|SG\.)[A-Za-z0-9_./-]{12,}\b"),
    re.compile(r"(?<![A-Za-z0-9])[A-Fa-f0-9]{40,}(?![A-Za-z0-9])"),
    re.compile(r"(?i)whatsapp:\+\d{8,}"),
]
def names(target):
    if isinstance(target, ast.Name): return [target.id]
    if isinstance(target, ast.Attribute): return [target.attr] + names(target.value)
    if isinstance(target, (ast.Tuple, ast.List)): return sum((names(x) for x in target.elts), [])
    if isinstance(target, ast.Subscript):
        key = [target.slice.value] if isinstance(target.slice, ast.Constant) and isinstance(target.slice.value, str) else []
        return key + names(target.value)
    return []
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source", required=True, help="Path to captured active_app.py")
    p.add_argument("--output", help="Output path (default: active_app.review.py beside source)")
    a=p.parse_args()
    src=Path(a.source).expanduser().resolve(strict=True)
    if not src.is_file() or src.suffix!=".py": p.error("source must be an existing .py file")
    raw=src.read_text(encoding="utf-8"); tree=ast.parse(raw, filename=str(src))
    lines=raw.splitlines(keepends=True); blank=set(); replacement={}
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign): targets=node.targets
        elif isinstance(node, ast.AnnAssign): targets=[node.target]
        elif isinstance(node, ast.NamedExpr): targets=[node.target]
        else: continue
        sensitive=sorted({n for t in targets for n in names(t) if SENSITIVE.search(n)})
        value=getattr(node,"value",None)
        # Do not redact runtime customer/session variables just because their names contain
        # "token". Redact only literal assignments or environment-backed config defaults.
        literal_value=isinstance(value, ast.Constant) and isinstance(value.value, (str, bytes))
        env_value=False
        if isinstance(value, ast.Call):
            fn=value.func
            env_value=(
                isinstance(fn, ast.Name) and fn.id == "getenv"
            ) or (
                isinstance(fn, ast.Attribute) and fn.attr == "get" and
                isinstance(fn.value, ast.Attribute) and fn.value.attr == "environ" and
                isinstance(fn.value.value, ast.Name) and fn.value.value.id == "os"
            )
        start=getattr(node,"lineno",None); end=getattr(node,"end_lineno",None)
        if not sensitive or not (literal_value or env_value) or not start or not end: continue
        indent=re.match(r"\s*",lines[start-1]).group(0)
        replacement[start]=indent+"# [REDACTED sensitive assignment: "+", ".join(sensitive)+"]\n"
        blank.update(range(start+1,end+1))
    for ln,val in replacement.items(): lines[ln-1]=val
    for ln in blank: lines[ln-1]="\n" if lines[ln-1].endswith("\n") else ""
    text="".join(lines)
    for pattern in PATTERNS: text=pattern.sub("<REDACTED_SECRET>",text)
    out=Path(a.output).expanduser() if a.output else src.with_name("active_app.review.py")
    out.write_text("# REDACTED REVIEW COPY ONLY — NOT EXECUTABLE OR DEPLOYABLE. Original capture left unchanged.\n"+text,encoding="utf-8")
    try: out.chmod(0o600)
    except OSError: pass
    print(f"REVIEW_COPY={out}")
    print(f"INPUT_BYTES={src.stat().st_size}")
    print(f"OUTPUT_BYTES={out.stat().st_size}")
    print("ORIGINAL_CAPTURE_MODIFIED=NO")
    print("EXECUTABLE_COPY=NO")
    print("WARNING=Best-effort only; inspect for custom hard-coded secrets before sharing.")
if __name__=="__main__": main()
