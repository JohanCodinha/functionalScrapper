exports.up = function (knex, Promise) {
  return knex.schema.createTable('scrappedEvents', function (t) {
    t.increments('id').primary()
    t.string('uri').notNullable()
    t.string('type').notNullable()
    t.text('html').notNullable()
    t.jsonb('data')
    //t.timestamp('created_at').defaultTo(knex.fn.now())
  })
}

exports.down = function (knex, Promise) {
  return knex.schema.dropTableIfExists('scrappedEvents')
}
