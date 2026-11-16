#!/bin/bash
set -e

if [ -z "$MYSQL_ROOT_PASSWORD" ] || [ -z "$MYSQL_APP_PASSWORD" ]; then
    echo "ERRO: variáveis de senha do MySQL não configuradas."
    exit 1
fi

echo "Criando bancos de dados do Adapti..."

mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL

CREATE DATABASE IF NOT EXISTS adapti_auth
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS adapti_user
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS adapti_quest
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'adapti_app'@'%'
    IDENTIFIED BY '${MYSQL_APP_PASSWORD}';

GRANT ALL PRIVILEGES ON adapti_auth.* TO 'adapti_app'@'%';
GRANT ALL PRIVILEGES ON adapti_user.* TO 'adapti_app'@'%';
GRANT ALL PRIVILEGES ON adapti_quest.* TO 'adapti_app'@'%';

FLUSH PRIVILEGES;

SQL

echo "Bancos de dados e permissões configurados com sucesso."
