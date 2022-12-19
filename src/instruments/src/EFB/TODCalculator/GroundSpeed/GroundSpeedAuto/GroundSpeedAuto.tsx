import React, { useEffect } from 'react';
import { useSimVar } from '@instruments/common/simVars';
import { t } from '../../../translation';
import { useAppDispatch, useAppSelector } from '../../../Store/store';
import { removeTodGroundSpeed, setTodGroundSpeed, setTodGroundSpeedMode } from '../../../Store/features/todCalculator';
import { TOD_INPUT_MODE } from '../../../Enum/TODInputMode';

export const GroundSpeedAuto = () => {
    const dispatch = useAppDispatch();

    const currentAltitude = useAppSelector((state) => state.todCalculator.currentAltitude);
    const groundSpeedData = useAppSelector((state) => state.todCalculator.groundSpeed);
    const { groundSpeed } = groundSpeedData[groundSpeedData.length - 1];

    let [simGroundSpeed] = useSimVar('GPS GROUND SPEED', 'knots', 1_000);
    simGroundSpeed = Math.round(simGroundSpeed);

    const setCurrentGroundSpeed = () => {
        if ((currentAltitude ?? 0) > 10000 && groundSpeed >= 250) {
            dispatch(setTodGroundSpeed({ index: 0, value: { from: 0, groundSpeed: 250 } }));
            dispatch(setTodGroundSpeed({ index: 1, value: { from: 10000, groundSpeed: simGroundSpeed } }));
        } else {
            dispatch(setTodGroundSpeed({ index: 0, value: { from: 0, groundSpeed: simGroundSpeed > 0 ? simGroundSpeed : '' } }));
            dispatch(removeTodGroundSpeed(1));
        }
    };

    useEffect(() => {
        setCurrentGroundSpeed();
    }, [currentAltitude, simGroundSpeed]);

    if (Number.isNaN(groundSpeed)) {
        return null;
    }

    return (
        <div className="flex flex-col justify-center items-center">
            <div className="flex absolute top-0 flex-row items-center p-2 space-x-4 w-full bg-theme-accent">
                <div className="flex-shrink-0 w-6 h-6 bg-theme-highlight rounded-full" />
                <p>{t('Performance.TopOfDescent.GroundSpeed.FetchingSpeedFromSimulator')}</p>
            </div>

            <span className="mb-4 text-5xl">
                {groundSpeed || 0}
                {' '}
                {t('Performance.TopOfDescent.GroundSpeed.UnitKt')}
            </span>

            <button
                type="button"
                className="flex justify-center p-3 text-theme-highlight hover:text-theme-body hover:bg-theme-highlight rounded-md border-2 border-theme-highlight transition duration-100"
                onClick={() => dispatch(setTodGroundSpeedMode(TOD_INPUT_MODE.MANUAL))}
            >
                <p className="text-current">{t('Performance.TopOfDescent.GroundSpeed.ManualInput')}</p>
            </button>
        </div>
    );
};
