import "dotenv/config";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  DynamoDBClient,
  ScanCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";

// Initialize AWS clients
const s3 = new S3Client({ region: process.env.AWS_REGION });
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

export const handler = async (event) => {
  console.log("📩 Received event:", JSON.stringify(event, null, 2));
  const method = event.httpMethod;
  const path = event.path || "";

  // ✅ 1️⃣ Handle GET /getPresignedUrl
  if (method === "GET" && path.includes("getPresignedUrl")) {
    try {
      const fileName = event.queryStringParameters?.name || `${Date.now()}.pdf`;
      const jobId = event.queryStringParameters?.jobId || "unknown";

      const objectKey = `uploads/${jobId}/${fileName}`;

      const command = new PutObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: objectKey,
        ContentType: "application/pdf",
      });

      const url = await getSignedUrl(s3, command, { expiresIn: 60 });

      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
        },
        body: JSON.stringify({ url }),
      };
    } catch (err) {
      console.error("❌ Error generating presigned URL:", err);
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  // ✅ 2️⃣ Handle GET /getJobRoles
  if (method === "GET" && path.includes("getJobRoles")) {
    try {
      const command = new ScanCommand({ TableName: process.env.JOB_TABLE });
      const data = await dynamo.send(command);

      const jobs = data.Items.map((item) => ({
        id: item.jobId.S,
        title: item.title.S,
        description: item.description.S,
      }));

      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
        },
        body: JSON.stringify(jobs),
      };
    } catch (err) {
      console.error("❌ Error fetching job roles:", err);
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  // ✅ 3️⃣ Handle GET /jobs/{jobId}
  if (method === "GET" && path.includes("/jobs/")) {
    const jobId = event.queryStringParameters?.jobId;
    try {
      const command = new GetItemCommand({
        TableName: process.env.JOB_TABLE,
        Key: { jobId: { S: jobId } },
      });
      const data = await dynamo.send(command);

      if (!data.Item)
        return {
          statusCode: 404,
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ message: "Job not found" }),
        };

      const job = {
        id: data.Item.jobId.S,
        title: data.Item.title.S,
        description: data.Item.description.S,
      };

      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(job),
      };
    } catch (err) {
      console.error("❌ Error fetching job:", err);
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: err.message }),
      };
    }
  }

  // 4️⃣ Default fallback
  return {
    statusCode: 404,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ error: "Invalid route or method" }),
  };
};
