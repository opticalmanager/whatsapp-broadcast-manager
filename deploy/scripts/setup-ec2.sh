#!/bin/bash
# ===================================================================
# One-Click EC2 Ubuntu Bootstrap Script
# ===================================================================
set -e

echo "=== 1. Updating Ubuntu Packages ==="
sudo apt update && sudo apt upgrade -y

echo "=== 2. Installing Node.js 20 LTS, Nginx, Git, and Build Tools ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git ufw certbot python3-certbot-nginx

echo "=== 3. Installing PM2 Process Manager ==="
sudo npm install -g pm2

echo "=== 4. Setting up Dedicated WhatsApp Sessions Directory ==="
sudo mkdir -p /var/data/whatsapp_sessions
sudo chown -R $USER:$USER /var/data/whatsapp_sessions
sudo chmod 755 /var/data/whatsapp_sessions

echo "=== 5. Configuring UFW Firewall ==="
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo "=== EC2 Bootstrap Completed Successfully! ==="
echo "You can now clone the repository into /var/www/whatsapp-broadcast"
