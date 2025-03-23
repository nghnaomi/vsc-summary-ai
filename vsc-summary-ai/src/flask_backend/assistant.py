from flask import Flask, request, jsonify, render_template
from config import api_key
import openai
from git import Repo
from datetime import datetime, timedelta
import os
import sys

app = Flask(__name__)

OPENROUTER_API_KEY = api_key
client = openai.OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY
)

def get_commit_logs(repo_path, days=999):
    repo = Repo(repo_path)
    since = datetime.now() - timedelta(days=days)
    commits = list(repo.iter_commits(since=since.isoformat()))
    logs = []

    for commit in commits:
        if commit.parents:
            diff_index = commit.diff(commit.parents[0], create_patch=True)
            diff_summary = "\n".join([d.diff.decode('utf-8', errors='ignore') for d in diff_index])
        else:
            diff_summary = "(initial commit or no parent diff available)"
        logs.append({
            "message": commit.message.strip(),
            "author": commit.author.name,
            "date": datetime.fromtimestamp(commit.committed_date).isoformat(),
            "files_changed": commit.stats.files,
            "diff": diff_summary
        })
    return logs

def format_for_prompt(commits):
    prompt = "Developer Activity Summary:\n"
    for c in commits:
        prompt += f"- {c['date']} by {c['author']}\n"
        prompt += f"  Commit Message: {c['message']}\n"
        prompt += f"  Files Changed: {', '.join(c['files_changed'].keys())}\n"
        prompt += f"  Code Diff:\n{c['diff']}\n"
        prompt += "-" * 40 + "\n"
    return prompt

def get_summary_from_gpt(prompt_text):
    instructions = (
        "You are an assistant that summarizes a developer's Git activity.\n"
        "Organize the summary into the following sections:\n"
        "- ✅ Completed Work\n"
        "- 🛠 In Progress\n"
        "- 🔜 Planned or Upcoming Tasks\n"
        "- 📋 Notes or Observations\n"
        "Use commit messages and filenames to infer what work was done.\n"
        "If possible, group similar changes together. Be concise and helpful.\n\n"
    )
    
    full_prompt = instructions + prompt_text

    response = client.chat.completions.create(
        model="mistralai/mistral-7b-instruct",
        messages=[
            {"role": "user", "content": full_prompt}
        ]
    )
    return response.choices[0].message.content

def save_summary_to_file(summary, filename="weekly_summary.md"):
    with open(filename, "w") as f:
        f.write(summary)

@app.route("/")
def index():
    return "✅ Flask backend is running!"

@app.route("/generate", methods=["POST"])
def generate():
    try:
        data = request.get_json()
        repo_path = data.get("repo_path")

        if not repo_path:
            return jsonify({"error": "No repo_path provided"}), 400

        commits = get_commit_logs(repo_path)
        prompt = format_for_prompt(commits)
        summary = get_summary_from_gpt(prompt)

        return jsonify({"summary": summary})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)

