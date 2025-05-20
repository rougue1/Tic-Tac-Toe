import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'you-will-never-guess'
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'super-secret-jwt'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///site.db' # Fallback to SQLite if DB_URL not set
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # For Flask-SocketIO with eventlet or gevent
    # For production, you might use a message queue like Redis
    # For development, default is fine, but eventlet is more robust
    # SOCKETIO_MESSAGE_QUEUE = os.environ.get('SOCKETIO_MESSAGE_QUEUE')