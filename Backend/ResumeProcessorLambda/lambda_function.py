import json
import os
import tempfile
import boto3
import requests
import logging

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
s3_client = boto3.client('s3')
sns_client = boto3.client('sns')
dynamo_client = boto3.client('dynamodb')

# Load environment variables
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN')
JOB_TABLE = os.environ.get('JOB_TABLE')

if not all([GEMINI_API_KEY, SNS_TOPIC_ARN, JOB_TABLE]):
    logger.warning("Missing one or more environment variables.")

# 🧩 Updated schema to include match percentage
RESUME_MATCH_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "email": {"type": "string"},
        "skills": {"type": "array", "items": {"type": "string"}},
        "companies_worked_for": {"type": "array", "items": {"type": "string"}},
        "match_percentage": {
            "type": "number",
            "description": "How well this resume fits the job (0–100)."
        },
        "key_strengths": {"type": "array", "items": {"type": "string"}},
        "missing_skills": {"type": "array", "items": {"type": "string"}}
    },
    "required": ["name", "email", "match_percentage"]
}


def extract_pdf_text(file_path):
    """Extract text from PDF."""
    try:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            text = ""
            for page in pdf.pages:
                text += page.extract_text() or ""
            return text
    except Exception as e:
        logger.error(f"Error extracting text: {e}")
        return ""


def get_job_from_dynamo(job_id):
    """Fetch job title & description from DynamoDB using job_id."""
    try:
        response = dynamo_client.get_item(
            TableName=JOB_TABLE,
            Key={"jobId": {"S": job_id}}
        )
        item = response.get('Item', {})
        if not item:
            logger.warning(f"No job found for jobId={job_id}")
            return None, None
        title = item.get('title', {}).get('S', 'N/A')
        description = item.get('description', {}).get('S', 'N/A')
        return title, description
    except Exception as e:
        logger.error(f"Error fetching job from DynamoDB: {e}")
        return None, None


def process_resume_with_gemini(resume_text, job_title=None, job_description=None):
    """Send resume and job info to Gemini and get structured match output."""
    if not GEMINI_API_KEY or GEMINI_API_KEY == "YOUR_GEMINI_API_KEY":
        logger.error("Gemini API key missing.")
        return None

    prompt = f"""
    You are a career matching assistant.
    Compare the following candidate resume with the provided job role and description.
    Output JSON only with:
      - name
      - email
      - list of skills
      - list of companies_worked_for
      - match_percentage (0–100)
      - key_strengths (skills that match job requirements)
      - missing_skills (important skills missing for this job)
      
    Job Role: {job_title or "N/A"}
    Job Description: {job_description or "N/A"}

    Resume Text:
    ---
    {resume_text}
    ---
    """

    api_url = (
        f"https://generativelanguage.googleapis.com/v1beta/"
        f"models/gemini-2.5-flash-preview-05-20:generateContent?key={GEMINI_API_KEY}"
    )

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": RESUME_MATCH_SCHEMA
        }
    }

    try:
        response = requests.post(api_url, headers={"Content-Type": "application/json"}, data=json.dumps(payload))
        response.raise_for_status()
        result = response.json()
        json_string = result['candidates'][0]['content']['parts'][0]['text']
        return json.loads(json_string)
    except Exception as e:
        logger.error(f"Gemini API call failed: {e}")
        logger.error(f"Raw response: {response.text if 'response' in locals() else 'No response'}")
        return None


def publish_to_sns(subject, message):
    """Publish a message to SNS."""
    try:
        sns_client.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=subject,
            Message=message
        )
        logger.info("Message published to SNS.")
    except Exception as e:
        logger.error(f"Error publishing SNS: {e}")


def lambda_handler(event, context):
    """Lambda handler triggered by S3 upload event."""
    logger.info("Lambda triggered.")
    logger.info(json.dumps(event))

    # ✅ Get S3 bucket & key
    try:
        record = event['Records'][0]
        bucket = record['s3']['bucket']['name']
        key = record['s3']['object']['key']
        logger.info(f"S3 upload detected: bucket={bucket}, key={key}")
    except KeyError:
        return {'statusCode': 400, 'body': json.dumps("Invalid S3 event structure.")}

    # ✅ Extract jobId from S3 key path (uploads/{jobId}/{filename})
    try:
        parts = key.split('/')
        job_id = parts[1] if len(parts) > 1 else 'default'
        logger.info(f"✅ Extracted jobId from key path: {job_id}")
    except Exception as e:
        logger.warning(f"Could not parse jobId from key: {e}")
        job_id = 'default'

    # ✅ Download the PDF
    download_path = os.path.join(tempfile.gettempdir(), os.path.basename(key))
    try:
        s3_client.download_file(bucket, key, download_path)
        logger.info(f"Downloaded file: {download_path}")
    except Exception as e:
        logger.error(f"Error downloading file: {e}")
        return {'statusCode': 500, 'body': json.dumps("Download failed.")}

    # ✅ Extract resume text
    resume_text = extract_pdf_text(download_path)
    os.remove(download_path)

    if not resume_text:
        return {'statusCode': 500, 'body': json.dumps("Failed to extract resume text.")}

    # ✅ Get job info from DynamoDB
    job_title, job_description = get_job_from_dynamo(job_id)

    # ✅ Compare resume with job using Gemini
    result = process_resume_with_gemini(resume_text, job_title, job_description)

    if not result:
        return {'statusCode': 500, 'body': json.dumps("Gemini processing failed.")}

    # ✅ Publish summary to SNS
    summary = f"""
    Resume Match Analysis:
    Candidate: {result.get('name')}
    Email: {result.get('email')}
    Job Role: {job_title}
    Match: {result.get('match_percentage')}%
    Key Strengths: {', '.join(result.get('key_strengths', []))}
    Missing Skills: {', '.join(result.get('missing_skills', []))}
    """
    publish_to_sns(f"Resume Match Result - {job_title}", summary)

    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Resume processed successfully',
            'match_result': result
        })
    }
