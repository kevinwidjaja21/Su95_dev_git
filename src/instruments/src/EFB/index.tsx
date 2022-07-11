import React, { useState, useEffect } from 'react';
import { MemoryRouter as Router } from 'react-router-dom';
import { customAlphabet } from 'nanoid';
import { NXDataStore } from '@shared/persistence';
import { usePersistentProperty } from '@instruments/common/persistence';
import { FailuresOrchestratorProvider } from './failures-orchestrator-provider';
import Efb from './Efb';
import { render } from '../Common/index';
import { readSettingsFromPersistentStorage } from './Settings/sync';
import { useInteractionEvent } from '../util';

import './Assets/Reset.scss';
import './Assets/Efb.scss';

import logo from './Assets/eas-logo.svg';

const ScreenLoading = () => (
    <div className="loading-screen">
        <div className="center">
            <div className="placeholder">
                <img src={logo} className="fbw-logo" alt="logo" />
                {' '}
                flyPad
            </div>
            <div className="loading-bar">
                <div className="loaded" />
            </div>
        </div>
    </div>
);

export enum ContentState {
    OFF,
    LOADING,
    LOADED
}

interface PowerContextInterface {
    content: ContentState,
    setContent: (ContentState) => void
}

export const PowerContext = React.createContext<PowerContextInterface>(undefined as any);

const EFBLoad = () => {
    const [content, setContent] = useState<ContentState>(ContentState.OFF);
    const [, setSessionId] = usePersistentProperty('SU95_SENTRY_SESSION_ID');

    function offToLoaded() {
        setContent(ContentState.LOADING);
        setTimeout(() => {
            setContent(ContentState.LOADED);
        }, 6000);
    }

    useEffect(() => () => setSessionId(''), []);

    useInteractionEvent('A32NX_EFB_POWER', () => {
        if (content === ContentState.OFF) {
            offToLoaded();
        } else {
            setContent(ContentState.OFF);
        }
    });

    switch (content) {
    case ContentState.OFF:
        return <div className="w-screen h-screen" onClick={() => offToLoaded()} />;
    case ContentState.LOADING:
        return <ScreenLoading />;
    case ContentState.LOADED:
        return (
            <Router>
                <PowerContext.Provider value={{ content, setContent }}>
                    <Efb />
                </PowerContext.Provider>
            </Router>
        );
    default:
        throw new Error('Invalid content state provided');
    }
};

readSettingsFromPersistentStorage();

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SESSION_ID_LENGTH = 14;
const nanoid = customAlphabet(ALPHABET, SESSION_ID_LENGTH);
const generatedSessionID = nanoid();

NXDataStore.set('SU95_SENTRY_SESSION_ID', generatedSessionID);

render(<FailuresOrchestratorProvider><EFBLoad /></FailuresOrchestratorProvider>, true, true);
