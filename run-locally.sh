#!/bin/bash

# run-locally.sh - Simple local development script

echo "🚀 Starting Raseed AI with Vertex AI..."

# Set environment variables for Vertex AI (update these with your values)
export GCP_PROJECT_ID="dummy"  # Replace with your actual project ID
export GCP_LOCATION="us-central1"             # Optional: defaults to us-central1

export GOOGLE_APPLICATION_CREDENTIALS="sa.json"

# Check if GCP_PROJECT_ID is set
if [ -z "$GCP_PROJECT_ID" ] || [ "$GCP_PROJECT_ID" == "your-gcp-project-id" ]; then
    echo ""
    echo "!!!        Please update GCP_PROJECT_ID in this script        !!!"
    echo "!!!        and ensure GCP authentication is set up           !!!"
    echo "!!!        Run: gcloud auth application-default login        !!!"
    echo ""
fi

echo "📊 Backend: Flask + Vertex AI"
echo "💾 Database: SQLite (expenses.db)"

# Install dependencies
echo "🔧 Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "🏁 Starting Flask backend on http://127.0.0.1:5002"
echo ""

# Start the application
python app.py
