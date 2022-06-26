use crate::simulation::{InitContext, SimulationElement, SimulatorWriter, UpdateContext};

use super::{
    ElectricalElement, ElectricalElementIdentifier, ElectricalElementIdentifierProvider,
    ElectricalStateWriter, ElectricitySource, Potential, PotentialOrigin, ProvideFrequency,
    ProvidePotential,
};
use crate::shared::{
    EmergencyGeneratorPower, HydraulicGeneratorControlUnit, PowerConsumptionReport,
};
use uom::si::{
    angular_velocity::revolution_per_minute, electric_potential::volt, f64::*, frequency::hertz,
    power::watt,
};

pub struct EmergencyGenerator {
    identifier: ElectricalElementIdentifier,
    writer: ElectricalStateWriter,
    supplying: bool,
    output_frequency: Frequency,
    output_potential: ElectricPotential,
    generated_power: Power,
    demand: Power,
}
impl EmergencyGenerator {
    const MIN_RPM_TO_SUPPLY_POWER: f64 = 10000.;
    const MIN_POWER_TO_DECLARE_SUPPLYING_WATT: f64 = 100.;

    pub fn new(context: &mut InitContext) -> EmergencyGenerator {
        EmergencyGenerator {
            identifier: context.next_electrical_identifier(),
            writer: ElectricalStateWriter::new(context, "EMER_GEN"),
            supplying: false,
            output_frequency: Frequency::new::<hertz>(0.),
            output_potential: ElectricPotential::new::<volt>(0.),
            generated_power: Power::new::<watt>(0.),
            demand: Power::new::<watt>(0.),
        }
    }

    pub fn update(&mut self, gcu: &impl HydraulicGeneratorControlUnit) {
        self.update_generated_power(gcu);

        self.supplying = self.generated_power
            > Power::new::<watt>(Self::MIN_POWER_TO_DECLARE_SUPPLYING_WATT)
            || (gcu.motor_speed()
                > AngularVelocity::new::<revolution_per_minute>(Self::MIN_RPM_TO_SUPPLY_POWER));
    }

    /// Indicates if the provided electricity's potential and frequency
    /// are within normal parameters. Use this to decide if the
    /// generator contactor should close.
    pub fn output_within_normal_parameters(&self) -> bool {
        self.should_provide_output() && self.frequency_normal() && self.potential_normal()
    }

    fn should_provide_output(&self) -> bool {
        self.supplying
    }

    fn update_generated_power(&mut self, gcu: &impl HydraulicGeneratorControlUnit) {
        self.generated_power =
            if gcu.motor_speed().get::<revolution_per_minute>() > Self::MIN_RPM_TO_SUPPLY_POWER {
                self.demand.min(gcu.max_allowed_power())
            } else {
                Power::new::<watt>(0.)
            };
    }
}
provide_frequency!(EmergencyGenerator, (390.0..=410.0));
provide_potential!(EmergencyGenerator, (110.0..=120.0));
impl ElectricalElement for EmergencyGenerator {
    fn input_identifier(&self) -> ElectricalElementIdentifier {
        self.identifier
    }

    fn output_identifier(&self) -> ElectricalElementIdentifier {
        self.identifier
    }

    fn is_conductive(&self) -> bool {
        true
    }
}
impl ElectricitySource for EmergencyGenerator {
    fn output_potential(&self) -> Potential {
        if self.should_provide_output() {
            Potential::new(PotentialOrigin::EmergencyGenerator, self.output_potential)
        } else {
            Potential::none()
        }
    }
}
impl EmergencyGeneratorPower for EmergencyGenerator {
    fn generated_power(&self) -> Power {
        self.generated_power
    }
}
impl SimulationElement for EmergencyGenerator {
    fn process_power_consumption_report<T: PowerConsumptionReport>(
        &mut self,
        _: &UpdateContext,
        report: &T,
    ) {
        self.demand = report.total_consumption_of(PotentialOrigin::EmergencyGenerator);

        self.output_frequency = if self.should_provide_output() {
            Frequency::new::<hertz>(400.)
        } else {
            Frequency::new::<hertz>(0.)
        };

        self.output_potential = if self.should_provide_output() {
            ElectricPotential::new::<volt>(115.)
        } else {
            ElectricPotential::new::<volt>(0.)
        };
    }

    fn write(&self, writer: &mut SimulatorWriter) {
        self.writer.write_alternating(self, writer);
    }
}

#[cfg(test)]
mod emergency_generator_tests {
    use std::time::Duration;

    use super::*;
    use crate::simulation::test::ReadByName;
    use crate::simulation::InitContext;
    use crate::{
        electrical::{consumption::PowerConsumer, ElectricalBus, ElectricalBusType, Electricity},
        simulation::{
            test::{SimulationTestBed, TestBed},
            Aircraft, SimulationElementVisitor, UpdateContext,
        },
    };

    struct EmergencyGeneratorTestBed {
        test_bed: SimulationTestBed<TestAircraft>,
    }
    impl EmergencyGeneratorTestBed {
        fn new() -> Self {
            Self {
                test_bed: SimulationTestBed::new(TestAircraft::new),
            }
        }

        fn frequency_is_normal(&mut self) -> bool {
            self.read_by_name("ELEC_EMER_GEN_FREQUENCY_NORMAL")
        }

        fn potential_is_normal(&mut self) -> bool {
            self.read_by_name("ELEC_EMER_GEN_POTENTIAL_NORMAL")
        }

        fn emer_gen_is_powered(&self) -> bool {
            self.query_elec(|a, elec| a.emer_gen_is_powered(elec))
        }
    }
    impl TestBed for EmergencyGeneratorTestBed {
        type Aircraft = TestAircraft;

        fn test_bed(&self) -> &SimulationTestBed<TestAircraft> {
            &self.test_bed
        }

        fn test_bed_mut(&mut self) -> &mut SimulationTestBed<TestAircraft> {
            &mut self.test_bed
        }
    }

    struct TestHydraulicSystem {
        motor_speed: AngularVelocity,
    }
    impl TestHydraulicSystem {
        fn new() -> Self {
            Self {
                motor_speed: AngularVelocity::new::<revolution_per_minute>(0.),
            }
        }

        fn set_motor_speed(&mut self, speed: AngularVelocity) {
            self.motor_speed = speed;
        }
    }
    impl HydraulicGeneratorControlUnit for TestHydraulicSystem {
        fn max_allowed_power(&self) -> Power {
            if self.motor_speed.get::<revolution_per_minute>() > 10000. {
                Power::new::<watt>(5000.)
            } else {
                Power::new::<watt>(0.)
            }
        }
        fn motor_speed(&self) -> AngularVelocity {
            self.motor_speed
        }
    }

    struct TestAircraft {
        supplied_bus: ElectricalBus,
        consumer: PowerConsumer,
        emer_gen: EmergencyGenerator,
        hydraulic: TestHydraulicSystem,
        generator_output_within_normal_parameters_before_processing_power_consumption_report: bool,
    }
    impl TestAircraft {
        fn new(context: &mut InitContext) -> Self {
            Self {
                supplied_bus: ElectricalBus::new(context,ElectricalBusType::AlternatingCurrent(1)),
                consumer: PowerConsumer::from(ElectricalBusType::AlternatingCurrent(1)),
                emer_gen: EmergencyGenerator::new(context),
                hydraulic: TestHydraulicSystem::new(),
                generator_output_within_normal_parameters_before_processing_power_consumption_report: false,
            }
        }

        fn emer_gen_is_powered(&self, electricity: &Electricity) -> bool {
            electricity.is_powered(&self.emer_gen)
        }

        fn attempt_emer_gen_start(&mut self) {
            self.consumer.demand(Power::new::<watt>(3000.));

            self.hydraulic
                .set_motor_speed(AngularVelocity::new::<revolution_per_minute>(12000.));
        }

        fn stop_emer_gen(&mut self) {
            self.consumer.demand(Power::new::<watt>(0.));
            self.hydraulic
                .set_motor_speed(AngularVelocity::new::<revolution_per_minute>(0.));
        }

        fn set_generator_motor_speed(&mut self, angular_velocity: AngularVelocity) {
            self.hydraulic.set_motor_speed(angular_velocity);
        }

        fn generator_output_within_normal_parameters_before_processing_power_consumption_report(
            &self,
        ) -> bool {
            self.generator_output_within_normal_parameters_before_processing_power_consumption_report
        }

        fn generator_output_within_normal_parameters_after_processing_power_consumption_report(
            &self,
        ) -> bool {
            self.emer_gen.output_within_normal_parameters()
        }
    }
    impl Aircraft for TestAircraft {
        fn update_before_power_distribution(
            &mut self,
            _: &UpdateContext,
            electricity: &mut Electricity,
        ) {
            electricity.supplied_by(&self.emer_gen);
            electricity.flow(&self.emer_gen, &self.supplied_bus);

            self.emer_gen.update(&self.hydraulic);

            self.generator_output_within_normal_parameters_before_processing_power_consumption_report = self.emer_gen.output_within_normal_parameters();
        }
    }
    impl SimulationElement for TestAircraft {
        fn accept<T: SimulationElementVisitor>(&mut self, visitor: &mut T) {
            self.emer_gen.accept(visitor);
            self.consumer.accept(visitor);
            self.supplied_bus.accept(visitor);

            visitor.visit(self);
        }
    }

    #[test]
    fn when_shutdown_has_no_output() {
        let mut test_bed = EmergencyGeneratorTestBed::new();

        test_bed.run_with_delta(Duration::from_secs(100));

        assert!(!test_bed.emer_gen_is_powered());
    }

    #[test]
    fn when_started_provides_output() {
        let mut test_bed = EmergencyGeneratorTestBed::new();

        test_bed.command(|a| a.attempt_emer_gen_start());
        test_bed.run_without_delta();
        test_bed.run_with_delta(Duration::from_secs(100));

        assert!(test_bed.emer_gen_is_powered());
    }

    #[test]
    fn when_shutdown_frequency_not_normal() {
        let mut test_bed = EmergencyGeneratorTestBed::new();

        test_bed.run_with_delta(Duration::from_secs(100));

        assert!(!test_bed.frequency_is_normal());
    }

    #[test]
    fn when_started_frequency_normal() {
        let mut test_bed = EmergencyGeneratorTestBed::new();

        test_bed.command(|a| a.attempt_emer_gen_start());
        test_bed.run_with_delta(Duration::from_secs(100));

        assert!(test_bed.frequency_is_normal());
    }

    #[test]
    fn when_shutdown_potential_not_normal() {
        let mut test_bed = EmergencyGeneratorTestBed::new();

        test_bed.run_with_delta(Duration::from_secs(100));

        assert!(!test_bed.potential_is_normal());
    }

    #[test]
    fn when_started_potential_normal() {
        let mut test_bed = EmergencyGeneratorTestBed::new();

        test_bed.command(|a| a.attempt_emer_gen_start());
        test_bed.run_with_delta(Duration::from_secs(100));

        assert!(test_bed.potential_is_normal());
    }

    #[test]
    fn output_not_within_normal_parameters_when_shutdown() {
        let mut test_bed = EmergencyGeneratorTestBed::new();

        test_bed.run_with_delta(Duration::from_secs(100));

        assert!(!test_bed.query(|a| a
            .generator_output_within_normal_parameters_after_processing_power_consumption_report(
            )));
    }

    #[test]
    fn output_within_normal_parameters_when_started() {
        let mut test_bed = EmergencyGeneratorTestBed::new();

        test_bed.command(|a| a.attempt_emer_gen_start());
        test_bed.run_with_delta(Duration::from_secs(100));

        assert!(test_bed.query(|a| a
            .generator_output_within_normal_parameters_after_processing_power_consumption_report(
            )));
    }

    #[test]
    fn output_within_normal_parameters_only_above_min_rpm() {
        let mut test_bed = EmergencyGeneratorTestBed::new();

        test_bed.command(|a| a.attempt_emer_gen_start());

        test_bed.run_with_delta(Duration::from_secs(10));

        assert!(test_bed.query(|a| a
            .generator_output_within_normal_parameters_after_processing_power_consumption_report(
            )));

        test_bed.command(|a| {
            a.set_generator_motor_speed(AngularVelocity::new::<revolution_per_minute>(5000.))
        });

        test_bed.run_with_delta(Duration::from_secs(1));

        assert!(test_bed.query(|a| !a
            .generator_output_within_normal_parameters_after_processing_power_consumption_report(
            )));
    }

    #[test]
    fn output_within_normal_parameters_adapts_to_no_longer_supplying_emer_gen_instantaneously() {
        // The frequency and potential of the generator are only known at the end of a tick,
        // due to them being directly related to the power consumption (large changes can cause
        // spikes and dips). However, the decision if a generator can supply power is made much
        // earlier in the tick. This is especially of great consequence when the generator no longer
        // supplies potential but the previous tick's frequency and potential are still normal.
        // With this test we ensure that a generator which is no longer supplying power is
        // immediately noticed.
        let mut test_bed = EmergencyGeneratorTestBed::new();

        test_bed.command(|a| a.attempt_emer_gen_start());
        test_bed.run_with_delta(Duration::from_secs(100));

        test_bed.command(|a| a.stop_emer_gen());
        test_bed.run_with_delta(Duration::from_secs(0));

        assert!(!test_bed.query(|a| a
            .generator_output_within_normal_parameters_before_processing_power_consumption_report(
            )));
    }

    #[test]
    fn writes_its_state() {
        let mut test_bed = SimulationTestBed::new(TestAircraft::new);
        test_bed.run();

        assert!(test_bed.contains_variable_with_name("ELEC_EMER_GEN_POTENTIAL"));
        assert!(test_bed.contains_variable_with_name("ELEC_EMER_GEN_POTENTIAL_NORMAL"));
        assert!(test_bed.contains_variable_with_name("ELEC_EMER_GEN_FREQUENCY"));
        assert!(test_bed.contains_variable_with_name("ELEC_EMER_GEN_FREQUENCY_NORMAL"));
    }
}
