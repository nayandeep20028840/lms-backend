const { uploadPresignedUrl, getPresignedUrl } = require("../utils/s3");
const logger = require("../utils/logger");
const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/dynamodb");
const { ulid } = require("ulid");

const TABLE_NAME = "CBS_POC_LMS";

exports.generateUploadUrl = async (req, res) => {
  try {
    const { key, contentType } = req.body;

    if (!key) {
      return res.status(400).json({ error: "File key is required" });
    }

    const result = await uploadPresignedUrl(key, contentType);

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(500).json({ error: "Failed to generate presigned URL", details: result.message });
    }
  } catch (error) {
    logger.error("Error in generateUploadUrl:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.generateDownloadUrl = async (req, res) => {
  try {
    const { key } = req.query;

    if (!key) {
      return res.status(400).json({ error: "File key is required" });
    }

    const url = await getPresignedUrl(key);
    return res.status(200).json({ success: true, downloadUrl: url });
  } catch (error) {
    logger.error("Error in generateDownloadUrl:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.confirmUpload = async (req, res) => {
    try {
        const { s3Key, documentType, contentType } = req.body;
        const userId = req.user.id;
        const documentId = ulid();
        const timestamp = Date.now();

        const putCommand = new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                pk: `DOCUMENT#${documentId}`,
                sk: `DOCUMENT#${documentId}`,
                gsipk: `USER#${userId}`,
                gsisk: timestamp.toString(),
                userId,
                documentId,
                documentType,
                s3Key,
                contentType,
                uploadedAt: timestamp
            }
        });

        await docClient.send(putCommand);

        res.status(201).json({ message: "Document saved successfully", documentId });
    } catch (error) {
        logger.error("Error in confirmUpload:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
