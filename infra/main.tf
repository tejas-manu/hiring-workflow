# Define the AWS provider and specify a region
provider "aws" {
  region = "us-east-1" 
}

# Generate a unique bucket name to avoid naming conflicts
resource "random_string" "bucket_suffix" {
  length  = 6
  special = false
  upper   = false
}

# Create an S3 bucket to store the Lambda deployment package
resource "aws_s3_bucket" "lambda_bucket" {
  bucket = "resume-processor-lambda-code-${random_string.bucket_suffix.result}"
}

# Create a role for the Lambda function
resource "aws_iam_role" "lambda_role" {
  name = "lambda-resume-processor-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      },
    ]
  })
}

# Attach a policy to the role allowing Lambda to write to CloudWatch logs,
# read from S3, and publish to SNS
resource "aws_iam_role_policy" "lambda_policy" {
  name = "lambda-resume-processor-policy"
  role = aws_iam_role.lambda_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = "s3:GetObject"
        Resource = "${aws_s3_bucket.lambda_bucket.arn}/*"
      },
      {
        Effect = "Allow"
        Action = "sns:Publish"
        Resource = aws_sns_topic.resume_topic.arn
      }
    ]
  })
}

# Create an SNS topic for notifications
resource "aws_sns_topic" "resume_topic" {
  name = "ResumeProcessorTopic"
}

# Create the Lambda function
resource "aws_lambda_function" "resume_processor" {
  function_name = "ResumeProcessor"
  s3_bucket     = aws_s3_bucket.lambda_bucket.id
  s3_key        = "deployment_package.zip"
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.13"
  role          = aws_iam_role.lambda_role.arn
  timeout       = 30

  environment {
    variables = {
      GEMINI_API_KEY  = var.gemini_api_key
      SNS_TOPIC_ARN   = aws_sns_topic.resume_topic.arn
    }
  }
}

# Give S3 permission to invoke the Lambda function
resource "aws_lambda_permission" "allow_s3" {
  statement_id  = "AllowExecutionFromS3Bucket"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.resume_processor.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.lambda_bucket.arn
}

# Configure the S3 bucket to trigger the Lambda function on new object creation
resource "aws_s3_bucket_notification" "s3_to_lambda" {
  bucket = aws_s3_bucket.lambda_bucket.id
  lambda_function {
    lambda_function_arn = aws_lambda_function.resume_processor.arn
    events              = ["s3:ObjectCreated:*"]
  }
  depends_on = [aws_lambda_permission.allow_s3]
}

# Define variables that will be passed into Terraform from GitHub Actions
variable "gemini_api_key" {
  description = "The Gemini API key to use for the Lambda function."
  type        = string
  sensitive   = true
}

# The SNS Topic ARN is created by Terraform so no need for a variable
# variable "sns_topic_arn" {
#   description = "The ARN of the SNS topic for notifications."
#   type        = string
# }

# Output the S3 bucket name and SNS topic ARN
output "s3_bucket_name" {
  description = "The name of the S3 bucket where Lambda code is uploaded."
  value       = aws_s3_bucket.lambda_bucket.id
}

output "sns_topic_arn" {
  description = "The ARN of the created SNS topic."
  value       = aws_sns_topic.resume_topic.arn
}
