# Saint Kitts Outage Map

A mobile-first web application for tracking power, internet, and water outages across Saint Kitts and Nevis. Built with Flask and optimized for vertical cell phone displays.

## Features

- **Mobile-First Design**: Optimized for vertical cell phone screens
- **Interactive Map**: Real-time outage visualization using OpenStreetMap
- **Header Bar**: Fixed header taking 10% of screen height with controls
- **Full-Screen Map**: 90% of screen dedicated to map view
- **Outage Types**: Power, Internet, and Water outage tracking
- **Severity Levels**: High, Medium, and Low severity indicators
- **Real-Time Updates**: Auto-refresh every 5 minutes
- **Responsive Design**: Works on all device sizes
- **API Endpoints**: RESTful API for outage data

## Quick Start

### Development Setup

1. **Navigate to the project:**
   ```bash
   cd c:\Users\paulo\OneDrive\Apps\OutageMap
   ```

2. **Create and activate virtual environment:**
   ```bash
   python -m venv venv
   venv\Scripts\activate  # Windows
   # source venv/bin/activate  # Linux/macOS
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables:**
   ```bash
   copy .env.example .env
   # Edit .env file with your settings
   ```

5. **Run the application:**
   ```bash
   python app.py
   ```

6. **Open on mobile or browser:**
   Visit `http://127.0.0.1:5000` or `http://your-ip:5000` from mobile device

## Mobile Interface

### Header Bar (10% height)
- **Title**: Saint Kitts Outage Map with location icon
- **Last Updated**: Shows timestamp of last data refresh
- **Refresh Button**: Manual refresh with loading animation
- **Legend Button**: Toggle legend panel

### Map Area (90% height)
- **Interactive Map**: Full-screen map of Saint Kitts and Nevis
- **Outage Markers**: Color-coded markers for different outage types
- **Zoom Controls**: Bottom-right corner for map navigation
- **Legend Panel**: Slide-out panel explaining markers and severity

### Outage Markers
- **Red**: Power outages
- **Orange**: Internet outages  
- **Cyan**: Water outages
- **Size**: Indicates severity (larger = more customers affected)

## API Endpoints

- `GET /` - Main map interface
- `GET /api/outages` - Current outage data with locations
- `GET /api/status` - Application status
- `GET /api/health` - Health check endpoint

### Sample Outage Data Structure
```json
{
  "outages": [
    {
      "id": 1,
      "location": "Basseterre",
      "lat": 17.2948,
      "lng": -62.7264,
      "type": "power",
      "severity": "high",
      "affected_customers": 1200,
      "start_time": "2025-07-28T08:30:00Z",
      "estimated_restoration": "2025-07-28T14:00:00Z",
      "description": "Power outage affecting downtown Basseterre area"
    }
  ]
}
```

## Deployment to Self-Hosted Server

### Prerequisites
- Linux server with Python 3.6+
- sudo access
- systemd support

### Deployment Steps

1. **Copy files to your server:**
   ```bash
   scp -r . user@your-server:/tmp/python-webapp
   ```

2. **Run deployment script:**
   ```bash
   ssh user@your-server
   cd /tmp/python-webapp
   sudo chmod +x deploy.sh
   sudo ./deploy.sh
   ```

3. **Configure environment:**
   ```bash
   sudo nano /var/www/python-webapp/.env
   # Update production settings
   sudo systemctl restart python-webapp
   ```

### Optional: Nginx Reverse Proxy

1. **Install nginx:**
   ```bash
   sudo apt update
   sudo apt install nginx
   ```

2. **Configure nginx:**
   ```bash
   sudo cp nginx.conf.example /etc/nginx/sites-available/python-webapp
   sudo ln -s /etc/nginx/sites-available/python-webapp /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## Project Structure

```
OutageMap/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── gunicorn.conf.py      # Production server configuration
├── deploy.sh             # Deployment script
├── nginx.conf.example    # Nginx configuration template
├── .env.example          # Environment variables template
├── templates/
│   └── index.html        # HTML templates
├── static/
│   ├── css/
│   │   └── style.css     # Application styles
│   └── js/
│       └── app.js        # JavaScript functionality
└── .github/
    └── copilot-instructions.md
```

## Configuration

### Environment Variables
- `FLASK_APP`: Application entry point (default: app.py)
- `FLASK_ENV`: Environment (development/production)
- `FLASK_DEBUG`: Debug mode (True/False)
- `SECRET_KEY`: Flask secret key (change for production)
- `HOST`: Server host (default: 127.0.0.1)
- `PORT`: Server port (default: 5000)

### Production Configuration
- Update `.env` file with production values
- Set `FLASK_ENV=production` and `FLASK_DEBUG=False`
- Use a strong `SECRET_KEY`
- Configure `HOST=0.0.0.0` for external access

## Monitoring and Maintenance

### Service Management
```bash
# Check service status
sudo systemctl status python-webapp

# Restart service
sudo systemctl restart python-webapp

# View logs
sudo journalctl -u python-webapp -f

# Stop service
sudo systemctl stop python-webapp
```

### Log Files
- Application logs: `/var/www/python-webapp/logs/`
- System logs: `journalctl -u python-webapp`

## Development

### Adding New Routes
Add new routes to `app.py`:
```python
@app.route('/new-page')
def new_page():
    return render_template('new_page.html')
```

### Adding Static Files
- CSS files: `static/css/`
- JavaScript files: `static/js/`
- Images: `static/images/`

### Database Integration
Uncomment database dependencies in `requirements.txt` and add your models.

## Security Considerations

- Change the default `SECRET_KEY` in production
- Use HTTPS with SSL certificates
- Keep dependencies updated
- Implement proper input validation
- Use environment variables for sensitive data

## Contributing

1. Create a virtual environment
2. Install development dependencies
3. Make your changes
4. Test thoroughly
5. Update documentation as needed

## License

This project is ready for customization and deployment to your self-hosted infrastructure.
