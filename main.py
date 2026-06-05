from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import datetime, date
import sqlite3
import os
import hashlib
import secrets

app = FastAPI(title="DARKONIQ POS")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_NAME = "darkoniq.db"
RECEIPTS_DIR = "receipts"
TABLE_COUNT = 12
ORDER_STATUSES = {"open", "paid", "cancelled"}
ROLES = {"admin", "waiter"}

os.makedirs(RECEIPTS_DIR, exist_ok=True)


def get_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(password: str):
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_number INTEGER NOT NULL,
            total REAL NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            note TEXT,
            FOREIGN KEY(order_id) REFERENCES orders(id)
        )
    """)

    cursor.execute("PRAGMA table_info(order_items)")
    order_item_columns = {row["name"] for row in cursor.fetchall()}
    if "note" not in order_item_columns:
        cursor.execute("ALTER TABLE order_items ADD COLUMN note TEXT")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS restaurant_tables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_number INTEGER NOT NULL UNIQUE,
            seats INTEGER NOT NULL,
            x REAL NOT NULL,
            y REAL NOT NULL,
            zone TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            display_name TEXT NOT NULL
        )
    """)

    cursor.execute("PRAGMA table_info(users)")
    user_columns = {row["name"] for row in cursor.fetchall()}
    if "password_plain" not in user_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN password_plain TEXT")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)

    cursor.execute("SELECT COUNT(*) FROM products")
    count = cursor.fetchone()[0]

    if count == 0:
        products = [
            ("Espresso", "Coffee", 2.20),
            ("Cappuccino", "Coffee", 3.30),
            ("Latte", "Coffee", 3.50),
            ("Americano", "Coffee", 2.80),
            ("Pizza Margherita", "Food", 8.90),
            ("Pizza Salami", "Food", 10.50),
            ("Burger", "Food", 11.90),
            ("Caesar Salad", "Food", 9.50),
            ("Cola", "Drinks", 3.20),
            ("Water", "Drinks", 2.50),
            ("Beer", "Drinks", 4.00),
            ("Tiramisu", "Dessert", 5.50),
        ]

        cursor.executemany(
            "INSERT INTO products (name, category, price) VALUES (?, ?, ?)",
            products
        )

    menu_products = [
        ("Schnitzel Wiener Art", "Food", 14.90),
        ("Rumpsteak", "Food", 24.90),
        ("Bratkartoffeln Extra", "Food", 4.20),
        ("Pommes Frites", "Food", 3.90),
        ("Hausgemachte Limonade", "Drinks", 4.50),
        ("Apfelschorle", "Drinks", 3.40),
        ("Pils", "Drinks", 4.20),
        ("Weisswein", "Drinks", 5.80),
        ("Rotwein", "Drinks", 5.80),
    ]
    for name, category, price in menu_products:
        cursor.execute("SELECT id FROM products WHERE name = ?", (name,))
        if cursor.fetchone():
            continue
        cursor.execute(
            "INSERT INTO products (name, category, price) VALUES (?, ?, ?)",
            (name, category, price)
        )

    cursor.execute("SELECT COUNT(*) FROM restaurant_tables")
    tables_count = cursor.fetchone()[0]

    if tables_count == 0:
        default_tables = [
            (1, 2, 8, 10, "Innenbereich"),
            (2, 4, 25, 10, "Innenbereich"),
            (3, 2, 42, 10, "Innenbereich"),
            (4, 6, 62, 10, "Innenbereich"),
            (5, 4, 8, 34, "Innenbereich"),
            (6, 2, 28, 34, "Innenbereich"),
            (7, 3, 48, 34, "Innenbereich"),
            (8, 4, 68, 34, "Innenbereich"),
            (9, 4, 10, 62, "Terrasse"),
            (10, 2, 30, 62, "Terrasse"),
            (11, 6, 52, 62, "Terrasse"),
            (12, 2, 74, 62, "Terrasse"),
        ]
        cursor.executemany(
            """
            INSERT INTO restaurant_tables (table_number, seats, x, y, zone)
            VALUES (?, ?, ?, ?, ?)
            """,
            default_tables
        )

    cursor.execute(
        """
        UPDATE users
        SET username = ?, password_hash = ?, password_plain = ?, display_name = ?
        WHERE username = ?
        """,
        ("alexadmin", hash_password("alexadmin2026"), "alexadmin2026", "Alex Admin", "admin")
    )

    seed_users = [
        ("alexadmin", "alexadmin2026", "admin", "Alex Admin"),
        ("waiter", "waiter2026", "waiter", "Service"),
    ]
    for username, password, role, display_name in seed_users:
        cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
        if cursor.fetchone():
            continue
        cursor.execute(
            """
            INSERT INTO users (username, password_hash, password_plain, role, display_name)
            VALUES (?, ?, ?, ?, ?)
            """,
            (username, hash_password(password), password, role, display_name)
        )

    cursor.execute("""
        UPDATE users
        SET password_plain = ?
        WHERE username = ? AND (password_plain IS NULL OR password_plain = '')
    """, ("alexadmin2026", "alexadmin"))
    cursor.execute("""
        UPDATE users
        SET password_plain = ?
        WHERE username = ? AND (password_plain IS NULL OR password_plain = '')
    """, ("waiter2026", "waiter"))

    conn.commit()
    conn.close()


class OrderItem(BaseModel):
    product_name: str = Field(min_length=1)
    quantity: int = Field(gt=0)
    price: float = Field(ge=0)
    note: str | None = Field(default="", max_length=500)


class CreateOrderRequest(BaseModel):
    table_number: int = Field(gt=0)
    items: list[OrderItem] = Field(min_length=1)


class UpdateOrderStatusRequest(BaseModel):
    status: str


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class CreateUserRequest(BaseModel):
    username: str = Field(min_length=3)
    password: str = Field(min_length=6)
    role: str
    display_name: str = Field(min_length=1)


class CreateTableRequest(BaseModel):
    seats: int = Field(default=2, ge=1, le=20)
    zone: str = Field(default="Innenbereich", min_length=1)


class UpdateTableRequest(BaseModel):
    x: float | None = Field(default=None, ge=0, le=100)
    y: float | None = Field(default=None, ge=0, le=100)
    seats: int | None = Field(default=None, ge=1, le=20)
    zone: str | None = Field(default=None, min_length=1)


def get_current_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.removeprefix("Bearer ").strip()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.username, u.role, u.display_name
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = ?
    """, (token,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")

    return dict(user)


def require_admin(user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return user


@app.on_event("startup")
def startup():
    init_db()


@app.get("/")
def index():
    return FileResponse("static/index.html")


@app.post("/api/login")
def login(request: LoginRequest):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, username, password_hash, role, display_name
        FROM users
        WHERE username = ?
    """, (request.username,))
    user = cursor.fetchone()

    if not user or user["password_hash"] != hash_password(request.password):
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = secrets.token_urlsafe(32)
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
        (token, user["id"], created_at)
    )
    conn.commit()
    conn.close()

    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "display_name": user["display_name"],
        }
    }


@app.get("/api/me")
def me(user: dict = Depends(get_current_user)):
    return user


@app.post("/api/logout")
def logout(authorization: str | None = Header(default=None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        conn.close()

    return {"message": "Logged out"}


@app.get("/api/users")
def get_users(user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, username, password_plain, role, display_name
        FROM users
        ORDER BY role, username
    """)
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return users


@app.post("/api/users")
def create_user(request: CreateUserRequest, user: dict = Depends(require_admin)):
    if request.role not in ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO users (username, password_hash, password_plain, role, display_name)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                request.username,
                hash_password(request.password),
                request.password,
                request.role,
                request.display_name,
            )
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="Username already exists")

    user_id = cursor.lastrowid
    conn.close()
    return {
        "id": user_id,
        "username": request.username,
        "password_plain": request.password,
        "role": request.role,
        "display_name": request.display_name,
    }


@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, user: dict = Depends(require_admin)):
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, role FROM users WHERE id = ?", (user_id,))
    target = cursor.fetchone()

    if not target:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")

    if target["role"] == "admin":
        cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")
        admin_count = cursor.fetchone()[0]
        if admin_count <= 1:
            conn.close()
            raise HTTPException(status_code=409, detail="Cannot delete last admin")

    cursor.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()

    return {"message": "User deleted", "user_id": user_id}


@app.get("/api/products")
def get_products(user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id, name, category, price FROM products ORDER BY category, name")
    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def fetch_order(cursor, order_id: int):
    cursor.execute("""
        SELECT id, table_number, total, status, created_at
        FROM orders
        WHERE id = ?
    """, (order_id,))
    order = cursor.fetchone()

    if not order:
        return None

    cursor.execute("""
        SELECT product_name, quantity, price, COALESCE(note, '') AS note
        FROM order_items
        WHERE order_id = ?
        ORDER BY id
    """, (order_id,))
    items = cursor.fetchall()

    result = dict(order)
    result["items"] = [dict(item) for item in items]
    return result


@app.post("/api/orders")
def create_order(order: CreateOrderRequest, user: dict = Depends(get_current_user)):
    total = round(sum(item.quantity * item.price for item in order.items), 2)
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "INSERT INTO orders (table_number, total, status, created_at) VALUES (?, ?, ?, ?)",
        (order.table_number, total, "open", created_at)
    )

    order_id = cursor.lastrowid

    for item in order.items:
        cursor.execute(
            """
            INSERT INTO order_items
            (order_id, product_name, quantity, price, note)
            VALUES (?, ?, ?, ?, ?)
            """,
            (order_id, item.product_name, item.quantity, item.price, item.note or "")
        )

    conn.commit()
    created_order = fetch_order(cursor, order_id)
    conn.close()

    return created_order


@app.get("/api/orders")
def get_orders(
    status: str | None = None,
    table_number: int | None = None,
    user: dict = Depends(get_current_user),
):
    conn = get_connection()
    cursor = conn.cursor()

    conditions = []
    params = []

    if status:
        if status not in ORDER_STATUSES:
            conn.close()
            raise HTTPException(status_code=400, detail="Invalid status")
        conditions.append("status = ?")
        params.append(status)

    if table_number:
        conditions.append("table_number = ?")
        params.append(table_number)

    where_sql = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    cursor.execute(f"""
        SELECT id
        FROM orders
        {where_sql}
        ORDER BY id DESC
    """, params)
    order_ids = [row["id"] for row in cursor.fetchall()]

    result = [fetch_order(cursor, order_id) for order_id in order_ids]
    conn.close()
    return result


@app.patch("/api/orders/{order_id}/status")
def update_order_status(
    order_id: int,
    request: UpdateOrderStatusRequest,
    user: dict = Depends(require_admin),
):
    if request.status not in ORDER_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM orders WHERE id = ?", (order_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Order not found")

    cursor.execute(
        "UPDATE orders SET status = ? WHERE id = ?",
        (request.status, order_id)
    )
    conn.commit()

    order = fetch_order(cursor, order_id)
    conn.close()
    return order


@app.get("/api/tables")
def get_tables(user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            table_number,
            COUNT(*) AS open_orders,
            COALESCE(SUM(total), 0) AS total,
            MIN(created_at) AS first_order_at
        FROM orders
        WHERE status = 'open'
        GROUP BY table_number
    """)
    open_by_table = {row["table_number"]: row for row in cursor.fetchall()}

    cursor.execute("""
        SELECT id, table_number, seats, x, y, zone
        FROM restaurant_tables
        ORDER BY table_number
    """)
    table_rows = cursor.fetchall()

    tables = []
    for table in table_rows:
        row = open_by_table.get(table["table_number"])
        tables.append({
            "id": table["id"],
            "table_number": table["table_number"],
            "seats": table["seats"],
            "x": table["x"],
            "y": table["y"],
            "zone": table["zone"],
            "status": "busy" if row else "free",
            "open_orders": row["open_orders"] if row else 0,
            "total": round(row["total"], 2) if row else 0,
            "first_order_at": row["first_order_at"] if row else None,
        })

    conn.close()
    return tables


@app.post("/api/tables")
def create_table(table: CreateTableRequest, user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COALESCE(MAX(table_number), 0) + 1 FROM restaurant_tables")
    table_number = cursor.fetchone()[0]

    x = 12 + ((table_number - 1) % 4) * 18
    y = 12 + ((table_number - 1) // 4) * 20

    cursor.execute(
        """
        INSERT INTO restaurant_tables (table_number, seats, x, y, zone)
        VALUES (?, ?, ?, ?, ?)
        """,
        (table_number, table.seats, x, y, table.zone)
    )
    conn.commit()
    table_id = cursor.lastrowid

    cursor.execute("""
        SELECT id, table_number, seats, x, y, zone
        FROM restaurant_tables
        WHERE id = ?
    """, (table_id,))
    created = dict(cursor.fetchone())
    conn.close()

    return {
        **created,
        "status": "free",
        "open_orders": 0,
        "total": 0,
    }


@app.patch("/api/tables/{table_id}")
def update_table(
    table_id: int,
    table: UpdateTableRequest,
    user: dict = Depends(require_admin),
):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM restaurant_tables WHERE id = ?", (table_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Table not found")

    updates = []
    params = []

    for field in ("x", "y", "seats", "zone"):
        value = getattr(table, field)
        if value is not None:
            updates.append(f"{field} = ?")
            params.append(value)

    if updates:
        params.append(table_id)
        cursor.execute(
            f"UPDATE restaurant_tables SET {', '.join(updates)} WHERE id = ?",
            params
        )
        conn.commit()

    cursor.execute("""
        SELECT id, table_number, seats, x, y, zone
        FROM restaurant_tables
        WHERE id = ?
    """, (table_id,))
    updated = dict(cursor.fetchone())
    conn.close()

    return updated


@app.delete("/api/tables/{table_id}")
def delete_table(table_id: int, user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id, table_number FROM restaurant_tables WHERE id = ?",
        (table_id,)
    )
    table = cursor.fetchone()
    if not table:
        conn.close()
        raise HTTPException(status_code=404, detail="Table not found")

    cursor.execute(
        "SELECT COUNT(*) FROM orders WHERE table_number = ? AND status = 'open'",
        (table["table_number"],)
    )
    open_orders = cursor.fetchone()[0]
    if open_orders > 0:
        conn.close()
        raise HTTPException(status_code=409, detail="Table has open orders")

    cursor.execute("DELETE FROM restaurant_tables WHERE id = ?", (table_id,))
    conn.commit()
    conn.close()

    return {"message": "Table deleted", "table_id": table_id}


@app.get("/api/reports/summary")
def get_reports_summary(day: str | None = None, user: dict = Depends(require_admin)):
    report_day = day or date.today().strftime("%Y-%m-%d")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            COUNT(*) AS orders_count,
            COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) AS gross_sales,
            COALESCE(SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END), 0) AS paid_sales,
            COALESCE(SUM(CASE WHEN status = 'open' THEN total ELSE 0 END), 0) AS open_total,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count
        FROM orders
        WHERE DATE(created_at) = ?
    """, (report_day,))
    totals = dict(cursor.fetchone())

    cursor.execute("""
        SELECT status, COUNT(*) AS count, COALESCE(SUM(total), 0) AS total
        FROM orders
        WHERE DATE(created_at) = ?
        GROUP BY status
    """, (report_day,))
    by_status = [dict(row) for row in cursor.fetchall()]

    cursor.execute("""
        SELECT oi.product_name, SUM(oi.quantity) AS quantity, SUM(oi.quantity * oi.price) AS total
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE DATE(o.created_at) = ? AND o.status != 'cancelled'
        GROUP BY oi.product_name
        ORDER BY quantity DESC, total DESC
        LIMIT 10
    """, (report_day,))
    top_products = [dict(row) for row in cursor.fetchall()]

    conn.close()

    for key in ("gross_sales", "paid_sales", "open_total"):
        totals[key] = round(totals[key] or 0, 2)
    totals["orders_count"] = totals["orders_count"] or 0
    totals["cancelled_count"] = totals["cancelled_count"] or 0

    for row in by_status:
        row["total"] = round(row["total"] or 0, 2)

    for row in top_products:
        row["quantity"] = row["quantity"] or 0
        row["total"] = round(row["total"] or 0, 2)

    return {
        "date": report_day,
        "totals": totals,
        "by_status": by_status,
        "top_products": top_products,
    }


@app.post("/api/orders/{order_id}/print")
def print_receipt(order_id: int, user: dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    order = fetch_order(cursor, order_id)
    conn.close()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    receipt_text = []
    receipt_text.append("DARKONIQ POS")
    receipt_text.append("TESTBON / NICHT FISKALISCH")
    receipt_text.append("------------------------------")
    receipt_text.append(f"Order: #{order['id']}")
    receipt_text.append(f"Table: {order['table_number']}")
    receipt_text.append(f"Date: {order['created_at']}")
    receipt_text.append(f"Status: {order['status']}")
    receipt_text.append("------------------------------")

    for item in order["items"]:
        line_total = item["quantity"] * item["price"]
        receipt_text.append(f"{item['quantity']}x {item['product_name']}  {line_total:.2f} EUR")
        if item.get("note"):
            receipt_text.append(f"  Kueche: {item['note']}")

    receipt_text.append("------------------------------")
    receipt_text.append(f"TOTAL: {order['total']:.2f} EUR")
    receipt_text.append("------------------------------")
    receipt_text.append("Danke!")

    filename = f"receipt_{order_id}.txt"
    filepath = os.path.join(RECEIPTS_DIR, filename)

    with open(filepath, "w", encoding="utf-8") as file:
        file.write("\n".join(receipt_text))

    return {
        "message": "Receipt created",
        "receipt_file": filename,
        "receipt_text": "\n".join(receipt_text)
    }


app.mount("/static", StaticFiles(directory="static"), name="static")
