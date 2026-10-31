import os
import re
import uuid
import time
import hmac
import hashlib
import sqlite3
import threading
import subprocess
from pathlib import Path
from datetime import datetime, timedelta, timezone

import razorpay
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
from PyPDF2 import PdfReader

BASE = Path(__file__).resolve().parent
load_dotenv(BASE / ".env", override=True)
DB_PATH = BASE / "revenue_log.db"
UPLOAD_DIR = BASE / "local_uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_PHYSICAL_PAGES = 60
MAX_FILES = 10
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".heic"}
PIN_TTL_SECONDS = 300
SESSION_TTL_SECONDS = 900
ORDER_TTL_SECONDS = 900

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 30 * 1024 * 1024
CORS(app, resources={r"/*": {"origins": [
    "https://arkout.in", "https://www.arkout.in",
    re.compile(r"^https://[a-z0-9-]+\.vercel\.app$")
]}})

pin_lock = threading.RLock()
print_lock = threading.Lock()
current_pin = None
pin_expires_at = 0
kiosk_state = {"status": "idle", "filename": ""}

def db():
    conn = sqlite3.connect(DB_PATH, timeout=20)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    with db() as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS t01_sessions (
            token_hash TEXT PRIMARY KEY, created_at REAL NOT NULL,
            expires_at REAL NOT NULL, active INTEGER NOT NULL DEFAULT 1
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS t01_uploads (
            file_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL,
            filename TEXT NOT NULL, original_name TEXT NOT NULL,
            pages INTEGER NOT NULL, created_at REAL NOT NULL,
            FOREIGN KEY(token_hash) REFERENCES t01_sessions(token_hash)
        )""")
        conn.execute("""CREATE TABLE IF NOT EXISTS t01_orders (
            order_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL,
            file_ids TEXT NOT NULL, config_json TEXT NOT NULL,
            pages INTEGER NOT NULL, copies INTEGER NOT NULL,
            amount_paise INTEGER NOT NULL, status TEXT NOT NULL,
            payment_id TEXT, created_at REAL NOT NULL,
            updated_at REAL NOT NULL, error TEXT
        )""")
        conn.execute("""CREATE UNIQUE INDEX IF NOT EXISTS t01_payment_unique
            ON t01_orders(payment_id) WHERE payment_id IS NOT NULL""")

def new_pin():
    global current_pin, pin_expires_at
    import secrets
    with pin_lock:
        current_pin = f"{secrets.randbelow(9000) + 1000}"
        pin_expires_at = time.time() + PIN_TTL_SECONDS
    print("Terminal 01 PIN rotated; value intentionally not logged.")

def pin_rotator():
    while True:
        time.sleep(PIN_TTL_SECONDS)
        new_pin()

def razorpay_client():
    key_id = os.getenv("RAZORPAY_KEY_ID")
    secret = os.getenv("RAZORPAY_KEY_SECRET")
    if not key_id or not secret:
        raise RuntimeError("Terminal 01 Razorpay credentials are not configured")
    return razorpay.Client(auth=(key_id, secret)), key_id

def token_from_request():
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return request.headers.get("X-Arkout-Session", "").strip()

def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()

def require_session():
    token = token_from_request()
    if not token or len(token) < 32:
        return None, (jsonify({"error": "Session required"}), 401)
    digest = token_hash(token)
    with db() as conn:
        row = conn.execute(
            "SELECT expires_at, active FROM t01_sessions WHERE token_hash=?",
            (digest,)
        ).fetchone()
    if not row or not row["active"] or row["expires_at"] < time.time():
        return None, (jsonify({"error": "Session expired. Scan the kiosk QR again."}), 401)
    return digest, None

def price_for(config):
    mode = config.get("colorMode", "bw")
    margin = config.get("margin", "standard")
    if mode not in ("bw", "color") or margin not in ("standard", "none"):
        raise ValueError("Invalid print configuration")
    if mode == "bw":
        return 150
    return 1000 if margin == "none" else 700

def get_uploads(conn, digest, file_ids):
    if not isinstance(file_ids, list) or not file_ids or len(file_ids) > MAX_FILES:
        raise ValueError("Invalid document package")
    if len(set(file_ids)) != len(file_ids):
        raise ValueError("Duplicate file reference")
    rows = conn.execute(
        "SELECT * FROM t01_uploads WHERE token_hash=? AND file_id IN (" +
        ",".join("?" for _ in file_ids) + ")",
        [digest, *file_ids]
    ).fetchall()
    if len(rows) != len(file_ids):
        raise ValueError("One or more files do not belong to this session")
    by_id = {r["file_id"]: r for r in rows}
    return [by_id[x] for x in file_ids]

@app.get("/api/stats")
def stats():
    return jsonify({"active_jobs": 0, "ink_level": None,
                    "pages_remaining": None, "system_health": "API online",
                    "total_revenue": None})

@app.get("/api/kiosk-state")
def get_kiosk_state():
    return jsonify(kiosk_state)

@app.post("/api/verify-pin")
def verify_pin():
    global current_pin
    data = request.get_json(silent=True) or {}
    supplied = str(data.get("pin", ""))
    with pin_lock:
        valid = bool(current_pin and time.time() < pin_expires_at and
                     hmac.compare_digest(supplied, current_pin))
    if not valid:
        return jsonify({"error": "Invalid or expired Terminal 01 PIN"}), 403
    import secrets
    token = secrets.token_urlsafe(32)
    digest = token_hash(token)
    now = time.time()
    with db() as conn:
        conn.execute("UPDATE t01_sessions SET active=0 WHERE active=1")
        conn.execute("INSERT INTO t01_sessions(token_hash,created_at,expires_at,active) VALUES(?,?,?,1)",
                     (digest, now, now + SESSION_TTL_SECONDS))
    return jsonify({"status": "success", "session_token": token,
                    "expires_in": SESSION_TTL_SECONDS}), 200

@app.post("/api/session/abort")
def abort_session():
    digest, error = require_session()
    if error:
        return error
    with db() as conn:
        conn.execute("UPDATE t01_sessions SET active=0 WHERE token_hash=?", (digest,))
    return jsonify({"status": "aborted"})

@app.post("/upload")
def upload_file():
    digest, error = require_session()
    if error:
        return error
    incoming = request.files.getlist("files")
    if not incoming or len(incoming) > MAX_FILES:
        return jsonify({"error": f"Upload between 1 and {MAX_FILES} files"}), 400
    results = []
    saved_paths = []
    try:
        with db() as conn:
            existing = conn.execute(
                "SELECT COALESCE(SUM(pages),0) AS n FROM t01_uploads WHERE token_hash=?",
                (digest,)
            ).fetchone()["n"]
            total = int(existing)
            for item in incoming:
                if not item.filename:
                    continue
                original = item.filename
                safe = secure_filename(original)
                ext = Path(safe).suffix.lower()
                if ext not in ALLOWED_EXTENSIONS:
                    raise ValueError(f"Unsupported file type: {ext or 'unknown'}")
                file_id = uuid.uuid4().hex
                stored = file_id + ext
                path = UPLOAD_DIR / stored
                item.save(path)
                saved_paths.append(path)
                pages = 1
                if ext == ".pdf":
                    try:
                        pages = len(PdfReader(str(path)).pages)
                    except Exception:
                        raise ValueError(f"Could not read PDF: {safe}")
                    if pages < 1:
                        raise ValueError(f"PDF has no pages: {safe}")
                total += pages
                if total > MAX_PHYSICAL_PAGES:
                    raise ValueError("Upload package exceeds 60 pages. Reduce the documents and retry.")
                conn.execute("""INSERT INTO t01_uploads
                    (file_id,token_hash,filename,original_name,pages,created_at)
                    VALUES(?,?,?,?,?,?)""",
                    (file_id, digest, stored, safe, pages, time.time()))
                results.append({"file_id": file_id, "filename": safe, "pages": pages})
        kiosk_state.update(status="processing",
                           filename=results[0]["filename"] if len(results) == 1 else "Multiple Files")
        return jsonify({"message": "Success", "files": results,
                        "total_pages": total, "max_pages": MAX_PHYSICAL_PAGES}), 200
    except ValueError as exc:
        for path in saved_paths:
            path.unlink(missing_ok=True)
        return jsonify({"error": str(exc)}), 400
    except Exception:
        for path in saved_paths:
            path.unlink(missing_ok=True)
        app.logger.exception("Upload failed")
        return jsonify({"error": "Upload failed"}), 500

@app.post("/api/create-order")
def create_order():
    digest, error = require_session()
    if error:
        return error
    data = request.get_json(silent=True) or {}
    config = data.get("config") or {}
    copies = data.get("copies", config.get("copies", 1))
    try:
        copies = int(copies)
        if copies < 1 or copies > 60:
            raise ValueError("Copies must be between 1 and 60")
        with db() as conn:
            files = get_uploads(conn, digest, data.get("file_ids"))
            pages_per_copy = sum(int(row["pages"]) for row in files)
            physical_pages = pages_per_copy * copies
            if physical_pages < 1 or physical_pages > MAX_PHYSICAL_PAGES:
                raise ValueError("Maximum package size is 60 physical pages, including copies")
            unit_rate = price_for(config)
            amount_paise = physical_pages * unit_rate
            client, key_id = razorpay_client()
            order = client.order.create({
                "amount": amount_paise, "currency": "INR",
                "receipt": "t01_" + uuid.uuid4().hex[:20],
                "notes": {"terminal": "01", "pages": str(physical_pages)}
            })
            now = time.time()
            import json
            conn.execute("""INSERT INTO t01_orders
                (order_id,token_hash,file_ids,config_json,pages,copies,amount_paise,status,created_at,updated_at)
                VALUES(?,?,?,?,?,?,?,'created',?,?)""",
                (order["id"], digest, ",".join(data["file_ids"]),
                 json.dumps(config), pages_per_copy, copies, amount_paise, now, now))
        return jsonify({"id": order["id"], "amount": amount_paise,
                        "currency": "INR", "key_id": key_id,
                        "pages": physical_pages, "amount_rupees": amount_paise / 100}), 200
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        app.logger.exception("Order creation failed")
        return jsonify({"error": "Unable to create payment order"}), 500

@app.post("/api/confirm-payment")
def confirm_payment():
    digest, error = require_session()
    if error:
        return error
    data = request.get_json(silent=True) or {}
    order_id = str(data.get("razorpay_order_id", ""))
    payment_id = str(data.get("razorpay_payment_id", ""))
    signature = str(data.get("razorpay_signature", ""))
    if not all((order_id, payment_id, signature)):
        return jsonify({"error": "Payment confirmation fields missing"}), 400

    try:
        client, _ = razorpay_client()
        client.utility.verify_payment_signature({
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature
        })
        payment = client.payment.fetch(payment_id)
        if payment.get("order_id") != order_id:
            return jsonify({"error": "Payment does not belong to this order"}), 400
        with db() as conn:
            expected = conn.execute(
                "SELECT amount_paise FROM t01_orders WHERE order_id=? AND token_hash=?",
                (order_id, digest)
            ).fetchone()
        if not expected or int(payment.get("amount", -1)) != int(expected["amount_paise"]):
            return jsonify({"error": "Payment amount does not match the order"}), 400
        if payment.get("status") != "captured":
            return jsonify({"error": "Payment is not captured yet; check order status before retrying"}), 409
    except Exception:
        app.logger.exception("Razorpay verification failed for order %s", order_id)
        return jsonify({"error": "Payment signature or capture verification failed"}), 400

    with print_lock:
        with db() as conn:
            order = conn.execute("SELECT * FROM t01_orders WHERE order_id=? AND token_hash=?",
                                 (order_id, digest)).fetchone()
            if not order:
                return jsonify({"error": "Order not found for this session"}), 404
            if order["status"] == "printed":
                return jsonify({"status": "printed", "message": "This order was already processed"}), 200
            if order["status"] in ("printing", "print_error"):
                return jsonify({"status": order["status"],
                                "message": "Order already claimed; do not retry automatically"}), 409
            if order["status"] != "created" or time.time() - order["created_at"] > ORDER_TTL_SECONDS:
                return jsonify({"error": "Order is expired or cannot be processed"}), 409
            conn.execute("UPDATE t01_orders SET status='printing',payment_id=?,updated_at=? WHERE order_id=? AND status='created'",
                         (payment_id, time.time(), order_id))
        try:
            import json
            config = json.loads(order["config_json"])
            with db() as conn:
                files = get_uploads(conn, digest, order["file_ids"].split(","))
            for row in files:
                path = UPLOAD_DIR / row["filename"]
                if not path.is_file():
                    raise RuntimeError("An uploaded document is missing; contact support before retrying")
                cmd = ["lp", "-n", str(order["copies"]), "-o", "InputSlot=Auto", "-o", "media=A4"]
                cmd += ["-o", "sides=two-sided-long-edge"] if config.get("sides") == "double" else ["-o", "sides=one-sided"]
                cmd += ["-o", "print-color-mode=color"] if config.get("colorMode") == "color" else ["-o", "print-color-mode=monochrome"]
                if config.get("margin") == "none" and config.get("colorMode") == "color":
                    cmd += ["-o", "page-bottom=0", "-o", "page-left=0", "-o", "page-right=0", "-o", "page-top=0"]
                else:
                    cmd += ["-o", "fit-to-page"]
                cmd.append(str(path))
                subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=120)
            total_pages = int(order["pages"]) * int(order["copies"])
            amount = int(order["amount_paise"]) / 100
            with db() as conn:
                conn.execute("""INSERT INTO transactions
                    (timestamp,filename,pages,color_mode,amount)
                    VALUES(?,?,?,?,?)""",
                    (datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                     f"Order {order_id}", total_pages,
                     config.get("colorMode", "bw"), amount))
                conn.execute("UPDATE t01_orders SET status='printed',updated_at=? WHERE order_id=?",
                             (time.time(), order_id))
            kiosk_state.update(status="printing", filename="Print package submitted")
            return jsonify({"status": "printed", "pages": total_pages}), 200
        except Exception as exc:
            app.logger.exception("Print submission failed for paid order %s", order_id)
            with db() as conn:
                conn.execute("UPDATE t01_orders SET status='print_error',error=?,updated_at=? WHERE order_id=?",
                             (str(exc)[:500], time.time(), order_id))
            return jsonify({"status": "payment_review",
                            "message": "Payment verified, but print submission needs operator review. Do not pay again."}), 202

@app.get("/api/order-status/<order_id>")
def order_status(order_id):
    digest, error = require_session()
    if error:
        return error
    with db() as conn:
        row = conn.execute("SELECT order_id,status,pages,copies,amount_paise,error FROM t01_orders WHERE order_id=? AND token_hash=?",
                           (order_id, digest)).fetchone()
    if not row:
        return jsonify({"error": "Order not found"}), 404
    return jsonify(dict(row))

@app.post("/api/set-state")
def set_state():
    digest, error = require_session()
    if error:
        return error
    data = request.get_json(silent=True) or {}
    requested = data.get("status")
    if requested not in ("processing", "payment", "idle"):
        return jsonify({"error": "Invalid kiosk state"}), 400
    kiosk_state["status"] = requested
    return jsonify({"status": "ok"})

@app.errorhandler(413)
def too_large(_):
    return jsonify({"error": "Upload exceeds 30 MB"}), 413

if __name__ == "__main__":
    init_db()
    new_pin()
    threading.Thread(target=pin_rotator, daemon=True).start()
    app.run(host="0.0.0.0", port=int(os.getenv("TERMINAL01_PORT", "5002")),
            debug=False, threaded=True)
