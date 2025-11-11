from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from datetime import timezone
import pytz

db = SQLAlchemy()

# Define Saint Kitts timezone (GMT-4)
AST = pytz.timezone('America/St_Kitts')

class Marker(db.Model):
    __tablename__ = 'markers'
    
    id = db.Column(db.Integer, primary_key=True)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    marker_type = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(AST))
    expires_at = db.Column(db.DateTime, nullable=False)
    
    def __init__(self, latitude, longitude, marker_type):
        self.latitude = latitude
        self.longitude = longitude
        self.marker_type = marker_type
        # Set expiration to 1 hour from now in AST timezone
        self.expires_at = datetime.now(AST) + timedelta(hours=1)
    
    def to_dict(self):
        return {
            'id': self.id,
            'lat': self.latitude,
            'lng': self.longitude,
            'type': self.marker_type,
            'created_at': self.created_at.isoformat(),
            'expires_at': self.expires_at.isoformat()
        }

def init_database(app):
    db.init_app(app)
    with app.app_context():
        db.create_all()
    print("Database initialized successfully")

def cleanup_expired_markers():
    """Remove markers that have expired (older than 1 hour)"""
    current_time = datetime.now(AST)
    expired_markers = Marker.query.filter(Marker.expires_at < current_time).delete()
    db.session.commit()
    
    if expired_markers > 0:
        print(f"Cleaned up {expired_markers} expired markers")
    
    return expired_markers

def add_marker(latitude, longitude, marker_type):
    """Add a new marker to the database"""
    marker = Marker(latitude=latitude, longitude=longitude, marker_type=marker_type)
    db.session.add(marker)
    db.session.commit()
    return marker.id

def get_active_markers():
    """Get all active (non-expired) markers"""
    current_time = datetime.now(AST)
    markers = Marker.query.filter(Marker.expires_at > current_time).order_by(Marker.created_at.desc()).all()
    return [marker.to_dict() for marker in markers]

def check_marker_collision(latitude, longitude, marker_type, radius_meters=40):
    """Check if a marker can be placed at the given location (collision detection)"""
    import math
    current_time = datetime.now(AST)
    
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
