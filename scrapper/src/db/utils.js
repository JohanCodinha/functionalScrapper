const knexfile = require('./knexfile.js')
const knex = require('knex')(knexfile)
const {
  Async: { fromPromise },
  constant: K,
  nAry
} = require('crocks')

// dbEntryMatchJson :: string -> html -> {}
const dbEntryMatchJson = nAry(2, fromPromise(
  (table, data) => knex(table).where({ data })
))

// dbInsertToTable :: string -> {} -> {}
const dbInsertToTable = nAry(2, fromPromise(
  (table, data) => knex(table).insert(data).then(K(data))
))

module.exports = {
  dbEntryMatchJson,
  dbInsertToTable
}
