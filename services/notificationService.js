const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const axios = require("axios");

// AWS ses client
const sesClient = new SESClient({
    region: process.env.AWS_REGION || "ap-south-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN
    }
});

// Not required for now, just sending G Chat messages
const sendEmail = async (toEmail, subject, body) => {
    try {
        const command = new SendEmailCommand({
            Destination: {
                ToAddresses: [toEmail],
            },
            Message: {
                Body: {
                    Text: { Data: body },
                },
                Subject: { Data: subject },
            },
            Source: process.env.SES_FROM_EMAIL,
        });

        await sesClient.send(command);
        console.log(`Email successfully sent to ${toEmail}`);
    } catch (error) {
        console.error("Error sending SES email:", error);
        throw error;
    }
};

const sendGChatMessage = async (message) => {
    try {
        const webhookUrl = process.env.GCHAT_WEBHOOK_URL;
        if (!webhookUrl) {
            console.warn("GCHAT_WEBHOOK_URL is missing. Skipping G-Chat notification.");
            return;
        }

        await axios.post(webhookUrl, {
            text: message
        });
        console.log("Message successfully sent to G-Chat group.");
    } catch (error) {
        console.error("Error sending G-Chat message:", error);
    }
};

module.exports = {
    sendEmail,
    sendGChatMessage
};
