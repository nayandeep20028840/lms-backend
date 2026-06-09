const { QueryCommand, PutCommand, UpdateCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/dynamodb");
const { ulid } = require("ulid");

const TABLE_NAME = "CBS_POC_LMS";
const INDEX_NAME = "gsi";

exports.requestLoan = async (req, res) => {
    try {
        const { amount } = req.body;
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
                gsipk: `USER#${userId}`,
                gsisk: timestamp.toString(),
                userId,
                loanReqId,
                amount: Number(amount),
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
        console.error("Error requesting loan:", error);
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
            UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
            ExpressionAttributeNames: {
                "#status": "status"
            },
            ExpressionAttributeValues: {
                ":status": status,
                ":updatedAt": Date.now()
            },
            ReturnValues: "ALL_NEW"
        });

        const result = await docClient.send(updateCommand);

        return res.status(200).json({
            message: "Loan status updated successfully",
            updatedLoan: result.Attributes
        });

    } catch (error) {
        console.error("Error updating loan status:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

exports.getCompletedLoans = async (req, res) => {
    try {
        const scanCommand = new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: "begins_with(pk, :pkPrefix) AND #status = :status",
            ExpressionAttributeNames: {
                "#status": "status"
            },
            ExpressionAttributeValues: {
                ":pkPrefix": "LOAN_REQ#",
                ":status": "COMPLETED"
            }
        });

        const response = await docClient.send(scanCommand);

        return res.status(200).json({
            message: "Completed loans fetched successfully",
            count: response.Count,
            loans: response.Items
        });

    } catch (error) {
        console.error("Error fetching completed loans:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
