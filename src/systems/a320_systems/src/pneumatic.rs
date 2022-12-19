use core::panic;
use std::{f64::consts::PI, time::Duration};

use uom::si::{
    f64::*,
    pressure::psi,
    ratio::ratio,
    thermodynamic_temperature::degree_celsius,
    volume::{cubic_meter, gallon},
};

use systems::{
    accept_iterable,
    air_conditioning::PackFlowControllers,
    overhead::{AutoOffFaultPushButton, OnOffFaultPushButton},
    pneumatic::{
        valve::*, BleedMonitoringComputerChannelOperationMode,
        BleedMonitoringComputerIsAliveSignal, CompressionChamber, ControllablePneumaticValve,
        CrossBleedValveSelectorKnob, CrossBleedValveSelectorMode,
        EngineCompressionChamberController, EngineModeSelector, EngineState, PneumaticContainer,
        PneumaticPipe, PneumaticValveSignal, Precooler, PressurisedReservoirWithExhaustValve,
        PressurizeableReservoir, TargetPressureTemperatureSignal, VariableVolumeContainer,
        WingAntiIcePushButton,
    },
    shared::{
        pid::PidController, update_iterator::MaxStepLoop, ControllerSignal, ElectricalBusType,
        ElectricalBuses, EngineBleedPushbutton, EngineCorrectedN1, EngineCorrectedN2,
        EngineFirePushButtons, EngineStartState, HydraulicColor, LgciuWeightOnWheels,
        PackFlowValveState, PneumaticBleed, PneumaticValve, ReservoirAirPressure,
    },
    simulation::{
        InitContext, Read, SimulationElement, SimulationElementVisitor, SimulatorReader,
        SimulatorWriter, UpdateContext, VariableIdentifier, Write,
    },
};

mod wing_anti_ice;
use wing_anti_ice::*;

macro_rules! valve_signal_implementation {
    ($signal_type: ty) => {
        impl PneumaticValveSignal for $signal_type {
            fn new(target_open_amount: Ratio) -> Self {
                Self { target_open_amount }
            }

            fn target_open_amount(&self) -> Ratio {
                self.target_open_amount
            }
        }
    };
}

struct HighPressureValveSignal {
    target_open_amount: Ratio,
}

struct PressureRegulatingValveSignal {
    target_open_amount: Ratio,
}

struct EngineStarterValveSignal {
    target_open_amount: Ratio,
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum CrossBleedValveSignalType {
    Manual,
    Automatic,
}

struct CrossBleedValveSignal {
    target_open_amount: Ratio,
    signal_type: CrossBleedValveSignalType,
}
impl CrossBleedValveSignal {
    fn new(target_open_amount: Ratio, signal_type: CrossBleedValveSignalType) -> Self {
        Self {
            target_open_amount,
            signal_type,
        }
    }

    fn target_open_amount(&self) -> Ratio {
        self.target_open_amount
    }

    fn new_open(signal_type: CrossBleedValveSignalType) -> Self {
        Self::new(Ratio::new::<ratio>(1.), signal_type)
    }

    fn new_closed(signal_type: CrossBleedValveSignalType) -> Self {
        Self::new(Ratio::new::<ratio>(0.), signal_type)
    }
}

struct FanAirValveSignal {
    target_open_amount: Ratio,
}

struct PackFlowValveSignal {
    target_open_amount: Ratio,
}

valve_signal_implementation!(HighPressureValveSignal);
valve_signal_implementation!(PressureRegulatingValveSignal);
valve_signal_implementation!(EngineStarterValveSignal);
valve_signal_implementation!(FanAirValveSignal);
valve_signal_implementation!(PackFlowValveSignal);

pub struct A320Pneumatic {
    physics_updater: MaxStepLoop,

    cross_bleed_valve_open_id: VariableIdentifier,
    apu_bleed_air_valve_open_id: VariableIdentifier,
    bleed_monitoring_computers: [BleedMonitoringComputer; 2],
    engine_systems: [EngineBleedAirSystem; 2],

    cross_bleed_valve: CrossBleedValve,

    fadec: FullAuthorityDigitalEngineControl,
    engine_starter_valve_controllers: [EngineStarterValveController; 2],

    apu_compression_chamber: CompressionChamber,
    apu_bleed_air_valve: DefaultValve,

    wing_anti_ice: WingAntiIceComplex,

    hydraulic_reservoir_bleed_air_valves: [PurelyPneumaticValve; 2],
    hydraulic_reservoir_bleed_air_pipe: PneumaticPipe,

    green_hydraulic_reservoir_with_valve:
        PressurisedReservoirWithExhaustValve<VariableVolumeContainer>,
    blue_hydraulic_reservoir_with_valve:
        PressurisedReservoirWithExhaustValve<VariableVolumeContainer>,
    yellow_hydraulic_reservoir_with_valve:
        PressurisedReservoirWithExhaustValve<VariableVolumeContainer>,

    packs: [PackComplex; 2],
}
impl A320Pneumatic {
    const PNEUMATIC_SIM_MAX_TIME_STEP: Duration = Duration::from_millis(100);

    pub fn new(context: &mut InitContext) -> Self {
        Self {
            physics_updater: MaxStepLoop::new(Self::PNEUMATIC_SIM_MAX_TIME_STEP),
            cross_bleed_valve_open_id: context.get_identifier("PNEU_XBLEED_VALVE_OPEN".to_owned()),
            apu_bleed_air_valve_open_id: context
                .get_identifier("APU_BLEED_AIR_VALVE_OPEN".to_owned()),
            bleed_monitoring_computers: [
                BleedMonitoringComputer::new(1, 2, ElectricalBusType::DirectCurrentEssentialShed),
                BleedMonitoringComputer::new(2, 1, ElectricalBusType::DirectCurrent(2)),
            ],
            engine_systems: [
                EngineBleedAirSystem::new(
                    context,
                    1,
                    ElectricalBusType::DirectCurrentEssentialShed,
                ),
                EngineBleedAirSystem::new(context, 2, ElectricalBusType::DirectCurrent(2)),
            ],
            cross_bleed_valve: CrossBleedValve::new(),
            fadec: FullAuthorityDigitalEngineControl::new(context),
            engine_starter_valve_controllers: [
                EngineStarterValveController::new(1),
                EngineStarterValveController::new(2),
            ],
            apu_compression_chamber: CompressionChamber::new(Volume::new::<cubic_meter>(5.)),
            apu_bleed_air_valve: DefaultValve::new_closed(),
            wing_anti_ice: WingAntiIceComplex::new(context),
            hydraulic_reservoir_bleed_air_valves: [
                PurelyPneumaticValve::new(),
                PurelyPneumaticValve::new(),
            ],
            hydraulic_reservoir_bleed_air_pipe: PneumaticPipe::new(
                Volume::new::<cubic_meter>(0.2),
                Pressure::new::<psi>(14.7),
                ThermodynamicTemperature::new::<degree_celsius>(15.),
            ),
            green_hydraulic_reservoir_with_valve: PressurisedReservoirWithExhaustValve::new(
                context,
                HydraulicColor::Green,
                VariableVolumeContainer::new(
                    Volume::new::<gallon>(2.5),
                    Pressure::new::<psi>(52.),
                    ThermodynamicTemperature::new::<degree_celsius>(15.),
                ),
                Pressure::new::<psi>(75.),
                6e-2,
            ),
            blue_hydraulic_reservoir_with_valve: PressurisedReservoirWithExhaustValve::new(
                context,
                HydraulicColor::Blue,
                VariableVolumeContainer::new(
                    Volume::new::<gallon>(1.1),
                    Pressure::new::<psi>(55.),
                    ThermodynamicTemperature::new::<degree_celsius>(15.),
                ),
                Pressure::new::<psi>(75.),
                6e-2,
            ),
            yellow_hydraulic_reservoir_with_valve: PressurisedReservoirWithExhaustValve::new(
                context,
                HydraulicColor::Yellow,
                VariableVolumeContainer::new(
                    Volume::new::<gallon>(1.7),
                    Pressure::new::<psi>(65.),
                    ThermodynamicTemperature::new::<degree_celsius>(15.),
                ),
                Pressure::new::<psi>(75.),
                6e-2,
            ),
            packs: [PackComplex::new(context, 1), PackComplex::new(context, 2)],
        }
    }

    pub(crate) fn update(
        &mut self,
        context: &UpdateContext,
        engines: [&(impl EngineCorrectedN1 + EngineCorrectedN2); 2],
        overhead_panel: &A320PneumaticOverheadPanel,
        engine_fire_push_buttons: &impl EngineFirePushButtons,
        apu: &impl ControllerSignal<TargetPressureTemperatureSignal>,
        pack_flow_valve_signals: &impl PackFlowControllers<3>,
        lgciu: [&impl LgciuWeightOnWheels; 2],
    ) {
        self.physics_updater.update(context);

        for cur_time_step in self.physics_updater {
            self.update_physics(
                &context.with_delta(cur_time_step),
                engines,
                overhead_panel,
                engine_fire_push_buttons,
                apu,
                pack_flow_valve_signals,
                lgciu,
            );
        }
    }

    pub(crate) fn update_physics(
        &mut self,
        context: &UpdateContext,
        engines: [&(impl EngineCorrectedN1 + EngineCorrectedN2); 2],
        overhead_panel: &A320PneumaticOverheadPanel,
        engine_fire_push_buttons: &impl EngineFirePushButtons,
        apu: &impl ControllerSignal<TargetPressureTemperatureSignal>,
        pack_flow_valve_signals: &impl PackFlowControllers<3>,
        lgciu: [&impl LgciuWeightOnWheels; 2],
    ) {
        self.apu_compression_chamber.update(apu);

        for bleed_monitoring_computer in self.bleed_monitoring_computers.iter_mut() {
            bleed_monitoring_computer.update(
                context,
                &self.engine_systems,
                &self.apu_bleed_air_valve,
                overhead_panel,
                engine_fire_push_buttons,
                &self.cross_bleed_valve,
                &self.fadec,
            );

            // I am not exactly sure if both BMCs should actually control this valve all the time.
            self.cross_bleed_valve
                .update_open_amount(&bleed_monitoring_computer.main_channel);
        }

        let [bmc_one, bmc_two] = &mut self.bleed_monitoring_computers;

        bmc_one.check_for_failure(bmc_two);
        bmc_two.check_for_failure(bmc_one);

        for controller in self.engine_starter_valve_controllers.iter_mut() {
            controller.update(&self.fadec);
        }

        for (engine_system, hydraulic_valve) in self
            .engine_systems
            .iter_mut()
            .zip(&mut self.hydraulic_reservoir_bleed_air_valves)
        {
            for bleed_monitoring_computer in self.bleed_monitoring_computers.iter() {
                let index = engine_system.number - 1;

                // If we get an actual channel here, this means that the channel is not in slave mode
                if let Some(channel) =
                    bleed_monitoring_computer.channel_for_engine(engine_system.number)
                {
                    engine_system.update(
                        context,
                        channel,
                        channel,
                        &self.engine_starter_valve_controllers[index],
                        channel,
                        engines[index],
                    );
                }
            }

            hydraulic_valve.update_move_fluid(
                context,
                engine_system,
                &mut self.hydraulic_reservoir_bleed_air_pipe,
            );
        }

        self.wing_anti_ice.update(
            context,
            &mut self.engine_systems,
            overhead_panel.wing_anti_ice.mode(),
            lgciu,
        );
        let [left_system, right_system] = &mut self.engine_systems;
        self.apu_bleed_air_valve.update_move_fluid(
            context,
            &mut self.apu_compression_chamber,
            left_system,
        );

        self.cross_bleed_valve
            .update_move_fluid(context, left_system, right_system);

        self.green_hydraulic_reservoir_with_valve
            .update_flow_through_valve(context, &mut self.hydraulic_reservoir_bleed_air_pipe);
        self.blue_hydraulic_reservoir_with_valve
            .update_flow_through_valve(context, &mut self.hydraulic_reservoir_bleed_air_pipe);
        self.yellow_hydraulic_reservoir_with_valve
            .update_flow_through_valve(context, &mut self.hydraulic_reservoir_bleed_air_pipe);

        self.packs
            .iter_mut()
            .zip(self.engine_systems.iter_mut())
            .for_each(|(pack, engine_system)| {
                pack.update(context, engine_system, pack_flow_valve_signals)
            });
    }

    // TODO: Returning a mutable reference here is not great. I was running into an issue with the update order:
    // - The APU turbine must know about the bleed valve being open as soon as possible to update EGT properly
    // - To open the bleed valve, we need a signal from the ecb
    // - To get a signal from the ECB to open the bleed valve, we have to update the APU.
    // For now, we just pass over control of the bleed valve to the APU, so it can be updated after the ECB update but before the turbine update.
    pub fn apu_bleed_air_valve(&mut self) -> &mut impl ControllablePneumaticValve {
        &mut self.apu_bleed_air_valve
    }

    pub fn update_hydraulic_reservoir_spatial_volumes(
        &mut self,
        green_hydraulic_reservoir: &impl PressurizeableReservoir,
        blue_hydraulic_reservoir: &impl PressurizeableReservoir,
        yellow_hydraulic_reservoir: &impl PressurizeableReservoir,
    ) {
        self.green_hydraulic_reservoir_with_valve
            .change_spatial_volume(green_hydraulic_reservoir.available_volume());
        self.blue_hydraulic_reservoir_with_valve
            .change_spatial_volume(blue_hydraulic_reservoir.available_volume());
        self.yellow_hydraulic_reservoir_with_valve
            .change_spatial_volume(yellow_hydraulic_reservoir.available_volume());
    }
}
impl PneumaticBleed for A320Pneumatic {
    fn apu_bleed_is_on(&self) -> bool {
        self.apu_bleed_air_valve.is_open()
    }
    fn engine_crossbleed_is_on(&self) -> bool {
        self.cross_bleed_valve.is_open()
    }
}
impl EngineStartState for A320Pneumatic {
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
impl PackFlowValveState for A320Pneumatic {
    fn pack_flow_valve_open_amount(&self, pack_id: usize) -> Ratio {
        self.packs[pack_id].pack_flow_valve_open_amount()
    }
    fn pack_flow_valve_air_flow(&self, pack_id: usize) -> MassRate {
        self.packs[pack_id].pack_flow_valve_air_flow()
    }
}
impl SimulationElement for A320Pneumatic {
    fn accept<T: SimulationElementVisitor>(&mut self, visitor: &mut T) {
        self.cross_bleed_valve.accept(visitor);
        self.fadec.accept(visitor);
        self.wing_anti_ice.accept(visitor);

        accept_iterable!(self.bleed_monitoring_computers, visitor);
        accept_iterable!(self.engine_systems, visitor);
        accept_iterable!(self.packs, visitor);

        self.blue_hydraulic_reservoir_with_valve.accept(visitor);
        self.yellow_hydraulic_reservoir_with_valve.accept(visitor);
        self.green_hydraulic_reservoir_with_valve.accept(visitor);

        visitor.visit(self);
    }

    fn write(&self, writer: &mut SimulatorWriter) {
        writer.write(
            &self.cross_bleed_valve_open_id,
            self.cross_bleed_valve.is_open(),
        );
        writer.write(
            &self.apu_bleed_air_valve_open_id,
            self.apu_bleed_air_valve.is_open(),
        );
    }
}
impl ReservoirAirPressure for A320Pneumatic {
    fn green_reservoir_pressure(&self) -> Pressure {
        self.green_hydraulic_reservoir_with_valve.pressure()
    }

    fn blue_reservoir_pressure(&self) -> Pressure {
        self.blue_hydraulic_reservoir_with_valve.pressure()
    }

    fn yellow_reservoir_pressure(&self) -> Pressure {
        self.yellow_hydraulic_reservoir_with_valve.pressure()
    }
}

struct EngineStarterValveController {
    number: usize,
    engine_state: EngineState,
}
impl ControllerSignal<EngineStarterValveSignal> for EngineStarterValveController {
    fn signal(&self) -> Option<EngineStarterValveSignal> {
        match self.engine_state {
            EngineState::Starting => Some(EngineStarterValveSignal::new_open()),
            _ => Some(EngineStarterValveSignal::new_closed()),
        }
    }
}
impl EngineStarterValveController {
    fn new(number: usize) -> Self {
        Self {
            number,
            engine_state: EngineState::Off,
        }
    }

    fn update(&mut self, fadec: &FullAuthorityDigitalEngineControl) {
        self.engine_state = fadec.engine_state(self.number);
    }
}

struct BleedMonitoringComputer {
    main_channel_engine_number: usize,
    backup_channel_engine_number: usize,
    main_channel: BleedMonitoringComputerChannel,
    backup_channel: BleedMonitoringComputerChannel,
    powered_by: ElectricalBusType,
    is_powered: bool,
}
impl BleedMonitoringComputer {
    fn new(
        main_channel_engine_number: usize,
        backup_channel_engine_number: usize,
        powered_by: ElectricalBusType,
    ) -> Self {
        Self {
            main_channel_engine_number,
            backup_channel_engine_number,
            main_channel: BleedMonitoringComputerChannel::new(
                main_channel_engine_number,
                BleedMonitoringComputerChannelOperationMode::Master,
            ),
            backup_channel: BleedMonitoringComputerChannel::new(
                backup_channel_engine_number,
                BleedMonitoringComputerChannelOperationMode::Slave,
            ),
            powered_by,
            is_powered: true,
        }
    }

    fn update(
        &mut self,
        context: &UpdateContext,
        sensors: &[EngineBleedAirSystem; 2],
        apu_bleed_valve: &impl PneumaticValve,
        overhead_panel: &A320PneumaticOverheadPanel,
        engine_fire_push_buttons: &impl EngineFirePushButtons,
        cross_bleed_valve: &impl PneumaticValve,
        fadec: &FullAuthorityDigitalEngineControl,
    ) {
        self.main_channel.update(
            context,
            &sensors[self.main_channel_engine_number - 1],
            engine_fire_push_buttons.is_released(self.main_channel_engine_number),
            apu_bleed_valve,
            cross_bleed_valve,
            overhead_panel,
            fadec,
        );

        self.backup_channel.update(
            context,
            &sensors[self.backup_channel_engine_number - 1],
            engine_fire_push_buttons.is_released(self.backup_channel_engine_number),
            apu_bleed_valve,
            cross_bleed_valve,
            overhead_panel,
            fadec,
        );
    }

    fn check_for_failure(&mut self, other: &mut BleedMonitoringComputer) {
        match other.signal() {
            None => {
                self.change_backup_channel_operation_mode(
                    BleedMonitoringComputerChannelOperationMode::Master,
                );
                other.change_main_channel_operation_mode(
                    BleedMonitoringComputerChannelOperationMode::Slave,
                );
            }
            Some(_) => {}
        }
    }

    pub fn change_main_channel_operation_mode(
        &mut self,
        mode: BleedMonitoringComputerChannelOperationMode,
    ) {
        self.main_channel.set_operation_mode(mode);
    }

    pub fn change_backup_channel_operation_mode(
        &mut self,
        mode: BleedMonitoringComputerChannelOperationMode,
    ) {
        self.backup_channel.set_operation_mode(mode);
    }

    pub fn channel_for_engine(
        &self,
        engine_number: usize,
    ) -> Option<&BleedMonitoringComputerChannel> {
        if engine_number == self.main_channel_engine_number {
            self.main_channel.or_none_if_slave()
        } else if engine_number == self.backup_channel_engine_number {
            self.backup_channel.or_none_if_slave()
        } else {
            None
        }
    }

    fn is_powered(&self) -> bool {
        self.is_powered
    }
}
impl SimulationElement for BleedMonitoringComputer {
    fn receive_power(&mut self, buses: &impl ElectricalBuses) {
        self.is_powered = buses.is_powered(self.powered_by)
    }
}
impl ControllerSignal<BleedMonitoringComputerIsAliveSignal> for BleedMonitoringComputer {
    fn signal(&self) -> Option<BleedMonitoringComputerIsAliveSignal> {
        if self.is_powered() {
            Some(BleedMonitoringComputerIsAliveSignal)
        } else {
            None
        }
    }
}

struct BleedMonitoringComputerChannel {
    engine_number: usize,
    operation_mode: BleedMonitoringComputerChannelOperationMode,
    pressure_regulating_valve_is_closed: bool,
    high_pressure_compressor_pressure: Pressure,
    transfer_pressure: Pressure,
    engine_starter_valve_is_open: bool,
    is_engine_bleed_pushbutton_auto: bool,
    is_engine_fire_pushbutton_released: bool,
    is_apu_bleed_valve_open: bool,
    is_apu_bleed_on: bool,
    high_pressure_valve_pid: PidController,
    pressure_regulating_valve_pid: PidController,
    fan_air_valve_pid: PidController,
    cross_bleed_valve_selector: CrossBleedValveSelectorMode,
    cross_bleed_valve_is_open: bool,
}
impl BleedMonitoringComputerChannel {
    const PRESSURE_REGULATING_VALVE_SINGLE_BLEED_CONFIG_TARGET_PSI: f64 = 52.;
    const PRESSURE_REGULATING_VALVE_DUAL_BLEED_CONFIG_TARGET_PSI: f64 = 46.;

    fn new(
        engine_number: usize,
        operation_mode: BleedMonitoringComputerChannelOperationMode,
    ) -> Self {
        Self {
            engine_number,
            operation_mode,
            pressure_regulating_valve_is_closed: false,
            high_pressure_compressor_pressure: Pressure::new::<psi>(0.),
            transfer_pressure: Pressure::new::<psi>(0.),
            engine_starter_valve_is_open: false,
            is_engine_bleed_pushbutton_auto: true,
            is_engine_fire_pushbutton_released: false,
            is_apu_bleed_valve_open: false,
            is_apu_bleed_on: false,
            high_pressure_valve_pid: PidController::new(0.05, 0.003, 0., 0., 1., 65., 1.),
            pressure_regulating_valve_pid: PidController::new(0.05, 0.01, 0., 0., 1., 46., 1.),
            fan_air_valve_pid: PidController::new(-0.005, -0.001, 0., 0., 1., 200., 1.),
            cross_bleed_valve_selector: CrossBleedValveSelectorMode::Auto,
            cross_bleed_valve_is_open: false,
        }
    }

    fn update(
        &mut self,
        context: &UpdateContext,
        sensors: &EngineBleedAirSystem,
        is_engine_fire_pushbutton_released: bool,
        apu_bleed_valve: &impl PneumaticValve,
        cross_bleed_valve: &impl PneumaticValve,
        overhead_panel: &A320PneumaticOverheadPanel,
        fadec: &FullAuthorityDigitalEngineControl,
    ) {
        self.high_pressure_compressor_pressure = sensors.high_pressure();
        self.transfer_pressure = sensors.transfer_pressure();

        self.pressure_regulating_valve_pid.change_setpoint(
            if fadec.is_single_vs_dual_bleed_config() {
                Self::PRESSURE_REGULATING_VALVE_SINGLE_BLEED_CONFIG_TARGET_PSI
            } else {
                Self::PRESSURE_REGULATING_VALVE_DUAL_BLEED_CONFIG_TARGET_PSI
            },
        );

        self.pressure_regulating_valve_is_closed = !sensors.pressure_regulating_valve_is_open();

        self.high_pressure_valve_pid
            .next_control_output(self.transfer_pressure.get::<psi>(), Some(context.delta()));
        self.pressure_regulating_valve_pid.next_control_output(
            sensors.precooler_outlet_pressure().get::<psi>(),
            Some(context.delta()),
        );
        self.fan_air_valve_pid.next_control_output(
            sensors
                .precooler_outlet_temperature()
                .get::<degree_celsius>(),
            Some(context.delta()),
        );

        self.engine_starter_valve_is_open = sensors.engine_starter_valve_is_open();

        self.is_engine_bleed_pushbutton_auto =
            overhead_panel.engine_bleed_pb_is_auto(self.engine_number);
        self.is_engine_fire_pushbutton_released = is_engine_fire_pushbutton_released;

        self.is_apu_bleed_valve_open = apu_bleed_valve.is_open();
        self.is_apu_bleed_on = overhead_panel.apu_bleed_is_on();

        self.cross_bleed_valve_selector = overhead_panel.cross_bleed_mode();
        self.cross_bleed_valve_is_open = cross_bleed_valve.is_open();
    }

    fn operation_mode(&self) -> BleedMonitoringComputerChannelOperationMode {
        self.operation_mode
    }

    fn set_operation_mode(&mut self, mode: BleedMonitoringComputerChannelOperationMode) {
        self.operation_mode = mode;
    }

    fn or_none_if_slave(&self) -> Option<&BleedMonitoringComputerChannel> {
        match self.operation_mode() {
            BleedMonitoringComputerChannelOperationMode::Master => Some(self),
            BleedMonitoringComputerChannelOperationMode::Slave => None,
        }
    }

    fn should_close_pressure_regulating_valve_because_apu_bleed_is_on(&self) -> bool {
        self.is_apu_bleed_on
            && self.is_apu_bleed_valve_open
            && (self.engine_number == 1 || self.cross_bleed_valve_is_open)
    }
}
impl ControllerSignal<HighPressureValveSignal> for BleedMonitoringComputerChannel {
    fn signal(&self) -> Option<HighPressureValveSignal> {
        if self.pressure_regulating_valve_is_closed
            || self.high_pressure_compressor_pressure < Pressure::new::<psi>(18.)
        {
            Some(HighPressureValveSignal::new_closed())
        } else {
            Some(HighPressureValveSignal::new(Ratio::new::<ratio>(
                self.high_pressure_valve_pid.output(),
            )))
        }
    }
}
impl ControllerSignal<PressureRegulatingValveSignal> for BleedMonitoringComputerChannel {
    fn signal(&self) -> Option<PressureRegulatingValveSignal> {
        if self.transfer_pressure < Pressure::new::<psi>(18.)
            || (!self.is_engine_bleed_pushbutton_auto || self.is_engine_fire_pushbutton_released)
            || self.should_close_pressure_regulating_valve_because_apu_bleed_is_on()
            || self.engine_starter_valve_is_open
        {
            Some(PressureRegulatingValveSignal::new_closed())
        } else {
            Some(PressureRegulatingValveSignal::new(Ratio::new::<ratio>(
                self.pressure_regulating_valve_pid.output(),
            )))
        }
    }
}
impl ControllerSignal<FanAirValveSignal> for BleedMonitoringComputerChannel {
    fn signal(&self) -> Option<FanAirValveSignal> {
        Some(FanAirValveSignal::new(Ratio::new::<ratio>(
            self.fan_air_valve_pid.output(),
        )))
    }
}
impl ControllerSignal<CrossBleedValveSignal> for BleedMonitoringComputerChannel {
    fn signal(&self) -> Option<CrossBleedValveSignal> {
        match self.cross_bleed_valve_selector {
            CrossBleedValveSelectorMode::Shut => Some(CrossBleedValveSignal::new_closed(
                CrossBleedValveSignalType::Manual,
            )),
            CrossBleedValveSelectorMode::Open => Some(CrossBleedValveSignal::new_open(
                CrossBleedValveSignalType::Manual,
            )),
            CrossBleedValveSelectorMode::Auto => {
                if self.is_apu_bleed_valve_open {
                    Some(CrossBleedValveSignal::new_open(
                        CrossBleedValveSignalType::Automatic,
                    ))
                } else {
                    Some(CrossBleedValveSignal::new_closed(
                        CrossBleedValveSignalType::Automatic,
                    ))
                }
            }
        }
    }
}

struct EngineBleedAirSystem {
    intermediate_pressure_id: VariableIdentifier,
    high_pressure_id: VariableIdentifier,
    transfer_pressure_id: VariableIdentifier,
    precooler_inlet_pressure_id: VariableIdentifier,
    precooler_outlet_pressure_id: VariableIdentifier,
    starter_container_pressure_id: VariableIdentifier,
    intermediate_temperature_id: VariableIdentifier,
    high_temperature_id: VariableIdentifier,
    transfer_temperature_id: VariableIdentifier,
    precooler_inlet_temperature_id: VariableIdentifier,
    precooler_outlet_temperature_id: VariableIdentifier,
    starter_container_temperature_id: VariableIdentifier,
    intermediate_pressure_valve_open_id: VariableIdentifier,
    high_pressure_valve_open_id: VariableIdentifier,
    pressure_regulating_valve_open_id: VariableIdentifier,
    starter_valve_open_id: VariableIdentifier,

    number: usize,
    fan_compression_chamber_controller: EngineCompressionChamberController, // Controls pressure just behind the main fan
    intermediate_pressure_compression_chamber_controller: EngineCompressionChamberController,
    high_pressure_compression_chamber_controller: EngineCompressionChamberController,
    fan_compression_chamber: CompressionChamber,
    intermediate_pressure_compression_chamber: CompressionChamber,
    high_pressure_compression_chamber: CompressionChamber,
    intermediate_pressure_valve: PurelyPneumaticValve,
    high_pressure_valve: ElectroPneumaticValve,
    pressure_regulating_valve: ElectroPneumaticValve,
    transfer_pressure_pipe: PneumaticPipe,
    precooler_inlet_pipe: PneumaticPipe,
    precooler_outlet_pipe: PneumaticPipe,
    precooler_supply_pipe: PneumaticPipe,
    engine_starter_exhaust: PneumaticExhaust,
    engine_starter_container: PneumaticPipe,
    engine_starter_valve: DefaultValve,
    fan_air_valve: ElectroPneumaticValve,
    precooler: Precooler,
}
impl EngineBleedAirSystem {
    fn new(context: &mut InitContext, number: usize, powered_by: ElectricalBusType) -> Self {
        Self {
            number,
            intermediate_pressure_id: context
                .get_identifier(format!("PNEU_ENG_{}_IP_PRESSURE", number)),
            high_pressure_id: context.get_identifier(format!("PNEU_ENG_{}_HP_PRESSURE", number)),
            transfer_pressure_id: context
                .get_identifier(format!("PNEU_ENG_{}_TRANSFER_PRESSURE", number)),
            precooler_inlet_pressure_id: context
                .get_identifier(format!("PNEU_ENG_{}_PRECOOLER_INLET_PRESSURE", number)),
            precooler_outlet_pressure_id: context
                .get_identifier(format!("PNEU_ENG_{}_PRECOOLER_OUTLET_PRESSURE", number)),
            starter_container_pressure_id: context
                .get_identifier(format!("PNEU_ENG_{}_STARTER_CONTAINER_PRESSURE", number)),
            intermediate_temperature_id: context
                .get_identifier(format!("PNEU_ENG_{}_IP_TEMPERATURE", number)),
            high_temperature_id: context
                .get_identifier(format!("PNEU_ENG_{}_HP_TEMPERATURE", number)),
            transfer_temperature_id: context
                .get_identifier(format!("PNEU_ENG_{}_TRANSFER_TEMPERATURE", number)),
            precooler_inlet_temperature_id: context
                .get_identifier(format!("PNEU_ENG_{}_PRECOOLER_INLET_TEMPERATURE", number)),
            precooler_outlet_temperature_id: context
                .get_identifier(format!("PNEU_ENG_{}_PRECOOLER_OUTLET_TEMPERATURE", number)),
            starter_container_temperature_id: context
                .get_identifier(format!("PNEU_ENG_{}_STARTER_CONTAINER_TEMPERATURE", number)),
            intermediate_pressure_valve_open_id: context
                .get_identifier(format!("PNEU_ENG_{}_IP_VALVE_OPEN", number)),
            high_pressure_valve_open_id: context
                .get_identifier(format!("PNEU_ENG_{}_HP_VALVE_OPEN", number)),
            pressure_regulating_valve_open_id: context
                .get_identifier(format!("PNEU_ENG_{}_PR_VALVE_OPEN", number)),
            starter_valve_open_id: context
                .get_identifier(format!("PNEU_ENG_{}_STARTER_VALVE_OPEN", number)),
            fan_compression_chamber_controller: EngineCompressionChamberController::new(1., 0., 2.),
            intermediate_pressure_compression_chamber_controller:
                EngineCompressionChamberController::new(3., 0., 4.),
            high_pressure_compression_chamber_controller: EngineCompressionChamberController::new(
                3., 2., 4.,
            ),
            fan_compression_chamber: CompressionChamber::new(Volume::new::<cubic_meter>(1.)),
            intermediate_pressure_compression_chamber: CompressionChamber::new(Volume::new::<
                cubic_meter,
            >(1.)),
            high_pressure_compression_chamber: CompressionChamber::new(Volume::new::<cubic_meter>(
                1.,
            )),
            intermediate_pressure_valve: PurelyPneumaticValve::new(),
            high_pressure_valve: ElectroPneumaticValve::new(powered_by),
            pressure_regulating_valve: ElectroPneumaticValve::new(powered_by),
            fan_air_valve: ElectroPneumaticValve::new(powered_by),
            transfer_pressure_pipe: PneumaticPipe::new(
                Volume::new::<cubic_meter>(1.),
                Pressure::new::<psi>(14.7),
                ThermodynamicTemperature::new::<degree_celsius>(15.),
            ),
            precooler_inlet_pipe: PneumaticPipe::new(
                Volume::new::<cubic_meter>(0.5),
                Pressure::new::<psi>(14.7),
                ThermodynamicTemperature::new::<degree_celsius>(15.),
            ),
            precooler_outlet_pipe: PneumaticPipe::new(
                Volume::new::<cubic_meter>(2.5),
                Pressure::new::<psi>(14.7),
                ThermodynamicTemperature::new::<degree_celsius>(15.),
            ),
            precooler_supply_pipe: PneumaticPipe::new(
                Volume::new::<cubic_meter>(1.),
                Pressure::new::<psi>(14.7),
                ThermodynamicTemperature::new::<degree_celsius>(15.),
            ),
            engine_starter_container: PneumaticPipe::new(
                Volume::new::<cubic_meter>(0.5),
                Pressure::new::<psi>(14.7),
                ThermodynamicTemperature::new::<degree_celsius>(15.),
            ),
            engine_starter_exhaust: PneumaticExhaust::new(3e-2, 3e-2, Pressure::new::<psi>(0.)),
            engine_starter_valve: DefaultValve::new_closed(),
            precooler: Precooler::new(180. * 2.),
        }
    }

    fn update(
        &mut self,
        context: &UpdateContext,
        high_pressure_valve_controller: &impl ControllerSignal<HighPressureValveSignal>,
        pressure_regulating_valve_controller: &impl ControllerSignal<PressureRegulatingValveSignal>,
        engine_starter_valve_controller: &impl ControllerSignal<EngineStarterValveSignal>,
        fan_air_valve_controller: &impl ControllerSignal<FanAirValveSignal>,
        engine: &(impl EngineCorrectedN1 + EngineCorrectedN2),
    ) {
        // Update engines
        self.fan_compression_chamber_controller
            .update(context, engine);
        self.intermediate_pressure_compression_chamber_controller
            .update(context, engine);
        self.high_pressure_compression_chamber_controller
            .update(context, engine);

        self.fan_compression_chamber
            .update(&self.fan_compression_chamber_controller);
        self.intermediate_pressure_compression_chamber
            .update(&self.intermediate_pressure_compression_chamber_controller);
        self.high_pressure_compression_chamber
            .update(&self.high_pressure_compression_chamber_controller);

        self.high_pressure_valve
            .update_open_amount(high_pressure_valve_controller);
        self.pressure_regulating_valve
            .update_open_amount(pressure_regulating_valve_controller);
        self.engine_starter_valve
            .update_open_amount(engine_starter_valve_controller);
        self.fan_air_valve
            .update_open_amount(fan_air_valve_controller);

        self.intermediate_pressure_valve.update_move_fluid(
            context,
            &mut self.intermediate_pressure_compression_chamber,
            &mut self.transfer_pressure_pipe,
        );
        self.high_pressure_valve.update_move_fluid(
            context,
            &mut self.high_pressure_compression_chamber,
            &mut self.transfer_pressure_pipe,
        );
        self.fan_air_valve.update_move_fluid(
            context,
            &mut self.fan_compression_chamber,
            &mut self.precooler_supply_pipe,
        );
        self.pressure_regulating_valve.update_move_fluid(
            context,
            &mut self.transfer_pressure_pipe,
            &mut self.precooler_inlet_pipe,
        );
        self.precooler.update(
            context,
            &mut self.precooler_inlet_pipe,
            &mut self.precooler_supply_pipe,
            &mut self.precooler_outlet_pipe,
        );
        self.engine_starter_valve.update_move_fluid(
            context,
            &mut self.precooler_inlet_pipe,
            &mut self.engine_starter_container,
        );
        self.engine_starter_exhaust
            .update_move_fluid(context, &mut self.engine_starter_container)
    }

    fn intermediate_pressure(&self) -> Pressure {
        self.intermediate_pressure_compression_chamber.pressure()
    }

    fn high_pressure(&self) -> Pressure {
        self.high_pressure_compression_chamber.pressure()
    }

    fn transfer_pressure(&self) -> Pressure {
        self.transfer_pressure_pipe.pressure()
    }

    fn precooler_inlet_pressure(&self) -> Pressure {
        self.precooler_inlet_pipe.pressure()
    }

    fn precooler_outlet_pressure(&self) -> Pressure {
        self.precooler_outlet_pipe.pressure()
    }

    fn intermediate_temperature(&self) -> ThermodynamicTemperature {
        self.intermediate_pressure_compression_chamber.temperature()
    }

    fn high_temperature(&self) -> ThermodynamicTemperature {
        self.high_pressure_compression_chamber.temperature()
    }

    fn transfer_temperature(&self) -> ThermodynamicTemperature {
        self.transfer_pressure_pipe.temperature()
    }

    fn precooler_inlet_temperature(&self) -> ThermodynamicTemperature {
        self.precooler_inlet_pipe.temperature()
    }

    fn precooler_outlet_temperature(&self) -> ThermodynamicTemperature {
        self.precooler_outlet_pipe.temperature()
    }

    fn engine_starter_valve_is_open(&self) -> bool {
        self.engine_starter_valve.is_open()
    }

    fn pressure_regulating_valve_is_open(&self) -> bool {
        self.pressure_regulating_valve.is_open()
    }
}
impl SimulationElement for EngineBleedAirSystem {
    fn accept<T: SimulationElementVisitor>(&mut self, visitor: &mut T) {
        self.high_pressure_valve.accept(visitor);
        self.pressure_regulating_valve.accept(visitor);
        self.fan_air_valve.accept(visitor);

        visitor.visit(self);
    }

    fn write(&self, writer: &mut SimulatorWriter) {
        writer.write(&self.intermediate_pressure_id, self.intermediate_pressure());
        writer.write(&self.high_pressure_id, self.high_pressure());
        writer.write(&self.transfer_pressure_id, self.transfer_pressure());
        writer.write(
            &self.precooler_inlet_pressure_id,
            self.precooler_inlet_pressure(),
        );
        writer.write(
            &self.precooler_outlet_pressure_id,
            self.precooler_outlet_pressure(),
        );
        writer.write(
            &self.starter_container_pressure_id,
            self.engine_starter_container.pressure(),
        );
        writer.write(
            &self.intermediate_temperature_id,
            self.intermediate_temperature(),
        );
        writer.write(&self.high_temperature_id, self.high_temperature());
        writer.write(&self.transfer_temperature_id, self.transfer_temperature());
        writer.write(
            &self.precooler_inlet_temperature_id,
            self.precooler_inlet_temperature(),
        );
        writer.write(
            &self.precooler_outlet_temperature_id,
            self.precooler_outlet_temperature(),
        );
        writer.write(
            &self.starter_container_temperature_id,
            self.engine_starter_container.temperature(),
        );
        writer.write(
            &self.intermediate_pressure_valve_open_id,
            self.intermediate_pressure_valve.is_open(),
        );
        writer.write(
            &self.high_pressure_valve_open_id,
            self.high_pressure_valve.is_open(),
        );
        writer.write(
            &self.pressure_regulating_valve_open_id,
            self.pressure_regulating_valve.is_open(),
        );
        writer.write(
            &self.starter_valve_open_id,
            self.engine_starter_valve.is_open(),
        );
    }
}
impl PneumaticContainer for EngineBleedAirSystem {
    fn pressure(&self) -> Pressure {
        self.precooler_outlet_pipe.pressure()
    }

    fn volume(&self) -> Volume {
        self.precooler_outlet_pipe.volume()
    }

    fn temperature(&self) -> ThermodynamicTemperature {
        self.precooler_outlet_pipe.temperature()
    }

    fn mass(&self) -> Mass {
        self.precooler_outlet_pipe.mass()
    }

    fn change_fluid_amount(
        &mut self,
        fluid_amount: Mass,
        fluid_temperature: ThermodynamicTemperature,
        fluid_pressure: Pressure,
    ) {
        self.precooler_outlet_pipe.change_fluid_amount(
            fluid_amount,
            fluid_temperature,
            fluid_pressure,
        )
    }

    fn update_temperature(&mut self, temperature: TemperatureInterval) {
        self.precooler_outlet_pipe.update_temperature(temperature);
    }
}

pub struct A320PneumaticOverheadPanel {
    apu_bleed: OnOffFaultPushButton,
    cross_bleed: CrossBleedValveSelectorKnob,
    engine_1_bleed: AutoOffFaultPushButton,
    engine_2_bleed: AutoOffFaultPushButton,
    wing_anti_ice: WingAntiIcePushButton,
}
impl A320PneumaticOverheadPanel {
    pub fn new(context: &mut InitContext) -> Self {
        A320PneumaticOverheadPanel {
            apu_bleed: OnOffFaultPushButton::new_on(context, "PNEU_APU_BLEED"),
            cross_bleed: CrossBleedValveSelectorKnob::new_auto(context),
            engine_1_bleed: AutoOffFaultPushButton::new_auto(context, "PNEU_ENG_1_BLEED"),
            engine_2_bleed: AutoOffFaultPushButton::new_auto(context, "PNEU_ENG_2_BLEED"),
            wing_anti_ice: WingAntiIcePushButton::new_off(context),
        }
    }

    pub fn apu_bleed_is_on(&self) -> bool {
        self.apu_bleed.is_on()
    }

    pub fn cross_bleed_mode(&self) -> CrossBleedValveSelectorMode {
        self.cross_bleed.mode()
    }

    pub fn engine_bleed_pb_is_auto(&self, engine_number: usize) -> bool {
        match engine_number {
            1 => self.engine_1_bleed.is_auto(),
            2 => self.engine_2_bleed.is_auto(),
            _ => panic!("Invalid engine number"),
        }
    }
}
impl EngineBleedPushbutton for A320PneumaticOverheadPanel {
    fn engine_bleed_pushbuttons_are_auto(&self) -> [bool; 2] {
        [self.engine_1_bleed.is_auto(), self.engine_2_bleed.is_auto()]
    }
}
impl SimulationElement for A320PneumaticOverheadPanel {
    fn accept<T: SimulationElementVisitor>(&mut self, visitor: &mut T) {
        self.apu_bleed.accept(visitor);
        self.cross_bleed.accept(visitor);
        self.engine_1_bleed.accept(visitor);
        self.engine_2_bleed.accept(visitor);
        self.wing_anti_ice.accept(visitor);

        visitor.visit(self);
    }
}

/// We use this simply as an interface to engine parameter simvars. It should probably not be part of the pneumatic system.
pub struct FullAuthorityDigitalEngineControl {
    engine_1_state_id: VariableIdentifier,
    engine_2_state_id: VariableIdentifier,

    engine_1_state: EngineState,
    engine_2_state: EngineState,

    engine_mode_selector1_id: VariableIdentifier,
    engine_mode_selector1_position: EngineModeSelector,
}
impl FullAuthorityDigitalEngineControl {
    fn new(context: &mut InitContext) -> Self {
        Self {
            engine_1_state_id: context.get_identifier("ENGINE_STATE:1".to_owned()),
            engine_2_state_id: context.get_identifier("ENGINE_STATE:2".to_owned()),
            engine_1_state: EngineState::Off,
            engine_2_state: EngineState::Off,
            engine_mode_selector1_id: context
                .get_identifier("TURB ENG IGNITION SWITCH EX1:1".to_owned()),
            engine_mode_selector1_position: EngineModeSelector::Norm,
        }
    }

    fn engine_state(&self, number: usize) -> EngineState {
        match number {
            1 => self.engine_1_state,
            2 => self.engine_2_state,
            _ => panic!("Invalid engine number"),
        }
    }

    fn is_single_vs_dual_bleed_config(&self) -> bool {
        (self.engine_1_state == EngineState::On) ^ (self.engine_2_state == EngineState::On)
    }

    fn engine_mode_selector(&self) -> EngineModeSelector {
        self.engine_mode_selector1_position
    }
}
impl SimulationElement for FullAuthorityDigitalEngineControl {
    fn read(&mut self, reader: &mut SimulatorReader) {
        self.engine_1_state = reader.read(&self.engine_1_state_id);
        self.engine_2_state = reader.read(&self.engine_2_state_id);
        self.engine_mode_selector1_position = reader.read(&self.engine_mode_selector1_id);
    }
}

/// A struct to hold all the pack related components
struct PackComplex {
    engine_number: usize,
    pack_flow_valve_id: VariableIdentifier,
    pack_flow_valve_flow_rate_id: VariableIdentifier,
    pack_container: PneumaticPipe,
    exhaust: PneumaticExhaust,
    pack_flow_valve: DefaultValve,
}
impl PackComplex {
    fn new(context: &mut InitContext, engine_number: usize) -> Self {
        Self {
            engine_number,
            pack_flow_valve_id: context.get_identifier(Self::pack_flow_valve_id(engine_number)),
            pack_flow_valve_flow_rate_id: context
                .get_identifier(format!("PNEU_PACK_{}_FLOW_VALVE_FLOW_RATE", engine_number)),
            pack_container: PneumaticPipe::new(
                Volume::new::<cubic_meter>(2.),
                Pressure::new::<psi>(14.7),
                ThermodynamicTemperature::new::<degree_celsius>(15.),
            ),
            exhaust: PneumaticExhaust::new(0.3, 0.3, Pressure::new::<psi>(0.)),
            pack_flow_valve: DefaultValve::new_closed(),
        }
    }

    fn pack_flow_valve_id(number: usize) -> String {
        format!("COND_PACK_FLOW_VALVE_{}_IS_OPEN", number)
    }

    fn update(
        &mut self,
        context: &UpdateContext,
        from: &mut impl PneumaticContainer,
        pack_flow_valve_signals: &impl PackFlowControllers<3>,
    ) {
        self.pack_flow_valve.update_open_amount(
            &pack_flow_valve_signals.pack_flow_controller(self.engine_number.into()),
        );

        self.pack_flow_valve
            .update_move_fluid(context, from, &mut self.pack_container);

        self.exhaust
            .update_move_fluid(context, &mut self.pack_container);
    }

    fn pack_flow_valve_open_amount(&self) -> Ratio {
        self.pack_flow_valve.open_amount()
    }

    fn pack_flow_valve_air_flow(&self) -> MassRate {
        self.pack_flow_valve.fluid_flow()
    }
}
impl PneumaticContainer for PackComplex {
    fn pressure(&self) -> Pressure {
        self.pack_container.pressure()
    }

    fn volume(&self) -> Volume {
        self.pack_container.volume()
    }

    fn temperature(&self) -> ThermodynamicTemperature {
        self.pack_container.temperature()
    }

    fn mass(&self) -> Mass {
        self.pack_container.mass()
    }

    fn change_fluid_amount(
        &mut self,
        fluid_amount: Mass,
        fluid_temperature: ThermodynamicTemperature,
        fluid_pressure: Pressure,
    ) {
        self.pack_container
            .change_fluid_amount(fluid_amount, fluid_temperature, fluid_pressure);
    }

    fn update_temperature(&mut self, temperature_change: TemperatureInterval) {
        self.pack_container.update_temperature(temperature_change);
    }
}
impl SimulationElement for PackComplex {
    fn write(&self, writer: &mut SimulatorWriter) {
        writer.write(
            &self.pack_flow_valve_id,
            self.pack_flow_valve_open_amount() > Ratio::new::<ratio>(0.),
        );
        writer.write(
            &self.pack_flow_valve_flow_rate_id,
            self.pack_flow_valve.fluid_flow(),
        );
    }
}

/// This is a unique valve (and specific to the A320 probably) because it is controlled by two motors. One for manual control and one for automatic control
pub struct CrossBleedValve {
    open_amount: Ratio,
    connector: PneumaticContainerConnector,
    is_powered_for_manual_control: bool,
    is_powered_for_automatic_control: bool,
}
impl CrossBleedValve {
    const SPRING_CHARACTERISTIC: f64 = 1.;

    pub fn new() -> Self {
        Self {
            open_amount: Ratio::new::<ratio>(0.),
            connector: PneumaticContainerConnector::new(),
            is_powered_for_manual_control: false,
            is_powered_for_automatic_control: false,
        }
    }

    pub fn update_move_fluid(
        &mut self,
        context: &UpdateContext,
        container_one: &mut impl PneumaticContainer,
        container_two: &mut impl PneumaticContainer,
    ) {
        if !self.is_powered_for_manual_control && !self.is_powered_for_automatic_control {
            self.set_open_amount_from_pressure_difference(
                container_one.pressure() - container_two.pressure(),
            )
        }

        self.connector
            .with_transfer_speed_factor(self.open_amount)
            .update_move_fluid(context, container_one, container_two);
    }

    fn set_open_amount_from_pressure_difference(&mut self, pressure_difference: Pressure) {
        self.open_amount = Ratio::new::<ratio>(
            2. / PI
                * (pressure_difference.get::<psi>() * Self::SPRING_CHARACTERISTIC)
                    .atan()
                    .max(0.),
        );
    }

    fn update_open_amount(&mut self, controller: &impl ControllerSignal<CrossBleedValveSignal>) {
        if let Some(signal) = controller.signal() {
            if signal.signal_type == CrossBleedValveSignalType::Manual
                && self.is_powered_for_manual_control
                || signal.signal_type == CrossBleedValveSignalType::Automatic
                    && self.is_powered_for_automatic_control
            {
                self.open_amount = signal.target_open_amount()
            }
        }
    }
}
impl PneumaticValve for CrossBleedValve {
    fn is_open(&self) -> bool {
        self.open_amount.get::<ratio>() > 0.
    }
}
impl SimulationElement for CrossBleedValve {
    fn receive_power(&mut self, buses: &impl ElectricalBuses) {
        self.is_powered_for_manual_control =
            buses.is_powered(ElectricalBusType::DirectCurrentEssentialShed);
        self.is_powered_for_automatic_control =
            buses.is_powered(ElectricalBusType::DirectCurrent(2));
    }
}

#[cfg(test)]
mod tests {
    use systems::{
        air_conditioning::{
            acs_controller::{Pack, PackFlowController},
            AirConditioningSystem, PackFlowControllers, ZoneType,
        },
        electrical::{test::TestElectricitySource, ElectricalBus, Electricity},
        engine::leap_engine::LeapEngine,
        failures::FailureType,
        pneumatic::{
            BleedMonitoringComputerChannelOperationMode, ControllablePneumaticValve,
            CrossBleedValveSelectorMode, EngineState, PneumaticContainer, PneumaticValveSignal,
            TargetPressureTemperatureSignal, WingAntiIcePushButtonMode,
        },
        pressurization::PressurizationOverheadPanel,
        shared::{
            ApuBleedAirValveSignal, Cabin, ControllerSignal, ElectricalBusType, ElectricalBuses,
            EmergencyElectricalState, EngineBleedPushbutton, EngineCorrectedN1,
            EngineFirePushButtons, EngineStartState, GroundSpeed, HydraulicColor,
            InternationalStandardAtmosphere, LgciuWeightOnWheels, MachNumber, PackFlowValveState,
            PneumaticBleed, PneumaticValve, PotentialOrigin,
        },
        simulation::{
            test::{ReadByName, SimulationTestBed, TestBed, WriteByName},
            Aircraft, InitContext, SimulationElement, SimulationElementVisitor, UpdateContext,
        },
    };

    use std::{fs, fs::File, time::Duration};

    use uom::si::{
        f64::*,
        length::foot,
        mass_rate::kilogram_per_second,
        pressure::{pascal, psi},
        ratio::ratio,
        thermodynamic_temperature::degree_celsius,
        velocity::knot,
    };

    use super::{A320Pneumatic, A320PneumaticOverheadPanel};

    struct TestAirConditioning {
        a320_air_conditioning_system: AirConditioningSystem<3>,
        adirs: TestAdirs,
        pressurization: TestPressurization,
        pressurization_overhead: PressurizationOverheadPanel,
    }
    impl TestAirConditioning {
        fn new(context: &mut InitContext) -> Self {
            let cabin_zones: [ZoneType; 3] =
                [ZoneType::Cockpit, ZoneType::Cabin(1), ZoneType::Cabin(2)];

            Self {
                a320_air_conditioning_system: AirConditioningSystem::new(
                    context,
                    cabin_zones,
                    vec![ElectricalBusType::DirectCurrent(1)],
                    vec![ElectricalBusType::DirectCurrent(2)],
                ),
                adirs: TestAdirs::new(),
                pressurization: TestPressurization::new(),
                pressurization_overhead: PressurizationOverheadPanel::new(context),
            }
        }
        fn update(
            &mut self,
            context: &UpdateContext,
            engines: [&impl EngineCorrectedN1; 2],
            engine_fire_push_buttons: &impl EngineFirePushButtons,
            pneumatic: &(impl EngineStartState + PackFlowValveState + PneumaticBleed),
            pneumatic_overhead: &impl EngineBleedPushbutton,
            lgciu: [&impl LgciuWeightOnWheels; 2],
        ) {
            self.a320_air_conditioning_system.update(
                context,
                &self.adirs,
                engines,
                engine_fire_push_buttons,
                pneumatic,
                pneumatic_overhead,
                &self.pressurization,
                &self.pressurization_overhead,
                lgciu,
            );
        }
    }
    impl PackFlowControllers<3> for TestAirConditioning {
        fn pack_flow_controller(&self, pack_id: Pack) -> PackFlowController<3> {
            self.a320_air_conditioning_system
                .pack_flow_controller(pack_id)
        }
    }
    impl SimulationElement for TestAirConditioning {
        fn accept<V: SimulationElementVisitor>(&mut self, visitor: &mut V) {
            self.a320_air_conditioning_system.accept(visitor);

            visitor.visit(self);
        }
    }

    struct TestAdirs {
        ground_speed: Velocity,
    }
    impl TestAdirs {
        fn new() -> Self {
            Self {
                ground_speed: Velocity::new::<knot>(0.),
            }
        }
    }
    impl GroundSpeed for TestAdirs {
        fn ground_speed(&self) -> Velocity {
            self.ground_speed
        }
    }

    struct TestPressurization {
        cabin_pressure: Pressure,
    }
    impl TestPressurization {
        fn new() -> Self {
            Self {
                cabin_pressure: Pressure::new::<pascal>(101315.),
            }
        }
    }
    impl Cabin for TestPressurization {
        fn altitude(&self) -> Length {
            Length::new::<foot>(0.)
        }

        fn pressure(&self) -> Pressure {
            self.cabin_pressure
        }
    }

    struct TestLgciu {
        compressed: bool,
    }
    impl TestLgciu {
        fn new(compressed: bool) -> Self {
            Self { compressed }
        }

        pub fn set_on_ground(&mut self, is_on_ground: bool) {
            self.compressed = is_on_ground;
        }
    }
    impl LgciuWeightOnWheels for TestLgciu {
        fn left_and_right_gear_compressed(&self, _treat_ext_pwr_as_ground: bool) -> bool {
            self.compressed
        }
        fn right_gear_compressed(&self, _treat_ext_pwr_as_ground: bool) -> bool {
            self.compressed
        }
        fn right_gear_extended(&self, _treat_ext_pwr_as_ground: bool) -> bool {
            !self.compressed
        }
        fn left_gear_compressed(&self, _treat_ext_pwr_as_ground: bool) -> bool {
            self.compressed
        }
        fn left_gear_extended(&self, _treat_ext_pwr_as_ground: bool) -> bool {
            !self.compressed
        }
        fn left_and_right_gear_extended(&self, _treat_ext_pwr_as_ground: bool) -> bool {
            !self.compressed
        }
        fn nose_gear_compressed(&self, _treat_ext_pwr_as_ground: bool) -> bool {
            self.compressed
        }
        fn nose_gear_extended(&self, _treat_ext_pwr_as_ground: bool) -> bool {
            !self.compressed
        }
    }

    struct TestApu {
        bleed_air_valve_signal: ApuBleedAirValveSignal,
        bleed_air_pressure: Pressure,
        bleed_air_temperature: ThermodynamicTemperature,
    }
    impl TestApu {
        fn new() -> Self {
            Self {
                bleed_air_valve_signal: ApuBleedAirValveSignal::new_closed(),
                bleed_air_pressure: Pressure::new::<psi>(14.7),
                bleed_air_temperature: ThermodynamicTemperature::new::<degree_celsius>(15.),
            }
        }

        fn update(&self, bleed_valve: &mut impl ControllablePneumaticValve) {
            bleed_valve.update_open_amount::<ApuBleedAirValveSignal, Self>(self);
        }

        fn set_bleed_air_pressure(&mut self, pressure: Pressure) {
            self.bleed_air_pressure = pressure;
        }

        fn set_bleed_air_temperature(&mut self, temperature: ThermodynamicTemperature) {
            self.bleed_air_temperature = temperature;
        }

        fn set_bleed_air_valve_signal(&mut self, signal: ApuBleedAirValveSignal) {
            self.bleed_air_valve_signal = signal;
        }
    }
    impl ControllerSignal<ApuBleedAirValveSignal> for TestApu {
        fn signal(&self) -> Option<ApuBleedAirValveSignal> {
            Some(self.bleed_air_valve_signal)
        }
    }
    impl ControllerSignal<TargetPressureTemperatureSignal> for TestApu {
        fn signal(&self) -> Option<TargetPressureTemperatureSignal> {
            Some(TargetPressureTemperatureSignal::new(
                self.bleed_air_pressure,
                self.bleed_air_temperature,
            ))
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

    struct A320TestElectrical {
        airspeed: Velocity,
        all_ac_lost: bool,
    }
    impl A320TestElectrical {
        pub fn new() -> Self {
            A320TestElectrical {
                airspeed: Velocity::new::<knot>(100.),
                all_ac_lost: false,
            }
        }

        fn update(&mut self, context: &UpdateContext) {
            self.airspeed = context.indicated_airspeed();
        }
    }
    impl EmergencyElectricalState for A320TestElectrical {
        fn is_in_emergency_elec(&self) -> bool {
            self.all_ac_lost && self.airspeed >= Velocity::new::<knot>(100.)
        }
    }
    impl SimulationElement for A320TestElectrical {
        fn receive_power(&mut self, buses: &impl ElectricalBuses) {
            self.all_ac_lost = !buses.is_powered(ElectricalBusType::AlternatingCurrent(1))
                && !buses.is_powered(ElectricalBusType::AlternatingCurrent(2));
        }
    }

    struct PneumaticTestAircraft {
        pneumatic: A320Pneumatic,
        air_conditioning: TestAirConditioning,
        lgciu: TestLgciu,
        apu: TestApu,
        engine_1: LeapEngine,
        engine_2: LeapEngine,
        pneumatic_overhead_panel: A320PneumaticOverheadPanel,
        fire_pushbuttons: TestEngineFirePushButtons,
        electrical: A320TestElectrical,
        powered_source: TestElectricitySource,
        dc_1_bus: ElectricalBus,
        dc_2_bus: ElectricalBus,
        dc_ess_bus: ElectricalBus,
        dc_ess_shed_bus: ElectricalBus,
        // Electric buses states to be able to kill them dynamically
        is_dc_1_powered: bool,
        is_dc_2_powered: bool,
        is_dc_ess_powered: bool,
        is_dc_ess_shed_powered: bool,
    }
    impl PneumaticTestAircraft {
        fn new(context: &mut InitContext) -> Self {
            Self {
                pneumatic: A320Pneumatic::new(context),
                air_conditioning: TestAirConditioning::new(context),
                lgciu: TestLgciu::new(true),
                apu: TestApu::new(),
                engine_1: LeapEngine::new(context, 1),
                engine_2: LeapEngine::new(context, 2),
                pneumatic_overhead_panel: A320PneumaticOverheadPanel::new(context),
                fire_pushbuttons: TestEngineFirePushButtons::new(),
                electrical: A320TestElectrical::new(),
                powered_source: TestElectricitySource::powered(
                    context,
                    PotentialOrigin::EngineGenerator(1),
                ),
                dc_1_bus: ElectricalBus::new(context, ElectricalBusType::DirectCurrent(1)),
                dc_2_bus: ElectricalBus::new(context, ElectricalBusType::DirectCurrent(2)),
                dc_ess_bus: ElectricalBus::new(context, ElectricalBusType::DirectCurrentEssential),
                dc_ess_shed_bus: ElectricalBus::new(
                    context,
                    ElectricalBusType::DirectCurrentEssentialShed,
                ),
                is_dc_1_powered: true,
                is_dc_2_powered: true,
                is_dc_ess_powered: true,
                is_dc_ess_shed_powered: true,
            }
        }

        fn set_dc_2_bus_power(&mut self, is_powered: bool) {
            self.is_dc_2_powered = is_powered;
        }

        fn set_dc_ess_shed_bus_power(&mut self, is_powered: bool) {
            self.is_dc_ess_shed_powered = is_powered;
        }
    }
    impl Aircraft for PneumaticTestAircraft {
        fn update_before_power_distribution(
            &mut self,
            _context: &UpdateContext,
            electricity: &mut Electricity,
        ) {
            electricity.supplied_by(&self.powered_source);

            if self.is_dc_1_powered {
                electricity.flow(&self.powered_source, &self.dc_1_bus);
            }

            if self.is_dc_2_powered {
                electricity.flow(&self.powered_source, &self.dc_2_bus);
            }

            if self.is_dc_ess_powered {
                electricity.flow(&self.powered_source, &self.dc_ess_bus);
            }

            if self.is_dc_ess_shed_powered {
                electricity.flow(&self.powered_source, &self.dc_ess_shed_bus);
            }
        }

        fn update_after_power_distribution(&mut self, context: &UpdateContext) {
            self.electrical.update(context);

            self.apu.update(self.pneumatic.apu_bleed_air_valve());
            self.pneumatic.update(
                context,
                [&self.engine_1, &self.engine_2],
                &self.pneumatic_overhead_panel,
                &self.fire_pushbuttons,
                &self.apu,
                &self.air_conditioning,
                [&self.lgciu; 2],
            );
            self.air_conditioning.update(
                context,
                [&self.engine_1, &self.engine_2],
                &self.fire_pushbuttons,
                &self.pneumatic,
                &self.pneumatic_overhead_panel,
                [&self.lgciu; 2],
            )
        }
    }
    impl SimulationElement for PneumaticTestAircraft {
        fn accept<T: SimulationElementVisitor>(&mut self, visitor: &mut T) {
            self.electrical.accept(visitor);
            self.pneumatic.accept(visitor);
            self.engine_1.accept(visitor);
            self.engine_2.accept(visitor);
            self.pneumatic_overhead_panel.accept(visitor);
            self.air_conditioning.accept(visitor);

            visitor.visit(self);
        }
    }
    struct PneumaticTestBed {
        test_bed: SimulationTestBed<PneumaticTestAircraft>,
    }
    impl TestBed for PneumaticTestBed {
        type Aircraft = PneumaticTestAircraft;

        fn test_bed(&self) -> &SimulationTestBed<PneumaticTestAircraft> {
            &self.test_bed
        }

        fn test_bed_mut(&mut self) -> &mut SimulationTestBed<PneumaticTestAircraft> {
            &mut self.test_bed
        }
    }
    impl PneumaticTestBed {
        fn new() -> Self {
            let mut test_bed = Self {
                test_bed: SimulationTestBed::<PneumaticTestAircraft>::new(|context| {
                    PneumaticTestAircraft::new(context)
                }),
            };
            test_bed.command_pack_flow_selector_position(1);

            test_bed
        }

        fn and_run(mut self) -> Self {
            self.run();

            self
        }

        fn and_stabilize(mut self) -> Self {
            self.test_bed.run_multiple_frames(Duration::from_secs(16));

            self
        }

        fn mach_number(mut self, mach: MachNumber) -> Self {
            self.write_by_name("AIRSPEED MACH", mach);

            self
        }

        fn in_isa_atmosphere(mut self, altitude: Length) -> Self {
            self.set_ambient_pressure(InternationalStandardAtmosphere::pressure_at_altitude(
                altitude,
            ));
            self.set_ambient_temperature(InternationalStandardAtmosphere::temperature_at_altitude(
                altitude,
            ));

            self
        }

        fn idle_eng1(mut self) -> Self {
            self.write_by_name("GENERAL ENG STARTER ACTIVE:1", true);
            self.write_by_name("TURB ENG CORRECTED N2:1", Ratio::new::<ratio>(0.55));
            self.write_by_name("TURB ENG CORRECTED N1:1", Ratio::new::<ratio>(0.2));
            self.write_by_name("ENGINE_STATE:1", EngineState::On);

            self
        }

        fn idle_eng2(mut self) -> Self {
            self.write_by_name("GENERAL ENG STARTER ACTIVE:2", true);
            self.write_by_name("TURB ENG CORRECTED N2:2", Ratio::new::<ratio>(0.55));
            self.write_by_name("TURB ENG CORRECTED N1:2", Ratio::new::<ratio>(0.2));
            self.write_by_name("ENGINE_STATE:2", EngineState::On);

            self
        }

        fn toga_eng1(mut self) -> Self {
            self.write_by_name("GENERAL ENG STARTER ACTIVE:1", true);
            self.write_by_name("TURB ENG CORRECTED N2:1", Ratio::new::<ratio>(0.65));
            self.write_by_name("TURB ENG CORRECTED N1:1", Ratio::new::<ratio>(0.99));
            self.write_by_name("ENGINE_STATE:1", EngineState::On);

            self
        }

        fn toga_eng2(mut self) -> Self {
            self.write_by_name("GENERAL ENG STARTER ACTIVE:2", true);
            self.write_by_name("TURB ENG CORRECTED N2:2", Ratio::new::<ratio>(0.65));
            self.write_by_name("TURB ENG CORRECTED N1:2", Ratio::new::<ratio>(0.99));
            self.write_by_name("ENGINE_STATE:2", EngineState::On);

            self
        }

        fn holding_eng1(mut self) -> Self {
            self.write_by_name("GENERAL ENG STARTER ACTIVE:1", true);
            self.write_by_name("TURB ENG CORRECTED N2:1", Ratio::new::<ratio>(0.92));
            self.write_by_name("TURB ENG CORRECTED N1:1", Ratio::new::<ratio>(0.5));
            self.write_by_name("ENGINE_STATE:1", EngineState::On);

            self
        }

        fn holding_eng2(mut self) -> Self {
            self.write_by_name("GENERAL ENG STARTER ACTIVE:2", true);
            self.write_by_name("TURB ENG CORRECTED N2:2", Ratio::new::<ratio>(0.92));
            self.write_by_name("TURB ENG CORRECTED N1:2", Ratio::new::<ratio>(0.5));
            self.write_by_name("ENGINE_STATE:2", EngineState::On);

            self
        }

        fn stop_eng1(mut self) -> Self {
            self.write_by_name("GENERAL ENG STARTER ACTIVE:1", false);
            self.write_by_name("TURB ENG CORRECTED N2:1", Ratio::new::<ratio>(0.));
            self.write_by_name("TURB ENG CORRECTED N1:1", Ratio::new::<ratio>(0.));
            self.write_by_name("ENGINE_STATE:1", EngineState::Off);

            self
        }

        fn stop_eng2(mut self) -> Self {
            self.write_by_name("GENERAL ENG STARTER ACTIVE:2", false);
            self.write_by_name("TURB ENG CORRECTED N2:2", Ratio::new::<ratio>(0.));
            self.write_by_name("TURB ENG CORRECTED N1:2", Ratio::new::<ratio>(0.));
            self.write_by_name("ENGINE_STATE:2", EngineState::Off);

            self
        }

        fn start_eng1(mut self) -> Self {
            self.write_by_name("GENERAL ENG STARTER ACTIVE:1", true);
            self.write_by_name("ENGINE_STATE:1", EngineState::Starting);

            self
        }

        fn start_eng2(mut self) -> Self {
            self.write_by_name("GENERAL ENG STARTER ACTIVE:2", true);
            self.write_by_name("ENGINE_STATE:2", EngineState::Starting);

            self
        }

        fn cross_bleed_valve_selector_knob(mut self, mode: CrossBleedValveSelectorMode) -> Self {
            self.write_by_name("KNOB_OVHD_AIRCOND_XBLEED_Position", mode);

            self
        }

        fn ip_pressure(&self, number: usize) -> Pressure {
            self.query(|a| a.pneumatic.engine_systems[number - 1].intermediate_pressure())
        }

        fn hp_pressure(&self, number: usize) -> Pressure {
            self.query(|a| a.pneumatic.engine_systems[number - 1].high_pressure())
        }

        fn transfer_pressure(&self, number: usize) -> Pressure {
            self.query(|a| a.pneumatic.engine_systems[number - 1].transfer_pressure())
        }

        fn precooler_inlet_pressure(&self, number: usize) -> Pressure {
            self.query(|a| a.pneumatic.engine_systems[number - 1].precooler_inlet_pressure())
        }

        fn precooler_outlet_pressure(&self, number: usize) -> Pressure {
            self.query(|a| a.pneumatic.engine_systems[number - 1].precooler_outlet_pressure())
        }

        fn precooler_supply_pressure(&self, number: usize) -> Pressure {
            self.query(|a| {
                a.pneumatic.engine_systems[number - 1]
                    .precooler_supply_pipe
                    .pressure()
            })
        }

        fn engine_starter_container_pressure(&self, number: usize) -> Pressure {
            self.query(|a| {
                a.pneumatic.engine_systems[number - 1]
                    .engine_starter_container
                    .pressure()
            })
        }

        fn ip_temperature(&self, number: usize) -> ThermodynamicTemperature {
            self.query(|a| a.pneumatic.engine_systems[number - 1].intermediate_temperature())
        }

        fn hp_temperature(&self, number: usize) -> ThermodynamicTemperature {
            self.query(|a| a.pneumatic.engine_systems[number - 1].high_temperature())
        }

        fn transfer_temperature(&self, number: usize) -> ThermodynamicTemperature {
            self.query(|a| a.pneumatic.engine_systems[number - 1].transfer_temperature())
        }

        fn precooler_inlet_temperature(&self, number: usize) -> ThermodynamicTemperature {
            self.query(|a| a.pneumatic.engine_systems[number - 1].precooler_inlet_temperature())
        }

        fn precooler_outlet_temperature(&self, number: usize) -> ThermodynamicTemperature {
            self.query(|a| a.pneumatic.engine_systems[number - 1].precooler_outlet_temperature())
        }

        fn precooler_supply_temperature(&self, number: usize) -> ThermodynamicTemperature {
            self.query(|a| {
                a.pneumatic.engine_systems[number - 1]
                    .precooler_supply_pipe
                    .temperature()
            })
        }

        fn engine_starter_container_temperature(&self, number: usize) -> ThermodynamicTemperature {
            self.query(|a| {
                a.pneumatic.engine_systems[number - 1]
                    .engine_starter_container
                    .temperature()
            })
        }

        fn hp_valve_is_open(&self, number: usize) -> bool {
            self.query(|a| {
                a.pneumatic.engine_systems[number - 1]
                    .high_pressure_valve
                    .is_open()
            })
        }

        fn pr_valve_is_open(&self, number: usize) -> bool {
            self.query(|a| {
                a.pneumatic.engine_systems[number - 1]
                    .pressure_regulating_valve
                    .is_open()
            })
        }

        fn es_valve_is_open(&self, number: usize) -> bool {
            self.query(|a| a.pneumatic.engine_systems[number - 1].engine_starter_valve_is_open())
        }

        fn apu_bleed_valve_is_open(&self) -> bool {
            self.query(|a| a.pneumatic.apu_bleed_air_valve.is_open())
        }

        fn hp_valve_is_powered(&self, number: usize) -> bool {
            self.query(|a| {
                a.pneumatic.engine_systems[number - 1]
                    .high_pressure_valve
                    .is_powered()
            })
        }

        fn pr_valve_is_powered(&self, number: usize) -> bool {
            self.query(|a| {
                a.pneumatic.engine_systems[number - 1]
                    .pressure_regulating_valve
                    .is_powered()
            })
        }

        fn fan_air_valve_is_powered(&self, number: usize) -> bool {
            self.query(|a| {
                a.pneumatic.engine_systems[number - 1]
                    .fan_air_valve
                    .is_powered()
            })
        }

        fn set_engine_bleed_push_button_off(mut self, number: usize) -> Self {
            self.write_by_name(&format!("OVHD_PNEU_ENG_{}_BLEED_PB_IS_AUTO", number), false);

            self
        }

        fn set_apu_bleed_valve_signal(mut self, signal: ApuBleedAirValveSignal) -> Self {
            self.command(|a| a.apu.set_bleed_air_valve_signal(signal));

            self
        }

        fn set_apu_bleed_air_pb(mut self, is_on: bool) -> Self {
            self.write_by_name("OVHD_APU_BLEED_PB_IS_ON", is_on);

            self
        }

        fn set_bleed_air_running(mut self) -> Self {
            self.command(|a| a.apu.set_bleed_air_pressure(Pressure::new::<psi>(42.)));
            self.command(|a| {
                a.apu
                    .set_bleed_air_temperature(ThermodynamicTemperature::new::<degree_celsius>(
                        250.,
                    ))
            });

            self.set_apu_bleed_valve_signal(ApuBleedAirValveSignal::new_open())
                .set_apu_bleed_air_pb(true)
        }

        fn release_fire_pushbutton(mut self, number: usize) -> Self {
            self.command(|a| a.fire_pushbuttons.release(number));

            self
        }

        fn set_engine_state(mut self, number: usize, engine_state: EngineState) -> Self {
            self.write_by_name(&format!("ENGINE_STATE:{}", number), engine_state);

            self
        }

        fn engine_state(&self, number: usize) -> EngineState {
            self.query(|a| a.pneumatic.fadec.engine_state(number))
        }

        fn cross_bleed_valve_is_open(&self) -> bool {
            self.query(|a| a.pneumatic.cross_bleed_valve.is_open())
        }

        fn cross_bleed_valve_selector(&self) -> CrossBleedValveSelectorMode {
            self.query(|a| a.pneumatic_overhead_panel.cross_bleed_mode())
        }

        fn engine_bleed_push_button_is_auto(&self, number: usize) -> bool {
            self.query(|a| a.pneumatic_overhead_panel.engine_bleed_pb_is_auto(number))
        }

        fn green_hydraulic_reservoir_pressure(&self) -> Pressure {
            self.query(|a| a.pneumatic.green_hydraulic_reservoir_with_valve.pressure())
        }

        fn blue_hydraulic_reservoir_pressure(&self) -> Pressure {
            self.query(|a| a.pneumatic.blue_hydraulic_reservoir_with_valve.pressure())
        }

        fn yellow_hydraulic_reservoir_pressure(&self) -> Pressure {
            self.query(|a| a.pneumatic.yellow_hydraulic_reservoir_with_valve.pressure())
        }

        fn set_pack_flow_pb_is_auto(mut self, number: usize, is_auto: bool) -> Self {
            self.write_by_name(&format!("OVHD_COND_PACK_{}_PB_IS_ON", number), is_auto);

            self
        }

        fn pack_flow_valve_is_open(&self, number: usize) -> bool {
            self.query(|a| a.pneumatic.packs[number - 1].pack_flow_valve.is_open())
        }

        fn both_packs_auto(self) -> Self {
            self.set_pack_flow_pb_is_auto(1, true)
                .set_pack_flow_pb_is_auto(2, true)
        }

        fn bmc_operation_mode_for_engine(
            &self,
            bmc_number: usize,
            engine_number: usize,
        ) -> BleedMonitoringComputerChannelOperationMode {
            self.query(|a| {
                let bmc = &a.pneumatic.bleed_monitoring_computers[bmc_number - 1];

                let channel = if bmc_number == engine_number {
                    &bmc.main_channel
                } else {
                    &bmc.backup_channel
                };

                channel.operation_mode()
            })
        }

        fn set_dc_2_bus_power(mut self, is_powered: bool) -> Self {
            self.command(|a| a.set_dc_2_bus_power(is_powered));

            self
        }

        fn set_dc_ess_shed_bus_power(mut self, is_powered: bool) -> Self {
            self.command(|a| a.set_dc_ess_shed_bus_power(is_powered));

            self
        }

        fn bmc_is_powered(&self, bmc_number: usize) -> bool {
            self.query(|a| a.pneumatic.bleed_monitoring_computers[bmc_number - 1].is_powered())
        }

        fn fadec_single_vs_dual_bleed_config(&self) -> bool {
            self.query(|a| a.pneumatic.fadec.is_single_vs_dual_bleed_config())
        }

        fn pack_flow_valve_flow(&self, engine_number: usize) -> MassRate {
            self.query(|a| {
                a.pneumatic.packs[engine_number - 1]
                    .pack_flow_valve
                    .fluid_flow()
            })
        }

        fn pack_pressure(&self, engine_number: usize) -> Pressure {
            self.query(|a| {
                a.pneumatic.packs[engine_number - 1]
                    .pack_container
                    .pressure()
            })
        }

        fn cross_bleed_valve_is_powered_for_automatic_control(&self) -> bool {
            self.query(|a| {
                a.pneumatic
                    .cross_bleed_valve
                    .is_powered_for_automatic_control
            })
        }

        fn cross_bleed_valve_is_powered_for_manual_control(&self) -> bool {
            self.query(|a| a.pneumatic.cross_bleed_valve.is_powered_for_manual_control)
        }

        fn command_pack_flow_selector_position(&mut self, value: u8) {
            self.write_by_name("KNOB_OVHD_AIRCOND_PACKFLOW_Position", value);
        }

        fn set_lgciu_on_ground(&mut self, is_on_ground: bool) {
            self.set_on_ground(is_on_ground);
            self.command(|a| a.lgciu.set_on_ground(is_on_ground));
        }

        fn wing_anti_ice_push_button(mut self, mode: WingAntiIcePushButtonMode) -> Self {
            match mode {
                WingAntiIcePushButtonMode::On => {
                    self.write_by_name("BUTTON_OVHD_ANTI_ICE_WING_POSITION", true)
                }
                _ => self.write_by_name("BUTTON_OVHD_ANTI_ICE_WING_POSITION", false),
            };

            self
        }

        fn wing_anti_ice_system_on(&mut self) -> bool {
            self.read_by_name("PNEU_WING_ANTI_ICE_SYSTEM_ON")
        }

        fn wing_anti_ice_system_selected(&mut self) -> bool {
            self.read_by_name("PNEU_WING_ANTI_ICE_SYSTEM_SELECTED")
        }

        fn wing_anti_ice_has_fault(&mut self) -> bool {
            self.read_by_name("PNEU_WING_ANTI_ICE_HAS_FAULT")
        }

        fn left_precooler_pressurised(&self) -> bool {
            self.query(|a| a.pneumatic.wing_anti_ice.is_precoooler_pressurised(0))
        }

        fn right_precooler_pressurised(&self) -> bool {
            self.query(|a| a.pneumatic.wing_anti_ice.is_precoooler_pressurised(1))
        }

        fn left_wai_pressure(&self) -> Pressure {
            self.query(|a| a.pneumatic.wing_anti_ice.wai_consumer_pressure(0))
        }

        fn right_wai_pressure(&self) -> Pressure {
            self.query(|a| a.pneumatic.wing_anti_ice.wai_consumer_pressure(1))
        }

        fn left_wai_temperature(&self) -> ThermodynamicTemperature {
            self.query(|a| a.pneumatic.wing_anti_ice.wai_consumer_temperature(0))
        }

        fn right_wai_temperature(&self) -> ThermodynamicTemperature {
            self.query(|a| a.pneumatic.wing_anti_ice.wai_consumer_temperature(1))
        }

        fn valve_controller_timer(&self) -> Duration {
            self.query(|a| a.pneumatic.wing_anti_ice.wai_timer())
        }

        fn left_valve_controller_on(&self) -> bool {
            self.query(|a| a.pneumatic.wing_anti_ice.wai_valve_controller_on(0))
        }

        fn right_valve_controller_on(&self) -> bool {
            self.query(|a| a.pneumatic.wing_anti_ice.wai_valve_controller_on(1))
        }

        fn left_valve_closed(&self) -> bool {
            self.query(|a| a.pneumatic.wing_anti_ice.is_wai_valve_closed(0))
        }

        fn right_valve_closed(&self) -> bool {
            self.query(|a| a.pneumatic.wing_anti_ice.is_wai_valve_closed(1))
        }

        fn left_exhaust_flow(&self) -> MassRate {
            self.query(|a| a.pneumatic.wing_anti_ice.wai_mass_flow(0))
        }

        fn right_exhaust_flow(&self) -> MassRate {
            self.query(|a| a.pneumatic.wing_anti_ice.wai_mass_flow(1))
        }
    }

    fn test_bed() -> PneumaticTestBed {
        PneumaticTestBed::new()
    }

    fn test_bed_with() -> PneumaticTestBed {
        test_bed()
    }

    fn pressure_tolerance() -> Pressure {
        Pressure::new::<psi>(0.5)
    }

    fn flow_rate_tolerance() -> MassRate {
        MassRate::new::<kilogram_per_second>(0.1)
    }

    // Just a way for me to plot some graphs
    #[test]
    #[ignore]
    fn full_graphing_test() {
        let alt = Length::new::<foot>(0.);

        let mut test_bed = test_bed_with()
            .idle_eng1()
            .idle_eng2()
            .in_isa_atmosphere(alt)
            .cross_bleed_valve_selector_knob(CrossBleedValveSelectorMode::Auto)
            .mach_number(MachNumber(0.))
            .both_packs_auto();

        let mut time_points = Vec::new();
        let mut high_pressures = Vec::new();
        let mut intermediate_pressures = Vec::new();
        let mut transfer_pressures = Vec::new(); // Transfer pressure (before PRV)
        let mut precooler_inlet_pressures = Vec::new(); // Precooler inlet pressure
        let mut precooler_outlet_pressures = Vec::new(); // Precooler outlet pressure
        let mut precooler_supply_pressures = Vec::new(); // Precooler cooling air pressure
        let mut engine_starter_container_pressures = Vec::new(); // Precooler cooling air pressure
        let mut intermediate_pressure_compressor_temperatures = Vec::new();
        let mut high_pressure_compressor_temperatures = Vec::new(); // Transfer temperature (before PRV)
        let mut transfer_temperatures = Vec::new(); // Precooler inlet temperature
        let mut precooler_inlet_temperatures = Vec::new(); // Precooler outlet temperature
        let mut precooler_outlet_temperatures = Vec::new(); // Precooler cooling air temperature
        let mut precooler_supply_temperatures = Vec::new();
        let mut engine_starter_container_temperatures = Vec::new();
        let mut high_pressure_valve_open_amounts = Vec::new();
        let mut pressure_regulating_valve_open_amounts = Vec::new();
        let mut intermediate_pressure_valve_open_amounts = Vec::new();
        let mut engine_starter_valve_open_amounts = Vec::new();
        let mut apu_bleed_valve_open_amounts = Vec::new();
        let mut fan_air_valve_open_amounts = Vec::new();

        for i in 1..6000 {
            time_points.push(i as f64 * 16.);

            if i == 2000 {
                test_bed = test_bed.stop_eng2().stop_eng2();
            } else if i == 4000 {
                test_bed = test_bed.start_eng2().start_eng2();
            }

            high_pressures.push(test_bed.hp_pressure(1).get::<psi>());
            intermediate_pressures.push(test_bed.ip_pressure(1).get::<psi>());
            transfer_pressures.push(test_bed.transfer_pressure(1).get::<psi>());
            precooler_inlet_pressures.push(test_bed.precooler_inlet_pressure(1).get::<psi>());
            precooler_outlet_pressures.push(test_bed.precooler_outlet_pressure(1).get::<psi>());
            precooler_supply_pressures.push(test_bed.precooler_supply_pressure(1).get::<psi>());
            engine_starter_container_pressures
                .push(test_bed.engine_starter_container_pressure(1).get::<psi>());

            intermediate_pressure_compressor_temperatures
                .push(test_bed.ip_temperature(1).get::<degree_celsius>());
            high_pressure_compressor_temperatures
                .push(test_bed.hp_temperature(1).get::<degree_celsius>());
            transfer_temperatures.push(test_bed.transfer_temperature(1).get::<degree_celsius>());
            precooler_inlet_temperatures.push(
                test_bed
                    .precooler_inlet_temperature(1)
                    .get::<degree_celsius>(),
            );
            precooler_outlet_temperatures.push(
                test_bed
                    .precooler_outlet_temperature(1)
                    .get::<degree_celsius>(),
            );
            precooler_supply_temperatures.push(
                test_bed
                    .precooler_supply_temperature(1)
                    .get::<degree_celsius>(),
            );
            engine_starter_container_temperatures.push(
                test_bed
                    .engine_starter_container_temperature(1)
                    .get::<degree_celsius>(),
            );

            high_pressure_valve_open_amounts.push(test_bed.query(|aircraft| {
                aircraft.pneumatic.engine_systems[0]
                    .high_pressure_valve
                    .open_amount()
                    .get::<ratio>()
            }));

            pressure_regulating_valve_open_amounts.push(test_bed.query(|aircraft| {
                aircraft.pneumatic.engine_systems[0]
                    .pressure_regulating_valve
                    .open_amount()
                    .get::<ratio>()
            }));

            intermediate_pressure_valve_open_amounts.push(test_bed.query(|aircraft| {
                aircraft.pneumatic.engine_systems[0]
                    .intermediate_pressure_valve
                    .open_amount()
                    .get::<ratio>()
            }));

            engine_starter_valve_open_amounts.push(test_bed.query(|aircraft| {
                aircraft.pneumatic.engine_systems[0]
                    .engine_starter_valve
                    .open_amount()
                    .get::<ratio>()
            }));

            apu_bleed_valve_open_amounts.push(if test_bed.apu_bleed_valve_is_open() {
                1.
            } else {
                0.
            });

            fan_air_valve_open_amounts.push(test_bed.query(|aircraft| {
                aircraft.pneumatic.engine_systems[0]
                    .fan_air_valve
                    .open_amount()
                    .get::<ratio>()
            }));

            test_bed.run_with_delta(Duration::from_millis(32));
        }

        assert!(test_bed.hp_valve_is_powered(1));
        assert!(test_bed.pr_valve_is_powered(1));
        assert!(test_bed.fan_air_valve_is_powered(1));

        // If anyone is wondering, I am using python to plot pressure curves. This will be removed once the model is complete.
        let data = vec![
            time_points,
            high_pressures,
            intermediate_pressures,
            transfer_pressures,
            precooler_inlet_pressures,
            precooler_outlet_pressures,
            precooler_supply_pressures,
            engine_starter_container_pressures,
            high_pressure_compressor_temperatures,
            intermediate_pressure_compressor_temperatures,
            transfer_temperatures,
            precooler_inlet_temperatures,
            precooler_outlet_temperatures,
            precooler_supply_temperatures,
            engine_starter_container_temperatures,
            high_pressure_valve_open_amounts,
            pressure_regulating_valve_open_amounts,
            intermediate_pressure_valve_open_amounts,
            engine_starter_valve_open_amounts,
            apu_bleed_valve_open_amounts,
            fan_air_valve_open_amounts,
        ];

        if fs::create_dir_all("../a320_pneumatic_simulation_graph_data").is_ok() {
            let mut file = File::create("../a320_pneumatic_simulation_graph_data/generic_data.txt")
                .expect("Could not create file");

            use std::io::Write;

            writeln!(file, "{:?}", data).expect("Could not write file");
        };
    }

    #[test]
    #[ignore]
    fn hydraulic_reservoir_pressurization_graphs() {
        let alt = Length::new::<foot>(0.);

        let mut test_bed = test_bed_with()
            .in_isa_atmosphere(alt)
            .stop_eng1()
            .stop_eng2()
            .set_bleed_air_running()
            .cross_bleed_valve_selector_knob(CrossBleedValveSelectorMode::Auto);

        let mut ts = Vec::new();
        let mut green_pressures = Vec::new();
        let mut blue_pressures = Vec::new();
        let mut yellow_pressures = Vec::new();

        for i in 1..1000 {
            ts.push(i as f64 * 16.);

            green_pressures.push(test_bed.green_hydraulic_reservoir_pressure().get::<psi>());
            blue_pressures.push(test_bed.blue_hydraulic_reservoir_pressure().get::<psi>());
            yellow_pressures.push(test_bed.yellow_hydraulic_reservoir_pressure().get::<psi>());

            test_bed.run_with_delta(Duration::from_millis(16));
        }

        assert!(test_bed.green_hydraulic_reservoir_pressure() > Pressure::new::<psi>(35.));
        assert!(test_bed.blue_hydraulic_reservoir_pressure() > Pressure::new::<psi>(35.));
        assert!(test_bed.yellow_hydraulic_reservoir_pressure() > Pressure::new::<psi>(35.));

        // If anyone is wondering, I am using python to plot pressure curves. This will be removed once the model is complete.
        let data = vec![ts, green_pressures, blue_pressures, yellow_pressures];

        if fs::create_dir_all("../a320_pneumatic_simulation_graph_data").is_ok() {
            let mut file = File::create(
                "../a320_pneumatic_simulation_graph_data/hydraulic_reservoir_pressures_data.txt",
            )
            .expect("Could not create file");

            use std::io::Write;

            writeln!(file, "{:?}", data).expect("Could not write file");
        };
    }

    #[test]
    #[ignore]
    fn pack_pressurization_graphs() {
        let alt = Length::new::<foot>(0.);

        let mut test_bed = test_bed_with()
            .in_isa_atmosphere(alt)
            .stop_eng1()
            .stop_eng2()
            .set_bleed_air_running()
            .both_packs_auto()
            .cross_bleed_valve_selector_knob(CrossBleedValveSelectorMode::Open);

        let mut ts = Vec::new();
        let mut left_pressures = Vec::new();
        let mut right_pressures = Vec::new();

        for i in 1..10000 {
            ts.push(i as f64 * 16.);

            left_pressures.push(test_bed.pack_pressure(1).get::<psi>());
            right_pressures.push(test_bed.pack_pressure(2).get::<psi>());

            test_bed.run_with_delta(Duration::from_millis(16));
        }

        // If anyone is wondering, I am using python to plot pressure curves. This will be removed once the model is complete.
        let data = vec![ts, left_pressures, right_pressures];

        if fs::create_dir_all("../a320_pneumatic_simulation_graph_data").is_ok() {
            let mut file =
                File::create("../a320_pneumatic_simulation_graph_data/pack_pressures_data.txt")
                    .expect("Could not create file");

            use std::io::Write;

            writeln!(file, "{:?}", data).expect("Could not write file");
        };
    }

    #[test]
    fn cold_and_dark_full_state() {
        let altitude = Length::new::<foot>(0.);
        let ambient_pressure = InternationalStandardAtmosphere::pressure_at_altitude(altitude);

        let test_bed = test_bed_with()
            .stop_eng1()
            .stop_eng2()
            .in_isa_atmosphere(altitude)
            .mach_number(MachNumber(0.))
            .set_pack_flow_pb_is_auto(1, false)
            .set_pack_flow_pb_is_auto(2, false)
            .and_stabilize();

        assert!((test_bed.ip_pressure(1) - ambient_pressure).abs() < pressure_tolerance());
        assert!((test_bed.ip_pressure(2) - ambient_pressure).abs() < pressure_tolerance());

        assert!((test_bed.hp_pressure(1) - ambient_pressure).abs() < pressure_tolerance());
        assert!((test_bed.hp_pressure(2) - ambient_pressure).abs() < pressure_tolerance());

        assert!((test_bed.transfer_pressure(1) - ambient_pressure).abs() < pressure_tolerance());
        assert!((test_bed.transfer_pressure(2) - ambient_pressure).abs() < pressure_tolerance());

        assert!(
            (test_bed.precooler_inlet_pressure(1) - ambient_pressure).abs() < pressure_tolerance()
        );
        assert!(
            (test_bed.precooler_inlet_pressure(2) - ambient_pressure).abs() < pressure_tolerance()
        );

        assert!(
            (test_bed.precooler_outlet_pressure(1) - ambient_pressure).abs() < pressure_tolerance()
        );
        assert!(
            (test_bed.precooler_outlet_pressure(2) - ambient_pressure).abs() < pressure_tolerance()
        );

        assert!(!test_bed.hp_valve_is_open(1));
        assert!(!test_bed.hp_valve_is_open(2));

        assert!(!test_bed.pr_valve_is_open(1));
        assert!(!test_bed.pr_valve_is_open(2));

        assert!(!test_bed.cross_bleed_valve_is_open())
    }

    #[test]
    fn single_engine_idle_full_state() {
        let altitude = Length::new::<foot>(0.);
        let test_bed = test_bed_with()
            .idle_eng1()
            .stop_eng2()
            .in_isa_atmosphere(altitude)
            .mach_number(MachNumber(0.))
            .and_stabilize();

        let ambient_pressure = InternationalStandardAtmosphere::pressure_at_altitude(altitude);

        assert!(test_bed.ip_pressure(1) - ambient_pressure > pressure_tolerance());
        assert!((test_bed.ip_pressure(2) - ambient_pressure).abs() < pressure_tolerance());

        assert!(test_bed.hp_pressure(1) - ambient_pressure > pressure_tolerance());
        assert!((test_bed.hp_pressure(2) - ambient_pressure).abs() < pressure_tolerance());

        assert!(test_bed.transfer_pressure(1) - ambient_pressure > pressure_tolerance());
        assert!((test_bed.transfer_pressure(2) - ambient_pressure).abs() < pressure_tolerance());

        assert!((test_bed.precooler_inlet_pressure(1) - ambient_pressure) > pressure_tolerance());
        assert!(!test_bed.precooler_inlet_pressure(2).is_nan());

        assert!((test_bed.precooler_outlet_pressure(1) - ambient_pressure) > pressure_tolerance());
        assert!(!test_bed.precooler_outlet_pressure(2).is_nan());

        assert!(test_bed.hp_valve_is_open(1));
        assert!(!test_bed.hp_valve_is_open(2));

        assert!(!test_bed.es_valve_is_open(1));
        assert!(!test_bed.es_valve_is_open(2));

        assert!(!test_bed.cross_bleed_valve_is_open());
    }

    #[test]
    fn two_engine_idle_full_state() {
        let altitude = Length::new::<foot>(0.);
        let test_bed = test_bed_with()
            .idle_eng1()
            .idle_eng2()
            .in_isa_atmosphere(altitude)
            .mach_number(MachNumber(0.))
            .and_stabilize();

        let ambient_pressure = InternationalStandardAtmosphere::pressure_at_altitude(altitude);

        assert!(test_bed.ip_pressure(1) - ambient_pressure > pressure_tolerance());
        assert!(test_bed.ip_pressure(2) - ambient_pressure > pressure_tolerance());

        assert!(test_bed.hp_pressure(1) - ambient_pressure > pressure_tolerance());
        assert!(test_bed.hp_pressure(2) - ambient_pressure > pressure_tolerance());

        assert!(test_bed.transfer_pressure(1) - ambient_pressure > pressure_tolerance());
        assert!(test_bed.transfer_pressure(2) - ambient_pressure > pressure_tolerance());

        assert!((test_bed.precooler_inlet_pressure(1) - ambient_pressure) > pressure_tolerance());
        assert!((test_bed.precooler_inlet_pressure(2) - ambient_pressure) > pressure_tolerance());

        assert!((test_bed.precooler_outlet_pressure(1) - ambient_pressure) > pressure_tolerance());
        assert!((test_bed.precooler_outlet_pressure(2) - ambient_pressure) > pressure_tolerance());

        assert!(test_bed.hp_valve_is_open(1));
        assert!(test_bed.hp_valve_is_open(2));

        assert!(!test_bed.es_valve_is_open(1));
        assert!(!test_bed.es_valve_is_open(2));

        assert!(!test_bed.cross_bleed_valve_is_open());
    }

    #[test]
    fn engine_shutdown() {
        let altitude = Length::new::<foot>(0.);
        let ambient_pressure = InternationalStandardAtmosphere::pressure_at_altitude(altitude);

        let mut test_bed = test_bed_with()
            .idle_eng1()
            .idle_eng2()
            .in_isa_atmosphere(altitude)
            .mach_number(MachNumber(0.))
            .and_stabilize();

        assert!(test_bed.precooler_outlet_pressure(1) - ambient_pressure > pressure_tolerance());
        assert!(test_bed.precooler_outlet_pressure(2) - ambient_pressure > pressure_tolerance());

        test_bed = test_bed.set_bleed_air_running();

        assert!(!test_bed.precooler_outlet_pressure(1).get::<psi>().is_nan());
        assert!(!test_bed.precooler_outlet_pressure(2).get::<psi>().is_nan());
    }

    #[test]
    fn starter_valve_opens_on_engine_start() {
        let mut test_bed = test_bed_with().stop_eng1().stop_eng2().and_run();

        assert!(!test_bed.es_valve_is_open(1));
        assert!(!test_bed.es_valve_is_open(2));

        test_bed = test_bed.start_eng1().start_eng2().and_run();

        assert!(test_bed.es_valve_is_open(1));
        assert!(test_bed.es_valve_is_open(2));
    }

    #[test]
    fn cross_bleed_valve_opens_when_apu_bleed_valve_opens() {
        let mut test_bed = test_bed_with()
            .cross_bleed_valve_selector_knob(CrossBleedValveSelectorMode::Auto)
            .and_run();

        assert!(!test_bed.cross_bleed_valve_is_open());

        test_bed = test_bed
            .set_apu_bleed_valve_signal(ApuBleedAirValveSignal::new_open())
            .and_run();

        assert!(test_bed.cross_bleed_valve_is_open());
    }

    #[test]
    fn cross_bleed_valve_closes_when_apu_bleed_valve_closes() {
        let mut test_bed = test_bed_with()
            .cross_bleed_valve_selector_knob(CrossBleedValveSelectorMode::Auto)
            .set_apu_bleed_valve_signal(ApuBleedAirValveSignal::new_open())
            .and_run();

        assert!(test_bed.cross_bleed_valve_is_open());

        test_bed = test_bed
            .set_apu_bleed_valve_signal(ApuBleedAirValveSignal::new_closed())
            .and_run();

        assert!(!test_bed.cross_bleed_valve_is_open());
    }

    #[test]
    fn cross_bleed_valve_manual_overrides_everything() {
        let mut test_bed = test_bed_with()
            .cross_bleed_valve_selector_knob(CrossBleedValveSelectorMode::Shut)
            .set_apu_bleed_valve_signal(ApuBleedAirValveSignal::new_open())
            .and_run();

        assert!(!test_bed.cross_bleed_valve_is_open());

        test_bed = test_bed
            .cross_bleed_valve_selector_knob(CrossBleedValveSelectorMode::Open)
            .set_apu_bleed_valve_signal(ApuBleedAirValveSignal::new_closed())
            .and_run();

        assert!(test_bed.cross_bleed_valve_is_open());
    }

    #[test]
    fn vars_initialized_properly() {
        let test_bed = test_bed()
            .in_isa_atmosphere(Length::new::<foot>(0.))
            .and_run();

        assert!(test_bed.contains_variable_with_name("PNEU_ENG_1_IP_PRESSURE"));
        assert!(test_bed.contains_variable_with_name("PNEU_ENG_2_IP_PRESSURE"));

        assert!(test_bed.contains_variable_with_name("PNEU_ENG_1_HP_PRESSURE"));
        assert!(test_bed.contains_variable_with_name("PNEU_ENG_2_HP_PRESSURE"));

        assert!(test_bed.contains_variable_with_name("PNEU_ENG_1_TRANSFER_PRESSURE"));
        assert!(test_bed.contains_variable_with_name("PNEU_ENG_2_TRANSFER_PRESSURE"));

        assert!(test_bed.contains_variable_with_name("PNEU_ENG_1_PRECOOLER_INLET_PRESSURE"));
        assert!(test_bed.contains_variable_with_name("PNEU_ENG_2_PRECOOLER_INLET_PRESSURE"));

        assert!(test_bed.contains_variable_with_name("PNEU_ENG_1_PRECOOLER_OUTLET_PRESSURE"));
        assert!(test_bed.contains_variable_with_name("PNEU_ENG_2_PRECOOLER_OUTLET_PRESSURE"));

        assert!(test_bed.contains_variable_with_name("PNEU_ENG_1_STARTER_CONTAINER_PRESSURE"));
        assert!(test_bed.contains_variable_with_name("PNEU_ENG_2_STARTER_CONTAINER_PRESSURE"));

        assert!(test_bed.contains_variable_with_name("PNEU_ENG_1_IP_TEMPERATURE"));
        assert!(test_bed.contains_variable_with_name("PNEU_ENG_2_IP_TEMPERATURE"));

        assert!(test_bed.contains_variable_with_name("PNEU_ENG_1_HP_TEMPERATURE"));
        assert!(test_bed.contains_variable_with_name("PNEU_ENG_2_HP_TEMPERATURE"));

        assert!(test_bed.contains_variable_with_name("PNEU_ENG_1_TRANSFER_TEMPERATURE"));
        assert!(test_bed.contains_variable_with_name("PNEU_ENG_2_TRANSFER_TEMPERATURE"));

        assert!(test_bed.contains_variable_with_name("PNEU_ENG_1_PRECOOLER_INLET_TEMPERATURE"));
        assert!(test_bed.contains_variable_with_name("PNEU_ENG_2_PRECOOLER_INLET_TEMPERATURE"));

        assert!(test_bed.contains_variable_with_name("PNEU_ENG_1_PRECOOLER_OUTLET_TEMPERATURE"));
        assert!(test_bed.contains_variable_with_name("PNEU_ENG_2_PRECOOLER_OUTLET_TEMPERATURE"));

        assert!(test_bed.contains_variable_with_name("PNEU_ENG_1_STARTER_CONTAINER_TEMPERATURE"));
        assert!(test_bed.contains_variable_with_name("PNEU_ENG_2_STARTER_CONTAINER_TEMPERATURE"));

        assert!(test_bed.contains_variable_with_name("PNEU_ENG_1_IP_PRESSURE"));
        assert!(test_bed.contains_variable_with_name("PNEU_ENG_2_IP_PRESSURE"));

        assert!(test_bed.contains_variable_with_name("PNEU_ENG_1_IP_VALVE_OPEN"));
        assert!(test_bed.contains_variable_with_name("PNEU_ENG_2_IP_VALVE_OPEN"));

        assert!(test_bed.contains_variable_with_name("PNEU_ENG_1_HP_VALVE_OPEN"));
        assert!(test_bed.contains_variable_with_name("PNEU_ENG_2_HP_VALVE_OPEN"));

        assert!(test_bed.contains_variable_with_name("PNEU_ENG_1_PR_VALVE_OPEN"));
        assert!(test_bed.contains_variable_with_name("PNEU_ENG_2_PR_VALVE_OPEN"));

        assert!(test_bed.contains_variable_with_name("PNEU_ENG_1_STARTER_VALVE_OPEN"));
        assert!(test_bed.contains_variable_with_name("PNEU_ENG_2_STARTER_VALVE_OPEN"));

        assert!(test_bed.contains_variable_with_name("PNEU_PACK_1_FLOW_VALVE_FLOW_RATE"));
        assert!(test_bed.contains_variable_with_name("PNEU_PACK_2_FLOW_VALVE_FLOW_RATE"));

        assert!(test_bed.contains_variable_with_name("OVHD_PNEU_ENG_1_BLEED_PB_HAS_FAULT"));
        assert!(test_bed.contains_variable_with_name("OVHD_PNEU_ENG_2_BLEED_PB_HAS_FAULT"));

        assert!(test_bed.contains_variable_with_name("OVHD_PNEU_ENG_1_BLEED_PB_IS_AUTO"));
        assert!(test_bed.contains_variable_with_name("OVHD_PNEU_ENG_2_BLEED_PB_IS_AUTO"));

        assert!(test_bed.contains_variable_with_name("PNEU_XBLEED_VALVE_OPEN"));
    }

    #[test]
    fn wing_anti_ice_simvars() {
        let test_bed = test_bed();

        assert!(test_bed.contains_variable_with_name("BUTTON_OVHD_ANTI_ICE_WING_POSITION"));
        assert!(test_bed.contains_variable_with_name("PNEU_WING_ANTI_ICE_SYSTEM_ON"));
        assert!(test_bed.contains_variable_with_name("PNEU_WING_ANTI_ICE_SYSTEM_SELECTED"));
        assert!(test_bed.contains_variable_with_name("PNEU_WING_ANTI_ICE_HAS_FAULT"));
        assert!(test_bed.contains_variable_with_name("PNEU_WING_ANTI_ICE_GROUND_TIMER"));
        assert!(test_bed.contains_variable_with_name("PNEU_WING_ANTI_ICE_1_CONSUMER_PRESSURE"));
        assert!(test_bed.contains_variable_with_name("PNEU_WING_ANTI_ICE_2_CONSUMER_PRESSURE"));
        assert!(test_bed.contains_variable_with_name("PNEU_WING_ANTI_ICE_1_CONSUMER_TEMPERATURE"));
        assert!(test_bed.contains_variable_with_name("PNEU_WING_ANTI_ICE_2_CONSUMER_TEMPERATURE"));
        assert!(test_bed.contains_variable_with_name("PNEU_WING_ANTI_ICE_1_VALVE_CLOSED"));
        assert!(test_bed.contains_variable_with_name("PNEU_WING_ANTI_ICE_2_VALVE_CLOSED"));

        assert!(test_bed.contains_variable_with_name("PNEU_WING_ANTI_ICE_1_HIGH_PRESSURE"));
        assert!(test_bed.contains_variable_with_name("PNEU_WING_ANTI_ICE_2_HIGH_PRESSURE"));
        assert!(test_bed.contains_variable_with_name("PNEU_WING_ANTI_ICE_1_LOW_PRESSURE"));
        assert!(test_bed.contains_variable_with_name("PNEU_WING_ANTI_ICE_2_LOW_PRESSURE"));
    }

    #[test]
    fn pressure_regulating_valve_closes_with_ovhd_engine_bleed_off() {
        let mut test_bed = test_bed().idle_eng1().idle_eng2().and_run();

        // We have to run two update ticks for the pressure to propagate through the system.
        test_bed.run_with_delta(Duration::from_secs(5));

        assert!(test_bed.pr_valve_is_open(1));
        assert!(test_bed.pr_valve_is_open(2));

        test_bed = test_bed.set_engine_bleed_push_button_off(1).and_run();

        assert!(!test_bed.pr_valve_is_open(1));
        assert!(test_bed.pr_valve_is_open(2));

        test_bed = test_bed.set_engine_bleed_push_button_off(2).and_run();

        assert!(!test_bed.pr_valve_is_open(1));
        assert!(!test_bed.pr_valve_is_open(2));
    }

    #[test]
    fn pressure_regulating_valve_closes_with_ovhd_engine_fire_pushbutton_released() {
        let mut test_bed = test_bed().idle_eng1().idle_eng2().and_run();

        test_bed.run_with_delta(Duration::from_secs(5));

        assert!(test_bed.pr_valve_is_open(1));
        assert!(test_bed.pr_valve_is_open(2));

        test_bed = test_bed.release_fire_pushbutton(1).and_run();

        assert!(!test_bed.pr_valve_is_open(1));
        assert!(test_bed.pr_valve_is_open(2));

        test_bed = test_bed.release_fire_pushbutton(2).and_run();

        assert!(!test_bed.pr_valve_is_open(1));
        assert!(!test_bed.pr_valve_is_open(2));
    }

    #[test]
    fn pressure_regulating_valve_1_closes_with_apu_bleed_on() {
        let mut test_bed = test_bed_with().idle_eng1().idle_eng2().and_run();

        test_bed.run_with_delta(Duration::from_secs(5));

        assert!(test_bed.pr_valve_is_open(1));

        test_bed = test_bed
            .set_apu_bleed_air_pb(true)
            .set_apu_bleed_valve_signal(ApuBleedAirValveSignal::new_open())
            .and_run();

        assert!(!test_bed.pr_valve_is_open(1));
    }

    #[test]
    fn pressure_regulating_valve_2_closes_with_apu_bleed_on_and_cross_bleed_open() {
        let mut test_bed = test_bed_with().idle_eng1().idle_eng2().and_run();

        test_bed.run_with_delta(Duration::from_secs(5));

        assert!(test_bed.pr_valve_is_open(2));

        test_bed = test_bed
            .set_apu_bleed_air_pb(true)
            .set_apu_bleed_valve_signal(ApuBleedAirValveSignal::new_open())
            .cross_bleed_valve_selector_knob(CrossBleedValveSelectorMode::Open)
            .and_run();

        assert!(!test_bed.pr_valve_is_open(2));
    }

    #[test]
    fn fadec_represents_engine_state() {
        let mut test_bed = test_bed_with()
            .set_engine_state(1, EngineState::Off)
            .set_engine_state(2, EngineState::Off);

        assert_eq!(test_bed.engine_state(1), EngineState::Off);
        assert_eq!(test_bed.engine_state(2), EngineState::Off);

        test_bed = test_bed
            .set_engine_state(1, EngineState::Starting)
            .and_run();

        assert_eq!(test_bed.engine_state(1), EngineState::Starting);
        assert_eq!(test_bed.engine_state(2), EngineState::Off);

        test_bed = test_bed
            .set_engine_state(2, EngineState::Starting)
            .and_run();

        assert_eq!(test_bed.engine_state(1), EngineState::Starting);
        assert_eq!(test_bed.engine_state(2), EngineState::Starting);

        test_bed = test_bed.set_engine_state(1, EngineState::On).and_run();

        assert_eq!(test_bed.engine_state(1), EngineState::On);
        assert_eq!(test_bed.engine_state(2), EngineState::Starting);

        test_bed = test_bed.set_engine_state(2, EngineState::On).and_run();

        assert_eq!(test_bed.engine_state(1), EngineState::On);
        assert_eq!(test_bed.engine_state(2), EngineState::On);

        test_bed = test_bed
            .set_engine_state(1, EngineState::Shutting)
            .and_run();

        assert_eq!(test_bed.engine_state(1), EngineState::Shutting);
        assert_eq!(test_bed.engine_state(2), EngineState::On);

        test_bed = test_bed
            .set_engine_state(2, EngineState::Shutting)
            .and_run();

        assert_eq!(test_bed.engine_state(1), EngineState::Shutting);
        assert_eq!(test_bed.engine_state(2), EngineState::Shutting);
    }

    #[test]
    fn apu_bleed_provides_at_least_35_psi_with_open_cross_bleed_valve() {
        let test_bed = test_bed_with()
            .stop_eng1()
            .stop_eng2()
            .cross_bleed_valve_selector_knob(CrossBleedValveSelectorMode::Auto)
            .set_bleed_air_running()
            .set_pack_flow_pb_is_auto(1, false)
            .set_pack_flow_pb_is_auto(2, false)
            .and_stabilize();

        assert!(test_bed.cross_bleed_valve_is_open());

        assert!(!test_bed.pr_valve_is_open(1));
        assert!(!test_bed.pr_valve_is_open(2));

        assert!(test_bed.precooler_outlet_pressure(1) > Pressure::new::<psi>(35.));
        assert!(test_bed.precooler_outlet_pressure(2) > Pressure::new::<psi>(35.));
    }

    #[test]
    fn hydraulic_reservoirs_get_pressurized() {
        let test_bed = test_bed_with()
            .stop_eng1()
            .stop_eng2()
            .cross_bleed_valve_selector_knob(CrossBleedValveSelectorMode::Auto)
            .set_bleed_air_running()
            .and_stabilize();

        assert!(test_bed.green_hydraulic_reservoir_pressure() > Pressure::new::<psi>(35.));
        assert!(test_bed.blue_hydraulic_reservoir_pressure() > Pressure::new::<psi>(35.));
        assert!(test_bed.yellow_hydraulic_reservoir_pressure() > Pressure::new::<psi>(35.));
    }

    #[test]
    fn hydraulic_reservoirs_is_pressurized_by_left_system() {
        let mut test_bed = test_bed_with()
            .idle_eng1()
            .stop_eng2()
            .cross_bleed_valve_selector_knob(CrossBleedValveSelectorMode::Shut);
        test_bed.fail(FailureType::ReservoirAirLeak(HydraulicColor::Green));
        test_bed.fail(FailureType::ReservoirAirLeak(HydraulicColor::Blue));
        test_bed.fail(FailureType::ReservoirAirLeak(HydraulicColor::Yellow));
        test_bed
            .test_bed
            .run_multiple_frames(Duration::from_secs(16));

        test_bed.unfail(FailureType::ReservoirAirLeak(HydraulicColor::Green));
        test_bed.unfail(FailureType::ReservoirAirLeak(HydraulicColor::Blue));
        test_bed.unfail(FailureType::ReservoirAirLeak(HydraulicColor::Yellow));
        test_bed
            .test_bed
            .run_multiple_frames(Duration::from_secs(16));

        assert!(test_bed.green_hydraulic_reservoir_pressure() > Pressure::new::<psi>(40.));
        assert!(test_bed.blue_hydraulic_reservoir_pressure() > Pressure::new::<psi>(40.));
        assert!(test_bed.yellow_hydraulic_reservoir_pressure() > Pressure::new::<psi>(40.));
    }

    #[test]
    fn hydraulic_reservoirs_is_pressurized_by_right_system() {
        let mut test_bed = test_bed_with()
            .stop_eng1()
            .idle_eng2()
            .cross_bleed_valve_selector_knob(CrossBleedValveSelectorMode::Shut);
        test_bed.fail(FailureType::ReservoirAirLeak(HydraulicColor::Green));
        test_bed.fail(FailureType::ReservoirAirLeak(HydraulicColor::Blue));
        test_bed.fail(FailureType::ReservoirAirLeak(HydraulicColor::Yellow));
        test_bed
            .test_bed
            .run_multiple_frames(Duration::from_secs(16));

        test_bed.unfail(FailureType::ReservoirAirLeak(HydraulicColor::Green));
        test_bed.unfail(FailureType::ReservoirAirLeak(HydraulicColor::Blue));
        test_bed.unfail(FailureType::ReservoirAirLeak(HydraulicColor::Yellow));
        test_bed
            .test_bed
            .run_multiple_frames(Duration::from_secs(16));

        assert!(test_bed.green_hydraulic_reservoir_pressure() > Pressure::new::<psi>(40.));
        assert!(test_bed.blue_hydraulic_reservoir_pressure() > Pressure::new::<psi>(40.));
        assert!(test_bed.yellow_hydraulic_reservoir_pressure() > Pressure::new::<psi>(40.));
    }

    #[test]
    fn apu_bleed_provides_at_least_35_psi_to_left_system_with_closed_cross_bleed_valve() {
        let test_bed = test_bed_with()
            .stop_eng1()
            .stop_eng2()
            .cross_bleed_valve_selector_knob(CrossBleedValveSelectorMode::Shut)
            .set_bleed_air_running()
            .set_pack_flow_pb_is_auto(1, false)
            .set_pack_flow_pb_is_auto(2, false)
            .and_stabilize();

        assert!(!test_bed.pr_valve_is_open(1));
        assert!(!test_bed.cross_bleed_valve_is_open());

        assert!(test_bed.precooler_outlet_pressure(1) > Pressure::new::<psi>(35.));
        assert!(!test_bed.precooler_outlet_pressure(2).is_nan());
    }

    #[test]
    fn bleed_monitoring_computers_powered_by_correct_buses() {
        let mut test_bed = test_bed()
            .set_dc_ess_shed_bus_power(false)
            .set_dc_2_bus_power(false)
            .and_run();

        test_bed.run();

        assert!(!test_bed.bmc_is_powered(1));
        assert!(!test_bed.bmc_is_powered(2));

        test_bed = test_bed.set_dc_ess_shed_bus_power(true).and_run();

        assert!(test_bed.bmc_is_powered(1));
        assert!(!test_bed.bmc_is_powered(2));

        test_bed = test_bed.set_dc_2_bus_power(true).and_run();

        assert!(test_bed.bmc_is_powered(1));
        assert!(test_bed.bmc_is_powered(2));
    }

    #[test]
    fn bleed_monitoring_computers_initialize_in_correct_configuration() {
        let test_bed = test_bed()
            .set_dc_2_bus_power(true)
            .set_dc_ess_shed_bus_power(true)
            .and_run();

        assert_eq!(
            test_bed.bmc_operation_mode_for_engine(1, 1),
            BleedMonitoringComputerChannelOperationMode::Master
        );
        assert_eq!(
            test_bed.bmc_operation_mode_for_engine(2, 2),
            BleedMonitoringComputerChannelOperationMode::Master
        );

        assert_eq!(
            test_bed.bmc_operation_mode_for_engine(1, 2),
            BleedMonitoringComputerChannelOperationMode::Slave
        );
        assert_eq!(
            test_bed.bmc_operation_mode_for_engine(2, 1),
            BleedMonitoringComputerChannelOperationMode::Slave
        );
    }

    #[test]
    fn bleed_monitoring_computer_one_takes_over_for_dc_2_failure() {
        let test_bed = test_bed()
            .set_dc_2_bus_power(false)
            .set_dc_ess_shed_bus_power(true)
            .and_run();

        assert!(test_bed.bmc_is_powered(1));
        assert!(!test_bed.bmc_is_powered(2));

        assert_eq!(
            test_bed.bmc_operation_mode_for_engine(1, 1),
            BleedMonitoringComputerChannelOperationMode::Master
        );
        assert_eq!(
            test_bed.bmc_operation_mode_for_engine(1, 2),
            BleedMonitoringComputerChannelOperationMode::Master
        );

        assert_eq!(
            test_bed.bmc_operation_mode_for_engine(2, 1),
            BleedMonitoringComputerChannelOperationMode::Slave
        );
        assert_eq!(
            test_bed.bmc_operation_mode_for_engine(2, 2),
            BleedMonitoringComputerChannelOperationMode::Slave
        );
    }

    #[test]
    fn bleed_monitoring_computer_two_takes_over_for_dc_ess_shed_failure() {
        let test_bed = test_bed()
            .set_dc_2_bus_power(true)
            .set_dc_ess_shed_bus_power(false)
            .and_run();

        assert!(!test_bed.bmc_is_powered(1));
        assert!(test_bed.bmc_is_powered(2));

        assert_eq!(
            test_bed.bmc_operation_mode_for_engine(2, 1),
            BleedMonitoringComputerChannelOperationMode::Master
        );
        assert_eq!(
            test_bed.bmc_operation_mode_for_engine(2, 2),
            BleedMonitoringComputerChannelOperationMode::Master
        );

        assert_eq!(
            test_bed.bmc_operation_mode_for_engine(1, 1),
            BleedMonitoringComputerChannelOperationMode::Slave
        );
        assert_eq!(
            test_bed.bmc_operation_mode_for_engine(1, 2),
            BleedMonitoringComputerChannelOperationMode::Slave
        );
    }

    #[test]
    fn valves_powered_by_correct_busses() {
        let mut test_bed = test_bed()
            .set_dc_ess_shed_bus_power(true)
            .set_dc_2_bus_power(true)
            .and_run();

        assert!(test_bed.hp_valve_is_powered(1));
        assert!(test_bed.hp_valve_is_powered(2));

        assert!(test_bed.pr_valve_is_powered(1));
        assert!(test_bed.pr_valve_is_powered(2));

        test_bed = test_bed.set_dc_ess_shed_bus_power(false).and_run();

        assert!(!test_bed.hp_valve_is_powered(1));
        assert!(test_bed.hp_valve_is_powered(2));

        assert!(!test_bed.pr_valve_is_powered(1));
        assert!(test_bed.pr_valve_is_powered(2));

        test_bed = test_bed.set_dc_2_bus_power(false).and_run();

        assert!(!test_bed.hp_valve_is_powered(1));
        assert!(!test_bed.hp_valve_is_powered(2));

        assert!(!test_bed.pr_valve_is_powered(1));
        assert!(!test_bed.pr_valve_is_powered(2));
    }

    #[test]
    fn fadec_detects_single_vs_dual_bleed_config() {
        let mut test_bed = test_bed_with().stop_eng1().stop_eng2().and_run();

        assert!(!test_bed.fadec_single_vs_dual_bleed_config());

        test_bed = test_bed.idle_eng1().stop_eng2().and_run();
        assert!(test_bed.fadec_single_vs_dual_bleed_config());

        test_bed = test_bed.stop_eng1().idle_eng2().and_run();
        assert!(test_bed.fadec_single_vs_dual_bleed_config());

        test_bed = test_bed.idle_eng1().idle_eng2().and_run();
        assert!(!test_bed.fadec_single_vs_dual_bleed_config());
    }

    #[test]
    fn hydraulic_reservoirs_maintain_pressure_after_bleed_pressure_loss() {
        let mut test_bed = test_bed_with()
            .toga_eng1()
            .toga_eng2()
            .cross_bleed_valve_selector_knob(CrossBleedValveSelectorMode::Shut)
            .mach_number(MachNumber(0.))
            .both_packs_auto()
            .and_stabilize();

        let pressure_before_green = test_bed.green_hydraulic_reservoir_pressure();
        let pressure_before_blue = test_bed.blue_hydraulic_reservoir_pressure();
        let pressure_before_yellow = test_bed.yellow_hydraulic_reservoir_pressure();

        test_bed = test_bed.idle_eng1().and_stabilize();

        assert!(test_bed.green_hydraulic_reservoir_pressure() >= pressure_before_green);
        assert!(test_bed.blue_hydraulic_reservoir_pressure() >= pressure_before_blue);
        assert!(test_bed.yellow_hydraulic_reservoir_pressure() >= pressure_before_yellow);
    }

    #[test]
    fn cross_bleed_valve_is_powered_by_two_electrical_busses() {
        let mut test_bed = test_bed_with()
            .stop_eng1()
            .stop_eng2()
            .cross_bleed_valve_selector_knob(CrossBleedValveSelectorMode::Auto)
            .mach_number(MachNumber(0.))
            .both_packs_auto()
            .set_dc_2_bus_power(true)
            .set_dc_ess_shed_bus_power(true)
            .and_run();

        assert!(test_bed.cross_bleed_valve_is_powered_for_automatic_control());
        assert!(test_bed.cross_bleed_valve_is_powered_for_manual_control());
        assert!(!test_bed.cross_bleed_valve_is_open());

        test_bed = test_bed.set_dc_2_bus_power(false).and_run();
        assert!(!test_bed.cross_bleed_valve_is_powered_for_automatic_control());

        test_bed = test_bed
            .set_dc_2_bus_power(true)
            .set_dc_ess_shed_bus_power(false)
            .and_run();
        assert!(test_bed.cross_bleed_valve_is_powered_for_automatic_control());
        assert!(!test_bed.cross_bleed_valve_is_powered_for_manual_control());
    }

    #[test]
    fn cross_bleed_valve_does_not_accept_manual_signal_when_bus_unpowered() {
        let mut test_bed = test_bed_with()
            .stop_eng1()
            .stop_eng2()
            .cross_bleed_valve_selector_knob(CrossBleedValveSelectorMode::Shut)
            .mach_number(MachNumber(0.))
            .both_packs_auto()
            .set_dc_ess_shed_bus_power(false)
            .and_run();

        assert!(test_bed.cross_bleed_valve_is_powered_for_automatic_control());
        assert!(!test_bed.cross_bleed_valve_is_powered_for_manual_control());
        assert!(!test_bed.cross_bleed_valve_is_open());

        test_bed = test_bed
            .cross_bleed_valve_selector_knob(CrossBleedValveSelectorMode::Open)
            .and_run();

        assert!(!test_bed.cross_bleed_valve_is_open());
    }

    #[test]
    fn large_time_step_stability() {
        let mut test_bed = test_bed_with()
            .idle_eng1()
            .idle_eng2()
            .mach_number(MachNumber(0.))
            .both_packs_auto()
            .and_stabilize();

        // Introduce perturbation
        test_bed = test_bed.toga_eng1().toga_eng2();

        test_bed.run_with_delta(Duration::from_millis(1000));

        assert!(!test_bed.precooler_inlet_pressure(1).is_nan());
        assert!(!test_bed.precooler_inlet_pressure(2).is_nan());
    }

    mod wing_anti_ice {
        use super::*;

        #[test]
        fn wing_anti_ice_cold_and_dark() {
            let altitude = Length::new::<foot>(500.);
            let ambient_pressure = InternationalStandardAtmosphere::pressure_at_altitude(altitude);
            let ambient_temperature =
                InternationalStandardAtmosphere::temperature_at_altitude(altitude);

            let temperature_epsilon = ThermodynamicTemperature::new::<degree_celsius>(0.5);
            let pressure_epsilon = Pressure::new::<psi>(0.1);

            let mut test_bed = test_bed_with()
                .stop_eng1()
                .stop_eng2()
                .in_isa_atmosphere(altitude);
            test_bed.set_lgciu_on_ground(true);
            test_bed = test_bed.and_stabilize();

            assert!((test_bed.left_wai_pressure() - ambient_pressure).abs() < pressure_epsilon);
            assert!((test_bed.right_wai_pressure() - ambient_pressure).abs() < pressure_epsilon);
            assert!(
                (test_bed.left_wai_temperature().get::<degree_celsius>()
                    - ambient_temperature.get::<degree_celsius>())
                .abs()
                    < temperature_epsilon.get::<degree_celsius>()
            );
            assert!(
                (test_bed.right_wai_temperature().get::<degree_celsius>()
                    - ambient_temperature.get::<degree_celsius>())
                .abs()
                    < temperature_epsilon.get::<degree_celsius>()
            );
            assert!(test_bed.left_valve_closed());
            assert!(test_bed.right_valve_closed());
            assert!(!test_bed.wing_anti_ice_system_on());
            assert!(!test_bed.wing_anti_ice_has_fault());
            assert!(!test_bed.wing_anti_ice_system_selected());
        }

        #[test]
        fn wing_anti_ice_on_and_off() {
            let altitude = Length::new::<foot>(2000.);
            let ambient_pressure = InternationalStandardAtmosphere::pressure_at_altitude(altitude);
            let ambient_temperature =
                InternationalStandardAtmosphere::temperature_at_altitude(altitude);

            let temperature_epsilon = ThermodynamicTemperature::new::<degree_celsius>(1.);
            let pressure_epsilon = Pressure::new::<psi>(0.1);
            let pressure_epsilon_pressurized = Pressure::new::<psi>(20.);

            let mut test_bed = test_bed_with()
                .holding_eng1()
                .holding_eng2()
                .mach_number(MachNumber(0.35))
                .in_isa_atmosphere(altitude)
                .and_stabilize();
            test_bed.set_lgciu_on_ground(false);

            test_bed = test_bed
                .wing_anti_ice_push_button(WingAntiIcePushButtonMode::Off)
                .and_stabilize();

            assert!((test_bed.left_wai_pressure() - ambient_pressure).abs() < pressure_epsilon);
            assert!((test_bed.right_wai_pressure() - ambient_pressure).abs() < pressure_epsilon);
            assert!(
                (test_bed.left_wai_temperature().get::<degree_celsius>()
                    - ambient_temperature.get::<degree_celsius>())
                .abs()
                    < temperature_epsilon.get::<degree_celsius>()
            );
            assert!(
                (test_bed.right_wai_temperature().get::<degree_celsius>()
                    - ambient_temperature.get::<degree_celsius>())
                .abs()
                    < temperature_epsilon.get::<degree_celsius>()
            );
            assert!(test_bed.left_valve_closed());
            assert!(test_bed.right_valve_closed());
            assert!(!test_bed.wing_anti_ice_system_on());
            assert!(!test_bed.wing_anti_ice_system_selected());
            assert!(!test_bed.wing_anti_ice_has_fault());

            test_bed = test_bed
                .wing_anti_ice_push_button(WingAntiIcePushButtonMode::On)
                .and_stabilize();
            // Wing pressure must be higher than ambient, no abs()
            assert!(test_bed.left_wai_pressure() - ambient_pressure > pressure_epsilon_pressurized);
            assert!(
                test_bed.right_wai_pressure() - ambient_pressure > pressure_epsilon_pressurized
            );

            assert!(!test_bed.left_valve_closed());
            assert!(!test_bed.right_valve_closed());
            assert!(test_bed.wing_anti_ice_system_on());
            assert!(test_bed.wing_anti_ice_system_selected());
            assert!(!test_bed.wing_anti_ice_has_fault());
        }

        #[test]
        fn wing_anti_ice_when_precooler_not_pressurized() {
            let altitude = Length::new::<foot>(500.);

            let mut test_bed = test_bed_with()
                .stop_eng1()
                .stop_eng2()
                .in_isa_atmosphere(altitude)
                .and_stabilize();
            test_bed.set_lgciu_on_ground(true);

            test_bed = test_bed
                .wing_anti_ice_push_button(WingAntiIcePushButtonMode::On)
                .and_stabilize();

            assert!(!test_bed.left_precooler_pressurised());
            assert!(!test_bed.right_precooler_pressurised());
            assert!(test_bed.valve_controller_timer() > Duration::from_secs(0));
            assert!(test_bed.left_valve_closed());
            assert!(test_bed.right_valve_closed());
            assert!(test_bed.wing_anti_ice_has_fault());
            assert!(test_bed.wing_anti_ice_system_selected());
            assert!(test_bed.wing_anti_ice_system_on());
        }

        #[test]
        fn wing_anti_ice_no_fault_after_starting_engine() {
            let altitude = Length::new::<foot>(500.);

            let mut test_bed = test_bed_with()
                .idle_eng1()
                .idle_eng2()
                .in_isa_atmosphere(altitude)
                .and_stabilize();
            test_bed.set_lgciu_on_ground(true);

            test_bed = test_bed
                .wing_anti_ice_push_button(WingAntiIcePushButtonMode::On)
                .and_stabilize();

            assert!(!test_bed.wing_anti_ice_has_fault());
            assert!(test_bed.wing_anti_ice_system_selected());
            assert!(test_bed.wing_anti_ice_system_on());
        }

        #[test]
        fn wing_anti_ice_pid() {
            let altitude = Length::new::<foot>(10.);

            let mut test_bed = test_bed_with()
                .in_isa_atmosphere(altitude)
                .idle_eng1()
                .idle_eng2()
                .wing_anti_ice_push_button(WingAntiIcePushButtonMode::On)
                .and_stabilize();
            test_bed.set_lgciu_on_ground(false);

            assert!(test_bed.left_valve_controller_on());
            assert!(test_bed.right_valve_controller_on());

            for _ in 0..1000 {
                assert!(!test_bed.left_valve_closed());
                assert!(!test_bed.right_valve_closed());
                test_bed.run_with_delta(Duration::from_millis(16));
            }

            test_bed = test_bed
                .wing_anti_ice_push_button(WingAntiIcePushButtonMode::Off)
                .and_stabilize();

            assert!(!test_bed.left_valve_controller_on());
            assert!(!test_bed.right_valve_controller_on());

            for _ in 0..1000 {
                assert!(test_bed.left_valve_closed());
                assert!(test_bed.right_valve_closed());
                test_bed.run_with_delta(Duration::from_millis(16));
            }
        }

        #[test]
        fn wing_anti_ice_pressure_regulated() {
            let altitude = Length::new::<foot>(6000.);
            let ambient_pressure = InternationalStandardAtmosphere::pressure_at_altitude(altitude);
            let nominal_wai_pressure: Pressure = Pressure::new::<psi>(22.5);
            let pressure_epsilon: Pressure = Pressure::new::<psi>(2.5);

            let test_bed = test_bed_with()
                .in_isa_atmosphere(altitude)
                .toga_eng1()
                .toga_eng2()
                .wing_anti_ice_push_button(WingAntiIcePushButtonMode::On)
                .and_stabilize();

            assert!(
                (test_bed.left_wai_pressure() - ambient_pressure - nominal_wai_pressure).abs()
                    < pressure_epsilon
            );
            assert!(
                (test_bed.right_wai_pressure() - ambient_pressure - nominal_wai_pressure).abs()
                    < pressure_epsilon
            );
        }

        #[test]
        fn wing_anti_ice_valve_close_after_30_seconds_on_ground() {
            let altitude = Length::new::<foot>(10.);
            // Holding settings give more pressure to the WAI valve
            // to make it open completely
            let mut test_bed = test_bed_with()
                .holding_eng1()
                .holding_eng2()
                .in_isa_atmosphere(altitude)
                .and_stabilize();
            test_bed.set_lgciu_on_ground(true);

            assert!(test_bed.valve_controller_timer() == Duration::from_secs(0));

            test_bed = test_bed.wing_anti_ice_push_button(WingAntiIcePushButtonMode::On);
            test_bed.run_with_delta(Duration::from_millis(16));
            assert!(test_bed.wing_anti_ice_system_selected());

            for _ in 0..375 {
                test_bed.run_with_delta(Duration::from_millis(16));
            }
            assert!(test_bed.valve_controller_timer() < Duration::from_secs(7));
            assert!(!test_bed.left_valve_closed());
            assert!(!test_bed.right_valve_closed());
            assert!(!test_bed.wing_anti_ice_has_fault());
            assert!(test_bed.wing_anti_ice_system_on());

            // 30 secs from WAI ON
            for _ in 0..1625 {
                test_bed.run_with_delta(Duration::from_millis(16));
            }
            assert!(test_bed.valve_controller_timer() == Duration::from_secs(30));
            assert!(test_bed.wing_anti_ice_system_selected());
            assert!(!test_bed.wing_anti_ice_has_fault());
            assert!(!test_bed.wing_anti_ice_system_on());
            assert!(test_bed.left_valve_closed());
            assert!(test_bed.right_valve_closed());
            assert!(!test_bed.wing_anti_ice_system_on());
            assert!(test_bed.wing_anti_ice_system_selected());
        }

        #[test]
        fn wing_anti_ice_valve_timer_reset_after_landing() {
            let altitude = Length::new::<foot>(500.);
            let mut test_bed = test_bed_with()
                .idle_eng1()
                .idle_eng2()
                .in_isa_atmosphere(altitude)
                .and_stabilize();
            test_bed.set_lgciu_on_ground(true);

            test_bed = test_bed.wing_anti_ice_push_button(WingAntiIcePushButtonMode::On);
            test_bed.run_with_delta(Duration::from_secs(31));

            assert!(!test_bed.wing_anti_ice_system_on());
            assert!(test_bed.wing_anti_ice_system_selected());
            assert!(!test_bed.wing_anti_ice_has_fault());
            assert!(test_bed.left_valve_closed());
            assert!(test_bed.right_valve_closed());

            test_bed.set_lgciu_on_ground(false);
            test_bed.run_with_delta(Duration::from_secs(4));

            assert!(test_bed.wing_anti_ice_system_on());
            assert!(test_bed.wing_anti_ice_system_selected());
            assert!(!test_bed.wing_anti_ice_has_fault());
            assert!(!test_bed.left_valve_closed());
            assert!(!test_bed.right_valve_closed());
            assert!(test_bed.valve_controller_timer() == Duration::from_secs(0));

            test_bed.set_lgciu_on_ground(true);
            test_bed.run_with_delta(Duration::from_millis(500));

            assert!(!test_bed.left_valve_closed());
            assert!(!test_bed.right_valve_closed());
            assert!(test_bed.valve_controller_timer() > Duration::from_secs(0));

            test_bed.run_with_delta(Duration::from_secs(30));
            assert!(test_bed.left_valve_closed());
            assert!(test_bed.right_valve_closed());
        }

        #[test]
        fn wing_anti_ice_valve_timer_reset_after_dc_ess_shed_bus_power_cycle() {
            let altitude = Length::new::<foot>(500.);
            let mut test_bed = test_bed_with()
                .idle_eng1()
                .idle_eng2()
                .in_isa_atmosphere(altitude)
                .and_stabilize();
            test_bed.set_lgciu_on_ground(true);

            assert!(test_bed.valve_controller_timer() == Duration::from_secs(0));

            test_bed = test_bed.wing_anti_ice_push_button(WingAntiIcePushButtonMode::On);
            test_bed.run_with_delta(Duration::from_secs(31));

            assert!(!test_bed.wing_anti_ice_system_on());
            assert!(test_bed.wing_anti_ice_system_selected());
            assert!(!test_bed.wing_anti_ice_has_fault());
            assert!(test_bed.left_valve_closed());
            assert!(test_bed.right_valve_closed());
            assert!(test_bed.valve_controller_timer() >= Duration::from_secs(30));

            test_bed = test_bed
                .wing_anti_ice_push_button(WingAntiIcePushButtonMode::Off)
                .set_dc_ess_shed_bus_power(false)
                .and_stabilize();
            test_bed = test_bed.set_dc_ess_shed_bus_power(true).and_stabilize();

            assert!(test_bed.valve_controller_timer() == Duration::from_secs(0));
        }

        #[test]
        fn wing_anti_ice_not_working_without_dc_ess_shed_bus() {
            let altitude = Length::new::<foot>(500.);

            let mut test_bed = test_bed_with()
                .stop_eng1()
                .stop_eng2()
                .set_dc_ess_shed_bus_power(false)
                .in_isa_atmosphere(altitude)
                .wing_anti_ice_push_button(WingAntiIcePushButtonMode::On)
                .and_stabilize();
            test_bed.set_lgciu_on_ground(true);

            assert!(test_bed.left_valve_closed());
            assert!(test_bed.right_valve_closed());
            assert!(test_bed.valve_controller_timer() == Duration::from_secs(0));
            assert!(test_bed.wing_anti_ice_system_selected());
            assert!(!test_bed.wing_anti_ice_system_on());
            assert!(!test_bed.wing_anti_ice_has_fault());
        }

        #[test]
        fn wing_anti_ice_tweak_time_to_open() {
            let altitude = Length::new::<foot>(2000.);
            let mut test_bed = test_bed_with()
                .in_isa_atmosphere(altitude)
                .holding_eng1()
                .holding_eng2()
                .and_stabilize();
            test_bed.set_lgciu_on_ground(false);
            test_bed = test_bed.wing_anti_ice_push_button(WingAntiIcePushButtonMode::On);
            test_bed.run_with_delta(Duration::from_millis(16));

            let mut time_to_open_valve = Duration::from_millis(0);
            for _ in 0..500 {
                let wai_has_fault = test_bed.wing_anti_ice_has_fault();
                if wai_has_fault {
                    time_to_open_valve += Duration::from_millis(16);
                } else {
                    break;
                }
                test_bed.run_with_delta(Duration::from_millis(16));
            }
            println!(
                "Time to open left valve = {}",
                time_to_open_valve.as_secs_f32()
            );
            assert!(!test_bed.wing_anti_ice_has_fault());
            assert!(test_bed.wing_anti_ice_system_on());
            assert!(test_bed.wing_anti_ice_system_selected());
            assert!(time_to_open_valve.as_secs_f32() >= 2.);
            assert!(time_to_open_valve.as_secs_f32() <= 3.);
        }

        #[test]
        fn wing_anti_ice_tweak_exhaust() {
            let altitude = Length::new::<foot>(22000.);

            let mut test_bed = test_bed_with()
                .in_isa_atmosphere(altitude)
                .toga_eng1()
                .toga_eng2()
                .wing_anti_ice_push_button(WingAntiIcePushButtonMode::On)
                .and_stabilize();
            test_bed.set_lgciu_on_ground(false);

            assert!(test_bed.left_valve_controller_on());
            assert!(!test_bed.left_valve_closed());

            let left_flow_rate =
                (test_bed.left_exhaust_flow().get::<kilogram_per_second>() * 1000.0).round();
            let right_flow_rate =
                (test_bed.right_exhaust_flow().get::<kilogram_per_second>() * 1000.0).round();

            println!("Left flow rate = {}", left_flow_rate);
            println!("Right flow rate = {}", right_flow_rate);

            // At 22000ft, flow rate is given at 0.327kg/s
            // Checking between 0.326 and 0.328
            assert!(left_flow_rate >= 327.0 - 1.);
            assert!(left_flow_rate <= 327.0 + 1.);
            assert!(right_flow_rate >= 327.0 - 1.);
            assert!(right_flow_rate <= 327.0 + 1.);
        }

        #[test]
        fn wing_anti_ice_selected_with_bleeds_unpressurised() {
            let altitude = Length::new::<foot>(500.);

            let mut test_bed = test_bed_with()
                .in_isa_atmosphere(altitude)
                .wing_anti_ice_push_button(WingAntiIcePushButtonMode::On)
                .and_stabilize();
            test_bed.set_lgciu_on_ground(true);

            assert!(test_bed.left_valve_closed());
            assert!(test_bed.right_valve_closed());
            assert!(test_bed.wing_anti_ice_system_selected());
            assert!(test_bed.wing_anti_ice_system_on());
            assert!(test_bed.wing_anti_ice_has_fault());

            // 31 secs from WAI ON
            for _ in 0..1950 {
                test_bed.run_with_delta(Duration::from_millis(16));
            }
            // According to the schematics, the relay starts counting
            // regardless of the pressurisation
            assert!(test_bed.valve_controller_timer() == Duration::from_secs(30));
            test_bed = test_bed
                .wing_anti_ice_push_button(WingAntiIcePushButtonMode::Off)
                .and_stabilize();
            assert!(!test_bed.wing_anti_ice_system_selected());
            assert!(!test_bed.wing_anti_ice_system_on());
            assert!(!test_bed.wing_anti_ice_has_fault());
        }
    }

    mod overhead {
        use super::*;

        #[test]
        fn ovhd_engine_bleed_push_buttons() {
            let mut test_bed = test_bed().and_run();

            assert!(test_bed.engine_bleed_push_button_is_auto(1));
            assert!(test_bed.engine_bleed_push_button_is_auto(2));

            test_bed = test_bed
                .set_engine_bleed_push_button_off(1)
                .set_engine_bleed_push_button_off(2)
                .and_run();

            assert!(!test_bed.engine_bleed_push_button_is_auto(1));
            assert!(!test_bed.engine_bleed_push_button_is_auto(2));
        }

        #[test]
        fn ovhd_cross_bleed_valve_mode_selector() {
            let mut test_bed = test_bed().and_run();

            assert_eq!(
                test_bed.cross_bleed_valve_selector(),
                CrossBleedValveSelectorMode::Auto
            );

            test_bed = test_bed
                .cross_bleed_valve_selector_knob(CrossBleedValveSelectorMode::Open)
                .and_run();

            assert_eq!(
                test_bed.cross_bleed_valve_selector(),
                CrossBleedValveSelectorMode::Open
            );

            test_bed = test_bed
                .cross_bleed_valve_selector_knob(CrossBleedValveSelectorMode::Shut)
                .and_run();

            assert_eq!(
                test_bed.cross_bleed_valve_selector(),
                CrossBleedValveSelectorMode::Shut
            );
        }
    }

    mod pack_flow_valve_tests {
        use super::*;

        #[test]
        fn pack_flow_valve_starts_closed() {
            let test_bed = test_bed();

            assert!(!test_bed.pack_flow_valve_is_open(1));
            assert!(!test_bed.pack_flow_valve_is_open(2));
        }

        #[test]
        fn pack_flow_valve_opens_when_conditions_met() {
            let test_bed = test_bed_with()
                .idle_eng1()
                .idle_eng2()
                .set_pack_flow_pb_is_auto(1, true)
                .set_pack_flow_pb_is_auto(2, true)
                .and_stabilize();

            assert!(test_bed.pack_flow_valve_is_open(1));
            assert!(test_bed.pack_flow_valve_is_open(2));
        }

        #[test]
        fn pack_flow_valve_closes_with_pack_pb_off() {
            let mut test_bed = test_bed_with()
                .idle_eng1()
                .idle_eng2()
                .set_pack_flow_pb_is_auto(1, true)
                .set_pack_flow_pb_is_auto(2, false)
                .and_stabilize();

            assert!(test_bed.pack_flow_valve_is_open(1));
            assert!(!test_bed.pack_flow_valve_is_open(2));

            test_bed = test_bed
                .set_pack_flow_pb_is_auto(1, false)
                .and_run()
                .and_run();

            assert!(!test_bed.pack_flow_valve_is_open(1));
            assert!(!test_bed.pack_flow_valve_is_open(2));
        }

        #[test]
        fn pack_flow_drops_when_valve_is_closed() {
            let mut test_bed = test_bed_with()
                .idle_eng1()
                .idle_eng2()
                .cross_bleed_valve_selector_knob(CrossBleedValveSelectorMode::Shut)
                .mach_number(MachNumber(0.))
                .both_packs_auto()
                .and_stabilize();

            assert!(test_bed.pack_flow_valve_flow(1) > flow_rate_tolerance());
            assert!(test_bed.pack_flow_valve_flow(2) > flow_rate_tolerance());

            test_bed = test_bed
                .set_pack_flow_pb_is_auto(1, false)
                .set_pack_flow_pb_is_auto(2, false)
                .and_run()
                .and_run();

            assert!(test_bed.pack_flow_valve_flow(1) < flow_rate_tolerance());
            assert!(test_bed.pack_flow_valve_flow(2) < flow_rate_tolerance());
        }
    }
}
