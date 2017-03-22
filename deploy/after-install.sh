# deploy/after-install.sh
#!/bin/bash
source /home/ec2-user/.bash_profile
npm install
sudo chown -R ec2-user /var/node/grumbler
sudo chgrp -R ec2-user /var/node/grumbler
chmod -R 755 /var/node/grumbler
cd /var/node/grumbler
pm2 start /var/node/grumbler/index.js --name='grumbler'
