let products = [];
let selectedCategory = "All";
let cart = [];
let lastOrderId = null;

const translations = {
    ru: {
        cash_register: "Касса",
        tables: "Столы",
        orders: "Заказы",
        reports: "Отчёты",
        test_version: "Тестовая версия / Не фискальный чек",
        order: "Заказ",
        total: "Итого:",
        save_order: "Сохранить заказ",
        print_receipt: "Печать чека",
        clear: "Очистить",
        latest_orders: "Последние заказы",
        table_1: "Стол 1",
        table_2: "Стол 2",
        table_3: "Стол 3",
        table_4: "Стол 4",
        table_5: "Стол 5",
        table_6: "Стол 6"
    },
    de: {
        cash_register: "Kasse",
        tables: "Tische",
        orders: "Bestellungen",
        reports: "Berichte",
        test_version: "Testversion / Nicht fiskalisch",
        order: "Bestellung",
        total: "Gesamt:",
        save_order: "Bestellung speichern",
        print_receipt: "Bon drucken",
        clear: "Leeren",
        latest_orders: "Letzte Bestellungen",
        table_1: "Tisch 1",
        table_2: "Tisch 2",
        table_3: "Tisch 3",
        table_4: "Tisch 4",
        table_5: "Tisch 5",
        table_6: "Tisch 6"
    },
    en: {
        cash_register: "POS",
        tables: "Tables",
        orders: "Orders",
        reports: "Reports",
        test_version: "Test version / Not fiscal",
        order: "Order",
        total: "Total:",
        save_order: "Save order",
        print_receipt: "Print receipt",
        clear: "Clear",
        latest_orders: "Latest orders",
        table_1: "Table 1",
        table_2: "Table 2",
        table_3: "Table 3",
        table_4: "Table 4",
        table_5: "Table 5",
        table_6: "Table 6"
    }
};

let currentLanguage = "ru";

function changeLanguage() {
    currentLanguage = document.getElementById("languageSelect").value;

    document.querySelectorAll("[data-i18n]").forEach(element => {
        const key = element.getAttribute("data-i18n");

        if (translations[currentLanguage][key]) {
            element.textContent = translations[currentLanguage][key];
        }
    });
}

async function loadProducts() {
    const response = await fetch("/api/products");
    products = await response.json();

    renderCategories();
    renderProducts();
}

function renderCategories() {
    const categoriesDiv = document.getElementById("categories");

    const categories = ["All", ...new Set(products.map(p => p.category))];

    categoriesDiv.innerHTML = "";

    categories.forEach(category => {
        const button = document.createElement("button");
        button.className = "category-button";

        if (category === selectedCategory) {
            button.classList.add("active");
        }

        button.textContent = category;
        button.onclick = () => {
            selectedCategory = category;
            renderCategories();
            renderProducts();
        };

        categoriesDiv.appendChild(button);
    });
}

function renderProducts() {
    const productsDiv = document.getElementById("products");

    productsDiv.innerHTML = "";

    const filteredProducts = selectedCategory === "All"
        ? products
        : products.filter(p => p.category === selectedCategory);

    filteredProducts.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";

        card.innerHTML = `
            <h3>${product.name}</h3>
            <span>${product.category}</span>
            <strong>${product.price.toFixed(2)} €</strong>
        `;

        card.onclick = () => addToCart(product);

        productsDiv.appendChild(card);
    });
}

function addToCart(product) {
    const existingItem = cart.find(item => item.product_name === product.name);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            product_name: product.name,
            quantity: 1,
            price: product.price
        });
    }

    renderCart();
}

function renderCart() {
    const cartItemsDiv = document.getElementById("cartItems");
    const totalElement = document.getElementById("total");

    cartItemsDiv.innerHTML = "";

    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.quantity * item.price;
        total += itemTotal;

        const div = document.createElement("div");
        div.className = "cart-item";

        div.innerHTML = `
            <span>${item.quantity}x ${item.product_name}</span>
            <strong>${itemTotal.toFixed(2)} €</strong>
        `;

        cartItemsDiv.appendChild(div);
    });

    totalElement.textContent = `${total.toFixed(2)} €`;
}

function clearCart() {
    cart = [];
    lastOrderId = null;
    document.getElementById("receiptPreview").textContent = "";
    renderCart();
}

async function saveOrder() {
    if (cart.length === 0) {
        alert("Корзина пустая");
        return;
    }

    const tableNumber = Number(document.getElementById("tableSelect").value);

    const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            table_number: tableNumber,
            items: cart
        })
    });

    const result = await response.json();

    lastOrderId = result.order_id;

    alert(`Заказ сохранён. Номер: ${lastOrderId}`);

    await loadOrders();
}

async function printLastOrder() {
    if (!lastOrderId) {
        alert("Сначала сохрани заказ");
        return;
    }

    const response = await fetch(`/api/orders/${lastOrderId}/print`, {
        method: "POST"
    });

    const result = await response.json();

    document.getElementById("receiptPreview").textContent = result.receipt_text;

    alert("Тестовый чек создан");
}

async function loadOrders() {
    const response = await fetch("/api/orders");
    const orders = await response.json();

    const ordersList = document.getElementById("ordersList");
    ordersList.innerHTML = "";

    orders.slice(0, 5).forEach(order => {
        const div = document.createElement("div");
        div.className = "order-card";

        div.innerHTML = `
            <strong>Заказ #${order.id}</strong><br>
            Стол: ${order.table_number}<br>
            Сумма: ${order.total.toFixed(2)} €<br>
            Время: ${order.created_at}
        `;

        ordersList.appendChild(div);
    });
}

loadProducts();
loadOrders();
changeLanguage();

function showScreen(screenName, button) {
    document.querySelectorAll(".nav-button").forEach(btn => {
        btn.classList.remove("active");
    });

    button.classList.add("active");

    if (screenName === "pos") {
        alert("Экран кассы уже открыт");
    }

    if (screenName === "tables") {
        alert("Экран столов ещё в разработке");
    }

    if (screenName === "orders") {
        alert("Экран заказов пока снизу на странице");
    }

    if (screenName === "reports") {
        alert("Отчёты добавим следующим шагом");
    }
}