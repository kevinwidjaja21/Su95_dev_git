class A32NX_PayloadConstructor {
    constructor() {
        this.paxStations = {
            rows1_5: {
                name: 'ROWS [1-5]',
                seats: 23,
                weight: 1955,
                pax: 0,
                paxTarget: 0,
                stationIndex: 0 + 2,
                position: 4.5,
                seatsRange: [1, 23],
                simVar: "SU95_PAX_TOTAL_ROWS_1_5"
            },
            rows6_10: {
                name: 'ROWS [6-10]',
                seats: 25,
                weight: 2125,
                pax: 0,
                paxTarget: 0,
                stationIndex: 1 + 2,
                position: 4.5,
                seatsRange: [24, 48],
                simVar: "SU95_PAX_TOTAL_ROWS_6_10"
            },
            rows11_15: {
                name: 'ROWS [11-15]',
                seats: 25,
                weight: 2125,
                pax: 0,
                paxTarget: 0,
                stationIndex: 2 + 2,
                position: -21,
                seatsRange: [49, 73],
                simVar: "SU95_PAX_TOTAL_ROWS_11_15"
            },
            rows16_20: {
                name: 'ROWS [16-20]',
                seats: 25,
                weight: 2125,
                pax: 0,
                paxTarget: 0,
                stationIndex: 3 + 2,
                position: -21,
                seatsRange: [74, 98],
                simVar: "SU95_PAX_TOTAL_ROWS_16_20"
            },
        };

        this.cargoStations = {
            fwdBag: {
                name: 'FWD BAGGAGE',
                weight: 1947,
                load: 0,
                stationIndex: 4 + 2,
                position: 3.5,
                visible: true,
                simVar: 'SU95_CARGO_FWD_BAGGAGE',
            },
            aftCont: {
                name: 'AFT BAGGAGE 1',
                weight: 580,
                load: 0,
                stationIndex: 5 + 2,
                position: -19,
                visible: true,
                simVar: 'SU95_CARGO_AFT_BAGGAGE_1',
            },
            aftBag: {
                name: 'AFT BAGGAGE 2',
                weight: 1213,
                load: 0,
                stationIndex: 6 + 2,
                position: -19,
                visible: true,
                simVar: 'SU95_CARGO_AFT_BAGGAGE_2',
            },
            aftBulk: {
                name: 'AFT BULK/LOOSE',
                weight: 460,
                load: 0,
                stationIndex: 7 + 2,
                position: -19,
                visible: true,
                simVar: 'SU95_CARGO_AFT_BULK_LOOSE',
            },
        };
    }
}
