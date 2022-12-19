#ifndef RTW_HEADER_SecComputer_types_h_
#define RTW_HEADER_SecComputer_types_h_
#include "rtwtypes.h"

#ifndef DEFINED_TYPEDEF_FOR_pitch_efcs_law_
#define DEFINED_TYPEDEF_FOR_pitch_efcs_law_

enum class pitch_efcs_law
  : int32_T {
  NormalLaw = 0,
  AlternateLaw1,
  AlternateLaw2,
  DirectLaw,
  None
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_SignStatusMatrix_
#define DEFINED_TYPEDEF_FOR_SignStatusMatrix_

enum class SignStatusMatrix
  : int32_T {
  FailureWarning = 0,
  NoComputedData,
  FunctionalTest,
  NormalOperation
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_time_
#define DEFINED_TYPEDEF_FOR_base_time_

struct base_time
{
  real_T dt;
  real_T simulation_time;
  real_T monotonic_time;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_sim_data_
#define DEFINED_TYPEDEF_FOR_base_sim_data_

struct base_sim_data
{
  boolean_T slew_on;
  boolean_T pause_on;
  boolean_T tracking_mode_on_override;
  boolean_T tailstrike_protection_on;
  boolean_T computer_running;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_sec_discrete_inputs_
#define DEFINED_TYPEDEF_FOR_base_sec_discrete_inputs_

struct base_sec_discrete_inputs
{
  boolean_T sec_engaged_from_switch;
  boolean_T sec_in_emergency_powersupply;
  boolean_T is_unit_1;
  boolean_T is_unit_2;
  boolean_T is_unit_3;
  boolean_T pitch_not_avail_elac_1;
  boolean_T pitch_not_avail_elac_2;
  boolean_T left_elev_not_avail_sec_opp;
  boolean_T digital_output_failed_elac_1;
  boolean_T right_elev_not_avail_sec_opp;
  boolean_T green_low_pressure;
  boolean_T blue_low_pressure;
  boolean_T yellow_low_pressure;
  boolean_T sfcc_1_slats_out;
  boolean_T sfcc_2_slats_out;
  boolean_T digital_output_failed_elac_2;
  boolean_T ths_motor_fault;
  boolean_T l_elev_servo_failed;
  boolean_T r_elev_servo_failed;
  boolean_T l_spoiler_1_servo_failed;
  boolean_T r_spoiler_1_servo_failed;
  boolean_T l_spoiler_2_servo_failed;
  boolean_T r_spoiler_2_servo_failed;
  boolean_T ths_override_active;
  boolean_T capt_priority_takeover_pressed;
  boolean_T fo_priority_takeover_pressed;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_sec_analog_inputs_
#define DEFINED_TYPEDEF_FOR_base_sec_analog_inputs_

struct base_sec_analog_inputs
{
  real_T capt_pitch_stick_pos;
  real_T fo_pitch_stick_pos;
  real_T capt_roll_stick_pos;
  real_T fo_roll_stick_pos;
  real_T spd_brk_lever_pos;
  real_T thr_lever_1_pos;
  real_T thr_lever_2_pos;
  real_T left_elevator_pos_deg;
  real_T right_elevator_pos_deg;
  real_T ths_pos_deg;
  real_T left_spoiler_1_pos_deg;
  real_T right_spoiler_1_pos_deg;
  real_T left_spoiler_2_pos_deg;
  real_T right_spoiler_2_pos_deg;
  real_T load_factor_acc_1_g;
  real_T load_factor_acc_2_g;
  real_T wheel_speed_left;
  real_T wheel_speed_right;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_arinc_429_
#define DEFINED_TYPEDEF_FOR_base_arinc_429_

struct base_arinc_429
{
  uint32_T SSM;
  real32_T Data;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_adr_bus_
#define DEFINED_TYPEDEF_FOR_base_adr_bus_

struct base_adr_bus
{
  base_arinc_429 altitude_standard_ft;
  base_arinc_429 altitude_corrected_ft;
  base_arinc_429 mach;
  base_arinc_429 airspeed_computed_kn;
  base_arinc_429 airspeed_true_kn;
  base_arinc_429 vertical_speed_ft_min;
  base_arinc_429 aoa_corrected_deg;
  base_arinc_429 corrected_average_static_pressure;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_ir_bus_
#define DEFINED_TYPEDEF_FOR_base_ir_bus_

struct base_ir_bus
{
  base_arinc_429 discrete_word_1;
  base_arinc_429 latitude_deg;
  base_arinc_429 longitude_deg;
  base_arinc_429 ground_speed_kn;
  base_arinc_429 track_angle_true_deg;
  base_arinc_429 heading_true_deg;
  base_arinc_429 wind_speed_kn;
  base_arinc_429 wind_direction_true_deg;
  base_arinc_429 track_angle_magnetic_deg;
  base_arinc_429 heading_magnetic_deg;
  base_arinc_429 drift_angle_deg;
  base_arinc_429 flight_path_angle_deg;
  base_arinc_429 flight_path_accel_g;
  base_arinc_429 pitch_angle_deg;
  base_arinc_429 roll_angle_deg;
  base_arinc_429 body_pitch_rate_deg_s;
  base_arinc_429 body_roll_rate_deg_s;
  base_arinc_429 body_yaw_rate_deg_s;
  base_arinc_429 body_long_accel_g;
  base_arinc_429 body_lat_accel_g;
  base_arinc_429 body_normal_accel_g;
  base_arinc_429 track_angle_rate_deg_s;
  base_arinc_429 pitch_att_rate_deg_s;
  base_arinc_429 roll_att_rate_deg_s;
  base_arinc_429 inertial_alt_ft;
  base_arinc_429 along_track_horiz_acc_g;
  base_arinc_429 cross_track_horiz_acc_g;
  base_arinc_429 vertical_accel_g;
  base_arinc_429 inertial_vertical_speed_ft_s;
  base_arinc_429 north_south_velocity_kn;
  base_arinc_429 east_west_velocity_kn;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_elac_out_bus_
#define DEFINED_TYPEDEF_FOR_base_elac_out_bus_

struct base_elac_out_bus
{
  base_arinc_429 left_aileron_position_deg;
  base_arinc_429 right_aileron_position_deg;
  base_arinc_429 left_elevator_position_deg;
  base_arinc_429 right_elevator_position_deg;
  base_arinc_429 ths_position_deg;
  base_arinc_429 left_sidestick_pitch_command_deg;
  base_arinc_429 right_sidestick_pitch_command_deg;
  base_arinc_429 left_sidestick_roll_command_deg;
  base_arinc_429 right_sidestick_roll_command_deg;
  base_arinc_429 rudder_pedal_position_deg;
  base_arinc_429 aileron_command_deg;
  base_arinc_429 roll_spoiler_command_deg;
  base_arinc_429 yaw_damper_command_deg;
  base_arinc_429 elevator_double_pressurization_command_deg;
  base_arinc_429 discrete_status_word_1;
  base_arinc_429 discrete_status_word_2;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_fcdc_bus_
#define DEFINED_TYPEDEF_FOR_base_fcdc_bus_

struct base_fcdc_bus
{
  base_arinc_429 efcs_status_word_1;
  base_arinc_429 efcs_status_word_2;
  base_arinc_429 efcs_status_word_3;
  base_arinc_429 efcs_status_word_4;
  base_arinc_429 efcs_status_word_5;
  base_arinc_429 capt_roll_command_deg;
  base_arinc_429 fo_roll_command_deg;
  base_arinc_429 rudder_pedal_position_deg;
  base_arinc_429 capt_pitch_command_deg;
  base_arinc_429 fo_pitch_command_deg;
  base_arinc_429 aileron_left_pos_deg;
  base_arinc_429 elevator_left_pos_deg;
  base_arinc_429 aileron_right_pos_deg;
  base_arinc_429 elevator_right_pos_deg;
  base_arinc_429 horiz_stab_trim_pos_deg;
  base_arinc_429 spoiler_1_left_pos_deg;
  base_arinc_429 spoiler_2_left_pos_deg;
  base_arinc_429 spoiler_3_left_pos_deg;
  base_arinc_429 spoiler_4_left_pos_deg;
  base_arinc_429 spoiler_5_left_pos_deg;
  base_arinc_429 spoiler_1_right_pos_deg;
  base_arinc_429 spoiler_2_right_pos_deg;
  base_arinc_429 spoiler_3_right_pos_deg;
  base_arinc_429 spoiler_4_right_pos_deg;
  base_arinc_429 spoiler_5_right_pos_deg;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_sfcc_bus_
#define DEFINED_TYPEDEF_FOR_base_sfcc_bus_

struct base_sfcc_bus
{
  base_arinc_429 slat_flap_component_status_word;
  base_arinc_429 slat_flap_system_status_word;
  base_arinc_429 slat_flap_actual_position_word;
  base_arinc_429 slat_actual_position_deg;
  base_arinc_429 flap_actual_position_deg;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_lgciu_bus_
#define DEFINED_TYPEDEF_FOR_base_lgciu_bus_

struct base_lgciu_bus
{
  base_arinc_429 discrete_word_1;
  base_arinc_429 discrete_word_2;
  base_arinc_429 discrete_word_3;
  base_arinc_429 discrete_word_4;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_sec_bus_inputs_
#define DEFINED_TYPEDEF_FOR_base_sec_bus_inputs_

struct base_sec_bus_inputs
{
  base_adr_bus adr_1_bus;
  base_adr_bus adr_2_bus;
  base_ir_bus ir_1_bus;
  base_ir_bus ir_2_bus;
  base_elac_out_bus elac_1_bus;
  base_fcdc_bus fcdc_1_bus;
  base_fcdc_bus fcdc_2_bus;
  base_elac_out_bus elac_2_bus;
  base_sfcc_bus sfcc_1_bus;
  base_sfcc_bus sfcc_2_bus;
  base_lgciu_bus lgciu_1_bus;
  base_lgciu_bus lgciu_2_bus;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_sec_inputs_
#define DEFINED_TYPEDEF_FOR_sec_inputs_

struct sec_inputs
{
  base_time time;
  base_sim_data sim_data;
  base_sec_discrete_inputs discrete_inputs;
  base_sec_analog_inputs analog_inputs;
  base_sec_bus_inputs bus_inputs;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_sec_lateral_law_outputs_
#define DEFINED_TYPEDEF_FOR_base_sec_lateral_law_outputs_

struct base_sec_lateral_law_outputs
{
  real_T left_spoiler_1_command_deg;
  real_T right_spoiler_1_command_deg;
  real_T left_spoiler_2_command_deg;
  real_T right_spoiler_2_command_deg;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_sec_pitch_law_outputs_
#define DEFINED_TYPEDEF_FOR_base_sec_pitch_law_outputs_

struct base_sec_pitch_law_outputs
{
  real_T elevator_command_deg;
  real_T ths_command_deg;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_sec_laws_outputs_
#define DEFINED_TYPEDEF_FOR_base_sec_laws_outputs_

struct base_sec_laws_outputs
{
  base_sec_lateral_law_outputs lateral_law_outputs;
  base_sec_pitch_law_outputs pitch_law_outputs;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_sec_adr_computation_data_
#define DEFINED_TYPEDEF_FOR_base_sec_adr_computation_data_

struct base_sec_adr_computation_data
{
  real_T V_ias_kn;
  real_T V_tas_kn;
  real_T mach;
  real_T alpha_deg;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_sec_ir_computation_data_
#define DEFINED_TYPEDEF_FOR_base_sec_ir_computation_data_

struct base_sec_ir_computation_data
{
  real_T theta_deg;
  real_T phi_deg;
  real_T q_deg_s;
  real_T r_deg_s;
  real_T n_x_g;
  real_T n_y_g;
  real_T n_z_g;
  real_T theta_dot_deg_s;
  real_T phi_dot_deg_s;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_sec_logic_outputs_
#define DEFINED_TYPEDEF_FOR_base_sec_logic_outputs_

struct base_sec_logic_outputs
{
  boolean_T on_ground;
  boolean_T pitch_law_in_flight;
  boolean_T tracking_mode_on;
  pitch_efcs_law pitch_law_capability;
  pitch_efcs_law active_pitch_law;
  boolean_T abnormal_condition_law_active;
  boolean_T is_engaged_in_pitch;
  boolean_T can_engage_in_pitch;
  boolean_T has_priority_in_pitch;
  boolean_T left_elevator_avail;
  boolean_T right_elevator_avail;
  boolean_T ths_avail;
  boolean_T ths_active_commanded;
  boolean_T ths_ground_setting_active;
  boolean_T is_engaged_in_roll;
  boolean_T spoiler_pair_1_avail;
  boolean_T spoiler_pair_2_avail;
  boolean_T is_yellow_hydraulic_power_avail;
  boolean_T is_blue_hydraulic_power_avail;
  boolean_T is_green_hydraulic_power_avail;
  boolean_T left_sidestick_disabled;
  boolean_T right_sidestick_disabled;
  boolean_T left_sidestick_priority_locked;
  boolean_T right_sidestick_priority_locked;
  real_T total_sidestick_pitch_command;
  real_T total_sidestick_roll_command;
  boolean_T ground_spoilers_armed;
  boolean_T ground_spoilers_out;
  boolean_T partial_lift_dumping_active;
  boolean_T speed_brake_inhibited;
  boolean_T single_adr_failure;
  boolean_T double_adr_failure;
  boolean_T cas_or_mach_disagree;
  boolean_T alpha_disagree;
  boolean_T single_ir_failure;
  boolean_T double_ir_failure;
  boolean_T ir_disagree;
  base_sec_adr_computation_data adr_computation_data;
  base_sec_ir_computation_data ir_computation_data;
  boolean_T any_landing_gear_not_uplocked;
  boolean_T lgciu_uplock_disagree_or_fault;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_sec_discrete_outputs_
#define DEFINED_TYPEDEF_FOR_base_sec_discrete_outputs_

struct base_sec_discrete_outputs
{
  boolean_T thr_reverse_selected;
  boolean_T left_elevator_ok;
  boolean_T right_elevator_ok;
  boolean_T ground_spoiler_out;
  boolean_T sec_failed;
  boolean_T left_elevator_damping_mode;
  boolean_T right_elevator_damping_mode;
  boolean_T ths_active;
  boolean_T batt_power_supply;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_sec_analog_outputs_
#define DEFINED_TYPEDEF_FOR_base_sec_analog_outputs_

struct base_sec_analog_outputs
{
  real_T left_elev_pos_order_deg;
  real_T right_elev_pos_order_deg;
  real_T ths_pos_order_deg;
  real_T left_spoiler_1_pos_order_deg;
  real_T right_spoiler_1_pos_order_deg;
  real_T left_spoiler_2_pos_order_deg;
  real_T right_spoiler_2_pos_order_deg;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_sec_out_bus_
#define DEFINED_TYPEDEF_FOR_base_sec_out_bus_

struct base_sec_out_bus
{
  base_arinc_429 left_spoiler_1_position_deg;
  base_arinc_429 right_spoiler_1_position_deg;
  base_arinc_429 left_spoiler_2_position_deg;
  base_arinc_429 right_spoiler_2_position_deg;
  base_arinc_429 left_elevator_position_deg;
  base_arinc_429 right_elevator_position_deg;
  base_arinc_429 ths_position_deg;
  base_arinc_429 left_sidestick_pitch_command_deg;
  base_arinc_429 right_sidestick_pitch_command_deg;
  base_arinc_429 left_sidestick_roll_command_deg;
  base_arinc_429 right_sidestick_roll_command_deg;
  base_arinc_429 speed_brake_lever_command_deg;
  base_arinc_429 thrust_lever_angle_1_deg;
  base_arinc_429 thrust_lever_angle_2_deg;
  base_arinc_429 discrete_status_word_1;
  base_arinc_429 discrete_status_word_2;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_sec_outputs_
#define DEFINED_TYPEDEF_FOR_sec_outputs_

struct sec_outputs
{
  sec_inputs data;
  base_sec_laws_outputs laws;
  base_sec_logic_outputs logic;
  base_sec_discrete_outputs discrete_outputs;
  base_sec_analog_outputs analog_outputs;
  base_sec_out_bus bus_outputs;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_lateral_direct_input_
#define DEFINED_TYPEDEF_FOR_lateral_direct_input_

struct lateral_direct_input
{
  base_time time;
  real_T delta_xi_pos;
  boolean_T tracking_mode_on;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_roll_output_
#define DEFINED_TYPEDEF_FOR_base_roll_output_

struct base_roll_output
{
  real_T xi_deg;
  real_T zeta_deg;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_pitch_alternate_input_
#define DEFINED_TYPEDEF_FOR_pitch_alternate_input_

struct pitch_alternate_input
{
  base_time time;
  real_T nz_g;
  real_T Theta_deg;
  real_T Phi_deg;
  real_T qk_deg_s;
  real_T eta_deg;
  real_T eta_trim_deg;
  real_T V_ias_kn;
  real_T mach;
  real_T V_tas_kn;
  real_T CG_percent_MAC;
  real_T total_weight_kg;
  real_T flaps_handle_index;
  real_T spoilers_left_pos;
  real_T spoilers_right_pos;
  real_T delta_eta_pos;
  boolean_T on_ground;
  real_T in_flight;
  boolean_T tracking_mode_on;
  boolean_T stabilities_available;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_pitch_output_
#define DEFINED_TYPEDEF_FOR_base_pitch_output_

struct base_pitch_output
{
  real_T eta_deg;
  real_T eta_trim_dot_deg_s;
  real_T eta_trim_limit_lo;
  real_T eta_trim_limit_up;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_pitch_alternate_data_computed_
#define DEFINED_TYPEDEF_FOR_base_pitch_alternate_data_computed_

struct base_pitch_alternate_data_computed
{
  real_T eta_trim_deg_limit_lo;
  real_T eta_trim_deg_limit_up;
  real_T delta_eta_deg;
  real_T nz_limit_up_g;
  real_T nz_limit_lo_g;
  boolean_T eta_trim_deg_should_freeze;
  boolean_T eta_trim_deg_reset;
  real_T eta_trim_deg_reset_deg;
  boolean_T eta_trim_deg_should_write;
  real_T eta_trim_deg_rate_limit_up_deg_s;
  real_T eta_trim_deg_rate_limit_lo_deg_s;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_pitch_normal_
#define DEFINED_TYPEDEF_FOR_base_pitch_normal_

struct base_pitch_normal
{
  real_T nz_c_g;
  real_T Cstar_g;
  real_T protection_alpha_c_deg;
  real_T protection_V_c_kn;
  real_T eta_dot_deg_s;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_pitch_law_output_
#define DEFINED_TYPEDEF_FOR_base_pitch_law_output_

struct base_pitch_law_output
{
  real_T eta_dot_deg_s;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_pitch_integrated_
#define DEFINED_TYPEDEF_FOR_base_pitch_integrated_

struct base_pitch_integrated
{
  real_T eta_deg;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_pitch_direct_input_
#define DEFINED_TYPEDEF_FOR_pitch_direct_input_

struct pitch_direct_input
{
  base_time time;
  real_T eta_deg;
  real_T flaps_handle_index;
  real_T delta_eta_pos;
  boolean_T tracking_mode_on;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_struct_2OohiAWrazWy5wDS5iisgF_
#define DEFINED_TYPEDEF_FOR_struct_2OohiAWrazWy5wDS5iisgF_

struct struct_2OohiAWrazWy5wDS5iisgF
{
  real_T SSM;
  real_T Data;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_struct_7m2qji9xkXJ1tCsn7SH04E_
#define DEFINED_TYPEDEF_FOR_struct_7m2qji9xkXJ1tCsn7SH04E_

struct struct_7m2qji9xkXJ1tCsn7SH04E
{
  struct_2OohiAWrazWy5wDS5iisgF left_spoiler_1_position_deg;
  struct_2OohiAWrazWy5wDS5iisgF right_spoiler_1_position_deg;
  struct_2OohiAWrazWy5wDS5iisgF left_spoiler_2_position_deg;
  struct_2OohiAWrazWy5wDS5iisgF right_spoiler_2_position_deg;
  struct_2OohiAWrazWy5wDS5iisgF left_elevator_position_deg;
  struct_2OohiAWrazWy5wDS5iisgF right_elevator_position_deg;
  struct_2OohiAWrazWy5wDS5iisgF ths_position_deg;
  struct_2OohiAWrazWy5wDS5iisgF left_sidestick_pitch_command_deg;
  struct_2OohiAWrazWy5wDS5iisgF right_sidestick_pitch_command_deg;
  struct_2OohiAWrazWy5wDS5iisgF left_sidestick_roll_command_deg;
  struct_2OohiAWrazWy5wDS5iisgF right_sidestick_roll_command_deg;
  struct_2OohiAWrazWy5wDS5iisgF speed_brake_lever_command_deg;
  struct_2OohiAWrazWy5wDS5iisgF thrust_lever_angle_1_deg;
  struct_2OohiAWrazWy5wDS5iisgF thrust_lever_angle_2_deg;
  struct_2OohiAWrazWy5wDS5iisgF discrete_status_word_1;
  struct_2OohiAWrazWy5wDS5iisgF discrete_status_word_2;
};

#endif
#endif

