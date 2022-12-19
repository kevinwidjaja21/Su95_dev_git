// Copyright (c) 2022 FlyByWire Simulations
// SPDX-License-Identifier: GPL-3.0

#include <chrono>
#include <iostream>

#include "AircraftPreset.h"

void AircraftPreset::initialize() {
  LoadAircraftPresetRequest = register_named_variable("A32NX_AIRCRAFT_PRESET_LOAD");
  this->setLoadAircraftPresetRequest(0);
  ProgressAircraftPreset = register_named_variable("A32NX_AIRCRAFT_PRESET_LOAD_PROGRESS");
  ProgressAircraftPresetId = register_named_variable("A32NX_AIRCRAFT_PRESET_LOAD_CURRENT_ID");
  SimOnGround = get_aircraft_var_enum("SIM ON GROUND");
  isInitialized = true;
  std::cout << "FLYPAD_BACKEND: AircraftPresets initialized" << std::endl;
}

void AircraftPreset::onUpdate(double deltaTime) {
  if (!isInitialized) {
    return;
  }

  const auto loadAircraftPresetRequest = static_cast<int64_t>(getLoadAircraftPresetRequest());

  // has request to load a preset been received?
  if (loadAircraftPresetRequest) {
    // we do not allow loading of presets in the air to prevent users from
    // accidentally changing the aircraft configuration
    if (!getSimOnGround()) {
      std::cout << "FLYPAD_BACKEND: Aircraft must be on the ground to load a preset!" << std::endl;
      setLoadAircraftPresetRequest(0);
      loadingIsActive = false;
      return;
    }

    // check if we already have an active loading process or if this is a new request which
    // needs to be initialized
    if (!loadingIsActive) {
      // check if procedure ID exists
      const std::vector<const ProcedureStep*>* requestedProcedure = procedures.getProcedure(loadAircraftPresetRequest);
      if (requestedProcedure == nullptr) {
        std::cout << "FLYPAD_BACKEND: Preset " << loadAircraftPresetRequest << " not found!"
                  << std::endl;
        setLoadAircraftPresetRequest(0);
        loadingIsActive = false;
        return;
      }

      // initialize new loading process
      currentProcedureID = loadAircraftPresetRequest;
      currentProcedure = requestedProcedure;
      currentLoadingTime = 0;
      currentDelay = 0;
      currentStep = 0;
      loadingIsActive = true;
      setProgressAircraftPreset(0);
      setProgressAircraftPresetId(0);
      std::cout << "FLYPAD_BACKEND: Aircraft Preset " << currentProcedureID
                << " starting procedure!" << std::endl;
      return;
    }

    // reset the LVAR to the currently running procedure in case it has been changed
    // during a running procedure. We only allow "0" as a signal to interrupt the
    // current procedure
    setLoadAircraftPresetRequest(static_cast<FLOAT64>(currentProcedureID));

    // check if all procedure steps are done and the procedure is finished
    if (currentStep >= currentProcedure->size()) {
      std::cout << "FLYPAD_BACKEND: Aircraft Preset " << currentProcedureID << " done!"
                << std::endl;
      setProgressAircraftPreset(0);
      setProgressAircraftPresetId(0);
      setLoadAircraftPresetRequest(0);
      loadingIsActive = false;
      return;
    }

    // update run timer
    currentLoadingTime += deltaTime * 1000;

    // check if we are in a delay and return if we have to wait
    if (currentLoadingTime <= currentDelay) {
      return;
    }

    // convenience tmp
    const ProcedureStep* currentStepPtr = (*currentProcedure)[currentStep];

    // calculate next delay
    currentDelay = currentLoadingTime + currentStepPtr->delayAfter;

    // prepare return values for execute_calculator_code
    FLOAT64 fvalue = 0;
    SINT32 ivalue = 0;
    PCSTRINGZ svalue = "";

    // check if the current step is a condition step and check the condition
    if (currentStepPtr->isConditional) {
      // update progress var
      setProgressAircraftPreset(static_cast<double>(currentStep) / currentProcedure->size());
      setProgressAircraftPresetId(currentStepPtr->id);
      execute_calculator_code(currentStepPtr->actionCode.c_str(), &fvalue, &ivalue, &svalue);
      std::cout << "FLYPAD_BACKEND: Aircraft Preset Step " << currentStep << " Condition: "
                << currentStepPtr->description
                << " (delay between tests: " << currentStepPtr->delayAfter << ")" << std::endl;
      if (static_cast<bool>(fvalue)) {
        currentDelay = 0;
        currentStep++;
      }
      return;
    }

    // test if the next step is required or if the state is already
    // set then set in which case the action can be skipped and delay can be ignored.
    fvalue = 0;
    ivalue = 0;
    svalue = "";
    if (!currentStepPtr->expectedStateCheckCode.empty()) {
#ifdef DEBUG
      std::cout << "FLYPAD_BACKEND: Aircraft Preset Step " << currentStep << " Test: "
                << currentStepPtr->description << " TEST: \""
                << currentStepPtr->expectedStateCheckCode << "\"" << std::endl;
#endif
      execute_calculator_code(currentStepPtr->expectedStateCheckCode.c_str(), &fvalue, &ivalue, &svalue);
      if (static_cast<bool>(fvalue)) {
#ifdef DEBUG
        std::cout << "FLYPAD_BACKEND: Aircraft Preset Step " << currentStep << " Skipping: "
                  << currentStepPtr->description << " TEST: \""
                  << currentStepPtr->expectedStateCheckCode << "\"" << std::endl;
#endif

        currentDelay = 0;
        currentStep++;
        return;
      }
    }

    // update progress var
    setProgressAircraftPreset(static_cast<double>(currentStep) / currentProcedure->size());
    setProgressAircraftPresetId(currentStepPtr->id);

    // execute code to set expected state
    std::cout << "FLYPAD_BACKEND: Aircraft Preset Step " << currentStep << " Execute: "
              << currentStepPtr->description
              << " (delay after: " << currentStepPtr->delayAfter << ")" << std::endl;
    execute_calculator_code(currentStepPtr->actionCode.c_str(), &fvalue, &ivalue, &svalue);
    currentStep++;

  }
  else if (loadingIsActive) {
    // request lvar has been set to 0 while we were executing a procedure ==> cancel loading
    std::cout << "FLYPAD_BACKEND: Aircraft Preset " << currentProcedureID << " loading cancelled!"
              << std::endl;
    loadingIsActive = false;
  }
}

void AircraftPreset::shutdown() {
  isInitialized = false;
  std::cout << "FLYPAD_BACKEND: AircraftPresets shutdown" << std::endl;
}
