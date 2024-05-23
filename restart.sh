#!/bin/bash

sudo systemctl stop startdiscord.service

git pull

npm run install
npm run db push
npm run dbgenerate

npm run build

sudo systemctl start startdiscord.service