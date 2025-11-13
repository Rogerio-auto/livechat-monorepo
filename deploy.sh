#!/bin/bash

# Script de Deploy Automatizado
# Usage: ./deploy.sh [build|start|restart|stop|logs|update]

set -e

COMPOSE_FILE="docker-compose.prod.yml"
PROJECT_NAME="livechat"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se Docker está instalado
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo_error "Docker não está instalado!"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        echo_error "Docker Compose não está instalado!"
        exit 1
    fi
}

# Verificar arquivos .env
check_env_files() {
    if [ ! -f "backend/.env" ]; then
        echo_warn "backend/.env não encontrado. Copiando de .env.example..."
        cp backend/.env.example backend/.env
        echo_error "IMPORTANTE: Edite backend/.env com valores reais antes de continuar!"
        exit 1
    fi
    
    if [ ! -f "frontend/.env.production" ]; then
        echo_warn "frontend/.env.production não encontrado. Copiando de .env.example..."
        cp frontend/.env.example frontend/.env.production
        echo_error "IMPORTANTE: Edite frontend/.env.production com valores reais antes de continuar!"
        exit 1
    fi
}

# Build das imagens
build() {
    echo_info "Construindo imagens Docker..."
    docker-compose -f $COMPOSE_FILE build --no-cache
    echo_info "Build concluído!"
}

# Start dos serviços
start() {
    echo_info "Iniciando serviços..."
    docker-compose -f $COMPOSE_FILE up -d
    echo_info "Serviços iniciados!"
    echo_info "Aguardando serviços ficarem prontos..."
    sleep 10
    docker-compose -f $COMPOSE_FILE ps
}

# Restart dos serviços
restart() {
    echo_info "Reiniciando serviços..."
    docker-compose -f $COMPOSE_FILE restart
    echo_info "Serviços reiniciados!"
}

# Stop dos serviços
stop() {
    echo_info "Parando serviços..."
    docker-compose -f $COMPOSE_FILE down
    echo_info "Serviços parados!"
}

# Ver logs
logs() {
    docker-compose -f $COMPOSE_FILE logs -f
}

# Update completo (pull + build + restart)
update() {
    echo_info "Atualizando aplicação..."
    
    if [ -d ".git" ]; then
        echo_info "Fazendo pull do repositório..."
        git pull origin main
    fi
    
    echo_info "Parando serviços..."
    docker-compose -f $COMPOSE_FILE down
    
    echo_info "Reconstruindo imagens..."
    docker-compose -f $COMPOSE_FILE build --no-cache
    
    echo_info "Iniciando serviços..."
    docker-compose -f $COMPOSE_FILE up -d
    
    echo_info "Update concluído!"
}

# Verificar status
status() {
    docker-compose -f $COMPOSE_FILE ps
}

# Backup
backup() {
    BACKUP_DIR="./backups"
    mkdir -p $BACKUP_DIR
    DATE=$(date +%Y%m%d_%H%M%S)
    
    echo_info "Criando backup..."
    docker-compose -f $COMPOSE_FILE logs --no-color > "$BACKUP_DIR/logs_$DATE.txt"
    echo_info "Backup salvo em $BACKUP_DIR/logs_$DATE.txt"
}

# Main
main() {
    check_docker
    
    case "${1:-help}" in
        build)
            check_env_files
            build
            ;;
        start)
            check_env_files
            start
            ;;
        restart)
            restart
            ;;
        stop)
            stop
            ;;
        logs)
            logs
            ;;
        update)
            check_env_files
            update
            ;;
        status)
            status
            ;;
        backup)
            backup
            ;;
        *)
            echo "Usage: $0 {build|start|restart|stop|logs|update|status|backup}"
            echo ""
            echo "Commands:"
            echo "  build    - Constrói as imagens Docker"
            echo "  start    - Inicia os serviços"
            echo "  restart  - Reinicia os serviços"
            echo "  stop     - Para os serviços"
            echo "  logs     - Mostra os logs em tempo real"
            echo "  update   - Atualiza a aplicação (pull + build + restart)"
            echo "  status   - Mostra o status dos serviços"
            echo "  backup   - Cria backup dos logs"
            exit 1
            ;;
    esac
}

main "$@"
