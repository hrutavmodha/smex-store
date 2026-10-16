#! /home/hrutav-modha/.nvm/versions/node/v22.22.3/bin/node

import { readdirSync, readFileSync } from 'fs'

let mdLoc = 0
let tsLoc = 0
let tsTestLoc = 0
let otherLoc = 0

/**
 * 
 * @param {string} filePath 
 * @returns number
 */
function cloc(filePath) {
    return readFileSync(filePath).toString().split('\n').length
}

/**
 * 
 * @param {string} dirName 
 */
function clocDir(dirName) {
    const dirEnt = readdirSync(dirName, { 
        withFileTypes: true
    })

    for (let entry of dirEnt) {
        const entryName = entry.name

        if (entry.isFile()) {
            if (entryName.endsWith('.md')) {
                mdLoc += cloc(`${dirName}/${entryName}`)
            } else if (entryName.endsWith('.test.ts')) {
                tsTestLoc += cloc(`${dirName}/${entryName}`)
            } else if (entryName.endsWith('.ts')) {
                tsLoc += cloc(`${dirName}/${entryName}`)
            } else {
                otherLoc += cloc(`${dirName}/${entryName}`)
            }
        } else if (entry.isDirectory()) {
            if (entryName !== 'node_modules' && entryName !== '.next' && entryName !== 'dist') {
                clocDir(`${dirName}/${entryName}`)
            }
        }
    }
}

clocDir('client')
clocDir('docs')
clocDir('server')

console.table({
    'MarkDown': mdLoc,
    'TypeScript': tsLoc,
    'TypeScript Test': tsTestLoc
})

console.log('Total LOC in CodeBase:', mdLoc + tsLoc + tsTestLoc)