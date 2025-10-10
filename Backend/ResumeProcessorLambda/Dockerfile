FROM amazon/aws-lambda-python:3.13

# Install the zip utility
RUN microdnf install -y zip

# Copy the requirements file into the container
COPY requirements.txt ./

# Install the dependencies from the requirements.txt
RUN pip install -r requirements.txt --target "${LAMBDA_TASK_ROOT}"

# Copy your Lambda function code into the container
COPY lambda_function.py .