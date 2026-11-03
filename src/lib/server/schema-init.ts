import type { Sql } from "postgres";

const NOW_UTC = "to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')";

async function columnNames(sql: Sql, table: string): Promise<Set<string>> {
  const rows = await sql<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
  `;
  return new Set(rows.map((row) => row.column_name));
}

async function ensureColumn(sql: Sql, table: string, column: string, definition: string) {
  if (!(await columnNames(sql, table)).has(column)) {
    await sql.unsafe(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export async function ensureSchema(sql: Sql) {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'friend',
      pin TEXT NOT NULL DEFAULT '',
      avatar_initials TEXT NOT NULL DEFAULT '??',
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC}),
      password_hash TEXT NOT NULL DEFAULT '',
      share_all_friends INTEGER NOT NULL DEFAULT 0,
      custom_item_fixed_eur DOUBLE PRECISION,
      custom_item_percent DOUBLE PRECISION,
      custom_haul_percent DOUBLE PRECISION,
      disabled INTEGER NOT NULL DEFAULT 0,
      must_setup INTEGER NOT NULL DEFAULT 0,
      email TEXT,
      bio TEXT NOT NULL DEFAULT '',
      handle TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC}),
      expires_at TEXT,
      setup_only INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      weidian_url TEXT DEFAULT '',
      source_platform TEXT DEFAULT 'Yupoo',
      seller TEXT DEFAULT '',
      title TEXT NOT NULL,
      brand TEXT DEFAULT '—',
      category TEXT DEFAULT 'Apparel / Item',
      available_sizes TEXT DEFAULT '',
      chosen_size TEXT DEFAULT '',
      color_variant TEXT DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1,
      price_cny DOUBLE PRECISION,
      shipping_cny DOUBLE PRECISION DEFAULT 0,
      stage TEXT NOT NULL DEFAULT 'submitted',
      order_status TEXT NOT NULL DEFAULT 'Pending',
      description TEXT DEFAULT '',
      user_notes TEXT DEFAULT '',
      admin_notes TEXT DEFAULT '',
      tracking_number TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      local_image TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC}),
      updated_at TEXT NOT NULL DEFAULT (${NOW_UTC}),
      is_shared INTEGER NOT NULL DEFAULT 0,
      custom_fee_fixed_eur DOUBLE PRECISION,
      custom_fee_percent DOUBLE PRECISION
    );

    CREATE TABLE IF NOT EXISTS login_codes (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      purpose TEXT NOT NULL,
      name TEXT,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC})
    );

    CREATE TABLE IF NOT EXISTS order_shares (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shared_with_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC}),
      UNIQUE(owner_id, shared_with_user_id)
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      brand TEXT DEFAULT '—',
      category TEXT DEFAULT 'Apparel / Item',
      available_sizes TEXT DEFAULT '',
      description TEXT DEFAULT '',
      price_cny DOUBLE PRECISION,
      image_url TEXT DEFAULT '',
      local_image TEXT DEFAULT '',
      source_platform TEXT DEFAULT 'Yupoo',
      seller TEXT DEFAULT '',
      source_url TEXT NOT NULL DEFAULT '',
      weidian_url TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC}),
      updated_at TEXT NOT NULL DEFAULT (${NOW_UTC})
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      chosen_size TEXT DEFAULT '',
      color_variant TEXT DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC})
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'awaiting_payment',
      ship_name TEXT DEFAULT '',
      ship_street TEXT DEFAULT '',
      ship_zip TEXT DEFAULT '',
      ship_city TEXT DEFAULT '',
      ship_country TEXT DEFAULT '',
      subtotal_cny DOUBLE PRECISION NOT NULL DEFAULT 0,
      subtotal_eur DOUBLE PRECISION NOT NULL DEFAULT 0,
      item_fees_eur DOUBLE PRECISION NOT NULL DEFAULT 0,
      haul_fee_percent DOUBLE PRECISION NOT NULL DEFAULT 0,
      haul_fee_eur DOUBLE PRECISION NOT NULL DEFAULT 0,
      shipping_eur DOUBLE PRECISION NOT NULL DEFAULT 0,
      total_eur DOUBLE PRECISION NOT NULL DEFAULT 0,
      crypto_currency TEXT DEFAULT '',
      crypto_address TEXT DEFAULT '',
      crypto_txid TEXT DEFAULT '',
      admin_notes TEXT DEFAULT '',
      tracking_number TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC}),
      updated_at TEXT NOT NULL DEFAULT (${NOW_UTC})
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      chosen_size TEXT DEFAULT '',
      color_variant TEXT DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1,
      price_cny DOUBLE PRECISION,
      base_eur DOUBLE PRECISION,
      fee_eur DOUBLE PRECISION NOT NULL DEFAULT 0,
      line_total_eur DOUBLE PRECISION NOT NULL DEFAULT 0,
      local_image TEXT DEFAULT '',
      seller TEXT DEFAULT '',
      source_url TEXT DEFAULT '',
      weidian_url TEXT DEFAULT '',
      fulfillment_status TEXT NOT NULL DEFAULT 'pending',
      tracking_number TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC})
    );

    CREATE TABLE IF NOT EXISTS scrape_sources (
      id SERIAL PRIMARY KEY,
      seller_url TEXT NOT NULL,
      label TEXT DEFAULT '',
      interval_hours INTEGER NOT NULL DEFAULT 24,
      per_run_limit INTEGER NOT NULL DEFAULT 20,
      active INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT,
      last_status TEXT NOT NULL DEFAULT '',
      last_message TEXT NOT NULL DEFAULT '',
      last_added INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC}),
      updated_at TEXT NOT NULL DEFAULT (${NOW_UTC})
    );

    CREATE TABLE IF NOT EXISTS gram_posts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id INTEGER,
      title TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      image TEXT NOT NULL DEFAULT '',
      published INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC})
    );

    CREATE TABLE IF NOT EXISTS gram_looks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 0,
      result_image TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC})
    );

    CREATE TABLE IF NOT EXISTS gram_look_items (
      look_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (look_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS gram_messages (
      id SERIAL PRIMARY KEY,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC})
    );

    CREATE TABLE IF NOT EXISTS gram_invites (
      id SERIAL PRIMARY KEY,
      from_user_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC})
    );

    CREATE TABLE IF NOT EXISTS gram_follows (
      follower_id INTEGER NOT NULL,
      followed_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC}),
      PRIMARY KEY (follower_id, followed_id)
    );

    CREATE TABLE IF NOT EXISTS gram_likes (
      user_id INTEGER NOT NULL,
      target_kind TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC}),
      PRIMARY KEY (user_id, target_kind, target_id)
    );

    CREATE TABLE IF NOT EXISTS gram_comments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      target_kind TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC})
    );

    CREATE TABLE IF NOT EXISTS gram_saved (
      user_id INTEGER NOT NULL,
      target_kind TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC}),
      PRIMARY KEY (user_id, target_kind, target_id)
    );

    CREATE TABLE IF NOT EXISTS gram_stories (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      media TEXT NOT NULL,
      media_kind TEXT NOT NULL DEFAULT 'image',
      caption TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC}),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gram_notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      actor_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      target_kind TEXT NOT NULL DEFAULT '',
      target_id INTEGER NOT NULL DEFAULT 0,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC})
    );

    CREATE TABLE IF NOT EXISTS gram_reels (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      video TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      published INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (${NOW_UTC})
    );
  `);

  // Nachtraegliche Spalten (Migration bestehender Datenbanken)
  await ensureColumn(sql, "users", "password_hash", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(sql, "users", "share_all_friends", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(sql, "users", "custom_item_fixed_eur", "DOUBLE PRECISION");
  await ensureColumn(sql, "users", "custom_item_percent", "DOUBLE PRECISION");
  await ensureColumn(sql, "users", "custom_haul_percent", "DOUBLE PRECISION");
  await ensureColumn(sql, "users", "disabled", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(sql, "users", "must_setup", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(sql, "users", "email", "TEXT");
  await ensureColumn(sql, "users", "bio", "TEXT NOT NULL DEFAULT ''");
  await ensureColumn(sql, "users", "handle", "TEXT");
  await ensureColumn(sql, "sessions", "expires_at", "TEXT");
  await ensureColumn(sql, "sessions", "setup_only", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(sql, "items", "is_shared", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(sql, "items", "custom_fee_fixed_eur", "DOUBLE PRECISION");
  await ensureColumn(sql, "items", "custom_fee_percent", "DOUBLE PRECISION");

  await sql.unsafe(
    "CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(email) WHERE email IS NOT NULL"
  );
  // Dedupe: ein Produkt pro Quell-URL (leere URLs duerfen mehrfach vorkommen)
  await sql.unsafe(
    "CREATE UNIQUE INDEX IF NOT EXISTS products_source_url_unique ON products(source_url) WHERE source_url <> ''"
  );
  // Ein Warenkorb-Eintrag pro User + Produkt + Groesse
  await sql.unsafe(
    "CREATE UNIQUE INDEX IF NOT EXISTS cart_items_user_product_size_unique ON cart_items(user_id, product_id, chosen_size)"
  );
  await sql.unsafe(
    "CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items(order_id)"
  );
  await sql.unsafe(
    "CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id)"
  );
  // Jede Seller-URL darf nur einmal als Scrape-Quelle existieren
  await sql.unsafe(
    "CREATE UNIQUE INDEX IF NOT EXISTS scrape_sources_seller_url_unique ON scrape_sources(seller_url)"
  );

  // Handles fuer bestehende Nutzer vergeben
  const people = await sql<{ id: number; name: string; handle: string | null }[]>`
    SELECT id, name, handle FROM users
  `;
  const taken = new Set(people.map((p) => (p.handle || "").toLowerCase()).filter(Boolean));
  for (const person of people) {
    if (person.handle) continue;
    const base =
      person.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "user";
    let handle = base;
    let n = 2;
    while (taken.has(handle)) handle = `${base}-${n++}`;
    taken.add(handle);
    await sql`UPDATE users SET handle = ${handle} WHERE id = ${person.id}`;
  }
  await sql.unsafe(
    "CREATE UNIQUE INDEX IF NOT EXISTS users_handle_unique ON users(handle) WHERE handle IS NOT NULL"
  );
}
