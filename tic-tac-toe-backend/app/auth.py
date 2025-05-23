from flask import Blueprint, request, jsonify
from werkzeug.security import check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from .models import db, User

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"msg": "Username and password required"}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"msg": "Username already exists"}), 409

    new_user = User(username=username)
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.commit()

    return jsonify({
        "msg": "User created successfully",
        "user_id": new_user.id
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    user = User.query.filter_by(username=username).first()

    if not user or not user.check_password(password):
        return jsonify({"msg": "Bad username or password"}), 401

    access_token = create_access_token(identity=str(user.id))
    return jsonify(access_token=access_token,
                   user_id=user.id,
                   username=user.username), 200


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_me():
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404
    return jsonify({
        "id": user.id,
        "username": user.username,
        "wins": user.wins
    }), 200


@auth_bp.route('/scoreboard', methods=['GET'])
def scoreboard():
    # Get top 10 players by wins, or all if fewer than 10
    top_players = User.query.order_by(User.wins.desc()).limit(10).all()
    scoreboard_data = [{
        "username": user.username,
        "wins": user.wins
    } for user in top_players]
    return jsonify(scoreboard_data), 200
