from os import environ

class Config:
    DATABASE_URL = environ.get('DATABASE_URL', 'sqlite:///outage_map.db')
    if DATABASE_URL.startswith('postgres://'):
        DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://')

    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    DEBUG = environ.get('DEBUG', 'False').lower() == 'true'