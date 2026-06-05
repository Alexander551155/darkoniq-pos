let products = [];
let selectedCategory = "All";
let cart = [];
let lastOrderId = null;
let currentScreen = "pos";
let currentTableZone = "Innenbereich";
let currentServiceZone = "Innenbereich";
let restaurantTables = [];
let menuPath = [];
let pendingModifierProduct = null;
let tableRefreshTimer = null;
let activeTableDrag = null;
let suppressTableClickUntil = 0;
let authToken = localStorage.getItem("darkoniq_token") || "";
let currentUser = JSON.parse(localStorage.getItem("darkoniq_user") || "null");

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
    {id: 12, name: "Tiramisu", category: "Dessert", price: 5.50},
    {id: 13, name: "Schnitzel Wiener Art", category: "Food", price: 14.90},
    {id: 14, name: "Rumpsteak", category: "Food", price: 24.90},
    {id: 15, name: "Hausgemachte Limonade", category: "Drinks", price: 4.50},
    {id: 16, name: "Pils", category: "Drinks", price: 4.20},
    {id: 17, name: "Weisswein", category: "Drinks", price: 5.80}
];

const menuTree = {
    label: "Menü",
    children: [
        {key: "drinks", label: "Getränke", children: [
            {key: "coffee", label: "Kaffee"},
            {key: "alcohol_free", label: "Alkoholfrei"},
            {key: "alcohol", label: "Alkoholisch"}
        ]},
        {key: "food", label: "Essen", children: [
            {key: "main", label: "Hauptgerichte"},
            {key: "pizza", label: "Pizza"},
            {key: "salad", label: "Salat"},
            {key: "sides", label: "Beilagen"}
        ]},
        {key: "dessert", label: "Dessert"}
    ]
};

const sideOptions = [
    "Keine Beilage",
    "Pommes Frites",
    "Bratkartoffeln",
    "Kartoffelsalat",
    "Reis",
    "Gemüse"
];

const translations = {
    de: {
        cash_register: "Kasse",
        tables: "Tische",
        orders: "Bestellungen",
        reports: "Berichte",
        users: "Benutzer",
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
        users_hint: "Accounts fuer Admin und Service verwalten",
        create_user: "Benutzer erstellen",
        existing_users: "Bestehende Benutzer",
        user_created: "Benutzer wurde erstellt.",
        user_create_error: "Benutzer konnte nicht erstellt werden.",
        username_exists: "Login existiert bereits.",
        delete_user: "Löschen",
        delete_user_confirm: "Diesen Benutzer löschen?",
        delete_user_error: "Benutzer konnte nicht gelöscht werden.",
        delete_self_error: "Du kannst deinen eigenen Account nicht löschen.",
        delete_last_admin_error: "Der letzte Admin kann nicht gelöscht werden.",
        password_label: "Passwort",
        active_table: "Aktiver Tisch",
        current_order: "Aktuelle Bestellung",
        tables_overview: "Übersicht Tische",
        tables_online_hint: "Live Status und Sitzdauer",
        occupied_since: "seit",
        guests_waiting: "Gäste sitzen",
        back: "Zurück",
        kitchen_options: "Küchenoptionen",
        add_to_order: "Zur Bestellung",
        kitchen_note: "Küche",
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
        table_manager: "Tische verwalten",
        table_manager_hint: "Antippen zeigt den Tisch auf der Karte",
        show_on_plan: "Anzeigen",
        no_tables_in_zone: "Keine Tische in diesem Bereich",
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

function parseDateTime(value) {
    if (!value) return null;
    return new Date(String(value).replace(" ", "T"));
}

function formatDuration(firstOrderAt) {
    const startedAt = parseDateTime(firstOrderAt);
    if (!startedAt || Number.isNaN(startedAt.getTime())) return "0 min";

    const minutes = Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 60000));
    if (minutes < 60) return `${minutes} min`;

    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return `${hours}h ${restMinutes}m`;
}

function cartTotal() {
    return cart.reduce((sum, item) => sum + item.quantity * item.price, 0);
}

function cartCount() {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
}

function setMessage(element, message) {
    element.innerHTML = `<div class="empty-state">${message}</div>`;
}

function openCartPanel() {
    document.body.classList.add("cart-open");
}

function closeCartPanel() {
    document.body.classList.remove("cart-open");
}

function apiUrl(path) {
    return `${API_BASE}${path}`;
}

async function authFetch(path, options = {}) {
    const headers = {
        ...(options.headers || {}),
        ...(authToken ? {Authorization: `Bearer ${authToken}`} : {})
    };

    const response = await fetch(apiUrl(path), {
        ...options,
        headers
    });

    if (response.status === 401) {
        clearSession();
        showLogin();
    }

    return response;
}

function getCurrentRole() {
    return String(currentUser?.role || "").trim().toLowerCase();
}

function isAdmin() {
    return getCurrentRole() === "admin";
}

function clearSession() {
    authToken = "";
    currentUser = null;
    localStorage.removeItem("darkoniq_token");
    localStorage.removeItem("darkoniq_user");
}

function showLogin(message = "") {
    document.getElementById("loginScreen").classList.remove("hidden");
    document.querySelector(".app").classList.add("app-locked");
    document.getElementById("loginError").textContent = message;
}

function hideLogin() {
    document.getElementById("loginScreen").classList.add("hidden");
    document.querySelector(".app").classList.remove("app-locked");
}

async function login(event) {
    event.preventDefault();
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;
    const loginError = document.getElementById("loginError");
    loginError.textContent = "";

    try {
        const response = await fetch(apiUrl("/api/login"), {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({username, password})
        });

        if (!response.ok) {
            loginError.textContent = "Login fehlgeschlagen.";
            return;
        }

        const result = await response.json();
        authToken = result.token;
        currentUser = result.user;
        localStorage.setItem("darkoniq_token", authToken);
        localStorage.setItem("darkoniq_user", JSON.stringify(currentUser));
        await startApp();
    } catch (error) {
        loginError.textContent = "Server nicht erreichbar.";
    }
}

async function logout() {
    if (authToken) {
        try {
            await authFetch("/api/logout", {method: "POST"});
        } catch (error) {
            // Local logout still matters if the network is unavailable.
        }
    }
    clearSession();
    showLogin();
}

function applyRoleAccess() {
    document.body.dataset.role = getCurrentRole();
    document.querySelectorAll(".admin-only").forEach(element => {
        element.classList.toggle("hidden", !isAdmin());
    });

    if (!isAdmin() && (currentScreen === "orders" || currentScreen === "reports" || currentScreen === "users")) {
        showScreen("pos", document.querySelector('[data-title="cash_register"]'));
    }
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
    if (!tableSelect) return;
    const selectedValue = tableSelect.value || "1";
    const sourceTables = restaurantTables.length > 0
        ? restaurantTables
        : Array.from({length: 12}, (_, index) => ({table_number: index + 1}));
    tableSelect.innerHTML = "";

    sourceTables.forEach(table => {
        const option = document.createElement("option");
        option.value = String(table.table_number);
        option.textContent = table.status
            ? `${t("table")} ${table.table_number} · ${t(table.status)} · ${money(table.total)}${table.first_order_at ? ` · ${formatDuration(table.first_order_at)}` : ""}`
            : `${t("table")} ${table.table_number}`;
        tableSelect.appendChild(option);
    });

    if ([...tableSelect.options].some(option => option.value === selectedValue)) {
        tableSelect.value = selectedValue;
    } else if (tableSelect.options.length > 0) {
        tableSelect.value = tableSelect.options[0].value;
    }

    syncActiveTableUi();
    renderQuickTables();
}

async function loadProducts() {
    const productsDiv = document.getElementById("products");

    try {
        const response = await authFetch("/api/products");
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

    const node = getMenuNode(menuPath);
    const children = node?.children || [];
    categoriesDiv.innerHTML = "";

    if (menuPath.length > 0) {
        const backButton = document.createElement("button");
        backButton.className = "category-button back-button";
        backButton.textContent = `‹ ${t("back")}`;
        backButton.onclick = () => {
            menuPath = menuPath.slice(0, -1);
            renderCategories();
            renderProducts();
        };
        categoriesDiv.appendChild(backButton);
    }

    children.forEach(child => {
        const button = document.createElement("button");
        button.className = "category-button";
        button.textContent = child.label;
        button.onclick = () => {
            menuPath = [...menuPath, child.key];
            renderCategories();
            renderProducts();
        };
        categoriesDiv.appendChild(button);
    });

    renderMenuBreadcrumbs();
}

function renderProducts() {
    const productsDiv = document.getElementById("products");
    if (!productsDiv) return;

    productsDiv.innerHTML = "";

    const node = getMenuNode(menuPath);
    if (node?.children?.length) {
        node.children.forEach(child => {
            const card = document.createElement("button");
            card.className = "menu-tile";
            card.type = "button";
            card.innerHTML = `<strong>${child.label}</strong><span>öffnen</span>`;
            card.onclick = () => {
                menuPath = [...menuPath, child.key];
                renderCategories();
                renderProducts();
            };
            productsDiv.appendChild(card);
        });
        return;
    }

    const filteredProducts = products.filter(product => productMatchesPath(product, menuPath));
    if (filteredProducts.length === 0) {
        setMessage(productsDiv, t("no_products"));
        return;
    }

    filteredProducts.forEach(product => {
        const card = document.createElement("button");
        card.className = "product-card";
        card.type = "button";
        card.innerHTML = `
            <div class="product-info">
                <h3>${product.name}</h3>
                <span>${getProductGroupLabel(product)}</span>
            </div>
            <strong class="product-price">${money(product.price)}</strong>
        `;
        card.onclick = () => addToCart(product);
        productsDiv.appendChild(card);
    });
}

function getMenuNode(path) {
    return path.reduce((node, key) => node?.children?.find(child => child.key === key), menuTree);
}

function renderMenuBreadcrumbs() {
    const breadcrumbs = document.getElementById("menuBreadcrumbs");
    if (!breadcrumbs) return;

    const labels = [];
    let node = menuTree;
    menuPath.forEach(key => {
        node = node?.children?.find(child => child.key === key);
        if (node) labels.push(node.label);
    });
    breadcrumbs.textContent = labels.length ? labels.join(" / ") : "Menü";
}

function normalizedName(product) {
    return `${product.category} ${product.name}`.toLowerCase();
}

function getProductGroup(product) {
    const name = normalizedName(product);
    if (product.category === "Coffee" || /espresso|cappuccino|latte|americano/.test(name)) return "coffee";
    if (/beer|pils|wein|wine|rotwein|weisswein/.test(name)) return "alcohol";
    if (product.category === "Drinks") return "alcohol_free";
    if (/pizza/.test(name)) return "pizza";
    if (/salad|salat/.test(name)) return "salad";
    if (/pommes|bratkartoffeln|beilage/.test(name)) return "sides";
    if (product.category === "Dessert") return "dessert";
    if (product.category === "Food") return "main";
    return "alcohol_free";
}

function getProductGroupLabel(product) {
    const group = getProductGroup(product);
    const labels = {
        coffee: "Kaffee",
        alcohol_free: "Alkoholfrei",
        alcohol: "Alkoholisch",
        main: "Hauptgerichte",
        pizza: "Pizza",
        salad: "Salat",
        sides: "Beilagen",
        dessert: "Dessert"
    };
    return labels[group] || product.category;
}

function productMatchesPath(product, path) {
    const group = getProductGroup(product);
    const root = path[0];
    const leaf = path[path.length - 1];

    if (!root) return false;
    if (root === "drinks") return ["coffee", "alcohol_free", "alcohol"].includes(group) && (path.length === 1 || group === leaf);
    if (root === "food") return ["main", "pizza", "salad", "sides"].includes(group) && (path.length === 1 || group === leaf);
    if (root === "dessert") return group === "dessert";
    return false;
}

function addToCart(product) {
    if (needsKitchenOptions(product)) {
        openModifierModal(product);
        return;
    }

    addCartLine(product, "");
}

function addCartLine(product, note = "") {
    const cleanNote = note.trim();
    const existingItem = cart.find(item => item.product_name === product.name && item.note === cleanNote && item.price === product.price);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            product_name: product.name,
            quantity: 1,
            price: product.price,
            note: cleanNote
        });
    }

    renderCart();
}

function needsKitchenOptions(product) {
    return product.category === "Food" && getProductGroup(product) !== "sides";
}

function openModifierModal(product) {
    pendingModifierProduct = product;
    const modal = document.getElementById("modifierModal");
    const title = document.getElementById("modifierProductName");
    const sideSelect = document.getElementById("modifierSide");
    const noteInput = document.getElementById("modifierNote");
    if (!modal || !title || !sideSelect || !noteInput) return;

    title.textContent = `${product.name} · ${money(product.price)}`;
    sideSelect.innerHTML = sideOptions.map(option => `<option value="${option}">${option}</option>`).join("");
    noteInput.value = "";
    modal.classList.remove("hidden");
}

function closeModifierModal() {
    pendingModifierProduct = null;
    document.getElementById("modifierModal")?.classList.add("hidden");
}

function appendKitchenNote(text) {
    const noteInput = document.getElementById("modifierNote");
    if (!noteInput) return;

    const parts = noteInput.value
        .split(",")
        .map(part => part.trim())
        .filter(Boolean);
    if (!parts.includes(text)) parts.push(text);
    noteInput.value = parts.join(", ");
}

function confirmModifierProduct() {
    if (!pendingModifierProduct) return;

    const side = document.getElementById("modifierSide")?.value || "";
    const kitchenNote = document.getElementById("modifierNote")?.value.trim() || "";
    const noteParts = [];
    if (side && side !== "Keine Beilage") noteParts.push(`Beilage: ${side}`);
    if (kitchenNote) noteParts.push(kitchenNote);

    addCartLine(pendingModifierProduct, noteParts.join("; "));
    closeModifierModal();
}

function changeQuantity(index, delta) {
    const item = cart[index];
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
        cart.splice(index, 1);
    }

    renderCart();
}

function renderCart() {
    const cartItemsDiv = document.getElementById("cartItems");
    const totalElement = document.getElementById("total");
    if (!cartItemsDiv || !totalElement) return;

    cartItemsDiv.innerHTML = "";
    let total = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.quantity * item.price;
        total += itemTotal;

        const div = document.createElement("div");
        div.className = "cart-item";
        div.innerHTML = `
            <div>
                <strong>${item.quantity}x ${item.product_name}</strong>
                <span>${money(item.price)} / ${money(itemTotal)}</span>
                ${item.note ? `<small>${t("kitchen_note")}: ${item.note}</small>` : ""}
            </div>
            <div class="quantity-actions">
                <button onclick="changeQuantity(${index}, -1)">-</button>
                <button onclick="changeQuantity(${index}, 1)">+</button>
            </div>
        `;
        cartItemsDiv.appendChild(div);
    });

    if (cart.length === 0) {
        setMessage(cartItemsDiv, t("cart_empty"));
    }

    totalElement.textContent = money(total);
    updateMobileCartButton(total);
    updateServiceCartSummary(total);
}

function updateMobileCartButton(total = 0) {
    const countElement = document.getElementById("mobileCartCount");
    const totalButtonElement = document.getElementById("mobileCartTotal");
    const mobileCartButton = document.getElementById("mobileCartButton");
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (countElement) countElement.textContent = String(itemCount);
    if (totalButtonElement) totalButtonElement.textContent = money(total);
    if (mobileCartButton) mobileCartButton.classList.toggle("has-items", itemCount > 0);
}

function updateServiceCartSummary(total = cartTotal()) {
    const totalElement = document.getElementById("serviceCartTotal");
    const countElement = document.getElementById("serviceCartCount");
    const count = cartCount();

    if (totalElement) totalElement.textContent = money(total);
    if (countElement) countElement.textContent = `${count} ${count === 1 ? "Position" : "Positionen"}`;
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
        response = await authFetch("/api/orders", {
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
    closeCartPanel();

    const refreshTasks = [loadTables()];
    if (isAdmin()) {
        refreshTasks.push(loadOrders(), loadReports());
    }
    await Promise.allSettled(refreshTasks);
}

async function printOrder(orderId) {
    let response;
    try {
        response = await authFetch(`/api/orders/${orderId}/print`, {method: "POST"});
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
        response = await authFetch(`/api/orders/${orderId}/status`, {
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
        const response = await authFetch(url);
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
            .map(item => `${item.quantity}x ${item.product_name}${item.note ? ` (${item.note})` : ""}`)
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
        const response = await authFetch("/api/tables");
        if (!response.ok) throw new Error("Tables API failed");
        restaurantTables = await response.json();
    } catch (error) {
        setMessage(tablesGrid, t("api_unavailable"));
        return;
    }

    buildTableSelect();
    renderTables();
    renderTableManager();
    syncActiveTableUi();
    renderQuickTables();
}

function getSelectedTable() {
    const tableNumber = Number(document.getElementById("tableSelect")?.value || 0);
    return restaurantTables.find(table => table.table_number === tableNumber) || null;
}

function syncActiveTableUi() {
    const tableSelect = document.getElementById("tableSelect");
    const activeTableLabel = document.getElementById("activeTableLabel");
    const activeTableStatus = document.getElementById("activeTableStatus");
    const selectedTable = getSelectedTable();
    const selectedNumber = tableSelect?.value || "1";

    if (selectedTable && selectedTable.zone !== currentServiceZone) {
        currentServiceZone = selectedTable.zone;
        syncServiceZoneButtons();
    }

    if (activeTableLabel) activeTableLabel.textContent = `${t("table")} ${selectedNumber}`;
    if (activeTableStatus) {
        activeTableStatus.textContent = selectedTable
            ? `${t(selectedTable.status)} · ${money(selectedTable.total)}${selectedTable.first_order_at ? ` · ${formatDuration(selectedTable.first_order_at)}` : ""}`
            : t("free");
    }

    renderQuickTables();
}

function selectTable(tableNumber) {
    const tableSelect = document.getElementById("tableSelect");
    if (!tableSelect) return;
    tableSelect.value = String(tableNumber);
    syncActiveTableUi();
}

function switchServiceZone(zone, button) {
    currentServiceZone = zone;
    syncServiceZoneButtons();
    if (button) button.classList.add("active");
    renderQuickTables();
}

function syncServiceZoneButtons() {
    document.querySelectorAll(".service-zone-button").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.serviceZone === currentServiceZone);
    });
}

function renderQuickTables() {
    const quickTables = document.getElementById("quickTables");
    const tableSelect = document.getElementById("tableSelect");
    if (!quickTables || !tableSelect) return;

    const selectedTableNumber = Number(tableSelect.value || 0);
    const zoneTables = restaurantTables
        .filter(table => table.zone === currentServiceZone)
        .sort((a, b) => a.table_number - b.table_number);

    quickTables.innerHTML = zoneTables.map(table => `
        <button class="quick-table-chip ${table.status} ${table.table_number === selectedTableNumber ? "active" : ""}"
                type="button"
                onclick="selectTable(${table.table_number})">
            <strong>${table.table_number}</strong>
            <span>${t(table.status)}</span>
            <em>${table.first_order_at ? formatDuration(table.first_order_at) : money(table.total)}</em>
        </button>
    `).join("");
    renderLiveTablesOverview();
}

function renderLiveTablesOverview() {
    const overview = document.getElementById("liveTablesOverview");
    if (!overview) return;

    overview.innerHTML = restaurantTables
        .slice()
        .sort((a, b) => a.table_number - b.table_number)
        .map(table => `
            <button class="live-table-card ${table.status}" type="button" onclick="selectTable(${table.table_number})">
                <strong>${table.table_number}</strong>
                <span>${t(table.status)}</span>
                <em>${table.status === "busy" ? formatDuration(table.first_order_at) : "0 min"}</em>
                <small>${money(table.total)}</small>
            </button>
        `).join("");
}

function tableCoordinate(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : fallback;
}

function syncFloorLayerHeight(layer, floorPlan, tables) {
    if (!layer || !floorPlan) return 0;

    const baseHeight = floorPlan.clientHeight || 680;
    const maxY = tables.reduce((max, table) => Math.max(max, tableCoordinate(table.y)), 0);
    const neededHeight = Math.max(baseHeight, Math.round((maxY / 100) * baseHeight + 150));
    layer.style.height = `${neededHeight}px`;
    return baseHeight;
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
    const baseHeight = syncFloorLayerHeight(layer, floorPlan, visibleTables) || 680;

    visibleTables.forEach(table => {

        const card = document.createElement("div");
        card.className = `floor-table ${table.status}`;
        card.setAttribute("role", "button");
        card.tabIndex = 0;
        card.style.left = `${Math.min(tableCoordinate(table.x), 100)}%`;
        card.style.top = `${(tableCoordinate(table.y) / 100) * baseHeight}px`;
        card.dataset.tableId = String(table.id);
        card.dataset.tableNumber = String(table.table_number);
        card.innerHTML = `
            <button class="delete-table-button admin-only" type="button" title="${t("delete_table")}">×</button>
            <span class="table-status-dot"></span>
            <strong>${t("table")} ${table.table_number}</strong>
            <small>${table.seats} ${t("seats")} · ${table.zone}</small>
            <em>${t(table.status)} · ${money(table.total)}</em>
        `;
        const deleteButton = card.querySelector(".delete-table-button");
        deleteButton.classList.toggle("hidden", !isAdmin());
        deleteButton.addEventListener("pointerdown", event => event.stopPropagation());
        deleteButton.addEventListener("click", event => {
            event.stopPropagation();
            deleteTable(table);
        });
        if (isAdmin()) {
            card.addEventListener("pointerdown", event => startTableDrag(event, table));
        }
        card.addEventListener("click", event => openTableFromPlan(event, table));
        layer.appendChild(card);
    });
}

function renderTableManager() {
    const list = document.getElementById("tableManagerList");
    const count = document.getElementById("tableManagerCount");
    if (!list) return;

    const zoneTables = restaurantTables
        .filter(table => table.zone === currentTableZone)
        .sort((a, b) => a.table_number - b.table_number);

    if (count) count.textContent = String(zoneTables.length);

    if (zoneTables.length === 0) {
        setMessage(list, t("no_tables_in_zone"));
        return;
    }

    list.innerHTML = zoneTables.map(table => `
        <div class="table-manager-row ${table.status}">
            <button class="table-manager-focus" type="button" onclick="focusTableOnPlan(${table.id})">
                <strong>${t("table")} ${table.table_number}</strong>
                <span>${table.seats} ${t("seats")} · ${t(table.status)} · y ${Number(table.y).toFixed(0)}</span>
            </button>
            <button class="delete-table-button list-delete-button" type="button" onclick="deleteTableById(${table.id})" title="${t("delete_table")}">×</button>
        </div>
    `).join("");
}

function syncTableZoneButtons() {
    document.querySelectorAll(".zone-tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.tableZone === currentTableZone);
    });
}

function focusTableOnPlan(tableId) {
    const table = restaurantTables.find(item => item.id === tableId);
    if (!table) return;

    if (table.zone !== currentTableZone) {
        currentTableZone = table.zone;
        syncTableZoneButtons();
        renderTables();
        renderTableManager();
    }

    const floorPlan = document.getElementById("floorPlan");
    const card = document.querySelector(`.floor-table[data-table-id="${tableId}"]`);
    if (!floorPlan || !card) return;

    floorPlan.scrollTo({
        top: Math.max(0, card.offsetTop - 24),
        behavior: "smooth"
    });
    card.classList.add("spotlight");
    window.setTimeout(() => card.classList.remove("spotlight"), 1200);
}

function switchTableZone(zone) {
    currentTableZone = zone;
    syncTableZoneButtons();
    renderTables();
    renderTableManager();
}

async function createTable(zone = currentTableZone) {
    if (!isAdmin()) return;

    try {
        const response = await authFetch("/api/tables", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({seats: 2, zone})
        });
        if (!response.ok) throw new Error("Create table failed");
        const table = await response.json();
        restaurantTables.push(table);
        buildTableSelect();
        renderTables();
        renderTableManager();
        focusTableOnPlan(table.id);
    } catch (error) {
        alert(t("api_unavailable"));
    }
}

function deleteTableById(tableId) {
    const table = restaurantTables.find(item => item.id === tableId);
    if (table) deleteTable(table);
}

async function deleteTable(table) {
    if (!isAdmin()) return;

    if (!confirm(t("delete_confirm"))) return;

    try {
        const response = await authFetch(`/api/tables/${table.id}`, {
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
        renderTableManager();
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
    const baseWidth = floorRect.width || 1;
    const baseHeight = floorPlan.clientHeight || floorRect.height || 1;
    const tableWidth = tableElement.offsetWidth;
    const tableHeight = tableElement.offsetHeight;

    const xPx = event.clientX - floorRect.left - activeTableDrag.offsetX;
    const yPx = event.clientY - floorRect.top - activeTableDrag.offsetY + floorPlan.scrollTop;
    const maxX = Math.max(0, baseWidth - tableWidth);
    const maxY = Math.max(0, floorPlan.scrollHeight - tableHeight);
    const clampedX = Math.min(Math.max(xPx, 0), maxX);
    const clampedY = Math.min(Math.max(yPx, 0), maxY);
    const nextX = (clampedX / baseWidth) * 100;
    const nextY = (clampedY / baseHeight) * 100;

    if (Math.abs(event.clientX - activeTableDrag.startX) > 4 || Math.abs(event.clientY - activeTableDrag.startY) > 4) {
        activeTableDrag.moved = true;
    }

    tableElement.style.left = `${nextX}%`;
    tableElement.style.top = `${clampedY}px`;

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
        await authFetch(`/api/tables/${table.id}`, {
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

    currentServiceZone = table.zone;
    syncServiceZoneButtons();
    selectTable(table.table_number);
    showScreen("pos", document.querySelector('[data-title="cash_register"]'));
}

async function loadUsers() {
    if (!isAdmin()) return;

    const usersList = document.getElementById("usersList");
    if (!usersList) return;

    try {
        const response = await authFetch("/api/users");
        if (!response.ok) throw new Error("Users API failed");
        const users = await response.json();
        usersList.innerHTML = users.map(user => `
            <div class="user-card">
                <div>
                    <strong>${user.display_name}</strong>
                    <span>${user.username}</span>
                    <code>${t("password_label")}: ${user.password_plain || "nicht gespeichert"}</code>
                </div>
                <div class="user-card-actions">
                    <em>${user.role}</em>
                    <button class="delete-user-button" type="button" onclick="deleteUser(${user.id})">${t("delete_user")}</button>
                </div>
            </div>
        `).join("");
    } catch (error) {
        setMessage(usersList, t("api_unavailable"));
    }
}

function setNewUserRole(role, button) {
    document.getElementById("newRole").value = role;
    document.querySelectorAll(".role-choice").forEach(choice => choice.classList.remove("active"));
    button.classList.add("active");
}

function generateUserPassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let password = "";
    for (let index = 0; index < 10; index += 1) {
        password += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    document.getElementById("newPassword").value = password;
}

async function createUser(event) {
    event.preventDefault();

    const message = document.getElementById("userFormMessage");
    const displayName = document.getElementById("newDisplayName").value.trim();
    const username = document.getElementById("newUsername").value.trim();
    const password = document.getElementById("newPassword").value;
    const role = document.getElementById("newRole").value;
    message.textContent = "";

    try {
        const response = await authFetch("/api/users", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                display_name: displayName,
                username,
                password,
                role
            })
        });

        if (response.status === 409) {
            message.textContent = t("username_exists");
            return;
        }

        if (!response.ok) {
            message.textContent = t("user_create_error");
            return;
        }

        event.target.reset();
        document.getElementById("newRole").value = "waiter";
        document.querySelectorAll(".role-choice").forEach(choice => {
            choice.classList.toggle("active", choice.textContent.trim() === "Service");
        });
        message.textContent = t("user_created");
        await loadUsers();
    } catch (error) {
        message.textContent = t("api_unavailable");
    }
}

async function deleteUser(userId) {
    if (!confirm(t("delete_user_confirm"))) return;

    const message = document.getElementById("userFormMessage");
    message.textContent = "";

    try {
        const response = await authFetch(`/api/users/${userId}`, {
            method: "DELETE"
        });

        if (response.status === 400) {
            message.textContent = t("delete_self_error");
            return;
        }

        if (response.status === 409) {
            message.textContent = t("delete_last_admin_error");
            return;
        }

        if (!response.ok) {
            message.textContent = t("delete_user_error");
            return;
        }

        await loadUsers();
    } catch (error) {
        message.textContent = t("api_unavailable");
    }
}

async function loadReports() {
    const dateInput = document.getElementById("reportDate");
    if (!dateInput.value) {
        dateInput.value = new Date().toISOString().slice(0, 10);
    }

    let report;
    try {
        const response = await authFetch(`/api/reports/summary?day=${encodeURIComponent(dateInput.value)}`);
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
        reports: "reports",
        users: "users"
    };
    const screenTitle = document.getElementById("screenTitle");
    screenTitle.textContent = t(titleMap[currentScreen]);
}

function startLiveTableTimer() {
    if (tableRefreshTimer) return;

    tableRefreshTimer = window.setInterval(() => {
        renderQuickTables();
        syncActiveTableUi();
        renderLiveTablesOverview();
    }, 60000);
}

function showScreen(screenName, button) {
    if (!isAdmin() && (screenName === "orders" || screenName === "reports" || screenName === "users")) {
        screenName = "pos";
        button = document.querySelector('[data-title="cash_register"]');
    }

    currentScreen = screenName;
    document.body.dataset.screen = currentScreen;

    document.querySelectorAll(".nav-button").forEach(navButton => navButton.classList.remove("active"));
    if (button) button.classList.add("active");
    document.querySelectorAll(".mobile-nav-button, .mobile-admin-button").forEach(navButton => navButton.classList.remove("active"));
    document.querySelectorAll(`[data-mobile-screen="${screenName}"]`).forEach(navButton => navButton.classList.add("active"));

    document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("active-screen"));
    document.getElementById(`${screenName}Screen`).classList.add("active-screen");
    closeCartPanel();

    updateScreenTitle();

    if (screenName === "tables") loadTables();
    if (screenName === "orders") loadOrders();
    if (screenName === "reports") loadReports();
    if (screenName === "users") loadUsers();
}

async function startApp() {
    hideLogin();
    document.body.dataset.screen = currentScreen;
    applyRoleAccess();
    buildTableSelect();
    const reportDate = document.getElementById("reportDate");
    reportDate.value = new Date().toISOString().slice(0, 10);

    await loadProducts();
    const startupTasks = [loadTables()];
    if (isAdmin()) {
        startupTasks.push(loadOrders(), loadReports(), loadUsers());
    }
    await Promise.allSettled(startupTasks);
    applyLanguage();
    applyRoleAccess();
    renderCart();
    startLiveTableTimer();
}

async function bootstrap() {
    if (!authToken) {
        showLogin();
        return;
    }

    try {
        const response = await authFetch("/api/me");
        if (!response.ok) {
            showLogin();
            return;
        }
        currentUser = await response.json();
        localStorage.setItem("darkoniq_user", JSON.stringify(currentUser));
        await startApp();
    } catch (error) {
        showLogin("Server nicht erreichbar.");
    }
}

bootstrap();
