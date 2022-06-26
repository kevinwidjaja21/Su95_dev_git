#pragma once

struct AdditionalData {
  double master_warning_active;
  double master_caution_active;
  double park_brake_lever_pos;
  double brake_pedal_left_pos;
  double brake_pedal_right_pos;
  double brake_left_sim_pos;
  double brake_right_sim_pos;
  double autobrake_armed_mode;
  double autobrake_decel_light;
  double spoilers_handle_pos;
  double spoilers_armed;
  double spoilers_handle_sim_pos;
  double ground_spoilers_active;
  double flaps_handle_percent;
  double flaps_handle_index;
  double flaps_handle_configuration_index;
  double flaps_handle_sim_index;
  double gear_handle_pos;
  double hydraulic_green_pressure;
  double hydraulic_blue_pressure;
  double hydraulic_yellow_pressure;
  double throttle_lever_1_pos;
  double throttle_lever_2_pos;
  double corrected_engine_N1_1_percent;
  double corrected_engine_N1_2_percent;
  unsigned long long assistanceTakeoffEnabled;
  unsigned long long assistanceLandingEnabled;
  unsigned long long aiAutoTrimActive;
  unsigned long long aiControlsActive;
  unsigned long long realisticTillerEnabled;
  double tillerHandlePosition;
  double noseWheelPosition;
};
