#pragma once

#include "SimVars.h"
#include "common.h"

EngineRatios* ratios;

/// <summary>
/// Table 1502 (CN2 vs correctedN1) representations with FSX nomenclature
/// </summary>
/// <returns>Returns CN2 - correctedN1 pair.</returns>
double table1502(int i, int j) {
  double t[13][4] = {{17.18454936,0,0,0}, {20.77253219,2.132653061,2.132653061,2.132653061}, {24.54935622,2.806122449,2.806122449,2.806122449}, {53.81974249,14.36734694,14.36734694,14.36734694},
                    {66,22,22,22}, {71.24492754,26.51105651,26.51105651,26.51105651}, {75.61076605,32.03783686,32.03783686,32.03783686}, {81.07660455,41.77738824,41.77738824,41.77738824}, {84.53830228,52.002457,52.002457,52.002457},
                    {88.36438923,66.27764128,66.27764128,66.27764128}, {91.09730849,78.51351351,78.51351351,78.51351351}, {94.74120083,86.67076167,86.67076167,86.67076167}, {110,105,105,105}};

  return t[i][j];
}

/// <summary>
/// Calculate expected CN2 at Idle
/// </summary>
double iCN2(double pressAltitude, double mach) {
  double cn2 = 0;

  cn2 = 66.0 / (sqrt((288.15 - (1.98 * pressAltitude / 1000)) / 288.15) * sqrt(1 + (0.2 * powFBW(mach, 2))));

  return cn2;
}

/// <summary>
/// Calculate expected correctedN1 at Idle
/// </summary>
double iCN1(double pressAltitude, double mach, double ambientTemp) {
  int i;
  double cn1_lo = 0, cn1_hi = 0, cn1 = 0;
  double cn2 = iCN2(pressAltitude, mach);
  double cell = 0;
  double cn2lo = 0, cn2hi = 0;
  double cn1lolo = 0, cn1hilo = 0, cn1lohi = 0, cn1hihi = 0;

  for (i = 0; i < 13; i++) {
    cell = table1502(i, 0);
    if (cell > cn2) {
      break;
    }
  }

  cn2lo = table1502(i - 1, 0);
  cn2hi = table1502(i, 0);

  cn1lolo = table1502(i - 1, 1);
  cn1hilo = table1502(i, 1);

  if (mach <= 0.2) {
    cn1 = interpolate(cn2, cn2lo, cn2hi, cn1lolo, cn1hilo);
  } else {
    cn1lohi = table1502(i - 1, 3);
    cn1hihi = table1502(i, 3);

    cn1_lo = interpolate(cn2, cn2lo, cn2hi, cn1lolo, cn1hilo);
    cn1_hi = interpolate(cn2, cn2lo, cn2hi, cn1lohi, cn1hihi);
    cn1 = interpolate(mach, 0.2, 0.9, cn1_lo, cn1_hi);
  }

  return cn1;
}
