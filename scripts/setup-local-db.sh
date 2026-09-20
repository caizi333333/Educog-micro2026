#!/usr/bin/env bash

# 启动隔离的本地 PostgreSQL，写入仅开发环境读取的配置，并初始化演示数据。
# 该脚本拒绝任何非 localhost 数据库地址，避免把本地验证动作写入云端数据库。

set -Eeuo pipefail

LOCAL_DATABASE_URL='postgresql://educog_user:educog_password@127.0.0.1:5432/educog_micro?schema=public'
DEVELOPMENT_ENV_FILE='.env.development.local'
INIT_ADMIN_PASSWORD='LocalAdminOnly#2026'
INIT_TEACHER_PASSWORD='LocalTeacherOnly#2026'
INIT_STUDENT_PASSWORD='LocalStudentOnly#2026'
INIT_DEMO_PASSWORD='LocalDemoOnly#2026'

case "$LOCAL_DATABASE_URL" in
  postgresql://*@127.0.0.1:5432/educog_micro*) ;;
  *)
    echo '错误：本地数据库地址未通过安全校验，已停止。' >&2
    exit 1
    ;;
esac

if ! command -v docker >/dev/null 2>&1; then
  echo '错误：未安装 Docker。' >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo '错误：未安装 Docker Compose。' >&2
  exit 1
fi

echo '启动本地 PostgreSQL 容器…'
"${COMPOSE[@]}" up -d postgres

echo '等待本地数据库就绪…'
for attempt in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U educog_user -d educog_micro >/dev/null 2>&1; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    echo '错误：本地数据库未在预期时间内就绪。' >&2
    "${COMPOSE[@]}" logs postgres
    exit 1
  fi
  sleep 1
done

# 保留开发者已有的其他本地配置，只替换数据库和种子账号密码。
touch "$DEVELOPMENT_ENV_FILE"
temp_env="$(mktemp)"
grep -Ev '^(DATABASE_URL|INIT_ADMIN_PASSWORD|INIT_TEACHER_PASSWORD|INIT_STUDENT_PASSWORD|INIT_DEMO_PASSWORD)=' \
  "$DEVELOPMENT_ENV_FILE" >"$temp_env" || true
cat >>"$temp_env" <<EOF
DATABASE_URL="$LOCAL_DATABASE_URL"
INIT_ADMIN_PASSWORD="$INIT_ADMIN_PASSWORD"
INIT_TEACHER_PASSWORD="$INIT_TEACHER_PASSWORD"
INIT_STUDENT_PASSWORD="$INIT_STUDENT_PASSWORD"
INIT_DEMO_PASSWORD="$INIT_DEMO_PASSWORD"
EOF
mv "$temp_env" "$DEVELOPMENT_ENV_FILE"
chmod 600 "$DEVELOPMENT_ENV_FILE"

if [ ! -d node_modules ]; then
  echo '安装项目依赖…'
  npm install
fi

run_local() {
  DATABASE_URL="$LOCAL_DATABASE_URL" \
  INIT_ADMIN_PASSWORD="$INIT_ADMIN_PASSWORD" \
  INIT_TEACHER_PASSWORD="$INIT_TEACHER_PASSWORD" \
  INIT_STUDENT_PASSWORD="$INIT_STUDENT_PASSWORD" \
  INIT_DEMO_PASSWORD="$INIT_DEMO_PASSWORD" \
  "$@"
}

echo '同步本地数据库结构…'
run_local npx prisma generate
run_local npx prisma db push

echo '写入本地演示数据…'
run_local npx prisma db seed

cat <<'EOF'

本地验证数据库已经就绪：
  地址：127.0.0.1:5432/educog_micro
  开发覆盖配置：.env.development.local
  演示教师：demo_teacher
  演示学生：demo_student

运行 npm run dev 后，Next.js 会优先读取上述开发覆盖配置。
EOF
