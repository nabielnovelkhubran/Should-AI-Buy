#!/usr/bin/env bash
set -e

echo "=== 1. Updating packages and installing essentials ==="
sudo apt-get update -y
sudo apt-get install -y curl git ufw

echo "=== 2. Creating 2GB Swap Memory (prevents OOM on t2.micro) ==="
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo "Swap created successfully!"
else
  echo "Swapfile already exists."
fi

echo "=== 3. Installing Node.js 20 LTS & PM2 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2

echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"
echo "PM2 version: $(pm2 -v)"

echo "=== 4. Installing dependencies & building project ==="
npm install
npm run build

echo "=== 5. Starting with PM2 ==="
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -n 1 | bash || true

echo "=== DEPLOYMENT COMPLETE! ==="
echo "Your app is running 24/7. Check status with: pm2 status"
