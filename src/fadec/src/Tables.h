#pragma once

#include "SimVars.h"
#include "common.h"

EngineRatios* ratios;

/// <summary>
/// Interpolation function being used by MSFS for the engine tables
/// </summary>
/// <returns>Interpolated 'y' for a given 'x'.</returns>
double interpolate(double x, double x0, double x1, double y0, double y1) {
  double y = 0;

  y = ((y0 * (x1 - x)) + (y1 * (x - x0))) / (x1 - x0);

  return y;
}

/// <summary>
/// Table 1502 (CN2 vs correctedN1) representations with FSX nomenclature
/// </summary>
/// <returns>Returns CN2 - correctedN1 pair.</returns>
double table1502(int i, int j) {
  double t[13][2] = { {17.1846,0}, {20.7725,2.1327}, {24.5494,2.8061}, {53.8197,14.3674}, {66,22}, {71.245,26.5111}, {75.611,32.038}, {81.0766,41.7774}, {84.5383,51.0025}, {88.3644,66.2776}, {91.0973,78.5135}, {94.7412,86.6708}, {110,105} };

  return t[i][j];
}

/// <summary>
/// Calculate expected CN2 at Idle
/// </summary>
double iCN2(double pressAltitude) {
  double cn2 = 0;

  cn2 = 66.0 / sqrt((288.15 - (1.98 * pressAltitude / 1000)) / 288.15);

  return cn2;
}

/// <summary>
/// Calculate expected correctedN1 at Idle
/// </summary>
double iCN1(double pressAltitude, double ambientTemp) {
  int i;
  double cn1 = 0;
  double cn2 = iCN2(pressAltitude);
  double cell = 0;
  double cn2lo = 0, cn2hi = 0, cn1lo = 0, cn1hi = 0;

  for (i = 0; i < 13; i++) {
    cell = table1502(i, 0);
    if (cell > cn2) {
      break;
    }
  }
  cn2lo = table1502(i - 1, 0);
  cn2hi = table1502(i, 0);
  cn1lo = table1502(i - 1, 1);
  cn1hi = table1502(i, 1);

  cn1 = interpolate(cn2, cn2lo, cn2hi, cn1lo, cn1hi);

  return cn1;
}
