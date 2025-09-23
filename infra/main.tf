terraform {

  backend "s3" {
    bucket = "my-terraform-state-bucket-personal"
    key    = "resume-workflow/terraform.tfstate"
    region = "us-east-1"
        
  }
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.2"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Create a dummy zip file for the initial Lambda deployment.
# The actual code will be uploaded by the GitHub Actions workflow.
data "archive_file" "dummy_lambda_package" {
  type        = "zip"
  output_path = "${path.module}/dummy_package.zip"
  source {
    content  = "exports.handler = (event, context, callback) => callback(null, 'hello world');"
    filename = "index.js"
  }
}

resource "aws_iam_role" "lambda_execution_role" {
  name = "${var.project_name}-lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "lambda_permissions" {
  name        = "${var.project_name}-lambda-policy"
  description = "Permissions for the resume processor Lambda function"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Effect   = "Allow",
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Action   = "s3:GetObject",
        Effect   = "Allow",
        Resource = "${aws_s3_bucket.resume_bucket.arn}/*"
      },
      {
        Action   = "sns:Publish",
        Effect   = "Allow",
        Resource = aws_sns_topic.notifications.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy_attachment" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = aws_iam_policy.lambda_permissions.arn
}

resource "aws_iam_role_policy_attachment" "s3_read_only_attachment" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
}


resource "aws_s3_bucket" "resume_bucket" {
  bucket = "${var.project_name}-bucket-${random_id.bucket_suffix.hex}"
  force_destroy = true
}


# Add a random suffix to the bucket name to ensure it's globally unique.
resource "random_id" "bucket_suffix" {
  byte_length = 8
}

resource "aws_sns_topic" "notifications" {
  name = "${var.project_name}-notifications"
}

resource "aws_sns_topic_subscription" "email_subscription" {
  topic_arn = aws_sns_topic.notifications.arn
  protocol  = "email"
  endpoint  = var.notification_email
}

resource "aws_lambda_function" "resume_processor_lambda" {
  function_name    = "${var.project_name}-function"
  role             = aws_iam_role.lambda_execution_role.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.13"
  timeout          = 180
  memory_size      = 256

  # Use the dummy package for the initial creation.
  filename         = data.archive_file.dummy_lambda_package.output_path
  source_code_hash = data.archive_file.dummy_lambda_package.output_base64sha256

  environment {
    variables = {
      # These will be populated from GitHub Actions secrets
      GEMINI_API_KEY = "dummy_value"
      SNS_TOPIC_ARN  = aws_sns_topic.notifications.arn
    }
  }
}

# Permission for S3 to invoke the Lambda function
resource "aws_lambda_permission" "allow_s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.resume_processor_lambda.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.resume_bucket.arn
}

# Configure the S3 bucket to trigger the Lambda on file upload
resource "aws_s3_bucket_notification" "bucket_notification" {
  bucket = aws_s3_bucket.resume_bucket.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.resume_processor_lambda.arn
    events              = ["s3:ObjectCreated:*"]
  }

  depends_on = [aws_lambda_permission.allow_s3]
}

