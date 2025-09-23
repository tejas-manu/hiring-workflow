variable "aws_region" {
  description = "The AWS region to deploy the resources in."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "A unique name for the project to prefix resources."
  type        = string
  default     = "resume-processor"
}

variable "notification_email" {
  description = "The email address to receive notifications from the SNS topic."
  type        = string
  # IMPORTANT: You must provide a valid email address for the SNS subscription.
  # You can set this in a terraform.tfvars file or as a secret in your CI/CD pipeline.
}