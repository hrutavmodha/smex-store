#! /home/hrutav-modha/.nvm/versions/node/v22.22.3/bin/node

import { execSync } from 'child_process'

console.log(execSync(`cloc . --exclude-dir=node_modules,dist,.next,coverage,html --exclude-ext=json,yml,yaml`).toString('utf-8'))