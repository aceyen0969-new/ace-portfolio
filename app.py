import html
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import quote, unquote, urljoin, urlsplit, urlunsplit

import requests
import resend
from flask import Flask, jsonify, request, send_from_directory

app = Flask(__name__, static_folder="static", static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
GITHUB_USERNAME = "aceyen0969-new"
FEATURED_REPOSITORY = "quasar"
GITHUB_API = "https://api.github.com"
PROJECT_CACHE_SECONDS = 600
IMAGE_REQUEST_TIMEOUT = 5
IMAGE_WORKERS = 8

MARKDOWN_IMAGE_PATTERN = re.compile(
    r"!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))"
    r"(?:\s+(?:\"[^\"]*\"|'[^']*'))?\s*\)",
    re.IGNORECASE,
)
HTML_IMAGE_PATTERN = re.compile(
    r"<img\b[^>]*\bsrc\s*=\s*[\"']([^\"']+)[\"']",
    re.IGNORECASE,
)
GITHUB_BLOB_PATTERN = re.compile(
    r"^https://github\.com/([^/]+)/([^/]+)/blob/([^/]+)/(.+)$",
    re.IGNORECASE,
)

_projects_cache = None
_projects_cache_time = 0

FALLBACK_PROJECT = {
    "name": "quasar",
    "description": "My Discord AI assistant project, featuring multi-provider AI fallback and approval-based workflows.",
    "html_url": "https://github.com/aceyen0969-new/quasar",
    "language": "Python",
    "stargazers_count": 0,
    "forks_count": 0,
    "updated_at": "",
    "featured": True,
    "fallback": True,
    "image_url": None,
}


def github_headers():
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"

    return headers


def raw_file_url(owner, repository, branch, path):
    owner = quote(owner, safe="")
    repository = quote(repository, safe="")
    branch = quote(branch, safe="")
    path = quote(unquote(path).lstrip("/"), safe="/:@!$&'()*+,;=-._~")

    return (
        f"https://raw.githubusercontent.com/"
        f"{owner}/{repository}/{branch}/{path}"
    )


def preview_image_url(repository, branch):
    url = raw_file_url(
        GITHUB_USERNAME,
        repository,
        branch,
        "screenshots/preview.png",
    )

    try:
        response = requests.head(
            url,
            allow_redirects=True,
            headers={"User-Agent": "ace-portfolio"},
            timeout=IMAGE_REQUEST_TIMEOUT,
        )

        if response.status_code == 200:
            return response.url
    except requests.RequestException:
        app.logger.debug(
            "Preview image lookup failed for %s.",
            repository,
        )

    return None


def fetch_readme(repository, branch):
    filenames = ("README.md", "readme.md", "Readme.md")

    for filename in filenames:
        url = raw_file_url(
            GITHUB_USERNAME,
            repository,
            branch,
            filename,
        )

        try:
            response = requests.get(
                url,
                headers={"User-Agent": "ace-portfolio"},
                timeout=IMAGE_REQUEST_TIMEOUT,
            )

            if response.status_code == 200:
                return response.text, response.url
        except requests.RequestException:
            app.logger.debug(
                "README lookup failed for %s.",
                repository,
            )

    return None, None


def normalize_readme_image(source, readme_url, repository, branch):
    source = html.unescape(source.strip())

    if not source or source.startswith("#") or source.lower().startswith("data:"):
        return None

    if source.startswith("//"):
        source = f"https:{source}"

    match = GITHUB_BLOB_PATTERN.match(source)

    if match:
        owner, repo_name, image_branch, path = match.groups()
        return raw_file_url(owner, repo_name, image_branch, path)

    if source.startswith("/"):
        return raw_file_url(
            GITHUB_USERNAME,
            repository,
            branch,
            source,
        )

    parsed = urlsplit(source)

    if parsed.scheme:
        if parsed.scheme.lower() not in ("http", "https"):
            return None

        if parsed.scheme.lower() != "https":
            return None

        if not parsed.netloc:
            return None

        return urlunsplit(parsed)

    resolved = urljoin(readme_url, source)
    parsed = urlsplit(resolved)

    if parsed.scheme != "https" or not parsed.netloc:
        return None

    return urlunsplit(parsed)


def first_readme_image(readme, readme_url, repository, branch):
    candidates = []

    for match in MARKDOWN_IMAGE_PATTERN.finditer(readme):
        source = match.group(1) or match.group(2)
        candidates.append((match.start(), source))

    for match in HTML_IMAGE_PATTERN.finditer(readme):
        candidates.append((match.start(), match.group(1)))

    candidates.sort(key=lambda candidate: candidate[0])

    for _, source in candidates:
        image_url = normalize_readme_image(
            source,
            readme_url,
            repository,
            branch,
        )

        if image_url:
            return image_url

    return None


def discover_repository_image(repository, branch):
    image_url = preview_image_url(repository, branch)

    if image_url:
        return image_url

    readme, readme_url = fetch_readme(repository, branch)

    if not readme or not readme_url:
        return None

    return first_readme_image(
        readme,
        readme_url,
        repository,
        branch,
    )


def attach_project_images(projects):
    futures = {}

    with ThreadPoolExecutor(max_workers=IMAGE_WORKERS) as executor:
        for project in projects:
            project["image_url"] = None

            if project.get("fallback"):
                continue

            repository = project.get("name")
            branch = project.pop("_default_branch", "main")

            if not repository:
                continue

            future = executor.submit(
                discover_repository_image,
                repository,
                branch,
            )
            futures[future] = project

        for future in as_completed(futures):
            project = futures[future]

            try:
                project["image_url"] = future.result()
            except Exception:
                app.logger.exception(
                    "Image discovery failed for %s.",
                    project.get("name"),
                )
                project["image_url"] = None

    return projects


def fetch_github_projects():
    response = requests.get(
        f"{GITHUB_API}/users/{GITHUB_USERNAME}/repos",
        headers=github_headers(),
        params={
            "type": "owner",
            "sort": "updated",
            "direction": "desc",
            "per_page": 100,
            "page": 1,
        },
        timeout=15,
    )
    response.raise_for_status()
    repositories = response.json()

    if not isinstance(repositories, list):
        raise ValueError("GitHub returned an unexpected repository response.")

    projects = []

    for repository in repositories:
        if (
            repository.get("private")
            or repository.get("archived")
            or repository.get("disabled")
            or repository.get("fork")
        ):
            continue

        projects.append({
            "name": repository.get("name", "Untitled project"),
            "description": repository.get("description") or "No description provided yet.",
            "html_url": repository.get("html_url", ""),
            "language": repository.get("language") or "Other",
            "stargazers_count": repository.get("stargazers_count", 0),
            "forks_count": repository.get("forks_count", 0),
            "updated_at": repository.get("updated_at") or "",
            "featured": repository.get("name", "").lower() == FEATURED_REPOSITORY,
            "fallback": False,
            "image_url": None,
            "_default_branch": repository.get("default_branch") or "main",
        })

    if not any(project["featured"] for project in projects):
        response = requests.get(
            f"{GITHUB_API}/repos/{GITHUB_USERNAME}/{FEATURED_REPOSITORY}",
            headers=github_headers(),
            timeout=15,
        )
        response.raise_for_status()
        repository = response.json()

        if not repository.get("private"):
            projects.append({
                "name": repository.get("name", FEATURED_REPOSITORY),
                "description": repository.get("description") or FALLBACK_PROJECT["description"],
                "html_url": repository.get("html_url", FALLBACK_PROJECT["html_url"]),
                "language": repository.get("language") or "Python",
                "stargazers_count": repository.get("stargazers_count", 0),
                "forks_count": repository.get("forks_count", 0),
                "updated_at": repository.get("updated_at") or "",
                "featured": True,
                "fallback": False,
                "image_url": None,
                "_default_branch": repository.get("default_branch") or "main",
            })

    projects = attach_project_images(projects)

    projects.sort(
        key=lambda project: (
            not project["featured"],
            project["name"].lower(),
        )
    )

    return projects


def get_projects():
    global _projects_cache, _projects_cache_time

    current_time = time.time()

    if (
        _projects_cache is not None
        and current_time - _projects_cache_time < PROJECT_CACHE_SECONDS
    ):
        return _projects_cache, True

    try:
        projects = fetch_github_projects()
        _projects_cache = projects
        _projects_cache_time = time.time()
        return projects, True
    except (requests.RequestException, ValueError) as error:
        app.logger.warning("GitHub project fetch failed: %s", error)

        if _projects_cache is not None:
            return _projects_cache, False

        return [FALLBACK_PROJECT.copy()], False


@app.get("/")
def home():
    return send_from_directory("static", "index.html")


@app.get("/health")
def health():
    return jsonify({"status": "ok"}), 200


@app.get("/api/projects")
def projects():
    project_list, github_available = get_projects()
    return jsonify({
        "projects": project_list,
        "github_available": github_available,
    }), 200


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