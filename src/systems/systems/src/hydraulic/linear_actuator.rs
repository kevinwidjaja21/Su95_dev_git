use nalgebra::{Rotation3, Unit, Vector3};

use uom::si::{
    angle::radian,
    angular_acceleration::radian_per_second_squared,
    angular_velocity::radian_per_second,
    area::square_meter,
    f64::*,
    force::newton,
    length::meter,
    mass::kilogram,
    pressure::psi,
    ratio::ratio,
    torque::newton_meter,
    velocity::meter_per_second,
    volume::{cubic_meter, gallon},
    volume_rate::gallon_per_second,
};

use crate::{
    shared::{interpolation, low_pass_filter::LowPassFilter, pid::PidController},
    simulation::UpdateContext,
};

use super::aerodynamic_model::AerodynamicBody;

use std::fmt::Debug;
use std::time::Duration;

pub trait Actuator {
    fn used_volume(&self) -> Volume;
    fn reservoir_return(&self) -> Volume;
    fn reset_volumes(&mut self);
}

/// Trait linked to anything moving bounded between a minimum and maximum position.
/// Those bounds implies that it will have a max and min distance from a fixed
/// point in space to the position where we apply forces to it,
/// for example a control arm where an actuator is attached.
pub trait BoundedLinearLength {
    fn min_absolute_length_to_anchor(&self) -> Length;
    fn max_absolute_length_to_anchor(&self) -> Length;
    fn absolute_length_to_anchor(&self) -> Length;
}

#[derive(PartialEq, Clone, Copy, Debug)]
pub enum LinearActuatorMode {
    ClosedValves,
    PositionControl,
    ActiveDamping,
    ClosedCircuitDamping,
}

/// Represents an abstraction of the low level hydraulic actuator control system that would in real life consist of a lot of
/// solenoid control valves, spring loaded valves, and a differential pressure mechanism.
///
/// We don't want to simulate all of those little bits, so the functions of the actuator are split into
/// the following functional modes:
///
/// - [LinearActuatorMode.ClosedValves]: Turns actuator in a high constant spring/damper system simulating a closed actuator
/// only constrained by its own fluid compressibility.
/// - [ActiveDamping.LinearActuatorMode]: Actuator use internal valves to provide a force resisting to its own movements, dampening
/// the piece movements it's connected to.
/// - [LinearActuatorMode.PositionControl]: -> Actuator will try to use hydraulic pressure to move to a requested position, while
/// maintaining flow limitations.
///     CAUTION: For actuators having only ON/OFF behaviour (gear, door ...), might be needed to require more than required
///         position to ensure it's reached at max force. So full retract position at 0 might need to require -0.5, full extension might
///         need to request 1.5
/// - [LinearActuatorMode.ClosedCircuitDamping]: -> Actuator will connect retract and extend port in closed loop. This provide a dampened
/// free moving mode, usable for gravity extension, or for aileron droop.
#[derive(PartialEq, Clone, Copy)]
struct CoreHydraulicForce {
    current_mode: LinearActuatorMode,
    closed_valves_reference_position: Ratio,

    active_hydraulic_damping_constant: f64,
    slow_hydraulic_damping_constant: f64,

    fluid_compression_spring_constant: f64,
    fluid_compression_damping_constant: f64,

    flow_open_loop_modifier_map: [f64; 6],
    flow_open_loop_position_breakpoints: [f64; 6],

    max_flow: VolumeRate,
    min_flow: VolumeRate,
    flow_error_prev: VolumeRate,

    bore_side_area: Area,
    rod_side_area: Area,

    last_control_force: Force,

    force_raw: Force,
    force_filtered: LowPassFilter<Force>,
    max_force: Force,

    pid_controller: PidController,
}
impl CoreHydraulicForce {
    // Indicates the actuator positioning error from which max flow is applied
    const OPEN_LOOP_POSITION_ERROR_FOR_MAX_FLOW: f64 = 0.02;

    const MIN_PRESSURE_TO_EXIT_POSITION_CONTROL_PSI: f64 = 500.;
    const MIN_PRESSURE_TO_ALLOW_POSITION_CONTROL_PSI: f64 = 700.;

    fn new(
        init_position: Ratio,
        active_hydraulic_damping_constant: f64,
        slow_hydraulic_damping_constant: f64,
        slow_hydraulic_damping_filtering_constant: Duration,
        fluid_compression_spring_constant: f64,
        fluid_compression_damping_constant: f64,
        max_flow: VolumeRate,
        min_flow: VolumeRate,
        bore_side_area: Area,
        rod_side_area: Area,
        flow_open_loop_modifier_map: [f64; 6],
        flow_open_loop_position_breakpoints: [f64; 6],
        flow_control_proportional_gain: f64,
        flow_control_integral_gain: f64,
        flow_control_force_gain: f64,
    ) -> Self {
        let max_force = Pressure::new::<psi>(3000.) * bore_side_area;
        Self {
            current_mode: LinearActuatorMode::ClosedValves,
            closed_valves_reference_position: init_position,

            active_hydraulic_damping_constant,
            slow_hydraulic_damping_constant,
            fluid_compression_spring_constant,
            fluid_compression_damping_constant,

            flow_open_loop_modifier_map,
            flow_open_loop_position_breakpoints,

            max_flow,
            min_flow,
            flow_error_prev: VolumeRate::new::<gallon_per_second>(0.),
            bore_side_area,
            rod_side_area,
            last_control_force: Force::new::<newton>(0.),
            force_raw: Force::new::<newton>(0.),
            force_filtered: LowPassFilter::<Force>::new(slow_hydraulic_damping_filtering_constant),

            max_force,

            pid_controller: PidController::new(
                flow_control_proportional_gain,
                flow_control_integral_gain,
                0.,
                -max_force.get::<newton>(),
                max_force.get::<newton>(),
                0.,
                flow_control_force_gain,
            ),
        }
    }

    fn update_force(
        &mut self,
        context: &UpdateContext,
        required_position: Ratio,
        requested_mode: LinearActuatorMode,
        position_normalized: Ratio,
        current_pressure: Pressure,
        signed_flow: VolumeRate,
        speed: Velocity,
    ) {
        let new_requested_mode = self.new_requested_mode(requested_mode, current_pressure);

        self.update_actions(new_requested_mode, position_normalized, current_pressure);

        self.update_force_from_current_mode(
            context,
            required_position,
            position_normalized,
            current_pressure,
            signed_flow,
            speed,
        );
    }

    /// Computes what new requested mode is allowed depending on current mode
    fn new_requested_mode(
        &mut self,
        requested_mode: LinearActuatorMode,
        current_pressure: Pressure,
    ) -> LinearActuatorMode {
        match self.current_mode {
            LinearActuatorMode::ClosedValves => requested_mode,
            LinearActuatorMode::PositionControl => {
                if current_pressure.get::<psi>() < Self::MIN_PRESSURE_TO_EXIT_POSITION_CONTROL_PSI {
                    LinearActuatorMode::ClosedCircuitDamping
                } else {
                    requested_mode
                }
            }
            LinearActuatorMode::ActiveDamping => requested_mode,
            LinearActuatorMode::ClosedCircuitDamping => requested_mode,
        }
    }

    fn update_actions(
        &mut self,
        new_mode: LinearActuatorMode,
        position_normalized: Ratio,
        current_pressure: Pressure,
    ) {
        match new_mode {
            LinearActuatorMode::ClosedValves => {
                self.actions_from_current_to_closed_valves(position_normalized)
            }
            LinearActuatorMode::PositionControl => {
                if current_pressure.get::<psi>() > Self::MIN_PRESSURE_TO_ALLOW_POSITION_CONTROL_PSI
                {
                    self.actions_from_current_to_position_control()
                }
            }
            LinearActuatorMode::ActiveDamping => self.actions_from_current_to_active_damping(),
            LinearActuatorMode::ClosedCircuitDamping => {
                self.actions_from_current_to_closed_circuit_damping()
            }
        }
    }

    fn actions_from_current_to_closed_valves(&mut self, position_normalized: Ratio) {
        match self.current_mode {
            LinearActuatorMode::ClosedValves => {}
            LinearActuatorMode::PositionControl
            | LinearActuatorMode::ActiveDamping
            | LinearActuatorMode::ClosedCircuitDamping => {
                self.go_to_close_control_valves(position_normalized);
            }
        }
    }

    fn actions_from_current_to_position_control(&mut self) {
        match self.current_mode {
            LinearActuatorMode::PositionControl => {}
            LinearActuatorMode::ClosedValves
            | LinearActuatorMode::ActiveDamping
            | LinearActuatorMode::ClosedCircuitDamping => {
                self.go_to_position_control();
            }
        }
    }

    fn actions_from_current_to_active_damping(&mut self) {
        match self.current_mode {
            LinearActuatorMode::ActiveDamping => {}
            LinearActuatorMode::ClosedValves
            | LinearActuatorMode::PositionControl
            | LinearActuatorMode::ClosedCircuitDamping => {
                self.go_to_active_damping();
            }
        }
    }

    fn actions_from_current_to_closed_circuit_damping(&mut self) {
        match self.current_mode {
            LinearActuatorMode::ClosedCircuitDamping => {}
            LinearActuatorMode::ClosedValves
            | LinearActuatorMode::PositionControl
            | LinearActuatorMode::ActiveDamping => {
                self.go_to_closed_circuit_damping();
            }
        }
    }

    fn go_to_close_control_valves(&mut self, position_normalized: Ratio) {
        self.force_filtered.reset(self.force_raw);
        self.closed_valves_reference_position = position_normalized;
        self.current_mode = LinearActuatorMode::ClosedValves;
    }

    fn go_to_position_control(&mut self) {
        self.pid_controller
            .reset_with_output(self.force_raw.get::<newton>());
        self.current_mode = LinearActuatorMode::PositionControl;
    }

    fn go_to_active_damping(&mut self) {
        self.force_filtered.reset(self.force_raw);
        self.current_mode = LinearActuatorMode::ActiveDamping;
    }

    fn go_to_closed_circuit_damping(&mut self) {
        self.force_filtered.reset(self.force_raw);
        self.current_mode = LinearActuatorMode::ClosedCircuitDamping;
    }

    fn update_force_from_current_mode(
        &mut self,
        context: &UpdateContext,
        required_position: Ratio,
        position_normalized: Ratio,
        current_pressure: Pressure,
        signed_flow: VolumeRate,
        speed: Velocity,
    ) {
        match self.current_mode {
            LinearActuatorMode::ClosedValves => {
                self.force_raw = self.force_closed_valves(position_normalized, speed);
            }
            LinearActuatorMode::ActiveDamping => {
                self.force_filtered
                    .update(context.delta(), self.force_active_damping(speed));

                self.force_raw = self.force_filtered.output();
            }
            LinearActuatorMode::ClosedCircuitDamping => {
                self.force_filtered
                    .update(context.delta(), self.force_closed_circuit_damping(speed));

                self.force_raw = self.force_filtered.output();
            }
            LinearActuatorMode::PositionControl => {
                self.force_raw = self.force_position_control(
                    context,
                    required_position,
                    position_normalized,
                    signed_flow,
                    current_pressure,
                    speed,
                );
            }
        }

        self.force_raw = self.force_raw.min(self.max_force).max(-self.max_force);
    }

    fn force(&self) -> Force {
        self.force_raw
    }

    fn mode(&self) -> LinearActuatorMode {
        self.current_mode
    }

    fn force_active_damping(&self, speed: Velocity) -> Force {
        Force::new::<newton>(
            -speed.get::<meter_per_second>() * self.active_hydraulic_damping_constant,
        )
    }

    fn force_closed_circuit_damping(&self, speed: Velocity) -> Force {
        Force::new::<newton>(
            -speed.get::<meter_per_second>() * self.slow_hydraulic_damping_constant,
        )
    }

    fn force_closed_valves(&self, position_normalized: Ratio, speed: Velocity) -> Force {
        let position_error = self.closed_valves_reference_position - position_normalized;

        Force::new::<newton>(
            position_error.get::<ratio>() * self.fluid_compression_spring_constant
                - speed.get::<meter_per_second>() * self.fluid_compression_damping_constant,
        )
    }

    /// Computes a hydraulic flow request based on required actuator position and its current position
    /// Flow is computed through the formula flow = position_error^2 * maxflow / [Self::OPEN_LOOP_POSITION_ERROR_FOR_MAX_FLOW]^2.
    /// This formula means max flow will be applied above [Self::OPEN_LOOP_POSITION_ERROR_FOR_MAX_FLOW] position error.
    /// Below [Self::OPEN_LOOP_POSITION_ERROR_FOR_MAX_FLOW] position error, a squared law defines flow vs positioning error.
    ///
    /// Then final flow request is corrected depending on actuator position, modeling dampening holes
    /// in the real actuator at start/end of course
    fn open_loop_flow(&self, required_position: Ratio, position_normalized: Ratio) -> VolumeRate {
        let position_error = required_position - position_normalized;

        let open_loop_flow_target = if position_error.get::<ratio>() >= 0. {
            VolumeRate::new::<gallon_per_second>(
                position_error.get::<ratio>().powi(2) * self.max_flow.get::<gallon_per_second>()
                    / Self::OPEN_LOOP_POSITION_ERROR_FOR_MAX_FLOW.powi(2),
            )
        } else {
            VolumeRate::new::<gallon_per_second>(
                position_error.get::<ratio>().powi(2) * -self.max_flow.get::<gallon_per_second>()
                    / Self::OPEN_LOOP_POSITION_ERROR_FOR_MAX_FLOW.powi(2),
            )
        };

        let open_loop_modifier_from_position = interpolation(
            &self.flow_open_loop_position_breakpoints,
            &self.flow_open_loop_modifier_map,
            position_normalized.get::<ratio>(),
        );

        (open_loop_flow_target.min(self.max_flow).max(self.min_flow))
            * open_loop_modifier_from_position
    }

    fn update_force_min_max(&mut self, current_pressure: Pressure, speed: Velocity) {
        self.pid_controller.set_min(-self.max_force.get::<newton>());
        self.pid_controller.set_max(self.max_force.get::<newton>());

        if self.last_control_force > Force::new::<newton>(0.) {
            if speed > Velocity::new::<meter_per_second>(0.) {
                let max_force = current_pressure * self.bore_side_area;
                self.last_control_force = self.last_control_force.min(max_force);
                self.pid_controller.set_max(max_force.get::<newton>());
            }
        } else if self.last_control_force < Force::new::<newton>(0.)
            && speed < Velocity::new::<meter_per_second>(0.)
        {
            let max_force = -1. * current_pressure * self.rod_side_area;
            self.last_control_force = self.last_control_force.max(max_force);
            self.pid_controller.set_min(max_force.get::<newton>());
        }
    }

    fn force_position_control(
        &mut self,
        context: &UpdateContext,
        required_position: Ratio,
        position_normalized: Ratio,
        signed_flow: VolumeRate,
        current_pressure: Pressure,
        speed: Velocity,
    ) -> Force {
        let open_loop_flow_target = self.open_loop_flow(required_position, position_normalized);

        self.pid_controller
            .change_setpoint(open_loop_flow_target.get::<gallon_per_second>());

        self.update_force_min_max(current_pressure, speed);

        self.last_control_force = Force::new::<newton>(self.pid_controller.next_control_output(
            signed_flow.get::<gallon_per_second>(),
            Some(context.delta()),
        ));

        self.last_control_force
    }
}

/// Represents a classical linear actuator with a rod side area and a bore side area
/// It is connected between an anchor point on the plane and a control arm of a rigid body
/// When the actuator moves, it takes fluid on one side and gives back to reservoir the fluid on other side
/// Difference of volume between both side will cause variation of loop reservoir level.
/// It moves between a max absolute and minimum absolute position. The position is finally normalized from 0 to 1 (compressed to extended)
///
/// It can behave it two main ways: its control valves are either closed, and it can't move, or valves are opened and
/// hydraulic power can move it with enough pressure.
#[derive(PartialEq, Clone, Copy)]
pub struct LinearActuator {
    number_of_actuators: u8,

    position_normalized: Ratio,
    position: Length,
    last_position: Length,

    speed: Velocity,

    max_absolute_length: Length,
    min_absolute_length: Length,

    total_travel: Length,

    bore_side_area: Area,
    bore_side_volume: Volume,

    rod_side_area: Area,
    rod_side_volume: Volume,

    volume_extension_ratio: Ratio,
    signed_flow: VolumeRate,
    flow_error_prev: VolumeRate,

    delta_displacement: Length,

    total_volume_to_actuator: Volume,
    total_volume_to_reservoir: Volume,

    requested_position: Ratio,

    core_hydraulics: CoreHydraulicForce,
}
impl LinearActuator {
    pub fn new(
        bounded_linear_length: &impl BoundedLinearLength,
        number_of_actuators: u8,
        bore_side_diameter: Length,
        rod_diameter: Length,
        max_flow: VolumeRate,
        fluid_compression_spring_constant: f64,
        fluid_compression_damping_constant: f64,
        active_hydraulic_damping_constant: f64,
        slow_hydraulic_damping_constant: f64,
        slow_hydraulic_damping_filtering_constant: Duration,
        flow_open_loop_modifier_map: [f64; 6],
        flow_open_loop_position_breakpoints: [f64; 6],
        flow_control_proportional_gain: f64,
        flow_control_integral_gain: f64,
        flow_control_force_gain: f64,
    ) -> Self {
        let total_travel = (bounded_linear_length.max_absolute_length_to_anchor()
            - bounded_linear_length.min_absolute_length_to_anchor())
        .abs();

        let bore_side_area_single_actuator = Area::new::<square_meter>(
            std::f64::consts::PI * (bore_side_diameter.get::<meter>() / 2.).powi(2),
        );
        let bore_side_volume_single_actuator = bore_side_area_single_actuator * total_travel;

        let rod_area = Area::new::<square_meter>(
            std::f64::consts::PI * (rod_diameter.get::<meter>() / 2.).powi(2),
        );

        let rod_side_area_single_actuator = bore_side_area_single_actuator - rod_area;
        let rod_side_volume_single_actuator = rod_side_area_single_actuator * total_travel;

        let volume_extension_ratio: Ratio =
            bore_side_volume_single_actuator / rod_side_volume_single_actuator;

        let actual_max_flow = number_of_actuators as f64 * max_flow;

        // For the same displacement speed there is less flow needed in retraction direction because
        // volume of the fluid is divided by the extension ratio
        let actual_min_flow = -actual_max_flow / volume_extension_ratio;

        let total_bore_side_area = bore_side_area_single_actuator * number_of_actuators as f64;
        let total_bore_side_volume = bore_side_volume_single_actuator * number_of_actuators as f64;

        let total_rod_side_area = rod_side_area_single_actuator * number_of_actuators as f64;
        let total_rod_side_volume = rod_side_volume_single_actuator * number_of_actuators as f64;

        let init_position = bounded_linear_length.absolute_length_to_anchor();
        let init_position_normalized =
            (init_position - bounded_linear_length.min_absolute_length_to_anchor()) / total_travel;

        Self {
            number_of_actuators,

            position_normalized: init_position_normalized,
            position: init_position,
            last_position: init_position,

            speed: Velocity::new::<meter_per_second>(0.),

            max_absolute_length: bounded_linear_length.max_absolute_length_to_anchor(),
            min_absolute_length: bounded_linear_length.min_absolute_length_to_anchor(),

            total_travel,

            bore_side_area: total_bore_side_area,
            bore_side_volume: total_bore_side_volume,

            rod_side_area: total_rod_side_area,
            rod_side_volume: total_rod_side_volume,

            volume_extension_ratio,
            signed_flow: VolumeRate::new::<gallon_per_second>(0.),
            flow_error_prev: VolumeRate::new::<gallon_per_second>(0.),

            delta_displacement: Length::new::<meter>(0.),

            total_volume_to_actuator: Volume::new::<gallon>(0.),
            total_volume_to_reservoir: Volume::new::<gallon>(0.),

            requested_position: Ratio::new::<ratio>(0.),

            core_hydraulics: CoreHydraulicForce::new(
                init_position_normalized,
                active_hydraulic_damping_constant,
                slow_hydraulic_damping_constant,
                slow_hydraulic_damping_filtering_constant,
                fluid_compression_spring_constant,
                fluid_compression_damping_constant,
                actual_max_flow,
                actual_min_flow,
                total_bore_side_area,
                total_rod_side_area,
                flow_open_loop_modifier_map,
                flow_open_loop_position_breakpoints,
                flow_control_proportional_gain,
                flow_control_integral_gain,
                flow_control_force_gain,
            ),
        }
    }

    fn update_before_rigid_body(
        &mut self,
        context: &UpdateContext,
        connected_body: &mut LinearActuatedRigidBodyOnHingeAxis,
        requested_mode: LinearActuatorMode,
        current_pressure: Pressure,
    ) {
        self.core_hydraulics.update_force(
            context,
            self.requested_position,
            requested_mode,
            self.position_normalized,
            current_pressure,
            self.signed_flow,
            self.speed,
        );
        connected_body.apply_control_arm_force(self.core_hydraulics.force());
    }

    fn update_after_rigid_body(
        &mut self,
        context: &UpdateContext,
        connected_body: &LinearActuatedRigidBodyOnHingeAxis,
    ) {
        self.update_speed_position(context, connected_body);

        self.update_fluid_displacements(context);
    }

    fn update_speed_position(
        &mut self,
        context: &UpdateContext,
        connected_body: &LinearActuatedRigidBodyOnHingeAxis,
    ) {
        self.last_position = self.position;
        self.position = connected_body.linear_extension_to_anchor();

        self.position_normalized = (self.position - self.min_absolute_length) / self.total_travel;

        self.delta_displacement = self.position - self.last_position;

        self.speed = self.delta_displacement / context.delta_as_time();
    }

    fn update_fluid_displacements(&mut self, context: &UpdateContext) {
        // TODO We disable flow consumption and return for damping modes
        // This needs a clean rework as depending on volume extension ratio and displacement direction this
        // might not be physically possible to ignore return flow in damping modes and could cause reservoir quantity discrepencies
        match self.core_hydraulics.mode() {
            LinearActuatorMode::PositionControl | LinearActuatorMode::ClosedValves => {
                let mut volume_to_actuator = Volume::new::<cubic_meter>(0.);
                let mut volume_to_reservoir = Volume::new::<cubic_meter>(0.);

                if self.delta_displacement > Length::new::<meter>(0.) {
                    volume_to_actuator = self.delta_displacement * self.bore_side_area;
                    volume_to_reservoir = volume_to_actuator / self.volume_extension_ratio;
                } else if self.delta_displacement < Length::new::<meter>(0.) {
                    volume_to_actuator = -self.delta_displacement * self.rod_side_area;
                    volume_to_reservoir = volume_to_actuator * self.volume_extension_ratio;
                }

                self.signed_flow = if self.delta_displacement >= Length::new::<meter>(0.) {
                    volume_to_actuator
                } else {
                    -volume_to_actuator
                } / context.delta_as_time();

                self.total_volume_to_actuator += volume_to_actuator;
                self.total_volume_to_reservoir += volume_to_reservoir;
            }
            _ => {}
        }
    }

    fn set_position_target(&mut self, target_position: Ratio) {
        self.requested_position = target_position;
    }

    fn position_normalized(&self) -> Ratio {
        self.position_normalized
    }

    #[cfg(test)]
    fn force(&self) -> Force {
        self.core_hydraulics.force()
    }
}
impl Actuator for LinearActuator {
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

pub trait HydraulicAssemblyController {
    fn requested_mode(&self) -> LinearActuatorMode;
    fn requested_position(&self) -> Ratio;
    fn should_lock(&self) -> bool;
    fn requested_lock_position(&self) -> Ratio;
}

pub struct HydraulicLinearActuatorAssembly<const N: usize> {
    linear_actuators: [LinearActuator; N],
    rigid_body: LinearActuatedRigidBodyOnHingeAxis,
}
impl<const N: usize> HydraulicLinearActuatorAssembly<N> {
    pub fn new(
        linear_actuators: [LinearActuator; N],
        rigid_body: LinearActuatedRigidBodyOnHingeAxis,
    ) -> Self {
        Self {
            linear_actuators,
            rigid_body,
        }
    }

    pub fn actuator(&mut self, index: usize) -> &mut impl Actuator {
        assert!(index < N);
        &mut self.linear_actuators[index]
    }

    pub fn body(&mut self) -> &mut impl AerodynamicBody {
        &mut self.rigid_body
    }

    pub fn update(
        &mut self,
        context: &UpdateContext,
        assembly_controllers: &[impl HydraulicAssemblyController],
        current_pressure: [Pressure; N],
    ) {
        for (index, actuator) in self.linear_actuators.iter_mut().enumerate() {
            actuator.set_position_target(assembly_controllers[index].requested_position());
        }

        // Only one lock mechanism on the connected rigid body so we only look at first controller demand
        // We could decide it's a OR or AND over all actuators if not satisfying this way
        self.update_lock_mechanism(&assembly_controllers[0]);

        if !self.rigid_body.is_locked() {
            for (index, actuator) in self.linear_actuators.iter_mut().enumerate() {
                actuator.update_before_rigid_body(
                    context,
                    &mut self.rigid_body,
                    assembly_controllers[index].requested_mode(),
                    current_pressure[index],
                );
            }

            self.rigid_body.update(context);

            for actuator in &mut self.linear_actuators {
                actuator.update_after_rigid_body(context, &self.rigid_body);
            }
        } else {
            self.rigid_body.update(context);
        }
    }

    fn update_lock_mechanism(&mut self, assembly_controller: &impl HydraulicAssemblyController) {
        if assembly_controller.should_lock() {
            self.rigid_body
                .lock_at_position_normalized(assembly_controller.requested_lock_position())
        } else {
            self.rigid_body.unlock();
        }
    }

    pub fn is_locked(&self) -> bool {
        self.rigid_body.is_locked()
    }

    pub fn position_normalized(&self) -> Ratio {
        self.rigid_body.position_normalized()
    }

    pub fn actuator_position_normalized(&self, index: usize) -> Ratio {
        self.linear_actuators[index].position_normalized()
    }
}

/// Represent any physical object able to rotate on a hinge axis.
/// It can be a gear, elevator, cargo door, etc. Only one rotation degree of freedom is handled.
/// An linear actuator or multiple linear actuators can apply forces to its control arm.
///
/// Coordinates are as follows:
/// on x (left->right looking at the plane from the back)
/// on y (down->up)
/// on z (aft->fwd)
///
/// All coordinate references are from the hinge axis. So (0,0,0) is the hinge rotation axis center.
#[derive(PartialEq, Clone, Copy)]
pub struct LinearActuatedRigidBodyOnHingeAxis {
    total_travel: Angle,
    min_angle: Angle,
    max_angle: Angle,

    // size in meters
    size: Vector3<f64>,

    center_of_gravity_offset: Vector3<f64>,
    center_of_gravity_actual: Vector3<f64>,

    control_arm: Vector3<f64>,
    control_arm_actual: Vector3<f64>,
    actuator_extension_gives_positive_angle: bool,

    anchor_point: Vector3<f64>,

    angular_position: Angle,
    angular_speed: AngularVelocity,
    angular_acceleration: AngularAcceleration,
    sum_of_torques: Torque,

    position_normalized: Ratio,
    position_normalized_prev: Ratio,

    mass: Mass,
    inertia_at_hinge: f64,

    natural_damping_constant: f64,

    lock_position_request: Ratio,
    is_lock_requested: bool,
    is_locked: bool,

    axis_direction: Vector3<f64>,
    rotation_transform: Rotation3<f64>,

    plane_acceleration_filtered: LowPassFilter<Vector3<f64>>,
}
impl LinearActuatedRigidBodyOnHingeAxis {
    // Rebound energy when hiting min or max position. 0.3 means the body rebounds at 30% of the speed it hit the min/max position
    const DEFAULT_MAX_MIN_POSITION_REBOUND_FACTOR: f64 = 0.3;
    const PLANE_ACCELERATION_FILTERING_TIME_CONSTANT: Duration = Duration::from_millis(100);

    pub fn new(
        mass: Mass,
        size: Vector3<f64>,
        center_of_gravity_offset: Vector3<f64>,
        control_arm: Vector3<f64>,
        anchor_point: Vector3<f64>,
        min_angle: Angle,
        total_travel: Angle,
        init_angle: Angle,
        natural_damping_constant: f64,
        locked: bool,
        axis_direction: Vector3<f64>,
    ) -> Self {
        // The inertia about a given axis is the sum of squares of the size of the rectangle, minus
        // the size along the axis dimension
        let relevant_inertia = size.norm_squared();
        let relevant_inertia = relevant_inertia - (size.dot(&axis_direction)).powf(2.);
        let inertia_at_cog = (1. / 12.) * mass.get::<kilogram>() * relevant_inertia;
        // Parallel axis theorem to get inertia at hinge axis from inertia at CoG
        let inertia_at_hinge =
            inertia_at_cog + mass.get::<kilogram>() * center_of_gravity_offset.norm_squared();

        let mut new_body = Self {
            total_travel,
            min_angle,
            max_angle: min_angle + total_travel,
            size,
            center_of_gravity_offset,
            center_of_gravity_actual: center_of_gravity_offset,
            control_arm,
            control_arm_actual: control_arm,
            actuator_extension_gives_positive_angle: false,
            anchor_point,
            angular_position: init_angle,
            angular_speed: AngularVelocity::new::<radian_per_second>(0.),
            angular_acceleration: AngularAcceleration::new::<radian_per_second_squared>(0.),
            sum_of_torques: Torque::new::<newton_meter>(0.),
            position_normalized: Ratio::new::<ratio>(0.),
            position_normalized_prev: Ratio::new::<ratio>(0.),
            mass,
            inertia_at_hinge,
            natural_damping_constant,
            lock_position_request: Ratio::new::<ratio>(0.),
            is_lock_requested: locked,
            is_locked: locked,
            axis_direction,
            rotation_transform: Rotation3::from_axis_angle(
                &Unit::new_normalize(axis_direction),
                0.,
            ),
            plane_acceleration_filtered: LowPassFilter::<Vector3<f64>>::new(
                Self::PLANE_ACCELERATION_FILTERING_TIME_CONSTANT,
            ),
        };
        // Make sure the new object has coherent structure by updating internal roations and positions once
        new_body.initialize_actuator_force_direction();
        new_body.update_all_rotations();
        new_body.init_position_normalized();
        new_body
    }

    pub fn apply_control_arm_force(&mut self, actuator_local_force: Force) {
        let absolute_actuator_force = -actuator_local_force;

        // Computing the normalized vector on which force is applied. This is the vector from anchor point of actuator to where
        // it is connected to the rigid body
        let force_support_vector = self.anchor_point - self.control_arm_actual;
        let force_support_vector_normalized = force_support_vector / force_support_vector.norm();

        // Final torque is control arm position relative to hinge, cross product with
        // magnitude of the force applied on the force support vector
        let torque = self
            .control_arm
            .cross(&(absolute_actuator_force.get::<newton>() * force_support_vector_normalized));

        let torque_value = Torque::new::<newton_meter>(self.axis_direction.dot(&torque));

        self.sum_of_torques += torque_value;
    }

    pub fn apply_aero_force(&mut self, aerodynamic_force: Vector3<Force>) {
        // Aero force applied at CG for now, might change to a different point
        let torque = self.center_of_gravity_actual.cross(&Vector3::<f64>::new(
            aerodynamic_force[0].get::<newton>(),
            aerodynamic_force[1].get::<newton>(),
            aerodynamic_force[2].get::<newton>(),
        ));

        let torque_value = Torque::new::<newton_meter>(self.axis_direction.dot(&torque));

        self.sum_of_torques += torque_value;
    }

    pub fn linear_extension_to_anchor(&self) -> Length {
        Length::new::<meter>((self.anchor_point - self.control_arm_actual).norm())
    }

    /// Indicates correct direction of the rigid body when an actuator would be extending or compressing.
    /// If extending actuator would give an increasing rigid body angle, sets TRUE
    /// If extending actuator would give a decreasing rigid body angle, sets FALSE
    fn initialize_actuator_force_direction(&mut self) {
        self.actuator_extension_gives_positive_angle = self
            .absolute_length_to_anchor_at_angle(self.min_angle)
            < self.absolute_length_to_anchor_at_angle(self.max_angle)
    }

    /// If extending actuator would give an increasing rigid body angle, returns TRUE
    /// If extending actuator would give a decreasing rigid body angle, returns FALSE
    pub fn actuator_extension_gives_positive_angle(&self) -> bool {
        self.actuator_extension_gives_positive_angle
    }

    fn lock_requested_position_in_absolute_reference(&self) -> Angle {
        if self.actuator_extension_gives_positive_angle() {
            self.lock_position_request.get::<ratio>() * self.total_travel + self.min_angle
        } else {
            self.lock_position_request.get::<ratio>() * self.total_travel + self.max_angle
        }
    }

    pub fn position_normalized(&self) -> Ratio {
        self.position_normalized
    }

    fn init_position_normalized(&mut self) {
        self.update_position_normalized();
        self.position_normalized_prev = self.position_normalized;
    }

    fn update_position_normalized(&mut self) {
        self.position_normalized_prev = self.position_normalized;

        self.position_normalized = (self.angular_position - self.min_angle) / self.total_travel;

        if !self.actuator_extension_gives_positive_angle() {
            self.position_normalized = Ratio::new::<ratio>(1.) - self.position_normalized;
        };
    }

    // Rotates the static coordinates of the body according to its current angle to get the actual coordinates
    fn update_all_rotations(&mut self) {
        self.rotation_transform = Rotation3::from_axis_angle(
            &Unit::new_normalize(self.axis_direction),
            self.angular_position.get::<radian>(),
        );
        self.control_arm_actual = self.rotation_transform * self.control_arm;
        self.center_of_gravity_actual = self.rotation_transform * self.center_of_gravity_offset;
    }

    // Computes local acceleration including world gravity and plane acceleration
    // Note that this does not compute acceleration due to angular velocity of the plane
    fn local_acceleration_and_gravity(&self, context: &UpdateContext) -> Torque {
        let plane_acceleration_plane_reference = self.plane_acceleration_filtered.output();

        let pitch_rotation = context.attitude().pitch_rotation_transform();

        let bank_rotation = context.attitude().bank_rotation_transform();

        let gravity_acceleration_world_reference = Vector3::new(0., -9.8, 0.);

        // Total acceleration in plane reference is the gravity in world reference rotated to plane reference. To this we substract
        // the local plane reference to get final local acceleration (if plane falling at 1G final local accel is 1G of gravity - 1G local accel = 0G)
        let total_acceleration_plane_reference = (pitch_rotation
            * (bank_rotation * gravity_acceleration_world_reference))
            - plane_acceleration_plane_reference;

        // We add a 0 component to make the 2D CG position a 3D vector so we can compute a cross product easily

        // Force = m * G
        let resultant_force_plane_reference =
            total_acceleration_plane_reference * self.mass.get::<kilogram>();

        // The Moment generated by acceleration force is the CoG offset from hinge position cross product with the acceleration force
        let gravity_moment_vector = self
            .center_of_gravity_actual
            .cross(&resultant_force_plane_reference);

        // We work with only one degree of freedom so final result holds in the hinge rotation component only
        Torque::new::<newton_meter>(gravity_moment_vector.dot(&self.axis_direction))
    }

    // A global damping factor that simulates hinge friction and local air resistance
    fn natural_damping(&self) -> Torque {
        Torque::new::<newton_meter>(
            -self.angular_speed.get::<radian_per_second>() * self.natural_damping_constant,
        )
    }

    pub fn update(&mut self, context: &UpdateContext) {
        self.plane_acceleration_filtered
            .update(context.delta(), context.acceleration().to_ms2_vector());

        if !self.is_locked {
            self.sum_of_torques +=
                self.natural_damping() + self.local_acceleration_and_gravity(context);

            self.angular_acceleration = AngularAcceleration::new::<radian_per_second_squared>(
                self.sum_of_torques.get::<newton_meter>() / self.inertia_at_hinge,
            );

            self.angular_speed += AngularVelocity::new::<radian_per_second>(
                self.angular_acceleration.get::<radian_per_second_squared>()
                    * context.delta_as_secs_f64(),
            );

            self.angular_position += Angle::new::<radian>(
                self.angular_speed.get::<radian_per_second>() * context.delta_as_secs_f64(),
            );

            self.update_lock_state();
            self.limit_position_to_range();

            self.update_position_normalized();
            self.update_all_rotations();
        }

        self.sum_of_torques = Torque::new::<newton_meter>(0.);
    }

    fn update_lock_state(&mut self) {
        // We check if lock is requested and if we crossed the lock position since last update
        if self.is_lock_requested
            && (self.position_normalized >= self.lock_position_request
                && self.position_normalized_prev <= self.lock_position_request
                || self.position_normalized <= self.lock_position_request
                    && self.position_normalized_prev >= self.lock_position_request)
        {
            self.is_locked = true;
            self.angular_position = self.lock_requested_position_in_absolute_reference();
            self.angular_speed = AngularVelocity::new::<radian_per_second>(0.);
        }
    }

    fn limit_position_to_range(&mut self) {
        if self.angular_position >= self.max_angle {
            self.angular_position = self.max_angle;
            self.angular_speed =
                -self.angular_speed * Self::DEFAULT_MAX_MIN_POSITION_REBOUND_FACTOR;
        } else if self.angular_position <= self.min_angle {
            self.angular_position = self.min_angle;
            self.angular_speed =
                -self.angular_speed * Self::DEFAULT_MAX_MIN_POSITION_REBOUND_FACTOR;
        }
    }

    pub fn unlock(&mut self) {
        self.is_locked = false;
        self.is_lock_requested = false;
    }

    pub fn lock_at_position_normalized(&mut self, position_normalized: Ratio) {
        self.is_lock_requested = true;
        self.lock_position_request = position_normalized;
    }

    pub fn is_locked(&self) -> bool {
        self.is_locked
    }

    fn absolute_length_to_anchor_at_angle(&self, position: Angle) -> Length {
        let rotation = Rotation3::from_axis_angle(
            &Unit::new_normalize(self.axis_direction),
            position.get::<radian>(),
        );
        let control_arm_position = rotation * self.control_arm;

        Length::new::<meter>((self.anchor_point - control_arm_position).norm())
    }
}
impl BoundedLinearLength for LinearActuatedRigidBodyOnHingeAxis {
    fn min_absolute_length_to_anchor(&self) -> Length {
        let length_at_min_angle = self.absolute_length_to_anchor_at_angle(self.min_angle);
        let length_at_max_angle = self.absolute_length_to_anchor_at_angle(self.max_angle);
        length_at_min_angle.min(length_at_max_angle)
    }

    fn max_absolute_length_to_anchor(&self) -> Length {
        let length_at_min_angle = self.absolute_length_to_anchor_at_angle(self.min_angle);
        let length_at_max_angle = self.absolute_length_to_anchor_at_angle(self.max_angle);
        length_at_min_angle.max(length_at_max_angle)
    }

    fn absolute_length_to_anchor(&self) -> Length {
        self.linear_extension_to_anchor()
    }
}
impl AerodynamicBody for LinearActuatedRigidBodyOnHingeAxis {
    fn size(&self) -> Vector3<Length> {
        Vector3::new(
            Length::new::<meter>(self.size[0]),
            Length::new::<meter>(self.size[1]),
            Length::new::<meter>(self.size[2]),
        )
    }

    fn rotation_transform(&self) -> Rotation3<f64> {
        Rotation3::from_axis_angle(
            &Unit::new_normalize(self.axis_direction),
            self.angular_position.get::<radian>(),
        )
    }

    fn apply_aero_forces(&mut self, aero_forces: Vector3<Force>) {
        self.apply_aero_force(aero_forces);
    }
}

#[cfg(test)]
mod tests {
    use nalgebra::Vector3;

    use super::*;

    use crate::shared::update_iterator::MaxStepLoop;
    use crate::simulation::test::{SimulationTestBed, TestBed, WriteByName};
    use crate::simulation::{Aircraft, SimulationElement};
    use std::time::Duration;
    use uom::si::{angle::degree, mass::kilogram, pressure::psi};

    #[derive(PartialEq, Clone, Copy)]
    struct TestHydraulicAssemblyController {
        mode: LinearActuatorMode,
        requested_position: Ratio,
        lock_request: bool,
        lock_position: Ratio,
    }
    impl TestHydraulicAssemblyController {
        fn new() -> Self {
            Self {
                mode: LinearActuatorMode::ClosedValves,

                requested_position: Ratio::new::<ratio>(0.),
                lock_request: true,
                lock_position: Ratio::new::<ratio>(0.),
            }
        }

        fn set_mode(&mut self, mode: LinearActuatorMode) {
            self.mode = mode;
        }

        fn set_lock(&mut self, lock_position: Ratio) {
            self.lock_request = true;
            self.lock_position = lock_position;
        }

        fn set_unlock(&mut self) {
            self.lock_request = false;
        }

        fn set_position_target(&mut self, requested_position: Ratio) {
            self.requested_position = requested_position;
        }
    }
    impl HydraulicAssemblyController for TestHydraulicAssemblyController {
        fn requested_mode(&self) -> LinearActuatorMode {
            self.mode
        }

        fn requested_position(&self) -> Ratio {
            self.requested_position
        }

        fn should_lock(&self) -> bool {
            self.lock_request
        }

        fn requested_lock_position(&self) -> Ratio {
            self.lock_position
        }
    }

    struct TestAerodynamicModel {
        force: Vector3<Force>,
    }
    impl TestAerodynamicModel {
        fn new() -> Self {
            Self {
                force: Vector3::<Force>::new(Force::default(), Force::default(), Force::default()),
            }
        }

        fn apply_up_force(&mut self, force_up: Force) {
            self.force[1] = force_up;
        }

        fn update_body(&self, body: &mut impl AerodynamicBody) {
            body.apply_aero_forces(self.force);
        }
    }

    struct TestAircraft<const N: usize> {
        loop_updater: MaxStepLoop,

        hydraulic_assembly: HydraulicLinearActuatorAssembly<N>,

        controllers: [TestHydraulicAssemblyController; N],

        pressures: [Pressure; N],

        aero_forces: TestAerodynamicModel,
    }
    impl<const N: usize> TestAircraft<N> {
        fn new(
            time_step: Duration,
            hydraulic_assembly: HydraulicLinearActuatorAssembly<N>,
        ) -> Self {
            Self {
                loop_updater: MaxStepLoop::new(time_step),

                hydraulic_assembly,

                controllers: [TestHydraulicAssemblyController::new(); N],

                pressures: [Pressure::new::<psi>(0.); N],

                aero_forces: TestAerodynamicModel::new(),
            }
        }

        fn set_pressures(&mut self, pressures: [Pressure; N]) {
            self.pressures = pressures;
        }

        fn command_active_damping_mode(&mut self, actuator_id: usize) {
            assert!(actuator_id < N);
            self.controllers[actuator_id].set_mode(LinearActuatorMode::ActiveDamping);
        }

        fn command_closed_circuit_damping_mode(&mut self, actuator_id: usize) {
            assert!(actuator_id < N);
            self.controllers[actuator_id].set_mode(LinearActuatorMode::ClosedCircuitDamping);
        }

        fn command_closed_valve_mode(&mut self, actuator_id: usize) {
            assert!(actuator_id < N);
            self.controllers[actuator_id].set_mode(LinearActuatorMode::ClosedValves);
        }

        fn command_position_control(&mut self, position: Ratio, actuator_id: usize) {
            assert!(actuator_id < N);
            self.controllers[actuator_id].set_mode(LinearActuatorMode::PositionControl);
            self.controllers[actuator_id].set_position_target(position);
        }

        fn command_lock(&mut self, lock_position: Ratio) {
            for controller in &mut self.controllers {
                controller.set_lock(lock_position);
            }
        }

        fn command_unlock(&mut self) {
            for controller in &mut self.controllers {
                controller.set_unlock();
            }
        }

        fn body_position(&self) -> Ratio {
            self.hydraulic_assembly.position_normalized()
        }

        fn apply_up_aero_forces(&mut self, force_up: Force) {
            self.aero_forces.apply_up_force(force_up);
        }

        fn actuator_position(&self, actuator_id: usize) -> Ratio {
            assert!(actuator_id < N);
            self.hydraulic_assembly
                .actuator_position_normalized(actuator_id)
        }

        fn is_locked(&self) -> bool {
            self.hydraulic_assembly.is_locked()
        }

        fn update_actuator_physics(&mut self, context: &UpdateContext) {
            self.aero_forces.update_body(self.hydraulic_assembly.body());

            self.hydraulic_assembly
                .update(context, &self.controllers[..], self.pressures);

            println!(
                "Body angle {:.2} Body Npos {:.3}, Act Npos {:.3}, Act force {:.1}",
                self.hydraulic_assembly
                    .rigid_body
                    .angular_position
                    .get::<degree>(),
                self.hydraulic_assembly
                    .rigid_body
                    .position_normalized()
                    .get::<ratio>(),
                self.hydraulic_assembly.linear_actuators[0]
                    .position_normalized
                    .get::<ratio>(),
                self.hydraulic_assembly.linear_actuators[0]
                    .force()
                    .get::<newton>(),
            );
        }
    }
    impl Aircraft for TestAircraft<1> {
        fn update_after_power_distribution(&mut self, context: &UpdateContext) {
            self.loop_updater.update(context);

            for cur_time_step in self.loop_updater {
                self.update_actuator_physics(&context.with_delta(cur_time_step));
            }
        }
    }
    impl SimulationElement for TestAircraft<1> {}

    impl Aircraft for TestAircraft<2> {
        fn update_after_power_distribution(&mut self, context: &UpdateContext) {
            self.loop_updater.update(context);

            for cur_time_step in self.loop_updater {
                self.update_actuator_physics(&context.with_delta(cur_time_step));
            }
        }
    }
    impl SimulationElement for TestAircraft<2> {}

    #[test]
    fn linear_actuator_not_moving_on_locked_rigid_body() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(33), cargo_door_assembly(true))
        });

        let actuator_position_init = test_bed.query(|a| a.body_position());

        test_bed.run_with_delta(Duration::from_secs(1));

        assert!(test_bed.query(|a| a.body_position()) == actuator_position_init);
    }

    #[test]
    fn linear_actuator_moving_on_unlocked_rigid_body() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(33), cargo_door_assembly(true))
        });

        let actuator_position_init = test_bed.query(|a| a.body_position());

        test_bed.run_with_delta(Duration::from_secs(1));

        assert!(test_bed.query(|a| a.body_position()) == actuator_position_init);

        test_bed.command(|a| a.command_unlock());
        test_bed.run_with_delta(Duration::from_secs(5));

        assert!(test_bed.query(|a| a.body_position()) > actuator_position_init);
    }

    #[test]
    fn linear_actuator_can_move_rigid_body_up() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(33), cargo_door_assembly(true))
        });

        let actuator_position_init = test_bed.query(|a| a.body_position());

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(1.1), 0));

        test_bed.command(|a| a.set_pressures([Pressure::new::<psi>(3000.)]));

        test_bed.run_with_delta(Duration::from_secs(1));

        assert!(test_bed.query(|a| a.body_position()) > actuator_position_init);

        test_bed.run_with_delta(Duration::from_secs(25));

        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.9));
    }

    #[test]
    fn linear_actuator_resists_body_drop_when_valves_closed() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(33), cargo_door_assembly(true))
        });

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(1.), 0));

        test_bed.command(|a| a.set_pressures([Pressure::new::<psi>(3000.)]));

        test_bed.run_with_delta(Duration::from_secs(25));

        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.9));

        test_bed.command(|a| a.command_closed_valve_mode(0));

        test_bed.run_with_delta(Duration::from_secs(25));

        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.7));
    }

    #[test]
    fn linear_actuator_dampens_body_drop_when_active_damping_mode() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(33), cargo_door_assembly(true))
        });

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(1.), 0));

        test_bed.command(|a| a.set_pressures([Pressure::new::<psi>(3000.)]));

        test_bed.run_with_delta(Duration::from_secs(25));

        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.9));

        test_bed.command(|a| a.command_active_damping_mode(0));

        test_bed.run_with_delta(Duration::from_secs(1));

        assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.9));
        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.5));
    }

    #[test]
    fn linear_actuator_dampens_super_slow_body_drop_when_slow_damping_mode() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(33), cargo_door_assembly(true))
        });

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(1.), 0));

        test_bed.command(|a| a.set_pressures([Pressure::new::<psi>(3000.)]));

        test_bed.run_with_delta(Duration::from_secs(25));

        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.9));

        test_bed.command(|a| a.command_closed_circuit_damping_mode(0));

        test_bed.run_with_delta(Duration::from_secs(10));

        assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.9));
        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.5));
    }

    #[test]
    fn linear_actuator_without_hyd_pressure_cant_move_body_up() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(33), cargo_door_assembly(true))
        });

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(1.), 0));

        test_bed.command(|a| a.set_pressures([Pressure::new::<psi>(0.)]));

        test_bed.run_with_delta(Duration::from_secs(25));

        assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.3));
    }

    #[test]
    fn linear_actuator_losing_hyd_pressure_half_way_cant_move_body_up() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(33), cargo_door_assembly(true))
        });

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(1.), 0));

        test_bed.command(|a| a.set_pressures([Pressure::new::<psi>(3000.)]));

        test_bed.run_with_delta(Duration::from_secs(10));

        let actuator_position_at_10s = test_bed.query(|a| a.body_position());

        println!("PRESSURE LOST!");
        test_bed.command(|a| a.set_pressures([Pressure::new::<psi>(0.)]));
        test_bed.run_with_delta(Duration::from_secs(25));

        assert!(
            test_bed.query(|a| a.body_position())
                <= actuator_position_at_10s + Ratio::new::<ratio>(0.05)
        );
    }

    #[test]
    fn body_gravity_movement_if_unlocked() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(33), cargo_door_assembly(false))
        });

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| a.command_active_damping_mode(0));

        test_bed.write_by_name(UpdateContext::PLANE_BANK_KEY, -45.);

        test_bed.run_with_delta(Duration::from_secs(25));

        // At 45 degrees bank angle we expect door around mid position
        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.4));
        assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.6));
    }

    #[test]
    fn start_moving_once_unlocked() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(33), cargo_door_assembly(true))
        });

        test_bed.write_by_name(UpdateContext::PLANE_BANK_KEY, -45.);

        let actuator_position_at_init = test_bed.query(|a| a.body_position());
        test_bed.run_with_delta(Duration::from_secs(5));

        assert!(test_bed.query(|a| a.body_position()) == actuator_position_at_init);

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| a.command_active_damping_mode(0));

        test_bed.run_with_delta(Duration::from_secs(5));

        assert!(test_bed.query(|a| a.body_position()) > actuator_position_at_init);
    }

    #[test]
    fn locks_at_required_position() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(33), cargo_door_assembly(true))
        });

        test_bed.write_by_name(UpdateContext::PLANE_BANK_KEY, -45.);

        let actuator_position_at_init = test_bed.query(|a| a.body_position());
        test_bed.run_with_delta(Duration::from_secs(5));

        assert!(test_bed.query(|a| a.body_position()) == actuator_position_at_init);

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| a.command_active_damping_mode(0));

        test_bed.run_with_delta(Duration::from_secs_f64(0.1));

        assert!(test_bed.query(|a| a.body_position()) > actuator_position_at_init);

        test_bed.command(|a| a.command_lock(Ratio::new::<ratio>(0.3)));

        test_bed.run_with_delta(Duration::from_secs(20));

        assert!(test_bed.query(|a| a.is_locked()));
        assert!(test_bed.query(|a| a.body_position()) == Ratio::new::<ratio>(0.3));
    }

    #[test]
    fn linear_actuator_can_control_position() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(33), cargo_door_assembly(true))
        });

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(0.7), 0));

        test_bed.command(|a| a.set_pressures([Pressure::new::<psi>(3000.)]));

        test_bed.run_with_delta(Duration::from_secs(20));

        assert!(test_bed.query(|a| a.actuator_position(0)) > Ratio::new::<ratio>(0.68));
        assert!(test_bed.query(|a| a.actuator_position(0)) < Ratio::new::<ratio>(0.72));

        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(0.2), 0));
        test_bed.run_with_delta(Duration::from_secs(20));

        assert!(test_bed.query(|a| a.actuator_position(0)) > Ratio::new::<ratio>(0.18));
        assert!(test_bed.query(|a| a.actuator_position(0)) < Ratio::new::<ratio>(0.22));
    }

    #[test]
    fn right_main_gear_door_drops_when_unlocked() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(
                Duration::from_millis(33),
                main_gear_door_right_assembly(true),
            )
        });

        test_bed.command(|a| a.command_closed_circuit_damping_mode(0));
        test_bed.command(|a| a.command_unlock());
        test_bed.run_with_delta(Duration::from_secs(20));

        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.98));
    }

    #[test]
    fn right_main_gear_door_drops_freefall_when_unlocked_with_broken_actuator() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(
                Duration::from_millis(33),
                main_gear_door_right_broken_assembly(true),
            )
        });

        test_bed.command(|a| a.command_closed_circuit_damping_mode(0));
        test_bed.command(|a| a.command_unlock());
        test_bed.run_with_delta(Duration::from_secs_f64(1.));

        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.9));
    }

    #[test]
    fn left_main_gear_door_drops_when_unlocked() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(
                Duration::from_millis(33),
                main_gear_door_left_assembly(true),
            )
        });

        test_bed.command(|a| a.command_closed_circuit_damping_mode(0));
        test_bed.command(|a| a.command_unlock());
        test_bed.run_with_delta(Duration::from_secs(20));

        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.98));
    }

    #[test]
    fn right_main_gear_door_cant_open_fully_if_banking_right() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(
                Duration::from_millis(33),
                main_gear_door_right_assembly(true),
            )
        });

        test_bed.run_with_delta(Duration::from_secs(1));

        test_bed.write_by_name(UpdateContext::PLANE_BANK_KEY, -45.);
        test_bed.command(|a| a.command_closed_circuit_damping_mode(0));
        test_bed.command(|a| a.command_unlock());
        test_bed.run_with_delta(Duration::from_secs(20));

        assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.8));
    }

    #[test]
    fn left_main_gear_door_can_open_fully_if_banking_right() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(
                Duration::from_millis(33),
                main_gear_door_left_assembly(true),
            )
        });

        test_bed.write_by_name(UpdateContext::PLANE_BANK_KEY, -45.);
        test_bed.command(|a| a.command_closed_circuit_damping_mode(0));
        test_bed.command(|a| a.command_unlock());
        test_bed.run_with_delta(Duration::from_secs(20));

        assert!(test_bed.query(|a| a.body_position()) >= Ratio::new::<ratio>(0.98));
    }

    #[test]
    fn left_main_gear_door_opens_with_pressure() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(
                Duration::from_millis(33),
                main_gear_door_left_assembly(true),
            )
        });

        test_bed.command(|a| a.set_pressures([Pressure::new::<psi>(3000.)]));
        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(1.5), 0));
        test_bed.command(|a| a.command_unlock());
        test_bed.run_with_delta(Duration::from_secs(4));

        assert!(test_bed.query(|a| a.body_position()) >= Ratio::new::<ratio>(0.98));
    }

    #[test]
    fn right_main_gear_door_closes_after_opening_with_pressure() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(
                Duration::from_millis(33),
                main_gear_door_right_assembly(true),
            )
        });

        test_bed.command(|a| a.set_pressures([Pressure::new::<psi>(3000.)]));
        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(1.5), 0));
        test_bed.command(|a| a.command_unlock());
        test_bed.run_with_delta(Duration::from_secs(10));

        assert!(test_bed.query(|a| a.body_position()) >= Ratio::new::<ratio>(0.98));

        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(-0.5), 0));
        test_bed.command(|a| a.command_lock(Ratio::new::<ratio>(0.)));

        test_bed.run_with_delta(Duration::from_secs(6));
        assert!(test_bed.query(|a| a.body_position()) <= Ratio::new::<ratio>(0.001));
    }

    #[test]
    fn right_main_gear_retracts_with_pressure() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(33), main_gear_right_assembly(true))
        });

        test_bed.command(|a| a.set_pressures([Pressure::new::<psi>(3000.)]));
        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(1.5), 0));
        test_bed.command(|a| a.command_unlock());
        test_bed.run_with_delta(Duration::from_secs(10));

        assert!(test_bed.query(|a| a.body_position()) >= Ratio::new::<ratio>(0.98));
    }

    #[test]
    fn aileron_initialized_down_stays_down_with_broken_actuator() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(10), aileron_assembly(true))
        });

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| a.command_closed_circuit_damping_mode(0));
        test_bed.command(|a| a.command_closed_circuit_damping_mode(1));
        test_bed.run_with_delta(Duration::from_secs_f64(1.));

        assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.1));
    }

    #[test]
    fn aileron_initialized_down_moves_up_when_commanded() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(10), aileron_assembly(true))
        });

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| {
            a.set_pressures([Pressure::new::<psi>(3000.), Pressure::new::<psi>(3000.)])
        });
        test_bed.command(|a| a.command_active_damping_mode(0));
        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(1.), 1));
        test_bed.run_with_delta(Duration::from_secs_f64(2.));

        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.95));
    }

    #[test]
    fn aileron_drops_from_middle_pos_in_more_20s_in_closed_circuit_damping() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(10), aileron_assembly(false))
        });

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| a.command_closed_circuit_damping_mode(0));
        test_bed.command(|a| a.command_closed_circuit_damping_mode(1));
        test_bed.run_with_delta(Duration::from_secs_f64(20.));

        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.1));

        test_bed.run_with_delta(Duration::from_secs_f64(20.));
        assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.1));
    }

    #[test]
    fn aileron_drops_from_middle_pos_and_damping_is_stable() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(10), aileron_assembly(false))
        });

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| a.command_closed_circuit_damping_mode(0));
        test_bed.command(|a| a.command_closed_circuit_damping_mode(1));
        test_bed.run_with_delta(Duration::from_secs_f64(30.));

        assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.1));

        for _ in 0..20 {
            test_bed.run_with_delta(Duration::from_secs_f64(1.));
            assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.01));
        }
    }

    #[test]
    fn aileron_position_control_is_stable() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(10), aileron_assembly(false))
        });

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| {
            a.set_pressures([Pressure::new::<psi>(3000.), Pressure::new::<psi>(3000.)])
        });
        test_bed.command(|a| a.command_active_damping_mode(0));
        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(0.8), 1));

        // Step demand in 0.3s to position 0.8
        test_bed.run_with_delta(Duration::from_secs_f64(0.3));

        //Now check position is stable for 20s
        for _ in 0..20 {
            test_bed.run_with_delta(Duration::from_secs_f64(1.));
            assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.75));
            assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.85));
        }

        // Step demand in 0.3s to position 0.2
        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(0.2), 1));
        test_bed.run_with_delta(Duration::from_secs_f64(0.3));

        //Now check position is stable for 20s
        for _ in 0..20 {
            test_bed.run_with_delta(Duration::from_secs_f64(1.));
            assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.15));
            assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.25));
        }
    }

    #[test]
    fn aileron_position_control_from_down_to_up_less_0_5s() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(10), aileron_assembly(false))
        });

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| {
            a.set_pressures([Pressure::new::<psi>(3000.), Pressure::new::<psi>(3000.)])
        });

        // Let aileron fall fully down first
        test_bed.command(|a| a.command_active_damping_mode(0));
        test_bed.command(|a| a.command_active_damping_mode(1));
        test_bed.run_with_delta(Duration::from_secs_f64(2.));
        assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.01));

        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(1.), 1));
        test_bed.run_with_delta(Duration::from_secs_f64(0.5));

        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.95));
    }

    #[test]
    fn aileron_position_control_resists_step_change_in_aero_force() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(10), aileron_assembly(false))
        });

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| {
            a.set_pressures([Pressure::new::<psi>(3000.), Pressure::new::<psi>(3000.)])
        });

        // Let aileron control at 0.5 position
        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(0.5), 0));
        test_bed.command(|a| a.command_active_damping_mode(1));
        test_bed.run_with_delta(Duration::from_secs_f64(2.));
        assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.51));
        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.49));

        test_bed.command(|a| a.apply_up_aero_forces(Force::new::<newton>(5000.)));

        println!("APPLYING UP FORCE");
        test_bed.run_with_delta(Duration::from_secs_f64(1.));

        assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.51));
        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.49));
    }

    #[test]
    fn aileron_position_control_fails_when_aero_force_over_max_force() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(10), aileron_assembly(false))
        });

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| {
            a.set_pressures([Pressure::new::<psi>(3000.), Pressure::new::<psi>(3000.)])
        });

        // Let aileron control at 0.5 position
        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(0.5), 0));
        test_bed.command(|a| a.command_active_damping_mode(1));

        let mut test_force = Force::new::<newton>(2000.);

        for _ in 0..25 {
            println!("APPLYING UP FORCE {:.0}", test_force.get::<newton>());
            test_bed.command(|a| a.apply_up_aero_forces(test_force));
            test_bed.run_with_delta(Duration::from_secs_f64(0.5));

            test_force += Force::new::<newton>(300.);

            if test_force < Force::new::<newton>(8000.) {
                assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.51));
                assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.49));
            }
        }
        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.6));
        // test_bed.run_with_delta(Duration::from_secs_f64(1.));
    }

    #[test]
    fn aileron_position_control_fails_when_lower_pressure_and_back_in_position_with_pressure_back()
    {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(10), aileron_assembly(false))
        });

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| {
            a.set_pressures([Pressure::new::<psi>(3000.), Pressure::new::<psi>(3000.)])
        });

        // Let aileron control at 0.5 position
        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(0.5), 0));
        test_bed.command(|a| a.command_active_damping_mode(1));

        let mut test_pressure = Pressure::new::<psi>(3000.);

        for _ in 0..10 {
            println!("Reducing pressure {:.0}", test_pressure.get::<psi>());
            test_bed.command(|a| a.set_pressures([test_pressure, test_pressure]));
            test_bed.command(|a| a.apply_up_aero_forces(Force::new::<newton>(5000.)));
            test_bed.run_with_delta(Duration::from_secs_f64(0.3));

            test_pressure -= Pressure::new::<psi>(300.);

            test_pressure = test_pressure.max(Pressure::new::<psi>(0.));

            if test_pressure > Pressure::new::<psi>(2500.) {
                assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.51));
                assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.49));
            }
        }
        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.6));

        println!("Pressure back to 3000");
        test_bed.command(|a| {
            a.set_pressures([Pressure::new::<psi>(3000.), Pressure::new::<psi>(3000.)])
        });
        test_bed.run_with_delta(Duration::from_secs_f64(1.));

        assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.51));
        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.49));
    }

    #[test]
    fn aileron_position_control_from_down_to_up_less_0_5s_with_limited_pressure() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(10), aileron_assembly(false))
        });

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| {
            a.set_pressures([Pressure::new::<psi>(1700.), Pressure::new::<psi>(1700.)])
        });

        // Let aileron fall fully down first
        test_bed.command(|a| a.command_active_damping_mode(0));
        test_bed.command(|a| a.command_active_damping_mode(1));
        test_bed.run_with_delta(Duration::from_secs_f64(2.));
        assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.01));

        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(1.), 0));
        test_bed.run_with_delta(Duration::from_secs_f64(0.5));

        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.95));
    }

    #[test]
    fn elevator_position_control_is_stable_with_all_actuators_in_control() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(10), elevator_assembly())
        });

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| {
            a.set_pressures([Pressure::new::<psi>(3000.), Pressure::new::<psi>(3000.)])
        });

        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(0.8), 0));
        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(0.8), 1));

        // Step demand in 0.3s to position 0.8
        test_bed.run_with_delta(Duration::from_secs_f64(0.5));

        //Now check position is stable for 20s
        for _ in 0..20 {
            test_bed.run_with_delta(Duration::from_secs_f64(1.));
            assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.75));
            assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.85));
        }

        // Step demand in 0.3s to position 0.2
        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(0.2), 0));
        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(0.2), 1));
        test_bed.run_with_delta(Duration::from_secs_f64(0.5));

        // Now check position is stable for 20s
        for _ in 0..20 {
            test_bed.run_with_delta(Duration::from_secs_f64(1.));
            assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.15));
            assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.25));
        }
    }

    #[test]
    fn elevator_droop_control_is_stable_engaged_at_full_speed() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(10), elevator_assembly())
        });

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| {
            a.set_pressures([Pressure::new::<psi>(3000.), Pressure::new::<psi>(3000.)])
        });

        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(1.), 0));
        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(1.), 1));

        // Run until 0.8 position is reached
        for _ in 0..20 {
            test_bed.run_with_delta(Duration::from_secs_f64(0.1));
            if test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.8) {
                break;
            }
        }

        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.8));

        test_bed.command(|a| a.command_closed_circuit_damping_mode(0));
        test_bed.command(|a| a.command_closed_circuit_damping_mode(1));

        // Capture position at damping engagement
        let damping_start_position = test_bed.query(|a| a.body_position());

        // Wait for oscillations to settle
        test_bed.run_with_delta(Duration::from_secs_f64(0.5));

        // Now check position slowly decrease
        for _ in 0..10 {
            test_bed.run_with_delta(Duration::from_secs_f64(1.));
            assert!(test_bed.query(|a| a.body_position()) < damping_start_position);
        }
    }

    #[test]
    fn spoiler_position_control_from_down_to_up_less_0_8s() {
        let mut test_bed = SimulationTestBed::new(|_| {
            TestAircraft::new(Duration::from_millis(10), spoiler_assembly())
        });

        test_bed.command(|a| a.command_unlock());
        test_bed.command(|a| a.set_pressures([Pressure::new::<psi>(3000.)]));

        assert!(test_bed.query(|a| a.body_position()) < Ratio::new::<ratio>(0.01));

        test_bed.command(|a| a.command_position_control(Ratio::new::<ratio>(1.), 0));
        test_bed.run_with_delta(Duration::from_secs_f64(0.8));

        assert!(test_bed.query(|a| a.body_position()) > Ratio::new::<ratio>(0.95));
    }

    fn cargo_door_actuator(bounded_linear_length: &impl BoundedLinearLength) -> LinearActuator {
        const DEFAULT_I_GAIN: f64 = 5.;
        const DEFAULT_P_GAIN: f64 = 0.05;
        const DEFAULT_FORCE_GAIN: f64 = 200000.;

        LinearActuator::new(
            bounded_linear_length,
            2,
            Length::new::<meter>(0.04422),
            Length::new::<meter>(0.03366),
            VolumeRate::new::<gallon_per_second>(0.008),
            800000.,
            15000.,
            50000.,
            1200000.,
            Duration::from_millis(100),
            [1., 1., 1., 1., 1., 1.],
            [0., 0.2, 0.21, 0.79, 0.8, 1.],
            DEFAULT_P_GAIN,
            DEFAULT_I_GAIN,
            DEFAULT_FORCE_GAIN,
        )
    }

    fn cargo_door_assembly(is_locked: bool) -> HydraulicLinearActuatorAssembly<1> {
        let rigid_body = cargo_door_body(is_locked);
        let actuator = cargo_door_actuator(&rigid_body);

        HydraulicLinearActuatorAssembly::new([actuator], rigid_body)
    }

    fn cargo_door_body(is_locked: bool) -> LinearActuatedRigidBodyOnHingeAxis {
        let size = Vector3::new(100. / 1000., 1855. / 1000., 2025. / 1000.);
        let cg_offset = Vector3::new(0., -size[1] / 2., 0.);

        let control_arm = Vector3::new(-0.1597, -0.1614, 0.);
        let anchor = Vector3::new(-0.759, -0.086, 0.);

        LinearActuatedRigidBodyOnHingeAxis::new(
            Mass::new::<kilogram>(130.),
            size,
            cg_offset,
            control_arm,
            anchor,
            Angle::new::<degree>(-23.),
            Angle::new::<degree>(136.),
            Angle::new::<degree>(-23.),
            100.,
            is_locked,
            Vector3::new(0., 0., 1.),
        )
    }

    fn main_gear_door_right_assembly(is_locked: bool) -> HydraulicLinearActuatorAssembly<1> {
        let rigid_body = main_gear_door_right_body(is_locked);
        let actuator = main_gear_door_actuator(&rigid_body);

        HydraulicLinearActuatorAssembly::new([actuator], rigid_body)
    }

    fn main_gear_door_left_assembly(is_locked: bool) -> HydraulicLinearActuatorAssembly<1> {
        let rigid_body = main_gear_door_left_body(is_locked);
        let actuator = main_gear_door_actuator(&rigid_body);

        HydraulicLinearActuatorAssembly::new([actuator], rigid_body)
    }

    fn main_gear_door_right_broken_assembly(is_locked: bool) -> HydraulicLinearActuatorAssembly<1> {
        let rigid_body = main_gear_door_right_body(is_locked);
        let actuator = disconnected_actuator(&rigid_body);

        HydraulicLinearActuatorAssembly::new([actuator], rigid_body)
    }

    fn main_gear_door_actuator(bounded_linear_length: &impl BoundedLinearLength) -> LinearActuator {
        const DEFAULT_I_GAIN: f64 = 5.;
        const DEFAULT_P_GAIN: f64 = 0.05;
        const DEFAULT_FORCE_GAIN: f64 = 200000.;

        LinearActuator::new(
            bounded_linear_length,
            1,
            Length::new::<meter>(0.055),
            Length::new::<meter>(0.03),
            VolumeRate::new::<gallon_per_second>(0.08),
            20000.,
            5000.,
            2000.,
            28000.,
            Duration::from_millis(100),
            [0.5, 1., 1., 1., 1., 0.5],
            [0., 0.2, 0.21, 0.79, 0.8, 1.],
            DEFAULT_P_GAIN,
            DEFAULT_I_GAIN,
            DEFAULT_FORCE_GAIN,
        )
    }

    fn disconnected_actuator(bounded_linear_length: &impl BoundedLinearLength) -> LinearActuator {
        LinearActuator::new(
            bounded_linear_length,
            1,
            Length::new::<meter>(0.055),
            Length::new::<meter>(0.03),
            VolumeRate::new::<gallon_per_second>(0.004),
            0.,
            0.,
            0.,
            0.,
            Duration::from_millis(100),
            [0.5, 1., 1., 1., 1., 0.5],
            [0., 0.2, 0.21, 0.79, 0.8, 1.],
            0.,
            0.,
            0.,
        )
    }

    fn main_gear_door_right_body(is_locked: bool) -> LinearActuatedRigidBodyOnHingeAxis {
        let size = Vector3::new(1.73, 0.02, 1.7);
        let cg_offset = Vector3::new(2. / 3. * size[0], 0.1, 0.);

        let control_arm = Vector3::new(0.76, 0., 0.);
        let anchor = Vector3::new(0.19, 0.23, 0.);

        LinearActuatedRigidBodyOnHingeAxis::new(
            Mass::new::<kilogram>(50.),
            size,
            cg_offset,
            control_arm,
            anchor,
            Angle::new::<degree>(-85.),
            Angle::new::<degree>(85.),
            Angle::new::<degree>(0.),
            150.,
            is_locked,
            Vector3::new(0., 0., 1.),
        )
    }

    fn main_gear_door_left_body(is_locked: bool) -> LinearActuatedRigidBodyOnHingeAxis {
        let size = Vector3::new(-1.73, 0.02, 1.7);
        let cg_offset = Vector3::new(2. / 3. * size[0], 0.1, 0.);

        let control_arm = Vector3::new(-0.76, 0., 0.);
        let anchor = Vector3::new(-0.19, 0.23, 0.);

        LinearActuatedRigidBodyOnHingeAxis::new(
            Mass::new::<kilogram>(50.),
            size,
            cg_offset,
            control_arm,
            anchor,
            Angle::new::<degree>(0.),
            Angle::new::<degree>(85.),
            Angle::new::<degree>(0.),
            150.,
            is_locked,
            Vector3::new(0., 0., 1.),
        )
    }

    fn main_gear_right_assembly(is_locked: bool) -> HydraulicLinearActuatorAssembly<1> {
        let rigid_body = main_gear_right_body(is_locked);
        let actuator = main_gear_actuator(&rigid_body);

        HydraulicLinearActuatorAssembly::new([actuator], rigid_body)
    }

    fn main_gear_actuator(bounded_linear_length: &impl BoundedLinearLength) -> LinearActuator {
        const DEFAULT_I_GAIN: f64 = 5.;
        const DEFAULT_P_GAIN: f64 = 0.05;
        const DEFAULT_FORCE_GAIN: f64 = 200000.;

        LinearActuator::new(
            bounded_linear_length,
            1,
            Length::new::<meter>(0.145),
            Length::new::<meter>(0.105),
            VolumeRate::new::<gallon_per_second>(0.15),
            800000.,
            15000.,
            50000.,
            1200000.,
            Duration::from_millis(100),
            [1., 1., 1., 1., 1., 1.],
            [0., 0.2, 0.21, 0.79, 0.8, 1.],
            DEFAULT_P_GAIN,
            DEFAULT_I_GAIN,
            DEFAULT_FORCE_GAIN,
        )
    }

    fn main_gear_right_body(is_locked: bool) -> LinearActuatedRigidBodyOnHingeAxis {
        let size = Vector3::new(0.3, 3.453, 0.3);
        let cg_offset = Vector3::new(0., -3. / 4. * size[1], 0.);

        let control_arm = Vector3::new(-0.1815, 0.15, 0.);
        let anchor = Vector3::new(-0.26, 0.15, 0.);

        LinearActuatedRigidBodyOnHingeAxis::new(
            Mass::new::<kilogram>(700.),
            size,
            cg_offset,
            control_arm,
            anchor,
            Angle::new::<degree>(-80.),
            Angle::new::<degree>(80.),
            Angle::new::<degree>(0.),
            150.,
            is_locked,
            Vector3::new(0., 0., 1.),
        )
    }

    fn aileron_assembly(is_init_down: bool) -> HydraulicLinearActuatorAssembly<2> {
        let rigid_body = aileron_body(is_init_down);
        let actuator = aileron_actuator(&rigid_body);

        HydraulicLinearActuatorAssembly::new([actuator, actuator], rigid_body)
    }

    fn aileron_actuator(bounded_linear_length: &impl BoundedLinearLength) -> LinearActuator {
        const DEFAULT_I_GAIN: f64 = 5.;
        const DEFAULT_P_GAIN: f64 = 0.35;
        const DEFAULT_FORCE_GAIN: f64 = 450000.;

        LinearActuator::new(
            bounded_linear_length,
            1,
            Length::new::<meter>(0.0537878),
            Length::new::<meter>(0.),
            VolumeRate::new::<gallon_per_second>(0.055),
            80000.,
            1500.,
            5000.,
            800000.,
            Duration::from_millis(300),
            [1., 1., 1., 1., 1., 1.],
            [0., 0.2, 0.21, 0.79, 0.8, 1.],
            DEFAULT_P_GAIN,
            DEFAULT_I_GAIN,
            DEFAULT_FORCE_GAIN,
        )
    }

    fn aileron_body(is_init_down: bool) -> LinearActuatedRigidBodyOnHingeAxis {
        let size = Vector3::new(3.325, 0.16, 0.58);
        let cg_offset = Vector3::new(0., 0., -0.5 * size[2]);

        let control_arm = Vector3::new(0., -0.0525, 0.);
        let anchor = Vector3::new(0., -0.0525, 0.33);

        let init_angle = if is_init_down {
            Angle::new::<degree>(-25.)
        } else {
            Angle::new::<degree>(0.)
        };

        LinearActuatedRigidBodyOnHingeAxis::new(
            Mass::new::<kilogram>(24.65),
            size,
            cg_offset,
            control_arm,
            anchor,
            Angle::new::<degree>(-25.),
            Angle::new::<degree>(50.),
            init_angle,
            1.,
            false,
            Vector3::new(1., 0., 0.),
        )
    }

    fn elevator_assembly() -> HydraulicLinearActuatorAssembly<2> {
        let rigid_body = elevator_body();
        let actuator = elevator_actuator(&rigid_body);

        HydraulicLinearActuatorAssembly::new([actuator, actuator], rigid_body)
    }

    fn elevator_actuator(bounded_linear_length: &impl BoundedLinearLength) -> LinearActuator {
        const DEFAULT_I_GAIN: f64 = 5.;
        const DEFAULT_P_GAIN: f64 = 1.;
        const DEFAULT_FORCE_GAIN: f64 = 450000.;

        LinearActuator::new(
            bounded_linear_length,
            1,
            Length::new::<meter>(0.0407),
            Length::new::<meter>(0.),
            VolumeRate::new::<gallon_per_second>(0.029),
            80000.,
            1500.,
            20000.,
            10000000.,
            Duration::from_millis(300),
            [1., 1., 1., 1., 1., 1.],
            [0., 0.2, 0.21, 0.79, 0.8, 1.],
            DEFAULT_P_GAIN,
            DEFAULT_I_GAIN,
            DEFAULT_FORCE_GAIN,
        )
    }

    fn elevator_body() -> LinearActuatedRigidBodyOnHingeAxis {
        let size = Vector3::new(6., 0.405, 1.125);
        let cg_offset = Vector3::new(0., 0., -0.5 * size[2]);

        let control_arm = Vector3::new(0., -0.091, 0.);
        let anchor = Vector3::new(0., -0.091, 0.41);

        LinearActuatedRigidBodyOnHingeAxis::new(
            Mass::new::<kilogram>(58.6),
            size,
            cg_offset,
            control_arm,
            anchor,
            Angle::new::<degree>(-17.),
            Angle::new::<degree>(47.),
            Angle::new::<degree>(-17.),
            100.,
            false,
            Vector3::new(1., 0., 0.),
        )
    }

    fn spoiler_assembly() -> HydraulicLinearActuatorAssembly<1> {
        let rigid_body = spoiler_body();
        let actuator = spoiler_actuator(&rigid_body);

        HydraulicLinearActuatorAssembly::new([actuator], rigid_body)
    }

    fn spoiler_actuator(bounded_linear_length: &impl BoundedLinearLength) -> LinearActuator {
        const DEFAULT_I_GAIN: f64 = 1.;
        const DEFAULT_P_GAIN: f64 = 0.15;
        const DEFAULT_FORCE_GAIN: f64 = 450000.;

        LinearActuator::new(
            bounded_linear_length,
            1,
            Length::new::<meter>(0.03),
            Length::new::<meter>(0.),
            VolumeRate::new::<gallon_per_second>(0.03),
            80000.,
            1500.,
            5000.,
            800000.,
            Duration::from_millis(300),
            [1., 1., 1., 1., 1., 1.],
            [0., 0.2, 0.21, 0.79, 0.8, 1.],
            DEFAULT_P_GAIN,
            DEFAULT_I_GAIN,
            DEFAULT_FORCE_GAIN,
        )
    }

    fn spoiler_body() -> LinearActuatedRigidBodyOnHingeAxis {
        let size = Vector3::new(1.785, 0.1, 0.685);
        let cg_offset = Vector3::new(0., 0., -0.5 * size[2]);

        let control_arm = Vector3::new(0., -0.067 * size[2], -0.26 * size[2]);
        let anchor = Vector3::new(0., -0.26 * size[2], 0.26 * size[2]);

        LinearActuatedRigidBodyOnHingeAxis::new(
            Mass::new::<kilogram>(16.),
            size,
            cg_offset,
            control_arm,
            anchor,
            Angle::new::<degree>(-10.),
            Angle::new::<degree>(40.),
            Angle::new::<degree>(-10.),
            50.,
            false,
            Vector3::new(1., 0., 0.),
        )
    }
}
