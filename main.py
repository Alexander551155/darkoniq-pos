from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import datetime, date
import sqlite3
import os

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

os.makedirs(RECEIPTS_DIR, exist_ok=True)


def get_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn


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
            FOREIGN KEY(order_id) REFERENCES orders(id)
        )
    """)

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

    conn.commit()
    conn.close()


class OrderItem(BaseModel):
    product_name: str = Field(min_length=1)
    quantity: int = Field(gt=0)
    price: float = Field(ge=0)


class CreateOrderRequest(BaseModel):
    table_number: int = Field(gt=0)
    items: list[OrderItem] = Field(min_length=1)


class UpdateOrderStatusRequest(BaseModel):
    status: str


class CreateTableRequest(BaseModel):
    seats: int = Field(default=2, ge=1, le=20)
    zone: str = Field(default="Innenbereich", min_length=1)


class UpdateTableRequest(BaseModel):
    x: float | None = Field(default=None, ge=0, le=100)
    y: float | None = Field(default=None, ge=0, le=100)
    seats: int | None = Field(default=None, ge=1, le=20)
    zone: str | None = Field(default=None, min_length=1)


@app.on_event("startup")
def startup():
    init_db()


@app.get("/")
def index():
    return FileResponse("static/index.html")


@app.get("/api/products")
def get_products():
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
        SELECT product_name, quantity, price
        FROM order_items
        WHERE order_id = ?
        ORDER BY id
    """, (order_id,))
    items = cursor.fetchall()

    result = dict(order)
    result["items"] = [dict(item) for item in items]
    return result


@app.post("/api/orders")
def create_order(order: CreateOrderRequest):
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
            (order_id, product_name, quantity, price)
            VALUES (?, ?, ?, ?)
            """,
            (order_id, item.product_name, item.quantity, item.price)
        )

    conn.commit()
    created_order = fetch_order(cursor, order_id)
    conn.close()

    return created_order


@app.get("/api/orders")
def get_orders(status: str | None = None, table_number: int | None = None):
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
def update_order_status(order_id: int, request: UpdateOrderStatusRequest):
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
def get_tables():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT table_number, COUNT(*) AS open_orders, COALESCE(SUM(total), 0) AS total
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
        })

    conn.close()
    return tables


@app.post("/api/tables")
def create_table(table: CreateTableRequest):
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
def update_table(table_id: int, table: UpdateTableRequest):
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
def delete_table(table_id: int):
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
def get_reports_summary(day: str | None = None):
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
def print_receipt(order_id: int):
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
