from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm import aliased
from sqlalchemy import or_
from .models import db, User, Friendship
from . import socketio, online_users_sids

friend_bp = Blueprint('friends', __name__)

def get_user_friends_data(user_id):
    user = User.query.get(user_id)
    if not user:
        return []

    # Friendships where user is requester and status is 'accepted'
    sent_accepted = db.session.query(Friendship, User.username.label('friend_username'))\
        .join(User, Friendship.addressee_id == User.id)\
        .filter(Friendship.requester_id == user_id, Friendship.status == 'accepted').all()

    # Friendships where user is addressee and status is 'accepted'
    received_accepted = db.session.query(Friendship, User.username.label('friend_username'))\
        .join(User, Friendship.requester_id == User.id)\
        .filter(Friendship.addressee_id == user_id, Friendship.status == 'accepted').all()
    
    friends_data = []
    processed_friend_ids = set()

    for friendship, friend_username in sent_accepted:
        friend_id = friendship.addressee_id
        if friend_id not in processed_friend_ids:
            friends_data.append({
                "id": friend_id, 
                "username": friend_username, 
                "online": friend_id in online_users_sids
            })
            processed_friend_ids.add(friend_id)

    for friendship, friend_username in received_accepted:
        friend_id = friendship.requester_id
        if friend_id not in processed_friend_ids:
            friends_data.append({
                "id": friend_id, 
                "username": friend_username, 
                "online": friend_id in online_users_sids
            })
            processed_friend_ids.add(friend_id)
            
    return friends_data


@friend_bp.route('/friends', methods=['GET'])
@jwt_required()
def list_friends():
    current_user_id = get_jwt_identity()
    return jsonify(get_user_friends_data(current_user_id)), 200


@friend_bp.route('/friends/requests', methods=['GET'])
@jwt_required()
def list_friend_requests():
    current_user_id = get_jwt_identity()
    # List pending requests where current_user is the addressee
    requests = Friendship.query.join(User, Friendship.requester_id == User.id)\
        .filter(Friendship.addressee_id == current_user_id, Friendship.status == 'pending')\
        .add_columns(User.username.label('requester_username'))\
        .all()
    
    requests_data = [{
        "request_id": fr.id, 
        "requester_id": fr.requester_id, 
        "requester_username": username
        } for fr, username in requests]
    return jsonify(requests_data), 200

@friend_bp.route('/friends/send_request/<int:addressee_user_id>', methods=['POST'])
@jwt_required()
def send_friend_request(addressee_user_id):
    requester_id = get_jwt_identity()
    
    if requester_id == addressee_user_id:
        return jsonify({"msg": "Cannot send friend request to yourself"}), 400

    addressee = User.query.get(addressee_user_id)
    if not addressee:
        return jsonify({"msg": "User to add not found"}), 404

    # Check if a request already exists (in either direction) or if they are already friends
    existing_friendship = Friendship.query.filter(
        or_(
            (Friendship.requester_id == requester_id) & (Friendship.addressee_id == addressee_user_id),
            (Friendship.requester_id == addressee_user_id) & (Friendship.addressee_id == requester_id)
        )
    ).first()

    if existing_friendship:
        if existing_friendship.status == 'accepted':
            return jsonify({"msg": "You are already friends with this user"}), 409
        elif existing_friendship.status == 'pending':
            # If current user is addressee, they can accept. If requester, it's already sent.
            if existing_friendship.requester_id == addressee_user_id: # They sent you a request
                return jsonify({"msg": f"{addressee.username} has already sent you a friend request. Please check your requests."}), 409
            else: # You already sent them one
                return jsonify({"msg": "Friend request already sent"}), 409
        elif existing_friendship.status == 'declined':
            # Allow re-requesting after a decline by deleting the old one or updating
            db.session.delete(existing_friendship)
            db.session.commit() # Commit deletion before adding new one

    new_request = Friendship(requester_id=requester_id, addressee_id=addressee_user_id, status='pending')
    db.session.add(new_request)
    db.session.commit()

    # Notify the addressee via WebSocket if they are online
    addressee_sid = online_users_sids.get(addressee_user_id)
    requester_user = User.query.get(requester_id)
    if addressee_sid and requester_user:
        socketio.emit('friend_request_received', {
            "request_id": new_request.id,
            "requester_id": requester_id,
            "requester_username": requester_user.username
        }, room=addressee_sid)

    return jsonify({"msg": f"Friend request sent to {addressee.username}"}), 201


@friend_bp.route('/friends/respond_request/<int:request_id>', methods=['POST'])
@jwt_required()
def respond_friend_request(request_id):
    current_user_id = get_jwt_identity()
    data = request.get_json()
    response_status = data.get('status') # 'accepted' or 'declined'

    if response_status not in ['accepted', 'declined']:
        return jsonify({"msg": "Invalid status. Must be 'accepted' or 'declined'."}), 400

    friend_request = Friendship.query.get(request_id)

    if not friend_request:
        return jsonify({"msg": "Friend request not found"}), 404
    
    if friend_request.addressee_id != current_user_id:
        return jsonify({"msg": "This is not your friend request to respond to"}), 403
    
    if friend_request.status != 'pending':
        return jsonify({"msg": f"This friend request is already {friend_request.status}"}), 409

    friend_request.status = response_status
    db.session.commit()

    # Notify the original requester about the response
    requester_sid = online_users_sids.get(friend_request.requester_id)
    addressee_user = User.query.get(current_user_id)

    if requester_sid and addressee_user:
        socketio.emit('friend_request_responded', {
            "request_id": friend_request.id,
            "addressee_id": current_user_id,
            "addressee_username": addressee_user.username,
            "status": response_status
        }, room=requester_sid)
        
        # If accepted, also notify both to update their friend lists
        if response_status == 'accepted':
            # Notify requester
            socketio.emit('friend_list_update', get_user_friends_data(friend_request.requester_id), room=requester_sid)
            # Notify addressee (self)
            self_sid = online_users_sids.get(current_user_id)
            if self_sid:
                socketio.emit('friend_list_update', get_user_friends_data(current_user_id), room=self_sid)


    return jsonify({"msg": f"Friend request {response_status}"}), 200

@friend_bp.route('/users/search', methods=['GET'])
@jwt_required()
def search_users():
    query = request.args.get('q', '')
    current_user_id = get_jwt_identity()
    if not query or len(query) < 2: # Require at least 2 chars for search
        return jsonify([]), 200
    
    # Search for users by username, excluding self
    users = User.query.filter(User.username.ilike(f'%{query}%'), User.id != current_user_id).limit(10).all()
    users_data = [{"id": user.id, "username": user.username} for user in users]
    return jsonify(users_data), 200