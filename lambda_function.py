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

# Load environment variables
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN')

if not all([GEMINI_API_KEY, SNS_TOPIC_ARN]):
    logger.error("Missing one or more required environment variables.")
    # In a real-world scenario, you might want to raise an exception here.
    # For this example, we'll continue with placeholders.
    GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"
    SNS_TOPIC_ARN = "arn:aws:sns:REGION:ACCOUNT_ID:YOUR_TOPIC_NAME"

# Define the structured schema for Gemini's response.
# This ensures the API returns a consistent JSON object.
RESUME_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "phone_number": {"type": "string"},
        "email": {"type": "string"},
        "skills": {
            "type": "array",
            "items": {"type": "string"}
        },
        "companies_worked_for": {
            "type": "array",
            "items": {"type": "string"}
        }
    },
    "required": ["name", "email"]
}

def extract_pdf_text(file_path):
    """
    Extracts all text from a PDF file.

    Args:
        file_path (str): The path to the PDF file.

    Returns:
        str: The extracted text content.
    """
    try:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            full_text = ""
            for page in pdf.pages:
                full_text += page.extract_text() or ""
            return full_text
    except Exception as e:
        logger.error(f"Error extracting text from PDF: {e}")
        return ""

def process_resume_with_gemini(resume_text):
    """
    Sends resume text to the Gemini API to extract structured information.

    Args:
        resume_text (str): The full text of the resume.

    Returns:
        dict or None: A dictionary containing the extracted details, or None on failure.
    """
    if not GEMINI_API_KEY or GEMINI_API_KEY == "YOUR_GEMINI_API_KEY":
        logger.error("Gemini API key is not set. Skipping API call.")
        return None

    # Construct the prompt for the LLM
    prompt = f"""
    Analyze the following resume text and extract the key information.
    Provide the name, phone number, email, a list of professional skills,
    and a list of company names where the person has worked.
    Resume Text:
    ---
    {resume_text}
    ---
    """
    
    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key={GEMINI_API_KEY}"
    
    # We use a structured JSON response to ensure the output is parseable.
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": RESUME_SCHEMA
        }
    }

    headers = {
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(api_url, headers=headers, data=json.dumps(payload))
        response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)
        
        # Parse the JSON response
        result = response.json()
        
        # Extract the content text from the nested JSON structure
        json_string = result.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '{}')
        
        return json.loads(json_string)

    except requests.exceptions.RequestException as e:
        logger.error(f"Error during Gemini API call: {e}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON response from Gemini: {e}")
        logger.error(f"Raw response text: {response.text}")
        return None

def publish_to_sns(subject, message):
    """
    Publishes a message to an SNS topic.

    Args:
        subject (str): The subject of the message.
        message (str): The body of the message.
    """
    try:
        sns_client.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=subject,
            Message=message
        )
        logger.info(f"Message published to SNS topic: {SNS_TOPIC_ARN}")
    except Exception as e:
        logger.error(f"Error publishing to SNS: {e}")

def lambda_handler(event, context):
    """
    The main handler for the AWS Lambda function.

    This function is triggered by an S3 event. It downloads the PDF,
    extracts information using Gemini, and publishes a summary message via SNS.
    """
    logger.info("Lambda function triggered.")
    # Log the full S3 event payload for debugging purposes
    logger.info("S3 Event Payload: " + json.dumps(event))
    
    # Get the S3 bucket and file key from the event
    try:
        bucket = event['Records'][0]['s3']['bucket']['name']
        key = event['Records'][0]['s3']['object']['key']
        logger.info(f"New object '{key}' uploaded to bucket '{bucket}'.")
    except KeyError:
        logger.error("S3 event record not found or malformed.")
        return {'statusCode': 400, 'body': json.dumps('Invalid S3 event.')}

    # Use a temporary file path for the Lambda environment
    download_path = os.path.join(tempfile.gettempdir(), key)
    
    # Download the file from S3
    try:
        s3_client.download_file(bucket, key, download_path)
        logger.info(f"File downloaded to {download_path}")
    except Exception as e:
        logger.error(f"Error downloading file from S3: {e}")
        return {'statusCode': 500, 'body': json.dumps('Failed to download file.')}

    # Extract text from the PDF
    resume_text = extract_pdf_text(download_path)
    if not resume_text:
        return {'statusCode': 500, 'body': json.dumps('Failed to extract text from PDF.')}

    # Process the text with the Gemini API
    extracted_details = process_resume_with_gemini(resume_text)
    
    # Clean up the temporary file
    os.remove(download_path)

    logger.info(f"File downloaded to {extracted_details}")
    
    if extracted_details:
        # Construct the email body from the extracted details
        name = extracted_details.get('name', 'N/A')
        email = extracted_details.get('email', 'N/A')
        phone = extracted_details.get('phone_number', 'N/A')
        skills = ", ".join(extracted_details.get('skills', ['N/A']))
        companies = ", ".join(extracted_details.get('companies_worked_for', ['N/A']))
        
        email_subject = f"New Resume Processed: {name}"
        email_body = f"""
        A new resume has been uploaded and processed.

        Here are the extracted details:
        Name: {name}
        Email: {email}
        Phone: {phone}
        Skills: {skills}
        Companies: {companies}

        The original PDF file name was: {key}
        """
        
        # Publish the summary to the SNS topic
        publish_to_sns(email_subject, email_body)
    else:
        logger.warning("No details could be extracted from the resume. No SNS message published.")
        
    return {
        'statusCode': 200,
        'body': json.dumps('Lambda function executed successfully!')
    }
