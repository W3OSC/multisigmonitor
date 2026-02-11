#!/bin/bash
set -e

NODE_VERSION="22.13.1-1nodesource1"
PM2_VERSION="6.0.14"
RUST_VERSION="1.93.0"
NGINX_VERSION="1.22.1-9+deb12u3"

echo "🔧 Preparing production server..."
echo "Versions to install:"
echo "  - Node.js: $NODE_VERSION"
echo "  - PM2: $PM2_VERSION"
echo "  - Rust: $RUST_VERSION"
echo "  - Nginx: $NGINX_VERSION"
echo ""

echo "📦 Updating package lists..."
sudo apt-get update

echo "📦 Installing build essentials..."
sudo apt-get install -y curl build-essential pkg-config libssl-dev

echo "📦 Installing Node.js $NODE_VERSION..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
    sudo apt-get install -y nodejs=$NODE_VERSION
else
    CURRENT_NODE=$(node --version)
    echo "Node.js already installed: $CURRENT_NODE"
fi

echo "📦 Installing PM2 $PM2_VERSION..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2@$PM2_VERSION
else
    CURRENT_PM2=$(pm2 --version)
    echo "PM2 already installed: $CURRENT_PM2"
fi

echo "📦 Installing Rust $RUST_VERSION..."
if ! command -v cargo &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain $RUST_VERSION
    source "$HOME/.cargo/env"
    rustc --version
else
    CURRENT_RUST=$(rustc --version)
    echo "Rust already installed: $CURRENT_RUST"
fi

echo "📦 Installing nginx and certbot..."
sudo apt-get install -y nginx=$NGINX_VERSION certbot python3-certbot-nginx

echo "📁 Creating application directory..."
sudo mkdir -p /opt/multisigmonitor
sudo chown -R $(whoami):$(whoami) /opt/multisigmonitor

echo ""
echo "✅ Production server preparation complete!"
echo ""
echo "Installed versions:"
node --version
npm --version
pm2 --version
source "$HOME/.cargo/env" && rustc --version
/usr/sbin/nginx -v 2>&1 | head -1
certbot --version | head -1
echo ""
echo "Next steps:"
echo "  1. Ensure production environment files are configured:"
echo "     - secrets/.env.backend.prod"
echo "     - secrets/.env.frontend.prod"
echo "  2. Run deployment: SERVER_IP=<ip> SERVER_USER=<user> DOMAIN=<domain> make deploy"
