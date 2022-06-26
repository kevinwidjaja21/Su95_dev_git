import React, { FC, memo, useEffect, useState } from 'react';
import { Layer } from '@instruments/common/utils';
import { EfisSide } from '@shared/NavigationDisplay';
import { useSimVar } from '@instruments/common/simVars';
import { SimVarString } from '@shared/simvar';

export type ToWaypointIndicatorProps = {
    side: EfisSide,
}

export const ToWaypointIndicator: FC<ToWaypointIndicatorProps> = memo(({ side }) => {
    // TODO replace with appropriate ARINC 429 labels

    const [ident, setIdent] = useState<string | null>(null);
    const [ident0] = useSimVar(`L:A32NX_EFIS_${side}_TO_WPT_IDENT_0`, 'number', 500);
    const [ident1] = useSimVar(`L:A32NX_EFIS_${side}_TO_WPT_IDENT_1`, 'number', 500);
    const [bearing] = useSimVar(`L:A32NX_EFIS_${side}_TO_WPT_BEARING`, 'Degrees');
    const [distance] = useSimVar(`L:A32NX_EFIS_${side}_TO_WPT_DISTANCE`, 'Number');
    const [eta] = useSimVar(`L:A32NX_EFIS_${side}_TO_WPT_ETA`, 'Seconds');

    useEffect(() => {
        // EIS2 can only display 9 characters for the ident
        setIdent(SimVarString.unpack([ident0, ident1]));
    }, [ident0, ident1]);

    let distanceFixed;
    let distanceIntegralPart;
    let distanceDecimalPart;

    /*
     * distance < 20nm: XX.Y NM
     * distance > 20nm: XXXX NM
     */
    if (!distance) {
        distanceFixed = '';
        distanceIntegralPart = '';
        distanceDecimalPart = '';
    } else if (distance < 20) {
        distanceFixed = distance.toFixed(1);
        [distanceIntegralPart, distanceDecimalPart] = distanceFixed.split('.');
    } else {
        distanceFixed = Math.round(Math.min(9999, distance));
    }

    const hh = Math.floor(eta / 3600);
    const mm = Math.floor((eta % 3600) / 60);

    const utc = `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;

    return (
        <Layer x={690} y={28}>
            {ident && (
                <text x={-9} y={0} fontSize={25} className="White" textAnchor="end">{ident}</text>
            )}

            {bearing && bearing !== -1 && Number.isFinite(bearing) && (
                <>
                    <text x={54} y={0} fontSize={25} className="Green" textAnchor="end">{(Math.round(bearing)).toString().padStart(3, '0')}</text>
                    <text x={73} y={2} fontSize={25} className="Cyan" textAnchor="end">&deg;</text>
                </>
            )}

            {distance && distance !== -1 && Number.isFinite(distance) && (
                <>
                    {distance < 20 ? (
                        <>
                            <text x={8} y={30} fontSize={24} className="Green" textAnchor="end">{distanceIntegralPart}</text>
                            <text x={8} y={30} fontSize={23} className="Green" textAnchor="start">.</text>
                            <text x={22} y={30} fontSize={19} className="Green" textAnchor="start">{distanceDecimalPart}</text>
                        </>
                    ) : (
                        <>
                            <text x={34} y={30} fontSize={24} className="Green" textAnchor="end">{distanceFixed}</text>
                        </>
                    )}

                    <text x={72} y={30} fontSize={18} className="Cyan" textAnchor="end">NM</text>
                </>
            )}

            {eta !== -1 && utc && (
                <text x={72} y={62} fontSize={25} className="Green" textAnchor="end">{utc}</text>
            )}
        </Layer>
    );
});
