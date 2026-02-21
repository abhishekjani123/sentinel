#!/usr/bin/env bash
set -o errexit

cd frontend
npm install
npm run build
cd ..

cd backend
pip install -r requirements.txt
