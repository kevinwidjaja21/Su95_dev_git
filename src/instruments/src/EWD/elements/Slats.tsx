import { useSimVar } from '@instruments/common/simVars';
import React, { useEffect, useState } from 'react';

type SlatsProps = {
    x: number,
    y: number,
};

const Slats: React.FC<SlatsProps> = ({ x, y }) => {
    const [slatsAngle] = useSimVar('L:A32NX_LEFT_SLATS_ANGLE', 'degrees', 100);
    const [targetSlatsAngle] = useSimVar('L:A32NX_LEFT_SLATS_TARGET_ANGLE', 'degrees', 100);
    const [flapsAngle] = useSimVar('L:A32NX_LEFT_FLAPS_ANGLE', 'degrees', 100);
    const [targetFlapsAngle] = useSimVar('L:A32NX_LEFT_FLAPS_TARGET_ANGLE', 'degrees', 100);
    const [handleIndex] = useSimVar('L:A32NX_FLAPS_CONF_INDEX', 'number', 100);
    const [greenPress] = useSimVar('L:A32NX_HYD_GREEN_SYSTEM_1_SECTION_PRESSURE', 'number', 1000);
    const [yellowPress] = useSimVar('L:A32NX_HYD_YELLOW_SYSTEM_1_SECTION_PRESSURE', 'number', 1000);
    const [bluePress] = useSimVar('L:A32NX_HYD_BLUE_SYSTEM_1_SECTION_PRESSURE', 'number', 1000);

    const flapsPowered = greenPress > 1450 || yellowPress > 1450;
    const slatsPowered = greenPress > 1450 || bluePress > 1450;
    const flapsMoving = (flapsAngle !== targetFlapsAngle) && flapsPowered;
    const slatsMoving = (slatsAngle !== targetSlatsAngle) && slatsPowered;

    const flapText = ['0', '1', '1+F', '2', '3', 'FULL'];

    const [flapsInitial, setFlapsInitial] = useState(true);
    const [slatsInitial, setSlatsInitial] = useState(true);

    const [slatPos, setSlatPos] = useState([x - 15, y]);
    const [deltaSlatsAngle, setDeltaSlatsAngle] = useState(slatsAngle);

    const [flapsPos, setFlapsPos] = useState([x, y]);
    const [deltaFlapsAngle, setDeltaFlapsAngle] = useState(flapsAngle);

    const [alphaLockEngaged] = useSimVar('L:A32NX_SFCC_1_ALPHA_LOCK_ENGAGED', 'bool', 500); // TODO: this SimVar is part of PR #6647

    useEffect(() => {
        const xVal = 34;
        const yVal = 12;

        const currX = slatPos[0];
        const currY = slatPos[1];

        if (slatsInitial) {
            setSlatsInitial(false);
            if (handleIndex) {
                switch (true) {
                case (slatsAngle === 18):
                    setSlatPos([x - 49, y + 12]);
                    break;
                case (slatsAngle === 22):
                    setSlatPos([x - 83, y + 24]);
                    break;
                case (slatsAngle === 27):
                    setSlatPos([x - 117, y + 36]);
                    break;
                default:
                    setSlatPos([x - 15, y]);
                    break;
                }
            }
        } else {
            switch (true) {
            case (slatsAngle > 22):
                setSlatPos(
                    [
                        currX - ((xVal / 5) * (slatsAngle - deltaSlatsAngle)),
                        currY + ((yVal / 5) * (slatsAngle - deltaSlatsAngle)),
                    ],
                );
                break;
            case (slatsAngle > 18):
                setSlatPos(
                    [
                        currX - ((xVal / 4) * (slatsAngle - deltaSlatsAngle)),
                        currY + ((yVal / 4) * (slatsAngle - deltaSlatsAngle)),
                    ],
                );
                break;
            default:
                setSlatPos(
                    [
                        currX - ((xVal / 18) * (slatsAngle - deltaSlatsAngle)),
                        currY + ((yVal / 18) * (slatsAngle - deltaSlatsAngle)),
                    ],
                );
            }
        }
        // Hack to cater for strange behaviour when loading in on approach
        if (slatsAngle === 27) {
            setSlatPos([x - 117, y + 36]);
        } else {
            setDeltaSlatsAngle(slatsAngle);
        }
    }, [slatsAngle]);

    useEffect(() => {
        const xVal = 43;
        const yVal = 9;

        const currX = flapsPos[0];
        const currY = flapsPos[1];

        if (flapsInitial) {
            setFlapsInitial(false);
            if (handleIndex) {
                switch (true) {
                case (flapsAngle === 10):
                    setFlapsPos([x + 43, y + 9]);
                    break;
                case (flapsAngle === 15):
                    setFlapsPos([x + 86, y + 18]);
                    break;
                case (flapsAngle === 20):
                    setFlapsPos([x + 129, y + 27]);
                    break;
                case (flapsAngle === 40):
                    setFlapsPos([x + 172, y + 36]);
                    break;
                default:
                    setFlapsPos([x, y]);
                    break;
                }
            }
        } else {
            switch (true) {
            case (flapsAngle > 20):
                setFlapsPos(
                    [
                        currX + ((xVal / 20) * (flapsAngle - deltaFlapsAngle)),
                        currY + ((yVal / 20) * (flapsAngle - deltaFlapsAngle)),
                    ],
                );
                break;
            case (flapsAngle > 10):
                setFlapsPos(
                    [
                        currX + ((xVal / 5) * (flapsAngle - deltaFlapsAngle)),
                        currY + ((yVal / 5) * (flapsAngle - deltaFlapsAngle)),
                    ],
                );
                break;
            default:
                setFlapsPos(
                    [
                        currX + ((xVal / 10) * (flapsAngle - deltaFlapsAngle)),
                        currY + ((yVal / 10) * (flapsAngle - deltaFlapsAngle)),
                    ],
                );
            }
        }

        if (flapsAngle === 40) {
            setFlapsPos([x + 172, y + 36]);
        }
        setDeltaFlapsAngle(flapsAngle);
    }, [flapsAngle]);

    return (
        <>
            <path d={`M ${x},${y} l -16,0 l -4,13 l 26,0 Z`} className="DarkGreyBox" />
            <text
                className={`Large Center
                ${flapsMoving || slatsMoving ? 'Cyan' : 'Green'}
                ${!flapsPowered || (!flapsMoving && !slatsMoving && handleIndex === 0) ? 'Hide' : 'Show'}`}
                x={x - 5}
                y={y + 60}
            >
                {flapText[handleIndex]}

            </text>
            <g id="SlatsPositionIndicators" className={(flapsPowered || slatsPowered) && (flapsAngle > 0 || slatsAngle > 0) ? 'Show' : 'Hide'}>
                <text className="Medium Center" x={x - 100} y={y + 14}>S</text>
                <text className="Medium Center" x={x + 102} y={y + 14}>F</text>
            </g>
            {/* Slats */}
            <g id="SlatsPositionIndicators" className={(flapsPowered || slatsPowered) && (flapsAngle > 0 || slatsAngle > 0) ? 'Show' : 'Hide'}>
                <path d={`M ${x - 58},${y + 19} l -7,2 l -1,4 l 7,-2 Z`} className="SlatsSmallWhite" />
                <path d={`M ${x - 92},${y + 31} l -7,2 l -1,4 l 7,-2 Z`} className="SlatsSmallWhite" />
                <path d={`M ${x - 126},${y + 43} l -7,2 l -1,4 l 7,-2 Z`} className="SlatsSmallWhite" />
                <path d={`M ${x - 26},${y + 23} l -7,2 l -1,4 l 7,-2 Z`} className={`SlatsSmallCyan ${targetSlatsAngle === 0 && slatsAngle > 0.5 ? 'Show' : 'Hide'}`} />
                <path d={`M ${x - 58},${y + 34} l -7,2 l -1,4 l 7,-2 Z`} className={`SlatsSmallCyan ${targetSlatsAngle === 18 && slatsAngle !== 18 ? 'Show' : 'Hide'}`} />
                <path d={`M ${x - 92},${y + 46} l -7,2 l -1,4 l 7,-2 Z`} className={`SlatsSmallCyan ${targetSlatsAngle === 22 && slatsAngle !== 22 ? 'Show' : 'Hide'}`} />
                <path d={`M ${x - 126},${y + 57} l -7,2 l -1,4 l 7,-2 Z`} className={`SlatsSmallCyan ${targetSlatsAngle === 27 && slatsAngle !== 27 ? 'Show' : 'Hide'}`} />
            </g>
            {alphaLockEngaged === 1 && <text className="Medium Center GreenPulseNoFill" x={x - 95} y={y - 10}>A LOCK</text>}
            <path className={`Slats ${alphaLockEngaged === 1 ? 'GreenPulseNoFill' : ''}`} d={`M ${slatPos[0]},${slatPos[1]} l -19,7 l -4,13 l 19,-7 Z`} />
            <line className={`GreenLine ${alphaLockEngaged === 1 ? 'GreenPulse' : ''}`} x1={x - 16} y1={y} x2={slatPos[0]} y2={slatPos[1]} />
            {/* Flaps */}
            <g id="Flaps" className={(flapsPowered || slatsPowered) && (flapsAngle > 0 || slatsAngle > 0) ? 'Show' : 'Hide'}>
                <path d={`M ${x + 52},${y + 15} l 3,5 l 5,1 l 0,-4 Z`} className="FlapsSmallWhite" />
                <path d={`M ${x + 95},${y + 24} l 3,5 l 5,1 l 0,-4 Z`} className="FlapsSmallWhite" />
                <path d={`M ${x + 138},${y + 33} l 3,5 l 5,1 l 0,-4 Z`} className="FlapsSmallWhite" />
                <path d={`M ${x + 181},${y + 42} l 3,5 l 5,1 l 0,-4 Z`} className="FlapsSmallWhite" />
                <path d={`M ${x + 12},${y + 23} l 3,5 l 5,1 l 0,-4 Z`} className={`FlapsSmallCyan ${targetFlapsAngle === 0 && flapsAngle > 0.5 ? 'Show' : 'Hide'}`} />
                <path d={`M ${x + 52},${y + 30} l 3,5 l 5,1 l 0,-4 Z`} className={`FlapsSmallCyan ${targetFlapsAngle === 10 && flapsAngle !== 10 ? 'Show' : 'Hide'}`} />
                <path d={`M ${x + 95},${y + 39} l 3,5 l 5,1 l 0,-4 Z`} className={`FlapsSmallCyan ${Math.round(targetFlapsAngle) === 15 && Math.round(flapsAngle) !== 15 ? 'Show' : 'Hide'}`} />
                <path d={`M ${x + 138},${y + 48} l 3,5 l 5,1 l 0,-4 Z`} className={`FlapsSmallCyan ${targetFlapsAngle === 20 && flapsAngle !== 20 ? 'Show' : 'Hide'}`} />
                <path d={`M ${x + 181},${y + 57} l 3,5 l 5,1 l 0,-4 Z`} className={`FlapsSmallCyan ${targetFlapsAngle === 40 && flapsAngle !== 40 ? 'Show' : 'Hide'}`} />
            </g>
            <path d={`M${flapsPos[0]},${flapsPos[1]} l 22,5 l 0,12, l -15,-3 Z`} className="Flaps" />
            <line className="GreenLine" x1={x} y1={y} x2={flapsPos[0]} y2={flapsPos[1]} />
        </>
    );
};

export default Slats;
