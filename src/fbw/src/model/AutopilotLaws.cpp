#include "AutopilotLaws.h"
#include "AutopilotLaws_private.h"
#include "look1_binlxpw.h"
#include "mod_mvZvttxs.h"
#include "rt_modd.h"

const uint8_T AutopilotLaws_IN_any{ 1U };

const uint8_T AutopilotLaws_IN_left{ 2U };

const uint8_T AutopilotLaws_IN_right{ 3U };

const uint8_T AutopilotLaws_IN_any_o{ 1U };

const uint8_T AutopilotLaws_IN_left_f{ 2U };

const uint8_T AutopilotLaws_IN_right_l{ 3U };

const uint8_T AutopilotLaws_IN_InAir{ 1U };

const uint8_T AutopilotLaws_IN_OnGround{ 2U };

void AutopilotLawsModelClass::AutopilotLaws_MATLABFunction(real_T rtu_tau, real_T rtu_zeta, real_T *rty_k2, real_T
  *rty_k1)
{
  real_T t;
  t = rtu_tau / 3600.0;
  *rty_k1 = 180.0 / (39.478417604357432 * rtu_zeta * t);
  *rty_k2 = rtu_zeta / (215666.565757755 * t);
}

void AutopilotLawsModelClass::AutopilotLaws_LagFilter(real_T rtu_U, real_T rtu_C1, real_T rtu_dt, real_T *rty_Y,
  rtDW_LagFilter_AutopilotLaws_T *localDW)
{
  real_T ca;
  real_T denom_tmp;
  if ((!localDW->pY_not_empty) || (!localDW->pU_not_empty)) {
    localDW->pU = rtu_U;
    localDW->pU_not_empty = true;
    localDW->pY = rtu_U;
    localDW->pY_not_empty = true;
  }

  denom_tmp = rtu_dt * rtu_C1;
  ca = denom_tmp / (denom_tmp + 2.0);
  *rty_Y = (2.0 - denom_tmp) / (denom_tmp + 2.0) * localDW->pY + (rtu_U * ca + localDW->pU * ca);
  localDW->pY = *rty_Y;
  localDW->pU = rtu_U;
}

void AutopilotLawsModelClass::AutopilotLaws_RateLimiter(real_T rtu_u, real_T rtu_up, real_T rtu_lo, real_T rtu_Ts,
  real_T rtu_init, real_T *rty_Y, rtDW_RateLimiter_AutopilotLaws_T *localDW)
{
  if (!localDW->pY_not_empty) {
    localDW->pY = rtu_init;
    localDW->pY_not_empty = true;
  }

  localDW->pY += std::fmax(std::fmin(rtu_u - localDW->pY, std::abs(rtu_up) * rtu_Ts), -std::abs(rtu_lo) * rtu_Ts);
  *rty_Y = localDW->pY;
}

void AutopilotLawsModelClass::AutopilotLaws_MATLABFunction_f_Init(rtDW_MATLABFunction_AutopilotLaws_d_T *localDW)
{
  localDW->limit = 30.0;
}

void AutopilotLawsModelClass::AutopilotLaws_MATLABFunction_m(real_T rtu_Psi_c, real_T rtu_dPsi, real_T rtu_Phi_c, real_T
  *rty_up, real_T *rty_lo, rtDW_MATLABFunction_AutopilotLaws_d_T *localDW)
{
  static const int8_T b[5]{ 0, 5, 10, 20, 30 };

  static const int8_T c[5]{ 5, 5, 10, 30, 30 };

  boolean_T wasPsiCmdChanged;
  if (!localDW->lastPsi_not_empty) {
    localDW->lastPsi = rtu_Psi_c;
    localDW->lastPsi_not_empty = true;
  }

  wasPsiCmdChanged = (rtu_Psi_c != localDW->lastPsi);
  if (wasPsiCmdChanged || (std::abs(rtu_dPsi) > localDW->limitDeltaPsi)) {
    localDW->limitDeltaPsi = std::abs(rtu_dPsi);
    if (localDW->limitDeltaPsi > 30.0) {
      localDW->limit = 30.0;
    } else {
      real_T r;
      int32_T high_i;
      int32_T low_i;
      int32_T low_ip1;
      high_i = 5;
      low_i = 0;
      low_ip1 = 2;
      while (high_i > low_ip1) {
        int32_T mid_i;
        mid_i = ((low_i + high_i) + 1) >> 1;
        if (localDW->limitDeltaPsi >= b[mid_i - 1]) {
          low_i = mid_i - 1;
          low_ip1 = mid_i + 1;
        } else {
          high_i = mid_i;
        }
      }

      r = (localDW->limitDeltaPsi - static_cast<real_T>(b[low_i])) / static_cast<real_T>(b[low_i + 1] - b[low_i]);
      if (r == 0.0) {
        localDW->limit = c[low_i];
      } else if (r == 1.0) {
        localDW->limit = c[low_i + 1];
      } else if (c[low_i + 1] == c[low_i]) {
        localDW->limit = c[low_i];
      } else {
        localDW->limit = (1.0 - r) * static_cast<real_T>(c[low_i]) + static_cast<real_T>(c[low_i + 1]) * r;
      }
    }
  }

  if ((!wasPsiCmdChanged) && (std::abs(rtu_Phi_c) < localDW->limit)) {
    localDW->limit = 30.0;
  }

  *rty_up = localDW->limit;
  *rty_lo = -localDW->limit;
  localDW->lastPsi = rtu_Psi_c;
}

void AutopilotLawsModelClass::AutopilotLaws_Chart_Init(real_T *rty_out)
{
  *rty_out = 0.0;
}

void AutopilotLawsModelClass::AutopilotLaws_Chart(real_T rtu_right, real_T rtu_left, boolean_T rtu_use_short_path,
  real_T *rty_out, rtDW_Chart_AutopilotLaws_T *localDW)
{
  if (localDW->is_active_c10_AutopilotLaws == 0U) {
    localDW->is_active_c10_AutopilotLaws = 1U;
    localDW->is_c10_AutopilotLaws = AutopilotLaws_IN_any;
    if (std::abs(rtu_left) < std::abs(rtu_right)) {
      *rty_out = rtu_left;
    } else {
      *rty_out = rtu_right;
    }
  } else {
    switch (localDW->is_c10_AutopilotLaws) {
     case AutopilotLaws_IN_any:
      {
        real_T tmp;
        real_T tmp_0;
        boolean_T tmp_1;
        tmp = std::abs(rtu_right);
        tmp_0 = std::abs(rtu_left);
        tmp_1 = !rtu_use_short_path;
        if (tmp_1 && (tmp < tmp_0) && (tmp >= 10.0) && (tmp <= 20.0)) {
          localDW->is_c10_AutopilotLaws = AutopilotLaws_IN_right;
          *rty_out = rtu_right;
        } else if (tmp_1 && (tmp_0 < tmp) && (tmp_0 >= 10.0) && (tmp_0 <= 20.0)) {
          localDW->is_c10_AutopilotLaws = AutopilotLaws_IN_left;
          *rty_out = rtu_left;
        } else if (tmp_0 < tmp) {
          *rty_out = rtu_left;
        } else {
          *rty_out = rtu_right;
        }
      }
      break;

     case AutopilotLaws_IN_left:
      {
        real_T tmp;
        real_T tmp_0;
        tmp = std::abs(rtu_left);
        tmp_0 = std::abs(rtu_right);
        if (rtu_use_short_path || (tmp_0 < 10.0) || (tmp < 10.0)) {
          localDW->is_c10_AutopilotLaws = AutopilotLaws_IN_any;
          if (tmp < tmp_0) {
            *rty_out = rtu_left;
          } else {
            *rty_out = rtu_right;
          }
        } else {
          *rty_out = rtu_left;
        }
      }
      break;

     default:
      {
        real_T tmp;
        real_T tmp_0;
        tmp = std::abs(rtu_left);
        tmp_0 = std::abs(rtu_right);
        if (rtu_use_short_path || (tmp_0 < 10.0) || (tmp < 10.0)) {
          localDW->is_c10_AutopilotLaws = AutopilotLaws_IN_any;
          if (tmp < tmp_0) {
            *rty_out = rtu_left;
          } else {
            *rty_out = rtu_right;
          }
        } else {
          *rty_out = rtu_right;
        }
      }
      break;
    }
  }
}

void AutopilotLawsModelClass::AutopilotLaws_RateLimiter_n(boolean_T rtu_u, real_T rtu_up, real_T rtu_lo, real_T rtu_Ts,
  real_T rtu_init, real_T *rty_Y, rtDW_RateLimiter_AutopilotLaws_l_T *localDW)
{
  if (!localDW->pY_not_empty) {
    localDW->pY = rtu_init;
    localDW->pY_not_empty = true;
  }

  localDW->pY += std::fmax(std::fmin(static_cast<real_T>(rtu_u) - localDW->pY, std::abs(rtu_up) * rtu_Ts), -std::abs
    (rtu_lo) * rtu_Ts);
  *rty_Y = localDW->pY;
}

void AutopilotLawsModelClass::AutopilotLaws_Chart_g_Init(real_T *rty_out)
{
  *rty_out = 0.0;
}

void AutopilotLawsModelClass::AutopilotLaws_Chart_h(real_T rtu_right, real_T rtu_left, real_T rtu_use_short_path, real_T
  *rty_out, rtDW_Chart_AutopilotLaws_m_T *localDW)
{
  if (localDW->is_active_c15_AutopilotLaws == 0U) {
    localDW->is_active_c15_AutopilotLaws = 1U;
    localDW->is_c15_AutopilotLaws = AutopilotLaws_IN_any_o;
    if (std::abs(rtu_left) < std::abs(rtu_right)) {
      *rty_out = rtu_left;
    } else {
      *rty_out = rtu_right;
    }
  } else {
    switch (localDW->is_c15_AutopilotLaws) {
     case AutopilotLaws_IN_any_o:
      {
        real_T tmp;
        real_T tmp_0;
        tmp = std::abs(rtu_right);
        tmp_0 = std::abs(rtu_left);
        if ((rtu_use_short_path == 0.0) && (tmp < tmp_0) && (tmp >= 10.0) && (tmp <= 20.0)) {
          localDW->is_c15_AutopilotLaws = AutopilotLaws_IN_right_l;
          *rty_out = rtu_right;
        } else if ((rtu_use_short_path == 0.0) && (tmp_0 < tmp) && (tmp_0 >= 10.0) && (tmp_0 <= 20.0)) {
          localDW->is_c15_AutopilotLaws = AutopilotLaws_IN_left_f;
          *rty_out = rtu_left;
        } else if (tmp_0 < tmp) {
          *rty_out = rtu_left;
        } else {
          *rty_out = rtu_right;
        }
      }
      break;

     case AutopilotLaws_IN_left_f:
      {
        real_T tmp;
        real_T tmp_0;
        tmp = std::abs(rtu_left);
        tmp_0 = std::abs(rtu_right);
        if ((rtu_use_short_path != 0.0) || (tmp_0 < 10.0) || (tmp < 10.0)) {
          localDW->is_c15_AutopilotLaws = AutopilotLaws_IN_any_o;
          if (tmp < tmp_0) {
            *rty_out = rtu_left;
          } else {
            *rty_out = rtu_right;
          }
        } else {
          *rty_out = rtu_left;
        }
      }
      break;

     default:
      {
        real_T tmp;
        real_T tmp_0;
        tmp = std::abs(rtu_left);
        tmp_0 = std::abs(rtu_right);
        if ((rtu_use_short_path != 0.0) || (tmp_0 < 10.0) || (tmp < 10.0)) {
          localDW->is_c15_AutopilotLaws = AutopilotLaws_IN_any_o;
          if (tmp < tmp_0) {
            *rty_out = rtu_left;
          } else {
            *rty_out = rtu_right;
          }
        } else {
          *rty_out = rtu_right;
        }
      }
      break;
    }
  }
}

void AutopilotLawsModelClass::AutopilotLaws_storevalue(boolean_T rtu_active, real_T rtu_u, real_T *rty_y,
  rtDW_storevalue_AutopilotLaws_T *localDW)
{
  if ((!rtu_active) || (!localDW->storage_not_empty)) {
    localDW->storage = rtu_u;
    localDW->storage_not_empty = true;
  }

  *rty_y = localDW->storage;
}

void AutopilotLawsModelClass::AutopilotLaws_LeadLagFilter(real_T rtu_U, real_T rtu_C1, real_T rtu_C2, real_T rtu_C3,
  real_T rtu_C4, real_T rtu_dt, real_T *rty_Y, rtDW_LeadLagFilter_AutopilotLaws_T *localDW)
{
  real_T denom;
  real_T denom_tmp;
  real_T tmp;
  if ((!localDW->pY_not_empty) || (!localDW->pU_not_empty)) {
    localDW->pU = rtu_U;
    localDW->pU_not_empty = true;
    localDW->pY = rtu_U;
    localDW->pY_not_empty = true;
  }

  denom_tmp = rtu_dt * rtu_C4;
  denom = 2.0 * rtu_C3 + denom_tmp;
  tmp = rtu_dt * rtu_C2;
  *rty_Y = ((2.0 * rtu_C1 + tmp) / denom * rtu_U + (tmp - 2.0 * rtu_C1) / denom * localDW->pU) + (2.0 * rtu_C3 -
    denom_tmp) / denom * localDW->pY;
  localDW->pY = *rty_Y;
  localDW->pU = rtu_U;
}

void AutopilotLawsModelClass::AutopilotLaws_WashoutFilter(real_T rtu_U, real_T rtu_C1, real_T rtu_dt, real_T *rty_Y,
  rtDW_WashoutFilter_AutopilotLaws_T *localDW)
{
  real_T ca;
  real_T denom_tmp;
  if ((!localDW->pY_not_empty) || (!localDW->pU_not_empty)) {
    localDW->pU = rtu_U;
    localDW->pU_not_empty = true;
    localDW->pY = rtu_U;
    localDW->pY_not_empty = true;
  }

  denom_tmp = rtu_dt * rtu_C1;
  ca = 2.0 / (denom_tmp + 2.0);
  *rty_Y = (2.0 - denom_tmp) / (denom_tmp + 2.0) * localDW->pY + (rtu_U * ca - localDW->pU * ca);
  localDW->pY = *rty_Y;
  localDW->pU = rtu_U;
}

void AutopilotLawsModelClass::AutopilotLaws_V_LSSpeedSelection1(real_T rtu_V_c, real_T rtu_VLS, real_T *rty_y)
{
  if (rtu_V_c <= rtu_VLS) {
    *rty_y = rtu_VLS - 5.0;
  } else {
    *rty_y = rtu_VLS;
  }
}

void AutopilotLawsModelClass::AutopilotLaws_SpeedProtectionSignalSelection(const ap_laws_output *rtu_in, real_T
  rtu_VS_FD, real_T rtu_VS_AP, real_T rtu_VLS_FD, real_T rtu_VLS_AP, real_T rtu_VMAX_FD, real_T rtu_VMAX_AP, real_T
  rtu_margin, real_T *rty_FD, real_T *rty_AP)
{
  real_T rtu_in_0;
  if (rtu_in->input.V_c_kn <= rtu_in->data.VLS_kn) {
    rtu_in_0 = rtu_in->data.VLS_kn - 5.0;
  } else {
    rtu_in_0 = rtu_in->data.VLS_kn;
  }

  if (rtu_in->data.V_ias_kn < rtu_in_0 + rtu_margin) {
    *rty_FD = std::fmin(rtu_VS_FD, rtu_VLS_FD);
    *rty_AP = std::fmin(rtu_VS_AP, rtu_VLS_AP);
  } else if (rtu_in->data.V_ias_kn > rtu_in->data.VMAX_kn - rtu_margin) {
    *rty_FD = std::fmax(rtu_VS_FD, rtu_VMAX_FD);
    *rty_AP = std::fmax(rtu_VS_AP, rtu_VMAX_AP);
  } else {
    *rty_FD = rtu_VS_FD;
    *rty_AP = rtu_VS_AP;
  }
}

void AutopilotLawsModelClass::AutopilotLaws_VSLimiter(real_T rtu_u, const ap_laws_output *rtu_in, real_T *rty_y)
{
  real_T limit;
  limit = 9.81 / (rtu_in->data.V_tas_kn * 0.51444444444444448) * 0.15 * 57.295779513082323;
  *rty_y = std::fmax(-limit, std::fmin(limit, rtu_u));
}

void AutopilotLawsModelClass::AutopilotLaws_VSLimiter_f(real_T rtu_u, const ap_laws_output *rtu_in, real_T *rty_y)
{
  real_T limit;
  limit = 9.81 / (rtu_in->data.V_tas_kn * 0.51444444444444448) * 0.3 * 57.295779513082323;
  *rty_y = std::fmax(-limit, std::fmin(limit, rtu_u));
}

void AutopilotLawsModelClass::AutopilotLaws_SignalEnablerGSTrack(real_T rtu_u, boolean_T rtu_e, real_T *rty_y)
{
  if (rtu_e) {
    *rty_y = rtu_u;
  } else {
    *rty_y = 0.0;
  }
}

void AutopilotLawsModelClass::AutopilotLaws_Voter1(real_T rtu_u1, real_T rtu_u2, real_T rtu_u3, real_T *rty_Y)
{
  real_T v[3];
  int32_T rtu_u1_0;
  v[0] = rtu_u1;
  v[1] = rtu_u2;
  v[2] = rtu_u3;
  if (rtu_u1 < rtu_u2) {
    if (rtu_u2 < rtu_u3) {
      rtu_u1_0 = 1;
    } else if (rtu_u1 < rtu_u3) {
      rtu_u1_0 = 2;
    } else {
      rtu_u1_0 = 0;
    }
  } else if (rtu_u1 < rtu_u3) {
    rtu_u1_0 = 0;
  } else if (rtu_u2 < rtu_u3) {
    rtu_u1_0 = 2;
  } else {
    rtu_u1_0 = 1;
  }

  *rty_Y = v[rtu_u1_0];
}

void AutopilotLawsModelClass::step()
{
  static const int8_T b[5]{ 15, 30, 30, 19, 19 };

  real_T result_tmp[9];
  real_T result[3];
  real_T result_0[3];
  real_T L;
  real_T Phi2;
  real_T R;
  real_T a;
  real_T b_L;
  real_T b_R;
  real_T distance_m;
  real_T rtb_Add3_aj;
  real_T rtb_Add3_g;
  real_T rtb_Add3_i;
  real_T rtb_Add3_j4;
  real_T rtb_Add3_lz;
  real_T rtb_Cos1_j;
  real_T rtb_Cos1_pk;
  real_T rtb_Cos_i;
  real_T rtb_FD_h;
  real_T rtb_Gain1_pj;
  real_T rtb_Gain4;
  real_T rtb_GainTheta;
  real_T rtb_GainTheta1;
  real_T rtb_Gain_n4;
  real_T rtb_Product_dh;
  real_T rtb_Saturation;
  real_T rtb_Sum1_g;
  real_T rtb_Sum3_m3;
  real_T rtb_Sum_es;
  real_T rtb_Sum_i;
  real_T rtb_Sum_kq;
  real_T rtb_Vz;
  real_T rtb_Y_i;
  real_T rtb_Y_j;
  real_T rtb_Y_pf;
  real_T rtb_dme;
  real_T rtb_error_d;
  real_T rtb_lo_b;
  real_T rtb_lo_k;
  real_T rtb_uDLookupTable_m;
  int32_T i;
  int32_T rtb_fpmtoms;
  int32_T rtb_on_ground;
  boolean_T guard1{ false };

  boolean_T rtb_Compare_jy;
  boolean_T rtb_Compare_l;
  boolean_T rtb_Delay_j;
  boolean_T rtb_valid;
  boolean_T rtb_valid_d;
  rtb_fpmtoms = ((AutopilotLaws_U.in.input.enabled_AP1 != 0.0) || (AutopilotLaws_U.in.input.enabled_AP2 != 0.0));
  rtb_GainTheta = AutopilotLaws_P.GainTheta_Gain * AutopilotLaws_U.in.data.Theta_deg;
  rtb_GainTheta1 = AutopilotLaws_P.GainTheta1_Gain * AutopilotLaws_U.in.data.Phi_deg;
  b_R = 0.017453292519943295 * rtb_GainTheta;
  rtb_dme = 0.017453292519943295 * rtb_GainTheta1;
  Phi2 = std::tan(b_R);
  a = std::sin(rtb_dme);
  rtb_dme = std::cos(rtb_dme);
  result_tmp[0] = 1.0;
  result_tmp[3] = a * Phi2;
  result_tmp[6] = rtb_dme * Phi2;
  result_tmp[1] = 0.0;
  result_tmp[4] = rtb_dme;
  result_tmp[7] = -a;
  result_tmp[2] = 0.0;
  distance_m = std::cos(b_R);
  rtb_Add3_j4 = 1.0 / distance_m;
  result_tmp[5] = rtb_Add3_j4 * a;
  result_tmp[8] = rtb_Add3_j4 * rtb_dme;
  rtb_error_d = AutopilotLaws_P.Gain_Gain_de * AutopilotLaws_U.in.data.p_rad_s * AutopilotLaws_P.Gainpk_Gain;
  rtb_Saturation = AutopilotLaws_P.Gain_Gain_d * AutopilotLaws_U.in.data.q_rad_s * AutopilotLaws_P.Gainqk_Gain;
  Phi2 = AutopilotLaws_P.Gain_Gain_m * AutopilotLaws_U.in.data.r_rad_s;
  for (rtb_on_ground = 0; rtb_on_ground < 3; rtb_on_ground++) {
    result[rtb_on_ground] = (result_tmp[rtb_on_ground + 3] * rtb_Saturation + result_tmp[rtb_on_ground] * rtb_error_d) +
      result_tmp[rtb_on_ground + 6] * Phi2;
  }

  rtb_error_d = std::sin(b_R);
  result_tmp[0] = distance_m;
  result_tmp[3] = 0.0;
  result_tmp[6] = -rtb_error_d;
  result_tmp[1] = a * rtb_error_d;
  result_tmp[4] = rtb_dme;
  result_tmp[7] = distance_m * a;
  result_tmp[2] = rtb_dme * rtb_error_d;
  result_tmp[5] = 0.0 - a;
  result_tmp[8] = rtb_dme * distance_m;
  for (rtb_on_ground = 0; rtb_on_ground < 3; rtb_on_ground++) {
    result_0[rtb_on_ground] = (result_tmp[rtb_on_ground + 3] * AutopilotLaws_U.in.data.by_m_s2 +
      result_tmp[rtb_on_ground] * AutopilotLaws_U.in.data.bx_m_s2) + result_tmp[rtb_on_ground + 6] *
      AutopilotLaws_U.in.data.bz_m_s2;
  }

  if (AutopilotLaws_U.in.data.nav_dme_valid != 0.0) {
    rtb_dme = AutopilotLaws_U.in.data.nav_dme_nmi;
  } else if (AutopilotLaws_U.in.data.nav_loc_valid) {
    a = std::sin((AutopilotLaws_U.in.data.nav_loc_position.lat - AutopilotLaws_U.in.data.aircraft_position.lat) *
                 0.017453292519943295 / 2.0);
    distance_m = std::sin((AutopilotLaws_U.in.data.nav_loc_position.lon - AutopilotLaws_U.in.data.aircraft_position.lon)
                          * 0.017453292519943295 / 2.0);
    a = std::cos(0.017453292519943295 * AutopilotLaws_U.in.data.aircraft_position.lat) * std::cos(0.017453292519943295 *
      AutopilotLaws_U.in.data.nav_loc_position.lat) * distance_m * distance_m + a * a;
    rtb_dme = std::atan2(std::sqrt(a), std::sqrt(1.0 - a)) * 2.0 * 6.371E+6;
    distance_m = AutopilotLaws_U.in.data.aircraft_position.alt - AutopilotLaws_U.in.data.nav_loc_position.alt;
    rtb_dme = std::sqrt(rtb_dme * rtb_dme + distance_m * distance_m) / 1852.0;
  } else {
    rtb_dme = 0.0;
  }

  rtb_error_d = 0.017453292519943295 * AutopilotLaws_U.in.data.aircraft_position.lat;
  Phi2 = 0.017453292519943295 * AutopilotLaws_U.in.data.nav_loc_position.lat;
  rtb_Saturation = 0.017453292519943295 * AutopilotLaws_U.in.data.aircraft_position.lon;
  a = std::sin((AutopilotLaws_U.in.data.nav_loc_position.lat - AutopilotLaws_U.in.data.aircraft_position.lat) *
               0.017453292519943295 / 2.0);
  distance_m = std::sin((AutopilotLaws_U.in.data.nav_loc_position.lon - AutopilotLaws_U.in.data.aircraft_position.lon) *
                        0.017453292519943295 / 2.0);
  a = std::cos(rtb_error_d) * std::cos(Phi2) * distance_m * distance_m + a * a;
  distance_m = std::atan2(std::sqrt(a), std::sqrt(1.0 - a)) * 2.0 * 6.371E+6;
  a = AutopilotLaws_U.in.data.aircraft_position.alt - AutopilotLaws_U.in.data.nav_loc_position.alt;
  L = std::cos(Phi2);
  R = 0.017453292519943295 * AutopilotLaws_U.in.data.nav_loc_position.lon - rtb_Saturation;
  b_L = mod_mvZvttxs((mod_mvZvttxs(mod_mvZvttxs(360.0) + 360.0) - (mod_mvZvttxs(mod_mvZvttxs
    (AutopilotLaws_U.in.data.nav_loc_magvar_deg) + 360.0) + 360.0)) + 360.0);
  b_R = mod_mvZvttxs(360.0 - b_L);
  if (std::abs(b_L) < std::abs(b_R)) {
    b_R = -b_L;
  }

  rtb_Add3_j4 = std::cos(rtb_error_d);
  rtb_error_d = std::sin(rtb_error_d);
  L = mod_mvZvttxs(mod_mvZvttxs(mod_mvZvttxs(std::atan2(std::sin(R) * L, rtb_Add3_j4 * std::sin(Phi2) - rtb_error_d * L *
    std::cos(R)) * 57.295779513082323 + 360.0)) + 360.0) + 360.0;
  Phi2 = mod_mvZvttxs((mod_mvZvttxs(mod_mvZvttxs(mod_mvZvttxs(mod_mvZvttxs(AutopilotLaws_U.in.data.nav_loc_deg - b_R) +
    360.0)) + 360.0) - L) + 360.0);
  b_R = mod_mvZvttxs(360.0 - Phi2);
  guard1 = false;
  if (std::abs(std::sqrt(distance_m * distance_m + a * a) / 1852.0) < 30.0) {
    L = mod_mvZvttxs((mod_mvZvttxs(mod_mvZvttxs(AutopilotLaws_U.in.data.nav_loc_deg) + 360.0) - L) + 360.0);
    R = mod_mvZvttxs(360.0 - L);
    if (std::abs(L) < std::abs(R)) {
      R = -L;
    }

    if ((std::abs(R) < 90.0) && ((AutopilotLaws_U.in.data.nav_loc_position.lat != 0.0) ||
         (AutopilotLaws_U.in.data.nav_loc_position.lon != 0.0) || (AutopilotLaws_U.in.data.nav_loc_position.alt != 0.0)))
    {
      rtb_valid = true;
      if (std::abs(Phi2) < std::abs(b_R)) {
        b_R = -Phi2;
      }
    } else {
      guard1 = true;
    }
  } else {
    guard1 = true;
  }

  if (guard1) {
    rtb_valid = false;
    b_R = 0.0;
  }

  if (AutopilotLaws_U.in.data.nav_gs_valid || (!AutopilotLaws_DWork.nav_gs_deg_not_empty)) {
    AutopilotLaws_DWork.nav_gs_deg = AutopilotLaws_U.in.data.nav_gs_deg;
    AutopilotLaws_DWork.nav_gs_deg_not_empty = true;
  }

  Phi2 = 0.017453292519943295 * AutopilotLaws_U.in.data.nav_gs_position.lat;
  a = std::sin((AutopilotLaws_U.in.data.nav_gs_position.lat - AutopilotLaws_U.in.data.aircraft_position.lat) *
               0.017453292519943295 / 2.0);
  distance_m = std::sin((AutopilotLaws_U.in.data.nav_gs_position.lon - AutopilotLaws_U.in.data.aircraft_position.lon) *
                        0.017453292519943295 / 2.0);
  L = std::cos(Phi2);
  a = rtb_Add3_j4 * L * distance_m * distance_m + a * a;
  distance_m = std::atan2(std::sqrt(a), std::sqrt(1.0 - a)) * 2.0 * 6.371E+6;
  a = AutopilotLaws_U.in.data.aircraft_position.alt - AutopilotLaws_U.in.data.nav_gs_position.alt;
  distance_m = std::sqrt(distance_m * distance_m + a * a);
  rtb_Saturation = 0.017453292519943295 * AutopilotLaws_U.in.data.nav_gs_position.lon - rtb_Saturation;
  rtb_Saturation = std::atan2(std::sin(rtb_Saturation) * L, rtb_Add3_j4 * std::sin(Phi2) - rtb_error_d * L * std::cos
    (rtb_Saturation)) * 57.295779513082323;
  if (rtb_Saturation + 360.0 == 0.0) {
    rtb_error_d = 0.0;
  } else {
    rtb_error_d = std::fmod(rtb_Saturation + 360.0, 360.0);
    if (rtb_error_d == 0.0) {
      rtb_error_d = 0.0;
    } else if (rtb_Saturation + 360.0 < 0.0) {
      rtb_error_d += 360.0;
    }
  }

  guard1 = false;
  if (std::abs(distance_m / 1852.0) < 30.0) {
    if (AutopilotLaws_U.in.data.nav_loc_deg == 0.0) {
      Phi2 = 0.0;
    } else {
      Phi2 = std::fmod(AutopilotLaws_U.in.data.nav_loc_deg, 360.0);
      if (Phi2 == 0.0) {
        Phi2 = 0.0;
      } else if (AutopilotLaws_U.in.data.nav_loc_deg < 0.0) {
        Phi2 += 360.0;
      }
    }

    if (rtb_error_d == 0.0) {
      rtb_Saturation = 0.0;
    } else {
      rtb_Saturation = std::fmod(rtb_error_d, 360.0);
      if (rtb_Saturation == 0.0) {
        rtb_Saturation = 0.0;
      } else if (rtb_error_d < 0.0) {
        rtb_Saturation += 360.0;
      }
    }

    if (Phi2 + 360.0 == 0.0) {
      Phi2 = 0.0;
    } else {
      Phi2 = std::fmod(Phi2 + 360.0, 360.0);
    }

    if (rtb_Saturation + 360.0 == 0.0) {
      rtb_Saturation = 0.0;
    } else {
      rtb_Saturation = std::fmod(rtb_Saturation + 360.0, 360.0);
    }

    rtb_error_d = (Phi2 - (rtb_Saturation + 360.0)) + 360.0;
    if (rtb_error_d == 0.0) {
      L = 0.0;
    } else {
      L = std::fmod(rtb_error_d, 360.0);
      if (L == 0.0) {
        L = 0.0;
      } else if (rtb_error_d < 0.0) {
        L += 360.0;
      }
    }

    if (360.0 - L == 0.0) {
      R = 0.0;
    } else {
      R = std::fmod(360.0 - L, 360.0);
      if (R == 0.0) {
        R = 0.0;
      } else if (360.0 - L < 0.0) {
        R += 360.0;
      }
    }

    if (std::abs(L) < std::abs(R)) {
      R = -L;
    }

    if ((std::abs(R) < 90.0) && ((AutopilotLaws_U.in.data.nav_gs_position.lat != 0.0) ||
         (AutopilotLaws_U.in.data.nav_gs_position.lon != 0.0) || (AutopilotLaws_U.in.data.nav_gs_position.alt != 0.0)))
    {
      rtb_valid_d = true;
      rtb_error_d = std::asin(a / distance_m) * 57.295779513082323 - AutopilotLaws_DWork.nav_gs_deg;
    } else {
      guard1 = true;
    }
  } else {
    guard1 = true;
  }

  if (guard1) {
    rtb_valid_d = false;
    rtb_error_d = 0.0;
  }

  rtb_Saturation = AutopilotLaws_P.Gain_Gain_n * AutopilotLaws_U.in.data.gear_strut_compression_1 -
    AutopilotLaws_P.Constant1_Value_b;
  if (rtb_Saturation > AutopilotLaws_P.Saturation_UpperSat_p) {
    rtb_Saturation = AutopilotLaws_P.Saturation_UpperSat_p;
  } else if (rtb_Saturation < AutopilotLaws_P.Saturation_LowerSat_g) {
    rtb_Saturation = AutopilotLaws_P.Saturation_LowerSat_g;
  }

  Phi2 = AutopilotLaws_P.Gain1_Gain_ll * AutopilotLaws_U.in.data.gear_strut_compression_2 -
    AutopilotLaws_P.Constant1_Value_b;
  if (Phi2 > AutopilotLaws_P.Saturation1_UpperSat_j) {
    Phi2 = AutopilotLaws_P.Saturation1_UpperSat_j;
  } else if (Phi2 < AutopilotLaws_P.Saturation1_LowerSat_d) {
    Phi2 = AutopilotLaws_P.Saturation1_LowerSat_d;
  }

  if (AutopilotLaws_DWork.is_active_c5_AutopilotLaws == 0U) {
    AutopilotLaws_DWork.is_active_c5_AutopilotLaws = 1U;
    AutopilotLaws_DWork.is_c5_AutopilotLaws = AutopilotLaws_IN_OnGround;
    rtb_on_ground = 1;
  } else if (AutopilotLaws_DWork.is_c5_AutopilotLaws == 1) {
    if ((rtb_Saturation > 0.05) || (Phi2 > 0.05)) {
      AutopilotLaws_DWork.is_c5_AutopilotLaws = AutopilotLaws_IN_OnGround;
      rtb_on_ground = 1;
    } else {
      rtb_on_ground = 0;
    }
  } else if ((rtb_Saturation == 0.0) && (Phi2 == 0.0)) {
    AutopilotLaws_DWork.is_c5_AutopilotLaws = AutopilotLaws_IN_InAir;
    rtb_on_ground = 0;
  } else {
    rtb_on_ground = 1;
  }

  rtb_Compare_jy = (AutopilotLaws_U.in.data.altimeter_setting_left_mbar != AutopilotLaws_DWork.DelayInput1_DSTATE);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_DWork.DelayInput1_DSTATE_g;
  AutopilotLaws_Y.out = AutopilotLaws_P.ap_laws_output_MATLABStruct;
  AutopilotLaws_Y.out.output.ap_on = rtb_fpmtoms;
  AutopilotLaws_Y.out.time = AutopilotLaws_U.in.time;
  AutopilotLaws_Y.out.data.aircraft_position = AutopilotLaws_U.in.data.aircraft_position;
  AutopilotLaws_Y.out.data.Theta_deg = rtb_GainTheta;
  AutopilotLaws_Y.out.data.Phi_deg = rtb_GainTheta1;
  AutopilotLaws_Y.out.data.qk_deg_s = result[1];
  AutopilotLaws_Y.out.data.rk_deg_s = result[2];
  AutopilotLaws_Y.out.data.pk_deg_s = result[0];
  AutopilotLaws_Y.out.data.V_ias_kn = AutopilotLaws_U.in.data.V_ias_kn;
  AutopilotLaws_Y.out.data.V_tas_kn = AutopilotLaws_U.in.data.V_tas_kn;
  AutopilotLaws_Y.out.data.V_mach = AutopilotLaws_U.in.data.V_mach;
  AutopilotLaws_Y.out.data.V_gnd_kn = AutopilotLaws_U.in.data.V_gnd_kn;
  AutopilotLaws_Y.out.data.alpha_deg = AutopilotLaws_U.in.data.alpha_deg;
  AutopilotLaws_Y.out.data.beta_deg = AutopilotLaws_U.in.data.beta_deg;
  AutopilotLaws_Y.out.data.H_ft = AutopilotLaws_U.in.data.H_ft;
  AutopilotLaws_Y.out.data.H_ind_ft = AutopilotLaws_U.in.data.H_ind_ft;
  AutopilotLaws_Y.out.data.H_radio_ft = AutopilotLaws_U.in.data.H_radio_ft;
  AutopilotLaws_Y.out.data.H_dot_ft_min = AutopilotLaws_U.in.data.H_dot_ft_min;
  AutopilotLaws_Y.out.data.Psi_magnetic_deg = AutopilotLaws_U.in.data.Psi_magnetic_deg;
  AutopilotLaws_Y.out.data.Psi_magnetic_track_deg = AutopilotLaws_U.in.data.Psi_magnetic_track_deg;
  AutopilotLaws_Y.out.data.Psi_true_deg = AutopilotLaws_U.in.data.Psi_true_deg;
  AutopilotLaws_Y.out.data.ax_m_s2 = result_0[0];
  AutopilotLaws_Y.out.data.ay_m_s2 = result_0[1];
  AutopilotLaws_Y.out.data.az_m_s2 = result_0[2];
  AutopilotLaws_Y.out.data.bx_m_s2 = AutopilotLaws_U.in.data.bx_m_s2;
  AutopilotLaws_Y.out.data.by_m_s2 = AutopilotLaws_U.in.data.by_m_s2;
  AutopilotLaws_Y.out.data.bz_m_s2 = AutopilotLaws_U.in.data.bz_m_s2;
  AutopilotLaws_Y.out.data.nav_valid = AutopilotLaws_U.in.data.nav_valid;
  AutopilotLaws_Y.out.data.nav_loc_deg = AutopilotLaws_U.in.data.nav_loc_deg;
  AutopilotLaws_Y.out.data.nav_gs_deg = AutopilotLaws_P.Gain3_Gain_a * AutopilotLaws_U.in.data.nav_gs_deg;
  AutopilotLaws_Y.out.data.nav_dme_valid = AutopilotLaws_U.in.data.nav_dme_valid;
  AutopilotLaws_Y.out.data.nav_dme_nmi = rtb_dme;
  AutopilotLaws_Y.out.data.nav_loc_valid = AutopilotLaws_U.in.data.nav_loc_valid;
  AutopilotLaws_Y.out.data.nav_loc_magvar_deg = AutopilotLaws_U.in.data.nav_loc_magvar_deg;
  AutopilotLaws_Y.out.data.nav_loc_error_deg = AutopilotLaws_U.in.data.nav_loc_error_deg;
  AutopilotLaws_Y.out.data.nav_loc_position = AutopilotLaws_U.in.data.nav_loc_position;
  AutopilotLaws_Y.out.data.nav_e_loc_valid = rtb_valid;
  AutopilotLaws_Y.out.data.nav_e_loc_error_deg = b_R;
  AutopilotLaws_Y.out.data.nav_gs_valid = AutopilotLaws_U.in.data.nav_gs_valid;
  AutopilotLaws_Y.out.data.nav_gs_error_deg = AutopilotLaws_U.in.data.nav_gs_error_deg;
  AutopilotLaws_Y.out.data.nav_gs_position = AutopilotLaws_U.in.data.nav_gs_position;
  AutopilotLaws_Y.out.data.nav_e_gs_valid = rtb_valid_d;
  AutopilotLaws_Y.out.data.nav_e_gs_error_deg = rtb_error_d;
  AutopilotLaws_Y.out.data.flight_guidance_xtk_nmi = AutopilotLaws_U.in.data.flight_guidance_xtk_nmi;
  AutopilotLaws_Y.out.data.flight_guidance_tae_deg = AutopilotLaws_U.in.data.flight_guidance_tae_deg;
  AutopilotLaws_Y.out.data.flight_guidance_phi_deg = AutopilotLaws_U.in.data.flight_guidance_phi_deg;
  AutopilotLaws_Y.out.data.flight_guidance_phi_limit_deg = AutopilotLaws_U.in.data.flight_guidance_phi_limit_deg;
  AutopilotLaws_Y.out.data.flight_phase = AutopilotLaws_U.in.data.flight_phase;
  AutopilotLaws_Y.out.data.V2_kn = AutopilotLaws_U.in.data.V2_kn;
  AutopilotLaws_Y.out.data.VAPP_kn = AutopilotLaws_U.in.data.VAPP_kn;
  AutopilotLaws_Y.out.data.VLS_kn = AutopilotLaws_U.in.data.VLS_kn;
  AutopilotLaws_Y.out.data.VMAX_kn = AutopilotLaws_U.in.data.VMAX_kn;
  AutopilotLaws_Y.out.data.is_flight_plan_available = AutopilotLaws_U.in.data.is_flight_plan_available;
  AutopilotLaws_Y.out.data.altitude_constraint_ft = AutopilotLaws_U.in.data.altitude_constraint_ft;
  AutopilotLaws_Y.out.data.thrust_reduction_altitude = AutopilotLaws_U.in.data.thrust_reduction_altitude;
  AutopilotLaws_Y.out.data.thrust_reduction_altitude_go_around =
    AutopilotLaws_U.in.data.thrust_reduction_altitude_go_around;
  AutopilotLaws_Y.out.data.acceleration_altitude = AutopilotLaws_U.in.data.acceleration_altitude;
  AutopilotLaws_Y.out.data.acceleration_altitude_engine_out = AutopilotLaws_U.in.data.acceleration_altitude_engine_out;
  AutopilotLaws_Y.out.data.acceleration_altitude_go_around = AutopilotLaws_U.in.data.acceleration_altitude_go_around;
  AutopilotLaws_Y.out.data.acceleration_altitude_go_around_engine_out =
    AutopilotLaws_U.in.data.acceleration_altitude_go_around_engine_out;
  AutopilotLaws_Y.out.data.cruise_altitude = AutopilotLaws_U.in.data.cruise_altitude;
  AutopilotLaws_Y.out.data.on_ground = rtb_on_ground;
  AutopilotLaws_Y.out.data.zeta_deg = AutopilotLaws_P.Gain2_Gain_b * AutopilotLaws_U.in.data.zeta_pos;
  AutopilotLaws_Y.out.data.throttle_lever_1_pos = AutopilotLaws_U.in.data.throttle_lever_1_pos;
  AutopilotLaws_Y.out.data.throttle_lever_2_pos = AutopilotLaws_U.in.data.throttle_lever_2_pos;
  AutopilotLaws_Y.out.data.flaps_handle_index = AutopilotLaws_U.in.data.flaps_handle_index;
  AutopilotLaws_Y.out.data.is_engine_operative_1 = AutopilotLaws_U.in.data.is_engine_operative_1;
  AutopilotLaws_Y.out.data.is_engine_operative_2 = AutopilotLaws_U.in.data.is_engine_operative_2;
  AutopilotLaws_Y.out.data.altimeter_setting_changed = (rtb_Compare_jy ||
    (AutopilotLaws_U.in.data.altimeter_setting_right_mbar != AutopilotLaws_DWork.DelayInput1_DSTATE));
  AutopilotLaws_Y.out.data.total_weight_kg = AutopilotLaws_U.in.data.total_weight_kg;
  AutopilotLaws_Y.out.input = AutopilotLaws_U.in.input;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_U.in.data.Psi_true_deg + AutopilotLaws_P.Constant3_Value_e;
  AutopilotLaws_DWork.DelayInput1_DSTATE = (AutopilotLaws_U.in.data.Psi_magnetic_deg -
    AutopilotLaws_DWork.DelayInput1_DSTATE) + AutopilotLaws_P.Constant3_Value_e;
  b_R = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE, AutopilotLaws_P.Constant3_Value_e);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Constant3_Value_e - b_R;
  rtb_error_d = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE, AutopilotLaws_P.Constant3_Value_e);
  if (b_R < rtb_error_d) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain1_Gain_h * b_R;
  } else {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain_Gain_e * rtb_error_d;
  }

  AutopilotLaws_DWork.DelayInput1_DSTATE += AutopilotLaws_U.in.data.Psi_magnetic_track_deg;
  AutopilotLaws_DWork.DelayInput1_DSTATE = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE,
    AutopilotLaws_P.Constant3_Value_b);
  AutopilotLaws_DWork.DelayInput1_DSTATE += AutopilotLaws_P.Constant3_Value_b;
  AutopilotLaws_DWork.DelayInput1_DSTATE = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE,
    AutopilotLaws_P.Constant3_Value_b);
  rtb_Saturation = AutopilotLaws_U.in.data.nav_loc_deg - AutopilotLaws_U.in.data.nav_loc_magvar_deg;
  R = rt_modd(rt_modd(rtb_Saturation, AutopilotLaws_P.Constant3_Value_n) + AutopilotLaws_P.Constant3_Value_n,
              AutopilotLaws_P.Constant3_Value_n);
  b_R = rt_modd((AutopilotLaws_DWork.DelayInput1_DSTATE - (R + AutopilotLaws_P.Constant3_Value_i)) +
                AutopilotLaws_P.Constant3_Value_i, AutopilotLaws_P.Constant3_Value_i);
  Phi2 = rt_modd(AutopilotLaws_P.Constant3_Value_i - b_R, AutopilotLaws_P.Constant3_Value_i);
  if (AutopilotLaws_P.ManualSwitch_CurrentSetting == 1) {
    rtb_error_d = AutopilotLaws_P.Constant_Value_d;
  } else {
    rtb_error_d = AutopilotLaws_U.in.input.lateral_law;
  }

  rtb_valid = (rtb_error_d == AutopilotLaws_P.CompareToConstant2_const);
  if (b_R < Phi2) {
    b_R *= AutopilotLaws_P.Gain1_Gain;
  } else {
    b_R = AutopilotLaws_P.Gain_Gain * Phi2;
  }

  b_R = std::abs(b_R);
  if (!AutopilotLaws_DWork.limit_not_empty) {
    AutopilotLaws_DWork.limit = b_R;
    AutopilotLaws_DWork.limit_not_empty = true;
  }

  if (!rtb_valid) {
    AutopilotLaws_DWork.limit = std::fmin(std::fmax(b_R, 15.0), 115.0);
  }

  if (rtb_valid && (b_R < 15.0)) {
    AutopilotLaws_DWork.limit = 15.0;
  }

  AutopilotLaws_MATLABFunction(AutopilotLaws_P.tau_Value, AutopilotLaws_P.zeta_Value, &Phi2, &rtb_lo_k);
  if (rtb_dme > AutopilotLaws_P.Saturation_UpperSat_b) {
    b_R = AutopilotLaws_P.Saturation_UpperSat_b;
  } else if (rtb_dme < AutopilotLaws_P.Saturation_LowerSat_n) {
    b_R = AutopilotLaws_P.Saturation_LowerSat_n;
  } else {
    b_R = rtb_dme;
  }

  b_R = std::sin(AutopilotLaws_P.Gain1_Gain_f * AutopilotLaws_U.in.data.nav_loc_error_deg) * b_R *
    AutopilotLaws_P.Gain_Gain_h * rtb_lo_k / AutopilotLaws_U.in.data.V_gnd_kn;
  AutopilotLaws_DWork.DelayInput1_DSTATE = (AutopilotLaws_DWork.DelayInput1_DSTATE - (rt_modd(rt_modd
    (AutopilotLaws_U.in.data.nav_loc_error_deg + R, AutopilotLaws_P.Constant3_Value_c2) +
    AutopilotLaws_P.Constant3_Value_c2, AutopilotLaws_P.Constant3_Value_c2) + AutopilotLaws_P.Constant3_Value_p)) +
    AutopilotLaws_P.Constant3_Value_p;
  a = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE, AutopilotLaws_P.Constant3_Value_p);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Constant3_Value_p - a;
  distance_m = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE, AutopilotLaws_P.Constant3_Value_p);
  if (a < distance_m) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain1_Gain_p * a;
  } else {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain_Gain_a * distance_m;
  }

  if (b_R > AutopilotLaws_DWork.limit) {
    b_R = AutopilotLaws_DWork.limit;
  } else if (b_R < -AutopilotLaws_DWork.limit) {
    b_R = -AutopilotLaws_DWork.limit;
  }

  AutopilotLaws_DWork.DelayInput1_DSTATE = (AutopilotLaws_P.Gain2_Gain_i * AutopilotLaws_DWork.DelayInput1_DSTATE + b_R)
    * Phi2;
  a = AutopilotLaws_DWork.DelayInput1_DSTATE * AutopilotLaws_U.in.data.V_gnd_kn;
  AutopilotLaws_RateLimiter_n(rtb_error_d == AutopilotLaws_P.CompareToConstant1_const,
    AutopilotLaws_P.RateLimiterVariableTs_up, AutopilotLaws_P.RateLimiterVariableTs_lo, AutopilotLaws_U.in.time.dt,
    AutopilotLaws_P.RateLimiterVariableTs_InitialCondition, &rtb_Y_pf, &AutopilotLaws_DWork.sf_RateLimiter_n);
  AutopilotLaws_LagFilter(AutopilotLaws_U.in.data.nav_loc_error_deg, AutopilotLaws_P.LagFilter2_C1,
    AutopilotLaws_U.in.time.dt, &Phi2, &AutopilotLaws_DWork.sf_LagFilter_h);
  b_R = AutopilotLaws_P.DiscreteDerivativeVariableTs_Gain * Phi2;
  AutopilotLaws_DWork.DelayInput1_DSTATE = b_R - AutopilotLaws_DWork.Delay_DSTATE;
  AutopilotLaws_DWork.DelayInput1_DSTATE /= AutopilotLaws_U.in.time.dt;
  AutopilotLaws_LagFilter(Phi2 + AutopilotLaws_P.Gain3_Gain_i * AutopilotLaws_DWork.DelayInput1_DSTATE,
    AutopilotLaws_P.LagFilter_C1, AutopilotLaws_U.in.time.dt, &rtb_Y_i, &AutopilotLaws_DWork.sf_LagFilter_m);
  AutopilotLaws_DWork.DelayInput1_DSTATE = rtb_Saturation;
  AutopilotLaws_DWork.DelayInput1_DSTATE = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE,
    AutopilotLaws_P.Constant3_Value_if);
  AutopilotLaws_DWork.DelayInput1_DSTATE += AutopilotLaws_P.Constant3_Value_if;
  L = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE, AutopilotLaws_P.Constant3_Value_if);
  rtb_Compare_jy = (AutopilotLaws_U.in.data.H_radio_ft <= AutopilotLaws_P.CompareToConstant_const);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain1_Gain_nr * AutopilotLaws_U.in.data.nav_loc_error_deg;
  Phi2 = std::sin(AutopilotLaws_DWork.DelayInput1_DSTATE);
  if (rtb_dme > AutopilotLaws_P.Saturation_UpperSat_o) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_UpperSat_o;
  } else if (rtb_dme < AutopilotLaws_P.Saturation_LowerSat_o) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_LowerSat_o;
  } else {
    AutopilotLaws_DWork.DelayInput1_DSTATE = rtb_dme;
  }

  AutopilotLaws_DWork.DelayInput1_DSTATE = Phi2 * AutopilotLaws_DWork.DelayInput1_DSTATE * AutopilotLaws_P.Gain2_Gain_gs;
  if (AutopilotLaws_DWork.DelayInput1_DSTATE > AutopilotLaws_P.Saturation1_UpperSat_g) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation1_UpperSat_g;
  } else if (AutopilotLaws_DWork.DelayInput1_DSTATE < AutopilotLaws_P.Saturation1_LowerSat_k) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation1_LowerSat_k;
  }

  rtb_Compare_l = (rtb_error_d == AutopilotLaws_P.CompareToConstant_const_k);
  if (!rtb_Compare_l) {
    AutopilotLaws_DWork.Delay_DSTATE_h = AutopilotLaws_P.DiscreteTimeIntegratorVariableTs_InitialCondition;
  }

  AutopilotLaws_DWork.Delay_DSTATE_h += AutopilotLaws_P.Gain6_Gain_b * AutopilotLaws_DWork.DelayInput1_DSTATE *
    AutopilotLaws_P.DiscreteTimeIntegratorVariableTs_Gain * AutopilotLaws_U.in.time.dt;
  if (AutopilotLaws_DWork.Delay_DSTATE_h > AutopilotLaws_P.DiscreteTimeIntegratorVariableTs_UpperLimit) {
    AutopilotLaws_DWork.Delay_DSTATE_h = AutopilotLaws_P.DiscreteTimeIntegratorVariableTs_UpperLimit;
  } else if (AutopilotLaws_DWork.Delay_DSTATE_h < AutopilotLaws_P.DiscreteTimeIntegratorVariableTs_LowerLimit) {
    AutopilotLaws_DWork.Delay_DSTATE_h = AutopilotLaws_P.DiscreteTimeIntegratorVariableTs_LowerLimit;
  }

  rtb_dme = AutopilotLaws_DWork.DelayInput1_DSTATE * look1_binlxpw(AutopilotLaws_U.in.data.V_gnd_kn,
    AutopilotLaws_P.ScheduledGain_BreakpointsForDimension1_j, AutopilotLaws_P.ScheduledGain_Table_p, 2U);
  AutopilotLaws_DWork.DelayInput1_DSTATE = rtb_Saturation;
  AutopilotLaws_DWork.DelayInput1_DSTATE = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE,
    AutopilotLaws_P.Constant3_Value_dk);
  AutopilotLaws_DWork.DelayInput1_DSTATE += AutopilotLaws_P.Constant3_Value_dk;
  AutopilotLaws_storevalue(rtb_Compare_l, rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE,
    AutopilotLaws_P.Constant3_Value_dk), &rtb_lo_k, &AutopilotLaws_DWork.sf_storevalue);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_U.in.data.nav_loc_error_deg + rtb_lo_k;
  AutopilotLaws_DWork.DelayInput1_DSTATE = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE,
    AutopilotLaws_P.Constant3_Value_o);
  AutopilotLaws_DWork.DelayInput1_DSTATE += AutopilotLaws_P.Constant3_Value_o;
  AutopilotLaws_DWork.DelayInput1_DSTATE = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE,
    AutopilotLaws_P.Constant3_Value_o);
  AutopilotLaws_DWork.DelayInput1_DSTATE += AutopilotLaws_P.Constant3_Value_n1;
  AutopilotLaws_DWork.DelayInput1_DSTATE = (AutopilotLaws_U.in.data.Psi_true_deg -
    AutopilotLaws_DWork.DelayInput1_DSTATE) + AutopilotLaws_P.Constant3_Value_n1;
  rtb_Saturation = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE, AutopilotLaws_P.Constant3_Value_n1);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Constant3_Value_n1 - rtb_Saturation;
  Phi2 = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE, AutopilotLaws_P.Constant3_Value_n1);
  if (rtb_Saturation < Phi2) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain1_Gain_j * rtb_Saturation;
  } else {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain_Gain_i * Phi2;
  }

  AutopilotLaws_DWork.DelayInput1_DSTATE = (AutopilotLaws_DWork.Delay_DSTATE_h + rtb_dme) +
    AutopilotLaws_P.Gain1_Gain_fq * AutopilotLaws_DWork.DelayInput1_DSTATE;
  AutopilotLaws_DWork.DelayInput1_DSTATE += AutopilotLaws_U.in.data.Psi_true_deg;
  AutopilotLaws_DWork.DelayInput1_DSTATE = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE,
    AutopilotLaws_P.Constant3_Value_hr);
  AutopilotLaws_DWork.DelayInput1_DSTATE += AutopilotLaws_P.Constant3_Value_hr;
  AutopilotLaws_DWork.DelayInput1_DSTATE = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE,
    AutopilotLaws_P.Constant3_Value_hr);
  AutopilotLaws_DWork.DelayInput1_DSTATE = (AutopilotLaws_DWork.DelayInput1_DSTATE -
    (AutopilotLaws_U.in.data.Psi_true_deg + AutopilotLaws_P.Constant3_Value_nr)) + AutopilotLaws_P.Constant3_Value_nr;
  rtb_dme = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE, AutopilotLaws_P.Constant3_Value_nr);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Constant3_Value_nr - rtb_dme;
  AutopilotLaws_DWork.DelayInput1_DSTATE = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE,
    AutopilotLaws_P.Constant3_Value_nr);
  AutopilotLaws_Chart_h(rtb_dme, AutopilotLaws_P.Gain_Gain_o * AutopilotLaws_DWork.DelayInput1_DSTATE,
                        AutopilotLaws_P.Constant1_Value_e, &rtb_Saturation, &AutopilotLaws_DWork.sf_Chart_b);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_U.in.data.Psi_true_deg + AutopilotLaws_P.Constant3_Value_m;
  AutopilotLaws_DWork.DelayInput1_DSTATE = (L - AutopilotLaws_DWork.DelayInput1_DSTATE) +
    AutopilotLaws_P.Constant3_Value_m;
  rtb_dme = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE, AutopilotLaws_P.Constant3_Value_m);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Constant3_Value_m - rtb_dme;
  AutopilotLaws_DWork.DelayInput1_DSTATE = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE,
    AutopilotLaws_P.Constant3_Value_m);
  AutopilotLaws_Chart_h(rtb_dme, AutopilotLaws_P.Gain_Gain_fn * AutopilotLaws_DWork.DelayInput1_DSTATE,
                        AutopilotLaws_P.Constant2_Value_l, &distance_m, &AutopilotLaws_DWork.sf_Chart_h);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_U.in.data.Psi_magnetic_deg + AutopilotLaws_P.Constant3_Value_cd;
  AutopilotLaws_DWork.DelayInput1_DSTATE = (AutopilotLaws_U.in.input.Psi_c_deg - AutopilotLaws_DWork.DelayInput1_DSTATE)
    + AutopilotLaws_P.Constant3_Value_cd;
  rtb_dme = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE, AutopilotLaws_P.Constant3_Value_cd);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Constant3_Value_cd - rtb_dme;
  AutopilotLaws_DWork.DelayInput1_DSTATE = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE,
    AutopilotLaws_P.Constant3_Value_cd);
  rtb_valid = ((rtb_error_d == AutopilotLaws_P.CompareToConstant5_const) == AutopilotLaws_P.CompareToConstant_const_hx);
  Phi2 = AutopilotLaws_P.Subsystem_Value / AutopilotLaws_U.in.time.dt;
  if (!rtb_valid) {
    for (i = 0; i < 100; i++) {
      AutopilotLaws_DWork.Delay_DSTATE_l[i] = AutopilotLaws_P.Delay_InitialCondition;
    }
  }

  if (Phi2 < 1.0) {
    rtb_valid_d = rtb_valid;
  } else {
    if (Phi2 > 100.0) {
      i = 100;
    } else {
      i = static_cast<int32_T>(static_cast<uint32_T>(std::fmod(std::trunc(Phi2), 4.294967296E+9)));
    }

    rtb_valid_d = AutopilotLaws_DWork.Delay_DSTATE_l[100U - i];
  }

  AutopilotLaws_Chart(rtb_dme, AutopilotLaws_P.Gain_Gain_cy * AutopilotLaws_DWork.DelayInput1_DSTATE, rtb_valid !=
                      rtb_valid_d, &Phi2, &AutopilotLaws_DWork.sf_Chart);
  AutopilotLaws_DWork.DelayInput1_DSTATE = look1_binlxpw(AutopilotLaws_U.in.data.V_tas_kn,
    AutopilotLaws_P.ScheduledGain_BreakpointsForDimension1_h, AutopilotLaws_P.ScheduledGain_Table_o, 6U);
  rtb_dme = Phi2 * AutopilotLaws_DWork.DelayInput1_DSTATE;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain_Gain_o5 * result[2];
  b_L = AutopilotLaws_P.Gain1_Gain_o * rtb_dme + AutopilotLaws_DWork.DelayInput1_DSTATE;
  AutopilotLaws_MATLABFunction_m(AutopilotLaws_U.in.input.Psi_c_deg, Phi2, b_L, &rtb_dme, &rtb_lo_b,
    &AutopilotLaws_DWork.sf_MATLABFunction_m);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_U.in.data.Psi_magnetic_track_deg +
    AutopilotLaws_P.Constant3_Value_k;
  AutopilotLaws_DWork.DelayInput1_DSTATE = (AutopilotLaws_U.in.input.Psi_c_deg - AutopilotLaws_DWork.DelayInput1_DSTATE)
    + AutopilotLaws_P.Constant3_Value_k;
  R = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE, AutopilotLaws_P.Constant3_Value_k);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Constant3_Value_k - R;
  AutopilotLaws_DWork.DelayInput1_DSTATE = rt_modd(AutopilotLaws_DWork.DelayInput1_DSTATE,
    AutopilotLaws_P.Constant3_Value_k);
  rtb_valid_d = ((rtb_error_d == AutopilotLaws_P.CompareToConstant4_const) == AutopilotLaws_P.CompareToConstant_const_e);
  Phi2 = AutopilotLaws_P.Subsystem_Value_n / AutopilotLaws_U.in.time.dt;
  if (!rtb_valid_d) {
    for (i = 0; i < 100; i++) {
      AutopilotLaws_DWork.Delay_DSTATE_h5[i] = AutopilotLaws_P.Delay_InitialCondition_b;
    }
  }

  if (Phi2 < 1.0) {
    rtb_Delay_j = rtb_valid_d;
  } else {
    if (Phi2 > 100.0) {
      i = 100;
    } else {
      i = static_cast<int32_T>(static_cast<uint32_T>(std::fmod(std::trunc(Phi2), 4.294967296E+9)));
    }

    rtb_Delay_j = AutopilotLaws_DWork.Delay_DSTATE_h5[100U - i];
  }

  AutopilotLaws_Chart(R, AutopilotLaws_P.Gain_Gain_p * AutopilotLaws_DWork.DelayInput1_DSTATE, rtb_valid_d !=
                      rtb_Delay_j, &Phi2, &AutopilotLaws_DWork.sf_Chart_ba);
  AutopilotLaws_DWork.DelayInput1_DSTATE = look1_binlxpw(AutopilotLaws_U.in.data.V_tas_kn,
    AutopilotLaws_P.ScheduledGain_BreakpointsForDimension1_o, AutopilotLaws_P.ScheduledGain_Table_e, 6U);
  R = Phi2 * AutopilotLaws_DWork.DelayInput1_DSTATE;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain_Gain_l * result[2];
  rtb_Sum_i = AutopilotLaws_P.Gain1_Gain_i4 * R + AutopilotLaws_DWork.DelayInput1_DSTATE;
  AutopilotLaws_MATLABFunction_m(AutopilotLaws_U.in.input.Psi_c_deg, Phi2, rtb_Sum_i, &rtb_Y_j, &rtb_lo_k,
    &AutopilotLaws_DWork.sf_MATLABFunction_e);
  AutopilotLaws_MATLABFunction(AutopilotLaws_P.tau_Value_c, AutopilotLaws_P.zeta_Value_h,
    &AutopilotLaws_DWork.DelayInput1_DSTATE, &R);
  AutopilotLaws_RateLimiter(AutopilotLaws_U.in.data.flight_guidance_phi_deg, AutopilotLaws_P.RateLimiterVariableTs_up_h,
    AutopilotLaws_P.RateLimiterVariableTs_lo_n, AutopilotLaws_U.in.time.dt,
    AutopilotLaws_P.RateLimiterVariableTs_InitialCondition_l, &rtb_Gain1_pj, &AutopilotLaws_DWork.sf_RateLimiter);
  AutopilotLaws_LagFilter(rtb_Gain1_pj, AutopilotLaws_P.LagFilter_C1_g, AutopilotLaws_U.in.time.dt, &Phi2,
    &AutopilotLaws_DWork.sf_LagFilter);
  switch (static_cast<int32_T>(rtb_error_d)) {
   case 0:
    b_L = rtb_GainTheta1;
    break;

   case 1:
    if (b_L > rtb_dme) {
      b_L = rtb_dme;
    } else if (b_L < rtb_lo_b) {
      b_L = rtb_lo_b;
    }
    break;

   case 2:
    if (rtb_Sum_i > rtb_Y_j) {
      b_L = rtb_Y_j;
    } else if (rtb_Sum_i < rtb_lo_k) {
      b_L = rtb_lo_k;
    } else {
      b_L = rtb_Sum_i;
    }
    break;

   case 3:
    rtb_Add3_j4 = AutopilotLaws_P.Gain_Gain_c * AutopilotLaws_U.in.data.flight_guidance_xtk_nmi * R /
      AutopilotLaws_U.in.data.V_gnd_kn;
    if (rtb_Add3_j4 > AutopilotLaws_P.Saturation_UpperSat) {
      rtb_Add3_j4 = AutopilotLaws_P.Saturation_UpperSat;
    } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation_LowerSat) {
      rtb_Add3_j4 = AutopilotLaws_P.Saturation_LowerSat;
    }

    b_L = Phi2 - (AutopilotLaws_P.Gain2_Gain * AutopilotLaws_U.in.data.flight_guidance_tae_deg + rtb_Add3_j4) *
      AutopilotLaws_DWork.DelayInput1_DSTATE * AutopilotLaws_U.in.data.V_gnd_kn;
    break;

   case 4:
    b_L = a;
    break;

   case 5:
    rtb_dme = rt_modd((AutopilotLaws_U.in.data.Psi_magnetic_deg - (AutopilotLaws_U.in.data.Psi_true_deg +
      AutopilotLaws_P.Constant3_Value)) + AutopilotLaws_P.Constant3_Value, AutopilotLaws_P.Constant3_Value);
    Phi2 = rt_modd(AutopilotLaws_P.Constant3_Value - rtb_dme, AutopilotLaws_P.Constant3_Value);
    if (rtb_dme < Phi2) {
      rtb_dme *= AutopilotLaws_P.Gain1_Gain_l;
    } else {
      rtb_dme = AutopilotLaws_P.Gain_Gain_g * Phi2;
    }

    Phi2 = rt_modd((rt_modd(rt_modd(AutopilotLaws_U.in.data.Psi_magnetic_track_deg + rtb_dme,
      AutopilotLaws_P.Constant3_Value_d) + AutopilotLaws_P.Constant3_Value_d, AutopilotLaws_P.Constant3_Value_d) - (L +
      AutopilotLaws_P.Constant3_Value_c)) + AutopilotLaws_P.Constant3_Value_c, AutopilotLaws_P.Constant3_Value_c);
    rtb_dme = rt_modd(AutopilotLaws_P.Constant3_Value_c - Phi2, AutopilotLaws_P.Constant3_Value_c);
    if (rtb_Y_pf > AutopilotLaws_P.Saturation_UpperSat_a) {
      rtb_Y_pf = AutopilotLaws_P.Saturation_UpperSat_a;
    } else if (rtb_Y_pf < AutopilotLaws_P.Saturation_LowerSat_a) {
      rtb_Y_pf = AutopilotLaws_P.Saturation_LowerSat_a;
    }

    if (Phi2 < rtb_dme) {
      Phi2 *= AutopilotLaws_P.Gain1_Gain_g;
    } else {
      Phi2 = AutopilotLaws_P.Gain_Gain_f * rtb_dme;
    }

    if (rtb_Compare_jy) {
      rtb_dme = AutopilotLaws_P.k_beta_Phi_Gain * AutopilotLaws_U.in.data.beta_deg;
    } else {
      rtb_dme = AutopilotLaws_P.Constant1_Value_fk;
    }

    rtb_Add3_j4 = (rtb_Y_i * look1_binlxpw(AutopilotLaws_U.in.data.V_tas_kn,
      AutopilotLaws_P.ScheduledGain2_BreakpointsForDimension1, AutopilotLaws_P.ScheduledGain2_Table, 6U) *
                   AutopilotLaws_P.Gain4_Gain * look1_binlxpw(AutopilotLaws_U.in.data.H_radio_ft,
      AutopilotLaws_P.ScheduledGain_BreakpointsForDimension1, AutopilotLaws_P.ScheduledGain_Table, 5U) + std::sin
                   (AutopilotLaws_P.Gain1_Gain_b * Phi2) * AutopilotLaws_U.in.data.V_gnd_kn *
                   AutopilotLaws_P.Gain2_Gain_g) + rtb_dme;
    if (rtb_Add3_j4 > AutopilotLaws_P.Saturation1_UpperSat) {
      rtb_Add3_j4 = AutopilotLaws_P.Saturation1_UpperSat;
    } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation1_LowerSat) {
      rtb_Add3_j4 = AutopilotLaws_P.Saturation1_LowerSat;
    }

    b_L = (AutopilotLaws_P.Constant_Value - rtb_Y_pf) * a + rtb_Add3_j4 * rtb_Y_pf;
    break;

   default:
    b_L = AutopilotLaws_P.Constant3_Value_h;
    break;
  }

  rtb_dme = std::abs(AutopilotLaws_U.in.data.V_tas_kn);
  if (rtb_dme > 600.0) {
    rtb_dme = 19.0;
  } else {
    int32_T low_i;
    int32_T low_ip1;
    i = 5;
    low_i = 1;
    low_ip1 = 2;
    while (i > low_ip1) {
      int32_T mid_i;
      mid_i = (low_i + i) >> 1;
      if (rtb_dme >= (static_cast<real_T>(mid_i) - 1.0) * 150.0) {
        low_i = mid_i;
        low_ip1 = mid_i + 1;
      } else {
        i = mid_i;
      }
    }

    Phi2 = (rtb_dme - (static_cast<real_T>(low_i) - 1.0) * 150.0) / static_cast<real_T>(150 * low_i - (low_i - 1) * 150);
    if (Phi2 == 0.0) {
      rtb_dme = b[low_i - 1];
    } else if (Phi2 == 1.0) {
      rtb_dme = b[low_i];
    } else if (b[low_i - 1] == b[low_i]) {
      rtb_dme = b[low_i - 1];
    } else {
      rtb_dme = (1.0 - Phi2) * static_cast<real_T>(b[low_i - 1]) + Phi2 * static_cast<real_T>(b[low_i]);
    }
  }

  if ((AutopilotLaws_U.in.input.lateral_mode != 30.0) && (AutopilotLaws_U.in.input.lateral_mode != 31.0) &&
      (AutopilotLaws_U.in.input.lateral_mode != 32.0) && (AutopilotLaws_U.in.input.lateral_mode != 33.0) &&
      (AutopilotLaws_U.in.input.lateral_mode != 34.0)) {
    rtb_dme = std::fmin(25.0, rtb_dme);
  } else if (AutopilotLaws_U.in.data.H_radio_ft < 700.0) {
    rtb_dme = 10.0;
  }

  Phi2 = std::abs(AutopilotLaws_U.in.data.flight_guidance_phi_limit_deg);
  if (!AutopilotLaws_DWork.pY_not_empty_g) {
    AutopilotLaws_DWork.pY_b = 25.0;
    AutopilotLaws_DWork.pY_not_empty_g = true;
  }

  if ((AutopilotLaws_U.in.input.lateral_mode == 20.0) && (Phi2 > 0.0)) {
    rtb_dme = Phi2;
  }

  AutopilotLaws_DWork.pY_b += std::fmax(std::fmin(rtb_dme - AutopilotLaws_DWork.pY_b, 5.0 * AutopilotLaws_U.in.time.dt),
    -5.0 * AutopilotLaws_U.in.time.dt);
  if (b_L > AutopilotLaws_DWork.pY_b) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_DWork.pY_b;
  } else {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain1_Gain_lt * AutopilotLaws_DWork.pY_b;
    if (b_L >= AutopilotLaws_DWork.DelayInput1_DSTATE) {
      AutopilotLaws_DWork.DelayInput1_DSTATE = b_L;
    }
  }

  AutopilotLaws_LagFilter(AutopilotLaws_P.Gain_Gain_lu * (AutopilotLaws_DWork.DelayInput1_DSTATE - rtb_GainTheta1),
    AutopilotLaws_P.LagFilter_C1_a, AutopilotLaws_U.in.time.dt, &rtb_Y_i, &AutopilotLaws_DWork.sf_LagFilter_mp);
  AutopilotLaws_RateLimiter_n(rtb_Compare_l, AutopilotLaws_P.RateLimiterVariableTs_up_n,
    AutopilotLaws_P.RateLimiterVariableTs_lo_k, AutopilotLaws_U.in.time.dt,
    AutopilotLaws_P.RateLimiterVariableTs_InitialCondition_i, &rtb_Y_j, &AutopilotLaws_DWork.sf_RateLimiter_e);
  if (rtb_Y_j > AutopilotLaws_P.Saturation_UpperSat_k) {
    rtb_Sum_kq = AutopilotLaws_P.Saturation_UpperSat_k;
  } else if (rtb_Y_j < AutopilotLaws_P.Saturation_LowerSat_f3) {
    rtb_Sum_kq = AutopilotLaws_P.Saturation_LowerSat_f3;
  } else {
    rtb_Sum_kq = rtb_Y_j;
  }

  rtb_Saturation = (AutopilotLaws_P.Gain_Gain_b * result[2] * rtb_Sum_kq + (AutopilotLaws_P.Constant_Value_a -
    rtb_Sum_kq) * (AutopilotLaws_P.Gain4_Gain_o * AutopilotLaws_U.in.data.beta_deg)) + AutopilotLaws_P.Gain5_Gain_o *
    rtb_Saturation;
  if (rtb_fpmtoms > AutopilotLaws_P.Switch_Threshold_n) {
    switch (static_cast<int32_T>(rtb_error_d)) {
     case 0:
      R = AutopilotLaws_P.beta1_Value;
      break;

     case 1:
      R = AutopilotLaws_P.beta1_Value_h;
      break;

     case 2:
      R = AutopilotLaws_P.beta1_Value_l;
      break;

     case 3:
      R = AutopilotLaws_P.beta1_Value_m;
      break;

     case 4:
      R = AutopilotLaws_P.beta1_Value_d;
      break;

     case 5:
      R = AutopilotLaws_P.beta1_Value_hy;
      break;

     default:
      R = AutopilotLaws_P.Gain3_Gain * rtb_Saturation;
      break;
    }
  } else {
    R = AutopilotLaws_P.Constant1_Value;
  }

  if (rtb_Compare_jy) {
    rtb_dme = AutopilotLaws_P.Gain_Gain_ae * distance_m + AutopilotLaws_P.Gain1_Gain_k *
      AutopilotLaws_U.in.data.beta_deg;
  } else {
    rtb_dme = AutopilotLaws_P.Constant1_Value_fk;
  }

  AutopilotLaws_LagFilter(rtb_dme, AutopilotLaws_P.LagFilter1_C1, AutopilotLaws_U.in.time.dt, &rtb_Y_j,
    &AutopilotLaws_DWork.sf_LagFilter_c);
  switch (static_cast<int32_T>(rtb_error_d)) {
   case 0:
    rtb_Saturation = AutopilotLaws_P.beta_Value;
    break;

   case 1:
    rtb_Saturation = AutopilotLaws_P.beta_Value_e;
    break;

   case 2:
    rtb_Saturation = AutopilotLaws_P.beta_Value_b;
    break;

   case 3:
    rtb_Saturation = AutopilotLaws_P.beta_Value_i;
    break;

   case 4:
    rtb_Saturation = AutopilotLaws_P.beta_Value_c;
    break;

   case 5:
    if (rtb_Y_j > AutopilotLaws_P.Saturation_UpperSat_e) {
      rtb_Saturation = AutopilotLaws_P.Saturation_UpperSat_e;
    } else if (rtb_Y_j < AutopilotLaws_P.Saturation_LowerSat_f) {
      rtb_Saturation = AutopilotLaws_P.Saturation_LowerSat_f;
    } else {
      rtb_Saturation = rtb_Y_j;
    }
    break;

   default:
    rtb_Saturation *= AutopilotLaws_P.Gain7_Gain;
    break;
  }

  AutopilotLaws_LagFilter(rtb_Saturation, AutopilotLaws_P.LagFilter_C1_k, AutopilotLaws_U.in.time.dt, &rtb_dme,
    &AutopilotLaws_DWork.sf_LagFilter_h2);
  AutopilotLaws_DWork.icLoad = ((rtb_fpmtoms == 0) || AutopilotLaws_DWork.icLoad);
  if (AutopilotLaws_DWork.icLoad) {
    AutopilotLaws_DWork.Delay_DSTATE_hc = rtb_GainTheta1;
  }

  AutopilotLaws_DWork.DelayInput1_DSTATE -= AutopilotLaws_DWork.Delay_DSTATE_hc;
  if (!AutopilotLaws_DWork.pY_not_empty) {
    AutopilotLaws_DWork.pY = 5.0;
    AutopilotLaws_DWork.pY_not_empty = true;
  }

  if ((AutopilotLaws_U.in.input.lateral_mode == 30.0) || (AutopilotLaws_U.in.input.lateral_mode == 31.0) ||
      (AutopilotLaws_U.in.input.lateral_mode == 32.0) || (AutopilotLaws_U.in.input.lateral_mode == 33.0) ||
      (AutopilotLaws_U.in.input.lateral_mode == 34.0)) {
    rtb_Add3_j4 = 7.5;
  } else {
    rtb_Add3_j4 = 5.0;
  }

  AutopilotLaws_DWork.pY += std::fmax(std::fmin(rtb_Add3_j4 - AutopilotLaws_DWork.pY, 2.5 * AutopilotLaws_U.in.time.dt),
    -2.5 * AutopilotLaws_U.in.time.dt);
  AutopilotLaws_DWork.DelayInput1_DSTATE = std::fmin(AutopilotLaws_DWork.DelayInput1_DSTATE, AutopilotLaws_DWork.pY *
    AutopilotLaws_U.in.time.dt);
  AutopilotLaws_DWork.Delay_DSTATE_hc += std::fmax(AutopilotLaws_DWork.DelayInput1_DSTATE, AutopilotLaws_P.Gain1_Gain_kf
    * AutopilotLaws_DWork.pY * AutopilotLaws_U.in.time.dt);
  AutopilotLaws_LagFilter(AutopilotLaws_DWork.Delay_DSTATE_hc, AutopilotLaws_P.LagFilter_C1_l,
    AutopilotLaws_U.in.time.dt, &rtb_Y_pf, &AutopilotLaws_DWork.sf_LagFilter_o);
  AutopilotLaws_RateLimiter(static_cast<real_T>(rtb_fpmtoms), AutopilotLaws_P.RateLimiterVariableTs_up_b,
    AutopilotLaws_P.RateLimiterVariableTs_lo_b, AutopilotLaws_U.in.time.dt,
    AutopilotLaws_P.RateLimiterVariableTs_InitialCondition_il, &rtb_Y_j, &AutopilotLaws_DWork.sf_RateLimiter_d);
  if (rtb_Y_j > AutopilotLaws_P.Saturation_UpperSat_m) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_UpperSat_m;
  } else if (rtb_Y_j < AutopilotLaws_P.Saturation_LowerSat_fw) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_LowerSat_fw;
  } else {
    AutopilotLaws_DWork.DelayInput1_DSTATE = rtb_Y_j;
  }

  rtb_error_d = rtb_Y_pf * AutopilotLaws_DWork.DelayInput1_DSTATE;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Constant_Value_ii - AutopilotLaws_DWork.DelayInput1_DSTATE;
  AutopilotLaws_DWork.DelayInput1_DSTATE *= rtb_GainTheta1;
  AutopilotLaws_DWork.DelayInput1_DSTATE += rtb_error_d;
  AutopilotLaws_Y.out.output.Phi_loc_c = a;
  rtb_Add3_j4 = AutopilotLaws_P.Gain_Gain_m3 * R;
  if (rtb_Add3_j4 > AutopilotLaws_P.Saturation_UpperSat_c) {
    AutopilotLaws_Y.out.output.Nosewheel_c = AutopilotLaws_P.Saturation_UpperSat_c;
  } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation_LowerSat_d) {
    AutopilotLaws_Y.out.output.Nosewheel_c = AutopilotLaws_P.Saturation_LowerSat_d;
  } else {
    AutopilotLaws_Y.out.output.Nosewheel_c = rtb_Add3_j4;
  }

  AutopilotLaws_Y.out.output.flight_director.Beta_c_deg = rtb_dme;
  AutopilotLaws_Y.out.output.autopilot.Beta_c_deg = rtb_Saturation;
  AutopilotLaws_Y.out.output.flight_director.Phi_c_deg = rtb_Y_i;
  AutopilotLaws_Y.out.output.autopilot.Phi_c_deg = AutopilotLaws_DWork.DelayInput1_DSTATE;
  AutopilotLaws_WashoutFilter(rtb_GainTheta, AutopilotLaws_P.WashoutFilter_C1, AutopilotLaws_U.in.time.dt, &rtb_dme,
    &AutopilotLaws_DWork.sf_WashoutFilter_f);
  if (AutopilotLaws_P.ManualSwitch_CurrentSetting_b == 1) {
    rtb_error_d = AutopilotLaws_P.Constant_Value_m;
  } else {
    rtb_error_d = AutopilotLaws_U.in.input.vertical_law;
  }

  if (AutopilotLaws_U.in.input.ALT_soft_mode_active) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = (AutopilotLaws_U.in.input.V_c_kn - AutopilotLaws_U.in.data.V_ias_kn) *
      AutopilotLaws_P.Gain1_Gain_bs;
    if (AutopilotLaws_DWork.DelayInput1_DSTATE > AutopilotLaws_P.Saturation1_UpperSat_a) {
      AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation1_UpperSat_a;
    } else if (AutopilotLaws_DWork.DelayInput1_DSTATE < AutopilotLaws_P.Saturation1_LowerSat_i) {
      AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation1_LowerSat_i;
    }
  } else {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Constant1_Value_h;
  }

  if (rtb_error_d != AutopilotLaws_P.CompareToConstant5_const_e) {
    AutopilotLaws_B.u = (AutopilotLaws_U.in.input.H_c_ft + AutopilotLaws_U.in.data.H_ft) -
      AutopilotLaws_U.in.data.H_ind_ft;
  }

  AutopilotLaws_LagFilter(AutopilotLaws_B.u - AutopilotLaws_U.in.data.H_ft, AutopilotLaws_P.LagFilter_C1_ai,
    AutopilotLaws_U.in.time.dt, &rtb_Y_j, &AutopilotLaws_DWork.sf_LagFilter_g);
  AutopilotLaws_DWork.DelayInput1_DSTATE += AutopilotLaws_P.Gain_Gain_ft * rtb_Y_j;
  if (AutopilotLaws_DWork.DelayInput1_DSTATE > AutopilotLaws_P.Saturation_UpperSat_n) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_UpperSat_n;
  } else if (AutopilotLaws_DWork.DelayInput1_DSTATE < AutopilotLaws_P.Saturation_LowerSat_d4) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_LowerSat_d4;
  }

  AutopilotLaws_DWork.DelayInput1_DSTATE -= AutopilotLaws_U.in.data.H_dot_ft_min;
  Phi2 = AutopilotLaws_P.ftmintoms_Gain * AutopilotLaws_DWork.DelayInput1_DSTATE;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.kntoms_Gain * AutopilotLaws_U.in.data.V_tas_kn;
  if (AutopilotLaws_DWork.DelayInput1_DSTATE > AutopilotLaws_P.Saturation_UpperSat_ar) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_UpperSat_ar;
  } else if (AutopilotLaws_DWork.DelayInput1_DSTATE < AutopilotLaws_P.Saturation_LowerSat_n5) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_LowerSat_n5;
  }

  rtb_Add3_j4 = Phi2 / AutopilotLaws_DWork.DelayInput1_DSTATE;
  if (rtb_Add3_j4 > 1.0) {
    rtb_Add3_j4 = 1.0;
  } else if (rtb_Add3_j4 < -1.0) {
    rtb_Add3_j4 = -1.0;
  }

  a = AutopilotLaws_P.Gain_Gain_k * std::asin(rtb_Add3_j4);
  rtb_Compare_jy = (rtb_error_d == AutopilotLaws_P.CompareToConstant1_const_c);
  if (!AutopilotLaws_DWork.wasActive_not_empty_p) {
    AutopilotLaws_DWork.wasActive_c = rtb_Compare_jy;
    AutopilotLaws_DWork.wasActive_not_empty_p = true;
  }

  distance_m = AutopilotLaws_U.in.input.H_c_ft - AutopilotLaws_U.in.data.H_ind_ft;
  if (distance_m < 0.0) {
    Phi2 = -1.0;
  } else if (distance_m > 0.0) {
    Phi2 = 1.0;
  } else {
    Phi2 = distance_m;
  }

  Phi2 = Phi2 * AutopilotLaws_DWork.dH_offset + distance_m;
  if ((!AutopilotLaws_DWork.wasActive_c) && rtb_Compare_jy) {
    AutopilotLaws_DWork.k = AutopilotLaws_U.in.data.H_dot_ft_min / Phi2;
    AutopilotLaws_DWork.dH_offset = std::abs(500.0 / std::abs(AutopilotLaws_DWork.k) - 100.0);
    if (Phi2 < 0.0) {
      L = -1.0;
    } else if (Phi2 > 0.0) {
      L = 1.0;
    } else {
      L = Phi2;
    }

    Phi2 += L * AutopilotLaws_DWork.dH_offset;
    AutopilotLaws_DWork.k = AutopilotLaws_U.in.data.H_dot_ft_min / Phi2;
    AutopilotLaws_DWork.maxH_dot = std::abs(AutopilotLaws_U.in.data.H_dot_ft_min);
  }

  Phi2 *= AutopilotLaws_DWork.k;
  if (std::abs(Phi2) > AutopilotLaws_DWork.maxH_dot) {
    if (Phi2 < 0.0) {
      Phi2 = -1.0;
    } else if (Phi2 > 0.0) {
      Phi2 = 1.0;
    }

    Phi2 *= AutopilotLaws_DWork.maxH_dot;
  }

  AutopilotLaws_DWork.wasActive_c = rtb_Compare_jy;
  AutopilotLaws_DWork.DelayInput1_DSTATE = Phi2 - AutopilotLaws_U.in.data.H_dot_ft_min;
  Phi2 = AutopilotLaws_P.ftmintoms_Gain_c * AutopilotLaws_DWork.DelayInput1_DSTATE;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.kntoms_Gain_h * AutopilotLaws_U.in.data.V_tas_kn;
  if (AutopilotLaws_DWork.DelayInput1_DSTATE > AutopilotLaws_P.Saturation_UpperSat_d) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_UpperSat_d;
  } else if (AutopilotLaws_DWork.DelayInput1_DSTATE < AutopilotLaws_P.Saturation_LowerSat_nr) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_LowerSat_nr;
  }

  rtb_Add3_j4 = Phi2 / AutopilotLaws_DWork.DelayInput1_DSTATE;
  if (rtb_Add3_j4 > 1.0) {
    rtb_Add3_j4 = 1.0;
  } else if (rtb_Add3_j4 < -1.0) {
    rtb_Add3_j4 = -1.0;
  }

  Phi2 = AutopilotLaws_P.Gain_Gain_es * std::asin(rtb_Add3_j4);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.fpmtoms_Gain * AutopilotLaws_U.in.data.H_dot_ft_min;
  rtb_Add3_j4 = AutopilotLaws_P.kntoms_Gain_m * AutopilotLaws_U.in.data.V_gnd_kn;
  if (rtb_Add3_j4 > AutopilotLaws_P.Saturation_UpperSat_j) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_UpperSat_j;
  } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation_LowerSat_i) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_LowerSat_i;
  }

  AutopilotLaws_DWork.DelayInput1_DSTATE = std::atan(AutopilotLaws_DWork.DelayInput1_DSTATE / rtb_Add3_j4) *
    AutopilotLaws_P.Gain_Gain_e3;
  R = AutopilotLaws_P.Gain1_Gain_c * rtb_GainTheta1;
  AutopilotLaws_WashoutFilter(AutopilotLaws_P._Gain * (AutopilotLaws_P.GStoGS_CAS_Gain * (AutopilotLaws_P.ktstomps_Gain *
    AutopilotLaws_U.in.data.V_gnd_kn)), AutopilotLaws_P.WashoutFilter_C1_e, AutopilotLaws_U.in.time.dt, &rtb_Y_j,
    &AutopilotLaws_DWork.sf_WashoutFilter);
  rtb_Add3_j4 = AutopilotLaws_P.kntoms_Gain_b * AutopilotLaws_U.in.data.V_gnd_kn;
  if (rtb_Add3_j4 > AutopilotLaws_P.Saturation_UpperSat_ei) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_UpperSat_ei;
  } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation_LowerSat_dz) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_LowerSat_dz;
  }

  AutopilotLaws_LeadLagFilter(rtb_Y_j - AutopilotLaws_P.g_Gain * (AutopilotLaws_P.Gain1_Gain_lp *
    (AutopilotLaws_P.Gain_Gain_am * ((AutopilotLaws_P.Gain1_Gain_go * rtb_GainTheta - AutopilotLaws_P.Gain1_Gain_lx *
    (AutopilotLaws_P.Gain_Gain_c1 * std::atan(AutopilotLaws_P.fpmtoms_Gain_g * AutopilotLaws_U.in.data.H_dot_ft_min /
    rtb_Add3_j4))) * (AutopilotLaws_P.Constant_Value_dy - std::cos(R)) + std::sin(R) * std::sin
    (AutopilotLaws_P.Gain1_Gain_pf * AutopilotLaws_U.in.data.Psi_magnetic_track_deg - AutopilotLaws_P.Gain1_Gain_e *
     AutopilotLaws_U.in.data.Psi_magnetic_deg)))), AutopilotLaws_P.HighPassFilter_C1, AutopilotLaws_P.HighPassFilter_C2,
    AutopilotLaws_P.HighPassFilter_C3, AutopilotLaws_P.HighPassFilter_C4, AutopilotLaws_U.in.time.dt, &rtb_Y_pf,
    &AutopilotLaws_DWork.sf_LeadLagFilter);
  AutopilotLaws_LeadLagFilter(AutopilotLaws_P.ktstomps_Gain_b * AutopilotLaws_U.in.data.V_ias_kn,
    AutopilotLaws_P.LowPassFilter_C1, AutopilotLaws_P.LowPassFilter_C2, AutopilotLaws_P.LowPassFilter_C3,
    AutopilotLaws_P.LowPassFilter_C4, AutopilotLaws_U.in.time.dt, &rtb_Y_j, &AutopilotLaws_DWork.sf_LeadLagFilter_o);
  R = (rtb_Y_pf + rtb_Y_j) * AutopilotLaws_P.ug_Gain;
  rtb_Sum_kq = AutopilotLaws_P.Gain1_Gain_bf * AutopilotLaws_DWork.DelayInput1_DSTATE;
  L = R + rtb_Sum_kq;
  b_L = AutopilotLaws_P.Constant3_Value_nq - AutopilotLaws_P.Constant4_Value;
  rtb_lo_k = (AutopilotLaws_P.Gain1_Gain_ik * R + rtb_Sum_kq) * AutopilotLaws_P.Gain_Gain_aj;
  if (b_L > AutopilotLaws_P.Switch_Threshold_l) {
    R = AutopilotLaws_P.Constant1_Value_g;
  } else {
    R = AutopilotLaws_P.Gain5_Gain * rtb_lo_k;
  }

  AutopilotLaws_V_LSSpeedSelection1(AutopilotLaws_U.in.input.V_c_kn, AutopilotLaws_U.in.data.VLS_kn, &rtb_Y_j);
  rtb_lo_b = (AutopilotLaws_U.in.data.V_ias_kn - rtb_Y_j) * AutopilotLaws_P.Gain1_Gain_oz;
  if (rtb_lo_b <= R) {
    if (b_L > AutopilotLaws_P.Switch1_Threshold) {
      R = AutopilotLaws_P.Constant_Value_g;
    } else {
      R = AutopilotLaws_P.Gain6_Gain * rtb_lo_k;
    }

    if (rtb_lo_b >= R) {
      R = rtb_lo_b;
    }
  }

  rtb_lo_k = (AutopilotLaws_P.Gain_Gain_b0 * L - AutopilotLaws_DWork.DelayInput1_DSTATE) + R;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.fpmtoms_Gain_a * AutopilotLaws_U.in.data.H_dot_ft_min;
  rtb_Add3_j4 = AutopilotLaws_P.kntoms_Gain_p * AutopilotLaws_U.in.data.V_gnd_kn;
  if (rtb_Add3_j4 > AutopilotLaws_P.Saturation_UpperSat_h) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_UpperSat_h;
  } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation_LowerSat_e) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_LowerSat_e;
  }

  AutopilotLaws_DWork.DelayInput1_DSTATE = std::atan(AutopilotLaws_DWork.DelayInput1_DSTATE / rtb_Add3_j4) *
    AutopilotLaws_P.Gain_Gain_d4;
  R = AutopilotLaws_P.Gain1_Gain_j0 * rtb_GainTheta1;
  AutopilotLaws_WashoutFilter(AutopilotLaws_P._Gain_h * (AutopilotLaws_P.GStoGS_CAS_Gain_m *
    (AutopilotLaws_P.ktstomps_Gain_g * AutopilotLaws_U.in.data.V_gnd_kn)), AutopilotLaws_P.WashoutFilter_C1_e4,
    AutopilotLaws_U.in.time.dt, &rtb_Y_j, &AutopilotLaws_DWork.sf_WashoutFilter_d);
  rtb_Add3_j4 = AutopilotLaws_P.kntoms_Gain_l * AutopilotLaws_U.in.data.V_gnd_kn;
  if (rtb_Add3_j4 > AutopilotLaws_P.Saturation_UpperSat_i) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_UpperSat_i;
  } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation_LowerSat_h) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_LowerSat_h;
  }

  AutopilotLaws_LeadLagFilter(rtb_Y_j - AutopilotLaws_P.g_Gain_h * (AutopilotLaws_P.Gain1_Gain_dv *
    (AutopilotLaws_P.Gain_Gain_id * ((AutopilotLaws_P.Gain1_Gain_kd * rtb_GainTheta - AutopilotLaws_P.Gain1_Gain_o4 *
    (AutopilotLaws_P.Gain_Gain_bs * std::atan(AutopilotLaws_P.fpmtoms_Gain_c * AutopilotLaws_U.in.data.H_dot_ft_min /
    rtb_Add3_j4))) * (AutopilotLaws_P.Constant_Value_c - std::cos(R)) + std::sin(R) * std::sin
    (AutopilotLaws_P.Gain1_Gain_bk * AutopilotLaws_U.in.data.Psi_magnetic_track_deg - AutopilotLaws_P.Gain1_Gain_lxx *
     AutopilotLaws_U.in.data.Psi_magnetic_deg)))), AutopilotLaws_P.HighPassFilter_C1_e,
    AutopilotLaws_P.HighPassFilter_C2_c, AutopilotLaws_P.HighPassFilter_C3_f, AutopilotLaws_P.HighPassFilter_C4_c,
    AutopilotLaws_U.in.time.dt, &rtb_Y_pf, &AutopilotLaws_DWork.sf_LeadLagFilter_h);
  AutopilotLaws_LeadLagFilter(AutopilotLaws_P.ktstomps_Gain_i * AutopilotLaws_U.in.data.V_ias_kn,
    AutopilotLaws_P.LowPassFilter_C1_n, AutopilotLaws_P.LowPassFilter_C2_a, AutopilotLaws_P.LowPassFilter_C3_o,
    AutopilotLaws_P.LowPassFilter_C4_o, AutopilotLaws_U.in.time.dt, &rtb_Y_j, &AutopilotLaws_DWork.sf_LeadLagFilter_m);
  R = (rtb_Y_pf + rtb_Y_j) * AutopilotLaws_P.ug_Gain_a;
  rtb_Sum_kq = AutopilotLaws_P.Gain1_Gain_hm * AutopilotLaws_DWork.DelayInput1_DSTATE;
  L = R + rtb_Sum_kq;
  b_L = AutopilotLaws_P.Constant1_Value_b4 - AutopilotLaws_P.Constant2_Value_c;
  rtb_lo_b = (AutopilotLaws_P.Gain1_Gain_mz * R + rtb_Sum_kq) * AutopilotLaws_P.Gain_Gain_ie;
  if (b_L > AutopilotLaws_P.Switch_Threshold_b) {
    R = AutopilotLaws_P.Constant1_Value_a;
  } else {
    R = AutopilotLaws_P.Gain5_Gain_l * rtb_lo_b;
  }

  rtb_Y_j = AutopilotLaws_U.in.data.V_ias_kn - AutopilotLaws_U.in.data.VMAX_kn;
  rtb_Gain1_pj = rtb_Y_j * AutopilotLaws_P.Gain1_Gain_f1;
  if (rtb_Gain1_pj <= R) {
    if (b_L > AutopilotLaws_P.Switch1_Threshold_f) {
      R = AutopilotLaws_P.Constant_Value_p;
    } else {
      R = AutopilotLaws_P.Gain6_Gain_j * rtb_lo_b;
    }

    if (rtb_Gain1_pj >= R) {
      R = rtb_Gain1_pj;
    }
  }

  R += AutopilotLaws_P.Gain_Gain_kj * L - AutopilotLaws_DWork.DelayInput1_DSTATE;
  AutopilotLaws_SpeedProtectionSignalSelection(&AutopilotLaws_Y.out, Phi2, AutopilotLaws_P.VS_Gain * Phi2, rtb_lo_k,
    AutopilotLaws_P.Gain_Gain_m0 * rtb_lo_k, R, AutopilotLaws_P.Gain_Gain_lr * R, AutopilotLaws_P.Constant_Value_ig,
    &b_L, &L);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.fpmtoms_Gain_p * AutopilotLaws_U.in.data.H_dot_ft_min;
  rtb_Add3_j4 = AutopilotLaws_P.kntoms_Gain_f * AutopilotLaws_U.in.data.V_gnd_kn;
  if (rtb_Add3_j4 > AutopilotLaws_P.Saturation_UpperSat_eik) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_UpperSat_eik;
  } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation_LowerSat_ad) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_LowerSat_ad;
  }

  AutopilotLaws_DWork.DelayInput1_DSTATE = std::atan(AutopilotLaws_DWork.DelayInput1_DSTATE / rtb_Add3_j4) *
    AutopilotLaws_P.Gain_Gain_e33;
  R = AutopilotLaws_P.Gain1_Gain_ok * AutopilotLaws_DWork.DelayInput1_DSTATE;
  Phi2 = AutopilotLaws_P.Gain1_Gain_jd * rtb_GainTheta1;
  rtb_lo_k = std::cos(Phi2);
  rtb_lo_b = std::sin(Phi2);
  Phi2 = AutopilotLaws_P.ktstomps_Gain_f * AutopilotLaws_U.in.data.V_gnd_kn;
  AutopilotLaws_WashoutFilter(AutopilotLaws_P._Gain_m * (AutopilotLaws_P.GStoGS_CAS_Gain_l * Phi2),
    AutopilotLaws_P.WashoutFilter_C1_k, AutopilotLaws_U.in.time.dt, &rtb_Gain1_pj,
    &AutopilotLaws_DWork.sf_WashoutFilter_n);
  rtb_Add3_j4 = AutopilotLaws_P.kntoms_Gain_a * AutopilotLaws_U.in.data.V_gnd_kn;
  if (rtb_Add3_j4 > AutopilotLaws_P.Saturation_UpperSat_f) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_UpperSat_f;
  } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation_LowerSat_c) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_LowerSat_c;
  }

  AutopilotLaws_LeadLagFilter(rtb_Gain1_pj - AutopilotLaws_P.g_Gain_j * (AutopilotLaws_P.Gain1_Gain_ca *
    (AutopilotLaws_P.Gain_Gain_ms * ((AutopilotLaws_P.Gain1_Gain_dh * rtb_GainTheta - AutopilotLaws_P.Gain1_Gain_cv *
    (AutopilotLaws_P.Gain_Gain_nq * std::atan(AutopilotLaws_P.fpmtoms_Gain_h * AutopilotLaws_U.in.data.H_dot_ft_min /
    rtb_Add3_j4))) * (AutopilotLaws_P.Constant_Value_l - rtb_lo_k) + rtb_lo_b * std::sin(AutopilotLaws_P.Gain1_Gain_id *
    AutopilotLaws_U.in.data.Psi_magnetic_track_deg - AutopilotLaws_P.Gain1_Gain_ct *
    AutopilotLaws_U.in.data.Psi_magnetic_deg)))), AutopilotLaws_P.HighPassFilter_C1_b,
    AutopilotLaws_P.HighPassFilter_C2_g, AutopilotLaws_P.HighPassFilter_C3_n, AutopilotLaws_P.HighPassFilter_C4_b,
    AutopilotLaws_U.in.time.dt, &Phi2, &AutopilotLaws_DWork.sf_LeadLagFilter_es);
  AutopilotLaws_LeadLagFilter(AutopilotLaws_P.ktstomps_Gain_j * AutopilotLaws_U.in.data.V_ias_kn,
    AutopilotLaws_P.LowPassFilter_C1_d, AutopilotLaws_P.LowPassFilter_C2_p, AutopilotLaws_P.LowPassFilter_C3_a,
    AutopilotLaws_P.LowPassFilter_C4_b, AutopilotLaws_U.in.time.dt, &rtb_Gain1_pj,
    &AutopilotLaws_DWork.sf_LeadLagFilter_ja);
  Phi2 = (Phi2 + rtb_Gain1_pj) * AutopilotLaws_P.ug_Gain_o;
  rtb_lo_k = (AutopilotLaws_P.Gain1_Gain_hu * Phi2 + R) * AutopilotLaws_P.Gain_Gain_bn;
  AutopilotLaws_Voter1(AutopilotLaws_U.in.data.VLS_kn, AutopilotLaws_U.in.input.V_c_kn, AutopilotLaws_U.in.data.VMAX_kn,
                       &rtb_lo_b);
  rtb_lo_b = (AutopilotLaws_U.in.data.V_ias_kn - rtb_lo_b) * AutopilotLaws_P.Gain1_Gain_hz;
  rtb_Compare_jy = ((distance_m > AutopilotLaws_P.CompareToConstant6_const) && (rtb_lo_k <
    AutopilotLaws_P.CompareToConstant5_const_a) && (rtb_lo_b < AutopilotLaws_P.CompareToConstant2_const_d) &&
                    (rtb_error_d == AutopilotLaws_P.CompareToConstant2_const_e));
  R += Phi2;
  if (rtb_Compare_jy) {
    Phi2 = AutopilotLaws_P.Constant_Value_f;
  } else {
    if (distance_m > AutopilotLaws_P.CompareToConstant_const_l) {
      Phi2 = AutopilotLaws_P.Constant1_Value_c;
    } else {
      Phi2 = AutopilotLaws_P.Gain5_Gain_k * rtb_lo_k;
    }

    if (rtb_lo_b <= Phi2) {
      if (distance_m > AutopilotLaws_P.CompareToConstant4_const_o) {
        Phi2 = std::fmax(AutopilotLaws_P.Constant2_Value, AutopilotLaws_P.Gain1_Gain_kg * rtb_lo_k);
      } else {
        Phi2 = AutopilotLaws_P.Gain6_Gain_a * rtb_lo_k;
      }

      if (rtb_lo_b >= Phi2) {
        Phi2 = rtb_lo_b;
      }
    }
  }

  rtb_lo_b = (AutopilotLaws_P.Gain_Gain_d4y * R - AutopilotLaws_DWork.DelayInput1_DSTATE) + Phi2;
  rtb_Add3_j4 = AutopilotLaws_P.kntoms_Gain_n * AutopilotLaws_U.in.data.V_tas_kn;
  if (distance_m < 0.0) {
    Phi2 = -1.0;
  } else if (distance_m > 0.0) {
    Phi2 = 1.0;
  } else {
    Phi2 = distance_m;
  }

  if (rtb_Add3_j4 > AutopilotLaws_P.Saturation_UpperSat_ju) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_UpperSat_ju;
  } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation_LowerSat_gw) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_LowerSat_gw;
  }

  rtb_Add3_j4 = (Phi2 * AutopilotLaws_P.Constant3_Value_ix - AutopilotLaws_U.in.data.H_dot_ft_min) *
    AutopilotLaws_P.ftmintoms_Gain_d / rtb_Add3_j4;
  if (rtb_Add3_j4 > 1.0) {
    rtb_Add3_j4 = 1.0;
  } else if (rtb_Add3_j4 < -1.0) {
    rtb_Add3_j4 = -1.0;
  }

  rtb_Sum_i = AutopilotLaws_P.Gain_Gain_nz * std::asin(rtb_Add3_j4);
  rtb_Add3_j4 = AutopilotLaws_P.kntoms_Gain_au * AutopilotLaws_U.in.data.V_tas_kn;
  if (rtb_Add3_j4 > AutopilotLaws_P.Saturation_UpperSat_l) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_UpperSat_l;
  } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation_LowerSat_hm) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_LowerSat_hm;
  }

  rtb_Add3_j4 = (AutopilotLaws_U.in.input.H_dot_c_fpm - AutopilotLaws_U.in.data.H_dot_ft_min) *
    AutopilotLaws_P.ftmintoms_Gain_l / rtb_Add3_j4;
  if (rtb_Add3_j4 > 1.0) {
    rtb_Add3_j4 = 1.0;
  } else if (rtb_Add3_j4 < -1.0) {
    rtb_Add3_j4 = -1.0;
  }

  rtb_Y_i = AutopilotLaws_P.Gain_Gain_ey * std::asin(rtb_Add3_j4);
  if (!AutopilotLaws_DWork.prevVerticalLaw_not_empty) {
    AutopilotLaws_DWork.prevVerticalLaw = AutopilotLaws_U.in.input.vertical_law;
    AutopilotLaws_DWork.prevVerticalLaw_not_empty = true;
  }

  if (!AutopilotLaws_DWork.prevTarget_not_empty) {
    AutopilotLaws_DWork.prevTarget = AutopilotLaws_U.in.input.H_dot_c_fpm;
    AutopilotLaws_DWork.prevTarget_not_empty = true;
  }

  AutopilotLaws_DWork.islevelOffActive = (((AutopilotLaws_U.in.input.vertical_law == 4.0) &&
    (AutopilotLaws_DWork.prevVerticalLaw != 4.0) && (AutopilotLaws_U.in.input.H_dot_c_fpm == 0.0)) ||
    ((AutopilotLaws_U.in.input.H_dot_c_fpm == 0.0) && (AutopilotLaws_DWork.prevTarget > 500.0)) ||
    ((AutopilotLaws_U.in.input.H_dot_c_fpm == 0.0) && (AutopilotLaws_U.in.input.vertical_law == 4.0) &&
     AutopilotLaws_DWork.islevelOffActive));
  if (AutopilotLaws_U.in.input.vertical_mode == 50.0) {
    rtb_Add3_j4 = 0.3;
  } else if (AutopilotLaws_DWork.islevelOffActive) {
    rtb_Add3_j4 = 0.1;
  } else {
    rtb_Add3_j4 = 0.05;
  }

  rtb_lo_k = 9.81 / (AutopilotLaws_U.in.data.V_tas_kn * 0.51444444444444448);
  rtb_Y_pf = rtb_lo_k * rtb_Add3_j4 * 57.295779513082323;
  AutopilotLaws_DWork.prevVerticalLaw = AutopilotLaws_U.in.input.vertical_law;
  AutopilotLaws_DWork.prevTarget = AutopilotLaws_U.in.input.H_dot_c_fpm;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.kntoms_Gain_o * AutopilotLaws_U.in.data.V_gnd_kn;
  if (AutopilotLaws_DWork.DelayInput1_DSTATE > AutopilotLaws_P.Saturation_UpperSat_fr) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_UpperSat_fr;
  } else if (AutopilotLaws_DWork.DelayInput1_DSTATE < AutopilotLaws_P.Saturation_LowerSat_cd) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_LowerSat_cd;
  }

  Phi2 = std::atan(AutopilotLaws_P.fpmtoms_Gain_o * AutopilotLaws_U.in.data.H_dot_ft_min /
                   AutopilotLaws_DWork.DelayInput1_DSTATE) * AutopilotLaws_P.Gain_Gain_lx;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain1_Gain_jn * rtb_GainTheta;
  rtb_Add3_j4 = AutopilotLaws_P.kntoms_Gain_d * AutopilotLaws_U.in.data.V_gnd_kn;
  if (rtb_Add3_j4 > AutopilotLaws_P.Saturation_UpperSat_hb) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_UpperSat_hb;
  } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation_LowerSat_k) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_LowerSat_k;
  }

  R = AutopilotLaws_DWork.DelayInput1_DSTATE - std::atan(AutopilotLaws_P.fpmtoms_Gain_e *
    AutopilotLaws_U.in.data.H_dot_ft_min / rtb_Add3_j4) * AutopilotLaws_P.Gain_Gain_in * AutopilotLaws_P.Gain1_Gain_ps;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain1_Gain_hi * rtb_GainTheta1;
  rtb_Cos_i = std::cos(AutopilotLaws_DWork.DelayInput1_DSTATE);
  rtb_Cos1_pk = std::sin(AutopilotLaws_DWork.DelayInput1_DSTATE);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain1_Gain_da * AutopilotLaws_U.in.data.Psi_magnetic_deg;
  rtb_Add3_g = AutopilotLaws_P.Gain1_Gain_hg * AutopilotLaws_U.in.data.Psi_magnetic_track_deg -
    AutopilotLaws_DWork.DelayInput1_DSTATE;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.ktstomps_Gain_m * AutopilotLaws_U.in.data.V_gnd_kn;
  AutopilotLaws_WashoutFilter(AutopilotLaws_P._Gain_k * (AutopilotLaws_P.GStoGS_CAS_Gain_k *
    AutopilotLaws_DWork.DelayInput1_DSTATE), AutopilotLaws_P.WashoutFilter_C1_o, AutopilotLaws_U.in.time.dt,
    &rtb_Gain1_pj, &AutopilotLaws_DWork.sf_WashoutFilter_fs);
  AutopilotLaws_LeadLagFilter(rtb_Gain1_pj - AutopilotLaws_P.g_Gain_m * (AutopilotLaws_P.Gain1_Gain_kdq *
    (AutopilotLaws_P.Gain_Gain_b5 * (R * (AutopilotLaws_P.Constant_Value_od - rtb_Cos_i) + rtb_Cos1_pk * std::sin
    (rtb_Add3_g)))), AutopilotLaws_P.HighPassFilter_C1_g, AutopilotLaws_P.HighPassFilter_C2_l,
    AutopilotLaws_P.HighPassFilter_C3_j, AutopilotLaws_P.HighPassFilter_C4_i, AutopilotLaws_U.in.time.dt,
    &AutopilotLaws_DWork.DelayInput1_DSTATE, &AutopilotLaws_DWork.sf_LeadLagFilter_b);
  AutopilotLaws_LeadLagFilter(AutopilotLaws_P.ktstomps_Gain_c * AutopilotLaws_U.in.data.V_ias_kn,
    AutopilotLaws_P.LowPassFilter_C1_m, AutopilotLaws_P.LowPassFilter_C2_l, AutopilotLaws_P.LowPassFilter_C3_i,
    AutopilotLaws_P.LowPassFilter_C4_k, AutopilotLaws_U.in.time.dt, &rtb_Gain1_pj,
    &AutopilotLaws_DWork.sf_LeadLagFilter_kq);
  AutopilotLaws_DWork.DelayInput1_DSTATE = (AutopilotLaws_DWork.DelayInput1_DSTATE + rtb_Gain1_pj) *
    AutopilotLaws_P.ug_Gain_aa;
  R = AutopilotLaws_P.Gain1_Gain_gf * Phi2;
  rtb_Cos_i = AutopilotLaws_DWork.DelayInput1_DSTATE + R;
  rtb_Cos1_pk = AutopilotLaws_P.Constant3_Value_h1 - AutopilotLaws_P.Constant4_Value_f;
  R = (AutopilotLaws_P.Gain1_Gain_ov * AutopilotLaws_DWork.DelayInput1_DSTATE + R) * AutopilotLaws_P.Gain_Gain_jy;
  if (rtb_Cos1_pk > AutopilotLaws_P.Switch_Threshold_o) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Constant1_Value_m5;
  } else {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain5_Gain_h * R;
  }

  AutopilotLaws_V_LSSpeedSelection1(AutopilotLaws_U.in.input.V_c_kn, AutopilotLaws_U.in.data.VLS_kn, &rtb_Gain1_pj);
  rtb_Gain1_pj = (AutopilotLaws_U.in.data.V_ias_kn - rtb_Gain1_pj) * AutopilotLaws_P.Gain1_Gain_dvi;
  if (rtb_Gain1_pj <= AutopilotLaws_DWork.DelayInput1_DSTATE) {
    if (rtb_Cos1_pk > AutopilotLaws_P.Switch1_Threshold_c) {
      AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Constant_Value_b;
    } else {
      AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain6_Gain_ai * R;
    }

    if (rtb_Gain1_pj >= AutopilotLaws_DWork.DelayInput1_DSTATE) {
      AutopilotLaws_DWork.DelayInput1_DSTATE = rtb_Gain1_pj;
    }
  }

  rtb_Add3_g = (AutopilotLaws_P.Gain_Gain_j * rtb_Cos_i - Phi2) + AutopilotLaws_DWork.DelayInput1_DSTATE;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.kntoms_Gain_bq * AutopilotLaws_U.in.data.V_gnd_kn;
  if (AutopilotLaws_DWork.DelayInput1_DSTATE > AutopilotLaws_P.Saturation_UpperSat_ba) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_UpperSat_ba;
  } else if (AutopilotLaws_DWork.DelayInput1_DSTATE < AutopilotLaws_P.Saturation_LowerSat_p) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_LowerSat_p;
  }

  Phi2 = std::atan(AutopilotLaws_P.fpmtoms_Gain_p3 * AutopilotLaws_U.in.data.H_dot_ft_min /
                   AutopilotLaws_DWork.DelayInput1_DSTATE) * AutopilotLaws_P.Gain_Gain_py;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain1_Gain_hk * rtb_GainTheta;
  rtb_Add3_j4 = AutopilotLaws_P.kntoms_Gain_l5 * AutopilotLaws_U.in.data.V_gnd_kn;
  if (rtb_Add3_j4 > AutopilotLaws_P.Saturation_UpperSat_b3) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_UpperSat_b3;
  } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation_LowerSat_es) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_LowerSat_es;
  }

  R = AutopilotLaws_DWork.DelayInput1_DSTATE - std::atan(AutopilotLaws_P.fpmtoms_Gain_j *
    AutopilotLaws_U.in.data.H_dot_ft_min / rtb_Add3_j4) * AutopilotLaws_P.Gain_Gain_e5 * AutopilotLaws_P.Gain1_Gain_ja;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain1_Gain_er * rtb_GainTheta1;
  rtb_Cos_i = std::cos(AutopilotLaws_DWork.DelayInput1_DSTATE);
  rtb_Cos1_pk = std::sin(AutopilotLaws_DWork.DelayInput1_DSTATE);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain1_Gain_fl * AutopilotLaws_U.in.data.Psi_magnetic_deg;
  rtb_Add3_i = AutopilotLaws_P.Gain1_Gain_ero * AutopilotLaws_U.in.data.Psi_magnetic_track_deg -
    AutopilotLaws_DWork.DelayInput1_DSTATE;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.ktstomps_Gain_a * AutopilotLaws_U.in.data.V_gnd_kn;
  AutopilotLaws_WashoutFilter(AutopilotLaws_P._Gain_i * (AutopilotLaws_P.GStoGS_CAS_Gain_n *
    AutopilotLaws_DWork.DelayInput1_DSTATE), AutopilotLaws_P.WashoutFilter_C1_p, AutopilotLaws_U.in.time.dt,
    &rtb_Gain1_pj, &AutopilotLaws_DWork.sf_WashoutFilter_j);
  AutopilotLaws_LeadLagFilter(rtb_Gain1_pj - AutopilotLaws_P.g_Gain_g * (AutopilotLaws_P.Gain1_Gain_hv *
    (AutopilotLaws_P.Gain_Gain_mx * (R * (AutopilotLaws_P.Constant_Value_ia - rtb_Cos_i) + rtb_Cos1_pk * std::sin
    (rtb_Add3_i)))), AutopilotLaws_P.HighPassFilter_C1_n, AutopilotLaws_P.HighPassFilter_C2_m,
    AutopilotLaws_P.HighPassFilter_C3_k, AutopilotLaws_P.HighPassFilter_C4_h, AutopilotLaws_U.in.time.dt,
    &AutopilotLaws_DWork.DelayInput1_DSTATE, &AutopilotLaws_DWork.sf_LeadLagFilter_c);
  AutopilotLaws_LeadLagFilter(AutopilotLaws_P.ktstomps_Gain_o * AutopilotLaws_U.in.data.V_ias_kn,
    AutopilotLaws_P.LowPassFilter_C1_l, AutopilotLaws_P.LowPassFilter_C2_c, AutopilotLaws_P.LowPassFilter_C3_g,
    AutopilotLaws_P.LowPassFilter_C4_d, AutopilotLaws_U.in.time.dt, &rtb_Gain1_pj,
    &AutopilotLaws_DWork.sf_LeadLagFilter_p);
  AutopilotLaws_DWork.DelayInput1_DSTATE = (AutopilotLaws_DWork.DelayInput1_DSTATE + rtb_Gain1_pj) *
    AutopilotLaws_P.ug_Gain_f;
  R = AutopilotLaws_P.Gain1_Gain_ot * Phi2;
  rtb_Gain1_pj = AutopilotLaws_DWork.DelayInput1_DSTATE + R;
  rtb_Cos_i = AutopilotLaws_P.Constant1_Value_d - AutopilotLaws_P.Constant2_Value_k;
  R = (AutopilotLaws_P.Gain1_Gain_ou * AutopilotLaws_DWork.DelayInput1_DSTATE + R) * AutopilotLaws_P.Gain_Gain_jg;
  if (rtb_Cos_i > AutopilotLaws_P.Switch_Threshold_a) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Constant1_Value_mi;
  } else {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain5_Gain_g * R;
  }

  rtb_Cos1_pk = rtb_Y_j * AutopilotLaws_P.Gain1_Gain_gy;
  if (rtb_Cos1_pk <= AutopilotLaws_DWork.DelayInput1_DSTATE) {
    if (rtb_Cos_i > AutopilotLaws_P.Switch1_Threshold_b) {
      AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Constant_Value_ow;
    } else {
      AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain6_Gain_c * R;
    }

    if (rtb_Cos1_pk >= AutopilotLaws_DWork.DelayInput1_DSTATE) {
      AutopilotLaws_DWork.DelayInput1_DSTATE = rtb_Cos1_pk;
    }
  }

  Phi2 = (AutopilotLaws_P.Gain_Gain_dm * rtb_Gain1_pj - Phi2) + AutopilotLaws_DWork.DelayInput1_DSTATE;
  AutopilotLaws_SpeedProtectionSignalSelection(&AutopilotLaws_Y.out, rtb_Y_i, std::fmax(-rtb_Y_pf, std::fmin(rtb_Y_pf,
    AutopilotLaws_P.VS_Gain_h * rtb_Y_i)), rtb_Add3_g, AutopilotLaws_P.Gain_Gain_h4 * rtb_Add3_g, Phi2,
    AutopilotLaws_P.Gain_Gain_eq * Phi2, AutopilotLaws_P.Constant_Value_ga, &rtb_Cos1_pk, &rtb_Cos_i);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.kntoms_Gain_c * AutopilotLaws_U.in.data.V_gnd_kn;
  if (AutopilotLaws_DWork.DelayInput1_DSTATE > AutopilotLaws_P.Saturation_UpperSat_oz) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_UpperSat_oz;
  } else if (AutopilotLaws_DWork.DelayInput1_DSTATE < AutopilotLaws_P.Saturation_LowerSat_ou) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_LowerSat_ou;
  }

  rtb_Add3_g = AutopilotLaws_U.in.input.FPA_c_deg - std::atan(AutopilotLaws_P.fpmtoms_Gain_ps *
    AutopilotLaws_U.in.data.H_dot_ft_min / AutopilotLaws_DWork.DelayInput1_DSTATE) * AutopilotLaws_P.Gain_Gain_gt;
  if (!AutopilotLaws_DWork.prevVerticalLaw_not_empty_n) {
    AutopilotLaws_DWork.prevVerticalLaw_b = AutopilotLaws_U.in.input.vertical_law;
    AutopilotLaws_DWork.prevVerticalLaw_not_empty_n = true;
  }

  if (!AutopilotLaws_DWork.prevTarget_not_empty_j) {
    AutopilotLaws_DWork.prevTarget_k = AutopilotLaws_U.in.input.FPA_c_deg;
    AutopilotLaws_DWork.prevTarget_not_empty_j = true;
  }

  AutopilotLaws_DWork.islevelOffActive_k = (((AutopilotLaws_U.in.input.vertical_law == 5.0) &&
    (AutopilotLaws_DWork.prevVerticalLaw_b != 5.0) && (AutopilotLaws_U.in.input.FPA_c_deg == 0.0)) ||
    ((AutopilotLaws_U.in.input.FPA_c_deg == 0.0) && (AutopilotLaws_DWork.prevTarget_k > 1.0)) ||
    ((AutopilotLaws_U.in.input.FPA_c_deg == 0.0) && (AutopilotLaws_U.in.input.vertical_law == 5.0) &&
     AutopilotLaws_DWork.islevelOffActive_k));
  if (AutopilotLaws_DWork.islevelOffActive_k) {
    rtb_Add3_j4 = 0.1;
  } else {
    rtb_Add3_j4 = 0.05;
  }

  rtb_Y_pf = rtb_lo_k * rtb_Add3_j4 * 57.295779513082323;
  AutopilotLaws_DWork.prevVerticalLaw_b = AutopilotLaws_U.in.input.vertical_law;
  AutopilotLaws_DWork.prevTarget_k = AutopilotLaws_U.in.input.FPA_c_deg;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.kntoms_Gain_cv * AutopilotLaws_U.in.data.V_gnd_kn;
  if (AutopilotLaws_DWork.DelayInput1_DSTATE > AutopilotLaws_P.Saturation_UpperSat_bb) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_UpperSat_bb;
  } else if (AutopilotLaws_DWork.DelayInput1_DSTATE < AutopilotLaws_P.Saturation_LowerSat_a4) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_LowerSat_a4;
  }

  Phi2 = std::atan(AutopilotLaws_P.fpmtoms_Gain_d * AutopilotLaws_U.in.data.H_dot_ft_min /
                   AutopilotLaws_DWork.DelayInput1_DSTATE) * AutopilotLaws_P.Gain_Gain_hv;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain1_Gain_ej * rtb_GainTheta;
  rtb_Add3_j4 = AutopilotLaws_P.kntoms_Gain_k * AutopilotLaws_U.in.data.V_gnd_kn;
  if (rtb_Add3_j4 > AutopilotLaws_P.Saturation_UpperSat_pj) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_UpperSat_pj;
  } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation_LowerSat_py) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_LowerSat_py;
  }

  R = AutopilotLaws_DWork.DelayInput1_DSTATE - std::atan(AutopilotLaws_P.fpmtoms_Gain_f *
    AutopilotLaws_U.in.data.H_dot_ft_min / rtb_Add3_j4) * AutopilotLaws_P.Gain_Gain_bf * AutopilotLaws_P.Gain1_Gain_jv;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain1_Gain_gfa * rtb_GainTheta1;
  rtb_Add3_i = std::cos(AutopilotLaws_DWork.DelayInput1_DSTATE);
  rtb_Cos1_j = std::sin(AutopilotLaws_DWork.DelayInput1_DSTATE);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain1_Gain_kw * AutopilotLaws_U.in.data.Psi_magnetic_deg;
  rtb_Add3_j4 = AutopilotLaws_P.Gain1_Gain_j4 * AutopilotLaws_U.in.data.Psi_magnetic_track_deg -
    AutopilotLaws_DWork.DelayInput1_DSTATE;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.ktstomps_Gain_j4 * AutopilotLaws_U.in.data.V_gnd_kn;
  AutopilotLaws_WashoutFilter(AutopilotLaws_P._Gain_kb * (AutopilotLaws_P.GStoGS_CAS_Gain_o *
    AutopilotLaws_DWork.DelayInput1_DSTATE), AutopilotLaws_P.WashoutFilter_C1_j, AutopilotLaws_U.in.time.dt, &rtb_Y_i,
    &AutopilotLaws_DWork.sf_WashoutFilter_h);
  AutopilotLaws_LeadLagFilter(rtb_Y_i - AutopilotLaws_P.g_Gain_l * (AutopilotLaws_P.Gain1_Gain_n4 *
    (AutopilotLaws_P.Gain_Gain_bc * (R * (AutopilotLaws_P.Constant_Value_lf - rtb_Add3_i) + rtb_Cos1_j * std::sin
    (rtb_Add3_j4)))), AutopilotLaws_P.HighPassFilter_C1_i, AutopilotLaws_P.HighPassFilter_C2_h,
    AutopilotLaws_P.HighPassFilter_C3_m, AutopilotLaws_P.HighPassFilter_C4_n, AutopilotLaws_U.in.time.dt, &rtb_Gain1_pj,
    &AutopilotLaws_DWork.sf_LeadLagFilter_e);
  AutopilotLaws_LeadLagFilter(AutopilotLaws_P.ktstomps_Gain_k * AutopilotLaws_U.in.data.V_ias_kn,
    AutopilotLaws_P.LowPassFilter_C1_l4, AutopilotLaws_P.LowPassFilter_C2_po, AutopilotLaws_P.LowPassFilter_C3_f,
    AutopilotLaws_P.LowPassFilter_C4_dt, AutopilotLaws_U.in.time.dt, &rtb_Y_i, &AutopilotLaws_DWork.sf_LeadLagFilter_kp);
  AutopilotLaws_DWork.DelayInput1_DSTATE = (rtb_Gain1_pj + rtb_Y_i) * AutopilotLaws_P.ug_Gain_n;
  R = AutopilotLaws_P.Gain1_Gain_b1 * Phi2;
  rtb_Gain1_pj = AutopilotLaws_DWork.DelayInput1_DSTATE + R;
  rtb_Add3_i = AutopilotLaws_P.Constant3_Value_nk - AutopilotLaws_P.Constant4_Value_o;
  R = (AutopilotLaws_P.Gain1_Gain_on * AutopilotLaws_DWork.DelayInput1_DSTATE + R) * AutopilotLaws_P.Gain_Gain_hy;
  if (rtb_Add3_i > AutopilotLaws_P.Switch_Threshold_d) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Constant1_Value_m;
  } else {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain5_Gain_b * R;
  }

  AutopilotLaws_V_LSSpeedSelection1(AutopilotLaws_U.in.input.V_c_kn, AutopilotLaws_U.in.data.VLS_kn, &rtb_Y_i);
  rtb_Y_i = (AutopilotLaws_U.in.data.V_ias_kn - rtb_Y_i) * AutopilotLaws_P.Gain1_Gain_m1;
  if (rtb_Y_i <= AutopilotLaws_DWork.DelayInput1_DSTATE) {
    if (rtb_Add3_i > AutopilotLaws_P.Switch1_Threshold_d) {
      AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Constant_Value_p0;
    } else {
      AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain6_Gain_n * R;
    }

    if (rtb_Y_i >= AutopilotLaws_DWork.DelayInput1_DSTATE) {
      AutopilotLaws_DWork.DelayInput1_DSTATE = rtb_Y_i;
    }
  }

  rtb_Add3_i = (AutopilotLaws_P.Gain_Gain_d0 * rtb_Gain1_pj - Phi2) + AutopilotLaws_DWork.DelayInput1_DSTATE;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.kntoms_Gain_hi * AutopilotLaws_U.in.data.V_gnd_kn;
  if (AutopilotLaws_DWork.DelayInput1_DSTATE > AutopilotLaws_P.Saturation_UpperSat_cv) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_UpperSat_cv;
  } else if (AutopilotLaws_DWork.DelayInput1_DSTATE < AutopilotLaws_P.Saturation_LowerSat_hd) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_LowerSat_hd;
  }

  Phi2 = std::atan(AutopilotLaws_P.fpmtoms_Gain_o2 * AutopilotLaws_U.in.data.H_dot_ft_min /
                   AutopilotLaws_DWork.DelayInput1_DSTATE) * AutopilotLaws_P.Gain_Gain_pp;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain1_Gain_iw * rtb_GainTheta;
  rtb_Sum_kq = AutopilotLaws_P.kntoms_Gain_i * AutopilotLaws_U.in.data.V_gnd_kn;
  if (rtb_Sum_kq > AutopilotLaws_P.Saturation_UpperSat_nu) {
    rtb_Sum_kq = AutopilotLaws_P.Saturation_UpperSat_nu;
  } else if (rtb_Sum_kq < AutopilotLaws_P.Saturation_LowerSat_ae) {
    rtb_Sum_kq = AutopilotLaws_P.Saturation_LowerSat_ae;
  }

  R = AutopilotLaws_DWork.DelayInput1_DSTATE - std::atan(AutopilotLaws_P.fpmtoms_Gain_hz *
    AutopilotLaws_U.in.data.H_dot_ft_min / rtb_Sum_kq) * AutopilotLaws_P.Gain_Gain_ej * AutopilotLaws_P.Gain1_Gain_lw;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain1_Gain_ky * rtb_GainTheta1;
  rtb_Cos1_j = std::cos(AutopilotLaws_DWork.DelayInput1_DSTATE);
  rtb_Add3_j4 = std::sin(AutopilotLaws_DWork.DelayInput1_DSTATE);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain1_Gain_nrn * AutopilotLaws_U.in.data.Psi_magnetic_deg;
  rtb_Add3_lz = AutopilotLaws_P.Gain1_Gain_ip * AutopilotLaws_U.in.data.Psi_magnetic_track_deg -
    AutopilotLaws_DWork.DelayInput1_DSTATE;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.ktstomps_Gain_l * AutopilotLaws_U.in.data.V_gnd_kn;
  AutopilotLaws_WashoutFilter(AutopilotLaws_P._Gain_ip * (AutopilotLaws_P.GStoGS_CAS_Gain_e *
    AutopilotLaws_DWork.DelayInput1_DSTATE), AutopilotLaws_P.WashoutFilter_C1_c, AutopilotLaws_U.in.time.dt, &rtb_Y_i,
    &AutopilotLaws_DWork.sf_WashoutFilter_g5);
  AutopilotLaws_LeadLagFilter(rtb_Y_i - AutopilotLaws_P.g_Gain_hq * (AutopilotLaws_P.Gain1_Gain_mx *
    (AutopilotLaws_P.Gain_Gain_d3 * (R * (AutopilotLaws_P.Constant_Value_fo - rtb_Cos1_j) + rtb_Add3_j4 * std::sin
    (rtb_Add3_lz)))), AutopilotLaws_P.HighPassFilter_C1_d, AutopilotLaws_P.HighPassFilter_C2_i,
    AutopilotLaws_P.HighPassFilter_C3_d, AutopilotLaws_P.HighPassFilter_C4_nr, AutopilotLaws_U.in.time.dt, &rtb_Gain1_pj,
    &AutopilotLaws_DWork.sf_LeadLagFilter_j);
  AutopilotLaws_LeadLagFilter(AutopilotLaws_P.ktstomps_Gain_mh * AutopilotLaws_U.in.data.V_ias_kn,
    AutopilotLaws_P.LowPassFilter_C1_e, AutopilotLaws_P.LowPassFilter_C2_i, AutopilotLaws_P.LowPassFilter_C3_o5,
    AutopilotLaws_P.LowPassFilter_C4_f, AutopilotLaws_U.in.time.dt, &rtb_Y_i, &AutopilotLaws_DWork.sf_LeadLagFilter_a);
  AutopilotLaws_DWork.DelayInput1_DSTATE = (rtb_Gain1_pj + rtb_Y_i) * AutopilotLaws_P.ug_Gain_e;
  R = AutopilotLaws_P.Gain1_Gain_be * Phi2;
  rtb_Gain1_pj = AutopilotLaws_DWork.DelayInput1_DSTATE + R;
  rtb_Y_i = AutopilotLaws_P.Constant1_Value_o - AutopilotLaws_P.Constant2_Value_h;
  R = (AutopilotLaws_P.Gain1_Gain_nj * AutopilotLaws_DWork.DelayInput1_DSTATE + R) * AutopilotLaws_P.Gain_Gain_aq;
  if (rtb_Y_i > AutopilotLaws_P.Switch_Threshold_g) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Constant1_Value_f;
  } else {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain5_Gain_a * R;
  }

  rtb_Y_j *= AutopilotLaws_P.Gain1_Gain_fle;
  if (rtb_Y_j <= AutopilotLaws_DWork.DelayInput1_DSTATE) {
    if (rtb_Y_i > AutopilotLaws_P.Switch1_Threshold_h) {
      AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Constant_Value_i;
    } else {
      AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain6_Gain_g * R;
    }

    if (rtb_Y_j >= AutopilotLaws_DWork.DelayInput1_DSTATE) {
      AutopilotLaws_DWork.DelayInput1_DSTATE = rtb_Y_j;
    }
  }

  Phi2 = (AutopilotLaws_P.Gain_Gain_gx * rtb_Gain1_pj - Phi2) + AutopilotLaws_DWork.DelayInput1_DSTATE;
  AutopilotLaws_SpeedProtectionSignalSelection(&AutopilotLaws_Y.out, rtb_Add3_g, std::fmax(-rtb_Y_pf, std::fmin(rtb_Y_pf,
    AutopilotLaws_P.Gain_Gain_c3 * rtb_Add3_g)), rtb_Add3_i, AutopilotLaws_P.Gain_Gain_fnw * rtb_Add3_i, Phi2,
    AutopilotLaws_P.Gain_Gain_ko * Phi2, AutopilotLaws_P.Constant_Value_fov, &rtb_FD_h, &rtb_Cos1_j);
  rtb_Add3_g = AutopilotLaws_P.Gain2_Gain_n * AutopilotLaws_U.in.data.H_dot_ft_min *
    AutopilotLaws_P.DiscreteDerivativeVariableTs1_Gain;
  AutopilotLaws_LagFilter((rtb_Add3_g - AutopilotLaws_DWork.Delay_DSTATE_c) / AutopilotLaws_U.in.time.dt,
    AutopilotLaws_P.LagFilter2_C1_d, AutopilotLaws_U.in.time.dt, &AutopilotLaws_DWork.DelayInput1_DSTATE,
    &AutopilotLaws_DWork.sf_LagFilter_f);
  Phi2 = AutopilotLaws_P.kn2ms_Gain * AutopilotLaws_U.in.data.V_gnd_kn;
  AutopilotLaws_LagFilter(AutopilotLaws_P.Gain_Gain_os * (std::tan(AutopilotLaws_P.Gain1_Gain_ox * result[1]) * Phi2),
    AutopilotLaws_P.LagFilter3_C1, AutopilotLaws_U.in.time.dt, &rtb_Gain1_pj, &AutopilotLaws_DWork.sf_LagFilter_l);
  AutopilotLaws_LagFilter(AutopilotLaws_DWork.DelayInput1_DSTATE - rtb_Gain1_pj, AutopilotLaws_P.LagFilter4_C1,
    AutopilotLaws_U.in.time.dt, &Phi2, &AutopilotLaws_DWork.sf_LagFilter_i);
  AutopilotLaws_WashoutFilter(Phi2, AutopilotLaws_P.WashoutFilter1_C1, AutopilotLaws_U.in.time.dt, &rtb_Gain1_pj,
    &AutopilotLaws_DWork.sf_WashoutFilter_db);
  rtb_Add3_j4 = AutopilotLaws_P.Gain4_Gain_n * rtb_Gain1_pj;
  AutopilotLaws_LagFilter(AutopilotLaws_U.in.data.nav_gs_error_deg, AutopilotLaws_P.LagFilter1_C1_l,
    AutopilotLaws_U.in.time.dt, &rtb_Gain1_pj, &AutopilotLaws_DWork.sf_LagFilter_gx);
  R = rtb_Gain1_pj * look1_binlxpw(AutopilotLaws_U.in.data.H_radio_ft,
    AutopilotLaws_P.ScheduledGain_BreakpointsForDimension1_a, AutopilotLaws_P.ScheduledGain_Table_j, 7U) *
    AutopilotLaws_P.Gain_Gain_gm;
  rtb_Compare_l = ((AutopilotLaws_U.in.input.vertical_mode == AutopilotLaws_P.CompareGSTRACK_const) ||
                   (AutopilotLaws_U.in.input.vertical_mode == AutopilotLaws_P.CompareGSTRACK2_const));
  AutopilotLaws_RateLimiter_n(rtb_Compare_l, AutopilotLaws_P.RateLimiterVariableTs_up_d,
    AutopilotLaws_P.RateLimiterVariableTs_lo_c, AutopilotLaws_U.in.time.dt,
    AutopilotLaws_P.RateLimiterVariableTs_InitialCondition_m, &rtb_Gain1_pj, &AutopilotLaws_DWork.sf_RateLimiter_l);
  if (rtb_Gain1_pj > AutopilotLaws_P.Saturation_UpperSat_j1) {
    Phi2 = AutopilotLaws_P.Saturation_UpperSat_j1;
  } else if (rtb_Gain1_pj < AutopilotLaws_P.Saturation_LowerSat_nq) {
    Phi2 = AutopilotLaws_P.Saturation_LowerSat_nq;
  } else {
    Phi2 = rtb_Gain1_pj;
  }

  AutopilotLaws_LagFilter(AutopilotLaws_U.in.data.nav_gs_error_deg, AutopilotLaws_P.LagFilter2_C1_e,
    AutopilotLaws_U.in.time.dt, &rtb_Y_i, &AutopilotLaws_DWork.sf_LagFilter_cf);
  rtb_Add3_i = AutopilotLaws_P.DiscreteDerivativeVariableTs_Gain_g * rtb_Y_i;
  AutopilotLaws_DWork.DelayInput1_DSTATE = look1_binlxpw(AutopilotLaws_U.in.data.H_radio_ft,
    AutopilotLaws_P.ScheduledGain3_BreakpointsForDimension1, AutopilotLaws_P.ScheduledGain3_Table, 4U);
  AutopilotLaws_LagFilter(rtb_Y_i + (rtb_Add3_i - AutopilotLaws_DWork.Delay_DSTATE_b) / AutopilotLaws_U.in.time.dt *
    AutopilotLaws_DWork.DelayInput1_DSTATE, AutopilotLaws_P.LagFilter_C1_d, AutopilotLaws_U.in.time.dt, &rtb_Gain1_pj,
    &AutopilotLaws_DWork.sf_LagFilter_p);
  if (rtb_Add3_j4 > AutopilotLaws_P.Saturation_UpperSat_ko) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_UpperSat_ko;
  } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation_LowerSat_ez) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_LowerSat_ez;
  }

  AutopilotLaws_SignalEnablerGSTrack(AutopilotLaws_P.Gain3_Gain_c * ((AutopilotLaws_P.Gain2_Gain_k * rtb_Add3_j4 + R) *
    Phi2 + (AutopilotLaws_P.Constant_Value_lu - Phi2) * (rtb_Gain1_pj * look1_binlxpw(AutopilotLaws_U.in.data.H_radio_ft,
    AutopilotLaws_P.ScheduledGain2_BreakpointsForDimension1_h, AutopilotLaws_P.ScheduledGain2_Table_p, 7U))),
    (AutopilotLaws_U.in.data.H_radio_ft > AutopilotLaws_P.CompareToConstant_const_kt) &&
    AutopilotLaws_U.in.data.nav_gs_valid, &rtb_Sum_kq);
  AutopilotLaws_storevalue(rtb_error_d == AutopilotLaws_P.CompareToConstant6_const_e,
    AutopilotLaws_Y.out.data.nav_gs_deg, &rtb_Gain1_pj, &AutopilotLaws_DWork.sf_storevalue_g);
  if (rtb_Gain1_pj > AutopilotLaws_P.Saturation_UpperSat_e0) {
    Phi2 = AutopilotLaws_P.Saturation_UpperSat_e0;
  } else if (rtb_Gain1_pj < AutopilotLaws_P.Saturation_LowerSat_ph) {
    Phi2 = AutopilotLaws_P.Saturation_LowerSat_ph;
  } else {
    Phi2 = rtb_Gain1_pj;
  }

  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.fpmtoms_Gain_g4 * AutopilotLaws_U.in.data.H_dot_ft_min;
  rtb_Add3_j4 = AutopilotLaws_P.kntoms_Gain_k4 * AutopilotLaws_U.in.data.V_gnd_kn;
  if (rtb_Add3_j4 > AutopilotLaws_P.Saturation_UpperSat_eb) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_UpperSat_eb;
  } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation_LowerSat_gk) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_LowerSat_gk;
  }

  AutopilotLaws_DWork.DelayInput1_DSTATE = std::atan(AutopilotLaws_DWork.DelayInput1_DSTATE / rtb_Add3_j4) *
    AutopilotLaws_P.Gain_Gain_ow;
  AutopilotLaws_SignalEnablerGSTrack(AutopilotLaws_P.Gain2_Gain_l * (Phi2 - AutopilotLaws_DWork.DelayInput1_DSTATE),
    rtb_Compare_l, &rtb_Gain1_pj);
  AutopilotLaws_Voter1(rtb_Sum_kq + rtb_Gain1_pj, AutopilotLaws_P.Gain1_Gain_d4 * ((Phi2 + AutopilotLaws_P.Bias_Bias) -
    AutopilotLaws_DWork.DelayInput1_DSTATE), AutopilotLaws_P.Gain_Gain_eyl * ((Phi2 + AutopilotLaws_P.Bias1_Bias) -
    AutopilotLaws_DWork.DelayInput1_DSTATE), &R);
  rtb_Product_dh = R * look1_binlxpw(AutopilotLaws_U.in.data.V_tas_kn,
    AutopilotLaws_P.ScheduledGain1_BreakpointsForDimension1, AutopilotLaws_P.ScheduledGain1_Table, 6U);
  rtb_Gain4 = (rtb_GainTheta - AutopilotLaws_P.Constant2_Value_f) * AutopilotLaws_P.Gain4_Gain_oy;
  rtb_Y_i = AutopilotLaws_P.Gain5_Gain_c * AutopilotLaws_U.in.data.bz_m_s2;
  AutopilotLaws_WashoutFilter(AutopilotLaws_U.in.data.bx_m_s2, AutopilotLaws_P.WashoutFilter_C1_m,
    AutopilotLaws_U.in.time.dt, &rtb_Y_pf, &AutopilotLaws_DWork.sf_WashoutFilter_g);
  rtb_Compare_l = (rtb_error_d == AutopilotLaws_P.CompareToConstant7_const);
  AutopilotLaws_LagFilter(AutopilotLaws_U.in.data.H_dot_ft_min, AutopilotLaws_P.LagFilterH_C1,
    AutopilotLaws_U.in.time.dt, &rtb_Y_j, &AutopilotLaws_DWork.sf_LagFilter_a);
  Phi2 = rtb_Y_j - AutopilotLaws_P.kntofpm_Gain * AutopilotLaws_U.in.data.V_gnd_kn * AutopilotLaws_P.maxslope_Gain;
  AutopilotLaws_LeadLagFilter(AutopilotLaws_U.in.data.H_radio_ft, AutopilotLaws_P.LeadLagFilter_C1,
    AutopilotLaws_P.LeadLagFilter_C2, AutopilotLaws_P.LeadLagFilter_C3, AutopilotLaws_P.LeadLagFilter_C4,
    AutopilotLaws_U.in.time.dt, &rtb_Y_j, &AutopilotLaws_DWork.sf_LeadLagFilter_k);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain1_Gain_oa * rtb_Y_j;
  rtb_Add3_lz = std::fmax(Phi2, AutopilotLaws_DWork.DelayInput1_DSTATE);
  if (!AutopilotLaws_DWork.wasActive_not_empty) {
    AutopilotLaws_DWork.wasActive = rtb_Compare_l;
    AutopilotLaws_DWork.wasActive_not_empty = true;
  }

  if ((!AutopilotLaws_DWork.wasActive) && rtb_Compare_l) {
    R = std::abs(rtb_Add3_lz) / 60.0;
    AutopilotLaws_DWork.Tau = AutopilotLaws_U.in.data.H_radio_ft / (R - 2.5);
    AutopilotLaws_DWork.H_bias = AutopilotLaws_DWork.Tau * R - AutopilotLaws_U.in.data.H_radio_ft;
  }

  if (rtb_Compare_l) {
    rtb_Vz = -1.0 / AutopilotLaws_DWork.Tau * (AutopilotLaws_U.in.data.H_radio_ft + AutopilotLaws_DWork.H_bias) * 60.0;
  } else {
    rtb_Vz = rtb_Add3_lz;
  }

  AutopilotLaws_DWork.wasActive = rtb_Compare_l;
  AutopilotLaws_LeadLagFilter(rtb_Vz, AutopilotLaws_P.LeadLagFilter_C1_a, AutopilotLaws_P.LeadLagFilter_C2_p,
    AutopilotLaws_P.LeadLagFilter_C3_m, AutopilotLaws_P.LeadLagFilter_C4_k, AutopilotLaws_U.in.time.dt, &rtb_Gain1_pj,
    &AutopilotLaws_DWork.sf_LeadLagFilter_hp);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.kntoms_Gain_av * AutopilotLaws_U.in.data.V_gnd_kn;
  if (AutopilotLaws_DWork.DelayInput1_DSTATE > AutopilotLaws_P.Saturation_UpperSat_i0) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_UpperSat_i0;
  } else if (AutopilotLaws_DWork.DelayInput1_DSTATE < AutopilotLaws_P.Saturation_LowerSat_nd) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_LowerSat_nd;
  } else {
    rtb_Add3_j4 = AutopilotLaws_DWork.DelayInput1_DSTATE;
  }

  R = AutopilotLaws_P.ftmintoms_Gain_k * rtb_Gain1_pj / rtb_Add3_j4;
  if (AutopilotLaws_DWork.DelayInput1_DSTATE > AutopilotLaws_P.Saturation_UpperSat_ew) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_UpperSat_ew;
  } else if (AutopilotLaws_DWork.DelayInput1_DSTATE < AutopilotLaws_P.Saturation_LowerSat_an) {
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Saturation_LowerSat_an;
  }

  rtb_Add3_j4 = (rtb_Vz - rtb_Add3_lz) * AutopilotLaws_P.ftmintoms_Gain_j / AutopilotLaws_DWork.DelayInput1_DSTATE;
  if (R > 1.0) {
    R = 1.0;
  } else if (R < -1.0) {
    R = -1.0;
  }

  if (rtb_Add3_j4 > 1.0) {
    rtb_Add3_j4 = 1.0;
  } else if (rtb_Add3_j4 < -1.0) {
    rtb_Add3_j4 = -1.0;
  }

  rtb_Sum1_g = AutopilotLaws_P.Gain_Gain_gr * std::asin(R) * AutopilotLaws_P.Gain1_Gain_ml +
    AutopilotLaws_P.Gain_Gain_by * std::asin(rtb_Add3_j4) * AutopilotLaws_P.Gain2_Gain_m;
  rtb_uDLookupTable_m = look1_binlxpw(AutopilotLaws_U.in.data.total_weight_kg, AutopilotLaws_P.uDLookupTable_bp01Data,
    AutopilotLaws_P.uDLookupTable_tableData, 3U);
  rtb_Sum_es = AutopilotLaws_P.Constant1_Value_o0 - rtb_GainTheta;
  rtb_Sum3_m3 = AutopilotLaws_P.Constant2_Value_kz - AutopilotLaws_U.in.data.H_ind_ft;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.fpmtoms_Gain_po * AutopilotLaws_U.in.data.H_dot_ft_min;
  rtb_Add3_j4 = AutopilotLaws_P.kntoms_Gain_bh * AutopilotLaws_U.in.data.V_gnd_kn;
  if (rtb_Add3_j4 > AutopilotLaws_P.Saturation_UpperSat_pd) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_UpperSat_pd;
  } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation_LowerSat_l) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_LowerSat_l;
  }

  AutopilotLaws_DWork.DelayInput1_DSTATE = std::atan(AutopilotLaws_DWork.DelayInput1_DSTATE / rtb_Add3_j4) *
    AutopilotLaws_P.Gain_Gain_cr;
  R = AutopilotLaws_P.Gain1_Gain_ga * AutopilotLaws_DWork.DelayInput1_DSTATE;
  rtb_Gain1_pj = AutopilotLaws_P.Gain1_Gain_hm2 * rtb_GainTheta1;
  rtb_Add3_j4 = AutopilotLaws_P.kntoms_Gain_py * AutopilotLaws_U.in.data.V_gnd_kn;
  if (rtb_Add3_j4 > AutopilotLaws_P.Saturation_UpperSat_ec) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_UpperSat_ec;
  } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation_LowerSat_m) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_LowerSat_m;
  }

  rtb_GainTheta1 = (AutopilotLaws_P.Gain1_Gain_ol * rtb_GainTheta - std::atan(AutopilotLaws_P.fpmtoms_Gain_k *
    AutopilotLaws_U.in.data.H_dot_ft_min / rtb_Add3_j4) * AutopilotLaws_P.Gain_Gain_hc * AutopilotLaws_P.Gain1_Gain_ln) *
    (AutopilotLaws_P.Constant_Value_h - std::cos(rtb_Gain1_pj));
  rtb_Add3_j4 = std::sin(rtb_Gain1_pj);
  rtb_Sum_kq = AutopilotLaws_P.Gain1_Gain_it * AutopilotLaws_U.in.data.Psi_magnetic_track_deg;
  rtb_Add3_aj = rtb_Sum_kq - AutopilotLaws_P.Gain1_Gain_a * AutopilotLaws_U.in.data.Psi_magnetic_deg;
  rtb_Gain1_pj = AutopilotLaws_P.ktstomps_Gain_k5 * AutopilotLaws_U.in.data.V_gnd_kn;
  AutopilotLaws_WashoutFilter(AutopilotLaws_P._Gain_f * (AutopilotLaws_P.GStoGS_CAS_Gain_j * rtb_Gain1_pj),
    AutopilotLaws_P.WashoutFilter_C1_cn, AutopilotLaws_U.in.time.dt, &rtb_Gain1_pj,
    &AutopilotLaws_DWork.sf_WashoutFilter_i);
  AutopilotLaws_LeadLagFilter(rtb_Gain1_pj - AutopilotLaws_P.g_Gain_p * (AutopilotLaws_P.Gain1_Gain_mxw *
    (AutopilotLaws_P.Gain_Gain_er * (rtb_GainTheta1 + rtb_Add3_j4 * std::sin(rtb_Add3_aj)))),
    AutopilotLaws_P.HighPassFilter_C1_gw, AutopilotLaws_P.HighPassFilter_C2_e, AutopilotLaws_P.HighPassFilter_C3_di,
    AutopilotLaws_P.HighPassFilter_C4_a, AutopilotLaws_U.in.time.dt, &rtb_Sum_kq,
    &AutopilotLaws_DWork.sf_LeadLagFilter_g);
  AutopilotLaws_LeadLagFilter(AutopilotLaws_P.ktstomps_Gain_mf * AutopilotLaws_U.in.data.V_ias_kn,
    AutopilotLaws_P.LowPassFilter_C1_d1, AutopilotLaws_P.LowPassFilter_C2_e, AutopilotLaws_P.LowPassFilter_C3_l,
    AutopilotLaws_P.LowPassFilter_C4_a, AutopilotLaws_U.in.time.dt, &rtb_Gain1_pj,
    &AutopilotLaws_DWork.sf_LeadLagFilter_n);
  rtb_Gain1_pj = (rtb_Sum_kq + rtb_Gain1_pj) * AutopilotLaws_P.ug_Gain_c;
  rtb_GainTheta1 = (AutopilotLaws_P.Gain1_Gain_nc * rtb_Gain1_pj + R) * AutopilotLaws_P.Gain_Gain_bg;
  rtb_Add3_j4 = (AutopilotLaws_U.in.data.V_ias_kn - AutopilotLaws_U.in.input.V_c_kn) * AutopilotLaws_P.Gain1_Gain_ke;
  rtb_Compare_l = ((rtb_Sum3_m3 > AutopilotLaws_P.CompareToConstant6_const_d) && (rtb_GainTheta1 <
    AutopilotLaws_P.CompareToConstant5_const_h) && (rtb_Add3_j4 < AutopilotLaws_P.CompareToConstant2_const_j) &&
                   (rtb_error_d == AutopilotLaws_P.CompareToConstant8_const));
  R += rtb_Gain1_pj;
  if (rtb_Compare_l) {
    rtb_Gain1_pj = AutopilotLaws_P.Constant_Value_o;
  } else {
    if (rtb_Sum3_m3 > AutopilotLaws_P.CompareToConstant_const_h) {
      rtb_Gain1_pj = AutopilotLaws_P.Constant1_Value_g5;
    } else {
      rtb_Gain1_pj = AutopilotLaws_P.Gain5_Gain_n * rtb_GainTheta1;
    }

    if (rtb_Add3_j4 <= rtb_Gain1_pj) {
      if (rtb_Sum3_m3 > AutopilotLaws_P.CompareToConstant4_const_e) {
        rtb_Gain1_pj = std::fmax(AutopilotLaws_P.Constant2_Value_m, AutopilotLaws_P.Gain1_Gain_m * rtb_GainTheta1);
      } else {
        rtb_Gain1_pj = AutopilotLaws_P.Gain6_Gain_fa * rtb_GainTheta1;
      }

      if (rtb_Add3_j4 >= rtb_Gain1_pj) {
        rtb_Gain1_pj = rtb_Add3_j4;
      }
    }
  }

  rtb_GainTheta1 = (AutopilotLaws_P.Gain_Gain_c2 * R - AutopilotLaws_DWork.DelayInput1_DSTATE) + rtb_Gain1_pj;
  rtb_Add3_j4 = AutopilotLaws_P.kntoms_Gain_om * AutopilotLaws_U.in.data.V_tas_kn;
  if (rtb_Sum3_m3 < 0.0) {
    R = -1.0;
  } else if (rtb_Sum3_m3 > 0.0) {
    R = 1.0;
  } else {
    R = rtb_Sum3_m3;
  }

  if (rtb_Add3_j4 > AutopilotLaws_P.Saturation_UpperSat_ed) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_UpperSat_ed;
  } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation_LowerSat_ee) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_LowerSat_ee;
  }

  rtb_Add3_j4 = (R * AutopilotLaws_P.Constant3_Value_ew - AutopilotLaws_U.in.data.H_dot_ft_min) *
    AutopilotLaws_P.ftmintoms_Gain_m / rtb_Add3_j4;
  if (rtb_Add3_j4 > 1.0) {
    rtb_Add3_j4 = 1.0;
  } else if (rtb_Add3_j4 < -1.0) {
    rtb_Add3_j4 = -1.0;
  }

  rtb_Gain_n4 = AutopilotLaws_P.Gain_Gain_kon * std::asin(rtb_Add3_j4);
  rtb_Gain1_pj = AutopilotLaws_P.kntoms_Gain_iw * AutopilotLaws_U.in.data.V_tas_kn;
  if (rtb_Gain1_pj > AutopilotLaws_P.Saturation_UpperSat_jt) {
    rtb_Gain1_pj = AutopilotLaws_P.Saturation_UpperSat_jt;
  } else if (rtb_Gain1_pj < AutopilotLaws_P.Saturation_LowerSat_ih) {
    rtb_Gain1_pj = AutopilotLaws_P.Saturation_LowerSat_ih;
  }

  rtb_Add3_j4 = (AutopilotLaws_P.Constant_Value_iaf - AutopilotLaws_U.in.data.H_dot_ft_min) *
    AutopilotLaws_P.ftmintoms_Gain_lv / rtb_Gain1_pj;
  if (rtb_Add3_j4 > 1.0) {
    rtb_Add3_j4 = 1.0;
  } else if (rtb_Add3_j4 < -1.0) {
    rtb_Add3_j4 = -1.0;
  }

  rtb_Add3_aj = AutopilotLaws_P.Gain_Gain_o1 * std::asin(rtb_Add3_j4);
  if (rtb_Compare_l) {
    rtb_Gain1_pj = rtb_GainTheta1;
  } else if (rtb_Sum3_m3 > AutopilotLaws_P.Switch_Threshold_k) {
    rtb_Gain1_pj = std::fmax(rtb_GainTheta1, rtb_Gain_n4);
  } else {
    rtb_Gain1_pj = std::fmin(rtb_GainTheta1, rtb_Gain_n4);
  }

  AutopilotLaws_Voter1(rtb_Sum_es, rtb_Gain1_pj, rtb_Add3_aj, &R);
  AutopilotLaws_LagFilter(AutopilotLaws_U.in.input.H_c_ft - AutopilotLaws_U.in.data.H_ft, AutopilotLaws_P.LagFilter_C1_b,
    AutopilotLaws_U.in.time.dt, &rtb_Gain1_pj, &AutopilotLaws_DWork.sf_LagFilter_d);
  rtb_Add3_j4 = AutopilotLaws_P.Gain2_Gain_hq * rtb_Gain1_pj;
  rtb_Gain1_pj = AutopilotLaws_P.kntoms_Gain_j * AutopilotLaws_U.in.data.V_tas_kn;
  if (rtb_Add3_j4 > AutopilotLaws_P.Saturation_UpperSat_f3) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_UpperSat_f3;
  } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation_LowerSat_b) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_LowerSat_b;
  }

  if (rtb_Gain1_pj > AutopilotLaws_P.Saturation_UpperSat_nuy) {
    rtb_Gain1_pj = AutopilotLaws_P.Saturation_UpperSat_nuy;
  } else if (rtb_Gain1_pj < AutopilotLaws_P.Saturation_LowerSat_dj) {
    rtb_Gain1_pj = AutopilotLaws_P.Saturation_LowerSat_dj;
  }

  rtb_Add3_j4 = ((AutopilotLaws_U.in.input.H_dot_c_fpm + rtb_Add3_j4) - AutopilotLaws_U.in.data.H_dot_ft_min) *
    AutopilotLaws_P.ftmintoms_Gain_kr / rtb_Gain1_pj;
  if (rtb_Add3_j4 > 1.0) {
    rtb_Add3_j4 = 1.0;
  } else if (rtb_Add3_j4 < -1.0) {
    rtb_Add3_j4 = -1.0;
  }

  rtb_Sum_kq = AutopilotLaws_P.Gain_Gain_fs * std::asin(rtb_Add3_j4);
  switch (static_cast<int32_T>(rtb_error_d)) {
   case 0:
    b_L = AutopilotLaws_P.Constant_Value_dh;
    break;

   case 1:
    b_L = a;
    break;

   case 2:
    break;

   case 3:
    if (rtb_Compare_jy) {
      b_L = rtb_lo_b;
    } else if (distance_m > AutopilotLaws_P.Switch_Threshold) {
      b_L = std::fmax(rtb_lo_b, rtb_Sum_i);
    } else {
      b_L = std::fmin(rtb_lo_b, rtb_Sum_i);
    }
    break;

   case 4:
    b_L = rtb_Cos1_pk;
    break;

   case 5:
    b_L = rtb_FD_h;
    break;

   case 6:
    b_L = AutopilotLaws_P.Gain1_Gain_d * rtb_Product_dh;
    break;

   case 7:
    if (rtb_on_ground > AutopilotLaws_P.Switch1_Threshold_j) {
      b_L = AutopilotLaws_P.Gain2_Gain_h * rtb_Gain4;
    } else {
      b_L = ((AutopilotLaws_P.Gain1_Gain_i * rtb_Y_pf + rtb_Y_i) + rtb_Sum1_g * rtb_uDLookupTable_m) *
        AutopilotLaws_P.Gain6_Gain_f;
    }
    break;

   case 8:
    b_L = R;
    break;

   default:
    b_L = rtb_Sum_kq;
    break;
  }

  if (b_L > AutopilotLaws_P.Constant1_Value_i) {
    rtb_Gain1_pj = AutopilotLaws_P.Constant1_Value_i;
  } else {
    rtb_Gain1_pj = AutopilotLaws_P.Gain1_Gain_n * AutopilotLaws_P.Constant1_Value_i;
    if (b_L >= rtb_Gain1_pj) {
      rtb_Gain1_pj = b_L;
    }
  }

  AutopilotLaws_RateLimiter(rtb_Gain1_pj - rtb_dme, AutopilotLaws_P.RateLimiterVariableTs1_up,
    AutopilotLaws_P.RateLimiterVariableTs1_lo, AutopilotLaws_U.in.time.dt,
    AutopilotLaws_P.RateLimiterVariableTs1_InitialCondition, &rtb_Gain1_pj, &AutopilotLaws_DWork.sf_RateLimiter_h);
  AutopilotLaws_LagFilter(rtb_Gain1_pj, AutopilotLaws_P.LagFilter_C1_gh, AutopilotLaws_U.in.time.dt, &R,
    &AutopilotLaws_DWork.sf_LagFilter_pe);
  AutopilotLaws_DWork.icLoad_f = ((rtb_fpmtoms == 0) || AutopilotLaws_DWork.icLoad_f);
  if (AutopilotLaws_DWork.icLoad_f) {
    AutopilotLaws_DWork.Delay_DSTATE_h2 = rtb_GainTheta;
  }

  AutopilotLaws_VSLimiter(AutopilotLaws_P.VS_Gain_n * a, &AutopilotLaws_Y.out, &rtb_Gain1_pj);
  if (!rtb_Compare_jy) {
    if (distance_m > AutopilotLaws_P.Switch_Threshold_h) {
      rtb_lo_b = std::fmax(rtb_lo_b, AutopilotLaws_P.VS_Gain_j * rtb_Sum_i);
    } else {
      rtb_lo_b = std::fmin(rtb_lo_b, AutopilotLaws_P.VS_Gain_j * rtb_Sum_i);
    }
  }

  AutopilotLaws_VSLimiter(AutopilotLaws_P.Gain_Gain_k2 * rtb_lo_b, &AutopilotLaws_Y.out, &distance_m);
  AutopilotLaws_VSLimiter_f(rtb_Product_dh, &AutopilotLaws_Y.out, &rtb_lo_b);
  a = AutopilotLaws_P.Gain3_Gain_l * rtb_Y_pf;
  b_L = AutopilotLaws_P.VS_Gain_e * rtb_Sum1_g;
  AutopilotLaws_WashoutFilter(rtb_Saturation, AutopilotLaws_P.WashoutFilter1_C1_h, AutopilotLaws_U.in.time.dt, &rtb_dme,
    &AutopilotLaws_DWork.sf_WashoutFilter_k);
  rtb_Add3_j4 = std::abs(rtb_dme);
  if (rtb_Add3_j4 > AutopilotLaws_P.Saturation_UpperSat_ig) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_UpperSat_ig;
  } else if (rtb_Add3_j4 < AutopilotLaws_P.Saturation_LowerSat_ous) {
    rtb_Add3_j4 = AutopilotLaws_P.Saturation_LowerSat_ous;
  }

  rtb_Saturation = AutopilotLaws_P.Gain_Gain_j0 * rtb_Add3_j4;
  if (rtb_on_ground <= AutopilotLaws_P.Switch_Threshold_c) {
    rtb_Gain4 = ((rtb_Y_i + a) + rtb_uDLookupTable_m * b_L) + rtb_Saturation;
  }

  AutopilotLaws_VSLimiter_f(rtb_Gain4, &AutopilotLaws_Y.out, &rtb_dme);
  if (!rtb_Compare_l) {
    if (rtb_Sum3_m3 > AutopilotLaws_P.Switch_Threshold_hz) {
      rtb_GainTheta1 = std::fmax(rtb_GainTheta1, AutopilotLaws_P.VS_Gain_n5 * rtb_Gain_n4);
    } else {
      rtb_GainTheta1 = std::fmin(rtb_GainTheta1, AutopilotLaws_P.VS_Gain_n5 * rtb_Gain_n4);
    }
  }

  AutopilotLaws_Voter1(rtb_Sum_es, AutopilotLaws_P.Gain_Gain_o2 * rtb_GainTheta1, AutopilotLaws_P.VS_Gain_nx *
                       rtb_Add3_aj, &rtb_Sum_i);
  AutopilotLaws_VSLimiter(rtb_Sum_i, &AutopilotLaws_Y.out, &rtb_GainTheta1);
  if (AutopilotLaws_U.in.input.vertical_mode == 24.0) {
    rtb_Add3_j4 = 0.15;
  } else {
    rtb_Add3_j4 = 0.1;
  }

  rtb_Y_pf = rtb_lo_k * rtb_Add3_j4 * 57.295779513082323;
  switch (static_cast<int32_T>(rtb_error_d)) {
   case 0:
    rtb_Gain1_pj = AutopilotLaws_P.Constant_Value_dh;
    break;

   case 1:
    break;

   case 2:
    rtb_Gain1_pj = L;
    break;

   case 3:
    rtb_Gain1_pj = distance_m;
    break;

   case 4:
    rtb_Gain1_pj = rtb_Cos_i;
    break;

   case 5:
    rtb_Gain1_pj = rtb_Cos1_j;
    break;

   case 6:
    rtb_Gain1_pj = rtb_lo_b;
    break;

   case 7:
    rtb_Gain1_pj = rtb_dme;
    break;

   case 8:
    rtb_Gain1_pj = rtb_GainTheta1;
    break;

   default:
    rtb_Gain1_pj = std::fmax(-rtb_Y_pf, std::fmin(rtb_Y_pf, AutopilotLaws_P.VS_Gain_ne * rtb_Sum_kq));
    break;
  }

  rtb_Gain1_pj += rtb_GainTheta;
  if (rtb_Gain1_pj > AutopilotLaws_P.Constant1_Value_i) {
    rtb_Gain1_pj = AutopilotLaws_P.Constant1_Value_i;
  } else {
    rtb_GainTheta1 = AutopilotLaws_P.Gain1_Gain_m4 * AutopilotLaws_P.Constant1_Value_i;
    if (rtb_Gain1_pj < rtb_GainTheta1) {
      rtb_Gain1_pj = rtb_GainTheta1;
    }
  }

  rtb_GainTheta1 = rtb_lo_k * 0.3 * 57.295779513082323;
  AutopilotLaws_DWork.DelayInput1_DSTATE = rtb_GainTheta1 * AutopilotLaws_U.in.time.dt;
  rtb_Gain1_pj = std::fmin(rtb_Gain1_pj - AutopilotLaws_DWork.Delay_DSTATE_h2, AutopilotLaws_DWork.DelayInput1_DSTATE);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain1_Gain_i0 * rtb_GainTheta1;
  AutopilotLaws_DWork.DelayInput1_DSTATE *= AutopilotLaws_U.in.time.dt;
  AutopilotLaws_DWork.Delay_DSTATE_h2 += std::fmax(rtb_Gain1_pj, AutopilotLaws_DWork.DelayInput1_DSTATE);
  AutopilotLaws_LagFilter(AutopilotLaws_DWork.Delay_DSTATE_h2, AutopilotLaws_P.LagFilter_C1_i,
    AutopilotLaws_U.in.time.dt, &rtb_dme, &AutopilotLaws_DWork.sf_LagFilter_gn);
  AutopilotLaws_RateLimiter(static_cast<real_T>(rtb_fpmtoms), AutopilotLaws_P.RateLimiterVariableTs_up_i,
    AutopilotLaws_P.RateLimiterVariableTs_lo_o, AutopilotLaws_U.in.time.dt,
    AutopilotLaws_P.RateLimiterVariableTs_InitialCondition_p, &rtb_Gain1_pj, &AutopilotLaws_DWork.sf_RateLimiter_eb);
  if (rtb_Gain1_pj > AutopilotLaws_P.Saturation_UpperSat_ix) {
    rtb_Gain1_pj = AutopilotLaws_P.Saturation_UpperSat_ix;
  } else if (rtb_Gain1_pj < AutopilotLaws_P.Saturation_LowerSat_eq) {
    rtb_Gain1_pj = AutopilotLaws_P.Saturation_LowerSat_eq;
  }

  rtb_GainTheta1 = rtb_dme * rtb_Gain1_pj;
  AutopilotLaws_LagFilter(rtb_Y_j, AutopilotLaws_P.LagFilter1_C1_d, AutopilotLaws_U.in.time.dt, &rtb_dme,
    &AutopilotLaws_DWork.sf_LagFilter_cs);
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.Gain7_Gain_l * rtb_dme;
  AutopilotLaws_Y.out.output.flight_director.Theta_c_deg = R;
  AutopilotLaws_Y.out.output.autopilot.Theta_c_deg = (AutopilotLaws_P.Constant_Value_i4 - rtb_Gain1_pj) * rtb_GainTheta
    + rtb_GainTheta1;
  AutopilotLaws_Y.out.output.flare_law.condition_Flare = ((AutopilotLaws_U.in.data.H_radio_ft < 60.0) &&
    ((AutopilotLaws_U.in.data.H_radio_ft * 15.0 <= std::abs(std::fmax(AutopilotLaws_DWork.DelayInput1_DSTATE, Phi2))) ||
     (AutopilotLaws_U.in.data.H_radio_ft <= 45.0)));
  AutopilotLaws_Y.out.output.flare_law.H_dot_radio_fpm = rtb_Add3_lz;
  AutopilotLaws_Y.out.output.flare_law.H_dot_c_fpm = rtb_Vz;
  AutopilotLaws_Y.out.output.flare_law.delta_Theta_H_dot_deg = b_L;
  AutopilotLaws_Y.out.output.flare_law.delta_Theta_bz_deg = rtb_Y_i;
  AutopilotLaws_Y.out.output.flare_law.delta_Theta_bx_deg = a;
  AutopilotLaws_Y.out.output.flare_law.delta_Theta_beta_c_deg = rtb_Saturation;
  AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_U.in.data.altimeter_setting_left_mbar;
  AutopilotLaws_DWork.DelayInput1_DSTATE_g = AutopilotLaws_U.in.data.altimeter_setting_right_mbar;
  AutopilotLaws_DWork.Delay_DSTATE = b_R;
  for (rtb_fpmtoms = 0; rtb_fpmtoms < 99; rtb_fpmtoms++) {
    AutopilotLaws_DWork.Delay_DSTATE_l[rtb_fpmtoms] = AutopilotLaws_DWork.Delay_DSTATE_l[rtb_fpmtoms + 1];
    AutopilotLaws_DWork.Delay_DSTATE_h5[rtb_fpmtoms] = AutopilotLaws_DWork.Delay_DSTATE_h5[rtb_fpmtoms + 1];
  }

  AutopilotLaws_DWork.Delay_DSTATE_l[99] = rtb_valid;
  AutopilotLaws_DWork.Delay_DSTATE_h5[99] = rtb_valid_d;
  AutopilotLaws_DWork.icLoad = false;
  AutopilotLaws_DWork.Delay_DSTATE_c = rtb_Add3_g;
  AutopilotLaws_DWork.Delay_DSTATE_b = rtb_Add3_i;
  AutopilotLaws_DWork.icLoad_f = false;
}

void AutopilotLawsModelClass::initialize()
{
  {
    real_T rtb_out_f;
    AutopilotLaws_DWork.DelayInput1_DSTATE = AutopilotLaws_P.DetectChange_vinit;
    AutopilotLaws_DWork.DelayInput1_DSTATE_g = AutopilotLaws_P.DetectChange1_vinit;
    AutopilotLaws_DWork.Delay_DSTATE = AutopilotLaws_P.DiscreteDerivativeVariableTs_InitialCondition;
    AutopilotLaws_DWork.Delay_DSTATE_h = AutopilotLaws_P.DiscreteTimeIntegratorVariableTs_InitialCondition;
    for (int32_T i{0}; i < 100; i++) {
      AutopilotLaws_DWork.Delay_DSTATE_l[i] = AutopilotLaws_P.Delay_InitialCondition;
      AutopilotLaws_DWork.Delay_DSTATE_h5[i] = AutopilotLaws_P.Delay_InitialCondition_b;
    }

    AutopilotLaws_DWork.icLoad = true;
    AutopilotLaws_DWork.Delay_DSTATE_c = AutopilotLaws_P.DiscreteDerivativeVariableTs1_InitialCondition;
    AutopilotLaws_DWork.Delay_DSTATE_b = AutopilotLaws_P.DiscreteDerivativeVariableTs_InitialCondition_f;
    AutopilotLaws_DWork.icLoad_f = true;
    AutopilotLaws_Chart_g_Init(&rtb_out_f);
    AutopilotLaws_Chart_g_Init(&rtb_out_f);
    AutopilotLaws_Chart_Init(&rtb_out_f);
    AutopilotLaws_MATLABFunction_f_Init(&AutopilotLaws_DWork.sf_MATLABFunction_m);
    AutopilotLaws_Chart_Init(&rtb_out_f);
    AutopilotLaws_MATLABFunction_f_Init(&AutopilotLaws_DWork.sf_MATLABFunction_e);
    AutopilotLaws_B.u = AutopilotLaws_P.Y_Y0;
    AutopilotLaws_DWork.k = 5.0;
    AutopilotLaws_DWork.maxH_dot = 1500.0;
  }
}

void AutopilotLawsModelClass::terminate()
{
}

AutopilotLawsModelClass::AutopilotLawsModelClass():
  AutopilotLaws_U(),
  AutopilotLaws_Y(),
  AutopilotLaws_B(),
  AutopilotLaws_DWork()
{
}

AutopilotLawsModelClass::~AutopilotLawsModelClass()
{
}
