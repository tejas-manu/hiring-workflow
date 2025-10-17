# fetch_job_description.py
import os
import json
import boto3
from urllib.parse import parse_qs

dynamo = boto3.client("dynamodb")
JOB_TABLE = os.environ["JOB_TABLE"]

def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,OPTIONS"
    }

def _ddb_item_to_job(item):
    # Adjust attribute names to match your table
    return {
        "id": item["jobId"]["S"],
        "title": item.get("title", {}).get("S", ""),
        "description": item.get("description", {}).get("S", "")
    }

def handler(event, context):
    method = event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method")
    path = event.get("path", "")

    if method == "OPTIONS":
        return {"statusCode": 200, "headers": _cors_headers(), "body": ""}

    # GET /getJobRoles
    if method == "GET" and "getJobRoles" in path:
        try:
            resp = dynamo.scan(TableName=JOB_TABLE)
            items = resp.get("Items", [])
            jobs = [_ddb_item_to_job(i) for i in items]
            return {"statusCode": 200, "headers": _cors_headers(), "body": json.dumps(jobs)}
        except Exception as e:
            return {"statusCode": 500, "headers": _cors_headers(), "body": json.dumps({"error": str(e)})}

    # GET /jobs?jobId=...
    if method == "GET" and "/jobs" in path:
        qs = event.get("queryStringParameters") or {}
        if not qs and "rawQueryString" in event:
            qs = {k: v[0] for k, v in parse_qs(event["rawQueryString"]).items()}

        job_id = qs.get("jobId")
        if not job_id:
            return {"statusCode": 400, "headers": _cors_headers(), "body": json.dumps({"error": "jobId is required"})}

        try:
            resp = dynamo.get_item(
                TableName=JOB_TABLE,
                Key={"jobId": {"S": job_id}},
                ProjectionExpression="jobId, title, description"
            )
            item = resp.get("Item")
            if not item:
                return {"statusCode": 404, "headers": _cors_headers(), "body": json.dumps({"message": "Job not found"})}

            job = _ddb_item_to_job(item)
            return {"statusCode": 200, "headers": _cors_headers(), "body": json.dumps(job)}
        except Exception as e:
            return {"statusCode": 500, "headers": _cors_headers(), "body": json.dumps({"error": str(e)})}

    # Fallback
    return {
        "statusCode": 404,
        "headers": _cors_headers(),
        "body": json.dumps({"error": "Invalid route or method"})
    }
