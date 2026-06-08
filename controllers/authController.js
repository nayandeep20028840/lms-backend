const { QueryCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/dynamodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { ulid } = require("ulid");

const TABLE_NAME = "CBS_POC_LMS";
const INDEX_NAME = "gsi"; 

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const queryCommand = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: INDEX_NAME,
      KeyConditionExpression: "gsipk = :gsipk AND gsisk = :gsisk",
      ExpressionAttributeValues: {
        ":gsipk": `ACCOUNT#${email}`,
        ":gsisk": "PROFILE"
      }
    });

    const response = await docClient.send(queryCommand);
    
    if (!response.Items || response.Items.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = response.Items[0];

    const isPasswordValid = await bcrypt.compare(password, user.hashPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { ulid: user.pk.split("#")[1], role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.pk.split("#")[1],
        email: user.email,
        name: user.name,
        role: user.role,
        phn: user.phn
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.signup = async (req, res) => {
  try {
    const { email, password, name, phn } = req.body;

    if (!email || !password || !name || !phn) {
      return res.status(400).json({ error: "Email, password, name, and phn are required" });
    }

    const queryCommand = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: INDEX_NAME,
      KeyConditionExpression: "gsipk = :gsipk AND gsisk = :gsisk",
      ExpressionAttributeValues: {
        ":gsipk": `ACCOUNT#${email}`,
        ":gsisk": "PROFILE"
      }
    });

    const existingUser = await docClient.send(queryCommand);
    if (existingUser.Items && existingUser.Items.length > 0) {
      return res.status(409).json({ error: "Email is already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = ulid();

    const putCommand = new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `USER#${userId}`,
        sk: `USER#${userId}`,
        gsipk: `ACCOUNT#${email}`,
        gsisk: `PROFILE`,
        role: "user",
        email: email,
        name: name,
        phn: phn,
        hashPassword: hashedPassword
      }
    });

    await docClient.send(putCommand);

    res.status(201).json({
      message: "User successfully registered. Please log in.",
      userId: userId
    });

  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
