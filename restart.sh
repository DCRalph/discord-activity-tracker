#!/bin/bash

sudo systemctl stop startdiscord.service

git pull

npm run installdeps
npm run db push
npm run dbgenerate

npm run build

sudo systemctl start startdiscord.service