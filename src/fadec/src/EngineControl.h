#pragma once

#include "RegPolynomials.h"
#include "SimVars.h"
#include "Tables.h"
#include "ThrustLimits.h"
#include "common.h"

#include "ini_type_conversion.h"

#define FILENAME_FADEC_CONF_DIRECTORY "\\work\\AircraftStates\\"
#define FILENAME_FADEC_CONF_FILE_EXTENSION ".ini"
#define CONFIGURATION_SECTION_FUEL "FUEL"

#define CONFIGURATION_SECTION_FUEL_CENTER_QUANTITY "FUEL_CENTER_QUANTITY"
#define CONFIGURATION_SECTION_FUEL_LEFT_QUANTITY "FUEL_LEFT_QUANTITY"
#define CONFIGURATION_SECTION_FUEL_RIGHT_QUANTITY "FUEL_RIGHT_QUANTITY"
#define CONFIGURATION_SECTION_FUEL_LEFT_AUX_QUANTITY "FUEL_LEFT_AUX_QUANTITY"
#define CONFIGURATION_SECTION_FUEL_RIGHT_AUX_QUANTITY "FUEL_RIGHT_AUX_QUANTITY"

/* Values in gallons */
struct Configuration {
  double fuelCenter = 0;
  double fuelLeft = 400;
  double fuelRight = fuelLeft;
  double fuelLeftAux = 228;
  double fuelRightAux = fuelLeftAux;
};

class EngineControl {
 private:
  SimVars* simVars;
  EngineRatios* ratios;
  Polynomial* poly;
  Timer timerLeft;
  Timer timerRight;
  Timer timerFuel;

  std::string confFilename = FILENAME_FADEC_CONF_DIRECTORY;

  bool simPaused;
  double animationDeltaTime;
  double timer;
  double ambientTemp;
  double ambientPressure;
  double simOnGround;
  double devState;

  int engine;
  int egtImbalance;
  int ffImbalance;
  int n2Imbalance;
  double engineState;
  double engineStarter;
  double engineIgniter;

  double packs;
  double nai;
  double wai;

  double simCN1;
  double simN1;
  double simN2;
  double thrust;
  double simN2LeftPre;
  double simN2RightPre;
  double deltaN2;
  double thermalEnergy1;
  double thermalEnergy2;
  double oilTemperature;
  double oilTemperatureLeftPre;
  double oilTemperatureRightPre;
  double oilTemperatureMax;
  double idleN1;
  double idleN2;
  double idleFF;
  double idleEGT;
  double idleOil;
  double mach;
  double pressAltitude;
  double correctedEGT;
  double correctedFuelFlow;
  double cFbwFF;
  double imbalance;
  int engineImbalanced;
  double paramImbalance;

  const double LBS_TO_KGS = 0.4535934;
  const double KGS_TO_LBS = 1 / 0.4535934;
  const double FUEL_THRESHOLD = 661;  // lbs/sec

  bool isFlexActive = false;
  double prevThrustLimitType = 0;
  double prevFlexTemperature = 0;

  const double waitTime = 10;
  const double transitionTime = 30;

  bool isTransitionActive = false;
  double transitionFactor = 0;
  double transitionStartTime = 0;

  /// <summary>
  /// Generate Idle/ Initial Engine Parameters (non-imbalanced)
  /// </summary>
  void generateIdleParameters(double pressAltitude, double mach, double ambientTemp, double ambientPressure) {
    double idleCN1;
    double idleCFF;

    idleCN1 = iCN1(pressAltitude, mach, ambientTemp);
    idleN1 = idleCN1 * sqrt(ratios->theta2(0, ambientTemp));
    idleN2 = iCN2(pressAltitude, mach) * sqrt(ratios->theta(ambientTemp));
    idleCFF = poly->correctedFuelFlow(idleCN1, 0, pressAltitude);                                               // lbs/hr
    idleFF = idleCFF * LBS_TO_KGS * ratios->delta2(0, ambientPressure) * sqrt(ratios->theta2(0, ambientTemp));  // Kg/hr
    idleEGT = poly->correctedEGT(idleCN1, idleCFF, 0, pressAltitude) * ratios->theta2(0, ambientTemp);

    simVars->setEngineIdleN1(idleN1);
    simVars->setEngineIdleN2(idleN2);
    simVars->setEngineIdleFF(idleFF);
    simVars->setEngineIdleEGT(idleEGT);
  }

  double initOil(int minOil, int maxOil) {
    double idleOil = (rand() % (maxOil - minOil + 1) + minOil) / 10;
    return idleOil;
  }

  /// <summary>
  /// Engine imbalance Coded Digital Word:
  /// 0 - Engine, 00 - EGT, 00 - FuelFlow, 00 - N2, 00 - Oil Qty, 00 - Oil PSI, 00 - Oil PSI Rnd, 00 - Oil Max Temp
  /// Generates a random engine imbalance. Next steps: make realistic imbalance due to wear
  /// </summary>
  void generateEngineImbalance(int initial) {
    int oilQtyImbalance;
    int oilPressureImbalance;
    int oilPressureIdle;
    int oilTemperatureMax;
    std::string imbalanceCode;

    if (initial == 1) {
      // Decide Engine with imbalance
      if ((rand() % 100) + 1 < 50) {
        engine = 1;
      } else {
        engine = 2;
      }
      // Obtain EGT imbalance (Max 20 degree C)
      egtImbalance = (rand() % 20) + 1;

      // Obtain FF imbalance (Max 36 Kg/h)
      ffImbalance = (rand() % 36) + 1;

      // Obtain N2 imbalance (Max 0.3%)
      n2Imbalance = (rand() % 30) + 1;

      // Obtain Oil Qty imbalance (Max 2.0 qt)
      oilQtyImbalance = (rand() % 20) + 1;

      // Obtain Oil Pressure imbalance (Max 3.0 PSI)
      oilPressureImbalance = (rand() % 30) + 1;

      // Obtain Oil Pressure Random Idle (-6 to +6 PSI)
      oilPressureIdle = (rand() % 12) + 1;

      // Obtain Oil Temperature (85 to 95 Celsius)
      oilTemperatureMax = (rand() % 10) + 86;

      // Zero Padding and Merging
      imbalanceCode = to_string_with_zero_padding(engine, 2) + to_string_with_zero_padding(egtImbalance, 2) +
                      to_string_with_zero_padding(ffImbalance, 2) + to_string_with_zero_padding(n2Imbalance, 2) +
                      to_string_with_zero_padding(oilQtyImbalance, 2) + to_string_with_zero_padding(oilPressureImbalance, 2) +
                      to_string_with_zero_padding(oilPressureIdle, 2) + to_string_with_zero_padding(oilTemperatureMax, 2);

      simVars->setEngineImbalance(stod(imbalanceCode));
    }
  }

  /// <summary>
  /// Engine State Machine
  /// 0 - Engine OFF, 1 - Engine ON, 2 - Engine Starting, 3 - Engine Re-starting & 4 - Engine Shutting
  /// </summary>
  void engineStateMachine(int engine,
                          double engineIgniter,
                          double engineStarter,
                          double simN2,
                          double idleN2,
                          double pressAltitude,
                          double ambientTemp,
                          double deltaTimeDiff) {
    int resetTimer = 0;
    double egtFbw = 0;

    switch (engine) {
      case 1:
        engineState = simVars->getEngine1State();
        egtFbw = simVars->getEngine1EGT();
        break;
      case 2:
        engineState = simVars->getEngine2State();
        egtFbw = simVars->getEngine2EGT();
        break;
    }
    // Present State PAUSED
    if (deltaTimeDiff == 0 && engineState < 10) {
      engineState = engineState + 10;
      simPaused = true;
    } else if (deltaTimeDiff == 0 && engineState >= 10) {
      engineState = engineState;
      simPaused = true;
    } else {
      simPaused = false;

      // Present State OFF
      if (engineState == 0 || engineState == 10) {
        if (engineIgniter == 1 && engineStarter == 1 && simN2 > 20) {
          engineState = 1;
        } else if (engineIgniter == 2 && engineStarter == 1) {
          engineState = 2;
        } else {
          engineState = 0;
        }
      }

      // Present State ON
      if (engineState == 1 || engineState == 11) {
        if (engineStarter == 1) {
          engineState = 1;
        } else {
          engineState = 4;
        }
      }

      // Present State Starting.
      if (engineState == 2 || engineState == 12) {
        if (engineStarter == 1 && simN2 >= (idleN2 - 0.1)) {
          engineState = 1;
          resetTimer = 1;
        } else if (engineStarter == 0) {
          engineState = 4;
          resetTimer = 1;
        } else {
          engineState = 2;
        }
      }

      // Present State Re-Starting.
      if (engineState == 3 || engineState == 13) {
        if (engineStarter == 1 && simN2 >= (idleN2 - 0.1)) {
          engineState = 1;
          resetTimer = 1;
        } else if (engineStarter == 0) {
          engineState = 4;
          resetTimer = 1;
        } else {
          engineState = 3;
        }
      }

      // Present State Shutting
      if (engineState == 4 || engineState == 14) {
        if (engineIgniter == 2 && engineStarter == 1) {
          engineState = 3;
          resetTimer = 1;
        } else if (engineStarter == 0 && simN2 < 0.05 && egtFbw <= ambientTemp) {
          engineState = 0;
          resetTimer = 1;
        } else if (engineStarter == 1 && simN2 > 50) {
          engineState = 3;
          resetTimer = 1;
        } else {
          engineState = 4;
        }
      }
    }

    switch (engine) {
      case 1:
        simVars->setEngine1State(engineState);
        if (resetTimer == 1) {
          simVars->setEngine1Timer(0);
        }
        break;
      case 2:
        simVars->setEngine2State(engineState);
        if (resetTimer == 1) {
          simVars->setEngine2Timer(0);
        }
        break;
    }
  }

  /// <summary>
  /// Engine Start Procedure
  /// </summary>TIT
  void engineStartProcedure(int engine,
                            double engineState,
                            double imbalance,
                            double deltaTime,
                            double timer,
                            double simN2,
                            double pressAltitude,
                            double ambientTemp) {
    double startCN2Left;
    double startCN2Right;
    double preN2Fbw;
    double newN2Fbw;
    double preEgtFbw;
    double startEgtFbw;
    double shutdownEgtFbw;

    n2Imbalance = 0;
    ffImbalance = 0;
    egtImbalance = 0;
    idleN2 = simVars->getEngineIdleN2();
    idleN1 = simVars->getEngineIdleN1();
    idleFF = simVars->getEngineIdleFF();
    idleEGT = simVars->getEngineIdleEGT();

    // Engine imbalance
    engineImbalanced = imbalanceExtractor(imbalance, 1);

    // Checking engine imbalance
    if (engineImbalanced == engine) {
      ffImbalance = imbalanceExtractor(imbalance, 3);
      egtImbalance = imbalanceExtractor(imbalance, 2);
      n2Imbalance = imbalanceExtractor(imbalance, 4) / 100;
    }

    if (engine == 1) {
      // Delay between Engine Master ON and Start Valve Open
      if (timer < 1.7) {
        if (simOnGround == 1) {
          simVars->setFuelUsedLeft(0);
        }
        simVars->setEngine1Timer(timer + deltaTime);
        startCN2Left = 0;
        SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::StartCN2Left, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double),
                                      &startCN2Left);
      } else {
        preN2Fbw = simVars->getEngine1N2();
        preEgtFbw = simVars->getEngine1EGT();
        newN2Fbw = poly->startN2(simN2, preN2Fbw, idleN2 - n2Imbalance);
        startEgtFbw = poly->startEGT(newN2Fbw, idleN2 - n2Imbalance, ambientTemp, idleEGT - egtImbalance);
        shutdownEgtFbw = poly->shutdownEGT(preEgtFbw, ambientTemp, deltaTime);

        simVars->setEngine1N2(newN2Fbw);
        simVars->setEngine1N1(poly->startN1(newN2Fbw, idleN2 - n2Imbalance, idleN1));
        simVars->setEngine1FF(poly->startFF(newN2Fbw, idleN2 - n2Imbalance, idleFF - ffImbalance));

        if (engineState == 3) {
          if (abs(startEgtFbw - preEgtFbw) <= 1.5) {
            simVars->setEngine1EGT(startEgtFbw);
            simVars->setEngine1State(2);
          } else if (startEgtFbw > preEgtFbw) {
            simVars->setEngine1EGT(preEgtFbw + (0.75 * deltaTime * (idleN2 - newN2Fbw)));
          } else {
            simVars->setEngine1EGT(shutdownEgtFbw);
          }
        } else {
          simVars->setEngine1EGT(startEgtFbw);
        }

        oilTemperature = poly->startOilTemp(newN2Fbw, idleN2, ambientTemp);
        oilTemperatureLeftPre = oilTemperature;
        SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::OilTempLeft, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double),
                                      &oilTemperature);
      }
    } else {
      if (timer < 1.7) {
        if (simOnGround == 1) {
          simVars->setFuelUsedRight(0);
        }
        simVars->setEngine2Timer(timer + deltaTime);
        startCN2Right = 0;
        SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::StartCN2Right, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double),
                                      &startCN2Right);
      } else {
        preN2Fbw = simVars->getEngine2N2();
        preEgtFbw = simVars->getEngine2EGT();
        newN2Fbw = poly->startN2(simN2, preN2Fbw, idleN2 - n2Imbalance);
        startEgtFbw = poly->startEGT(newN2Fbw, idleN2 - n2Imbalance, ambientTemp, idleEGT - egtImbalance);
        shutdownEgtFbw = poly->shutdownEGT(preEgtFbw, ambientTemp, deltaTime);

        simVars->setEngine2N2(newN2Fbw);
        simVars->setEngine2N1(poly->startN1(newN2Fbw, idleN2 - n2Imbalance, idleN1));
        simVars->setEngine2FF(poly->startFF(newN2Fbw, idleN2 - n2Imbalance, idleFF - ffImbalance));

        if (engineState == 3) {
          if (abs(startEgtFbw - preEgtFbw) <= 1.5) {
            simVars->setEngine2EGT(startEgtFbw);
            simVars->setEngine2State(2);
          } else if (startEgtFbw > preEgtFbw) {
            simVars->setEngine2EGT(preEgtFbw + (0.75 * deltaTime * (idleN2 - newN2Fbw)));
          } else {
            simVars->setEngine2EGT(shutdownEgtFbw);
          }
        } else {
          simVars->setEngine2EGT(startEgtFbw);
        }

        oilTemperature = poly->startOilTemp(newN2Fbw, idleN2, ambientTemp);
        oilTemperatureRightPre = oilTemperature;
        SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::OilTempRight, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double),
                                      &oilTemperature);
      }
    }
  }

  /// <summary>
  /// Engine Shutdown Procedure - TEMPORAL SOLUTION
  /// </summary>
  void engineShutdownProcedure(int engine, double ambientTemp, double simN1, double deltaTime, double timer) {
    double preN1Fbw;
    double preN2Fbw;
    double preEgtFbw;
    double newN1Fbw;
    double newN2Fbw;
    double newEgtFbw;

    if (engine == 1) {
      if (timer < 1.8) {
        simVars->setEngine1Timer(timer + deltaTime);
      } else {
        preN1Fbw = simVars->getEngine1N1();
        preN2Fbw = simVars->getEngine1N2();
        preEgtFbw = simVars->getEngine1EGT();
        newN1Fbw = poly->shutdownN1(preN1Fbw, deltaTime);
        if (simN1 < 5 && simN1 > newN1Fbw) {  // Takes care of windmilling
          newN1Fbw = simN1;
        }
        newN2Fbw = poly->shutdownN2(preN2Fbw, deltaTime);
        newEgtFbw = poly->shutdownEGT(preEgtFbw, ambientTemp, deltaTime);
        simVars->setEngine1N1(newN1Fbw);
        simVars->setEngine1N2(newN2Fbw);
        simVars->setEngine1EGT(newEgtFbw);
      }

    } else {
      if (timer < 1.8) {
        simVars->setEngine2Timer(timer + deltaTime);
      } else {
        preN1Fbw = simVars->getEngine2N1();
        preN2Fbw = simVars->getEngine2N2();
        preEgtFbw = simVars->getEngine2EGT();
        newN1Fbw = poly->shutdownN1(preN1Fbw, deltaTime);
        if (simN1 < 5 && simN1 > newN1Fbw) {  // Takes care of windmilling
          newN1Fbw = simN1;
        }
        newN2Fbw = poly->shutdownN2(preN2Fbw, deltaTime);
        newEgtFbw = poly->shutdownEGT(preEgtFbw, ambientTemp, deltaTime);
        simVars->setEngine2N1(newN1Fbw);
        simVars->setEngine2N2(newN2Fbw);
        simVars->setEngine2EGT(newEgtFbw);
      }
    }
  }
  /// <summary>
  /// FBW Engine RPM (N1 and N2)
  /// Updates Engine N1 and N2 with our own algorithm for start-up and shutdown
  /// </summary>
  void updatePrimaryParameters(int engine, double imbalance, double simN1, double simN2) {
    // Engine imbalance
    engineImbalanced = imbalanceExtractor(imbalance, 1);
    paramImbalance = imbalanceExtractor(imbalance, 4) / 100;

    // Checking engine imbalance
    if (engineImbalanced != engine) {
      paramImbalance = 0;
    }

    if (engine == 1) {
      simVars->setEngine1N1(simN1);
      simVars->setEngine1N2(simN2 - paramImbalance);
    } else {
      simVars->setEngine2N1(simN1);
      simVars->setEngine2N2(simN2 - paramImbalance);
    }
  }

  /// <summary>
  /// FBW Exhaust Gas Temperature (in degree Celsius)
  /// Updates EGT with realistic values visualized in the ECAM
  /// </summary>
  void updateEGT(int engine,
                 double imbalance,
                 double deltaTime,
                 double simOnGround,
                 double engineState,
                 double simCN1,
                 double cFbwFF,
                 double mach,
                 double pressAltitude,
                 double ambientTemp) {
    double egtFbwPreviousEng1;
    double egtFbwActualEng1;
    double egtFbwPreviousEng2;
    double egtFbwActualEng2;

    // Engine imbalance timer
    engineImbalanced = imbalanceExtractor(imbalance, 1);
    paramImbalance = imbalanceExtractor(imbalance, 2);

    correctedEGT = poly->correctedEGT(simCN1, cFbwFF, mach, pressAltitude);

    // Checking engine imbalance
    if (engineImbalanced != engine) {
      paramImbalance = 0;
    }

    if (engine == 1) {
      if (simOnGround == 1 && engineState == 0) {
        simVars->setEngine1EGT(ambientTemp);
      } else {
        egtFbwPreviousEng1 = simVars->getEngine1EGT();
        egtFbwActualEng1 = (correctedEGT * ratios->theta2(mach, ambientTemp)) - paramImbalance;
        egtFbwActualEng1 = egtFbwActualEng1 + (egtFbwPreviousEng1 - egtFbwActualEng1) * expFBW(-0.1 * deltaTime);
        simVars->setEngine1EGT(egtFbwActualEng1);
      }
    } else {
      if (simOnGround == 1 && engineState == 0) {
        simVars->setEngine2EGT(ambientTemp);
      } else {
        egtFbwPreviousEng2 = simVars->getEngine2EGT();
        egtFbwActualEng2 = (correctedEGT * ratios->theta2(mach, ambientTemp)) - paramImbalance;
        egtFbwActualEng2 = egtFbwActualEng2 + (egtFbwPreviousEng2 - egtFbwActualEng2) * expFBW(-0.1 * deltaTime);
        simVars->setEngine2EGT(egtFbwActualEng2);
      }
    }
  }

  /// <summary>
  /// FBW Fuel FLow (in Kg/h)
  /// Updates Fuel Flow with realistic values
  /// </summary>
  double
  updateFF(int engine, double imbalance, double simCN1, double mach, double pressAltitude, double ambientTemp, double ambientPressure) {
    double outFlow = 0;

    // Engine imbalance
    engineImbalanced = imbalanceExtractor(imbalance, 1);
    paramImbalance = imbalanceExtractor(imbalance, 3);

    correctedFuelFlow = poly->correctedFuelFlow(simCN1, mach, pressAltitude);  // in lbs/hr.

    // Checking engine imbalance
    if (engineImbalanced != engine || correctedFuelFlow < 1) {
      paramImbalance = 0;
    }

    // Checking Fuel Logic and final Fuel Flow
    if (correctedFuelFlow < 1) {
      outFlow = 0;
    } else {
      outFlow = (correctedFuelFlow * LBS_TO_KGS * ratios->delta2(mach, ambientPressure) * sqrt(ratios->theta2(mach, ambientTemp))) -
                paramImbalance;
    }

    if (engine == 1) {
      simVars->setEngine1FF(outFlow);
    } else {
      simVars->setEngine2FF(outFlow);
    }

    return correctedFuelFlow;
  }

  /// <summary>
  /// FBW Oil Qty, Pressure and Temperature (in Quarts, PSI and degree Celsius)
  /// Updates Oil with realistic values visualized in the SD
  /// </summary>
  void updateOil(int engine, double imbalance, double thrust, double simN2, double deltaN2, double deltaTime, double ambientTemp) {
    double steadyTemperature;
    double thermalEnergy;
    double oilTemperaturePre;
    double oilQtyActual;
    double oilTotalActual;
    double oilQtyObjective;
    double oilBurn;
    double oilIdleRandom;
    double oilPressure;

    //--------------------------------------------
    // Engine Reading
    //--------------------------------------------
    if (engine == 1) {
      steadyTemperature = simVars->getEngine1EGT();
      thermalEnergy = thermalEnergy1;
      oilTemperaturePre = oilTemperatureLeftPre;
      oilQtyActual = simVars->getEngine1Oil();
      oilTotalActual = simVars->getEngine1TotalOil();
    } else {
      steadyTemperature = simVars->getEngine2EGT();
      thermalEnergy = thermalEnergy2;
      oilTemperaturePre = oilTemperatureRightPre;
      oilQtyActual = simVars->getEngine2Oil();
      oilTotalActual = simVars->getEngine2TotalOil();
    }

    //--------------------------------------------
    // Oil Temperature
    //--------------------------------------------
    if (simOnGround == 1 && engineState == 0 && ambientTemp > oilTemperaturePre - 10) {
      oilTemperature = ambientTemp;
    } else {
      if (steadyTemperature > oilTemperatureMax) {
        steadyTemperature = oilTemperatureMax;
      }
      thermalEnergy = (0.995 * thermalEnergy) + (deltaN2 / deltaTime);
      oilTemperature = poly->oilTemperature(thermalEnergy, oilTemperaturePre, steadyTemperature, deltaTime);
    }

    //--------------------------------------------
    // Oil Quantity
    //--------------------------------------------
    // Calculating Oil Qty as a function of thrust
    oilQtyObjective = oilTotalActual * (1 - poly->oilGulpPct(thrust));
    oilQtyActual = oilQtyActual - (oilTemperature - oilTemperaturePre);

    // Oil burnt taken into account for tank and total oil
    oilBurn = (0.00011111 * deltaTime);
    oilQtyActual = oilQtyActual - oilBurn;
    oilTotalActual = oilTotalActual - oilBurn;

    //--------------------------------------------
    // Oil Pressure
    //--------------------------------------------
    // Engine imbalance
    engineImbalanced = imbalanceExtractor(imbalance, 1);
    paramImbalance = imbalanceExtractor(imbalance, 6) / 10;
    oilIdleRandom = imbalanceExtractor(imbalance, 7) - 6;

    // Checking engine imbalance
    if (engineImbalanced != engine) {
      paramImbalance = 0;
    }

    oilPressure = poly->oilPressure(simN2) - paramImbalance + oilIdleRandom;

    //--------------------------------------------
    // Engine Writing
    //--------------------------------------------
    if (engine == 1) {
      thermalEnergy1 = thermalEnergy;
      oilTemperatureLeftPre = oilTemperature;
      simVars->setEngine1Oil(oilQtyActual);
      simVars->setEngine1TotalOil(oilTotalActual);
      SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::OilTempLeft, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double),
                                    &oilTemperature);
      SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::OilPsiLeft, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double), &oilPressure);
    } else {
      thermalEnergy2 = thermalEnergy;
      oilTemperatureRightPre = oilTemperature;
      simVars->setEngine2Oil(oilQtyActual);
      simVars->setEngine2TotalOil(oilTotalActual);
      SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::OilTempRight, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double),
                                    &oilTemperature);
      SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::OilPsiRight, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double), &oilPressure);
    }
  }

  /// <summary>
  /// FBW Payload checking and UI override function
  /// </summary>
  void checkPayload() {
    double fuelWeightGallon = simVars->getFuelWeightGallon();
    double aircraftEmptyWeight = simVars->getEmptyWeight();                                   // in LBS
    double conversionFactor = simVars->getConversionFactor();
    double perPaxWeightLbs = simVars->getPerPaxWeight() / conversionFactor;                   // in LBS
    double aircraftTotalWeight = simVars->getTotalWeight();                                   // in LBS
    double fuelTotalWeight = simVars->getFuelTotalQuantity() * fuelWeightGallon;              // in LBS
    double payloadTotalWeight = aircraftTotalWeight - aircraftEmptyWeight - fuelTotalWeight;  // in LBS

    double paxRows1to6Actual = simVars->getPaxRows1to6Actual() * perPaxWeightLbs;                 // in LBS
    double paxRows7to13Actual = simVars->getPaxRows7to13Actual() * perPaxWeightLbs;               // in LBS
    double paxRows14to21Actual = simVars->getPaxRows14to21Actual() * perPaxWeightLbs;             // in LBS
    double paxRows22to29Actual = simVars->getPaxRows22to29Actual() * perPaxWeightLbs;             // in LBS
    double paxRows1to6Desired = simVars->getPaxRows1to6Desired() * perPaxWeightLbs;               // in LBS
    double paxRows7to13Desired = simVars->getPaxRows7to13Desired() * perPaxWeightLbs;             // in LBS
    double paxRows14to21Desired = simVars->getPaxRows14to21Desired() * perPaxWeightLbs;           // in LBS
    double paxRows22to29Desired = simVars->getPaxRows22to29Desired() * perPaxWeightLbs;           // in LBS
    double cargoFwdContainerActual = simVars->getCargoFwdContainerActual() / conversionFactor;    // in LBS
    double cargoAftContainerActual = simVars->getCargoAftContainerActual() / conversionFactor;    // in LBS
    double cargoAftBaggageActual = simVars->getCargoAftBaggageActual() / conversionFactor;        // in LBS
    double cargoAftBulkActual = simVars->getCargoAftBulkActual() / conversionFactor;              // in LBS
    double cargoFwdContainerDesired = simVars->getCargoFwdContainerDesired() / conversionFactor;  // in LBS
    double cargoAftContainerDesired = simVars->getCargoAftContainerDesired() / conversionFactor;  // in LBS
    double cargoAftBaggageDesired = simVars->getCargoAftBaggageDesired() / conversionFactor;      // in LBS
    double cargoAftBulkDesired = simVars->getCargoAftBulkDesired() / conversionFactor;            // in LBS
    double paxTotalWeightActual = (paxRows1to6Actual + paxRows7to13Actual + paxRows14to21Actual + paxRows22to29Actual);
    double paxTotalWeightDesired = (paxRows1to6Desired + paxRows7to13Desired + paxRows14to21Desired + paxRows22to29Desired);
    double cargoTotalWeightActual = (cargoFwdContainerActual + cargoAftContainerActual + cargoAftBaggageActual + cargoAftBulkActual);
    double cargoTotalWeightDesired = (cargoFwdContainerDesired + cargoAftContainerDesired + cargoAftBaggageDesired + cargoAftBulkDesired);

    if (abs(payloadTotalWeight - paxTotalWeightActual + cargoTotalWeightActual) > 5) {
      SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::PayloadStation1, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double),
                                    &paxRows1to6Actual);
      SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::PayloadStation2, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double),
                                    &paxRows7to13Actual);
      SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::PayloadStation3, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double),
                                    &paxRows14to21Actual);
      SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::PayloadStation4, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double),
                                    &paxRows22to29Actual);
      SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::PayloadStation5, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double),
                                    &cargoFwdContainerActual);
      SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::PayloadStation6, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double),
                                    &cargoAftContainerActual);
      SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::PayloadStation7, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double),
                                    &cargoAftBaggageActual);
      SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::PayloadStation8, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double),
                                    &cargoAftBulkActual);
    }
  }

  /// <summary>
  /// FBW Fuel Consumption and Tankering
  /// Updates Fuel Consumption with realistic values
  /// </summary>
  void updateFuel(double deltaTime) {
    double m = 0;
    double b = 0;
    double fuelBurn1 = 0;
    double fuelBurn2 = 0;

    double refuelRate = simVars->getRefuelRate();
    double refuelStartedByUser = simVars->getRefuelStartedByUser();
    bool uiFuelTamper = false;
    double pumpStateLeft = simVars->getPumpStateLeft();
    double pumpStateRight = simVars->getPumpStateRight();

    double engine1PreFF = simVars->getEngine1PreFF();  // KG/H
    double engine2PreFF = simVars->getEngine2PreFF();  // KG/H
    double engine1FF = simVars->getEngine1FF();        // KG/H
    double engine2FF = simVars->getEngine2FF();        // KG/H

    double fuelWeightGallon = simVars->getFuelWeightGallon();
    double fuelUsedLeft = simVars->getFuelUsedLeft();    // Kg
    double fuelUsedRight = simVars->getFuelUsedRight();  // Kg

    double fuelLeftPre = simVars->getFuelLeftPre();                                   // LBS
    double fuelRightPre = simVars->getFuelRightPre();                                 // LBS
    double fuelAuxLeftPre = simVars->getFuelAuxLeftPre();                             // LBS
    double fuelAuxRightPre = simVars->getFuelAuxRightPre();                           // LBS
    double fuelCenterPre = simVars->getFuelCenterPre();                               // LBS
    double leftQuantity = simVars->getTankLeftQuantity() * fuelWeightGallon;          // LBS
    double rightQuantity = simVars->getTankRightQuantity() * fuelWeightGallon;        // LBS
    double leftAuxQuantity = simVars->getTankLeftAuxQuantity() * fuelWeightGallon;    // LBS
    double rightAuxQuantity = simVars->getTankRightAuxQuantity() * fuelWeightGallon;  // LBS
    double centerQuantity = simVars->getTankCenterQuantity() * fuelWeightGallon;      // LBS
    double fuelLeft = 0;                                                              // LBS
    double fuelRight = 0;
    double fuelLeftAux = 0;
    double fuelRightAux = 0;
    double fuelCenter = 0;
    double xfrCenter = 0;
    double xfrAuxLeft = 0;
    double xfrAuxRight = 0;
    double fuelTotalActual = leftQuantity + rightQuantity + leftAuxQuantity + rightAuxQuantity + centerQuantity;  // LBS
    double fuelTotalPre = fuelLeftPre + fuelRightPre + fuelAuxLeftPre + fuelAuxRightPre + fuelCenterPre;          // LBS
    double deltaFuelRate = abs(fuelTotalActual - fuelTotalPre) / (fuelWeightGallon * deltaTime);                  // LBS/ sec

    double engine1State = simVars->getEngine1State();
    double engine2State = simVars->getEngine2State();

    // Check Development State for UI
    devState = simVars->getDeveloperState();

    deltaTime = deltaTime / 3600;

    // Pump State Logic for Left Wing
    if (pumpStateLeft == 0 && (timerLeft.elapsed() == 0 || timerLeft.elapsed() >= 1000)) {
      if (fuelLeftPre - leftQuantity > 0 && leftQuantity == 0) {
        timerLeft.reset();
        simVars->setPumpStateLeft(1);
      } else if (fuelLeftPre == 0 && leftQuantity - fuelLeftPre > 0) {
        timerLeft.reset();
        simVars->setPumpStateLeft(2);
      } else {
        simVars->setPumpStateLeft(0);
      }
    } else if (pumpStateLeft == 1 && timerLeft.elapsed() >= 2100) {
      simVars->setPumpStateLeft(0);
      fuelLeftPre = 0;
      timerLeft.reset();
    } else if (pumpStateLeft == 2 && timerLeft.elapsed() >= 2700) {
      simVars->setPumpStateLeft(0);
      timerLeft.reset();
    }

    // Pump State Logic for Right Wing
    if (pumpStateRight == 0 && (timerRight.elapsed() == 0 || timerRight.elapsed() >= 1000)) {
      if (fuelRightPre - rightQuantity > 0 && rightQuantity == 0) {
        timerRight.reset();
        simVars->setPumpStateRight(1);
      } else if (fuelRightPre == 0 && rightQuantity - fuelRightPre > 0) {
        timerRight.reset();
        simVars->setPumpStateRight(2);
      } else {
        simVars->setPumpStateRight(0);
      }
    } else if (pumpStateRight == 1 && timerRight.elapsed() >= 2100) {
      simVars->setPumpStateRight(0);
      fuelRightPre = 0;
      timerRight.reset();
    } else if (pumpStateRight == 2 && timerRight.elapsed() >= 2700) {
      simVars->setPumpStateRight(0);
      timerRight.reset();
    }

    // Checking for in-game UI Fuel tampering
    if ((refuelStartedByUser == 0 && deltaFuelRate > FUEL_THRESHOLD) ||
        (refuelStartedByUser == 1 && deltaFuelRate > FUEL_THRESHOLD && refuelRate < 2)) {
      uiFuelTamper = true;
    }

    if (simPaused || uiFuelTamper) {                 // Detects whether the Sim is paused or the Fuel UI is being tampered with
      simVars->setFuelLeftPre(fuelLeftPre);          // in LBS
      simVars->setFuelRightPre(fuelRightPre);        // in LBS
      simVars->setFuelAuxLeftPre(fuelAuxLeftPre);    // in LBS
      simVars->setFuelAuxRightPre(fuelAuxRightPre);  // in LBS
      simVars->setFuelCenterPre(fuelCenterPre);      // in LBS
      if (devState == 0) {
        fuelLeft = (fuelLeftPre / fuelWeightGallon);          // USG
        fuelRight = (fuelRightPre / fuelWeightGallon);        // USG
        fuelCenter = (fuelCenterPre / fuelWeightGallon);      // USG
        fuelLeftAux = (fuelAuxLeftPre / fuelWeightGallon);    // USG
        fuelRightAux = (fuelAuxRightPre / fuelWeightGallon);  // USG

        SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::FuelCenterMain, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double),
                                      &fuelCenter);
        SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::FuelLeftMain, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double), &fuelLeft);
        SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::FuelRightMain, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double), &fuelRight);
        SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::FuelLeftAux, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double), &fuelLeftAux);
        SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::FuelRightAux, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double),
                                      &fuelRightAux);
      }
    } else if (!uiFuelTamper && refuelStartedByUser == 1) {  // Detects refueling from the EFB
      simVars->setFuelLeftPre(leftQuantity);                 // in LBS
      simVars->setFuelRightPre(rightQuantity);               // in LBS
      simVars->setFuelAuxLeftPre(leftAuxQuantity);           // in LBS
      simVars->setFuelAuxRightPre(rightAuxQuantity);         // in LBS
      simVars->setFuelCenterPre(centerQuantity);             // in LBS
    } else {
      //--------------------------------------------
      // Left Engine and Wing routine
      //--------------------------------------------
      if (fuelLeftPre > 0) {
        // Cycle Fuel Burn for Engine 1
        m = (engine1FF - engine1PreFF) / deltaTime;
        b = engine1PreFF;
        fuelBurn1 = (m * pow(deltaTime, 2) / 2) + (b * deltaTime);  // KG

        // Fuel Used Accumulators - Engine 1
        fuelUsedLeft += fuelBurn1;

        // Fuel transfer routine for Left Wing
        if (fuelAuxLeftPre > leftAuxQuantity) {
          xfrAuxLeft = fuelAuxLeftPre - leftAuxQuantity;
        }
      } else if (fuelLeftPre <= 0) {
        fuelBurn1 = 0;
        fuelLeftPre = 0;
      } else {
        fuelBurn1 = 0;
        fuelLeftPre = -10;
      }

      //--------------------------------------------
      // Right Engine and Wing routine
      //--------------------------------------------
      if (fuelRightPre > 0) {
        // Cycle Fuel Burn for Engine 2
        m = (engine2FF - engine2PreFF) / deltaTime;
        b = engine2PreFF;
        fuelBurn2 = (m * pow(deltaTime, 2) / 2) + (b * deltaTime);  // KG

        // Fuel Used Accumulators - Engine 2
        fuelUsedRight += fuelBurn2;

        // Fuel transfer routine for Left Wing
        if (fuelAuxRightPre > rightAuxQuantity) {
          xfrAuxRight = fuelAuxRightPre - rightAuxQuantity;
        }
      } else if (fuelRightPre <= 0) {
        fuelBurn2 = 0;
        fuelRightPre = 0;
      } else {
        fuelBurn2 = 0;
        fuelRightPre = -10;
      }

      //--------------------------------------------
      // Center Tank transfer routine
      //--------------------------------------------
      if (fuelCenterPre > centerQuantity) {
        xfrCenter = fuelCenterPre - centerQuantity;
      }

      //--------------------------------------------
      // Main Fuel Logic
      //--------------------------------------------
      fuelLeft = (fuelLeftPre - (fuelBurn1 * KGS_TO_LBS)) + xfrAuxLeft + (xfrCenter / 2);     // LBS
      fuelRight = (fuelRightPre - (fuelBurn2 * KGS_TO_LBS)) + xfrAuxRight + (xfrCenter / 2);  // LBS

      double leftQuantity = simVars->getTankLeftCapacity() * fuelWeightGallon; // Change SSJ
      double rightQuantity = simVars->getTankRightCapacity() * fuelWeightGallon; // Change SSJ

      // Checking for Inner Tank overflow - Will be taken off with Rust code Change SSJ
      if (fuelLeft > leftQuantity && fuelRight > rightQuantity) {
        fuelCenter = centerQuantity + (fuelLeft - leftQuantity) + (fuelRight - rightQuantity);
        fuelLeft = leftQuantity;
        fuelRight = rightQuantity;
      } else if (fuelRight > rightQuantity) {
        fuelCenter = centerQuantity + fuelRight - rightQuantity;
        fuelRight = rightQuantity;
      } else if (fuelLeft > leftQuantity) {
        fuelCenter = centerQuantity + fuelLeft - leftQuantity;
        fuelLeft = leftQuantity;
      } else {
        fuelCenter = centerQuantity;
      }


      // Setting new pre-cycle conditions
      simVars->setEngine1PreFF(engine1FF);
      simVars->setEngine2PreFF(engine2FF);
      simVars->setFuelUsedLeft(fuelUsedLeft);         // in KG
      simVars->setFuelUsedRight(fuelUsedRight);       // in KG
      simVars->setFuelAuxLeftPre(leftAuxQuantity);    // in LBS
      simVars->setFuelAuxRightPre(rightAuxQuantity);  // in LBS
      simVars->setFuelCenterPre(fuelCenter);          // in LBS

      simVars->setFuelLeftPre(fuelLeft);    // in LBS
      simVars->setFuelRightPre(fuelRight);  // in LBS

      fuelLeft = (fuelLeft / fuelWeightGallon);      // USG
      fuelRight = (fuelRight / fuelWeightGallon);    // USG
      fuelCenter = (fuelCenter / fuelWeightGallon);  // USG

      SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::FuelCenterMain, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double), &fuelCenter);
      SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::FuelLeftMain, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double), &fuelLeft);
      SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::FuelRightMain, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double), &fuelRight);
    }

    // Will save the current fuel quantities if on the ground AND engines being shutdown
    if (timerFuel.elapsed() >= 1000 && simVars->getSimOnGround() &&
        (engine1State == 0 || engine1State == 10 || engine1State == 4 || engine1State == 14 || engine2State == 0 || engine2State == 10 ||
         engine2State == 4 || engine2State == 14)) {
      Configuration configuration;

      configuration.fuelLeft = simVars->getFuelLeftPre() / simVars->getFuelWeightGallon();
      configuration.fuelRight = simVars->getFuelRightPre() / simVars->getFuelWeightGallon();
      configuration.fuelCenter = simVars->getFuelCenterPre() / simVars->getFuelWeightGallon();
      configuration.fuelLeftAux = simVars->getFuelAuxLeftPre() / simVars->getFuelWeightGallon();
      configuration.fuelRightAux = simVars->getFuelAuxRightPre() / simVars->getFuelWeightGallon();

      saveFuelInConfiguration(configuration);
      timerFuel.reset();
    }
  }

  void updateThrustLimits(double simulationTime,
                          double altitude,
                          double ambientTemp,
                          double ambientPressure,
                          double mach,
                          double simN1highest,
                          double packs,
                          double nai,
                          double wai) {
    double idle = simVars->getEngineIdleN1();
    double flexTemp = simVars->getFlexTemp();
    double thrustLimitType = simVars->getThrustLimitType();
    double to = 0;
    double ga = 0;
    double toga = 0;
    double clb = 0;
    double mct = 0;
    double flex_to = 0;
    double flex_ga = 0;
    double flex = 0;

    // Write all N1 Limits
    to = limitN1(0, min(16600.0, pressAltitude), ambientTemp, ambientPressure, 0, packs, nai, wai);
    ga = limitN1(1, min(16600.0, pressAltitude), ambientTemp, ambientPressure, 0, packs, nai, wai);
    if (flexTemp > 0) {
      flex_to = limitN1(0, min(16600.0, pressAltitude), ambientTemp, ambientPressure, flexTemp, packs, nai, wai);
      flex_ga = limitN1(1, min(16600.0, pressAltitude), ambientTemp, ambientPressure, flexTemp, packs, nai, wai);
    }
    clb = limitN1(2, pressAltitude, ambientTemp, ambientPressure, 0, packs, nai, wai);
    mct = limitN1(3, pressAltitude, ambientTemp, ambientPressure, 0, packs, nai, wai);

    // transition between TO and GA limit -----------------------------------------------------------------------------
    double machFactorLow = max(0.0, min(1.0, (mach - 0.04) / 0.04));
    toga = to + (ga - to) * machFactorLow;
    flex = flex_to + (flex_ga - flex_to) * machFactorLow;

    // adaption of CLB due to FLX limit if necessary ------------------------------------------------------------------

    if ((prevThrustLimitType != 3 && thrustLimitType == 3) || (prevFlexTemperature == 0 && flexTemp > 0)) {
      isFlexActive = true;
    } else if ((flexTemp == 0) || (thrustLimitType == 4)) {
      isFlexActive = false;
    }

    if (isFlexActive && !isTransitionActive && thrustLimitType == 1) {
      isTransitionActive = true;
      transitionStartTime = simulationTime;
      transitionFactor = 0.2;
      // transitionFactor = (clb - flex) / transitionTime;
    } else if (!isFlexActive) {
      isTransitionActive = false;
      transitionStartTime = 0;
      transitionFactor = 0;
    }

    double deltaThrust = 0;

    if (isTransitionActive) {
      double timeDifference = max(0, (simulationTime - transitionStartTime) - waitTime);

      if (timeDifference > 0 && clb > flex) {
        deltaThrust = min(clb - flex, timeDifference * transitionFactor);
      }

      if (flex + deltaThrust >= clb) {
        isFlexActive = false;
        isTransitionActive = false;
      }
    }

    if (isFlexActive) {
      clb = min(clb, flex) + deltaThrust;
    }

    prevThrustLimitType = thrustLimitType;
    prevFlexTemperature = flexTemp;

    // thrust transitions for MCT and TOGA ----------------------------------------------------------------------------

    // get factors
    double machFactor = max(0.0, min(1.0, ((mach - 0.37) / 0.05)));
    double altitudeFactorLow = max(0.0, min(1.0, ((altitude - 16600) / 500)));
    double altitudeFactorHigh = max(0.0, min(1.0, ((altitude - 25000) / 500)));

    // adapt thrust limits
    if (altitude >= 25000) {
      mct = max(clb, mct + (clb - mct) * altitudeFactorHigh);
      toga = mct;
    } else {
      if (mct > toga) {
        mct = toga + (mct - toga) * min(1.0, altitudeFactorLow + machFactor);
        toga = mct;
      } else {
        toga = toga + (mct - toga) * min(1.0, altitudeFactorLow + machFactor);
      }
    }

    // write limits ---------------------------------------------------------------------------------------------------
    simVars->setThrustLimitIdle(idle);
    simVars->setThrustLimitToga(toga);
    simVars->setThrustLimitFlex(flex);
    simVars->setThrustLimitClimb(clb);
    simVars->setThrustLimitMct(mct);
  }

 public:
  /// <summary>
  /// Initialize the FADEC and Fuel model
  /// </summary>
  void initialize(const char* acftRegistration) {
    srand((int)time(0));

    std::cout << "FADEC: Initializing EngineControl" << std::endl;

    simVars = new SimVars();
    double engTime = 0;
    ambientTemp = simVars->getAmbientTemperature();
    simN2LeftPre = simVars->getN2(1);
    simN2RightPre = simVars->getN2(2);

    confFilename += acftRegistration;
    confFilename += FILENAME_FADEC_CONF_FILE_EXTENSION;

    Configuration configuration = getConfigurationFromFile();

    // One-off Engine imbalance
    generateEngineImbalance(1);
    imbalance = simVars->getEngineImbalance();
    engineImbalanced = imbalanceExtractor(imbalance, 1);

    // Checking engine imbalance
    if (engineImbalanced != engine) {
      paramImbalance = 0;
    }

    for (engine = 1; engine <= 2; engine++) {
      // Obtain Engine Time
      engTime = simVars->getEngineTime(engine) + engTime;

      // Checking engine imbalance
      paramImbalance = imbalanceExtractor(imbalance, 5) / 10;

      if (engineImbalanced != engine) {
        paramImbalance = 0;
      }

      // Engine Idle Oil Qty
      idleOil = initOil(140, 200);

      // Setting initial Oil
      if (engine == 1) {
        simVars->setEngine1TotalOil(idleOil - paramImbalance);
      } else {
        simVars->setEngine2TotalOil(idleOil - paramImbalance);
      }
    }

    // Setting initial Oil Temperature
    thermalEnergy1 = 0;
    thermalEnergy2 = 0;
    oilTemperatureMax = imbalanceExtractor(imbalance, 8);
    simOnGround = simVars->getSimOnGround();
    double engine1Combustion = simVars->getEngineCombustion(1);
    double engine2Combustion = simVars->getEngineCombustion(2);

    if (simOnGround == 1 && engine1Combustion == 1 && engine2Combustion == 1) {
      oilTemperatureLeftPre = 75;
      oilTemperatureRightPre = 75;
    } else if (simOnGround == 0 && engine1Combustion == 1 && engine2Combustion == 1) {
      oilTemperatureLeftPre = 85;
      oilTemperatureRightPre = 85;

    } else {
      oilTemperatureLeftPre = ambientTemp;
      oilTemperatureRightPre = ambientTemp;
    }

    SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::OilTempLeft, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double),
                                  &oilTemperatureLeftPre);
    SimConnect_SetDataOnSimObject(hSimConnect, DataTypesID::OilTempRight, SIMCONNECT_OBJECT_ID_USER, 0, 0, sizeof(double),
                                  &oilTemperatureRightPre);

    // Initialize Engine State
    simVars->setEngine1State(10);
    simVars->setEngine2State(10);

    // Resetting Engine Timers
    simVars->setEngine1Timer(0);
    simVars->setEngine2Timer(0);

    // Initialize Fuel Tanks
    simVars->setFuelLeftPre(configuration.fuelLeft * simVars->getFuelWeightGallon());          // in LBS
    simVars->setFuelRightPre(configuration.fuelRight * simVars->getFuelWeightGallon());        // in LBS
    simVars->setFuelAuxLeftPre(configuration.fuelLeftAux * simVars->getFuelWeightGallon());    // in LBS
    simVars->setFuelAuxRightPre(configuration.fuelRightAux * simVars->getFuelWeightGallon());  // in LBS
    simVars->setFuelCenterPre(configuration.fuelCenter * simVars->getFuelWeightGallon());      // in LBS

    // Initialize Pump State
    simVars->setPumpStateLeft(0);
    simVars->setPumpStateRight(0);

    // Initialize Thrust Limits
    simVars->setThrustLimitIdle(0);
    simVars->setThrustLimitToga(0);
    simVars->setThrustLimitFlex(0);
    simVars->setThrustLimitClimb(0);
    simVars->setThrustLimitMct(0);
  }

  /// <summary>
  /// Update cycle at deltaTime
  /// </summary>
  void update(double deltaTime, double simulationTime) {
    double animationDeltaTime;
    double prevAnimationDeltaTime;
    double simN1highest = 0;

    // animationDeltaTimes being used to detect a Paused situation
    prevAnimationDeltaTime = animationDeltaTime;
    animationDeltaTime = simVars->getAnimDeltaTime();

    mach = simVars->getMach();
    pressAltitude = simVars->getPressureAltitude();
    ambientTemp = simVars->getAmbientTemperature();
    ambientPressure = simVars->getAmbientPressure();
    simOnGround = simVars->getSimOnGround();
    imbalance = simVars->getEngineImbalance();
    packs = 0;
    nai = 0;
    wai = 0;

    // Obtain Bleed Variables
    if (simVars->getPacksState1() > 0.5 || simVars->getPacksState2() > 0.5) {
      packs = 1;
    }
    if (simVars->getNAI(1) > 0.5 || simVars->getNAI(2) > 0.5) {
      nai = 1;
    }
    wai = simVars->getWAI();

    generateIdleParameters(pressAltitude, mach, ambientTemp, ambientPressure);

    // Timer timer;
    for (engine = 1; engine <= 2; engine++) {
      engineStarter = simVars->getEngineStarter(engine);
      engineIgniter = simVars->getEngineIgniter(engine);
      simCN1 = simVars->getCN1(engine);
      simN1 = simVars->getN1(engine);
      simN2 = simVars->getN2(engine);
      thrust = simVars->getThrust(engine);

      // Set & Check Engine Status for this Cycle
      engineStateMachine(engine, engineIgniter, engineStarter, simN2, idleN2, pressAltitude, ambientTemp,
                         animationDeltaTime - prevAnimationDeltaTime);
      if (engine == 1) {
        engineState = simVars->getEngine1State();
        deltaN2 = simN2 - simN2LeftPre;
        simN2LeftPre = simN2;
        timer = simVars->getEngine1Timer();
      } else {
        engineState = simVars->getEngine2State();
        deltaN2 = simN2 - simN2RightPre;
        simN2RightPre = simN2;
        timer = simVars->getEngine2Timer();
      }

      switch (int(engineState)) {
        case 2:
        case 3:
          engineStartProcedure(engine, engineState, imbalance, deltaTime, timer, simN2, pressAltitude, ambientTemp);
          break;
        case 4:
          engineShutdownProcedure(engine, ambientTemp, simN1, deltaTime, timer);
          cFbwFF = updateFF(engine, imbalance, simCN1, mach, pressAltitude, ambientTemp, ambientPressure);
          break;
        default:
          updatePrimaryParameters(engine, imbalance, simN1, simN2);
          cFbwFF = updateFF(engine, imbalance, simCN1, mach, pressAltitude, ambientTemp, ambientPressure);
          updateEGT(engine, imbalance, deltaTime, simOnGround, engineState, simCN1, cFbwFF, mach, pressAltitude, ambientTemp);
          // updateOil(engine, imbalance, thrust, simN2, deltaN2, deltaTime, ambientTemp);
      }

      // set highest N1 from either engine
      simN1highest = max(simN1highest, simN1);
    }

    // If Development State is 1, UI Payload will be enabled
    devState = simVars->getDeveloperState();
    if (devState == 0)
      checkPayload();

    updateFuel(deltaTime);

    updateThrustLimits(simulationTime, pressAltitude, ambientTemp, ambientPressure, mach, simN1highest, packs, nai, wai);
    // timer.elapsed();
  }

  void terminate() {}

  Configuration getConfigurationFromFile() {
    Configuration configuration;
    mINI::INIStructure stInitStructure;

    mINI::INIFile iniFile(confFilename);

    if (!iniFile.read(stInitStructure)) {
      std::cout << "EngineControl: failed to read configuration file " << confFilename << " due to error \"" << strerror(errno)
                << "\" -> use default main/aux/center: " << configuration.fuelLeft << "/" << configuration.fuelLeftAux << "/"
                << configuration.fuelCenter << std::endl;
    } else {
      configuration = loadConfiguration(stInitStructure);
    }

    return configuration;
  }

  Configuration loadConfiguration(const mINI::INIStructure& structure) {
    return {
        mINI::INITypeConversion::getDouble(structure, CONFIGURATION_SECTION_FUEL, CONFIGURATION_SECTION_FUEL_CENTER_QUANTITY, 0),
        mINI::INITypeConversion::getDouble(structure, CONFIGURATION_SECTION_FUEL, CONFIGURATION_SECTION_FUEL_LEFT_QUANTITY, 400.0),
        mINI::INITypeConversion::getDouble(structure, CONFIGURATION_SECTION_FUEL, CONFIGURATION_SECTION_FUEL_RIGHT_QUANTITY, 400.0),
        mINI::INITypeConversion::getDouble(structure, CONFIGURATION_SECTION_FUEL, CONFIGURATION_SECTION_FUEL_LEFT_AUX_QUANTITY, 228.0),
        mINI::INITypeConversion::getDouble(structure, CONFIGURATION_SECTION_FUEL, CONFIGURATION_SECTION_FUEL_RIGHT_AUX_QUANTITY, 228.0),
    };
  }

  void saveFuelInConfiguration(Configuration configuration) {
    mINI::INIStructure stInitStructure;
    mINI::INIFile iniFile(confFilename);

    // Do not check a possible error since the file may not exist yet
    iniFile.read(stInitStructure);

    stInitStructure[CONFIGURATION_SECTION_FUEL][CONFIGURATION_SECTION_FUEL_CENTER_QUANTITY] = std::to_string(configuration.fuelCenter);
    stInitStructure[CONFIGURATION_SECTION_FUEL][CONFIGURATION_SECTION_FUEL_LEFT_QUANTITY] = std::to_string(configuration.fuelLeft);
    stInitStructure[CONFIGURATION_SECTION_FUEL][CONFIGURATION_SECTION_FUEL_RIGHT_QUANTITY] = std::to_string(configuration.fuelRight);
    stInitStructure[CONFIGURATION_SECTION_FUEL][CONFIGURATION_SECTION_FUEL_LEFT_AUX_QUANTITY] = std::to_string(configuration.fuelLeftAux);
    stInitStructure[CONFIGURATION_SECTION_FUEL][CONFIGURATION_SECTION_FUEL_RIGHT_AUX_QUANTITY] = std::to_string(configuration.fuelRightAux);

    if (!iniFile.write(stInitStructure, true)) {
      std::cout << "EngineControl: failed to write engine conf " << confFilename << " due to error \"" << strerror(errno) << "\""
                << std::endl;
    }
  }
};

EngineControl EngineControlInstance;
