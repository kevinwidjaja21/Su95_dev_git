class CDUIRSMonitor {
    static ShowPage(mcdu) {
        mcdu.clearDisplay();
        mcdu.page.Current = mcdu.page.IRSMonitor;
        const checkAligned = SimVar.GetSimVarValue("L:A320_Neo_ADIRS_STATE", "Number") || 2;
        let IRSStatus;
        switch (checkAligned) {
            case 0:
                IRSStatus = "";
                break;
            case 1:
                IRSStatus = "ALIGN";
                break;
            case 2:
                IRSStatus = "NAV";
                break;
            default:
                IRSStatus = "NAV";
        }
        mcdu.setTemplate([
            ["IRS MONITOR"],
            [""],
            ["<IRS1"],
            [`\xa0${IRSStatus}[color]green`],
            ["<IRS2"],
            [`\xa0${IRSStatus}[color]green`],
            ["<IRS3"],
            [`\xa0${IRSStatus}[color]green`],
        ]);
        mcdu.leftInputDelay[0] = () => {
            return mcdu.getDelaySwitchPage();
        };
        mcdu.onLeftInput[0] = () => {
            CDUIRSStatus.ShowPage(mcdu, 1);
        };
        mcdu.leftInputDelay[1] = () => {
            return mcdu.getDelaySwitchPage();
        };
        mcdu.onLeftInput[1] = () => {
            CDUIRSStatus.ShowPage(mcdu, 2);
        };
        mcdu.leftInputDelay[2] = () => {
            return mcdu.getDelaySwitchPage();
        };
        mcdu.onLeftInput[2] = () => {
            CDUIRSStatus.ShowPage(mcdu, 3);
        };
    }
}
