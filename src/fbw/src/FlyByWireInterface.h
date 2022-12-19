#pragma once

#include <MSFS/Legacy/gauges.h>
#include <SimConnect.h>

#include "AdditionalData.h"
#include "AutopilotLaws.h"
#include "AutopilotStateMachine.h"
#include "Autothrust.h"
#include "CalculatedRadioReceiver.h"
#include "EngineData.h"
#include "FlightDataRecorder.h"
#include "InterpolatingLookupTable.h"
#include "LocalVariable.h"
#include "RateLimiter.h"
#include "SimConnectInterface.h"
#include "SpoilersHandler.h"
#include "ThrottleAxisMapping.h"
#include "elac/Elac.h"
#include "fac/Fac.h"
#include "failures/FailuresConsumer.h"
#include "fcdc/Fcdc.h"
#include "sec/Sec.h"

#include "utils/HysteresisNode.h"

class FlyByWireInterface {
 public:
  bool connect();

  void disconnect();

  bool update(double sampleTime);

 private:
  const std::string CONFIGURATION_FILEPATH = "\\work\\ModelConfiguration.ini";

  static constexpr double MAX_ACCEPTABLE_SAMPLE_TIME = 0.11;
  static constexpr uint32_t LOW_PERFORMANCE_TIMER_THRESHOLD = 10;
  uint32_t lowPerformanceTimer = 0;

  double previousSimulationTime = 0;
  double calculatedSampleTime = 0;

  double monotonicTime = 0;

  int currentApproachCapability = 0;
  double previousApproachCapabilityUpdateTime = 0;

  bool simulationRateReductionEnabled = true;
  bool limitSimulationRateByPerformance = true;

  double targetSimulationRate = 1;
  bool targetSimulationRateModified = false;

  bool autopilotStateMachineEnabled = false;
  bool autopilotLawsEnabled = false;
  bool flyByWireEnabled = false;
  int elacDisabled = -1;
  int secDisabled = -1;
  int facDisabled = -1;
  bool autoThrustEnabled = false;
  bool tailstrikeProtectionEnabled = true;

  bool wasTcasEngaged = false;

  bool pauseDetected = false;
  // As fdr is not written when paused 'wasPaused' is used to detect previous pause state
  // changes and record them in fdr
  bool wasPaused = false;
  bool wasInSlew = false;

  double autothrustThrustLimitReverse = -45;

  bool flightDirectorConnectLatch_1 = false;
  bool flightDirectorConnectLatch_2 = false;
  bool flightDirectorDisconnectLatch_1 = false;
  bool flightDirectorDisconnectLatch_2 = false;

  bool autolandWarningLatch = false;
  bool autolandWarningTriggered = false;

  double flightControlsKeyChangeAileron = 0.0;
  double flightControlsKeyChangeElevator = 0.0;
  double flightControlsKeyChangeRudder = 0.0;

  double rudderTravelLimiterPosition = 25;

  bool disableXboxCompatibilityRudderAxisPlusMinus = false;

  bool clientDataEnabled = false;

  bool last_fd1_active = false;
  bool last_fd2_active = false;

  bool last_ls1_active = false;
  bool last_ls2_active = false;

  FlightDataRecorder flightDataRecorder;

  SimConnectInterface simConnectInterface;

  FailuresConsumer failuresConsumer;

  AutopilotStateMachineModelClass autopilotStateMachine;
  AutopilotStateMachineModelClass::ExternalInputs_AutopilotStateMachine_T autopilotStateMachineInput = {};
  ap_raw_laws_input autopilotStateMachineOutput;

  AutopilotLawsModelClass autopilotLaws;
  AutopilotLawsModelClass::ExternalInputs_AutopilotLaws_T autopilotLawsInput = {};
  ap_raw_output autopilotLawsOutput;

  AutothrustModelClass autoThrust;
  AutothrustModelClass::ExternalInputs_Autothrust_T autoThrustInput = {};
  athr_output autoThrustOutput;

  base_ra_bus raBusOutputs[2] = {};

  base_lgciu_bus lgciuBusOutputs[2] = {};

  base_sfcc_bus sfccBusOutputs[2] = {};

  base_fmgc_b_bus fmgcBBusOutputs = {};

  base_adr_bus adrBusOutputs[3] = {};
  base_ir_bus irBusOutputs[3] = {};

  Elac elacs[2] = {Elac(true), Elac(false)};
  base_elac_discrete_outputs elacsDiscreteOutputs[2] = {};
  base_elac_analog_outputs elacsAnalogOutputs[2] = {};
  base_elac_out_bus elacsBusOutputs[2] = {};

  Sec secs[3] = {Sec(true, false), Sec(false, false), Sec(false, true)};
  base_sec_discrete_outputs secsDiscreteOutputs[3] = {};
  base_sec_analog_outputs secsAnalogOutputs[3] = {};
  base_sec_out_bus secsBusOutputs[3] = {};

  Fcdc fcdcs[2] = {Fcdc(true), Fcdc(false)};
  FcdcDiscreteOutputs fcdcsDiscreteOutputs[2] = {};
  base_fcdc_bus fcdcsBusOutputs[2] = {};

  Fac facs[2] = {Fac(true), Fac(false)};
  base_fac_discrete_outputs facsDiscreteOutputs[2] = {};
  base_fac_analog_outputs facsAnalogOutputs[2] = {};
  base_fac_bus facsBusOutputs[2] = {};

  InterpolatingLookupTable throttleLookupTable;

  RadioReceiver radioReceiver;

  bool wasFcuInitialized = false;
  double simulationTimeReady = 0.0;
  std::unique_ptr<LocalVariable> idIsReady;
  std::unique_ptr<LocalVariable> idStartState;

  bool developmentLocalVariablesEnabled = false;
  bool useCalculatedLocalizerAndGlideSlope = false;
  std::unique_ptr<LocalVariable> idDevelopmentAutoland_condition_Flare;
  std::unique_ptr<LocalVariable> idDevelopmentAutoland_H_dot_c_fpm;
  std::unique_ptr<LocalVariable> idDevelopmentAutoland_delta_Theta_H_dot_deg;
  std::unique_ptr<LocalVariable> idDevelopmentAutoland_delta_Theta_bz_deg;
  std::unique_ptr<LocalVariable> idDevelopmentAutoland_delta_Theta_bx_deg;
  std::unique_ptr<LocalVariable> idDevelopmentAutoland_delta_Theta_beta_c_deg;

  std::unique_ptr<LocalVariable> idLoggingFlightControlsEnabled;
  std::unique_ptr<LocalVariable> idLoggingThrottlesEnabled;

  std::unique_ptr<LocalVariable> idMinimumSimulationRate;
  std::unique_ptr<LocalVariable> idMaximumSimulationRate;

  std::unique_ptr<LocalVariable> idPerformanceWarningActive;

  std::unique_ptr<LocalVariable> idTrackingMode;
  std::unique_ptr<LocalVariable> idExternalOverride;

  std::unique_ptr<LocalVariable> idFdrEvent;

  std::unique_ptr<LocalVariable> idSideStickPositionX;
  std::unique_ptr<LocalVariable> idSideStickPositionY;
  std::unique_ptr<LocalVariable> idRudderPedalPosition;
  std::unique_ptr<LocalVariable> idRudderPedalAnimationPosition;
  std::unique_ptr<LocalVariable> idAutopilotNosewheelDemand;

  std::unique_ptr<LocalVariable> idFmaLateralMode;
  std::unique_ptr<LocalVariable> idFmaLateralArmed;
  std::unique_ptr<LocalVariable> idFmaVerticalMode;
  std::unique_ptr<LocalVariable> idFmaVerticalArmed;
  std::unique_ptr<LocalVariable> idFmaSoftAltModeActive;
  std::unique_ptr<LocalVariable> idFmaCruiseAltModeActive;
  std::unique_ptr<LocalVariable> idFmaExpediteModeActive;
  std::unique_ptr<LocalVariable> idFmaSpeedProtectionActive;
  std::unique_ptr<LocalVariable> idFmaApproachCapability;
  std::unique_ptr<LocalVariable> idFmaTripleClick;
  std::unique_ptr<LocalVariable> idFmaModeReversion;

  std::unique_ptr<LocalVariable> idAutopilotTcasMessageDisarm;
  std::unique_ptr<LocalVariable> idAutopilotTcasMessageRaInhibited;
  std::unique_ptr<LocalVariable> idAutopilotTcasMessageTrkFpaDeselection;

  std::unique_ptr<LocalVariable> idFlightDirectorBank;
  std::unique_ptr<LocalVariable> idFlightDirectorPitch;
  std::unique_ptr<LocalVariable> idFlightDirectorYaw;

  std::unique_ptr<LocalVariable> idAutopilotAutolandWarning;

  std::unique_ptr<LocalVariable> idAutopilotActiveAny;
  std::unique_ptr<LocalVariable> idAutopilotActive_1;
  std::unique_ptr<LocalVariable> idAutopilotActive_2;

  std::unique_ptr<LocalVariable> idAutopilotAutothrustMode;

  std::unique_ptr<LocalVariable> idAutopilot_H_dot_radio;

  std::unique_ptr<LocalVariable> idFcuTrkFpaModeActive;
  std::unique_ptr<LocalVariable> idFcuSelectedFpa;
  std::unique_ptr<LocalVariable> idFcuSelectedVs;
  std::unique_ptr<LocalVariable> idFcuSelectedHeading;

  std::unique_ptr<LocalVariable> idFcuLocModeActive;
  std::unique_ptr<LocalVariable> idFcuApprModeActive;
  std::unique_ptr<LocalVariable> idFcuHeadingSync;
  std::unique_ptr<LocalVariable> idFcuModeReversionActive;
  std::unique_ptr<LocalVariable> idFcuModeReversionTrkFpaActive;
  std::unique_ptr<LocalVariable> idFcuModeReversionTargetFpm;

  std::unique_ptr<LocalVariable> idFlightGuidanceAvailable;
  std::unique_ptr<LocalVariable> idFlightGuidanceCrossTrackError;
  std::unique_ptr<LocalVariable> idFlightGuidanceTrackAngleError;
  std::unique_ptr<LocalVariable> idFlightGuidancePhiCommand;
  std::unique_ptr<LocalVariable> idFlightGuidancePhiLimit;
  std::unique_ptr<LocalVariable> idFlightGuidanceRequestedVerticalMode;
  std::unique_ptr<LocalVariable> idFlightGuidanceTargetAltitude;
  std::unique_ptr<LocalVariable> idFlightGuidanceTargetVerticalSpeed;
  std::unique_ptr<LocalVariable> idFmRnavAppSelected;
  std::unique_ptr<LocalVariable> idFmFinalCanEngage;

  std::unique_ptr<LocalVariable> idTcasFault;
  std::unique_ptr<LocalVariable> idTcasMode;
  std::unique_ptr<LocalVariable> idTcasTaOnly;
  std::unique_ptr<LocalVariable> idTcasState;
  std::unique_ptr<LocalVariable> idTcasRaCorrective;
  std::unique_ptr<LocalVariable> idTcasTargetGreenMin;
  std::unique_ptr<LocalVariable> idTcasTargetGreenMax;
  std::unique_ptr<LocalVariable> idTcasTargetRedMin;
  std::unique_ptr<LocalVariable> idTcasTargetRedMax;

  std::unique_ptr<LocalVariable> idFwcFlightPhase;
  std::unique_ptr<LocalVariable> idFmgcFlightPhase;
  std::unique_ptr<LocalVariable> idFmgcV2;
  std::unique_ptr<LocalVariable> idFmgcV_APP;
  std::unique_ptr<LocalVariable> idFmgcV_LS;
  std::unique_ptr<LocalVariable> idFmgcV_MAX;
  std::unique_ptr<LocalVariable> idFmgcAltitudeConstraint;
  std::unique_ptr<LocalVariable> idFmgcThrustReductionAltitude;
  std::unique_ptr<LocalVariable> idFmgcThrustReductionAltitudeGoAround;
  std::unique_ptr<LocalVariable> idFmgcAccelerationAltitude;
  std::unique_ptr<LocalVariable> idFmgcAccelerationAltitudeEngineOut;
  std::unique_ptr<LocalVariable> idFmgcAccelerationAltitudeGoAround;
  std::unique_ptr<LocalVariable> idFmgcAccelerationAltitudeGoAroundEngineOut;
  std::unique_ptr<LocalVariable> idFmgcCruiseAltitude;
  std::unique_ptr<LocalVariable> idFmgcFlexTemperature;
  std::unique_ptr<LocalVariable> idFmgcDirToTrigger;

  std::unique_ptr<LocalVariable> idAirConditioningPack_1;
  std::unique_ptr<LocalVariable> idAirConditioningPack_2;

  std::unique_ptr<LocalVariable> thrustLeverAngle_1;
  std::unique_ptr<LocalVariable> thrustLeverAngle_2;
  std::unique_ptr<LocalVariable> idAutothrustN1_TLA_1;
  std::unique_ptr<LocalVariable> idAutothrustN1_TLA_2;
  std::unique_ptr<LocalVariable> idAutothrustReverse_1;
  std::unique_ptr<LocalVariable> idAutothrustReverse_2;
  std::unique_ptr<LocalVariable> idAutothrustThrustLimitType;
  std::unique_ptr<LocalVariable> idAutothrustThrustLimit;
  std::unique_ptr<LocalVariable> idAutothrustThrustLimitREV;
  std::unique_ptr<LocalVariable> idAutothrustThrustLimitIDLE;
  std::unique_ptr<LocalVariable> idAutothrustThrustLimitCLB;
  std::unique_ptr<LocalVariable> idAutothrustThrustLimitMCT;
  std::unique_ptr<LocalVariable> idAutothrustThrustLimitFLX;
  std::unique_ptr<LocalVariable> idAutothrustThrustLimitTOGA;
  std::unique_ptr<LocalVariable> idAutothrustN1_c_1;
  std::unique_ptr<LocalVariable> idAutothrustN1_c_2;
  std::unique_ptr<LocalVariable> idAutothrustStatus;
  std::unique_ptr<LocalVariable> idAutothrustMode;
  std::unique_ptr<LocalVariable> idAutothrustModeMessage;
  std::unique_ptr<LocalVariable> idAutothrustDisabled;
  std::unique_ptr<LocalVariable> idAutothrustThrustLeverWarningFlex;
  std::unique_ptr<LocalVariable> idAutothrustThrustLeverWarningToga;
  std::unique_ptr<LocalVariable> idAutothrustDisconnect;
  std::unique_ptr<LocalVariable> idThrottlePosition3d_1;
  std::unique_ptr<LocalVariable> idThrottlePosition3d_2;
  InterpolatingLookupTable idThrottlePositionLookupTable3d;

  std::vector<std::shared_ptr<ThrottleAxisMapping>> throttleAxis;

  AdditionalData additionalData = {};
  std::unique_ptr<LocalVariable> idParkBrakeLeverPos;
  std::unique_ptr<LocalVariable> idBrakePedalLeftPos;
  std::unique_ptr<LocalVariable> idBrakePedalRightPos;
  std::unique_ptr<LocalVariable> idAutobrakeArmedMode;
  std::unique_ptr<LocalVariable> idAutobrakeDecelLight;
  std::unique_ptr<LocalVariable> idHydraulicGreenPressure;
  std::unique_ptr<LocalVariable> idHydraulicBluePressure;
  std::unique_ptr<LocalVariable> idHydraulicYellowPressure;
  std::unique_ptr<LocalVariable> idMasterWarning;
  std::unique_ptr<LocalVariable> idMasterCaution;

  EngineData engineData = {};
  std::unique_ptr<LocalVariable> engineEngine1N2;
  std::unique_ptr<LocalVariable> engineEngine2N2;
  std::unique_ptr<LocalVariable> engineEngine1N1;
  std::unique_ptr<LocalVariable> engineEngine2N1;
  std::unique_ptr<LocalVariable> engineEngineIdleN1;
  std::unique_ptr<LocalVariable> engineEngineIdleN2;
  std::unique_ptr<LocalVariable> engineEngineIdleFF;
  std::unique_ptr<LocalVariable> engineEngineIdleEGT;
  std::unique_ptr<LocalVariable> engineEngine1EGT;
  std::unique_ptr<LocalVariable> engineEngine2EGT;
  std::unique_ptr<LocalVariable> engineEngine1Oil;
  std::unique_ptr<LocalVariable> engineEngine2Oil;
  std::unique_ptr<LocalVariable> engineEngine1TotalOil;
  std::unique_ptr<LocalVariable> engineEngine2TotalOil;
  std::unique_ptr<LocalVariable> engineEngine1FF;
  std::unique_ptr<LocalVariable> engineEngine2FF;
  std::unique_ptr<LocalVariable> engineEngine1PreFF;
  std::unique_ptr<LocalVariable> engineEngine2PreFF;
  std::unique_ptr<LocalVariable> engineEngineImbalance;
  std::unique_ptr<LocalVariable> engineFuelUsedLeft;
  std::unique_ptr<LocalVariable> engineFuelUsedRight;
  std::unique_ptr<LocalVariable> engineFuelLeftPre;
  std::unique_ptr<LocalVariable> engineFuelRightPre;
  std::unique_ptr<LocalVariable> engineFuelAuxLeftPre;
  std::unique_ptr<LocalVariable> engineFuelAuxRightPre;
  std::unique_ptr<LocalVariable> engineFuelCenterPre;
  std::unique_ptr<LocalVariable> engineEngineCycleTime;
  std::unique_ptr<LocalVariable> engineEngine1State;
  std::unique_ptr<LocalVariable> engineEngine2State;
  std::unique_ptr<LocalVariable> engineEngine1Timer;
  std::unique_ptr<LocalVariable> engineEngine2Timer;

  std::unique_ptr<LocalVariable> idFlapsHandleIndex;
  std::unique_ptr<LocalVariable> idFlapsHandlePercent;

  std::unique_ptr<LocalVariable> flapsHandleIndexFlapConf;
  std::unique_ptr<LocalVariable> flapsPosition;

  std::unique_ptr<LocalVariable> idSpoilersArmed;
  std::unique_ptr<LocalVariable> idSpoilersHandlePosition;
  std::shared_ptr<SpoilersHandler> spoilersHandler;

  std::unique_ptr<LocalVariable> idRudderPosition;

  std::unique_ptr<LocalVariable> idRadioReceiverUsageEnabled;
  std::unique_ptr<LocalVariable> idRadioReceiverLocalizerValid;
  std::unique_ptr<LocalVariable> idRadioReceiverLocalizerDeviation;
  std::unique_ptr<LocalVariable> idRadioReceiverLocalizerDistance;
  std::unique_ptr<LocalVariable> idRadioReceiverGlideSlopeValid;
  std::unique_ptr<LocalVariable> idRadioReceiverGlideSlopeDeviation;

  std::unique_ptr<LocalVariable> idRealisticTillerEnabled;
  std::unique_ptr<LocalVariable> idTillerHandlePosition;
  std::unique_ptr<LocalVariable> idNoseWheelPosition;

  std::unique_ptr<LocalVariable> idSyncFoEfisEnabled;

  std::unique_ptr<LocalVariable> idLs1Active;
  std::unique_ptr<LocalVariable> idLs2Active;
  std::unique_ptr<LocalVariable> idIsisLsActive;

  std::unique_ptr<LocalVariable> idWingAntiIce;

  // RA bus inputs
  std::unique_ptr<LocalVariable> idRadioAltimeterHeight[2];

  // LGCIU inputs
  std::unique_ptr<LocalVariable> idLgciuNoseGearCompressed[2];
  std::unique_ptr<LocalVariable> idLgciuLeftMainGearCompressed[2];
  std::unique_ptr<LocalVariable> idLgciuRightMainGearCompressed[2];
  std::unique_ptr<LocalVariable> idLgciuDiscreteWord1[2];
  std::unique_ptr<LocalVariable> idLgciuDiscreteWord2[2];
  std::unique_ptr<LocalVariable> idLgciuDiscreteWord3[2];

  // SFCC inputs
  std::unique_ptr<LocalVariable> idSfccSlatFlapComponentStatusWord;
  std::unique_ptr<LocalVariable> idSfccSlatFlapSystemStatusWord;
  std::unique_ptr<LocalVariable> idSfccSlatFlapActualPositionWord;
  std::unique_ptr<LocalVariable> idSfccSlatActualPositionWord;
  std::unique_ptr<LocalVariable> idSfccFlapActualPositionWord;

  // ADR bus inputs
  std::unique_ptr<LocalVariable> idAdrAltitudeCorrected[3];
  std::unique_ptr<LocalVariable> idAdrMach[3];
  std::unique_ptr<LocalVariable> idAdrAirspeedComputed[3];
  std::unique_ptr<LocalVariable> idAdrAirspeedTrue[3];
  std::unique_ptr<LocalVariable> idAdrVerticalSpeed[3];
  std::unique_ptr<LocalVariable> idAdrAoaCorrected[3];
  std::unique_ptr<LocalVariable> idAdrCorrectedAverageStaticPressure[3];

  // IR bus inputs
  std::unique_ptr<LocalVariable> idIrLatitude[3];
  std::unique_ptr<LocalVariable> idIrLongitude[3];
  std::unique_ptr<LocalVariable> idIrGroundSpeed[3];
  std::unique_ptr<LocalVariable> idIrWindSpeed[3];
  std::unique_ptr<LocalVariable> idIrWindDirectionTrue[3];
  std::unique_ptr<LocalVariable> idIrTrackAngleMagnetic[3];
  std::unique_ptr<LocalVariable> idIrHeadingMagnetic[3];
  std::unique_ptr<LocalVariable> idIrDriftAngle[3];
  std::unique_ptr<LocalVariable> idIrFlightPathAngle[3];
  std::unique_ptr<LocalVariable> idIrPitchAngle[3];
  std::unique_ptr<LocalVariable> idIrRollAngle[3];
  std::unique_ptr<LocalVariable> idIrBodyPitchRate[3];
  std::unique_ptr<LocalVariable> idIrBodyRollRate[3];
  std::unique_ptr<LocalVariable> idIrBodyYawRate[3];
  std::unique_ptr<LocalVariable> idIrBodyLongAccel[3];
  std::unique_ptr<LocalVariable> idIrBodyLatAccel[3];
  std::unique_ptr<LocalVariable> idIrBodyNormalAccel[3];
  std::unique_ptr<LocalVariable> idIrTrackAngleRate[3];
  std::unique_ptr<LocalVariable> idIrPitchAttRate[3];
  std::unique_ptr<LocalVariable> idIrRollAttRate[3];
  std::unique_ptr<LocalVariable> idIrInertialVerticalSpeed[3];

  // FCDC bus label Lvars
  std::unique_ptr<LocalVariable> idFcdcDiscreteWord1[2];
  std::unique_ptr<LocalVariable> idFcdcDiscreteWord2[2];
  std::unique_ptr<LocalVariable> idFcdcDiscreteWord3[2];
  std::unique_ptr<LocalVariable> idFcdcDiscreteWord4[2];
  std::unique_ptr<LocalVariable> idFcdcDiscreteWord5[2];
  std::unique_ptr<LocalVariable> idFcdcCaptRollCommand[2];
  std::unique_ptr<LocalVariable> idFcdcFoRollCommand[2];
  std::unique_ptr<LocalVariable> idFcdcCaptPitchCommand[2];
  std::unique_ptr<LocalVariable> idFcdcFoPitchCommand[2];
  std::unique_ptr<LocalVariable> idFcdcRudderPedalPos[2];
  std::unique_ptr<LocalVariable> idFcdcAileronLeftPos[2];
  std::unique_ptr<LocalVariable> idFcdcElevatorLeftPos[2];
  std::unique_ptr<LocalVariable> idFcdcAileronRightPos[2];
  std::unique_ptr<LocalVariable> idFcdcElevatorRightPos[2];
  std::unique_ptr<LocalVariable> idFcdcElevatorTrimPos[2];
  std::unique_ptr<LocalVariable> idFcdcSpoilerLeft1Pos[2];
  std::unique_ptr<LocalVariable> idFcdcSpoilerLeft2Pos[2];
  std::unique_ptr<LocalVariable> idFcdcSpoilerLeft3Pos[2];
  std::unique_ptr<LocalVariable> idFcdcSpoilerLeft4Pos[2];
  std::unique_ptr<LocalVariable> idFcdcSpoilerLeft5Pos[2];
  std::unique_ptr<LocalVariable> idFcdcSpoilerRight1Pos[2];
  std::unique_ptr<LocalVariable> idFcdcSpoilerRight2Pos[2];
  std::unique_ptr<LocalVariable> idFcdcSpoilerRight3Pos[2];
  std::unique_ptr<LocalVariable> idFcdcSpoilerRight4Pos[2];
  std::unique_ptr<LocalVariable> idFcdcSpoilerRight5Pos[2];

  // FCDC discrete output Lvars
  std::unique_ptr<LocalVariable> idFcdcPriorityCaptGreen[2];
  std::unique_ptr<LocalVariable> idFcdcPriorityCaptRed[2];
  std::unique_ptr<LocalVariable> idFcdcPriorityFoGreen[2];
  std::unique_ptr<LocalVariable> idFcdcPriorityFoRed[2];

  // fault input Lvars
  std::unique_ptr<LocalVariable> idElevFaultLeft[2];
  std::unique_ptr<LocalVariable> idElevFaultRight[2];
  std::unique_ptr<LocalVariable> idAilFaultLeft[2];
  std::unique_ptr<LocalVariable> idAilFaultRight[2];
  std::unique_ptr<LocalVariable> idSplrFaultLeft[5];
  std::unique_ptr<LocalVariable> idSplrFaultRight[5];

  // THS Override Signal LVar
  std::unique_ptr<LocalVariable> idThsOverrideActive;

  // ELAC discrete input Lvars
  std::unique_ptr<LocalVariable> idElacPushbuttonPressed[2];

  // ELAC discrete output Lvars
  std::unique_ptr<LocalVariable> idElacDigitalOpValidated[2];

  // SEC discrete input Lvars
  std::unique_ptr<LocalVariable> idSecPushbuttonPressed[3];

  // SEC discrete output Lvars
  std::unique_ptr<LocalVariable> idSecFaultLightOn[3];
  std::unique_ptr<LocalVariable> idSecGroundSpoilersOut[3];

  // Flight controls solenoid valve energization Lvars
  std::unique_ptr<LocalVariable> idLeftAileronSolenoidEnergized[2];
  std::unique_ptr<LocalVariable> idLeftAileronCommandedPosition[2];
  std::unique_ptr<LocalVariable> idRightAileronSolenoidEnergized[2];
  std::unique_ptr<LocalVariable> idRightAileronCommandedPosition[2];
  std::unique_ptr<LocalVariable> idLeftSpoilerCommandedPosition[5];
  std::unique_ptr<LocalVariable> idRightSpoilerCommandedPosition[5];
  std::unique_ptr<LocalVariable> idLeftElevatorSolenoidEnergized[2];
  std::unique_ptr<LocalVariable> idLeftElevatorCommandedPosition[2];
  std::unique_ptr<LocalVariable> idRightElevatorSolenoidEnergized[2];
  std::unique_ptr<LocalVariable> idRightElevatorCommandedPosition[2];
  std::unique_ptr<LocalVariable> idTHSActiveModeCommanded[3];
  std::unique_ptr<LocalVariable> idTHSCommandedPosition[3];
  std::unique_ptr<LocalVariable> idYawDamperSolenoidEnergized[2];
  std::unique_ptr<LocalVariable> idYawDamperCommandedPosition[2];
  std::unique_ptr<LocalVariable> idRudderTrimActiveModeCommanded[2];
  std::unique_ptr<LocalVariable> idRudderTrimCommandedPosition[2];
  std::unique_ptr<LocalVariable> idRudderTravelLimitActiveModeCommanded[2];
  std::unique_ptr<LocalVariable> idRudderTravelLimCommandedPosition[2];

  // FAC discrete input Lvars
  std::unique_ptr<LocalVariable> idFacPushbuttonPressed[2];
  // FAC discrete output Lvars
  std::unique_ptr<LocalVariable> idFacHealthy[2];

  std::unique_ptr<LocalVariable> idFacDiscreteWord1[2];
  std::unique_ptr<LocalVariable> idFacGammaA[2];
  std::unique_ptr<LocalVariable> idFacGammaT[2];
  std::unique_ptr<LocalVariable> idFacWeight[2];
  std::unique_ptr<LocalVariable> idFacCenterOfGravity[2];
  std::unique_ptr<LocalVariable> idFacSideslipTarget[2];
  std::unique_ptr<LocalVariable> idFacSlatAngle[2];
  std::unique_ptr<LocalVariable> idFacFlapAngle[2];
  std::unique_ptr<LocalVariable> idFacDiscreteWord2[2];
  std::unique_ptr<LocalVariable> idFacRudderTravelLimitCommand[2];
  std::unique_ptr<LocalVariable> idFacDeltaRYawDamperVoted[2];
  std::unique_ptr<LocalVariable> idFacEstimatedSideslip[2];
  std::unique_ptr<LocalVariable> idFacVAlphaLim[2];
  std::unique_ptr<LocalVariable> idFacVLs[2];
  std::unique_ptr<LocalVariable> idFacVStall[2];
  std::unique_ptr<LocalVariable> idFacVAlphaProt[2];
  std::unique_ptr<LocalVariable> idFacVStallWarn[2];
  std::unique_ptr<LocalVariable> idFacSpeedTrend[2];
  std::unique_ptr<LocalVariable> idFacV3[2];
  std::unique_ptr<LocalVariable> idFacV4[2];
  std::unique_ptr<LocalVariable> idFacVMan[2];
  std::unique_ptr<LocalVariable> idFacVMax[2];
  std::unique_ptr<LocalVariable> idFacVFeNext[2];
  std::unique_ptr<LocalVariable> idFacDiscreteWord3[2];
  std::unique_ptr<LocalVariable> idFacDiscreteWord4[2];
  std::unique_ptr<LocalVariable> idFacDiscreteWord5[2];
  std::unique_ptr<LocalVariable> idFacDeltaRRudderTrim[2];
  std::unique_ptr<LocalVariable> idFacRudderTrimPos[2];

  std::unique_ptr<LocalVariable> idLeftAileronPosition;
  std::unique_ptr<LocalVariable> idRightAileronPosition;
  std::unique_ptr<LocalVariable> idLeftElevatorPosition;
  std::unique_ptr<LocalVariable> idRightElevatorPosition;
  std::unique_ptr<LocalVariable> idLeftSpoilerPosition[5];
  std::unique_ptr<LocalVariable> idRightSpoilerPosition[5];

  std::unique_ptr<LocalVariable> idElecDcBus2Powered;
  std::unique_ptr<LocalVariable> idElecDcEssShedBusPowered;
  std::unique_ptr<LocalVariable> idElecDcEssBusPowered;
  std::unique_ptr<LocalVariable> idElecBat1HotBusPowered;

  std::unique_ptr<LocalVariable> idHydYellowSystemPressure;
  std::unique_ptr<LocalVariable> idHydGreenSystemPressure;
  std::unique_ptr<LocalVariable> idHydBlueSystemPressure;
  std::unique_ptr<LocalVariable> idHydYellowPressurised;
  std::unique_ptr<LocalVariable> idHydGreenPressurised;
  std::unique_ptr<LocalVariable> idHydBluePressurised;

  std::unique_ptr<LocalVariable> idCaptPriorityButtonPressed;
  std::unique_ptr<LocalVariable> idFoPriorityButtonPressed;

  void loadConfiguration();
  void setupLocalVariables();

  bool handleFcuInitialization(double sampleTime);

  bool readDataAndLocalVariables(double sampleTime);

  bool updatePerformanceMonitoring(double sampleTime);
  bool handleSimulationRate(double sampleTime);

  bool updateRadioReceiver(double sampleTime);

  bool updateEngineData(double sampleTime);
  bool updateAdditionalData(double sampleTime);

  bool updateAutopilotStateMachine(double sampleTime);
  bool updateAutopilotLaws(double sampleTime);
  bool updateFlyByWire(double sampleTime);
  bool updateAutothrust(double sampleTime);

  bool updateRa(int raIndex);

  bool updateLgciu(int lgciuIndex);

  bool updateSfcc(int sfccIndex);

  bool updateAdirs(int adirsIndex);

  bool updateElac(double sampleTime, int elacIndex);

  bool updateSec(double sampleTime, int secIndex);

  bool updateFcdc(double sampleTime, int fcdcIndex);

  bool updateFac(double sampleTime, int facIndex);

  bool updateServoSolenoidStatus();

  bool updateSpoilers(double sampleTime);

  bool updateFoSide(double sampleTime);

  bool updateAltimeterSetting(double sampleTime);

  double getTcasModeAvailable();

  double getTcasAdvisoryState();
};
