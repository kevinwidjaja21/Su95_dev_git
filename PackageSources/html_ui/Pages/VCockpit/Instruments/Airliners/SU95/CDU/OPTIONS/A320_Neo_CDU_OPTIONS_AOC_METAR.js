class CDU_OPTIONS_METAR {
    static ShowPage(mcdu) {
        mcdu.clearDisplay();

        const storedMetarSrc = NXDataStore.get("CONFIG_METAR_SRC", "MSFS");

        let msfs = "*METEOBLUE (MSFS)[color]cyan";
        let avwx = "*AVWX (UNREAL WEATHER)[color]cyan";
        let vatsim = "*VATSIM[color]cyan";
        let pilotedge = "*PILOTEDGE[color]cyan";
        let ivao = "*IVAO[color]cyan";

        switch (storedMetarSrc) {
            case "AVWX":
                avwx = "AVWX (UNREAL WEATHER)[color]green";
                break;
            case "VATSIM":
                vatsim = "VATSIM[color]green";
                break;
            case "PILOTEDGE":
                pilotedge = "PILOTEDGE[color]green";
                break;
            case "IVAO":
                ivao = "IVAO[color]green";
                break;
            default:
                msfs = "METEOBLUE (MSFS)[color]green";
        }

        mcdu.setTemplate([
            ["A32NX OPTIONS AOC"],
            ["", "", "METAR UPLINK SRC"],
            [msfs],
            [""],
            [avwx],
            [""],
            [vatsim],
            [""],
            [pilotedge],
            [""],
            [ivao],
            [""],
            ["<RETURN"]
        ]);

        mcdu.leftInputDelay[0] = () => {
            return mcdu.getDelaySwitchPage();
        };
        mcdu.onLeftInput[0] = () => {
            if (storedMetarSrc != "MSFS") {
                NXDataStore.set("CONFIG_METAR_SRC", "MSFS");
                CDU_OPTIONS_METAR.ShowPage(mcdu);
            }
        };
        mcdu.leftInputDelay[1] = () => {
            return mcdu.getDelaySwitchPage();
        };
        mcdu.onLeftInput[1] = () => {
            mcdu.addNewMessage(NXFictionalMessages.notYetImplemented);
        };
        mcdu.leftInputDelay[2] = () => {
            return mcdu.getDelaySwitchPage();
        };
        mcdu.onLeftInput[2] = () => {
            if (storedMetarSrc != "VATSIM") {
                NXDataStore.set("CONFIG_METAR_SRC", "VATSIM");
                CDU_OPTIONS_METAR.ShowPage(mcdu);
            }
        };
        mcdu.leftInputDelay[3] = () => {
            return mcdu.getDelaySwitchPage();
        };
        mcdu.onLeftInput[3] = () => {
            if (storedMetarSrc != "PILOTEDGE") {
                NXDataStore.set("CONFIG_METAR_SRC", "PILOTEDGE");
                CDU_OPTIONS_METAR.ShowPage(mcdu);
            }
        };
        mcdu.leftInputDelay[4] = () => {
            return mcdu.getDelaySwitchPage();
        };
        mcdu.onLeftInput[4] = () => {
            if (storedMetarSrc != "IVAO") {
                NXDataStore.set("CONFIG_METAR_SRC", "IVAO");
                CDU_OPTIONS_METAR.ShowPage(mcdu);
            }
        };
        mcdu.leftInputDelay[5] = () => {
            return mcdu.getDelaySwitchPage();
        };
        mcdu.onLeftInput[5] = () => {
            CDU_OPTIONS_AOC.ShowPage(mcdu);
        };
    }
}
