// Copyright (c) 2022 FlyByWire Simulations
// SPDX-License-Identifier: GPL-3.0

/* eslint-disable max-len */
import React from 'react';
import { useSimVar } from '@instruments/common/simVars';
import { t } from '../../translation';
import { ScrollableContainer } from '../../UtilComponents/ScrollableContainer';
import { PromptModal, useModals } from '../../UtilComponents/Modals/Modals';
import { StepDescription } from './Procedures';

export const AircraftPresets = () => {
    // Aircraft presets are handled by a backend WASM module. This frontend will
    // use the LVAR A32NX_AIRCRAFT_PRESET_LOAD to signal the backend that the user
    // requests a preset to be loaded.
    // The backend will reset the LVAR to 0 when done.
    // As long as the LVAR is 1 the backend is still applying the preset.
    // If the LVAR is set to 0 before the backend is finished applying the preset
    // will be stopped by the backend.
    // The progress while loading an aircraft preset can be read from
    // the LVAR A32NX_AIRCRAFT_PRESET_LOAD_PROGRESS.
    // The current step ID can be read via A32NX_AIRCRAFT_PRESET_LOAD_CURRENT_ID
    // and then use the StepDescription from './Procedures' to get the string.

    const [simOnGround] = useSimVar('SIM ON GROUND', 'number', 200);
    const [loadPresetVar, setLoadPresetVar] = useSimVar('L:A32NX_AIRCRAFT_PRESET_LOAD', 'number', 200);
    const [loadPresetProgress] = useSimVar('L:A32NX_AIRCRAFT_PRESET_LOAD_PROGRESS', 'number', 100);
    const [loadPresetCurrentId] = useSimVar('L:A32NX_AIRCRAFT_PRESET_LOAD_CURRENT_ID', 'number', 100);
    const { showModal } = useModals();

    // These need to align with the IDs in the Presets C++ WASM.
    // WASM: src/presets/src/Aircraft/AircraftProcedures.h
    const AircraftPresetsList: { index: number, name: string }[] = [
        { index: 1, name: `${t('Presets.AircraftStates.ColdDark')}` }, // 'Cold & Dark' },
        { index: 2, name: `${t('Presets.AircraftStates.Powered')}` },
        { index: 3, name: `${t('Presets.AircraftStates.ReadyPushback')}` },
        { index: 4, name: `${t('Presets.AircraftStates.ReadyTaxi')}` },
        { index: 5, name: `${t('Presets.AircraftStates.ReadyTakeoff')}` },
    ];

    // Sets the LVAR to tell the wasm to load the preset into the aircraft
    const handleLoadPreset = (presetID: number) => {
        showModal(
            <PromptModal
                title={`${AircraftPresetsList[presetID - 1].name}`}
                bodyText={t('Presets.AircraftStates.ConfirmationDialogMsg')}
                onConfirm={() => setLoadPresetVar(presetID)}
            />,
        );
    };

    // Called by the cancel button to stop and cancel loading of a preset
    const handleCancel = () => {
        setLoadPresetVar(0);
    };

    return (
        <div className="p-4 mt-4 space-y-4 h-content-section-reduced rounded-lg border-2 border-theme-accent">
            <div className="flex flex-row justify-center items-center p-2 space-x-2 h-20 rounded-md border-2 border-theme-accent">
                {loadPresetVar ? (
                    <>
                        <div className="overflow-hidden justify-center content-center w-full h-full bg-theme-accent rounded-md">
                            <span className="pt-1 pl-3 h-1/2 text-xl">
                                {t('Presets.AircraftStates.CurrentProcedureStep')}
                                :
                                {' '}
                                {StepDescription.get(loadPresetCurrentId)}
                            </span>
                            <div
                                className="h-1/2 bg-theme-highlight"
                                style={{ width: `${loadPresetProgress * 100}%`, transition: 'width 0.1s ease' }}
                            />
                        </div>

                        <div
                            className="flex items-center px-4 h-full text-theme-body hover:text-theme-highlight bg-theme-highlight hover:bg-theme-body rounded-md border-2 border-theme-highlight transition duration-100"
                            onClick={() => handleCancel()}
                        >
                            {t('Presets.AircraftStates.Cancel')}
                        </div>
                    </>
                ) : (
                    <>
                        {simOnGround
                            ? t('Presets.AircraftStates.SelectAPresetToLoad')
                            : t('Presets.AircraftStates.TheAircraftMustBeOnTheGroundToLoadAPreset')}
                    </>
                )}
            </div>

            <ScrollableContainer innerClassName="space-y-4" height={52}>
                {AircraftPresetsList.map(({ index, name }) => (
                    <div
                        className={`flex justify-center items-center h-24 rounded-md border-2 transition duration-100 text-theme-text hover:text-theme-body bg-theme-accent hover:bg-theme-highlight border-theme-accent ${(!simOnGround || (loadPresetVar && loadPresetVar !== index)) && 'opacity-50 pointer-events-none'}`}
                        onClick={() => handleLoadPreset(index)}
                    >
                        {name}
                    </div>
                ))}
            </ScrollableContainer>
        </div>
    );
};
