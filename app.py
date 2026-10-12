import html
import os
import re

import resend
from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__, static_folder="static", static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@app.get("/")
def home():
    return send_from_directory("static", "index.html")


@app.get("/health")
def health():
    return jsonify({"status": "ok"}), 200


@app.post("/api/contact")
def contact():
    if not request.is_json:
        return jsonify({"error": "Please submit a valid form."}), 415

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid request."}), 400

    if data.get("company"):
        return jsonify({"success": True}), 200

    name = str(data.get("name", "")).strip()
    sender_email = str(data.get("email", "")).strip()
    message = str(data.get("message", "")).strip()

    if not name or not sender_email or not message:
        return jsonify({"error": "Please complete every field."}), 400

    if len(name) > 80:
        return jsonify({"error": "Your name is too long."}), 400

    if len(sender_email) > 150 or not EMAIL_PATTERN.fullmatch(sender_email):
        return jsonify({"error": "Enter a valid email address."}), 400

    if len(message) > 3000:
        return jsonify({"error": "Your message is too long."}), 400

    api_key = os.environ.get("RESEND_API_KEY")
    recipient = os.environ.get("CONTACT_RECEIVER_EMAIL")
    sender = os.environ.get("RESEND_FROM_EMAIL")

    if not api_key or not recipient or not sender:
        app.logger.error("Email service environment variables are missing.")
        return jsonify({
            "error": "The contact service is not configured yet. Please try again later."
        }), 503

    safe_name = html.escape(name)
    safe_email = html.escape(sender_email)
    safe_message = html.escape(message).replace("\n", "<br>")

    resend.api_key = api_key

    email_payload = {
        "from": sender,
        "to": [recipient],
        "reply_to": sender_email,
        "subject": f"ace.portfolio contact message from {name}",
        "text": (
            f"Name: {name}\n"
            f"Email: {sender_email}\n\n"
            f"Message:\n{message}"
        ),
        "html": (
            f"<h2>New ace.portfolio message</h2>"
            f"<p><strong>Name:</strong> {safe_name}</p>"
            f"<p><strong>Email:</strong> {safe_email}</p>"
            f"<p><strong>Message:</strong><br>{safe_message}</p>"
        ),
    }

    try:
        resend.Emails.send(email_payload)
    except Exception:
        app.logger.exception("Resend failed to deliver a contact message.")
        return jsonify({
            "error": "Your message could not be sent right now. Please try again later."
        }), 502

    return jsonify({
        "success": True,
        "message": "Your message was sent successfully."
    }), 200


@app.errorhandler(413)
def request_too_large(_error):
    return jsonify({"error": "Your submission is too large."}), 413


@app.errorhandler(404)
def not_found(_error):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Endpoint not found."}), 404

    return "Page not found.", 404


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "10000")),
        debug=False,
    )