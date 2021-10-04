const ENABLE_TOTAL_UPDATE_TIME_TRACING = false;

class A32NX_Core {
    constructor() {
        this.modules = [
            {
                name: 'ADIRS',
                module: new A32NX_ADIRS(),
                updateInterval: 100,
            },
            {
                name: 'APU',
                module: new A32NX_APU(),
                updateInterval: 100,
            },
            {
                name: 'BaroSelector',
                module: new A32NX_BaroSelector(),
                updateInterval: 300,
            },
            {
                name: 'BrakeTemp',
                module: new A32NX_BrakeTemp(),
                updateInterval: 150,
            },
            {
                name: 'Refuel',
                module: new A32NX_Refuel(),
                updateInterval: 150,
            },
            {
                name: 'Electricity',
                module: new A32NX_Electricity(),
                updateInterval: 100,
            },
            {
                name: 'LocalVars',
                module: new A32NX_LocalVarUpdater(),
                updateInterval: 50,
            },
            {
                name: 'FADEC #1',
                module: new A32NX_FADEC(1),
                updateInterval: 100,
            },
            {
                name: 'FADEC #2',
                module: new A32NX_FADEC(2),
                updateInterval: 100,
            },
            {
                name: 'FWC',
                module: new A32NX_FWC(2),
                updateInterval: 50,
            },
            {
                name: 'GPWS',
                module: new A32NX_GPWS(this),
                updateInterval: 75,
            },
            {
                name: 'Speeds',
                module: new A32NX_Speeds(),
                updateInterval: 500,
            },
        ];

        this.moduleThrottlers = {};
        for (const moduleDefinition of this.modules) {
            this.moduleThrottlers[moduleDefinition.name] = new UpdateThrottler(moduleDefinition.updateInterval);
        }

        this.soundManager = new A32NX_SoundManager();
    }

    init(startTime) {
        this.ACPowerStateChange = false;
        this.getDeltaTime = A32NX_Util.createDeltaTimeCalculator(startTime);
        this.modules.forEach(moduleDefinition => {
            if (typeof moduleDefinition.module.init === "function") {
                moduleDefinition.module.init();
            }
        });
        this.isInit = true;
    }

    update() {
        if (!this.isInit) {
            return;
        }

        const startTime = ENABLE_TOTAL_UPDATE_TIME_TRACING ? Date.now() : 0;
        this.updateACPowerStateChange();

        const deltaTime = this.getDeltaTime();

        this.soundManager.update(deltaTime);

        let updatedModules = 0;
        this.modules.forEach(moduleDefinition => {
            const moduleDeltaTime = this.moduleThrottlers[moduleDefinition.name].canUpdate(deltaTime);

            if (moduleDeltaTime !== -1) {
                moduleDefinition.module.update(moduleDeltaTime, this);
                updatedModules++;
            }
        });

        if (ENABLE_TOTAL_UPDATE_TIME_TRACING) {
            const endTime = Date.now();

            const updateTime = endTime - startTime;

            console.warn(`NXCore update took: ${updateTime.toFixed(2)}ms (${updatedModules} modules updated)`);
        }
    }

    updateACPowerStateChange() {
        const engineOn = Simplane.getEngineActive(0) || Simplane.getEngineActive(1);
        const externalPowerOn = SimVar.GetSimVarValue("EXTERNAL POWER AVAILABLE:1", "Bool") === 1 && SimVar.GetSimVarValue("EXTERNAL POWER ON", "Bool") === 1;
        const apuOn = SimVar.GetSimVarValue("L:APU_GEN_ONLINE", "bool");
        const isACPowerAvailable = engineOn || apuOn || externalPowerOn;
        this.ACPowerStateChange = (isACPowerAvailable != this.ACPowerLastState);
    }
}
