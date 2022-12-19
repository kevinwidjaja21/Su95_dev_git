use uom::si::{
    angular_acceleration::radian_per_second_squared,
    angular_velocity::{radian_per_second, revolution_per_minute},
    f64::*,
    power::watt,
    pressure::psi,
    ratio::ratio,
    torque::{newton_meter, pound_force_inch},
    volume::{cubic_inch, gallon},
    volume_rate::{gallon_per_minute, gallon_per_second},
};

use crate::shared::{
    interpolation, low_pass_filter::LowPassFilter, pid::PidController, ControlValveCommand,
    EmergencyElectricalRatPushButton, EmergencyElectricalState, EmergencyGeneratorPower,
    HydraulicGeneratorControlUnit, LgciuWeightOnWheels, SectionPressure,
};

use crate::simulation::{
    InitContext, SimulationElement, SimulatorWriter, UpdateContext, VariableIdentifier, Write,
};

use std::time::Duration;

use super::linear_actuator::Actuator;

pub trait AngularSpeedSensor {
    fn speed(&self) -> AngularVelocity;
}

pub struct GeneratorControlUnit<const N: usize> {
    pid_controller: PidController,
    nominal_rpm: AngularVelocity,

    is_active: bool,
    max_allowed_power_rpm_breakpoints: [f64; N],
    max_allowed_power_vs_rpm: [f64; N],
    current_speed: AngularVelocity,

    manual_generator_on_was_pressed: bool,
}
impl<const N: usize> GeneratorControlUnit<N> {
    const NOMINAL_SPEED_MARGIN_RPM: f64 = 500.;
    const MIN_ACTIVATION_PRESSURE_PSI: f64 = 1000.;

    pub fn new(
        nominal_rpm: AngularVelocity,
        max_allowed_power_rpm_breakpoints: [f64; N],
        max_allowed_power_vs_rpm: [f64; N],
    ) -> Self {
        Self {
            pid_controller: PidController::new(
                0.003,
                0.01,
                0.,
                0.,
                1.,
                nominal_rpm.get::<revolution_per_minute>(),
                1.,
            ),

            nominal_rpm,
            is_active: false,
            max_allowed_power_rpm_breakpoints,
            max_allowed_power_vs_rpm,
            current_speed: AngularVelocity::new::<revolution_per_minute>(0.),
            manual_generator_on_was_pressed: false,
        }
    }

    fn update_active_state(
        &mut self,
        elec_emergency_state: &impl EmergencyElectricalState,
        rat_and_emer_gen_man_on: &impl EmergencyElectricalRatPushButton,
        lgciu: &impl LgciuWeightOnWheels,
        pressure_feedback: Pressure,
    ) {
        self.manual_generator_on_was_pressed =
            self.manual_generator_on_was_pressed || rat_and_emer_gen_man_on.is_pressed();

        self.is_active = elec_emergency_state.is_in_emergency_elec()
            || (self.manual_generator_on_was_pressed
                && !lgciu.left_and_right_gear_compressed(false)
                && pressure_feedback.get::<psi>() > Self::MIN_ACTIVATION_PRESSURE_PSI);
    }

    pub fn update(
        &mut self,
        context: &UpdateContext,
        generator_feedback: &impl AngularSpeedSensor,
        pressure_feedback: &impl SectionPressure,
        elec_emergency_state: &impl EmergencyElectricalState,
        rat_and_emer_gen_man_on: &impl EmergencyElectricalRatPushButton,
        lgciu: &impl LgciuWeightOnWheels,
    ) {
        self.current_speed = generator_feedback.speed();

        self.update_active_state(
            elec_emergency_state,
            rat_and_emer_gen_man_on,
            lgciu,
            pressure_feedback.pressure(),
        );

        self.update_valve_control(context);
    }

    fn max_allowed_power(&self) -> Power {
        if self.is_active {
            Power::new::<watt>(interpolation(
                &self.max_allowed_power_rpm_breakpoints,
                &self.max_allowed_power_vs_rpm,
                self.current_speed.get::<revolution_per_minute>(),
            ))
        } else {
            Power::new::<watt>(0.)
        }
    }

    fn update_valve_control(&mut self, context: &UpdateContext) {
        if self.is_active {
            self.pid_controller.next_control_output(
                self.current_speed.get::<revolution_per_minute>(),
                Some(context.delta()),
            );
        } else {
            self.pid_controller.reset();
        }
    }

    pub fn is_at_nominal_speed(&self) -> bool {
        (self.nominal_rpm - self.current_speed)
            .abs()
            .get::<revolution_per_minute>()
            <= Self::NOMINAL_SPEED_MARGIN_RPM
    }
}
impl<const N: usize> HydraulicGeneratorControlUnit for GeneratorControlUnit<N> {
    fn max_allowed_power(&self) -> Power {
        self.max_allowed_power()
    }

    fn motor_speed(&self) -> AngularVelocity {
        self.current_speed
    }
}
impl<const N: usize> ControlValveCommand for GeneratorControlUnit<N> {
    fn valve_position_command(&self) -> Ratio {
        Ratio::new::<ratio>(self.pid_controller.output())
    }
}

pub struct HydraulicGeneratorMotor {
    generator_rpm_id: VariableIdentifier,

    speed: AngularVelocity,

    displacement: Volume,
    virtual_displacement: Volume,
    current_flow: VolumeRate,

    valve: MeteringValve,

    total_volume_to_actuator: Volume,
    total_volume_to_reservoir: Volume,
}
impl HydraulicGeneratorMotor {
    const MOTOR_INERTIA: f64 = 0.01;
    const STATIC_RESISTANT_TORQUE_WHEN_UNPOWERED_NM: f64 = 2.;
    const DYNAMIC_FRICTION_TORQUE_CONSTANT: f64 = 0.00018;
    const EFFICIENCY: f64 = 0.95;
    const FLOW_CONSTANT_RPM_CUBIC_INCH_TO_GPM: f64 = 231.;

    pub fn new(context: &mut InitContext, displacement: Volume) -> Self {
        Self {
            generator_rpm_id: context.get_identifier("HYD_EMERGENCY_GEN_RPM".to_owned()),

            speed: AngularVelocity::new::<radian_per_second>(0.),

            displacement,
            virtual_displacement: Volume::new::<gallon>(0.),
            current_flow: VolumeRate::new::<gallon_per_second>(0.),

            valve: MeteringValve::new(),

            total_volume_to_actuator: Volume::new::<gallon>(0.),
            total_volume_to_reservoir: Volume::new::<gallon>(0.),
        }
    }

    pub fn speed(&self) -> AngularVelocity {
        self.speed
    }

    pub fn update(
        &mut self,
        context: &UpdateContext,
        section_pressure: &impl SectionPressure,
        gcu: &impl ControlValveCommand,
        emergency_generator: &impl EmergencyGeneratorPower,
    ) {
        self.update_valve_position(context, gcu);
        self.update_virtual_displacement();
        self.update_speed(context, emergency_generator, section_pressure.pressure());
        self.update_flow(context);
    }

    fn update_valve_position(
        &mut self,
        context: &UpdateContext,
        gcu_interface: &impl ControlValveCommand,
    ) {
        self.valve
            .update(context, gcu_interface.valve_position_command());
    }

    fn resistant_torque(&mut self, emergency_generator: &impl EmergencyGeneratorPower) -> Torque {
        if self.speed().get::<radian_per_second>() < 1.
            || self.virtual_displacement < Volume::new::<cubic_inch>(0.001)
        {
            -Torque::new::<newton_meter>(Self::STATIC_RESISTANT_TORQUE_WHEN_UNPOWERED_NM)
        } else {
            let theoretical_torque = Torque::new::<newton_meter>(
                emergency_generator.generated_power().get::<watt>()
                    / self.speed().get::<radian_per_second>(),
            );
            -(theoretical_torque + (1. - Self::EFFICIENCY) * theoretical_torque)
        }
    }

    fn friction_torque(&self) -> Torque {
        Torque::new::<newton_meter>(
            Self::DYNAMIC_FRICTION_TORQUE_CONSTANT * -self.speed.get::<revolution_per_minute>(),
        )
    }

    fn generated_torque(&self, pressure: Pressure) -> Torque {
        Torque::new::<pound_force_inch>(
            pressure.get::<psi>() * self.virtual_displacement.get::<cubic_inch>()
                / (2. * std::f64::consts::PI),
        )
    }

    fn update_virtual_displacement(&mut self) {
        self.virtual_displacement = self.virtual_displacement_after_valve_inlet();
    }

    fn virtual_displacement_after_valve_inlet(&mut self) -> Volume {
        self.displacement * self.valve.position()
    }

    fn update_speed(
        &mut self,
        context: &UpdateContext,
        emergency_generator: &impl EmergencyGeneratorPower,
        pressure: Pressure,
    ) {
        let mut total_torque: Torque;
        total_torque = self.resistant_torque(emergency_generator);
        total_torque += self.friction_torque();
        total_torque += self.generated_torque(pressure);

        let acceleration = AngularAcceleration::new::<radian_per_second_squared>(
            total_torque.get::<newton_meter>() / Self::MOTOR_INERTIA,
        );
        self.speed += AngularVelocity::new::<radian_per_second>(
            acceleration.get::<radian_per_second_squared>() * context.delta_as_secs_f64(),
        );
        self.speed = self
            .speed
            .max(AngularVelocity::new::<revolution_per_minute>(0.));
    }

    fn update_flow(&mut self, context: &UpdateContext) {
        self.current_flow = self.flow();

        let total_volume = self.current_flow * context.delta_as_time();
        self.total_volume_to_actuator += total_volume;
        self.total_volume_to_reservoir = self.total_volume_to_actuator;
    }

    fn flow(&self) -> VolumeRate {
        VolumeRate::new::<gallon_per_minute>(
            self.speed.get::<revolution_per_minute>()
                * self.virtual_displacement.get::<cubic_inch>()
                / Self::FLOW_CONSTANT_RPM_CUBIC_INCH_TO_GPM,
        )
    }
}
impl Actuator for HydraulicGeneratorMotor {
    fn used_volume(&self) -> Volume {
        self.total_volume_to_actuator
    }

    fn reservoir_return(&self) -> Volume {
        self.total_volume_to_reservoir
    }

    fn reset_volumes(&mut self) {
        self.total_volume_to_reservoir = Volume::new::<gallon>(0.);
        self.total_volume_to_actuator = Volume::new::<gallon>(0.);
    }
}
impl SimulationElement for HydraulicGeneratorMotor {
    fn write(&self, writer: &mut SimulatorWriter) {
        writer.write(&self.generator_rpm_id, self.speed());
    }
}
impl AngularSpeedSensor for HydraulicGeneratorMotor {
    fn speed(&self) -> AngularVelocity {
        self.speed()
    }
}

struct MeteringValve {
    position: LowPassFilter<Ratio>,
}
impl MeteringValve {
    const POSITION_RESPONSE_TIME_CONSTANT: Duration = Duration::from_millis(50);

    fn new() -> Self {
        Self {
            position: LowPassFilter::<Ratio>::new(Self::POSITION_RESPONSE_TIME_CONSTANT),
        }
    }

    fn update(&mut self, context: &UpdateContext, commanded_position: Ratio) {
        self.position.update(context.delta(), commanded_position);
    }

    fn position(&self) -> Ratio {
        self.position.output()
    }
}

#[derive(Default)]
pub struct TestGenerator {
    speed: AngularVelocity,
    generated_power: Power,
}
impl TestGenerator {
    #[cfg(test)]
    fn from_gcu(gcu: &impl HydraulicGeneratorControlUnit) -> Self {
        let mut g = TestGenerator {
            speed: gcu.motor_speed(),
            generated_power: Power::new::<watt>(0.),
        };

        g.update(gcu);
        g
    }

    pub fn update(&mut self, gcu: &impl HydraulicGeneratorControlUnit) {
        self.speed = gcu.motor_speed();
        self.generated_power = gcu.max_allowed_power();
    }
}
impl EmergencyGeneratorPower for TestGenerator {
    fn generated_power(&self) -> Power {
        self.generated_power
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::update_iterator::FixedStepLoop;
    use crate::simulation::test::{SimulationTestBed, TestBed};
    use crate::simulation::{Aircraft, SimulationElement, SimulationElementVisitor};
    use std::time::Duration;

    struct TestEmergencyState {
        is_emergency: bool,
    }
    impl TestEmergencyState {
        fn not_in_emergency() -> Self {
            Self {
                is_emergency: false,
            }
        }

        fn set_in_emergency(&mut self, state: bool) {
            self.is_emergency = state;
        }
    }
    impl EmergencyElectricalState for TestEmergencyState {
        fn is_in_emergency_elec(&self) -> bool {
            self.is_emergency
        }
    }

    struct TestRatManOn {
        is_pressed: bool,
    }
    impl TestRatManOn {
        fn not_pressed() -> Self {
            Self { is_pressed: false }
        }

        fn press(&mut self) {
            self.is_pressed = true;
        }
    }
    impl EmergencyElectricalRatPushButton for TestRatManOn {
        fn is_pressed(&self) -> bool {
            self.is_pressed
        }
    }

    struct TestHydraulicSection {
        pressure: Pressure,
    }
    impl TestHydraulicSection {
        fn new(pressure: Pressure) -> Self {
            Self { pressure }
        }

        fn set_pressure(&mut self, pressure: Pressure) {
            self.pressure = pressure;
        }
    }
    impl SectionPressure for TestHydraulicSection {
        fn pressure(&self) -> Pressure {
            self.pressure
        }

        fn pressure_downstream_leak_valve(&self) -> Pressure {
            self.pressure
        }

        fn is_pressure_switch_pressurised(&self) -> bool {
            self.pressure.get::<psi>() > 1700.
        }
    }

    struct TestLgciuSensors {
        main_gear_compressed: bool,
    }
    impl TestLgciuSensors {
        fn compressed() -> Self {
            Self {
                main_gear_compressed: true,
            }
        }

        fn set_compressed(&mut self, is_compressed: bool) {
            self.main_gear_compressed = is_compressed;
        }
    }
    impl LgciuWeightOnWheels for TestLgciuSensors {
        fn right_gear_compressed(&self, _: bool) -> bool {
            self.main_gear_compressed
        }
        fn right_gear_extended(&self, _: bool) -> bool {
            !self.main_gear_compressed
        }

        fn left_gear_compressed(&self, _: bool) -> bool {
            self.main_gear_compressed
        }
        fn left_gear_extended(&self, _: bool) -> bool {
            !self.main_gear_compressed
        }

        fn left_and_right_gear_compressed(&self, _: bool) -> bool {
            self.main_gear_compressed
        }
        fn left_and_right_gear_extended(&self, _: bool) -> bool {
            !self.main_gear_compressed
        }

        fn nose_gear_compressed(&self, _: bool) -> bool {
            self.main_gear_compressed
        }
        fn nose_gear_extended(&self, _: bool) -> bool {
            !self.main_gear_compressed
        }
    }

    struct TestAircraft {
        updater_fixed_step: FixedStepLoop,

        gcu: GeneratorControlUnit<9>,
        lgciu: TestLgciuSensors,
        rat_man_on: TestRatManOn,
        emergency_state: TestEmergencyState,
        current_pressure: TestHydraulicSection,

        emergency_gen: HydraulicGeneratorMotor,
    }
    impl TestAircraft {
        fn new(context: &mut InitContext) -> Self {
            Self {
                updater_fixed_step: FixedStepLoop::new(Duration::from_millis(33)),
                gcu: gen_control_unit(),
                lgciu: TestLgciuSensors::compressed(),
                rat_man_on: TestRatManOn::not_pressed(),
                emergency_state: TestEmergencyState::not_in_emergency(),

                current_pressure: TestHydraulicSection::new(Pressure::new::<psi>(2500.)),

                emergency_gen: HydraulicGeneratorMotor::new(
                    context,
                    Volume::new::<cubic_inch>(0.19),
                ),
            }
        }

        fn rat_man_on_pressed(&mut self) {
            self.rat_man_on.press();
        }

        fn set_in_emergency(&mut self, state: bool) {
            self.emergency_state.set_in_emergency(state);
        }

        fn set_gear_compressed(&mut self, state: bool) {
            self.lgciu.set_compressed(state);
        }

        fn set_hyd_pressure(&mut self, pressure: Pressure) {
            self.current_pressure.set_pressure(pressure)
        }
    }
    impl Aircraft for TestAircraft {
        fn update_after_power_distribution(&mut self, context: &UpdateContext) {
            self.updater_fixed_step.update(context);

            for cur_time_step in &mut self.updater_fixed_step {
                self.gcu.update(
                    &context.with_delta(cur_time_step),
                    &self.emergency_gen,
                    &self.current_pressure,
                    &self.emergency_state,
                    &self.rat_man_on,
                    &self.lgciu,
                );

                self.emergency_gen.update(
                    &context.with_delta(cur_time_step),
                    &self.current_pressure,
                    &self.gcu,
                    &TestGenerator::from_gcu(&self.gcu),
                );
            }
        }
    }
    impl SimulationElement for TestAircraft {
        fn accept<V: SimulationElementVisitor>(&mut self, visitor: &mut V) {
            self.emergency_gen.accept(visitor);

            visitor.visit(self);
        }
    }

    #[test]
    fn emergency_generator_init_state() {
        let mut test_bed = SimulationTestBed::new(TestAircraft::new);

        test_bed.run();

        assert!(test_bed.query(|a| {
            a.emergency_gen.speed() == AngularVelocity::new::<radian_per_second>(0.)
        }));

        assert!(test_bed.query(|a| a.gcu.valve_position_command() == Ratio::new::<ratio>(0.)));
    }

    #[test]
    fn rat_man_on_on_ground_should_not_run_generator() {
        let mut test_bed = SimulationTestBed::new(TestAircraft::new);

        test_bed.command(|a| a.set_gear_compressed(true));
        test_bed.command(|a| a.rat_man_on_pressed());

        test_bed.run_with_delta(Duration::from_secs_f64(0.5));

        assert!(test_bed.query(|a| {
            a.emergency_gen.speed() == AngularVelocity::new::<revolution_per_minute>(0.)
        }));
    }

    #[test]
    fn rat_man_on_in_flight_should_run_generator() {
        let mut test_bed = SimulationTestBed::new(TestAircraft::new);

        test_bed.command(|a| a.set_gear_compressed(false));
        test_bed.command(|a| a.rat_man_on_pressed());

        test_bed.run_with_delta(Duration::from_secs_f64(0.5));

        assert!(test_bed.query(|a| {
            a.emergency_gen.speed() >= AngularVelocity::new::<revolution_per_minute>(100.)
        }));
    }

    #[test]
    fn emergency_generator_in_emergency_state_should_start_spining_with_pressure() {
        let mut test_bed = SimulationTestBed::new(TestAircraft::new);

        test_bed.run_with_delta(Duration::from_secs_f64(0.5));

        assert!(test_bed.query(|a| {
            a.emergency_gen.speed() == AngularVelocity::new::<revolution_per_minute>(0.)
        }));

        test_bed.command(|a| a.set_in_emergency(true));

        test_bed.run_with_delta(Duration::from_secs_f64(0.5));

        assert!(test_bed.query(|a| {
            a.emergency_gen.speed() >= AngularVelocity::new::<revolution_per_minute>(100.)
        }));
    }

    #[test]
    fn emergency_generator_in_emergency_state_should_not_start_spining_without_pressure() {
        let mut test_bed = SimulationTestBed::new(TestAircraft::new);

        test_bed.command(|a| a.set_hyd_pressure(Pressure::new::<psi>(0.)));
        test_bed.command(|a| a.set_in_emergency(true));

        test_bed.run_with_delta(Duration::from_secs_f64(0.5));

        assert!(test_bed.query(|a| {
            a.emergency_gen.speed() == AngularVelocity::new::<revolution_per_minute>(0.)
        }));
    }

    #[test]
    fn emergency_generator_in_emergency_state_regulates_speed() {
        let mut test_bed = SimulationTestBed::new(TestAircraft::new);

        test_bed.command(|a| a.set_in_emergency(true));

        test_bed.run_with_delta(Duration::from_secs_f64(5.));

        for _ in 0..10 {
            assert!(test_bed.query(|a| {
                a.emergency_gen.speed() >= AngularVelocity::new::<revolution_per_minute>(11950.)
            }));

            assert!(test_bed.query(|a| {
                a.emergency_gen.speed() <= AngularVelocity::new::<revolution_per_minute>(12050.)
            }));

            test_bed.run_with_delta(Duration::from_secs_f64(0.5));
        }
    }

    #[test]
    fn emergency_generator_in_emergency_state_reaches_nominal_less_5s() {
        let mut test_bed = SimulationTestBed::new(TestAircraft::new);

        test_bed.command(|a| a.set_in_emergency(true));

        test_bed.run_with_delta(Duration::from_secs_f64(5.));

        assert!(test_bed.query(|a| {
            a.emergency_gen.speed() >= AngularVelocity::new::<revolution_per_minute>(11900.)
        }));

        assert!(test_bed.query(|a| {
            a.emergency_gen.speed() <= AngularVelocity::new::<revolution_per_minute>(12100.)
        }));
    }

    #[test]
    fn emergency_generator_stops_in_less_than_5_seconds() {
        let mut test_bed = SimulationTestBed::new(TestAircraft::new);

        test_bed.command(|a| a.set_in_emergency(true));

        test_bed.run_with_delta(Duration::from_secs_f64(15.));

        assert!(test_bed.query(|a| {
            a.emergency_gen.speed() >= AngularVelocity::new::<revolution_per_minute>(11000.)
        }));

        test_bed.command(|a| a.set_in_emergency(false));

        test_bed.run_with_delta(Duration::from_secs_f64(5.));

        assert!(test_bed.query(|a| {
            a.emergency_gen.speed() <= AngularVelocity::new::<revolution_per_minute>(5.)
        }));
    }

    #[cfg(test)]
    fn gen_control_unit() -> GeneratorControlUnit<9> {
        GeneratorControlUnit::new(
            AngularVelocity::new::<revolution_per_minute>(12000.),
            [
                0., 1000., 6000., 9999., 10000., 12000., 14000., 14001., 30000.,
            ],
            [0., 0., 0., 0., 1000., 6000., 1000., 0., 0.],
        )
    }
}
