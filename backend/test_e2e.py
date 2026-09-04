import os
import time
import requests
import sys

# We assume the server is running on port 8000
BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("Testing /health/featherless...")
    res = requests.get(f"{BASE_URL}/health/featherless")
    if res.status_code != 200:
        print(f"FAILED /health/featherless: {res.text}")
        sys.exit(1)
    
    data = res.json()
    if not data.get("is_configured"):
        print("FAILED: Featherless is not configured. Missing API key?")
        sys.exit(1)
    
    print("Featherless health check passed.")
    print(f"Model configured: {data.get('model')}")

    print("\nTesting POST /analyze-area with 'Gachibowli, Hyderabad'...")
    payload = {"location": "Gachibowli, Hyderabad"}
    res = requests.post(f"{BASE_URL}/analyze-area", json=payload)
    if res.status_code != 200:
        print(f"FAILED /analyze-area: {res.text}")
        sys.exit(1)
    
    result = res.json()
    print("Success! Result received:")
    print(f"Location: {result.get('location')}")
    print(f"Coordinates: {result.get('latitude')}, {result.get('longitude')}")
    print(f"Susceptibility: {result.get('susceptibility_score')}")
    print(f"Risk Level: {result.get('risk_level')}")
    print(f"Features Used: {len(result.get('features_used', {}))} features")
    print(f"AI Explanation Snippet: {result.get('ai_explanation', '')[:100]}...")
    
    if len(result.get('features_used', {})) != 13:
        print("FAILED: Expected exactly 13 features used.")
        sys.exit(1)
        
    print("\nAll End-to-End Tests Passed successfully!")

if __name__ == "__main__":
    run_tests()
