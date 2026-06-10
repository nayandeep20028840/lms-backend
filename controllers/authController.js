const { QueryCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/dynamodb");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { ulid } = require("ulid");
const { sendEmail, sendGChatMessage } = require("../services/notificationService");
const logger = require("../utils/logger");

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
    logger.error("Login error:", error);
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
    logger.error("Signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
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
      return res.status(400).json({ message: "User Doesn't Exist Register your self" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Math.floor(Date.now() / 1000) + 600;

    const putCommand = new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `ACCOUNT#${email}`,
        sk: `OTP`,
        otp: otp,
        ttl: expiresAt
      }
    });
    await docClient.send(putCommand);

    const emailBody = `Your password reset OTP is: ${otp}. It will expire in 10 minutes.`;
    await Promise.all([
      sendEmail(email, "Password Reset OTP", emailBody).catch(e => logger.error("Email failed:", e)),
      sendGChatMessage(`Password reset requested for ${email}. OTP: ${otp}`).catch(e => logger.error("GChat failed:", e))
    ]);

    res.status(200).json({ message: "An OTP has been sent." });

  } catch (error) {
    logger.error("Forgot password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    const queryCommand = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "pk = :pk AND sk = :sk",
      ExpressionAttributeValues: {
        ":pk": `ACCOUNT#${email}`,
        ":sk": `OTP`
      }
    });

    const response = await docClient.send(queryCommand);
    logger.info("Response -> ", response);
    if (!response.Items || response.Items.length === 0) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    const storedOtpData = response.Items[0];

    if (Math.floor(Date.now() / 1000) > storedOtpData.ttl) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    if (storedOtpData.otp !== otp) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    res.status(200).json({ message: "OTP verified successfully. You may now reset your password." });

  } catch (error) {
    logger.error("Verify OTP error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: "Email, new password, and confirm password are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    const userQuery = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: INDEX_NAME,
      KeyConditionExpression: "gsipk = :gsipk AND gsisk = :gsisk",
      ExpressionAttributeValues: {
        ":gsipk": `ACCOUNT#${email}`,
        ":gsisk": "PROFILE"
      }
    });

    const userResponse = await docClient.send(userQuery);
    if (!userResponse.Items || userResponse.Items.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userResponse.Items[0];
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updatedUser = { ...user, hashPassword: hashedPassword };
    const putCommand = new PutCommand({
      TableName: TABLE_NAME,
      Item: updatedUser
    });

    await docClient.send(putCommand);

    res.status(200).json({ message: "Password has been successfully updated." });

  } catch (error) {
    logger.error("Reset password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
