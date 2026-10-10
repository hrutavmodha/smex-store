#! /home/hrutav-modha/.nvm/versions/node/v22.22.3/bin/node

import { execSync } from 'node:child_process'
import { argv } from 'node:process'

execSync(`
    git add .
    git commit -m "${argv[2]}"
    git push origin main
`)