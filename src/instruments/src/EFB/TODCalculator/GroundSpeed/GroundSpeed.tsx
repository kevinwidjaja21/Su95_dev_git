import React from 'react';
import { t } from '../../translation';
import Card from '../../UtilComponents/Card/Card';
import { TOD_INPUT_MODE } from '../../Enum/TODInputMode';
import { useAppSelector } from '../../Store/store';
import { GroundSpeedAuto } from './GroundSpeedAuto/GroundSpeedAuto';
import { GroundSpeedManual } from './GroundSpeedManual/GroundSpeedManual';

export const GroundSpeed = ({ className }: {className: string}) => {
    const groundSpeedMode = useAppSelector((state) => state.todCalculator.groundSpeedMode);

    const groundSpeedComponent = {
        [TOD_INPUT_MODE.AUTO]: {
            component: GroundSpeedAuto,
            childrenContainerClassName: 'flex-1 flex flex-col justify-center',
        },
        [TOD_INPUT_MODE.MANUAL]: {
            component: GroundSpeedManual,
            childrenContainerClassName: 'flex-1 flex flex-col justify-start',
        },
    }[groundSpeedMode];

    return (
        <Card title={t('Performance.TopOfDescent.GroundSpeed.Title')} childrenContainerClassName={`${groundSpeedComponent.childrenContainerClassName} relative`} className={className}>
            <groundSpeedComponent.component />
        </Card>
    );
};
