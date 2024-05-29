#!/bin/bash

git pull

npm run installdeps
npm run dbpush
npm run dbgenerate

npm run build

sudo systemctl restart startdiscord.service