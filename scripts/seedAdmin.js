const { PutItemCommand } = require("@aws-sdk/client-dynamodb");
const { client } = require("../config/dynamodb");
const bcrypt = require("bcryptjs");
const { ulid } = require("ulid");

const TABLE_NAME = "CBS_POC_LMS";

async function seedAdmin() {
  try {
    console.log("Seeding admin user...");
    const adminEmail = "admin@gmail.com";
    const rawPassword = "admin123";
    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    const adminId = ulid();

    const putItemCommand = new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: { S: `ADMIN#${adminId}` },
        sk: { S: `ADMIN#${adminId}` },
        gsipk: { S: `ACCOUNT#${adminEmail}` },
        gsisk: { S: `PROFILE` },
        email: { S: adminEmail },
        role: { S: "admin" },
        hashPassword: { S: hashedPassword },
        name: { S: "Nayan" },
        phn: { S: "+919999999999" }
      }
    });

    await client.send(putItemCommand);
    console.log("Admin user successfully seeded!");
    console.log(`Email: ${adminEmail}`);
    console.log(`Assigned ULID: ${adminId}`);

  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seedAdmin();
