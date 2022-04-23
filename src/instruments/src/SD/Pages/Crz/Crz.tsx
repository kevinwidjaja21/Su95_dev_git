import ReactDOM from 'react-dom';
import React, { useEffect, useState } from 'react';
import { getRenderTarget, setIsEcamPage } from '../../../Common/defaults';
import { SimVarProvider, useSimVar } from '../../../Common/simVars';
import { usePersistentProperty } from '../../../Common/persistence';
import { splitDecimals, valueRadianAngleConverter, polarToCartesian } from './common';
import { fuelForDisplay } from '../../Common/FuelFunctions';

import './Crz.scss';

setIsEcamPage('crz_page');

export const CrzPage = () => (
    <>
        <svg id="crz-page" viewBox="0 0 600 600" style={{ marginTop: '-60px' }} xmlns="http://www.w3.org/2000/svg">
            <text className="Title" x="300" y="20">CRUISE</text>

            <text className="SubTitle" x="50" y="60">ENG</text>
            <FuelComponent />
            <OilComponent />

            <text className="SubTitle" x="50" y="330">AIR</text>
            <PressureComponent />

            <CondComponent />
        </svg>
    </>
);

export const FuelComponent = () => {
    const [unit] = usePersistentProperty('CONFIG_USING_METRIC_UNIT', '1');

    const [leftConsumption] = useSimVar('L:A32NX_FUEL_USED:1', 'number', 1000);
    const [rightConsumption] = useSimVar('L:A32NX_FUEL_USED:2', 'number', 1000);

    const leftFuel = fuelForDisplay(leftConsumption, unit);
    const rightFuel = fuelForDisplay(rightConsumption, unit);

    return (
        <>
            <text className="Standard Center" x="300" y="70">F.USED</text>
            <text className="Standard Center" x="300" y="90">1+2</text>
            <text id="FuelUsedLeft" className="Large Green" x="210" y="95" textAnchor="end">{leftFuel}</text>
            <text id="FuelUsedRight" className="Large Green" x="455" y="95" textAnchor="end">{rightFuel}</text>
            <text id="FuelUsedTotal" className="Large Green Center" x="300" y="112">{leftFuel + rightFuel}</text>
            <text id="FuelUsedUnit" className="Standard Cyan Center" x="300" y="132">{unit === '1' ? 'KG' : 'LBS'}</text>
            <path className="WingPlaneSym" d="M230 80 l20 -2" />
            <path className="WingPlaneSym" d="M370 80 l-20 -2" />
        </>
    );
};

export const OilComponent = () => {
    const [oilQuantLeft] = useSimVar('ENG OIL QUANTITY:1', 'percent', 1000);
    const [oilQuantRight] = useSimVar('ENG OIL QUANTITY:2', 'percent', 1000);

    const oilLeft = splitDecimals(oilQuantLeft, 'oil');
    const oilRight = splitDecimals(oilQuantRight, 'oil');

    const [leftVIBN1] = useSimVar('TURB ENG VIBRATION:1', 'Number', 1000);
    const [rightVIBN1] = useSimVar('TURB ENG VIBRATION:2', 'Number', 1000);

    const leftVN1 = splitDecimals(leftVIBN1, 'vib');
    const rightVN1 = splitDecimals(rightVIBN1, 'vib');

    return (
        <>
            <text className="Standard Center" x="300" y="160">OIL</text>
            <text className="Medium Cyan Center" x="300" y="180">QT</text>

            <path className="WingPlaneSym" d="M230 170 l20 -2" />
            <path className="WingPlaneSym" d="M370 170 l-20 -2" />

            <text className="Standard Center" x="300" y="220">VIB N1</text>
            <text className="Standard" x="312" y="250">N2</text>

            <path className="WingPlaneSym" d="M230 220 l20 -2" />
            <path className="WingPlaneSym" d="M370 220 l-20 -2" />

            <path className="WingPlaneSym" d="M230 250 l20 -2" />
            <path className="WingPlaneSym" d="M370 250 l-20 -2" />

            <text id="OilQuantityLeft" className="Large Green" x="195" y="185" textAnchor="end">
                {oilLeft[0]}
                .
            </text>
            <text id="OilQuantityLeftDecimal" className="Standard Green" x="197" y="185" textAnchor="start">{oilLeft[1]}</text>
            <text id="OilQuantityRight" className="Large Green" x="440" y="185" textAnchor="end">
                {oilRight[0]}
                .
            </text>
            <text id="OilQuantityRightDecimal" className="Standard Green" x="440" y="185" textAnchor="start">{oilRight[1]}</text>

            <text id="VibN1Left" className="Large Green" x="195" y="235" textAnchor="end">
                {leftVN1[0]}
                .
            </text>
            <text id="VibN1LeftDecimal" className="Standard Green" x="197" y="235" textAnchor="start">{leftVN1[1]}</text>

            <text id="VibN2Left" className="Large Green" x="195" y="265" textAnchor="end">
                {leftVN1[0]}
                .
            </text>
            <text id="VibN2LeftDecimal" className="Standard Green" x="197" y="265" textAnchor="start">{leftVN1[1]}</text>

            <text id="VibN1Right" className="Large Green" x="440" y="235" textAnchor="end">
                {rightVN1[0]}
                .
            </text>
            <text id="VibN1RightDecimal" className="Standard Green" x="440" y="235" textAnchor="start">{rightVN1[1]}</text>

            <text id="VibN2Right" className="Large Green" x="440" y="265" textAnchor="end">
                {rightVN1[0]}
                .
            </text>
            <text id="VibN2RightDecimal" className="Standard Green" x="440" y="265" textAnchor="start">{rightVN1[1]}</text>
        </>
    );
};

export const PressureComponent = () => {
    const [landingElevDialPosition] = useSimVar('L:XMLVAR_KNOB_OVHD_CABINPRESS_LDGELEV', 'Number', 100);
    const [landingRunwayElevation] = useSimVar('L:A32NX_PRESS_AUTO_LANDING_ELEVATION', 'feet', 1000);
    const [manMode] = useSimVar('L:A32NX_CAB_PRESS_MODE_MAN', 'Bool', 1000);
    const [ldgElevMode, setLdgElevMode] = useState('AUTO');
    const [ldgElevValue, setLdgElevValue] = useState('XX');
    const [cssLdgElevName, setCssLdgElevName] = useState('green');
    const [landingElev] = useSimVar('L:A32NX_LANDING_ELEVATION', 'feet', 100);
    const [cabinAlt] = useSimVar('L:A32NX_PRESS_CABIN_ALTITUDE', 'feet', 500);
    const [cabinVs] = useSimVar('L:A32NX_PRESS_CABIN_VS', 'feet per minute', 500);
    const [deltaPsi] = useSimVar('L:A32NX_PRESS_CABIN_DELTA_PRESSURE', 'psi', 1000);

    const deltaPress = splitDecimals(deltaPsi, '');

    useEffect(() => {
        setLdgElevMode(landingElevDialPosition === 0 ? 'AUTO' : 'MAN');
        if (landingElevDialPosition === 0) {
            // On Auto
            const nearestfifty = Math.round(landingRunwayElevation / 50) * 50;
            setLdgElevValue(landingRunwayElevation > -5000 ? nearestfifty.toString() : 'XX');
            setCssLdgElevName(landingRunwayElevation > -5000 ? 'Green' : 'Amber');
        } else {
            // On manual
            const nearestfifty = Math.round(landingElev / 50) * 50;
            setLdgElevValue(nearestfifty.toString());
            setCssLdgElevName('Green');
        }
    }, [landingElevDialPosition, landingRunwayElevation]);

    return (
        <>
            <g id="LandingElevation" className={!manMode ? 'show' : 'hide'}>
                <text className="Standard Center" x="330" y="335">LDG ELEV</text>
                <text id="LandingElevationMode" className="Standard Green" x="385" y="335">{ldgElevMode}</text>

                <text id="LandingElevation" className={`Large ${cssLdgElevName}`} x="525" y="335" textAnchor="end">{ldgElevValue}</text>
                <text className="Standard Cyan" x="530" y="335">FT</text>
            </g>
            <g id="ManualVSIndicator" className={manMode ? 'show' : 'hide'}>
                <GaugeComponentMemo x={440} y={385} radius={50} startAngle={10} endAngle={-190} verticalSpeed={cabinVs * 60 / 1000} className="Gauge" />
            </g>

            <text className="Standard" x="218" y="370">@P</text>
            <text id="Large Green" className="Large Green" x="290" y="370" textAnchor="end">
                {deltaPress[0]}
                .
            </text>
            <text id="standard green" className="Standard Green" x="290" y="370">{deltaPress[1]}</text>
            <text className="Standard Cyan" x="320" y="370">PSI</text>

            <text className="Standard" x="480" y="380">CAB V/S</text>
            <text id="CabinVerticalSpeed" className="Large Green" x="515" y="405" textAnchor="end">{Math.abs(Math.round(cabinVs / 50) * 50)}</text>
            <text className="Medium Cyan" x="525" y="405">FT/MIN</text>

            <text className="Standard" x="480" y="450">CAB ALT</text>
            <text id="CabinAltitude" className="Large Green" x="515" y="475" textAnchor="end">{Math.round(cabinAlt / 50) * 50 > 0 ? Math.round(cabinAlt / 50) * 50 : 0}</text>
            <text className="Medium Cyan" x="525" y="475">FT</text>

            <g
                id="vsArrow"
                className={(cabinVs * 60 <= -50 || cabinVs * 60 >= 50) && !manMode ? '' : 'Hide'}
                transform={cabinVs * 60 <= -50 ? 'translate(0, 795) scale(1, -1)' : 'scale(1, 1)'}
            >
                <path d="M433,405 h7 L446,395" className="VsIndicator" strokeLinejoin="miter" />
                <polygon points="452,388 447,396 457,396" transform="rotate(38,452,388)" className="VsIndicator" />
            </g>
        </>
    );
};

type GaugeComponentType = {
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    verticalSpeed: number,
    className: string,
}

export const GaugeComponent = ({ x, y, radius, startAngle, endAngle, verticalSpeed, className } : GaugeComponentType) => {
    const startPos = polarToCartesian(x, y, radius, startAngle);
    const endPos = polarToCartesian(x, y, radius, endAngle);
    const largeArcFlag = ((startAngle - endAngle) <= 180) ? '0' : '1';
    const d = ['M', startPos.x, startPos.y, 'A', radius, radius, 0, largeArcFlag, 0, endPos.x, endPos.y].join(' ');

    return (
        <>
            <path d={d} className={className} />
            <GaugeMarkerComponentMemo value={2} x={x} y={y} min={-2} max={2} radius={radius} startAngle={0} endAngle={180} className="GaugeText" showValue indicator={false} />
            <GaugeMarkerComponentMemo value={1} x={x} y={y} min={-2} max={2} radius={radius} startAngle={0} endAngle={180} className="GaugeText" showValue={false} indicator={false} />
            <GaugeMarkerComponentMemo value={0} x={x} y={y} min={-2} max={2} radius={radius} startAngle={0} endAngle={180} className="GaugeText" showValue indicator={false} />
            <GaugeMarkerComponentMemo value={-1} x={x} y={y} min={-2} max={2} radius={radius} startAngle={0} endAngle={180} className="GaugeText" showValue={false} indicator={false} />
            <GaugeMarkerComponentMemo value={-2} x={x} y={y} min={-2} max={2} radius={radius} startAngle={0} endAngle={180} className="GaugeText" showValue indicator={false} />

            <GaugeMarkerComponentMemo value={verticalSpeed} x={x} y={y} min={-2} max={2} radius={radius} startAngle={0} endAngle={180} className="GaugeIndicator" showValue={false} indicator />

        </>
    );
};

export const GaugeComponentMemo = React.memo(GaugeComponent);

type GaugeMarkerComponentType = {
    value: number,
    x: number,
    y: number,
    min: number,
    max: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    className: string,
    showValue: boolean,
    indicator: boolean,
};

export const GaugeMarkerComponent = ({ value, x, y, min, max, radius, startAngle, endAngle, className, showValue, indicator } : GaugeMarkerComponentType) => {
    let textValue = value.toString();
    const dir = valueRadianAngleConverter(value, min, max, endAngle, startAngle);

    let start = {
        x: x + (dir.x * radius * 0.9),
        y: y + (dir.y * radius * 0.9),
    };
    let end = {
        x: x + (dir.x * radius),
        y: y + (dir.y * radius),
    };

    if (indicator) {
        start = { x, y };

        end = {
            x: x + (dir.x * radius * 1.1),
            y: y + (dir.y * radius * 1.1),
        };
    }

    // Text

    const pos = {
        x: x + (dir.x * (radius * 0.7)),
        y: y + (dir.y * (radius * 0.7)),
    };

    textValue = !showValue ? '' : Math.abs(value).toString();

    return (
        <>
            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} className={className} />
            <text x={pos.x} y={pos.y} className={className} alignmentBaseline="central" textAnchor="middle">{textValue}</text>
        </>
    );
};

export const GaugeMarkerComponentMemo = React.memo(GaugeMarkerComponent);

export const CondComponent = () => {
    const [cockpitCabinTemp] = useSimVar('L:A32NX_CKPT_TEMP', 'celsius', 1000);
    const [fwdCabinTemp] = useSimVar('L:A32NX_FWD_TEMP', 'celsius', 1000);
    const [aftCabinTemp] = useSimVar('L:A32NX_AFT_TEMP', 'celsius', 1000);

    return (
        <>
            <path className="WingPlaneSym" d="M 300 410 a 70 70 0 0 0 -30 -5 l -180 0 m 30 0 l 0 50 l 85 0 l 0 -10 m 0 10 l 85 0 l 0 -48 m -170 48 l -30 0 c -60 0 -60 -20 -45 -25" />

            <text className="Standard" x="55" y="425">CKPT</text>
            <text id="CockpitTemp" className="Standard Green" x="75" y="448">{cockpitCabinTemp.toFixed(0)}</text>
            <text className="Standard" x="145" y="425">FWD</text>
            <text id="ForwardTemp" className="Standard Green" x="150" y="448">{fwdCabinTemp.toFixed(0)}</text>
            <text className="Standard" x="245" y="425">AFT</text>
            <text id="AftTemp" className="Standard Green" x="235" y="448">{aftCabinTemp.toFixed(0)}</text>
            <text className="Medium Cyan" x="310" y="455">°C</text>
        </>
    );
};

ReactDOM.render(<SimVarProvider><CrzPage /></SimVarProvider>, getRenderTarget());
