/* ==========================================
   DOCUMENT PORTAL — password gateway
   The access code is verified on the server; nothing secret lives here.
   ========================================== */

const editor = document.getElementById("editor");
const documentTitle = document.getElementById("documentTitle");
const wordCount = document.getElementById("wordCount");
const saveStatus = document.getElementById("saveStatus");
const notification = document.getElementById("notification");
const saveButton = document.getElementById("saveButton");
const printButton = document.getElementById("printButton");
const undoButton = document.getElementById("undoButton");
const redoButton = document.getElementById("redoButton");
const zoomSelect = document.getElementById("zoomSelect");
const paragraphStyle = document.getElementById("paragraphStyle");
const fontSelect = document.getElementById("fontSelect");
const fontSizeSelect = document.getElementById("fontSizeSelect");
const menuPopup = document.getElementById("menuPopup");

const STORAGE_KEY = "documentPortalData";

/* ---------- notification ---------- */
function showNotification(message) {
    notification.textContent = message;
    notification.classList.add("show");
    setTimeout(() => notification.classList.remove("show"), 1800);
}

/* ---------- word count ---------- */
function updateWordCount() {
    const text = editor.innerText.trim();
    if (!text) { wordCount.textContent = "0 words"; return; }
    const words = text.split(/\s+/).filter(Boolean);
    wordCount.textContent = `${words.length} ${words.length === 1 ? "word" : "words"}`;
}

/* ---------- local save (title only — document text is never persisted,
   so an access code can never be left behind on a shared computer) ---------- */
function saveDocument() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ title: documentTitle.value }));
    saveStatus.textContent = "Saved just now";
    setTimeout(() => { saveStatus.textContent = "All changes saved locally"; }, 1800);
}

function loadDocument() {
    // Always start with an empty page. Only the title is restored.
    editor.innerHTML = "";
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    try {
        const data = JSON.parse(stored);
        if (data.title) documentTitle.value = data.title;
        if (data.content) localStorage.setItem(STORAGE_KEY, JSON.stringify({ title: data.title || "Untitled document" }));
    } catch (error) {
        console.error("Could not load saved document:", error);
    }
}

/* ---------- reset after successful access ---------- */
function scrubEditor() {
    editor.innerHTML = "";
    editor.textContent = "";
    updateWordCount();
    saveDocument();
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
}

/* ---------- secret code (server-verified) ---------- */
let verifyTimer = null;
let lastChecked = "";
let verifying = false;
let unlocked = false;

function scheduleSecretCheck() {
    clearTimeout(verifyTimer);
    verifyTimer = setTimeout(checkSecretCode, 450);
}

async function checkSecretCode() {
    if (unlocked || verifying) return;
    const text = editor.innerText.trim();
    if (!text || text === lastChecked) return;
    lastChecked = text;
    verifying = true;
    try {
        const res = await fetch("/api/gate/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ text: text.slice(-600) })
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.ok) {
            unlocked = true;
            scrubEditor();
            window.location.replace(data.redirect || "/");
        }
    } catch (error) {
        /* network hiccup: user keeps typing, we retry on next input */
        lastChecked = "";
    } finally {
        verifying = false;
    }
}

/* ---------- editor input ---------- */
editor.addEventListener("input", () => {
    updateWordCount();
    saveStatus.textContent = "Saving...";
    clearTimeout(window.saveTimer);
    window.saveTimer = setTimeout(saveDocument, 600);
    scheduleSecretCheck();
});

documentTitle.addEventListener("input", () => {
    saveStatus.textContent = "Saving...";
    clearTimeout(window.titleSaveTimer);
    window.titleSaveTimer = setTimeout(saveDocument, 600);
});

/* ---------- formatting ---------- */
document.querySelectorAll("[data-command]").forEach(button => {
    button.addEventListener("click", () => {
        document.execCommand(button.dataset.command, false, null);
        editor.focus();
    });
});

undoButton.addEventListener("click", () => { document.execCommand("undo", false, null); editor.focus(); });
redoButton.addEventListener("click", () => { document.execCommand("redo", false, null); editor.focus(); });

fontSelect.addEventListener("change", () => { document.execCommand("fontName", false, fontSelect.value); editor.focus(); });
fontSizeSelect.addEventListener("change", () => { document.execCommand("fontSize", false, fontSizeSelect.value); editor.focus(); });
paragraphStyle.addEventListener("change", () => { document.execCommand("formatBlock", false, paragraphStyle.value); editor.focus(); });

zoomSelect.addEventListener("change", () => {
    const zoom = Number(zoomSelect.value) / 100;
    const page = document.querySelector(".document-page");
    page.style.transform = `scale(${zoom})`;
    page.style.transformOrigin = "top center";
});

saveButton.addEventListener("click", () => { saveDocument(); showNotification("Document saved"); });
printButton.addEventListener("click", () => { window.print(); });
document.querySelector(".share-button").addEventListener("click", () => {
    showNotification("Sharing is unavailable in this project");
});

/* ---------- menu system ---------- */
const menuItems = {
    file: [["New document", "new"], ["Save", "save"], ["Print", "print"]],
    edit: [["Undo", "undo"], ["Redo", "redo"], ["Select all", "select"]],
    view: [["Zoom 100%", "zoom100"], ["Zoom 125%", "zoom125"]],
    insert: [["Insert text", "insertText"], ["Insert line break", "lineBreak"]],
    format: [["Bold", "bold"], ["Italic", "italic"], ["Underline", "underline"]],
    tools: [["Word count", "wordCount"]]
};

document.querySelectorAll(".menu-button").forEach(button => {
    button.addEventListener("click", (event) => {
        event.stopPropagation();
        const items = menuItems[button.dataset.menu] || [];
        menuPopup.innerHTML = "";
        items.forEach(([label, action]) => {
            const item = document.createElement("div");
            item.className = "popup-item";
            item.textContent = label;
            item.addEventListener("click", () => {
                executeMenuAction(action);
                menuPopup.classList.remove("visible");
            });
            menuPopup.appendChild(item);
        });
        const rect = button.getBoundingClientRect();
        menuPopup.style.left = `${rect.left}px`;
        menuPopup.style.top = `${rect.bottom + 2}px`;
        menuPopup.classList.add("visible");
    });
});

document.addEventListener("click", () => menuPopup.classList.remove("visible"));

function executeMenuAction(action) {
    switch (action) {
        case "new":
            editor.innerHTML = "";
            documentTitle.value = "Untitled document";
            updateWordCount();
            saveDocument();
            break;
        case "save": saveDocument(); showNotification("Document saved"); break;
        case "print": window.print(); break;
        case "undo": document.execCommand("undo"); break;
        case "redo": document.execCommand("redo"); break;
        case "select": document.execCommand("selectAll"); break;
        case "zoom100": zoomSelect.value = "100"; zoomSelect.dispatchEvent(new Event("change")); break;
        case "zoom125": zoomSelect.value = "125"; zoomSelect.dispatchEvent(new Event("change")); break;
        case "insertText": document.execCommand("insertText", false, " "); editor.focus(); break;
        case "lineBreak": document.execCommand("insertHTML", false, "<br>"); editor.focus(); break;
        case "bold": document.execCommand("bold"); break;
        case "italic": document.execCommand("italic"); break;
        case "underline": document.execCommand("underline"); break;
        case "wordCount": updateWordCount(); showNotification(wordCount.textContent); break;
    }
}

/* ---------- keyboard shortcuts ---------- */
document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault(); saveDocument(); showNotification("Document saved");
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
        event.preventDefault(); window.print();
    }
});

/* ---------- startup ---------- */
loadDocument();
updateWordCount();

// If the page is restored from the back/forward cache, make sure it is empty again.
window.addEventListener("pageshow", (event) => {
    if (event.persisted) { editor.innerHTML = ""; updateWordCount(); lastChecked = ""; unlocked = false; }
});
