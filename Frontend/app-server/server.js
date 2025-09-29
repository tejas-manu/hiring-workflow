require("dotenv").config();
const express = require("express");
const AWS = require("aws-sdk");
const cors = require("cors");

const app = express();
app.use(cors());

// Configure AWS SDK (S3 only)
const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// =========================
// Route: Generate Pre-Signed URL
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
// Start server
// =========================
app.listen(5000, () => {
  console.log("✅ Backend running on http://localhost:5000");
});
