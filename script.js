// =====================================================================
//  BUDGET APP
//  Sections:
//   1. Small helpers          6. Category popup + transactions
//   2. Data + saving          7. Income popup
//   3. Budget / spending      8. Entry popup (the + button)
//      calculations           9. Small popup (sheet) for editing numbers
//   4. Month navigation      10. Statistics + trend chart
//   5. Budget page           11. Savings page
//                            12. Popups + back button / pages / start
// =====================================================================


// =====================================================================
// 1. SMALL HELPERS
// =====================================================================

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// shortcut for document.getElementById
function byId(id) {
    return document.getElementById(id);
}

// shortcut: make an element, optionally with a class and some text
function el(tag, className, text) {
    let element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

// today as text, e.g. "2026-10-10" (uses the LOCAL date, not UTC)
function todayString() {
    let now = new Date();
    return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
}

// current month as text, e.g. "2026-10"
function currentMonth() {
    return todayString().slice(0, 7);
}

// "2026-10" + 1 = "2026-11", "2026-01" - 1 = "2025-12"
function addMonths(month, amount) {
    let year = Number(month.split("-")[0]);
    let index = Number(month.split("-")[1]) - 1 + amount;
    year = year + Math.floor(index / 12);
    index = ((index % 12) + 12) % 12;
    return year + "-" + String(index + 1).padStart(2, "0");
}

// "2026-10" -> "October 2026"
function formatMonth(month) {
    return monthNames[Number(month.split("-")[1]) - 1] + " " + month.split("-")[0];
}

// "2026-10" -> "Oct"
function shortMonth(month) {
    return monthNames[Number(month.split("-")[1]) - 1].slice(0, 3);
}

// "2026-10-03" -> "Oct 3"
function formatDate(date) {
    let shortName = monthNames[Number(date.split("-")[1]) - 1].slice(0, 3);
    return shortName + " " + Number(date.split("-")[2]);
}

// 1234 -> "1 234€"
function euro(amount) {
    let rounded = Math.round(amount);
    let sign = rounded < 0 ? "-" : "";
    let digits = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return sign + digits + "€";
}

// how many % of the budget is used (a budget of 0 gives 0% or 100%)
function percentOf(spent, budget) {
    if (budget === 0) {
        return spent === 0 ? 0 : 100;
    }
    return Math.round(spent / budget * 100);
}

// a new unique number for a list (highest existing number + 1)
function nextId(list, field) {
    let highest = 0;
    for (let i = 0; i < list.length; i++) {
        if (list[i][field] > highest) highest = list[i][field];
    }
    return highest + 1;
}

// the last N months, oldest first, ending with the current month
function lastMonths(count) {
    let months = [];
    for (let i = count - 1; i >= 0; i--) {
        months.push(addMonths(currentMonth(), -i));
    }
    return months;
}

function average(values) {
    let sum = 0;
    for (let i = 0; i < values.length; i++) sum = sum + values[i];
    return sum / values.length;
}

function median(values) {
    let sorted = values.slice().sort(function(a, b) { return a - b; });
    let middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[middle - 1] + sorted[middle]) / 2;
    }
    return sorted[middle];
}


// =====================================================================
// 2. DATA + SAVING
// =====================================================================

// the categories. "budget" here is the starting budget, it can be
// changed for any month with "Edit budgets"
let categories = [
    {id: 1, name: "Groceries", budget: 100},
    {id: 2, name: "Eating out", budget: 0},
    {id: 3, name: "Coffee shops", budget: 15},
    {id: 4, name: "Alcohol", budget: 10},
    {id: 5, name: "Public transport", budget: 8},
    {id: 6, name: "Car/Bolt", budget: 5},
    {id: 7, name: "Hobbies", budget: 10},
    {id: 8, name: "Clothing", budget: 10},
    {id: 9, name: "Personal care", budget: 20},
    {id: 10, name: "Entertainment", budget: 25},
    {id: 11, name: "Home", budget: 10},
    {id: 12, name: "Gifts", budget: 20},
    {id: 13, name: "Health", budget: 0},
    {id: 14, name: "Misc", budget: 0}
];

function findCategory(id) {
    for (let i = 0; i < categories.length; i++) {
        if (categories[i].id === id) return categories[i];
    }
    return null;
}

// read something from the browser's storage (falls back if nothing / broken)
function loadData(key, fallback) {
    try {
        let text = localStorage.getItem(key);
        if (text) return JSON.parse(text);
    } catch (error) {
        console.log("Could not read " + key, error);
    }
    return fallback;
}

// write something to the browser's storage
function saveData(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.log("Could not save " + key, error);
    }
}

// expenses:  { trans, amount, date, description, categoryId }
let transactions = loadData("transactions", []);
// income:    { id, amount, date, description }
let incomes = loadData("incomes", []);
// budgets per month:  { "2026-10": { 1: 100, 2: 50 }, ... }
let budgets = loadData("budgets", {});
// savings funds:  { id, name, goal, saved }
let savings = loadData("savings", [
    {id: 1, name: "Emergency fund", goal: 1000, saved: 0},
    {id: 2, name: "Travel fund", goal: 500, saved: 0},
    {id: 3, name: "Fun fund", goal: 200, saved: 0}
]);

// what the app is currently showing
let selectMonth = currentMonth();
let currentPage = "budget";
let openCategoryId = null;
let statMode = "average";
let trendSelected = null;
let entryType = "expense";
let editing = null;      // null = the entry popup adds something new, otherwise {kind, id}
let layers = [];         // the popups that are open right now, bottom to top (see section 12)


// =====================================================================
// 3. BUDGET / SPENDING CALCULATIONS
// =====================================================================

// The budget of a category in a month. If you never set one for that
// month, the most recent earlier month you set is used. If you never
// set any, the starting budget from the category list is used.
function getBudget(categoryId, month) {
    let months = Object.keys(budgets).sort();
    let found = null;
    for (let i = 0; i < months.length; i++) {
        if (months[i] <= month && budgets[months[i]][categoryId] !== undefined) {
            found = budgets[months[i]][categoryId];
        }
    }
    if (found !== null) return found;
    return findCategory(categoryId).budget;
}

function setBudget(categoryId, month, amount) {
    if (!budgets[month]) budgets[month] = {};
    budgets[month][categoryId] = amount;
    saveData("budgets", budgets);
}

// euros spent in one category in one month
function spentMoney(categoryId, month) {
    let total = 0;
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].categoryId === categoryId && transactions[i].date.startsWith(month)) {
            total = total + transactions[i].amount;
        }
    }
    return total;
}

// euros spent in all categories in one month
function totalSpent(month) {
    let total = 0;
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].date.startsWith(month)) {
            total = total + transactions[i].amount;
        }
    }
    return total;
}

// income logged in one month
function monthIncome(month) {
    let total = 0;
    for (let i = 0; i < incomes.length; i++) {
        if (incomes[i].date.startsWith(month)) {
            total = total + incomes[i].amount;
        }
    }
    return total;
}

// all the category budgets of a month added up
function totalPlanned(month) {
    let total = 0;
    for (let i = 0; i < categories.length; i++) {
        total = total + getBudget(categories[i].id, month);
    }
    return total;
}

// The total budget of a month: your income if you logged any,
// otherwise the category budgets added up.
function totalBudget(month) {
    let income = monthIncome(month);
    if (income > 0) return income;
    return totalPlanned(month);
}


// =====================================================================
// 4. MONTH NAVIGATION
// =====================================================================

// the oldest month you can go to: 2 years back, or further if you have older data
function earliestMonth() {
    let earliest = addMonths(currentMonth(), -23);
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].date.slice(0, 7) < earliest) earliest = transactions[i].date.slice(0, 7);
    }
    for (let i = 0; i < incomes.length; i++) {
        if (incomes[i].date.slice(0, 7) < earliest) earliest = incomes[i].date.slice(0, 7);
    }
    return earliest;
}

// all months for the drop-down, newest first
function monthOptions() {
    let options = [];
    let month = currentMonth();
    let earliest = earliestMonth();
    while (month >= earliest) {
        options.push(month);
        month = addMonths(month, -1);
    }
    return options;
}

function changeMonth(amount) {
    let target = addMonths(selectMonth, amount);
    if (target > currentMonth() || target < earliestMonth()) return;
    selectMonth = target;
    byId("month-list").innerHTML = "";
    refresh();
}

byId("prev-month").addEventListener("click", function() { changeMonth(-1); });
byId("next-month").addEventListener("click", function() { changeMonth(1); });

byId("month-label").addEventListener("click", function() {
    let list = byId("month-list");

    // second click closes the list
    if (list.children.length > 0) {
        list.innerHTML = "";
        return;
    }

    let options = monthOptions();
    for (let i = 0; i < options.length; i++) {
        let month = options[i];
        let item = el("div", month === selectMonth ? "selected" : "", formatMonth(month));
        item.addEventListener("click", function() {
            selectMonth = month;
            list.innerHTML = "";
            refresh();
        });
        list.appendChild(item);
    }
});

// clicking anywhere outside the month bar closes the drop-down
document.addEventListener("click", function(event) {
    if (!event.target.closest("#month-wrap")) {
        byId("month-list").innerHTML = "";
    }
});


// =====================================================================
// 5. BUDGET PAGE
// =====================================================================

// a progress bar. style "goal" = green (savings), otherwise the red scale
function makebar(percent, style) {
    let capped = Math.min(Math.max(percent, 0), 100);

    let bar = el("div", "bar");
    let progress = el("div", "progress-bar");
    progress.style.width = capped + "%";

    if (style === "goal") {
        progress.style.backgroundColor = "var(--green)";
    } else {
        bar.style.backgroundColor = "hsl(0, 65%, 100%)";
        progress.style.backgroundColor = "hsl(0, 50%, " + (100 - capped * 0.6) + "%)";
    }

    bar.appendChild(progress);
    return bar;
}

// the "12€ / 100€" part: spent is bold, the budget is fainter and smaller
function makeAmounts(spent, budget) {
    let wrap = el("span", "amounts");
    wrap.appendChild(el("span", "spent", euro(spent)));
    wrap.appendChild(el("span", "of-budget", " / " + euro(budget)));
    return wrap;
}

function renderMonthBar() {
    byId("month-label").textContent = formatMonth(selectMonth);
    byId("prev-month").disabled = selectMonth <= earliestMonth();
    byId("next-month").disabled = selectMonth >= currentMonth();
}

function renderTotal() {
    let spent = totalSpent(selectMonth);
    let income = monthIncome(selectMonth);
    let budget = totalBudget(selectMonth);
    let percent = percentOf(spent, budget);

    byId("total-label").textContent = "Spent in " + formatMonth(selectMonth);
    byId("total-amount").textContent = euro(spent);
    byId("total-amount").className = spent > budget ? "over" : "";
    byId("total-of").textContent = income > 0 ? "of " + euro(income) + " income" : "of " + euro(budget) + " budgeted";
    byId("total-percent").textContent = percent + "%";

    byId("total-bar").innerHTML = "";
    byId("total-bar").appendChild(makebar(percent));
}

function renderCategories() {
    let container = byId("category-list");
    container.innerHTML = "";

    for (let i = 0; i < categories.length; i++) {
        let category = categories[i];
        let budget = getBudget(category.id, selectMonth);
        let spent = spentMoney(category.id, selectMonth);
        let percent = percentOf(spent, budget);

        let card = el("div", "card");
        card.appendChild(el("div", "card-name", category.name));

        let line = el("div", "card-line");
        line.appendChild(makeAmounts(spent, budget));
        line.appendChild(el("span", "card-percent", percent + "%"));
        card.appendChild(line);

        card.appendChild(makebar(percent));

        card.addEventListener("click", function() {
            openCategory(category.id);
        });

        container.appendChild(card);
    }
}

// "Edit budgets": one popup with every category's budget for this month
function editAllBudgets() {
    let fields = [];
    for (let i = 0; i < categories.length; i++) {
        fields.push({
            label: categories[i].name,
            name: categories[i].id,
            value: getBudget(categories[i].id, selectMonth)
        });
    }

    openSheet({
        title: "Budgets for " + formatMonth(selectMonth),
        confirmText: "Save budgets",
        fields: fields,
        onConfirm: function(values) {
            for (let i = 0; i < categories.length; i++) {
                setBudget(categories[i].id, selectMonth, values[categories[i].id]);
            }
        }
    });
}

byId("edit-budgets-button").addEventListener("click", editAllBudgets);


// =====================================================================
// 6. CATEGORY POPUP + TRANSACTIONS
// =====================================================================

function openCategory(categoryId) {
    openCategoryId = categoryId;
    openLayer("category");
    renderCategoryPopup();
}

function renderCategoryPopup() {
    let category = findCategory(openCategoryId);
    let budget = getBudget(category.id, selectMonth);
    let spent = spentMoney(category.id, selectMonth);
    let percent = percentOf(spent, budget);

    byId("category-title").textContent = category.name;

    byId("category-amounts").innerHTML = "";
    byId("category-amounts").appendChild(makeAmounts(spent, budget));
    byId("category-percent").textContent = percent + "%";

    byId("category-bar").innerHTML = "";
    byId("category-bar").appendChild(makebar(percent));

    // remaining box
    let remaining = budget - spent;
    byId("remaining-label").textContent = remaining < 0 ? "Over by" : "Remaining";
    byId("remaining-amount").textContent = euro(Math.abs(remaining));
    byId("remaining-box").className = remaining < 0 ? "over" : "";

    // message box (the texts live in messages.js)
    let year = Number(selectMonth.split("-")[0]);
    let monthNumber = Number(selectMonth.split("-")[1]);
    let daysInMonth = new Date(year, monthNumber, 0).getDate();
    let isPastMonth = selectMonth < currentMonth();
    let message = getMessage(spent, budget, new Date().getDate(), daysInMonth, isPastMonth);
    byId("category-message").className = "message " + message.color;
    byId("category-message-title").textContent = message.title;
    byId("category-message-text").textContent = message.text;

    showTransactions(category);
}

function showTransactions(category) {
    let list = byId("category-transactions");
    list.innerHTML = "";

    // newest first; for the same day, the one you added last first
    let sorted = transactions.slice();
    sorted.sort(function(a, b) {
        let byDate = b.date.localeCompare(a.date);
        if (byDate !== 0) return byDate;
        return b.trans - a.trans;
    });

    let count = 0;
    for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].categoryId === category.id && sorted[i].date.startsWith(selectMonth)) {
            list.appendChild(makeTransactionRow(sorted[i], "expense"));
            count++;
        }
    }

    if (count === 0) {
        list.appendChild(el("div", "empty-note", "No transactions this month."));
    }
}

function closeOpenRows() {
    let rows = document.querySelectorAll(".trans-row.open");
    for (let i = 0; i < rows.length; i++) rows[i].classList.remove("open");
}

// One line in a list: date | description | amount.
// Click it (or swipe it left) and it slides over to show Edit and Delete buttons.
function makeTransactionRow(item, kind) {
    let id = kind === "income" ? item.id : item.trans;

    let wrap = el("div", "trans-wrap");

    let editButton = el("button", "trans-edit", "Edit");
    editButton.type = "button";
    editButton.addEventListener("click", function(event) {
        event.stopPropagation();
        openEdit(kind, id);
    });

    let deleteButton = el("button", "trans-delete", "Delete");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", function(event) {
        event.stopPropagation();
        deleteItem(kind, id);
    });

    let row = el("div", "trans-row");
    row.appendChild(el("div", "trans-date", formatDate(item.date)));
    row.appendChild(el("div", "trans-desc", item.description || (kind === "income" ? "Income" : "")));
    row.appendChild(el("div", kind === "income" ? "trans-amount income" : "trans-amount", (kind === "income" ? "+ " : "- ") + item.amount + "€"));

    // click toggles
    let lastSwipe = 0;
    row.addEventListener("click", function() {
        if (Date.now() - lastSwipe < 400) return;
        let wasOpen = row.classList.contains("open");
        closeOpenRows();
        if (!wasOpen) row.classList.add("open");
    });

    // swipe left opens, swipe right closes (touch screens)
    let startX = null;
    row.addEventListener("touchstart", function(event) {
        startX = event.touches[0].clientX;
    }, {passive: true});
    row.addEventListener("touchend", function(event) {
        if (startX === null) return;
        let distance = event.changedTouches[0].clientX - startX;
        startX = null;
        if (distance < -40) {
            closeOpenRows();
            row.classList.add("open");
            lastSwipe = Date.now();
        } else if (distance > 40) {
            row.classList.remove("open");
            lastSwipe = Date.now();
        }
    });

    wrap.appendChild(editButton);
    wrap.appendChild(deleteButton);
    wrap.appendChild(row);
    return wrap;
}

// permanently delete one expense or income entry
function deleteItem(kind, id) {
    if (kind === "income") {
        incomes = incomes.filter(function(entry) { return entry.id !== id; });
        saveData("incomes", incomes);
    } else {
        transactions = transactions.filter(function(entry) { return entry.trans !== id; });
        saveData("transactions", transactions);
    }
    refresh();
}

byId("edit-budget-button").addEventListener("click", function() {
    let category = findCategory(openCategoryId);
    openSheet({
        title: category.name + " · " + formatMonth(selectMonth),
        confirmText: "Save budget",
        fields: [{label: "Budget", name: "budget", value: getBudget(category.id, selectMonth)}],
        onConfirm: function(values) {
            setBudget(category.id, selectMonth, values.budget);
        }
    });
});


// =====================================================================
// 7. INCOME POPUP
// =====================================================================

function openIncomeScreen() {
    openLayer("income");
    renderIncomeScreen();
}

function renderIncomeScreen() {
    byId("income-title").textContent = "Income · " + formatMonth(selectMonth);
    byId("income-total").textContent = euro(monthIncome(selectMonth));

    let list = byId("income-list");
    list.innerHTML = "";

    let sorted = incomes.slice();
    sorted.sort(function(a, b) {
        let byDate = b.date.localeCompare(a.date);
        if (byDate !== 0) return byDate;
        return b.id - a.id;
    });

    let count = 0;
    for (let i = 0; i < sorted.length; i++) {
        if (sorted[i].date.startsWith(selectMonth)) {
            list.appendChild(makeTransactionRow(sorted[i], "income"));
            count++;
        }
    }

    if (count === 0) {
        list.appendChild(el("div", "empty-note", "No income logged this month. Use the + button and pick Income."));
    }
}

byId("income-button").addEventListener("click", openIncomeScreen);


// =====================================================================
// 8. ENTRY POPUP (the + button)
// =====================================================================

function renderCategoriesOptions() {
    let select = byId("category");
    select.innerHTML = "";
    for (let i = 0; i < categories.length; i++) {
        let option = el("option", "", categories[i].name);
        option.value = categories[i].id;
        select.appendChild(option);
    }
}

// switch between "Expense" and "Income" at the top of the popup
function setEntryType(type) {
    entryType = type;

    let buttons = byId("type-toggle").querySelectorAll("button");
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].classList.toggle("active", buttons[i].dataset.type === type);
    }

    byId("pick-row").classList.toggle("income", type === "income");
    byId("description").placeholder = type === "income" ? "Source (e.g. salary)" : "Description (optional)";
}

byId("type-toggle").addEventListener("click", function(event) {
    let button = event.target.closest("button");
    if (button) setEntryType(button.dataset.type);
});

// the + button: a new, empty entry
function openEntry() {
    editing = null;
    byId("entry-screen").classList.remove("editing");
    byId("save").textContent = "Save";
    setEntryType("expense");
    byId("date").value = todayString();
    openLayer("entry");
    byId("number").focus();
}

// one expense or income entry, by its id
function findItem(kind, id) {
    let list = kind === "income" ? incomes : transactions;
    let field = kind === "income" ? "id" : "trans";
    for (let i = 0; i < list.length; i++) {
        if (list[i][field] === id) return list[i];
    }
    return null;
}

// the "Edit" button in a list: the same popup, filled in with the entry
function openEdit(kind, id) {
    let item = findItem(kind, id);
    if (!item) return;

    editing = {kind: kind, id: id};
    byId("entry-screen").classList.add("editing");
    byId("save").textContent = "Save changes";

    setEntryType(kind);
    byId("number").value = item.amount + "€";
    byId("description").value = item.description || "";
    byId("date").value = item.date;
    if (kind === "expense") byId("category").value = item.categoryId;

    openLayer("entry");
    byId("number").focus();
}

// the amount box always shows digits followed by a €
byId("number").addEventListener("input", function() {
    let field = byId("number");
    let digits = field.value.replace(/[^0-9]/g, "");
    if (digits === "") {
        field.value = "";
        return;
    }
    field.value = digits + "€";
    field.setSelectionRange(digits.length, digits.length);
});

byId("save").addEventListener("click", function() {
    let amount = Number(byId("number").value.replace("€", ""));
    if (!(amount > 0)) return;

    let date = byId("date").value || todayString();
    let description = byId("description").value.trim();

    if (editing) {
        // change the existing entry
        let item = findItem(editing.kind, editing.id);
        if (item) {
            item.amount = amount;
            item.date = date;
            item.description = description;
            if (editing.kind === "expense") item.categoryId = Number(byId("category").value);
        }
        saveData(editing.kind === "income" ? "incomes" : "transactions", editing.kind === "income" ? incomes : transactions);
    } else if (entryType === "income") {
        incomes.push({id: nextId(incomes, "id"), amount: amount, date: date, description: description});
        saveData("incomes", incomes);
    } else {
        transactions.push({
            trans: nextId(transactions, "trans"),
            amount: amount,
            date: date,
            description: description,
            categoryId: Number(byId("category").value)
        });
        saveData("transactions", transactions);
    }

    byId("number").value = "";
    byId("description").value = "";
    closeTopLayer();   // only the entry popup; if it was opened from a category, that one stays
    refresh();
});

byId("add-button").addEventListener("click", openEntry);


// =====================================================================
// 9. SMALL POPUP ("sheet") FOR EDITING NUMBERS AND NAMES
//    openSheet({
//        title, confirmText,
//        fields: [{label, name, value, type, placeholder}],   type "text" = a name, otherwise a number
//        onConfirm(values),            can return a text to show as an error and keep the popup open
//        deleteText, onDelete()        optional: adds a Delete button (it asks for a second tap)
//    })
// =====================================================================

let sheetInputs = [];
let sheetOnConfirm = null;
let sheetOnDelete = null;
let sheetDeleteSure = "";

function openSheet(options) {
    byId("sheet-title").textContent = options.title;
    byId("sheet-confirm").textContent = options.confirmText || "Save";
    byId("sheet-error").textContent = "";

    // the optional Delete button
    let deleteButton = byId("sheet-delete");
    deleteButton.classList.remove("sure");
    deleteButton.textContent = options.deleteText || "Delete";
    deleteButton.style.display = options.onDelete ? "block" : "none";
    sheetOnDelete = options.onDelete || null;
    sheetDeleteSure = options.deleteSure || "Tap again to delete";

    let box = byId("sheet-fields");
    box.innerHTML = "";
    sheetInputs = [];

    for (let i = 0; i < options.fields.length; i++) {
        let field = options.fields[i];
        let isText = field.type === "text";

        let label = el("label", "sheet-field");
        label.appendChild(el("span", "", field.label));

        let input = el("input");
        input.type = "text";
        input.autocomplete = "off";
        input.value = (field.value === undefined || field.value === "") ? "" : String(field.value);

        if (isText) {
            input.className = "text-input";
            input.maxLength = 30;
            input.placeholder = field.placeholder || "";
        } else {
            input.inputMode = "numeric";
            input.placeholder = "0";
            // only digits allowed
            input.addEventListener("input", function() {
                input.value = input.value.replace(/[^0-9]/g, "");
            });
        }

        // Enter confirms
        input.addEventListener("keydown", function(event) {
            if (event.key === "Enter") byId("sheet-confirm").click();
        });

        label.appendChild(input);
        box.appendChild(label);
        sheetInputs.push({name: field.name, input: input, isText: isText});
    }

    sheetOnConfirm = options.onConfirm;
    if (layers.indexOf("sheet") === -1) openLayer("sheet");
    if (sheetInputs.length > 0) sheetInputs[0].input.focus();
}

function closeSheet() {
    if (layers[layers.length - 1] === "sheet") closeTopLayer();
}

byId("sheet-confirm").addEventListener("click", function() {
    if (!sheetOnConfirm) return;

    // collect the values (an empty number field counts as 0)
    let values = {};
    for (let i = 0; i < sheetInputs.length; i++) {
        let text = sheetInputs[i].input.value;
        if (sheetInputs[i].isText) {
            values[sheetInputs[i].name] = text.trim();
        } else {
            values[sheetInputs[i].name] = text === "" ? 0 : Number(text);
        }
    }

    let error = sheetOnConfirm(values);
    if (error) {
        byId("sheet-error").textContent = error;
        return;
    }

    closeSheet();
    refresh();
});

// Delete: the first tap only asks "are you sure?", the second one deletes
byId("sheet-delete").addEventListener("click", function() {
    if (!sheetOnDelete) return;

    let button = byId("sheet-delete");
    if (!button.classList.contains("sure")) {
        button.classList.add("sure");
        button.textContent = sheetDeleteSure;
        return;
    }

    let action = sheetOnDelete;
    closeSheet();
    action();
    refresh();
});

byId("sheet-cancel").addEventListener("click", closeSheet);
byId("sheet-backdrop").addEventListener("click", closeSheet);


// =====================================================================
// 10. STATISTICS + TREND CHART
// =====================================================================

function renderStats() {
    renderTrend();

    // the last 6 months, including the current one
    let months = lastMonths(6);
    byId("stats-range").textContent = "Last 6 months · " + shortMonth(months[0]) + " – " + shortMonth(months[5]) + " " + months[5].split("-")[0];

    let rows = [];
    for (let i = 0; i < categories.length; i++) {
        let values = [];
        for (let m = 0; m < months.length; m++) {
            values.push(spentMoney(categories[i].id, months[m]));
        }
        rows.push({
            name: categories[i].name,
            value: statMode === "median" ? median(values) : average(values)
        });
    }

    // biggest first
    rows.sort(function(a, b) {
        return (b.value - a.value) || a.name.localeCompare(b.name);
    });

    let highest = 1;
    for (let i = 0; i < rows.length; i++) {
        if (rows[i].value > highest) highest = rows[i].value;
    }

    let list = byId("stats-list");
    list.innerHTML = "";
    for (let i = 0; i < rows.length; i++) {
        let row = el("div", "stat-row");

        let top = el("div", "stat-top");
        top.appendChild(el("span", "stat-name", rows[i].name));
        top.appendChild(el("span", "stat-value", euro(rows[i].value)));
        row.appendChild(top);

        let track = el("div", "mini-track");
        let fill = el("div", "mini-fill");
        fill.style.width = (rows[i].value / highest * 100) + "%";
        track.appendChild(fill);
        row.appendChild(track);

        list.appendChild(row);
    }

    list.appendChild(el("div", "panel-note", "Per month. Months without spending count as 0€."));
}

// bar chart of the total spent in each of the last 12 months
function renderTrend() {
    let chart = byId("trend-chart");
    chart.innerHTML = "";

    let months = lastMonths(12);
    let totals = [];
    for (let i = 0; i < months.length; i++) totals.push(totalSpent(months[i]));

    let highest = 1;
    for (let i = 0; i < totals.length; i++) {
        if (totals[i] > highest) highest = totals[i];
    }

    // by default the current month is selected
    if (months.indexOf(trendSelected) === -1) trendSelected = months[months.length - 1];

    const maxBarHeight = 128; // pixels for the tallest bar

    for (let i = 0; i < months.length; i++) {
        let month = months[i];

        let column = el("button", "trend-col");
        column.type = "button";
        column.setAttribute("aria-label", formatMonth(month) + ": " + euro(totals[i]));
        if (month === trendSelected) column.classList.add("selected");

        let area = el("div", "trend-area");
        let bar = el("div", "trend-bar");
        bar.style.height = Math.max(3, Math.round(totals[i] / highest * maxBarHeight)) + "px";
        if (totals[i] === 0) bar.classList.add("zero");
        area.appendChild(bar);

        column.appendChild(area);
        column.appendChild(el("div", "trend-label", shortMonth(month)));

        column.addEventListener("click", function() {
            trendSelected = month;
            renderTrend();
        });

        chart.appendChild(column);
    }

    // line under the chart: the selected month and the 12-month average
    let detail = byId("trend-detail");
    detail.innerHTML = "";
    let selectedTotal = totals[months.indexOf(trendSelected)];
    detail.appendChild(el("span", "trend-detail-main", formatMonth(trendSelected) + " · " + euro(selectedTotal)));
    detail.appendChild(el("span", "trend-detail-avg", "12-month average " + euro(average(totals))));
}

byId("stat-toggle").addEventListener("click", function(event) {
    let button = event.target.closest("button");
    if (!button) return;
    statMode = button.dataset.mode;

    let buttons = byId("stat-toggle").querySelectorAll("button");
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].classList.toggle("active", buttons[i].dataset.mode === statMode);
    }
    renderStats();
});


// =====================================================================
// 11. SAVINGS PAGE
// =====================================================================

function saveSavings() {
    saveData("savings", savings);
}

function renderSavings() {
    let totalSaved = 0;
    for (let i = 0; i < savings.length; i++) totalSaved = totalSaved + savings[i].saved;
    byId("savings-total").textContent = euro(totalSaved);

    let list = byId("savings-list");
    list.innerHTML = "";

    for (let i = 0; i < savings.length; i++) {
        let fund = savings[i];
        let percent = percentOf(fund.saved, fund.goal);

        let card = el("div", "fund-card");
        card.appendChild(el("div", "card-name", fund.name));

        let line = el("div", "card-line");
        line.appendChild(makeAmounts(fund.saved, fund.goal));
        line.appendChild(el("span", "card-percent", percent + "%"));
        card.appendChild(line);

        card.appendChild(makebar(percent, "goal"));

        let note = "";
        if (fund.goal > 0) {
            note = fund.saved >= fund.goal ? "Goal reached." : euro(fund.goal - fund.saved) + " to go.";
        }
        card.appendChild(el("div", "fund-note", note));

        let buttons = el("div", "fund-buttons");

        let addButton = el("button", "fund-btn", "+ Add");
        addButton.type = "button";
        addButton.addEventListener("click", function() {
            openSheet({
                title: "Add to " + fund.name,
                confirmText: "Add",
                fields: [{label: "Amount", name: "amount", value: ""}],
                onConfirm: function(values) {
                    if (values.amount <= 0) return "Enter an amount.";
                    fund.saved = fund.saved + values.amount;
                    saveSavings();
                }
            });
        });

        let takeButton = el("button", "fund-btn", "− Take out");
        takeButton.type = "button";
        takeButton.addEventListener("click", function() {
            openSheet({
                title: "Take out of " + fund.name,
                confirmText: "Take out",
                fields: [{label: "Amount", name: "amount", value: ""}],
                onConfirm: function(values) {
                    if (values.amount <= 0) return "Enter an amount.";
                    if (values.amount > fund.saved) return "There is only " + euro(fund.saved) + " in this fund.";
                    fund.saved = fund.saved - values.amount;
                    saveSavings();
                }
            });
        });

        // Edit: change the name and the goal, or delete the whole fund
        let editButton = el("button", "fund-btn", "Edit");
        editButton.type = "button";
        editButton.addEventListener("click", function() {
            openSheet({
                title: "Edit " + fund.name,
                confirmText: "Save",
                fields: [
                    {label: "Name", name: "name", type: "text", value: fund.name},
                    {label: "Goal", name: "goal", value: fund.goal}
                ],
                onConfirm: function(values) {
                    if (values.name === "") return "Give the goal a name.";
                    fund.name = values.name;
                    fund.goal = values.goal;
                    saveSavings();
                },
                deleteText: "Delete this goal",
                deleteSure: fund.saved > 0
                    ? "Tap again: " + euro(fund.saved) + " saved here will be forgotten"
                    : "Tap again to delete",
                onDelete: function() {
                    savings = savings.filter(function(entry) { return entry.id !== fund.id; });
                    saveSavings();
                }
            });
        });

        buttons.appendChild(addButton);
        buttons.appendChild(takeButton);
        buttons.appendChild(editButton);
        card.appendChild(buttons);

        list.appendChild(card);
    }

    if (savings.length === 0) {
        list.appendChild(el("div", "empty-note", "No savings goals yet. Add your first one below."));
    }
}

// "New savings goal" button under the list
byId("add-fund-button").addEventListener("click", function() {
    openSheet({
        title: "New savings goal",
        confirmText: "Create",
        fields: [
            {label: "Name", name: "name", type: "text", value: "", placeholder: "e.g. New laptop"},
            {label: "Goal", name: "goal", value: ""},
            {label: "Already saved", name: "saved", value: ""}
        ],
        onConfirm: function(values) {
            if (values.name === "") return "Give the goal a name.";
            savings.push({id: nextId(savings, "id"), name: values.name, goal: values.goal, saved: values.saved});
            saveSavings();
        }
    });
});


// =====================================================================
// 12. PAGES / NAVIGATION / START
// =====================================================================

function isVisible(id) {
    let display = byId(id).style.display;
    return display !== "" && display !== "none";
}


// ---------------------------------------------------------------------
// POPUPS + THE BROWSER'S BACK BUTTON
//
// Every popup that opens is added to the list "layers" ("category",
// "entry", "income", "sheet"; the last one is on top). Each one also
// adds a step to the browser history, so pressing Back (or swiping back
// on a phone) closes the top popup instead of leaving the app.
//
//   openLayer(name)   open a popup (and add a history step)
//   closeTopLayer()   close the top popup (and remove its history step)
//   closeAll()        close every popup
// ---------------------------------------------------------------------

// put the popup on screen
function showLayer(name) {
    if (name === "sheet") {
        byId("sheet-backdrop").style.display = "block";
        byId("sheet").style.display = "flex";
    } else {
        byId(name + "-screen").style.display = name === "entry" ? "block" : "flex";
        byId("backdrop").style.display = "block";
    }
}

// take the popup off the screen (the caller has already removed it from "layers")
function hideLayer(name) {
    if (name === "sheet") {
        byId("sheet").style.display = "none";
        byId("sheet-backdrop").style.display = "none";
        sheetOnConfirm = null;
        sheetOnDelete = null;
        return;
    }

    byId(name + "-screen").style.display = "none";

    if (name === "category") openCategoryId = null;

    // leaving the edit mode: empty the form again
    if (name === "entry" && editing) {
        editing = null;
        byId("entry-screen").classList.remove("editing");
        byId("save").textContent = "Save";
        byId("number").value = "";
        byId("description").value = "";
    }

    // the dark background stays while any of the big popups is still open
    let anyOpen = layers.some(function(layer) { return layer !== "sheet"; });
    byId("backdrop").style.display = anyOpen ? "block" : "none";
}

function openLayer(name) {
    layers.push(name);
    history.pushState({depth: layers.length}, "");
    showLayer(name);
}

function closeTopLayer() {
    if (layers.length === 0) return;
    hideLayer(layers.pop());
    history.back();   // remove its history step; the popstate handler below then has nothing left to do
}

function closeAll() {
    let count = layers.length;
    while (layers.length > 0) hideLayer(layers.pop());
    byId("month-list").innerHTML = "";
    if (count > 0) history.go(-count);
}

// the Back button was pressed: close popups until we match the history again
window.addEventListener("popstate", function(event) {
    let depth = event.state && event.state.depth ? event.state.depth : 0;
    while (layers.length > depth) hideLayer(layers.pop());

    // Forward button: we can't bring a closed popup back, so just fix the step
    if (layers.length < depth) history.replaceState({depth: layers.length}, "");
});

// a page reload keeps the old history state, so start from zero
history.replaceState({depth: 0}, "");

// draw whatever is on screen again (call after any change to the data)
function refresh() {
    if (currentPage === "budget") {
        renderMonthBar();
        renderTotal();
        renderCategories();
    } else if (currentPage === "stats") {
        renderStats();
    } else if (currentPage === "savings") {
        renderSavings();
    }

    if (isVisible("category-screen") && openCategoryId !== null) renderCategoryPopup();
    if (isVisible("income-screen")) renderIncomeScreen();
}

function showPage(name) {
    currentPage = name;
    closeAll();

    let pages = ["budget", "stats", "savings"];
    for (let i = 0; i < pages.length; i++) {
        byId("page-" + pages[i]).hidden = pages[i] !== name;
    }

    let tabs = document.querySelectorAll("#tab-bar .tab");
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].classList.toggle("active", tabs[i].dataset.page === name);
    }

    // the + button only makes sense on the budget page
    byId("add-button").style.display = name === "budget" ? "flex" : "none";

    window.scrollTo(0, 0);
    refresh();
}

byId("tab-bar").addEventListener("click", function(event) {
    let tab = event.target.closest(".tab");
    if (tab) showPage(tab.dataset.page);
});

byId("backdrop").addEventListener("click", closeAll);

// Escape closes the top popup
document.addEventListener("keydown", function(event) {
    if (event.key === "Escape") closeTopLayer();
});

renderCategoriesOptions();
showPage("budget");