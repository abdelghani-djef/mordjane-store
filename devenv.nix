{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:

let
  pgPort = config.services.postgres.port;
  dbUrl = db: "postgresql+asyncpg://mordjane:mordjane@127.0.0.1:${toString pgPort}/${db}";
in
{
  # https://devenv.sh/packages/
  packages = [
    pkgs.git
    # libstdc++ for binary wheels such as greenlet (picked up via languages.python.libraries)
    pkgs.stdenv.cc.cc.lib
  ];

  # https://devenv.sh/languages/
  # devenv owns the venv (.devenv/state/venv), built from its wrapped python so native
  # wheels find libstdc++; uv syncs backend/pyproject.toml into it on shell entry.
  languages.python = {
    enable = true;
    package = pkgs.python314;
    directory = "${config.devenv.root}/backend";
    venv.enable = true;
    uv = {
      enable = true;
      sync.enable = true;
      sync.allGroups = true;
    };
  };

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
    directory = "${config.devenv.root}/frontend";
    npm = {
      enable = true;
      install.enable = true;
    };
  };

  # https://devenv.sh/services/
  services.postgres = {
    enable = true;
    package = pkgs.postgresql_17;
    listen_addresses = "127.0.0.1";
    # 5432 is taken by the system postgresql service
    port = 5433;
    initialDatabases = [
      {
        name = "mordjane";
        user = "mordjane";
        pass = "mordjane";
      }
      {
        name = "mordjane_test";
        user = "mordjane";
        pass = "mordjane";
      }
    ];
  };

  # Local mail catcher: every email the shop sends lands in the inbox at http://localhost:8025
  # (SMTP on 1025). Nothing is delivered to real addresses.
  services.mailpit.enable = true;

  env = {
    UV_PYTHON_DOWNLOADS = "never";
    DATABASE_URL = dbUrl "mordjane";
    TEST_DATABASE_URL = dbUrl "mordjane_test";
    JWT_SECRET = "dev-only-jwt-secret-change-me-in-production";
    MEDIA_DIR = "${config.devenv.state}/media";
    BACKEND_URL = "http://127.0.0.1:8000";
    NEXT_TELEMETRY_DISABLED = "1";
    # Email: Mailpit in development; point these at a real SMTP provider in production.
    SMTP_HOST = "127.0.0.1";
    SMTP_PORT = "1025";
    MAIL_FROM = "Mordjane <orders@mordjane.local>";
    PUBLIC_SITE_URL = "http://localhost:3000";
  };

  # https://devenv.sh/processes/
  processes = {
    api = {
      exec = ''
        cd "$DEVENV_ROOT/backend"
        until pg_isready -q -h 127.0.0.1 -p ${toString pgPort}; do sleep 0.5; done
        uv run alembic upgrade head
        exec uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
      '';
      after = [ "devenv:processes:postgres" ];
    };
    web.exec = ''
      cd "$DEVENV_ROOT/frontend"
      exec npm run dev
    '';
  };

  # https://devenv.sh/scripts/
  scripts = {
    migrate.exec = ''cd "$DEVENV_ROOT/backend" && uv run alembic upgrade head'';
    seed.exec = ''cd "$DEVENV_ROOT/backend" && uv run python -m app.cli seed "$@"'';
    seed-cities.exec = ''cd "$DEVENV_ROOT/backend" && uv run python -m app.cli seed-cities'';
    sync-catalog.exec = ''cd "$DEVENV_ROOT/backend" && uv run python -m app.cli sync-catalog'';
    create-admin.exec = ''cd "$DEVENV_ROOT/backend" && uv run python -m app.cli create-admin "$@"'';
    gen-api.exec = ''cd "$DEVENV_ROOT/frontend" && npm run gen:api'';
  };

  enterShell = ''
    python --version
    node --version
    psql --version
  '';

  # https://devenv.sh/tests/
  enterTest = ''
    python --version | grep "3.14"
    node --version | grep "^v24"
    wait_for_port ${toString pgPort}
    psql "postgresql://mordjane:mordjane@127.0.0.1:${toString pgPort}/mordjane" -c "select 1"
    cd "$DEVENV_ROOT/backend" && uv run pytest -q
  '';
}
