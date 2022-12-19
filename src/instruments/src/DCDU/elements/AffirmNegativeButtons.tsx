import React from 'react';
import { AtsuMessageComStatus } from '@atsu/messages/AtsuMessage';
import { CpdlcMessage } from '@atsu/messages/CpdlcMessage';
import { UplinkMonitor } from '@atsu/components/UplinkMessageMonitoring';
import { Button } from './Button';

type AffirmNegativeButtonsProps = {
    message: CpdlcMessage,
    reachedEndOfMessage: boolean,
    selectedResponse: number,
    setMessageStatus(message: number, response: number),
    sendResponse: (message: number, response: number) => void,
    closeMessage: (message: number) => void,
    monitorMessage: (message: number) => void,
    cancelMessageMonitoring: (message: number) => void,
}

export const AffirmNegativeButtons: React.FC<AffirmNegativeButtonsProps> = ({
    message, reachedEndOfMessage, selectedResponse, setMessageStatus, sendResponse, closeMessage,
    monitorMessage, cancelMessageMonitoring,
}) => {
    const buttonsBlocked = message.Response?.ComStatus === AtsuMessageComStatus.Sending || reachedEndOfMessage === false;

    // define the rules for the visualization of the buttons
    let showAnswers = false;
    let showSend = false;

    if (selectedResponse === -1 && !message.Response) {
        showAnswers = true;
    } else if (!message.Response) {
        showSend = true;
    }

    const clicked = (index: string) : void => {
        if (message.UniqueMessageID === -1 || buttonsBlocked) {
            return;
        }

        if (showAnswers) {
            if (index === 'L1') {
                setMessageStatus(message.UniqueMessageID, 5);
            } else if (index === 'R2') {
                setMessageStatus(message.UniqueMessageID, 4);
                if (UplinkMonitor.relevantMessage(message)) {
                    monitorMessage(message.UniqueMessageID);
                }
            }
        } else if (showSend) {
            if (index === 'L1') {
                if (UplinkMonitor.relevantMessage(message)) {
                    cancelMessageMonitoring(message.UniqueMessageID);
                }
                setMessageStatus(message.UniqueMessageID, -1);
            } else if (index === 'R2') {
                sendResponse(message.UniqueMessageID, selectedResponse);
            }
        } else if (index === 'R2') {
            closeMessage(message.UniqueMessageID);
        }
    };

    return (
        <>
            {showAnswers && (
                <>
                    <Button
                        messageId={message.UniqueMessageID}
                        index="L1"
                        content="NEGATV"
                        active={!buttonsBlocked}
                        onClick={clicked}
                    />
                    <Button
                        messageId={message.UniqueMessageID}
                        index="R2"
                        content="AFFIRM"
                        active={!buttonsBlocked}
                        onClick={clicked}
                    />
                </>
            )}
            {showSend && (
                <>
                    <Button
                        messageId={message.UniqueMessageID}
                        index="L1"
                        content="CANCEL"
                        active={!buttonsBlocked}
                        onClick={clicked}
                    />
                    <Button
                        messageId={message.UniqueMessageID}
                        index="R2"
                        content="SEND"
                        active={!buttonsBlocked}
                        onClick={clicked}
                    />
                </>
            )}
            {!showAnswers && !showSend && (
                <Button
                    messageId={message.UniqueMessageID}
                    index="R2"
                    content="CLOSE"
                    active={!buttonsBlocked}
                    onClick={clicked}
                />
            )}
        </>
    );
};
