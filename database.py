from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from datetime import timezone
import pytz

db = SQLAlchemy()

# Use UTC for database storage to avoid timezone issues
UTC = timezone.utc

class Marker(db.Model):
    __tablename__ = 'markers'
    
    id = db.Column(db.Integer, primary_key=True)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    marker_type = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(UTC))
    expires_at = db.Column(db.DateTime, nullable=False)
    
    def __init__(self, latitude, longitude, marker_type):
        self.latitude = latitude
        self.longitude = longitude
        self.marker_type = marker_type
    # Set expiration to 1 hour from now in UTC
    self.expires_at = datetime.now(UTC) + timedelta(hours=1)
    
    def to_dict(self):
        def _iso_utc(dt):
            if dt is None:
                return None
            # If datetime is naive, assume it's UTC; make it timezone-aware
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=UTC)
            # Convert to UTC and use ISO format with Z suffix for clarity
            # Limit to milliseconds so JS Date parsing is consistent
            try:
                iso = dt.astimezone(UTC).isoformat(timespec='milliseconds')
            except TypeError:
                # Fallback if timespec not supported in this Python version
                iso = dt.astimezone(UTC).isoformat()
            # Replace '+00:00' with 'Z' for a compact UTC indicator
            if iso.endswith('+00:00'):
                iso = iso.replace('+00:00', 'Z')
            return iso

        return {
            'id': self.id,
            'lat': self.latitude,
            'lng': self.longitude,
            'type': self.marker_type,
            'created_at': _iso_utc(self.created_at),
            'expires_at': _iso_utc(self.expires_at)
        }

def init_database(app):
    db.init_app(app)
    with app.app_context():
        db.create_all()
    print("Database initialized successfully")

def cleanup_expired_markers():
    """Remove markers that have expired (older than 1 hour)."""
    current_time = datetime.now(UTC)
    expired_markers = Marker.query.filter(Marker.expires_at < current_time).delete()
    db.session.commit()
    
    if expired_markers > 0:
        print(f"Deleted {expired_markers} expired markers")
    return expired_markers
    
    return expired_markers

def add_marker(latitude, longitude, marker_type):
    """Add a new marker to the database"""
    marker = Marker(latitude=latitude, longitude=longitude, marker_type=marker_type)
    db.session.add(marker)
    db.session.commit()
    return marker.id

def get_active_markers():
    """Get all active (non-expired) markers"""
    current_time = datetime.now(UTC)
    markers = Marker.query.filter(Marker.expires_at > current_time).order_by(Marker.created_at.desc()).all()
    return [marker.to_dict() for marker in markers]

def check_marker_collision(latitude, longitude, marker_type, radius_meters=40):
    """Check if a marker can be placed at the given location (collision detection)"""
    import math
    current_time = datetime.now(UTC)
    
    # Get all active markers of the same type
    existing_markers = Marker.query.filter(
        Marker.expires_at > current_time,
        Marker.marker_type == marker_type
    ).all()
    
    # Check distance using approximate calculation
    # 1 degree latitude ≈ 111 km, 1 degree longitude ≈ 111 km * cos(latitude)
    for marker in existing_markers:
        # Simple distance calculation (good enough for small distances)
        lat_diff = abs(latitude - marker.latitude)
        lng_diff = abs(longitude - marker.longitude)
        
        # Convert to meters (approximate)
        lat_meters = lat_diff * 111000
        lng_meters = lng_diff * 111000 * math.cos(math.radians(latitude))
        
        distance = math.sqrt(lat_meters**2 + lng_meters**2)
        
        if distance < radius_meters:
            return False  # Collision detected
    
    return True  # No collision

if __name__ == '__main__':
    init_database()
