﻿// A32NX_FADEC.cpp

#include "FadecGauge.h"

FadecGauge FADEC_GAUGE;

__attribute__((export_name("FadecGauge_gauge_callback"))) extern "C" bool FadecGauge_gauge_callback(FsContext ctx,
                                                                                                    int service_id,
                                                                                                    void* pData) {
  switch (service_id) {
    case PANEL_SERVICE_PRE_INSTALL: {
      return true;
    } break;
    case PANEL_SERVICE_POST_INSTALL: {
      return FADEC_GAUGE.InitializeFADEC();
    } break;
    case PANEL_SERVICE_PRE_DRAW: {
      sGaugeDrawData* drawData = static_cast<sGaugeDrawData*>(pData);
      return FADEC_GAUGE.OnUpdate(drawData->dt);
    } break;
    case PANEL_SERVICE_PRE_KILL: {
      FADEC_GAUGE.KillFADEC();
      return true;
    } break;
  }
  return false;
}
