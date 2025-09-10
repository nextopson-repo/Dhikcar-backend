#!/usr/bin/env python3
"""
Google Sheets API Location Importer
Fetches location data from Google Sheets and saves it as CSV for the TypeScript importer
"""

import os
import sys
import csv
from typing import List, Dict, Any

# Configuration
SHEET_ID = "1aBUpLKfBpUVSTT4SaY-zGmjKAjKYKYGkHBC9SFEcXp4"
SHEET_NAME = "Sheet1"
CSV_OUTPUT_FILE = "locations.csv"

# Default image URLs for states when stateUrl is empty
DEFAULT_STATE_IMAGES = {
    'Delhi': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Maharashtra': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Karnataka': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Tamil Nadu': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Telangana': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Andhra Pradesh': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Kerala': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Gujarat': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Rajasthan': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Uttar Pradesh': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'West Bengal': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Punjab': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Haryana': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Bihar': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Odisha': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Madhya Pradesh': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Jharkhand': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Chhattisgarh': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Assam': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Himachal Pradesh': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Uttarakhand': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Jammu and Kashmir': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Goa': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Manipur': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Meghalaya': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Tripura': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Nagaland': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Arunachal Pradesh': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Mizoram': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
    'Sikkim': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop',
}

def get_default_state_image(state: str) -> str:
    """Get default image URL for a state"""
    return DEFAULT_STATE_IMAGES.get(state, 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop')

def check_dependencies():
    """Check if required packages are available"""
    try:
        from googleapiclient.discovery import build
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from google_auth_oauthlib.flow import InstalledAppFlow
        return True
    except ImportError:
        print("❌ Missing Google Sheets API packages. Install with:")
        print("   pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client")
        return False

def fetch_sheet_data(sheet_id: str, sheet_name: str = "Sheet1") -> List[Dict[str, Any]]:
    """Fetch data from Google Sheets using the official API"""
    try:
        from googleapiclient.discovery import build
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from google_auth_oauthlib.flow import InstalledAppFlow
        
        SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
        
        # Load credentials
        creds = None
        if os.path.exists('token.json'):
            creds = Credentials.from_authorized_user_file('token.json', SCOPES)
        
        # Authenticate if needed
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not os.path.exists('credentials.json'):
                    print("❌ credentials.json not found! Please set up Google Sheets API credentials.")
                    return []
                flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
                creds = flow.run_local_server(port=0)
            
            with open('token.json', 'w') as token:
                token.write(creds.to_json())
        
        # Fetch data
        service = build('sheets', 'v4', credentials=creds)
        result = service.spreadsheets().values().get(
            spreadsheetId=sheet_id,
            range=sheet_name
        ).execute()
        
        values = result.get('values', [])
        if not values:
            print("❌ No data found in sheet")
            return []
        
        # Convert to list of dictionaries
        headers = values[0]
        data = []
        for i, row in enumerate(values[1:], 1):
            # Pad row with empty strings if shorter than headers
            while len(row) < len(headers):
                row.append("")
            
            row_dict = {headers[j]: row[j] if j < len(row) else "" for j in range(len(headers))}
            
            # Handle empty stateUrl - provide default image
            if not row_dict.get('stateUrl') or row_dict['stateUrl'].strip() == '':
                state = row_dict.get('state', '')
                row_dict['stateUrl'] = get_default_state_image(state)
                print(f"🖼️  Row {i}: Added default image for {state}")
            
            data.append(row_dict)
            print(f"📝 Row {i}: {row_dict.get('city', 'N/A')} - {row_dict.get('locality', 'N/A')}")
        
        print(f"✅ Fetched {len(data)} rows from Google Sheets")
        return data
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return []

def save_to_csv(data: List[Dict[str, Any]], filename: str) -> bool:
    """Save data to CSV file"""
    try:
        if not data:
            return False
        
        headers = list(data[0].keys())
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=headers)
            writer.writeheader()
            writer.writerows(data)
        
        print(f"💾 Saved to {filename}")
        return True
        
    except Exception as e:
        print(f"❌ Error saving CSV: {e}")
        return False

def validate_data(data: List[Dict[str, Any]]) -> bool:
    """Validate the fetched data"""
    if not data:
        return False
    
    required_fields = ['city', 'locality', 'state']
    for row in data:
        for field in required_fields:
            if field not in row or not row[field]:
                print(f"⚠️  Missing required field '{field}' in row")
                return False
    
    print("✅ Data validation passed")
    return True

def main():
    """Main function"""
    print("🎯 Google Sheets Location Importer")
    print("==================================\n")
    
    if not check_dependencies():
        sys.exit(1)
    
    # Fetch data
    data = fetch_sheet_data(SHEET_ID, SHEET_NAME)
    if not data:
        sys.exit(1)
    
    # Validate and save
    if validate_data(data) and save_to_csv(data, CSV_OUTPUT_FILE):
        print(f"\n🎉 Success! {len(data)} records saved to '{CSV_OUTPUT_FILE}'")
        
        # Summary
        state_count = {}
        for row in data:
            state = row.get('state', 'Unknown')
            state_count[state] = state_count.get(state, 0) + 1
        
        print("\n📊 Summary:")
        for state, count in state_count.items():
            print(f"   {state}: {count} locations")
        
        print(f"\n💡 Next: Run 'npm run import-locations' to import to database")
    else:
        print("❌ Import failed")
        sys.exit(1)

if __name__ == "__main__":
    main() 