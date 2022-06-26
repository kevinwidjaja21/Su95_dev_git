import { Common } from './common';

export class EngineModel {
    // In pounds of force. Used as a multiplier for results of table 1506 SSJ
    static maxThrust = 17760;

    /**
     * Table 1502 - CN2 vs CN1 @ Mach 0, 0.2, 0.9
     * n2_to_n1_table --> SSJ
     * @param i row index (n2)
     * @param j 1 = Mach 0, 2 = Mach 0.2, 3 = Mach 0.9
     * @returns Corrected N1 (CN1)
     */
    static table1502 = [
        [0, 0, 0.2, 0.9],
        [17.18454936, 0, 0, 0],
        [20.77253219, 2.132653061, 2.132653061, 2.132653061],
        [24.54935622, 2.806122449, 2.806122449, 2.806122449],
        [53.81974249, 14.36734694, 14.36734694, 14.36734694],
        [66, 22, 22, 22],
        [71.24492754, 26.51105651, 26.51105651, 26.51105651],
        [75.61076605, 32.03783686, 32.03783686, 32.03783686],
        [81.07660455, 41.77738824, 41.77738824, 41.77738824],
        [84.53830228, 52.002457, 52.002457, 52.002457],
        [88.36438923, 66.27764128, 66.27764128, 66.27764128],
        [91.09730849, 78.51351351, 78.51351351, 78.51351351],
        [94.74120083, 86.67076167, 86.67076167, 86.67076167],
        [110, 105, 105, 105],
    ];

    /**
     * Table 1503 - Turbine LoMach (0) CN2 vs. Throttle @ IAP Ratio 1.00000000, 1.20172257, 1.453783983, 2.175007333, 3.364755652, 4.47246108, 5.415178313
     * mach_0_corrected_commanded_ne_table --> Same as SSJ
     * @param i row index (thrust lever position)
     * @param j IAP ratio
     * @returns Corrected N2 (CN2)
     */
    static table1503 = [
        [0, 1.00000000, 1.20172257, 1.453783983, 2.175007333, 3.364755652, 4.47246108, 5.415178313],
        [0.000000, 68.200000, 69.402657, 70.671269, 73.432244, 76.544349, 78.644882, 78.644882],
        [0.100000, 76.000000, 77.340205, 78.753906, 81.830654, 85.298688, 87.639458, 87.639458],
        [0.200000, 83.000000, 84.463645, 86.007556, 89.367688, 93.155146, 95.711513, 95.711513],
        [0.400000, 92.800000, 94.436461, 96.162664, 99.919535, 104.154188, 107.012390, 107.012390],
        [0.600000, 98.000000, 99.728159, 101.551090, 105.518475, 109.990414, 113.008774, 113.008774],
        [0.750000, 101.500000, 103.289879, 105.177914, 109.286991, 113.918643, 117.044802, 117.044802],
        [0.900000, 103.000000, 104.816330, 106.000000, 110.902070, 115.602170, 118.774528, 118.774528],
        [1.000000, 104.200000, 106.037491, 107.975750, 112.194133, 116.948991, 120.158309, 120.158309],
    ];

    /**
     * Table 1504 - Turbine HiMach (0.9) CN2 vs. Throttle @ IAP Ratio 1.00000000, 1.20172257, 1.453783983, 2.175007333, 3.364755652, 4.47246108, 5.415178313
     * mach_hi_corrected_commanded_ne_table --> Same as SSJ
     * @param i row index (thrust ever position)
     * @param j IAP ratio
     * @returns Corrected N2 (CN2)
     */
    static table1504 = [
        [0, 1.00000000, 1.20172257, 1.453783983, 2.175007333, 3.364755652, 4.47246108, 5.415178313],
        [0.000000, 63.267593, 64.383271, 65.560133, 68.121427, 71.008456, 72.957073, 72.957073],
        [0.100000, 70.503476, 71.746753, 73.058212, 75.912441, 79.129658, 81.301137, 81.301137],
        [0.200000, 76.997217, 78.355007, 79.787258, 82.904376, 86.417916, 88.789399, 88.789399],
        [0.400000, 86.088455, 87.606562, 89.207922, 92.693086, 96.621477, 99.272967, 99.272967],
        [0.600000, 90.912377, 92.515550, 94.206642, 97.887095, 102.035612, 104.835676, 104.835676],
        [0.750000, 94.159247, 95.819677, 97.571165, 101.383063, 105.679741, 108.579808, 108.579808],
        [0.900000, 95.550763, 97.235732, 98.333795, 102.881334, 107.241510, 110.184435, 110.184435],
        [1.000000, 104.200000, 106.037491, 107.975750, 112.194133, 116.948991, 120.158309, 120.158309],
    ];

    /**
     * Table 1506 - Corrected net Thrust vs CN1 @ Mach 0 to 0.9 in 0.1 steps
     * n1_and_mach_on_thrust_table
     * @param i row index (CN1)
     * @param j mach
     * @returns Corrected net thrust (pounds of force)
     */
    static table1506 = [
        [0, 0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
        [0.000000, 0.000000, 0.000000, 0.000000, 0.000000, 0.000000, 0.000000, 0.000000, 0.000000, 0.000000, 0.000000],
        [20,0.0606902,0.040966677,0.024447102,0.011732209,-0.015369465,-0.0352764,-0.057252622,-0.21819146,-0.352276422,-0.573678571],
        [25,0.0971108,0.053026443,0.029986217,0.017197657,-0.008606291,-0.025280409,-0.02469632,-0.16040768,-0.296627314,-0.513035577],
        [30,0.132593843,0.061750546,0.033713934,0.02282692,0.015738,0.003817246,-0.027145835,-0.06022284,-0.091095136,-0.429711333],
        [35,0.187982249,0.096543691,0.062918648,0.039673725,0.022567632,0.005831511,-0.002843002,-0.024168,-0.077320246,-0.340031151],
        [40,0.242846062,0.127236626,0.102761227,0.060847218,0.053323505,0.047996049,0.03019593,0.05754104,0.059985365,-0.254330626],
        [45,0.296482415,0.199472172,0.131840527,0.099496992,0.084908235,0.074648291,0.057002233,0.01961954,-0.06348691,-0.177995938],
        [50,0.349343345,0.253023135,0.1806023,0.14166133,0.119363164,0.102586118,0.082705221,0.05026414,-0.008147031,-0.112476786],
        [55,0.402871618,0.30977408,0.234243083,0.189482206,0.159309385,0.134900765,0.110717403,0.0801996,0.03153024,-0.056242448],
        [60,0.481179945,0.371786148,0.294767699,0.245197048,0.207434765,0.174838418,0.144822558,0.11357688,0.070742025,-0.005698981],
        [65,0.546305892,0.441290081,0.364019839,0.310680669,0.265972607,0.225224296,0.188550625,0.154601,0.114173524,0.043942088],
        [70,0.620739308,0.520328667,0.443257382,0.386958756,0.336175863,0.287893286,0.244555243,0.20685052,0.166292433,0.09783718],
        [75,0.707854563,0.610381688,0.532709918,0.473714925,0.417781327,0.363113995,0.314003458,0.27262882,0.230642802,0.160725546],
        [80,0.803903778,0.71196148,0.631114623,0.568787529,0.508468535,0.449025812,0.395977981,0.35232704,0.309158955,0.236190547],
        [85,0.924225677,0.824201256,0.735245887,0.667652838,0.603316438,0.541061664,0.486887191,0.4438114,0.401517719,0.325953253],
        [90,1.06448508,0.9444133,0.839424,0.76289668,0.694251,0.63139122,0.57988424,0.54182218,0.50452092,0.4292233],
        [95,1.202481738,1.067648914,0.935012587,0.843683655,0.769495523,0.708352055,0.664301799,0.63740132,0.611498105,0.54207183],
        [100,1.299439338,1.18623106,1.009912447,0.895216675,0.813016911,0.755895655,0.725090353,0.69397246,0.664140455,0.587339133],
        [105,1.344885668,1.224096619,1.048037122,0.926416978,0.839063455,0.778045864,0.744410549,0.71067064,0.678451538,0.598558294],
        [110,1.384183206,1.25627596,1.082952918,0.954668349,0.862340414,0.797537978,0.761105218,0.72478454,0.690223385,0.607476343],
    ];

    /**
     * Placeholder
     * @param table
     * @param i
     * @param j
     * @returns
     */
    static tableInterpolation(table: number[][], i: number, j: number): number {
        const numRows = table.length;
        const numCols = table[0].length;
        // Iterate through rows to find the upper bound to i
        let r: number;
        for (r = 1; r < numRows; r++) {
            if (table[r][0] > i) {
                break;
            }
        }
        // Get lower bound to i
        const r1 = Math.max(1, r - 1);
        const r2 = Math.min(numRows - 1, r);
        // Iterate through rows to find the upper bound to j
        let c: number;
        for (c = 1; c < numCols; c++) {
            if (table[0][c] > j) {
                break;
            }
        }
        // Get the lower bound to j
        const c1 = Math.max(1, c - 1);
        const c2 = Math.min(numCols - 1, c);

        const interpolatedRowAtC1 = r1 === r2 ? table[r1][c1] : Common.interpolate(i, table[r1][0], table[r2][0], table[r1][c1], table[r2][c1]);
        const interpolatedRowAtC2 = r1 === r2 ? table[r1][c2] : Common.interpolate(i, table[r1][0], table[r2][0], table[r1][c2], table[r2][c2]);

        return Common.interpolate(j, table[0][c1], table[0][c2], interpolatedRowAtC1, interpolatedRowAtC2);
    }

    /**
     * Retrieve a bilinear interpolated row value from a table
     * @param table
     * @param j Value on column axis
     * @param result Value normally returned as result
     */
    static reverseTableInterpolation(table: number[][], j: number, result: number): number {
        const numRows = table.length;
        const numCols = table[0].length;

        let c: number;
        for (c = 1; c < numCols; c++) {
            if (table[0][c] > j) {
                break;
            }
        }
        const c1 = Math.max(1, c - 1);
        const c2 = Math.min(numCols - 1, c);

        let r: number;
        for (r = 1; r < numRows; r++) {
            if (table[r][c1] > result) {
                break;
            }
        }
        const r1 = Math.max(1, r - 1);
        const r2 = Math.min(numRows - 1, r);
        for (r = 1; r < numRows; r++) {
            if (table[r][c2] > result) {
                break;
            }
        }
        const r3 = Math.max(1, r - 1);
        const r4 = Math.min(numRows - 1, r);

        const interpolatedRowAtC1 = r1 === r2 ? table[r1][0] : Common.interpolate(result, table[r1][c1], table[r2][c1], table[r1][0], table[r2][0]);
        const interpolatedRowAtC2 = r3 === r4 ? table[r3][0] : Common.interpolate(result, table[r3][c2], table[r4][c2], table[r3][0], table[r4][0]);

        return Common.interpolate(j, table[0][c1], table[0][c2], interpolatedRowAtC1, interpolatedRowAtC2);
    }

    /**
     * Placeholder
     * @param cn1 corrected N1 %
     * @param mach mach value
     * @param alt altitude in feet
     * @returns fuel flow, in pounds per hour (per engine)
     */
    static getCorrectedFuelFlow(cn1: number, mach: number, alt: number): number {
        const coefficients = [-639.6602981, 0.00000e+00, 1.03705e+02, -2.23264e+03, 5.70316e-03, -2.29404e+00, 1.08230e+02,
            2.77667e-04, -6.17180e+02, -7.20713e-02, 2.19013e-07, 2.49418e-02, -7.31662e-01, -1.00003e-05,
            -3.79466e+01, 1.34552e-03, 5.72612e-09, -2.71950e+02, 8.58469e-02, -2.72912e-06, 2.02928e-11];

        const flow = coefficients[0] + coefficients[1] + (coefficients[2] * cn1) + (coefficients[3] * mach) + (coefficients[4] * alt)
                    + (coefficients[5] * cn1 ** 2) + (coefficients[6] * cn1 * mach) + (coefficients[7] * cn1 * alt)
                    + (coefficients[8] * mach ** 2) + (coefficients[9] * mach * alt) + (coefficients[10] * alt ** 2)
                    + (coefficients[11] * cn1 ** 3) + (coefficients[12] * cn1 ** 2 * mach) + (coefficients[13] * cn1 ** 2 * alt)
                    + (coefficients[14] * cn1 * mach ** 2) + (coefficients[15] * cn1 * mach * alt) + (coefficients[16] * cn1 * alt ** 2)
                    + (coefficients[17] * mach ** 3) + (coefficients[18] * mach ** 2 * alt) + (coefficients[19] * mach * alt ** 2)
                    + (coefficients[20] * alt ** 3);

        return flow * 0.88;
    }

    // static getCN1fromUncorrectedThrust(thrust: number)

    static getCorrectedN1(n1: number, theta2: number): number {
        return n1 / Math.sqrt(theta2);
    }

    static getUncorrectedN1(cn1: number, theta2: number): number {
        return cn1 * Math.sqrt(theta2);
    }

    static getUncorrectedN2(cn2: number, theta2: number): number {
        return cn2 * Math.sqrt(theta2);
    }

    static getUncorrectedThrust(correctedThrust: number, delta2: number): number {
        return correctedThrust * delta2;
    }

    static getUncorrectedFuelFlow(correctedFuelFlow: number, delta2: number, theta2: number): number {
        return correctedFuelFlow * delta2 * Math.sqrt(theta2);
    }

    static getCorrectedThrust(uncorrectedThrust: number, delta2: number): number {
        return uncorrectedThrust / delta2;
    }
}
