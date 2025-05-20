from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import datetime

db = SQLAlchemy()

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    wins = db.Column(db.Integer, default=0)
    
    # Relationships for friendships
    # 'friends' relationship will list users who are friends with this user
    # The secondary table 'friendships' handles the many-to-many relationship
    friends = db.relationship(
        'User', 
        secondary='friendships',
        primaryjoin='User.id == friendships.c.user_id',
        secondaryjoin='User.id == friendships.c.friend_id',
        backref=db.backref('friend_of', lazy='dynamic'), # 'friend_of' can be used to see who friended this user
        lazy='dynamic'
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.username}>'

# Association table for Friendships (Many-to-Many)
friendships = db.Table('friendships',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('friend_id', db.Integer, db.ForeignKey('user.id'), primary_key=True)
    # We can add a status column here if we want pending/accepted requests,
    # but for simplicity, direct adding is assumed.
    # For pending/accepted, we'd need a Friendship model class instead of just a table.
)

# Let's refine Friendships to include status (pending, accepted)
class Friendship(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    requester_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False) # User who sent the request
    addressee_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False) # User who received the request
    status = db.Column(db.String(20), default='pending') # 'pending', 'accepted', 'declined'
    # Ensure a pair can only have one pending/accepted request in one direction
    __table_args__ = (db.UniqueConstraint('requester_id', 'addressee_id', name='unique_friend_request'),)

    requester = db.relationship('User', foreign_keys=[requester_id], backref='sent_friend_requests')
    addressee = db.relationship('User', foreign_keys=[addressee_id], backref='received_friend_requests')


class Game(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.String(10), unique=True, nullable=False) # Short, shareable ID
    player_x_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    player_o_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    
    # Board state: 9 characters, e.g., "         " for empty, "X O X O  "
    # ' ' for empty, 'X' for player X, 'O' for player O
    board = db.Column(db.String(9), default=' ' * 9) 
    current_turn_player_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True) # Whose turn is it
    
    # 'pending', 'active', 'finished_x_wins', 'finished_o_wins', 'draw'
    status = db.Column(db.String(30), default='pending') 
    is_public = db.Column(db.Boolean, default=True)
    winner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    player_x = db.relationship('User', foreign_keys=[player_x_id], backref='games_as_x')
    player_o = db.relationship('User', foreign_keys=[player_o_id], backref='games_as_o')
    current_turn_player = db.relationship('User', foreign_keys=[current_turn_player_id])
    winner = db.relationship('User', foreign_keys=[winner_id])

    def __repr__(self):
        return f'<Game {self.room_id}>'

    def to_dict(self, current_user_id=None):
        player_x_username = User.query.get(self.player_x_id).username if self.player_x_id else None
        player_o_username = User.query.get(self.player_o_id).username if self.player_o_id else None
        current_turn_username = User.query.get(self.current_turn_player_id).username if self.current_turn_player_id else None
        
        # Determine player symbol for the current user if in game
        player_symbol = None
        if current_user_id:
            if self.player_x_id == current_user_id:
                player_symbol = 'X'
            elif self.player_o_id == current_user_id:
                player_symbol = 'O'

        return {
            'id': self.id,
            'room_id': self.room_id,
            'player_x_id': self.player_x_id,
            'player_x_username': player_x_username,
            'player_o_id': self.player_o_id,
            'player_o_username': player_o_username,
            'board': list(self.board), # send as array for easier frontend use
            'current_turn_player_id': self.current_turn_player_id,
            'current_turn_username': current_turn_username,
            'current_player_symbol': player_symbol, # X or O for the requesting user
            'status': self.status,
            'is_public': self.is_public,
            'winner_id': self.winner_id,
            'winner_username': User.query.get(self.winner_id).username if self.winner_id else None,
            'created_at': self.created_at.isoformat()
        }