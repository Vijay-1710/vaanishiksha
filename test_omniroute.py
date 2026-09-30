"""
Standalone test to verify Omniroute integration for translation service.
Run this before the full pipeline to isolate config issues.
"""
import httpx
import os
from dotenv import load_dotenv

# Load .env file
load_dotenv()

def test_omniroute_translation():
    api_key = os.getenv("GEMINI_API_KEY")
    
    if not api_key:
        print("❌ FAILED: No GEMINI_API_KEY found in .env")
        return False
    
    print(f"✓ API key loaded: {api_key[:20]}...")
    
    # Omniroute's Gemini-compatible endpoint
    omniroute_base_url = "http://localhost:20128/v1beta"
    
    # Simple translation test: English to Hindi
    prompt = """Translate the following text from English to हिन्दी (Hindi).
Preserve the meaning, tone, and educational context. This is for primary school students.

Text to translate:
Hello students, today we will learn about the solar system.

Translation:"""
    
    url = f"{omniroute_base_url}/models/gemini-pro:generateContent"
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": api_key
    }
    payload = {
        "contents": [{
            "parts": [{
                "text": prompt
            }]
        }]
    }
    
    print(f"\n🔄 Sending translation request to Omniroute...")
    print(f"   Endpoint: {url}")
    
    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(url, headers=headers, json=payload)
            
            print(f"   Status: {response.status_code}")
            
            if response.status_code != 200:
                print(f"❌ FAILED: HTTP {response.status_code}")
                print(f"   Response: {response.text[:500]}")
                return False
            
            result = response.json()
            
            # Extract text from Gemini API response format
            if "candidates" in result and len(result["candidates"]) > 0:
                candidate = result["candidates"][0]
                if "content" in candidate and "parts" in candidate["content"]:
                    parts = candidate["content"]["parts"]
                    if len(parts) > 0 and "text" in parts[0]:
                        translated_text = parts[0]["text"].strip()
                        print(f"\n✅ SUCCESS! Omniroute returned translation:")
                        print(f"   {translated_text}")
                        return True
            
            print(f"❌ FAILED: Unexpected response format")
            print(f"   Response: {result}")
            return False
            
    except httpx.RequestError as e:
        print(f"❌ FAILED: Connection error to Omniroute")
        print(f"   Error: {e}")
        print(f"\n   Is Omniroute running at http://localhost:20128?")
        return False
    except Exception as e:
        print(f"❌ FAILED: Unexpected error")
        print(f"   Error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Testing Omniroute Integration for VaaniShiksha")
    print("=" * 60)
    
    success = test_omniroute_translation()
    
    print("\n" + "=" * 60)
    if success:
        print("✅ Omniroute integration test PASSED")
        print("   Ready to proceed with full setup")
    else:
        print("❌ Omniroute integration test FAILED")
        print("   Fix the issue above before continuing")
    print("=" * 60)
