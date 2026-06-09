const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/dynamodb");
const { ulid } = require("ulid");

const TABLE_NAME = "CBS_POC_LMS";

async function seedLoanAmount() {
  try {
    const loanId = ulid();

    const putCommand = new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `LOAN#${loanId}`,
        sk: `LOAN#${loanId}`,
        gsipk: `LOAN#VALUE`,
        gsisk: `LOAN#VALUE`,
        value: 1000000000000,
        createdAt: Date.now()
      }
    });

    await docClient.send(putCommand);
    console.log("Loan pool successfully seeded!");
    console.log(`Loan ID: ${loanId}`);

  } catch (error) {
    console.error("Error seeding loan pool:", error);
  }
}

seedLoanAmount();
