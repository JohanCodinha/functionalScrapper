const {
  compose,
  map,
  tryCatch,
  resultToAsync,
  pipe
} = require('crocks')

const {
  mergeLeft,
  objOf,
  unnest,
  head,
  trim,
  prop,
  converge,
  mergeAll,
  concat,
  unapply,
  pathEq,
  filter,
  both,
  reduce,
  propEq,
  always:
  propOr
} = require('ramda')

const {
  tapLog,
  log,
  httpGet,
  $$,
  $,
  stringToDoc
} = require('./helper')

const {
  saveToDb
} = require('./db/utils')

// const { isSameHour, getDate } = require('date-fns')

const extractEventsUri = compose(
  map(compose(
    prop('href'),
    $('a.col.ribbon-wrapper')
  )),
  unnest,
  map($$('ul li')),
  $$('.event-listing > li'),
  stringToDoc
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
  map(({ textContent, href }) => ({ name: textContent, link: href })),
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
    extractContact
  ]
)

// parsePage :: html -> Result e {}
const parsePage = tryCatch(compose(
  extractUniMelbData,
  stringToDoc
))

const extractEventsData = pipe(
  httpGet,
  map(pipe(
    extractEventsUri,
    map(uri => compose(httpGet, concat(DOMAIN))(uri)
      .chain(html => resultToAsync(parsePage(html))
        .map(compose(
          mergeLeft({ html, uri, type: 'eventScrapped' }),
          objOf('data')
        ))
      )
    )
  )
  )
)

const flow = extractEventsData(DOMAIN + '/all')
  .chain(saveToDb)

flow
  .fork(tapLog('error'), compose(() => process.exit(), log))
