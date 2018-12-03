const { Async, curry, compose } = require('crocks')
const { prop, construct, invoker, tap, path, replace, toUpper } = require('ramda')
const fs = require('fs')
const crypto = require('crypto')
const { JSDOM } = require('jsdom')

const axios = require('axios')
const hash = string => crypto.createHash('md5').update(string).digest('hex')

const generateDOM = construct(JSDOM)

const capitalize = replace(/^./, toUpper);

const tapLog = curry(
  (label, data) => tap(_ => {
    console.log(`${label}: ${JSON.stringify(data, null, ' ')}`)
  })(data)
)

const log = compose(
  console.log,
  x => JSON.stringify(x, null, ' ')
)

const $$ = query => compose(
  Array.from,
  invoker(1, 'querySelectorAll')(query)
)

const $ = query => compose(
  invoker(1, 'querySelector')(query)
)

const getDocument = path(['window', 'document'])

const stringToDoc = compose(
  getDocument,
  generateDOM
)

// readFile :: string -> Async e string
const readFile = name => Async((rej, res) => {
  fs.readFile(name, 'utf8', (err, cont) => {
    return err ? rej(err) : res(cont)
  })
})

// writeFile :: string -> {} -> Async e {}
const writeFile = curry(
  (name, data) => Async((rej, res) => {
    fs.writeFile(name, data, 'utf8', (err) => err ? rej(err) : res(data))
  })
)

const httpGet = url => Async((rej, res) => axios.get(url).then(res, res)).map(prop('data'))

const httpGetCached = url =>
  readFile(`${hash(url)}.html`)
    .alt(httpGet(url)
      .chain(writeFile(`./${hash(url)}.html`))
    )

module.exports = {
  httpGetCached,
  httpGet,
  hash,
  readFile,
  writeFile,
  tapLog,
  log,
  $$,
  $,
  getDocument,
  stringToDoc,
  capitalize
}
