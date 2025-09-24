require("dotenv").config();
const express = require("express");
const AWS = require("aws-sdk");
const cors = require("cors");

const app = express();
app.use(cors());

// Configure S3 client
const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// Route to generate a pre-signed URL
app.get("/getPresignedUrl", async (req, res) => {
  // ✅ Take filename from query param (frontend will send it)
  const fileName = req.query.name || `${Date.now()}.pdf`;

  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: fileName, // 👈 goes to root of bucket, keeps name
    Expires: 60, // URL expires in 60 seconds
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

app.listen(5000, () => {
  console.log("✅ Backend running on http://localhost:5000");
});
