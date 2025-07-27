# app.py - Complete AI Expense Parser & Analyst Application

import os
import json
import logging
import traceback
import time
from functools import wraps
from decimal import Decimal

# Flask and related imports
from flask import Flask, request, jsonify
from flask_cors import CORS

# Database imports
from database import init_db, get_db_session, Expense, Insight

# AI and utility imports - UPDATED FOR VERTEX AI
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from pydantic import BaseModel, ValidationError
from typing import List
from enum import Enum

# --- Expense Categories Enum ---

class ExpenseCategory(Enum):
    """
    Standard expense categories for better organization and insights.
    """
    FOOD_DINING = "Food & Dining"
    GROCERIES = "Groceries" 
    TRANSPORTATION = "Transportation"
    SHOPPING = "Shopping"
    ENTERTAINMENT = "Entertainment"
    UTILITIES = "Utilities"
    HEALTHCARE = "Healthcare"
    EDUCATION = "Education"
    TRAVEL = "Travel"
    MISCELLANEOUS = "Miscellaneous"
    
    @classmethod
    def get_all_categories(cls):
        """Return all category values as a list."""
        return [category.value for category in cls]
    
    @classmethod
    def from_string(cls, category_str: str):
        """Find category from string, case-insensitive."""
        for category in cls:
            if category.value.lower() == category_str.lower():
                return category
        return cls.MISCELLANEOUS  # Default fallback

# --- Application Setup ---

app = Flask(__name__)
CORS(app) # Allow all origins for local development

# Initialize the database (creates 'expenses.db' if it doesn't exist)
with app.app_context():
    init_db()

# --- Logging Configuration ---

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(funcName)s - %(message)s'
)
logger = logging.getLogger(__name__)

# --- Vertex AI Configuration ---

model = None
try:
    # Load GCP configuration from environment variables
    PROJECT_ID = os.environ.get("GCP_PROJECT_ID")
    LOCATION = os.environ.get("GCP_LOCATION", "us-central1")  # Default to us-central1
    
    if PROJECT_ID:
        # Initialize Vertex AI
        vertexai.init(project=PROJECT_ID, location=LOCATION)
        # Use Gemini model through Vertex AI
        model = GenerativeModel("gemini-2.5-pro")
        logger.info(f"Vertex AI configured successfully for project {PROJECT_ID} in {LOCATION}")
    else:
        logger.warning("GCP_PROJECT_ID environment variable not set. AI features will be disabled.")

except Exception as config_error:
    logger.error(f"Failed to configure Vertex AI: {config_error}")

# --- Data Models (Pydantic for validation) ---

class Split(BaseModel):
    participant: str
    amount: float

class LineItem(BaseModel):
    description: str
    amount: float
    category: str = ExpenseCategory.MISCELLANEOUS.value  # Default category
    allocation_text: str = ""  # Default to empty string if not provided
    splits: List[Split] = [] # The calculated splits will be added here

# --- Mock Authentication ---

def require_auth(f):
    """
    Decorator for MOCK authentication.
    For local testing, this just checks for any 'Authorization: Bearer <token>'
    header and uses the token as the user_id.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({
                'error': 'Missing or invalid Authorization header',
                'message': 'Please provide a Bearer token (e.g., "Bearer local-user")'
            }), 401
        user_id = auth_header.split('Bearer ')[1]
        if not user_id:
             return jsonify({'error': 'Bearer token cannot be empty'}), 401
        request.user_id = user_id
        return f(*args, **kwargs)
    return decorated_function

# --- Vertex AI Call with Retry Logic ---

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    retry=retry_if_exception_type(Exception)
)
def call_vertex_ai_with_retry(prompt: str, system_instruction: str, is_json_output: bool = True) -> str:
    """Makes a call to the Vertex AI Gemini API with robust retry logic."""
    if not model:
        raise Exception("Vertex AI model not configured - check GCP_PROJECT_ID")
    
    full_prompt = f"System: {system_instruction}\n\nUser: {prompt}"
    
    # Configure the generation settings
    generation_config = GenerationConfig(
        temperature=0.1,  # Keep low for factual analysis and financial calculations
        max_output_tokens=2048,
    )
    
    # Set response format if JSON is expected
    if is_json_output:
        generation_config.response_mime_type = "application/json"

    response = model.generate_content(
        full_prompt, 
        generation_config=generation_config
    )
    
    text_response = response.text.strip()
    # Clean up the response if it's expected to be JSON
    if is_json_output:
        return text_response.lstrip("```json").rstrip("```")
    return text_response

# --- AI Tooling Functions ---

def detect_detailed_itemized_expense(text: str) -> bool:
    """
    Use AI to detect if this expense contains detailed itemized information
    that should be broken down into individual line items.
    """
    prompt = f"""Analyze this expense text: "{text}"

Is this a detailed itemized expense that lists multiple specific items with individual prices?

Examples of detailed itemized expenses:
- "Bought rice ₹450, flour ₹120, dal ₹180..."
- "Restaurant: pizza $15, drinks $8, dessert $5..."
- "Shopping: shirt $25, shoes $60, socks $10..."

Answer: YES or NO"""

    system_instruction = "You are an expense analyzer. Determine if the expense contains multiple specific items with individual prices that should be broken down separately. Answer only YES or NO."

    try:
        response = call_vertex_ai_with_retry(prompt, system_instruction, is_json_output=False)
        return response.strip().upper() == 'YES'
    except Exception as e:
        logger.error(f"Error detecting itemized expense: {e}")
        return False

def extract_individual_items(text: str) -> List[dict]:
    """
    Use AI to extract individual items with prices and categories from detailed expense text.
    """
    categories_list = ExpenseCategory.get_all_categories()
    categories_text = ", ".join(categories_list)
    
    prompt = f"""Extract all individual items with their prices and categories from this expense text: "{text}"

List each item separately with its price and category. Be specific and include quantities where mentioned.

Available categories: {categories_text}

Return as JSON array of items:"""

    system_instruction = f"""Extract individual items, prices, and categories from the expense text. Return a JSON array:
[
    {{
        "description": "5kg basmati rice",
        "amount": 450.0,
        "category": "Groceries"
    }},
    {{
        "description": "2kg whole wheat flour", 
        "amount": 120.0,
        "category": "Groceries"
    }}
]

Available categories:
{categories_text}

CATEGORIZATION RULES:
- Food & Dining: Restaurant meals, takeout, cafes, food delivery
- Groceries: Supermarket items, raw ingredients, household food items
- Transportation: Fuel, public transport, taxi, car maintenance
- Shopping: Clothing, electronics, personal items, non-food retail
- Entertainment: Movies, games, sports, subscriptions, hobbies
- Utilities: Electricity, water, internet, phone bills, rent
- Healthcare: Medicine, doctor visits, medical supplies
- Education: Books, courses, school fees, learning materials
- Travel: Hotels, flights, vacation expenses, tourism
- Miscellaneous: Items that don't fit other categories

Rules:
- Include quantities and details in description
- Convert prices to numbers (remove currency symbols)
- Each item should be separate
- Be precise with item names
- Choose the most appropriate category for each item
- If unsure about category, use Miscellaneous"""

    try:
        response = call_vertex_ai_with_retry(prompt, system_instruction, is_json_output=True)
        items = json.loads(response)
        
        # Validate the items
        validated_items = []
        for item in items:
            if isinstance(item, dict) and 'description' in item and 'amount' in item:
                # Validate and set category
                category = item.get('category', ExpenseCategory.MISCELLANEOUS.value)
                validated_category = ExpenseCategory.from_string(category).value
                
                validated_items.append({
                    'description': str(item['description']),
                    'amount': float(item['amount']),
                    'category': validated_category
                })
        
        logger.info(f"Extracted {len(validated_items)} items with categories")
        return validated_items
    except Exception as e:
        logger.error(f"Error extracting individual items: {e}")
        return []

def determine_splits_for_items(text: str, items: List[dict]) -> dict:
    """
    Use AI to determine how each item should be split among participants.
    """
    items_text = "\n".join([f"- {item['description']}: ₹{item['amount']}" for item in items])
    
    prompt = f"""Original expense text: "{text}"

Items found:
{items_text}

CONTEXT ANALYSIS - WHY are other people mentioned? Analyze step by step:

1. IDENTIFY ALL PEOPLE mentioned in the text:
   - The person entering expense = "me"
   - Any other names or relationships mentioned

2. DETERMINE THE FINANCIAL RELATIONSHIP - Why are others mentioned?

   SCENARIO A - PERSONAL EXPENSE (I pay for everything):
   - "I bought coffee for John" → I'm treating/gifting John
   - "Bought lunch for my team" → I'm paying for everyone  
   - "Got groceries for roommate" → I'm covering roommate's groceries
   - "Dinner for me and Sarah" → I'm paying for both of us
   
   SCENARIO B - SHARED EXPENSE (We split costs):
   - "Split dinner with John" → We each pay our portion
   - "Groceries, John owes me half" → Cost sharing arrangement
   - "Restaurant bill, we split equally" → Dividing the cost
   - "Shared Uber with Sarah" → Both contributing to cost

   SCENARIO C - CONTEXT ONLY (Others mentioned but not financially involved):
   - "Dinner with friends at restaurant" → Context, but need to check if splitting
   - "Shopping with mom" → Could be either scenario A or B

3. KEY INDICATORS:
   - Personal: "for", "treating", "bought X for Y", "paid for everyone"
   - Shared: "split", "divide", "owes me", "each pays", "we share"
   - Ambiguous: "with", "and" → Need more context analysis

4. FINAL DECISION:
   - If I'm paying FOR others → PERSONAL (only "me" pays)
   - If we're splitting/sharing costs → SHARED (multiple people pay)
   - If unclear → Default to PERSONAL unless clear sharing intent"""

    system_instruction = """Analyze the expense context to determine if it's personal or shared. Return JSON:

{
    "participants": ["me"],
    "clean_participants": [],
    "is_shared": false,
    "expense_type": "personal",
    "splitting_method": "personal",
    "split_ratio": {"me": 1.0},
    "context_analysis": "Detailed explanation of why this classification was chosen",
    "people_mentioned": ["list of all people mentioned"],
    "financial_relationship": "personal_expense" or "shared_expense" or "context_only"
}

CLASSIFICATION RULES:

PERSONAL EXPENSE (is_shared = false):
- I'm paying FOR other people (treating, gifting, covering)
- Others mentioned for context but don't contribute financially
- Examples: "bought coffee for John", "team lunch on me", "groceries for roommate"
- Result: Only "me" in participants, I pay 100%

SHARED EXPENSE (is_shared = true):  
- Multiple people will actually pay/contribute their portions
- Clear cost-sharing arrangement mentioned
- Examples: "split with John", "John owes me half", "we each pay"
- Result: Multiple people in participants with split ratios

CRITICAL: Don't assume sharing just because people are mentioned. Analyze the financial intent!

financial_relationship options:
- "personal_expense": I pay for others
- "shared_expense": We split costs  
- "context_only": People mentioned but no financial involvement"""

    try:
        response = call_vertex_ai_with_retry(prompt, system_instruction, is_json_output=True)
        splitting_info = json.loads(response)
        
        # Validation based on financial relationship analysis
        financial_relationship = splitting_info.get('financial_relationship', 'personal_expense')
        participants = splitting_info.get('participants', ['me'])
        
        logger.info(f"AI analysis - Financial relationship: {financial_relationship}")
        logger.info(f"AI analysis - People mentioned: {splitting_info.get('people_mentioned', [])}")
        logger.info(f"AI analysis - Context: {splitting_info.get('context_analysis', 'N/A')}")
        
        # Force consistency based on financial relationship
        if financial_relationship == 'personal_expense' or financial_relationship == 'context_only':
            # Personal expense - only "me" pays regardless of people mentioned
            splitting_info.update({
                'participants': ['me'],
                'clean_participants': [],
                'is_shared': False,
                'expense_type': 'personal',
                'splitting_method': 'personal',
                'split_ratio': {'me': 1.0}
            })
            logger.info("Classified as PERSONAL: I pay for everything")
            
        elif financial_relationship == 'shared_expense':
            # Shared expense - multiple people contribute
            if len(participants) == 1:
                # AI said shared but only listed "me" - try to extract other participants
                people_mentioned = splitting_info.get('people_mentioned', [])
                other_people = [p for p in people_mentioned if p.lower() not in ['me', 'myself', 'i']]
                
                if other_people:
                    participants = ['me'] + other_people[:2]  # Limit to avoid too many participants
                    splitting_info['participants'] = participants
                    logger.info(f"Added participants from people_mentioned: {participants}")
                else:
                    # Fallback to personal if no other people found
                    logger.warning("Shared expense but no other participants found - defaulting to personal")
                    splitting_info.update({
                        'participants': ['me'],
                        'clean_participants': [],
                        'is_shared': False,
                        'expense_type': 'personal',
                        'splitting_method': 'personal',
                        'split_ratio': {'me': 1.0}
                    })
                    return splitting_info
            
            # Update for shared expense
            clean_participants = [p for p in participants if p != 'me']
            splitting_info.update({
                'clean_participants': clean_participants,
                'is_shared': True,
                'expense_type': 'shared'
            })
            
            # Set equal split ratios for shared expenses
            if splitting_info.get('splitting_method') == 'equal_split' or not splitting_info.get('split_ratio'):
                equal_ratio = 1.0 / len(participants)
                split_ratio = {p: equal_ratio for p in participants}
                splitting_info['split_ratio'] = split_ratio
                splitting_info['splitting_method'] = 'equal_split'
                logger.info(f"Set equal split ratios for shared expense: {split_ratio}")
        
        # Final validation of split_ratio
        if 'split_ratio' in splitting_info:
            split_ratio = splitting_info['split_ratio']
            participants = splitting_info.get('participants', ['me'])
            
            # Ensure all participants have a ratio
            for participant in participants:
                if participant not in split_ratio:
                    split_ratio[participant] = 1.0 / len(participants)
            
            # Normalize ratios to sum to 1.0
            total_ratio = sum(split_ratio.values())
            if total_ratio > 0:
                for participant in split_ratio:
                    split_ratio[participant] = split_ratio[participant] / total_ratio
            
            splitting_info['split_ratio'] = split_ratio
        
        logger.info(f"Final classification: {splitting_info.get('expense_type')} expense with participants: {splitting_info.get('participants')}")
        return splitting_info
        
    except Exception as e:
        logger.error(f"Error determining splits: {e}")
        
        # Intelligent fallback - analyze text patterns
        text_lower = text.lower()
        
        # Strong indicators for personal expense (paying FOR others)
        personal_indicators = ['for ', ' for', 'bought for', 'treating', 'paid for', 'lunch for', 'dinner for', 'coffee for']
        
        # Strong indicators for shared expense (splitting WITH others)  
        shared_indicators = ['split with', 'divide with', 'owes me', 'each pay', 'we split', 'share with', 'between us']
        
        # Check for strong personal indicators first
        if any(indicator in text_lower for indicator in personal_indicators):
            logger.warning("Fallback: detected 'paying FOR others' pattern - personal expense")
            return {
                "participants": ["me"],
                "clean_participants": [],
                "is_shared": False,
                "expense_type": "personal",
                "splitting_method": "personal",
                "split_ratio": {"me": 1.0},
                "context_analysis": "Fallback: detected pattern indicating paying for others"
            }
        
        # Check for shared indicators
        elif any(indicator in text_lower for indicator in shared_indicators):
            logger.warning("Fallback: detected sharing pattern - shared expense")
            return {
                "participants": ["me", "other"],
                "clean_participants": ["other"],
                "is_shared": True,
                "expense_type": "shared",
                "splitting_method": "equal_split",
                "split_ratio": {"me": 0.5, "other": 0.5},
                "context_analysis": "Fallback: detected cost sharing pattern"
            }
        
        # Default to personal
        else:
            logger.warning("Fallback: no clear pattern - defaulting to personal expense")
            return {
                "participants": ["me"],
                "clean_participants": [],
                "is_shared": False,
                "expense_type": "personal",
                "splitting_method": "personal",
                "split_ratio": {"me": 1.0},
                "context_analysis": "Fallback: default to personal expense"
            }

def apply_splits_to_item(item: dict, splitting_info: dict) -> List[dict]:
    """
    Apply the splitting strategy to create splits for a single item.
    """
    item_amount = item['amount']
    splits = []
    
    split_ratio = splitting_info.get('split_ratio', {})
    participants = splitting_info.get('participants', ['me'])
    
    logger.info(f"Applying splits to '{item['description']}' (₹{item_amount}) with ratio: {split_ratio}")
    
    for participant in participants:
        ratio = split_ratio.get(participant, 0)
        if ratio > 0:
            split_amount = round(item_amount * ratio, 2)
            splits.append({
                'participant': participant,
                'amount': split_amount
            })
            logger.info(f"  {participant}: ₹{split_amount} ({ratio*100:.1f}%)")
    
    # Ensure splits sum to item amount (handle rounding errors)
    total_splits = sum(split['amount'] for split in splits)
    if abs(total_splits - item_amount) > 0.01 and splits:
        # Adjust the first split to match exact total
        adjustment = item_amount - total_splits
        splits[0]['amount'] = round(splits[0]['amount'] + adjustment, 2)
        logger.info(f"  Adjusted {splits[0]['participant']} by ₹{adjustment:.2f} for rounding")
    
    return splits

def tool_intelligent_expense_parser(text: str) -> dict:
    """
    Advanced multi-stage AI-powered expense parser that intelligently handles
    detailed itemized expenses by breaking them down into individual items.
    """
    logger.info("Starting intelligent expense parsing...")
    
    # Stage 1: Detect if this is a detailed itemized expense
    is_detailed = detect_detailed_itemized_expense(text)
    logger.info(f"Detailed itemized expense detected: {is_detailed}")
    
    if is_detailed:
        # Stage 2: Extract individual items
        individual_items = extract_individual_items(text)
        logger.info(f"Extracted {len(individual_items)} individual items")
        
        if individual_items:
            # Stage 3: Determine splitting strategy
            splitting_info = determine_splits_for_items(text, individual_items)
            logger.info(f"Splitting strategy: {splitting_info.get('splitting_method')}")
            
            # Stage 4: Create line items with splits
            line_items = []
            total_amount = 0
            
            for item in individual_items:
                item_amount = item['amount']
                total_amount += item_amount
                
                # Apply splits to the item
                splits = apply_splits_to_item(item, splitting_info)
                
                line_items.append({
                    'description': item['description'],
                    'amount': item_amount,
                    'category': item.get('category', ExpenseCategory.MISCELLANEOUS.value),
                    'allocation_text': splitting_info.get('splitting_explanation', 'Personal expense'),
                    'splits': splits
                })
            
            return {
                'participants': splitting_info.get('participants', ['me']),
                'clean_participants': splitting_info.get('clean_participants', []),
                'is_shared': splitting_info.get('is_shared', False),
                'expense_type': splitting_info.get('expense_type', 'personal'),
                'expense_date': None,  # Could add date extraction if needed
                'line_items': line_items,
                'total_amount': round(total_amount, 2)
            }
    
    # Fallback: Use simple parsing for non-detailed expenses
    logger.info("Using simple parsing approach")
    
    # First, determine splitting strategy using the same robust logic
    splitting_info = determine_splits_for_items(text, [])
    logger.info(f"Simple parsing - splitting strategy: {splitting_info.get('splitting_method')}")
    
    prompt = f"""Parse this expense into line items: "{text}"

Based on the expense description, extract:
1. Individual items or services with their amounts
2. If no specific items mentioned, create one general line item

Return the items found:"""

    system_instruction = """Extract line items from the expense. Return JSON:
{
    "line_items": [
        {
            "description": "item or service description",
            "amount": 0.0
        }
    ],
    "total_amount": 0.0,
    "expense_date": null
}

Rules:
- If specific items with prices mentioned, list them separately
- If general expense (like "dinner $50"), create one item
- Amounts should be numbers without currency symbols
- total_amount should sum all line items"""

    try:
        response = call_vertex_ai_with_retry(prompt, system_instruction)
        
        if not response or not response.strip():
            logger.error("Empty response from AI")
            raise Exception("Empty response from AI")
        
        logger.info(f"Attempting to parse JSON response of length: {len(response)}")
        
        # Try to parse JSON
        try:
            parsed_result = json.loads(response)
            logger.info("Successfully parsed JSON response")
            
            # Apply splitting to each line item
            line_items = []
            for item_data in parsed_result.get('line_items', []):
                splits = apply_splits_to_item(item_data, splitting_info)
                
                # Determine category for the item
                description = item_data.get('description', 'Unknown expense')
                category = categorize_line_item(description)
                
                line_items.append({
                    'description': description,
                    'amount': item_data.get('amount', 0),
                    'category': category,
                    'allocation_text': splitting_info.get('splitting_explanation', 'Personal expense'),
                    'splits': splits
                })
            
            # Build final result
            result = {
                'participants': splitting_info.get('participants', ['me']),
                'clean_participants': splitting_info.get('clean_participants', []),
                'is_shared': splitting_info.get('is_shared', False),
                'expense_type': splitting_info.get('expense_type', 'personal'),
                'expense_date': parsed_result.get('expense_date'),
                'line_items': line_items,
                'total_amount': parsed_result.get('total_amount', 0)
            }
            
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing failed: {e}")
            logger.error(f"Response content: {response[:500]}")
            
            # Try to extract JSON from response if it's wrapped in other text
            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                logger.info("Found JSON pattern in response, attempting to parse...")
                try:
                    parsed_result = json.loads(json_str)
                    logger.info("Successfully parsed extracted JSON")
                    
                    # Apply same logic as above
                    line_items = []
                    for item_data in parsed_result.get('line_items', []):
                        splits = apply_splits_to_item(item_data, splitting_info)
                        
                        # Determine category for the item
                        description = item_data.get('description', 'Unknown expense')
                        category = categorize_line_item(description)
                        
                        line_items.append({
                            'description': description,
                            'amount': item_data.get('amount', 0),
                            'category': category,
                            'allocation_text': splitting_info.get('splitting_explanation', 'Personal expense'),
                            'splits': splits
                        })
                    
                    result = {
                        'participants': splitting_info.get('participants', ['me']),
                        'clean_participants': splitting_info.get('clean_participants', []),
                        'is_shared': splitting_info.get('is_shared', False),
                        'expense_type': splitting_info.get('expense_type', 'personal'),
                        'expense_date': parsed_result.get('expense_date'),
                        'line_items': line_items,
                        'total_amount': parsed_result.get('total_amount', 0)
                    }
                    
                    return result
                except json.JSONDecodeError as e2:
                    logger.error(f"Extracted JSON also failed to parse: {e2}")
            
            # Fallback response with proper splitting
            logger.warning("Returning fallback parsing result due to JSON error")
            fallback_item = {
                'description': text[:100] + ("..." if len(text) > 100 else ""),
                'amount': 0.0
            }
            splits = apply_splits_to_item(fallback_item, splitting_info)
            
            return {
                'participants': splitting_info.get('participants', ['me']),
                'clean_participants': splitting_info.get('clean_participants', []),
                'is_shared': splitting_info.get('is_shared', False),
                'expense_type': splitting_info.get('expense_type', 'personal'),
                'expense_date': None,
                'line_items': [{
                    'description': fallback_item['description'],
                    'amount': fallback_item['amount'],
                    'category': ExpenseCategory.MISCELLANEOUS.value,
                    'allocation_text': splitting_info.get('splitting_explanation', 'Fallback expense'),
                    'splits': splits
                }],
                'total_amount': 0.0
            }
    
    except Exception as e:
        logger.error(f"Error in tool_intelligent_expense_parser: {e}")
        # Create fallback with proper splitting
        splitting_info = determine_splits_for_items(text, [])
        fallback_item = {
            'description': text[:100] + ("..." if len(text) > 100 else ""),
            'amount': 0.0
        }
        splits = apply_splits_to_item(fallback_item, splitting_info)
        
        return {
            'participants': splitting_info.get('participants', ['me']),
            'clean_participants': splitting_info.get('clean_participants', []),
            'is_shared': splitting_info.get('is_shared', False),
            'expense_type': splitting_info.get('expense_type', 'personal'),
            'expense_date': None,
            'line_items': [{
                'description': fallback_item['description'],
                'amount': fallback_item['amount'],
                'allocation_text': splitting_info.get('splitting_explanation', 'Error fallback'),
                'splits': splits
            }],
            'total_amount': 0.0
        }

def create_fallback_expense_result(text: str, error_msg: str) -> dict:
    """Create a fallback expense result when AI parsing fails."""
    return {
        "participants": ["me"],
        "clean_participants": [],
        "is_shared": False,
        "expense_type": "personal",
        "expense_date": None,
        "line_items": [
            {
                "description": text[:100] + ("..." if len(text) > 100 else ""),
                "amount": 0.0,
                "category": ExpenseCategory.MISCELLANEOUS.value,
                "allocation_text": "Personal expense (fallback)",
                "splits": [
                    {
                        "participant": "me",
                        "amount": 0.0
                    }
                ]
            }
        ],
        "total_amount": 0.0
    }

def summarize_expenses_for_analysis(expenses: List[dict], limit: int = 20) -> dict:
    """Summarize expenses data to reduce token usage for insights."""
    if not expenses:
        return {"summary": "No expenses", "sample_expenses": []}
    
    # Take only recent expenses to limit token usage
    recent_expenses = expenses[:limit]
    
    # Create summary statistics
    total_amount = sum(exp.get('total_amount', 0) for exp in recent_expenses)
    personal_count = len([exp for exp in recent_expenses if exp.get('expense_type') == 'personal'])
    shared_count = len(recent_expenses) - personal_count
    
    # Extract categories and amounts
    categories = {}
    for exp in recent_expenses:
        for item in exp.get('line_items', []):
            category = categorize_line_item(item.get('description', ''))
            categories[category] = categories.get(category, 0) + item.get('amount', 0)
    
    # Get sample expenses for context
    sample_expenses = []
    for exp in recent_expenses[:5]:  # Only first 5 for context
        sample_expenses.append({
            'type': exp.get('expense_type'),
            'amount': exp.get('total_amount'),
            'items': [item.get('description') for item in exp.get('line_items', [])][:2]  # Max 2 items
        })
    
    return {
        "summary": f"Total: ${total_amount:.2f}, Personal: {personal_count}, Shared: {shared_count}",
        "categories": categories,
        "sample_expenses": sample_expenses,
        "total_expenses_analyzed": len(recent_expenses)
    }

def tool_analyze_expenses_for_insights(query: str, user_expenses: List[dict]) -> str:
    """Optimized insights analysis with reduced token usage."""
    logger.info(f"Calling tool_analyze_expenses_for_insights for query: '{query}'")
    
    if not user_expenses:
        return "You don't have any expense data yet. Please add some expenses first."
    
    # Check if this is a complex query that should be split
    if should_split_insight_query(query):
        return handle_complex_insight_query(query, user_expenses)
    
    # Regular single-call analysis
    expense_summary = summarize_expenses_for_analysis(user_expenses, limit=30)
    
    prompt = f"""Question: "{query}"

Expense Summary: {expense_summary['summary']}
Categories: {json.dumps(expense_summary['categories'], indent=1)}
Recent samples: {json.dumps(expense_summary['sample_expenses'], indent=1)}
Total analyzed: {expense_summary['total_expenses_analyzed']} expenses

IMPORTANT: All monetary amounts must be in Indian Rupees (INR) using the ₹ symbol. Never use $ or USD.

Provide insights based on this data."""

    system_instruction = "You are a financial analyst. Answer the user's question based on the provided expense summary. Be concise and data-driven. CRITICAL: All monetary amounts must be displayed in Indian Rupees (INR) using the ₹ symbol only. Never use dollars ($) or USD. Always format money as ₹1,234.56 format."
    
    # Insights are text-based, not JSON
    response = call_vertex_ai_with_retry(prompt, system_instruction, is_json_output=False)
    return response

def should_split_insight_query(query: str) -> bool:
    """Determine if a query should be split into multiple calls."""
    # Keywords that indicate complex multi-part queries
    complex_keywords = [
        'compare', 'versus', 'vs', 'trend', 'over time', 
        'month by month', 'category breakdown', 'detailed analysis',
        'both', 'and also', 'as well as'
    ]
    
    query_lower = query.lower()
    return any(keyword in query_lower for keyword in complex_keywords) and len(query.split()) > 10

def handle_complex_insight_query(query: str, user_expenses: List[dict]) -> str:
    """Handle complex queries by splitting into multiple focused calls."""
    logger.info("Handling complex query with multiple AI calls")
    
    # Split query into focused sub-queries
    sub_queries = split_query_into_parts(query)
    
    results = []
    for i, sub_query in enumerate(sub_queries, 1):
        logger.info(f"Processing sub-query {i}/{len(sub_queries)}: {sub_query}")
        
        # Use smaller data sets for each sub-query
        expense_summary = summarize_expenses_for_analysis(user_expenses, limit=15)
        
        prompt = f"""Focus on: "{sub_query}"

Data: {expense_summary['summary']}
Categories: {json.dumps(expense_summary['categories'], indent=1)}

Brief answer (2-3 sentences):"""

        system_instruction = "Provide a brief, focused answer. Be concise."
        
        try:
            response = call_vertex_ai_with_retry(prompt, system_instruction, is_json_output=False)
            results.append(f"**{sub_query}**\n{response}")
        except Exception as e:
            logger.error(f"Error in sub-query {i}: {e}")
            results.append(f"**{sub_query}**\nUnable to analyze this aspect.")
    
    # Combine results
    final_response = "\n\n".join(results)
    
    # Add summary if multiple parts
    if len(results) > 1:
        final_response += f"\n\n**Summary:** Based on your {len(expense_summary.get('total_expenses_analyzed', 0))} recent expenses."
    
    return final_response

def split_query_into_parts(query: str) -> List[str]:
    """Split a complex query into focused sub-queries."""
    # Simple splitting logic - can be enhanced
    if 'compare' in query.lower() or 'vs' in query.lower():
        # Handle comparison queries
        if 'and' in query:
            parts = query.split(' and ')
            return [part.strip() for part in parts if len(part.strip()) > 5]
    
    if 'trend' in query.lower() or 'over time' in query.lower():
        # Handle trend queries
        return [
            "What are my spending trends?",
            "How has my spending changed recently?"
        ]
    
    if len(query.split()) > 15:
        # Split long queries into smaller parts
        sentences = query.split('.')
        return [sentence.strip() + '?' for sentence in sentences if len(sentence.strip()) > 10]
    
    # Default: return original query
    return [query]

# --- Main Orchestrator for Parsing ---

def calculate_user_allocations(line_items: List[dict]) -> dict:
    """
    Calculate total allocation for each user across all line items.
    This is a core feature for expense splitting.
    """
    user_totals = {}
    
    for item in line_items:
        splits = item.get('splits', [])
        for split in splits:
            participant = split.get('participant', '')
            amount = split.get('amount', 0)
            
            if participant in user_totals:
                user_totals[participant] += amount
            else:
                user_totals[participant] = amount
    
    # Round to 2 decimal places
    for participant in user_totals:
        user_totals[participant] = round(user_totals[participant], 2)
    
    return user_totals

def calculate_user_allocation_breakdown(line_items: List[dict]) -> dict:
    """
    Calculate item-level allocation breakdown grouped by user.
    Shows exactly which items each person is paying for and how much.
    """
    user_breakdown = {}
    
    for item in line_items:
        item_description = item.get('description', 'Unknown Item')
        splits = item.get('splits', [])
        
        for split in splits:
            participant = split.get('participant', '')
            amount = split.get('amount', 0)
            
            if amount > 0:  # Only include if user actually pays something
                if participant not in user_breakdown:
                    user_breakdown[participant] = []
                
                user_breakdown[participant].append({
                    'item': item_description,
                    'amount': round(amount, 2),
                    'item_total': item.get('amount', 0)
                })
    
    return user_breakdown

def run_expense_agent(text: str) -> dict:
    """
    Advanced AI-powered expense parsing orchestrator.
    Uses intelligent step-by-step reasoning to handle dynamic natural language input.
    """
    logger.info("Starting intelligent expense agent orchestration")
    start_time = time.time()
    try:
        # Use the new intelligent parser for complete expense analysis
        parsed_result = tool_intelligent_expense_parser(text)
        
        # Validate and ensure required fields
        participants = parsed_result.get('participants', ['me'])
        clean_participants = parsed_result.get('clean_participants', [])
        is_shared = parsed_result.get('is_shared', False)
        expense_type = parsed_result.get('expense_type', 'personal')
        expense_date = parsed_result.get('expense_date')
        line_items_data = parsed_result.get('line_items', [])
        total_amount = parsed_result.get('total_amount', 0)
        
        # Convert line items to Pydantic models for validation
        processed_line_items = []
        calculated_total = 0
        
        for item_data in line_items_data:
            # Ensure required fields
            if not item_data.get('allocation_text'):
                item_data['allocation_text'] = item_data.get('description', 'Personal expense')
            
            # Validate splits
            splits = item_data.get('splits', [])
            if not splits:
                # Fallback: create a split for "me" with full amount
                splits = [{'participant': 'me', 'amount': item_data.get('amount', 0)}]
                item_data['splits'] = splits
            
            # Ensure splits sum to item amount
            split_total = sum(split.get('amount', 0) for split in splits)
            item_amount = item_data.get('amount', 0)
            if abs(split_total - item_amount) > 0.01:  # Allow small rounding differences
                logger.warning(f"Split total {split_total} doesn't match item amount {item_amount}, adjusting...")
                # Adjust the first split to make totals match
                if splits:
                    adjustment = item_amount - split_total
                    splits[0]['amount'] = splits[0].get('amount', 0) + adjustment
                    item_data['splits'] = splits
            
            item_with_splits = LineItem(**item_data)
            processed_line_items.append(item_with_splits)
            calculated_total += item_data.get('amount', 0)
        
        # Use calculated total if provided total seems incorrect
        if abs(calculated_total - total_amount) > 0.01:
            total_amount = calculated_total
            logger.info(f"Adjusted total amount to calculated value: {total_amount}")
        
        # Calculate grouped user allocations - CORE FEATURE
        line_items_dict = [item.model_dump() for item in processed_line_items]
        user_allocations = calculate_user_allocations(line_items_dict)
        user_allocation_breakdown = calculate_user_allocation_breakdown(line_items_dict)
        
        # Log the user allocations for debugging
        logger.info(f"User allocations calculated: {user_allocations}")
        logger.info(f"User allocation breakdown: {user_allocation_breakdown}")
        
        processing_time = round(time.time() - start_time, 2)
        
        # Final result with validation and user allocations
        result = {
            "error": False,
            "participants": participants,
            "clean_participants": clean_participants, 
            "is_shared": is_shared,
            "expense_type": expense_type,
            "expense_date": expense_date,
            "line_items": line_items_dict,
            "user_allocations": user_allocations,  # Total per user
            "user_allocation_breakdown": user_allocation_breakdown,  # NEW: Item-level breakdown
            "total_amount": round(total_amount, 2),
            "processing_time": processing_time,
            "status": "success"
        }
        
        # Include AI reasoning in debug mode
        if logger.level == logging.DEBUG and 'reasoning' in parsed_result:
            result['ai_reasoning'] = parsed_result['reasoning']
        
        return result
        
    except Exception as e:
        logger.error(f"Critical error in run_expense_agent: {e}\nTraceback: {traceback.format_exc()}")
        return {'error': True, 'message': f"An unexpected critical error occurred: {e}"}

# --- Flask API Endpoints ---

@app.route("/health", methods=["GET"])
def health_check():
    """Simple endpoint to check if the server is running."""
    return jsonify({'status': 'healthy'}), 200

@app.route("/health-check", methods=["GET"])  
def health_check_alt():
    """Alternative health check endpoint."""
    return jsonify({'status': 'healthy'}), 200

@app.route("/parse-expense", methods=["POST"])
@require_auth
def parse_expense():
    """Parses a natural language expense, calculates allocations, and stores it."""
    if not model: return jsonify({'error': 'Service configuration error'}), 503
    
    data = request.get_json()
    expense_text = data.get('text')
    user_id = request.user_id

    if not expense_text or not expense_text.strip(): return jsonify({'error': 'Empty text'}), 400
    
    result = run_expense_agent(expense_text)
    
    if result.get('error'): return jsonify({'error': 'AI Processing Failed', 'message': result.get('message')}), 500
    
    # Parse the expense date if provided
    expense_date = None
    if result.get('expense_date'):
        try:
            from datetime import datetime
            expense_date = datetime.fromisoformat(result['expense_date'])
        except (ValueError, TypeError):
            logger.warning(f"Invalid date format: {result.get('expense_date')}, using current date")
    
    db_session = get_db_session()
    new_expense = Expense(
        user_id=user_id, 
        original_text=expense_text, 
        parsed_data=json.dumps(result), 
        status='completed',
        expense_date=expense_date  # Use parsed date or None (defaults to created_at)
    )
    db_session.add(new_expense)
    db_session.commit()
    
    document_id = new_expense.id
    del result['error'] # Remove internal flag before returning to user
    
    return jsonify({'message': 'Expense parsed and stored successfully', 'document_id': document_id, **result}), 200

@app.route("/expenses", methods=["GET"])
@require_auth
def get_expenses():
    """Retrieves all stored expenses for the authenticated user."""
    user_id = request.user_id
    db_session = get_db_session()
    user_expenses = db_session.query(Expense).filter_by(user_id=user_id).order_by(Expense.created_at.desc()).all()
    
    expenses_list = [exp.to_dict() for exp in user_expenses]
    for exp in expenses_list:
        exp['parsed_data'] = json.loads(exp['parsed_data'])
        
    return jsonify({'status': 'success', 'count': len(expenses_list), 'expenses': expenses_list}), 200

@app.route("/expenses/<int:expense_id>/allocations", methods=["GET"])
@require_auth
def get_expense_allocations(expense_id):
    """Get user allocations for a specific expense with item-level breakdown."""
    user_id = request.user_id
    
    try:
        db_session = get_db_session()
        expense = db_session.query(Expense).filter_by(id=expense_id, user_id=user_id).first()
        
        if not expense:
            return jsonify({'error': 'Expense not found'}), 404
            
        parsed_data = json.loads(expense.parsed_data)
        line_items = parsed_data.get('line_items', [])
        
        # Calculate user allocations if not already present
        user_allocations = parsed_data.get('user_allocations')
        if not user_allocations:
            user_allocations = calculate_user_allocations(line_items)
        
        # Calculate item-level breakdown if not already present
        user_allocation_breakdown = parsed_data.get('user_allocation_breakdown')
        if not user_allocation_breakdown:
            user_allocation_breakdown = calculate_user_allocation_breakdown(line_items)
        
        return jsonify({
            'status': 'success',
            'expense_id': expense_id,
            'user_allocations': user_allocations,  # Total per user
            'user_allocation_breakdown': user_allocation_breakdown,  # Item-level breakdown
            'total_amount': parsed_data.get('total_amount', 0),
            'expense_type': parsed_data.get('expense_type', 'personal'),
            'participants': parsed_data.get('participants', []),
            'line_items': line_items
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting expense allocations: {e}\nTraceback: {traceback.format_exc()}")
        return jsonify({'error': 'Failed to get expense allocations', 'message': str(e)}), 500

@app.route("/insights", methods=["POST"])
@require_auth
def get_insights():
    """Analyzes all of a user's expenses to provide insights based on a query."""
    if not model: return jsonify({'error': 'Service configuration error'}), 503

    data = request.get_json()
    query = data.get('query')
    user_id = request.user_id

    if not query: return jsonify({'error': 'Missing query'}), 400

    try:
        db_session = get_db_session()
        user_expenses_raw = db_session.query(Expense).filter_by(user_id=user_id).all()
        
        if not user_expenses_raw:
            return jsonify({'insights': "You don't have any expense data yet. Please add some expenses first."}), 200

        user_expenses_data = [json.loads(exp.parsed_data) for exp in user_expenses_raw]
        insights = tool_analyze_expenses_for_insights(query, user_expenses_data)
        
        return jsonify({'status': 'success', 'query': query, 'insights': insights}), 200

    except Exception as e:
        logger.error(f"Error generating insights: {e}\nTraceback: {traceback.format_exc()}")
        return jsonify({'error': 'Failed to generate insights', 'message': str(e)}), 500

@app.route("/dashboard/stats", methods=["GET"])
@require_auth
def get_dashboard_stats():
    """Get dashboard statistics using improved user allocation calculations."""
    user_id = request.user_id
    
    try:
        db_session = get_db_session()
        user_expenses = db_session.query(Expense).filter_by(user_id=user_id).all()
        
        if not user_expenses:
            return jsonify({
                'status': 'success',
                'this_month_total': 0,
                'last_month_total': 0,
                'category_breakdown': [],
                'personal_count': 0,
                'shared_count': 0,
                'total_expenses': 0
            }), 200
        
        # Parse expenses and calculate stats using improved allocation logic
        parsed_expenses = []
        for exp in user_expenses:
            parsed_data = json.loads(exp.parsed_data)
            
            # Use existing user_allocations if available, otherwise calculate
            user_allocations = parsed_data.get('user_allocations')
            if not user_allocations:
                line_items = parsed_data.get('line_items', [])
                user_allocations = calculate_user_allocations(line_items)
            
            # Get user's portion from allocations (much more accurate)
            user_portion = user_allocations.get('me', 0)
            
            parsed_expenses.append({
                'amount': parsed_data.get('total_amount', 0),
                'user_portion': user_portion,  # NEW: Use calculated allocation
                'type': parsed_data.get('expense_type', 'personal'),
                'date': exp.created_at,
                'line_items': parsed_data.get('line_items', []),
                'user_allocations': user_allocations
            })
        
        # Calculate monthly totals using accurate user portions
        from datetime import datetime, timedelta
        now = datetime.now()
        current_month_start = datetime(now.year, now.month, 1)
        
        # Last month calculation
        if now.month == 1:
            last_month_start = datetime(now.year - 1, 12, 1)
            last_month_end = datetime(now.year, 1, 1) - timedelta(days=1)
        else:
            last_month_start = datetime(now.year, now.month - 1, 1)
            last_month_end = current_month_start - timedelta(days=1)
        
        this_month_total = 0
        last_month_total = 0
        category_totals = {}
        personal_count = 0
        shared_count = 0
        
        for expense in parsed_expenses:
            # Count expense types
            if expense['type'] == 'shared':
                shared_count += 1
            else:
                personal_count += 1
                
            # Use the accurate user portion from allocations
            user_portion = expense['user_portion']
            
            # Monthly totals (use accurate user portions)
            if expense['date'] >= current_month_start:
                this_month_total += user_portion
                logger.info(f"Added ${user_portion:.2f} to this month total. New total: ${this_month_total:.2f}")
                
                # Category breakdown (this month only, using accurate user portions)
                user_allocations = expense.get('user_allocations', {})
                user_allocation_amount = user_allocations.get('me', 0)
                
                for item in expense['line_items']:
                    # Calculate user's portion of this specific item
                    item_user_amount = 0
                    splits = item.get('splits', [])
                    for split in splits:
                        if split.get('participant', '').lower() in ['me', 'myself', 'i', 'user', 'you']:
                            item_user_amount += split.get('amount', 0)
                    
                    if item_user_amount > 0:
                        # Use AI-determined category if available, otherwise fallback to description-based
                        ai_category = item.get('category')
                        category = categorize_line_item(item.get('description', ''), ai_category)
                        category_totals[category] = category_totals.get(category, 0) + item_user_amount
                            
            elif last_month_start <= expense['date'] <= last_month_end:
                last_month_total += user_portion
        
        category_breakdown = [{'name': k, 'value': round(v, 2)} for k, v in category_totals.items()]
        
        return jsonify({
            'status': 'success',
            'this_month_total': round(this_month_total, 2),
            'last_month_total': round(last_month_total, 2),
            'category_breakdown': category_breakdown,
            'personal_count': personal_count,
            'shared_count': shared_count,
            'total_expenses': len(user_expenses)
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting dashboard stats: {e}\nTraceback: {traceback.format_exc()}")
        return jsonify({'error': 'Failed to get dashboard statistics', 'message': str(e)}), 500

def categorize_line_item(description: str, ai_category: str = None) -> str:
    """
    Categorize line item using AI-determined category or smart fallback.
    """
    # If AI provided a category, use it (this is the preferred method)
    if ai_category:
        # Validate the AI category
        try:
            validated_category = ExpenseCategory.from_string(ai_category)
            return validated_category.value
        except:
            logger.warning(f"Invalid AI category '{ai_category}', using fallback")
    
    # Fallback: Simple rule-based categorization for legacy items
    desc_lower = description.lower()
    
    # Food & Dining
    if any(word in desc_lower for word in ['restaurant', 'cafe', 'pizza', 'burger', 'dining', 'takeout', 'food delivery', 'meal']):
        return ExpenseCategory.FOOD_DINING.value
    
    # Groceries
    elif any(word in desc_lower for word in ['grocery', 'supermarket', 'vegetables', 'rice', 'dal', 'flour', 'milk', 'bread']):
        return ExpenseCategory.GROCERIES.value
    
    # Transportation
    elif any(word in desc_lower for word in ['fuel', 'gas', 'petrol', 'uber', 'taxi', 'transport', 'bus', 'train', 'metro']):
        return ExpenseCategory.TRANSPORTATION.value
    
    # Shopping
    elif any(word in desc_lower for word in ['clothes', 'shopping', 'mall', 'store', 'electronics', 'phone', 'laptop']):
        return ExpenseCategory.SHOPPING.value
    
    # Entertainment
    elif any(word in desc_lower for word in ['movie', 'cinema', 'game', 'sports', 'entertainment', 'music', 'streaming']):
        return ExpenseCategory.ENTERTAINMENT.value
    
    # Utilities
    elif any(word in desc_lower for word in ['utility', 'electricity', 'water', 'internet', 'bill', 'rent', 'wifi']):
        return ExpenseCategory.UTILITIES.value
    
    # Healthcare
    elif any(word in desc_lower for word in ['medicine', 'doctor', 'hospital', 'medical', 'pharmacy', 'health']):
        return ExpenseCategory.HEALTHCARE.value
    
    # Education
    elif any(word in desc_lower for word in ['book', 'course', 'school', 'education', 'learning', 'study']):
        return ExpenseCategory.EDUCATION.value
    
    # Travel
    elif any(word in desc_lower for word in ['hotel', 'flight', 'vacation', 'travel', 'trip', 'tourism']):
        return ExpenseCategory.TRAVEL.value
    
    # Default to Miscellaneous
    else:
        return ExpenseCategory.MISCELLANEOUS.value

@app.route("/budget", methods=["GET", "POST"])
@require_auth
def manage_budget():
    """Get or set user budget."""
    user_id = request.user_id
    
    if request.method == "GET":
        # For now, return a default budget since we don't have user preferences storage
        # In a real app, this would be stored in a user preferences table
        return jsonify({
            'status': 'success',
            'monthly_budget': 50000  # Default budget
        }), 200
    
    elif request.method == "POST":
        data = request.get_json()
        monthly_budget = data.get('monthly_budget')
        
        if not monthly_budget or monthly_budget <= 0:
            return jsonify({'error': 'Invalid budget amount'}), 400
        
        # For now, just return success
        # In a real app, this would be stored in a user preferences table
        return jsonify({
            'status': 'success',
            'monthly_budget': monthly_budget,
            'message': 'Budget updated successfully'
        }), 200

@app.route("/insights/generate", methods=["POST"])
@require_auth
def generate_and_store_insight():
    """Generate an insight and store it in the database."""
    if not model: return jsonify({'error': 'Service configuration error'}), 503

    data = request.get_json()
    query = data.get('query')
    tags = data.get('tags', '')
    user_id = request.user_id

    if not query: return jsonify({'error': 'Missing query'}), 400

    try:
        db_session = get_db_session()
        user_expenses_raw = db_session.query(Expense).filter_by(user_id=user_id).all()
        
        if not user_expenses_raw:
            return jsonify({'insights': "You don't have any expense data yet. Please add some expenses first."}), 200

        user_expenses_data = [json.loads(exp.parsed_data) for exp in user_expenses_raw]
        insight_text = tool_analyze_expenses_for_insights(query, user_expenses_data)
        
        # Store the insight in database
        new_insight = Insight(
            user_id=user_id,
            query=query,
            insight_text=insight_text,
            tags=tags
        )
        db_session.add(new_insight)
        db_session.commit()
        
        return jsonify({
            'status': 'success',
            'query': query,
            'insight_text': insight_text,
            'insight_id': new_insight.id,
            'created_at': new_insight.created_at.isoformat()
        }), 200

    except Exception as e:
        logger.error(f"Error generating and storing insight: {e}\nTraceback: {traceback.format_exc()}")
        return jsonify({'error': 'Failed to generate insight', 'message': str(e)}), 500

@app.route("/insights", methods=["GET"])
@require_auth
def get_all_insights():
    """Get all stored insights for the user."""
    user_id = request.user_id
    
    try:
        db_session = get_db_session()
        user_insights = db_session.query(Insight).filter_by(user_id=user_id).order_by(Insight.created_at.desc()).all()
        
        insights_list = [insight.to_dict() for insight in user_insights]
        
        return jsonify({
            'status': 'success',
            'count': len(insights_list),
            'insights': insights_list
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting insights: {e}\nTraceback: {traceback.format_exc()}")
        return jsonify({'error': 'Failed to get insights', 'message': str(e)}), 500

@app.route("/insights/<int:insight_id>", methods=["DELETE"])
@require_auth
def delete_insight(insight_id):
    """Delete a specific insight."""
    user_id = request.user_id
    
    try:
        db_session = get_db_session()
        insight = db_session.query(Insight).filter_by(id=insight_id, user_id=user_id).first()
        
        if not insight:
            return jsonify({'error': 'Insight not found'}), 404
            
        db_session.delete(insight)
        db_session.commit()
        
        return jsonify({
            'status': 'success',
            'message': 'Insight deleted successfully'
        }), 200
        
    except Exception as e:
        logger.error(f"Error deleting insight: {e}\nTraceback: {traceback.format_exc()}")
        return jsonify({'error': 'Failed to delete insight', 'message': str(e)}), 500

# --- Debug Endpoints ---

@app.route("/debug/expenses", methods=["GET"])
@require_auth
def debug_expenses():
    """Debug endpoint to see raw expense data, splits, and user allocations with item-level breakdown."""
    user_id = request.user_id
    
    try:
        db_session = get_db_session()
        user_expenses = db_session.query(Expense).filter_by(user_id=user_id).limit(5).all()
        
        debug_data = []
        for exp in user_expenses:
            parsed_data = json.loads(exp.parsed_data)
            line_items = parsed_data.get('line_items', [])
            
            # Get or calculate user allocations
            user_allocations = parsed_data.get('user_allocations')
            if not user_allocations:
                user_allocations = calculate_user_allocations(line_items)
            
            # Get or calculate user allocation breakdown
            user_allocation_breakdown = parsed_data.get('user_allocation_breakdown')
            if not user_allocation_breakdown:
                user_allocation_breakdown = calculate_user_allocation_breakdown(line_items)
            
            # Calculate user's portion using the new grouped allocation
            user_portion = user_allocations.get('me', 0)
            
            debug_data.append({
                'id': exp.id,
                'original_text': exp.original_text,
                'expense_type': parsed_data.get('expense_type'),
                'total_amount': parsed_data.get('total_amount'),
                'user_portion_from_allocations': user_portion,
                'user_allocations': user_allocations,  # Total per user
                'user_allocation_breakdown': user_allocation_breakdown,  # NEW: Item breakdown
                'created_at': exp.created_at.isoformat(),
                'participants': parsed_data.get('participants', []),
                'line_items_count': len(line_items),
                'line_items_sample': line_items[:2],  # Show first 2 items
            })
        
        return jsonify({
            'status': 'success',
            'debug_data': debug_data,
            'explanation': {
                'user_allocations': 'Total amount each person owes across all items',
                'user_allocation_breakdown': 'Shows exactly which items each person is paying for and how much'
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error in debug endpoint: {e}\nTraceback: {traceback.format_exc()}")
        return jsonify({'error': 'Debug failed', 'message': str(e)}), 500

# --- Main Execution ---

if __name__ == '__main__':
    # Runs the Flask development server
    # Accessible at http://127.0.0.1:5000
    app.run(host='0.0.0.0', port=5002, debug=True)
