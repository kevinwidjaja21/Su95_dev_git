class NXApi {
    static getMetar(icao, source) {
        if (!icao) {
            throw ("No ICAO provided");
        }

        return fetch(`${NXApi.url}/metar/${icao}?source=${source}`)
            .then((response) => {
                if (!response.ok) {
                    throw (response);
                }

                return response.json();
            });
    }

    static getTaf(icao, source) {
        if (!icao) {
            throw ("No ICAO provided");
        }

        return fetch(`${NXApi.url}/taf/${icao}?source=${source}`)
            .then((response) => {
                if (!response.ok) {
                    throw (response);
                }

                return response.json();
            });
    }

    static getAtis(icao, source) {
        if (!icao) {
            throw ("No ICAO provided");
        }

        return fetch(`${NXApi.url}/atis/${icao}?source=${source}`)
            .then((response) => {
                if (!response.ok) {
                    throw (response);
                }

                return response.json();
            });
    }

    static connectTelex(flightNo) {
        // TELEX disabled
        if (NXDataStore.get("CONFIG_ONLINE_FEATURES_STATUS", "DISABLED") !== "ENABLED") {
            return Promise.reject(NXApi.disabledError);
        }

        if (!flightNo) {
            return Promise.reject(NXApi.disabledError);
        }

        // Do not reconnect when using the same FLT NBR
        if (flightNo === NXApi.activeFlight) {
            return Promise.resolve({
                flight: NXApi.activeFlight
            });
        }

        const oldToken = NXApi.accessToken;

        const connectBody = NXApi.buildTelexBody(flightNo);
        const headers = {"Content-Type": "application/json"};

        return fetch(`${NXApi.url}/txcxn`, {method: "POST", body: JSON.stringify(connectBody), headers})
            .then((response) => {
                if (!response.ok) {
                    throw (response);
                }

                // Delete old connection using an override token
                // in case the new one is successful
                if (!!oldToken) {
                    this.disconnectTelex(oldToken);
                }

                return response.json()
                    .then((data) => {
                        NXApi.accessToken = data.accessToken;
                        NXApi.activeFlight = data.flight;
                        return data;
                    });
            });
    }

    static updateTelex() {
        // TELEX disabled
        if (NXDataStore.get("CONFIG_ONLINE_FEATURES_STATUS", "DISABLED") !== "ENABLED") {
            return Promise.reject(NXApi.disabledError);
        }

        // No connection
        if (!NXApi.hasTelexConnection()) {
            return Promise.reject(NXApi.disconnectedError);
        }

        const updateBody = NXApi.buildTelexBody();
        const headers = {
            "Content-Type": "application/json",
            Authorization: NXApi.buildToken()
        };

        return fetch(`${NXApi.url}/txcxn`, {method: "PUT", body: JSON.stringify(updateBody), headers})
            .then((response) => {
                if (!response.ok) {
                    throw (response);
                }

                return response.json();
            });
    }

    static disconnectTelex(tokenOverride) {
        // No connection
        if (!NXApi.hasTelexConnection()) {
            return Promise.reject(NXApi.disconnectedError);
        }

        const headers = {
            Authorization: NXApi.buildToken(tokenOverride)
        };

        return fetch(`${NXApi.url}/txcxn`, {method: "DELETE", headers})
            .then((response) => {
                if (!response.ok) {
                    throw (response);
                }

                NXApi.accessToken = "";
                NXApi.activeFlight = "";
            });
    }

    static getTelexMessages() {
        // TELEX disabled
        if (NXDataStore.get("CONFIG_ONLINE_FEATURES_STATUS", "DISABLED") !== "ENABLED") {
            return Promise.reject(NXApi.disabledError);
        }

        // No connection
        if (!NXApi.hasTelexConnection()) {
            return Promise.reject(NXApi.disconnectedError);
        }

        const headers = {
            Authorization: NXApi.buildToken()
        };

        return fetch(`${NXApi.url}/txmsg`, {method: "GET", headers})
            .then((response) => {
                if (!response.ok) {
                    throw (response);
                }

                return response.json();
            });
    }

    static sendTelexMessage(recipient, message) {
        // TELEX disabled
        if (NXDataStore.get("CONFIG_ONLINE_FEATURES_STATUS", "DISABLED") !== "ENABLED") {
            return Promise.reject(NXApi.disabledError);
        }

        // No connection
        if (!NXApi.hasTelexConnection()) {
            return Promise.reject(NXApi.disconnectedError);
        }

        // No recipient
        if (!recipient) {
            return Promise.reject(NXApi.noRecipientError);
        }

        const body = {
            to: recipient,
            message
        };
        const headers = {
            "Content-Type": "application/json",
            Authorization: NXApi.buildToken()
        };

        return fetch(`${NXApi.url}/txmsg`, {method: "POST", body: JSON.stringify(body), headers})
            .then((response) => {
                if (!response.ok) {
                    throw (response);
                }
            });
    }

    static hasTelexConnection() {
        return !!NXApi.accessToken && !!NXApi.activeFlight;
    }

    static buildToken(tokenOverride) {
        return `Bearer ${!!tokenOverride ? tokenOverride : NXApi.accessToken}`;
    }

    static buildTelexBody(flightNo) {
        const lat = SimVar.GetSimVarValue("PLANE LATITUDE", "degree latitude");
        const long = SimVar.GetSimVarValue("PLANE LONGITUDE", "degree longitude");
        const alt = SimVar.GetSimVarValue("PLANE ALTITUDE", "feet");
        const heading = SimVar.GetSimVarValue("PLANE HEADING DEGREES TRUE", "degree");
        const acType = SimVar.GetSimVarValue("TITLE", "string");
        const origin = NXDataStore.get("PLAN_ORIGIN", "");
        const destination = NXDataStore.get("PLAN_DESTINATION", "");
        const freetext = NXDataStore.get("CONFIG_ONLINE_FEATURES_STATUS", "DISABLED") === "ENABLED";

        return {
            location: {
                x: long,
                y: lat,
            },
            trueAltitude: alt,
            heading: heading,
            origin: origin,
            destination: destination,
            freetextEnabled: freetext,
            flight: flightNo,
            aircraftType: acType,
        };
    }
}

NXApi.url = "https://api.flybywiresim.com";
NXApi.disabledError = "TELEX DISABLED";
NXApi.disconnectedError = "TELEX DISCONNECTED";
NXApi.noRecipientError = "NO RECIPIENT";
NXApi.accessToken = "";
NXApi.activeFlight = "";
NXApi.updateRate = 15000;

NXDataStore.set("PLAN_ORIGIN", "");
NXDataStore.set("PLAN_DESTINATION", "");
