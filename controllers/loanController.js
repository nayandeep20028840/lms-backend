const { QueryCommand, PutCommand, UpdateCommand, DeleteCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/dynamodb");
const { ulid } = require("ulid");
const logger = require("../utils/logger");

const TABLE_NAME = "CBS_POC_LMS";
const INDEX_NAME = "gsi";

exports.requestLoan = async (req, res) => {
    try {
        const { amount, name, email, age, type, documents } = req.body;
        const userId = req.user.id;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: "A valid loan amount is required" });
        }

        const queryCommand = new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: INDEX_NAME,
            KeyConditionExpression: "gsipk = :gsipk",
            ExpressionAttributeValues: {
                ":gsipk": "LOAN#VALUE"
            }
        });

        const poolResponse = await docClient.send(queryCommand);

        let totalAvailablePool = 0;
        if (poolResponse.Items && poolResponse.Items.length > 0) {
            totalAvailablePool = poolResponse.Items.reduce((acc, item) => acc + (item.value || 0), 0);
        }

        if (totalAvailablePool < amount) {
            return res.status(400).json({
                error: "Insufficient loan pool available",
                availablePool: totalAvailablePool,
                requestedAmount: amount
            });
        }

        const loanReqId = ulid();
        const timestamp = Date.now();

        const putCommand = new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                pk: `LOAN_REQ#${loanReqId}`,
                sk: `LOAN_REQ#${loanReqId}`,
                gsipk: `STATUS#PENDING`,
                gsisk: timestamp.toString(),
                userId,
                loanReqId,
                amount: Number(amount),
                name,
                email,
                age,
                type: type || 'Personal Loan',
                documents: documents || {},
                status: "PENDING",
                createdAt: timestamp
            }
        });

        await docClient.send(putCommand);

        return res.status(201).json({
            message: "Loan request submitted successfully",
            loanReqId,
            status: "PENDING",
            requestedAmount: Number(amount)
        });

    } catch (error) {
        logger.error("Error fetching loan pool:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

exports.updateLoanStatus = async (req, res) => {
    try {
        const { loanReqId } = req.params;
        const { status } = req.body;

        if (!loanReqId || !status) {
            return res.status(400).json({ error: "loanReqId parameter and status body field are required" });
        }

        const validStatuses = ["PENDING", "APPROVED", "COMPLETED", "REJECTED"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        const updateCommand = new UpdateCommand({
            TableName: TABLE_NAME,
            Key: {
                pk: `LOAN_REQ#${loanReqId}`,
                sk: `LOAN_REQ#${loanReqId}`
            },
            UpdateExpression: "SET #status = :status, gsipk = :gsipk, updatedAt = :updatedAt",
            ExpressionAttributeNames: {
                "#status": "status"
            },
            ExpressionAttributeValues: {
                ":status": status,
                ":gsipk": `STATUS#${status}`,
                ":updatedAt": Date.now()
            },
            ReturnValues: "ALL_NEW"
        });

        const result = await docClient.send(updateCommand);

        if (status === "COMPLETED") {
            const getCommand = new GetCommand({
                TableName: TABLE_NAME,
                Key: {
                    pk: `LOAN_REQ#${loanReqId}`,
                    sk: `LOAN_REQ#${loanReqId}`
                }
            });
            const loanData = await docClient.send(getCommand);
            
            if (loanData.Item && loanData.Item.amount) {
                const poolQuery = new QueryCommand({
                    TableName: TABLE_NAME,
                    IndexName: INDEX_NAME,
                    KeyConditionExpression: "gsipk = :gsipk",
                    ExpressionAttributeValues: {
                        ":gsipk": "LOAN#VALUE"
                    }
                });
                const poolResult = await docClient.send(poolQuery);
                const poolItem = poolResult.Items.find(item => item.gsisk === "POOL" || item.value > 0);

                if (poolItem) {
                    const poolDecreaseCommand = new UpdateCommand({
                        TableName: TABLE_NAME,
                        Key: { pk: poolItem.pk, sk: poolItem.sk },
                        UpdateExpression: "SET #val = #val - :amt",
                        ExpressionAttributeNames: { "#val": "value" },
                        ExpressionAttributeValues: { ":amt": Number(loanData.Item.amount) }
                    });
                    await docClient.send(poolDecreaseCommand);
                }
            }
        }

        return res.status(200).json({
            message: "Loan status updated successfully",
            updatedLoan: result.Attributes
        });

    } catch (error) {
        logger.error("Error updating loan status:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

exports.getCompletedLoans = async (req, res) => {
    try {
        const queryCommand = new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: INDEX_NAME,
            KeyConditionExpression: "gsipk = :gsipk",
            ExpressionAttributeValues: {
                ":gsipk": "STATUS#COMPLETED"
            }
        });

        const response = await docClient.send(queryCommand);

        return res.status(200).json({
            message: "Completed loans fetched successfully",
            count: response.Count,
            loans: response.Items
        });

    } catch (error) {
        logger.error("Error fetching completed loans:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

exports.getPendingLoans = async (req, res) => {
    try {
        const queryCommand = new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: INDEX_NAME,
            KeyConditionExpression: "gsipk = :gsipk",
            ExpressionAttributeValues: {
                ":gsipk": "STATUS#PENDING"
            }
        });

        const response = await docClient.send(queryCommand);

        return res.status(200).json({
            message: "Pending loans fetched successfully",
            count: response.Count,
            loans: response.Items
        });

    } catch (error) {
        logger.error("Error fetching pending loans:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

exports.clearCompletedLoans = async (req, res) => {
    try {
        const queryCommand = new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: INDEX_NAME,
            KeyConditionExpression: "gsipk = :gsipk",
            ExpressionAttributeValues: {
                ":gsipk": "STATUS#COMPLETED"
            }
        });

        const response = await docClient.send(queryCommand);

        if (!response.Items || response.Items.length === 0) {
            return res.status(200).json({ message: "No completed loans found to clear." });
        }

        for (const loan of response.Items) {
            const deleteCommand = new DeleteCommand({
                TableName: TABLE_NAME,
                Key: {
                    pk: loan.pk,
                    sk: loan.sk
                }
            });
            await docClient.send(deleteCommand);
        }

        return res.status(200).json({
            message: "Completed transaction history cleared successfully",
            deletedCount: response.Items.length
        });

    } catch (error) {
        logger.error("Error clearing completed loans:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

exports.getLoanPool = async (req, res) => {
    try {
        const queryCommand = new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: INDEX_NAME,
            KeyConditionExpression: "gsipk = :gsipk",
            ExpressionAttributeValues: {
                ":gsipk": "LOAN#VALUE"
            }
        });

        const poolResponse = await docClient.send(queryCommand);
        let totalAvailablePool = 0;
        if (poolResponse.Items && poolResponse.Items.length > 0) {
            totalAvailablePool = poolResponse.Items.reduce((acc, item) => acc + (item.value || 0), 0);
        }

        return res.status(200).json({ availablePool: totalAvailablePool });
    } catch (error) {
        logger.error("Error fetching loan pool:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
