from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from datetime import datetime
import sqlite3
import os

app = FastAPI(title="DARKONIQ POS")

DB_NAME = "darkoniq.db"
RECEIPTS_DIR = "receipts"

os.makedirs(RECEIPTS_DIR, exist_ok=True)


def get_connection():
    return sqlite3.connect(DB_NAME)


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
            price REAL NOT NULL
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

    conn.commit()
    conn.close()


class OrderItem(BaseModel):
    product_name: str
    quantity: int
    price: float


class CreateOrderRequest(BaseModel):
    table_number: int
    items: list[OrderItem]


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

    cursor.execute("SELECT id, name, category, price FROM products")
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": row[0],
            "name": row[1],
            "category": row[2],
            "price": row[3],
        }
        for row in rows
    ]


@app.post("/api/orders")
def create_order(order: CreateOrderRequest):
    total = sum(item.quantity * item.price for item in order.items)
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
    conn.close()

    return {
        "message": "Order created",
        "order_id": order_id,
        "total": total
    }


@app.get("/api/orders")
def get_orders():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, table_number, total, status, created_at 
        FROM orders 
        ORDER BY id DESC
    """)
    orders = cursor.fetchall()

    result = []

    for order in orders:
        order_id = order[0]

        cursor.execute("""
            SELECT product_name, quantity, price 
            FROM order_items 
            WHERE order_id = ?
        """, (order_id,))

        items = cursor.fetchall()

        result.append({
            "id": order[0],
            "table_number": order[1],
            "total": order[2],
            "status": order[3],
            "created_at": order[4],
            "items": [
                {
                    "product_name": item[0],
                    "quantity": item[1],
                    "price": item[2],
                }
                for item in items
            ]
        })

    conn.close()
    return result


@app.post("/api/orders/{order_id}/print")
def print_receipt(order_id: int):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, table_number, total, created_at 
        FROM orders 
        WHERE id = ?
    """, (order_id,))
    order = cursor.fetchone()

    if not order:
        conn.close()
        return {"error": "Order not found"}

    cursor.execute("""
        SELECT product_name, quantity, price 
        FROM order_items 
        WHERE order_id = ?
    """, (order_id,))
    items = cursor.fetchall()

    conn.close()

    receipt_text = []
    receipt_text.append("DARKONIQ POS")
    receipt_text.append("TESTBON / NICHT FISKALISCH")
    receipt_text.append("------------------------------")
    receipt_text.append(f"Order: #{order[0]}")
    receipt_text.append(f"Table: {order[1]}")
    receipt_text.append(f"Date: {order[3]}")
    receipt_text.append("------------------------------")

    for item in items:
        name, quantity, price = item
        line_total = quantity * price
        receipt_text.append(f"{quantity}x {name}  {line_total:.2f} EUR")

    receipt_text.append("------------------------------")
    receipt_text.append(f"TOTAL: {order[2]:.2f} EUR")
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