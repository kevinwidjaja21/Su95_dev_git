#include "AutopilotStateMachine.h"
#include "AutopilotStateMachine_private.h"

AutopilotStateMachineModelClass::Parameters_AutopilotStateMachine_T AutopilotStateMachineModelClass::
  AutopilotStateMachine_P{

  {
    {
      0.0,
      0.0
    },

    {
      {
        0.0,
        0.0,
        0.0
      },
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      false,
      0.0,
      0.0,
      0.0,
      0.0,
      false,
      0.0,
      0.0,

      {
        0.0,
        0.0,
        0.0
      },
      false,
      0.0,
      false,
      0.0,

      {
        0.0,
        0.0,
        0.0
      },
      false,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      false,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      false,
      false,
      false,
      0.0
    },

    {
      0.0,
      0.0,
      0.0,
      false,
      false,
      false,
      false,
      false,
      false
    },

    {
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      0.0,
      fm_requested_vertical_mode_NONE,
      0.0,
      0.0,
      false,
      false,
      false,
      false,
      0.0,
      0.0,
      0.0,
      false
    },

    {
      {
        false,
        false
      },

      {
        false,
        false,
        false,
        false,
        false,
        false,
        false
      },

      {
        lateral_mode_NONE,
        false,
        false,
        lateral_law_NONE,
        0.0
      }
    },

    {
      {
        false,
        false
      },

      {
        false,
        false,
        false,
        false,
        false,
        false,
        false
      },

      {
        lateral_mode_NONE,
        false,
        false,
        lateral_law_NONE,
        0.0
      }
    },

    {
      {
        false,
        false,
        false,
        false,
        false,
        false,
        false
      },

      {
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false
      },

      {
        vertical_mode_NONE,
        athr_requested_mode_NONE,
        false,
        0.0,
        false,
        vertical_law_NONE,
        0.0,
        0.0,
        0.0,
        0.0,
        false,
        false,
        false,
        false,
        false,
        false,
        NONE,
        false,
        false,
        false,
        false
      }
    },

    {
      {
        false,
        false,
        false,
        false,
        false,
        false,
        false
      },

      {
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false
      },

      {
        vertical_mode_NONE,
        athr_requested_mode_NONE,
        false,
        0.0,
        false,
        vertical_law_NONE,
        0.0,
        0.0,
        0.0,
        0.0,
        false,
        false,
        false,
        false,
        false,
        false,
        NONE,
        false,
        false,
        false,
        false
      }
    },

    {
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      false,
      false,
      false,
      false,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      0.0,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false
    }
  },

  1.0,

  0.0,

  0.0,

  0.0,

  0.0,

  0.0,

  0.0,

  0.0,

  0.0,

  0.0,

  0.5,

  3.0,

  1.0,

  1.0,

  1.0,

  1.0,

  1.0,

  10.0,

  10.0,

  0.0,

  -1.0,

  -1.0,

  0.0,

  0.0,

  0.0,

  0.0,

  0.0,

  0.0,

  0.0,

  0.0,

  0.0,

  0.0,

  0.0,

  false,

  false,

  false,

  false,

  false,

  false,

  false,

  false,

  false,

  false,

  false,

  false,

  false,

  false,

  false,


  {
    {
      false,
      false,
      false,
      false,
      false,
      false,
      false
    },

    {
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false
    },

    {
      vertical_mode_NONE,
      athr_requested_mode_NONE,
      false,
      0.0,
      false,
      vertical_law_NONE,
      0.0,
      0.0,
      0.0,
      0.0,
      false,
      false,
      false,
      false,
      false,
      false,
      NONE,
      false,
      false,
      false,
      false
    }
  },


  {
    {
      false,
      false
    },

    {
      false,
      false,
      false,
      false,
      false,
      false,
      false
    },

    {
      lateral_mode_NONE,
      false,
      false,
      lateral_law_NONE,
      0.0
    }
  },

  0.0,

  1000.0,

  -1.0,

  -1.0,

  -1.0,

  57.295779513082323,

  -1.0,

  57.295779513082323,

  57.295779513082323,

  -1.0,

  2.0,

  1.0,

  1.0,

  0.0,

  2.0,

  1.0,

  0.0,

  -25.0,

  0.5,

  0.0,

  0.5,

  0.0,

  0.5,

  0.0,

  1000.0,

  -1.0,

  1000.0,

  -1.0,

  1000.0,

  -1.0,

  1000.0,

  -1.0,

  1000.0,

  -1.0,

  1000.0,

  -1.0,

  1000.0,

  -1.0,

  1000.0,

  -1.0
};
