import { ClockEvents, DisplayComponent, EventBus, FSComponent, VNode } from 'msfssdk';
import { Arinc429Word } from '@shared/arinc429';
import { calculateHorizonOffsetFromPitch } from './PFDUtils';
import { Arinc429Values } from './shared/ArincValueProvider';
import { PFDSimvars } from './shared/PFDSimvarPublisher';

const DistanceSpacing = 15;
const ValueSpacing = 10;

interface FlightPathVectorData {
    roll: Arinc429Word;
    pitch: Arinc429Word;
    fpa: Arinc429Word;
    da: Arinc429Word;
}

export class FlightPathVector extends DisplayComponent<{bus: EventBus}> {
    private bird = FSComponent.createRef<SVGGElement>();

    private fpvFlag = FSComponent.createRef<SVGGElement>();

    private isTrkFpaActive = false;

    private data: FlightPathVectorData = {
        roll: new Arinc429Word(0),
        pitch: new Arinc429Word(0),
        fpa: new Arinc429Word(0),
        da: new Arinc429Word(0),
    }

    private needsUpdate = false;

    onAfterRender(node: VNode): void {
        super.onAfterRender(node);

        const sub = this.props.bus.getSubscriber<PFDSimvars & Arinc429Values & ClockEvents>();

        sub.on('trkFpaActive').whenChanged().handle((a) => {
            this.isTrkFpaActive = a;
            if (this.isTrkFpaActive) {
                this.moveBird();
                this.bird.instance.classList.remove('HiddenElement');
            } else {
                this.bird.instance.classList.add('HiddenElement');
            }
        });

        sub.on('fpa').handle((fpa) => {
            this.data.fpa = fpa;
            this.needsUpdate = true;
        });

        sub.on('da').handle((da) => {
            this.data.da = da;
            this.needsUpdate = true;
        });

        sub.on('rollAr').handle((r) => {
            this.data.roll = r;
            this.needsUpdate = true;
        });

        sub.on('pitchAr').handle((p) => {
            this.data.pitch = p;
            this.needsUpdate = true;
        });

        sub.on('realTime').handle((_t) => {
            if (this.needsUpdate) {
                this.needsUpdate = false;

                const daAndFpaValid = this.data.fpa.isNormalOperation() && this.data.da.isNormalOperation();
                if (this.isTrkFpaActive && daAndFpaValid) {
                    this.fpvFlag.instance.style.visibility = 'hidden';
                    this.bird.instance.classList.remove('HiddenElement');
                    this.moveBird();
                } else if (this.isTrkFpaActive && this.data.pitch.isNormalOperation() && this.data.roll.isNormalOperation()) {
                    this.fpvFlag.instance.style.visibility = 'visible';
                    this.bird.instance.classList.add('HiddenElement');
                }
            }
        });
    }

    private moveBird() {
        const daLimConv = Math.max(Math.min(this.data.da.value, 21), -21) * DistanceSpacing / ValueSpacing;
        const pitchSubFpaConv = (calculateHorizonOffsetFromPitch(this.data.pitch.value) - calculateHorizonOffsetFromPitch(this.data.fpa.value));
        const rollCos = Math.cos(this.data.roll.value * Math.PI / 180);
        const rollSin = Math.sin(-this.data.roll.value * Math.PI / 180);

        const xOffset = daLimConv * rollCos - pitchSubFpaConv * rollSin;
        const yOffset = pitchSubFpaConv * rollCos + daLimConv * rollSin;

        this.bird.instance.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0px)`;
    }

    render(): VNode {
        return (
            <>
                <g ref={this.bird} id="bird">
                    <svg x="53.4" y="65.3" width="31px" height="31px" version="1.1" viewBox="0 0 31 31" xmlns="http://www.w3.org/2000/svg">
                        <g>
                            <path
                                class="NormalOutline"
                                // eslint-disable-next-line max-len
                                d="m17.766 15.501c8.59e-4 -1.2531-1.0142-2.2694-2.2665-2.2694-1.2524 0-2.2674 1.0163-2.2665 2.2694-8.57e-4 1.2531 1.0142 2.2694 2.2665 2.2694 1.2524 0 2.2674-1.0163 2.2665-2.2694z"
                            />
                            <path class="ThickOutline" d="m17.766 15.501h5.0367m-9.5698 0h-5.0367m7.3033-2.2678v-2.5199" />
                            <path
                                class="NormalStroke Green"
                                // eslint-disable-next-line max-len
                                d="m17.766 15.501c8.59e-4 -1.2531-1.0142-2.2694-2.2665-2.2694-1.2524 0-2.2674 1.0163-2.2665 2.2694-8.57e-4 1.2531 1.0142 2.2694 2.2665 2.2694 1.2524 0 2.2674-1.0163 2.2665-2.2694z"
                            />
                            <path class="ThickStroke Green" d="m17.766 15.501h5.0367m-9.5698 0h-5.0367m7.3033-2.2678v-2.5199" />
                        </g>
                    </svg>
                </g>
                <text ref={this.fpvFlag} style="visibility:hidden" id="FPVFlag" x="62.987099" y="89.42025" class="Blink9Seconds FontLargest Red EndAlign">FPV</text>
            </>
        );
    }
}
