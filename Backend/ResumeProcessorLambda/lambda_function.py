# fetch_job_description.py
import os
import json
import boto3
from urllib.parse import parse_qs
import logging
from botocore.exceptions import ClientError

log = logging.getLogger()
log.setLevel(logging.INFO)

dynamo = boto3.client("dynamodb")
JOB_TABLE = os.environ.get("JOB_TABLE", "")

def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,OPTIONS"
    }

def _s(item, key):
    """Safely read a DynamoDB string attribute (S)."""
    v = item.get(key)
    return v.get("S", "") if isinstance(v, dict) else ""

def _ddb_item_to_job(item):
    """Map a DynamoDB item to a plain dict. Accepts jobId or id as PK."""
    job_id = _s(item, "jobId") or _s(item, "id")
    title = _s(item, "title")
    desc  = _s(item, "description")
    return {"id": job_id, "title": title, "description": desc}

def _method_and_path(event):
    # Works for REST (httpMethod/path) and HTTP API v2 (requestContext.http.method/rawPath)
    method = event.get("httpMethod") or event.get("requestContext", {}).get("http", {}).get("method") or ""
    path = event.get("path") or event.get("rawPath") or ""
    return method.upper(), path

def _ok(body):
    return {"statusCode": 200, "headers": _cors_headers(), "body": json.dumps(body)}

def _err(code, msg):
    return {"statusCode": code, "headers": _cors_headers(), "body": json.dumps({"error": msg})}

def handler(event, context):
    log.info("event=%s", json.dumps(event))
    if not JOB_TABLE:
        return _err(500, "JOB_TABLE env var is not set")

    method, path = _method_and_path(event)

    # Preflight
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": _cors_headers(), "body": ""}

    # GET /getJobRoles  -> list all roles
    if method == "GET" and "getJobRoles" in path:
        try:
            items = []
            scan_kwargs = {"TableName": JOB_TABLE}
            while True:
                resp = dynamo.scan(**scan_kwargs)
                items.extend(resp.get("Items", []))
                lek = resp.get("LastEvaluatedKey")
                if not lek:
                    break
                scan_kwargs["ExclusiveStartKey"] = lek

            jobs = [_ddb_item_to_job(i) for i in items]
            log.info("getJobRoles: count=%d", len(jobs))
            return _ok(jobs)
        except Exception as e:
            log.exception("getJobRoles failed")
            return _err(500, str(e))

    # GET /jobs?jobId=...  -> single job
    if method == "GET" and "/jobs" in path:
        try:
            qs = event.get("queryStringParameters") or {}
            if not qs and "rawQueryString" in event:
                qs = {k: v[0] for k, v in parse_qs(event["rawQueryString"]).items()}

            job_id = (qs or {}).get("jobId")
            if not job_id:
                return _err(400, "jobId is required")

            # Try with PK name 'jobId'
            try:
                resp = dynamo.get_item(
                    TableName=JOB_TABLE,
                    Key={"jobId": {"S": job_id}},
                    ProjectionExpression="jobId, title, description"
                )
                item = resp.get("Item")
            except ClientError as ce:
                # If the key attr name is wrong for the table, retry with 'id'
                if ce.response.get("Error", {}).get("Code") == "ValidationException":
                    item = None
                else:
                    raise

            # If not found or key was wrong, try 'id' as PK
            if not item:
                try:
                    resp = dynamo.get_item(
                        TableName=JOB_TABLE,
                        Key={"id": {"S": job_id}},
                        ProjectionExpression="id, title, description"
                    )
                    item = resp.get("Item")
                except ClientError as ce:
                    if ce.response.get("Error", {}).get("Code") != "ValidationException":
                        raise

            if not item:
                return {"statusCode": 404, "headers": _cors_headers(), "body": json.dumps({"message": "Job not found"})}

            job = _ddb_item_to_job(item)
            return _ok(job)

        except Exception as e:
            log.exception("get /jobs failed")
            return _err(500, str(e))

    # Fallback
    return _err(404, "Invalid route or method")
