class A32NX_PayloadConstructor {
    constructor() {
        this.paxStations = {
            rows16_20: {
                name: 'ROWS [16-20]',
                seats: 25,
                weight: 2125,
                pax: 0,
                paxTarget: 0,
                stationIndex: 3 + 1,
                position: -20,
                seatsRange: [74, 98],
                simVar: "SU95_PAX_TOTAL_ROWS_16_20"
            },
            rows11_15: {
                name: 'ROWS [11-15]',
                seats: 25,
                weight: 2125,
                pax: 0,
                paxTarget: 0,
                stationIndex: 2 + 1,
                position: -20,
                seatsRange: [49, 73],
                simVar: "SU95_PAX_TOTAL_ROWS_11_15"
            },
            rows6_10: {
                name: 'ROWS [6-10]',
                seats: 25,
                weight: 2125,
                pax: 0,
                paxTarget: 0,
                stationIndex: 1 + 1,
                position: 13.5,
                seatsRange: [24, 48],
                simVar: "SU95_PAX_TOTAL_ROWS_6_10"
            },
            rows1_5: {
                name: 'ROWS [1-5]',
                seats: 23,
                weight: 1955,
                pax: 0,
                paxTarget: 0,
                stationIndex: 0 + 1,
                position: 13.5,
                seatsRange: [1, 23],
                simVar: "SU95_PAX_TOTAL_ROWS_1_5"
            },
        };

        this.cargoStations = {
            fwdBag: {
                name: 'FWD BAGGAGE',
                weight: 1947,
                load: 0,
                stationIndex: 4 + 1,
                position: 12.5,
                visible: true,
                simVar: 'SU95_CARGO_FWD_BAGGAGE',
            },
            aftCont: {
                name: 'AFT BAGGAGE 1',
                weight: 580,
                load: 0,
                stationIndex: 5 + 1,
                position: -18,
                visible: true,
                simVar: 'SU95_CARGO_AFT_BAGGAGE_1',
            },
            aftBag: {
                name: 'AFT BAGGAGE 2',
                weight: 1213,
                load: 0,
                stationIndex: 6 + 1,
                position: -18,
                visible: true,
                simVar: 'SU95_CARGO_AFT_BAGGAGE_2',
            },
            aftBulk: {
                name: 'AFT BULK/LOOSE',
                weight: 460,
                load: 0,
                stationIndex: 7 + 1,
                position: -18,
                visible: true,
                simVar: 'SU95_CARGO_AFT_BULK_LOOSE',
            },
        };
    }
}
