class CDUAvailableDeparturesPage {
    static ShowPage(mcdu, airport, pageCurrent = 0, sidSelection = false) {
        const airportInfo = airport.infos;
        console.log(airportInfo);
        if (airportInfo instanceof AirportInfo) {
            mcdu.clearDisplay();
            mcdu.page.Current = mcdu.page.AvailableDeparturesPage;
            let selectedRunwayCell = "---";
            let selectedRunwayCellColor = "white";
            const selectedRunway = mcdu.flightPlanManager.getDepartureRunway();
            if (selectedRunway) {
                selectedRunwayCell = Avionics.Utils.formatRunway(selectedRunway.designation);
                selectedRunwayCellColor = mcdu.flightPlanManager.getCurrentFlightPlanIndex() === 1 ? "yellow" : "green";
            }
            let selectedSidCell = "------";
            let selectedSidCellColor = "white";
            let selectedTransCell = "------";
            let selectedTransCellColor = "white";
            let departureEnRouteTransition;
            const selectedDeparture = airportInfo.departures[mcdu.flightPlanManager.getDepartureProcIndex()];
            if (selectedDeparture) {
                selectedSidCell = selectedDeparture.name;
                selectedSidCellColor = mcdu.flightPlanManager.getCurrentFlightPlanIndex() === 1 ? "yellow" : "green";
                const departureEnRouteTransitionIndex = mcdu.flightPlanManager.getDepartureEnRouteTransitionIndex();
                if (departureEnRouteTransitionIndex > -1) {
                    departureEnRouteTransition = selectedDeparture.enRouteTransitions[departureEnRouteTransitionIndex];
                    if (departureEnRouteTransition) {
                        selectedTransCell = departureEnRouteTransition.name;
                    } else {
                        selectedTransCell = "NONE";
                    }
                    selectedTransCellColor = mcdu.flightPlanManager.getCurrentFlightPlanIndex() === 1 ? "yellow" : "green";
                }
            }
            let doInsertRunwayOnly = false;
            let insertRow = ["<RETURN"];
            mcdu.onLeftInput[5] = () => {
                CDUFlightPlanPage.ShowPage(mcdu);
            };
            const runways = airportInfo.oneWayRunways;
            const rows = [[""], [""], [""], [""], [""], [""], [""], [""]];
            if (!sidSelection) {
                for (let i = 0; i < 4; i++) {
                    const index = i + pageCurrent;
                    const runway = runways[index];
                    if (runway) {
                        rows[2 * i] = [
                            "{" + Avionics.Utils.formatRunway(runway.designation) + "[color]cyan",
                            "",
                            runway.length.toFixed(0) + "{small}M{end}[color]cyan"
                        ];
                        rows[2 * i + 1] = ["{sp}{sp}{sp}{sp}" + Utils.leadingZeros(Math.round((runway.direction)), 3) + "[color]cyan",];
                        mcdu.onLeftInput[i + 1] = async () => {
                            mcdu.setOriginRunwayIndex(index, () => {
                                CDUAvailableDeparturesPage.ShowPage(mcdu, airport, 0, true);
                            });
                        };
                    }
                }
            } else {
                doInsertRunwayOnly = true;
                insertRow = ["{ERASE[color]amber", "INSERT*[color]amber"];
                mcdu.onRightInput[5] = () => {
                    mcdu.insertTemporaryFlightPlan(() => {
                        mcdu.updateConstraints();
                        mcdu.onToRwyChanged();
                        CDUPerformancePage.UpdateThrRedAccFromOrigin(mcdu, true, true);
                        CDUPerformancePage.UpdateEngOutAccFromOrigin(mcdu);
                        CDUFlightPlanPage.ShowPage(mcdu, 0);
                    });
                };
                let rowIndex = -pageCurrent + 1;
                let index = 0;
                rows[0] = ["{NONE[color]cyan"];
                mcdu.onLeftInput[rowIndex + 1] = () => {
                    mcdu.setDepartureIndex(-1, () => {
                        CDUAvailableDeparturesPage.ShowPage(mcdu, airport);
                    });
                };
                while (rowIndex < 4 && index < airportInfo.departures.length) {
                    const sid = airportInfo.departures[index];
                    const scopout = index;
                    let transitionIndex = 0;
                    index++;
                    if (sid) {
                        let sidMatchesSelectedRunway = false;
                        if (!selectedRunway) {
                            sidMatchesSelectedRunway = true;
                        } else {
                            for (let j = 0; j < sid.runwayTransitions.length; j++) {
                                if (sid.runwayTransitions[j].name.indexOf(selectedRunway.designation) !== -1) {
                                    sidMatchesSelectedRunway = true;
                                    transitionIndex = j;
                                    break;
                                }
                            }
                        }
                        if (sidMatchesSelectedRunway) {
                            if (rowIndex >= 1) {
                                rows[2 * rowIndex] = ["{" + sid.name + "[color]cyan"];
                                mcdu.onLeftInput[rowIndex + 1] = () => {
                                    mcdu.setRunwayIndex(transitionIndex, (success) => {
                                        mcdu.setDepartureIndex(scopout, () => {
                                            CDUAvailableDeparturesPage.ShowPage(mcdu, airport, 0, true);
                                        });
                                    });
                                };
                            }
                            rowIndex++;
                        }
                    }
                }
                if (selectedDeparture) {
                    for (let i = 0; i < 4; i++) {
                        const enRouteTransitionIndex = i + pageCurrent;
                        const enRouteTransition = selectedDeparture.enRouteTransitions[enRouteTransitionIndex];
                        if (enRouteTransition) {
                            rows[2 * i][1] = enRouteTransition.name + "}[color]cyan";
                            mcdu.onRightInput[i + 1] = () => {
                                mcdu.flightPlanManager.setDepartureEnRouteTransitionIndex(enRouteTransitionIndex, () => {
                                    CDUAvailableDeparturesPage.ShowPage(mcdu, airport, 0, true);
                                });
                            };
                        }
                    }
                }
            }
            mcdu.setTemplate([
                ["DEPARTURES {small}FROM{end} {green}" + airport.ident + "{end}"],
                ["{sp}RWY", "TRANS{sp}", "{sp}SID"],
                [selectedRunwayCell + "[color]" + selectedRunwayCellColor, selectedTransCell + "[color]" + selectedTransCellColor, selectedSidCell + "[color]" + selectedSidCellColor],
                sidSelection ? ["SIDS", "TRANS", "AVAILABLE"] : ["", "", "RUNWAYS AVAILABLE"],
                rows[0],
                rows[1],
                rows[2],
                rows[3],
                rows[4],
                rows[5],
                rows[6],
                rows[7],
                insertRow
            ]);
            let maxPage = 0;
            if (sidSelection) {
                if (selectedRunway) {
                    for (const departure of airportInfo.departures) {
                        for (const transition of departure.runwayTransitions) {
                            if (transition.name.indexOf(selectedRunway.designation) !== -1) {
                                maxPage++;
                                break;
                            }
                        }
                    }
                    maxPage -= 3;
                } else {
                    maxPage = airportInfo.departures.length - 3;
                }
            } else {
                maxPage = airportInfo.oneWayRunways.length - 4;
            }
            let up = false;
            let down = false;
            if (pageCurrent < maxPage) {
                mcdu.onUp = () => {
                    pageCurrent++;
                    if (pageCurrent < 0) {
                        pageCurrent = 0;
                    }
                    CDUAvailableDeparturesPage.ShowPage(mcdu, airport, pageCurrent, sidSelection);
                };
                up = true;
            }
            if (pageCurrent > 0) {
                mcdu.onDown = () => {
                    pageCurrent--;
                    if (pageCurrent < 0) {
                        pageCurrent = 0;
                    }
                    CDUAvailableDeparturesPage.ShowPage(mcdu, airport, pageCurrent, sidSelection);
                };
                down = true;
            }
            mcdu.setArrows(up, down, true, true);
            mcdu.onPrevPage = () => {
                CDUAvailableDeparturesPage.ShowPage(mcdu, airport, 0, !sidSelection);
            };
            mcdu.onNextPage = mcdu.onPrevPage;
        }
    }
}
