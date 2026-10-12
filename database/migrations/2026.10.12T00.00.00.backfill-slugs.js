'use strict';

/**
 * Backfills the `slug` field on products and newsposts.
 *
 * Strapi 5 gives a published entry a new numeric id every time it is
 * republished, so the exirbc frontend can no longer look entries up by id.
 * It looks them up by slug instead. These slugs reproduce the URLs the site
 * already uses, so existing links keep working.
 */

// Product ids the frontend used before (exirbc data/product-category.ts).
const PRODUCT_SLUGS = {
  2: 'product',
  3: 'broadcasting',
  4: 'accessories',
  5: 'cable-clamps',
  6: 'rigid-line',
  7: 'measuring-equipment',
  8: 'power-loads',
  9: 'combiners',
  10: 'combiners-band-ii',
  11: 'combiners-band-iii',
  12: 'combiners-band-iv-v',
  14: 'filters',
  15: 'filters-band-ii',
  16: 'filters-band-iii',
  17: 'filters-band-iv-v',
  18: 'patch-panels',
  19: 'science',
  20: 'transmission-line',
  21: 'downloads',
  23: 'critical-communications-components',
};

// Same as the frontend's slugify, so news urls stay `${id}-${slugify(title)}`.
const slugify = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Sets the slug on the row with this id and, once Strapi 5 has added
// document ids, on every other version (draft/published) of the same entry.
async function setSlug(knex, table, id, slug) {
  const row = await knex(table).where({ id }).first();
  if (!row || row.slug) return;

  if (row.document_id) {
    await knex(table).where({ document_id: row.document_id }).whereNull('slug').update({ slug });
  } else {
    await knex(table).where({ id }).update({ slug });
  }
}

// This runs before Strapi's own v4 -> v5 migrations, one of which drops the
// `<table>_slug_unique` index that v4 created for uid fields (and aborts the
// transaction if it is missing), so the column is created the v4 way.
async function ensureSlugColumn(knex, table) {
  if (!(await knex.schema.hasColumn(table, 'slug'))) {
    await knex.schema.alterTable(table, (t) => t.string('slug').unique());
  }
}

module.exports = {
  async up(knex) {
    await ensureSlugColumn(knex, 'products');
    for (const [id, slug] of Object.entries(PRODUCT_SLUGS)) {
      await setSlug(knex, 'products', Number(id), slug);
    }

    await ensureSlugColumn(knex, 'newsposts');
    // Oldest id first: that is the original v4 row, whose id is in today's urls.
    const news = await knex('newsposts').whereNull('slug').orderBy('id').select('id', 'title');
    for (const { id, title } of news) {
      await setSlug(knex, 'newsposts', id, `${id}-${slugify(title || '')}`);
    }
  },
};
