const {
  compose,
  map,
  prop,
  unnest,
  //mergeAll,
  //converge,
  //unapply,
  objOf,
  pickBy,
  //pick,
  append,
  trim,
  isEmpty,
  complement,
  propEq,
  //filter,
  isNil,
  //reduce,
  allPass,
  //when,
  both,
  //merge,
  mergeLeft,
  toLower,
  or,
  pipe,
  ifElse,
  identity
} = require('ramda')

const {
  Async,
  prop: mprop,
  constant: K,
  chain,
  //curry,
  //either,
  //option,
  find,
  safe,
  bimap
} = require('crocks')

const {
  isValid: isValidDate,
  parse: parseDate
} = require('date-fns')

const {
  capitalize,
  tapLog,
  //log,
  //httpGet,
  $$,
  $,
  stringToDoc,
  httpGetCached
} = require('./helper')

const {
  dbEntryMatchJson,
  dbInsertToTable
} = require('./db/utils')

const extractNextPageURL = compose(
  mprop('href'),
  $('a.fb-next-result-page')
)

// getAllPages :: url -> Async e [dom]
const getAllPages = (pageURl, pages = []) => httpGetCached(pageURl)
  .map(stringToDoc)
  .chain(pageDoc => extractNextPageURL(pageDoc)
    .either(
      K(Async.of(append(pageDoc, pages))),
      href => getAllPages(href, append(pageDoc, pages))
    )
  )

// getEventsURL :: url -> Async e [url]
const getEventsURL = indexUrl => getAllPages(indexUrl)
  .map(
    // [dom] -> [url]
    pipe(
      map(
        // dom -> [url]
        pipe(
          $$('div.fb-results-wrapper div'),
          map(
            compose(
              prop('href'),
              $('h2 a')
            )
          )
        )
      ),
      unnest
    )
  )

const extractTitle = compose(
  map(objOf('title')),
  mprop('textContent'),
  $('h1')
)

const extractSubHeading = compose(
  map(objOf('subHeading')),
  chain(safe(complement(isEmpty))),
  map(trim),
  mprop('textContent'),
  $('div.event.event-all div.block > p')
)

const extractImage = compose(
  map(objOf('image')),
  mprop('src'),
  $('div.event.event-all div.block img')
)

const extractDates = compose(
  map(compose(
    pickBy(compose(
      isValidDate,
      parseDate
    ))
  )),
  mprop('dataset'),
  $('dl.event-details dd')
)

// extractMetaTag :: (String, String) -> Maybe {}
const extractMetaTag = (tagName, propName) => compose(
  chain(compose(
    map(objOf(or(propName, toLower(tagName)))),
    mprop('content')
  )),
  find(
    allPass([
      propEq('name', tagName),
      compose(
        both(
          complement(isNil),
          complement(isEmpty)
        ),
        prop('content')
      )
    ])
  ),
  $$('meta')
)

const extractPageData = extractFns => page =>
  extractFns.reduce((acc, item) => mergeLeft(acc, item(page).option({})), {})

const extractEventsData = getEventsURL('http://www.latrobe.edu.au/events/search-events')
  .map(map(uri => httpGetCached(uri)
    .map(html => pipe(
      stringToDoc,
      extractPageData(
        [
          extractMetaTag('Location'),
          extractMetaTag('Venue'),
          extractMetaTag('Cost'),
          extractMetaTag('Booking URL', 'bookingUrl'),
          extractMetaTag('description'),
          extractMetaTag('keywords'),
          extractMetaTag('audience'),
          extractMetaTag('author'),
          extractTitle,
          extractSubHeading,
          extractImage,
          extractDates
        ]
      ),
      objOf('data'),
      mergeLeft({html, uri})
    )(html))
  ))
  .chain(Async.all)

extractEventsData
  // .map(x => {debugger; return x})
  .map(map(event => dbEntryMatchJson('scrappedEvents', event)
    .chain(ifElse(
      // knex return emtpy array if no found
      isEmpty,
      // if not in db flow. Parse page then insert and return
      compose(
        dbInsertToTable('scrappedEvents'),
        K(mergeLeft(event, { type: 'eventScrapped' }))
      ),
      K(Async.of(`${event.uri} is already saved in db`))
    ))
  ))
  .chain(Async.all)
  .fork(
    tapLog('error'),
    tapLog('succes')
  )
