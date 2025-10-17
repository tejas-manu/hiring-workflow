# Start from AWS Lambda Python runtime base image
FROM public.ecr.aws/lambda/python:3.11

# Copy function code and requirements
COPY fetch_job_description.py ${LAMBDA_TASK_ROOT}
COPY requirements.txt  .

# Install dependencies
RUN pip install -r requirements.txt --target "${LAMBDA_TASK_ROOT}"

# Set the CMD to your Lambda handler
CMD [ "fetch_job_description.handler" ]