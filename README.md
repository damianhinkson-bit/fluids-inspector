# Inspector Training — ENVH 112

An interactive multiple-choice game built on the ENVH 112 class notes from Barbados Community College. The student plays a trainee Environmental Health Inspector. Every answer she gives is logged to a Google Sheet.

| Unit | Cases | Questions |
|---|---|---|
| Unit 1 · Fluids | 11 | 84 |
| Unit 2 · Forces | 12 | 109 (with drawn motion graphs) |

Each unit has its own Final Inspection: 12 mixed questions with no hints. Both units are open from the start.

| File | What it is |
|---|---|
| `index.html` | **The game** — share this link with the student |
| `teacher.html` | **Your dashboard** — accuracy by topic, the questions she misses (and which wrong answers she picks), and a full activity timeline |
| `questions.js` | Unit 1 question bank |
| `questions-u2.js` | Unit 2 question bank. It also holds the `UNITS` list: to add Unit 3, make `questions-u3.js` and add it there and to both HTML pages |
| `config.js` | Holds your Google Apps Script URL |
| `apps-script/Code.gs` | Backend code you paste into Google Apps Script |

## 1. Put it on GitHub Pages
Go to the repo's **Settings → Pages → Source: Deploy from a branch → `main` / root**. The game will be live at
`https://<your-username>.github.io/fluids-inspector/`

## 2. Set up logging (one time, about 5 minutes)
1. Create a new Google Sheet, e.g. "Fluids Inspector — Log".
2. In the Sheet, go to **Extensions → Apps Script**, delete the sample code, and paste in `apps-script/Code.gs`. Save.
3. Pick `setup` from the function dropdown and click **Run**, then approve the permissions. Open **Execution log** and copy your **TEACHER KEY**.
4. Click **Deploy → New deployment → Web app**. Set *Execute as*: **Me** and *Who has access*: **Anyone**. Click **Deploy** and copy the URL that ends in `/exec`.
5. In GitHub, edit `config.js` and paste the URL in:
   `const LOG_URL = "https://script.google.com/macros/s/XXXX/exec";`

That's it. Answers appear in the **Log** tab as she plays. The **Summary** tab shows her first-try accuracy for each case and the questions she misses most.
On `…/teacher.html`, enter the teacher key to see the dashboard.

> If you later change `Code.gs`, use **Deploy → Manage deployments → Edit → New version**. That keeps the same URL.

## What gets logged
`session_start`, `case_start`, `answer` (her choice, the correct answer, attempt 1 or 2, whether she used a hint, time taken), `hint`, `case_complete`, `case_quit`, `final_complete`, `session_end`.

## Scoring
- 10 XP for a correct first try, 5 XP for a correct second try. Using a hint takes off 3 XP. XP is only awarded the first time she gets a question right.
- Stars come from first-try accuracy: 90% or more = ★★★, 70% or more = ★★, anything below = ★.
- Within a unit, each case unlocks after the one before it.
- Progress is saved in her browser. If a different name is typed on the same device, progress starts fresh.
