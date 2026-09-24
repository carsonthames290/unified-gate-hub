// Server-only: the Doc Editor / password gateway page (ported 1:1 from the original).
export function gatePageHtml(navHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document Portal</title>
    <meta name="description" content="Document Portal — a simple online document editor.">
    <meta name="robots" content="noindex">
    <link rel="stylesheet" href="/gate/style.css">
</head>

<body>

    <header class="topbar">
        <div class="brand-area">
            <div class="document-logo" aria-label="Document Portal logo">
                <div class="logo-page">
                    <div class="logo-fold"></div>
                    <div class="logo-line line-1"></div>
                    <div class="logo-line line-2"></div>
                    <div class="logo-line line-3"></div>
                </div>
            </div>
            <div class="brand-text">
                <div class="brand-name">Document Portal</div>
                <input id="documentTitle" class="document-title" type="text" value="Untitled document" aria-label="Document title">
            </div>
        </div>
        <div class="top-actions">
            <button class="top-action" title="Save" id="saveButton">Save</button>
            <button class="top-action" title="Print" id="printButton">Print</button>
            <button class="top-action share-button" title="Share">Share</button>
            <div class="avatar">D</div>
        </div>
    </header>

    <nav class="menu-bar">
        <button class="menu-button" data-menu="file">File</button>
        <button class="menu-button" data-menu="edit">Edit</button>
        <button class="menu-button" data-menu="view">View</button>
        <button class="menu-button" data-menu="insert">Insert</button>
        <button class="menu-button" data-menu="format">Format</button>
        <button class="menu-button" data-menu="tools">Tools</button>
    </nav>

    <section class="toolbar">
        <button class="tool-button" id="undoButton" title="Undo">↶</button>
        <button class="tool-button" id="redoButton" title="Redo">↷</button>
        <div class="divider"></div>
        <select id="zoomSelect" class="toolbar-select small-select">
            <option value="50">50%</option>
            <option value="75">75%</option>
            <option value="100" selected>100%</option>
            <option value="125">125%</option>
            <option value="150">150%</option>
        </select>
        <select id="paragraphStyle" class="toolbar-select">
            <option value="p">Normal text</option>
            <option value="h1">Title</option>
            <option value="h2">Heading 1</option>
            <option value="h3">Heading 2</option>
        </select>
        <select id="fontSelect" class="toolbar-select font-select">
            <option value="Arial">Arial</option>
            <option value="Georgia">Georgia</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Courier New">Courier New</option>
            <option value="Verdana">Verdana</option>
        </select>
        <select id="fontSizeSelect" class="toolbar-select small-select">
            <option value="1">10</option>
            <option value="2">13</option>
            <option value="3" selected>16</option>
            <option value="4">18</option>
            <option value="5">24</option>
            <option value="6">32</option>
            <option value="7">48</option>
        </select>
        <div class="divider"></div>
        <button class="tool-button" data-command="bold" title="Bold"><strong>B</strong></button>
        <button class="tool-button" data-command="italic" title="Italic"><em>I</em></button>
        <button class="tool-button" data-command="underline" title="Underline"><u>U</u></button>
        <button class="tool-button" data-command="strikeThrough" title="Strikethrough"><s>S</s></button>
        <div class="divider"></div>
        <button class="tool-button" data-command="justifyLeft" title="Align left">☰</button>
        <button class="tool-button" data-command="justifyCenter" title="Center">≡</button>
        <button class="tool-button" data-command="justifyRight" title="Align right">☷</button>
        <button class="tool-button" data-command="justifyFull" title="Justify">▤</button>
        <div class="divider"></div>
        <button class="tool-button" data-command="insertUnorderedList" title="Bulleted list">•☰</button>
        <button class="tool-button" data-command="insertOrderedList" title="Numbered list">1☰</button>
    </section>

    <main class="workspace">
        <div class="document-page">
            <div id="editor" class="editor" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true" autocomplete="off" autocorrect="off" autocapitalize="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other"></div>
        </div>
    </main>

    <footer class="statusbar">
        <span id="wordCount">0 words</span>
        <span class="status-spacer"></span>
        <span id="saveStatus">All changes saved locally</span>
    </footer>

    <div id="notification" class="notification"></div>
    <div id="menuPopup" class="menu-popup"></div>

    <script src="/gate/script.js"></script>
    ${navHtml}
</body>
</html>`;
}
