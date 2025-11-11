# WSGI configuration for production deployment
bind = "0.0.0.0:5000"
workers = 4
worker_class = "sync"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 100
timeout = 30
keepalive = 2

# Logging - let Render handle logging
# accesslog = "logs/access.log"
# errorlog = "logs/error.log"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# Process naming
proc_name = "python-webapp"

# Daemonization (uncomment for daemon mode)
# daemon = True
# pidfile = "/var/run/python-webapp.pid"
# user = "www-data"
# group = "www-data"
