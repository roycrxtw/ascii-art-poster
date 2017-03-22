# deploy/before-install
#!/bin/bash
pm2 delete grumbler
cp /var/node/grumbler/config ~/backup/grumbler/
shopt -s extglob
rm -fr /var/node/grumbler/.gitignore
rm -fr /var/node/grumbler/!(config|node_modules)
shopt -u extglob
