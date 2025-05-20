from flask import request
from flask_socketio import emit, join_room, leave_room
from flask_jwt_extended import jwt_required, get_jwt_identity, decode_token
from . import socketio, online_users_sids, ready_to_play_users # Import from __init__
from .models import db, Game, User
from .utils import check_win, check_draw
from .friend_routes import get_user_friends_data # To update friend lists with online status

# Store active games and their players' SIDs: {room_id: {player_x_sid: sid, player_o_sid: sid}}
# This is for quick broadcast, DB is still source of truth for game state.
active_game_sids = {}

def notify_friends_online_status(user_id, online: bool):
    """Notifies a user's friends about their online status change."""
    friends_data = get_user_friends_data(user_id) # Get my friend list
    # This friends_data already contains online status for MY friends
    # What we need is to iterate MY friends and for each friend, get THEIR sid
    # and send them an update about ME.
    
    user = User.query.get(user_id)
    if not user: return

    # Get all friendships where this user is involved and status is 'accepted'
    friendships = Friendship.query.filter(
        ((Friendship.requester_id == user_id) | (Friendship.addressee_id == user_id)) &
        (Friendship.status == 'accepted')
    ).all()

    friend_ids = set()
    for f in friendships:
        if f.requester_id == user_id:
            friend_ids.add(f.addressee_id)
        else:
            friend_ids.add(f.requester_id)
    
    for friend_id in friend_ids:
        friend_sid = online_users_sids.get(friend_id)
        if friend_sid:
            emit('friend_status_update', {
                'user_id': user_id, 
                'username': user.username, 
                'online': online
            }, room=friend_sid)


@socketio.on('connect')
def handle_connect(auth_data=None):
    # Client should send JWT token in auth_data or connect query string for authentication
    # Example: socket = io({ auth: { token: 'your_jwt_token' } });
    # For simplicity now, we'll assume an authenticated user ID is passed after connection
    # OR, we can try to authenticate here.
    print(f"Client connected: {request.sid}")
    # A general 'lobby' room for global events like available players update
    join_room('lobby', sid=request.sid)

    # The client should emit an 'authenticate' event with their token
    # Or, it can be passed in connect handshake `auth` field.
    # Flask-SocketIO docs: `auth = data.get('token')` if sent as `io({ auth: { token: '...' } })`

    # If token is passed in auth handshake:
    token = auth_data.get('token') if auth_data else None
    if token:
        try:
            decoded_token = decode_token(token)
            user_id = decoded_token['sub'] # 'sub' is the standard claim for identity
            user = User.query.get(user_id)
            if user:
                online_users_sids[user_id] = request.sid
                print(f"User {user.username} (ID: {user_id}) authenticated and connected with SID {request.sid}")
                # Notify friends that this user is online
                notify_friends_online_status(user_id, online=True)
                # Send current friend list with online statuses to the connected user
                emit('friend_list_update', get_user_friends_data(user_id), room=request.sid)

            else:
                print(f"User ID {user_id} from token not found in DB.")
        except Exception as e:
            print(f"Token validation failed on connect for SID {request.sid}: {e}")
    else:
        print(f"Client {request.sid} connected without token.")


@socketio.on('authenticate_socket') # If client sends token after connect
def authenticate_socket(data):
    token = data.get('token')
    if token:
        try:
            decoded_token = decode_token(token)
            user_id = decoded_token['sub']
            user = User.query.get(user_id)
            if user:
                online_users_sids[user_id] = request.sid
                print(f"User {user.username} (ID: {user_id}) authenticated via event with SID {request.sid}")
                notify_friends_online_status(user_id, online=True)
                emit('friend_list_update', get_user_friends_data(user_id), room=request.sid)
            else:
                print(f"User ID {user_id} from token not found in DB.")
                emit('auth_error', {'message': 'User not found from token'}, room=request.sid)
        except Exception as e:
            print(f"Token validation failed on event for SID {request.sid}: {e}")
            emit('auth_error', {'message': f'Token validation failed: {e}'}, room=request.sid)
    else:
        emit('auth_error', {'message': 'Token not provided for authentication'}, room=request.sid)


@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")
    disconnected_user_id = None
    for user_id, sid in list(online_users_sids.items()): # Iterate over a copy
        if sid == request.sid:
            disconnected_user_id = user_id
            del online_users_sids[user_id]
            # If user was in ready_to_play_users, remove them
            if user_id in ready_to_play_users:
                del ready_to_play_users[user_id]
                # Broadcast updated available players list
                socketio.emit('available_players_update', 
                            [{"id": uid, "username": uname} for uid, uname in ready_to_play_users.items()], 
                            room='lobby')
            break
    
    if disconnected_user_id:
        print(f"User ID {disconnected_user_id} disconnected.")
        notify_friends_online_status(disconnected_user_id, online=False)
        # Handle game abandonment if user was in an active game
        active_games = Game.query.filter(
            ((Game.player_x_id == disconnected_user_id) | (Game.player_o_id == disconnected_user_id)) &
            (Game.status == 'active')
        ).all()
        for game in active_games:
            if game.player_x_id == disconnected_user_id:
                game.status = 'finished_o_wins' # Player O wins by forfeit
                game.winner_id = game.player_o_id
                if game.player_o_id:
                    winner_user = User.query.get(game.player_o_id)
                    winner_user.wins +=1
            else: # Player O disconnected
                game.status = 'finished_x_wins' # Player X wins by forfeit
                game.winner_id = game.player_x_id
                if game.player_x_id:
                    winner_user = User.query.get(game.player_x_id)
                    winner_user.wins +=1
            db.session.commit()
            emit('game_update', game.to_dict(), room=game.room_id) # Notify other player in room
            print(f"Game {game.room_id} ended due to player {disconnected_user_id} disconnect.")
            if game.room_id in active_game_sids:
                del active_game_sids[game.room_id]


    # Remove from any game SID tracking
    for room_id, sids in list(active_game_sids.items()):
        if request.sid in sids.values():
            # Potentially complex logic if a player disconnects mid-game
            # For now, just clean up the SID tracking
            if sids.get('player_x_sid') == request.sid:
                sids['player_x_sid'] = None
            if sids.get('player_o_sid') == request.sid:
                sids['player_o_sid'] = None
            if not sids.get('player_x_sid') and not sids.get('player_o_sid'):
                del active_game_sids[room_id] # Clean up room if both left
            break


@socketio.on('join_game_room')
def on_join_game_room(data):
    # User ID should be derived from an authenticated socket session
    # For now, assume 'user_id' is passed if not using authenticated socket connections.
    # Best practice: use JWT to authenticate socket, then get_jwt_identity() or similar.
    # Let's find user_id from online_users_sids map
    user_id = None
    for uid, sid_val in online_users_sids.items():
        if sid_val == request.sid:
            user_id = uid
            break
    
    if not user_id:
        emit('error', {'message': 'User not authenticated or not found for this session.'})
        return

    room_id_param = data.get('room_id')
    if not room_id_param:
        emit('error', {'message': 'Room ID is required.'})
        return

    game = Game.query.filter_by(room_id=room_id_param).first()
    if not game:
        emit('error', {'message': 'Game room not found.'})
        return

    # Check if user is part of this game
    if game.player_x_id != user_id and game.player_o_id != user_id:
        # If game is public and pending, and player_o is not set, allow join
        if game.is_public and game.status == 'pending' and game.player_o_id is None and game.player_x_id != user_id:
            game.player_o_id = user_id
            game.status = 'active'
            db.session.commit()
            # emit('player_joined', {'game': game.to_dict(user_id), 'joining_player_id': user_id}) # HTTP join handles this mostly
        else:
            emit('error', {'message': 'You are not a player in this game.'})
            return
            
    join_room(game.room_id) # SocketIO room
    print(f"User {user_id} (SID: {request.sid}) joined SocketIO room: {game.room_id}")

    # Update active_game_sids
    if game.room_id not in active_game_sids:
        active_game_sids[game.room_id] = {'player_x_sid': None, 'player_o_sid': None}
    
    if game.player_x_id == user_id:
        active_game_sids[game.room_id]['player_x_sid'] = request.sid
    elif game.player_o_id == user_id:
        active_game_sids[game.room_id]['player_o_sid'] = request.sid

    emit('game_joined_successfully', {'game': game.to_dict(user_id)}, room=request.sid) # Send to joining client
    
    # If both players are now connected via socket to the room, and game is active, send update
    if game.status == 'active' and \
        active_game_sids[game.room_id].get('player_x_sid') and \
        active_game_sids[game.room_id].get('player_o_sid'):
        emit('game_update', game.to_dict(), room=game.room_id) # Broadcast full state to both
    elif game.status == 'pending' and game.player_x_id == user_id: # Creator joined, waiting for P2
        emit('game_update', game.to_dict(user_id), room=request.sid)


@socketio.on('make_move')
def on_make_move(data):
    user_id = None
    for uid, sid_val in online_users_sids.items():
        if sid_val == request.sid:
            user_id = uid
            break
    
    if not user_id:
        emit('error', {'message': 'User not authenticated or not found for this session.'})
        return

    room_id_param = data.get('room_id')
    index = data.get('index') # 0-8 for the board cell

    if room_id_param is None or index is None:
        emit('error', {'message': 'Room ID and move index are required.'})
        return

    game = Game.query.filter_by(room_id=room_id_param).first()

    if not game:
        emit('error', {'message': 'Game not found.'})
        return
    if game.status != 'active':
        emit('error', {'message': 'Game is not active.'})
        return
    if game.current_turn_player_id != user_id:
        emit('error', {'message': 'Not your turn.'})
        return

    board_list = list(game.board)
    if not (0 <= index < 9 and board_list[index] == ' '):
        emit('error', {'message': 'Invalid move.'})
        return

    player_symbol = 'X' if game.player_x_id == user_id else 'O'
    board_list[index] = player_symbol
    game.board = "".join(board_list)

    winner_symbol = check_win(game.board)
    if winner_symbol:
        game.winner_id = game.player_x_id if winner_symbol == 'X' else game.player_o_id
        game.status = f"finished_{winner_symbol.lower()}_wins"
        
        winner_user = User.query.get(game.winner_id)
        if winner_user: # Should always be true
            winner_user.wins += 1
        
        emit('game_over', {'game': game.to_dict(), 'winner': winner_symbol}, room=game.room_id)
    elif check_draw(game.board):
        game.status = 'draw'
        emit('game_over', {'game': game.to_dict(), 'draw': True}, room=game.room_id)
    else:
        # Switch turn
        game.current_turn_player_id = game.player_o_id if game.current_turn_player_id == game.player_x_id else game.player_x_id
        emit('game_update', game.to_dict(), room=game.room_id)

    db.session.commit()
    
    if game.status not in ['active'] and game.room_id in active_game_sids: # Game ended
        del active_game_sids[game.room_id]


@socketio.on('leave_game_room')
def on_leave_game_room(data):
    # User ID logic as above
    user_id = None
    for uid, sid_val in online_users_sids.items():
        if sid_val == request.sid:
            user_id = uid
            break
    if not user_id: return # Silently fail if not authenticated

    room_id_param = data.get('room_id')
    if not room_id_param: return

    leave_room(room_id_param)
    print(f"User {user_id} (SID: {request.sid}) left SocketIO room: {room_id_param}")
    
    # Clean up SID from active_game_sids
    if room_id_param in active_game_sids:
        sids_in_room = active_game_sids[room_id_param]
        if sids_in_room.get('player_x_sid') == request.sid:
            sids_in_room['player_x_sid'] = None
        if sids_in_room.get('player_o_sid') == request.sid:
            sids_in_room['player_o_sid'] = None
        if not sids_in_room.get('player_x_sid') and not sids_in_room.get('player_o_sid'):
            del active_game_sids[room_id_param] # Clean up room if both left