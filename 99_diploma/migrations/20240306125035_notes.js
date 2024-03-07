/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.createTable("notes", (table) => {
        table.increments("id");
        table.integer("user_id").notNullable();
        table.foreign("user_id").references("users.id");
        table.string("title").notNullable();
        table.string("text");
        table.dateTime("created_at").notNullable().defaultTo(knex.fn.now());
        table.boolean("is_archive").notNullable().defaultTo(false);
      });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.dropTable("notes");
};
