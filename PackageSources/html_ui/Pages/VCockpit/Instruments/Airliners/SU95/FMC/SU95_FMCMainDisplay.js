class FMCMainDisplay extends BaseAirliners {
    constructor() {
        super(...arguments);
        this.currentFlightPlanWaypointIndex = -1;
        this.costIndex = 0;
        this.costIndexSet = false;
        this.maxCruiseFL = 400;
        this.routeIndex = 0;
        this.coRoute = "";
        this.tmpOrigin = "";
        this.transitionAltitude = 10000;
        this.perfTOTemp = NaN;
        this._overridenFlapApproachSpeed = NaN;
        this._overridenSlatApproachSpeed = NaN;
        this._routeFinalFuelWeight = 0;
        this._routeFinalFuelTime = 30;
        this._routeFinalFuelTimeDefault = 30;
        this._routeReservedWeight = 0;
        this._routeReservedPercent = 5;
        this.takeOffWeight = NaN;
        this.landingWeight = NaN;
        this.averageWind = 0;
        this.perfApprQNH = NaN;
        this.perfApprTemp = NaN;
        this.perfApprWindHeading = NaN;
        this.perfApprWindSpeed = NaN;
        this.perfApprTransAlt = NaN;
        this.perfApprTransAltPilotEntered = false;
        this._v1Checked = true;
        this._vRChecked = true;
        this._v2Checked = true;
        this._toFlexChecked = true;
        this.toRunway = "";
        this.vApp = NaN;
        this.perfApprMDA = NaN;
        this.perfApprDH = NaN;
        this.perfApprFlaps3 = false;
        this._lockConnectIls = false;
        this._apNavIndex = 1;
        this._apLocalizerOn = false;
        this._canSwitchToNav = false;
        this._vhf1Frequency = 0;
        this._vhf2Frequency = 0;
        this._vor1Frequency = 0;
        this._vor1Course = 0;
        this._vor2Frequency = 0;
        this._vor2Course = 0;
        this._ilsFrequency = 0;
        this._ilsFrequencyPilotEntered = false;
        this._ilsCourse = 0;
        this._adf1Frequency = 0;
        this._adf2Frequency = 0;
        this._rcl1Frequency = 0;
        this._pre2Frequency = 0;
        this._atc1Frequency = 0;
        this._radioNavOn = false;
        this._debug = 0;
        this._checkFlightPlan = 0;
        this.thrustReductionAltitude = NaN;
        this.thrustReductionAltitudeGoaround = NaN;
        this.thrustReductionAltitudeIsPilotEntered = false;
        this.accelerationAltitude = NaN;
        this.accelerationAltitudeGoaround = NaN;
        this.accelerationAltitudeIsPilotEntered = false;
        this.engineOutAccelerationAltitude = NaN;
        this.engineOutAccelerationAltitudeGoaround = NaN;
        this.engineOutAccelerationAltitudeIsPilotEntered = false;

        this._windDirections = {
            TAILWIND : "TL",
            HEADWIND : "HD"
        };
        this._fuelPlanningPhases = {
            PLANNING : 1,
            IN_PROGRESS : 2,
            COMPLETED : 3
        };
        this._zeroFuelWeightZFWCGEntered = false;
        this._taxiEntered = false;
        this._windDir = this._windDirections.HEADWIND;
        this._DistanceToAlt = 0;
        this._routeAltFuelWeight = 0;
        this._routeAltFuelTime = 0;
        this._routeTripFuelWeight = 0;
        this._routeTripTime = 0;
        this._defaultTaxiFuelWeight = 0.2;
        this._rteRsvPercentOOR = false;
        this._rteReservedEntered = false;
        this._rteFinalCoeffecient = 0;
        this._rteFinalEntered = false;
        this._routeAltFuelEntered = false;
        this._minDestFob = 0;
        this._minDestFobEntered = false;
        this._defaultRouteFinalTime = 45;
        this._fuelPredDone = false;
        this._fuelPlanningPhase = this._fuelPlanningPhases.PLANNING;
        this._blockFuelEntered = false;
        /* CPDLC Fields */
        this.tropo = "";
        this._destDataChecked = false;
        this._towerHeadwind = 0;
        this._conversionWeight = parseFloat(NXDataStore.get("CONFIG_USING_METRIC_UNIT", "1"));
        this._EfobBelowMinClr = false;
        this.simbrief = {
            route: "",
            cruiseAltitude: "",
            originIcao: "",
            destinationIcao: "",
            blockFuel: "",
            payload: undefined,
            estZfw: "",
            sendStatus: "READY",
            costIndex: "",
            navlog: [],
            icao_airline: "",
            flight_number: "",
            alternateIcao: "",
            avgTropopause: "",
            ete: "",
            blockTime: "",
            outTime: "",
            onTime: "",
            inTime: "",
            offTime: "",
            taxiFuel: "",
            tripFuel: ""
        };
        this.aocWeight = {
            blockFuel: undefined,
            estZfw: undefined,
            taxiFuel: undefined,
            tripFuel: undefined,
            payload: undefined
        };
        this.aocTimes = {
            doors: 0,
            off: 0,
            out: 0,
            on: 0,
            in: 0,
        };
        this.winds = {
            climb: [],
            cruise: [],
            des: [],
            alternate: null
        };
        this.approachSpeeds = undefined; // based on selected config, not current config
        this._cruiseEntered = false;
        this._blockFuelEntered = false;
        this.currentFlightPhase = FmgcFlightPhases.PREFLIGHT;
        this.constraintAlt = 0;
        this.constraintAltCached = 0;
        this.fcuSelAlt = 0;
        this._forceNextAltitudeUpdate = false;
        this._lastUpdateAPTime = NaN;
        this.updateAutopilotCooldown = 0;
        this._lastHasReachFlex = false;
        this._apMasterStatus = false;
        this._apCooldown = 500;
        this._lastRequestedFLCModeWaypointIndex = -1;
        this.flightPhaseUpdateThrottler = new UpdateThrottler(800);
        this._cruiseFlightLevel = undefined;
        this._activeCruiseFlightLevel = undefined;
        this._activeCruiseFlightLevelDefaulToFcu = false;
        this.fmsUpdateThrottler = new UpdateThrottler(250);
    }

    Init() {
        super.Init();

        this.A32NXCore = new A32NX_Core();
        this.A32NXCore.init(this._lastTime);

        this.dataManager = new FMCDataManager(this);

        this.flightPhaseManager = new A32NX_FlightPhaseManager(this);

        this.tempCurve = new Avionics.Curve();
        this.tempCurve.interpolationFunction = Avionics.CurveTool.NumberInterpolation;
        this.tempCurve.add(-10 * 3.28084, 21.50);
        this.tempCurve.add(0, 15.00);
        this.tempCurve.add(10 * 3.28084, 8.50);
        this.tempCurve.add(20 * 3.28084, 2.00);
        this.tempCurve.add(30 * 3.28084, -4.49);
        this.tempCurve.add(40 * 3.28084, -10.98);
        this.tempCurve.add(50 * 3.28084, -17.47);
        this.tempCurve.add(60 * 3.28084, -23.96);
        this.tempCurve.add(70 * 3.28084, -30.45);
        this.tempCurve.add(80 * 3.28084, -36.94);
        this.tempCurve.add(90 * 3.28084, -43.42);
        this.tempCurve.add(100 * 3.28084, -49.90);
        this.tempCurve.add(150 * 3.28084, -56.50);
        this.tempCurve.add(200 * 3.28084, -56.50);
        this.tempCurve.add(250 * 3.28084, -51.60);
        this.tempCurve.add(300 * 3.28084, -46.64);
        this.tempCurve.add(400 * 3.28084, -22.80);
        this.tempCurve.add(500 * 3.28084, -2.5);
        this.tempCurve.add(600 * 3.28084, -26.13);
        this.tempCurve.add(700 * 3.28084, -53.57);
        this.tempCurve.add(800 * 3.28084, -74.51);

        this.cruiseFlightLevel = SimVar.GetGameVarValue("AIRCRAFT CRUISE ALTITUDE", "feet");
        this.cruiseFlightLevel /= 100;

        SimVar.SetSimVarValue("L:FLIGHTPLAN_USE_DECEL_WAYPOINT", "number", 1);

        SimVar.SetSimVarValue("L:AIRLINER_DECISION_HEIGHT", "feet", -1);

        this.flightPlanManager.onCurrentGameFlightLoaded(() => {
            this.flightPlanManager.updateFlightPlan(() => {
                this.flightPlanManager.updateCurrentApproach(() => {
                    const frequency = this.flightPlanManager.getApproachNavFrequency();
                    if (isFinite(frequency)) {
                        const freq = Math.round(frequency * 100) / 100;
                        if (this.connectIlsFrequency(freq)) {
                            this._ilsFrequencyPilotEntered = false;
                            SimVar.SetSimVarValue("L:FLIGHTPLAN_APPROACH_ILS", "number", freq);
                            const approach = this.flightPlanManager.getApproach();
                            if (approach && approach.name && approach.name.indexOf("ILS") !== -1) {
                                const runway = this.flightPlanManager.getApproachRunway();
                                if (runway) {
                                    SimVar.SetSimVarValue("L:FLIGHTPLAN_APPROACH_COURSE", "number", runway.direction);
                                }
                            }
                        }
                    }
                });
                const callback = () => {
                    this.flightPlanManager.createNewFlightPlan();
                    SimVar.SetSimVarValue("L:AIRLINER_V1_SPEED", "Knots", NaN);
                    SimVar.SetSimVarValue("L:AIRLINER_V2_SPEED", "Knots", NaN);
                    SimVar.SetSimVarValue("L:AIRLINER_VR_SPEED", "Knots", NaN);
                    const cruiseAlt = Math.floor(this.flightPlanManager.cruisingAltitude / 100);
                    console.log("FlightPlan Cruise Override. Cruising at FL" + cruiseAlt + " instead of default FL" + this.cruiseFlightLevel);
                    if (cruiseAlt > 0) {
                        this.cruiseFlightLevel = cruiseAlt;
                    }
                };
                const arrivalIndex = this.flightPlanManager.getArrivalProcIndex();
                if (arrivalIndex >= 0) {
                    this.flightPlanManager.setArrivalProcIndex(arrivalIndex, callback);
                } else {
                    callback();
                }
            });
        });

        this.updateFuelVars();

        CDUPerformancePage.UpdateThrRedAccFromOrigin(this, true, true);
        CDUPerformancePage.UpdateEngOutAccFromOrigin(this);
        SimVar.SetSimVarValue("L:AIRLINER_THR_RED_ALT", "Number", this.thrustReductionAltitude);

        // Start the check routine for system health and status
        setInterval(() => {
            if (this.currentFlightPhase === FmgcFlightPhases.CRUISE && !this._destDataChecked) {
                const dest = this.flightPlanManager.getDestination();
                if (dest && dest.liveDistanceTo < 180) {
                    this._destDataChecked = true;
                    this.checkDestData();
                }
            }
        }, 15000);
    }

    onUpdate(_deltaTime) {
        super.onUpdate(_deltaTime);

        if (this._debug++ > 180) {
            this._debug = 0;
        }
        const flightPhaseManagerDelta = this.flightPhaseUpdateThrottler.canUpdate(_deltaTime);
        if (flightPhaseManagerDelta !== -1) {
            this.flightPhaseManager.checkFlightPhase(flightPhaseManagerDelta);
        }
        this._checkFlightPlan--;
        if (this._checkFlightPlan <= 0) {
            this._checkFlightPlan = 120;
            this.flightPlanManager.updateFlightPlan();
            this.flightPlanManager.updateCurrentApproach();
        }

        if (this.fmsUpdateThrottler.canUpdate(_deltaTime) !== -1) {
            this.updateRadioNavState();
            this.updateGPSMessage();
            this.updateDisplayedConstraints();
        }

        this.A32NXCore.update();

        this.updateAutopilot();
    }

    /**
     * This method is called by the FlightPhaseManager after a flight phase change
     * This method initializes AP States, initiates CDUPerformancePage changes and other set other required states
     * @param _lastFlightPhase {FmgcFlightPhases} Previous FmgcFlightPhase
     * @param _curFlightPhase {FmgcFlightPhases} New FmgcFlightPhase
     */
    onFlightPhaseChanged(_lastFlightPhase, _curFlightPhase) {
        this.updateConstraints();

        SimVar.SetSimVarValue("L:A32NX_CABIN_READY", "Bool", 0);

        switch (_curFlightPhase) {
            case FmgcFlightPhases.TAKEOFF: {
                this._destDataChecked = false;

                if (this.page.Current === this.page.PerformancePageTakeoff) {
                    CDUPerformancePage.ShowTAKEOFFPage(this);
                } else if (this.page.Current === this.page.ProgressPage) {
                    CDUProgressPage.ShowPage(this);
                }

                break;
            }

            case FmgcFlightPhases.CLIMB: {
                //TODO: when react PFD move vspeed reset to done flight phase (currently needed to keep the PFD working)
                SimVar.SetSimVarValue("L:AIRLINER_V1_SPEED", "Knots", -1);
                SimVar.SetSimVarValue("L:AIRLINER_VR_SPEED", "Knots", -1);
                SimVar.SetSimVarValue("L:AIRLINER_V2_SPEED", "Knots", -1);

                this._destDataChecked = false;

                if (this.canShowNextPerfPage(_lastFlightPhase)) {
                    CDUPerformancePage.ShowCLBPage(this);
                } else if (this.page.Current === this.page.ProgressPage) {
                    CDUProgressPage.ShowPage(this);
                }

                let preSelectedClbSpeed = this.preSelectedClbSpeed;

                if (SimVar.GetSimVarValue("L:A32NX_GOAROUND_PASSED", "bool") === 1) {
                    preSelectedClbSpeed = this.computedVgd;
                }

                if (isFinite(preSelectedClbSpeed)) {
                    this.setAPSelectedSpeed(preSelectedClbSpeed, Aircraft.A320_NEO);
                    SimVar.SetSimVarValue("K:SPEED_SLOT_INDEX_SET", "number", 1);
                }

                SimVar.SetSimVarValue("L:A32NX_AUTOBRAKES_BRAKING", "Bool", 0);

                break;
            }

            case FmgcFlightPhases.CRUISE: {
                if (this.canShowNextPerfPage(_lastFlightPhase)) {
                    CDUPerformancePage.ShowCRZPage(this);
                } else if (this.page.Current === this.page.ProgressPage) {
                    CDUProgressPage.ShowPage(this);
                }

                SimVar.SetSimVarValue("L:A32NX_GOAROUND_PASSED", "bool", 0);
                Coherent.call("GENERAL_ENG_THROTTLE_MANAGED_MODE_SET", ThrottleMode.AUTO);

                if (isFinite(this.preSelectedCrzSpeed)) {
                    this.setAPSelectedSpeed(this.preSelectedCrzSpeed, Aircraft.A320_NEO);
                    SimVar.SetSimVarValue("K:SPEED_SLOT_INDEX_SET", "number", 1);
                }

                break;
            }

            case FmgcFlightPhases.DESCENT: {
                if (this.canShowNextPerfPage(_lastFlightPhase)) {
                    CDUPerformancePage.ShowDESPage(this);
                } else if (this.page.Current === this.page.ProgressPage) {
                    CDUProgressPage.ShowPage(this);
                }

                this.checkDestData();

                Coherent.call("GENERAL_ENG_THROTTLE_MANAGED_MODE_SET", ThrottleMode.AUTO);

                if (isFinite(this.preSelectedDesSpeed)) {
                    this.setAPSelectedSpeed(this.preSelectedDesSpeed, Aircraft.A320_NEO);
                    SimVar.SetSimVarValue("K:SPEED_SLOT_INDEX_SET", "number", 1);
                }

                break;
            }

            case FmgcFlightPhases.APPROACH: {
                if (this.canShowNextPerfPage(_lastFlightPhase)) {
                    CDUPerformancePage.ShowAPPRPage(this);
                } else if (this.page.Current === this.page.ProgressPage) {
                    CDUProgressPage.ShowPage(this);
                }

                this.connectIls();
                this.flightPlanManager.activateApproach();

                Coherent.call("GENERAL_ENG_THROTTLE_MANAGED_MODE_SET", ThrottleMode.AUTO);
                SimVar.SetSimVarValue("L:A32NX_GOAROUND_PASSED", "bool", 0);

                this.checkDestData();

                break;
            }

            case FmgcFlightPhases.GOAROUND: {
                SimVar.SetSimVarValue("L:A32NX_GOAROUND_GATRK_MODE", "bool", 0);
                SimVar.SetSimVarValue("L:A32NX_GOAROUND_HDG_MODE", "bool", 0);
                SimVar.SetSimVarValue("L:A32NX_GOAROUND_NAV_MODE", "bool", 0);
                SimVar.SetSimVarValue("L:A32NX_GOAROUND_INIT_SPEED", "number", Simplane.getIndicatedSpeed());
                SimVar.SetSimVarValue("L:A32NX_GOAROUND_INIT_APP_SPEED", "number", this.getVApp());
                //delete override logic when we have valid nav data -aka goaround path- after goaround!
                SimVar.SetSimVarValue("L:A32NX_GOAROUND_NAV_OVERRIDE", "bool", 0);

                if (SimVar.GetSimVarValue("AUTOPILOT MASTER", "Bool") === 1) {
                    SimVar.SetSimVarValue("K:AP_LOC_HOLD_ON", "number", 1); // Turns AP localizer hold !!ON/ARMED!! and glide-slope hold mode !!OFF!!
                    SimVar.SetSimVarValue("K:AP_LOC_HOLD_OFF", "number", 1); // Turns !!OFF!! localizer hold mode
                    SimVar.SetSimVarValue("K:AUTOPILOT_OFF", "number", 1);
                    SimVar.SetSimVarValue("K:AUTOPILOT_ON", "number", 1);
                    SimVar.SetSimVarValue("L:A32NX_AUTOPILOT_APPR_MODE", "bool", 0);
                    SimVar.SetSimVarValue("L:A32NX_AUTOPILOT_LOC_MODE", "bool", 0);
                } else if (SimVar.GetSimVarValue("AUTOPILOT MASTER", "Bool") === 0 && SimVar.GetSimVarValue("AUTOPILOT APPROACH HOLD", "boolean") === 1) {
                    SimVar.SetSimVarValue("AP_APR_HOLD_OFF", "number", 1);
                    SimVar.SetSimVarValue("L:A32NX_AUTOPILOT_APPR_MODE", "bool", 0);
                    SimVar.SetSimVarValue("L:A32NX_AUTOPILOT_LOC_MODE", "bool", 0);
                }

                const currentHeading = Simplane.getHeadingMagnetic();
                Coherent.call("HEADING_BUG_SET", 1, currentHeading);

                if (this.canShowNextPerfPage(_lastFlightPhase)) {
                    CDUPerformancePage.ShowGOAROUNDPage(this);
                } else if (this.page.Current === this.page.ProgressPage) {
                    CDUProgressPage.ShowPage(this);
                }

                break;
            }
        }
    }

    updateRadioNavState() {
        if (this.isPrimary) {
            const radioNavOn = this.isRadioNavActive();
            if (radioNavOn !== this._radioNavOn) {
                this._radioNavOn = radioNavOn;
                if (!radioNavOn) {
                    this.initRadioNav(false);
                }
                if (this.refreshPageCallback) {
                    this.refreshPageCallback();
                }
            }
            let apNavIndex = 1;
            let gpsDriven = true;
            const apprHold = SimVar.GetSimVarValue("AUTOPILOT APPROACH HOLD", "Bool");
            if (apprHold) {
                if (this.canSwitchToNav()) {
                    let navid = 0;
                    const ils = this.radioNav.getBestILSBeacon();
                    if (ils.id > 0) {
                        navid = ils.id;
                    } else {
                        const vor = this.radioNav.getBestVORBeacon();
                        if (vor.id > 0) {
                            navid = vor.id;
                        }
                    }
                    if (navid > 0) {
                        apNavIndex = navid;
                        const hasFlightplan = Simplane.getAutopilotGPSActive();
                        const apprCaptured = Simplane.getAutoPilotAPPRCaptured();
                        if (apprCaptured || !hasFlightplan) {
                            gpsDriven = false;
                        }
                    }
                }
            }
            if (apNavIndex !== this._apNavIndex) {
                SimVar.SetSimVarValue("K:AP_NAV_SELECT_SET", "number", apNavIndex);
                this._apNavIndex = apNavIndex;
            }
            const curState = SimVar.GetSimVarValue("GPS DRIVES NAV1", "Bool");
            if (!!curState !== gpsDriven) {
                SimVar.SetSimVarValue("K:TOGGLE_GPS_DRIVES_NAV1", "Bool", 0);
            }
        }
    }

    updateAutopilot() {
        const now = performance.now();
        const dt = now - this._lastUpdateAPTime;
        let apLogicOn = (this._apMasterStatus || Simplane.getAutoPilotFlightDirectorActive(1));
        this._lastUpdateAPTime = now;
        if (isFinite(dt)) {
            this.updateAutopilotCooldown -= dt;
        }
        if (SimVar.GetSimVarValue("L:AIRLINER_FMC_FORCE_NEXT_UPDATE", "number") === 1) {
            SimVar.SetSimVarValue("L:AIRLINER_FMC_FORCE_NEXT_UPDATE", "number", 0);
            this.updateAutopilotCooldown = -1;
        }
        if (apLogicOn && this.currentFlightPhase >= FmgcFlightPhases.TAKEOFF) {
            if (this.isHeadingManaged()) {
                const heading = SimVar.GetSimVarValue("GPS COURSE TO STEER", "degree", "FMC");
                if (isFinite(heading)) {
                    Coherent.call("HEADING_BUG_SET", 2, heading);
                }
            }
        }
        if (this.updateAutopilotCooldown < 0) {
            this.updatePerfSpeeds();
            const currentApMasterStatus = SimVar.GetSimVarValue("AUTOPILOT MASTER", "boolean");
            if (currentApMasterStatus !== this._apMasterStatus) {
                this._apMasterStatus = currentApMasterStatus;
                apLogicOn = (this._apMasterStatus || Simplane.getAutoPilotFlightDirectorActive(1));
                this._forceNextAltitudeUpdate = true;
                console.log("Enforce AP in Altitude Lock mode. Cause : AP Master Status has changed.");
                SimVar.SetSimVarValue("L:A320_NEO_FCU_FORCE_IDLE_VS", "Number", 1);
                if (this._apMasterStatus) {
                    if (this.flightPlanManager.getWaypointsCount() === 0) {
                        this._onModeSelectedAltitude();
                        this._onModeSelectedHeading();
                        this._onModeSelectedSpeed();
                    }
                }
            }
            if (apLogicOn) {
                if (!Simplane.getAutoPilotFLCActive() && !SimVar.GetSimVarValue("AUTOPILOT AIRSPEED HOLD", "Boolean")) {
                    SimVar.SetSimVarValue("K:AP_PANEL_SPEED_HOLD", "Number", 1);
                }
                if (!SimVar.GetSimVarValue("AUTOPILOT HEADING LOCK", "Boolean")) {
                    if (!SimVar.GetSimVarValue("AUTOPILOT APPROACH HOLD", "Boolean")) {
                        SimVar.SetSimVarValue("K:AP_PANEL_HEADING_HOLD", "Number", 1);
                    }
                }
            }
            const currentHasReachedFlex = Simplane.getEngineThrottleMode(0) >= ThrottleMode.FLEX_MCT && Simplane.getEngineThrottleMode(1) >= ThrottleMode.FLEX_MCT;
            if (currentHasReachedFlex !== this._lastHasReachFlex) {
                this._lastHasReachFlex = currentHasReachedFlex;
                console.log("Current Has Reached Flex = " + currentHasReachedFlex);
                if (currentHasReachedFlex) {
                    if (!SimVar.GetSimVarValue("AUTOPILOT THROTTLE ARM", "boolean")) {
                        SimVar.SetSimVarValue("K:AUTO_THROTTLE_ARM", "number", 1);
                    }
                }
            }
            const currentAltitude = Simplane.getAltitude();
            const groundSpeed = Simplane.getGroundSpeed();
            const apTargetAltitude = Simplane.getAutoPilotAltitudeLockValue("feet");
            let showTopOfClimb = false;
            let topOfClimbLlaHeading;
            const planeCoordinates = new LatLong(SimVar.GetSimVarValue("PLANE LATITUDE", "degree latitude"), SimVar.GetSimVarValue("PLANE LONGITUDE", "degree longitude"));
            if (apTargetAltitude > currentAltitude + 40) {
                const vSpeed = Simplane.getVerticalSpeed();
                const climbDuration = (apTargetAltitude - currentAltitude) / vSpeed / 60;
                const climbDistance = climbDuration * groundSpeed;
                if (climbDistance > 1) {
                    topOfClimbLlaHeading = this.flightPlanManager.getCoordinatesHeadingAtDistanceAlongFlightPlan(climbDistance);
                    if (topOfClimbLlaHeading) {
                        showTopOfClimb = true;
                    }
                }
            }
            if (showTopOfClimb) {
                SimVar.SetSimVarValue("L:AIRLINER_FMS_SHOW_TOP_CLIMB", "number", 1);
                SimVar.SetSimVarValue("L:AIRLINER_FMS_LAT_TOP_CLIMB", "number", topOfClimbLlaHeading.lla.lat);
                SimVar.SetSimVarValue("L:AIRLINER_FMS_LONG_TOP_CLIMB", "number", topOfClimbLlaHeading.lla.long);
                SimVar.SetSimVarValue("L:AIRLINER_FMS_HEADING_TOP_CLIMB", "number", topOfClimbLlaHeading.heading);
            } else {
                SimVar.SetSimVarValue("L:AIRLINER_FMS_SHOW_TOP_CLIMB", "number", 0);
            }
            SimVar.SetSimVarValue("SIMVAR_AUTOPILOT_AIRSPEED_MIN_CALCULATED", "knots", Simplane.getStallProtectionMinSpeed());
            SimVar.SetSimVarValue("SIMVAR_AUTOPILOT_AIRSPEED_MAX_CALCULATED", "knots", Simplane.getMaxSpeed(Aircraft.A320_NEO));
            if (this.isAltitudeManaged()) {
                const prevWaypoint = this.flightPlanManager.getPreviousActiveWaypoint();
                const nextWaypoint = this.flightPlanManager.getActiveWaypoint();
                if (prevWaypoint && nextWaypoint) {
                    let targetAltitude = nextWaypoint.legAltitude1;
                    if (nextWaypoint.legAltitudeDescription === 4) {
                        targetAltitude = Math.max(nextWaypoint.legAltitude1, nextWaypoint.legAltitude2);
                    }
                    let showTopOfDescent = false;
                    let topOfDescentLat;
                    let topOfDescentLong;
                    let topOfDescentHeading;
                    if (currentAltitude > targetAltitude + 40) {
                        let vSpeed = Math.abs(Math.min(0, Simplane.getVerticalSpeed()));
                        if (vSpeed < 200) {
                            vSpeed = 2000;
                        }
                        const descentDuration = Math.abs(targetAltitude - currentAltitude) / vSpeed / 60;
                        const descentDistance = descentDuration * groundSpeed;
                        const distanceToTarget = Avionics.Utils.computeGreatCircleDistance(prevWaypoint.infos.coordinates, nextWaypoint.infos.coordinates);
                        showTopOfDescent = true;
                        const f = 1 - descentDistance / distanceToTarget;
                        topOfDescentLat = Avionics.Utils.lerpAngle(prevWaypoint.infos.lat, nextWaypoint.infos.lat, f);
                        topOfDescentLong = Avionics.Utils.lerpAngle(prevWaypoint.infos.long, nextWaypoint.infos.long, f);
                        topOfDescentHeading = nextWaypoint.bearingInFP;
                    }
                    if (showTopOfDescent) {
                        SimVar.SetSimVarValue("L:AIRLINER_FMS_SHOW_TOP_DSCNT", "number", 1);
                        SimVar.SetSimVarValue("L:AIRLINER_FMS_LAT_TOP_DSCNT", "number", topOfDescentLat);
                        SimVar.SetSimVarValue("L:AIRLINER_FMS_LONG_TOP_DSCNT", "number", topOfDescentLong);
                        SimVar.SetSimVarValue("L:AIRLINER_FMS_HEADING_TOP_DSCNT", "number", topOfDescentHeading);
                    } else {
                        SimVar.SetSimVarValue("L:AIRLINER_FMS_SHOW_TOP_DSCNT", "number", 0);
                    }
                    const activeWpIdx = this.flightPlanManager.getActiveWaypointIndex();
                    if (activeWpIdx !== this.activeWpIdx) {
                        this.activeWpIdx = activeWpIdx;
                        this.updateConstraints();
                    }
                    if (this.constraintAlt) {
                        SimVar.SetSimVarValue("L:A32NX_AP_CSTN_ALT", "feet", this.constraintAlt);
                        Coherent.call("AP_ALT_VAR_SET_ENGLISH", 2, this.constraintAlt, this._forceNextAltitudeUpdate);
                        this._forceNextAltitudeUpdate = false;
                        SimVar.SetSimVarValue("L:AP_CURRENT_TARGET_ALTITUDE_IS_CONSTRAINT", "number", 1);
                    } else {
                        const altitude = Simplane.getAutoPilotSelectedAltitudeLockValue("feet");
                        if (isFinite(altitude)) {
                            Coherent.call("AP_ALT_VAR_SET_ENGLISH", 2, altitude, this._forceNextAltitudeUpdate);
                            this._forceNextAltitudeUpdate = false;
                            SimVar.SetSimVarValue("L:AP_CURRENT_TARGET_ALTITUDE_IS_CONSTRAINT", "number", 0);
                        }
                    }
                } else {
                    const altitude = Simplane.getAutoPilotSelectedAltitudeLockValue("feet");
                    if (isFinite(altitude)) {
                        Coherent.call("AP_ALT_VAR_SET_ENGLISH", 2, altitude, this._forceNextAltitudeUpdate);
                        this._forceNextAltitudeUpdate = false;
                        SimVar.SetSimVarValue("L:AP_CURRENT_TARGET_ALTITUDE_IS_CONSTRAINT", "number", 0);
                    }
                }
            }
            if (!this.flightPlanManager.isActiveApproach()) {
                const activeWaypoint = this.flightPlanManager.getActiveWaypoint();
                const nextActiveWaypoint = this.flightPlanManager.getNextActiveWaypoint();
                if (activeWaypoint && nextActiveWaypoint) {
                    let pathAngle = nextActiveWaypoint.bearingInFP - activeWaypoint.bearingInFP;
                    while (pathAngle < 180) {
                        pathAngle += 360;
                    }
                    while (pathAngle > 180) {
                        pathAngle -= 360;
                    }
                    const absPathAngle = 180 - Math.abs(pathAngle);
                    const airspeed = Simplane.getIndicatedSpeed();
                    if (airspeed < 400) {
                        const turnRadius = airspeed * 360 / (1091 * 0.36 / airspeed) / 3600 / 2 / Math.PI;
                        const activateDistance = Math.pow(90 / absPathAngle, 1.6) * turnRadius * 1.2;
                        const distanceToActive = Avionics.Utils.computeGreatCircleDistance(planeCoordinates, activeWaypoint.infos.coordinates);
                        if (distanceToActive < activateDistance) {
                            this.flightPlanManager.setActiveWaypointIndex(this.flightPlanManager.getActiveWaypointIndex() + 1);
                        }
                    }
                }
            }
            if (this.flightPlanManager.isLoadedApproach() && !this.flightPlanManager.isActiveApproach() && (this.flightPlanManager.getActiveWaypointIndex() === -1 || (this.flightPlanManager.getActiveWaypointIndex() > this.flightPlanManager.getLastIndexBeforeApproach()))) {
                if (SimVar.GetSimVarValue("L:FMC_FLIGHT_PLAN_IS_TEMPORARY", "number") !== 1) {
                    this.flightPlanManager.tryAutoActivateApproach();
                }
            }
            if (Simplane.getAutoPilotAltitudeManaged() && SimVar.GetSimVarValue("L:A320_NEO_FCU_STATE", "number") !== 1) {
                const currentWaypointIndex = this.flightPlanManager.getActiveWaypointIndex();
                if (currentWaypointIndex !== this._lastRequestedFLCModeWaypointIndex) {
                    this._lastRequestedFLCModeWaypointIndex = currentWaypointIndex;
                    setTimeout(() => {
                        if (Simplane.getAutoPilotAltitudeManaged()) {
                            this._onModeManagedAltitude();
                        }
                    }, 1000);
                }
            }
            if (this.currentFlightPhase === FmgcFlightPhases.TAKEOFF) {
                const n1 = this.getThrustTakeOffLimit() / 100;
                SimVar.SetSimVarValue("AUTOPILOT THROTTLE MAX THRUST", "number", n1);
                if (this.isAirspeedManaged()) {
                    // getCleanTakeOffSpeed is a final fallback and not truth to reality
                    const speed = isFinite(this.v2Speed) ? this.v2Speed + 10 : this.computedVgd;
                    this.setAPManagedSpeed(speed, Aircraft.A320_NEO);
                }

            } else if (this.currentFlightPhase === FmgcFlightPhases.CLIMB) {
                let speed;
                if (SimVar.GetSimVarValue("L:A32NX_GOAROUND_PASSED", "bool") === 1) {
                    speed = this.computedVgd;
                    //delete override logic when we have valid nav data -aka goaround path- after goaround!
                    if (SimVar.GetSimVarValue("L:A32NX_GOAROUND_NAV_OVERRIDE", "bool") === 0) {
                        console.log("only once per goaround override to HDG selected");
                        SimVar.SetSimVarValue("L:A32NX_GOAROUND_NAV_OVERRIDE", "bool", 1);
                        this._onModeSelectedHeading();
                    }
                } else {
                    speed = this.getClbManagedSpeed();
                }
                if (this.isAirspeedManaged()) {
                    this.setAPManagedSpeed(speed, Aircraft.A320_NEO);
                }
            } else if (this.currentFlightPhase === FmgcFlightPhases.CRUISE) {
                if (this.isAirspeedManaged()) {
                    const speed = this.getCrzManagedSpeed();
                    this.setAPManagedSpeed(speed, Aircraft.A320_NEO);
                }
            } else if (this.currentFlightPhase === FmgcFlightPhases.DESCENT) {
                if (this.isAirspeedManaged()) {
                    const speed = this.getDesManagedSpeed();
                    this.setAPManagedSpeed(speed, Aircraft.A320_NEO);
                }
            } else if (this.currentFlightPhase === FmgcFlightPhases.APPROACH) {
                if (this.isAirspeedManaged()) {
                    const ctn = this.getSpeedConstraint(false);
                    let speed = this.getAppManagedSpeed();
                    let vls = this.getVApp();
                    if (isFinite(this.perfApprWindSpeed) && isFinite(this.perfApprWindHeading)) {
                        vls = NXSpeedsUtils.getVtargetGSMini(vls, NXSpeedsUtils.getHeadWindDiff(this._towerHeadwind));
                    }
                    if (ctn !== Infinity) {
                        vls = Math.max(vls, ctn);
                        speed = Math.max(speed, ctn);
                    }
                    SimVar.SetSimVarValue("L:A32NX_AP_APPVLS", "knots", vls);
                    this.setAPManagedSpeed(Math.max(speed, vls), Aircraft.A320_NEO);
                }

                if (Simplane.getAltitudeAboveGround() < 1.5) {
                    if (this.landingAutoBrakeTimer == null) {
                        this.landingAutoBrakeTimer = SimVar.GetSimVarValue("L:XMLVAR_Autobrakes_Level", "Enum") === 1 ? 4 : 2;
                    }
                    this.landingAutoBrakeTimer -= dt / 1000;
                    if (this.landingAutoBrakeTimer <= 0) {
                        this.landingAutoBrakeTimer = null;
                        SimVar.SetSimVarValue("L:A32NX_AUTOBRAKES_BRAKING", "Bool", 1);
                    }
                } else {
                    //Reset timer to 30 when airborne in case of go around
                    this.landingAutoBrakeTimer = SimVar.GetSimVarValue("L:XMLVAR_Autobrakes_Level", "Enum") === 1 ? 4 : 2;
                }
            }
            if (this.currentFlightPhase === FmgcFlightPhases.GOAROUND) {
                if (this.isAirspeedManaged()) {
                    if (Simplane.getAltitude() > this.accelerationAltitudeGoaround) {
                        this.setAPManagedSpeed(this.computedVgd, Aircraft.A320_NEO);
                    } else {
                        const speed = Math.min(
                            this.computedVls + (this.isAllEngineOn() ? 25 : 15),
                            Math.max(
                                SimVar.GetSimVarValue("L:A32NX_GOAROUND_INIT_SPEED", "number"),
                                SimVar.GetSimVarValue("L:A32NX_GOAROUND_INIT_APP_SPEED", "number")
                            )
                        );

                        SimVar.SetSimVarValue("L:A32NX_TOGA_SPEED", "number", speed);

                        this.setAPManagedSpeed(speed, Aircraft.A320_NEO);
                    }
                }

                if (apLogicOn) {
                    //depending if on HDR/TRK or NAV mode, select appropriate Alt Mode (WIP)
                    //this._onModeManagedAltitude();
                    this._onModeSelectedAltitude();
                }
            }
            this.updateAutopilotCooldown = this._apCooldown;
        }
        if (this.currentFlightPhase === FmgcFlightPhases.APPROACH) {
            if (Simplane.getAltitudeAboveGround() < 1.5) {
                if (this.landingAutoBrakeTimer == null) {
                    this.landingAutoBrakeTimer = SimVar.GetSimVarValue("L:XMLVAR_Autobrakes_Level", "Enum") === 1 ? 4 : 2;
                }
                this.landingAutoBrakeTimer -= dt / 1000;
                if (this.landingAutoBrakeTimer <= 0) {
                    this.landingAutoBrakeTimer = null;
                    SimVar.SetSimVarValue("L:A32NX_AUTOBRAKES_BRAKING", "Bool", 1);
                }
            } else {
                //Reset timer to 30 when airborne in case of go around
                this.landingAutoBrakeTimer = SimVar.GetSimVarValue("L:XMLVAR_Autobrakes_Level", "Enum") === 1 ? 4 : 2;
            }
        }
    }

    /**
     * Updates performance speeds such as GD, F, S, Vls and approach speeds
     */
    updatePerfSpeeds() {
        this.computedVgd = SimVar.GetSimVarValue("L:A32NX_SPEEDS_GD", "number");
        this.computedVfs = SimVar.GetSimVarValue("L:A32NX_SPEEDS_F", "number");
        this.computedVss = SimVar.GetSimVarValue("L:A32NX_SPEEDS_S", "number");
        this.computedVls = SimVar.GetSimVarValue("L:A32NX_SPEEDS_VLS", "number");

        let weight = this.tryEstimateLandingWeight();
        // Actual weight is used during approach phase (FCOM bulletin 46/2), and we also assume during go-around
        // We also fall back to current weight when landing weight is unavailable
        if (this.currentFlightPhase >= FmgcFlightPhases.APPROACH || !isFinite(weight)) {
            weight = SimVar.GetSimVarValue("TOTAL WEIGHT", "kg") / 1000;
        }
        // if pilot has set approach wind in MCDU we use it, otherwise fall back to current measured wind
        if (isFinite(this.perfApprWindSpeed) && isFinite(this.perfApprWindHeading)) {
            this.approachSpeeds = new NXSpeedsApp(weight, this.perfApprFlaps3, this._towerHeadwind);
        } else {
            this.approachSpeeds = new NXSpeedsApp(weight, this.perfApprFlaps3);
        }
        this.approachSpeeds.valid = this.currentFlightPhase >= FmgcFlightPhases.APPROACH || isFinite(weight);
    }

    updateGPSMessage() {
        if (!SimVar.GetSimVarValue("L:GPSPrimaryAcknowledged", "Bool")) {
            if (SimVar.GetSimVarValue("L:GPSPrimary", "Bool")) {
                SimVar.SetSimVarValue("L:A32NX_GPS_PRIMARY_LOST_MSG", "Bool", 0);
                if (!SimVar.GetSimVarValue("L:GPSPrimaryMessageDisplayed", "Bool")) {
                    SimVar.SetSimVarValue("L:GPSPrimaryMessageDisplayed", "Bool", 1);
                    this.tryRemoveMessage(NXSystemMessages.gpsPrimaryLost.text);
                    this.addNewMessage(NXSystemMessages.gpsPrimary, () => {
                        SimVar.SetSimVarValue("L:GPSPrimaryAcknowledged", "Bool", 1);
                    });
                }
            } else {
                SimVar.SetSimVarValue("L:GPSPrimaryMessageDisplayed", "Bool", 0);
                if (!SimVar.GetSimVarValue("L:A32NX_GPS_PRIMARY_LOST_MSG", "Bool")) {
                    SimVar.SetSimVarValue("L:A32NX_GPS_PRIMARY_LOST_MSG", "Bool", 1);
                    this.tryRemoveMessage(NXSystemMessages.gpsPrimary.text);
                    this.addNewMessage(NXSystemMessages.gpsPrimaryLost, () => {
                        SimVar.SetSimVarValue("L:A32NX_GPS_PRIMARY_LOST_MSG", "Bool", 1);
                    });
                }
            }
        }
    }

    updateDisplayedConstraints(force = false) {
        const fcuSelAlt = Simplane.getAutoPilotDisplayedAltitudeLockValue("feet");
        if (!force && fcuSelAlt === this.fcuSelAlt) {
            return;
        }
        this.fcuSelAlt = fcuSelAlt;
        this.constraintAlt = A32NX_ConstraintManager.getDisplayedConstraintAltitude(
            this.currentFlightPhase,
            this.fcuSelAlt,
            this.constraintAltCached
        );
    }

    updateConstraints() {
        this.constraintAltCached = A32NX_ConstraintManager.getConstraintAltitude(
            this.currentFlightPhase,
            this.flightPlanManager,
            this.constraintAltCached,
            this._cruiseFlightLevel * 100
        );
        this.updateDisplayedConstraints(true);
    }

    getSpeedConstraint() {
        if (this.flightPlanManager.getIsDirectTo()) {
            return Infinity;
        }
        const wpt = this.flightPlanManager.getActiveWaypoint();
        if (typeof wpt === 'undefined' || !isFinite(wpt.speedConstraint) || wpt.speedConstraint < 100) {
            return Infinity;
        }
        return wpt.speedConstraint;
    }

    getThrustTakeOffLimit() {
        if (this.perfTOTemp <= 10) {
            return 92.8;
        }
        if (this.perfTOTemp <= 40) {
            return 92.8;
        }
        if (this.perfTOTemp <= 45) {
            return 92.2;
        }
        if (this.perfTOTemp <= 50) {
            return 90.5;
        }
        if (this.perfTOTemp <= 55) {
            return 88.8;
        }
        return 88.4;
    }

    getClbManagedSpeed() {
        let maxSpeed = Infinity;
        if (isFinite(this.v2Speed)) {
            const altitude = Simplane.getAltitude();
            if (altitude < this.thrustReductionAltitude) {
                maxSpeed = this.v2Speed + 50;
            } else {
                maxSpeed = this.getSpeedConstraint();
            }
        }
        const dCI = (this.costIndex / 999) ** 2;
        let speed = 280 * (1 - dCI) + 300 * dCI;
        if (SimVar.GetSimVarValue("PLANE ALTITUDE", "feet") < 10000) {
            speed = Math.min(speed, 250);
        }
        return Math.min(maxSpeed, speed);
    }

    getCrzManagedSpeed() {
        const dCI = (this.costIndex / 999) ** 2;
        let speed = 280 * (1 - dCI) + 300 * dCI;
        if (SimVar.GetSimVarValue("PLANE ALTITUDE", "feet") < 10000) {
            speed = Math.min(speed, 250);
        }
        return speed;
    }

    getDesManagedSpeed() {
        const dCI = this.costIndex / 999;
        const flapsHandleIndex = Simplane.getFlapsHandleIndex();
        if (flapsHandleIndex !== 0) {
            return flapsHandleIndex === 1 ? this.computedVss : this.computedVfs;
        }
        let speed = 280 * (1 - dCI) + 300 * dCI;
        if (SimVar.GetSimVarValue("PLANE ALTITUDE", "feet") < 10000) {
            speed = Math.min(speed, 250);
        }
        return Math.min(speed, this.getSpeedConstraint());
    }

    getAppManagedSpeed() {
        switch (Simplane.getFlapsHandleIndex()) {
            case 0: return this.computedVgd;
            case 1: return this.computedVss;
            case 3: return this.perfApprFlaps3 ? this.getVApp() : this.computedVfs;
            case 4: return this.getVApp();
            default: return this.computedVfs;
        }
    }

    setAPSelectedSpeed(_speed, _aircraft) {
        if (isFinite(_speed)) {
            if (Simplane.getAutoPilotMachModeActive()) {
                const mach = SimVar.GetGameVarValue("FROM KIAS TO MACH", "number", _speed);
                Coherent.call("AP_MACH_VAR_SET", 1, mach);
                SimVar.SetSimVarValue("K:AP_MANAGED_SPEED_IN_MACH_ON", "number", 1);
                return;
            }
            Coherent.call("AP_SPD_VAR_SET", 1, _speed);
            SimVar.SetSimVarValue("K:AP_MANAGED_SPEED_IN_MACH_OFF", "number", 1);
        }
    }

    setAPManagedSpeed(_speed, _aircraft) {
        if (isFinite(_speed)) {
            if (Simplane.getAutoPilotMachModeActive()) {
                let mach = SimVar.GetGameVarValue("FROM KIAS TO MACH", "number", _speed);
                const cruiseMach = SimVar.GetGameVarValue("AIRCRAFT CRUISE MACH", "mach");
                mach = Math.min(mach, cruiseMach);
                Coherent.call("AP_MACH_VAR_SET", 2, mach);
                SimVar.SetSimVarValue("K:AP_MANAGED_SPEED_IN_MACH_ON", "number", 1);
                return;
            }
            Coherent.call("AP_SPD_VAR_SET", 2, _speed);
            SimVar.SetSimVarValue("K:AP_MANAGED_SPEED_IN_MACH_OFF", "number", 1);
        }
    }

    /* FMS EVENTS */

    onPowerOn() {
        super.onPowerOn();
        const gpsDriven = SimVar.GetSimVarValue("GPS DRIVES NAV1", "Bool");
        if (!gpsDriven) {
            SimVar.SetSimVarValue("K:TOGGLE_GPS_DRIVES_NAV1", "Bool", 0);
        }
        this.initRadioNav(true);

        if (Simplane.getAutoPilotAirspeedManaged()) {
            this._onModeManagedSpeed();
        } else if (Simplane.getAutoPilotAirspeedSelected()) {
            this._onModeSelectedSpeed();
        }
        this._onModeManagedHeading();
        this._onModeManagedAltitude();

        CDUPerformancePage.UpdateThrRedAccFromOrigin(this);
        CDUPerformancePage.UpdateThrRedAccFromDestination(this);

        SimVar.SetSimVarValue("K:VS_SLOT_INDEX_SET", "number", 1);

        this.taxiFuelWeight = 0.2;
        CDUInitPage.updateTowIfNeeded(this);
    }

    onEvent(_event) {
        if (_event === "MODE_SELECTED_SPEED") {
            this._onModeSelectedSpeed();
        }
        if (_event === "MODE_MANAGED_SPEED") {
            if (this.flightPlanManager.getWaypointsCount() === 0) {
                return;
            }
            this._onModeManagedSpeed();
        }
        if (_event === "MODE_SELECTED_HEADING") {
            SimVar.SetSimVarValue("L:A32NX_GOAROUND_HDG_MODE", "bool", 1);
            SimVar.SetSimVarValue("L:A32NX_GOAROUND_NAV_MODE", "bool", 0);
            if (Simplane.getAutoPilotHeadingManaged()) {
                if (SimVar.GetSimVarValue("L:A320_FCU_SHOW_SELECTED_HEADING", "number") === 0) {
                    const currentHeading = Simplane.getHeadingMagnetic();
                    Coherent.call("HEADING_BUG_SET", 1, currentHeading);
                }
            }
            this._onModeSelectedHeading();
        }
        if (_event === "MODE_MANAGED_HEADING") {
            SimVar.SetSimVarValue("L:A32NX_GOAROUND_HDG_MODE", "bool", 0);
            SimVar.SetSimVarValue("L:A32NX_GOAROUND_NAV_MODE", "bool", 1);
            if (this.flightPlanManager.getWaypointsCount() === 0) {
                return;
            }
            this._onModeManagedHeading();
        }
        if (_event === "MODE_SELECTED_ALTITUDE") {
            this.flightPhaseManager.handleFcuInput();
            this._onModeSelectedAltitude();

            if (this.currentFlightPhase === FmgcFlightPhases.CRUISE) {
                this._onStepClimbDescent(Simplane.getAutoPilotDisplayedAltitudeLockValue() / 100);
            }
        }
        if (_event === "MODE_MANAGED_ALTITUDE") {
            this.flightPhaseManager.handleFcuInput();
            this._onModeManagedAltitude();

            if (this.currentFlightPhase === FmgcFlightPhases.CRUISE) {
                this._onStepClimbDescent(Simplane.getAutoPilotDisplayedAltitudeLockValue() / 100);
            }
        }
        if (_event === "AP_DEC_ALT" || _event === "AP_INC_ALT") {
            if (this.currentFlightPhase === FmgcFlightPhases.CLIMB) {
                const fcuFl = Simplane.getAutoPilotDisplayedAltitudeLockValue() / 100;
                if (this._activeCruiseFlightLevelDefaulToFcu || fcuFl >= this._cruiseFlightLevel) {
                    this.cruiseFlightLevel = fcuFl;
                    if (this.page.Current === this.page.ProgressPage) {
                        CDUProgressPage.ShowPage(this);
                    }
                }
            }
        }
        if (_event === "AP_DEC_SPEED" || _event === "AP_INC_SPEED") {
            if (SimVar.GetSimVarValue("L:A320_FCU_SHOW_SELECTED_SPEED", "number") === 0) {
                const currentSpeed = Simplane.getIndicatedSpeed();
                this.setAPSelectedSpeed(currentSpeed, Aircraft.A320_NEO);
            }
            SimVar.SetSimVarValue("L:A320_FCU_SHOW_SELECTED_SPEED", "number", 1);
        }
        if (_event === "AP_DEC_HEADING" || _event === "AP_INC_HEADING") {
            if (SimVar.GetSimVarValue("L:A320_FCU_SHOW_SELECTED_HEADING", "number") === 0) {
                const currentHeading = Simplane.getHeadingMagnetic();
                Coherent.call("HEADING_BUG_SET", 1, currentHeading);
            }
            SimVar.SetSimVarValue("L:A320_FCU_SHOW_SELECTED_HEADING", "number", 1);
        }
    }

    _onModeSelectedSpeed() {
        if (SimVar.GetSimVarValue("L:A320_FCU_SHOW_SELECTED_SPEED", "number") === 0) {
            const currentSpeed = Simplane.getIndicatedSpeed();
            this.setAPSelectedSpeed(currentSpeed, Aircraft.A320_NEO);
        }
        SimVar.SetSimVarValue("K:SPEED_SLOT_INDEX_SET", "number", 1);
    }

    _onModeManagedSpeed() {
        SimVar.SetSimVarValue("K:SPEED_SLOT_INDEX_SET", "number", 2);
        SimVar.SetSimVarValue("L:A320_FCU_SHOW_SELECTED_SPEED", "number", 0);
    }

    _onModeSelectedHeading() {
        if (SimVar.GetSimVarValue("AUTOPILOT APPROACH HOLD", "boolean")) {
            return;
        }
        if (!SimVar.GetSimVarValue("AUTOPILOT HEADING LOCK", "Boolean")) {
            SimVar.SetSimVarValue("K:AP_PANEL_HEADING_HOLD", "Number", 1);
        }
        SimVar.SetSimVarValue("K:HEADING_SLOT_INDEX_SET", "number", 1);
        SimVar.SetSimVarValue("L:A32NX_GOAROUND_HDG_MODE", "bool", 1);
    }

    _onModeManagedHeading() {
        if (SimVar.GetSimVarValue("AUTOPILOT APPROACH HOLD", "boolean")) {
            return;
        }
        if (!SimVar.GetSimVarValue("AUTOPILOT HEADING LOCK", "Boolean")) {
            SimVar.SetSimVarValue("K:AP_PANEL_HEADING_HOLD", "Number", 1);
        }
        SimVar.SetSimVarValue("K:HEADING_SLOT_INDEX_SET", "number", 2);
        SimVar.SetSimVarValue("L:A320_FCU_SHOW_SELECTED_HEADING", "number", 0);
    }

    _onModeSelectedAltitude() {
        if (!Simplane.getAutoPilotGlideslopeHold()) {
            SimVar.SetSimVarValue("L:A320_NEO_FCU_FORCE_IDLE_VS", "Number", 1);
        }
        SimVar.SetSimVarValue("K:ALTITUDE_SLOT_INDEX_SET", "number", 1);
        Coherent.call("AP_ALT_VAR_SET_ENGLISH", 1, Simplane.getAutoPilotDisplayedAltitudeLockValue(), this._forceNextAltitudeUpdate);
    }

    _onModeManagedAltitude() {
        SimVar.SetSimVarValue("K:ALTITUDE_SLOT_INDEX_SET", "number", 2);
        Coherent.call("AP_ALT_VAR_SET_ENGLISH", 1, Simplane.getAutoPilotDisplayedAltitudeLockValue(), this._forceNextAltitudeUpdate);
        Coherent.call("AP_ALT_VAR_SET_ENGLISH", 2, Simplane.getAutoPilotDisplayedAltitudeLockValue(), this._forceNextAltitudeUpdate);
        if (!Simplane.getAutoPilotGlideslopeHold()) {
            this.requestCall(() => {
                SimVar.SetSimVarValue("L:A320_NEO_FCU_FORCE_IDLE_VS", "Number", 1);
            });
        }
    }

    _onStepClimbDescent(_targetFl) {
        // Only show the message on step climbs
        if (_targetFl > this.cruiseFlightLevel) {
            this.addNewMessage(NXSystemMessages.newCrzAlt.getSetMessage(_targetFl * 100));
        }
        this.cruiseFlightLevel = _targetFl;
        this._cruiseFlightLevel = _targetFl;
    }

    /* END OF FMS EVENTS */
    /* FMS CHECK ROUTINE */

    checkDestData() {
        if (!isFinite(this.perfApprQNH) || !isFinite(this.perfApprTemp) || !isFinite(this.perfApprWindHeading) || !isFinite(this.perfApprWindSpeed)) {
            this.addNewMessage(NXSystemMessages.enterDestData, () => {
                return isFinite(this.perfApprQNH) && isFinite(this.perfApprTemp) && isFinite(this.perfApprWindHeading) && isFinite(this.perfApprWindSpeed);
            });
        }
    }

    /* END OF FMS CHECK ROUTINE */
    /* MCDU GET/SET METHODS */

    get cruiseFlightLevel() {
        return this._activeCruiseFlightLevel;
    }

    set cruiseFlightLevel(fl) {
        this._activeCruiseFlightLevel = Math.round(fl);
        SimVar.SetSimVarValue("L:AIRLINER_CRUISE_ALTITUDE", "number", this._activeCruiseFlightLevel * 100);
    }

    setCruiseFlightLevelAndTemperature(input) {
        if (input === FMCMainDisplay.clrValue) {
            this.cruiseFlightLevel = undefined;
            this._cruiseFlightLevel = undefined;
            this.cruiseTemperature = undefined;
            return true;
        }
        const flString = input.split("/")[0].replace("FL", "");
        const tempString = input.split("/")[1];
        const onlyTemp = flString.length === 0;

        if (!!flString && !onlyTemp && this.trySetCruiseFl(parseFloat(flString))) {
            if (SimVar.GetSimVarValue("L:A32NX_CRZ_ALT_SET_INITIAL", "bool") === 1 && SimVar.GetSimVarValue("L:A32NX_GOAROUND_PASSED", "bool") === 1) {
                SimVar.SetSimVarValue("L:A32NX_NEW_CRZ_ALT", "number", this.cruiseFlightLevel);
            } else {
                SimVar.SetSimVarValue("L:A32NX_CRZ_ALT_SET_INITIAL", "bool", 1);
            }
            if (!tempString) {
                return true;
            }
        }
        if (!!tempString) {
            const temp = parseInt(tempString.replace("M", "-"));
            console.log("tS: " + tempString);
            console.log("ti: " + temp);
            if (isFinite(temp) && this._cruiseEntered) {
                if (temp > -270 && temp < 100) {
                    this.cruiseTemperature = temp;
                    return true;
                } else {
                    this.addNewMessage(NXSystemMessages.entryOutOfRange);
                    return false;
                }
            } else {
                this.addNewMessage(NXSystemMessages.notAllowed);
                return false;
            }
        }
        this.addNewMessage(NXSystemMessages.formatError);
        return false;
    }

    tryUpdateCostIndex(costIndex) {
        const value = parseInt(costIndex);
        if (isFinite(value)) {
            if (value >= 0) {
                if (value < 1000) {
                    this.costIndexSet = true;
                    this.costIndex = value;
                    return true;
                } else {
                    this.addNewMessage(NXSystemMessages.entryOutOfRange);
                    return false;
                }
            }
        }
        this.addNewMessage(NXSystemMessages.notAllowed);
        return false;
    }

    /**
     * Any tropopause altitude up to 60,000 ft is able to be entered
     * @param {string | number} tropo Format: NNNN or NNNNN Leading 0’s must be included. Entry is rounded to the nearest 10 ft
     * @return {boolean} Whether tropopause could be set or not
     */
    tryUpdateTropo(tropo) {
        const _tropo = typeof tropo === 'number' ? tropo.toString() : tropo;
        if (_tropo.match(/^(?=(\D*\d){4,5}\D*$)/g)) {
            const value = parseInt(_tropo.padEnd(5, '0'));
            if (isFinite(value)) {
                if (value >= 0 && value <= 60000) {
                    const valueRounded = Math.round(value / 10) * 10;
                    this.tropo = valueRounded.toString();
                    return true;
                }
            }
        }
        this.addNewMessage(NXSystemMessages.notAllowed);
        return false;
    }

    ensureCurrentFlightPlanIsTemporary(callback = EmptyCallback.Boolean) {
        if (this.flightPlanManager.getCurrentFlightPlanIndex() === 0) {
            this.flightPlanManager.copyCurrentFlightPlanInto(1, () => {
                this.flightPlanManager.setCurrentFlightPlanIndex(1, (result) => {
                    SimVar.SetSimVarValue("L:FMC_FLIGHT_PLAN_IS_TEMPORARY", "number", 1);
                    SimVar.SetSimVarValue("L:MAP_SHOW_TEMPORARY_FLIGHT_PLAN", "number", 1);
                    callback(result);
                });
            });
        } else {
            callback(true);
        }
    }

    tryUpdateFromTo(fromTo, callback = EmptyCallback.Boolean) {
        if (fromTo === FMCMainDisplay.clrValue) {
            this.addNewMessage(NXSystemMessages.notAllowed);
            return callback(false);
        }
        const from = fromTo.split("/")[0];
        const to = fromTo.split("/")[1];
        this.dataManager.GetAirportByIdent(from).then((airportFrom) => {
            if (airportFrom) {
                this.dataManager.GetAirportByIdent(to).then((airportTo) => {
                    if (airportTo) {
                        this.eraseTemporaryFlightPlan(() => {
                            this.flightPlanManager.clearFlightPlan(() => {
                                this.flightPlanManager.setOrigin(airportFrom.icao, () => {
                                    this.tmpOrigin = airportFrom.ident;
                                    this.flightPlanManager.setDestination(airportTo.icao, () => {
                                        this.tmpOrigin = airportTo.ident;
                                        callback(true);
                                    });
                                });
                            });
                        });
                    } else {
                        this.addNewMessage(NXSystemMessages.notInDatabase);
                        callback(false);
                    }
                });
            } else {
                this.addNewMessage(NXSystemMessages.notInDatabase);
                callback(false);
            }
        });
    }

    /**
     * Computes distance between destination and alternate destination
     */
    tryUpdateDistanceToAlt() {
        this._DistanceToAlt = Avionics.Utils.computeGreatCircleDistance(
            this.flightPlanManager.getDestination().infos.coordinates,
            this.altDestination.infos.coordinates);
    }

    // only used by trySetRouteAlternateFuel
    isAltFuelInRange(fuel) {
        return 0 < fuel && fuel < (this.blockFuel - this._routeTripFuelWeight);
    }

    async trySetRouteAlternateFuel(altFuel) {
        if (altFuel === FMCMainDisplay.clrValue) {
            this._routeAltFuelEntered = false;
            return true;
        }
        const value = parseFloat(altFuel) * this._conversionWeight;
        if (isFinite(value)) {
            if (this.isAltFuelInRange(value)) {
                this._routeAltFuelEntered = true;
                this._routeAltFuelWeight = value;
                this._routeAltFuelTime = FMCMainDisplay.minutesTohhmm(A32NX_FuelPred.computeUserAltTime(this._routeAltFuelWeight * 1000, 290));
                return true;
            } else {
                this.addNewMessage(NXSystemMessages.entryOutOfRange);
                return false;
            }
        }
        this.addNewMessage(NXSystemMessages.formatError);
        return false;
    }

    async trySetMinDestFob(fuel) {
        if (fuel === FMCMainDisplay.clrValue) {
            this._minDestFobEntered = false;
            return true;
        }
        const value = parseFloat(fuel) * this._conversionWeight;
        if (isFinite(value)) {
            if (this.isMinDestFobInRange(value)) {
                this._minDestFobEntered = true;
                if (value < this._minDestFob) {
                    this.addNewMessage(NXSystemMessages.checkMinDestFob);
                }
                this._minDestFob = value;
                return true;
            } else {
                this.addNewMessage(NXSystemMessages.entryOutOfRange);
            }
        }
        this.addNewMessage(NXSystemMessages.formatError);
        return false;
    }

    async tryUpdateAltDestination(altDestIdent) {
        if (altDestIdent === "NONE" || altDestIdent === FMCMainDisplay.clrValue) {
            this.altDestination = undefined;
            this._DistanceToAlt = 0;
            return true;
        }
        const airportAltDest = await this.dataManager.GetAirportByIdent(altDestIdent);
        if (airportAltDest) {
            this.altDestination = airportAltDest;
            this.tryUpdateDistanceToAlt();
            return true;
        }
        this.addNewMessage(NXSystemMessages.notInDatabase);
        return false;
    }

    /**
     * Updates the Fuel weight cell to tons. Uses a place holder FL120 for 30 min
     */
    tryUpdateRouteFinalFuel() {
        if (this._routeFinalFuelTime <= 0) {
            this._routeFinalFuelTime = this._defaultRouteFinalTime;
        }
        this._routeFinalFuelWeight = A32NX_FuelPred.computeHoldingTrackFF(this.zeroFuelWeight, 120) / 1000;
        this._rteFinalCoeffecient = A32NX_FuelPred.computeHoldingTrackFF(this.zeroFuelWeight, 120) / 30;
    }

    /**
     * Updates the alternate fuel and time values using a place holder FL of 330 until that can be set
     */
    tryUpdateRouteAlternate() {
        if (this._DistanceToAlt < 20) {
            this._routeAltFuelWeight = 0;
            this._routeAltFuelTime = 0;
        } else {
            const placeholderFl = 120;
            let airDistance = 0;
            if (this._windDir === this._windDirections.TAILWIND) {
                airDistance = A32NX_FuelPred.computeAirDistance(Math.round(this._DistanceToAlt), this.averageWind);
            } else if (this._windDir === this._windDirections.HEADWIND) {
                airDistance = A32NX_FuelPred.computeAirDistance(Math.round(this._DistanceToAlt), -this.averageWind);
            }

            const deviation = (this.zeroFuelWeight + this._routeFinalFuelWeight - A32NX_FuelPred.refWeight) * A32NX_FuelPred.computeNumbers(airDistance, placeholderFl, A32NX_FuelPred.computations.CORRECTIONS, true);
            if ((20 < airDistance && airDistance < 200) && (100 < placeholderFl && placeholderFl < 290)) { //This will always be true until we can setup alternate routes
                this._routeAltFuelWeight = (A32NX_FuelPred.computeNumbers(airDistance, placeholderFl, A32NX_FuelPred.computations.FUEL, true) + deviation) / 1000;
                this._routeAltFuelTime = A32NX_FuelPred.computeNumbers(airDistance, placeholderFl, A32NX_FuelPred.computations.TIME, true);
            }
        }
    }

    /**
     * Attempts to calculate trip information. Is dynamic in that it will use liveDistanceTo the destination rather than a
     * static distance. Works down to 20NM airDistance and FL100 Up to 3100NM airDistance and FL400, anything out of those ranges and values
     * won't be updated.
     */
    tryUpdateRouteTrip(dynamic = false) {
        let airDistance = 0;
        const groundDistance = dynamic ? this.flightPlanManager.getDestination().liveDistanceTo : this.flightPlanManager.getDestination().cumulativeDistanceInFP;
        if (this._windDir === this._windDirections.TAILWIND) {
            airDistance = A32NX_FuelPred.computeAirDistance(groundDistance, this.averageWind);
        } else if (this._windDir === this._windDirections.HEADWIND) {
            airDistance = A32NX_FuelPred.computeAirDistance(groundDistance, -this.averageWind);
        }

        let altToUse = this.cruiseFlightLevel;
        // Use the cruise level for calculations otherwise after cruise use descent altitude down to 10,000 feet.
        if (this.currentFlightPhase >= FmgcFlightPhases.DESCENT) {
            altToUse = SimVar.GetSimVarValue("PLANE ALTITUDE", 'Feet') / 100;
        }

        if ((20 <= airDistance && airDistance <= 3100) && (100 <= altToUse && altToUse <= 400)) {
            const deviation = (this.zeroFuelWeight + this._routeFinalFuelWeight + this._routeAltFuelWeight - A32NX_FuelPred.refWeight) * A32NX_FuelPred.computeNumbers(airDistance, altToUse, A32NX_FuelPred.computations.CORRECTIONS, false);

            this._routeTripFuelWeight = (A32NX_FuelPred.computeNumbers(airDistance, altToUse, A32NX_FuelPred.computations.FUEL, false) + deviation) / 1000;
            this._routeTripTime = A32NX_FuelPred.computeNumbers(airDistance, altToUse, A32NX_FuelPred.computations.TIME, false);
        }
    }

    tryUpdateMinDestFob() {
        this._minDestFob = this._routeAltFuelWeight + this.getRouteFinalFuelWeight();
    }

    tryUpdateTOW() {
        this.takeOffWeight = this.getGW() - this.taxiFuelWeight;
    }

    tryUpdateLW() {
        this.landingWeight = this.takeOffWeight - this._routeTripFuelWeight;
    }

    /**
     * Computes extra fuel
     * @param {boolean}useFOB - States whether to use the FOB rather than block fuel when computing extra fuel
     * @returns {number}
     */
    tryGetExtraFuel(useFOB = false) {
        const isFlying = parseInt(SimVar.GetSimVarValue("GROUND VELOCITY", "knots")) > 30;

        if (useFOB) {
            return this.getFOB() - this.getTotalTripFuelCons() - this._minDestFob - this.taxiFuelWeight - (isFlying ? 0 : this.getRouteReservedWeight());
        } else {
            return this.blockFuel - this.getTotalTripFuelCons() - this._minDestFob - this.taxiFuelWeight - (isFlying ? 0 : this.getRouteReservedWeight());
        }
    }

    /**
     * EXPERIMENTAL
     * Attempts to calculate the extra time
     */
    tryGetExtraTime(useFOB = false) {
        if (this.tryGetExtraFuel(useFOB) <= 0) {
            return 0;
        }
        const tempWeight = this.getGW() - this._minDestFob;
        const tempFFCoefficient = A32NX_FuelPred.computeHoldingTrackFF(tempWeight, 180) / 30;
        return (this.tryGetExtraFuel(useFOB) * 1000) / tempFFCoefficient;
    }

    getRouteAltFuelWeight() {
        return this._routeAltFuelWeight;
    }

    getRouteAltFuelTime() {
        return this._routeAltFuelTime;
    }

    setOriginRunwayIndex(runwayIndex, callback = EmptyCallback.Boolean) {
        this.ensureCurrentFlightPlanIsTemporary(() => {
            this.flightPlanManager.setDepartureProcIndex(-1, () => {
                this.flightPlanManager.setOriginRunwayIndex(runwayIndex, () => {
                    return callback(true);
                });
            });
        });
    }

    setRunwayIndex(runwayIndex, callback = EmptyCallback.Boolean) {
        this.ensureCurrentFlightPlanIsTemporary(() => {
            const routeOriginInfo = this.flightPlanManager.getOrigin().infos;
            if (!this.flightPlanManager.getOrigin()) {
                this.addNewMessage(NXFictionalMessages.noOriginSet);
                return callback(false);
            } else if (runwayIndex === -1) {
                this.flightPlanManager.setDepartureRunwayIndex(-1, () => {
                    this.flightPlanManager.setOriginRunwayIndex(-1, () => {
                        return callback(true);
                    });
                });
            } else if (routeOriginInfo instanceof AirportInfo) {
                if (routeOriginInfo.oneWayRunways[runwayIndex]) {
                    this.flightPlanManager.setDepartureRunwayIndex(runwayIndex, () => {
                        return callback(true);
                    });
                }
            } else {
                this.addNewMessage(NXSystemMessages.notInDatabase);
                callback(false);
            }
        });
    }

    setDepartureIndex(departureIndex, callback = EmptyCallback.Boolean) {
        this.ensureCurrentFlightPlanIsTemporary(() => {
            const currentRunway = this.flightPlanManager.getDepartureRunway();
            this.flightPlanManager.setDepartureProcIndex(departureIndex, () => {
                if (currentRunway) {
                    const departure = this.flightPlanManager.getDeparture();
                    const departureRunwayIndex = departure.runwayTransitions.findIndex(t => {
                        return t.name.indexOf(currentRunway.designation) !== -1;
                    });
                    if (departureRunwayIndex >= -1) {
                        return this.flightPlanManager.setDepartureRunwayIndex(departureRunwayIndex, () => {
                            return callback(true);
                        });
                    }
                }
                return callback(true);
            });
        });
    }

    setApproachTransitionIndex(transitionIndex, callback = EmptyCallback.Boolean) {
        const arrivalIndex = this.flightPlanManager.getArrivalProcIndex();
        this.ensureCurrentFlightPlanIsTemporary(() => {
            this.flightPlanManager.setApproachTransitionIndex(transitionIndex, () => {
                this.flightPlanManager.setArrivalProcIndex(arrivalIndex, () => {
                    callback(true);
                });
            });
        });
    }

    setArrivalProcIndex(arrivalIndex, callback = EmptyCallback.Boolean) {
        this.ensureCurrentFlightPlanIsTemporary(() => {
            this.flightPlanManager.setArrivalProcIndex(arrivalIndex, () => {
                callback(true);
            });
        });
    }

    setArrivalIndex(arrivalIndex, transitionIndex, callback = EmptyCallback.Boolean) {
        this.ensureCurrentFlightPlanIsTemporary(() => {
            this.flightPlanManager.setArrivalEnRouteTransitionIndex(transitionIndex, () => {
                this.flightPlanManager.setArrivalProcIndex(arrivalIndex, () => {
                    callback(true);
                });
            });
        });
    }

    setApproachIndex(approachIndex, callback = EmptyCallback.Boolean) {
        this.ensureCurrentFlightPlanIsTemporary(() => {
            this.flightPlanManager.setApproachIndex(approachIndex, () => {
                const frequency = this.flightPlanManager.getApproachNavFrequency();
                if (isFinite(frequency)) {
                    const freq = Math.round(frequency * 100) / 100;
                    if (this.connectIlsFrequency(freq)) {
                        this._ilsFrequencyPilotEntered = false;
                        SimVar.SetSimVarValue("L:FLIGHTPLAN_APPROACH_ILS", "number", freq);
                        const approach = this.flightPlanManager.getApproach();
                        if (approach && approach.name && approach.name.indexOf("ILS") !== -1) {
                            const runway = this.flightPlanManager.getApproachRunway();
                            if (runway) {
                                SimVar.SetSimVarValue("L:FLIGHTPLAN_APPROACH_COURSE", "number", runway.direction);
                            }
                        }
                    }
                }
                callback(true);
            });
        });
    }

    updateFlightNo(flightNo, callback = EmptyCallback.Boolean) {
        if (flightNo.length > 7) {
            this.addNewMessage(NXSystemMessages.notAllowed);
            return callback(false);
        }

        SimVar.SetSimVarValue("ATC FLIGHT NUMBER", "string", flightNo, "FMC").then(() => {
            NXApi.connectTelex(flightNo)
                .then(() => {
                    callback(true);
                })
                .catch((err) => {
                    if (err !== NXApi.disabledError) {
                        this.addNewMessage(NXFictionalMessages.fltNbrInUse);
                        return callback(false);
                    }

                    return callback(true);
                });
        });
    }

    updateCoRoute(coRoute, callback = EmptyCallback.Boolean) {
        if (coRoute.length > 2) {
            if (coRoute.length < 10) {
                if (coRoute === "NONE") {
                    this.coRoute = undefined;
                } else {
                    this.coRoute = coRoute;
                }
                return callback(true);
            }
        }
        this.addNewMessage(NXSystemMessages.notAllowed);
        return callback(false);
    }

    getTotalTripTime() {
        return this._routeTripTime;
    }

    getTotalTripFuelCons() {
        return this._routeTripFuelWeight;
    }

    getOrSelectVORsByIdent(ident, callback) {
        this.dataManager.GetVORsByIdent(ident).then((navaids) => {
            if (!navaids || navaids.length === 0) {
                this.addNewMessage(NXSystemMessages.notInDatabase);
                return callback(undefined);
            }
            if (navaids.length === 1) {
                return callback(navaids[0]);
            }
            A320_Neo_CDU_SelectWptPage.ShowPage(this, navaids, callback);
        });
    }
    getOrSelectNDBsByIdent(ident, callback) {
        this.dataManager.GetNDBsByIdent(ident).then((navaids) => {
            if (!navaids || navaids.length === 0) {
                this.addNewMessage(NXSystemMessages.notInDatabase);
                return callback(undefined);
            }
            if (navaids.length === 1) {
                return callback(navaids[0]);
            }
            A320_Neo_CDU_SelectWptPage.ShowPage(this, navaids, callback);
        });
    }

    getOrSelectWaypointByIdent(ident, callback) {
        this.dataManager.GetWaypointsByIdent(ident).then((waypoints) => {
            if (!waypoints || waypoints.length === 0) {
                return callback(undefined);
            }
            if (waypoints.length === 1) {
                return callback(waypoints[0]);
            }
            A320_Neo_CDU_SelectWptPage.ShowPage(this, waypoints, callback);
        });
    }

    insertWaypoint(newWaypointTo, index, callback = EmptyCallback.Boolean) {
        this.ensureCurrentFlightPlanIsTemporary(async () => {
            this.getOrSelectWaypointByIdent(newWaypointTo, (waypoint) => {
                if (!waypoint) {
                    this.addNewMessage(NXSystemMessages.notInDatabase);
                    return callback(false);
                }
                this.flightPlanManager.addWaypoint(waypoint.icao, index, () => {
                    return callback(true);
                });
            });
        });
    }

    activateDirectToWaypoint(waypoint, callback = EmptyCallback.Void) {
        const waypoints = this.flightPlanManager.getWaypoints();
        const indexInFlightPlan = waypoints.findIndex(w => {
            return w.icao === waypoint.icao;
        });
        let i = 1;
        const removeWaypointMethod = (callback = EmptyCallback.Void) => {
            if (i < indexInFlightPlan) {
                this.flightPlanManager.removeWaypoint(1, i === indexInFlightPlan - 1, () => {
                    i++;
                    removeWaypointMethod(callback);
                });
            } else {
                callback();
            }
        };
        removeWaypointMethod(() => {
            this.flightPlanManager.activateDirectTo(waypoint.infos.icao, callback);
        });
    }

    async insertWaypointsAlongAirway(lastWaypointIdent, index, airwayName, callback = EmptyCallback.Boolean) {
        const referenceWaypoint = this.flightPlanManager.getWaypoint(index - 1);
        const lastWaypointIdentPadEnd = lastWaypointIdent.padEnd(5, " ");
        if (referenceWaypoint) {
            const infos = referenceWaypoint.infos;
            if (infos instanceof WayPointInfo) {
                await referenceWaypoint.infos.UpdateAirway(airwayName); // Sometimes the waypoint is initialized without waiting to the airways array to be filled
                const airway = infos.airways.find(a => {
                    return a.name === airwayName;
                });
                if (airway) {
                    const firstIndex = airway.icaos.indexOf(referenceWaypoint.icao);
                    const lastWaypointIcao = airway.icaos.find(icao => icao.substring(7, 12) === lastWaypointIdentPadEnd);
                    const lastIndex = airway.icaos.indexOf(lastWaypointIcao);
                    if (firstIndex >= 0) {
                        if (lastIndex >= 0) {
                            let inc = 1;
                            if (lastIndex < firstIndex) {
                                inc = -1;
                            }
                            index -= 1;
                            const count = Math.abs(lastIndex - firstIndex);
                            for (let i = 1; i < count + 1; i++) { // 9 -> 6
                                const syncInsertWaypointByIcao = async (icao, idx) => {
                                    return new Promise(resolve => {
                                        console.log("add icao:" + icao + " @ " + idx);
                                        this.flightPlanManager.addWaypoint(icao, idx, () => {
                                            const waypoint = this.flightPlanManager.getWaypoint(idx);
                                            waypoint.infos.airwayIn = airwayName;
                                            if (i < count) {
                                                waypoint.infos.airwayOut = airwayName;
                                            }
                                            console.log("icao:" + icao + " added");
                                            resolve();
                                        });
                                    });
                                };

                                await syncInsertWaypointByIcao(airway.icaos[firstIndex + i * inc], index + i);
                            }
                            callback(true);
                            return;
                        }
                        this.addNewMessage(NXFictionalMessages.secondIndexNotFound);
                        return callback(false);
                    }
                    this.addNewMessage(NXFictionalMessages.firstIndexNotFound);
                    return callback(false);
                }
                this.addNewMessage(NXFictionalMessages.noRefWpt);
                return callback(false);
            }
            this.addNewMessage(NXFictionalMessages.noWptInfos);
            return callback(false);
        }
        this.addNewMessage(NXFictionalMessages.noRefWpt);
        return callback(false);
    }

    // Copy airway selections from temporary to active flightplan
    async copyAirwaySelections() {
        const temporaryFPWaypoints = this.flightPlanManager.getWaypoints(1);
        const activeFPWaypoints = this.flightPlanManager.getWaypoints(0);
        for (let i = 0; i < activeFPWaypoints.length; i++) {
            if (activeFPWaypoints[i].infos && temporaryFPWaypoints[i] && activeFPWaypoints[i].icao === temporaryFPWaypoints[i].icao && temporaryFPWaypoints[i].infos) {
                activeFPWaypoints[i].infos.airwayIn = temporaryFPWaypoints[i].infos.airwayIn;
                activeFPWaypoints[i].infos.airwayOut = temporaryFPWaypoints[i].infos.airwayOut;
            }
        }
    }

    removeWaypoint(index, callback = EmptyCallback.Void) {
        this.ensureCurrentFlightPlanIsTemporary(() => {
            this.flightPlanManager.removeWaypoint(index, true, callback);
        });
    }

    eraseTemporaryFlightPlan(callback = EmptyCallback.Void) {
        this.flightPlanManager.setCurrentFlightPlanIndex(0, () => {
            SimVar.SetSimVarValue("L:FMC_FLIGHT_PLAN_IS_TEMPORARY", "number", 0);
            SimVar.SetSimVarValue("L:MAP_SHOW_TEMPORARY_FLIGHT_PLAN", "number", 0);
            callback();
        });
    }

    insertTemporaryFlightPlan(callback = EmptyCallback.Void) {
        if (this.flightPlanManager.getCurrentFlightPlanIndex() === 1) {
            this.flightPlanManager.copyCurrentFlightPlanInto(0, () => {
                this.flightPlanManager.setCurrentFlightPlanIndex(0, () => {
                    SimVar.SetSimVarValue("L:FMC_FLIGHT_PLAN_IS_TEMPORARY", "number", 0);
                    SimVar.SetSimVarValue("L:MAP_SHOW_TEMPORARY_FLIGHT_PLAN", "number", 0);
                    callback();
                });
            });
        }
    }

    vSpeedsValid() {
        return this._v1Checked && this._vRChecked && this._v2Checked ? (
            (!!this.v1Speed && !!this.vRSpeed ? this.v1Speed <= this.vRSpeed : true)
            && (!!this.vRSpeed && !!this.v2Speed ? this.vRSpeed <= this.v2Speed : true)
            && (!!this.v1Speed && !!this.v2Speed ? this.v1Speed <= this.v2Speed : true)
        ) : true;
    }

    vSpeedDisagreeCheck() {
        if (!this.vSpeedsValid()) {
            this.addNewMessage(NXSystemMessages.vToDisagree, this.vSpeedsValid.bind(this));
        }
    }

    //Needs PR Merge #3082
    trySetV1Speed(s) {
        if (s === FMCMainDisplay.clrValue) {
            this.addNewMessage(NXSystemMessages.notAllowed);
            return false;
        }
        const v = parseInt(s);
        if (!isFinite(v) || !/^\d{2,3}$/.test(s)) {
            this.addNewMessage(NXSystemMessages.formatError);
            return false;
        }
        if (v < 90 || v > 350) {
            this.addNewMessage(NXSystemMessages.entryOutOfRange);
            return false;
        }
        this.tryRemoveMessage(NXSystemMessages.checkToData.text);
        this._v1Checked = true;
        this.v1Speed = v;
        SimVar.SetSimVarValue("L:AIRLINER_V1_SPEED", "Knots", this.v1Speed).then(() => {
            this.vSpeedDisagreeCheck();
        });
        return true;
    }

    //Needs PR Merge #3082
    trySetVRSpeed(s) {
        if (s === FMCMainDisplay.clrValue) {
            this.addNewMessage(NXSystemMessages.notAllowed);
            return false;
        }
        const v = parseInt(s);
        if (!isFinite(v) || !/^\d{2,3}$/.test(s)) {
            this.addNewMessage(NXSystemMessages.formatError);
            return false;
        }
        if (v < 90 || v > 350) {
            this.addNewMessage(NXSystemMessages.entryOutOfRange);
            return false;
        }
        this.tryRemoveMessage(NXSystemMessages.checkToData.text);
        this._vRChecked = true;
        this.vRSpeed = v;
        SimVar.SetSimVarValue("L:AIRLINER_VR_SPEED", "Knots", this.vRSpeed).then(() => {
            this.vSpeedDisagreeCheck();
        });
        return true;
    }

    //Needs PR Merge #3082
    trySetV2Speed(s) {
        if (s === FMCMainDisplay.clrValue) {
            this.addNewMessage(NXSystemMessages.notAllowed);
            return false;
        }
        const v = parseInt(s);
        if (!isFinite(v) || !/^\d{2,3}$/.test(s)) {
            this.addNewMessage(NXSystemMessages.formatError);
            return false;
        }
        if (v < 90 || v > 350) {
            this.addNewMessage(NXSystemMessages.entryOutOfRange);
            return false;
        }
        this.tryRemoveMessage(NXSystemMessages.checkToData.text);
        this._v2Checked = true;
        this.v2Speed = v;
        SimVar.SetSimVarValue("L:AIRLINER_V2_SPEED", "Knots", this.v2Speed).then(() => {
            this.vSpeedDisagreeCheck();
        });
        return true;
    }

    trySetTakeOffTransAltitude(s) {
        if (s === FMCMainDisplay.clrValue) {
            this.transitionAltitude = NaN;
            this.transitionAltitudeIsPilotEntered = false;
            SimVar.SetSimVarValue("L:AIRLINER_TRANS_ALT", "Number", 0);
            return true;
        }

        let value = parseInt(s);
        if (!isFinite(value) || !/^\d{4,5}$/.test(s)) {
            this.addNewMessage(NXSystemMessages.formatError);
            return false;
        }

        value = Math.round(value / 10) * 10;
        if (value < 1000 || value > 45000) {
            this.addNewMessage(NXSystemMessages.entryOutOfRange);
            return false;
        }

        this.transitionAltitude = value;
        this.transitionAltitudeIsPilotEntered = true;
        SimVar.SetSimVarValue("L:AIRLINER_TRANS_ALT", "Number", value);
        return true;
    }

    getTransitionAltitude() {
        if (isFinite(this.transitionAltitude)) {
            return this.transitionAltitude;
        }

        // TODO fetch this from the nav database once we have it in future
        return 10000;
    }

    //Needs PR Merge #3082
    trySetThrustReductionAccelerationAltitude(s) {
        if (s === FMCMainDisplay.clrValue) {
            this.thrustReductionAltitudeIsPilotEntered = false;
            this.accelerationAltitudeIsPilotEntered = false;
            CDUPerformancePage.UpdateThrRedAccFromOrigin(this, true, true);
            return true;
        }

        const origin = this.flightPlanManager.getOrigin();
        const elevation = origin ? origin.altitudeinFP : 0;
        const minimumAltitude = elevation + 400;

        let newThrRedAlt = null;
        let newAccAlt = null;

        let [thrRedAlt, accAlt] = s.split("/");

        if (thrRedAlt && thrRedAlt.length > 0) {
            if (!/^\d{4,5}$/.test(thrRedAlt)) {
                this.addNewMessage(NXSystemMessages.formatError);
                return false;
            }

            thrRedAlt = parseInt(thrRedAlt);
            thrRedAlt = Math.round(thrRedAlt / 10) * 10;
            if (thrRedAlt < minimumAltitude || thrRedAlt > 45000) {
                this.addNewMessage(NXSystemMessages.entryOutOfRange);
                return false;
            }

            newThrRedAlt = thrRedAlt;
        }

        if (accAlt && accAlt.length > 0) {
            if (!/^\d{4,5}$/.test(accAlt)) {
                this.addNewMessage(NXSystemMessages.formatError);
                return false;
            }

            accAlt = parseInt(accAlt);
            accAlt = Math.round(accAlt / 10) * 10;
            if (accAlt < minimumAltitude || accAlt > 45000) {
                this.addNewMessage(NXSystemMessages.entryOutOfRange);
                return false;
            }

            newAccAlt = accAlt;
        }

        if (newThrRedAlt !== null) {
            this.thrustReductionAltitude = newThrRedAlt;
            this.thrustReductionAltitudeIsPilotEntered = true;
            SimVar.SetSimVarValue("L:AIRLINER_THR_RED_ALT", "Number", newThrRedAlt);
        }
        if (newAccAlt !== null) {
            this.accelerationAltitude = newAccAlt;
            this.accelerationAltitudeIsPilotEntered = true;
            SimVar.SetSimVarValue("L:AIRLINER_ACC_ALT", "Number", newAccAlt);
        }
        return true;
    }

    trySetEngineOutAcceleration(s) {
        if (s === FMCMainDisplay.clrValue) {
            this.engineOutAccelerationAltitudeIsPilotEntered = false;
            CDUPerformancePage.UpdateEngOutAccFromOrigin(this);
            return true;
        }

        if (!/^\d{4,5}$/.test(s)) {
            this.addNewMessage(NXSystemMessages.formatError);
            return false;
        }

        const origin = this.flightPlanManager.getOrigin();
        const elevation = origin ? origin.altitudeinFP : 0;
        const minimumAltitude = elevation + 400;

        let engineOutAccAlt = parseInt(s);
        engineOutAccAlt = Math.round(engineOutAccAlt / 10) * 10;
        if (engineOutAccAlt < minimumAltitude || engineOutAccAlt > 45000) {
            this.addNewMessage(NXSystemMessages.entryOutOfRange);
            return false;
        }

        this.engineOutAccelerationAltitude = engineOutAccAlt;
        this.engineOutAccelerationAltitudeIsPilotEntered = true;
        SimVar.SetSimVarValue("L:A32NX_ENG_OUT_ACC_ALT", "feet", engineOutAccAlt);
        return true;
    }

    //Needs PR Merge #3082
    trySetThrustReductionAccelerationAltitudeGoaround(s) {
        let thrRed = NaN;
        let accAlt = NaN;
        if (s) {
            const sSplit = s.split("/");
            thrRed = parseInt(sSplit[0]);
            accAlt = parseInt(sSplit[1]);
        }
        if ((isFinite(thrRed) || isFinite(accAlt)) && thrRed <= accAlt) {
            if (isFinite(thrRed)) {
                this.thrustReductionAltitudeGoaround = thrRed;
                SimVar.SetSimVarValue("L:AIRLINER_THR_RED_ALT_GOAROUND", "Number", this.thrustReductionAltitudeGoaround);
            }
            if (isFinite(accAlt)) {
                this.accelerationAltitudeGoaround = accAlt;
                SimVar.SetSimVarValue("L:AIRLINER_ACC_ALT_GOAROUND", "Number", this.accelerationAltitudeGoaround);
            }
            return true;
        }
        this.addNewMessage(NXSystemMessages.notAllowed);
        return false;
    }

    trySetengineOutAccelerationAltitudeGoaround(s) {
        const engOutAcc = parseInt(s);
        if (isFinite(engOutAcc)) {
            this.engineOutAccelerationAltitudeGoaround = engOutAcc;
            SimVar.SetSimVarValue("L:AIRLINER_ENG_OUT_ACC_ALT_GOAROUND", "Number", this.engineOutAccelerationAltitudeGoaround);
            return true;
        }
        this.addNewMessage(NXSystemMessages.notAllowed);
        return false;
    }

    //Needs PR Merge #3082
    //TODO: with FADEC no longer needed
    setPerfTOFlexTemp(s) {
        if (s === FMCMainDisplay.clrValue) {
            this.perfTOTemp = NaN;
            // In future we probably want a better way of checking this, as 0 is
            // in the valid flex temperature range (-99 to 99).
            SimVar.SetSimVarValue("L:AIRLINER_TO_FLEX_TEMP", "Number", 0);
            return true;
        }
        let value = parseInt(s);
        if (!isFinite(value) || !/^[+\-]?\d{1,2}$/.test(s)) {
            this.addNewMessage(NXSystemMessages.formatError);
            return false;
        }
        if (value < -99 || value > 99) {
            this.addNewMessage(NXSystemMessages.entryOutOfRange);
            return false;
        }
        // As the sim uses 0 as a sentinel value to detect that no flex
        // temperature is set, we'll just use 0.1 as the actual value for flex 0
        // and make sure we never display it with decimals.
        if (value === 0) {
            value = 0.1;
        }
        this.perfTOTemp = value;
        SimVar.SetSimVarValue("L:AIRLINER_TO_FLEX_TEMP", "Number", value);
        return true;
    }

    /**
     * Attempts to predict required block fuel for trip
     * @returns {boolean}
     */
    //TODO: maybe make this part of an update routine?
    tryFuelPlanning() {
        if (this._fuelPlanningPhase === this._fuelPlanningPhases.IN_PROGRESS) {
            this._blockFuelEntered = true;
            this._fuelPlanningPhase = this._fuelPlanningPhases.COMPLETED;
            return true;
        }
        const tempRouteFinalFuelTime = this._routeFinalFuelTime;
        this.tryUpdateRouteFinalFuel();
        this.tryUpdateRouteAlternate();
        this.tryUpdateRouteTrip();

        this._routeFinalFuelTime = tempRouteFinalFuelTime;
        this._routeFinalFuelWeight = (this._routeFinalFuelTime * this._rteFinalCoeffecient) / 1000;

        this.tryUpdateMinDestFob();

        this.blockFuel = this.getTotalTripFuelCons() + this._minDestFob + this.taxiFuelWeight + this.getRouteReservedWeight();
        this._fuelPlanningPhase = this._fuelPlanningPhases.IN_PROGRESS;
        return true;
    }

    trySetTaxiFuelWeight(s) {
        if (s === FMCMainDisplay.clrValue) {
            this.taxiFuelWeight = this._defaultTaxiFuelWeight;
            this._taxiEntered = false;
            return true;
        }
        if (!/[0-9]+(\.[0-9][0-9]?)?/.test(s)) {
            this.addNewMessage(NXSystemMessages.formatError);
            return false;
        }
        const value = parseFloat(s) * this._conversionWeight;
        if (isFinite(value) && value >= 0) {
            if (this.isTaxiFuelInRange(value)) {
                this._taxiEntered = true;
                this.taxiFuelWeight = value;
                return true;
            } else {
                this.addNewMessage(NXSystemMessages.entryOutOfRange);
                return false;
            }
        }
        this.addNewMessage(NXSystemMessages.notAllowed);
        return false;
    }

    getRouteFinalFuelWeight() {
        if (isFinite(this._routeFinalFuelWeight)) {
            this._routeFinalFuelWeight = (this._routeFinalFuelTime * this._rteFinalCoeffecient) / 1000;
            return this._routeFinalFuelWeight;
        }
    }

    getRouteFinalFuelTime() {
        return this._routeFinalFuelTime;
    }

    /**
     * This method is used to set initial Final Time for when INIT B is making predictions
     * @param {String} s - containing time value
     * @returns {boolean}
     */
    async trySetRouteFinalTime(s) {
        if (s) {
            if (s === FMCMainDisplay.clrValue) {
                this._routeFinalFuelTime = this._routeFinalFuelTimeDefault;
                return true;
            }
            const rteFinalTime = s.split("/")[1];
            if (rteFinalTime !== undefined) {
                if (this.isFinalTimeInRange(rteFinalTime)) {
                    this._routeFinalFuelTime = FMCMainDisplay.hhmmToMinutes(rteFinalTime.padStart(4,"0"));
                    return true;
                } else {
                    this.addNewMessage(NXSystemMessages.entryOutOfRange);
                    return false;
                }
            }
        }
        this.addNewMessage(NXSystemMessages.notAllowed);
        return false;
    }

    /**
     *
     * @param {string} s
     * @returns {Promise<boolean>}
     */
    async trySetRouteFinalFuel(s) {
        if (s === FMCMainDisplay.clrValue) {
            this._routeFinalFuelTime = this._routeFinalFuelTimeDefault;
            this._rteFinalEntered = false;
            return true;
        }
        if (s) {
            this._rteFinalEntered = true;
            const rteFinalWeight = parseFloat(s.split("/")[0]) / this._conversionWeight;
            const rteFinalTime = s.split("/")[1];
            if (rteFinalTime === undefined) {
                if (this.isFinalFuelInRange(rteFinalWeight)) {
                    this._routeFinalFuelWeight = rteFinalWeight;
                    this._routeFinalFuelTime = (rteFinalWeight * 1000) / this._rteFinalCoeffecient;
                    return true;
                } else {
                    this.addNewMessage(NXSystemMessages.entryOutOfRange);
                    return false;
                }
            } else {
                if (this.isFinalTimeInRange(rteFinalTime)) {
                    this._routeFinalFuelTime = FMCMainDisplay.hhmmToMinutes(rteFinalTime.padStart(4,"0"));
                    this._routeFinalFuelWeight = (this._routeFinalFuelTime * this._rteFinalCoeffecient) / 1000;
                    return true;
                } else {
                    this.addNewMessage(NXSystemMessages.entryOutOfRange);
                    return false;
                }
            }
        }
        this.addNewMessage(NXSystemMessages.notAllowed);
        return false;
    }

    getRouteReservedWeight() {
        if (!this._rteReservedEntered && (this._rteFinalCoeffecient !== 0)) {
            const fivePercentWeight = this._routeReservedPercent * this._routeTripFuelWeight / 100;
            const fiveMinuteHoldingWeight = (5 * this._rteFinalCoeffecient) / 1000;

            return fivePercentWeight > fiveMinuteHoldingWeight ? fivePercentWeight : fiveMinuteHoldingWeight;
        }
        if (isFinite(this._routeReservedWeight) && this._routeReservedWeight !== 0) {
            return this._routeReservedWeight;
        } else {
            return this._routeReservedPercent * this._routeTripFuelWeight / 100;
        }
    }

    getRouteReservedPercent() {
        if (isFinite(this._routeReservedWeight) && isFinite(this.blockFuel) && this._routeReservedWeight !== 0) {
            return this._routeReservedWeight / this._routeTripFuelWeight * 100;
        }
        return this._routeReservedPercent;
    }

    trySetRouteReservedPercent(s) {
        if (s) {
            if (s === FMCMainDisplay.clrValue) {
                this._rteReservedEntered = false;
                this._routeReservedWeight = 0;
                this._routeReservedPercent = 5;
                return true;
            }
            const rteRsvPercent = parseFloat(s.split("/")[1]);
            if (!this.isRteRsvPercentInRange(rteRsvPercent)) {
                this._rteRsvPercentOOR = true;
                this.addNewMessage(NXSystemMessages.notAllowed);
                return false;
            }
            this._rteRsvPercentOOR = false;
            if (isFinite(rteRsvPercent)) {
                this._routeReservedWeight = NaN;
                this._routeReservedPercent = rteRsvPercent;
                return true;
            }
            this.addNewMessage(NXSystemMessages.notAllowed);
            return false;
        }
        this.addNewMessage(NXSystemMessages.notAllowed);
        return false;
    }

    /**
     * Checks input and passes to trySetCruiseFl()
     * @param input
     * @returns {boolean} input passed checks
     */
    trySetCruiseFlCheckInput(input) {
        if (input === FMCMainDisplay.clrValue) {
            this.addNewMessage(NXSystemMessages.notAllowed);
            return false;
        }
        const flString = input.replace("FL", "");
        if (!flString) {
            this.addNewMessage(NXSystemMessages.notAllowed);
            return false;
        }
        return this.trySetCruiseFl(parseFloat(flString));
    }

    /**
     * Sets new Cruise FL if all conditions good
     * @param fl {number} Altitude or FL
     * @returns {boolean} input passed checks
     */
    trySetCruiseFl(fl) {
        if (!isFinite(fl)) {
            this.addNewMessage(NXSystemMessages.notAllowed);
            return false;
        }
        if (fl >= 1000) {
            fl = Math.floor(fl / 100);
        }
        if (fl > this.maxCruiseFL) {
            this.addNewMessage(NXSystemMessages.entryOutOfRange);
            return false;
        }
        const phase = this.currentFlightPhase;
        const selFl = Math.floor(Math.max(0, Simplane.getAutoPilotSelectedAltitudeLockValue("feet")) / 100);
        if (fl < selFl && (phase === FmgcFlightPhases.CLIMB || phase === FmgcFlightPhases.APPROACH || phase === FmgcFlightPhases.GOAROUND)) {
            this.addNewMessage(NXSystemMessages.entryOutOfRange);
            return false;
        }

        if (fl <= 0 || fl > this.maxCruiseFL) {
            this.addNewMessage(NXSystemMessages.entryOutOfRange);
            return false;
        }

        this.cruiseFlightLevel = fl;
        this._cruiseFlightLevel = fl;
        this._cruiseEntered = true;
        this._activeCruiseFlightLevelDefaulToFcu = false;
        this.cruiseTemperature = undefined;
        this.updateConstraints();

        const acFl = Math.floor(Simplane.getAltitude() / 100);

        if (acFl > fl && (phase === FmgcFlightPhases.CLIMB || phase === FmgcFlightPhases.DESCENT || phase === FmgcFlightPhases.APPROACH)) {
            this.flightPhaseManager.changeFlightPhase(FmgcFlightPhases.CRUISE);
        } else if (acFl < fl && (phase === FmgcFlightPhases.DESCENT || phase === FmgcFlightPhases.APPROACH)) {
            this.flightPhaseManager.changeFlightPhase(FmgcFlightPhases.CLIMB);
        }

        return true;
    }

    trySetRouteReservedFuel(s) {
        if (s) {
            if (s === FMCMainDisplay.clrValue) {
                this._rteReservedEntered = false;
                this._routeReservedWeight = 0;
                this._routeReservedPercent = 5;
                this._rteRsvPercentOOR = false;
                return true;
            }
            const rteRsvWeight = parseFloat(s.split("/")[0]) / this._conversionWeight;
            const rteRsvPercent = parseFloat(s.split("/")[1]);
            if (!this.isRteRsvPercentInRange(rteRsvPercent)) {
                this._rteRsvPercentOOR = true;
                return true;
            }
            this._rteRsvPercentOOR = false;
            this._rteReservedEntered = true;
            if (isFinite(rteRsvWeight)) {
                this._routeReservedWeight = rteRsvWeight;
                this._routeReservedPercent = 0;
                if (this.isRteRsvPercentInRange(this.getRouteReservedPercent())) { // Bit of a hacky method due previous tight coupling of weight and percentage calculations
                    return true;
                } else {
                    this.trySetRouteReservedFuel(FMCMainDisplay.clrValue);
                    this._rteRsvPercentOOR = true;
                    return false;
                }
            } else if (isFinite(rteRsvPercent)) {
                this._routeReservedWeight = NaN;
                this._routeReservedPercent = rteRsvPercent;
                return true;
            }
        }
        this.addNewMessage(NXSystemMessages.notAllowed);
        return false;
    }

    trySetZeroFuelWeightZFWCG(s) {
        if (s) {
            if (s.includes("/")) {
                const sSplit = s.split("/");
                const zfw = parseFloat(sSplit[0]) / this._conversionWeight;
                const zfwcg = parseFloat(sSplit[1]);
                if (isFinite(zfw) && isFinite(zfwcg)) {
                    if (this.isZFWInRange(zfw) && this.isZFWCGInRange(zfwcg)) {
                        this._zeroFuelWeightZFWCGEntered = true;
                        this.zeroFuelWeight = zfw;
                        this.zeroFuelWeightMassCenter = zfwcg;
                        return true;
                    }
                    this.addNewMessage(NXSystemMessages.entryOutOfRange);
                    return false;
                }
                if (!this._zeroFuelWeightZFWCGEntered) {
                    this.addNewMessage(NXSystemMessages.notAllowed);
                    return false;
                }
                if (this.isZFWInRange(zfw)) {
                    this.zeroFuelWeight = zfw;
                    return true;
                }
                if (this.isZFWCGInRange(zfwcg)) {
                    this.zeroFuelWeightMassCenter = zfwcg;
                    return true;
                }
                this.addNewMessage(NXSystemMessages.entryOutOfRange);
                return false;
            }
            if (!this._zeroFuelWeightZFWCGEntered) {
                this.addNewMessage(NXSystemMessages.notAllowed);
                return false;
            }
            const zfw = parseFloat(s) / this._conversionWeight;
            if (this.isZFWInRange(zfw)) {
                this.zeroFuelWeight = zfw;
                return true;
            }
            this.addNewMessage(NXSystemMessages.entryOutOfRange);
            return false;
        }
        this.addNewMessage(NXSystemMessages.formatError);
        return false;
    }

    /**
     *
     * @returns {number} Returns estimated fuel on board when arriving at the destination
     */
    getDestEFOB(useFOB = false) {
        return (useFOB ? this.getFOB() : this.blockFuel) - this._routeTripFuelWeight - this.taxiFuelWeight;
    }

    /**
     * @returns {number} Returns EFOB when arriving at the alternate dest
     */
    getAltEFOB(useFOB = false) {
        return this.getDestEFOB(useFOB) - this._routeAltFuelWeight;
    }

    trySetBlockFuel(s) {
        if (s === FMCMainDisplay.clrValue) {
            this.blockFuel = 0.0;
            this._blockFuelEntered = false;
            this._fuelPredDone = false;
            this._fuelPlanningPhase = this._fuelPlanningPhases.PLANNING;
            return true;
        }
        const value = parseFloat(s) / this._conversionWeight;
        if (isFinite(value) && this.isBlockFuelInRange(value)) {
            if (this.isBlockFuelInRange(value)) {
                this.blockFuel = value;
                this._blockFuelEntered = true;
                return true;
            } else {
                this.addNewMessage(NXSystemMessages.entryOutOfRange);
                return false;
            }
        }
        this.addNewMessage(NXSystemMessages.notAllowed);
        return false;
    }

    async trySetAverageWind(s) {
        const validDelims = ["TL", "T", "+", "HD", "H", "-"];
        const matchedIndex = validDelims.findIndex(element => s.startsWith(element));
        const digits = matchedIndex >= 0 ? s.replace(validDelims[matchedIndex], "") : s;
        const isNum = /^\d+$/.test(digits);
        if (!isNum) {
            this.addNewMessage(NXSystemMessages.formatError);
            return false;
        }
        const wind = parseInt(digits);
        this._windDir = matchedIndex <= 2 ? this._windDirections.TAILWIND : this._windDirections.HEADWIND;
        if (wind > 250) {
            this.addNewMessage(NXSystemMessages.entryOutOfRange);
            return false;
        }
        this.averageWind = wind;
        return true;
    }

    //TODO: fix this functionality
    trySetPreSelectedClimbSpeed(s) {
        const v = parseFloat(s);
        if (isFinite(v)) {
            this.preSelectedClbSpeed = v;
            return true;
        }
        this.addNewMessage(NXSystemMessages.notAllowed);
        return false;
    }

    //TODO: fix this functionality
    trySetPreSelectedCruiseSpeed(s) {
        const v = parseFloat(s);
        if (isFinite(v)) {
            this.preSelectedCrzSpeed = v;
            return true;
        }
        this.addNewMessage(NXSystemMessages.notAllowed);
        return false;
    }

    //TODO: fix this functionality
    trySetPreSelectedDescentSpeed(s) {
        const v = parseFloat(s);
        if (isFinite(v)) {
            this.preSelectedDesSpeed = v;
            return true;
        }
        this.addNewMessage(NXSystemMessages.notAllowed);
        return false;
    }

    setPerfApprQNH(s) {
        if (s === FMCMainDisplay.clrValue) {
            const dest = this.flightPlanManager.getDestination();
            if (dest && dest.liveDistanceTo < 180) {
                this.addNewMessage(NXSystemMessages.notAllowed);
                return false;
            } else {
                this.perfApprQNH = NaN;
                return true;
            }
        }

        const value = parseFloat(s);
        const HPA_REGEX = /^[01]?[0-9]{3}$/;
        const INHG_REGEX = /^[23][0-9]\.?[0-9]{2}$/;

        if (HPA_REGEX.test(value)) {
            if (value >= 745 && value <= 1050) {
                this.perfApprQNH = value;
                return true;
            } else {
                this.addNewMessage(NXSystemMessages.entryOutOfRange);
                return false;
            }
        } else if (INHG_REGEX.test(value)) {
            if (value >= 2200 && value <= 3100) {
                this.perfApprQNH = value / 100;
                return true;
            } else if (value >= 22.0 && value <= 31.00) {
                this.perfApprQNH = value;
                return true;
            } else {
                this.addNewMessage(NXSystemMessages.entryOutOfRange);
                return false;
            }
        }
        this.addNewMessage(NXSystemMessages.formatError);
        return false;
    }

    setPerfApprTemp(s) {
        if (s === FMCMainDisplay.clrValue) {
            const dest = this.flightPlanManager.getDestination();
            if (dest && dest.liveDistanceTo < 180) {
                this.addNewMessage(NXSystemMessages.notAllowed);
                return false;
            } else {
                this.perfApprTemp = NaN;
                return true;
            }
        }

        if (!/^[\+\-]?\d{1,2}$/.test(s)) {
            this.addNewMessage(NXSystemMessages.formatError);
            return false;
        }
        this.perfApprTemp = parseInt(s);
        return true;
    }

    setPerfApprWind(s) {
        if (s === FMCMainDisplay.clrValue) {
            this.perfApprWindHeading = NaN;
            this.perfApprWindSpeed = NaN;
            return true;
        }

        // both must be entered
        if (!/^\d{1,3}\/\d{1,3}$/.test(s)) {
            this.addNewMessage(NXSystemMessages.formatError);
            return false;
        }
        const [dir, mag] = s.split("/").map((v) => parseInt(v));
        if (dir > 360 || mag > 500) {
            this.addNewMessage(NXSystemMessages.entryOutOfRange);
            return false;
        }
        this.perfApprWindHeading = dir % 360; // 360 is displayed as 0
        this.perfApprWindSpeed = mag;
        return true;
    }

    setPerfApprTransAlt(s) {
        if (s === FMCMainDisplay.clrValue) {
            this.perfApprTransAlt = NaN;
            this.perfApprTransAltPilotEntered = false;
            SimVar.SetSimVarValue("L:AIRLINER_APPR_TRANS_ALT", "Number", 0);
            return true;
        }

        if (!/^\d{4,5}$/.test(s)) {
            this.addNewMessage(NXSystemMessages.formatError);
            return false;
        }
        const value = Math.round(parseInt(s) / 10) * 10;
        if (value < 1000 || value > 45000) {
            this.addNewMessage(NXSystemMessages.entryOutOfRange);
            return false;
        }

        this.perfApprTransAlt = value;
        this.perfApprTransAltPilotEntered = true;
        SimVar.SetSimVarValue("L:AIRLINER_APPR_TRANS_ALT", "Number", value);
        return true;
    }

    /**
     * VApp for _selected_ landing config
     */
    getVApp() {
        if (isFinite(this.vApp)) {
            return this.vApp;
        }
        return this.approachSpeeds.vapp;
    }

    //Needs PR Merge #3154
    setPerfApprVApp(s) {
        if (s === FMCMainDisplay.clrValue) {
            if (isFinite(this.vApp)) {
                this.vApp = NaN;
                return true;
            }
        } else {
            if (s.includes(".")) {
                this.addNewMessage(NXSystemMessages.formatError);
                return false;
            }
            const value = parseInt(s);
            if (isFinite(value) && value >= 90 && value <= 350) {
                this.vApp = value;
                return true;
            }
            this.addNewMessage(NXSystemMessages.entryOutOfRange);
            return false;
        }
        this.addNewMessage(NXSystemMessages.notAllowed);
        return false;
    }

    /**
     * Tries to estimate the landing weight at destination
     * NaN on failure
     */
    tryEstimateLandingWeight() {
        const altActive = false;
        const landingWeight = this.zeroFuelWeight + (altActive ? this.getAltEFOB(true) : this.getDestEFOB(true));
        return isFinite(landingWeight) ? landingWeight : NaN;
    }

    setPerfApprMDA(s) {
        if (s === FMCMainDisplay.clrValue) {
            this.perfApprMDA = NaN;
            SimVar.SetSimVarValue("L:AIRLINER_MINIMUM_DESCENT_ALTITUDE", "feet", 0);
            return true;
        } else if (s.match(/^[0-9]{1,5}$/) !== null) {
            const value = parseInt(s);
            let ldgRwy = this.flightPlanManager.getApproachRunway();
            if (!ldgRwy) {
                const dest = this.flightPlanManager.getDestination();
                if (dest && dest.infos && dest.infos.runways.length > 0) {
                    ldgRwy = dest.infos.runways[0];
                }
            }
            const limitLo = ldgRwy ? ldgRwy.elevation * 3.28084 : 0;
            const limitHi = ldgRwy ? ldgRwy.elevation * 3.28084 + 5000 : 39000;
            if (value >= limitLo && value <= limitHi) {
                this.perfApprMDA = value;
                SimVar.SetSimVarValue("L:AIRLINER_MINIMUM_DESCENT_ALTITUDE", "feet", this.perfApprMDA);
                return true;
            }
            this.addNewMessage(NXSystemMessages.entryOutOfRange);
            return false;
        } else {
            this.addNewMessage(NXSystemMessages.formatError);
            return false;
        }
    }

    setPerfApprDH(s) {
        if (s === FMCMainDisplay.clrValue) {
            this.perfApprDH = NaN;
            SimVar.SetSimVarValue("L:AIRLINER_DECISION_HEIGHT", "feet", -1);
            return true;
        }

        if (s === "NO" || s === "NO DH" || s === "NODH") {
            this.perfApprDH = "NO DH";
            SimVar.SetSimVarValue("L:AIRLINER_DECISION_HEIGHT", "feet", -2);
            return true;
        } else if (s.match(/^[0-9]{1,5}$/) !== null) {
            const value = parseInt(s);
            if (value >= 0 && value <= 5000) {
                this.perfApprDH = value;
                SimVar.SetSimVarValue("L:AIRLINER_DECISION_HEIGHT", "feet", this.perfApprDH);
                return true;
            } else {
                this.addNewMessage(NXSystemMessages.entryOutOfRange);
                return false;
            }
        } else {
            this.addNewMessage(NXSystemMessages.formatError);
            return false;
        }
    }

    setPerfApprFlaps3(s) {
        this.perfApprFlaps3 = s;
        SimVar.SetSimVarValue("L:A32NX_SPEEDS_LANDING_CONF3", "boolean", s);
    }

    getIsFlying() {
        return this.currentFlightPhase >= FmgcFlightPhases.TAKEOFF;
    }

    tryGoInApproachPhase() {
        if (
            this.currentFlightPhase === FmgcFlightPhases.PREFLIGHT ||
            this.currentFlightPhase === FmgcFlightPhases.TAKEOFF ||
            this.currentFlightPhase === FmgcFlightPhases.DONE
        ) {
            return false;
        }

        if (this.currentFlightPhase !== FmgcFlightPhases.APPROACH) {
            this.flightPhaseManager.changeFlightPhase(FmgcFlightPhases.APPROACH);
        }

        return true;
    }

    connectIlsFrequency(_freq) {
        if (_freq >= 108 && _freq <= 111.95 && RadioNav.isHz50Compliant(_freq)) {
            switch (this.radioNav.mode) {
                case NavMode.FOUR_SLOTS: {
                    this.ilsFrequency = _freq;
                    break;
                }
                case NavMode.TWO_SLOTS: {
                    this.vor1Frequency = _freq;
                    break;
                }
            }
            this.connectIls();
            return true;
        }
        return false;
    }

    connectIls() {
        if (this.isRadioNavActive()) {
            return;
        }
        if (this._lockConnectIls) {
            return;
        }
        this._lockConnectIls = true;
        setTimeout(() => {
            this._lockConnectIls = false;
        }, 1000);
        switch (this.radioNav.mode) {
            case NavMode.FOUR_SLOTS: {
                if (Math.abs(this.radioNav.getILSActiveFrequency(1) - this.ilsFrequency) > 0.005) {
                    this.radioNav.setILSActiveFrequency(1, this.ilsFrequency);
                }
                break;
            }
            case NavMode.TWO_SLOTS: {
                if (Math.abs(this.radioNav.getVORActiveFrequency(1) - this.vor1Frequency) > 0.005) {
                    this.radioNav.setVORActiveFrequency(1, this.vor1Frequency);
                }
                break;
            }
            default:
                console.error("Unknown RadioNav operating mode");
                break;
        }
    }

    setIlsFrequency(s) {
        if (s === FMCMainDisplay.clrValue) {
            this.ilsFrequency = 0;
            this.radioNav.setILSActiveFrequency(1, 0);
            this._ilsFrequencyPilotEntered = false;
            return true;
        }
        const v = parseFloat(s);
        if (isFinite(v)) {
            const freq = Math.round(v * 100) / 100;
            if (this.connectIlsFrequency(freq)) {
                this._ilsFrequencyPilotEntered = true;
                return true;
            }
            this.addNewMessage(NXSystemMessages.entryOutOfRange);
            return false;
        }
        this.addNewMessage(NXSystemMessages.notAllowed);
        return false;
    }

    initRadioNav(_boot) {
        if (this.isPrimary) {
            console.log("Init RadioNav");
            {
                if (_boot) {
                    this.vhf1Frequency = this.radioNav.getVHFActiveFrequency(this.instrumentIndex, 1);
                    this.vhf2Frequency = this.radioNav.getVHFActiveFrequency(this.instrumentIndex, 2);
                } else {
                    if (Math.abs(this.radioNav.getVHFActiveFrequency(this.instrumentIndex, 1) - this.vhf1Frequency) > 0.005) {
                        this.radioNav.setVHFActiveFrequency(this.instrumentIndex, 1, this.vhf1Frequency);
                    }
                    if (Math.abs(this.radioNav.getVHFActiveFrequency(this.instrumentIndex, 2) - this.vhf2Frequency) > 0.005) {
                        this.radioNav.setVHFActiveFrequency(this.instrumentIndex, 2, this.vhf2Frequency);
                    }
                }
            }
            {
                if (Math.abs(this.radioNav.getVORActiveFrequency(1) - this.vor1Frequency) > 0.005) {
                    this.radioNav.setVORActiveFrequency(1, this.vor1Frequency);
                }
                if (this.vor1Course >= 0) {
                    SimVar.SetSimVarValue("K:VOR1_SET", "number", this.vor1Course);
                }
                this.connectIls();
            }
            {
                if (Math.abs(this.radioNav.getVORActiveFrequency(2) - this.vor2Frequency) > 0.005) {
                    this.radioNav.setVORActiveFrequency(2, this.vor2Frequency);
                }
                if (this.vor2Course >= 0) {
                    SimVar.SetSimVarValue("K:VOR2_SET", "number", this.vor2Course);
                }
                if (Math.abs(this.radioNav.getILSActiveFrequency(2) - 0) > 0.005) {
                    this.radioNav.setILSActiveFrequency(2, 0);
                }
            }
            {
                if (_boot) {
                    this.adf1Frequency = this.radioNav.getADFActiveFrequency(1);
                    this.adf2Frequency = this.radioNav.getADFActiveFrequency(2);
                } else {
                    if (Math.abs(this.radioNav.getADFActiveFrequency(1) - this.adf1Frequency) > 0.005) {
                        SimVar.SetSimVarValue("K:ADF_COMPLETE_SET", "Frequency ADF BCD32", Avionics.Utils.make_adf_bcd32(this.adf1Frequency * 1000)).then(() => {
                        });
                    }
                    if (Math.abs(this.radioNav.getADFActiveFrequency(2) - this.adf2Frequency) > 0.005) {
                        SimVar.SetSimVarValue("K:ADF2_COMPLETE_SET", "Frequency ADF BCD32", Avionics.Utils.make_adf_bcd32(this.adf2Frequency * 1000)).then(() => {
                        });
                    }
                }
            }
            {
                if (this.atc1Frequency > 0) {
                    SimVar.SetSimVarValue("K:XPNDR_SET", "Frequency BCD16", Avionics.Utils.make_xpndr_bcd16(this.atc1Frequency));
                } else {
                    this.atc1Frequency = SimVar.GetSimVarValue("TRANSPONDER CODE:1", "number");
                }
            }
        }
    }

    canSwitchToNav() {
        if (!this._canSwitchToNav) {
            const altitude = Simplane.getAltitudeAboveGround();
            if (altitude >= 500) {
                this._canSwitchToNav = true;
            }
        }
        return this._canSwitchToNav;
    }

    isRadioNavActive() {
        return this.radioNav.getRADIONAVActive((this.isPrimary) ? 1 : 2);
    }

    get vhf1Frequency() {
        return this._vhf1Frequency;
    }

    get vhf2Frequency() {
        return this._vhf2Frequency;
    }

    get vor1Frequency() {
        return this._vor1Frequency;
    }

    get vor1Course() {
        return this._vor1Course;
    }

    get vor2Frequency() {
        return this._vor2Frequency;
    }

    get vor2Course() {
        return this._vor2Course;
    }

    get ilsFrequency() {
        return this._ilsFrequency;
    }

    get ilsCourse() {
        return this._ilsCourse;
    }

    get adf1Frequency() {
        return this._adf1Frequency;
    }

    get adf2Frequency() {
        return this._adf2Frequency;
    }

    get rcl1Frequency() {
        return this._rcl1Frequency;
    }

    get pre2Frequency() {
        return this._pre2Frequency;
    }

    get atc1Frequency() {
        return this._atc1Frequency;
    }

    set vhf1Frequency(_frq) {
        this._vhf1Frequency = _frq;
    }

    set vhf2Frequency(_frq) {
        this._vhf2Frequency = _frq;
    }

    set vor1Frequency(_frq) {
        this._vor1Frequency = _frq;
        SimVar.SetSimVarValue("L:FMC_VOR_FREQUENCY:1", "Hz", _frq * 1000000);
    }

    set vor1Course(_crs) {
        this._vor1Course = _crs;
    }

    set vor2Frequency(_frq) {
        this._vor2Frequency = _frq;
        SimVar.SetSimVarValue("L:FMC_VOR_FREQUENCY:2", "Hz", _frq * 1000000);
    }

    set vor2Course(_crs) {
        this._vor2Course = _crs;
    }

    set ilsFrequency(_frq) {
        this._ilsFrequency = _frq;
    }

    set ilsCourse(_crs) {
        this._ilsCourse = _crs;
    }

    set adf1Frequency(_frq) {
        this._adf1Frequency = _frq;
    }

    set adf2Frequency(_frq) {
        this._adf2Frequency = _frq;
    }

    set rcl1Frequency(_frq) {
        this._rcl1Frequency = _frq;
    }

    set pre2Frequency(_frq) {
        this._pre2Frequency = _frq;
    }

    set atc1Frequency(_frq) {
        this._atc1Frequency = _frq;
    }

    updateZfwVars() {
        const totalWeight = SimVar.GetSimVarValue("TOTAL WEIGHT", "kilograms") / 1000;
        const blockFuel = SimVar.GetSimVarValue("FUEL TOTAL QUANTITY", "gallons") * SimVar.GetSimVarValue("FUEL WEIGHT PER GALLON", "kilograms") / 1000;
        this.zeroFuelWeight = totalWeight - blockFuel;
        this.zeroFuelWeightMassCenter = SimVar.GetSimVarValue("CG PERCENT", "percent");
    }

    updateFuelVars() {
        this.blockFuel = SimVar.GetSimVarValue("FUEL TOTAL QUANTITY", "gallons") * SimVar.GetSimVarValue("FUEL WEIGHT PER GALLON", "kilograms") / 1000;
        this.updateZfwVars();
    }

    trySetFlapsTHS(s) {
        if (s === FMCMainDisplay.clrValue) {
            this.flaps = NaN;
            this.ths = NaN;
            SimVar.SetSimVarValue("L:A32NX_TO_CONFIG_FLAPS", "number", 0);
            SimVar.SetSimVarValue("L:A32NX_TO_CONFIG_FLAPS_ENTERED", "bool", false);
            SimVar.SetSimVarValue("L:A32NX_TO_CONFIG_THS", "degree", 0);
            SimVar.SetSimVarValue("L:A32NX_TO_CONFIG_THS_ENTERED", "bool", false);
            this.tryCheckToData();
            return true;
        }

        let newFlaps = null;
        let newThs = null;

        let [flaps, ths] = s.split("/");

        if (flaps && flaps.length > 0) {
            if (!/^\d$/.test(flaps)) {
                this.addNewMessage(NXSystemMessages.formatError);
                return false;
            }

            flaps = parseInt(flaps);
            if (flaps < 0 || flaps > 3) {
                this.addNewMessage(NXSystemMessages.entryOutOfRange);
                return false;
            }

            newFlaps = flaps;
        }

        if (ths && ths.length > 0) {
            // allow AAN.N and N.NAA, where AA is UP or DN
            if (!/^(UP|DN)(\d|\d?\.\d|\d\.\d?)|(\d|\d?\.\d|\d\.\d?)(UP|DN)$/.test(ths)) {
                this.addNewMessage(NXSystemMessages.formatError);
                return false;
            }

            let direction = null;
            ths = ths.replace(/(UP|DN)/g, (substr) => {
                direction = substr;
                return "";
            });

            if (direction) {
                ths = parseFloat(ths);
                if (direction === "DN") {
                    // Note that 0 *= -1 will result in -0, which is strictly
                    // the same as 0 (that is +0 === -0) and doesn't make a
                    // difference for the calculation itself. However, in order
                    // to differentiate between DN0.0 and UP0.0 we'll do check
                    // later when displaying this value using Object.is to
                    // determine whether the pilot entered DN0.0 or UP0.0.
                    ths *= -1;
                }
                if (!isFinite(ths) || ths < -5 || ths > 7) {
                    this.addNewMessage(NXSystemMessages.entryOutOfRange);
                    return false;
                }
                newThs = ths;
            }
        }

        if (newFlaps !== null) {
            if (!isNaN(this.flaps)) {
                this.tryCheckToData();
            }
            this.flaps = newFlaps;
            SimVar.SetSimVarValue("L:A32NX_TO_CONFIG_FLAPS", "number", newFlaps);
            SimVar.SetSimVarValue("L:A32NX_TO_CONFIG_FLAPS_ENTERED", "bool", true);
        }
        if (newThs !== null) {
            if (!isNaN(this.ths)) {
                this.tryCheckToData();
            }
            this.ths = newThs;
            SimVar.SetSimVarValue("L:A32NX_TO_CONFIG_THS", "degree", newThs);
            SimVar.SetSimVarValue("L:A32NX_TO_CONFIG_THS_ENTERED", "bool", true);
        }
        return true;
    }

    checkEFOBBelowMin() {
        if (!this._minDestFobEntered) {
            this.tryUpdateMinDestFob();
        }
        const EFOBBelMin = this.isAnEngineOn() ? this.getDestEFOB(true) : this.getDestEFOB(false);

        if (EFOBBelMin < this._minDestFob) {
            if (this.isAnEngineOn()) {
                setTimeout(() => {
                    this.addNewMessage(NXSystemMessages.destEfobBelowMin, () => {
                        return this._EfobBelowMinClr === false;
                    }, () => {
                        this._EfobBelowMinClr = true;
                    });
                }, 180000);
            } else {
                this.addNewMessage(NXSystemMessages.destEfobBelowMin, () => {
                    return this._EfobBelowMinClr === false;
                }, () => {
                    this._EfobBelowMinClr = true;
                });
            }
        }
    }

    updateTowerHeadwind() {
        if (isFinite(this.perfApprWindSpeed) && isFinite(this.perfApprWindHeading)) {
            const rwy = this.flightPlanManager.getApproachRunway();
            if (rwy) {
                this._towerHeadwind = NXSpeedsUtils.getHeadwind(this.perfApprWindSpeed, this.perfApprWindHeading, rwy.direction);
            }
        }
    }

    _getV1Speed() {
        return (new NXSpeedsTo(SimVar.GetSimVarValue("TOTAL WEIGHT", "kg") / 1000, this.flaps, Simplane.getAltitude())).v1;
    }

    _getVRSpeed() {
        return (new NXSpeedsTo(SimVar.GetSimVarValue("TOTAL WEIGHT", "kg") / 1000, this.flaps, Simplane.getAltitude())).vr;
    }

    _getV2Speed() {
        return (new NXSpeedsTo(SimVar.GetSimVarValue("TOTAL WEIGHT", "kg") / 1000, this.flaps, Simplane.getAltitude())).v2;
    }

    /**
     * Called after Flaps or THS change
     */
    tryCheckToData() {
        if (isFinite(this.v1Speed) || isFinite(this.vRSpeed) || isFinite(this.v2Speed)) {
            this.addNewMessage(NXSystemMessages.checkToData);
        }
    }

    /**
     * Called after runway change
     * - Sets confirmation prompt state for every entry whether it is defined or not
     * - Adds message when at least one entry needs to be confirmed
     * Additional:
     *   Only prompt the confirmation of FLEX TEMP when the TO runway was changed, not on initial insertion of the runway
     */
    onToRwyChanged() {
        const selectedRunway = this.flightPlanManager.getDepartureRunway();
        if (!!selectedRunway) {
            const toRunway = Avionics.Utils.formatRunway(selectedRunway.designation);
            if (toRunway === this.toRunway) {
                return;
            }
            if (!!this.toRunway) {
                this.toRunway = toRunway;
                this._toFlexChecked = !isFinite(this.perfTOTemp);
                this._v1Checked = !isFinite(this.v1Speed);
                this._vRChecked = !isFinite(this.vRSpeed);
                this._v2Checked = !isFinite(this.v2Speed);

                if (this._v1Checked && this._vRChecked && this._v2Checked && this._toFlexChecked) {
                    return;
                }
                this.addNewMessage(NXSystemMessages.checkToData, (mcdu) => {
                    return mcdu._v1Checked && mcdu._vRChecked && mcdu._v2Checked && mcdu._toFlexChecked;
                });
            }
            this.toRunway = toRunway;
        }
    }

    /**
     * Evaluates whether or not the shown performance page can be updated with the one corresponding to the new flight phase
     * This function is in place to ensure only switching the performance page when the one currently showing is the one linked to the previous flight phase
     * @param _lastFlightPhase {FmgcFlightPhases}
     * @returns {boolean}
     */
    canShowNextPerfPage(_lastFlightPhase) {
        switch (_lastFlightPhase) {
            case FmgcFlightPhases.TAKEOFF: return this.page.Current === this.page.PerformancePageTakeoff;
            case FmgcFlightPhases.CLIMB: return this.page.Current === this.page.PerformancePageClb;
            case FmgcFlightPhases.CRUISE: return this.page.Current === this.page.PerformancePageCrz;
            case FmgcFlightPhases.DESCENT: return this.page.Current === this.page.PerformancePageDes;
            case FmgcFlightPhases.APPROACH: return this.page.Current === this.page.PerformancePageAppr;
            case FmgcFlightPhases.GOAROUND: return this.page.Current === this.page.PerformancePageGoAround;

            default: return false;
        }
    }

    /* END OF MCDU GET/SET METHODS */
    /* UNSORTED CODE BELOW */

    //TODO: can this be util?
    static secondsToUTC(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds - h * 3600) / 60);
        return (h % 24).toFixed(0).padStart(2, "0") + m.toFixed(0).padStart(2, "0");
    }
    //TODO: can this be util?
    static secondsTohhmm(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds - h * 3600) / 60);
        return h.toFixed(0).padStart(2, "0") + m.toFixed(0).padStart(2, "0");
    }

    //TODO: can this be util?
    static minuteToSeconds(minutes) {
        return minutes * 60;
    }

    //TODO: can this be util?
    static hhmmToSeconds(hhmm) {
        if (!hhmm) {
            return NaN;
        }
        const h = parseInt(hhmm.substring(0, 2));
        const m = parseInt(hhmm.substring(2, 4));
        return h * 3600 + m * 60;
    }

    /**
     * Computes hour and minutes when given minutes
     * @param {number} minutes - minutes used to make the conversion
     * @returns {string} A string in the format "HHMM" e.g "0235"
     */
    //TODO: can this be util?
    static minutesTohhmm(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes - h * 60;
        return h.toFixed(0).padStart(2,"0") + m.toFixed(0).padStart(2, "0");
    }

    /**
     * computes minutes when given hour and minutes
     * @param {string} hhmm - string used ot make the conversion
     * @returns {number} numbers in minutes form
     */
    //TODO: can this be util?
    static hhmmToMinutes(hhmm) {
        if (!hhmm) {
            return NaN;
        }
        const h = parseInt(hhmm.substring(0, 2));
        const m = parseInt(hhmm.substring(2, 4));
        return h * 60 + m;
    }

    //TODO: can this be util?
    getNavDataDateRange() {
        return SimVar.GetGameVarValue("FLIGHT NAVDATA DATE RANGE", "string");
    }

    /**
     * Returns true if an engine is running (FF > 0)
     * @returns {boolean}
     */
    //TODO: can this be an util?
    isAnEngineOn() {
        return Simplane.getEngineActive(0) || Simplane.getEngineActive(1);
    }

    /**
     * Returns true if all engines are running (FF > 0)
     * @returns {boolean}
     */
    //TODO: can this be an util?
    isAllEngineOn() {
        return Simplane.getEngineActive(0) && Simplane.getEngineActive(1);
    }

    /**
     * Returns the ISA temperature for a given altitude
     * @param alt {number} altitude in ft
     * @returns {number} ISA temp in C°
     */
    //TODO: can this be an util?
    getIsaTemp(alt = Simplane.getAltitude()) {
        return alt / 1000 * (-1.98) + 15;
    }

    /**
     * Returns the deviation from ISA temperature and OAT at given altitude
     * @param alt {number} altitude in ft
     * @returns {number} ISA temp deviation from OAT in C°
     */
    //TODO: can this be an util?
    getIsaTempDeviation(alt = Simplane.getAltitude()) {
        return SimVar.GetSimVarValue("AMBIENT TEMPERATURE", "celsius") - this.getIsaTemp(alt);
    }

    /**
     * Returns the maximum cruise FL for ISA temp and GW
     * @param temp {number} ISA in C°
     * @param gw {number} GW in t
     * @returns {number} MAX FL
     */
    //TODO: can this be an util?
    getMaxFL(temp = this.getIsaTempDeviation(), gw = SimVar.GetSimVarValue("TOTAL WEIGHT", "kg") / 1000) {
        return Math.round(temp <= 10 ? ((-0.0625 * (gw * gw)) + (1.525 * gw) + 436.05 ): ((-0.0625 * (gw * gw)) + (1.175 * gw) + 452.15 - ((temp - 10) * 2.8)));
    }

    /**
     * Returns the maximum allowed cruise FL considering max service FL
     * @param fl {number} FL to check
     * @returns {number} maximum allowed cruise FL
     */
    //TODO: can this be an util?
    getMaxFlCorrected(fl = this.getMaxFL()) {
        return fl >= this.maxCruiseFL ? this.maxCruiseFL : fl;
    }

    // only used by trySetMinDestFob
    //TODO: Can this be util?
    isMinDestFobInRange(fuel) {
        return 0 <= fuel && fuel <= 80.0;
    }

    //TODO: Can this be util?
    isTaxiFuelInRange(taxi) {
        return 0 <= taxi && taxi <= 9.9;
    }

    //TODO: Can this be util?
    isFinalFuelInRange(fuel) {
        return 0 <= fuel && fuel <= 100;
    }

    //TODO: Can this be util?
    isFinalTimeInRange(time) {
        const convertedTime = FMCMainDisplay.hhmmToMinutes(time.padStart(4,"0"));
        return 0 <= convertedTime && convertedTime <= 90;
    }

    //TODO: Can this be util?
    isRteRsvPercentInRange(value) {
        return value > 0 && value < 15;
    }

    //TODO: Can this be util?
    isZFWInRange(zfw) {
        return 24.0 <= zfw && zfw <= 80.0;
    }

    //TODO: Can this be util?
    isZFWCGInRange(zfwcg) {
        return (8.0 <= zfwcg && zfwcg <= 50.0);
    }

    //TODO: Can this be util?
    isBlockFuelInRange(fuel) {
        return 0 <= fuel && fuel <= 80;
    }

    /**
     *
     * @returns {*}
     */
    //TODO: Can this be util?
    getFOB() {
        return (SimVar.GetSimVarValue("FUEL TOTAL QUANTITY WEIGHT", "pound") * 0.453592) / 1000;
    }

    /**
     * retrieves GW in Tons
     * @returns {number}
     */
    //TODO: Can this be util?
    getGW() {
        return (SimVar.GetSimVarValue("TOTAL WEIGHT", "Pounds") * 0.45359237) / 1000;
    }

    //TODO: Can this be util?
    getCG() {
        return SimVar.GetSimVarValue("CG PERCENT", "Percent over 100") * 100;
    }

    //TODO: make this util or local var?
    isAirspeedManaged() {
        return SimVar.GetSimVarValue("AUTOPILOT SPEED SLOT INDEX", "number") === 2;
    }

    //TODO: make this util or local var?
    isHeadingManaged() {
        return SimVar.GetSimVarValue("AUTOPILOT HEADING SLOT INDEX", "number") === 2;
    }

    //TODO: make this util or local var?
    isAltitudeManaged() {
        return SimVar.GetSimVarValue("AUTOPILOT ALTITUDE SLOT INDEX", "number") === 2;
    }
}

FMCMainDisplay.clrValue = "\xa0\xa0\xa0\xa0\xa0CLR";
FMCMainDisplay._AvailableKeys = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
