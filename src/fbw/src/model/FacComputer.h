#ifndef RTW_HEADER_FacComputer_h_
#define RTW_HEADER_FacComputer_h_
#include "rtwtypes.h"
#include "FacComputer_types.h"

class FacComputer final
{
 public:
  struct rtDW_LagFilter_FacComputer_T {
    real_T pY;
    real_T pU;
    boolean_T pY_not_empty;
    boolean_T pU_not_empty;
  };

  struct rtDW_RateLimiter_FacComputer_T {
    real_T pY;
    boolean_T pY_not_empty;
  };

  struct rtDW_LagFilter_FacComputer_g_T {
    real32_T pY;
    real32_T pU;
    boolean_T pY_not_empty;
    boolean_T pU_not_empty;
  };

  struct rtDW_MATLABFunction_FacComputer_f_T {
    real_T timeSinceCondition;
    boolean_T output;
  };

  struct D_Work_FacComputer_T {
    real_T Delay_DSTATE;
    real_T Delay1_DSTATE;
    real_T Delay2_DSTATE;
    real_T Delay_DSTATE_d;
    real_T Delay_DSTATE_m;
    real_T Delay_DSTATE_k;
    real_T pY;
    real_T pU;
    real_T pY_n;
    real_T sAlphaFloor;
    uint8_T is_active_c15_FacComputer;
    uint8_T is_c15_FacComputer;
    boolean_T Memory_PreviousInput;
    boolean_T pY_not_empty;
    boolean_T pU_not_empty;
    boolean_T previousInput;
    boolean_T previousInput_not_empty;
    boolean_T pY_not_empty_l;
    boolean_T Runtime_MODE;
    rtDW_MATLABFunction_FacComputer_f_T sf_MATLABFunction_ax;
    rtDW_MATLABFunction_FacComputer_f_T sf_MATLABFunction_p;
    rtDW_LagFilter_FacComputer_T sf_LagFilter_c;
    rtDW_LagFilter_FacComputer_g_T sf_LagFilter_d;
    rtDW_LagFilter_FacComputer_T sf_LagFilter_f;
    rtDW_LagFilter_FacComputer_g_T sf_LagFilter_k;
    rtDW_LagFilter_FacComputer_T sf_LagFilter_b;
    rtDW_RateLimiter_FacComputer_T sf_RateLimiter_a;
    rtDW_RateLimiter_FacComputer_T sf_RateLimiter_n;
    rtDW_RateLimiter_FacComputer_T sf_RateLimiter_j;
    rtDW_RateLimiter_FacComputer_T sf_RateLimiter_c;
    rtDW_RateLimiter_FacComputer_T sf_RateLimiter;
    rtDW_LagFilter_FacComputer_T sf_LagFilter;
  };

  struct ExternalInputs_FacComputer_T {
    fac_inputs in;
  };

  struct ExternalOutputs_FacComputer_T {
    fac_outputs out;
  };

  struct Parameters_FacComputer_T {
    base_fac_logic_outputs fac_logic_output_MATLABStruct;
    base_fac_flight_envelope_outputs fac_flight_envelope_output_MATLABStruct;
    base_fac_analog_outputs fac_analog_output_MATLABStruct;
    base_fac_laws_outputs fac_laws_output_MATLABStruct;
    base_fac_discrete_outputs fac_discrete_output_MATLABStruct;
    real_T LagFilter_C1;
    real_T LagFilter1_C1;
    real_T LagFilter2_C1;
    real_T LagFilter3_C1;
    real_T LagFilter_C1_f;
    real_T LagFilter_C1_k;
    real_T WashoutFilter_C1;
    real_T DiscreteDerivativeVariableTs_Gain;
    real_T DiscreteTimeIntegratorVariableTs_Gain;
    real_T DiscreteDerivativeVariableTs_InitialCondition;
    real_T DiscreteTimeIntegratorVariableTs_InitialCondition;
    real_T RateLimiterDynamicEqualVariableTs_InitialCondition;
    real_T RateLimiterDynamicEqualVariableTs_InitialCondition_a;
    real_T RateLimiterVariableTs_InitialCondition;
    real_T DiscreteTimeIntegratorVariableTs_LowerLimit;
    real_T DiscreteTimeIntegratorVariableTs_UpperLimit;
    real_T BitfromLabel1_bit;
    real_T BitfromLabel4_bit;
    real_T BitfromLabel3_bit;
    real_T BitfromLabel2_bit;
    real_T BitfromLabel_bit;
    real_T BitfromLabel5_bit;
    real_T BitfromLabel6_bit;
    real_T BitfromLabel7_bit;
    real_T BitfromLabel8_bit;
    real_T BitfromLabel6_bit_m;
    real_T BitfromLabel7_bit_i;
    real_T BitfromLabel_bit_i;
    real_T BitfromLabel1_bit_b;
    real_T BitfromLabel2_bit_d;
    real_T BitfromLabel3_bit_n;
    real_T BitfromLabel4_bit_c;
    real_T BitfromLabel5_bit_g;
    real_T BitfromLabel9_bit;
    real_T BitfromLabel8_bit_i;
    real_T BitfromLabel_bit_a;
    real_T BitfromLabel1_bit_i;
    real_T BitfromLabel2_bit_di;
    real_T BitfromLabel3_bit_g;
    real_T BitfromLabel4_bit_f;
    real_T BitfromLabel5_bit_g3;
    real_T BitfromLabel_bit_j;
    real_T BitfromLabel1_bit_e;
    real_T BitfromLabel_bit_c;
    real_T BitfromLabel1_bit_n;
    real_T BitfromLabel3_bit_k;
    real_T BitfromLabel4_bit_k;
    real_T CompareToConstant_const;
    real_T RateLimiterGenericVariableTs1_lo;
    real_T RateLimiterGenericVariableTs1_lo_n;
    real_T RateLimiterGenericVariableTs4_lo;
    real_T RateLimiterGenericVariableTs3_lo;
    real_T RateLimiterGenericVariableTs2_lo;
    real_T RateLimiterVariableTs_lo;
    real_T ConfirmNode_timeDelay;
    real_T ConfirmNode_timeDelay_l;
    real_T RateLimiterGenericVariableTs1_up;
    real_T RateLimiterGenericVariableTs1_up_g;
    real_T RateLimiterGenericVariableTs4_up;
    real_T RateLimiterGenericVariableTs3_up;
    real_T RateLimiterGenericVariableTs2_up;
    real_T RateLimiterVariableTs_up;
    SignStatusMatrix EnumeratedConstant1_Value;
    SignStatusMatrix EnumeratedConstant2_Value;
    SignStatusMatrix EnumeratedConstant_Value;
    real32_T CompareToConstant_const_f;
    real32_T CompareToConstant1_const;
    real32_T CompareToConstant2_const;
    boolean_T SRFlipFlop_initial_condition;
    boolean_T ConfirmNode_isRisingEdge;
    boolean_T ConfirmNode_isRisingEdge_o;
    boolean_T PulseNode_isRisingEdge;
    fac_outputs out_Y0;
    base_fac_bus Constant4_Value;
    real_T Constant_Value;
    real_T Constant_Value_n;
    real_T uDLookupTable_tableData[7];
    real_T uDLookupTable_bp01Data[7];
    real_T Saturation_UpperSat;
    real_T Saturation_LowerSat;
    real_T Constant1_Value;
    real_T Gain2_Gain;
    real_T Gain_Gain;
    real_T Gain_Gain_p;
    real_T Saturation1_UpperSat;
    real_T Saturation1_LowerSat;
    real_T Gain_Gain_h;
    real_T Saturation_UpperSat_a;
    real_T Saturation_LowerSat_l;
    real_T Gain5_Gain;
    real_T Saturation1_UpperSat_o;
    real_T Saturation1_LowerSat_n;
    real_T Gain_Gain_k;
    real_T alphafloor_tableData[24];
    real_T alphafloor_bp01Data[4];
    real_T alphafloor_bp02Data[6];
    real_T alpha0_tableData[6];
    real_T alpha0_bp01Data[6];
    real_T alphamax_tableData[24];
    real_T alphamax_bp01Data[4];
    real_T alphamax_bp02Data[6];
    real_T alphaprotection_tableData[24];
    real_T alphaprotection_bp01Data[4];
    real_T alphaprotection_bp02Data[6];
    real_T alphastallwarn_tableData[24];
    real_T alphastallwarn_bp01Data[4];
    real_T alphastallwarn_bp02Data[6];
    real_T Delay1_InitialCondition;
    real_T Gain1_Gain;
    real_T Saturation_UpperSat_e;
    real_T Saturation_LowerSat_i;
    real_T Delay2_InitialCondition;
    real_T Constant_Value_b;
    real_T Gain_Gain_b;
    real_T Saturation_UpperSat_ew;
    real_T Saturation_LowerSat_o;
    real_T Constant_Value_k;
    real_T Gain_Gain_m;
    real_T Constant_Value_bu;
    real_T Switch7_Threshold;
    real_T Switch6_Threshold;
    real32_T Gain4_Gain;
    real32_T Constant28_Value;
    real32_T Constant22_Value;
    real32_T Constant21_Value;
    real32_T Constant4_Value_b;
    real32_T Constant2_Value;
    real32_T Constant1_Value_k;
    real32_T Constant26_Value;
    real32_T Constant15_Value;
    real32_T Constant14_Value;
    real32_T Constant11_Value;
    real32_T Constant8_Value;
    real32_T Constant7_Value;
    real32_T Constant6_Value;
    real32_T Constant5_Value;
    real32_T Constant17_Value;
    uint32_T alphafloor_maxIndex[2];
    uint32_T alphamax_maxIndex[2];
    uint32_T alphaprotection_maxIndex[2];
    uint32_T alphastallwarn_maxIndex[2];
    boolean_T Constant_Value_c;
    boolean_T Constant_Value_h;
    boolean_T Constant_Value_b5;
    boolean_T reset_Value;
    boolean_T reset_Value_k;
    boolean_T reset_Value_o;
    boolean_T reset_Value_a;
    boolean_T reset_Value_i;
    boolean_T Logic_table[16];
    boolean_T Constant2_Value_o;
    boolean_T Constant1_Value_d;
    boolean_T Constant20_Value;
    boolean_T Constant10_Value;
    boolean_T Constant18_Value;
    boolean_T Constant9_Value;
    boolean_T Constant19_Value;
  };

  FacComputer(FacComputer const&) = delete;
  FacComputer& operator= (FacComputer const&) & = delete;
  FacComputer(FacComputer &&) = delete;
  FacComputer& operator= (FacComputer &&) = delete;
  void setExternalInputs(const ExternalInputs_FacComputer_T *pExternalInputs_FacComputer_T)
  {
    FacComputer_U = *pExternalInputs_FacComputer_T;
  }

  const ExternalOutputs_FacComputer_T &getExternalOutputs() const
  {
    return FacComputer_Y;
  }

  void initialize();
  void step();
  static void terminate();
  FacComputer();
  ~FacComputer();
 private:
  ExternalInputs_FacComputer_T FacComputer_U;
  ExternalOutputs_FacComputer_T FacComputer_Y;
  D_Work_FacComputer_T FacComputer_DWork;
  static Parameters_FacComputer_T FacComputer_P;
  static void FacComputer_MATLABFunction(const base_arinc_429 *rtu_u, boolean_T *rty_y);
  static void FacComputer_MATLABFunction_f(const base_arinc_429 *rtu_u, real_T rtu_bit, uint32_T *rty_y);
  static void FacComputer_LagFilter_Reset(rtDW_LagFilter_FacComputer_T *localDW);
  static void FacComputer_LagFilter(real_T rtu_U, real_T rtu_C1, real_T rtu_dt, real_T *rty_Y,
    rtDW_LagFilter_FacComputer_T *localDW);
  static void FacComputer_MATLABFunction_d(boolean_T rtu_bit1, boolean_T rtu_bit2, boolean_T rtu_bit3, boolean_T
    rtu_bit4, boolean_T rtu_bit5, boolean_T rtu_bit6, real_T *rty_handleIndex);
  static void FacComputer_RateLimiter_Reset(rtDW_RateLimiter_FacComputer_T *localDW);
  static void FacComputer_RateLimiter(real_T rtu_u, real_T rtu_up, real_T rtu_lo, real_T rtu_Ts, boolean_T rtu_reset,
    real_T *rty_Y, rtDW_RateLimiter_FacComputer_T *localDW);
  static void FacComputer_CalculateV_alpha_max(real_T rtu_v_ias, real_T rtu_alpha, real_T rtu_alpha_0, real_T
    rtu_alpha_target, real_T *rty_V_alpha_target);
  static void FacComputer_LagFilter_n_Reset(rtDW_LagFilter_FacComputer_g_T *localDW);
  static void FacComputer_LagFilter_k(real32_T rtu_U, real_T rtu_C1, real_T rtu_dt, real32_T *rty_Y,
    rtDW_LagFilter_FacComputer_g_T *localDW);
  static void FacComputer_MATLABFunction_i_Reset(rtDW_MATLABFunction_FacComputer_f_T *localDW);
  static void FacComputer_MATLABFunction_p(boolean_T rtu_u, real_T rtu_Ts, boolean_T rtu_isRisingEdge, real_T
    rtu_timeDelay, boolean_T *rty_y, rtDW_MATLABFunction_FacComputer_f_T *localDW);
  static void FacComputer_MATLABFunction_g(const boolean_T rtu_u[19], real32_T *rty_y);
};

#endif

