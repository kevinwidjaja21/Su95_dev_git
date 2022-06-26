import React from 'react';
import { AtsuMessageComStatus, AtsuMessageDirection } from '@atsu/messages/AtsuMessage';
import { CpdlcMessageExpectedResponseType, CpdlcMessagesDownlink } from '@atsu/messages/CpdlcMessageElements';
import { CpdlcMessage } from '@atsu/messages/CpdlcMessage';
import { Checkerboard } from './Checkerboard';

type MessageStatusProps = {
    message: CpdlcMessage,
    selectedResponse : number
}

const translateResponseId = (response: number, message: CpdlcMessage): string => {
    const answerExpected = message.Content?.ExpectedResponse !== CpdlcMessageExpectedResponseType.NotRequired && message.Content?.ExpectedResponse !== CpdlcMessageExpectedResponseType.No;

    if (response === -1) {
        if (message.Direction === AtsuMessageDirection.Uplink && answerExpected) {
            return 'OPEN';
        }
        if (message.ComStatus === AtsuMessageComStatus.Sent) {
            return 'SENT';
        }
    } else if (`DM${response}` in CpdlcMessagesDownlink) {
        const text = CpdlcMessagesDownlink[`DM${response}`][0][0];
        if (text === 'STANDBY') {
            return 'STBY';
        }
        if (text === 'NEGATIVE') {
            return 'NEGATV';
        }
        return text;
    }

    return 'UKN';
};

const translateResponseMessage = (message: CpdlcMessage, response: CpdlcMessage | undefined): string => {
    const answerExpected = message.Content?.ExpectedResponse !== CpdlcMessageExpectedResponseType.NotRequired && message.Content?.ExpectedResponse !== CpdlcMessageExpectedResponseType.No;

    if (response === undefined) {
        if (message.Direction === AtsuMessageDirection.Uplink && answerExpected) {
            return 'OPEN';
        }
        if (message.ComStatus === AtsuMessageComStatus.Sent) {
            return 'SENT';
        }
    } else if (response.Content !== undefined && response.Content.TypeId in CpdlcMessagesDownlink) {
        const text = CpdlcMessagesDownlink[response.Content.TypeId][0][0];
        if (text === 'STANDBY') {
            return 'STBY';
        }
        if (text === 'NEGATIVE') {
            return 'NEGATV';
        }
        return text;
    }

    return 'UKN';
};

export const MessageStatus: React.FC<MessageStatusProps> = ({ message, selectedResponse }) => {
    let statusClass = 'status-message ';
    if (message.Direction === AtsuMessageDirection.Uplink) {
        if (message.Response === undefined && selectedResponse === -1) {
            statusClass += 'status-open';
        } else {
            statusClass += 'status-other';
        }
    } else if (message.ComStatus === AtsuMessageComStatus.Sent) {
        statusClass += 'status-other';
    } else {
        statusClass += 'status-open';
    }

    // calculate the position of the background rectangle
    let text = '';
    if (message.Direction === AtsuMessageDirection.Uplink) {
        if (selectedResponse !== -1) {
            text = translateResponseId(selectedResponse, message);
        } else {
            text = translateResponseMessage(message, message.Response);
        }
    }

    const backgroundRequired = text !== 'OPEN' && text !== 'SENT';
    let backgroundColor = 'rgba(0,0,0,0)';
    if (message.Direction === AtsuMessageDirection.Uplink) {
        if (selectedResponse === -1 || message.Response?.Content?.TypeId === `DM${selectedResponse}`) {
            backgroundColor = 'rgb(0,255,0)';
        } else {
            backgroundColor = 'rgb(0,255,255)';
        }
    }

    const background = { x: 0, y: 0, width: 0, height: 0 };
    if (text.length !== 0) {
        // one character has a width of 116px and a spacing of 24px per side
        background.width = text.length * 116 + 48;
        // one character has a height of 171 and a spacing of 8 per side
        background.height = 187;
        background.x = 3740 - background.width;
        background.y = 310 - background.height;
    }

    return (
        <g>
            <text className="station" x="168" y="280">
                {message.Timestamp?.dcduTimestamp()}
                {' '}
                {message.Direction === AtsuMessageDirection.Downlink ? ' TO ' : ' FROM '}
                {message.Station}
            </text>
            <>
                (
                {backgroundRequired
                && (
                    <Checkerboard
                        x={background.x}
                        y={background.y}
                        width={background.width}
                        height={background.height}
                        cellSize={10}
                        fill={backgroundColor}
                    />
                )}
                )
                <text className={statusClass} x="3716" y="290">
                    <tspan>{text}</tspan>
                </text>
            </>
        </g>
    );
};
