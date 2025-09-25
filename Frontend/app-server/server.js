require("dotenv").config();
const express = require("express");
const AWS = require("aws-sdk");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json()); // 👈 needed for parsing JSON body

// Configure AWS SDK
const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const sns = new AWS.SNS({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// =========================
// 1️⃣ Route: Generate Pre-Signed URL
// =========================
app.get("/getPresignedUrl", async (req, res) => {
  const fileName = req.query.name || `${Date.now()}.pdf`;

  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: fileName,
    Expires: 60, // URL valid for 60s
    ContentType: "application/pdf",
  };

  try {
    const url = await s3.getSignedUrlPromise("putObject", params);
    res.json({ url });
  } catch (err) {
    console.error("Error generating URL:", err);
    res.status(500).json({ error: err.message });
  }
});

// =========================
// 2️⃣ Route: Subscribe to SNS Topic
// =========================
app.post("/subscribe", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const params = {
    Protocol: "email", // could also be "sms" or "https"
    TopicArn: process.env.SNS_TOPIC_ARN,
    Endpoint: email,
  };

  try {
    const result = await sns.subscribe(params).promise();
    res.json({
      message: "Subscription request sent. Please check your email to confirm!",
      result,
    });
  } catch (err) {
    console.error("Error subscribing:", err);
    res.status(500).json({ error: err.message });
  }
});

// =========================
// Start server
// =========================
app.listen(5000, () => {
  console.log("✅ Backend running on http://localhost:5000");
});
