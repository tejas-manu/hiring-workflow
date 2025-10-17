# get_presigned_url.py
import os
import json
import uuid
import boto3
from urllib.parse import parse_qs

s3 = boto3.client("s3")
BUCKET = os.environ["BUCKET_NAME"]

def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,OPTIONS"
    }

def handler(event, context):
    # Support both API Gateway v1 (httpMethod) and v2 (requestContext.http.method)
    method = event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method")
    path = event.get("path", "")

    if method == "OPTIONS":
        return {"statusCode": 200, "headers": _cors_headers(), "body": ""}

    # Expect GET /getPresignedUrl?name=<file>&jobId=<id>
    if method == "GET" and "getPresignedUrl" in path:
        # Handle both queryStringParameters and raw queryString (for some proxies)
        qs = event.get("queryStringParameters") or {}
        if not qs and "rawQueryString" in event:  # API GW HTTP API
            qs = {k: v[0] for k, v in parse_qs(event["rawQueryString"]).items()}

        filename = qs.get("name") or f"{uuid.uuid4()}.pdf"
        job_id = qs.get("jobId") or "unknown"

        # Build object key that encodes the jobId
        object_key = f"uploads/{job_id}/{uuid.uuid4()}_{filename}"

        try:
            url = s3.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": BUCKET,
                    "Key": object_key,
                    "ContentType": "application/pdf"
                },
                ExpiresIn=900  # 15 minutes
            )
            # Return url (and key if you want the client to know it)
            return {
                "statusCode": 200,
                "headers": _cors_headers(),
                "body": json.dumps({"url": url, "key": object_key})
            }
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": _cors_headers(),
                "body": json.dumps({"error": str(e)})
            }

    # Fallback
    return {
        "statusCode": 404,
        "headers": _cors_headers(),
        "body": json.dumps({"error": "Invalid route or method"})
    }