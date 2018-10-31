const { Async, Async: { fromPromise }, curry, compose } = require('crocks')

const tapLog = curry((label, data) => (console.log(`${label}: ${data}`)))
const p = s => new Promise((res, _) => res(s))

// Async((rej, res) => {
//   res('resolved')
// })
fromPromise(p)('resolve')
  .map(compose(
    value => {
      console.log('in map')
      debugger;
      return value
    }
  ))
  .map(value => {
    console.log(value)
    throw new Error('inside map')
    return value
  })
  .fork(tapLog('error'), tapLog('ok'))
