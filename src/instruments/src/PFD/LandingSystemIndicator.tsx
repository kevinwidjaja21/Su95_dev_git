import { DisplayComponent, EventBus, FSComponent, HEvent, Subject, VNode } from 'msfssdk';
import { getDisplayIndex } from 'instruments/src/PFD/PFD';
import { Arinc429Word } from '@shared/arinc429';
import { Arinc429Values } from './shared/ArincValueProvider';
import { PFDSimvars } from './shared/PFDSimvarPublisher';
import { LagFilter } from './PFDUtils';

export class LandingSystem extends DisplayComponent<{ bus: EventBus, instrument: BaseInstrument }> {
    private lsButtonPressedVisibility = false;

    private xtkValid = Subject.create(false);

    private ldevRequest = false;

    private lsGroupRef = FSComponent.createRef<SVGGElement>();

    private gsReferenceLine = FSComponent.createRef<SVGPathElement>();

    private deviationGroup = FSComponent.createRef<SVGGElement>();

    private ldevRef = FSComponent.createRef<SVGGElement>();

    private vdevRef = FSComponent.createRef<SVGGElement>();

    private altitude = Arinc429Word.empty();

    private handleGsReferenceLine() {
        if (this.lsButtonPressedVisibility || (this.altitude.isNormalOperation())) {
            this.gsReferenceLine.instance.style.display = 'inline';
        } else if (!this.lsButtonPressedVisibility) {
            this.gsReferenceLine.instance.style.display = 'none';
        }
    }

    onAfterRender(node: VNode): void {
        super.onAfterRender(node);

        const sub = this.props.bus.getSubscriber<PFDSimvars & HEvent & Arinc429Values>();

        sub.on('hEvent').handle((eventName) => {
            if (eventName === `A320_Neo_PFD_BTN_LS_${getDisplayIndex()}`) {
                this.lsButtonPressedVisibility = !this.lsButtonPressedVisibility;
                SimVar.SetSimVarValue(`L:BTN_LS_${getDisplayIndex()}_FILTER_ACTIVE`, 'Bool', this.lsButtonPressedVisibility);

                this.lsGroupRef.instance.style.display = this.lsButtonPressedVisibility ? 'inline' : 'none';
                this.handleGsReferenceLine();
            }
        });

        sub.on(getDisplayIndex() === 1 ? 'ls1Button' : 'ls2Button').whenChanged().handle((lsButton) => {
            this.lsButtonPressedVisibility = lsButton;
            this.lsGroupRef.instance.style.display = this.lsButtonPressedVisibility ? 'inline' : 'none';
            this.deviationGroup.instance.style.display = this.lsButtonPressedVisibility ? 'none' : 'inline';
            this.handleGsReferenceLine();
        });

        sub.on('altitudeAr').handle((altitude) => {
            this.altitude = altitude;
            this.handleGsReferenceLine();
        });

        sub.on(getDisplayIndex() === 1 ? 'ldevRequestLeft' : 'ldevRequestRight').whenChanged().handle((ldevRequest) => {
            this.ldevRequest = ldevRequest;
            this.updateLdevVisibility();
        });

        sub.on('xtk').whenChanged().handle((xtk) => {
            this.xtkValid.set(Math.abs(xtk) > 0);
        });

        this.xtkValid.sub(() => {
            this.updateLdevVisibility();
        });
    }

    updateLdevVisibility() {
        this.ldevRef.instance.style.display = this.ldevRequest && this.xtkValid ? 'inline' : 'none';
    }

    render(): VNode {
        return (
            <>
                <g id="LSGroup" ref={this.lsGroupRef} style="display: none">
                    <LandingSystemInfo bus={this.props.bus} />

                    <g id="LSGroup">
                        <LocalizerIndicator bus={this.props.bus} instrument={this.props.instrument} />
                        <GlideSlopeIndicator bus={this.props.bus} instrument={this.props.instrument} />
                        <MarkerBeaconIndicator bus={this.props.bus} />
                    </g>

                    <path ref={this.gsReferenceLine} class="Yellow Fill" d="m 114.84887,80.06669 v 1.51188 h -8.43284 v -1.51188 z" />
                </g>
                <g id="DeviationGroup" ref={this.deviationGroup} style="display: none">
                    <g id="LateralDeviationGroup" ref={this.ldevRef} style="display: none">
                        <LDevIndicator bus={this.props.bus} />
                    </g>
                    <g id="VerticalDeviationGroup" ref={this.vdevRef} style="display: none">
                        <VDevIndicator bus={this.props.bus} />
                    </g>
                </g>
                <path ref={this.gsReferenceLine} class="Yellow Fill" d="m 114.84887,80.06669 v 1.51188 h -8.43284 v -1.51188 z" />
            </>
        );
    }
}

class LandingSystemInfo extends DisplayComponent<{ bus: EventBus }> {
    private hasDme = false;

    private identText = Subject.create('');

    private freqTextLeading = Subject.create('');

    private freqTextTrailing = Subject.create('');

    private navFreq = 0;

    private dme = 0;

    private dmeVisibilitySub = Subject.create('hidden');

    private destRef = FSComponent.createRef<SVGTextElement>();

    private lsInfoGroup = FSComponent.createRef<SVGGElement>();

    onAfterRender(node: VNode): void {
        super.onAfterRender(node);

        const sub = this.props.bus.getSubscriber<PFDSimvars>();

        // normally the ident and freq should be always displayed when an ILS freq is set, but currently it only show when we have a signal
        sub.on('hasLoc').whenChanged().handle((hasLoc) => {
            if (hasLoc) {
                this.lsInfoGroup.instance.style.display = 'inline';
            } else {
                this.lsInfoGroup.instance.style.display = 'none';
            }
        });

        sub.on('hasDme').whenChanged().handle((hasDme) => {
            this.hasDme = hasDme;
            this.updateContents();
        });

        sub.on('navIdent').whenChanged().handle((navIdent) => {
            this.identText.set(navIdent);
            this.updateContents();
        });

        sub.on('navFreq').whenChanged().handle((navFreq) => {
            this.navFreq = navFreq;
            this.updateContents();
        });

        sub.on('dme').whenChanged().handle((dme) => {
            this.dme = dme;
            this.updateContents();
        });
    }

    private updateContents() {
        const freqTextSplit = (Math.round(this.navFreq * 1000) / 1000).toString().split('.');
        this.freqTextLeading.set(freqTextSplit[0] === '0' ? '' : freqTextSplit[0]);
        if (freqTextSplit[1]) {
            this.freqTextTrailing.set(`.${freqTextSplit[1].padEnd(2, '0')}`);
        } else {
            this.freqTextTrailing.set('');
        }

        let distLeading = '';
        let distTrailing = '';
        if (this.hasDme) {
            this.dmeVisibilitySub.set('display: inline');
            const dist = Math.round(this.dme * 10) / 10;

            if (dist < 20) {
                const distSplit = dist.toString().split('.');

                distLeading = distSplit[0];
                distTrailing = `.${distSplit.length > 1 ? distSplit[1] : '0'}`;
            } else {
                distLeading = Math.round(dist).toString();
                distTrailing = '';
            }
            // eslint-disable-next-line max-len
            this.destRef.instance.innerHTML = `<tspan id="ILSDistLeading" class="FontLarge StartAlign">${distLeading}</tspan><tspan id="ILSDistTrailing" class="FontSmallest StartAlign">${distTrailing}</tspan>`;
        } else {
            this.dmeVisibilitySub.set('display: none');
        }
    }

    render(): VNode {
        return (
            <g id="LSInfoGroup" ref={this.lsInfoGroup}>
                <text id="ILSIdent" class="Magenta FontLarge AlignLeft" x="1.184" y="145.11522">{this.identText}</text>
                <text id="ILSFreqLeading" class="Magenta FontLarge AlignLeft" x="1.3610243" y="151.11575">{this.freqTextLeading}</text>
                <text id="ILSFreqTrailing" class="Magenta FontSmallest AlignLeft" x="12.964463" y="151.24084">{this.freqTextTrailing}</text>

                <g id="ILSDistGroup" style={this.dmeVisibilitySub}>
                    <text ref={this.destRef} class="Magenta AlignLeft" x="1.3685881" y="157.26602" />
                    <text class="Cyan FontSmallest AlignLeft" x="17.159119" y="157.22606">NM</text>
                </g>

            </g>
        );
    }
}

class LocalizerIndicator extends DisplayComponent<{bus: EventBus, instrument: BaseInstrument}> {
    private lagFilter = new LagFilter(1.5);

    private rightDiamond = FSComponent.createRef<SVGPathElement>();

    private leftDiamond = FSComponent.createRef<SVGPathElement>();

    private locDiamond = FSComponent.createRef<SVGPathElement>();

    private diamondGroup = FSComponent.createRef<SVGGElement>();

    private handleNavRadialError(radialError: number): void {
        const deviation = this.lagFilter.step(radialError, this.props.instrument.deltaTime / 1000);
        const dots = deviation / 0.8;

        if (dots > 2) {
            this.rightDiamond.instance.classList.remove('HiddenElement');
            this.leftDiamond.instance.classList.add('HiddenElement');
            this.locDiamond.instance.classList.add('HiddenElement');
        } else if (dots < -2) {
            this.rightDiamond.instance.classList.add('HiddenElement');
            this.leftDiamond.instance.classList.remove('HiddenElement');
            this.locDiamond.instance.classList.add('HiddenElement');
        } else {
            this.locDiamond.instance.classList.remove('HiddenElement');
            this.rightDiamond.instance.classList.add('HiddenElement');
            this.leftDiamond.instance.classList.add('HiddenElement');
            this.locDiamond.instance.style.transform = `translate3d(${dots * 30.221 / 2}px, 0px, 0px)`;
        }
    }

    onAfterRender(node: VNode): void {
        super.onAfterRender(node);

        const sub = this.props.bus.getSubscriber<PFDSimvars>();

        sub.on('hasLoc').whenChanged().handle((hasLoc) => {
            if (hasLoc) {
                this.diamondGroup.instance.classList.remove('HiddenElement');
                this.props.bus.on('navRadialError', this.handleNavRadialError.bind(this));
            } else {
                this.diamondGroup.instance.classList.add('HiddenElement');
                this.lagFilter.reset();
                this.props.bus.off('navRadialError', this.handleNavRadialError.bind(this));
            }
        });
    }

    render(): VNode {
        return (
            <g id="LocalizerSymbolsGroup">
                <path class="NormalStroke White" d="m54.804 130.51a1.0073 1.0079 0 1 0-2.0147 0 1.0073 1.0079 0 1 0 2.0147 0z" />
                <path class="NormalStroke White" d="m39.693 130.51a1.0074 1.0079 0 1 0-2.0147 0 1.0074 1.0079 0 1 0 2.0147 0z" />
                <path class="NormalStroke White" d="m85.024 130.51a1.0073 1.0079 0 1 0-2.0147 0 1.0073 1.0079 0 1 0 2.0147 0z" />
                <path class="NormalStroke White" d="m100.13 130.51a1.0074 1.0079 0 1 0-2.0147 0 1.0074 1.0079 0 1 0 2.0147 0z" />
                <g class="HiddenElement" ref={this.diamondGroup}>
                    <path id="LocDiamondRight" ref={this.rightDiamond} class="NormalStroke Magenta HiddenElement" d="m99.127 133.03 3.7776-2.5198-3.7776-2.5198" />
                    <path id="LocDiamondLeft" ref={this.leftDiamond} class="NormalStroke Magenta HiddenElement" d="m38.686 133.03-3.7776-2.5198 3.7776-2.5198" />
                    <path
                        id="LocDiamond"
                        ref={this.locDiamond}
                        class="NormalStroke Magenta HiddenElement"
                        d="m65.129 130.51 3.7776 2.5198 3.7776-2.5198-3.7776-2.5198z"
                    />
                </g>
                <path id="LocalizerNeutralLine" class="Yellow Fill" d="m 68.14059,133.69116 v -6.35451 h 1.531629 v 6.35451 z" />
            </g>
        );
    }
}

class GlideSlopeIndicator extends DisplayComponent<{bus: EventBus, instrument: BaseInstrument}> {
    private lagFilter = new LagFilter(1.5);

    private upperDiamond = FSComponent.createRef<SVGPathElement>();

    private lowerDiamond = FSComponent.createRef<SVGPathElement>();

    private glideSlopeDiamond = FSComponent.createRef<SVGPathElement>();

    private diamondGroup = FSComponent.createRef<SVGGElement>();

    private hasGlideSlope = false;

    private handleGlideSlopeError(glideSlopeError: number): void {
        const deviation = this.lagFilter.step(glideSlopeError, this.props.instrument.deltaTime / 1000);
        const dots = deviation / 0.4;

        if (dots > 2) {
            this.upperDiamond.instance.classList.remove('HiddenElement');
            this.lowerDiamond.instance.classList.add('HiddenElement');
            this.glideSlopeDiamond.instance.classList.add('HiddenElement');
        } else if (dots < -2) {
            this.upperDiamond.instance.classList.add('HiddenElement');
            this.lowerDiamond.instance.classList.remove('HiddenElement');
            this.glideSlopeDiamond.instance.classList.add('HiddenElement');
        } else {
            this.upperDiamond.instance.classList.add('HiddenElement');
            this.lowerDiamond.instance.classList.add('HiddenElement');
            this.glideSlopeDiamond.instance.classList.remove('HiddenElement');
            this.glideSlopeDiamond.instance.style.transform = `translate3d(0px, ${dots * 30.238 / 2}px, 0px)`;
        }
    }

    onAfterRender(node: VNode): void {
        super.onAfterRender(node);

        const sub = this.props.bus.getSubscriber<PFDSimvars>();

        sub.on('hasGlideslope').whenChanged().handle((hasGlideSlope) => {
            this.hasGlideSlope = hasGlideSlope;
            if (hasGlideSlope) {
                this.diamondGroup.instance.classList.remove('HiddenElement');
            } else {
                this.diamondGroup.instance.classList.add('HiddenElement');
                this.lagFilter.reset();
            }
        });

        sub.on('glideSlopeError').handle((gs) => {
            if (this.hasGlideSlope) {
                this.handleGlideSlopeError(gs);
            }
        });
    }

    render(): VNode {
        return (
            <g id="LocalizerSymbolsGroup">
                <path class="NormalStroke White" d="m110.71 50.585a1.0074 1.0079 0 1 0-2.0147 0 1.0074 1.0079 0 1 0 2.0147 0z" />
                <path class="NormalStroke White" d="m110.71 65.704a1.0074 1.0079 0 1 0-2.0147 0 1.0074 1.0079 0 1 0 2.0147 0z" />
                <path class="NormalStroke White" d="m110.71 95.942a1.0074 1.0079 0 1 0-2.0147 0 1.0074 1.0079 0 1 0 2.0147 0z" />
                <path class="NormalStroke White" d="m110.71 111.06a1.0074 1.0079 0 1 0-2.0147 0 1.0074 1.0079 0 1 0 2.0147 0z" />
                <g class="HideGSDiamond" ref={this.diamondGroup}>
                    <path id="GlideSlopeDiamondLower" ref={this.upperDiamond} class="NormalStroke Magenta HiddenElement" d="m107.19 111.06 2.5184 3.7798 2.5184-3.7798" />
                    <path id="GlideSlopeDiamondUpper" ref={this.lowerDiamond} class="NormalStroke Magenta HiddenElement" d="m107.19 50.585 2.5184-3.7798 2.5184 3.7798" />
                    <path
                        id="GlideSlopeDiamond"
                        ref={this.glideSlopeDiamond}
                        class="NormalStroke Magenta HiddenElement"
                        d="m109.7 77.043-2.5184 3.7798 2.5184 3.7798 2.5184-3.7798z"
                    />
                </g>
            </g>
        );
    }
}

class VDevIndicator extends DisplayComponent<{bus: EventBus}> {
    private VDevSymbolLower = FSComponent.createRef<SVGPathElement>();

    private VDevSymbolUpper = FSComponent.createRef<SVGPathElement>();

    private VDevSymbol = FSComponent.createRef<SVGPathElement>();

    onAfterRender(node: VNode): void {
        super.onAfterRender(node);

        // TODO use correct simvar once RNAV is implemented
        const deviation = 0;
        const dots = deviation / 100;

        if (dots > 2) {
            this.VDevSymbolLower.instance.style.visibility = 'visible';
            this.VDevSymbolUpper.instance.style.visibility = 'hidden';
            this.VDevSymbol.instance.style.visibility = 'hidden';
        } else if (dots < -2) {
            this.VDevSymbolLower.instance.style.visibility = 'hidden';
            this.VDevSymbolUpper.instance.style.visibility = 'visible';
            this.VDevSymbol.instance.style.visibility = 'hidden';
        } else {
            this.VDevSymbolLower.instance.style.visibility = 'hidden';
            this.VDevSymbolUpper.instance.style.visibility = 'hidden';
            this.VDevSymbol.instance.style.visibility = 'visible';
            this.VDevSymbol.instance.style.transform = `translate3d(0px, ${dots * 30.238 / 2}px, 0px)`;
        }
    }

    render(): VNode {
        return (
            <g id="VertDevSymbolsGroup">
                <text class="FontSmallest AlignRight Green" x="96.410" y="46.145">V/DEV</text>
                <path class="NormalStroke White" d="m108.7 65.704h2.0147" />
                <path class="NormalStroke White" d="m108.7 50.585h2.0147" />
                <path class="NormalStroke White" d="m108.7 111.06h2.0147" />
                <path class="NormalStroke White" d="m108.7 95.942h2.0147" />
                <path id="VDevSymbolLower" ref={this.VDevSymbolLower} class="NormalStroke Green" d="m 106.58482,111.06072 v 2.00569 h 6.2384 v -2.00569" />
                <path id="VDevSymbolUpper" ref={this.VDevSymbolUpper} class="NormalStroke Green" d="m 106.58482,50.584541 v -2.005689 h 6.2384 v 2.005689" />
                <path id="VDevSymbol" ref={this.VDevSymbol} class="NormalStroke Green" d="m 112.83172,78.62553 h -6.25541 v 2.197103 2.197106 h 6.25541 v -2.197106 z" />
            </g>
        );
    }
}

class LDevIndicator extends DisplayComponent<{bus: EventBus}> {
    private LDevSymbolLeft = FSComponent.createRef<SVGPathElement>();

    private LDevSymbolRight = FSComponent.createRef<SVGPathElement>();

    private LDevSymbol = FSComponent.createRef<SVGPathElement>();

    onAfterRender(node: VNode): void {
        super.onAfterRender(node);

        const sub = this.props.bus.getSubscriber<PFDSimvars>();

        sub.on('xtk').whenChanged().withPrecision(3).handle((xtk) => {
            const dots = xtk / 0.1;

            if (dots > 2) {
                this.LDevSymbolRight.instance.style.visibility = 'visible';
                this.LDevSymbolLeft.instance.style.visibility = 'hidden';
                this.LDevSymbol.instance.style.visibility = 'hidden';
            } else if (dots < -2) {
                this.LDevSymbolRight.instance.style.visibility = 'hidden';
                this.LDevSymbolLeft.instance.style.visibility = 'visible';
                this.LDevSymbol.instance.style.visibility = 'hidden';
            } else {
                this.LDevSymbolRight.instance.style.visibility = 'hidden';
                this.LDevSymbolLeft.instance.style.visibility = 'hidden';
                this.LDevSymbol.instance.style.visibility = 'visible';
                this.LDevSymbol.instance.style.transform = `translate3d(${dots * 30.238 / 2}px, 0px, 0px)`;
            }
        });
    }

    render(): VNode {
        return (
            <g id="LatDeviationSymbolsGroup">
                <text class="FontSmallest AlignRight Green" x="31.578" y="125.392">L/DEV</text>
                <path class="NormalStroke White" d="m38.686 129.51v2.0158" />
                <path class="NormalStroke White" d="m53.796 129.51v2.0158" />
                <path class="NormalStroke White" d="m84.017 129.51v2.0158" />
                <path class="NormalStroke White" d="m99.127 129.51v2.0158" />
                <path id="LDevSymbolLeft" ref={this.LDevSymbolLeft} class="NormalStroke Green" d="m 38.68595,127.35727 h -2.003935 v 6.31326 h 2.003935" />
                <path id="LDevSymbolRight" ref={this.LDevSymbolRight} class="NormalStroke Green" d="m 99.126865,127.35727 h 2.003925 v 6.31326 h -2.003925" />
                <path id="LDevSymbol" ref={this.LDevSymbol} class="NormalStroke Green" d="m 66.693251,127.36221 v 6.30339 h 2.213153 2.213153 v -6.30339 h -2.213153 z" />
                <path id="LDevNeutralLine" class="Yellow Fill" d="m 68.14059,133.69116 v -6.35451 h 1.531629 v 6.35451 z" />
            </g>
        );
    }
}

class MarkerBeaconIndicator extends DisplayComponent<{ bus: EventBus }> {
    private classNames = Subject.create('HiddenElement');

    private markerText = Subject.create('');

    onAfterRender(node: VNode): void {
        super.onAfterRender(node);

        const sub = this.props.bus.getSubscriber<PFDSimvars>();

        const baseClass = 'FontLarge StartAlign';

        sub.on('markerBeacon').whenChanged().handle((markerState) => {
            if (markerState === 0) {
                this.classNames.set(`${baseClass} HiddenElement`);
            } else if (markerState === 1) {
                this.classNames.set(`${baseClass} Cyan OuterMarkerBlink`);
                this.markerText.set('OM');
            } else if (markerState === 2) {
                this.classNames.set(`${baseClass} Amber MiddleMarkerBlink`);
                this.markerText.set('MM');
            } else {
                this.classNames.set(`${baseClass} White InnerMarkerBlink`);
                this.markerText.set('IM');
            }
        });
    }

    render(): VNode {
        return (
            <text id="ILSMarkerText" class={this.classNames} x="98.339211" y="125.12898">{this.markerText}</text>
        );
    }
}
