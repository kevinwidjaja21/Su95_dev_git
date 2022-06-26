class CDUAtcMessagesRecord {
    static TranslateCpdlcResponse(response) {
        if (response !== undefined && response.Content !== undefined) {
            if (response.Content.TypeId === "DM0") {
                return "WILC";
            }
            if (response.Content.TypeId === "UM0" || response.Content.TypeId === "DM1") {
                return "UNBL";
            }
            if (response.Content.TypeId === "UM1" || response.Content.TypeId === "DM2") {
                return "STBY";
            }
            if (response.Content.TypeId === "UM3" || response.Content.TypeId === "DM3") {
                return "ROGR";
            }
            if (response.Content.TypeId === "UM4" || response.Content.TypeId === "DM4") {
                return "AFRM";
            }
            if (response.Content.TypeId === "UM5" || response.Content.TypeId === "DM5") {
                return "NEG";
            }
        }

        return "";
    }

    static ShowPage(mcdu, messages = null, offset = 0, confirmErase = false) {
        if (!messages) {
            messages = mcdu.atsu.atc.messages();
        }
        mcdu.clearDisplay();

        let eraseRecordTitle = "\xa0MSG RECORD";
        let eraseRecordButton = "*ERASE";
        if (confirmErase) {
            eraseRecordTitle = "\xa0ERASE MSG RECORD";
            eraseRecordButton = "*CONFIRM";
        }

        mcdu.refreshPageCallback = () => {
            this.ShowPage(mcdu, null, offset, false);
        };

        const msgHeadersLeft = [], msgHeadersRight = [], msgStart = [];
        msgHeadersLeft.length = msgHeadersRight.length = msgStart.length = 4;
        for (let i = 0; i < 5; ++i) {
            let headerLeft = "", headerRight = "", contentStart = "";

            if (messages.length > (offset + i) && messages[offset + i]) {
                headerLeft = `${messages[offset + i].Timestamp.dcduTimestamp()} ${messages[offset + i].Direction === Atsu.AtsuMessageDirection.Input ? "FROM" : "TO"} `;
                headerLeft += messages[offset + i].Station;
                headerRight = CDUAtcMessagesRecord.TranslateCpdlcResponse(messages[offset + i].Response);

                // ignore the headline with the station and the timestamp
                const lines = messages[offset + i].serialize(Atsu.AtsuMessageSerializationFormat.Printer).split("\n");
                let firstLine = "CPDLC";
                if (lines.length >= 2) {
                    firstLine = messages[offset + i].serialize(Atsu.AtsuMessageSerializationFormat.Printer).split("\n")[1];
                }
                if (firstLine.length <= 24) {
                    contentStart = firstLine;
                } else {
                    firstLine.split(" ").forEach((word) => {
                        if (contentStart.length + word.length + 1 < 24) {
                            contentStart += `${word}\xa0`;
                        }
                    });
                }
            }

            msgHeadersLeft[i] = headerLeft;
            msgHeadersRight[i] = headerRight;
            msgStart[i] = `${contentStart.length !== 0 ? "<" : ""}${contentStart}`;
        }

        let left = false, right = false;
        if (messages.length > offset + 4) {
            mcdu.onNextPage = () => {
                CDUAtcMessagesRecord.ShowPage(mcdu, messages, offset + 4, false);
            };
            right = true;
        }
        if (offset > 0) {
            mcdu.onPrevPage = () => {
                CDUAtcMessagesRecord.ShowPage(mcdu, messages, offset - 4, false);
            };
            left = true;
        }
        mcdu.setArrows(false, false, left, right);

        mcdu.setTemplate([
            ["MSG RECORD"],
            [msgHeadersLeft[0], `{big}${msgHeadersRight[0]}{end}`],
            [`${messages.length !== 0 ? msgStart[0] : "NO MESSAGES"}`],
            [msgHeadersLeft[1], `{big}${msgHeadersRight[1]}{end}`],
            [msgStart[1]],
            [msgHeadersLeft[2], `{big}${msgHeadersRight[2]}{end}`],
            [msgStart[2]],
            [msgHeadersLeft[3], `{big}${msgHeadersRight[3]}{end}`],
            [msgStart[3]],
            [eraseRecordTitle],
            [eraseRecordButton],
            ["\xa0ATC MENU", "MSG RECORD\xa0[color]inop"],
            ["<RETURN", "PRINT*[color]inop"]
        ]);

        for (let i = 0; i < 5; i++) {
            mcdu.leftInputDelay[i] = () => {
                return mcdu.getDelaySwitchPage();
            };

            mcdu.onLeftInput[i] = (value) => {
                if (messages[offset + i]) {
                    if (value === FMCMainDisplay.clrValue) {
                        mcdu.atsu.removeMessage(messages[offset + i].UniqueMessageID);
                        CDUAtcMessagesRecord.ShowPage(mcdu, null, offset, false);
                    } else {
                        CDUAtcMessage.ShowPage(mcdu, messages, offset + i);
                    }
                }
            };
        }

        mcdu.leftInputDelay[4] = () => {
            return mcdu.getDelaySwitchPage();
        };
        mcdu.onLeftInput[4] = () => {
            if (messages.length !== 0) {
                if (!confirmErase) {
                    CDUAtcMessagesRecord.ShowPage(mcdu, messages, offset, true);
                } else {
                    mcdu.atsu.atc.cleanupMessages();
                    CDUAtcMessagesRecord.ShowPage(mcdu, null, 0, false);
                }
            }
        };
        mcdu.leftInputDelay[5] = () => {
            return mcdu.getDelaySwitchPage();
        };
        mcdu.onLeftInput[5] = () => {
            CDUAtcMenu.ShowPage1(mcdu);
        };
    }
}
