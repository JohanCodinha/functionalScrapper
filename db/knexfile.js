module.exports = {
  client: 'pg',
  connection: {
    host : process.env.HOST, //'localhost',
    user : process.env.USER, // 'johan',
    password : process.env.USER, //  your_database_password',
    database : process.env.DB // johan'
  }
}

