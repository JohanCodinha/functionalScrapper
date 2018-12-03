const {
  Async,
  Async: { fromPromise },
  compose,
  map,
  chain,
  tryCatch,
  resultToAsync,
  identity,
  pipe
} = require('crocks')

const { unnest, head, trim, prop, objOf, converge, mergeAll, concat, unapply, pathEq, filter, both, reduce, propEq, always: K, ifElse, isEmpty, propOr, omit } = require('ramda')

const {
  tapLog,
  log,
  httpGet,
  $$,
  $,
  stringToDoc
} = require('./helper')

const knexfile = require('./db/knexfile.js')
const knex = require('knex')(knexfile)
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

// dbEntryMatchJson :: string -> html -> {}
const dbEntryMatchJson = table => fromPromise(
  parsedPage => knex(table).where({ data: parsedPage })
)

// dbInsertToTable :: string -> {} -> {}
const dbInsertToTable = table => fromPromise(
  data => knex(table).insert(data).then(K(data))
)

// parsePage :: html -> Result e {}
const parsePage = tryCatch(compose(
  extractUniMelbData,
  stringToDoc
))

const flow = pipe(
  httpGet,
  map(pipe(
    extractEventsUri,
    map(uri => compose(httpGet, concat(DOMAIN))(uri)
      .chain(pageHtml => resultToAsync(parsePage(pageHtml))
        .chain(parsedPage => dbEntryMatchJson('uniMelb')(parsedPage)
          .bimap(error => ({error, message: "couldn't connect to db"}), identity)
          .chain(ifElse(
            // knex return emtpy array if no found
            isEmpty,
            // if not in db flow. Parse page then insert and return
            compose(
              map(omit(['html'])),
              dbInsertToTable('uniMelb'),
              K({
                uri,
                data: parsedPage,
                html: pageHtml
              })
            ),
            K(Async.of(`${uri} is already saved in db`))
          ))
        )
      )
    )
  )),
  chain(Async.all)
)

flow(DOMAIN + '/all')
  .fork(tapLog('error'), compose(() => process.exit(), log))
