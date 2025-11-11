<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Python Flask Web Application Instructions

This is a Flask-based web application designed for deployment to self-hosted servers.

## Project Structure Guidelines
- Follow Flask best practices for project organization
- Use environment variables for configuration
- Implement proper error handling and logging
- Include health check endpoints for monitoring
- Use Bootstrap for responsive UI components

## Development Guidelines
- Write clean, well-documented Python code
- Use virtual environments for dependency management
- Include proper error handling in all routes
- Follow PEP 8 style guidelines
- Add docstrings to all functions and classes

## Deployment Considerations
- Application is configured for Gunicorn WSGI server
- Supports systemd service management
- Includes nginx reverse proxy configuration
- Environment-based configuration management
- Proper logging setup for production monitoring

## Security Best Practices
- Use environment variables for sensitive data
- Implement proper input validation
- Use HTTPS in production (nginx configuration provided)
- Regular security updates for dependencies
