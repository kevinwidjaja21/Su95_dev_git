import React, { FC, useState, useEffect, memo } from 'react';
import { render } from '@instruments/common/index';
import { GaugeComponent, GaugeMarkerComponent, splitDecimals } from '@instruments/common/gauges';
import { setIsEcamPage } from '@instruments/common/defaults';
import { Triangle } from '../../Common/Shapes';
import { PageTitle } from '../../Common/PageTitle';
import { EcamPage } from '../../Common/EcamPage';
import { useSimVar } from '../../../Common/simVars';
import { SvgGroup } from '../../Common/SvgGroup';

import './Press.scss';

setIsEcamPage('press_page');

export const PressPage: FC = () => {
    const [cabinAlt] = useSimVar('L:A32NX_PRESS_CABIN_ALTITUDE', 'feet', 500);
    const [deltaPsi] = useSimVar('L:A32NX_PRESS_CABIN_DELTA_PRESSURE', 'psi', 500);
    const [flightPhase] = useSimVar('L:A32NX_FWC_FLIGHT_PHASE', 'enum', 1000);
    const [systemNumber] = useSimVar('L:A32NX_PRESS_ACTIVE_CPC_SYS', 'number', 1000);
    const [safetyValve] = useSimVar('L:A32NX_PRESS_SAFETY_VALVE_OPEN_PERCENTAGE', 'percentage', 500);

    const [cabinAltTextCss, setCabinAltTextCss] = useState('');
    const [cabinAltGaugeCss, setCabinAltGaugeCss] = useState('');

    useEffect(() => {
        if (Math.round(cabinAlt / 50) * 50 >= 8800 && Math.round(cabinAlt / 50) * 50 < 9550) {
            setCabinAltTextCss('GreenTextPulse');
            setCabinAltGaugeCss('GreenIndicatorPulse');
        } else if (Math.round(cabinAlt / 50) * 50 >= 9550) {
            setCabinAltTextCss('Red');
            setCabinAltGaugeCss('Red');
        } else {
            setCabinAltTextCss('Green');
            setCabinAltGaugeCss('Green');
        }
    }, [cabinAlt]);

    const deltaPress = splitDecimals(deltaPsi);
    const cax = 455;
    const dpx = 110;
    const y = 165;

    const radius = 50;

    return (
        <EcamPage name="main-press">
            <PageTitle x={6} y={18} text="CAB PRESS" />
            <PressureComponent />

            {/* System */}
            <SystemComponent id={1} x={180} y={290} visible={systemNumber === 1} />
            <SystemComponent id={2} x={350} y={290} visible={systemNumber === 2} />

            {/* Delta pressure gauge */}
            <g id="DeltaPressure">
                <text className="Large Center" x={dpx - 5} y="80">@P</text>
                <text className="Medium Center Cyan" x={dpx - 5} y="100">PSI</text>
                <text className={`Huge End ${deltaPsi < -0.4 || deltaPsi >= 8.5 ? 'Amber' : 'Green'}`} x={dpx + 38} y={y + 25}>
                    {deltaPress[0]}
                </text>
                <text className={`Huge End ${deltaPsi < -0.4 || deltaPsi >= 8.5 ? 'Amber' : 'Green'}`} x={dpx + 53} y={y + 25}>.</text>
                <text className={`Standard End ${deltaPsi < -0.4 || deltaPsi >= 8.5 ? 'Amber' : 'Green'}`} x={dpx + 63} y={y + 25}>{deltaPress[1]}</text>
                <GaugeComponent x={dpx} y={y} radius={radius} startAngle={210} endAngle={50} visible className="Gauge">
                    <GaugeComponent x={dpx} y={y} radius={radius} startAngle={40} endAngle={50} visible className="Gauge Amber" />
                    <GaugeComponent x={dpx} y={y} radius={radius} startAngle={210} endAngle={218} visible className="Gauge Amber" />
                    <GaugeMarkerComponent value={8} x={dpx} y={y} min={-1} max={9} radius={radius} startAngle={210} endAngle={50} className="GaugeText" showValue textNudgeY={10} />
                    <GaugeMarkerComponent
                        value={4}
                        x={dpx}
                        y={y}
                        min={-1}
                        max={9}
                        radius={radius}
                        startAngle={210}
                        endAngle={50}
                        className="GaugeText"
                    />
                    <GaugeMarkerComponent
                        value={0}
                        x={dpx}
                        y={y}
                        min={-1}
                        max={9}
                        radius={radius}
                        startAngle={210}
                        endAngle={50}
                        className="GaugeText"
                        showValue
                        textNudgeY={-10}
                        textNudgeX={5}
                    />
                    <GaugeMarkerComponent
                        value={deltaPsi}
                        x={dpx}
                        y={y}
                        min={-1}
                        max={9}
                        radius={radius}
                        startAngle={210}
                        endAngle={50}
                        className={`GaugeIndicator ${deltaPsi < -0.4 || deltaPsi >= 8.5 ? 'Amber' : ''}`}
                        indicator
                    />
                </GaugeComponent>
            </g>

            {/* Vertical speed gauge  */}
            <CabinVerticalSpeedComponent vsx={275} y={y} radius={radius} />

            {/* Cabin altitude gauge */}
            <g id="CaIndicator">
                <text className="Large Center" x={cax + 15} y="80">CAB ALT</text>
                <text className="Medium Center Cyan" x={cax + 20} y="100">FT</text>
                <text
                    className={`Huge End ${cabinAltTextCss}`}
                    x={cax + 85}
                    y={y + 25}
                >
                    {Math.round(cabinAlt / 50) * 50}
                </text>
                <GaugeComponent
                    x={cax}
                    y={y}
                    radius={radius}
                    startAngle={210}
                    endAngle={50}
                    visible
                    className="Gauge"
                >
                    <GaugeComponent
                        x={cax}
                        y={y}
                        radius={radius}
                        startAngle={30}
                        endAngle={50}
                        visible
                        className="Gauge Red"
                    />
                    <GaugeMarkerComponent
                        value={10}
                        x={cax}
                        y={y}
                        min={-0.625}
                        max={10.625}
                        radius={radius}
                        startAngle={210}
                        endAngle={50}
                        className="GaugeText"
                        showValue
                        indicator={false}
                        textNudgeY={15}
                    />
                    <GaugeMarkerComponent
                        value={5}
                        x={cax}
                        y={y}
                        min={-0.625}
                        max={10.625}
                        radius={radius}
                        startAngle={210}
                        endAngle={50}
                        className="GaugeText"
                        textNudgeY={10}
                    />
                    <GaugeMarkerComponent
                        value={0}
                        x={cax}
                        y={y}
                        min={-0.625}
                        max={10.625}
                        radius={radius}
                        startAngle={210}
                        endAngle={50}
                        className="GaugeText"
                        showValue
                        indicator={false}
                        textNudgeY={-10}
                        textNudgeX={5}
                    />
                    <GaugeMarkerComponent
                        value={Math.round(cabinAlt / 25) * 25 / 1000 > -0.625 ? Math.round(cabinAlt / 25) * 25 / 1000 : -0.625}
                        x={cax}
                        y={y}
                        min={-0.625}
                        max={10.625}
                        radius={radius}
                        startAngle={210}
                        endAngle={50}
                        className={`GaugeIndicator ${cabinAltGaugeCss}`}
                        indicator
                    />
                </GaugeComponent>
            </g>

            <SvgGroup x={-5} y={-25}>
                <polyline className="AirPressureShape" points="140,460 140,450 75,450 75,280 540,280 540,300" />
                <polyline className="AirPressureShape" points="180,457 180,450 265,450 265,457" />
                <polyline className="AirPressureShape" points="305,460 305,450 380,450" />
                <polyline className="AirPressureShape" points="453,450 540,450 540,380 550,380" />
                <line className="AirPressureShape" x1="540" y1="340" x2="547" y2="340" />
            </SvgGroup>

            {/* Safety and vent valves */}

            <text className={safetyValve < 0.2 ? 'Large White' : 'Large Amber'} x={490} y={305}>SAFETY</text>
            <GaugeMarkerComponent
                value={safetyValve < 0.2 ? 2 : 1}
                x={545}
                y={315}
                min={0}
                max={2}
                radius={34}
                startAngle={90}
                endAngle={180}
                className={safetyValve < 0.2 ? 'GreenLine' : 'AmberLine'}
                indicator
            />
            <circle className="WhiteCircle" cx={545} cy={315} r={3} />

            <text className="Large White" x={185} y={380}>VENT</text>

            <OverboardInletComponent flightPhase={flightPhase} validSDAC />
            <circle className="WhiteCircle" cx={175} cy={434} r={3} />

            {/* Overboard Outlet Valve */}
            <OverboardOutletComponent flightPhase={flightPhase} validSDAC />
            <circle className="WhiteCircle" cx={260} cy={434} r={3} />

            {/* Outflow valve */}
            <g id="OutflowValve">
                <OutflowValveComponent flightPhase={flightPhase} />
                <circle className="WhiteCircle" cx={448} cy={425} r={3} />
            </g>

            {/* Packs */}

            <PackComponent id={1} x={47} y={495} />
            <PackComponent id={2} x={478} y={495} />

        </EcamPage>
    );
};

type CabinVerticalSpeedComponentType = {
    vsx: number,
    y: number,
    radius: number
}

const CabinVerticalSpeedComponent: FC<CabinVerticalSpeedComponentType> = ({ vsx, y, radius }) => {
    const [cabinVs] = useSimVar('L:A32NX_PRESS_CABIN_VS', 'feet per minute', 500);

    return (
        <>
            <g id="VsIndicator">
                <text className="Large Center" x={vsx + 15} y="80">V/S</text>
                <text className="Medium Center Cyan" x={vsx + 20} y="100">FT/MIN</text>
                <text className={`Huge End ${Math.abs(Math.round(cabinVs / 50) * 50) > 1750 ? 'GreenTextPulse' : 'Green'}`} x={vsx + 85} y={y + 5}>{Math.round(cabinVs / 50) * 50}</text>
                <GaugeComponent x={vsx} y={y} radius={radius} startAngle={170} endAngle={10} visible className="GaugeComponent Gauge">
                    <GaugeMarkerComponent value={2} x={vsx} y={y} min={-2} max={2} radius={radius} startAngle={180} endAngle={0} className="GaugeText" showValue textNudgeY={10} />
                    <GaugeMarkerComponent value={1} x={vsx} y={y} min={-2} max={2} radius={radius} startAngle={180} endAngle={0} className="GaugeText" />
                    <GaugeMarkerComponent value={0} x={vsx} y={y} min={-2} max={2} radius={radius} startAngle={180} endAngle={0} className="GaugeText" showValue textNudgeX={10} />
                    <GaugeMarkerComponent value={-1} x={vsx} y={y} min={-2} max={2} radius={radius} startAngle={180} endAngle={0} className="GaugeText" />
                    <GaugeMarkerComponent value={-2} x={vsx} y={y} min={-2} max={2} radius={radius} startAngle={180} endAngle={0} className="GaugeText" showValue textNudgeY={-10} />
                    <GaugeMarkerComponent
                        value={Math.abs((cabinVs / 50 * 50) / 1000) <= 2.25 ? (cabinVs / 50 * 50) / 1000 : 2.250}
                        x={vsx}
                        y={y}
                        min={-2}
                        max={2}
                        radius={radius}
                        startAngle={180}
                        endAngle={0}
                        className={`GaugeIndicator ${Math.abs(Math.round(cabinVs / 50) * 50) > 1750 ? 'GreenIndicatorPulse' : ''}`}
                        indicator
                    />
                </GaugeComponent>
            </g>
        </>
    );
};

const PressureComponent = () => {
    const [landingElevDialPosition] = useSimVar('L:XMLVAR_KNOB_OVHD_CABINPRESS_LDGELEV', 'number', 100);
    const [landingRunwayElevation] = useSimVar('L:A32NX_PRESS_AUTO_LANDING_ELEVATION', 'feet', 1000);
    const [autoMode] = useSimVar('L:A32NX_OVHD_PRESS_MODE_SEL_PB_IS_AUTO', 'Bool', 1000);
    const [ldgElevMode, setLdgElevMode] = useState('AUTO');
    const [ldgElevValue, setLdgElevValue] = useState('XX');
    const [cssLdgElevName, setCssLdgElevName] = useState('green');
    const [landingElev] = useSimVar('L:A32NX_OVHD_PRESS_LDG_ELEV_KNOB', 'feet', 100);

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
    }, [landingElevDialPosition, landingRunwayElevation, landingElev]);

    return (
        <>
            <g id="LandingElevation">
                <text className="Large Center" x="280" y="25">LDG ELEV</text>
                <text id="LandingElevationMode" className="Large Green" x="350" y="25">{ldgElevMode}</text>

                <text id="LandingElevation" className={`Large ${cssLdgElevName}`} x="510" y="25" textAnchor="end">{ldgElevValue}</text>
                <text className="Medium Cyan" x="525" y="25">FT</text>
            </g>
            <text className={`Large Green ${!autoMode ? 'Show' : 'Hide'}`} x="420" y="340">MAN</text>
        </>
    );
};

type SystemComponentType = {
    id: number,
    visible: boolean,
    x: number,
    y: number
}

const SystemComponent: FC<SystemComponentType> = memo(({ id, visible, x, y }) => {
    // When failures are introduced can override visible variable
    const systemFault = false;
    const systemColour = systemFault ? 'Amber' : 'Green';

    return (
        <>
            <g id="LandingElevation" className={visible ? 'Show' : 'Hide'}>
                <text className={`Large ${systemColour}`} x={x} y={y}>
                    SYS
                    {' '}
                    {id}
                </text>
            </g>
        </>
    );
});

type PackComponentType = {
    id: number,
    x: number,
    y: number
}

const PackComponent: FC<PackComponentType> = ({ id, x, y }) => {
    const [engN2] = useSimVar(`L:A32NX_ENGINE_N2:${id}`, 'number', 500);
    const [packOff] = useSimVar(`L:A32NX_COND_PACK_FLOW_VALVE_${id}_IS_OPEN`, 'bool', 500);
    const triangleColour = !packOff && engN2 >= 60 ? 'Amber' : 'Green';
    const packWordColour = !packOff && engN2 >= 60 ? 'Amber' : 'White';

    return (
        <>
            <Triangle x={x + 38} y={y - 45} colour={triangleColour} fill={0} orientation={0} />
            <text className={`Large ${packWordColour}`} x={x} y={y}>
                PACK
                {' '}
                {id}
            </text>
        </>
    );
};

type OutflowValveComponentType = {
    flightPhase : number,
}

const OutflowValveComponent: FC<OutflowValveComponentType> = memo(({ flightPhase }) => {
    const ofx = 448;
    const ofy = 425;
    const ofradius = 72;

    const [outflowValueOpenPercentage] = useSimVar('L:A32NX_PRESS_OUTFLOW_VALVE_OPEN_PERCENTAGE', 'percent', 500);

    return (
        <>
            <GaugeComponent
                x={ofx}
                y={ofy}
                radius={ofradius}
                startAngle={270 + (outflowValueOpenPercentage / 100 * 90)}
                endAngle={360}
                visible
                className="Gauge"
            >
                <GaugeComponent x={ofx} y={ofy} radius={ofradius} startAngle={355.5} endAngle={360} visible className="Gauge Amber" />
                <GaugeMarkerComponent
                    value={outflowValueOpenPercentage}
                    x={ofx}
                    y={ofy}
                    min={0}
                    max={100}
                    radius={ofradius}
                    startAngle={270}
                    endAngle={360}
                    className={flightPhase >= 5 && flightPhase <= 7 && outflowValueOpenPercentage > 95 ? 'AmberLine' : 'GreenLine'}
                    indicator
                    multiplierOuter={1}
                />
                <GaugeMarkerComponent
                    value={25}
                    x={ofx}
                    y={ofy}
                    min={0}
                    max={100}
                    radius={ofradius}
                    startAngle={270}
                    endAngle={360}
                    className="Gauge"
                    outer
                    multiplierOuter={1.1}
                />
                <GaugeMarkerComponent
                    value={50}
                    x={ofx}
                    y={ofy}
                    min={0}
                    max={100}
                    radius={ofradius}
                    startAngle={270}
                    endAngle={360}
                    className="Gauge"
                    outer
                    multiplierOuter={1.1}
                />
                <GaugeMarkerComponent
                    value={75}
                    x={ofx}
                    y={ofy}
                    min={0}
                    max={100}
                    radius={ofradius}
                    startAngle={270}
                    endAngle={360}
                    className="Gauge"
                    outer
                    multiplierOuter={1.1}
                />
            </GaugeComponent>
        </>
    );
});

type OverboardInletComponentType = {
    validSDAC: boolean,
    flightPhase: number,
}

const OverboardInletComponent: FC<OverboardInletComponentType> = ({ validSDAC, flightPhase }) => {
    const [realInletValvePosition] = useSimVar('L:VENT_INLET_VALVE', 'percent', 500);
    let indicator = true;
    let classNameValue = 'GreenLine';
    let classNameText = 'White';
    let displayInletValvePosition = 2;

    // Simplified set - modify once pressurisation properly modeled.
    switch (true) {
    case !validSDAC: // case 1
        indicator = false;
        classNameText = 'Amber';
        break;
    case (realInletValvePosition > 0.01 && realInletValvePosition < 99.9): // case 2
        classNameValue = 'AmberLine';
        displayInletValvePosition = 1;
        break;
    case realInletValvePosition > 99.9 && flightPhase >= 5 && flightPhase <= 7: // case 3
        classNameValue = 'AmberLine';
        classNameText = 'Amber';
        displayInletValvePosition = 0;
        break;
    case realInletValvePosition > 99.9: // case 4
        displayInletValvePosition = 0;
        break;
    default: // case 5
        indicator = true;
    }

    return (
        <>
            <text className={`Large ${classNameText}`} x={120} y={417}>INLET</text>
            {indicator ? (
                <GaugeMarkerComponent
                    value={displayInletValvePosition}
                    x={175}
                    y={434}
                    min={0}
                    max={2}
                    radius={34}
                    startAngle={180}
                    endAngle={270}
                    className={classNameValue}
                    indicator
                />
            ) : <text className="Standard Amber" x={143} y={450}>XX</text>}
        </>
    );
};

type OverboardOutletComponentType = {
    validSDAC: boolean,
    flightPhase: number,
}

const OverboardOutletComponent: FC<OverboardOutletComponentType> = ({ validSDAC, flightPhase }) => {
    const [realOutletValvePosition] = useSimVar('L:VENT_OUTLET_VALVE', 'percent', 500);
    let indicator = true;
    let classNameValue = 'GreenLine';
    let classNameText = 'White';
    let displayOutletValvePosition = 0;

    // Simplified set -  modify once pressurisation properly modeled.
    switch (true) {
    case !validSDAC: // case 1
        indicator = false;
        classNameText = 'Amber';
        break;
    case (realOutletValvePosition > 0 && realOutletValvePosition < 0.01 && flightPhase >= 5 && flightPhase <= 7): // case 2b
        classNameValue = 'AmberLine';
        classNameText = 'Amber';
        displayOutletValvePosition = 1;
        break;
    case realOutletValvePosition > 0.01 && flightPhase < 5 && flightPhase > 7: // case 3
        displayOutletValvePosition = 1;
        break;
    case realOutletValvePosition > 95 && flightPhase < 5 && flightPhase > 7: // case 4
        classNameText = 'Amber';
        displayOutletValvePosition = 2;
        break;
    case realOutletValvePosition > 95: // case 5
        displayOutletValvePosition = 2;
        break;
    default: // case 7
        indicator = true;
    }

    return (
        <>
            <text className={`Large ${classNameText}`} x={240} y={417}>OUTLET</text>
            {indicator ? (
                <GaugeMarkerComponent
                    value={displayOutletValvePosition}
                    x={260}
                    y={434}
                    min={0}
                    max={2}
                    radius={34}
                    startAngle={90}
                    endAngle={180}
                    className={classNameValue}
                    indicator
                />
            )
                : <text className="Standard Amber" x={270} y={450}>XX</text>}
        </>
    );
};

render(<PressPage />);
