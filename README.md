## 📑 Resume Skills and Experience Extractor – Deployment Guide

This project demonstrates how to set up and deploy the **Resume Skills and Experience Extractor** using **AWS Lambda, Docker, S3, SNS, and Gemini AI**.

---

## 🚀 Prerequisites

- ✅ AWS account with IAM access
- ✅ Docker installed on your system
- ✅ Gemini AI API key

---

## 🛠️ Step 1: Clone the Repository

git clone <your-repo-url>
cd <repo-folder>

---

## 🛠️ Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd <repo-folder>
```

## 🛠️ Step 2: Build and Package Lambda with Docker

```bash

docker build --platform linux/amd64 -t lambda-packaging .
docker run --name lambda-temp -d lambda-packaging
docker cp lambda-temp:/var/task/. ./
docker rm -f lambda-temp
zip -r deployment_package.zip ./*

```

✅ This will create a deployment_package.zip file containing the Lambda package.

## 🛠️ Step 3: Deploy Lambda Function

Log in to AWS Console → Lambda

Create a new Lambda function from container image

Upload deployment_package.zip

Assign an IAM role with the following policies:

```
AmazonS3FullAccess
AmazonSNSFullAccess
AWSLambdaBasicExecutionRole
```

## 🛠️ Step 4: Configure Supporting AWS Services

#### 🔹 Amazon S3

- Create a bucket for uploading resumes

- Configure the Lambda function to trigger on ObjectCreated events

#### 🔹 Amazon SNS

- Create a new SNS Topic

- Copy the ARN

- Add your email as a subscriber (confirm via email)

#### 🔹 Gemini API

- Generate a Gemini API key

- Add it as an environment variable in Lambda

## 🛠️ Step 5: Configure Lambda Environment Variables

Inside your Lambda function settings, add:

```
GEMINI_API_KEY=your_gemini_api_key
SNS_ARN_NO=your_sns_topic_arn
```

## 🧪 Step 6: Test the Workflow

1. Upload a PDF resume into your S3 bucket

2. Lambda is triggered automatically

3. Gemini AI extracts skills and experiences

4. Results are published to SNS

5. You’ll receive an email notification once subscription is confirmed

## 📌 Notes

- Always confirm your SNS subscription email before testing end-to-end

- Rotate AWS credentials and Gemini API keys regularly

- For production, apply least-privilege IAM roles for security
