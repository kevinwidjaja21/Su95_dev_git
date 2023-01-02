class A32NX_PayloadConstructor {
    constructor() {
        this.paxStations = {
            rows1_5: {
                name: 'ROWS [1-5]',
                seats: 23,
                weight: Math.round(NXUnits.kgToUser(1955)),
                pax: 0,
                paxTarget: 0,
                stationIndex: 0 + 1,
                position: 13.5,
                seatsRange: [1, 23],
                simVar: "SU95_PAX_TOTAL_ROWS_1_5"
            },
            rows6_10: {
                name: 'ROWS [6-10]',
                seats: 25,
                weight: Math.round(NXUnits.kgToUser(2125)),
                pax: 0,
                paxTarget: 0,
                stationIndex: 1 + 1,
                position: 13.5,
                seatsRange: [24, 48],
                simVar: "SU95_PAX_TOTAL_ROWS_6_10"
            },
            rows11_15: {
                name: 'ROWS [11-15]',
                seats: 25,
                weight: Math.round(NXUnits.kgToUser(2125)),
                pax: 0,
                paxTarget: 0,
                stationIndex: 2 + 1,
                position: -20,
                seatsRange: [49, 73],
                simVar: "SU95_PAX_TOTAL_ROWS_11_15"
            },
            rows16_20: {
                name: 'ROWS [16-20]',
                seats: 25,
                weight: Math.round(NXUnits.kgToUser(2125)),
                pax: 0,
                paxTarget: 0,
                stationIndex: 3 + 1,
                position: -20,
                seatsRange: [74, 98],
                simVar: "SU95_PAX_TOTAL_ROWS_16_20"
            },
        };

        this.cargoStations = {
            fwdBag: {
                name: 'FWD BAGGAGE',
                weight: Math.round(NXUnits.kgToUser(1947)),
                load: 0,
                stationIndex: 4 + 1,
                position: 12.5,
                visible: true,
                simVar: 'SU95_CARGO_FWD_BAGGAGE',
            },
            aftCont: {
                name: 'AFT BAGGAGE 1',
                weight: Math.round(NXUnits.kgToUser(580)),
                load: 0,
                stationIndex: 5 + 1,
                position: -18,
                visible: true,
                simVar: 'SU95_CARGO_AFT_BAGGAGE_1',
            },
            aftBag: {
                name: 'AFT BAGGAGE 2',
                weight: Math.round(NXUnits.kgToUser(1213)),
                load: 0,
                stationIndex: 6 + 1,
                position: -18,
                visible: true,
                simVar: 'SU95_CARGO_AFT_BAGGAGE_2',
            },
            aftBulk: {
                name: 'AFT BULK/LOOSE',
                weight: Math.round(NXUnits.kgToUser(460)),
                load: 0,
                stationIndex: 7 + 1,
                position: -18,
                visible: true,
                simVar: 'SU95_CARGO_AFT_BULK_LOOSE',
            },
        };
    }
}

const payloadConstruct = new A32NX_PayloadConstructor();
const paxStations = payloadConstruct.paxStations;
const cargoStations = payloadConstruct.cargoStations;
const MAX_SEAT_AVAILABLE = 98;

/**
     * Calculate %MAC ZWFCG of all stations
     */
function getZfwcg() {

    const leMacZ = -3.900; // Accurate to 3 decimals, replaces debug weight values
    const macSize = 11.950; // Accurate to 3 decimals, replaces debug weight values

    const emptyWeight = (SimVar.GetSimVarValue("EMPTY WEIGHT", getUserUnit()));
    const emptyPosition = -5.66; // Value from flight_model.cfg
    const emptyMoment = emptyPosition * emptyWeight;
    const PAX_WEIGHT = SimVar.GetSimVarValue("L:A32NX_WB_PER_PAX_WEIGHT", "Number");

    const paxTotalMass = Object.values(paxStations).map((station) => (SimVar.GetSimVarValue(`L:${station.simVar}`, "Number") * PAX_WEIGHT)).reduce((acc, cur) => acc + cur, 0);
    const paxTotalMoment = Object.values(paxStations).map((station) => (SimVar.GetSimVarValue(`L:${station.simVar}`, "Number") * PAX_WEIGHT) * station.position).reduce((acc, cur) => acc + cur, 0);

    const cargoTotalMass = Object.values(cargoStations).map((station) => SimVar.GetSimVarValue(`PAYLOAD STATION WEIGHT:${station.stationIndex}`, getUserUnit())).reduce((acc, cur) => acc + cur, 0);
    const cargoTotalMoment = Object.values(cargoStations).map((station) => (SimVar.GetSimVarValue(`PAYLOAD STATION WEIGHT:${station.stationIndex}`, getUserUnit()) * station.position)).reduce((acc, cur) => acc + cur, 0);

    const totalMass = emptyWeight + paxTotalMass + cargoTotalMass;
    const totalMoment = emptyMoment + paxTotalMoment + cargoTotalMoment;

    const cgPosition = totalMoment / totalMass;
    const cgPositionToLemac = cgPosition - leMacZ;
    const cgPercentMac = -100 * (cgPositionToLemac / macSize);

    return cgPercentMac;
}

function getTotalCargo() {
    const cargoTotalMass = Object.values(cargoStations).filter((station) => station.visible).map((station) => SimVar.GetSimVarValue(`PAYLOAD STATION WEIGHT:${station.stationIndex}`, getUserUnit())).reduce((acc, cur) => acc + cur, 0);
    return cargoTotalMass;
}

function getTotalPayload() {
    const paxTotalMass = Object.values(paxStations).map((station) => SimVar.GetSimVarValue(`PAYLOAD STATION WEIGHT:${station.stationIndex}`, getUserUnit())).reduce((acc, cur) => acc + cur, 0);
    const cargoTotalMass = getTotalCargo();
    return paxTotalMass + cargoTotalMass;
}

function getZfw() {
    const emptyWeight = (SimVar.GetSimVarValue("EMPTY WEIGHT", getUserUnit()));
    return emptyWeight + getTotalPayload();
}

function getUserUnit() {
    const defaultUnit = (NXUnits.userWeightUnit() == "KG") ? "Kilograms" : "Pounds";
    return defaultUnit;
}
