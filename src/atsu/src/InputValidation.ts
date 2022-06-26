//  Copyright (c) 2022 FlyByWire Simulations
//  SPDX-License-Identifier: GPL-3.0

import { AtsuStatusCodes } from './AtsuStatusCodes';
import { FansMode } from './com/FutureAirNavigationSystem';
import { InputValidationFansA } from './components/InputValidationFansA';
import { InputValidationFansB } from './components/InputValidationFansB';

export enum InputWaypointType {
    Invalid,
    GeoCoordinate,
    Timepoint,
    Place
}

export class InputValidation {
    public static FANS: FansMode = FansMode.FansNone;

    /**
     * Checks if the value fits to a waypoint format
     * @param value The entered waypoint candidate
     * @returns AtsuStatusCodes.Ok if the format is valid
     */
    public static validateScratchpadWaypoint(value: string): AtsuStatusCodes {
        if (value.match(/^(N|S)?([0-9]{2,4}\.[0-9])(N|S)?\/(E|W)?([0-9]{2,5}\.[0-9])(E|W)?$/) !== null) {
            return AtsuStatusCodes.Ok;
        }
        if (/^[A-Z0-9]{1,5}$/.test(value)) {
            return AtsuStatusCodes.Ok;
        }
        return AtsuStatusCodes.FormatError;
    }

    /**
     * Checks if the value fits to a procedure format
     * @param value The entered procedure candidate
     * @returns AtsuStatusCodes.Ok if the format is valid
     */
    public static validateScratchpadProcedure(value: string): AtsuStatusCodes {
        if (/^[A-Z0-9]{1,7}$/.test(value)) {
            return AtsuStatusCodes.Ok;
        }
        return AtsuStatusCodes.FormatError;
    }

    /**
     * Checks if the value fits to the time format
     * @param value The entered time candidate
     * @returns AtsuStatusCodes.Ok if the format is valid
     */
    public static validateScratchpadTime(value: string): AtsuStatusCodes {
        if (/^[0-9]{4}Z$/.test(value)) {
            return AtsuStatusCodes.Ok;
        }
        return AtsuStatusCodes.FormatError;
    }

    /**
     * Checks if the value fits to the degree format
     * @param value The entered degree candidate
     * @returns AtsuStatusCodes.Ok if the format is valid
     */
    public static validateScratchpadDegree(value: string): AtsuStatusCodes {
        if (/^[0-9]{1,3}$/.test(value)) {
            const heading = parseInt(value);
            if (heading >= 0 && heading <= 360) {
                return AtsuStatusCodes.Ok;
            }
            return AtsuStatusCodes.EntryOutOfRange;
        }
        return AtsuStatusCodes.FormatError;
    }

    /**
     * Classifies a possible waypoint type of the scratchpad
     * Types:
     *   -  0 = lat-lon coordinate
     *   -  1 = time
     *   -  2 = place
     *   - -1 = unknonw
     * @param {FMCMainDisplay} mcdu The current MCDU instance
     * @param {string} waypoint The entered waypoint
     * @param {boolean} allowTime Indicates if time entries are allowed
     * @returns A tuple with the type and null or a NXSystemMessage-entry in case of a failure
     */
    public static async classifyScratchpadWaypointType(mcdu: any, waypoint: string, allowTime: boolean): Promise<[InputWaypointType, AtsuStatusCodes]> {
        if (mcdu.isLatLonFormat(waypoint)) {
            return [InputWaypointType.GeoCoordinate, AtsuStatusCodes.Ok];
        }

        // time formatted
        if (allowTime && /^([0-2][0-4][0-5][0-9]Z?)$/.test(waypoint)) {
            return [InputWaypointType.Timepoint, AtsuStatusCodes.Ok];
        }

        // place formatted
        if (/^[A-Z0-9]{2,7}/.test(waypoint)) {
            return mcdu.dataManager.GetWaypointsByIdent.bind(mcdu.dataManager)(waypoint).then((waypoints) => {
                if (waypoints.length !== 0) {
                    return [InputWaypointType.Place, AtsuStatusCodes.Ok];
                }
                return [InputWaypointType.Invalid, AtsuStatusCodes.NotInDatabase];
            });
        }

        return [InputWaypointType.Invalid, AtsuStatusCodes.FormatError];
    }

    /**
     * Validate a given VHF frequency that it fits to the 8.33 kHz-spacing
     * @param {string} value Frequency candidate
     * @returns null or a NXSystemMessages-entry in case of a failure
     */
    public static validateVhfFrequency(value: string): AtsuStatusCodes {
        // valid frequency range: 118.000 - 136.975
        if (!/^1[1-3][0-9].[0-9]{2}[0|5]$/.test(value)) {
            return AtsuStatusCodes.FormatError;
        }

        const elements = value.split('.');
        const before = parseInt(elements[0]);
        if (before < 118 || before > 136) {
            return AtsuStatusCodes.EntryOutOfRange;
        }

        // TODO replace by REGEX
        // valid 8.33 kHz spacings
        const frequencySpacingOther = ['00', '05', '10', '15', '25', '30', '35', '40', '50', '55', '60', '65', '75', '80', '85', '90'];
        const frequencySpacingEnd = ['00', '05', '10', '15', '25', '30', '35', '40', '50', '55', '60', '65', '75'];

        // validate the correct frequency fraction
        const twoDigitFraction = elements[1].substring(1, elements[1].length);
        if (before === 136) {
            if (frequencySpacingEnd.findIndex((entry) => entry === twoDigitFraction) === -1) {
                return AtsuStatusCodes.EntryOutOfRange;
            }
        } else if (frequencySpacingOther.findIndex((entry) => entry === twoDigitFraction) === -1) {
            return AtsuStatusCodes.EntryOutOfRange;
        }

        return AtsuStatusCodes.Ok;
    }

    /**
     * Validates a value that it is compatible with the FCOM format for altitudes and flight levels
     * @param {string} value The entered scratchpad altitude
     * @returns An AtsuStatusCodes-value
     */
    public static validateScratchpadAltitude(value: string): AtsuStatusCodes {
        if (/^((FL)*[0-9]{1,3})$/.test(value)) {
            const flightlevel = parseInt(value.match(/([0-9]+)/)[0]);
            if (flightlevel >= 30 && flightlevel <= 410) {
                return AtsuStatusCodes.Ok;
            }
            return AtsuStatusCodes.EntryOutOfRange;
        }

        if (InputValidation.FANS === FansMode.FansB) {
            return InputValidationFansB.validateScratchpadAltitude(value);
        }
        return InputValidationFansA.validateScratchpadAltitude(value);
    }

    /**
     * Checks if a string fits to the distance definition
     * @param distance The distance candidate
     * @returns AtsuStatusCodes.Ok if the format is valid
     */
    public static validateScratchpadDistance(distance: string): AtsuStatusCodes {
        if (/^[0-9]{1,3}(NM|KM)$/.test(distance) || /^[0-9]{1,3}$/.test(distance)) {
            return AtsuStatusCodes.Ok;
        }
        return AtsuStatusCodes.FormatError;
    }

    /**
     * Validates a value that it is compatible with the FCOM format for lateral offsets
     * @param {string} value The entered scratchpad offset
     * @returns An AtsuStatusCodes-value
     */
    public static validateScratchpadOffset(offset: string): AtsuStatusCodes {
        let nmUnit = true;
        let distance = 0;

        if (/^[LR][0-9]{1,3}(NM|KM)$/.test(offset) || /^[LR][0-9]{1,3}$/.test(offset)) {
            // format: DNNNKM, DNNNNM, DNNN
            distance = parseInt(offset.match(/([0-9]+)/)[0]);
            nmUnit = !offset.endsWith('KM');
        } else if (/^[0-9]{1,3}(NM|KM)[LR]$/.test(offset) || /^[0-9]{1,3}[LR]$/.test(offset)) {
            // format: NNNKMD, NNNNMD, NNND
            distance = parseInt(offset.match(/([0-9]+)/)[0]);
            nmUnit = !(offset.endsWith('KML') || offset.endsWith('KMR'));
        } else {
            return AtsuStatusCodes.FormatError;
        }

        // validate the ranges
        if (nmUnit) {
            if (distance >= 1 && distance <= 128) {
                return AtsuStatusCodes.Ok;
            }
        } else if (distance >= 1 && distance <= 256) {
            return AtsuStatusCodes.Ok;
        }

        return AtsuStatusCodes.EntryOutOfRange;
    }

    /**
     * Validates a value that it is compatible with the FCOM format for speeds
     * @param {string} value The entered scratchpad speed
     * @returns An AtsuStatusCodes-value
     */
    public static validateScratchpadSpeed(value: string): AtsuStatusCodes {
        if (InputValidation.FANS === FansMode.FansB) {
            return InputValidationFansB.validateScratchpadSpeed(value);
        }
        return InputValidationFansA.validateScratchpadSpeed(value);
    }

    /**
     * Validates that two speed entries describe the same (knots or mach)
     * @param {string} lower Lower speed value
     * @param {string} higher Higher speed value
     * @returns True if both are same type else false
     */
    private static sameSpeedType(lower: string, higher: string): boolean {
        if (lower[0] === 'M' && higher[0] === 'M') {
            return true;
        }
        if (lower[0] === 'M' || higher[0] === 'M') {
            return false;
        }
        return true;
    }

    /**
     * Validates that a scratchpad entry follows the FCOM definition for speed ranges
     * @param {string} Given speed range candidate
     * @returns An array of AtsuStatusCodes-value and the speed ranges
     */
    public static validateScratchpadSpeedRanges(value: string): [AtsuStatusCodes, string[]] {
        const entries = value.split('/');
        if (entries.length !== 2) {
            return [AtsuStatusCodes.FormatError, []];
        }
        if (InputValidation.validateScratchpadSpeed(entries[0]) || InputValidation.validateScratchpadSpeed(entries[1])) {
            let error = InputValidation.validateScratchpadSpeed(entries[0]);
            if (error) {
                return [error, []];
            }
            error = this.validateScratchpadSpeed(entries[1]);
            return [error, []];
        }

        const lower = InputValidation.formatScratchpadSpeed(entries[0]);
        const higher = InputValidation.formatScratchpadSpeed(entries[1]);

        if (!InputValidation.sameSpeedType(lower, higher)) {
            return [AtsuStatusCodes.FormatError, []];
        }
        if (parseInt(lower.match(/([0-9]+)/)[0]) >= parseInt(higher.match(/([0-9]+)/)[0])) {
            return [AtsuStatusCodes.EntryOutOfRange, []];
        }
        return [AtsuStatusCodes.Ok, [lower, higher]];
    }

    /**
     * Formats a scratchpad to a standard altitude string
     * @param {string} value The entered valid altitude
     * @returns Formatted string or empty string in case of a failure
     */
    public static formatScratchpadAltitude(value: string): string {
        if (value.startsWith('FL') || value.endsWith('M') || value.endsWith('FT')) {
            return value;
        }

        const altitude = parseInt(value);
        if (altitude >= 30 && altitude <= 410) {
            return `FL${value}`;
        }

        return `${value}FT`;
    }

    /**
     * Formats a scratchpad entry to the standard speed description
     * @param {string} value Valid speed entry
     * @returns The formatted speed string
     */
    public static formatScratchpadSpeed(value: string): string {
        if (value[0] === 'M' || value[0] === '.') {
            return `M.${value.match(/([0-9]+)/)[0]}`;
        }
        return value.replace('KT', '');
    }

    /**
     * Validates that two altitude entries describe the same (FL, feet or meters)
     * @param {string} lower Lower altitude value
     * @param {string} higher Higher altitude value
     * @returns True if both are same type else false
     */
    private static sameAltitudeType(lower: string, higher: string): boolean {
        if (lower.startsWith('FL') && higher.startsWith('FL')) {
            return true;
        }
        if (lower.startsWith('FL') || higher.startsWith('FL')) {
            return false;
        }
        if ((lower[lower.length - 1] === 'M' && higher[higher.length - 1] === 'M') || (lower[lower.length - 1] !== 'M' && higher[higher.length - 1] !== 'M')) {
            return true;
        }
        return false;
    }

    /**
     * Converts a given altitude into foot
     * @param value The altitude that needs to be converted
     * @returns The altitude in feet
     */
    private static convertToFeet(value: string): number {
        const height = parseInt(value.match(/([0-9]+)/)[0]);

        if (value.startsWith('FL')) {
            return height * 100;
        }
        if (value[value.length - 1] === 'M') {
            return height * 3.28;
        }
        if (value.endsWith('FT')) {
            return height;
        }

        if (height < 1000) return height * 100;

        return height;
    }

    /**
     * Validates that lower is smaller than higher
     * @param {string} lower Lower altitude value
     * @param {string} higher Higher altitude value
     * @returns True if lower is smaller than higher, else false
     */
    public static validateAltitudeRange(lower: string, higher: string): AtsuStatusCodes {
        if (!InputValidation.sameAltitudeType(lower, higher)) return AtsuStatusCodes.FormatError;

        const errorLower = InputValidation.validateScratchpadAltitude(lower);
        if (errorLower !== AtsuStatusCodes.Ok) return errorLower;
        const errorHigher = InputValidation.validateScratchpadAltitude(higher);
        if (errorHigher !== AtsuStatusCodes.Ok) return errorHigher;

        const lowerFt = InputValidation.convertToFeet(lower);
        const higherFt = InputValidation.convertToFeet(higher);

        if (lowerFt >= higherFt) return AtsuStatusCodes.EntryOutOfRange;

        return AtsuStatusCodes.Ok;
    }

    /**
     * Converts an FCOM valid encoded offset string to a list of offset entries
     * @param {string} offset Valid encoded offset
     * @returns The decoded offset entries
     */
    private static decodeOffsetString(offset: string): string[] | null {
        let nmUnit = true;
        let left = false;
        let distance;

        if (/^[LR][0-9]{1,3}(NM|KM)$/.test(offset) || /^[LR][0-9]{1,3}$/.test(offset)) {
            // format: DNNNKM, DNNNNM, DNNN

            // contains not only numbers
            distance = offset.replace(/NM|KM/, '').replace(/L|R/, '');
            if (/(?!^\d+$)^.+$/.test(distance)) {
                return [];
            }

            distance = parseInt(distance);
            nmUnit = !offset.endsWith('KM');
            left = offset[0] === 'L';
        } else if (/[0-9]{1,3}(NM|KM)[LR]/.test(offset) || /[0-9]{1,3}[LR]/.test(offset)) {
            // format: NNNKMD, NNNNMD, NNND

            // contains not only numbers
            distance = offset.replace(/NM|KM/, '').replace(/L|R/, '');
            if (/(?!^\d+$)^.+$/.test(distance)) {
                return null;
            }

            distance = parseInt(distance);
            nmUnit = !(offset.endsWith('KML') || offset.endsWith('KMR'));
            left = offset[offset.length - 1] === 'L';
        }

        return [left ? 'L' : 'R', distance.toString(), nmUnit ? 'NM' : 'KM'];
    }

    /**
     * Formats a valid scratchpad offset to a normalized offset entry
     * @param {string} value The scratchpad entry
     * @returns The normalized offset entry
     */
    public static formatScratchpadOffset(value: string): string {
        const entries = InputValidation.decodeOffsetString(value);
        return `${entries[0]}${entries[1]}${entries[2]}`;
    }

    /**
     * Expands a lateral offset encoded string into an expanded version
     * @param {string} offset The valid offset value
     * @returns The expanded lateral offset
     */
    public static expandLateralOffset(offset: string): string {
        const entries = InputValidation.decodeOffsetString(offset);
        return `${entries[1]}${entries[2]} ${entries[0] === 'L' ? 'LEFT' : 'RIGHT'}`;
    }
}
