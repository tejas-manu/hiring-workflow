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
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
}



provider "aws" {
  region = var.aws_region
}

# ==============================================================================
# GENERAL & SHARED RESOURCES
# ==============================================================================


resource "random_id" "bucket_suffix" {
  byte_length = 8
}

data "archive_file" "dummy_lambda_package" {
  type        = "zip"
  output_path = "${path.module}/dummy_package.zip"
  source {
    content  = "exports.handler = (event, context, callback) => callback(null, 'hello world');"
    filename = "index.js"
  }
}

# ==============================================================================
# BACKEND PROCESSOR (Python Lambda + S3 Upload Bucket + SNS)
# ==============================================================================

# S3 Bucket for resume uploads (with CORS for CloudFront)

resource "aws_s3_bucket" "resume_bucket" {
  bucket = "${var.project_name}-uploads-${random_id.bucket_suffix.hex}"
  force_destroy = true
}

resource "aws_s3_bucket_cors_configuration" "resume_bucket_cors" {
  bucket = aws_s3_bucket.resume_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST", "GET"]
    allowed_origins = ["https://${aws_cloudfront_distribution.frontend_distribution.domain_name}"]
    expose_headers  = []
  }
}

# SNS Topic and subscriptions for notifications to reqruiters
resource "aws_sns_topic" "notifications" {
  name = "${var.project_name}-notifications"
}

resource "aws_sns_topic_subscription" "email_subscription" {
  topic_arn = aws_sns_topic.notifications.arn
  protocol  = "email"
  endpoint  = var.notification_email
}

# IAM Role and Policy for the Lambda function
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

# Lambda function to process uploaded resumes
resource "aws_lambda_function" "resume_processor_lambda" {
  function_name    = "${var.project_name}-function"
  role             = aws_iam_role.lambda_execution_role.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.13"
  timeout          = 180
  memory_size      = 256
  filename         = data.archive_file.dummy_lambda_package.output_path
  source_code_hash = data.archive_file.dummy_lambda_package.output_base64sha256
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

# ==============================================================================
# FRONTEND (S3 Website Bucket + CloudFront)
# ==============================================================================

# S3 Bucket for frontend hosting (with CloudFront OAC and no public access)
resource "aws_s3_bucket" "frontend_bucket" {
  bucket = "${var.project_name}-frontend-${random_id.bucket_suffix.hex}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "frontend_bucket_pab" {
  bucket = aws_s3_bucket.frontend_bucket.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Bucket Policy to allow CloudFront access to the S3 bucket
resource "aws_s3_bucket_policy" "frontend_bucket_policy" {
  bucket = aws_s3_bucket.frontend_bucket.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "cloudfront.amazonaws.com" },
      Action    = "s3:GetObject",
      Resource  = "${aws_s3_bucket.frontend_bucket.arn}/*",
      Condition = {
        StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.frontend_distribution.arn }
      }
    }]
  })
}

# CloudFront Distribution with Origin Access Control (OAC) for S3
resource "aws_cloudfront_origin_access_control" "frontend_oac" {
  name                              = "OAC-${aws_s3_bucket.frontend_bucket.id}"
  description                       = "OAC for frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "frontend_distribution" {
  enabled             = true
  default_root_object = "index.html"

  origin {
    domain_name              = aws_s3_bucket.frontend_bucket.bucket_regional_domain_name
    origin_id                = "S3-Frontend-${aws_s3_bucket.frontend_bucket.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend_oac.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "S3-Frontend-${aws_s3_bucket.frontend_bucket.id}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    forwarded_values {
      query_string = false
      headers      = ["Origin"]
      cookies {
        forward = "none"
      }
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}


# ==============================================================================
# API (API Gateway + Node.js Lambda for Pre-signed URLs)
# ==============================================================================

# IAM Role and Policy for the API Lambda function
resource "aws_iam_role" "api_lambda_role" {
  name = "${var.project_name}-api-role"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [{
      Action    = "sts:AssumeRole",
      Effect    = "Allow",
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_policy" "api_lambda_policy" {
  name   = "${var.project_name}-api-policy"
  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect   = "Allow",
        Action   = "s3:PutObject",
        Resource = "${aws_s3_bucket.resume_bucket.arn}/*"
      },
      {
        Effect   = "Allow",
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "api_lambda_policy_attach" {
  role       = aws_iam_role.api_lambda_role.name
  policy_arn = aws_iam_policy.api_lambda_policy.arn
}

# Lambda function to generate pre-signed URLs for S3 uploads
resource "aws_lambda_function" "api_lambda" {
  function_name    = "${var.project_name}-api"
  role             = aws_iam_role.api_lambda_role.arn
  handler          = "getPresignedUrl-handler.handler" 
  runtime          = "nodejs18.x"
  filename         = data.archive_file.dummy_lambda_package.output_path
  source_code_hash = data.archive_file.dummy_lambda_package.output_base64sha256
}

# API Gateway HTTP API integrated with the Lambda
resource "aws_apigatewayv2_api" "http_api" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = ["https://${aws_cloudfront_distribution.frontend_distribution.domain_name}"]
    allow_methods = ["GET", "OPTIONS"]
    allow_headers = ["*"]
  }
}

resource "aws_apigatewayv2_integration" "api_lambda_integration" {
  api_id           = aws_apigatewayv2_api.http_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.api_lambda.invoke_arn
}

resource "aws_apigatewayv2_route" "get_url_route" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /getPresignedUrl"
  target    = "integrations/${aws_apigatewayv2_integration.api_lambda_integration.id}"
}

resource "aws_apigatewayv2_stage" "default_stage" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "allow_api_gateway_invoke_api" {
  statement_id  = "AllowAPIGatewayInvokeAPI"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}
