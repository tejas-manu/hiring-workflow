# output "lambda_function_name" {
#   description = "The name of the Lambda function."
#   value       = aws_lambda_function.resume_processor_lambda.function_name
# }



# output "sns_topic_arn" {
#   description = "The ARN of the SNS topic for notifications."
#   value       = aws_sns_topic.notifications.arn
# }

# output "frontend_s3_bucket_name" {
#   description = "The name of the S3 bucket for the React frontend."
#   value       = aws_s3_bucket.frontend_bucket.id
# }

# output "cloudfront_distribution_id" {
#   description = "The ID of the CloudFront distribution for the frontend."
#   value       = aws_cloudfront_distribution.frontend_distribution.id
# }

# output "api_gateway_invoke_url" {
#   description = "The invocation URL for the API Gateway endpoint."
#   value       = aws_apigatewayv2_stage.default_stage.invoke_url
# }



# ==============================================================================
# OUTPUTS
# ==============================================================================

output "processor_lambda_name" {
  description = "The name of the resume processor Lambda function"
  value       = aws_lambda_function.resume_processor_lambda.function_name
}

output "api_lambda_name" {
  description = "The name of the API Lambda function for pre-signed URLs"
  value       = aws_lambda_function.api_lambda.function_name
}

output "sns_topic_arn" {
  description = "The ARN of the SNS topic for notifications"
  value       = aws_sns_topic.notifications.arn
}

output "frontend_bucket_name" {
  description = "The name of the S3 bucket for the frontend website files"
  value       = aws_s3_bucket.frontend_bucket.id
}

output "cloudfront_distribution_id" {
  description = "The ID of the CloudFront distribution for the frontend"
  value       = aws_cloudfront_distribution.frontend_distribution.id
}

output "api_gateway_endpoint" {
  description = "The invoke URL for the API Gateway"
  value       = aws_apigatewayv2_stage.default_stage.invoke_url
}

output "s3_bucket_name" {
  description = "The name of the S3 bucket for resumes."
  value       = aws_s3_bucket.resume_bucket.bucket
}