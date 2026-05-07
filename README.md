# Sabixa Frontend

Vite + React frontend for the Sabixa Sprint 2 MVP. Deploy `frontend/` as its own Vercel project and point it at the separately deployed backend.

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Set `VITE_API_BASE_URL` to your backend base URL, for example:

```text
https://your-backend-project.vercel.app/api/v1
```

## Build

```bash
npm run build
```

## MVP Coverage

- Employer intake and generated hiring need
- Skill map and three-task assessment pack
- Candidate onboarding and work-sample scoring
- Skill passport and improvement route
- Ranked shortlist and trial-task overlap check
- Prototype feedback capture and review
