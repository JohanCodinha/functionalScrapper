const {
  Async,
  Async: { fromPromise },
  compose,
  map,
  curry,
  alt,
  tap,
  chain,
  bimap
} = require('crocks')
const { head, trim, toString, prop, objOf, converge, mergeAll, concat, invoker, pathr, path, flip, construct, unapply, pathEq, filter, allPass, both, reduce, propEq, always: K, ifElse, isEmpty, propOr } = require('ramda')
const { JSDOM } = require('jsdom')
const axios = require('axios')
const fs = require('fs')
const crypto = require('crypto')
const knexfile = require('./db/knexfile.js')
const knex = require('knex')(knexfile)
// const { isSameHour, getDate } = require('date-fns')

const hash = string => crypto.createHash('md5').update(string).digest("hex")

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

const httpGet = url => Async((rej, res) => axios.get(url).then(res, res))

const getUrl = url =>
  readFile(`${hash(url)}.html`)
    .alt(
      httpGet(url)
      .chain( res =>
        compose(
          writeFile(`./${hash(url)}.html`),
          prop('data'),
        )(res)
      ),
    )

const generateDOM = construct(JSDOM)
const tapLog = curry(
  (label, data) => tap(_=>{
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

const document = path(['window', 'document'])

const extractEventsUri = compose(
  map(prop('href')),
  map($('ul li a.col.ribbon-wrapper')),
  $$('.event-listing > li'),
  document,
  generateDOM
)

const extractTitle = compose(
  objOf('title'),
  prop('textContent'),
  $('div.upper.ribbon-wrapper h1')
)
const extractType = compose(
  objOf('type'),
  propOr('unknown content', 'textContent'),
  $('div.upper.ribbon-wrapper h2')
)

const extractTimestamp = compose(
  objOf('timestamps'),
  map(converge(unapply(mergeAll), [
    compose(objOf('date'), prop('dateTime')),
    compose(
      objOf('time'),
      trim,
      prop('textContent'),
      $('.event-time')
    )
  ])),
  $$('div.when.range time')  
)

const extractDescription = compose(
  objOf('description'),
  reduce((acc, node) => acc.concat(node.textContent), ''),
  filter(both(
    pathEq(['childNodes', 'length'], 1),
    pathEq(['childNodes', 0, 'nodeName'], '#text')
  )),
  Array.from,
  prop('childNodes'),
  $('div.lower')
)

const extractPresenters = compose(
  objOf('presenters'),
  map(({ textContent , href }) => ({ name: textContent, link: href })),
  $$('div.presenters a')
)

const extractTags = compose(
  objOf('tags'),
  map(({ title, href }) => ({ name: title, link: href })),
  $$('div.tags a')
)

const extractHeroImage = compose(
  objOf('heroImage'),
  prop('src'),
  $('img.hero')
)

const extractContact = compose(
  objOf('contact'),
  map(prop('textContent')),
  filter(propEq('nodeName', 'P')),
  prop('childNodes'),
  prop(2),
  prop('childNodes'),
  $('div.lower div.aside')
)

const extractLocation = compose(
  objOf('location'),
  prop('textContent'),
  head,
  prop('childNodes'),
  $('div.lower div.aside')
)

// stringToDoc :: String -> DOM
const stringToDoc = compose(
  document,
  generateDOM,
)

const DOMAIN = 'https://events.unimelb.edu.au'
const extractUniMelbData = converge(
  unapply(mergeAll),
  [
    extractTitle,
    extractType,
    extractTimestamp,
    extractHeroImage,
    extractDescription,
    extractPresenters,
    extractTags,
    extractLocation,
    extractContact,
  ] 
)

// dbEntryMatchHtml :: string -> html -> {}
const dbEntryMatchHtml = table => Async.fromPromise(
  html => {
    const data = parsePage(html)
    return knex(table).where({ data }).select('id')
     // .then(
     //   x => {console.log(data, x[0].data);debugger; return x},
     //   x => {console.log(data, table, html, x[0].data);debugger; return x})
    // tapLog('error db entry'))
  }
)

const dbInsertToTable = table => Async.fromPromise(
  data => {
    return knex(table).insert(data).then(K(data))
  })

//const dbInsertToTable = table => Async.fromPromise(
//  (data) => {
//    //console.log(data, table)
//    return knex(table).insert(data).then(_ => data)
//  }
//)
const parsePage = compose(
  extractUniMelbData,
  stringToDoc,
)

// get data -> save to db if not present 
getUrl(DOMAIN + '/all')
// Async e string -> Async e [String]
  .map(extractEventsUri)
// Async e [String] -> Async e [Async e {}]
  .map(

    // [String] -> Async e {}
    map(uri => compose(
      // chain(domString => compose(
      //   // {} -> Async
      //   chain(x => {
      //     console.log(x)
      //     debugger
      //     if (x.lenght === 0) {
      //       return dbInsertToTable('uniMelb')(x)
      //     }
      //     else {
      //       return Async.of('Already saved')
      //     }
      //   }),
      //   dbEntryMatchHtml('uniMelb'),
      //   // {} -> {}
      //   scrappedData => ({
      //     url: uri,
      //     data: scrappedData,
      //     html: domString 
      //   }),
      //   // DOM -> {}
      //   extractUniMelbData,
      //   // String -> DOM
      //   stringToDoc,
      // )(domString)),
      // Async e string -> Async e []
      chain(page => {
        return dbEntryMatchHtml('uniMelb')(page)
          .chain(ifElse(
            // knex return emtpy array if no found
            isEmpty,
            // if not in db flow. Parse page then insert and return 
            K(compose(
              map(K(`Saved to DB ${uri.slice(0, 20)}`)),
              dbInsertToTable('uniMelb'),
              scrappedData => ({
                url: uri,
                data: scrappedData,
                html: page 
              }),
              // x => {debugger; return x},
              parsePage,
            )(page)),
            K(Async.of(`${uri.slice(0, 20)} is already saved in db`))
          ))
      }
      ),
      // String -> Async
      getUrl,
      // String -> String
      concat(DOMAIN),
    )(uri)
    )
  )
//.map(x => {debugger; return x})
  .chain(Async.all)
// .map(x => JSON.stringify(x, null, ' '))
  .fork(tapLog('error'), compose( () => process.exit(), log))

