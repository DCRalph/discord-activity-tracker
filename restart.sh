#!/bin/bash

sudo systemctl stop startdiscord.service

git pull

npm run build

sudo systemctl start startdiscord.service