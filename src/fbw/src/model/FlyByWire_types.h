#ifndef RTW_HEADER_FlyByWire_types_h_
#define RTW_HEADER_FlyByWire_types_h_
#include "rtwtypes.h"

#ifndef DEFINED_TYPEDEF_FOR_base_raw_time_
#define DEFINED_TYPEDEF_FOR_base_raw_time_

struct base_raw_time
{
  real_T dt;
  real_T simulation_time;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_raw_data_
#define DEFINED_TYPEDEF_FOR_base_raw_data_

struct base_raw_data
{
  real_T nz_g;
  real_T Theta_deg;
  real_T Phi_deg;
  real_T q_rad_s;
  real_T r_rad_s;
  real_T p_rad_s;
  real_T q_dot_rad_s2;
  real_T r_dot_rad_s2;
  real_T p_dot_rad_s2;
  real_T psi_magnetic_deg;
  real_T psi_true_deg;
  real_T eta_pos;
  real_T eta_trim_deg;
  real_T xi_pos;
  real_T zeta_pos;
  real_T zeta_trim_pos;
  real_T alpha_deg;
  real_T beta_deg;
  real_T beta_dot_deg_s;
  real_T V_ias_kn;
  real_T V_tas_kn;
  real_T V_mach;
  real_T H_ft;
  real_T H_ind_ft;
  real_T H_radio_ft;
  real_T CG_percent_MAC;
  real_T total_weight_kg;
  real_T gear_animation_pos_0;
  real_T gear_animation_pos_1;
  real_T gear_animation_pos_2;
  real_T flaps_handle_index;
  real_T spoilers_left_pos;
  real_T spoilers_right_pos;
  real_T autopilot_master_on;
  real_T slew_on;
  real_T pause_on;
  real_T tracking_mode_on_override;
  real_T autopilot_custom_on;
  real_T autopilot_custom_Theta_c_deg;
  real_T autopilot_custom_Phi_c_deg;
  real_T autopilot_custom_Beta_c_deg;
  real_T simulation_rate;
  real_T ice_structure_percent;
  real_T linear_cl_alpha_per_deg;
  real_T alpha_stall_deg;
  real_T alpha_zero_lift_deg;
  real_T ambient_density_kg_per_m3;
  real_T ambient_pressure_mbar;
  real_T ambient_temperature_celsius;
  real_T ambient_wind_x_kn;
  real_T ambient_wind_y_kn;
  real_T ambient_wind_z_kn;
  real_T ambient_wind_velocity_kn;
  real_T ambient_wind_direction_deg;
  real_T total_air_temperature_celsius;
  real_T latitude_deg;
  real_T longitude_deg;
  real_T engine_1_thrust_lbf;
  real_T engine_2_thrust_lbf;
  real_T thrust_lever_1_pos;
  real_T thrust_lever_2_pos;
  boolean_T tailstrike_protection_on;
  real_T VLS_kn;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_input_
#define DEFINED_TYPEDEF_FOR_base_input_

struct base_input
{
  real_T delta_eta_pos;
  real_T delta_xi_pos;
  real_T delta_zeta_pos;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_fbw_input_
#define DEFINED_TYPEDEF_FOR_fbw_input_

struct fbw_input
{
  base_raw_time time;
  base_raw_data data;
  base_input input;
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

#ifndef DEFINED_TYPEDEF_FOR_base_data_
#define DEFINED_TYPEDEF_FOR_base_data_

struct base_data
{
  real_T nz_g;
  real_T Theta_deg;
  real_T Phi_deg;
  real_T q_deg_s;
  real_T r_deg_s;
  real_T p_deg_s;
  real_T qk_deg_s;
  real_T rk_deg_s;
  real_T pk_deg_s;
  real_T qk_dot_deg_s2;
  real_T rk_dot_deg_s2;
  real_T pk_dot_deg_s2;
  real_T psi_magnetic_deg;
  real_T psi_true_deg;
  real_T eta_deg;
  real_T eta_trim_deg;
  real_T xi_deg;
  real_T zeta_deg;
  real_T zeta_trim_deg;
  real_T alpha_deg;
  real_T beta_deg;
  real_T beta_dot_deg_s;
  real_T V_ias_kn;
  real_T V_tas_kn;
  real_T V_mach;
  real_T H_ft;
  real_T H_ind_ft;
  real_T H_radio_ft;
  real_T CG_percent_MAC;
  real_T total_weight_kg;
  real_T gear_strut_compression_0;
  real_T gear_strut_compression_1;
  real_T gear_strut_compression_2;
  real_T flaps_handle_index;
  real_T spoilers_left_pos;
  real_T spoilers_right_pos;
  real_T autopilot_master_on;
  real_T slew_on;
  real_T pause_on;
  real_T tracking_mode_on_override;
  real_T autopilot_custom_on;
  real_T autopilot_custom_Theta_c_deg;
  real_T autopilot_custom_Phi_c_deg;
  real_T autopilot_custom_Beta_c_deg;
  real_T simulation_rate;
  real_T ice_structure_percent;
  real_T linear_cl_alpha_per_deg;
  real_T alpha_stall_deg;
  real_T alpha_zero_lift_deg;
  real_T ambient_density_kg_per_m3;
  real_T ambient_pressure_mbar;
  real_T ambient_temperature_celsius;
  real_T ambient_wind_x_kn;
  real_T ambient_wind_y_kn;
  real_T ambient_wind_z_kn;
  real_T ambient_wind_velocity_kn;
  real_T ambient_wind_direction_deg;
  real_T total_air_temperature_celsius;
  real_T latitude_deg;
  real_T longitude_deg;
  real_T engine_1_thrust_lbf;
  real_T engine_2_thrust_lbf;
  real_T thrust_lever_1_pos;
  real_T thrust_lever_2_pos;
  boolean_T tailstrike_protection_on;
  real_T VLS_kn;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_data_computed_
#define DEFINED_TYPEDEF_FOR_base_data_computed_

struct base_data_computed
{
  real_T on_ground;
  real_T tracking_mode_on;
  real_T high_aoa_prot_active;
  real_T alpha_floor_command;
  real_T protection_ap_disc;
  real_T high_speed_prot_active;
  real_T high_speed_prot_low_kn;
  real_T high_speed_prot_high_kn;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_data_speeds_aoa_
#define DEFINED_TYPEDEF_FOR_base_data_speeds_aoa_

struct base_data_speeds_aoa
{
  real_T v_alpha_max_kn;
  real_T alpha_max_deg;
  real_T v_alpha_prot_kn;
  real_T alpha_prot_deg;
  real_T alpha_floor_deg;
  real_T alpha_filtered_deg;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_sim_
#define DEFINED_TYPEDEF_FOR_base_sim_

struct base_sim
{
  base_time time;
  base_data data;
  base_data_computed data_computed;
  base_data_speeds_aoa data_speeds_aoa;
  base_input input;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_pitch_data_computed_
#define DEFINED_TYPEDEF_FOR_base_pitch_data_computed_

struct base_pitch_data_computed
{
  real_T eta_trim_deg_limit_lo;
  real_T eta_trim_deg_limit_up;
  real_T delta_eta_deg;
  real_T in_flight;
  real_T in_rotation;
  real_T in_flare;
  real_T in_flight_gain;
  real_T in_rotation_gain;
  real_T nz_limit_up_g;
  real_T nz_limit_lo_g;
  boolean_T eta_trim_deg_should_freeze;
  boolean_T eta_trim_deg_reset;
  real_T eta_trim_deg_reset_deg;
  boolean_T eta_trim_deg_should_write;
  real_T eta_trim_deg_rate_limit_up_deg_s;
  real_T eta_trim_deg_rate_limit_lo_deg_s;
  real_T flare_Theta_deg;
  real_T flare_Theta_c_deg;
  real_T flare_Theta_c_rate_deg_s;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_pitch_rotation_
#define DEFINED_TYPEDEF_FOR_base_pitch_rotation_

struct base_pitch_rotation
{
  real_T qk_c_deg_s;
  real_T eta_deg;
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

#ifndef DEFINED_TYPEDEF_FOR_base_pitch_output_
#define DEFINED_TYPEDEF_FOR_base_pitch_output_

struct base_pitch_output
{
  real_T eta_deg;
  real_T eta_trim_deg;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_pitch_
#define DEFINED_TYPEDEF_FOR_base_pitch_

struct base_pitch
{
  base_pitch_data_computed data_computed;
  base_pitch_rotation law_rotation;
  base_pitch_normal law_normal;
  base_pitch_law_output vote;
  base_pitch_integrated integrated;
  base_pitch_output output;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_roll_data_computed_
#define DEFINED_TYPEDEF_FOR_base_roll_data_computed_

struct base_roll_data_computed
{
  real_T delta_xi_deg;
  real_T delta_zeta_deg;
  real_T in_flight;
  real_T in_flight_gain;
  boolean_T zeta_trim_deg_should_write;
  real_T beta_target_deg;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_roll_normal_
#define DEFINED_TYPEDEF_FOR_base_roll_normal_

struct base_roll_normal
{
  real_T pk_c_deg_s;
  real_T Phi_c_deg;
  real_T xi_deg;
  real_T zeta_deg;
  real_T zeta_tc_yd_deg;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_roll_output_
#define DEFINED_TYPEDEF_FOR_base_roll_output_

struct base_roll_output
{
  real_T xi_deg;
  real_T zeta_deg;
  real_T zeta_trim_deg;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_roll_
#define DEFINED_TYPEDEF_FOR_base_roll_

struct base_roll
{
  base_roll_data_computed data_computed;
  base_roll_normal law_normal;
  base_roll_output output;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_base_raw_output_
#define DEFINED_TYPEDEF_FOR_base_raw_output_

struct base_raw_output
{
  real_T eta_pos;
  real_T eta_trim_deg;
  boolean_T eta_trim_deg_should_write;
  real_T xi_pos;
  real_T zeta_pos;
  real_T zeta_trim_pos;
  boolean_T zeta_trim_pos_should_write;
};

#endif

#ifndef DEFINED_TYPEDEF_FOR_fbw_output_
#define DEFINED_TYPEDEF_FOR_fbw_output_

struct fbw_output
{
  base_sim sim;
  base_pitch pitch;
  base_roll roll;
  base_raw_output output;
};

#endif
#endif

