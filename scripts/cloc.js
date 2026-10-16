#! /home/hrutav-modha/.nvm/versions/node/v22.22.3/bin/node

import { readdirSync, readFileSync } from 'fs'
import { chdir, cwd } from 'process'

const clientDir = readdirSync('client', { 
    withFileTypes: true
})
const serverDir = readdirSync('server', { 
    withFileTypes: true
})

let markDownLoc = 0;
let typeScriptLoc = 0;
let typeScriptTestLoc = 0;


/**
 * @param { string } directory
 */
function countLoc(directory) {
    const dir = readdirSync(directory, { 
        withFileTypes: true
    })

    chdir(directory)

    for (let element of dir) {
        if (element.isFile()) {
            const fileLoc = readFileSync(element.name).toString().split('\n').length

            if (element.name.endsWith('.md')) {
                markDownLoc += fileLoc
            } else if (element.name.endsWith('.ts')) {
                typeScriptLoc += fileLoc
            } else if (element.name.endsWith('.test.ts')) {
                typeScriptTestLoc += fileLoc
            }
        } else if (element.isDirectory()) {
            const dirName = element.name
            if (dirName !== 'node_modules' || dirName !== '.next') {
                countLoc(element.name)
            }
        }
    }
}

countLoc('client')