# seed_db.py - Populates the database with dummy data.

import requests
import json
import time

# The base URL of your running Flask application
API_BASE_URL = "http://127.0.0.1:5002"

# A list of diverse expense data for different users - optimized for reduced AI hits
DUMMY_EXPENSES = {
    "user-one": [
        # Test 1: Complex unequal split with advance payments
        """Dec 15, 2024
Restaurant bill ₹4,800 at Barbeque Nation. Rajesh paid ₹2,000 upfront yesterday, Priya owes ₹1,200, Ankit owes ₹800, I owe ₹800. Rajesh still needs ₹800 more from others.""",
        
        # Test 2: Multi-item expense with different contribution rules
        """Dec 16, 2024
House party supplies: Decorations ₹1,500 (Kavya paid), Alcohol ₹3,600 (split among me, Arjun, Vikram only), Snacks ₹2,400 (split equally among all 6: me, Kavya, Arjun, Vikram, Sneha, Pooja), Music system ₹800 (my personal contribution).""",
        
        # Test 3: Complex trip with multiple payment methods and settlements
        """Dec 17, 2024
Goa trip Day 1: Hotel ₹6,000 (Ravi paid, split 4 ways), Flight tickets ₹8,000 (I paid for me and Ishita, she owes me ₹4,000), Cab ₹1,200 (Ishita paid, split 4 ways), Dinner ₹2,800 (split among me, Ravi, Ishita, Karan except Karan got food poisoning so pays only ₹200).""",
        
        # Test 4: Complex percentage-based business expense with personal additions
        """Dec 18, 2024
Client meeting costs: Conference room ₹5,000 (company pays 70%, I pay 30%), Lunch ₹3,200 (company pays 100%), My personal coffee ₹180, Rohit's taxi ₹450 (I'll reimburse him later), Parking ₹120 (split with Rohit).""",
        
        # Test 5: Wedding contribution with complex calculations
        """Dec 19, 2024
Meera's wedding gift fund: Base contribution ₹2,000 each from 8 friends (me, Aman, Nisha, Deepak, Sania, Harsh, Tanvi, Gaurav). Aman paid extra ₹1,500 for flowers, I paid extra ₹2,200 for jewelry, Nisha can only pay ₹1,000 so others cover her ₹1,000 deficit equally.""",
        
        # Test 6: Utility bills with complex roommate arrangements
        """Dec 20, 2024
Monthly bills: Electricity ₹2,400 (I pay 40%, Siddharth pays 35%, Akash pays 25%), Internet ₹1,800 (split equally among all 3), Water ₹900 (Akash pays, others owe him), Gas ₹1,200 (Siddharth paid, I owe him 50%, Akash exempt as he doesn't cook).""",
        
        # Test 7: Complex grocery shopping with specific item allocations
        """Dec 21, 2024
Grocery run: Vegetables ₹800 (split between me and Neha), Rice ₹450 (my personal), Dairy products ₹600 (Neha pays full), Cleaning supplies ₹350 (split 3 ways with Varun), Neha's personal snacks ₹280, Shared spices ₹240 (I paid, split 3 ways with Neha and Varun).""",
        
        # Test 8: Event planning with advance bookings and cancellation fees
        """Dec 22, 2024
Birthday party planning: Venue booking ₹8,000 (Aditi paid advance, split among 5 organizers: me, Aditi, Rahul, Shreya, Vivek), Catering ₹12,000 (I paid full, others owe me equally), Decoration ₹2,500 (Shreya paid), Cancellation fee for musician ₹1,500 (split only between me and Rahul as we chose him).""",
        
        # Test 9: Complex multi-day trip with changing group composition
        """Dec 23, 2024
Hill station trip Day 2-3: Cab to Manali ₹3,200 (split among me, Preeti, Arjun, Kavita), Hotel nights ₹4,800 (Arjun paid, split 4 ways), Preeti left early so pays only 50% of food expenses ₹1,800, Adventure activities ₹2,400 (only me and Kavita participated), Kavita's medicine ₹350 (she pays alone).""",
        
        # Test 10: Complex office lunch with dietary restrictions and variable pricing
        """Dec 24, 2024
Team lunch at food court: Regular thali ₹180 each for me, Yash, Kritika, Jain thali ₹220 for Anil, South Indian ₹160 for Ritu and Sagar, Drinks ₹80 each for everyone, Dessert ₹120 each (only me, Yash, Kritika wanted), Service tip ₹200 (split equally among all 6), Ritu forgot wallet so I paid her share.""",
    ]
}

def seed_database():
    """Sends POST requests to the /parse-expense endpoint to fill the DB."""
    print("Starting to seed the database with dummy data...")

    for user_id, expenses in DUMMY_EXPENSES.items():
        print(f"\n--- Adding expenses for user: {user_id} ---")
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {user_id}"
        }
        
        for i, text in enumerate(expenses):
            payload = {"text": str(text)}
            try:
                response = requests.post(
                    f"{API_BASE_URL}/parse-expense",
                    headers=headers,
                    data=json.dumps(payload)
                )
                response.raise_for_status()  # Raises an exception for bad status codes (4xx or 5xx)
                
                print(f"  [{i+1}/{len(expenses)}] Successfully added expense: '{text[:40]}...'")
                # Wait a moment to avoid overwhelming the server or hitting API rate limits
                time.sleep(3)  # Reduced from 10 seconds to 3 seconds for faster processing
                
            except requests.exceptions.RequestException as e:
                print(f"  [!] Error adding expense for {user_id}: {e}")
                if e.response:
                    print(f"  [!] Response Body: {e.response.text}")
                break # Stop processing this user if an error occurs

    print("\nDatabase seeding complete!")

def test_insights_api():
    """Hits the insights API with various queries to generate comprehensive insights."""
    print("\n--- Testing Insights API with various queries ---")
    
    insights_queries = [
        {
            "query": "What are my spending patterns and trends?",
            "tags": "spending,patterns,trends"
        },
        {
            "query": "How much money do people owe me vs how much I owe others?",
            "tags": "debt,balance,owed"
        },
        {
            "query": "Which friends do I spend the most money with?",
            "tags": "social,friends,spending"
        },
        {
            "query": "What categories of expenses am I spending the most on?",
            "tags": "categories,analysis,breakdown"
        },
        {
            "query": "Are there any unusual or expensive transactions I should review?",
            "tags": "anomalies,expensive,review"
        },
        {
            "query": "How do my shared expenses compare to personal expenses?",
            "tags": "shared,personal,comparison"
        },
        {
            "query": "What are my most frequent expense types and amounts?",
            "tags": "frequency,types,amounts"
        },
        {
            "query": "Show me insights about group trips and event expenses",
            "tags": "trips,events,groups"
        }
    ]
    
    for user_id, _ in DUMMY_EXPENSES.items():
        print(f"\n--- Generating insights for user: {user_id} ---")
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {user_id}"
        }
        
        for i, insight_data in enumerate(insights_queries):
            try:
                print(f"  [{i+1}/{len(insights_queries)}] Query: '{insight_data['query'][:50]}...'")
                
                # Hit the insights/generate endpoint to store insights
                response = requests.post(
                    f"{API_BASE_URL}/insights/generate",
                    headers=headers,
                    data=json.dumps(insight_data)
                )
                response.raise_for_status()
                
                result = response.json()
                if result.get('status') == 'success':
                    print(f"    ✅ Generated insight: '{result.get('insight_text', '')[:80]}...'")
                    print(f"    📊 Insight ID: {result.get('insight_id')}")
                else:
                    print(f"    ❌ Failed to generate insight: {result.get('insights', 'Unknown error')}")
                
                # Small delay to avoid overwhelming the server
                time.sleep(2)
                
            except requests.exceptions.RequestException as e:
                print(f"    [!] Error generating insight: {e}")
                if hasattr(e, 'response') and e.response:
                    print(f"    [!] Response: {e.response.text}")
                break
        
        # Get all insights for this user to verify
        try:
            print(f"\n  📋 Fetching all insights for {user_id}...")
            response = requests.get(
                f"{API_BASE_URL}/insights",
                headers=headers
            )
            response.raise_for_status()
            
            all_insights = response.json()
            if all_insights.get('status') == 'success':
                count = all_insights.get('count', 0)
                print(f"    📈 Total stored insights: {count}")
                
                # Show a sample of insights
                insights_list = all_insights.get('insights', [])
                for j, insight in enumerate(insights_list[:3]):  # Show first 3
                    print(f"    {j+1}. {insight.get('query', '')[:40]}...")
                    print(f"       💡 {insight.get('insight_text', '')[:60]}...")
                    print(f"       🏷️  Tags: {insight.get('tags', 'none')}")
                    print()
            
        except requests.exceptions.RequestException as e:
            print(f"    [!] Error fetching insights: {e}")
    
    print("\n🎯 Insights API testing complete!")

def run_full_test_suite():
    """Runs the complete test suite: seeding + insights generation."""
    print("🚀 Starting Full Test Suite...")
    print("=" * 50)
    
    # First, check if the server is healthy
    try:
        health_check = requests.get(f"{API_BASE_URL}/health-check")
        if health_check.status_code == 200:
            print("✅ API server is healthy. Proceeding with full test suite.")
            
            # Step 1: Seed the database
            print("\n📊 STEP 1: Seeding Database with Complex Expenses")
            seed_database()
            
            # Step 2: Generate insights
            print("\n🧠 STEP 2: Testing Insights API")
            test_insights_api()
            
            print("\n🎉 Full test suite completed successfully!")
            print("=" * 50)
            print("✅ Database has been populated with complex expense scenarios")
            print("✅ Insights have been generated and stored")
            print("✅ Your expense parsing system is ready for comprehensive testing!")
            
        else:
            print(f"❌ Server health check failed with status {health_check.status_code}")
            print("Please make sure your Flask application is running.")
            
    except requests.exceptions.ConnectionError:
        print(f"\n❌ Could not connect to the server at {API_BASE_URL}")
        print("Please make sure your Flask application (app.py) is running before executing this script.")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "seed-only":
            # Just seed the database
            try:
                health_check = requests.get(f"{API_BASE_URL}/health-check")
                if health_check.status_code == 200:
                    print("API server is healthy. Proceeding with seeding only.")
                    seed_database()
                else:
                    print(f"Server health check failed with status {health_check.status_code}. Is the server running?")
            except requests.exceptions.ConnectionError:
                print(f"\n[ERROR] Could not connect to the server at {API_BASE_URL}.")
                print("Please make sure your Flask application (app.py) is running in another terminal before executing this script.")
        
        elif sys.argv[1] == "insights-only":
            # Just test insights API
            try:
                health_check = requests.get(f"{API_BASE_URL}/health-check")
                if health_check.status_code == 200:
                    print("API server is healthy. Testing insights API only.")
                    test_insights_api()
                else:
                    print(f"Server health check failed with status {health_check.status_code}. Is the server running?")
            except requests.exceptions.ConnectionError:
                print(f"\n[ERROR] Could not connect to the server at {API_BASE_URL}.")
                print("Please make sure your Flask application (app.py) is running in another terminal before executing this script.")
        else:
            print("Usage: python seed.py [seed-only|insights-only]")
            print("  seed-only: Only seed the database with expenses")
            print("  insights-only: Only test the insights API")
            print("  (no arguments): Run full test suite (seed + insights)")
    else:
        # Run full test suite by default
        run_full_test_suite()