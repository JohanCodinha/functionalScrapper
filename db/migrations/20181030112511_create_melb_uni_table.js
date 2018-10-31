
exports.up = function(knex, Promise) {
  return knex.schema.createTable('uniMelb', function (t) {
    t.increments('id').primary()
    t.string('url').notNullable()
    t.text('html').notNullable()
    t.jsonb('data')
    t.timestamps(false, true)
  })  
};

exports.down = function(knex, Promise) {
 return knex.schema.dropTableIfExists('uniMelb') 
};
