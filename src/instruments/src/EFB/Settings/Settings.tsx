import React, { useContext, useState, useEffect } from 'react';
import { Slider, Toggle } from '@flybywiresim/react-components';
import { Hoppie } from '@flybywiresim/api-client';
import { useSimVar } from '@instruments/common/simVars';
import { IconArrowLeft, IconArrowRight } from '@tabler/icons';
import { PopUp } from '@shared/popup';
import { HoppieConnector } from '@atsu/com/webinterfaces/HoppieConnector';
import { SelectGroup, SelectItem } from '../Components/Form/Select';
import { usePersistentNumberProperty, usePersistentProperty } from '../../Common/persistence';
import Button, { BUTTON_TYPE } from '../Components/Button/Button';
import ThrottleConfig from './ThrottleConfig/ThrottleConfig';
import SimpleInput from '../Components/Form/SimpleInput/SimpleInput';
import { Navbar } from '../Components/Navbar';
import { SimbriefUserIdContext } from '../Efb';
import {
    FbwAircraftSentryClient,
    SENTRY_CONSENT_KEY,
    SentryConsentState,
} from '../../../../sentry-client/src/FbwAircraftSentryClient';

type ButtonType = {
    name: string,
    setting: string,
}

type SimVarButton = {
    simVarValue: number,
}

const ControlSettings = ({ setShowSettings }) => (
    <div className="bg-navy-lighter divide-y my-4 divide-gray-700 flex flex-col rounded-xl p-6 shadow-lg">
        <div className="flex flex-row justify-between items-center">
            <span className="text-lg text-gray-300">Detents</span>
            <Button type={BUTTON_TYPE.NONE} className="bg-teal-light-contrast border-teal-light-contrast" text="Calibrate" onClick={() => setShowSettings(true)} />
        </div>
    </div>
);

const DefaultsPage = () => {
    const [thrustReductionHeight, setThrustReductionHeight] = usePersistentProperty('CONFIG_THR_RED_ALT', '1500');
    const [thrustReductionHeightSetting, setThrustReductionHeightSetting] = useState(thrustReductionHeight);
    const [accelerationHeight, setAccelerationHeight] = usePersistentProperty('CONFIG_ACCEL_ALT', '1500');
    const [accelerationHeightSetting, setAccelerationHeightSetting] = useState(accelerationHeight);
    const [accelerationOutHeight, setAccelerationOutHeight] = usePersistentProperty('CONFIG_ENG_OUT_ACCEL_ALT', '1500');
    const [accelerationOutHeightSetting, setAccelerationOutHeightSetting] = useState(accelerationOutHeight);

    const handleSetThrustReductionAlt = (value: string) => {
        setThrustReductionHeightSetting(value);

        const parsedValue = parseInt(value);

        if (parsedValue >= 400 && parsedValue <= 5000) {
            setThrustReductionHeight(value.trim());
        }
    };

    const handleSetAccelerationAlt = (value: string) => {
        setAccelerationHeightSetting(value);

        const parsedValue = parseInt(value);

        if (parsedValue >= 400 && parsedValue <= 10000) {
            setAccelerationHeight(value.trim());
        }
    };

    const handleSetAccelerationOutAlt = (value: string) => {
        setAccelerationOutHeightSetting(value);

        const parsedValue = parseInt(value);

        if (parsedValue >= 400 && parsedValue <= 10000) {
            setAccelerationOutHeight(value.trim());
        }
    };

    return (
        <div className="bg-navy-lighter rounded-xl px-6 shadow-lg divide-y divide-gray-700 flex flex-col">

            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">Thrust Reduction Height (ft)</span>
                <div className="flex flex-row">
                    <SimpleInput
                        className="w-30 ml-1.5 px-5 py-1.5 text-lg text-gray-300 rounded-lg bg-navy-light
                            border-2 border-navy-light focus-within:outline-none focus-within:border-teal-light-contrast text-center"
                        placeholder={thrustReductionHeight}
                        noLabel
                        value={thrustReductionHeightSetting}
                        min={400}
                        max={5000}
                        onChange={(event) => handleSetThrustReductionAlt(event)}
                    />
                </div>
            </div>
            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">Acceleration Height (ft)</span>
                <div className="flex flex-row">
                    <SimpleInput
                        className="w-30 ml-1.5 px-5 py-1.5 text-lg text-gray-300 rounded-lg bg-navy-light
                            border-2 border-navy-light focus-within:outline-none focus-within:border-teal-light-contrast text-center"
                        placeholder={accelerationHeight}
                        noLabel
                        value={accelerationHeightSetting}
                        min={400}
                        max={10000}
                        onChange={(event) => handleSetAccelerationAlt(event)}
                    />
                </div>
            </div>
            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">Engine-Out Acceleration Height (ft)</span>
                <div className="flex flex-row">
                    <SimpleInput
                        className="w-30 ml-1.5 px-5 py-1.5 text-lg text-gray-300 rounded-lg bg-navy-light
                            border-2 border-navy-light focus-within:outline-none focus-within:border-teal-light-contrast text-center"
                        placeholder={accelerationOutHeight}
                        noLabel
                        value={accelerationOutHeightSetting}
                        min={400}
                        max={10000}
                        onChange={(event) => handleSetAccelerationOutAlt(event)}
                    />
                </div>
            </div>
        </div>
    );
};

const AircraftConfigurationPage = () => {
    const [weightUnit, setWeightUnit] = usePersistentProperty('CONFIG_USING_METRIC_UNIT', '1');
    const [paxSigns, setPaxSigns] = usePersistentProperty('CONFIG_USING_PORTABLE_DEVICES', '0');
    const [isisBaro, setIsisBaro] = usePersistentProperty('ISIS_BARO_UNIT_INHG', '0');
    const [isisMetricAltitude, setIsisMetricAltitude] = usePersistentProperty('ISIS_METRIC_ALTITUDE', '0');
    const [vhfSpacing, setVhfSpacing] = usePersistentProperty('RMP_VHF_SPACING_25KHZ', '0');
    const [latLonExtended, setLatLonExtended] = usePersistentProperty('LATLON_EXT_FMT', '0');

    const paxSignsButtons: ButtonType[] = [
        { name: 'No Smoking', setting: '0' },
        { name: 'No Portable Device', setting: '1' },
    ];

    const weightUnitButtons: ButtonType[] = [
        { name: 'kg', setting: '1' },
        { name: 'lbs', setting: '0' },
    ];

    const isisBaroButtons: ButtonType[] = [
        { name: 'hPa', setting: '0' },
        { name: 'hPa/inHg', setting: '1' },
    ];

    const isisMetricAltitudeButtons: ButtonType[] = [
        { name: 'Disabled', setting: '0' },
        { name: 'Enabled', setting: '1' },
    ];

    const vhfSpacingButtons: ButtonType[] = [
        { name: '8.33 kHz', setting: '0' },
        { name: '25 kHz', setting: '1' },
    ];

    const latLonExtendedButtons: ButtonType[] = [
        { name: 'LLnn', setting: '0' },
        { name: 'AxxByyy', setting: '1' },
    ];

    return (
        <div className="bg-navy-lighter rounded-xl px-6 shadow-lg divide-y divide-gray-700 flex flex-col">
            <div className="py-4 flex-grow flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300 mr-1">Weight Unit</span>
                <SelectGroup>
                    {weightUnitButtons.map((button) => (
                        <SelectItem
                            enabled
                            onSelect={() => setWeightUnit(button.setting)}
                            selected={weightUnit === button.setting}
                        >
                            {button.name}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </div>

            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">PAX Signs</span>
                <SelectGroup>
                    {paxSignsButtons.map((button) => (
                        <SelectItem
                            enabled
                            onSelect={() => setPaxSigns(button.setting)}
                            selected={paxSigns === button.setting}
                        >
                            {button.name}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </div>

            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">ISIS Baro Unit</span>
                <SelectGroup>
                    {isisBaroButtons.map((button) => (
                        <SelectItem
                            enabled
                            onSelect={() => setIsisBaro(button.setting)}
                            selected={isisBaro === button.setting}
                        >
                            {button.name}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </div>

            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">ISIS Metric Altitude</span>
                <SelectGroup>
                    {isisMetricAltitudeButtons.map((button) => (
                        <SelectItem
                            enabled
                            onSelect={() => setIsisMetricAltitude(button.setting)}
                            selected={isisMetricAltitude === button.setting}
                        >
                            {button.name}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </div>

            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">RMP VHF Spacing</span>
                <SelectGroup>
                    {vhfSpacingButtons.map((button) => (
                        <SelectItem
                            enabled
                            onSelect={() => setVhfSpacing(button.setting)}
                            selected={vhfSpacing === button.setting}
                        >
                            {button.name}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </div>

            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">FMGC Lat/Lon Waypoint Format</span>
                <SelectGroup>
                    {latLonExtendedButtons.map((button) => (
                        <SelectItem
                            enabled
                            onSelect={() => setLatLonExtended(button.setting)}
                            selected={latLonExtended === button.setting}
                        >
                            {button.name}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </div>
        </div>
    );
};

const SimOptionsPage = () => {
    const [showThrottleSettings, setShowThrottleSettings] = useState(false);
    const { setShowNavbar } = useContext(SettingsNavbarContext);
    const [fpSync, setFpSync] = usePersistentProperty('FP_SYNC', 'LOAD');
    const [dynamicRegistration, setDynamicRegistration] = usePersistentProperty('DYNAMIC_REGISTRATION_DECAL', '0');
    const [defaultBaro, setDefaultBaro] = usePersistentProperty('CONFIG_INIT_BARO_UNIT', 'AUTO');
    const [mcduServerPort, setMcduServerPort] = usePersistentProperty('CONFIG_EXTERNAL_MCDU_PORT', '8380');
    const [mcduServerEnabled, setMcduServerEnabled] = usePersistentProperty('CONFIG_EXTERNAL_MCDU_SERVER_ENABLED', 'AUTO ON');
    const [radioReceiverUsage, setRadioReceiverUsage] = usePersistentProperty('RADIO_RECEIVER_USAGE_ENABLED', '0');
    const [, setRadioReceiverUsageSimVar] = useSimVar('L:A32NX_RADIO_RECEIVER_USAGE_ENABLED', 'number', 0);

    const fpSyncButtons: ButtonType[] = [
        { name: 'None', setting: 'NONE' },
        { name: 'Load Only', setting: 'LOAD' },
        { name: 'Save', setting: 'SAVE' },
    ];

    const dynamicRegistrationButtons: ButtonType[] = [
        { name: 'Disabled', setting: '0' },
        { name: 'Enabled', setting: '1' },
    ];

    const defaultBaroButtons: ButtonType[] = [
        { name: 'Auto', setting: 'AUTO' },
        { name: 'in Hg', setting: 'IN HG' },
        { name: 'hPa', setting: 'HPA' },
    ];

    const mcduServerMode: ButtonType[] = [
        { name: 'Auto On', setting: 'AUTO ON' },
        { name: 'Auto Off', setting: 'AUTO OFF' },
        { name: 'Perm Off', setting: 'PERM OFF' },
    ];

    useEffect(() => {
        setShowNavbar(!showThrottleSettings);
    }, [showThrottleSettings]);

    return (
        <div>
            {!showThrottleSettings
        && (
            <>
                <div className="bg-navy-lighter rounded-xl px-6 shadow-lg divide-y divide-gray-700 flex flex-col">

                    <div className="py-4 flex flex-row justify-between items-center">
                        <span className="text-lg text-gray-300 mr-1">Default Baro</span>
                        <SelectGroup>
                            {defaultBaroButtons.map((button) => (
                                <SelectItem
                                    enabled
                                    onSelect={() => setDefaultBaro(button.setting)}
                                    selected={defaultBaro === button.setting}
                                >
                                    {button.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </div>

                    <div className="py-4 flex flex-row justify-between items-center">
                        <span className="text-lg text-gray-300 mr-1">Sync MSFS Flight Plan</span>
                        <SelectGroup>
                            {fpSyncButtons.map((button) => (
                                <SelectItem
                                    enabled
                                    onSelect={() => setFpSync(button.setting)}
                                    selected={fpSync === button.setting}
                                >
                                    {button.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </div>

                    <div className="py-4 flex flex-row justify-between items-center">
                        <span className="text-lg text-gray-300 mr-1">Dynamic Registration Decal</span>
                        <SelectGroup>
                            {dynamicRegistrationButtons.map((button) => (
                                <SelectItem
                                    enabled
                                    onSelect={() => setDynamicRegistration(button.setting)}
                                    selected={dynamicRegistration === button.setting}
                                >
                                    {button.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </div>

                    <div className="py-4 flex flex-row justify-between items-center">
                        <span>
                            <span className="text-lg text-gray-300">External MCDU Server Port</span>
                        </span>
                        <SimpleInput
                            className="w-30 ml-1.5 px-5 py-1.5 text-lg text-gray-300 rounded-lg bg-navy-light
                            border-2 border-navy-light focus-within:outline-none focus-within:border-teal-light-contrast text-center disabled"
                            value={mcduServerPort}
                            noLabel
                            onChange={(event) => {
                                setMcduServerPort(event);
                            }}
                        />
                    </div>

                    <div className="py-4 flex flex-row justify-between items-center">
                        <span>
                            <span className="text-lg text-gray-300">Enable MCDU Server Connection (Auto On deactivates after 5 minutes if no successful connection)</span>
                        </span>
                        <SelectGroup>
                            {mcduServerMode.map((button) => (
                                <SelectItem
                                    enabled
                                    onSelect={() => setMcduServerEnabled(button.setting)}
                                    selected={mcduServerEnabled === button.setting}
                                >
                                    {button.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </div>

                    <div className="py-4 flex flex-row justify-between items-center">
                        <span>
                            <span className="text-lg text-gray-300">Use calculated ILS signals</span>
                        </span>
                        <Toggle
                            value={radioReceiverUsage === '1'}
                            onToggle={(value) => {
                                setRadioReceiverUsage(value ? '1' : '0');
                                setRadioReceiverUsageSimVar(value ? 1 : 0);
                            }}
                        />
                    </div>
                </div>
                <ControlSettings setShowSettings={setShowThrottleSettings} />
            </>
        )}
            <ThrottleConfig isShown={showThrottleSettings} onClose={() => setShowThrottleSettings(false)} />
        </div>
    );
};

const RealismPage = () => {
    const [showThrottleSettings, setShowThrottleSettings] = useState(false);

    const [adirsAlignTime, setAdirsAlignTime] = usePersistentProperty('CONFIG_ALIGN_TIME', 'REAL');
    const [, setAdirsAlignTimeSimVar] = useSimVar('L:A32NX_CONFIG_ADIRS_IR_ALIGN_TIME', 'Enum', Number.MAX_SAFE_INTEGER);
    const [dmcSelfTestTime, setDmcSelfTestTime] = usePersistentProperty('CONFIG_SELF_TEST_TIME', '12');
    const [boardingRate, setBoardingRate] = usePersistentProperty('CONFIG_BOARDING_RATE', 'REAL');
    const [mcduInput, setMcduInput] = usePersistentProperty('MCDU_KB_INPUT', 'DISABLED');
    const [mcduTimeout, setMcduTimeout] = usePersistentProperty('CONFIG_MCDU_KB_TIMEOUT', '60');
    const [realisticTiller, setRealisticTiller] = usePersistentProperty('REALISTIC_TILLER_ENABLED', '0');
    const [homeCockpit, setHomeCockpit] = usePersistentProperty('HOME_COCKPIT_ENABLED', '0');

    const adirsAlignTimeButtons: (ButtonType & SimVarButton)[] = [
        { name: 'Instant', setting: 'INSTANT', simVarValue: 1 },
        { name: 'Fast', setting: 'FAST', simVarValue: 2 },
        { name: 'Real', setting: 'REAL', simVarValue: 0 },
    ];

    const dmcSelfTestTimeButtons: ButtonType[] = [
        { name: 'Instant', setting: '0' },
        { name: 'Fast', setting: '5' },
        { name: 'Real', setting: '12' },
    ];

    const boardingRateButtons: ButtonType[] = [
        { name: 'Instant', setting: 'INSTANT' },
        { name: 'Fast', setting: 'FAST' },
        { name: 'Real', setting: 'REAL' },
    ];

    const steeringSeparationButtons: (ButtonType & SimVarButton)[] = [
        { name: 'Disabled', setting: '0', simVarValue: 0 },
        { name: 'Enabled', setting: '1', simVarValue: 1 },
    ];

    return (
        <div>
            {!showThrottleSettings
        && (
            <>
                <div className="bg-navy-lighter rounded-xl px-6 shadow-lg divide-y divide-gray-700 flex flex-col">
                    <div className="py-4 flex flex-row justify-between items-center">
                        <span className="text-lg text-gray-300">ADIRS Align Time</span>
                        <SelectGroup>
                            {adirsAlignTimeButtons.map((button) => (
                                <SelectItem
                                    enabled
                                    onSelect={() => {
                                        setAdirsAlignTime(button.setting);
                                        setAdirsAlignTimeSimVar(button.simVarValue);
                                    }}
                                    selected={adirsAlignTime === button.setting}
                                >
                                    {button.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </div>

                    <div className="py-4 flex flex-row justify-between items-center">
                        <span className="text-lg text-gray-300">DMC Self Test Time</span>
                        <SelectGroup>
                            {dmcSelfTestTimeButtons.map((button) => (
                                <SelectItem
                                    enabled
                                    onSelect={() => setDmcSelfTestTime(button.setting)}
                                    selected={dmcSelfTestTime === button.setting}
                                >
                                    {button.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </div>

                    <div className="py-4 flex flex-row justify-between items-center">
                        <span className="text-lg text-gray-300">Boarding Time</span>
                        <SelectGroup>
                            {boardingRateButtons.map((button) => (
                                <SelectItem
                                    enabled
                                    onSelect={() => setBoardingRate(button.setting)}
                                    selected={boardingRate === button.setting}
                                >
                                    {button.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </div>

                    <div className="py-4 flex flex-row justify-between items-center">
                        <span>
                            <span className="text-lg text-gray-300">MCDU Keyboard Input</span>
                            <span className="text-lg text-gray-500 ml-2">(unrealistic)</span>
                        </span>
                        <Toggle value={mcduInput === 'ENABLED'} onToggle={(value) => setMcduInput(value ? 'ENABLED' : 'DISABLED')} />
                    </div>

                    <div className="py-4 flex flex-row justify-between items-center">
                        <span>
                            <span className="text-lg text-gray-300">MCDU Focus Timeout (s)</span>
                        </span>
                        <SimpleInput
                            className="w-30 ml-1.5 px-5 py-1.5 text-lg text-gray-300 rounded-lg bg-navy-light
                            border-2 border-navy-light focus-within:outline-none focus-within:border-teal-light-contrast text-center disabled"
                            value={mcduTimeout}
                            noLabel
                            min={5}
                            max={120}
                            disabled={(mcduInput !== 'ENABLED')}
                            onChange={(event) => {
                                if (!Number.isNaN(event) && parseInt(event) >= 5 && parseInt(event) <= 120) {
                                    setMcduTimeout(event.trim());
                                }
                            }}
                        />
                    </div>

                    <div className="py-4 flex flex-row justify-between items-center">
                        <span className="text-lg text-gray-300 mr-1">Separate Tiller from Rudder Inputs</span>
                        <SelectGroup>
                            {steeringSeparationButtons.map((button) => (
                                <SelectItem
                                    enabled
                                    onSelect={() => setRealisticTiller(button.setting)}
                                    selected={realisticTiller === button.setting}
                                >
                                    {button.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    </div>

                    <div className="py-4 flex flex-row justify-between items-center">
                        <span className="text-lg text-gray-300 mr-1">Home Cockpit Mode</span>
                        <Toggle value={homeCockpit === '1'} onToggle={(value) => setHomeCockpit(value ? '1' : '0')} />
                    </div>
                </div>
            </>
        )}
            <ThrottleConfig isShown={showThrottleSettings} onClose={() => setShowThrottleSettings(false)} />
        </div>
    );
};

const ATSUAOCPage = () => {
    const [atisSource, setAtisSource] = usePersistentProperty('CONFIG_ATIS_SRC', 'FAA');
    const [metarSource, setMetarSource] = usePersistentProperty('CONFIG_METAR_SRC', 'MSFS');
    const [tafSource, setTafSource] = usePersistentProperty('CONFIG_TAF_SRC', 'NOAA');
    const [telexEnabled, setTelexEnabled] = usePersistentProperty('CONFIG_ONLINE_FEATURES_STATUS', 'DISABLED');
    const [sentryEnabled, setSentryEnabled] = usePersistentProperty(SENTRY_CONSENT_KEY, SentryConsentState.Refused);

    const [simbriefError, setSimbriefError] = useState(false);
    const { simbriefUserId, setSimbriefUserId } = useContext(SimbriefUserIdContext);
    const [simbriefDisplay, setSimbriefDisplay] = useState(simbriefUserId);

    const [hoppieEnabled, setHoppieEnabled] = usePersistentProperty('CONFIG_HOPPIE_ENABLED', 'DISABLED');
    const [hoppieUserId, setHoppieUserId] = usePersistentProperty('CONFIG_HOPPIE_USERID');
    const [hoppieError, setHoppieError] = useState(false);

    function getSimbriefUserData(value: string): Promise<any> {
        const SIMBRIEF_URL = 'https://www.simbrief.com/api/xml.fetcher.php?json=1';

        if (!value) {
            throw new Error('No SimBrief username/pilot ID provided');
        }

        // The SimBrief API will try both username and pilot ID if either one
        // isn't valid, so request both if the input is plausibly a pilot ID.
        let apiUrl = `${SIMBRIEF_URL}&username=${value}`;
        if (/^\d{1,8}$/.test(value)) {
            apiUrl += `&userid=${value}`;
        }

        return fetch(apiUrl)
            .then((response) => {
                // 400 status means request was invalid, probably invalid username so preserve to display error properly
                if (!response.ok && response.status !== 400) {
                    throw new Error(response.status.toString());
                }

                return response.json();
            });
    }

    function getSimbriefUserId(value: string):Promise<any> {
        return new Promise((resolve, reject) => {
            if (!value) {
                reject(new Error('No SimBrief username/pilot ID provided'));
            }
            getSimbriefUserData(value)
                .then((data) => {
                    if (data.fetch.status === 'Error: Unknown UserID') {
                        reject(new Error('Error: Unknown UserID'));
                    }
                    resolve(data.fetch.userid);
                })
                .catch((_error) => {
                    reject(_error);
                });
        });
    }

    function handleSimbriefUsernameInput(value: string) {
        getSimbriefUserId(value).then((response) => {
            setSimbriefUserId(response);
            setSimbriefDisplay(response);
        }).catch(() => {
            setSimbriefError(true);
            setSimbriefDisplay(simbriefUserId);
            setTimeout(() => {
                setSimbriefError(false);
            }, 4000);
        });
    }

    function getHoppieResponse(value: string): Promise<any> {
        const body = {
            logon: value,
            from: 'FBWA32NX',
            to: 'ALL-CALLSIGNS',
            type: 'ping',
            packet: '',
        };
        return Hoppie.sendRequest(body).then((resp) => resp.response);
    }

    function validateHoppieUserId(value: string):Promise<any> {
        return new Promise((resolve, reject) => {
            if (!value) {
                reject(new Error('No Hoppie user ID provided'));
            }
            getHoppieResponse(value)
                .then((response) => {
                    if (response === 'error {illegal logon code}') {
                        reject(new Error(`Error: Unknown user ID: ${response}`));
                    }
                    resolve(value);
                })
                .catch((_error) => {
                    reject(_error);
                });
        });
    }

    function handleHoppieUsernameInput(value: string) {
        if (value !== '') {
            validateHoppieUserId(value).then((response) => {
                setHoppieUserId(response);
                setHoppieError(false);
            }).catch(() => {
                setHoppieError(true);
                setTimeout(() => {
                    setHoppieError(false);
                }, 4000);
            });
        }
    }

    const atisSourceButtons: ButtonType[] = [
        { name: 'FAA (US)', setting: 'FAA' },
        { name: 'PilotEdge', setting: 'PILOTEDGE' },
        { name: 'IVAO', setting: 'IVAO' },
        { name: 'VATSIM', setting: 'VATSIM' },
    ];

    const metarSourceButtons: ButtonType[] = [
        { name: 'Microsoft', setting: 'MSFS' },
        { name: 'PilotEdge', setting: 'PILOTEDGE' },
        { name: 'IVAO', setting: 'IVAO' },
        { name: 'VATSIM', setting: 'VATSIM' },
    ];

    const tafSourceButtons: ButtonType[] = [
        { name: 'FAA', setting: 'FAA' },
        { name: 'NOAA', setting: 'NOAA' },
    ];

    function handleTelexToggle(toggleValue: boolean) {
        if (toggleValue) {
            new PopUp().showPopUp(
                'TELEX WARNING',
                // eslint-disable-next-line max-len
                'Telex enables free text and live map. If enabled, aircraft position data is published for the duration of the flight. Messages are public and not moderated. USE AT YOUR OWN RISK. To learn more about telex and the features it enables, please go to https://docs.flybywiresim.com/telex. Would you like to enable telex?',
                'small',
                () => setTelexEnabled('ENABLED'),
                () => {},
            );
        } else {
            setTelexEnabled('DISABLED');
        }
    }

    function handleSentryToggle(toggleValue: boolean) {
        if (toggleValue) {
            FbwAircraftSentryClient.requestConsent().then((didConsent) => {
                if (didConsent) {
                    setSentryEnabled(SentryConsentState.Given);
                } else {
                    setSentryEnabled(SentryConsentState.Refused);
                }
            });
        } else {
            setSentryEnabled(SentryConsentState.Refused);
        }
    }

    function handleWeatherSource(source: string, type: string) {
        if (type !== 'TAF') {
            HoppieConnector.deactivateHoppie();
        }

        if (type === 'ATIS') {
            setAtisSource(source);
        } else if (type === 'METAR') {
            setMetarSource(source);
        } else if (type === 'TAF') {
            setTafSource(source);
        }

        if (type !== 'TAF') {
            HoppieConnector.activateHoppie();
        }
    }

    function handleHoppieEnabled(toggleValue: boolean) {
        if (toggleValue) {
            setHoppieEnabled('ENABLED');
            HoppieConnector.activateHoppie();
        } else {
            setHoppieEnabled('DISABLED');
            HoppieConnector.deactivateHoppie();
        }
    }

    return (
        <div className="bg-navy-lighter rounded-xl px-6 divide-y divide-gray-700 flex flex-col">
            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">ATIS/ATC Source</span>
                <SelectGroup>
                    {atisSourceButtons.map((button) => (
                        <SelectItem
                            enabled
                            onSelect={() => handleWeatherSource(button.setting, 'ATIS')}
                            selected={atisSource === button.setting}
                        >
                            {button.name}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </div>
            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">METAR Source</span>
                <SelectGroup>
                    {metarSourceButtons.map((button) => (
                        <SelectItem
                            enabled
                            onSelect={() => handleWeatherSource(button.setting, 'METAR')}
                            selected={metarSource === button.setting}
                        >
                            {button.name}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </div>
            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">TAF Source</span>
                <SelectGroup>
                    {tafSourceButtons.map((button) => (
                        <SelectItem
                            enabled
                            onSelect={() => handleWeatherSource(button.setting, 'TAF')}
                            selected={tafSource === button.setting}
                        >
                            {button.name}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </div>

            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">TELEX</span>
                <Toggle value={telexEnabled === 'ENABLED'} onToggle={(toggleValue) => handleTelexToggle(toggleValue)} />
            </div>

            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">Error Reporting</span>
                <Toggle value={sentryEnabled === SentryConsentState.Given} onToggle={(toggleValue) => handleSentryToggle(toggleValue)} />
            </div>

            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">
                    SimBrief Username/Pilot ID
                    <span className={`${!simbriefError && 'hidden'} text-red-600`}>
                        <span className="text-white"> | </span>
                        SimBrief Error
                    </span>
                </span>
                <div className="flex flex-row items-center">
                    <SimpleInput
                        className="w-30"
                        value={simbriefDisplay}
                        noLabel
                        onBlur={(value) => handleSimbriefUsernameInput(value.replace(/\s/g, ''))}
                        onChange={(value) => setSimbriefDisplay(value)}
                    />
                </div>
            </div>
            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">
                    Hoppie User ID
                    <span className={`${!hoppieError && 'hidden'} text-red-600`}>
                        <span className="text-white"> | </span>
                        Hoppie Error
                    </span>
                </span>
                <div className="flex flex-row items-center">
                    <SimpleInput
                        className="w-30"
                        value={hoppieUserId}
                        noLabel
                        onBlur={(value) => handleHoppieUsernameInput(value.replace(/\s/g, ''))}
                        onChange={(value) => setHoppieUserId(value)}
                    />
                </div>
            </div>
            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">Hoppie enabled</span>
                <Toggle value={hoppieEnabled === 'ENABLED'} onToggle={(toggleValue) => handleHoppieEnabled(toggleValue)} />
            </div>
        </div>
    );
};

const AudioPage = () => {
    const [ptuAudible, setPtuAudible] = usePersistentNumberProperty('SOUND_PTU_AUDIBLE_COCKPIT', 0);
    const [exteriorVolume, setExteriorVolume] = usePersistentNumberProperty('SOUND_EXTERIOR_MASTER', 0);
    const [engineVolume, setEngineVolume] = usePersistentNumberProperty('SOUND_INTERIOR_ENGINE', 0);
    const [windVolume, setWindVolume] = usePersistentNumberProperty('SOUND_INTERIOR_WIND', 0);
    const [passengerAmbienceEnabled, setPassengerAmbienceEnabled] = usePersistentNumberProperty('SOUND_PASSENGER_AMBIENCE_ENABLED', 1);
    const [announcementsEnabled, setAnnouncementsEnabled] = usePersistentNumberProperty('SOUND_ANNOUNCEMENTS_ENABLED', 1);
    const [boardingMusicEnabled, setBoardingMusicEnabled] = usePersistentNumberProperty('SOUND_BOARDING_MUSIC_ENABLED', 1);

    return (
        <div className="bg-navy-lighter divide-y divide-gray-700 flex flex-col rounded-xl px-6 ">
            <div className="py-8 flex flex-row justify-between items-center">
                <span>
                    <span className="text-lg text-gray-300">PTU Audible in Cockpit</span>
                    <span className="text-lg text-gray-500 ml-2">(unrealistic)</span>
                </span>
                <Toggle value={!!ptuAudible} onToggle={(value) => setPtuAudible(value ? 1 : 0)} />
            </div>
            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">Exterior Master Volume</span>
                <div className="flex flex-row items-center py-1.5">
                    <span className="text-base pr-3">{exteriorVolume}</span>
                    <Slider className="w-60" value={exteriorVolume + 50} onInput={(value) => setExteriorVolume(value - 50)} />
                </div>
            </div>
            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">Engine Interior Volume</span>
                <div className="flex flex-row items-center py-1.5">
                    <span className="text-base pr-3">{engineVolume}</span>
                    <Slider className="w-60" value={engineVolume + 50} onInput={(value) => setEngineVolume(value - 50)} />
                </div>
            </div>
            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">Wind Interior Volume</span>
                <div className="flex flex-row items-center py-1.5">
                    <span className="text-base pr-3">{windVolume}</span>
                    <Slider className="w-60" value={windVolume + 50} onInput={(value) => setWindVolume(value - 50)} />
                </div>
            </div>
            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">Passenger Ambience</span>
                <div className="flex flex-row items-center py-1.5">
                    <Toggle value={!!passengerAmbienceEnabled} onToggle={(value) => setPassengerAmbienceEnabled(value ? 1 : 0)} />
                </div>
            </div>
            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">Announcements</span>
                <div className="flex flex-row items-center py-1.5">
                    <Toggle value={!!announcementsEnabled} onToggle={(value) => setAnnouncementsEnabled(value ? 1 : 0)} />
                </div>
            </div>
            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">Boarding Music</span>
                <div className="flex flex-row items-center py-1.5">
                    <Toggle value={!!boardingMusicEnabled} onToggle={(value) => setBoardingMusicEnabled(value ? 1 : 0)} />
                </div>
            </div>
        </div>
    );
};

const FlyPadPage = () => {
    const [brightnessSetting, setBrightnessSetting] = usePersistentNumberProperty('EFB_BRIGHTNESS', 0);
    const [brightness] = useSimVar('L:A32NX_EFB_BRIGHTNESS', 'number', 500);
    const [usingAutobrightness, setUsingAutobrightness] = usePersistentNumberProperty('EFB_USING_AUTOBRIGHTNESS', 0);
    const [usingColoredMetar, setUsingColoredMetar] = usePersistentNumberProperty('EFB_USING_COLOREDMETAR', 1);

    return (
        <div className="bg-navy-lighter rounded-xl px-6 shadow-lg divide-y divide-gray-700 flex flex-col">
            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">Brightness</span>
                <div className={`flex flex-row items-center py-1.5 ${usingAutobrightness && 'pointer-events-none filter saturate-0'}`}>
                    <Slider className="w-60" value={usingAutobrightness ? brightness : brightnessSetting} onInput={(value) => setBrightnessSetting(value)} />
                </div>
            </div>
            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">Auto Brightness</span>
                <div className="flex flex-row items-center py-1.5">
                    <Toggle value={!!usingAutobrightness} onToggle={(value) => setUsingAutobrightness(value ? 1 : 0)} />
                </div>
            </div>
            <div className="py-4 flex flex-row justify-between items-center">
                <span className="text-lg text-gray-300">Colored Metar</span>
                <div className="flex flex-row items-center py-1.5">
                    <Toggle value={!!usingColoredMetar} onToggle={(value) => setUsingColoredMetar(value ? 1 : 0)} />
                </div>
            </div>
        </div>
    );
};

interface SettingsNavbarContextInterface {
    showNavbar: boolean,
    setShowNavbar: (newValue: boolean) => void
}

const SettingsNavbarContext = React.createContext<SettingsNavbarContextInterface>(undefined as any);

const Settings = () => {
    const [selectedTabIndex, setSelectedTabIndex] = useState(0);
    const [subPageIndex, setSubPageIndex] = useState(0);
    const [showNavbar, setShowNavbar] = useState(true);

    function currentPage(): JSX.Element[] {
        switch (selectedTabIndex) {
        case 0: return [<DefaultsPage />];
        case 1: return [<AircraftConfigurationPage />];
        case 2: return [<SimOptionsPage />];
        case 3: return [<RealismPage />];
        case 4: return [<ATSUAOCPage />];
        case 5: return [<AudioPage />];
        case 6: return [<FlyPadPage />];
        default: return [<AircraftConfigurationPage />];
        }
    }

    return (
        <SettingsNavbarContext.Provider value={{ showNavbar, setShowNavbar }}>
            <div className="w-full">
                <div className={`flex flex-row flex-wrap items-center space-x-10 mb-2 ${!showNavbar && 'hidden'}`}>
                    <Navbar
                        tabs={[
                            'Defaults',
                            'Aircraft Configuration',
                            'Sim Options',
                            'Realism',
                            'ATSU/AOC',
                            'Audio',
                            'flyPad',
                        ]}
                        onSelected={(indexNumber) => {
                            setSelectedTabIndex(indexNumber);
                            setSubPageIndex(0);
                        }}
                    />
                </div>
                {currentPage()[subPageIndex]}
                <div className={`mx-auto w-min mb-4 flex flex-row space-x-10 items-center justify-center mt-5 align-baseline ${!showNavbar && 'hidden'}`}>
                    <div
                        className={`p-3 rounded-full duration-200
                            ${subPageIndex === 0 ? 'bg-navy-lighter text-gray-700' : 'bg-teal-light-contrast hover:bg-white hover:text-teal-light-contrast text-white'}`}
                        onClick={() => {
                            if (subPageIndex > 0) {
                                setSubPageIndex(subPageIndex - 1);
                            }
                        }}
                    >
                        <IconArrowLeft size={32} className="text-current" />
                    </div>
                    <div
                        className={`p-3 rounded-full duration-200
                            ${subPageIndex === currentPage().length - 1 ? 'bg-navy-lighter text-gray-700' : 'bg-teal-light-contrast hover:bg-white hover:text-teal-light-contrast text-white'}`}
                        onClick={() => {
                            if (subPageIndex < currentPage().length - 1) {
                                setSubPageIndex(subPageIndex + 1);
                            }
                        }}
                    >
                        <IconArrowRight size={32} className="text-current" />
                    </div>
                </div>
            </div>
        </SettingsNavbarContext.Provider>
    );
};

export default Settings;
