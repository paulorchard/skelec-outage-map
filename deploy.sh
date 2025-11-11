#!/bin/bash

# Deployment script for self-hosted server
# This script sets up the application on a Linux server

set -e

echo "=== Python Web App Deployment Script ==="

# Configuration
APP_NAME="python-webapp"
APP_USER="www-data"
APP_DIR="/var/www/$APP_NAME"
VENV_DIR="$APP_DIR/venv"
SERVICE_FILE="/etc/systemd/system/$APP_NAME.service"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run this script as root (use sudo)"
    exit 1
fi

echo "1. Creating application directory..."
mkdir -p $APP_DIR
mkdir -p $APP_DIR/logs

echo "2. Copying application files..."
cp -r . $APP_DIR/
chown -R $APP_USER:$APP_USER $APP_DIR

echo "3. Setting up Python virtual environment..."
su $APP_USER -c "cd $APP_DIR && python3 -m venv $VENV_DIR"
su $APP_USER -c "cd $APP_DIR && source $VENV_DIR/bin/activate && pip install --upgrade pip"
su $APP_USER -c "cd $APP_DIR && source $VENV_DIR/bin/activate && pip install -r requirements.txt"

echo "4. Setting up environment file..."
if [ ! -f "$APP_DIR/.env" ]; then
    cp $APP_DIR/.env.example $APP_DIR/.env
    echo "Please edit $APP_DIR/.env with your production settings"
fi

echo "5. Creating systemd service..."
cat > $SERVICE_FILE << EOF
[Unit]
Description=Python Web App
After=network.target

[Service]
Type=exec
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
Environment=PATH=$VENV_DIR/bin
ExecStart=$VENV_DIR/bin/gunicorn -c gunicorn.conf.py app:app
ExecReload=/bin/kill -s HUP \$MAINPID
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "6. Starting the service..."
systemctl daemon-reload
systemctl enable $APP_NAME
systemctl start $APP_NAME

echo "7. Checking service status..."
systemctl status $APP_NAME

echo ""
echo "=== Deployment Complete ==="
echo "Your application should be running on http://your-server-ip:5000"
echo ""
echo "Useful commands:"
echo "  sudo systemctl status $APP_NAME     # Check service status"
echo "  sudo systemctl restart $APP_NAME    # Restart the service"
echo "  sudo systemctl logs $APP_NAME       # View logs"
echo "  sudo journalctl -u $APP_NAME -f     # Follow logs"
echo ""
echo "To configure nginx reverse proxy, see nginx.conf.example"
