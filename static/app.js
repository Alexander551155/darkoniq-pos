let products = [];
let selectedCategory = "All";
let cart = [];
let lastOrderId = null;
let currentScreen = "pos";
let currentTableZone = "Innenbereich";
let restaurantTables = [];
let activeTableDrag = null;
let suppressTableClickUntil = 0;

const API_BASE = window.location.protocol === "file:" ? "http://127.0.0.1:8000" : "";

const fallbackProducts = [
    {id: 1, name: "Espresso", category: "Coffee", price: 2.20},
    {id: 2, name: "Cappuccino", category: "Coffee", price: 3.30},
    {id: 3, name: "Latte", category: "Coffee", price: 3.50},
    {id: 4, name: "Americano", category: "Coffee", price: 2.80},
    {id: 5, name: "Pizza Margherita", category: "Food", price: 8.90},
    {id: 6, name: "Pizza Salami", category: "Food", price: 10.50},
    {id: 7, name: "Burger", category: "Food", price: 11.90},
    {id: 8, name: "Caesar Salad", category: "Food", price: 9.50},
    {id: 9, name: "Cola", category: "Drinks", price: 3.20},
    {id: 10, name: "Water", category: "Drinks", price: 2.50},
    {id: 11, name: "Beer", category: "Drinks", price: 4.00},
    {id: 12, name: "Tiramisu", category: "Dessert", price: 5.50}
];

const translations = {
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
        refresh: "Aktualisieren",
        tables_hint: "Tische per Touch verschieben oder direkt einen neuen Tisch anlegen",
        orders_hint: "Offene, bezahlte und stornierte Bestellungen verwalten",
        reports_hint: "Tagesumsatz fuer das gewaehlte Datum",
        all_orders: "Alle Bestellungen",
        open_orders: "Offen",
        paid_orders: "Bezahlt",
        cancelled_orders: "Storniert",
        top_products: "Top Produkte",
        free: "Frei",
        busy: "Belegt",
        open: "Offen",
        paid: "Bezahlt",
        cancelled: "Storniert",
        pay: "Bezahlen",
        cancel: "Stornieren",
        print: "Drucken",
        no_orders: "Keine Bestellungen",
        no_products: "Keine Produktverkaeufe",
        cart_empty: "Warenkorb ist leer",
        api_unavailable: "Server antwortet nicht. Basispositionen werden angezeigt.",
        save_error: "Bestellung konnte nicht gespeichert werden. Pruefe http://127.0.0.1:8000",
        print_error: "Bon konnte nicht erstellt werden",
        saved: "Bestellung gespeichert",
        save_first: "Bestellung zuerst speichern",
        gross_sales: "Umsatz",
        paid_sales: "Bezahlt",
        open_total: "Offen",
        orders_count: "Bestellungen",
        table: "Tisch",
        add_table: "Tisch hinzufügen",
        delete_table: "Löschen",
        delete_confirm: "Diesen Tisch löschen?",
        delete_blocked: "Tisch kann nicht gelöscht werden: Es gibt offene Bestellungen.",
        seats: "Personen",
        zone: "Bereich",
        inside: "Innenbereich",
        terrace: "Terrasse",
        inside_hint: "Hauptraum",
        terrace_hint: "Außenbereich",
        touch_hint: "Touch-Modus",
        drag_hint: "Tisch halten und ziehen. Tippen öffnet die Kasse. Löschen geht nur ohne offene Bestellung.",
        all: "Alle",
        sum: "Summe",
        time: "Zeit",
        items: "Positionen"
    }
};

function t(key) {
    return translations.de[key] || key;
}

function money(value) {
    return `${Number(value || 0).toFixed(2)} €`;
}

function setMessage(element, message) {
    element.innerHTML = `<div class="empty-state">${message}</div>`;
}

function apiUrl(path) {
    return `${API_BASE}${path}`;
}

function applyLanguage() {

    document.querySelectorAll("[data-i18n]").forEach(element => {
        const key = element.getAttribute("data-i18n");
        element.textContent = t(key);
    });

    updateScreenTitle();
    renderCategories();
    renderProducts();
    renderCart();
    buildTableSelect();

    if (currentScreen === "tables") loadTables();
    if (currentScreen === "orders") loadOrders();
    if (currentScreen === "reports") loadReports();
}

function buildTableSelect() {
    const tableSelect = document.getElementById("tableSelect");
    const selectedValue = tableSelect.value || "1";
    const sourceTables = restaurantTables.length > 0
        ? restaurantTables
        : Array.from({length: 12}, (_, index) => ({table_number: index + 1}));
    tableSelect.innerHTML = "";

    sourceTables.forEach(table => {
        const option = document.createElement("option");
        option.value = String(table.table_number);
        option.textContent = `${t("table")} ${table.table_number}`;
        tableSelect.appendChild(option);
    });

    if ([...tableSelect.options].some(option => option.value === selectedValue)) {
        tableSelect.value = selectedValue;
    }
}

async function loadProducts() {
    const productsDiv = document.getElementById("products");

    try {
        const response = await fetch(apiUrl("/api/products"));
        if (!response.ok) throw new Error("Products API failed");
        products = await response.json();
    } catch (error) {
        products = fallbackProducts;
        if (productsDiv) {
            setMessage(productsDiv, t("api_unavailable"));
        }
    }

    renderCategories();
    renderProducts();
}

function renderCategories() {
    const categoriesDiv = document.getElementById("categories");
    if (!categoriesDiv || products.length === 0) return;

    const categories = ["All", ...new Set(products.map(product => product.category))];
    categoriesDiv.innerHTML = "";

    categories.forEach(category => {
        const button = document.createElement("button");
        button.className = "category-button";
        button.classList.toggle("active", category === selectedCategory);
        button.textContent = category === "All" ? t("all") : category;
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
    if (!productsDiv) return;

    productsDiv.innerHTML = "";

    const filteredProducts = selectedCategory === "All"
        ? products
        : products.filter(product => product.category === selectedCategory);

    filteredProducts.forEach(product => {
        const card = document.createElement("div");
        card.className = "product-card";
        card.innerHTML = `
            <div class="product-info">
                <h3>${product.name}</h3>
                <span>${product.category}</span>
            </div>
            <strong class="product-price">${money(product.price)}</strong>
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

function changeQuantity(productName, delta) {
    const item = cart.find(cartItem => cartItem.product_name === productName);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(cartItem => cartItem.product_name !== productName);
    }

    renderCart();
}

function renderCart() {
    const cartItemsDiv = document.getElementById("cartItems");
    const totalElement = document.getElementById("total");
    if (!cartItemsDiv || !totalElement) return;

    cartItemsDiv.innerHTML = "";
    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.quantity * item.price;
        total += itemTotal;

        const div = document.createElement("div");
        div.className = "cart-item";
        div.innerHTML = `
            <div>
                <strong>${item.quantity}x ${item.product_name}</strong>
                <span>${money(item.price)} / ${money(itemTotal)}</span>
            </div>
            <div class="quantity-actions">
                <button onclick="changeQuantity('${item.product_name}', -1)">-</button>
                <button onclick="changeQuantity('${item.product_name}', 1)">+</button>
            </div>
        `;
        cartItemsDiv.appendChild(div);
    });

    if (cart.length === 0) {
        setMessage(cartItemsDiv, t("cart_empty"));
    }

    totalElement.textContent = money(total);
}

function clearCart() {
    cart = [];
    lastOrderId = null;
    document.getElementById("receiptPreview").textContent = "";
    renderCart();
}

async function saveOrder() {
    if (cart.length === 0) {
        alert(t("cart_empty"));
        return;
    }

    const tableNumber = Number(document.getElementById("tableSelect").value);
    let response;
    try {
        response = await fetch(apiUrl("/api/orders"), {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                table_number: tableNumber,
                items: cart
            })
        });
    } catch (error) {
        alert(t("save_error"));
        return;
    }

    if (!response.ok) {
        alert(t("save_error"));
        return;
    }

    const result = await response.json();
    lastOrderId = result.id;
    document.getElementById("receiptPreview").textContent = `${t("saved")}: #${lastOrderId}`;

    await Promise.allSettled([loadOrders(), loadTables(), loadReports()]);
}

async function printOrder(orderId) {
    let response;
    try {
        response = await fetch(apiUrl(`/api/orders/${orderId}/print`), {method: "POST"});
    } catch (error) {
        alert(t("print_error"));
        return;
    }

    if (!response.ok) {
        alert(t("print_error"));
        return;
    }

    const result = await response.json();
    document.getElementById("receiptPreview").textContent = result.receipt_text;
    lastOrderId = orderId;
}

async function printLastOrder() {
    if (!lastOrderId) {
        alert(t("save_first"));
        return;
    }

    await printOrder(lastOrderId);
}

async function updateOrderStatus(orderId, status) {
    let response;
    try {
        response = await fetch(apiUrl(`/api/orders/${orderId}/status`), {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({status})
        });
    } catch (error) {
        return;
    }

    if (!response.ok) return;

    await Promise.allSettled([loadOrders(), loadTables(), loadReports()]);
}

async function loadOrders() {
    const filter = document.getElementById("orderStatusFilter")?.value || "";
    const url = filter ? `/api/orders?status=${encodeURIComponent(filter)}` : "/api/orders";
    const ordersList = document.getElementById("ordersList");
    if (!ordersList) return;

    let orders = [];
    try {
        const response = await fetch(apiUrl(url));
        if (!response.ok) throw new Error("Orders API failed");
        orders = await response.json();
    } catch (error) {
        setMessage(ordersList, t("api_unavailable"));
        return;
    }

    ordersList.innerHTML = "";

    if (orders.length === 0) {
        setMessage(ordersList, t("no_orders"));
        return;
    }

    orders.forEach(order => {
        const div = document.createElement("div");
        div.className = "order-card";

        const items = order.items
            .map(item => `${item.quantity}x ${item.product_name}`)
            .join(", ");

        const statusActions = order.status === "open"
            ? `<button class="save-button compact" onclick="updateOrderStatus(${order.id}, 'paid')">${t("pay")}</button>
               <button class="clear-button compact" onclick="updateOrderStatus(${order.id}, 'cancelled')">${t("cancel")}</button>`
            : "";

        div.innerHTML = `
            <div class="order-main">
                <div>
                    <strong>#${order.id} · ${t("table")} ${order.table_number}</strong>
                    <span class="status-badge ${order.status}">${t(order.status)}</span>
                </div>
                <div>${t("sum")}: <strong>${money(order.total)}</strong></div>
                <div>${t("time")}: ${order.created_at}</div>
                <div>${t("items")}: ${items}</div>
            </div>
            <div class="order-actions">
                <button class="print-button compact" onclick="printOrder(${order.id})">${t("print")}</button>
                ${statusActions}
            </div>
        `;

        ordersList.appendChild(div);
    });
}

async function loadTables() {
    const tablesGrid = document.getElementById("tablesGrid");
    if (!tablesGrid) return;

    try {
        const response = await fetch(apiUrl("/api/tables"));
        if (!response.ok) throw new Error("Tables API failed");
        restaurantTables = await response.json();
    } catch (error) {
        setMessage(tablesGrid, t("api_unavailable"));
        return;
    }

    buildTableSelect();
    renderTables();
}

function renderTables() {
    const layer = document.getElementById("tablesGrid");
    const floorPlan = document.getElementById("floorPlan");
    const activeZoneTitle = document.getElementById("activeZoneTitle");
    const activeZoneHint = document.getElementById("activeZoneHint");
    const activeZoneBadge = document.getElementById("activeZoneBadge");
    if (!layer) return;

    layer.innerHTML = "";
    floorPlan?.classList.toggle("terrace-plan", currentTableZone === "Terrasse");
    if (activeZoneTitle) activeZoneTitle.textContent = currentTableZone === "Terrasse" ? t("terrace") : t("inside");
    if (activeZoneHint) activeZoneHint.textContent = currentTableZone === "Terrasse" ? t("terrace_hint") : t("inside_hint");
    if (activeZoneBadge) activeZoneBadge.textContent = currentTableZone === "Terrasse" ? t("terrace") : t("inside");

    const visibleTables = restaurantTables.filter(table => table.zone === currentTableZone);

    visibleTables.forEach(table => {

        const card = document.createElement("div");
        card.className = `floor-table ${table.status}`;
        card.setAttribute("role", "button");
        card.tabIndex = 0;
        card.style.left = `${table.x}%`;
        card.style.top = `${table.y}%`;
        card.dataset.tableId = String(table.id);
        card.innerHTML = `
            <button class="delete-table-button" type="button" title="${t("delete_table")}">×</button>
            <span class="table-status-dot"></span>
            <strong>${t("table")} ${table.table_number}</strong>
            <small>${table.seats} ${t("seats")} · ${table.zone}</small>
            <em>${t(table.status)} · ${money(table.total)}</em>
        `;
        card.querySelector(".delete-table-button").addEventListener("pointerdown", event => event.stopPropagation());
        card.querySelector(".delete-table-button").addEventListener("click", event => {
            event.stopPropagation();
            deleteTable(table);
        });
        card.addEventListener("pointerdown", event => startTableDrag(event, table));
        card.addEventListener("click", event => openTableFromPlan(event, table));
        layer.appendChild(card);
    });
}

function switchTableZone(zone, button) {
    currentTableZone = zone;
    document.querySelectorAll(".zone-tab").forEach(tab => tab.classList.remove("active"));
    if (button) button.classList.add("active");
    renderTables();
}

async function createTable(zone = currentTableZone) {
    try {
        const response = await fetch(apiUrl("/api/tables"), {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({seats: 2, zone})
        });
        if (!response.ok) throw new Error("Create table failed");
        const table = await response.json();
        restaurantTables.push(table);
        buildTableSelect();
        renderTables();
    } catch (error) {
        alert(t("api_unavailable"));
    }
}

async function deleteTable(table) {
    if (!confirm(t("delete_confirm"))) return;

    try {
        const response = await fetch(apiUrl(`/api/tables/${table.id}`), {
            method: "DELETE"
        });

        if (response.status === 409) {
            alert(t("delete_blocked"));
            return;
        }

        if (!response.ok) throw new Error("Delete table failed");

        restaurantTables = restaurantTables.filter(item => item.id !== table.id);
        buildTableSelect();
        renderTables();
    } catch (error) {
        alert(t("api_unavailable"));
    }
}

function startTableDrag(event, table) {
    if (event.target.closest(".delete-table-button")) return;

    const floorPlan = event.currentTarget.closest(".floor-plan");
    const tableElement = event.currentTarget;
    if (!floorPlan || !tableElement) return;

    const tableRect = tableElement.getBoundingClientRect();
    activeTableDrag = {
        id: table.id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - tableRect.left,
        offsetY: event.clientY - tableRect.top,
        moved: false
    };

    tableElement.setPointerCapture(event.pointerId);
    tableElement.classList.add("dragging");
    tableElement.addEventListener("pointermove", moveTableDrag);
    tableElement.addEventListener("pointerup", endTableDrag);
    tableElement.addEventListener("pointercancel", endTableDrag);
}

function moveTableDrag(event) {
    if (!activeTableDrag || activeTableDrag.pointerId !== event.pointerId) return;

    const tableElement = event.currentTarget;
    const floorPlan = tableElement.closest(".floor-plan");
    if (!floorPlan) return;
    const floorRect = floorPlan.getBoundingClientRect();
    const tableWidth = tableElement.offsetWidth;
    const tableHeight = tableElement.offsetHeight;

    const xPx = event.clientX - floorRect.left - activeTableDrag.offsetX;
    const yPx = event.clientY - floorRect.top - activeTableDrag.offsetY;
    const maxX = floorRect.width - tableWidth;
    const maxY = floorRect.height - tableHeight;
    const clampedX = Math.min(Math.max(xPx, 0), maxX);
    const clampedY = Math.min(Math.max(yPx, 0), maxY);
    const nextX = (clampedX / floorRect.width) * 100;
    const nextY = (clampedY / floorRect.height) * 100;

    if (Math.abs(event.clientX - activeTableDrag.startX) > 4 || Math.abs(event.clientY - activeTableDrag.startY) > 4) {
        activeTableDrag.moved = true;
    }

    tableElement.style.left = `${nextX}%`;
    tableElement.style.top = `${nextY}%`;

    const table = restaurantTables.find(item => item.id === activeTableDrag.id);
    if (table) {
        table.x = Number(nextX.toFixed(2));
        table.y = Number(nextY.toFixed(2));
    }
}

async function endTableDrag(event) {
    if (!activeTableDrag || activeTableDrag.pointerId !== event.pointerId) return;

    const tableElement = event.currentTarget;
    const table = restaurantTables.find(item => item.id === activeTableDrag.id);
    const moved = activeTableDrag.moved;

    tableElement.classList.remove("dragging");
    tableElement.removeEventListener("pointermove", moveTableDrag);
    tableElement.removeEventListener("pointerup", endTableDrag);
    tableElement.removeEventListener("pointercancel", endTableDrag);
    activeTableDrag = null;

    if (moved) {
        suppressTableClickUntil = Date.now() + 300;
    }

    if (!table || !moved) return;

    try {
        await fetch(apiUrl(`/api/tables/${table.id}`), {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({x: table.x, y: table.y})
        });
    } catch (error) {
        await loadTables();
    }
}

function openTableFromPlan(event, table) {
    if (Date.now() < suppressTableClickUntil) {
        event.preventDefault();
        return;
    }

    document.getElementById("tableSelect").value = String(table.table_number);
    showScreen("pos", document.querySelector('[data-title="cash_register"]'));
}

async function loadReports() {
    const dateInput = document.getElementById("reportDate");
    if (!dateInput.value) {
        dateInput.value = new Date().toISOString().slice(0, 10);
    }

    let report;
    try {
        const response = await fetch(apiUrl(`/api/reports/summary?day=${encodeURIComponent(dateInput.value)}`));
        if (!response.ok) throw new Error("Reports API failed");
        report = await response.json();
    } catch (error) {
        setMessage(document.getElementById("reportCards"), t("api_unavailable"));
        setMessage(document.getElementById("topProducts"), t("api_unavailable"));
        return;
    }
    const totals = report.totals;

    document.getElementById("reportCards").innerHTML = `
        <div class="report-card"><span>${t("gross_sales")}</span><strong>${money(totals.gross_sales)}</strong></div>
        <div class="report-card"><span>${t("paid_sales")}</span><strong>${money(totals.paid_sales)}</strong></div>
        <div class="report-card"><span>${t("open_total")}</span><strong>${money(totals.open_total)}</strong></div>
        <div class="report-card"><span>${t("orders_count")}</span><strong>${totals.orders_count}</strong></div>
    `;

    const topProducts = document.getElementById("topProducts");
    if (report.top_products.length === 0) {
        setMessage(topProducts, t("no_products"));
        return;
    }

    topProducts.innerHTML = `
        <table class="report-table">
            <thead>
                <tr><th>${t("items")}</th><th>Qty</th><th>${t("total")}</th></tr>
            </thead>
            <tbody>
                ${report.top_products.map(product => `
                    <tr>
                        <td>${product.product_name}</td>
                        <td>${product.quantity}</td>
                        <td>${money(product.total)}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;
}

function updateScreenTitle() {
    const titleMap = {
        pos: "cash_register",
        tables: "tables",
        orders: "orders",
        reports: "reports"
    };
    const screenTitle = document.getElementById("screenTitle");
    screenTitle.textContent = t(titleMap[currentScreen]);
}

function showScreen(screenName, button) {
    currentScreen = screenName;

    document.querySelectorAll(".nav-button").forEach(navButton => navButton.classList.remove("active"));
    if (button) button.classList.add("active");

    document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("active-screen"));
    document.getElementById(`${screenName}Screen`).classList.add("active-screen");

    updateScreenTitle();

    if (screenName === "tables") loadTables();
    if (screenName === "orders") loadOrders();
    if (screenName === "reports") loadReports();
}

async function init() {
    buildTableSelect();
    const reportDate = document.getElementById("reportDate");
    reportDate.value = new Date().toISOString().slice(0, 10);

    await loadProducts();
    await Promise.allSettled([loadOrders(), loadTables(), loadReports()]);
    applyLanguage();
    renderCart();
}

init();
