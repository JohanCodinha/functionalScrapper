const knexfile = require('./knexfile.js')
const knex = require('knex')(knexfile)
const {
  Async: { fromPromise },
  Async,
  constant: K,
  nAry,
  map,
  chain,
  pipe,
  compose
} = require('crocks')

const {
  isEmpty,
  ifElse
} = require('ramda')

// dbEntryMatchJson :: string -> html -> {}
const dbEntryMatchJson = nAry(2, fromPromise(
  (table, data) => knex(table).where({ data })
))

// dbInsertToTable :: string -> {} -> {}
const dbInsertToTable = nAry(2, fromPromise(
  (table, data) => knex(table).insert(data).then(K(data))
))

// saveToDb :: [Async] -> [String]
const saveToDb = pipe(
  map( // []
    chain(event => dbEntryMatchJson('scrappedEvents', event.data)
      .chain(ifElse(
        // knex return emtpy array if no found
        isEmpty,
        // if not in db flow. Parse page then insert and return
        compose(
          dbInsertToTable('scrappedEvents'),
          K(event)
        ),
        K(Async.of(`${event.uri} is already saved in db`))
      ))
    )
  ),
  Async.all
)

module.exports = {
  dbEntryMatchJson,
  dbInsertToTable,
  saveToDb
}
