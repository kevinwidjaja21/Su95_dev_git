import React from 'react';
import { AtsuMessageComStatus, AtsuMessageDirection, AtsuMessageSerializationFormat } from '@atsu/messages/AtsuMessage';
import { CpdlcMessage } from '@atsu/messages/CpdlcMessage';
import { MessageVisualization } from './MessageVisualization';

type DatalinkMessageProps = {
    messages: CpdlcMessage[],
    isStatusAvailable: (sender: string) => boolean,
    setStatus: (sender: string, message: string, duration: number) => void,
    resetStatus: (sender: string) => void
}

export const DatalinkMessage: React.FC<DatalinkMessageProps> = ({ messages, isStatusAvailable, setStatus, resetStatus }) => {
    // define the correct background color
    let backgroundColor: [number, number, number] = [0, 0, 0];
    if (messages[0].Direction === AtsuMessageDirection.Downlink) {
        if (messages[0].ComStatus === AtsuMessageComStatus.Sent || messages[0].ComStatus === AtsuMessageComStatus.Sending) {
            backgroundColor = [0, 255, 0];
        } else {
            backgroundColor = [0, 255, 255];
        }
    }

    // check if highlight is needed
    let ignoreHighlight = false;
    if (messages[0].Direction === AtsuMessageDirection.Downlink) {
        ignoreHighlight = true;
    } else if (messages[0].Response !== undefined && messages[0].Response.ComStatus === AtsuMessageComStatus.Sending) {
        ignoreHighlight = true;
    } else if (messages[0].Response !== undefined && messages[0].Response.ComStatus === AtsuMessageComStatus.Sent && messages[0].Response.Message !== 'STANDBY') {
        ignoreHighlight = true;
    }

    // define the text color
    let messageClass = 'message-content';
    if (messages[0].Direction === AtsuMessageDirection.Downlink) {
        messageClass += ' message-content-other message-content-out';
    } else if (ignoreHighlight) {
        messageClass += ' message-content-sent';
    } else {
        messageClass += ' message-content-other message-content-in';
    }

    // create the message content
    let content = '';
    messages.forEach((message) => {
        if (message.Content === undefined && message.Message !== '') {
            content += `${message.Message}\n`;
        } else {
            content += `${message.serialize(AtsuMessageSerializationFormat.DCDU)}\n`;
        }
    });

    // remove the last newline
    if (content.length !== 0) {
        content = content.slice(0, -1);
    }

    return (
        <g>
            <MessageVisualization
                message={content}
                backgroundColor={backgroundColor}
                keepNewlines={messages[0].Direction === AtsuMessageDirection.Downlink}
                ignoreHighlight={ignoreHighlight}
                cssClass={messageClass}
                yStart={720}
                deltaY={240}
                isStatusAvailable={isStatusAvailable}
                setStatus={setStatus}
                resetStatus={resetStatus}
            />
        </g>
    );
};
