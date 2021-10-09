#include <dirent.h>
#include <ini.h>
#include <ini_type_conversion.h>
#include <stdio.h>
#include <chrono>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <vector>

#include "FlightDataRecorder.h"

using namespace std;
using namespace mINI;

void FlightDataRecorder::initialize() {
  // read configuration
  INIStructure iniStructure;
  INIFile iniFile(CONFIGURATION_FILEPATH);
  if (!iniFile.read(iniStructure)) {
    // file does not exist yet -> store the default configuration in a file
    iniStructure["FLIGHT_DATA_RECORDER"]["ENABLED"] = "true";
    iniStructure["FLIGHT_DATA_RECORDER"]["MAXIMUM_NUMBER_OF_FILES"] = "15";
    iniStructure["FLIGHT_DATA_RECORDER"]["MAXIMUM_NUMBER_OF_ENTRIES_PER_FILE"] = "864000";
    iniFile.write(iniStructure, true);
  }

  // read basic configuration
  isEnabled = INITypeConversion::getBoolean(iniStructure, "FLIGHT_DATA_RECORDER", "ENABLED", true);
  maximumFileCount = INITypeConversion::getInteger(iniStructure, "FLIGHT_DATA_RECORDER", "MAXIMUM_NUMBER_OF_FILES", 15);
  maximumSampleCounter = INITypeConversion::getInteger(iniStructure, "FLIGHT_DATA_RECORDER", "MAXIMUM_NUMBER_OF_ENTRIES_PER_FILE", 864000);

  // print configuration
  cout << "WASM: Flight Data Recorder Configuration : Enabled                        = " << isEnabled << endl;
  cout << "WASM: Flight Data Recorder Configuration : MaximumNumberOfFiles           = " << maximumFileCount << endl;
  cout << "WASM: Flight Data Recorder Configuration : MaximumNumberOfEntriesPerFile  = " << maximumSampleCounter << endl;
  cout << "WASM: Flight Data Recorder Configuration : Interface Version              = " << INTERFACE_VERSION << endl;
}

void FlightDataRecorder::update(AutopilotStateMachineModelClass* autopilotStateMachine,
                                AutopilotLawsModelClass* autopilotLaws,
                                AutothrustModelClass* autoThrust,
                                FlyByWireModelClass* flyByWire,
                                const EngineData& engineData) {
  // check if enabled
  if (!isEnabled) {
    return;
  }

  // do file management
  manageFlightDataRecorderFiles();

  // write data to file
  fileStream->write((char*)(&autopilotStateMachine->getExternalOutputs().out), sizeof(autopilotStateMachine->getExternalOutputs().out));
  fileStream->write((char*)(&autopilotLaws->getExternalOutputs().out.output), sizeof(autopilotLaws->getExternalOutputs().out.output));
  fileStream->write((char*)(&autoThrust->getExternalOutputs().out), sizeof(autoThrust->getExternalOutputs().out));
  fileStream->write((char*)(&flyByWire->getExternalOutputs().out), sizeof(flyByWire->getExternalOutputs().out));
  fileStream->write((char*)(&engineData), sizeof(engineData));
}

void FlightDataRecorder::terminate() {
  if (fileStream) {
    fileStream->close();
    fileStream.reset();
  }
}

void FlightDataRecorder::manageFlightDataRecorderFiles() {
  // increase sample counter
  sampleCounter++;

  // check if file is considered full
  if (sampleCounter >= maximumSampleCounter) {
    // close file and delete
    if (fileStream) {
      fileStream->close();
      fileStream.reset();
    }
    // reset counter
    sampleCounter = 0;
  }

  if (!fileStream) {
    // create new file
    fileStream = make_shared<gzofstream>(getFlightDataRecorderFilename().c_str());
    // write version to file
    fileStream->write((char*)&INTERFACE_VERSION, sizeof(INTERFACE_VERSION));
    // clean up directory
    cleanUpFlightDataRecorderFiles();
  }
}

string FlightDataRecorder::getFlightDataRecorderFilename() {
  // get time
  auto in_time_t = chrono::system_clock::to_time_t(chrono::system_clock::now());

  // get filepath based on time
  stringstream result;
  result << put_time(gmtime(&in_time_t), "\\work\\%Y-%m-%d-%H-%M-%S.fdr");

  // return result
  return result.str();
}

void FlightDataRecorder::cleanUpFlightDataRecorderFiles() {
  // vector for directory entries
  vector<string> files;

  // extension
  string extension = "fdr";

  // structure representing an directory entry
  struct dirent* directoryEntry;

  // open directory
  DIR* directory = opendir("\\work");

  // read directory until end
  while ((directoryEntry = readdir(directory)) != NULL) {
    // get filename as string
    string filename = directoryEntry->d_name;

    // check if file has right extension
    if (filename.find(extension, (filename.length() - extension.length())) != string::npos) {
      files.push_back(filename);
    }
  }

  // close directory
  closedir(directory);

  // sort vector
  sort(files.begin(), files.end(), std::greater<>());

  // remove older files
  while (files.size() > maximumFileCount) {
    bool result = remove(("\\work\\" + files.back()).c_str());
    files.pop_back();
  }
}
