import json
import os
import tempfile
import boto3
import requests
import logging
from urllib.parse import unquote_plus

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
s3_client = boto3.client('s3')
sns_client = boto3.client('sns')

# Load environment variables
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN')

if not all([GEMINI_API_KEY, SNS_TOPIC_ARN]):
    logger.error("Missing one or more required environment variables.")
    GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"
    SNS_TOPIC_ARN = "arn:aws:sns:REGION:ACCOUNT_ID:YOUR_TOPIC_NAME"

# Define the structured schema for Gemini's response
RESUME_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "phone_number": {"type": "string"},
        "email": {"type": "string"},
        "skills": {"type": "array", "items": {"type": "string"}},
        "companies_worked_for": {"type": "array", "items": {"type": "string"}}
    },
    "required": ["name", "email"]
}


def extract_pdf_text(file_path):
    """Extracts text from a PDF file using pdfplumber."""
    try:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            return "".join([page.extract_text() or "" for page in pdf.pages])
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {e}")
        return ""


def process_resume_with_gemini(resume_text, custom_prompt=None):
    """Send resume text to Gemini with optional custom prompt."""
    if not GEMINI_API_KEY:
        logger.error("Gemini API key is missing")
        return None

    prompt = custom_prompt or f"""
    Analyze the following resume text and extract the key information.
    Provide the name, phone number, email, a list of professional skills,
    and a list of company names where the person has worked.
    Resume Text:
    ---
    {resume_text}
    ---
    """

    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key={GEMINI_API_KEY}"

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": RESUME_SCHEMA
        }
    }

    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(api_url, headers=headers, data=json.dumps(payload))
        response.raise_for_status()
        result = response.json()
        json_string = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
        return json.loads(json_string)
    except Exception as e:
        logger.error(f"Gemini API call failed: {e}")
        return None


def publish_to_sns(subject, message):
    """Publish summary to SNS topic."""
    try:
        sns_client.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=subject,
            Message=message
        )
    except Exception as e:
        logger.error(f"Error publishing to SNS: {e}")


def lambda_handler(event, context):
    """Main Lambda handler."""
    logger.info("Lambda triggered: " + json.dumps(event))

    try:
        record = event["Records"][0]
        bucket = record["s3"]["bucket"]["name"]
        key = unquote_plus(record["s3"]["object"]["key"])  # ✅ decode URL-encoded S3 key
    except KeyError:
        return {"statusCode": 400, "body": json.dumps("Invalid S3 event.")}

    # ✅ Create safe temporary download path
    download_path = os.path.join(tempfile.gettempdir(), key)

    # ✅ Ensure all intermediate directories exist (fix for your 404 error)
    os.makedirs(os.path.dirname(download_path), exist_ok=True)

    try:
        logger.info(f"Downloading file from S3: {bucket}/{key}")
        s3_client.download_file(bucket, key, download_path)
    except Exception as e:
        logger.error(f"Error downloading file from S3: {e}")
        return {"statusCode": 500, "body": json.dumps("Failed to download file from S3.")}

    # Extract text from the PDF
    resume_text = extract_pdf_text(download_path)

    # Clean up the temp file after processing
    try:
        os.remove(download_path)
    except Exception:
        pass  # ignore cleanup errors

    # Call Gemini API
    extracted_details = process_resume_with_gemini(resume_text)

    if extracted_details:
        name = extracted_details.get("name", "N/A")
        email = extracted_details.get("email", "N/A")
        phone = extracted_details.get("phone_number", "N/A")
        skills = ", ".join(extracted_details.get("skills", []))
        companies = ", ".join(extracted_details.get("companies_worked_for", []))

        subject = f"New Resume Processed: {name}"
        body = f"""
        Name: {name}
        Email: {email}
        Phone: {phone}
        Skills: {skills}
        Companies: {companies}
        File: {key}
        """

        publish_to_sns(subject, body)

    return {"statusCode": 200, "body": json.dumps("Lambda executed successfully")}
