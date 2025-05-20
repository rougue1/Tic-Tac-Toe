from app import create_app, socketio, db

app = create_app()

if __name__ == '__main__':
    # When using eventlet or gevent, Flask's standard `app.run()` is replaced by `socketio.run()`
    # For development, this setup is fine. For production, use Gunicorn with eventlet or gevent worker.
    # Example: gunicorn --worker-class eventlet -w 1 run:app
    socketio.run(app, host='0.0.0.0', port=5001, debug=True, use_reloader=True)
    # Port 5001 to avoid conflict with default React dev port 3000.
    # use_reloader=True for dev, might be false in production/with some workers.