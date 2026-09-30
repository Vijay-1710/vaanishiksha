"""
Test Omniroute using OpenAI-compatible endpoint instead of Gemini endpoint.
"""
import httpx
import os
from dotenv import load_dotenv

load_dotenv()

def test_omniroute_openai_endpoint():
    api_key = os.getenv("GEMINI_API_KEY")
    
    if not api_key:
        print("❌ FAILED: No GEMINI_API_KEY found in .env")
        return False
    
    print(f"✓ API key loaded: {api_key[:20]}...")
    
    # Try OpenAI-compatible endpoint
    omniroute_base_url = "http://localhost:20128/v1"
    
    prompt = "Translate to Hindi: Hello students, today we will learn about the solar system."
    
    url = f"{omniroute_base_url}/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    payload = {
        "model": "kr/claude-sonnet-4.5",  # Using Kiro provider (built-in)
        "messages": [
            {"role": "user", "content": prompt}
        ]
    }
    
    print(f"\n🔄 Testing OpenAI-compatible endpoint...")
    print(f"   URL: {url}")
    
    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(url, headers=headers, json=payload)
            
            print(f"   Status: {response.status_code}")
            
            if response.status_code != 200:
                print(f"❌ HTTP {response.status_code}")
                print(f"   Response: {response.text[:500]}")
                return False
            
            result = response.json()
            
            if "choices" in result and len(result["choices"]) > 0:
                translated_text = result["choices"][0]["message"]["content"]
                print(f"\n✅ SUCCESS! OpenAI endpoint works:")
                print(f"   {translated_text}")
                return True
            
            print(f"❌ Unexpected response: {result}")
            return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Testing Omniroute OpenAI-Compatible Endpoint")
    print("=" * 60)
    
    success = test_omniroute_openai_endpoint()
    
    print("\n" + "=" * 60)
    if success:
        print("✅ OpenAI endpoint works - will use this instead")
    else:
        print("❌ OpenAI endpoint also failed")
    print("=" * 60)
