#!/bin/bash
set -e

SERVER_IP="${SERVER_IP:-REPLACE_WITH_SERVER_IP}"
SERVER_USER="${SERVER_USER:-multisigmonitor}"
DOMAIN="${DOMAIN:-REPLACE_WITH_DOMAIN}"
APP_DIR="/opt/multisigmonitor"

echo "🚀 Starting deployment to $SERVER_IP..."

if [ "$SERVER_IP" = "REPLACE_WITH_SERVER_IP" ]; then
    echo "❌ Error: SERVER_IP environment variable not set"
    echo "Usage: SERVER_IP=1.2.3.4 DOMAIN=yourdomain.com ./deploy.sh"
    exit 1
fi

if [ "$DOMAIN" = "REPLACE_WITH_DOMAIN" ]; then
    echo "❌ Error: DOMAIN environment variable not set"
    echo "Usage: SERVER_IP=1.2.3.4 DOMAIN=yourdomain.com ./deploy.sh"
    exit 1
fi

echo "📦 Building backend with Docker cross-compilation..."
docker buildx build --platform linux/amd64 -f Dockerfile.cross -t multisigmonitor-builder --load .
docker run --rm -v "$(pwd)/backend/target/release:/output" multisigmonitor-builder

echo "📦 Building frontend..."
cd frontend
rm -f .env.local
cp ../secrets/.env.frontend.prod .env.production
npm run build
cd ..

echo "📤 Creating deployment package..."
mkdir -p deploy_temp/frontend deploy_temp/backend/target/release deploy_temp/backend/migrations deploy_temp/backend/templates deploy_temp/secrets
cp backend/target/release/multisigmonitor-backend deploy_temp/backend/target/release/
cp backend/target/release/monitor-worker deploy_temp/backend/target/release/
cp -r frontend/dist/* deploy_temp/frontend/
cp ecosystem.prod.config.js deploy_temp/
cp secrets/.env.backend.prod deploy_temp/secrets/
cp secrets/.env.frontend.prod deploy_temp/secrets/
cp -r backend/migrations/* deploy_temp/backend/migrations/
cp -r backend/templates/* deploy_temp/backend/templates/

echo "📤 Uploading to server..."
ssh $SERVER_USER@$SERVER_IP "mkdir -p $APP_DIR/backend/target/release $APP_DIR/backend/templates $APP_DIR/frontend $APP_DIR/secrets $APP_DIR/backend/logs"

rsync -avz --progress --delete \
  deploy_temp/backend/target/release/ \
  $SERVER_USER@$SERVER_IP:$APP_DIR/backend/target/release/

rsync -avz --progress --delete \
  deploy_temp/frontend/ \
  $SERVER_USER@$SERVER_IP:$APP_DIR/frontend/

rsync -avz --progress \
  deploy_temp/ecosystem.prod.config.js \
  deploy_temp/secrets/.env.backend.prod \
  deploy_temp/secrets/.env.frontend.prod \
  $SERVER_USER@$SERVER_IP:$APP_DIR/secrets/

rsync -avz --progress \
  deploy_temp/backend/migrations/ \
  $SERVER_USER@$SERVER_IP:$APP_DIR/backend/migrations/

rsync -avz --progress \
  deploy_temp/backend/templates/ \
  $SERVER_USER@$SERVER_IP:$APP_DIR/backend/templates/

rsync -avz deploy_temp/ecosystem.prod.config.js $SERVER_USER@$SERVER_IP:$APP_DIR/

echo "🔧 Setting up server environment..."
ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
set -e

export PATH="$HOME/.cargo/bin:$PATH"

cd /opt/multisigmonitor
chmod +x backend/target/release/multisigmonitor-backend
chmod +x backend/target/release/monitor-worker

if [ ! -d "backend/data" ]; then
    mkdir -p backend/data
fi

echo "Running database migrations..."
cd backend
if [ ! -f "data/multisigmonitor.db" ]; then
    touch data/multisigmonitor.db
fi

export DATABASE_URL="sqlite:./data/multisigmonitor.db"
if command -v sqlx &> /dev/null; then
    echo "Running migrations with sqlx-cli..."
    sqlx database create || true
    sqlx migrate run
else
    echo "WARNING: sqlx-cli not found, attempting migration via backend binary..."
    if [ -f "target/release/multisigmonitor-backend" ]; then
        timeout 5 ./target/release/multisigmonitor-backend || true
    fi
fi

cd ..

if pm2 list | grep -q "multisig-backend"; then
    echo "Reloading existing PM2 processes..."
    pm2 reload ecosystem.prod.config.js --update-env
else
    echo "Starting PM2 processes..."
    pm2 start ecosystem.prod.config.js
fi
pm2 save
pm2 startup | tail -n 1 | sudo bash || true

echo "✅ Application deployed and running"
ENDSSH

echo "🌐 Configuring Nginx..."
ssh $SERVER_USER@$SERVER_IP "bash -s" << ENDSSH
sudo bash -c "cat > /etc/nginx/sites-available/multisigmonitor" << 'EOF'
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        root /opt/multisigmonitor/frontend;
        try_files \\\$uri \\\$uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\\$host;
        proxy_cache_bypass \\\$http_upgrade;
        proxy_set_header X-Real-IP \\\$remote_addr;
        proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\\$scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/multisigmonitor /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

echo "🔒 Setting up SSL certificate..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || echo "⚠️  SSL setup skipped or failed - configure manually"

ENDSSH

rm -rf deploy_temp

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Application URL: https://$DOMAIN"
echo "📊 Monitor logs: ssh $SERVER_USER@$SERVER_IP 'cd $APP_DIR && pm2 logs'"
echo "📈 Check status: ssh $SERVER_USER@$SERVER_IP 'cd $APP_DIR && pm2 status'"
echo ""
