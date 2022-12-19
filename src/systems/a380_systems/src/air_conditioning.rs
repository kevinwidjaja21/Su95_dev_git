use systems::{
    accept_iterable,
    air_conditioning::{
        acs_controller::{Pack, PackFlowController},
        cabin_air::CabinZone,
        AirConditioningSystem, DuctTemperature, PackFlow, PackFlowControllers, ZoneType,
    },
    pressurization::PressurizationOverheadPanel,
    shared::{
        Cabin, ElectricalBusType, EngineBleedPushbutton, EngineCorrectedN1, EngineFirePushButtons,
        EngineStartState, GroundSpeed, LgciuWeightOnWheels, PackFlowValveState, PneumaticBleed,
    },
    simulation::{InitContext, SimulationElement, SimulationElementVisitor, UpdateContext},
};
use uom::si::{f64::*, mass_rate::kilogram_per_second, volume::cubic_meter};

pub(super) struct A380AirConditioning {
    a380_cabin: A380Cabin,
    a380_air_conditioning_system: AirConditioningSystem<3>,
}

impl A380AirConditioning {
    pub fn new(context: &mut InitContext) -> Self {
        let cabin_zones: [ZoneType; 3] =
            [ZoneType::Cockpit, ZoneType::Cabin(1), ZoneType::Cabin(2)];

        Self {
            a380_cabin: A380Cabin::new(context),
            a380_air_conditioning_system: AirConditioningSystem::new(
                context,
                cabin_zones,
                vec![
                    ElectricalBusType::DirectCurrent(1),
                    ElectricalBusType::AlternatingCurrent(1),
                ],
                vec![
                    ElectricalBusType::DirectCurrent(2),
                    ElectricalBusType::AlternatingCurrent(2),
                ],
            ),
        }
    }

    pub fn update(
        &mut self,
        context: &UpdateContext,
        adirs: &impl GroundSpeed,
        engines: [&impl EngineCorrectedN1; 2],
        engine_fire_push_buttons: &impl EngineFirePushButtons,
        pneumatic: &(impl EngineStartState + PackFlowValveState + PneumaticBleed),
        pneumatic_overhead: &impl EngineBleedPushbutton,
        pressurization: &impl Cabin,
        pressurization_overhead: &PressurizationOverheadPanel,
        lgciu: [&impl LgciuWeightOnWheels; 2],
    ) {
        self.a380_air_conditioning_system.update(
            context,
            adirs,
            engines,
            engine_fire_push_buttons,
            pneumatic,
            pneumatic_overhead,
            pressurization,
            pressurization_overhead,
            lgciu,
        );
        self.a380_cabin.update(
            context,
            &self.a380_air_conditioning_system,
            &self.a380_air_conditioning_system,
            pressurization,
        );
    }
}

impl PackFlowControllers<3> for A380AirConditioning {
    fn pack_flow_controller(&self, pack_id: Pack) -> PackFlowController<3> {
        self.a380_air_conditioning_system
            .pack_flow_controller(pack_id)
    }
}

impl SimulationElement for A380AirConditioning {
    fn accept<T: SimulationElementVisitor>(&mut self, visitor: &mut T) {
        self.a380_cabin.accept(visitor);
        self.a380_air_conditioning_system.accept(visitor);

        visitor.visit(self);
    }
}

struct A380Cabin {
    cabin_zone: [CabinZone<2>; 3],
}

impl A380Cabin {
    // TODO: Improve volume according to specs
    const A380_CABIN_VOLUME_CUBIC_METER: f64 = 200.; // m3
    const A380_COCKPIT_VOLUME_CUBIC_METER: f64 = 10.; // m3

    fn new(context: &mut InitContext) -> Self {
        Self {
            cabin_zone: [
                CabinZone::new(
                    context,
                    ZoneType::Cockpit,
                    Volume::new::<cubic_meter>(Self::A380_COCKPIT_VOLUME_CUBIC_METER),
                    2,
                    None,
                ),
                CabinZone::new(
                    context,
                    ZoneType::Cabin(1),
                    Volume::new::<cubic_meter>(Self::A380_CABIN_VOLUME_CUBIC_METER / 2.),
                    0,
                    Some([(1, 6), (7, 13)]),
                ),
                CabinZone::new(
                    context,
                    ZoneType::Cabin(2),
                    Volume::new::<cubic_meter>(Self::A380_CABIN_VOLUME_CUBIC_METER / 2.),
                    0,
                    Some([(14, 21), (22, 29)]),
                ),
            ],
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
            pack_flow.pack_flow().get::<kilogram_per_second>()
                / (Self::A380_CABIN_VOLUME_CUBIC_METER + Self::A380_COCKPIT_VOLUME_CUBIC_METER),
        );
        for zone in self.cabin_zone.iter_mut() {
            zone.update(
                context,
                duct_temperature,
                flow_rate_per_cubic_meter,
                pressurization,
            );
        }
    }
}

impl SimulationElement for A380Cabin {
    fn accept<T: SimulationElementVisitor>(&mut self, visitor: &mut T) {
        accept_iterable!(self.cabin_zone, visitor);

        visitor.visit(self);
    }
}
