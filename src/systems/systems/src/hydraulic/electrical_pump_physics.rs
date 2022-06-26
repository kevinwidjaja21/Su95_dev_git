use uom::si::{
    angular_acceleration::radian_per_second_squared,
    angular_velocity::{radian_per_second, revolution_per_minute},
    electric_current::ampere,
    electric_potential::volt,
    f64::*,
    power::watt,
    pressure::psi,
    torque::{newton_meter, pound_force_inch},
    volume::cubic_inch,
};

use crate::hydraulic::SectionPressure;
use crate::shared::{
    low_pass_filter::LowPassFilter, pid::PidController, ConsumePower, ElectricalBusType,
    ElectricalBuses,
};
use crate::simulation::{
    InitContext, SimulationElement, SimulatorWriter, UpdateContext, VariableIdentifier, Write,
};

use std::time::Duration;

pub(super) struct ElectricalPumpPhysics {
    active_id: VariableIdentifier,
    rpm_id: VariableIdentifier,
    powered_by: ElectricalBusType,
    is_powered: bool,
    available_potential: ElectricPotential,
    consumed_power: Power,

    acceleration: AngularAcceleration,
    speed_raw: AngularVelocity,
    speed_filtered: LowPassFilter<AngularVelocity>,
    inertia: f64,
    is_active: bool,

    output_current: ElectricCurrent,

    generated_torque: Torque,
    resistant_torque: Torque,

    current_controller: PidController,

    displacement_filtered: LowPassFilter<Volume>,
}
impl ElectricalPumpPhysics {
    const DEFAULT_INERTIA: f64 = 0.011;
    const DEFAULT_DYNAMIC_FRICTION_CONSTANT: f64 = 0.00004;
    const DEFAULT_RESISTANT_TORQUE_WHEN_OFF_NEWTON_METER: f64 = 2.8;
    const BACKPRESSURE_PRELOAD_PSI: f64 = 200.;

    const SPEED_DISPLACEMENT_FILTER_TIME_CONSTANT: Duration = Duration::from_millis(50);
    const MIN_FILTERING_RPM: f64 = 100.;

    // Efficiency gives generated mechanical torque ratio vs electrical power used.
    // 0.95 will convert 95% of electrical consumption in mechanical torque
    const ELECTRICAL_EFFICIENCY: f64 = 0.95;

    const DEFAULT_P_GAIN: f64 = 0.1;
    const DEFAULT_I_GAIN: f64 = 0.45;

    pub fn new(
        context: &mut InitContext,
        id: &str,
        bus_type: ElectricalBusType,
        max_current: ElectricCurrent,
        regulated_speed: AngularVelocity,
    ) -> Self {
        Self {
            active_id: context.get_identifier(format!("HYD_{}_EPUMP_ACTIVE", id)),
            rpm_id: context.get_identifier(format!("HYD_{}_EPUMP_RPM", id)),
            powered_by: bus_type,
            is_powered: false,
            available_potential: ElectricPotential::new::<volt>(0.),
            consumed_power: Power::new::<watt>(0.),

            acceleration: AngularAcceleration::new::<radian_per_second_squared>(0.),
            speed_raw: AngularVelocity::new::<radian_per_second>(0.),
            speed_filtered: LowPassFilter::<AngularVelocity>::new(
                Self::SPEED_DISPLACEMENT_FILTER_TIME_CONSTANT,
            ),
            inertia: Self::DEFAULT_INERTIA,
            is_active: false,
            output_current: ElectricCurrent::new::<ampere>(0.),
            generated_torque: Torque::new::<newton_meter>(0.),
            resistant_torque: Torque::new::<newton_meter>(0.),
            current_controller: PidController::new(
                Self::DEFAULT_P_GAIN,
                Self::DEFAULT_I_GAIN,
                0.,
                0.,
                max_current.get::<ampere>(),
                regulated_speed.get::<revolution_per_minute>(),
                1.,
            ),
            displacement_filtered: LowPassFilter::<Volume>::new(
                Self::SPEED_DISPLACEMENT_FILTER_TIME_CONSTANT,
            ),
        }
    }

    pub fn update(
        &mut self,
        context: &UpdateContext,
        section: &impl SectionPressure,
        current_displacement: Volume,
    ) {
        self.displacement_filtered
            .update(context.delta(), current_displacement);

        self.update_pump_resistant_torque(section);

        self.update_pump_generated_torque(context);

        self.update_pump_speed(context);
    }

    fn update_pump_speed(&mut self, context: &UpdateContext) {
        let final_torque = self.generated_torque - self.resistant_torque;

        self.acceleration = AngularAcceleration::new::<radian_per_second_squared>(
            final_torque.get::<newton_meter>() / self.inertia,
        );
        self.speed_raw += AngularVelocity::new::<radian_per_second>(
            self.acceleration.get::<radian_per_second_squared>() * context.delta_as_secs_f64(),
        );
        self.speed_raw = self
            .speed_raw
            .max(AngularVelocity::new::<radian_per_second>(0.));

        if self.speed_raw.get::<revolution_per_minute>() > Self::MIN_FILTERING_RPM {
            self.speed_filtered.update(context.delta(), self.speed_raw);
        } else {
            self.speed_filtered.reset(AngularVelocity::default());
        }
    }

    fn update_pump_resistant_torque(&mut self, section: &impl SectionPressure) {
        let dynamic_friction_torque = Torque::new::<newton_meter>(
            Self::DEFAULT_DYNAMIC_FRICTION_CONSTANT
                * self.speed_filtered.output().get::<revolution_per_minute>(),
        );

        let pumping_torque = if self.is_active && self.is_powered {
            Torque::new::<pound_force_inch>(
                section
                    .pressure()
                    .get::<psi>()
                    .max(Self::BACKPRESSURE_PRELOAD_PSI)
                    * self.displacement_filtered.output().get::<cubic_inch>()
                    / (2. * std::f64::consts::PI),
            )
        } else {
            Torque::new::<newton_meter>(Self::DEFAULT_RESISTANT_TORQUE_WHEN_OFF_NEWTON_METER)
        };

        self.resistant_torque = pumping_torque + dynamic_friction_torque;
    }

    fn update_current_control(&mut self, context: &UpdateContext) {
        self.output_current = if self.pump_should_run() {
            ElectricCurrent::new::<ampere>(self.current_controller.next_control_output(
                self.speed_raw.get::<revolution_per_minute>(),
                Some(context.delta()),
            ))
        } else {
            self.current_controller.reset();
            ElectricCurrent::new::<ampere>(0.)
        }
    }

    fn update_electrical_power_consumption(&mut self) {
        self.consumed_power = if self.pump_should_run() {
            Power::new::<watt>(
                self.available_potential.get::<volt>()
                    * self.output_current.get::<ampere>()
                    * (3_f64).sqrt(),
            )
        } else {
            Power::new::<watt>(0.)
        };
    }

    fn update_pump_generated_torque(&mut self, context: &UpdateContext) {
        self.update_current_control(context);

        self.update_electrical_power_consumption();

        if self.pump_should_run() {
            if self.speed_raw.get::<revolution_per_minute>() < 5.
                && self.output_current.get::<ampere>() > 0.
            {
                self.generated_torque =
                    Torque::new::<newton_meter>(0.5 * self.output_current.get::<ampere>());
            } else {
                self.generated_torque = Torque::new::<newton_meter>(
                    Self::ELECTRICAL_EFFICIENCY * self.consumed_power.get::<watt>()
                        / self.speed_raw.get::<radian_per_second>(),
                );
            }
        } else {
            self.generated_torque = Torque::new::<newton_meter>(0.);
        }
    }

    fn pump_should_run(&self) -> bool {
        self.is_active && self.is_powered
    }

    pub fn set_active(&mut self, is_active: bool) {
        self.is_active = is_active;
    }

    pub fn speed(&self) -> AngularVelocity {
        self.speed_filtered.output()
    }
}
impl SimulationElement for ElectricalPumpPhysics {
    fn write(&self, writer: &mut SimulatorWriter) {
        writer.write(&self.active_id, self.is_active);
        writer.write(&self.rpm_id, self.speed());
    }

    fn receive_power(&mut self, buses: &impl ElectricalBuses) {
        self.is_powered = buses.is_powered(self.powered_by);
        self.available_potential = buses.potential_of(self.powered_by).raw();
    }

    fn consume_power<T: ConsumePower>(&mut self, _: &UpdateContext, consumption: &mut T) {
        consumption.consume_from_bus(self.powered_by, self.consumed_power);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::electrical::test::TestElectricitySource;
    use crate::electrical::ElectricalBus;
    use crate::electrical::Electricity;

    use crate::shared::{update_iterator::FixedStepLoop, PotentialOrigin};
    use crate::simulation::{Aircraft, SimulationElement, SimulationElementVisitor, UpdateContext};

    use crate::simulation::test::{SimulationTestBed, TestBed};
    use std::time::Duration;
    use uom::si::{pressure::psi, volume::gallon};

    #[derive(Default)]
    struct TestHydraulicSection {
        pressure: Pressure,
    }
    impl TestHydraulicSection {
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

    struct TestAircraft {
        core_hydraulic_updater: FixedStepLoop,

        pump: ElectricalPumpPhysics,
        hydraulic_section: TestHydraulicSection,
        current_displacement: Volume,

        powered_source_ac: TestElectricitySource,
        ac_1_bus: ElectricalBus,
        is_ac_1_powered: bool,
    }
    impl TestAircraft {
        fn new(context: &mut InitContext) -> Self {
            Self {
                core_hydraulic_updater: FixedStepLoop::new(Duration::from_millis(33)),
                pump: physical_pump(context),
                hydraulic_section: TestHydraulicSection::default(),
                current_displacement: Volume::new::<gallon>(0.),
                powered_source_ac: TestElectricitySource::powered(
                    context,
                    PotentialOrigin::EngineGenerator(1),
                ),
                ac_1_bus: ElectricalBus::new(context, ElectricalBusType::AlternatingCurrent(1)),
                is_ac_1_powered: false,
            }
        }

        fn set_current_pressure(&mut self, current_pressure: Pressure) {
            self.hydraulic_section.set_pressure(current_pressure);
        }

        fn set_current_displacement(&mut self, current_displacement: Volume) {
            self.current_displacement = current_displacement;
        }

        fn set_ac_1_power(&mut self, is_powered: bool) {
            self.is_ac_1_powered = is_powered;
        }
    }
    impl Aircraft for TestAircraft {
        fn update_before_power_distribution(
            &mut self,
            _: &UpdateContext,
            electricity: &mut Electricity,
        ) {
            self.powered_source_ac
                .power_with_potential(ElectricPotential::new::<volt>(115.));
            electricity.supplied_by(&self.powered_source_ac);

            if self.is_ac_1_powered {
                electricity.flow(&self.powered_source_ac, &self.ac_1_bus);
            }
        }

        fn update_after_power_distribution(&mut self, context: &UpdateContext) {
            self.core_hydraulic_updater.update(context);

            for cur_time_step in &mut self.core_hydraulic_updater {
                self.pump.update(
                    &context.with_delta(cur_time_step),
                    &self.hydraulic_section,
                    self.current_displacement,
                );
            }
        }
    }
    impl SimulationElement for TestAircraft {
        fn accept<T: SimulationElementVisitor>(&mut self, visitor: &mut T) {
            self.pump.accept(visitor);

            visitor.visit(self);
        }
    }

    #[test]
    fn pump_inactive_at_init() {
        let test_bed = SimulationTestBed::new(TestAircraft::new);

        assert_eq!(
            test_bed.query(|a| a.pump.speed()),
            AngularVelocity::new::<revolution_per_minute>(0.)
        );

        assert!(!test_bed.query(|a| a.pump.is_active));
    }

    #[test]
    fn pump_spools_up_less_than_half_second_at_half_displacement() {
        let mut test_bed = SimulationTestBed::new(TestAircraft::new);

        test_bed.command(|a| a.set_ac_1_power(true));
        test_bed.command(|a| a.pump.set_active(true));
        test_bed.command(|a| a.set_current_displacement(Volume::new::<cubic_inch>(0.131)));
        test_bed.command(|a| a.set_current_pressure(Pressure::new::<psi>(3000.)));

        test_bed.run_with_delta(Duration::from_secs_f64(0.5));

        assert!(
            test_bed.query(|a| a.pump.speed())
                >= AngularVelocity::new::<revolution_per_minute>(6500.)
        );
    }

    #[test]
    fn pump_regulates_on_displacement_gradient() {
        let mut test_bed = SimulationTestBed::new(TestAircraft::new);

        test_bed.command(|a| a.set_ac_1_power(true));
        test_bed.command(|a| a.pump.set_active(true));
        test_bed.command(|a| a.set_current_displacement(Volume::new::<cubic_inch>(0.263 / 4.)));
        test_bed.command(|a| a.set_current_pressure(Pressure::new::<psi>(3000.)));

        test_bed.run_with_delta(Duration::from_secs_f64(1.));

        assert!(
            test_bed.query(|a| a.pump.speed())
                >= AngularVelocity::new::<revolution_per_minute>(7500.)
        );

        // Instant demand at full displacement
        test_bed.command(|a| a.set_current_displacement(Volume::new::<cubic_inch>(0.263)));

        test_bed.run_with_delta(Duration::from_secs_f64(0.5));
        assert!(
            test_bed.query(|a| a.pump.speed())
                < AngularVelocity::new::<revolution_per_minute>(7000.)
        );

        // Back to 1/4 displacement
        test_bed.command(|a| a.set_current_displacement(Volume::new::<cubic_inch>(0.263 / 4.)));

        test_bed.run_with_delta(Duration::from_secs_f64(0.5));
        assert!(
            test_bed.query(|a| a.pump.speed())
                >= AngularVelocity::new::<revolution_per_minute>(7300.)
        );

        // Checking we don't overshoot the 7600rpm target by more than 100rpm
        assert!(
            test_bed.query(|a| a.pump.speed())
                < AngularVelocity::new::<revolution_per_minute>(7700.)
        );
    }

    #[test]
    fn pump_spools_down_less_than_three_second_when_unpowered_with_no_displacement() {
        let mut test_bed = SimulationTestBed::new(TestAircraft::new);

        test_bed.command(|a| a.set_ac_1_power(true));
        test_bed.command(|a| a.pump.set_active(true));
        test_bed.command(|a| a.set_current_displacement(Volume::new::<cubic_inch>(0.)));
        test_bed.command(|a| a.set_current_pressure(Pressure::new::<psi>(3000.)));

        test_bed.run_with_delta(Duration::from_secs_f64(1.));

        assert!(
            test_bed.query(|a| a.pump.speed())
                >= AngularVelocity::new::<revolution_per_minute>(7000.)
        );

        test_bed.command(|a| a.set_ac_1_power(false));
        test_bed.run_with_delta(Duration::from_secs_f64(3.));

        assert!(
            test_bed.query(|a| a.pump.speed()) < AngularVelocity::new::<revolution_per_minute>(10.)
        );
    }

    fn physical_pump(context: &mut InitContext) -> ElectricalPumpPhysics {
        ElectricalPumpPhysics::new(
            context,
            "YELLOW",
            ElectricalBusType::AlternatingCurrent(1),
            ElectricCurrent::new::<ampere>(45.),
            AngularVelocity::new::<revolution_per_minute>(7600.),
        )
    }
}
