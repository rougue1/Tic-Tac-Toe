from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from .models import db, Game, User
from .utils import generate_room_code
from . import socketio, ready_to_play_users, online_users_sids  # Import from __init__

room_bp = Blueprint('rooms', __name__)


@room_bp.route('/rooms', methods=['POST'])
@jwt_required()
def create_room():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    data = request.get_json()
    is_public = data.get('is_public', True)  # Default to public

    room_id = generate_room_code()
    while Game.query.filter_by(
            room_id=room_id).first():  # Ensure room_id is unique
        room_id = generate_room_code()

    new_game = Game(
        room_id=room_id,
        player_x_id=current_user_id,  # Creator is Player X
        current_turn_player_id=current_user_id,
        is_public=is_public,
        status='pending')
    db.session.add(new_game)
    db.session.commit()

    return jsonify({
        "msg":
        "Room created successfully",
        "room_id":
        new_game.room_id,
        "game_id":
        new_game.id,
        "game_details":
        new_game.to_dict(current_user_id=current_user_id)
    }), 201


@room_bp.route('/rooms/public', methods=['GET'])
@jwt_required()
def list_public_rooms():
    # List public rooms that are 'pending' (waiting for a second player)
    rooms = Game.query.filter_by(is_public=True, status='pending').all()
    return jsonify([room.to_dict() for room in rooms]), 200


@room_bp.route('/rooms/<string:room_id_param>/join', methods=['POST'])
@jwt_required()
def join_room_http(
        room_id_param):  # Renamed to avoid conflict with socket event
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    game = Game.query.filter_by(room_id=room_id_param).first()

    if not game:
        return jsonify({"msg": "Room not found"}), 404

    if game.status != 'pending':
        return jsonify({
            "msg":
            "Room is not available for joining (already active or finished)"
        }), 403

    if game.player_x_id == current_user_id:
        # User is already player X, perhaps rejoining or checking status
        return jsonify({
            "msg": "You are already Player X in this room.",
            "game_details": game.to_dict(current_user_id)
        }), 200

    if game.player_o_id is not None and game.player_o_id != current_user_id:
        return jsonify({"msg": "Room is full"}), 403

    # Assign user as player O if slot is empty
    if game.player_o_id is None:
        game.player_o_id = current_user_id
        game.status = 'active'  # Game starts now
        # current_turn_player_id is already set to player_x_id on creation
        db.session.commit()

        # Notify Player X (the creator) that Player O has joined
        # This can also be handled via SocketIO more directly if Player X is already in the socket room
        player_x_sid = online_users_sids.get(game.player_x_id)
        if player_x_sid:
            socketio.emit(
                'player_joined', {
                    'game': game.to_dict(current_user_id=game.player_x_id),
                    'joining_player_username': user.username
                },
                room=player_x_sid)

        # Notify the joining player (Player O)
        # The client joining will typically then connect to the socket room for this game
        return jsonify({
            "msg": "Joined room successfully as Player O. Game is active.",
            "game_details": game.to_dict(current_user_id)
        }), 200

    # If user is already player O
    if game.player_o_id == current_user_id:
        return jsonify({
            "msg": "You are already Player O in this room.",
            "game_details": game.to_dict(current_user_id)
        }), 200

    return jsonify({"msg": "Cannot join room"}), 400  # Should not reach here


@room_bp.route('/game/<string:room_id_param>', methods=['GET'])
@jwt_required()
def get_game_details(room_id_param):
    current_user_id = get_jwt_identity()
    game = Game.query.filter_by(room_id=room_id_param).first()
    if not game:
        return jsonify({"msg": "Game not found"}), 404
    # Ensure the user is part of the game to view details, unless it's a public game query
    # For now, let's assume if they know the room_id, they can get basic details
    return jsonify(game.to_dict(current_user_id)), 200


# --- Public Matchmaking ---
@room_bp.route('/play/ready', methods=['POST'])
@jwt_required()
def set_ready_to_play():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    if current_user_id not in ready_to_play_users:
        ready_to_play_users[current_user_id] = user.username
        # Broadcast update to other users? (e.g., via a general 'lobby' socket room)
        socketio.emit('available_players_update',
                      get_all_available_players_list(),
                      room='lobby')  # Assuming a general lobby room
    return jsonify({"msg": f"{user.username} is now ready to play."}), 200


@room_bp.route('/play/unready', methods=['POST'])
@jwt_required()
def set_unready_to_play():
    current_user_id = get_jwt_identity()
    if current_user_id in ready_to_play_users:
        del ready_to_play_users[current_user_id]
        socketio.emit('available_players_update',
                      get_all_available_players_list(),
                      room='lobby')
    return jsonify({"msg": "No longer marked as ready to play."}), 200


def get_all_available_players_list():
    """Returns the full list of users in ready_to_play_users."""
    return [{
        "id": uid,
        "username": uname
    } for uid, uname in ready_to_play_users.items()]


def get_all_available_players_list_except(exclude_user_id):
    # Return list of {"id": user_id, "username": username}
    return [
        {
            "id": uid,
            "username": uname
        } for uid, uname in ready_to_play_users.items()
        if uid != exclude_user_id  # Don't list self
    ]


@room_bp.route('/play/available', methods=['GET'])
@jwt_required(
    optional=True
)  # Allow even non-logged in users to see, or only logged in. Let's make it required.
@jwt_required()
def list_available_players():
    current_user_id = get_jwt_identity()
    return jsonify(get_all_available_players_list_except(current_user_id)), 200


@room_bp.route('/play/start_with/<int:opponent_id>', methods=['POST'])
@jwt_required()
def start_game_with_player(opponent_id):
    challenger_id = get_jwt_identity()
    challenger = User.query.get(challenger_id)
    opponent = User.query.get(opponent_id)

    if not challenger or not opponent:
        return jsonify({"msg": "User not found"}), 404

    if challenger_id == opponent_id:
        return jsonify({"msg": "Cannot play against yourself"}), 400

    if challenger_id not in ready_to_play_users and opponent_id not in ready_to_play_users:
        # Could also be that one initiated, so only the other needs to be ready
        return jsonify({
            "msg":
            "Both players must be marked as ready to play, or one is no longer available."
        }), 400

    # Create a new game
    room_id = generate_room_code()
    while Game.query.filter_by(room_id=room_id).first():
        room_id = generate_room_code()

    new_game = Game(
        room_id=room_id,
        player_x_id=challenger_id,
        player_o_id=opponent_id,
        current_turn_player_id=challenger_id,  # Challenger (Player X) starts
        is_public=
        False,  # Games started this way are not listed as 'public waiting rooms'
        status='active')
    db.session.add(new_game)
    db.session.commit()

    # Remove both players from ready list
    if challenger_id in ready_to_play_users:
        del ready_to_play_users[challenger_id]
    if opponent_id in ready_to_play_users: del ready_to_play_users[opponent_id]
    socketio.emit('available_players_update',
                  get_all_available_players_list_except(),
                  room='lobby')  # Update global list

    # Notify both players about the new game
    # Challenger (already has game details from this response)
    # Opponent (needs to be notified via WebSocket)
    opponent_sid = online_users_sids.get(opponent_id)
    if opponent_sid:
        socketio.emit(
            'game_invite', {
                "msg": f"{challenger.username} has started a game with you!",
                "game_details": new_game.to_dict(current_user_id=opponent_id)
            },
            room=opponent_sid)

    challenger_sid = online_users_sids.get(challenger_id)
    if challenger_sid:  # Also notify challenger to join the socket room
        socketio.emit(
            'game_started_direct',
            {  # A specific event for this type of start
                "msg": f"Game with {opponent.username} started!",
                "game_details": new_game.to_dict(current_user_id=challenger_id)
            },
            room=challenger_sid)

    return jsonify({
        "msg":
        f"Game started with {opponent.username}",
        "game_details":
        new_game.to_dict(current_user_id=challenger_id)
    }), 201
