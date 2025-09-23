output "lambda_function_name" {
  description = "The name of the Lambda function."
  value       = aws_lambda_function.resume_processor_lambda.function_name
}

output "s3_bucket_name" {
  description = "The name of the S3 bucket for resumes."
  value       = aws_s3_bucket.resume_bucket.bucket
}

output "sns_topic_arn" {
  description = "The ARN of the SNS topic for notifications."
  value       = aws_sns_topic.notifications.arn
}
