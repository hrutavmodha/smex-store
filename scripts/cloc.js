#! /home/hrutav-modha/.nvm/versions/node/v22.22.3/bin/node

import { execSync } from 'node:child_process'

console.log(execSync('cloc . --exclude-ext=json,yaml,yml --exclude-dir=node_modules,.next,dist,coverage').toString('utf-8'))