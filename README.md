# Raseed AI - Expense Parser & Analyst

A complete AI-powered expense parsing and analysis system with a Flask backend and React frontend. The system can parse natural language expense descriptions, automatically calculate shared expense splits, and provide AI-powered financial insights.

## Architecture

- **Backend**: Flask API with AI-powered expense parsing using Vertex AI (Gemini)
- **Frontend**: React application with modern UI components
- **Database**: SQLite for expense storage
- **AI Integration**: Google Vertex AI for natural language processing

## Features

- 🤖 **AI Expense Parsing**: Describe expenses in natural language
- 👥 **Smart Shared Expenses**: Automatically detects and calculates splits
- 📊 **Financial Analytics**: AI-powered insights about spending patterns
- 💬 **Chat Assistant**: Natural language queries about your expenses
- 📱 **Modern UI**: Clean, responsive interface

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- Google Cloud Platform account with Vertex AI enabled
- GCP authentication set up

### 1. GCP Setup

#### Enable Vertex AI API
```bash
gcloud services enable aiplatform.googleapis.com
```

#### Authenticate (Choose one method)
```bash
# Method 1: Application Default Credentials (Recommended for development)
gcloud auth application-default login

# Method 2: Service Account Key
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
```

### 2. Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Set your GCP configuration
export GCP_PROJECT_ID="your-gcp-project-id"
export GCP_LOCATION="us-central1"  # Optional, defaults to us-central1

# Start the Flask backend
python app.py
```

The backend will run on `http://127.0.0.1:5002`

### 3. Frontend Setup

```bash
# Install Node dependencies
npm install

# Start the React frontend
npm run dev
```

The frontend will run on `http://localhost:5173`

## API Integration

The frontend now uses all backend APIs:
- **Expense Parsing**: Natural language → Vertex AI processing → Structured data
- **Data Persistence**: All expenses stored in database
- **AI Insights**: Chat queries → Backend analysis → Personalized responses
- **Authentication**: Bearer token system (default: 'local-user')

## Usage Examples

### Adding Expenses
```
"Yesterday I went to Big Bazaar with Priya and Rohit. We bought groceries worth 2500 rupees including rice, dal, vegetables, and snacks. We split the bill equally."
```

## Development

Use the convenient development script:
```bash
./start-dev.sh
```

This will set up environment variables, install dependencies, and start the backend.
