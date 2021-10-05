class LiveryPrinter extends TemplateElement {
    constructor() {
        super();
        this.curTime = 0.0;
        this.bNeedUpdate = false;
        this._isConnected = false;
    }
    get templateID() {
        return "LiveryPrinter";
    }
    connectedCallback() {
        super.connectedCallback();
        const url = document.getElementsByTagName("livery-printer-element")[0].getAttribute("url");
        this.index = parseInt(url.substring(url.length - 1));
        if (this.index == 0) {
            localStorage.setItem("pages", "[]");
        }
        this.lines = this.querySelector("#lines");
        const updateLoop = () => {
            if (!this._isConnected) {
                return;
            }
            this.Update();
            requestAnimationFrame(updateLoop);
        };
        this._isConnected = true;
        requestAnimationFrame(updateLoop);
    }
    disconnectedCallback() {
    }
    Update() {
        const pages = JSON.parse(localStorage.getItem("pages")) || [];

        if (this.index == 0) {
            const currentPageID = SimVar.GetSimVarValue("L:A32NX_PAGE_ID", "number") - 1;
            if (currentPageID >= 0 && pages[currentPageID] == null) {
                const elements = [];
                for (let i = 0; i < SimVar.GetSimVarValue('L:A32NX_PRINT_LINES', 'number'); i += 1) {
                    let line = '';
                    for (let j = 0; j < SimVar.GetSimVarValue(`L:A32NX_PRINT_LINE_LENGTH_${i}`, 'number'); j += 1) {
                        line += String.fromCharCode(SimVar.GetSimVarValue(`L:A32NX_PRINT_${i}_${j}`, 'number'));
                    }
                    elements.push(line);
                }
                pages[currentPageID] = elements;
                localStorage.setItem("pages", JSON.stringify(pages));
            }
        }
        if (pages == null) {
            return;
        }
        let displayedPage = 0;
        if (this.index == 0) {
            displayedPage = pages.length - 1;
        } else {
            let pagesPrinted = SimVar.GetSimVarValue("L:A32NX_PAGES_PRINTED", "number");
            const offset = SimVar.GetSimVarValue("L:A32NX_PRINT_PAGE_OFFSET", "number");
            displayedPage = pagesPrinted - 1 + offset;

            const discard = SimVar.GetSimVarValue("L:A32NX_DISCARD_PAGE", "bool");

            if (displayedPage < 0) {
                displayedPage = 0;
                SimVar.SetSimVarValue("L:A32NX_PRINT_PAGE_OFFSET", "number", (pagesPrinted - 1) * -1);
            }

            if (displayedPage > (pagesPrinted - 1)) {
                displayedPage = pagesPrinted - 1;
                SimVar.SetSimVarValue("L:A32NX_PRINT_PAGE_OFFSET", "number", 0);
            }

            if (discard) {
                pages.splice(displayedPage, 1);
                localStorage.setItem("pages", JSON.stringify(pages));
                pagesPrinted--;
                SimVar.SetSimVarValue("L:A32NX_PAGES_PRINTED", "number", pagesPrinted);
                SimVar.SetSimVarValue("L:A32NX_PAGE_ID", "number", SimVar.GetSimVarValue("L:A32NX_PAGE_ID", "number") - 1);
                SimVar.SetSimVarValue("L:A32NX_DISCARD_PAGE", "bool", 0);
            }
        }

        let newLines = '';
        const page = pages[displayedPage] || [];
        for (const value of page) {
            newLines += `<span class="line">${value}<br/></span>`;
        }
        if (this.previousLines !== newLines) {
            this.lines.innerHTML = newLines;
            this.lines.setAttribute("class", "large");
            if (this.lines.clientHeight > 1024) {
                this.lines.setAttribute("class", "small");
            }
        }
        this.previousLines = newLines;
    }
}
registerLivery("livery-printer-element", LiveryPrinter);
