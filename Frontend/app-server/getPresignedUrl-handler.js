require("dotenv").config();
const AWS = require("aws-sdk");

// Configure S3 client outside the handler for reuse
const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  // Credentials will be provided by the Lambda's IAM execution role
});

// This is the main Lambda handler function
exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  // Get the file name from the query string parameters
  const fileName = event.queryStringParameters?.name || `${Date.now()}.pdf`;

  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: fileName,
    Expires: 60, // URL expires in 60 seconds
    ContentType: "application/pdf",
  };

  try {
    const url = await s3.getSignedUrlPromise("putObject", params);

    // Return a response object that API Gateway understands
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*", // Allow requests from any origin (CORS)
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({ url }),
    };
  } catch (err) {
    console.error("Error generating URL:", err);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: err.message }),
    };
  }
};