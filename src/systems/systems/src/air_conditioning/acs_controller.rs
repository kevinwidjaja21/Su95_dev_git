use crate::{
    pneumatic::{EngineModeSelector, EngineState},
    pressurization::PressurizationOverheadPanel,
    shared::{
        pid::PidController, Cabin, ControllerSignal, EngineBleedPushbutton, EngineCorrectedN1,
        EngineFirePushButtons, EngineStartState, GroundSpeed, LgciuWeightOnWheels, PneumaticBleed,
    },
    simulation::{
        InitContext, Read, SimulationElement, SimulationElementVisitor, SimulatorReader,
        SimulatorWriter, UpdateContext, VariableIdentifier, Write,
    },
};

use super::{
    AirConditioningSystemOverhead, DuctTemperature, OverheadFlowSelector, PackFlow, PackFlowValve,
    ZoneType,
};

use std::time::Duration;

use uom::si::{
    f64::*,
    length::foot,
    mass_rate::kilogram_per_second,
    ratio::{percent, ratio},
    thermodynamic_temperature::{degree_celsius, kelvin},
    velocity::knot,
};

pub(super) struct AirConditioningSystemController<const ZONES: usize> {
    aircraft_state: AirConditioningStateManager,
    zone_controller: Vec<ZoneController<ZONES>>,
    pack_flow_controller: PackFlowController<ZONES>,
}

impl<const ZONES: usize> AirConditioningSystemController<ZONES> {
    pub fn new(context: &mut InitContext, cabin_zone_ids: &[ZoneType; ZONES]) -> Self {
        let zone_controller = cabin_zone_ids
            .iter()
            .map(|id| ZoneController::new(context, id))
            .collect::<Vec<ZoneController<ZONES>>>();
        Self {
            aircraft_state: AirConditioningStateManager::new(),
            zone_controller,
            pack_flow_controller: PackFlowController::new(context),
        }
    }

    pub fn update(
        &mut self,
        context: &UpdateContext,
        adirs: &impl GroundSpeed,
        acs_overhead: &AirConditioningSystemOverhead<ZONES>,
        pack_flow_valve: &[PackFlowValve; 2],
        engines: [&impl EngineCorrectedN1; 2],
        engine_fire_push_buttons: &impl EngineFirePushButtons,
        pneumatic: &(impl PneumaticBleed + EngineStartState),
        pneumatic_overhead: &impl EngineBleedPushbutton,
        pressurization: &impl Cabin,
        pressurization_overhead: &PressurizationOverheadPanel,
        lgciu: [&impl LgciuWeightOnWheels; 2],
    ) {
        self.aircraft_state = self.aircraft_state.update(context, adirs, engines, lgciu);
        self.pack_flow_controller.update(
            &self.aircraft_state,
            acs_overhead,
            engines,
            engine_fire_push_buttons,
            pneumatic,
            pneumatic_overhead,
            pressurization,
            pressurization_overhead,
            pack_flow_valve,
        );
        for zone in self.zone_controller.iter_mut() {
            zone.update(
                context,
                acs_overhead,
                &self.pack_flow_controller,
                pressurization,
            )
        }
    }
}

impl<const ZONES: usize> DuctTemperature for AirConditioningSystemController<ZONES> {
    fn duct_demand_temperature(&self) -> Vec<ThermodynamicTemperature> {
        let mut duct_temperature: Vec<ThermodynamicTemperature> = Vec::new();
        for zone in &self.zone_controller {
            duct_temperature.push(zone.duct_demand_temperature()[0]);
        }
        duct_temperature
    }
}

impl<const ZONES: usize> PackFlow for AirConditioningSystemController<ZONES> {
    fn pack_flow(&self) -> MassRate {
        self.pack_flow_controller.pack_flow()
    }
}

impl<const ZONES: usize> ControllerSignal<PackFlowValveSignal>
    for AirConditioningSystemController<ZONES>
{
    fn signal(&self) -> Option<PackFlowValveSignal> {
        self.pack_flow_controller.signal()
    }
}

impl<const ZONES: usize> SimulationElement for AirConditioningSystemController<ZONES> {
    fn accept<T: SimulationElementVisitor>(&mut self, visitor: &mut T) {
        accept_iterable!(self.zone_controller, visitor);
        self.pack_flow_controller.accept(visitor);

        visitor.visit(self);
    }
}

#[derive(Copy, Clone)]
enum AirConditioningStateManager {
    Initialisation(AirConditioningState<Initialisation>),
    OnGround(AirConditioningState<OnGround>),
    BeginTakeOff(AirConditioningState<BeginTakeOff>),
    EndTakeOff(AirConditioningState<EndTakeOff>),
    InFlight(AirConditioningState<InFlight>),
    BeginLanding(AirConditioningState<BeginLanding>),
    EndLanding(AirConditioningState<EndLanding>),
}

impl AirConditioningStateManager {
    const TAKEOFF_THRESHOLD_SPEED_KNOTS: f64 = 70.;

    fn new() -> Self {
        AirConditioningStateManager::Initialisation(AirConditioningState::init())
    }

    fn update(
        mut self,
        context: &UpdateContext,
        adirs: &impl GroundSpeed,
        engines: [&impl EngineCorrectedN1; 2],
        lgciu: [&impl LgciuWeightOnWheels; 2],
    ) -> Self {
        self = match self {
            AirConditioningStateManager::Initialisation(val) => val.step(lgciu),
            AirConditioningStateManager::OnGround(val) => val.step(engines, lgciu),
            AirConditioningStateManager::BeginTakeOff(val) => val.step(context, adirs, engines),
            AirConditioningStateManager::EndTakeOff(val) => val.step(context, lgciu),
            AirConditioningStateManager::InFlight(val) => val.step(engines, lgciu),
            AirConditioningStateManager::BeginLanding(val) => val.step(context, adirs, engines),
            AirConditioningStateManager::EndLanding(val) => val.step(context),
        };
        self
    }

    fn landing_gear_is_compressed(lgciu: [&impl LgciuWeightOnWheels; 2]) -> bool {
        lgciu.iter().all(|a| a.left_and_right_gear_compressed(true))
    }

    fn engines_are_in_takeoff(engines: [&impl EngineCorrectedN1; 2]) -> bool {
        engines
            .iter()
            .all(|x| x.corrected_n1() > Ratio::new::<percent>(70.))
    }
}

macro_rules! transition {
    ($from: ty, $to: tt) => {
        impl From<AirConditioningState<$from>> for AirConditioningState<$to> {
            fn from(_: AirConditioningState<$from>) -> AirConditioningState<$to> {
                AirConditioningState {
                    aircraft_state: $to,
                    timer: Duration::from_secs(0),
                }
            }
        }
    };
}

#[derive(Copy, Clone)]
struct AirConditioningState<S> {
    aircraft_state: S,
    timer: Duration,
}

impl<S> AirConditioningState<S> {
    fn increase_timer(mut self, context: &UpdateContext) -> Self {
        self.timer += context.delta();
        self
    }
}

#[derive(Copy, Clone)]
struct Initialisation;

impl AirConditioningState<Initialisation> {
    fn init() -> Self {
        Self {
            aircraft_state: Initialisation,
            timer: Duration::from_secs(0),
        }
    }

    fn step(
        self: AirConditioningState<Initialisation>,
        lgciu: [&impl LgciuWeightOnWheels; 2],
    ) -> AirConditioningStateManager {
        if AirConditioningStateManager::landing_gear_is_compressed(lgciu) {
            AirConditioningStateManager::OnGround(self.into())
        } else {
            AirConditioningStateManager::InFlight(self.into())
        }
    }
}

transition!(Initialisation, OnGround);
transition!(Initialisation, InFlight);

#[derive(Copy, Clone)]
struct OnGround;

impl AirConditioningState<OnGround> {
    fn step(
        self: AirConditioningState<OnGround>,
        engines: [&impl EngineCorrectedN1; 2],
        lgciu: [&impl LgciuWeightOnWheels; 2],
    ) -> AirConditioningStateManager {
        if !AirConditioningStateManager::landing_gear_is_compressed(lgciu) {
            AirConditioningStateManager::InFlight(self.into())
        } else if AirConditioningStateManager::engines_are_in_takeoff(engines)
            && AirConditioningStateManager::landing_gear_is_compressed(lgciu)
        {
            AirConditioningStateManager::BeginTakeOff(self.into())
        } else {
            AirConditioningStateManager::OnGround(self)
        }
    }
}

transition!(OnGround, InFlight);
transition!(OnGround, BeginTakeOff);

#[derive(Copy, Clone)]
struct BeginTakeOff;

impl AirConditioningState<BeginTakeOff> {
    fn step(
        self: AirConditioningState<BeginTakeOff>,
        context: &UpdateContext,
        adirs: &impl GroundSpeed,
        engines: [&impl EngineCorrectedN1; 2],
    ) -> AirConditioningStateManager {
        if (AirConditioningStateManager::engines_are_in_takeoff(engines)
            && adirs.ground_speed().get::<knot>()
                > AirConditioningStateManager::TAKEOFF_THRESHOLD_SPEED_KNOTS)
            || self.timer > Duration::from_secs(35)
        {
            AirConditioningStateManager::EndTakeOff(self.into())
        } else {
            AirConditioningStateManager::BeginTakeOff(self.increase_timer(context))
        }
    }
}

transition!(BeginTakeOff, EndTakeOff);

#[derive(Copy, Clone)]
struct EndTakeOff;

impl AirConditioningState<EndTakeOff> {
    fn step(
        self: AirConditioningState<EndTakeOff>,
        context: &UpdateContext,
        lgciu: [&impl LgciuWeightOnWheels; 2],
    ) -> AirConditioningStateManager {
        if !AirConditioningStateManager::landing_gear_is_compressed(lgciu)
            || self.timer > Duration::from_secs(10)
        {
            AirConditioningStateManager::InFlight(self.into())
        } else {
            AirConditioningStateManager::EndTakeOff(self.increase_timer(context))
        }
    }
}

transition!(EndTakeOff, InFlight);

#[derive(Copy, Clone)]
struct InFlight;

impl AirConditioningState<InFlight> {
    fn step(
        self: AirConditioningState<InFlight>,
        engines: [&impl EngineCorrectedN1; 2],
        lgciu: [&impl LgciuWeightOnWheels; 2],
    ) -> AirConditioningStateManager {
        if !AirConditioningStateManager::engines_are_in_takeoff(engines)
            && AirConditioningStateManager::landing_gear_is_compressed(lgciu)
        {
            AirConditioningStateManager::BeginLanding(self.into())
        } else {
            AirConditioningStateManager::InFlight(self)
        }
    }
}

transition!(InFlight, BeginLanding);

#[derive(Copy, Clone)]
struct BeginLanding;

impl AirConditioningState<BeginLanding> {
    fn step(
        self: AirConditioningState<BeginLanding>,
        context: &UpdateContext,
        adirs: &impl GroundSpeed,
        engines: [&impl EngineCorrectedN1; 2],
    ) -> AirConditioningStateManager {
        if (!AirConditioningStateManager::engines_are_in_takeoff(engines)
            && adirs.ground_speed().get::<knot>()
                < AirConditioningStateManager::TAKEOFF_THRESHOLD_SPEED_KNOTS)
            || self.timer > Duration::from_secs(35)
        {
            AirConditioningStateManager::EndLanding(self.into())
        } else {
            AirConditioningStateManager::BeginLanding(self.increase_timer(context))
        }
    }
}

transition!(BeginLanding, EndLanding);

#[derive(Copy, Clone)]
struct EndLanding;

impl AirConditioningState<EndLanding> {
    fn step(
        self: AirConditioningState<EndLanding>,
        context: &UpdateContext,
    ) -> AirConditioningStateManager {
        if self.timer > Duration::from_secs(10) {
            AirConditioningStateManager::OnGround(self.into())
        } else {
            AirConditioningStateManager::EndLanding(self.increase_timer(context))
        }
    }
}

transition!(EndLanding, OnGround);

struct ZoneController<const ZONES: usize> {
    zone_temp_id: VariableIdentifier,
    zone_duct_temp_id: VariableIdentifier,

    zone_id: usize,
    duct_demand_temperature: ThermodynamicTemperature,
    zone_selected_temperature: ThermodynamicTemperature,
    zone_measured_temperature: ThermodynamicTemperature,
    pid_controller: PidController,
}

impl<const ZONES: usize> ZoneController<ZONES> {
    const K_ALTITUDE_CORRECTION_DEG_PER_FEET: f64 = 0.0000375; // deg/feet
    const UPPER_DUCT_TEMP_TRIGGER_HIGH_CELSIUS: f64 = 19.; // C
    const UPPER_DUCT_TEMP_TRIGGER_LOW_CELSIUS: f64 = 17.; // C
    const UPPER_DUCT_TEMP_LIMIT_LOW_KELVIN: f64 = 323.15; // K
    const UPPER_DUCT_TEMP_LIMIT_HIGH_KELVIN: f64 = 343.15; // K
    const LOWER_DUCT_TEMP_TRIGGER_HIGH_CELSIUS: f64 = 28.; // C
    const LOWER_DUCT_TEMP_TRIGGER_LOW_CELSIUS: f64 = 26.; // C
    const LOWER_DUCT_TEMP_LIMIT_LOW_KELVIN: f64 = 275.15; // K
    const LOWER_DUCT_TEMP_LIMIT_HIGH_KELVIN: f64 = 281.15; // K
    const SETPOINT_TEMP_KELVIN: f64 = 297.15; // K
    const KI_DUCT_DEMAND_CABIN: f64 = 0.05;
    const KI_DUCT_DEMAND_COCKPIT: f64 = 0.04;
    const KP_DUCT_DEMAND_CABIN: f64 = 3.5;
    const KP_DUCT_DEMAND_COCKPIT: f64 = 2.;

    fn new(context: &mut InitContext, zone_type: &ZoneType) -> Self {
        let pid_controller = match zone_type {
            ZoneType::Cockpit => {
                PidController::new(
                    Self::KP_DUCT_DEMAND_COCKPIT,
                    Self::KI_DUCT_DEMAND_COCKPIT,
                    0.,
                    Self::LOWER_DUCT_TEMP_LIMIT_HIGH_KELVIN,
                    Self::UPPER_DUCT_TEMP_LIMIT_LOW_KELVIN,
                    Self::SETPOINT_TEMP_KELVIN,
                    1., // Output gain
                )
            }
            ZoneType::Cabin(_) => PidController::new(
                Self::KP_DUCT_DEMAND_CABIN,
                Self::KI_DUCT_DEMAND_CABIN,
                0.,
                Self::LOWER_DUCT_TEMP_LIMIT_HIGH_KELVIN,
                Self::UPPER_DUCT_TEMP_LIMIT_LOW_KELVIN,
                Self::SETPOINT_TEMP_KELVIN,
                1.,
            ),
        };
        Self {
            zone_temp_id: context.get_identifier(format!("COND_{}_TEMP", zone_type)),
            zone_duct_temp_id: context.get_identifier(format!("COND_{}_DUCT_TEMP", zone_type)),

            zone_id: zone_type.id(),
            duct_demand_temperature: ThermodynamicTemperature::new::<degree_celsius>(24.),
            zone_selected_temperature: ThermodynamicTemperature::new::<degree_celsius>(24.),
            zone_measured_temperature: ThermodynamicTemperature::new::<degree_celsius>(24.),
            pid_controller,
        }
    }

    fn update(
        &mut self,
        context: &UpdateContext,
        acs_overhead: &AirConditioningSystemOverhead<ZONES>,
        pack_flow: &impl PackFlow,
        pressurization: &impl Cabin,
    ) {
        self.zone_selected_temperature = acs_overhead.selected_cabin_temperature(self.zone_id);
        self.duct_demand_temperature =
            if pack_flow.pack_flow() < MassRate::new::<kilogram_per_second>(0.01) {
                // When there's no pack flow, duct temperature is mostly determined by cabin recirculated air and ambient temperature
                ThermodynamicTemperature::new::<degree_celsius>(
                    0.8 * self.zone_measured_temperature.get::<degree_celsius>()
                        + 0.2 * context.ambient_temperature().get::<degree_celsius>(),
                )
            } else {
                self.calculate_duct_temp_demand(context, pressurization)
            };
    }

    fn calculate_duct_temp_demand(
        &mut self,
        context: &UpdateContext,
        pressurization: &impl Cabin,
    ) -> ThermodynamicTemperature {
        let altitude_correction: f64 =
            pressurization.altitude().get::<foot>() * Self::K_ALTITUDE_CORRECTION_DEG_PER_FEET;
        let corrected_selected_temp: f64 =
            self.zone_selected_temperature.get::<kelvin>() + altitude_correction;

        self.pid_controller
            .set_max_output(self.calculate_duct_temp_upper_limit().get::<kelvin>());
        self.pid_controller
            .set_min_output(self.calculate_duct_temp_lower_limit().get::<kelvin>());
        self.pid_controller.change_setpoint(corrected_selected_temp);

        let duct_demand_limited: f64 = self.pid_controller.next_control_output(
            self.zone_measured_temperature.get::<kelvin>(),
            Some(context.delta()),
        );
        ThermodynamicTemperature::new::<kelvin>(duct_demand_limited)
    }

    fn calculate_duct_temp_upper_limit(&self) -> ThermodynamicTemperature {
        if self.zone_measured_temperature
            > ThermodynamicTemperature::new::<degree_celsius>(
                Self::UPPER_DUCT_TEMP_TRIGGER_HIGH_CELSIUS,
            )
        {
            ThermodynamicTemperature::new::<kelvin>(Self::UPPER_DUCT_TEMP_LIMIT_LOW_KELVIN)
        } else if self.zone_measured_temperature
            < ThermodynamicTemperature::new::<degree_celsius>(
                Self::UPPER_DUCT_TEMP_TRIGGER_LOW_CELSIUS,
            )
        {
            ThermodynamicTemperature::new::<kelvin>(Self::UPPER_DUCT_TEMP_LIMIT_HIGH_KELVIN)
        } else {
            let interpolation = (Self::UPPER_DUCT_TEMP_LIMIT_LOW_KELVIN
                - Self::UPPER_DUCT_TEMP_LIMIT_HIGH_KELVIN)
                / (Self::UPPER_DUCT_TEMP_TRIGGER_HIGH_CELSIUS
                    - Self::UPPER_DUCT_TEMP_TRIGGER_LOW_CELSIUS)
                * (self.zone_measured_temperature.get::<kelvin>()
                    - ThermodynamicTemperature::new::<degree_celsius>(
                        Self::UPPER_DUCT_TEMP_TRIGGER_LOW_CELSIUS,
                    )
                    .get::<kelvin>())
                + Self::UPPER_DUCT_TEMP_LIMIT_HIGH_KELVIN;
            ThermodynamicTemperature::new::<kelvin>(interpolation)
        }
    }

    fn calculate_duct_temp_lower_limit(&self) -> ThermodynamicTemperature {
        if self.zone_measured_temperature
            > ThermodynamicTemperature::new::<degree_celsius>(
                Self::LOWER_DUCT_TEMP_TRIGGER_HIGH_CELSIUS,
            )
        {
            ThermodynamicTemperature::new::<kelvin>(Self::LOWER_DUCT_TEMP_LIMIT_LOW_KELVIN)
        } else if self.zone_measured_temperature
            < ThermodynamicTemperature::new::<degree_celsius>(
                Self::LOWER_DUCT_TEMP_TRIGGER_LOW_CELSIUS,
            )
        {
            ThermodynamicTemperature::new::<kelvin>(Self::LOWER_DUCT_TEMP_LIMIT_HIGH_KELVIN)
        } else {
            let interpolation = (Self::LOWER_DUCT_TEMP_LIMIT_LOW_KELVIN
                - Self::LOWER_DUCT_TEMP_LIMIT_HIGH_KELVIN)
                / (Self::LOWER_DUCT_TEMP_TRIGGER_HIGH_CELSIUS
                    - Self::LOWER_DUCT_TEMP_TRIGGER_LOW_CELSIUS)
                * (self.zone_measured_temperature.get::<kelvin>()
                    - ThermodynamicTemperature::new::<degree_celsius>(
                        Self::LOWER_DUCT_TEMP_TRIGGER_LOW_CELSIUS,
                    )
                    .get::<kelvin>())
                + Self::LOWER_DUCT_TEMP_LIMIT_HIGH_KELVIN;
            ThermodynamicTemperature::new::<kelvin>(interpolation)
        }
    }
}

impl<const ZONES: usize> DuctTemperature for ZoneController<ZONES> {
    fn duct_demand_temperature(&self) -> Vec<ThermodynamicTemperature> {
        vec![self.duct_demand_temperature]
    }
}

impl<const ZONES: usize> SimulationElement for ZoneController<ZONES> {
    fn read(&mut self, reader: &mut SimulatorReader) {
        self.zone_measured_temperature = reader.read(&self.zone_temp_id);
    }

    fn write(&self, writer: &mut SimulatorWriter) {
        // TODO: Replace this with actual duct temperature when mixer is modelled, not duct demand temperature
        writer.write(&self.zone_duct_temp_id, self.duct_demand_temperature);
    }
}

pub struct PackFlowValveSignal {
    target_open_amount: [Ratio; 2],
}

impl PackFlowValveSignal {
    pub fn new(target_open_amount: [Ratio; 2]) -> Self {
        Self { target_open_amount }
    }

    pub fn target_open_amount(&self, pack_id: usize) -> Ratio {
        self.target_open_amount[pack_id - 1]
    }
}

struct PackFlowController<const ZONES: usize> {
    pack_flow_id: VariableIdentifier,

    flow_demand: Ratio,
    fcv_1_open_allowed: bool,
    fcv_2_open_allowed: bool,
    should_open_fcv: [bool; 2],
    pack_flow: MassRate,
}

impl<const ZONES: usize> PackFlowController<ZONES> {
    const PACK_START_TIME_SECOND: f64 = 30.;
    const PACK_START_FLOW_LIMIT: f64 = 100.;
    const APU_SUPPLY_FLOW_LIMIT: f64 = 120.;
    const ONE_PACK_FLOW_LIMIT: f64 = 120.;
    const FLOW_REDUCTION_LIMIT: f64 = 80.;
    const BACKFLOW_LIMIT: f64 = 80.;

    const FLOW_CONSTANT_C: f64 = 0.5675; // kg/s
    const FLOW_CONSTANT_XCAB: f64 = 0.00001828; // kg(feet*s)

    fn new(context: &mut InitContext) -> Self {
        Self {
            pack_flow_id: context.get_identifier("COND_PACK_FLOW".to_owned()),

            flow_demand: Ratio::new::<percent>(0.),
            fcv_1_open_allowed: false,
            fcv_2_open_allowed: false,
            should_open_fcv: [false, false],
            pack_flow: MassRate::new::<kilogram_per_second>(0.),
        }
    }

    fn update(
        &mut self,
        aircraft_state: &AirConditioningStateManager,
        acs_overhead: &AirConditioningSystemOverhead<ZONES>,
        engines: [&impl EngineCorrectedN1; 2],
        engine_fire_push_buttons: &impl EngineFirePushButtons,
        pneumatic: &(impl PneumaticBleed + EngineStartState),
        pneumatic_overhead: &impl EngineBleedPushbutton,
        pressurization: &impl Cabin,
        pressurization_overhead: &PressurizationOverheadPanel,
        pack_flow_valve: &[PackFlowValve; 2],
    ) {
        // TODO: Add overheat protection
        self.flow_demand = self.flow_demand_determination(
            aircraft_state,
            pack_flow_valve,
            acs_overhead,
            pneumatic,
        );
        self.fcv_open_allowed_determination(
            acs_overhead,
            engine_fire_push_buttons,
            pressurization_overhead,
            pneumatic,
        );
        self.should_open_fcv =
            self.should_open_fcv_determination(engines, pneumatic, pneumatic_overhead);
        self.pack_flow = self.pack_flow_calculation(pack_flow_valve, pressurization);
    }

    fn pack_start_condition_determination(&self, pack_flow_valve: &[PackFlowValve; 2]) -> bool {
        // Returns true when one of the packs is in start condition
        pack_flow_valve
            .iter()
            .any(|fcv| fcv.fcv_timer() <= Duration::from_secs_f64(Self::PACK_START_TIME_SECOND))
    }

    fn flow_demand_determination(
        &self,
        aircraft_state: &AirConditioningStateManager,
        pack_flow_valve: &[PackFlowValve; 2],
        acs_overhead: &AirConditioningSystemOverhead<ZONES>,
        pneumatic: &(impl PneumaticBleed + EngineStartState),
    ) -> Ratio {
        let mut intermediate_flow: Ratio = acs_overhead.flow_selector_position().into();
        let pack_in_start_condition = self.pack_start_condition_determination(pack_flow_valve);
        // TODO: Add "insufficient performance" based on Pack Mixer Temperature Demand
        if pack_in_start_condition {
            intermediate_flow =
                intermediate_flow.max(Ratio::new::<percent>(Self::PACK_START_FLOW_LIMIT));
        }
        if pneumatic.apu_bleed_is_on() {
            intermediate_flow =
                intermediate_flow.max(Ratio::new::<percent>(Self::APU_SUPPLY_FLOW_LIMIT));
        }
        // Single pack operation determination
        if pack_flow_valve[0].fcv_is_open() != pack_flow_valve[1].fcv_is_open() {
            intermediate_flow =
                intermediate_flow.max(Ratio::new::<percent>(Self::ONE_PACK_FLOW_LIMIT));
        }
        if matches!(
            aircraft_state,
            AirConditioningStateManager::BeginTakeOff(_)
                | AirConditioningStateManager::EndTakeOff(_)
                | AirConditioningStateManager::BeginLanding(_)
                | AirConditioningStateManager::EndLanding(_)
        ) {
            intermediate_flow =
                intermediate_flow.min(Ratio::new::<percent>(Self::FLOW_REDUCTION_LIMIT));
        }
        intermediate_flow.max(Ratio::new::<percent>(Self::BACKFLOW_LIMIT))
    }

    // This calculates the flow based on the demand, when the packs are modelled this needs to be changed
    // so the demand actuates the valve, and then the flow is calculated based on that
    fn absolute_flow_calculation(&self, pressurization: &impl Cabin) -> MassRate {
        let absolute_flow = self.flow_demand.get::<ratio>()
            * (Self::FLOW_CONSTANT_XCAB * pressurization.altitude().get::<foot>()
                + Self::FLOW_CONSTANT_C);
        MassRate::new::<kilogram_per_second>(absolute_flow)
    }

    fn fcv_open_allowed_determination(
        &mut self,
        acs_overhead: &AirConditioningSystemOverhead<ZONES>,
        engine_fire_push_buttons: &impl EngineFirePushButtons,
        pressurization_overhead: &PressurizationOverheadPanel,
        pneumatic: &(impl PneumaticBleed + EngineStartState),
    ) {
        // Flow Control Valve 1
        self.fcv_1_open_allowed = acs_overhead.pack_pushbuttons_state()[0]
            && !(pneumatic.left_engine_state() == EngineState::Starting)
            && (!(pneumatic.right_engine_state() == EngineState::Starting)
                || !pneumatic.engine_crossbleed_is_on())
            && (pneumatic.engine_mode_selector() != EngineModeSelector::Ignition
                || (pneumatic.left_engine_state() != EngineState::Off
                    && pneumatic.left_engine_state() != EngineState::Shutting))
            && !engine_fire_push_buttons.is_released(1)
            && !pressurization_overhead.ditching_is_on();
        // && ! pack 1 overheat
        // Flow Control Valve 2
        self.fcv_2_open_allowed = acs_overhead.pack_pushbuttons_state()[1]
            && !(pneumatic.right_engine_state() == EngineState::Starting)
            && (!(pneumatic.left_engine_state() == EngineState::Starting)
                || !pneumatic.engine_crossbleed_is_on())
            && (pneumatic.engine_mode_selector() != EngineModeSelector::Ignition
                || !pneumatic.engine_crossbleed_is_on()
                || (pneumatic.right_engine_state() != EngineState::Off
                    && pneumatic.right_engine_state() != EngineState::Shutting))
            && !engine_fire_push_buttons.is_released(2)
            && !pressurization_overhead.ditching_is_on();
        // && ! pack 2 overheat
    }

    fn should_open_fcv_determination(
        &self,
        engines: [&impl EngineCorrectedN1; 2],
        pneumatic: &(impl PneumaticBleed + EngineStartState),
        pneumatic_overhead: &impl EngineBleedPushbutton,
    ) -> [bool; 2] {
        // Pneumatic overhead represents engine bleed pushbutton for left and right engine(s)
        [
            self.fcv_1_open_allowed
                && (((engines[0].corrected_n1() >= Ratio::new::<percent>(15.)
                    && pneumatic_overhead.left_engine_bleed_pushbutton_is_auto())
                    || (engines[1].corrected_n1() >= Ratio::new::<percent>(15.)
                        && pneumatic_overhead.right_engine_bleed_pushbutton_is_auto()
                        && pneumatic.engine_crossbleed_is_on()))
                    || pneumatic.apu_bleed_is_on()),
            self.fcv_2_open_allowed
                && (((engines[1].corrected_n1() >= Ratio::new::<percent>(15.)
                    && pneumatic_overhead.right_engine_bleed_pushbutton_is_auto())
                    || (engines[0].corrected_n1() >= Ratio::new::<percent>(15.)
                        && pneumatic_overhead.left_engine_bleed_pushbutton_is_auto()
                        && pneumatic.engine_crossbleed_is_on()))
                    || pneumatic.apu_bleed_is_on()),
        ]
    }

    fn pack_flow_calculation(
        &self,
        pack_flow_valve: &[PackFlowValve; 2],
        pressurization: &impl Cabin,
    ) -> MassRate {
        let absolute_flow: MassRate = self.absolute_flow_calculation(pressurization);
        if pack_flow_valve.iter().any(|fcv| fcv.fcv_is_open()) {
            // Single pack operation determination
            if pack_flow_valve[0].fcv_is_open() != pack_flow_valve[1].fcv_is_open() {
                absolute_flow
            } else {
                absolute_flow * 2.
            }
        } else {
            MassRate::new::<kilogram_per_second>(0.)
        }
    }
}

impl<const ZONES: usize> PackFlow for PackFlowController<ZONES> {
    fn pack_flow(&self) -> MassRate {
        self.pack_flow
    }
}

impl<const ZONES: usize> ControllerSignal<PackFlowValveSignal> for PackFlowController<ZONES> {
    fn signal(&self) -> Option<PackFlowValveSignal> {
        let target_open: Vec<Ratio> = self
            .should_open_fcv
            .iter()
            .map(|&fcv| {
                if fcv {
                    Ratio::new::<percent>(100.)
                } else {
                    Ratio::new::<percent>(0.)
                }
            })
            .collect();
        Some(PackFlowValveSignal::new([target_open[0], target_open[1]]))
    }
}

impl<const ZONES: usize> SimulationElement for PackFlowController<ZONES> {
    fn write(&self, writer: &mut SimulatorWriter) {
        // If both flow control valves are closed, the flow indication is in the Lo position
        if self.should_open_fcv.iter().any(|&x| x) {
            writer.write(&self.pack_flow_id, self.flow_demand);
        } else {
            let flow_selected: Ratio = OverheadFlowSelector::Lo.into();
            writer.write(&self.pack_flow_id, flow_selected);
        }
    }
}

#[cfg(test)]
mod acs_controller_tests {
    use super::*;
    use crate::{
        air_conditioning::cabin_air::CabinZone,
        overhead::AutoOffFaultPushButton,
        pneumatic::{valve::DefaultValve, EngineModeSelector},
        shared::PneumaticValve,
        simulation::{
            test::{ReadByName, SimulationTestBed, TestBed, WriteByName},
            Aircraft, SimulationElement, SimulationElementVisitor, UpdateContext,
        },
    };
    use uom::si::{
        length::foot, pressure::hectopascal, thermodynamic_temperature::degree_celsius,
        velocity::knot, volume::cubic_meter,
    };

    struct TestAdirs {
        ground_speed: Velocity,
    }
    impl TestAdirs {
        fn new() -> Self {
            Self {
                ground_speed: Velocity::new::<knot>(0.),
            }
        }

        fn set_ground_speed(&mut self, ground_speed: Velocity) {
            self.ground_speed = ground_speed;
        }
    }
    impl GroundSpeed for TestAdirs {
        fn ground_speed(&self) -> Velocity {
            self.ground_speed
        }
    }

    struct TestEngine {
        corrected_n1: Ratio,
    }
    impl TestEngine {
        fn new(engine_corrected_n1: Ratio) -> Self {
            Self {
                corrected_n1: engine_corrected_n1,
            }
        }
        fn set_engine_n1(&mut self, n: Ratio) {
            self.corrected_n1 = n;
        }
    }
    impl EngineCorrectedN1 for TestEngine {
        fn corrected_n1(&self) -> Ratio {
            self.corrected_n1
        }
    }

    struct TestPressurization {
        cabin_altitude: Length,
    }
    impl TestPressurization {
        fn new() -> Self {
            Self {
                cabin_altitude: Length::new::<foot>(0.),
            }
        }

        fn set_cabin_altitude(&mut self, altitude: Length) {
            self.cabin_altitude = altitude;
        }
    }
    impl Cabin for TestPressurization {
        fn altitude(&self) -> Length {
            self.cabin_altitude
        }

        fn pressure(&self) -> Pressure {
            Pressure::new::<hectopascal>(1013.15)
        }
    }

    struct TestLgciu {
        compressed: bool,
    }
    impl TestLgciu {
        fn new(compressed: bool) -> Self {
            Self { compressed }
        }

        fn set_on_ground(&mut self, on_ground: bool) {
            self.compressed = on_ground;
        }
    }
    impl LgciuWeightOnWheels for TestLgciu {
        fn left_and_right_gear_compressed(&self, _treat_ext_pwr_as_ground: bool) -> bool {
            self.compressed
        }
        fn right_gear_compressed(&self, _treat_ext_pwr_as_ground: bool) -> bool {
            true
        }
        fn right_gear_extended(&self, _treat_ext_pwr_as_ground: bool) -> bool {
            false
        }
        fn left_gear_compressed(&self, _treat_ext_pwr_as_ground: bool) -> bool {
            true
        }
        fn left_gear_extended(&self, _treat_ext_pwr_as_ground: bool) -> bool {
            false
        }
        fn left_and_right_gear_extended(&self, _treat_ext_pwr_as_ground: bool) -> bool {
            false
        }
        fn nose_gear_compressed(&self, _treat_ext_pwr_as_ground: bool) -> bool {
            true
        }
        fn nose_gear_extended(&self, _treat_ext_pwr_as_ground: bool) -> bool {
            false
        }
    }

    struct TestEngineFirePushButtons {
        is_released: [bool; 2],
    }
    impl TestEngineFirePushButtons {
        fn new() -> Self {
            Self {
                is_released: [false, false],
            }
        }

        fn release(&mut self, engine_number: usize) {
            self.is_released[engine_number - 1] = true;
        }
    }
    impl EngineFirePushButtons for TestEngineFirePushButtons {
        fn is_released(&self, engine_number: usize) -> bool {
            self.is_released[engine_number - 1]
        }
    }

    struct TestPneumaticOverhead {
        engine_1_bleed: AutoOffFaultPushButton,
        engine_2_bleed: AutoOffFaultPushButton,
    }

    impl TestPneumaticOverhead {
        fn new(context: &mut InitContext) -> Self {
            Self {
                engine_1_bleed: AutoOffFaultPushButton::new_auto(context, "PNEU_ENG_1_BLEED"),
                engine_2_bleed: AutoOffFaultPushButton::new_auto(context, "PNEU_ENG_2_BLEED"),
            }
        }
    }

    impl EngineBleedPushbutton for TestPneumaticOverhead {
        fn left_engine_bleed_pushbutton_is_auto(&self) -> bool {
            self.engine_1_bleed.is_auto()
        }

        fn right_engine_bleed_pushbutton_is_auto(&self) -> bool {
            self.engine_2_bleed.is_auto()
        }
    }

    impl SimulationElement for TestPneumaticOverhead {
        fn accept<T: SimulationElementVisitor>(&mut self, visitor: &mut T) {
            self.engine_1_bleed.accept(visitor);
            self.engine_2_bleed.accept(visitor);

            visitor.visit(self);
        }
    }

    struct TestFadec {
        engine_1_state_id: VariableIdentifier,
        engine_2_state_id: VariableIdentifier,

        engine_1_state: EngineState,
        engine_2_state: EngineState,

        engine_mode_selector_id: VariableIdentifier,
        engine_mode_selector_position: EngineModeSelector,
    }
    impl TestFadec {
        fn new(context: &mut InitContext) -> Self {
            Self {
                engine_1_state_id: context.get_identifier("ENGINE_STATE:1".to_owned()),
                engine_2_state_id: context.get_identifier("ENGINE_STATE:2".to_owned()),
                engine_1_state: EngineState::Off,
                engine_2_state: EngineState::Off,
                engine_mode_selector_id: context
                    .get_identifier("TURB ENG IGNITION SWITCH EX1:1".to_owned()),
                engine_mode_selector_position: EngineModeSelector::Norm,
            }
        }

        fn engine_state(&self, number: usize) -> EngineState {
            match number {
                1 => self.engine_1_state,
                2 => self.engine_2_state,
                _ => panic!("Invalid engine number"),
            }
        }

        fn engine_mode_selector(&self) -> EngineModeSelector {
            self.engine_mode_selector_position
        }
    }
    impl SimulationElement for TestFadec {
        fn read(&mut self, reader: &mut SimulatorReader) {
            self.engine_1_state = reader.read(&self.engine_1_state_id);
            self.engine_2_state = reader.read(&self.engine_2_state_id);
            self.engine_mode_selector_position = reader.read(&self.engine_mode_selector_id);
        }
    }

    struct TestPneumatic {
        apu_bleed_air_valve: DefaultValve,
        cross_bleed_valve: DefaultValve,
        fadec: TestFadec,
    }

    impl TestPneumatic {
        fn new(context: &mut InitContext) -> Self {
            Self {
                apu_bleed_air_valve: DefaultValve::new_closed(),
                cross_bleed_valve: DefaultValve::new_closed(),
                fadec: TestFadec::new(context),
            }
        }

        fn set_apu_bleed_air_valve_open(&mut self) {
            self.apu_bleed_air_valve = DefaultValve::new_open();
        }

        fn set_cross_bleed_valve_open(&mut self) {
            self.cross_bleed_valve = DefaultValve::new_open();
        }
    }

    impl PneumaticBleed for TestPneumatic {
        fn apu_bleed_is_on(&self) -> bool {
            self.apu_bleed_air_valve.is_open()
        }
        fn engine_crossbleed_is_on(&self) -> bool {
            self.cross_bleed_valve.is_open()
        }
    }
    impl EngineStartState for TestPneumatic {
        fn left_engine_state(&self) -> EngineState {
            self.fadec.engine_state(1)
        }
        fn right_engine_state(&self) -> EngineState {
            self.fadec.engine_state(2)
        }
        fn engine_mode_selector(&self) -> EngineModeSelector {
            self.fadec.engine_mode_selector()
        }
    }
    impl SimulationElement for TestPneumatic {
        fn accept<V: SimulationElementVisitor>(&mut self, visitor: &mut V) {
            self.fadec.accept(visitor);

            visitor.visit(self);
        }
    }

    struct TestCabin {
        cockpit: CabinZone<2>,
        passenger_cabin: CabinZone<2>,
    }

    impl TestCabin {
        fn new(context: &mut InitContext) -> Self {
            Self {
                cockpit: CabinZone::new(
                    context,
                    ZoneType::Cockpit,
                    Volume::new::<cubic_meter>(60.),
                    2,
                    None,
                ),
                passenger_cabin: CabinZone::new(
                    context,
                    ZoneType::Cabin(1),
                    Volume::new::<cubic_meter>(400.),
                    0,
                    Some([(1, 6), (7, 13)]),
                ),
            }
        }

        fn update(
            &mut self,
            context: &UpdateContext,
            duct_temperature: &impl DuctTemperature,
            pack_flow: &impl PackFlow,
            pressurization: &impl Cabin,
        ) {
            let flow_rate_per_cubic_meter: MassRate = MassRate::new::<kilogram_per_second>(
                pack_flow.pack_flow().get::<kilogram_per_second>() / (460.),
            );
            self.cockpit.update(
                context,
                duct_temperature,
                flow_rate_per_cubic_meter,
                pressurization,
            );
            self.passenger_cabin.update(
                context,
                duct_temperature,
                flow_rate_per_cubic_meter,
                pressurization,
            );
        }

        fn update_number_of_passengers(&mut self, number_of_passengers: u8) {
            self.passenger_cabin
                .update_number_of_passengers(number_of_passengers);
        }
    }

    impl SimulationElement for TestCabin {
        fn accept<V: SimulationElementVisitor>(&mut self, visitor: &mut V) {
            self.cockpit.accept(visitor);
            self.passenger_cabin.accept(visitor);

            visitor.visit(self);
        }
    }

    struct TestAircraft {
        acsc: AirConditioningSystemController<2>,
        acs_overhead: AirConditioningSystemOverhead<2>,
        pack_flow_valve: [PackFlowValve; 2],
        adirs: TestAdirs,
        engine_1: TestEngine,
        engine_2: TestEngine,
        engine_fire_push_buttons: TestEngineFirePushButtons,
        pneumatic: TestPneumatic,
        pneumatic_overhead: TestPneumaticOverhead,
        pressurization: TestPressurization,
        pressurization_overhead: PressurizationOverheadPanel,
        lgciu1: TestLgciu,
        lgciu2: TestLgciu,
        test_cabin: TestCabin,
    }
    impl TestAircraft {
        fn new(context: &mut InitContext) -> Self {
            Self {
                acsc: AirConditioningSystemController::new(
                    context,
                    &[ZoneType::Cockpit, ZoneType::Cabin(1)],
                ),
                acs_overhead: AirConditioningSystemOverhead::new(
                    context,
                    &[ZoneType::Cockpit, ZoneType::Cabin(1)],
                ),
                pack_flow_valve: [
                    PackFlowValve::new(context, 1),
                    PackFlowValve::new(context, 2),
                ],
                adirs: TestAdirs::new(),
                engine_1: TestEngine::new(Ratio::new::<percent>(0.)),
                engine_2: TestEngine::new(Ratio::new::<percent>(0.)),
                engine_fire_push_buttons: TestEngineFirePushButtons::new(),
                pneumatic: TestPneumatic::new(context),
                pneumatic_overhead: TestPneumaticOverhead::new(context),
                pressurization: TestPressurization::new(),
                pressurization_overhead: PressurizationOverheadPanel::new(context),
                lgciu1: TestLgciu::new(false),
                lgciu2: TestLgciu::new(false),
                test_cabin: TestCabin::new(context),
            }
        }

        fn set_ground_speed(&mut self, ground_speed: Velocity) {
            self.adirs.set_ground_speed(ground_speed);
        }

        fn set_engine_n1(&mut self, n: Ratio) {
            self.engine_1.set_engine_n1(n);
            self.engine_2.set_engine_n1(n);
        }

        fn set_engine_1_n1(&mut self, n: Ratio) {
            self.engine_1.set_engine_n1(n);
        }

        fn set_on_ground(&mut self, on_ground: bool) {
            self.lgciu1.set_on_ground(on_ground);
            self.lgciu2.set_on_ground(on_ground);
        }

        fn set_apu_bleed_air_valve_open(&mut self) {
            self.pneumatic.set_apu_bleed_air_valve_open();
        }

        fn set_cross_bleed_valve_open(&mut self) {
            self.pneumatic.set_cross_bleed_valve_open();
        }
    }
    impl Aircraft for TestAircraft {
        fn update_after_power_distribution(&mut self, context: &UpdateContext) {
            self.acsc.update(
                context,
                &self.adirs,
                &self.acs_overhead,
                &self.pack_flow_valve,
                [&self.engine_1, &self.engine_2],
                &self.engine_fire_push_buttons,
                &self.pneumatic,
                &self.pneumatic_overhead,
                &self.pressurization,
                &self.pressurization_overhead,
                [&self.lgciu1, &self.lgciu2],
            );
            self.test_cabin
                .update(context, &self.acsc, &self.acsc, &self.pressurization);
            for fcv in self.pack_flow_valve.iter_mut() {
                fcv.update(context, &self.acsc);
            }
        }
    }
    impl SimulationElement for TestAircraft {
        fn accept<V: SimulationElementVisitor>(&mut self, visitor: &mut V) {
            self.acsc.accept(visitor);
            self.acs_overhead.accept(visitor);
            self.test_cabin.accept(visitor);
            self.pneumatic.accept(visitor);
            self.pressurization_overhead.accept(visitor);

            visitor.visit(self);
        }
    }

    struct ACSCTestBed {
        test_bed: SimulationTestBed<TestAircraft>,
    }
    impl ACSCTestBed {
        fn new() -> Self {
            let mut test_bed = ACSCTestBed {
                test_bed: SimulationTestBed::new(TestAircraft::new),
            };
            test_bed.command_ground_speed(Velocity::new::<knot>(0.));
            test_bed.set_indicated_altitude(Length::new::<foot>(0.));
            test_bed.set_ambient_temperature(ThermodynamicTemperature::new::<degree_celsius>(24.));
            test_bed.command_measured_temperature(
                [ThermodynamicTemperature::new::<degree_celsius>(24.); 2],
            );
            test_bed.command_pax_quantity(0);
            test_bed.command_pack_flow_selector_position(1);

            test_bed
        }

        fn and(self) -> Self {
            self
        }

        fn run_and(mut self) -> Self {
            self.run();
            self
        }

        fn and_run(mut self) -> Self {
            self.run();
            self
        }

        fn with(self) -> Self {
            self
        }

        fn iterate(mut self, iterations: usize) -> Self {
            for _ in 0..iterations {
                self.run();
            }
            self
        }

        fn iterate_with_delta(mut self, iterations: usize, delta: Duration) -> Self {
            for _ in 0..iterations {
                self.run_with_delta(delta);
            }
            self
        }

        fn on_ground(mut self) -> Self {
            self.command(|a| a.set_engine_n1(Ratio::new::<percent>(15.)));
            self.command(|a| a.set_on_ground(true));
            self.run();
            self
        }

        fn in_flight(mut self) -> Self {
            self.command(|a| a.set_engine_n1(Ratio::new::<percent>(60.)));
            self.command(|a| a.set_on_ground(false));
            self.command_ground_speed(Velocity::new::<knot>(250.));
            self.run();
            self
        }

        fn engine_in_take_off(mut self) -> Self {
            self.command(|a| a.set_engine_n1(Ratio::new::<percent>(71.)));
            self
        }

        fn engine_idle(mut self) -> Self {
            self.command(|a| a.set_engine_n1(Ratio::new::<percent>(15.)));
            self
        }

        fn one_engine_on(mut self) -> Self {
            self.command(|a| a.set_engine_1_n1(Ratio::new::<percent>(15.)));
            self
        }

        fn landing_gear_compressed(mut self) -> Self {
            self.command(|a| a.set_on_ground(true));
            self
        }

        fn landing_gear_not_compressed(mut self) -> Self {
            self.command(|a| a.set_on_ground(false));
            self
        }

        fn both_packs_on(mut self) -> Self {
            self.command_pack_1_pb_position(true);
            self.command_pack_2_pb_position(true);
            self
        }

        fn ac_state_is_initialisation(&self) -> bool {
            matches!(
                self.query(|a| a.acsc.aircraft_state),
                AirConditioningStateManager::Initialisation(_)
            )
        }

        fn ac_state_is_on_ground(&self) -> bool {
            matches!(
                self.query(|a| a.acsc.aircraft_state),
                AirConditioningStateManager::OnGround(_)
            )
        }

        fn ac_state_is_begin_takeoff(&self) -> bool {
            matches!(
                self.query(|a| a.acsc.aircraft_state),
                AirConditioningStateManager::BeginTakeOff(_)
            )
        }

        fn ac_state_is_end_takeoff(&self) -> bool {
            matches!(
                self.query(|a| a.acsc.aircraft_state),
                AirConditioningStateManager::EndTakeOff(_)
            )
        }

        fn ac_state_is_in_flight(&self) -> bool {
            matches!(
                self.query(|a| a.acsc.aircraft_state),
                AirConditioningStateManager::InFlight(_)
            )
        }

        fn ac_state_is_begin_landing(&self) -> bool {
            matches!(
                self.query(|a| a.acsc.aircraft_state),
                AirConditioningStateManager::BeginLanding(_)
            )
        }

        fn ac_state_is_end_landing(&self) -> bool {
            matches!(
                self.query(|a| a.acsc.aircraft_state),
                AirConditioningStateManager::EndLanding(_)
            )
        }

        fn command_selected_temperature(
            mut self,
            temp_array: [ThermodynamicTemperature; 2],
        ) -> Self {
            for (temp, id) in temp_array.iter().zip(["CKPT", "FWD"].iter()) {
                let zone_selected_temp_id = format!("OVHD_COND_{}_SELECTOR_KNOB", &id);
                self.write_by_name(
                    &zone_selected_temp_id,
                    (temp.get::<degree_celsius>() - 18.) / 0.04,
                );
            }
            self
        }

        fn command_measured_temperature(&mut self, temp_array: [ThermodynamicTemperature; 2]) {
            for (temp, id) in temp_array.iter().zip(["CKPT", "FWD"].iter()) {
                let zone_measured_temp_id = format!("COND_{}_TEMP", &id);
                self.write_by_name(&zone_measured_temp_id, temp.get::<degree_celsius>());
            }
        }

        fn command_pax_quantity(&mut self, pax_quantity: u8) {
            self.write_by_name(&format!("PAX_TOTAL_ROWS_{}_{}", 1, 6), pax_quantity / 2);
            self.write_by_name(&format!("PAX_TOTAL_ROWS_{}_{}", 7, 13), pax_quantity / 2);
            self.command(|a| a.test_cabin.update_number_of_passengers(pax_quantity));
        }

        fn command_cabin_altitude(&mut self, altitude: Length) {
            self.command(|a| a.pressurization.set_cabin_altitude(altitude));
        }

        fn command_pack_flow_selector_position(&mut self, value: u8) {
            self.write_by_name("KNOB_OVHD_AIRCOND_PACKFLOW_Position", value);
        }

        fn command_pack_1_pb_position(&mut self, value: bool) {
            self.write_by_name("OVHD_COND_PACK_1_PB_IS_ON", value);
        }

        fn command_pack_2_pb_position(&mut self, value: bool) {
            self.write_by_name("OVHD_COND_PACK_2_PB_IS_ON", value);
        }

        fn command_apu_bleed_on(&mut self) {
            self.command(|a| a.set_apu_bleed_air_valve_open());
        }

        fn command_eng_mode_selector(&mut self, mode: EngineModeSelector) {
            self.write_by_name("TURB ENG IGNITION SWITCH EX1:1", mode);
        }

        fn command_engine_in_start_mode(&mut self) {
            self.write_by_name("ENGINE_STATE:1", 2);
            self.write_by_name("ENGINE_STATE:2", 2);
        }

        fn command_engine_on_fire(&mut self) {
            self.command(|a| a.engine_fire_push_buttons.release(1));
            self.command(|a| a.engine_fire_push_buttons.release(2));
        }

        fn command_ditching_on(&mut self) {
            self.write_by_name("OVHD_PRESS_DITCHING_PB_IS_ON", true);
        }

        fn command_crossbleed_on(&mut self) {
            self.command(|a| a.set_cross_bleed_valve_open());
        }

        fn command_ground_speed(&mut self, ground_speed: Velocity) {
            self.command(|a| a.set_ground_speed(ground_speed));
        }

        fn measured_temperature(&mut self) -> ThermodynamicTemperature {
            self.read_by_name("COND_FWD_TEMP")
        }

        fn duct_demand_temperature(&self) -> Vec<ThermodynamicTemperature> {
            self.query(|a| a.acsc.duct_demand_temperature())
        }

        fn pack_flow(&self) -> MassRate {
            self.query(|a| a.acsc.pack_flow())
        }
    }

    impl TestBed for ACSCTestBed {
        type Aircraft = TestAircraft;

        fn test_bed(&self) -> &SimulationTestBed<TestAircraft> {
            &self.test_bed
        }

        fn test_bed_mut(&mut self) -> &mut SimulationTestBed<TestAircraft> {
            &mut self.test_bed
        }
    }

    fn test_bed() -> ACSCTestBed {
        ACSCTestBed::new()
    }

    mod ac_state_manager_tests {
        use super::*;

        #[test]
        fn acstate_starts_non_initialised() {
            let test_bed = test_bed();

            assert!(test_bed.ac_state_is_initialisation());
        }

        #[test]
        fn acstate_changes_to_in_flight_from_initialised() {
            let test_bed = test_bed().in_flight();

            assert!(test_bed.ac_state_is_in_flight());
        }

        #[test]
        fn acstate_changes_to_ground_from_initialised() {
            let test_bed = test_bed().on_ground();

            assert!(test_bed.ac_state_is_on_ground());
        }

        #[test]
        fn acstate_changes_to_begin_takeoff_from_ground() {
            let mut test_bed = test_bed()
                .on_ground()
                .with()
                .landing_gear_compressed()
                .and()
                .engine_in_take_off();

            test_bed.run();

            assert!(test_bed.ac_state_is_begin_takeoff());
        }

        #[test]
        fn acstate_changes_to_end_takeoff_from_begin_takeoff() {
            let mut test_bed = test_bed()
                .on_ground()
                .with()
                .landing_gear_compressed()
                .and()
                .engine_in_take_off()
                .and_run();

            test_bed.command_ground_speed(Velocity::new::<knot>(71.));
            test_bed.run();

            assert!(test_bed.ac_state_is_end_takeoff());
        }

        #[test]
        fn acstate_changes_to_end_takeoff_from_begin_takeoff_by_timeout() {
            let mut test_bed = test_bed()
                .on_ground()
                .with()
                .landing_gear_compressed()
                .and()
                .engine_in_take_off()
                .and_run();

            test_bed.run_with_delta(Duration::from_secs(36));
            test_bed.run();

            assert!(test_bed.ac_state_is_end_takeoff());
        }

        #[test]
        fn acstate_does_not_change_to_end_takeoff_from_begin_takeoff_before_timeout() {
            let mut test_bed = test_bed()
                .on_ground()
                .with()
                .landing_gear_compressed()
                .and()
                .engine_in_take_off()
                .and_run();

            test_bed.run_with_delta(Duration::from_secs(33));
            test_bed.run();

            assert!(test_bed.ac_state_is_begin_takeoff());
        }

        #[test]
        fn acstate_changes_to_in_flight_from_end_takeoff() {
            let mut test_bed = test_bed()
                .on_ground()
                .with()
                .landing_gear_compressed()
                .and()
                .engine_in_take_off()
                .and_run();

            test_bed.command_ground_speed(Velocity::new::<knot>(71.));
            test_bed.run();

            test_bed = test_bed.landing_gear_not_compressed();
            test_bed.run();

            assert!(test_bed.ac_state_is_in_flight());
        }

        #[test]
        fn acstate_changes_to_in_flight_from_end_takeoff_by_timeout() {
            let mut test_bed = test_bed()
                .on_ground()
                .with()
                .landing_gear_compressed()
                .and()
                .engine_in_take_off()
                .and_run();

            test_bed.command_ground_speed(Velocity::new::<knot>(71.));
            test_bed.run();

            test_bed.run_with_delta(Duration::from_secs(11));
            test_bed.run();

            assert!(test_bed.ac_state_is_in_flight());
        }

        #[test]
        fn acstate_does_not_change_to_in_flight_from_end_takeoff_before_timeout() {
            let mut test_bed = test_bed()
                .on_ground()
                .with()
                .landing_gear_compressed()
                .and()
                .engine_in_take_off()
                .and_run();

            test_bed.command_ground_speed(Velocity::new::<knot>(71.));
            test_bed.run();

            test_bed.run_with_delta(Duration::from_secs(9));
            test_bed.run();

            assert!(test_bed.ac_state_is_end_takeoff());
        }

        #[test]
        fn acstate_changes_to_begin_landing_from_in_flight() {
            let test_bed = test_bed()
                .in_flight()
                .with()
                .landing_gear_compressed()
                .and()
                .engine_idle()
                .and_run();

            assert!(test_bed.ac_state_is_begin_landing());
        }

        #[test]
        fn acstate_changes_to_end_landing_from_begin_landing() {
            let mut test_bed = test_bed()
                .in_flight()
                .with()
                .landing_gear_compressed()
                .and()
                .engine_idle()
                .and_run();

            test_bed.command_ground_speed(Velocity::new::<knot>(69.));
            test_bed.run();

            assert!(test_bed.ac_state_is_end_landing());
        }

        #[test]
        fn acstate_changes_to_end_landing_from_begin_landing_by_timeout() {
            let mut test_bed = test_bed()
                .in_flight()
                .with()
                .landing_gear_compressed()
                .and()
                .engine_idle()
                .and_run();

            test_bed.run_with_delta(Duration::from_secs(36));
            test_bed.run();

            assert!(test_bed.ac_state_is_end_landing());
        }

        #[test]
        fn acstate_does_not_change_to_end_landing_from_begin_landing_before_timeout() {
            let mut test_bed = test_bed()
                .in_flight()
                .with()
                .landing_gear_compressed()
                .and()
                .engine_idle()
                .and_run();

            test_bed.run_with_delta(Duration::from_secs(33));
            test_bed.run();

            assert!(test_bed.ac_state_is_begin_landing());
        }

        #[test]
        fn acstate_changes_to_on_ground_from_end_landing_by_timeout() {
            let mut test_bed = test_bed()
                .in_flight()
                .with()
                .landing_gear_compressed()
                .and()
                .engine_idle()
                .and_run();

            test_bed.command_ground_speed(Velocity::new::<knot>(69.));
            test_bed.run();

            test_bed.run_with_delta(Duration::from_secs(11));
            test_bed.run();

            assert!(test_bed.ac_state_is_on_ground());
        }

        #[test]
        fn acstate_does_not_change_to_on_ground_from_end_landing_before_timeout() {
            let mut test_bed = test_bed()
                .in_flight()
                .with()
                .landing_gear_compressed()
                .and()
                .engine_idle()
                .and_run();

            test_bed.command_ground_speed(Velocity::new::<knot>(69.));
            test_bed.run();

            test_bed.run_with_delta(Duration::from_secs(9));
            test_bed.run();

            assert!(test_bed.ac_state_is_end_landing());
        }
    }

    mod zone_controller_tests {
        use super::*;

        const A320_ZONE_IDS: [&str; 2] = ["CKPT", "FWD"];

        #[test]
        fn duct_demand_temperature_starts_at_24_c_in_all_zones() {
            let test_bed = test_bed();

            for id in 0..A320_ZONE_IDS.len() {
                assert_eq!(
                    test_bed.duct_demand_temperature()[id],
                    ThermodynamicTemperature::new::<degree_celsius>(24.)
                );
            }
        }

        #[test]
        fn duct_demand_temperature_stays_at_24_with_no_inputs() {
            let test_bed = test_bed()
                .with()
                .both_packs_on()
                .and()
                .engine_idle()
                .and()
                .command_selected_temperature(
                    [ThermodynamicTemperature::new::<degree_celsius>(24.); 2],
                )
                .iterate_with_delta(100, Duration::from_secs(10));

            assert!(
                (test_bed.duct_demand_temperature()[1].get::<degree_celsius>() - 24.).abs() < 1.
            );
        }

        #[test]
        fn duct_demand_temperature_is_cabin_temp_when_no_flow() {
            let mut test_bed = test_bed()
                .with()
                .engine_idle()
                .and()
                .command_selected_temperature(
                    [ThermodynamicTemperature::new::<degree_celsius>(18.); 2],
                );

            test_bed.command_pack_1_pb_position(false);
            test_bed.command_pack_2_pb_position(false);
            test_bed = test_bed.iterate_with_delta(100, Duration::from_secs(10));
            assert!(
                (test_bed.duct_demand_temperature()[1].get::<degree_celsius>()
                    - test_bed.measured_temperature().get::<degree_celsius>())
                .abs()
                    < 1.
            );
        }

        #[test]
        fn increasing_selected_temp_increases_duct_demand_temp() {
            let mut test_bed = test_bed()
                .with()
                .both_packs_on()
                .and()
                .engine_idle()
                .and()
                .command_selected_temperature(
                    [ThermodynamicTemperature::new::<degree_celsius>(30.); 2],
                );

            let initial_temperature = test_bed.duct_demand_temperature()[1];
            test_bed = test_bed.iterate_with_delta(100, Duration::from_secs(10));

            assert!(test_bed.duct_demand_temperature()[1] > initial_temperature);
        }

        #[test]
        fn increasing_measured_temp_reduces_duct_demand_temp() {
            let mut test_bed = test_bed()
                .with()
                .both_packs_on()
                .and()
                .engine_idle()
                .run_and()
                .command_selected_temperature(
                    [ThermodynamicTemperature::new::<degree_celsius>(24.); 2],
                )
                .iterate_with_delta(100, Duration::from_secs(10));

            test_bed.command_measured_temperature(
                [ThermodynamicTemperature::new::<degree_celsius>(30.); 2],
            );

            test_bed.run();

            assert!(
                test_bed.duct_demand_temperature()[1]
                    < ThermodynamicTemperature::new::<degree_celsius>(24.)
            );
        }

        #[test]
        fn duct_demand_temp_reaches_equilibrium() {
            let mut test_bed = test_bed()
                .with()
                .both_packs_on()
                .and()
                .engine_idle()
                .run_and()
                .command_selected_temperature(
                    [ThermodynamicTemperature::new::<degree_celsius>(30.); 2],
                )
                .iterate_with_delta(3, Duration::from_secs(1));

            let mut previous_temp = test_bed.duct_demand_temperature()[1];
            test_bed.run();
            let initial_temp_diff = test_bed.duct_demand_temperature()[1].get::<degree_celsius>()
                - previous_temp.get::<degree_celsius>();
            test_bed = test_bed.iterate_with_delta(100, Duration::from_secs(10));
            previous_temp = test_bed.duct_demand_temperature()[1];
            test_bed.run();
            let final_temp_diff = test_bed.duct_demand_temperature()[1].get::<degree_celsius>()
                - previous_temp.get::<degree_celsius>();

            assert!(
                (test_bed.duct_demand_temperature()[1].get::<degree_celsius>() - 30.).abs() < 1.
            );
            assert!(initial_temp_diff > final_temp_diff);
        }

        #[test]
        fn duct_demand_temp_increases_with_altitude() {
            let mut test_bed = test_bed()
                .with()
                .both_packs_on()
                .and()
                .engine_idle()
                .and()
                .command_selected_temperature(
                    [ThermodynamicTemperature::new::<degree_celsius>(24.); 2],
                )
                .iterate_with_delta(100, Duration::from_secs(10));

            let initial_temperature = test_bed.duct_demand_temperature()[1];

            test_bed.command_cabin_altitude(Length::new::<foot>(30000.));
            test_bed = test_bed.iterate_with_delta(100, Duration::from_secs(10));

            assert!(test_bed.duct_demand_temperature()[1] > initial_temperature);
        }

        #[test]
        fn duct_demand_limit_changes_with_measured_temperature() {
            let mut test_bed = test_bed()
                .with()
                .both_packs_on()
                .and()
                .engine_idle()
                .and()
                .command_selected_temperature(
                    [ThermodynamicTemperature::new::<degree_celsius>(10.); 2],
                );
            test_bed.command_measured_temperature(
                [ThermodynamicTemperature::new::<degree_celsius>(24.); 2],
            );
            test_bed = test_bed.iterate_with_delta(3, Duration::from_secs(1));
            assert!(
                (test_bed.duct_demand_temperature()[1].get::<degree_celsius>() - 8.).abs() < 1.
            );
            test_bed.command_measured_temperature(
                [ThermodynamicTemperature::new::<degree_celsius>(27.); 2],
            );
            test_bed.run();
            assert!(
                (test_bed.duct_demand_temperature()[1].get::<degree_celsius>() - 5.).abs() < 1.
            );
            test_bed.command_measured_temperature(
                [ThermodynamicTemperature::new::<degree_celsius>(29.); 2],
            );
            test_bed.run();
            assert!(
                (test_bed.duct_demand_temperature()[1].get::<degree_celsius>() - 2.).abs() < 1.
            );
        }
    }

    mod pack_flow_controller_tests {
        use super::*;

        #[test]
        fn pack_flow_starts_at_zero() {
            let test_bed = test_bed();

            assert_eq!(
                test_bed.pack_flow(),
                MassRate::new::<kilogram_per_second>(0.)
            );
        }

        #[test]
        fn pack_flow_is_not_zero_when_conditions_are_met() {
            let test_bed = test_bed()
                .with()
                .both_packs_on()
                .and()
                .engine_idle()
                .iterate(2);

            assert!(test_bed.pack_flow() > MassRate::new::<kilogram_per_second>(0.));
        }

        #[test]
        fn pack_flow_increases_when_knob_on_hi_setting() {
            let mut test_bed = test_bed()
                .with()
                .both_packs_on()
                .and()
                .engine_idle()
                .and_run();

            test_bed.run_with_delta(Duration::from_secs(31));
            test_bed.run();
            let initial_flow = test_bed.pack_flow();

            test_bed.command_pack_flow_selector_position(2);
            test_bed.run();
            test_bed.run();

            assert!(test_bed.pack_flow() > initial_flow);
        }

        #[test]
        fn pack_flow_decreases_when_knob_on_lo_setting() {
            let mut test_bed = test_bed()
                .with()
                .both_packs_on()
                .and()
                .engine_idle()
                .and_run();

            test_bed.run_with_delta(Duration::from_secs(31));
            test_bed.run();
            let initial_flow = test_bed.pack_flow();

            test_bed.command_pack_flow_selector_position(0);
            test_bed.run();
            test_bed.run();

            assert!(test_bed.pack_flow() < initial_flow);
        }

        #[test]
        fn pack_flow_increases_when_opposite_engine_and_xbleed() {
            let mut test_bed = test_bed()
                .with()
                .both_packs_on()
                .and()
                .one_engine_on()
                .iterate(2);

            let initial_flow = test_bed.pack_flow();

            test_bed.command_crossbleed_on();
            test_bed.run();
            test_bed.run();

            assert!(test_bed.pack_flow() > initial_flow);
        }

        #[test]
        fn pack_flow_increases_if_apu_bleed_is_on() {
            let mut test_bed = test_bed()
                .with()
                .both_packs_on()
                .and()
                .engine_idle()
                .iterate(2);

            let initial_flow = test_bed.pack_flow();
            test_bed.command_apu_bleed_on();
            test_bed.run();

            assert!(test_bed.pack_flow() > initial_flow);
        }

        #[test]
        fn pack_flow_reduces_when_single_pack_operation() {
            let mut test_bed = test_bed()
                .with()
                .both_packs_on()
                .and()
                .engine_idle()
                .iterate(2);

            let initial_flow = test_bed.pack_flow();
            test_bed.command_pack_1_pb_position(true);
            test_bed.command_pack_2_pb_position(false);
            test_bed = test_bed.iterate(2);

            assert!(test_bed.pack_flow() < initial_flow);
        }

        #[test]
        fn pack_flow_reduces_when_in_takeoff() {
            let mut test_bed = test_bed()
                .on_ground()
                .with()
                .landing_gear_compressed()
                .and()
                .both_packs_on()
                .and()
                .engine_idle()
                .iterate(2);

            let initial_flow = test_bed.pack_flow();
            assert!(test_bed.ac_state_is_on_ground());

            test_bed = test_bed.engine_in_take_off();

            test_bed.run();

            assert!(test_bed.ac_state_is_begin_takeoff());

            test_bed.run();

            assert!(test_bed.pack_flow() < initial_flow);
        }

        #[test]
        fn pack_flow_stops_with_eng_mode_ign() {
            let mut test_bed = test_bed().with().both_packs_on();

            test_bed.command_crossbleed_on();
            test_bed.command_apu_bleed_on();
            test_bed = test_bed.iterate(2);

            assert!(test_bed.pack_flow() > MassRate::new::<kilogram_per_second>(0.));

            test_bed.command_eng_mode_selector(EngineModeSelector::Ignition);
            test_bed = test_bed.iterate(2);

            assert_eq!(
                test_bed.pack_flow(),
                MassRate::new::<kilogram_per_second>(0.)
            );
        }

        #[test]
        fn pack_flow_reduces_with_eng_mode_ign_crossbleed_shut() {
            let mut test_bed = test_bed().with().both_packs_on();

            test_bed.command_apu_bleed_on();
            test_bed = test_bed.iterate(2);

            let initial_pack_flow = test_bed.pack_flow();

            assert!(initial_pack_flow > MassRate::new::<kilogram_per_second>(0.));

            test_bed.command_eng_mode_selector(EngineModeSelector::Ignition);
            test_bed = test_bed.iterate(2);

            assert!(test_bed.pack_flow() < initial_pack_flow);
        }

        #[test]
        fn pack_flow_stops_when_engine_in_start_mode() {
            let mut test_bed = test_bed()
                .with()
                .both_packs_on()
                .and()
                .engine_idle()
                .iterate(2);

            test_bed.command_engine_in_start_mode();
            test_bed = test_bed.iterate(2);

            assert_eq!(
                test_bed.pack_flow(),
                MassRate::new::<kilogram_per_second>(0.)
            );
        }

        #[test]
        fn pack_flow_stops_when_engine_on_fire() {
            let mut test_bed = test_bed()
                .with()
                .both_packs_on()
                .and()
                .engine_idle()
                .iterate(2);

            test_bed.command_engine_on_fire();
            test_bed = test_bed.iterate(2);

            assert_eq!(
                test_bed.pack_flow(),
                MassRate::new::<kilogram_per_second>(0.)
            );
        }

        #[test]
        fn pack_flow_stops_when_ditching_on() {
            let mut test_bed = test_bed()
                .with()
                .both_packs_on()
                .and()
                .engine_idle()
                .iterate(2);

            test_bed.command_ditching_on();
            test_bed = test_bed.iterate(2);

            assert_eq!(
                test_bed.pack_flow(),
                MassRate::new::<kilogram_per_second>(0.)
            );
        }
    }
}
