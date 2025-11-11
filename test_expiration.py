#!/usr/bin/env python3
"""
Test script to verify 1-hour expiration functionality
"""

import sqlite3
from datetime import datetime, timedelta
from database import cleanup_expired_markers, get_active_markers, add_marker

def test_expiration():
    print("=== Testing 1-Hour Expiration Functionality ===\n")
    
    # Show current markers
    print("1. Current active markers:")
    markers = get_active_markers()
    for i, marker in enumerate(markers, 1):
        created = datetime.fromisoformat(marker['created_at'])
        expires = datetime.fromisoformat(marker['expires_at'])
        now = datetime.now()
        remaining = expires - now
        
        print(f"   {i}. {marker['type'].upper()} at ({marker['latitude']:.4f}, {marker['longitude']:.4f})")
        print(f"      Created: {created.strftime('%H:%M:%S')}")
        print(f"      Expires: {expires.strftime('%H:%M:%S')}")
        print(f"      Time remaining: {remaining}")
        print()
    
    print(f"Total active markers: {len(markers)}\n")
    
    # Test adding a marker that expires in 10 seconds (for testing)
    print("2. Adding test marker that expires in 10 seconds...")
    
    # Connect directly to database to add test marker with custom expiration
    conn = sqlite3.connect('outage_map.db')
    cursor = conn.cursor()
    
    test_lat = 17.3000
    test_lng = -62.7200
    created_at = datetime.now()
    expires_at = created_at + timedelta(seconds=10)  # Expires in 10 seconds
    
    cursor.execute('''
        INSERT INTO markers (latitude, longitude, marker_type, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
    ''', (test_lat, test_lng, 'outage', created_at, expires_at))
    
    test_marker_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    print(f"   Added test marker with ID: {test_marker_id}")
    print(f"   Will expire at: {expires_at.strftime('%H:%M:%S')}")
    print()
    
    # Check markers again
    print("3. Markers after adding test marker:")
    markers = get_active_markers()
    print(f"   Total active markers: {len(markers)}")
    
    # Find our test marker
    test_marker = None
    for marker in markers:
        if marker['id'] == test_marker_id:
            test_marker = marker
            break
    
    if test_marker:
        print(f"   Test marker found: {test_marker['type']} at ({test_marker['latitude']}, {test_marker['longitude']})")
    else:
        print("   Test marker not found!")
    
    print()
    
    # Wait for expiration and test cleanup
    import time
    print("4. Waiting 12 seconds for test marker to expire...")
    time.sleep(12)
    
    print("5. Running cleanup and checking markers:")
    cleaned_count = cleanup_expired_markers()
    print(f"   Cleaned up {cleaned_count} expired markers")
    
    markers_after_cleanup = get_active_markers()
    print(f"   Active markers after cleanup: {len(markers_after_cleanup)}")
    
    # Check if test marker was removed
    test_marker_still_exists = any(m['id'] == test_marker_id for m in markers_after_cleanup)
    
    if test_marker_still_exists:
        print("   ❌ ERROR: Test marker still exists after expiration!")
    else:
        print("   ✅ SUCCESS: Test marker was properly removed after expiration!")
    
    print()
    print("=== Test Complete ===")
    
    # Show final state
    print("\nFinal active markers:")
    for i, marker in enumerate(markers_after_cleanup, 1):
        created = datetime.fromisoformat(marker['created_at'])
        expires = datetime.fromisoformat(marker['expires_at'])
        now = datetime.now()
        remaining = expires - now
        
        print(f"   {i}. {marker['type'].upper()} - Time remaining: {remaining}")

if __name__ == '__main__':
    test_expiration()
