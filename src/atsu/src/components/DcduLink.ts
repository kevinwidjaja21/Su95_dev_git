//  Copyright (c) 2022 FlyByWire Simulations
//  SPDX-License-Identifier: GPL-3.0

import { Atc } from '../ATC';
import { Atsu } from '../ATSU';
import { AtsuMessage, AtsuMessageDirection } from '../messages/AtsuMessage';
import { AtsuStatusCodes } from '../AtsuStatusCodes';
import { CpdlcMessage } from '../messages/CpdlcMessage';

class DcduMessage {
    public MessageId: number = 0;

    public Station: string = '';

    public MessageSent = false;

    public MessageRead = false;

    public EmergencyMessage = false;
}

export class DcduLink {
    private static MaxDcduFileSize = 5;

    private listener = RegisterViewListener('JS_LISTENER_SIMVARS', null, true);

    private atsu: Atsu | undefined = undefined;

    private atc: Atc | undefined = undefined;

    private messages: (DcduMessage[])[] = [];

    private bufferedMessages: (DcduMessage[])[] = [];

    private atcMsgWatchdogInterval: number | undefined = undefined;

    private atcRingInterval: number | undefined = undefined;

    constructor(atsu: Atsu, atc: Atc) {
        this.atsu = atsu;
        this.atc = atc;

        Coherent.on('A32NX_ATSU_DELETE_MESSAGE', (uid: number) => {
            const idx = this.messages.findIndex((elem) => elem[0].MessageId === uid);
            if (idx > -1) {
                this.messages[idx].forEach((message) => {
                    this.atc.removeMessage(message.MessageId);
                });
            }
        });

        Coherent.on('A32NX_ATSU_SEND_RESPONSE', (uid: number, response: number) => {
            const idx = this.messages.findIndex((elem) => elem[0].MessageId === uid);
            if (idx > -1) {
                // iterate in reverse order to ensure that the "identification" message is the last message in the queue
                // ensures that the DCDU-status change to SENT is done after every message is sent
                this.messages[idx].slice().reverse().forEach((message) => {
                    this.atc.sendResponse(message.MessageId, response);
                });
            }
        });

        Coherent.on('A32NX_ATSU_SEND_MESSAGE', (uid: number) => {
            const idx = this.messages.findIndex((elem) => elem[0].MessageId === uid);
            if (idx > -1) {
                // iterate in reverse order to ensure that the "identification" message is the last message in the queue
                // ensures that the DCDU-status change to SENT is done after every message is sent
                this.messages[idx].slice().reverse().forEach((entry) => {
                    const message = this.atc.messages().find((element) => element.UniqueMessageID === entry.MessageId);
                    if (message !== undefined) {
                        if (message.Direction === AtsuMessageDirection.Downlink) {
                            this.atc.sendMessage(message).then((code) => {
                                if (code !== AtsuStatusCodes.Ok) {
                                    this.atsu.publishAtsuStatusCode(code);
                                }
                            });
                        }
                    }
                });
            }
        });

        Coherent.on('A32NX_ATSU_PRINT_MESSAGE', (uid: number) => {
            const message = this.atc.messages().find((element) => element.UniqueMessageID === uid);
            if (message !== undefined) {
                this.atsu.printMessage(message);
            }
        });

        Coherent.on('A32NX_ATSU_DCDU_MESSAGE_CLOSED', (uid: number) => {
            const idx = this.messages.findIndex((elem) => elem[0].MessageId === uid);
            if (idx !== -1) {
                this.messages.splice(idx, 1);
                this.validateNotificationCondition();

                // add buffered messages
                while (this.bufferedMessages.length !== 0 && this.messages.length !== DcduLink.MaxDcduFileSize) {
                    const bufferedBlock = this.bufferedMessages.shift();
                    const dcduMessages = [];
                    this.messages.push([]);

                    bufferedBlock.forEach((data) => {
                        const message = this.atc.messages().find((elem) => elem.UniqueMessageID === data.MessageId);
                        if (message !== undefined) {
                            this.messages[this.messages.length - 1].push(data);

                            // pushed a new inbound message
                            if (!data.MessageRead) {
                                this.setupIntervals();
                            }

                            if ((message as CpdlcMessage).DcduRelevantMessage) {
                                dcduMessages.push(message);
                            }
                        }
                    });

                    this.listener.triggerToAllSubscribers('A32NX_DCDU_MSG', dcduMessages);
                }
            }
        });

        Coherent.on('A32NX_ATSU_DCDU_MESSAGE_READ', (uid: number) => {
            const idx = this.messages.findIndex((elem) => elem[0].MessageId === uid);
            if (idx !== -1) {
                this.messages[idx][0].MessageRead = true;
                this.validateNotificationCondition();
            }
        });
    }

    private validateNotificationCondition() {
        // check if the ring tone is still needed
        let unreadMessages = false;
        this.messages.forEach((elem) => {
            if (!elem[0].MessageRead) {
                unreadMessages = true;
            }
        });

        if (!unreadMessages) {
            this.cleanupNotifications();
        }
    }

    private estimateRingInterval() {
        let interval = 10000;

        this.messages.forEach((elem) => {
            if (!elem[0].MessageRead) {
                if (elem[0].EmergencyMessage) {
                    interval = Math.min(interval, 5000);
                } else {
                    interval = Math.min(interval, 10000);
                }
            }
        });

        return interval;
    }

    private atcRingTone() {
        Coherent.call('PLAY_INSTRUMENT_SOUND', 'cpdlc_ring');
        // ensure that the timeout is longer than the sound
        setTimeout(() => SimVar.SetSimVarValue('W:cpdlc_ring', 'boolean', 0), 2000);
    }

    private cleanupNotifications() {
        SimVar.SetSimVarValue('L:A32NX_DCDU_ATC_MSG_WAITING', 'boolean', 0);
        SimVar.SetSimVarValue('L:A32NX_DCDU_ATC_MSG_ACK', 'number', 0);

        if (this.atcMsgWatchdogInterval !== undefined) {
            clearInterval(this.atcMsgWatchdogInterval);
            this.atcMsgWatchdogInterval = undefined;
        }

        if (this.atcRingInterval !== undefined) {
            clearInterval(this.atcRingInterval);
            this.atcRingInterval = undefined;
        }
    }

    private setupIntervals() {
        if (this.atcMsgWatchdogInterval === undefined) {
            // start the watchdog to check the the ATC MSG button
            this.atcMsgWatchdogInterval = setInterval(() => {
                if (SimVar.GetSimVarValue('L:A32NX_DCDU_ATC_MSG_ACK', 'number') === 1) {
                    this.cleanupNotifications();
                }
            }, 100);
        }

        if (this.atcRingInterval !== undefined) {
            clearInterval(this.atcRingInterval);
        }

        // call the first ring tone
        this.atcRingTone();

        // start the ring tone interval
        this.atcRingInterval = setInterval(() => this.atcRingTone(), this.estimateRingInterval());
    }

    public reset() {
        this.listener.triggerToAllSubscribers('A32NX_DCDU_RESET');
    }

    public setAtcLogonMessage(message: string) {
        this.listener.triggerToAllSubscribers('A32NX_DCDU_ATC_LOGON_MSG', message);
    }

    public enqueue(messages: AtsuMessage[]) {
        if (this.messages.length < DcduLink.MaxDcduFileSize) {
            this.messages.push([]);
        } else {
            this.bufferedMessages.push([]);
        }

        messages.forEach((message) => {
            const block = new DcduMessage();
            block.MessageId = message.UniqueMessageID;
            block.MessageRead = message.Direction === AtsuMessageDirection.Downlink;
            block.Station = message.Station;

            if (this.messages.length < DcduLink.MaxDcduFileSize) {
                this.messages[this.messages.length - 1].push(block);

                // reset the ring tone interval
                if (block.MessageRead === false) {
                    SimVar.SetSimVarValue('L:A32NX_DCDU_ATC_MSG_WAITING', 'boolean', 1);
                    SimVar.SetSimVarValue('L:A32NX_DCDU_ATC_MSG_ACK', 'number', 0);
                    this.setupIntervals();
                }
            } else {
                this.atsu.publishAtsuStatusCode(AtsuStatusCodes.DcduFull);
                this.bufferedMessages[this.bufferedMessages.length - 1].push(block);
            }
        });

        this.listener.triggerToAllSubscribers('A32NX_DCDU_MSG', messages);
    }

    public update(message: CpdlcMessage) {
        // the assumption is that the first message in the block is the UID for the complete block
        const idx = this.messages.findIndex((elem) => elem[0].MessageId === message.UniqueMessageID);
        if (idx !== -1) {
            this.listener.triggerToAllSubscribers('A32NX_DCDU_MSG', [message]);
        }
    }

    public dequeue(uid: number) {
        // the assumption is that the first message in the block is the UID for the complete block
        const idx = this.messages.findIndex((elem) => elem[0].MessageId === uid);
        if (idx !== -1) {
            this.listener.triggerToAllSubscribers('A32NX_DCDU_MSG_DELETE_UID', uid);
            this.messages.splice(idx, 1);
        }
    }

    public openMessagesForStation(station: string): boolean {
        let retval = false;

        this.messages.forEach((block) => {
            if (!block[0].MessageSent && block[0].Station === station) retval = true;
        });

        if (!retval) {
            this.bufferedMessages.forEach((block) => {
                if (!block[0].MessageSent && block[0].Station === station) retval = true;
            });
        }

        return retval;
    }
}
