class A320_Neo_CDU_MainDisplay extends FMCMainDisplay {
    constructor() {
        super(...arguments);
        this._registered = false;
        this._title = undefined;
        this._pageCurrent = undefined;
        this._pageCount = undefined;
        this._labels = [];
        this._lines = [];
        this._inOut = undefined;
        this.onLeftInput = [];
        this.onRightInput = [];
        this.leftInputDelay = [];
        this.rightInputDelay = [];
        this.lastUserInput = "";
        this.isDisplayingErrorMessage = false;
        this.isDisplayingTypeTwoMessage = false;
        this.messages = [];
        this.sentMessages = [];
        this.activeSystem = 'FMGC';
        this.messageQueue = [];
    }
    get templateID() {
        return "A320_Neo_CDU";
    }
    connectedCallback() {
        super.connectedCallback();
        RegisterViewListener("JS_LISTENER_KEYEVENT", () => {
            console.log("JS_LISTENER_KEYEVENT registered.");
            RegisterViewListener("JS_LISTENER_FACILITY", () => {
                console.log("JS_LISTENER_FACILITY registered.");
                this._registered = true;
            });
        });
    }
    Init() {
        super.Init();

        let mainFrame = this.getChildById("Electricity");
        if (mainFrame == null) {
            mainFrame = this;
        }
        this.generateHTMLLayout(mainFrame);
        this._titleLeftElement = this.getChildById("title-left");
        this._titleElement = this.getChildById("title");
        this._pageCurrentElement = this.getChildById("page-current");
        this._pageCountElement = this.getChildById("page-count");
        this._labelElements = [];
        this._lineElements = [];
        for (let i = 0; i < 6; i++) {
            this._labelElements[i] = [
                this.getChildById("label-" + i + "-left"),
                this.getChildById("label-" + i + "-right"),
                this.getChildById("label-" + i + "-center")
            ];
            this._lineElements[i] = [
                this.getChildById("line-" + i + "-left"),
                this.getChildById("line-" + i + "-right"),
                this.getChildById("line-" + i + "-center")
            ];
        }
        this._inOutElement = this.getChildById("in-out");
        this._inOutElement.style.removeProperty("color");
        this._inOutElement.className = "white";

        this.onMenu = () => {
            FMCMainDisplayPages.MenuPage(this);
        };
        this.onLetterInput = (l) => {
            this.handlePreviousInputState();
            this.inOut += l;
        };
        this.onSp = () => {
            this.handlePreviousInputState();
            this.inOut += " ";
        };
        this.onDel = () => {
            this.handlePreviousInputState();
            if (this.inOut.length > 0) {
                this.inOut = this.inOut.slice(0, -1);
            }
        };
        this.onDiv = () => {
            this.handlePreviousInputState();
            this.inOut += "/";
        };
        this.onClr = () => {
            if (this.inOut === "") {
                this.inOut = FMCMainDisplay.clrValue;
            } else if (this.inOut === FMCMainDisplay.clrValue) {
                this.inOut = "";
            } else if (this.isDisplayingErrorMessage || this.isDisplayingTypeTwoMessage) {
                this.tryRemoveMessage();
                this.lastUserInputToScratchpad();
                this._inOutElement.className = "white";
                this.isDisplayingErrorMessage = false;
                this.isDisplayingTypeTwoMessage = false;
            } else {
                this.inOut = this.inOut.slice(0, -1);
            }
            this.tryShowMessage();
        };

        this.PageTimeout = {
            Prog: 5000,
            Dyn: 1500
        };
        this.page = {
            SelfPtr: false,
            Current: 0,
            Clear: 0,
            AirportsMonitor: 1,
            AirwaysFromWaypointPage: 2,
            // AirwaysFromWaypointPageGetAllRows: 3,
            AvailableArrivalsPage: 4,
            AvailableArrivalsPageVias: 5,
            AvailableDeparturesPage: 6,
            AvailableFlightPlanPage: 7,
            DataIndexPage1: 8,
            DataIndexPage2: 9,
            DirectToPage: 10,
            FlightPlanPage: 11,
            FuelPredPage: 12,
            GPSMonitor: 13,
            HoldAtPage: 14,
            IdentPage: 15,
            InitPageA: 16,
            InitPageB: 17,
            IRSInit: 18,
            IRSMonitor: 19,
            IRSStatus: 20,
            IRSStatusFrozen: 21,
            LateralRevisionPage: 22,
            MenuPage: 23,
            NavaidPage: 24,
            NavRadioPage: 25,
            NewWaypoint: 26,
            PerformancePageTakeoff: 27,
            PerformancePageClb: 28,
            PerformancePageCrz: 29,
            PerformancePageDes: 30,
            PerformancePageAppr: 31,
            PerformancePageGoAround: 32,
            PilotsWaypoint: 33,
            PosFrozen: 34,
            PositionMonitorPage: 35,
            ProgressPage: 36,
            ProgressPageReport: 37,
            ProgressPagePredictiveGPS: 38,
            SelectedNavaids: 39,
            SelectWptPage: 40,
            VerticalRevisionPage: 41,
            WaypointPage: 42,
            AOCInit: 43,
            AOCInit2: 44,
            AOCOfpData: 45,
            AOCOfpData2: 46,
            ClimbWind: 47,
            CruiseWind: 48,
            DescentWind: 49,
        };

        const flightNo = SimVar.GetSimVarValue("ATC FLIGHT NUMBER", "string");
        NXApi.connectTelex(flightNo)
            .catch((err) => {
                if (err !== NXApi.disabledError) {
                    this.addNewMessage(NXFictionalMessages.fltNbrInUse);
                }
            });

        this.onDir = () => {
            CDUDirectToPage.ShowPage(this);
        };
        this.onProg = () => {
            CDUProgressPage.ShowPage(this);
        };
        this.onPerf = () => {
            CDUPerformancePage.ShowPage(this);
        };
        this.onInit = () => {
            CDUInitPage.ShowPage1(this);
        };
        this.onData = () => {
            CDUDataIndexPage.ShowPage1(this);
        };
        this.onFpln = () => {
            CDUFlightPlanPage.ShowPage(this);
        };
        this.onSec = () => {
            CDUSecFplnMain.ShowPage(this);
        };
        this.onRad = () => {
            CDUNavRadioPage.ShowPage(this);
        };
        this.onFuel = () => {
            CDUFuelPredPage.ShowPage(this);
        };
        this.onAtc = () => {
            CDUAtcMenu.ShowPage1(this);
        };
        this.onMenu = () => {
            const cur = this.page.Current;
            setTimeout(() => {
                if (this.page.Current === cur) {
                    CDUMenuPage.ShowPage(this);
                }
            }, this.getDelaySwitchPage());
        };

        CDUMenuPage.ShowPage(this);

        this.updatePerfSpeeds();

        // support spawning in with a custom flight phases from the .flt files
        const initialFlightPhase = SimVar.GetSimVarValue("L:A32NX_INITIAL_FLIGHT_PHASE", "number");
        if (initialFlightPhase) {
            this.flightPhaseManager.changeFlightPhase(initialFlightPhase);
        }

        this.electricity = this.querySelector("#Electricity");
        this.climbTransitionGroundAltitude = null;
        this.initB = false;

        // If the consent is not set, show telex page
        const onlineFeaturesStatus = NXDataStore.get("CONFIG_ONLINE_FEATURES_STATUS", "UNKNOWN");

        if (onlineFeaturesStatus === "UNKNOWN") {
            CDU_OPTIONS_TELEX.ShowPage(this);
        }

        // Start the TELEX Ping. API functions check the connection status themself
        setInterval(() => {
            const toDelete = [];

            // Update connection
            NXApi.updateTelex()
                .catch((err) => {
                    if (err !== NXApi.disconnectedError && err !== NXApi.disabledError) {
                        console.log("TELEX PING FAILED");
                    }
                });

            // Fetch new messages
            NXApi.getTelexMessages()
                .then((data) => {
                    for (const msg of data) {
                        const sender = msg["from"]["flight"];

                        const lines = [];
                        lines.push("FROM " + sender + "[color]cyan");
                        const incLines = msg["message"].split(";");
                        incLines.forEach(l => lines.push(l.concat("[color]green")));
                        lines.push('---------------------------[color]white');

                        const newMessage = { "id": Date.now(), "type": "FREE TEXT (" + sender + ")", "time": '00:00', "opened": null, "content": lines, };
                        let timeValue = SimVar.GetGlobalVarValue("ZULU TIME", "seconds");
                        if (timeValue) {
                            const seconds = Number.parseInt(timeValue);
                            const displayTime = Utils.SecondsToDisplayTime(seconds, true, true, false);
                            timeValue = displayTime.toString();
                        }
                        newMessage["time"] = timeValue.substring(0, 5);
                        this.messages.unshift(newMessage);
                        toDelete.push(msg["id"]);
                    }

                    const msgCount = SimVar.GetSimVarValue("L:A32NX_COMPANY_MSG_COUNT", "Number");
                    SimVar.SetSimVarValue("L:A32NX_COMPANY_MSG_COUNT", "Number", msgCount + toDelete.length).then();
                })
                .catch(err => {
                    if (err.status === 404 || err === NXApi.disabledError || err === NXApi.disconnectedError) {
                        return;
                    }
                    console.log("TELEX MSG FETCH FAILED");
                });
        }, NXApi.updateRate);

        SimVar.SetSimVarValue("L:A32NX_GPS_PRIMARY_LOST_MSG", "Bool", 0).then();
    }

    onUpdate(_deltaTime) {
        super.onUpdate(_deltaTime);

        if (this.pageUpdate) {
            this.pageUpdate();
        }
        if (SimVar.GetSimVarValue("L:FMC_UPDATE_CURRENT_PAGE", "number") === 1) {
            SimVar.SetSimVarValue("L:FMC_UPDATE_CURRENT_PAGE", "number", 0).then();
            if (this.refreshPageCallback) {
                this.refreshPageCallback();
            }
        }

        this.checkAocTimes();

        this.updateMCDU();

        this.updateScreenState();

        // If legacy SimBrief username variable is in the DataStore, convert it to a user ID and remove it.
        const simbriefUsername = NXDataStore.get("CONFIG_SIMBRIEF_USERNAME", "");
        if (simbriefUsername) {
            getSimBriefUser(simbriefUsername, this, () => { });
            NXDataStore.set("CONFIG_SIMBRIEF_USERNAME", "");
        }
    }

    /* MCDU UPDATE */

    /**
     * Checks whether INIT page B is open and an engine is being started, if so:
     * The INIT page B reverts to the FUEL PRED page 15 seconds after the first engine start and cannot be accessed after engine start.
     */
    updateMCDU() {
        if (this.isAnEngineOn()) {
            if (!this.initB) {
                this.initB = true;
                setTimeout(() => {
                    if (this.page.Current === this.page.InitPageB && this.isAnEngineOn()) {
                        CDUFuelPredPage.ShowPage(this);
                    }
                }, 15000);
            }
        } else {
            this.initB = false;
        }
    }

    updateScreenState() {
        if (SimVar.GetSimVarValue("L:ACPowerAvailable","bool")) {
            this.electricity.style.display = "block";
        } else {
            this.electricity.style.display = "none";
        }
    }

    checkAocTimes() {
        if (!this.aocTimes.off) {
            const isAirborne = !Simplane.getIsGrounded(); //TODO replace with proper flight mode in future
            if (this.currentFlightPhase === FmgcFlightPhases.TAKEOFF && isAirborne) {
                // Wheels off
                // Off: remains blank until Take off time
                this.aocTimes.off = Math.floor(SimVar.GetGlobalVarValue("ZULU TIME", "seconds"));
            }
        }

        if (!this.aocTimes.out) {
            const currentPKGBrakeState = SimVar.GetSimVarValue("BRAKE PARKING POSITION", "Bool");
            if (this.currentFlightPhase === FmgcFlightPhases.PREFLIGHT && !currentPKGBrakeState) {
                // Out: is when you set the brakes to off
                this.aocTimes.out = Math.floor(SimVar.GetGlobalVarValue("ZULU TIME", "seconds"));
            }
        }

        if (!this.aocTimes.on) {
            const isAirborne = !Simplane.getIsGrounded(); //TODO replace with proper flight mode in future
            if (this.aocTimes.off && !isAirborne) {
                // On: remains blank until Landing time
                this.aocTimes.on = Math.floor(SimVar.GetGlobalVarValue("ZULU TIME", "seconds"));
            }
        }

        if (!this.aocTimes.in) {
            const currentPKGBrakeState = SimVar.GetSimVarValue("BRAKE PARKING POSITION", "Bool");
            const cabinDoorPctOpen = SimVar.GetSimVarValue("INTERACTIVE POINT OPEN:0", "percent");
            if (this.aocTimes.on && currentPKGBrakeState && cabinDoorPctOpen > 20) {
                // In: remains blank until brakes set to park AND the first door opens
                this.aocTimes.in = Math.floor(SimVar.GetGlobalVarValue("ZULU TIME", "seconds"));
            }
        }

        if (this.currentFlightPhase === FmgcFlightPhases.PREFLIGHT) {
            const cabinDoorPctOpen = SimVar.GetSimVarValue("INTERACTIVE POINT OPEN:0", "percent");
            if (!this.aocTimes.doors && cabinDoorPctOpen < 20) {
                this.aocTimes.doors = Math.floor(SimVar.GetGlobalVarValue("ZULU TIME", "seconds"));
            } else {
                if (cabinDoorPctOpen > 20) {
                    this.aocTimes.doors = "";
                }
            }
        }
    }

    /* END OF MCDU UPDATE */
    /* MCDU INTERFACE/LAYOUT */

    _formatCell(str) {
        return str
            .replace(/{big}/g, "<span class='b-text'>")
            .replace(/{small}/g, "<span class='s-text'>")
            .replace(/{big}/g, "<span class='b-text'>")
            .replace(/{amber}/g, "<span class='amber'>")
            .replace(/{red}/g, "<span class='red'>")
            .replace(/{green}/g, "<span class='green'>")
            .replace(/{cyan}/g, "<span class='cyan'>")
            .replace(/{white}/g, "<span class='white'>")
            .replace(/{magenta}/g, "<span class='magenta'>")
            .replace(/{yellow}/g, "<span class='yellow'>")
            .replace(/{inop}/g, "<span class='inop'>")
            .replace(/{sp}/g, "&nbsp;")
            .replace(/{left}/g, "<span class='left'>")
            .replace(/{right}/g, "<span class='right'>")
            .replace(/{end}/g, "</span>");
    }

    getTitle() {
        if (this._title === undefined) {
            this._title = this._titleElement.textContent;
        }
        return this._title;
    }

    setTitle(content) {
        let color = content.split("[color]")[1];
        if (!color) {
            color = "white";
        }
        this._title = content.split("[color]")[0];
        this._titleElement.classList.remove("white", "cyan", "yellow", "green", "amber", "red", "magenta", "inop");
        this._titleElement.classList.add(color);
        this._titleElement.textContent = this._title;
    }

    setTitleLeft(content) {
        if (!content) {
            this._titleLeftElement.textContent = "";
            return;
        }
        let color = content.split("[color]")[1];
        if (!color) {
            color = "white";
        }
        this._titleLeft = content.split("[color]")[0];
        this._titleLeftElement.classList.remove("white", "blue", "yellow", "green", "red", "magenta", "inop");
        this._titleLeftElement.classList.add(color);
        this._titleLeftElement.textContent = this._titleLeft;
    }

    setPageCurrent(value) {
        if (typeof (value) === "number") {
            this._pageCurrent = value;
        } else if (typeof (value) === "string") {
            this._pageCurrent = parseInt(value);
        }
        this._pageCurrentElement.textContent = (this._pageCurrent > 0 ? this._pageCurrent : "") + "";
    }

    setPageCount(value) {
        if (typeof (value) === "number") {
            this._pageCount = value;
        } else if (typeof (value) === "string") {
            this._pageCount = parseInt(value);
        }
        this._pageCountElement.textContent = (this._pageCount > 0 ? this._pageCount : "") + "";
        if (this._pageCount === 0) {
            this.getChildById("page-slash").textContent = "";
        } else {
            this.getChildById("page-slash").textContent = "/";
        }
    }

    setLabel(label, row, col = -1) {
        if (col >= this._labelElements[row].length) {
            return;
        }
        if (!this._labels[row]) {
            this._labels[row] = [];
        }
        if (!label) {
            label = "";
        }
        if (col === -1) {
            for (let i = 0; i < this._labelElements[row].length; i++) {
                this._labels[row][i] = "";
                this._labelElements[row][i].textContent = "";
            }
            col = 0;
        }
        if (label === "__FMCSEPARATOR") {
            label = "------------------------";
        }
        if (label !== "") {
            if (label.indexOf("[b-text]") !== -1) {
                label = label.replace("[b-text]", "");
                this._lineElements[row][col].classList.remove("s-text");
                this._lineElements[row][col].classList.add("msg-text");
            } else {
                this._lineElements[row][col].classList.remove("msg-text");
            }

            let color = label.split("[color]")[1];
            if (!color) {
                color = "white";
            }
            const e = this._labelElements[row][col];
            e.classList.remove("white", "cyan", "yellow", "green", "amber", "red", "magenta", "inop");
            e.classList.add(color);
            label = label.split("[color]")[0];
        }
        this._labels[row][col] = label;
        this._labelElements[row][col].textContent = label;
    }

    /**
     * @param {string|CDU_Field} content
     * @param {number} row
     * @param {number} col
     */
    setLine(content, row, col = -1) {

        if (content instanceof CDU_Field) {
            const field = content;
            ((col === 0 || col === -1) ? this.onLeftInput : this.onRightInput)[row] = (value) => {
                field.onSelect(value);
            };
            content = content.getValue();
        }

        if (col >= this._lineElements[row].length) {
            return;
        }
        if (!content) {
            content = "";
        }
        if (!this._lines[row]) {
            this._lines[row] = [];
        }
        if (col === -1) {
            for (let i = 0; i < this._lineElements[row].length; i++) {
                this._lines[row][i] = "";
                this._lineElements[row][i].textContent = "";
            }
            col = 0;
        }
        if (content === "__FMCSEPARATOR") {
            content = "------------------------";
        }
        if (content !== "") {
            if (content.indexOf("[s-text]") !== -1) {
                content = content.replace("[s-text]", "");
                this._lineElements[row][col].classList.add("s-text");
            } else {
                this._lineElements[row][col].classList.remove("s-text");
            }
            let color = content.split("[color]")[1];
            if (!color) {
                color = "white";
            }
            const e = this._lineElements[row][col];
            e.classList.remove("white", "cyan", "yellow", "green", "amber", "red", "magenta", "inop");
            e.classList.add(color);
            content = content.split("[color]")[0];
        }
        this._lines[row][col] = content;
        this._lineElements[row][col].textContent = this._lines[row][col];
    }

    setTemplate(template, large = false) {
        if (template[0]) {
            this.setTitle(template[0][0]);
            this.setPageCurrent(template[0][1]);
            this.setPageCount(template[0][2]);
            this.setTitleLeft(template[0][3]);
        }
        for (let i = 0; i < 6; i++) {
            let tIndex = 2 * i + 1;
            if (template[tIndex]) {
                if (large) {
                    if (template[tIndex][1] !== undefined) {
                        this.setLine(template[tIndex][0], i, 0);
                        this.setLine(template[tIndex][1], i, 1);
                        this.setLine(template[tIndex][2], i, 2);
                        this.setLine(template[tIndex][3], i, 3);
                    } else {
                        this.setLine(template[tIndex][0], i, -1);
                    }
                } else {
                    if (template[tIndex][1] !== undefined) {
                        this.setLabel(template[tIndex][0], i, 0);
                        this.setLabel(template[tIndex][1], i, 1);
                        this.setLabel(template[tIndex][2], i, 2);
                        this.setLabel(template[tIndex][3], i, 3);
                    } else {
                        this.setLabel(template[tIndex][0], i, -1);
                    }
                }
            }
            tIndex = 2 * i + 2;
            if (template[tIndex]) {
                if (template[tIndex][1] !== undefined) {
                    this.setLine(template[tIndex][0], i, 0);
                    this.setLine(template[tIndex][1], i, 1);
                    this.setLine(template[tIndex][2], i, 2);
                    this.setLine(template[tIndex][3], i, 3);
                } else {
                    this.setLine(template[tIndex][0], i, -1);
                }
            }
        }
        if (template[13]) {
            this.setInOut(template[13][0]);
        }
        SimVar.SetSimVarValue("L:AIRLINER_MCDU_CURRENT_FPLN_WAYPOINT", "number", this.currentFlightPlanWaypointIndex).then();
        // Apply formatting helper to title page, lines and labels
        if (this._titleElement !== null) {
            this._titleElement.innerHTML = this._formatCell(this._titleElement.innerHTML);
        }
        this._lineElements.forEach((row) => {
            row.forEach((column) => {
                if (column !== null) {
                    column.innerHTML = this._formatCell(column.innerHTML);
                }
            });
        });
        this._labelElements.forEach((row) => {
            row.forEach((column) => {
                if (column !== null) {
                    column.innerHTML = this._formatCell(column.innerHTML);
                }
            });
        });
    }

    /**
     * Sets what arrows will be displayed in the corner of the screen. Arrows are removed when clearDisplay() is called.
     * @param {boolean} up - whether the up arrow will be displayed
     * @param {boolean} down - whether the down arrow will be displayed
     * @param {boolean} left - whether the left arrow will be displayed
     * @param {boolean} right - whether the right arrow will be displayed
     */
    setArrows(up, down, left, right) {
        this.arrowHorizontal.style.opacity = (left || right) ? "1" : "0";
        this.arrowVertical.style.opacity = (up || down) ? "1" : "0";
        if (up && down) {
            this.arrowVertical.innerHTML = "↓↑\xa0";
        } else if (up) {
            this.arrowVertical.innerHTML = "↑\xa0";
        } else {
            this.arrowVertical.innerHTML = "↓\xa0\xa0";
        }
        if (left && right) {
            this.arrowHorizontal.innerHTML = "←→\xa0";
        } else if (right) {
            this.arrowHorizontal.innerHTML = "→\xa0";
        } else {
            this.arrowHorizontal.innerHTML = "←\xa0\xa0";
        }
    }

    clearDisplay() {
        this.setTitle("UNTITLED");
        this.setPageCurrent(0);
        this.setPageCount(0);
        for (let i = 0; i < 6; i++) {
            this.setLabel("", i, -1);
        }
        for (let i = 0; i < 6; i++) {
            this.setLine("", i, -1);
        }
        this.onLeftInput = [];
        this.onRightInput = [];
        this.leftInputDelay = [];
        this.rightInputDelay = [];
        this.onPrevPage = () => {};
        this.onNextPage = () => {};
        this.pageUpdate = () => {};
        this.refreshPageCallback = undefined;
        if (this.page.Current === this.page.MenuPage) {
            this.forceClearScratchpad();
        }
        this.page.Current = this.page.Clear;
        this.setArrows(false, false);
        this.tryDeleteTimeout();
        this.onUp = undefined;
        this.onDown = undefined;
        this.onLeft = undefined;
        this.onRight = undefined;
    }

    generateHTMLLayout(parent) {
        while (parent.children.length > 0) {
            parent.removeChild(parent.children[0]);
        }
        const header = document.createElement("div");
        header.id = "header";

        const titleLeft = document.createElement("div");
        titleLeft.classList.add("s-text");
        titleLeft.id = "title-left";
        parent.appendChild(titleLeft);

        const title = document.createElement("span");
        title.id = "title";
        header.appendChild(title);

        this.arrowHorizontal = document.createElement("span");
        this.arrowHorizontal.id = "arrow-horizontal";
        this.arrowHorizontal.innerHTML = "←→\xa0";
        header.appendChild(this.arrowHorizontal);

        parent.appendChild(header);

        const page = document.createElement("div");
        page.id = "page-info";
        page.classList.add("s-text");

        const pageCurrent = document.createElement("span");
        pageCurrent.id = "page-current";

        const pageSlash = document.createElement("span");
        pageSlash.id = "page-slash";
        pageSlash.textContent = "/";

        const pageCount = document.createElement("span");
        pageCount.id = "page-count";

        page.appendChild(pageCurrent);
        page.appendChild(pageSlash);
        page.appendChild(pageCount);
        parent.appendChild(page);

        for (let i = 0; i < 6; i++) {
            const label = document.createElement("div");
            label.classList.add("label", "s-text");
            const labelLeft = document.createElement("span");
            labelLeft.id = "label-" + i + "-left";
            labelLeft.classList.add("fmc-block", "label", "label-left");
            const labelRight = document.createElement("span");
            labelRight.id = "label-" + i + "-right";
            labelRight.classList.add("fmc-block", "label", "label-right");
            const labelCenter = document.createElement("span");
            labelCenter.id = "label-" + i + "-center";
            labelCenter.classList.add("fmc-block", "label", "label-center");
            label.appendChild(labelLeft);
            label.appendChild(labelRight);
            label.appendChild(labelCenter);
            parent.appendChild(label);
            const line = document.createElement("div");
            line.classList.add("line");
            const lineLeft = document.createElement("span");
            lineLeft.id = "line-" + i + "-left";
            lineLeft.classList.add("fmc-block", "line", "line-left");
            const lineRight = document.createElement("span");
            lineRight.id = "line-" + i + "-right";
            lineRight.classList.add("fmc-block", "line", "line-right");
            const lineCenter = document.createElement("span");
            lineCenter.id = "line-" + i + "-center";
            lineCenter.classList.add("fmc-block", "line", "line-center");
            line.appendChild(lineLeft);
            line.appendChild(lineRight);
            line.appendChild(lineCenter);
            parent.appendChild(line);
        }
        const footer = document.createElement("div");
        footer.classList.add("line");
        const inout = document.createElement("span");
        inout.id = "in-out";

        this.arrowVertical = document.createElement("span");
        this.arrowVertical.id = "arrow-vertical";
        this.arrowVertical.innerHTML = "↓↑\xa0";

        footer.appendChild(inout);
        footer.appendChild(this.arrowVertical);
        parent.appendChild(footer);
    }

    /* END OF MCDU INTERFACE/LAYOUT */
    /* MCDU SCRATCHPAD */

    get inOut() {
        return this.getInOut();
    }

    getInOut() {
        if (this._inOut === undefined) {
            this._inOut = this._inOutElement.textContent;
        }
        return this._inOut;
    }

    set inOut(v) {
        this.setInOut(v);
    }

    setInOut(content) {
        this._inOut = content;
        this._inOutElement.textContent = this._inOut;
    }

    forceClearScratchpad() {
        this.inOut = "";
        this.lastUserInput = "";
        this.isDisplayingErrorMessage = false;
        this.isDisplayingTypeTwoMessage = false;
        this.tryShowMessage();
    }

    lastUserInputToScratchpad() {
        this.inOut = this.lastUserInput;
        this.lastUserInput = "";
    }

    handlePreviousInputState() {
        if (this.inOut === FMCMainDisplay.clrValue) {
            this.inOut = "";
        }
        if (this.isDisplayingErrorMessage || this.isDisplayingTypeTwoMessage) {
            this.lastUserInputToScratchpad();
            this._inOutElement.className = "white";
            this.isDisplayingErrorMessage = false;
            this.isDisplayingTypeTwoMessage = false;
        }
    }

    clearUserInput() {
        if (!this.isDisplayingErrorMessage && !this.isDisplayingTypeTwoMessage) {
            this.lastUserInput = this.inOut;
            this.inOut = "";
            this._inOutElement.className = "white";
        }
        return this.lastUserInput;
    }

    tryClearOldUserInput() {
        if (!this.isDisplayingErrorMessage && !this.isDisplayingTypeTwoMessage) {
            this.lastUserInput = "";
        }
        this.tryShowMessage();
    }

    /**
     * This handler will write data to the scratchpad
     * @param data {string}
     */
    sendDataToScratchpad(data) {
        this.isDisplayingErrorMessage = false;
        this.isDisplayingTypeTwoMessage = false;
        this._inOutElement.className = "white";
        this.inOut = data;
    }

    /* END OF MCDU SCRATCHPAD */
    /* MCDU MESSAGE SYSTEM */

    /**
     * General message handler
     * @param msg {{text, isAmber, isTypeTwo}} Message Object
     * @param c {function} Function that checks for validity of error message (typeII only)
     * @param f {function} Function gets executed when error message has been cleared (typeII only)
     */
    addNewMessage(msg, c = () => {}, f = () => {
        return false;
    }) {
        if (msg.isTypeTwo) {
            this._addTypeTwoMessage(msg.text, msg.isAmber, c, f);
        } else {
            this._showTypeOneMessage(msg.text, msg.isAmber);
        }
    }

    _showTypeOneMessage(message, color = false) {
        if (!this.isDisplayingErrorMessage && !this.isDisplayingTypeTwoMessage && !this.lastUserInput) {
            this.lastUserInput = this.inOut;
        }
        this.isDisplayingErrorMessage = true;
        this.inOut = message;
        this._inOutElement.className = color ? "amber" : "white";
    }

    /**
     * Add Type II Message
     * @param message {string} Message to be displayed
     * @param isAmber {boolean} Is color amber
     * @param c {function} Function that checks for validity of error message
     * @param f {function} Function gets executed when error message has been cleared
     */
    _addTypeTwoMessage(message, isAmber, c, f) {
        if (this.checkForMessage(message)) {
            // Before adding message to queue, check other messages in queue for validity
            for (let i = 0; i < this.messageQueue.length; i++) {
                if (this.messageQueue[i][2](this)) {
                    this.messageQueue.splice(i, 1);
                }
            }
            this.messageQueue.unshift([message, isAmber, c, f]);
            if (this.messageQueue.length > 5) {
                this.messageQueue.splice(5, 1);
            }
            this.tryShowMessage();
        }
    }

    tryShowMessage() {
        if (!this.isDisplayingErrorMessage && (!this.inOut || this.isDisplayingTypeTwoMessage) && this.messageQueue.length > 0) {
            if (this.messageQueue[0][2](this)) {
                this.messageQueue.splice(0, 1);
                this._inOutElement.className = "white";
                this.lastUserInputToScratchpad();
                return this.tryShowMessage();
            }
            if (!this.isDisplayingErrorMessage) {
                if (!this.isDisplayingTypeTwoMessage) {
                    this.isDisplayingTypeTwoMessage = true;
                    this.lastUserInput = this.inOut;
                }
                this.inOut = this.messageQueue[0][0];
                this._inOutElement.className = this.messageQueue[0][1] ? "amber" : "white";
            }
        }
    }

    /**
     * Removes Type II Message
     * @param message {string} Message to be removed
     */
    tryRemoveMessage(message = this.inOut) {
        for (let i = 0; i < this.messageQueue.length; i++) {
            if (this.messageQueue[i][0] === message) {
                this.messageQueue[i][3](this);
                this.messageQueue.splice(i, 1);
                if (i === 0 && this.isDisplayingTypeTwoMessage) {
                    this._inOutElement.className = "white";
                    this.lastUserInputToScratchpad();
                }
                break;
            }
        }
        this.tryShowMessage();
    }

    checkForMessage(message) {
        if (!message) {
            return false;
        }
        for (let i = 0; i < this.messageQueue.length; i++) {
            if (this.messageQueue[i][0] === message) {
                if (i !== 0) {
                    this.messageQueue.unshift(this.messageQueue[i]);
                    this.messageQueue.splice(i + 1, 1);
                    this.tryShowMessage();
                }
                return false;
            }
        }
        return true;
    }

    /* END OF MCDU MESSAGE SYSTEM */
    /* MCDU EVENTS */

    onPowerOn() {
        super.onPowerOn();
    }

    onEvent(_event) {
        super.onEvent(_event);

        if (_event.indexOf("1_BTN_") !== -1 || _event.indexOf("2_BTN_") !== -1 || _event.indexOf("BTN_") !== -1) {
            const input = _event.replace("1_BTN_", "").replace("2_BTN_", "").replace("BTN_", "");
            if (this.onInputAircraftSpecific(input)) {
                return;
            }
            if (input === "INIT") {
                this.onInit();
            } else if (input === "DEPARR") {
                this.onDepArr();
            } else if (input === "ATC") {
                this.onAtc();
            } else if (input === "FIX") {
                this.onFix();
            } else if (input === "HOLD") {
                this.onHold();
            } else if (input === "FMCCOMM") {
                this.onFmcComm();
            } else if (input === "PROG") {
                this.onProg();
            } else if (input === "MENU") {
                this.onMenu();
            } else if (input === "NAVRAD") {
                this.onRad();
            } else if (input === "PREVPAGE") {
                const cur = this.page.Current;
                setTimeout(() => {
                    if (this.page.Current === cur) {
                        this.onPrevPage();
                    }
                }, this.getDelaySwitchPage());
            } else if (input === "NEXTPAGE") {
                const cur = this.page.Current;
                setTimeout(() => {
                    if (this.page.Current === cur) {
                        this.onNextPage();
                    }
                }, this.getDelaySwitchPage());
            } else if (input === "SP") {
                setTimeout(() => {
                    this.onSp();
                }, this.getDelaySwitchPage());
            } else if (input === "DEL") {
                setTimeout(() => {
                    this.onDel();
                }, this.getDelaySwitchPage());
            } else if (input === "CLR") {
                setTimeout(() => {
                    this.onClr();
                }, this.getDelaySwitchPage());
            } else if (input === "DIV") {
                setTimeout(() => {
                    this.onDiv();
                }, this.getDelaySwitchPage());
            } else if (input === "DOT") {
                setTimeout(() => {
                    this.handlePreviousInputState();
                    this.inOut += ".";
                }, this.getDelaySwitchPage());
            } else if (input === "PLUSMINUS") {
                setTimeout(() => {
                    this.handlePreviousInputState();
                    const val = this.inOut;
                    if (val === "") {
                        this.inOut = "-";
                    } else if (val !== FMCMainDisplay.clrValue && (!this.isDisplayingErrorMessage || !this.isDisplayingTypeTwoMessage)) {
                        if (val.slice(-1) === "-") {
                            this.inOut = this.inOut.slice(0, -1) + "+";
                        } else if (val.slice(-1) === "+") {
                            this.inOut = this.inOut.slice(0, -1) + "-";
                        } else {
                            this.inOut += "-";
                        }
                    }
                }, this.getDelaySwitchPage());
            } else if (input === "Localizer") {
                this._apLocalizerOn = !this._apLocalizerOn;
            } else if (input.length === 2 && input[0] === "L") {
                const v = parseInt(input[1]);
                if (isFinite(v)) {
                    if (this.onLeftInput[v - 1]) {
                        const value = this.clearUserInput();
                        const cur = this.page.Current;
                        setTimeout(() => {
                            if (this.page.Current === cur) {
                                this.onLeftInput[v - 1](value);
                                this.tryClearOldUserInput();
                            }
                        }, this.leftInputDelay[v - 1] ? this.leftInputDelay[v - 1](value) : this.getDelayBasic());
                    }
                }
            } else if (input.length === 2 && input[0] === "R") {
                const v = parseInt(input[1]);
                if (isFinite(v)) {
                    if (this.onRightInput[v - 1]) {
                        const value = this.clearUserInput();
                        const cur = this.page.Current;
                        setTimeout(() => {
                            if (this.page.Current === cur) {
                                this.onRightInput[v - 1](value);
                                this.tryClearOldUserInput();
                            }
                        }, this.rightInputDelay[v - 1] ? this.rightInputDelay[v - 1]() : this.getDelayBasic());
                    }
                }
            } else if (input.length === 1 && FMCMainDisplay._AvailableKeys.indexOf(input) !== -1) {
                setTimeout(() => {
                    this.onLetterInput(input);
                }, this.getDelaySwitchPage());
            } else {
                console.log("'" + input + "'");
            }
        }
    }

    onInputAircraftSpecific(input) {
        if (input === "DIR") {
            if (this.onDir) {
                this.onDir();
                this.activeSystem = 'FMGC';
            }
            return true;
        } else if (input === "PROG") {
            if (this.onProg) {
                this.onProg();
                this.activeSystem = 'FMGC';
            }
            return true;
        } else if (input === "PERF") {
            if (this.onPerf) {
                this.onPerf();
                this.activeSystem = 'FMGC';
            }
            return true;
        } else if (input === "INIT") {
            if (this.onInit) {
                this.onInit();
                this.activeSystem = 'FMGC';
            }
            return true;
        } else if (input === "DATA") {
            if (this.onData) {
                this.onData();
                this.activeSystem = 'FMGC';
            }
            return true;
        } else if (input === "FPLN") {
            if (this.onFpln) {
                this.onFpln();
                this.activeSystem = 'FMGC';
            }
            return true;
        } else if (input === "RAD") {
            if (this.onRad) {
                this.onRad();
                this.activeSystem = 'FMGC';
            }
            return true;
        } else if (input === "FUEL") {
            if (this.onFuel) {
                this.onFuel();
                this.activeSystem = 'FMGC';
            }
            return true;
        } else if (input === "SEC") {
            if (this.onSec) {
                this.onSec();
                this.activeSystem = 'FMGC';
            }
            return true;
        } else if (input === "ATC") {
            if (this.onAtc) {
                this.onAtc();
                this.activeSystem = 'FMGC';
            }
            return true;
        } else if (input === "MENU") {
            if (this.onMenu) {
                this.onMenu();
                // } else if (input === "MCDU") {
                //     if (this.onMcdu) {
                //         this.onMcdu();
            }
            return true;
        } else if (input === "AIRPORT") {
            if (this.onAirport) {
                this.onAirport();
                this.activeSystem = 'FMGC';
            }
            return true;
        } else if (input === "UP") {
            if (this.onUp) {
                this.onUp();
            }
            return true;
        } else if (input === "DOWN") {
            if (this.onDown) {
                this.onDown();
            }
            return true;
        } else if (input === "LEFT") {
            if (this.onLeft) {
                this.onLeft();
            }
            return true;
        } else if (input === "RIGHT") {
            if (this.onRight) {
                this.onRight();
            }
        } else if (input === "OVFY") {
            if (this.onOvfy) {
                this.onOvfy();
            }
            return true;
        }
        return false;
    }

    /* END OF MCDU EVENTS */
    /* MCDU DELAY SIMULATION */

    /**
     * Used for switching pages
     * @returns {number} delay in ms between 150 and 200
     */
    getDelaySwitchPage() {
        return 150 + 50 * Math.random();
    }

    /**
     * Used for basic inputs e.g. alternate airport, ci, fl, temp, constraints, ...
     * @returns {number} delay in ms between 300 and 400
     */
    getDelayBasic() {
        return 300 + 100 * Math.random();
    }

    /**
     * Used for e.g. loading time fore pages
     * @returns {number} delay in ms between 600 and 800
     */
    getDelayMedium() {
        return 600 + 200 * Math.random();
    }

    /**
     * Used for intense calculation
     * @returns {number} delay in ms between 900 and 12000
     */
    getDelayHigh() {
        return 900 + 300 * Math.random();
    }

    /**
     * Used for changes to the flight plan
     * @returns {number} dynamic delay in ms between ~300 and up to +2000 (depending on additional conditions)
     */
    getDelayRouteChange() {
        if (this._zeroFuelWeightZFWCGEntered && this._blockFuelEntered) {
            return Math.pow(this.flightPlanManager.getWaypointsCount(), 2) + (this.flightPlanManager.getDestination().cumulativeDistanceInFP) / 10 + Math.random() * 300;
        } else {
            return 300 + this.flightPlanManager.getWaypointsCount() * Math.random() + this.flightPlanManager.getDestination().cumulativeDistanceInFP * Math.random();
        }
    }

    /**
     * Used for calculation time for fuel pred page
     * @returns {number} dynamic delay in ms between 2000ms and 4000ms
     */
    getDelayFuelPred() {
        return 225 * this.flightPlanManager.getWaypointsCount() + (this.flightPlanManager.getDestination().cumulativeDistanceInFP / 2);
    }

    /**
     * Used to load wind data into fms
     * @returns {number} dynamic delay in ms dependent on amount of waypoints
     */
    getDelayWindLoad() {
        return Math.pow(this.flightPlanManager.getWaypointsCount(), 2);
    }

    /**
     * Tries to delete a pages timeout
     */
    tryDeleteTimeout() {
        if (this.page.SelfPtr) {
            clearTimeout(this.page.SelfPtr);
            this.page.SelfPtr = false;
        }
    }

    /* END OF MCDU DELAY SIMULATION */
    /* MCDU AOC MESSAGE SYSTEM */

    // INCOMING AOC MESSAGES
    getMessages() {
        return this.messages;
    }

    getMessage(id, type) {
        const messages = this.messages;
        const currentMessageIndex = messages.findIndex(m => m["id"].toString() === id.toString());
        if (type === 'previous') {
            if (messages[currentMessageIndex - 1]) {
                return messages[currentMessageIndex - 1];
            }
            return null;
        } else if (type === 'next') {
            if (messages[currentMessageIndex + 1]) {
                return messages[currentMessageIndex + 1];
            }
            return null;
        }
        return messages[currentMessageIndex];
    }

    getMessageIndex(id) {
        return this.messages.findIndex(m => m["id"].toString() === id.toString());
    }

    addMessage(message) {
        this.messages.unshift(message);
        const cMsgCnt = SimVar.GetSimVarValue("L:A32NX_COMPANY_MSG_COUNT", "Number");
        SimVar.SetSimVarValue("L:A32NX_COMPANY_MSG_COUNT", "Number", cMsgCnt + 1);
        if (this.refreshPageCallback) {
            this.refreshPageCallback();
        }
    }

    deleteMessage(id) {
        if (!this.messages[id]["opened"]) {
            const cMsgCnt = SimVar.GetSimVarValue("L:A32NX_COMPANY_MSG_COUNT", "Number");
            SimVar.SetSimVarValue("L:A32NX_COMPANY_MSG_COUNT", "Number", cMsgCnt <= 1 ? 0 : cMsgCnt - 1);
        }
        this.messages.splice(id, 1);
    }

    // OUTGOING/SENT AOC MESSAGES
    getSentMessages() {
        return this.sentMessages;
    }

    getSentMessage(id, type) {
        const messages = this.sentMessages;
        const currentMessageIndex = messages.findIndex(m => m["id"].toString() === id.toString());
        if (type === 'previous') {
            if (messages[currentMessageIndex - 1]) {
                return messages[currentMessageIndex - 1];
            }
            return null;
        } else if (type === 'next') {
            if (messages[currentMessageIndex + 1]) {
                return messages[currentMessageIndex + 1];
            }
            return null;
        }
        return messages[currentMessageIndex];
    }

    getSentMessageIndex(id) {
        return this.sentMessages.findIndex(m => m["id"].toString() === id.toString());
    }

    addSentMessage(message) {
        this.sentMessages.unshift(message);
    }

    deleteSentMessage(id) {
        this.sentMessages.splice(id, 1);
    }

    printPage(lines) {
        if (this.printing) {
            return;
        }
        this.printing = true;
        for (let i = 0; i < lines.length; i++) {
            let value = lines[i];
            value = value.replace(/\[color]cyan/g, "<br/>");
            value = value.replace(/(\[color][a-z]*)/g, "");
            value = value.replace(/-{3,}/g, "<br/><br/>");
            for (let j = 0; j < value.length; j++) {
                SimVar.SetSimVarValue(`L:A32NX_PRINT_${i}_${j}`, "number", value.charCodeAt(j));
            }
            SimVar.SetSimVarValue(`L:A32NX_PRINT_LINE_LENGTH_${i}`, "number", value.length);
        }
        if (SimVar.GetSimVarValue("L:A32NX_PRINTER_PRINTING", "bool") === 1) {
            SimVar.SetSimVarValue("L:A32NX_PAGES_PRINTED", "number", SimVar.GetSimVarValue("L:A32NX_PAGES_PRINTED", "number") + 1);
            SimVar.SetSimVarValue("L:A32NX_PRINT_PAGE_OFFSET", "number", 0);
        }
        SimVar.SetSimVarValue("L:A32NX_PRINT_LINES", "number", lines.length);
        SimVar.SetSimVarValue("L:A32NX_PAGE_ID", "number", SimVar.GetSimVarValue("L:A32NX_PAGE_ID", "number") + 1);
        SimVar.SetSimVarValue("L:A32NX_PRINTER_PRINTING", "bool", 0);
        setTimeout(() => {
            SimVar.SetSimVarValue("L:A32NX_PRINTER_PRINTING", "bool", 1);
            this.printing = false;
        }, 2500);
    }

    /* END OF MCDU AOC MESSAGE SYSTEM */
}
registerInstrument("a320-neo-cdu-main-display", A320_Neo_CDU_MainDisplay);
