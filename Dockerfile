# Use official lightweight Python image
FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV BULBS_FILE=/data/bulbs.json

# Set working directory
WORKDIR /app

# Install system dependencies if any are needed (none required for pure python UDP)
# Copy requirements file first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY app/ app/

# Create data directory for volume mounting and config persistence
RUN mkdir -p /data

# Expose the API and web server port
EXPOSE 8000

# Run FastAPI app using Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
