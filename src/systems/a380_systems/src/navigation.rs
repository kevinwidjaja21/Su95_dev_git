use systems::navigation::ala52b::{
    Ala52BAircraftInstallationDelay, Ala52BRadioAltimeter, Ala52BTransceiverPair,
};
use systems::navigation::radio_altimeter::AntennaInstallation;
use systems::shared::ElectricalBusType;
use systems::simulation::{
    InitContext, SimulationElement, SimulationElementVisitor, UpdateContext,
};
use uom::si::f64::Length;
use uom::si::length::{foot, meter};

pub struct A380RadioAltimeters {
    radio_altimeter_1: A380RadioAltimeter,
    radio_altimeter_2: A380RadioAltimeter,
    radio_altimeter_3: A380RadioAltimeter,
}

impl A380RadioAltimeters {
    pub fn new(context: &mut InitContext) -> Self {
        Self {
            radio_altimeter_1: A380RadioAltimeter::new(
                context,
                1,
                ElectricalBusType::AlternatingCurrent(1),
                AntennaInstallation::new(
                    // Sim alt over ground minus RA height over ground
                    Length::new::<foot>(14.75) - Length::new::<meter>(3.78),
                    // Aft distance from Sim CG
                    Length::new::<meter>(12.50),
                    // Electric length of the antennas and cable modeling some material variation
                    Length::new::<foot>(27.0),
                ),
                AntennaInstallation::new(
                    Length::new::<foot>(14.75) - Length::new::<meter>(3.69),
                    Length::new::<meter>(11.69),
                    Length::new::<foot>(27.0),
                ),
            ),
            radio_altimeter_2: A380RadioAltimeter::new(
                context,
                2,
                ElectricalBusType::AlternatingCurrent(2),
                AntennaInstallation::new(
                    Length::new::<foot>(14.75) - Length::new::<meter>(3.89),
                    Length::new::<meter>(13.35),
                    Length::new::<foot>(26.2),
                ),
                AntennaInstallation::new(
                    Length::new::<foot>(14.75) - Length::new::<meter>(4.01),
                    Length::new::<meter>(14.20),
                    Length::new::<foot>(26.2),
                ),
            ),
            radio_altimeter_3: A380RadioAltimeter::new(
                context,
                3,
                ElectricalBusType::AlternatingCurrent(2),
                AntennaInstallation::new(
                    Length::new::<foot>(14.75) - Length::new::<meter>(4.27),
                    Length::new::<meter>(15.90),
                    Length::new::<foot>(25.4),
                ),
                AntennaInstallation::new(
                    Length::new::<foot>(14.75) - Length::new::<meter>(4.14),
                    Length::new::<meter>(15.05),
                    Length::new::<foot>(25.4),
                ),
            ),
        }
    }

    pub fn update(&mut self, context: &UpdateContext) {
        self.radio_altimeter_1.update(context);
        self.radio_altimeter_2.update(context);
        self.radio_altimeter_3.update(context);
    }
}

impl SimulationElement for A380RadioAltimeters {
    fn accept<T: SimulationElementVisitor>(&mut self, visitor: &mut T) {
        self.radio_altimeter_1.accept(visitor);
        self.radio_altimeter_2.accept(visitor);
        self.radio_altimeter_3.accept(visitor);

        visitor.visit(self);
    }
}

pub struct A380RadioAltimeter {
    radio_altimeter: Ala52BRadioAltimeter,
    transceivers: Ala52BTransceiverPair,
}

impl A380RadioAltimeter {
    fn new(
        context: &mut InitContext,
        number: usize,
        powered_by: ElectricalBusType,
        transmitter: AntennaInstallation,
        receiver: AntennaInstallation,
    ) -> Self {
        Self {
            radio_altimeter: Ala52BRadioAltimeter::new(
                context,
                number,
                Ala52BAircraftInstallationDelay::EightyFeet,
                powered_by,
            ),
            transceivers: Ala52BTransceiverPair::new(context, transmitter, receiver),
        }
    }

    fn update(&mut self, context: &UpdateContext) {
        self.radio_altimeter.update(context, &self.transceivers);
    }
}

impl SimulationElement for A380RadioAltimeter {
    fn accept<T: SimulationElementVisitor>(&mut self, visitor: &mut T) {
        self.transceivers.accept(visitor);
        self.radio_altimeter.accept(visitor);

        visitor.visit(self);
    }
}
