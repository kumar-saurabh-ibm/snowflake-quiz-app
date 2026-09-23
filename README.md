# Snowflake Quiz

Minimal HTML/CSS/JavaScript quiz frontend connected to the supplied API.

API:
https://coavjcqfvd.execute-api.us-west-2.amazonaws.com/Stage-1

Run locally:
python -m http.server 5500

Then open:
http://localhost:5500

The app handles the current Lambda response where `body` is a JSON string and the questions are inside `objects[].content[]`.

If the browser reports CORS, enable CORS for the API Gateway route/stage.
