#!/usr/bin/env python3
"""
Simple Google Sheets Location Importer
Fetches location data from public Google Sheets CSV export URL
"""

import csv
import requests
import sys
from typing import List, Dict, Any

# Configuration
SHEET_ID = "1aBUpLKfBpUVSTT4SaY-zGmjKAjKYKYGkHBC9SFEcXp4"
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

def get_csv_url(sheet_id: str) -> str:
    """Generate CSV export URL for Google Sheets"""
    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid=0"

def get_default_state_image(state: str) -> str:
    """Get default image URL for a state"""
    return DEFAULT_STATE_IMAGES.get(state, 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop')

def fetch_sheet_data(sheet_id: str) -> List[Dict[str, Any]]:
    """Fetch data from Google Sheets CSV export"""
    try:
        url = get_csv_url(sheet_id)
        print(f"📡 Fetching data from: {url}")
        
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        # Parse CSV content
        content = response.content.decode('utf-8')
        csv_reader = csv.DictReader(content.splitlines())
        
        data = []
        for i, row in enumerate(csv_reader, 1):
            # Clean up the data
            cleaned_row = {}
            for key, value in row.items():
                if key:  # Skip empty column headers
                    cleaned_row[key.strip()] = value.strip() if value else ""
            
            # Handle empty stateUrl - provide default image
            if not cleaned_row.get('stateUrl') or cleaned_row['stateUrl'].strip() == '':
                state = cleaned_row.get('state', '')
                cleaned_row['stateUrl'] = get_default_state_image(state)
                print(f"🖼️  Row {i}: Added default image for {state}")
            
            data.append(cleaned_row)
            print(f"📝 Row {i}: {cleaned_row.get('city', 'N/A')} - {cleaned_row.get('locality', 'N/A')}")
        
        print(f"✅ Fetched {len(data)} rows from Google Sheets")
        return data
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
        return []
    except Exception as e:
        print(f"❌ Error parsing data: {e}")
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
    for i, row in enumerate(data, 1):
        for field in required_fields:
            if field not in row or not row[field]:
                print(f"⚠️  Missing required field '{field}' in row {i}")
                return False
    
    print("✅ Data validation passed")
    return True

def main():
    """Main function"""
    print("🎯 Simple Google Sheets Location Importer")
    print("=========================================\n")
    
    # Fetch data
    data = fetch_sheet_data(SHEET_ID)
    if not data:
        print("❌ Failed to fetch data from Google Sheets")
        sys.exit(1)
    
    # Validate and save
    if validate_data(data) and save_to_csv(data, CSV_OUTPUT_FILE):
        print(f"\n🎉 Success! {len(data)} records saved to '{CSV_OUTPUT_FILE}'")
        
        # Summary
        state_count = {}
        for row in data:
            state = row.get('state', 'Unknown')
            state_count[state] = state_count.get(state, 0) + 1
        
        print("\n�� Summary:")
        for state, count in state_count.items():
            print(f"   {state}: {count} locations")
        
        print(f"\n💡 Next: Run 'npm run import-locations' to import to database")
    else:
        print("❌ Import failed")
        sys.exit(1)

if __name__ == "__main__":
    main() 