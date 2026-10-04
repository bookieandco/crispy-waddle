#!/usr/bin/env python3
"""Commission a private PostgreSQL 17 staging authority on a RunPod Pod.

This script is intended to be executed remotely with:
  runpodctl exec python scripts/jhadina-portable-runpod-postgres.py --pod_id <id>

It never exposes PostgreSQL publicly. The database binds to 127.0.0.1 and all
state, secrets, receipts, and the checked-out source tree live under /workspace,
which must be a dedicated persistent mount rather than the Pod root overlay.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import time
from urllib.parse import quote

ROOT = Path("/workspace/jhadina-portable")
PGDATA = ROOT / "postgres" / "data"
PGSOCKET = ROOT / "postgres" / "socket"
SECRETS = ROOT / "secrets"
RECEIPTS = ROOT / "receipts"
REPO = ROOT / "repo"
ADMIN_PASSWORD_FILE = SECRETS / "postgres-admin.password"
RUNTIME_PASSWORD_FILE = SECRETS / "postgres-runtime.password"
RUNTIME_ENV_FILE = SECRETS / "database.env"
POSTGRES_BIN = Path("/usr/lib/postgresql/17/bin")
ADMIN_USER = "jhadina_admin"
RUNTIME_USER = "jhadina_runtime"
DATABASE = "jhadina"
MIN_FREE_BYTES = 10 * 1024**3


def fail(code: str, detail: str = "") -> "None":
    message = code if not detail else f"{code}:{detail}"
    print(message, file=sys.stderr, flush=True)
    raise SystemExit(2)


def run(
    args: list[str],
    *,
    cwd: Path | None = None,
    env: dict[str, str] | None = None,
    capture: bool = False,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=str(cwd) if cwd else None,
        env=env,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
        check=check,
    )


def require_persistent_workspace() -> dict[str, str]:
    if not Path("/workspace").exists():
        fail("PORTABLE_RUNPOD_WORKSPACE_MISSING")
    result = run(
        ["findmnt", "-T", "/workspace", "-n", "-o", "TARGET,FSTYPE,SOURCE"],
        capture=True,
    )
    fields = result.stdout.strip().split(None, 2)
    if len(fields) < 2:
        fail("PORTABLE_RUNPOD_WORKSPACE_MOUNT_UNRESOLVED")
    target, fs_type = fields[0], fields[1]
    source = fields[2] if len(fields) > 2 else "unknown"
    if target != "/workspace" or fs_type.lower() in {"overlay", "tmpfs", "rootfs"}:
        fail("PORTABLE_RUNPOD_PERSISTENT_WORKSPACE_REQUIRED", result.stdout.strip())
    free = shutil.disk_usage("/workspace").free
    if free < MIN_FREE_BYTES:
        fail("PORTABLE_RUNPOD_WORKSPACE_FREE_SPACE_LOW", str(free))
    return {"target": target, "fsType": fs_type, "source": source, "freeBytes": str(free)}


def ensure_dirs() -> None:
    for path in (ROOT, PGDATA.parent, PGSOCKET, SECRETS, RECEIPTS):
        path.mkdir(parents=True, exist_ok=True)
    os.chmod(SECRETS, 0o700)
    os.chmod(RECEIPTS, 0o700)


def secret_file(path: Path) -> str:
    if path.exists():
        value = path.read_text().strip()
        if len(value) < 24:
            fail("PORTABLE_RUNPOD_SECRET_INVALID", path.name)
        return value
    value = secrets.token_urlsafe(36)
    path.write_text(value + "\n")
    os.chmod(path, 0o600)
    return value


def install_postgres17() -> None:
    env = os.environ.copy()
    env["DEBIAN_FRONTEND"] = "noninteractive"
    run(["apt-get", "update", "-qq"], env=env)
    run(
        [
            "apt-get",
            "install",
            "-y",
            "--no-install-recommends",
            "ca-certificates",
            "curl",
            "gnupg",
            "git",
            "supervisor",
            "util-linux",
        ],
        env=env,
    )
    if (POSTGRES_BIN / "postgres").exists():
        return
    key = Path("/usr/share/keyrings/postgresql-pgdg.asc")
    key.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            "curl",
            "-fsSL",
            "https://www.postgresql.org/media/keys/ACCC4CF8.asc",
            "-o",
            str(key),
        ]
    )
    os_release = {}
    for line in Path("/etc/os-release").read_text().splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            os_release[k] = v.strip().strip('"')
    codename = os_release.get("VERSION_CODENAME", "").strip()
    if not codename:
        fail("PORTABLE_RUNPOD_OS_CODENAME_REQUIRED")
    Path("/etc/apt/sources.list.d/pgdg.list").write_text(
        f"deb [signed-by={key}] https://apt.postgresql.org/pub/repos/apt {codename}-pgdg main\n"
    )
    run(["apt-get", "update", "-qq"], env=env)
    run(
        [
            "apt-get",
            "install",
            "-y",
            "--no-install-recommends",
            "postgresql-17",
            "postgresql-client-17",
        ],
        env=env,
    )
    if not (POSTGRES_BIN / "postgres").exists():
        fail("PORTABLE_RUNPOD_POSTGRES17_INSTALL_FAILED")


def run_as_postgres(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run(["runuser", "-u", "postgres", "--", *args], check=check)


def initialize_cluster(admin_password: str) -> None:
    if (PGDATA / "PG_VERSION").exists():
        if (PGDATA / "PG_VERSION").read_text().strip() != "17":
            fail("PORTABLE_RUNPOD_POSTGRES_VERSION_DRIFT")
        return
    PGDATA.mkdir(parents=True, exist_ok=True)
    PGSOCKET.mkdir(parents=True, exist_ok=True)
    run(["chown", "-R", "postgres:postgres", str(PGDATA.parent)])
    temp_pw = Path("/tmp/jhadina-postgres-admin.password")
    temp_pw.write_text(admin_password + "\n")
    os.chmod(temp_pw, 0o600)
    run(["chown", "postgres:postgres", str(temp_pw)])
    try:
        run_as_postgres(
            [
                str(POSTGRES_BIN / "initdb"),
                "-D",
                str(PGDATA),
                "--username",
                ADMIN_USER,
                "--pwfile",
                str(temp_pw),
                "--auth-local=scram-sha-256",
                "--auth-host=scram-sha-256",
                "--encoding=UTF8",
            ]
        )
    finally:
        temp_pw.unlink(missing_ok=True)

    with (PGDATA / "postgresql.conf").open("a") as handle:
        handle.write(
            "\n# Jhadina portable staging boundary\n"
            "listen_addresses = '127.0.0.1'\n"
            "port = 5432\n"
            f"unix_socket_directories = '{PGSOCKET}'\n"
            "password_encryption = 'scram-sha-256'\n"
        )


def configure_supervisor() -> None:
    log_dir = ROOT / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    conf = Path("/etc/supervisor/conf.d/jhadina-postgres.conf")
    conf.parent.mkdir(parents=True, exist_ok=True)
    conf.write_text(
        "[program:jhadina-postgres]\n"
        f"command={POSTGRES_BIN / 'postgres'} -D {PGDATA}\n"
        "user=postgres\n"
        "autostart=true\n"
        "autorestart=true\n"
        "startsecs=3\n"
        "stopsignal=INT\n"
        "stopasgroup=true\n"
        "killasgroup=true\n"
        f"stdout_logfile={log_dir / 'postgres.stdout.log'}\n"
        f"stderr_logfile={log_dir / 'postgres.stderr.log'}\n"
    )
    # Distro package initialization may have started an ephemeral default cluster.
    if shutil.which("pg_ctlcluster"):
        run(["pg_ctlcluster", "17", "main", "stop"], check=False)
    supervisor_status = run(["supervisorctl", "status"], capture=True, check=False)
    if supervisor_status.returncode != 0:
        run(["supervisord", "-c", "/etc/supervisor/supervisord.conf"])
        time.sleep(1)
    run(["supervisorctl", "reread"], check=False)
    run(["supervisorctl", "update"], check=False)
    run(["supervisorctl", "restart", "jhadina-postgres"], check=False)
    state = run(
        ["supervisorctl", "status", "jhadina-postgres"],
        capture=True,
        check=False,
    )
    if state.returncode != 0 or "RUNNING" not in state.stdout:
        # update may still be in its configured startsecs window; wait_ready is
        # the final truth, but a hard supervisor rejection should fail clearly.
        if "FATAL" in state.stdout or "BACKOFF" in state.stdout:
            fail("PORTABLE_RUNPOD_SUPERVISOR_REJECTED", state.stdout.strip())


def postgres_env(password: str) -> dict[str, str]:
    env = os.environ.copy()
    env["PGPASSWORD"] = password
    return env


def wait_ready(admin_password: str) -> None:
    env = postgres_env(admin_password)
    for _ in range(60):
        probe = run(
            [
                str(POSTGRES_BIN / "pg_isready"),
                "-h",
                "127.0.0.1",
                "-p",
                "5432",
                "-U",
                ADMIN_USER,
                "-d",
                "postgres",
            ],
            env=env,
            capture=True,
            check=False,
        )
        if probe.returncode == 0:
            return
        time.sleep(2)
    fail("PORTABLE_RUNPOD_POSTGRES_NOT_READY")


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def psql(
    admin_password: str,
    *,
    database: str = DATABASE,
    sql: str | None = None,
    file: Path | None = None,
    capture: bool = False,
    scalar: bool = False,
    single_transaction: bool = False,
) -> subprocess.CompletedProcess[str]:
    args = [
        str(POSTGRES_BIN / "psql"),
        "-h",
        "127.0.0.1",
        "-p",
        "5432",
        "-U",
        ADMIN_USER,
        "-d",
        database,
        "-v",
        "ON_ERROR_STOP=1",
    ]
    if scalar:
        args += ["--tuples-only", "--no-align"]
    if single_transaction:
        args += ["--single-transaction"]
    if file is not None:
        args += ["-f", str(file)]
    if sql is not None:
        args += ["-c", sql]
    return run(args, env=postgres_env(admin_password), capture=capture)


def ensure_database_and_runtime(admin_password: str, runtime_password: str) -> None:
    exists = psql(
        admin_password,
        database="postgres",
        sql=f"SELECT 1 FROM pg_database WHERE datname={sql_literal(DATABASE)};",
        capture=True,
        scalar=True,
    ).stdout.strip()
    if exists != "1":
        run(
            [
                str(POSTGRES_BIN / "createdb"),
                "-h",
                "127.0.0.1",
                "-p",
                "5432",
                "-U",
                ADMIN_USER,
                DATABASE,
            ],
            env=postgres_env(admin_password),
        )

    # Roles and pgcrypto must exist before Supabase-oriented migrations replay.
    compat = REPO / "infrastructure/portable/postgres-init/000_supabase_compat.sql"
    if not compat.exists():
        fail("PORTABLE_RUNPOD_COMPAT_MIGRATION_MISSING")
    psql(admin_password, file=compat)

    role_sql = f"""
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = {sql_literal(RUNTIME_USER)}) THEN
    EXECUTE 'CREATE ROLE {RUNTIME_USER} LOGIN PASSWORD ' || quote_literal({sql_literal(runtime_password)});
  ELSE
    EXECUTE 'ALTER ROLE {RUNTIME_USER} LOGIN PASSWORD ' || quote_literal({sql_literal(runtime_password)});
  END IF;
END
$$;
GRANT service_role TO {RUNTIME_USER};
"""
    psql(admin_password, sql=role_sql)
    psql(
        admin_password,
        sql="""
CREATE TABLE IF NOT EXISTS public.jhadina_portable_migration_ledger (
  migration_id TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL,
  source_revision TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
REVOKE ALL ON public.jhadina_portable_migration_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.jhadina_portable_migration_ledger TO service_role;
""",
    )

    runtime_url = (
        f"postgresql://{RUNTIME_USER}:{quote(runtime_password, safe='')}"
        f"@127.0.0.1:5432/{DATABASE}"
    )
    RUNTIME_ENV_FILE.write_text(
        f"DATABASE_URL={runtime_url}\n"
        "PGHOST=127.0.0.1\n"
        "PGPORT=5432\n"
        f"PGDATABASE={DATABASE}\n"
        f"PGUSER={RUNTIME_USER}\n"
    )
    os.chmod(RUNTIME_ENV_FILE, 0o600)


def checkout_main() -> str:
    if (REPO / ".git").exists():
        run(["git", "fetch", "--depth", "1", "origin", "main"], cwd=REPO)
        run(["git", "reset", "--hard", "origin/main"], cwd=REPO)
    else:
        if REPO.exists():
            shutil.rmtree(REPO)
        run(
            [
                "git",
                "clone",
                "--depth",
                "1",
                "--branch",
                "main",
                "https://github.com/bookieandco/crispy-waddle.git",
                str(REPO),
            ]
        )
    return run(["git", "rev-parse", "HEAD"], cwd=REPO, capture=True).stdout.strip()


def migration_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def apply_migration(
    admin_password: str,
    source_revision: str,
    migration_id: str,
    path: Path,
) -> str:
    if not path.exists():
        fail("PORTABLE_RUNPOD_MIGRATION_MISSING", migration_id)
    digest = migration_hash(path)
    lookup = psql(
        admin_password,
        sql=(
            "SELECT sha256 FROM public.jhadina_portable_migration_ledger "
            f"WHERE migration_id={sql_literal(migration_id)};"
        ),
        capture=True,
        scalar=True,
    ).stdout.strip()
    existing = lookup
    if existing:
        if existing != digest:
            fail("PORTABLE_RUNPOD_MIGRATION_DRIFT", migration_id)
        return "already-applied"

    ledger_insert = (
        "INSERT INTO public.jhadina_portable_migration_ledger"
        "(migration_id,sha256,source_revision) VALUES ("
        f"{sql_literal(migration_id)},{sql_literal(digest)},{sql_literal(source_revision)});"
    )
    # Migration + durable receipt are one transaction. A crash or SQL failure
    # cannot leave schema changes committed without their exact hash lineage.
    psql(
        admin_password,
        file=path,
        sql=ledger_insert,
        single_transaction=True,
    )
    return "applied"


def replay_schema(admin_password: str, source_revision: str) -> dict[str, int]:
    counts = {"memory": 0, "money": 0, "prerequisite": 0}

    memory = [
        "supabase/migrations/20260822000000_create_jhadina_memory_core.sql",
        "supabase/migrations/20260920030600_preserve_jhadina_memory_reasoning_lineage.sql",
        "supabase/migrations/20260920224800_jhadina_personality_outcome_lineage.sql",
        "supabase/migrations/20260923045337_personality_memory_final_lifecycle.sql",
    ]
    for relative in memory:
        apply_migration(admin_password, source_revision, relative, REPO / relative)
        counts["memory"] += 1

    money_dir = REPO / "packages/money-core/migrations"
    prerequisite = REPO / "infrastructure/portable/postgres-init/010_money_execution_attempts_prerequisite.sql"
    money_files = sorted(money_dir.glob("*.sql"))
    if not money_files:
        fail("PORTABLE_RUNPOD_MONEY_MIGRATIONS_MISSING")

    prerequisite_applied = False
    for path in money_files:
        rel = path.relative_to(REPO).as_posix()
        apply_migration(admin_password, source_revision, rel, path)
        counts["money"] += 1
        if path.name == "002_create_money_execution_permits.sql":
            pre_rel = prerequisite.relative_to(REPO).as_posix()
            apply_migration(admin_password, source_revision, pre_rel, prerequisite)
            counts["prerequisite"] += 1
            prerequisite_applied = True

    if not prerequisite_applied:
        fail("PORTABLE_RUNPOD_MONEY_PREREQUISITE_INSERTION_POINT_MISSING")
    return counts


def verify_schema(admin_password: str) -> list[str]:
    required = [
        "jhadina_memory_candidates",
        "jhadina_memories",
        "jhadina_reasoning_events",
        "jhadina_timeline_events",
        "money_coffers",
        "money_wallet_connections",
        "money_signer_leases",
        "money_market_connector_admissions",
        "money_purse_charters",
        "money_shark_runtime_ingress",
        "money_shark_coffer_runtime_runs",
        "money_dex_execution_attempts",
    ]
    missing: list[str] = []
    for table in required:
        result = psql(
            admin_password,
            sql=f"SELECT to_regclass('public.{table}');",
            capture=True,
            scalar=True,
        ).stdout.strip()
        if result != table:
            missing.append(table)
    if missing:
        fail("PORTABLE_RUNPOD_REQUIRED_TABLES_MISSING", ",".join(missing))
    return required


def main() -> int:
    if os.geteuid() != 0:
        fail("PORTABLE_RUNPOD_ROOT_REQUIRED")

    mount = require_persistent_workspace()
    ensure_dirs()
    install_postgres17()

    admin_password = secret_file(ADMIN_PASSWORD_FILE)
    runtime_password = secret_file(RUNTIME_PASSWORD_FILE)

    initialize_cluster(admin_password)
    configure_supervisor()
    wait_ready(admin_password)

    source_revision = checkout_main()
    ensure_database_and_runtime(admin_password, runtime_password)
    migration_counts = replay_schema(admin_password, source_revision)
    verified_tables = verify_schema(admin_password)

    version = psql(
        admin_password,
        sql="SHOW server_version;",
        capture=True,
        scalar=True,
    ).stdout.strip()
    receipt = {
        "kind": "JHADINA_PORTABLE_RUNPOD_POSTGRES",
        "passed": True,
        "authority": "STAGING_DATABASE_EVIDENCE_ONLY",
        "canExecute": False,
        "sourceRevision": source_revision,
        "workspaceMount": mount,
        "postgresMajor": 17,
        "postgresVersionObserved": version,
        "migrationCounts": migration_counts,
        "verifiedTableCount": len(verified_tables),
        "databaseEndpoint": "127.0.0.1:5432",
        "runtimeEnvFile": str(RUNTIME_ENV_FILE),
        "recordedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    receipt_path = RECEIPTS / f"postgres-{int(time.time())}.json"
    receipt_path.write_text(json.dumps(receipt, sort_keys=True, indent=2) + "\n")
    os.chmod(receipt_path, 0o600)
    print(json.dumps(receipt, sort_keys=True), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
