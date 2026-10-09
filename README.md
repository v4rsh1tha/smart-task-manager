# Smart Task Manager

A full-stack task manager. People register, sign in, and manage their own tasks with priorities. Admins can see and manage everyone's tasks. The whole app runs in Docker with one command.

Built with **React**, **Node.js / Express**, **MongoDB**, **Docker Compose** and **Nginx**.

## Screenshots

Add your screenshots to `docs/screenshots/` and they will show here.

| Sign in | Tasks |
<img width="1920" height="1080" alt="Screenshot (33)" src="https://github.com/user-attachments/assets/04aa1cda-8a9a-4460-a2d9-5ccadb3233c9" />
|---|
| ![Sign in](docs/screenshots/sign-in.png) | ![Tasks](docs/screenshots/tasks.png) |
<img width="1920" height="1080" alt="Screenshot (34)" src="https://github.com/user-attachments/assets/435491a3-4fd9-4bfc-b0a9-ecdd67a57afe" />


## Features

- **Secure sign-in:** register and sign in with validation on the page and again on the server, a password strength meter, show/hide password, and an optional "keep me signed in" (7-day session).
- **Task management:** add a task with a priority (low, medium, high), tick it off, or delete it. Open tasks are listed first, and summary numbers show Open, Completed and Total.
- **Roles:** a user sees only their own tasks. An admin sees every task, with the owner's name.
- **Security basics:** passwords stored as bcrypt hashes, JWT authentication, rate limiting on login, security headers (Helmet), a generic "email or password is incorrect" message so nobody can discover which emails exist, and a database that is reachable only from inside Docker.
- **Tested:** 22 API tests and 19 UI tests.
- **Operations scripts:** nightly database backup and restore, and optional HTTPS with Let's Encrypt.

## Tech stack

| Part | Technology |
|---|---|
| Frontend | React 18, Vite |
| Backend | Node.js, Express |
| Database | MongoDB (Mongoose) |
| Auth | bcrypt, JSON Web Tokens |
| Web server | Nginx (serves the app, forwards `/api` to the backend) |
| Packaging | Docker, Docker Compose |
| Tests | Node test runner (API), Vitest and Testing Library (UI) |
| CI/CD | GitHub Actions |

## How it works

```
Browser ──► Nginx (port 80/443) ──┬──► React app (static files)
                                  └──► /api ──► Express API ──► MongoDB
```

1. A person registers. The server saves a bcrypt hash of the password, never the password itself.
2. On sign-in the server returns a JWT containing the user's id and role.
3. The browser sends that token with every request. The API checks it, then applies the rules: users can only change their own tasks, and admins can change any task.

## Getting started

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows or Mac) or Docker with the Compose plugin (Linux).

**1. Create your `.env` file with random secrets**

Windows PowerShell:

```powershell
copy .env.example .env
$pw  = -join ((48..57)+(97..122) | Get-Random -Count 30 | % {[char]$_})
$jwt = -join ((48..57)+(97..122) | Get-Random -Count 30 | % {[char]$_})
(Get-Content .env) -replace '^MONGO_PASSWORD=.*', "MONGO_PASSWORD=$pw" -replace '^JWT_SECRET=.*', "JWT_SECRET=$jwt" | Set-Content .env -Encoding ascii
```

Linux or Mac:

```bash
./scripts/init-env.sh
```

**2. Start everything**

```bash
docker compose up -d --build
```

**3. Open the app** at http://localhost

Useful commands:

```bash
docker compose ps               # what is running
docker compose logs -f api      # watch the API logs
docker compose down             # stop (your data is kept)
```

### Make an admin

Register normally, then run this (Linux, Mac, or the VM shell):

```bash
source .env
docker compose exec mongo mongosh -u "$MONGO_USER" -p "$MONGO_PASSWORD" --authenticationDatabase admin smart-task-manager \
  --eval 'db.users.updateOne({email:"you@example.com"},{$set:{role:"admin"}})'
```

Sign out and back in to see the admin view.

## Running the tests

```bash
cd server && npm install && npm test     # 22 API tests (no database needed)
cd client && npm install && npm test     # 19 UI tests
```

## API

| Method | Route | Who can use it |
|---|---|---|
| POST | `/api/auth/register` | Anyone |
| POST | `/api/auth/login` | Anyone |
| GET | `/api/auth/me` | Signed-in users |
| GET | `/api/tasks` | Signed-in users (admins get all tasks) |
| POST | `/api/tasks` | Signed-in users |
| PUT | `/api/tasks/:id` | The task's owner, or an admin |
| DELETE | `/api/tasks/:id` | The task's owner, or an admin |
| GET | `/api/health` | Anyone (reports whether the database is up) |

## Configuration

Set in `.env` (see `.env.example`). Never commit this file.

| Variable | Meaning |
|---|---|
| `MONGO_USER` | Database admin username |
| `MONGO_PASSWORD` | Database password (letters and numbers only) |
| `JWT_SECRET` | Secret used to sign tokens (32+ random characters) |

## Deployment

The same Docker setup runs on any Linux server.

**On a Linux VM**

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER          # then log out and back in
git clone https://github.com/<your-username>/smart-task-manager.git
cd smart-task-manager
./scripts/init-env.sh
docker compose up -d --build
```

Open ports 80 and 443 in the server's firewall.

**HTTPS (optional, needs a domain name pointing at the server)**

```bash
./scripts/enable-https.sh yourdomain.example.com you@email.com
```

Certificates renew automatically.

**Database backups (optional)**

```bash
./scripts/backup.sh        # saves a compressed copy to ./backups, keeps the newest 7
```

Run it every night with cron:

```
0 2 * * * /home/<user>/smart-task-manager/scripts/backup.sh >> /home/<user>/backup.log 2>&1
```

Restore with `./scripts/restore.sh backups/<file>.archive.gz`.

**Automatic deploys**

The workflow in `.github/workflows/deploy.yml` runs the tests on every push to `main`, then deploys to a server over SSH. Add the repository secrets `VM_HOST`, `VM_USER` and `VM_SSH_KEY` to enable it.

## Project structure

```
server/     Express API: routes, models, middleware, tests
client/     React app: Auth.jsx (sign-in), Tasks.jsx (task page), tests
nginx/      Nginx configuration (HTTP, plus an HTTPS template)
scripts/    init-env.sh, enable-https.sh, backup.sh, restore.sh
docker-compose.yml
```

## Ideas for next steps

- Edit task titles and add due dates
- Refresh tokens and httpOnly cookies instead of browser storage
- Password reset by email
- Monitoring and an uptime alert for the `/api/health` endpoint

## Author

Built by Varshitha Chanda.
