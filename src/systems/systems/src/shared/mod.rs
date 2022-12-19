use crate::{
    electrical::{ElectricalElement, ElectricitySource, Potential},
    pneumatic::{EngineModeSelector, EngineState, PneumaticValveSignal},
    simulation::UpdateContext,
};

use num_derive::FromPrimitive;
use std::{cell::Ref, fmt::Display, time::Duration};
use uom::si::{
    f64::*,
    length::meter,
    pressure::{hectopascal, pascal},
    thermodynamic_temperature::{degree_celsius, kelvin},
};

pub mod low_pass_filter;
pub mod pid;
pub mod update_iterator;

mod random;
pub use random::*;
pub mod arinc429;

pub trait ReservoirAirPressure {
    fn green_reservoir_pressure(&self) -> Pressure;
    fn blue_reservoir_pressure(&self) -> Pressure;
    fn yellow_reservoir_pressure(&self) -> Pressure;
}

pub trait AuxiliaryPowerUnitElectrical:
    ControllerSignal<ContactorSignal> + ApuAvailable + ElectricalElement + ElectricitySource
{
    fn output_within_normal_parameters(&self) -> bool;
}

pub trait ApuAvailable {
    fn is_available(&self) -> bool;
}

pub trait EngineFirePushButtons {
    /// Indicates if the fire push button of the given engine is released.
    fn is_released(&self, engine_number: usize) -> bool;
}

pub trait EmergencyElectricalRatPushButton {
    fn is_pressed(&self) -> bool;
}
pub trait EmergencyElectricalState {
    fn is_in_emergency_elec(&self) -> bool;
}

pub trait ApuMaster {
    fn master_sw_is_on(&self) -> bool;
}

pub trait ApuStart {
    fn start_is_on(&self) -> bool;
}

pub trait HydraulicGeneratorControlUnit {
    fn max_allowed_power(&self) -> Power;
    fn motor_speed(&self) -> AngularVelocity;
}

pub trait ControlValveCommand {
    fn valve_position_command(&self) -> Ratio;
}

pub trait EmergencyGeneratorPower {
    fn generated_power(&self) -> Power;
}

pub trait FeedbackPositionPickoffUnit {
    fn angle(&self) -> Angle;
}

pub trait LgciuWeightOnWheels {
    fn right_gear_compressed(&self, treat_ext_pwr_as_ground: bool) -> bool;
    fn right_gear_extended(&self, treat_ext_pwr_as_ground: bool) -> bool;

    fn left_gear_compressed(&self, treat_ext_pwr_as_ground: bool) -> bool;
    fn left_gear_extended(&self, treat_ext_pwr_as_ground: bool) -> bool;

    fn left_and_right_gear_compressed(&self, treat_ext_pwr_as_ground: bool) -> bool;
    fn left_and_right_gear_extended(&self, treat_ext_pwr_as_ground: bool) -> bool;

    fn nose_gear_compressed(&self, treat_ext_pwr_as_ground: bool) -> bool;
    fn nose_gear_extended(&self, treat_ext_pwr_as_ground: bool) -> bool;
}
pub trait LgciuGearExtension {
    fn all_down_and_locked(&self) -> bool;
    fn all_up_and_locked(&self) -> bool;
}

pub trait LgciuDoorPosition {
    fn all_fully_opened(&self) -> bool;
    fn all_closed_and_locked(&self) -> bool;
}

pub trait LgciuGearControl {
    fn should_open_doors(&self) -> bool;
    fn should_extend_gears(&self) -> bool;
    fn control_active(&self) -> bool;
}

pub trait LandingGearHandle {
    fn gear_handle_is_down(&self) -> bool;
    fn gear_handle_baulk_locked(&self) -> bool;
}

pub trait LgciuInterface:
    LgciuWeightOnWheels + LgciuGearExtension + LgciuDoorPosition + LgciuGearControl + LandingGearHandle
{
}

#[derive(Copy, Clone, PartialEq, Eq, Debug)]
#[repr(usize)]
pub enum LgciuId {
    Lgciu1 = 0,
    Lgciu2 = 1,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum ProximityDetectorId {
    UplockGearNose1,
    UplockGearNose2,
    UplockGearLeft1,
    UplockGearLeft2,
    UplockGearRight1,
    UplockGearRight2,
    DownlockGearNose1,
    DownlockGearNose2,
    DownlockGearLeft1,
    DownlockGearLeft2,
    DownlockGearRight1,
    DownlockGearRight2,

    UplockDoorNose1,
    UplockDoorNose2,
    UplockDoorLeft1,
    UplockDoorLeft2,
    UplockDoorRight1,
    UplockDoorRight2,
    DownlockDoorNose1,
    DownlockDoorNose2,
    DownlockDoorLeft1,
    DownlockDoorLeft2,
    DownlockDoorRight1,
    DownlockDoorRight2,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum GearActuatorId {
    GearNose,
    GearDoorNose,
    GearLeft,
    GearDoorLeft,
    GearRight,
    GearDoorRight,
}

pub trait EngineCorrectedN1 {
    fn corrected_n1(&self) -> Ratio;
}

pub trait EngineCorrectedN2 {
    fn corrected_n2(&self) -> Ratio;
}

pub trait EngineUncorrectedN2 {
    fn uncorrected_n2(&self) -> Ratio;
}

pub trait Cabin {
    fn altitude(&self) -> Length;
    fn pressure(&self) -> Pressure;
}

pub trait PneumaticBleed {
    fn apu_bleed_is_on(&self) -> bool;
    fn engine_crossbleed_is_on(&self) -> bool;
}

pub trait EngineStartState {
    fn left_engine_state(&self) -> EngineState;
    fn right_engine_state(&self) -> EngineState;
    fn engine_mode_selector(&self) -> EngineModeSelector;
}

pub trait EngineBleedPushbutton {
    fn engine_bleed_pushbuttons_are_auto(&self) -> [bool; 2];
}

pub trait PackFlowValveState {
    // Pack id is 1 or 2
    fn pack_flow_valve_open_amount(&self, pack_id: usize) -> Ratio;
    fn pack_flow_valve_air_flow(&self, pack_id: usize) -> MassRate;
}

pub trait GroundSpeed {
    fn ground_speed(&self) -> Velocity;
}

pub trait AdirsDiscreteOutputs {
    fn low_speed_warning_1_104kts(&self, adiru_number: usize) -> bool;
    fn low_speed_warning_2_54kts(&self, adiru_number: usize) -> bool;
    fn low_speed_warning_3_159kts(&self, adiru_number: usize) -> bool;
    fn low_speed_warning_4_260kts(&self, adiru_number: usize) -> bool;
}

pub enum GearWheel {
    NOSE = 0,
    LEFT = 1,
    RIGHT = 2,
}

pub trait SectionPressure {
    fn pressure(&self) -> Pressure;
    fn pressure_downstream_leak_valve(&self) -> Pressure;
    fn is_pressure_switch_pressurised(&self) -> bool;
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HydraulicColor {
    Green,
    Blue,
    Yellow,
}
impl Display for HydraulicColor {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Green => write!(f, "GREEN"),
            Self::Blue => write!(f, "BLUE"),
            Self::Yellow => write!(f, "YELLOW"),
        }
    }
}

/// The common types of electrical buses within Airbus aircraft.
/// These include types such as AC, DC, AC ESS, etc.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum ElectricalBusType {
    AlternatingCurrent(u8),
    AlternatingCurrentEssential,
    AlternatingCurrentEssentialShed,
    AlternatingCurrentStaticInverter,
    AlternatingCurrentGndFltService,
    DirectCurrent(u8),
    DirectCurrentEssential,
    DirectCurrentEssentialShed,
    DirectCurrentBattery,
    DirectCurrentHot(u8),
    DirectCurrentGndFltService,

    /// A sub bus is a subsection of a larger bus. An example of
    /// a sub bus is the A320's 202PP, which is a sub bus of DC BUS 2 (2PP).
    ///
    /// Sub buses represent a very small area of the electrical system. To keep things simple,
    /// they shouldn't be used for the vast majority of situations. Thus, prefer using a main
    /// bus over a sub bus. They do however come in handy when handling very specific situations,
    /// such as the APU STARTER MOTOR which is powered by a smaller section of the DC BAT BUS on the A320.
    /// Implementing this without a sub bus leads to additional work and reduces the commonality in
    /// handling the flow of electricity. In such cases, use the sub bus.
    ///
    /// As sub buses represent such a small area, their state is not exported towards
    /// the simulator.
    Sub(&'static str),
}
impl Display for ElectricalBusType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ElectricalBusType::AlternatingCurrent(number) => write!(f, "AC_{}", number),
            ElectricalBusType::AlternatingCurrentEssential => write!(f, "AC_ESS"),
            ElectricalBusType::AlternatingCurrentEssentialShed => write!(f, "AC_ESS_SHED"),
            ElectricalBusType::AlternatingCurrentStaticInverter => write!(f, "AC_STAT_INV"),
            ElectricalBusType::AlternatingCurrentGndFltService => write!(f, "AC_GND_FLT_SVC"),
            ElectricalBusType::DirectCurrent(number) => write!(f, "DC_{}", number),
            ElectricalBusType::DirectCurrentEssential => write!(f, "DC_ESS"),
            ElectricalBusType::DirectCurrentEssentialShed => write!(f, "DC_ESS_SHED"),
            ElectricalBusType::DirectCurrentBattery => write!(f, "DC_BAT"),
            ElectricalBusType::DirectCurrentHot(number) => write!(f, "DC_HOT_{}", number),
            ElectricalBusType::DirectCurrentGndFltService => write!(f, "DC_GND_FLT_SVC"),
            ElectricalBusType::Sub(name) => write!(f, "SUB_{}", name),
        }
    }
}

/// Trait through which elements can query the potential and powered state
/// of electrical buses.
pub trait ElectricalBuses {
    /// Returns the potential which is fed to the given bus type.
    fn potential_of(&self, bus_type: ElectricalBusType) -> Ref<Potential>;

    /// Returns whether the given bus type is powered.
    fn is_powered(&self, bus_type: ElectricalBusType) -> bool;

    /// Returns whether any of the given bus types are powered.
    fn any_is_powered(&self, bus_types: &[ElectricalBusType]) -> bool;
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum PotentialOrigin {
    EngineGenerator(usize),
    ApuGenerator(usize),
    External,
    EmergencyGenerator,
    Battery(usize),
    TransformerRectifier(usize),
    StaticInverter,
}
impl Display for PotentialOrigin {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PotentialOrigin::EngineGenerator(number) => write!(f, "EngineGenerator({})", number),
            PotentialOrigin::ApuGenerator(number) => write!(f, "ApuGenerator({})", number),
            PotentialOrigin::External => write!(f, "ExternalPower"),
            PotentialOrigin::EmergencyGenerator => write!(f, "EmergencyGenerator"),
            PotentialOrigin::Battery(number) => write!(f, "Battery({})", number),
            PotentialOrigin::TransformerRectifier(number) => {
                write!(f, "TransformerRectifier({})", number)
            }
            PotentialOrigin::StaticInverter => write!(f, "StaticInverter"),
        }
    }
}

/// Trait through which elements can query the power consumed throughout the aircraft.
pub trait PowerConsumptionReport {
    /// Returns whether or not the given element is powered.
    fn is_powered(&self, element: &impl ElectricalElement) -> bool;

    /// Returns the total power consumed from the given [PotentialOrigin].
    fn total_consumption_of(&self, potential_origin: PotentialOrigin) -> Power;
}

/// Trait through which elements can consume power from the aircraft's electrical system.
pub trait ConsumePower: PowerConsumptionReport {
    /// Returns the input potential of the given element.
    fn input_of(&self, element: &impl ElectricalElement) -> Ref<Potential>;

    /// Consumes the given amount of power from the potential provided to the element.
    fn consume_from_input(&mut self, element: &impl ElectricalElement, power: Power);

    /// Consumes the given amount of power from the provided electrical bus.
    fn consume_from_bus(&mut self, bus_type: ElectricalBusType, power: Power);
}

pub trait ControllerSignal<S> {
    fn signal(&self) -> Option<S>;
}

#[derive(Clone, Copy)]
pub struct ApuBleedAirValveSignal {
    target_open_amount: Ratio,
}
impl PneumaticValveSignal for ApuBleedAirValveSignal {
    fn new(target_open_amount: Ratio) -> Self {
        Self { target_open_amount }
    }

    fn target_open_amount(&self) -> Ratio {
        self.target_open_amount
    }
}

pub trait PneumaticValve {
    fn is_open(&self) -> bool;
}

pub enum ContactorSignal {
    Open,
    Close,
}

#[derive(FromPrimitive)]
pub(crate) enum FwcFlightPhase {
    ElecPwr = 1,
    FirstEngineStarted = 2,
    FirstEngineTakeOffPower = 3,
    AtOrAboveEightyKnots = 4,
    LiftOff = 5,
    AtOrAbove1500Feet = 6,
    AtOrBelow800Feet = 7,
    TouchDown = 8,
    AtOrBelowEightyKnots = 9,
    EnginesShutdown = 10,
}

/// The delay logic gate delays the true result of a given expression by the given amount of time.
/// False results are output immediately.
pub struct DelayedTrueLogicGate {
    delay: Duration,
    expression_result: bool,
    true_duration: Duration,
}
impl DelayedTrueLogicGate {
    pub fn new(delay: Duration) -> DelayedTrueLogicGate {
        DelayedTrueLogicGate {
            delay,
            expression_result: false,
            true_duration: Duration::from_millis(0),
        }
    }

    pub fn starting_as(mut self, state: bool) -> Self {
        self.set_output(state);
        self
    }

    fn set_output(&mut self, state: bool) {
        self.expression_result = state;
        if state {
            self.true_duration = self.delay;
        } else {
            self.true_duration = Duration::from_millis(0)
        }
    }

    pub fn update(&mut self, context: &UpdateContext, expression_result: bool) {
        if expression_result {
            self.true_duration += context.delta();
        } else {
            self.true_duration = Duration::from_millis(0);
        }

        self.expression_result = expression_result;
    }

    pub fn output(&self) -> bool {
        self.expression_result && self.delay <= self.true_duration
    }
}

/// The delay pulse logic gate delays the true result of a given expression by the given amount of time.
/// True will be set as output when time delay is over for one update only, then false.
/// False results are output immediately.
pub struct DelayedPulseTrueLogicGate {
    output: bool,
    last_gate_output: bool,
    true_delayed_gate: DelayedTrueLogicGate,
}
impl DelayedPulseTrueLogicGate {
    pub fn new(delay: Duration) -> DelayedPulseTrueLogicGate {
        DelayedPulseTrueLogicGate {
            output: false,
            last_gate_output: false,
            true_delayed_gate: DelayedTrueLogicGate::new(delay),
        }
    }

    pub fn starting_as(mut self, state: bool, output: bool) -> Self {
        self.output = output;
        self.last_gate_output = !output;
        self.true_delayed_gate.set_output(state);
        self
    }

    pub fn update(&mut self, context: &UpdateContext, expression_result: bool) {
        self.true_delayed_gate.update(context, expression_result);

        let gate_out = self.true_delayed_gate.output();

        if gate_out && !self.last_gate_output {
            self.output = true;
        } else {
            self.output = false;
        }

        self.last_gate_output = gate_out;
    }

    pub fn output(&self) -> bool {
        self.output
    }
}

/// The delay logic gate delays the false result of a given expression by the given amount of time.
/// True results are output immediately. Starts with a false result state.
pub struct DelayedFalseLogicGate {
    delay: Duration,
    expression_result: bool,
    false_duration: Duration,
}
impl DelayedFalseLogicGate {
    pub fn new(delay: Duration) -> Self {
        Self {
            delay,
            expression_result: false,
            false_duration: delay,
        }
    }

    pub fn update(&mut self, context: &UpdateContext, expression_result: bool) {
        if !expression_result {
            self.false_duration += context.delta();
        } else {
            self.false_duration = Duration::from_millis(0);
        }

        self.expression_result = expression_result;
    }

    pub fn output(&self) -> bool {
        self.expression_result || self.delay > self.false_duration
    }
}

/// Given a current and target temperature, takes a coefficient and delta to
/// determine the new temperature after a certain duration has passed.
pub(crate) fn calculate_towards_target_temperature(
    current: ThermodynamicTemperature,
    target: ThermodynamicTemperature,
    coefficient: f64,
    delta: Duration,
) -> ThermodynamicTemperature {
    if current == target {
        current
    } else if current > target {
        ThermodynamicTemperature::new::<degree_celsius>(
            (current.get::<degree_celsius>() - (coefficient * delta.as_secs_f64()))
                .max(target.get::<degree_celsius>()),
        )
    } else {
        ThermodynamicTemperature::new::<degree_celsius>(
            (current.get::<degree_celsius>() + (coefficient * delta.as_secs_f64()))
                .min(target.get::<degree_celsius>()),
        )
    }
}

// Interpolate values_map_y at point value_at_point in breakpoints break_points_x
pub fn interpolation(xs: &[f64], ys: &[f64], intermediate_x: f64) -> f64 {
    debug_assert!(xs.len() == ys.len());
    debug_assert!(xs.len() >= 2);
    debug_assert!(ys.len() >= 2);

    if intermediate_x <= xs[0] {
        *ys.first().unwrap()
    } else if intermediate_x >= xs[xs.len() - 1] {
        *ys.last().unwrap()
    } else {
        let mut idx: usize = 1;

        while idx < xs.len() - 1 {
            if intermediate_x < xs[idx] {
                break;
            }
            idx += 1;
        }

        ys[idx - 1]
            + (intermediate_x - xs[idx - 1]) / (xs[idx] - xs[idx - 1]) * (ys[idx] - ys[idx - 1])
    }
}

/// Converts a given `bool` value into an `f64` representing that boolean value in the simulator.
pub fn from_bool(value: bool) -> f64 {
    if value {
        1.0
    } else {
        0.0
    }
}

pub fn to_bool(value: f64) -> bool {
    (value - 1.).abs() < f64::EPSILON
}

pub struct InternationalStandardAtmosphere;
impl InternationalStandardAtmosphere {
    const TEMPERATURE_LAPSE_RATE: f64 = 0.0065;
    const GAS_CONSTANT_DRY_AIR: f64 = 287.04;
    const GRAVITY_ACCELERATION: f64 = 9.807;
    const GROUND_PRESSURE_PASCAL: f64 = 101325.;
    const GROUND_TEMPERATURE_KELVIN: f64 = 288.15;

    fn ground_pressure() -> Pressure {
        Pressure::new::<pascal>(Self::GROUND_PRESSURE_PASCAL)
    }

    pub fn pressure_at_altitude(altitude: Length) -> Pressure {
        Self::ground_pressure()
            * (1.
                - Self::TEMPERATURE_LAPSE_RATE * altitude.get::<meter>()
                    / Self::GROUND_TEMPERATURE_KELVIN)
                .powf(
                    Self::GRAVITY_ACCELERATION
                        / Self::GAS_CONSTANT_DRY_AIR
                        / Self::TEMPERATURE_LAPSE_RATE,
                )
    }

    pub fn temperature_at_altitude(altitude: Length) -> ThermodynamicTemperature {
        ThermodynamicTemperature::new::<kelvin>(
            Self::GROUND_TEMPERATURE_KELVIN
                - Self::TEMPERATURE_LAPSE_RATE * altitude.get::<meter>(),
        )
    }
}

/// The ratio of flow velocity past a boundary to the local speed of sound.
#[derive(Clone, Copy, Default, Debug, PartialEq, PartialOrd)]
pub struct MachNumber(pub f64);

impl From<f64> for MachNumber {
    fn from(value: f64) -> Self {
        MachNumber(value)
    }
}

impl From<MachNumber> for f64 {
    fn from(value: MachNumber) -> Self {
        value.0
    }
}

pub trait AverageExt: Iterator {
    fn average<M>(self) -> M
    where
        M: Average<Self::Item>,
        Self: Sized,
    {
        M::average(self)
    }
}

impl<I: Iterator> AverageExt for I {}

pub trait Average<A = Self> {
    fn average<I>(iter: I) -> Self
    where
        I: Iterator<Item = A>;
}

impl Average for Pressure {
    fn average<I>(iter: I) -> Self
    where
        I: Iterator<Item = Pressure>,
    {
        let mut sum = 0.0;
        let mut count: usize = 0;

        for v in iter {
            sum += v.get::<hectopascal>();
            count += 1;
        }

        if count > 0 {
            Pressure::new::<hectopascal>(sum / (count as f64))
        } else {
            Pressure::new::<hectopascal>(0.)
        }
    }
}

impl<'a> Average<&'a Pressure> for Pressure {
    fn average<I>(iter: I) -> Self
    where
        I: Iterator<Item = &'a Pressure>,
    {
        iter.copied().average()
    }
}

#[cfg(test)]
mod delayed_true_logic_gate_tests {
    use super::*;
    use crate::electrical::Electricity;
    use crate::simulation::test::{SimulationTestBed, TestBed};
    use crate::simulation::{Aircraft, SimulationElement};

    struct TestAircraft {
        gate: DelayedTrueLogicGate,
        expression_result: bool,
    }
    impl TestAircraft {
        fn new(gate: DelayedTrueLogicGate) -> Self {
            Self {
                gate,
                expression_result: false,
            }
        }

        fn set_expression(&mut self, value: bool) {
            self.expression_result = value;
        }

        fn gate_output(&self) -> bool {
            self.gate.output()
        }
    }
    impl Aircraft for TestAircraft {
        fn update_before_power_distribution(
            &mut self,
            context: &UpdateContext,
            _: &mut Electricity,
        ) {
            self.gate.update(context, self.expression_result);
        }
    }
    impl SimulationElement for TestAircraft {}

    #[test]
    fn when_the_expression_is_false_returns_false() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(DelayedTrueLogicGate::new(Duration::from_millis(100)))
        });

        test_bed.run_with_delta(Duration::from_millis(0));
        test_bed.run();

        assert!(!test_bed.query(|a| a.gate_output()));
    }

    #[test]
    fn when_the_expression_is_true_and_delay_hasnt_passed_returns_false() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(DelayedTrueLogicGate::new(Duration::from_millis(10_000)))
        });

        test_bed.command(|a| a.set_expression(true));

        test_bed.run_with_delta(Duration::from_millis(0));
        test_bed.run();

        assert!(!test_bed.query(|a| a.gate_output()));
    }

    #[test]
    fn when_the_expression_is_true_and_delay_has_passed_returns_true() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(DelayedTrueLogicGate::new(Duration::from_millis(100)))
        });

        test_bed.command(|a| a.set_expression(true));

        test_bed.run_with_delta(Duration::from_millis(0));
        test_bed.run();

        assert!(test_bed.query(|a| a.gate_output()));
    }

    #[test]
    fn when_the_expression_is_true_and_becomes_false_before_delay_has_passed_returns_false_once_delay_passed(
    ) {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(DelayedTrueLogicGate::new(Duration::from_millis(1_000)))
        });

        test_bed.command(|a| a.set_expression(true));
        test_bed.run_with_delta(Duration::from_millis(0));
        test_bed.run_with_delta(Duration::from_millis(800));

        test_bed.command(|a| a.set_expression(false));
        test_bed.run_with_delta(Duration::from_millis(100));
        test_bed.run_with_delta(Duration::from_millis(200));

        assert!(!test_bed.query(|a| a.gate_output()));
    }

    #[test]
    fn when_the_expression_is_true_and_delay_hasnt_passed_starting_as_true_returns_true() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(
                DelayedTrueLogicGate::new(Duration::from_millis(1_000)).starting_as(true),
            )
        });

        test_bed.command(|a| a.set_expression(true));

        test_bed.run_with_delta(Duration::from_millis(0));
        test_bed.run();

        assert!(test_bed.query(|a| a.gate_output()));
    }

    #[test]
    fn when_the_expression_is_true_and_delay_has_passed_starting_as_true_returns_true() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(
                DelayedTrueLogicGate::new(Duration::from_millis(1_000)).starting_as(true),
            )
        });

        test_bed.command(|a| a.set_expression(true));

        test_bed.run_with_delta(Duration::from_millis(1_500));
        test_bed.run();

        assert!(test_bed.query(|a| a.gate_output()));
    }

    #[test]
    fn when_the_expression_is_true_and_becomes_false_before_delay_has_passed_returns_false_even_when_starting_as_true(
    ) {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(
                DelayedTrueLogicGate::new(Duration::from_millis(1_000)).starting_as(true),
            )
        });

        test_bed.command(|a| a.set_expression(true));
        test_bed.run_with_delta(Duration::from_millis(0));
        test_bed.command(|a| a.set_expression(false));
        test_bed.run();

        assert!(!test_bed.query(|a| a.gate_output()));
    }
}

#[cfg(test)]
mod delayed_false_logic_gate_tests {
    use super::*;
    use crate::electrical::Electricity;
    use crate::simulation::test::{SimulationTestBed, TestBed};
    use crate::simulation::{Aircraft, SimulationElement};

    struct TestAircraft {
        gate: DelayedFalseLogicGate,
        expression_result: bool,
    }
    impl TestAircraft {
        fn new(gate: DelayedFalseLogicGate) -> Self {
            Self {
                gate,
                expression_result: false,
            }
        }

        fn set_expression(&mut self, value: bool) {
            self.expression_result = value;
        }

        fn gate_output(&self) -> bool {
            self.gate.output()
        }
    }
    impl Aircraft for TestAircraft {
        fn update_before_power_distribution(
            &mut self,
            context: &UpdateContext,
            _: &mut Electricity,
        ) {
            self.gate.update(context, self.expression_result);
        }
    }
    impl SimulationElement for TestAircraft {}

    #[test]
    fn when_the_expression_is_false_initially_returns_false() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(DelayedFalseLogicGate::new(Duration::from_millis(100)))
        });

        test_bed.run();

        assert!(!test_bed.query(|a| a.gate_output()));
    }

    #[test]
    fn when_the_expression_is_true_returns_true() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(DelayedFalseLogicGate::new(Duration::from_millis(100)))
        });

        test_bed.command(|a| a.set_expression(true));
        test_bed.run();

        assert!(test_bed.query(|a| a.gate_output()));
    }

    #[test]
    fn when_the_expression_is_false_and_delay_hasnt_passed_returns_true() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(DelayedFalseLogicGate::new(Duration::from_millis(10_000)))
        });

        test_bed.command(|a| a.set_expression(true));
        test_bed.run_with_delta(Duration::from_millis(0));

        test_bed.command(|a| a.set_expression(false));
        test_bed.run();

        assert!(test_bed.query(|a| a.gate_output()));
    }

    #[test]
    fn when_the_expression_is_false_and_delay_has_passed_returns_false() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(DelayedFalseLogicGate::new(Duration::from_millis(100)))
        });

        test_bed.command(|a| a.set_expression(true));
        test_bed.run_with_delta(Duration::from_millis(0));

        test_bed.command(|a| a.set_expression(false));
        test_bed.run();

        assert!(!test_bed.query(|a| a.gate_output()));
    }

    #[test]
    fn when_the_expression_is_false_and_becomes_true_before_delay_has_passed_returns_true_once_delay_passed(
    ) {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(DelayedFalseLogicGate::new(Duration::from_millis(1_000)))
        });

        test_bed.command(|a| a.set_expression(false));
        test_bed.run_with_delta(Duration::from_millis(0));
        test_bed.run_with_delta(Duration::from_millis(800));

        test_bed.command(|a| a.set_expression(true));
        test_bed.run_with_delta(Duration::from_millis(100));
        test_bed.run_with_delta(Duration::from_millis(200));

        assert!(test_bed.query(|a| a.gate_output()));
    }
}

#[cfg(test)]
mod delayed_pulse_true_logic_gate_tests {
    use super::*;
    use crate::electrical::Electricity;
    use crate::simulation::test::{SimulationTestBed, TestBed};
    use crate::simulation::{Aircraft, SimulationElement};

    struct TestAircraft {
        gate: DelayedPulseTrueLogicGate,
        expression_result: bool,
    }
    impl TestAircraft {
        fn new(gate: DelayedPulseTrueLogicGate) -> Self {
            Self {
                gate,
                expression_result: false,
            }
        }

        fn set_expression(&mut self, value: bool) {
            self.expression_result = value;
        }

        fn gate_output(&self) -> bool {
            self.gate.output()
        }
    }
    impl Aircraft for TestAircraft {
        fn update_before_power_distribution(
            &mut self,
            context: &UpdateContext,
            _: &mut Electricity,
        ) {
            self.gate.update(context, self.expression_result);
        }
    }
    impl SimulationElement for TestAircraft {}

    #[test]
    fn when_the_expression_is_false_initially_returns_false() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(DelayedPulseTrueLogicGate::new(Duration::from_millis(100)))
        });

        test_bed.run();

        assert!(!test_bed.query(|a| a.gate_output()));
    }

    #[test]
    fn when_the_expression_is_true_returns_false_if_less_than_delay() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(DelayedPulseTrueLogicGate::new(Duration::from_millis(100)))
        });

        test_bed.command(|a| a.set_expression(true));
        test_bed.run_with_delta(Duration::from_millis(0));

        assert!(!test_bed.query(|a| a.gate_output()));
    }

    #[test]
    fn when_the_expression_is_false_and_delay_hasnt_passed_returns_false() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(DelayedPulseTrueLogicGate::new(Duration::from_millis(10000)))
        });

        test_bed.command(|a| a.set_expression(false));
        test_bed.run();

        assert!(!test_bed.query(|a| a.gate_output()));
    }

    #[test]
    fn when_the_expression_is_true_and_becomes_false_before_delay_has_passed_returns_false_once_delay_passed(
    ) {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(DelayedPulseTrueLogicGate::new(Duration::from_millis(1000)))
        });

        test_bed.command(|a| a.set_expression(true));
        test_bed.run_with_delta(Duration::from_millis(800));

        test_bed.command(|a| a.set_expression(false));
        test_bed.run_with_delta(Duration::from_millis(300));

        assert!(!test_bed.query(|a| a.gate_output()));
    }

    #[test]
    fn when_the_expression_is_true_and_stays_true_until_delay_has_passed_returns_true_on_one_update_only(
    ) {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(DelayedPulseTrueLogicGate::new(Duration::from_millis(1000)))
        });

        test_bed.command(|a| a.set_expression(true));
        test_bed.run_with_delta(Duration::from_millis(1200));

        assert!(test_bed.query(|a| a.gate_output()));

        test_bed.run_with_delta(Duration::from_millis(100));

        assert!(!test_bed.query(|a| a.gate_output()));

        test_bed.run_with_delta(Duration::from_millis(1200));

        assert!(!test_bed.query(|a| a.gate_output()));
    }

    #[test]
    fn when_the_expression_is_true_and_starting_as_true_false_returns_false() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(
                DelayedPulseTrueLogicGate::new(Duration::from_millis(1_000))
                    .starting_as(true, false),
            )
        });

        test_bed.command(|a| a.set_expression(true));

        test_bed.run_with_delta(Duration::from_millis(0));
        assert!(!test_bed.query(|a| a.gate_output()));

        test_bed.run_with_delta(Duration::from_millis(500));
        assert!(!test_bed.query(|a| a.gate_output()));

        test_bed.run_with_delta(Duration::from_millis(1_200));
        assert!(!test_bed.query(|a| a.gate_output()));
    }

    #[test]
    fn when_the_expression_is_true_and_starting_as_true_true_returns_true_on_one_update_only() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(
                DelayedPulseTrueLogicGate::new(Duration::from_millis(1_000))
                    .starting_as(true, true),
            )
        });

        test_bed.command(|a| a.set_expression(true));

        test_bed.run_with_delta(Duration::from_millis(0));
        assert!(test_bed.query(|a| a.gate_output()));

        test_bed.run_with_delta(Duration::from_millis(500));
        assert!(!test_bed.query(|a| a.gate_output()));

        test_bed.run_with_delta(Duration::from_millis(1_200));
        assert!(!test_bed.query(|a| a.gate_output()));
    }
}
#[cfg(test)]
mod interpolation_tests {
    use super::*;

    const XS1: [f64; 10] = [
        -100.0, -10.0, 10.0, 240.0, 320.0, 435.3, 678.9, 890.3, 10005.0, 203493.7,
    ];

    const YS1: [f64; 10] = [
        -200.0, 10.0, 40.0, -553.0, 238.4, 30423.3, 23000.2, 32000.4, 43200.2, 34.2,
    ];

    #[test]
    fn interpolation_before_first_element_test() {
        // We expect to get first element of YS1
        assert!((interpolation(&XS1, &YS1, -500.0) - YS1[0]).abs() < f64::EPSILON);
    }

    #[test]
    fn interpolation_after_last_element_test() {
        // We expect to get last element of YS1
        assert!(
            (interpolation(&XS1, &YS1, 100000000.0) - *YS1.last().unwrap()).abs() < f64::EPSILON
        );
    }

    #[test]
    fn interpolation_first_element_test() {
        // Giving first element of X tab we expect first of Y tab
        assert!(
            (interpolation(&XS1, &YS1, *XS1.first().unwrap()) - *YS1.first().unwrap()).abs()
                < f64::EPSILON
        );
    }

    #[test]
    fn interpolation_last_element_test() {
        // Giving last element of X tab we expect last of Y tab
        assert!(
            (interpolation(&XS1, &YS1, *XS1.last().unwrap()) - *YS1.last().unwrap()).abs()
                < f64::EPSILON
        );
    }

    #[test]
    fn interpolation_middle_element_test() {
        let res = interpolation(&XS1, &YS1, 358.0);
        assert!((res - 10186.589).abs() < 0.001);
    }

    #[test]
    fn interpolation_last_segment_element_test() {
        let res = interpolation(&XS1, &YS1, 22200.0);
        assert!((res - 40479.579).abs() < 0.001);
    }

    #[test]
    fn interpolation_first_segment_element_test() {
        let res = interpolation(&XS1, &YS1, -50.0);
        assert!((res - (-83.3333)).abs() < 0.001);
    }
}

#[cfg(test)]
mod calculate_towards_target_temperature_tests {
    use super::*;
    use ntest::assert_about_eq;

    #[test]
    fn when_current_equals_target_returns_current() {
        let temperature = ThermodynamicTemperature::new::<degree_celsius>(10.);
        let result = calculate_towards_target_temperature(
            temperature,
            temperature,
            1.,
            Duration::from_secs(1),
        );

        assert_eq!(result, temperature);
    }

    #[test]
    fn when_current_less_than_target_moves_towards_target() {
        let result = calculate_towards_target_temperature(
            ThermodynamicTemperature::new::<degree_celsius>(10.),
            ThermodynamicTemperature::new::<degree_celsius>(15.),
            1.,
            Duration::from_secs(1),
        );

        assert_about_eq!(result.get::<degree_celsius>(), 11.);
    }

    #[test]
    fn when_current_slightly_less_than_target_does_not_overshoot_target() {
        let result = calculate_towards_target_temperature(
            ThermodynamicTemperature::new::<degree_celsius>(14.9),
            ThermodynamicTemperature::new::<degree_celsius>(15.),
            1.,
            Duration::from_secs(1),
        );

        assert_about_eq!(result.get::<degree_celsius>(), 15.);
    }

    #[test]
    fn when_current_more_than_target_moves_towards_target() {
        let result = calculate_towards_target_temperature(
            ThermodynamicTemperature::new::<degree_celsius>(15.),
            ThermodynamicTemperature::new::<degree_celsius>(10.),
            1.,
            Duration::from_secs(1),
        );

        assert_about_eq!(result.get::<degree_celsius>(), 14.);
    }

    #[test]
    fn when_current_slightly_more_than_target_does_not_undershoot_target() {
        let result = calculate_towards_target_temperature(
            ThermodynamicTemperature::new::<degree_celsius>(10.1),
            ThermodynamicTemperature::new::<degree_celsius>(10.),
            1.,
            Duration::from_secs(1),
        );

        assert_about_eq!(result.get::<degree_celsius>(), 10.);
    }
}

#[cfg(test)]
mod electrical_bus_type_tests {
    use super::ElectricalBusType;

    #[test]
    fn get_name_returns_name() {
        assert_eq!(ElectricalBusType::AlternatingCurrent(2).to_string(), "AC_2");
        assert_eq!(
            ElectricalBusType::AlternatingCurrentEssential.to_string(),
            "AC_ESS"
        );
        assert_eq!(
            ElectricalBusType::AlternatingCurrentEssentialShed.to_string(),
            "AC_ESS_SHED"
        );
        assert_eq!(
            ElectricalBusType::AlternatingCurrentStaticInverter.to_string(),
            "AC_STAT_INV"
        );
        assert_eq!(ElectricalBusType::DirectCurrent(2).to_string(), "DC_2");
        assert_eq!(
            ElectricalBusType::DirectCurrentEssential.to_string(),
            "DC_ESS"
        );
        assert_eq!(
            ElectricalBusType::DirectCurrentEssentialShed.to_string(),
            "DC_ESS_SHED"
        );
        assert_eq!(
            ElectricalBusType::DirectCurrentBattery.to_string(),
            "DC_BAT"
        );
        assert_eq!(
            ElectricalBusType::DirectCurrentHot(2).to_string(),
            "DC_HOT_2"
        );
    }
}

#[cfg(test)]
mod average_tests {
    use super::*;

    #[test]
    fn average_returns_average() {
        let iterator = [
            Pressure::new::<hectopascal>(100.),
            Pressure::new::<hectopascal>(200.),
            Pressure::new::<hectopascal>(300.),
        ];

        let average: Pressure = iterator.iter().average();
        assert_eq!(average, Pressure::new::<hectopascal>(200.));
    }
}
