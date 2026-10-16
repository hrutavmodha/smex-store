#! /home/hrutav-modha/.nvm/versions/node/v22.22.3/bin/node

import { readdirSync, readFileSync } from 'fs'

let mdLoc = 0
let mdFiles = 0

let tsLoc = 0
let tsFiles = 0

let tsTestLoc = 0
let tsTestFiles = 0

let otherLoc = 0
let otherFiles = 0

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
                mdFiles++
            } else if (entryName.endsWith('.test.ts') || entryName.endsWith('.test.jsx') || entryName.endsWith('.test.tsx') ) {
                tsTestLoc += cloc(`${dirName}/${entryName}`)
                tsTestFiles++
            } else if (entryName.endsWith('.ts') || entryName.endsWith('.jsx') || entryName.endsWith('.tsx')) {
                tsLoc += cloc(`${dirName}/${entryName}`)
                tsFiles++
            } else {
                otherLoc += cloc(`${dirName}/${entryName}`)
                otherFiles++
            }
        } else if (entry.isDirectory()) {
            if (entryName !== 'node_modules' && entryName !== '.next' && entryName !== 'dist') {
                clocDir(`${dirName}/${entryName}`)
            }
        }
    }
}
/**
 * 
 * @param {{[key: string]: Array<any>}} dict 
 * @param {Array<string>} headings 
 */
function table(dict, headings) {
    process.stdout.write('| ')
    process.stdout.write('File Type')
    process.stdout.write('\t|\n')
    process.stdout.write('|---|\n')

    for (let key in dict) {
        process.stdout.write('| ')
        process.stdout.write(String(key))
        process.stdout.write('\t|\n')
    }
}

clocDir('.')

const dataTable = {
    'MarkDown': [mdLoc, mdFiles],
    'TypeScript': [tsLoc, tsFiles],
    'TS Test': [tsTestLoc, tsTestFiles],
    'Other Type': [otherLoc, otherFiles]
}

table(dataTable, ['Type'])