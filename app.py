from flask import Flask, render_template, jsonify, request
import os
from datetime import datetime, timedelta
from database import db, Marker, init_database, UTC
from config import Config

app = Flask(__name__)
app.config.from_object(Config)

# Initialize database
init_database(app)

# Saint Kitts coordinates - Center of the island for better overview
SAINT_KITTS_CENTER = {
    'lat': 17.3433,  # Center of Saint Kitts island
    'lng': -62.75,   # Center of Saint Kitts island
    'zoom': 11       # Zoomed out to show whole island
}

@app.route('/')
def index():
    """Main outage map page for Saint Kitts"""
    return render_template('index.html', 
                         title='St. Kitts Power Outages',
                         center_lat=SAINT_KITTS_CENTER['lat'],
                         center_lng=SAINT_KITTS_CENTER['lng'],
                         zoom=SAINT_KITTS_CENTER['zoom'])

@app.route('/api/outages')
def get_outages():
    """API endpoint to get current power outage data"""
    # No hardcoded outages - only user-generated markers from database will show
    sample_outages = []
    
    # Use UTC ISO timestamps with Z suffix
    last_updated = datetime.now(UTC).astimezone(UTC).isoformat()
    if last_updated.endswith('+00:00'):
        last_updated = last_updated.replace('+00:00', 'Z')
    return jsonify({
        'outages': sample_outages,
        'last_updated': last_updated,
        'total_outages': len(sample_outages)
    })

@app.route('/api/status')
def api_status():
    """API endpoint to check application status"""
    timestamp = datetime.now(UTC).astimezone(UTC).isoformat()
    if timestamp.endswith('+00:00'):
        timestamp = timestamp.replace('+00:00', 'Z')
    return jsonify({
        'status': 'running',
        'timestamp': timestamp,
        'version': '1.0.0',
        'location': 'Saint Kitts and Nevis'
    })

@app.route('/api/markers', methods=['GET'])
def get_markers():
    """Get all active markers from database"""
    try:
        # Clean up expired markers and get active ones
        now = datetime.now(UTC)
        print(f"Current time (UTC): {now}")
        
        # Delete expired markers
        expired_count = Marker.query.filter(Marker.expires_at <= now).delete()
        db.session.commit()
        print(f"Deleted {expired_count} expired markers")
        
        # Get active markers
        active_markers = Marker.query.filter(Marker.expires_at > now).all()
        
        # Log marker details
        for marker in active_markers:
            print(f"Active marker: type={marker.marker_type}, expires_at={marker.expires_at}, created_at={marker.created_at}")
        
        response_data = {
            'success': True,
            'markers': [marker.to_dict() for marker in active_markers],
            'count': len(active_markers)
        }
        print(f"Returning {len(active_markers)} active markers")
        return jsonify(response_data)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/markers', methods=['POST'])
def add_new_marker():
    """Add a new marker to the database"""
    try:
        data = request.get_json()
        print(f"Received marker data: {data}")
        
        if not data:
            return jsonify({
                'success': False,
                'error': 'No data provided'
            }), 400
        
        # Validate required fields
        required_fields = ['latitude', 'longitude', 'type']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        latitude = float(data['latitude'])
        longitude = float(data['longitude'])
        marker_type = data['type']
        
        print(f"Creating new marker: type={marker_type}, lat={latitude}, lng={longitude}")
        
        # Validate marker type
        if marker_type not in ['outage', 'working']:
            return jsonify({
                'success': False,
                'error': 'Invalid marker type. Must be "outage" or "working"'
            }), 400
            
        # Check for nearby markers (40m radius) - use timezone-aware UTC
        now = datetime.now(UTC)
        nearby_markers = Marker.query.filter(
            Marker.marker_type == marker_type,
            Marker.expires_at > now
        ).all()
        
        from math import radians, sin, cos, sqrt, atan2
        
        def haversine_distance(lat1, lon1, lat2, lon2):
            R = 6371000  # Earth radius in meters
            
            lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            return R * c
        
        for marker in nearby_markers:
            distance = haversine_distance(latitude, longitude, marker.latitude, marker.longitude)
            if distance < 40:  # 40 meters radius
                return jsonify({
                    'success': False,
                    'error': 'Another marker of the same type already exists within 40 meters'
                }), 409
        
        # Add marker to database
        try:
            new_marker = Marker(latitude=latitude, longitude=longitude, marker_type=marker_type)
            db.session.add(new_marker)
            db.session.commit()
            
            # Return the complete marker data
            return jsonify({
                'success': True,
                'marker': new_marker.to_dict(),
                'message': f'{marker_type.title()} marker added successfully'
            }), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({
                'success': False,
                'error': f'Database error: {str(e)}'
            }), 500
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': 'Invalid latitude or longitude values'
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/health')
def health_check():
    """Health check endpoint for monitoring"""
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    # Development server - accessible from network
    app.run(
        host=os.environ.get('HOST', '0.0.0.0'),  # Listen on all interfaces
        port=int(os.environ.get('PORT', 5000)),
        debug=app.config['DEBUG']
    )
