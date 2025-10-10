// server.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { handler } from "./getPresignedUrl-handler.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Existing routes
app.get("/getPresignedUrl", async (req, res) => {
  const event = {
    httpMethod: "GET",
    path: "/getPresignedUrl",
    queryStringParameters: req.query,
  };
  const result = await handler(event);
  res.status(result.statusCode).set(result.headers).send(result.body);
});

app.get("/getJobRoles", async (req, res) => {
  const event = { httpMethod: "GET", path: "/getJobRoles" };
  const result = await handler(event);
  res.status(result.statusCode).set(result.headers).send(result.body);
});

// ✅ NEW endpoint: /jobs/:jobId
app.get("/jobs/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const event = {
    httpMethod: "GET",
    path: `/jobs/${jobId}`,
    queryStringParameters: { jobId },
  };
  const result = await handler(event);
  res.status(result.statusCode).set(result.headers).send(result.body);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
