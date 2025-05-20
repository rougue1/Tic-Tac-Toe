from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_socketio import SocketIO
from flask_jwt_extended import JWTManager
from flask_cors import CORS

from .config import Config
from .models import db # Import db instance from models.py

# Initialize extensions without app context first
# db = SQLAlchemy() # Already done in models.py
migrate = Migrate()
socketio = SocketIO(cors_allowed_origins="*") # Allow all for dev, restrict in prod
jwt = JWTManager()
cors = CORS()

# In-memory store for online users and users ready for public games
# {user_id: sid}
online_users_sids = {} 
# {user_id: username}
ready_to_play_users = {} 


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize extensions with app
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    
    # Important: SocketIO must be initialized AFTER app.config is set
    # and if using message queue, after that config is set.
    # socketio.init_app(app, message_queue=app.config.get('SOCKETIO_MESSAGE_QUEUE'))
    socketio.init_app(app) # Simpler init if not using external message queue
    
    cors.init_app(app, resources={r"/*": {"origins": "*"}}) # Allow all origins for dev

    # Import and register blueprints
    from .auth import auth_bp
    from .room_routes import room_bp
    from .friend_routes import friend_bp
    # Import SocketIO event handlers to register them
    from . import game_events 

    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(room_bp, url_prefix='/api')
    app.register_blueprint(friend_bp, url_prefix='/api')
    
    return app