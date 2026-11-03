import path from "path";
import type { Sql } from "postgres";
import { ensureDb, getSql } from "./db";

export const CACHE_DIR = process.env.FASHION_ORDERS_CACHE
  ? path.resolve(process.env.FASHION_ORDERS_CACHE)
  : path.resolve(process.cwd(), ".cache_images");

export type GramPerson = {
  id: number;
  name: string;
  handle: string;
  bio: string;
  avatar_initials: string;
};

async function db(): Promise<Sql> {
  await ensureDb();
  return getSql();
}

export async function personById(id: number): Promise<GramPerson | null> {
  const sql = await db();
  const rows = await sql<GramPerson[]>`
    SELECT id, name, handle, COALESCE(bio, '') AS bio, avatar_initials
    FROM users WHERE id = ${id} AND disabled = 0
  `;
  const row = rows[0];
  return row?.handle ? row : null;
}

export async function personByHandle(handle: string): Promise<GramPerson | null> {
  const sql = await db();
  const rows = await sql<GramPerson[]>`
    SELECT id, name, handle, COALESCE(bio, '') AS bio, avatar_initials
    FROM users WHERE LOWER(handle) = LOWER(${handle}) AND disabled = 0
  `;
  return rows[0] || null;
}

export async function searchUsers(query: string, selfId: number) {
  const q = query.trim().slice(0, 40).replace(/[%_]/g, "");
  if (q.length < 1) return [];
  const sql = await db();
  return sql<{ id: number; name: string; handle: string; avatar_initials: string }[]>`
    SELECT id, name, handle, avatar_initials
    FROM users
    WHERE disabled = 0 AND id != ${selfId}
      AND (name ILIKE ${"%" + q + "%"} OR handle ILIKE ${"%" + q + "%"})
    ORDER BY name
    LIMIT 12
  `;
}

export async function setBio(userId: number, bio: string) {
  const sql = await db();
  await sql`UPDATE users SET bio = ${bio.slice(0, 280)} WHERE id = ${userId}`;
}

export async function myItems(userId: number) {
  const sql = await db();
  return sql<{ id: number; title: string; brand: string; local_image: string }[]>`
    SELECT id, title, brand, COALESCE(local_image, '') AS local_image
    FROM items WHERE user_id = ${userId} ORDER BY id DESC
  `;
}

export async function myPosts(userId: number) {
  const sql = await db();
  return sql`
    SELECT id, item_id, title, caption, image, published, created_at
    FROM gram_posts WHERE user_id = ${userId} ORDER BY id DESC
  `;
}

export async function setItemVisible(
  userId: number,
  itemId: number,
  published: boolean,
  caption: string
) {
  const sql = await db();
  const items = await sql<{ id: number; title: string; local_image: string }[]>`
    SELECT id, title, COALESCE(local_image, '') AS local_image
    FROM items WHERE id = ${itemId} AND user_id = ${userId}
  `;
  const item = items[0];
  if (!item) return null;

  const existingRows = await sql<{ id: number }[]>`
    SELECT id FROM gram_posts WHERE user_id = ${userId} AND item_id = ${itemId}
  `;
  const existing = existingRows[0];

  const text = caption.slice(0, 500);
  if (existing) {
    await sql`
      UPDATE gram_posts SET published = ${published ? 1 : 0}, caption = ${text},
        title = ${item.title.slice(0, 300)}, image = ${item.local_image}
      WHERE id = ${existing.id}
    `;
    return existing.id;
  }

  const inserted = await sql<{ id: number }[]>`
    INSERT INTO gram_posts (user_id, item_id, title, caption, image, published)
    VALUES (${userId}, ${itemId}, ${item.title.slice(0, 300)}, ${text}, ${item.local_image}, ${published ? 1 : 0})
    RETURNING id
  `;
  return inserted[0].id;
}

export async function setPostVisible(userId: number, postId: number, published: boolean) {
  const sql = await db();
  const result = await sql`
    UPDATE gram_posts SET published = ${published ? 1 : 0}
    WHERE id = ${postId} AND user_id = ${userId}
  `;
  return result.count > 0;
}

export async function myLooks(userId: number) {
  const sql = await db();
  const looks = await sql<
    {
      id: number;
      title: string;
      published: number;
      result_image: string;
      status: string;
      created_at: string;
    }[]
  >`
    SELECT id, title, published, result_image, status, created_at
    FROM gram_looks WHERE user_id = ${userId} ORDER BY id DESC
  `;

  const result = [];
  for (const look of looks) {
    const items = await sql`
      SELECT i.id, i.title FROM gram_look_items li
      JOIN items i ON i.id = li.item_id
      WHERE li.look_id = ${look.id} ORDER BY li.position
    `;
    result.push({ ...look, items });
  }
  return result;
}

export async function createLook(userId: number, title: string, itemIds: number[]) {
  const unique = [...new Set(itemIds)].slice(0, 4);
  if (unique.length === 0) return null;
  const sql = await db();
  const owned = await sql<{ id: number; title: string; local_image: string }[]>`
    SELECT id, title, COALESCE(local_image, '') AS local_image
    FROM items WHERE user_id = ${userId} AND id IN ${sql(unique)}
  `;
  if (owned.length === 0) return null;

  const inserted = await sql<{ id: number }[]>`
    INSERT INTO gram_looks (user_id, title, status)
    VALUES (${userId}, ${title.slice(0, 80) || "Look"}, 'working')
    RETURNING id
  `;
  const lookId = inserted[0].id;
  for (const [index, item] of owned.entries()) {
    await sql`
      INSERT INTO gram_look_items (look_id, item_id, position)
      VALUES (${lookId}, ${item.id}, ${index})
    `;
  }
  return { id: lookId, items: owned };
}

export async function finishLook(userId: number, lookId: number, filename: string, status: string) {
  const sql = await db();
  await sql`
    UPDATE gram_looks SET result_image = ${filename}, status = ${status}
    WHERE id = ${lookId} AND user_id = ${userId}
  `;
}

export async function setLookVisible(userId: number, lookId: number, published: boolean) {
  const sql = await db();
  const rows = await sql<{ result_image: string; status: string }[]>`
    SELECT result_image, status FROM gram_looks WHERE id = ${lookId} AND user_id = ${userId}
  `;
  const look = rows[0];
  if (!look || look.status !== "ready" || !look.result_image) return false;
  await sql`
    UPDATE gram_looks SET published = ${published ? 1 : 0}
    WHERE id = ${lookId} AND user_id = ${userId}
  `;
  return true;
}

export type TargetKind = "post" | "look" | "reel";

export type FeedCard = {
  kind: TargetKind;
  id: number;
  title: string;
  caption: string;
  image: string;
  created_at: string;
  user_id: number;
  name: string;
  handle: string;
  avatar_initials: string;
  like_count: number;
  comment_count: number;
  liked: number;
  saved: number;
};

function key(kind: string, id: number) {
  return `${kind}:${id}`;
}

async function enrichCards<T extends { kind: string; id: number }>(
  viewerId: number,
  cards: T[]
): Promise<
  (T & {
    like_count: number;
    comment_count: number;
    liked: number;
    saved: number;
  })[]
> {
  const likes = new Map<string, number>();
  const comments = new Map<string, number>();
  const liked = new Set<string>();
  const savedSet = new Set<string>();
  const sql = await db();
  const kinds = [...new Set(cards.map((card) => card.kind))];
  for (const kind of kinds) {
    const ids = cards.filter((card) => card.kind === kind).map((card) => card.id);
    if (ids.length === 0) continue;
    const likeRows = await sql<{ target_id: number; c: number }[]>`
      SELECT target_id, COUNT(*)::int AS c FROM gram_likes
      WHERE target_kind = ${kind} AND target_id IN ${sql(ids)}
      GROUP BY target_id
    `;
    likeRows.forEach((row) => likes.set(key(kind, row.target_id), row.c));
    const commentRows = await sql<{ target_id: number; c: number }[]>`
      SELECT target_id, COUNT(*)::int AS c FROM gram_comments
      WHERE target_kind = ${kind} AND target_id IN ${sql(ids)}
      GROUP BY target_id
    `;
    commentRows.forEach((row) => comments.set(key(kind, row.target_id), row.c));
    const likedRows = await sql<{ target_id: number }[]>`
      SELECT target_id FROM gram_likes
      WHERE user_id = ${viewerId} AND target_kind = ${kind} AND target_id IN ${sql(ids)}
    `;
    likedRows.forEach((row) => liked.add(key(kind, row.target_id)));
    const savedRows = await sql<{ target_id: number }[]>`
      SELECT target_id FROM gram_saved
      WHERE user_id = ${viewerId} AND target_kind = ${kind} AND target_id IN ${sql(ids)}
    `;
    savedRows.forEach((row) => savedSet.add(key(kind, row.target_id)));
  }
  return cards.map((card) => ({
    ...card,
    like_count: likes.get(key(card.kind, card.id)) || 0,
    comment_count: comments.get(key(card.kind, card.id)) || 0,
    liked: liked.has(key(card.kind, card.id)) ? 1 : 0,
    saved: savedSet.has(key(card.kind, card.id)) ? 1 : 0,
  }));
}

export async function networkFeed(viewerId: number): Promise<FeedCard[]> {
  const sql = await db();
  const cards = await sql<Omit<FeedCard, "like_count" | "comment_count" | "liked" | "saved">[]>`
    SELECT kind, id, title, caption, image, created_at, user_id, name, handle, avatar_initials
    FROM (
      SELECT 'post' AS kind, p.id AS id, p.title AS title, p.caption AS caption,
             p.image AS image, p.created_at AS created_at,
             u.id AS user_id, u.name AS name, u.handle AS handle, u.avatar_initials AS avatar_initials
      FROM gram_posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.published = 1 AND p.image != '' AND u.disabled = 0 AND p.user_id != ${viewerId}
      UNION ALL
      SELECT 'look', l.id, l.title, '', l.result_image, l.created_at,
             u.id, u.name, u.handle, u.avatar_initials
      FROM gram_looks l
      JOIN users u ON u.id = l.user_id
      WHERE l.published = 1 AND l.status = 'ready' AND l.result_image != ''
        AND u.disabled = 0 AND l.user_id != ${viewerId}
    ) AS combined
    ORDER BY created_at DESC, id DESC
    LIMIT 40
  `;
  return enrichCards(viewerId, cards);
}

export async function memberProfile(handle: string, viewerId?: number) {
  const person = await personByHandle(handle);
  if (!person) return null;
  const sql = await db();
  const posts = await sql<
    { id: number; title: string; caption: string; image: string; created_at: string }[]
  >`
    SELECT id, title, caption, image, created_at
    FROM gram_posts WHERE user_id = ${person.id} AND published = 1 ORDER BY id DESC
  `;
  const looks = await sql<
    { id: number; title: string; result_image: string; created_at: string }[]
  >`
    SELECT id, title, result_image, created_at
    FROM gram_looks
    WHERE user_id = ${person.id} AND published = 1 AND status = 'ready'
    ORDER BY id DESC
  `;
  const reels = await sql<{ id: number; caption: string; video: string; created_at: string }[]>`
    SELECT id, caption, video, created_at
    FROM gram_reels WHERE user_id = ${person.id} AND published = 1 ORDER BY id DESC
  `;
  const counts = await followCounts(person.id);
  const mine = viewerId === person.id;
  return {
    person,
    posts: await enrichCards(
      viewerId || 0,
      posts.map((post) => ({ ...post, kind: "post" as const }))
    ),
    looks: await enrichCards(
      viewerId || 0,
      looks.map((look) => ({ ...look, kind: "look" as const, image: look.result_image, caption: "" }))
    ),
    reels: await enrichCards(
      viewerId || 0,
      reels.map((reel) => ({ ...reel, kind: "reel" as const, title: reel.caption, image: reel.video }))
    ),
    counts: {
      posts: posts.length + looks.length + reels.length,
      followers: counts.followers,
      following: counts.following,
    },
    is_following: viewerId ? await isFollowing(viewerId, person.id) : false,
    saved: mine && viewerId ? await savedTiles(viewerId) : [],
  };
}

export async function saveInvite(userId: number, email: string) {
  const sql = await db();
  await sql`INSERT INTO gram_invites (from_user_id, email) VALUES (${userId}, ${email})`;
}

export async function threadsFor(userId: number) {
  const sql = await db();
  const rows = await sql<
    {
      body: string;
      created_at: string;
      partner_id: number;
      name: string;
      handle: string;
      avatar_initials: string;
    }[]
  >`
    SELECT m.id, m.body, m.created_at,
           u.id AS partner_id, u.name, u.handle, u.avatar_initials
    FROM gram_messages m
    JOIN users u ON u.id = CASE WHEN m.from_user_id = ${userId} THEN m.to_user_id ELSE m.from_user_id END
    WHERE m.from_user_id = ${userId} OR m.to_user_id = ${userId}
    ORDER BY m.id DESC
    LIMIT 200
  `;

  const seen = new Set<number>();
  const threads = [];
  for (const row of rows) {
    if (seen.has(row.partner_id)) continue;
    seen.add(row.partner_id);
    threads.push(row);
  }
  return threads;
}

export async function conversation(userId: number, partnerId: number) {
  const sql = await db();
  return sql`
    SELECT id, from_user_id, to_user_id, body, created_at
    FROM gram_messages
    WHERE (from_user_id = ${userId} AND to_user_id = ${partnerId})
       OR (from_user_id = ${partnerId} AND to_user_id = ${userId})
    ORDER BY id ASC
    LIMIT 100
  `;
}

export async function sendMessage(fromId: number, toId: number, body: string) {
  const other = await personById(toId);
  if (!other || other.id === fromId) return null;
  const text = body.trim().slice(0, 1000);
  if (!text) return null;
  const sql = await db();
  const inserted = await sql<{ id: number }[]>`
    INSERT INTO gram_messages (from_user_id, to_user_id, body)
    VALUES (${fromId}, ${toId}, ${text})
    RETURNING id
  `;
  return { id: inserted[0].id, body: text, partner: other };
}

// ---------------------------------------------------------------------------
// Social graph: follows, likes, comments, saved, stories, notifications, reels
// ---------------------------------------------------------------------------

export async function followCounts(userId: number) {
  const sql = await db();
  const followers = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM gram_follows WHERE followed_id = ${userId}
  `;
  const following = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM gram_follows WHERE follower_id = ${userId}
  `;
  return { followers: followers[0].c, following: following[0].c };
}

export async function isFollowing(followerId: number, followedId: number): Promise<boolean> {
  const sql = await db();
  const rows = await sql`
    SELECT 1 FROM gram_follows WHERE follower_id = ${followerId} AND followed_id = ${followedId}
  `;
  return rows.length > 0;
}

export async function toggleFollow(followerId: number, followedId: number) {
  if (followerId === followedId) return null;
  const target = await personById(followedId);
  if (!target) return null;
  const sql = await db();
  if (await isFollowing(followerId, followedId)) {
    await sql`
      DELETE FROM gram_follows WHERE follower_id = ${followerId} AND followed_id = ${followedId}
    `;
    return { following: false, followers: (await followCounts(followedId)).followers };
  }
  await sql`
    INSERT INTO gram_follows (follower_id, followed_id) VALUES (${followerId}, ${followedId})
    ON CONFLICT DO NOTHING
  `;
  await notify(followedId, followerId, "follow", "", 0);
  return { following: true, followers: (await followCounts(followedId)).followers };
}

async function targetOwner(
  kind: TargetKind,
  targetId: number,
  viewerId: number
): Promise<number | null> {
  const sql = await db();
  let rows: { user_id: number; ok: number }[] = [];
  if (kind === "post") {
    rows = await sql`
      SELECT user_id, published AS ok FROM gram_posts WHERE id = ${targetId}
    `;
  } else if (kind === "look") {
    rows = await sql`
      SELECT user_id, published AS ok FROM gram_looks WHERE id = ${targetId} AND status = 'ready'
    `;
  } else if (kind === "reel") {
    rows = await sql`
      SELECT user_id, published AS ok FROM gram_reels WHERE id = ${targetId}
    `;
  }
  const row = rows[0];
  if (!row) return null;
  if (!row.ok && row.user_id !== viewerId) return null;
  return row.user_id;
}

export async function toggleLike(userId: number, kind: TargetKind, targetId: number) {
  const ownerId = await targetOwner(kind, targetId, userId);
  if (ownerId === null) return null;
  const sql = await db();
  const existing = await sql`
    SELECT 1 FROM gram_likes
    WHERE user_id = ${userId} AND target_kind = ${kind} AND target_id = ${targetId}
  `;
  if (existing.length > 0) {
    await sql`
      DELETE FROM gram_likes
      WHERE user_id = ${userId} AND target_kind = ${kind} AND target_id = ${targetId}
    `;
  } else {
    await sql`
      INSERT INTO gram_likes (user_id, target_kind, target_id)
      VALUES (${userId}, ${kind}, ${targetId})
      ON CONFLICT DO NOTHING
    `;
    await notify(ownerId, userId, "like", kind, targetId);
  }
  const count = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM gram_likes
    WHERE target_kind = ${kind} AND target_id = ${targetId}
  `;
  return { liked: existing.length === 0, count: count[0].c };
}

export async function toggleSave(userId: number, kind: TargetKind, targetId: number) {
  const ownerId = await targetOwner(kind, targetId, userId);
  if (ownerId === null) return null;
  const sql = await db();
  const existing = await sql`
    SELECT 1 FROM gram_saved
    WHERE user_id = ${userId} AND target_kind = ${kind} AND target_id = ${targetId}
  `;
  if (existing.length > 0) {
    await sql`
      DELETE FROM gram_saved
      WHERE user_id = ${userId} AND target_kind = ${kind} AND target_id = ${targetId}
    `;
    return { saved: false };
  }
  await sql`
    INSERT INTO gram_saved (user_id, target_kind, target_id)
    VALUES (${userId}, ${kind}, ${targetId})
    ON CONFLICT DO NOTHING
  `;
  return { saved: true };
}

export async function savedTiles(userId: number) {
  const sql = await db();
  const rows = await sql<{ kind: TargetKind; id: number; title: string; image: string }[]>`
    SELECT s.target_kind AS kind, s.target_id AS id, s.created_at,
           COALESCE(p.title, l.title, r.caption, '') AS title,
           COALESCE(p.image, l.result_image, r.video, '') AS image
    FROM gram_saved s
    LEFT JOIN gram_posts p ON s.target_kind = 'post' AND p.id = s.target_id AND p.published = 1
    LEFT JOIN gram_looks l ON s.target_kind = 'look' AND l.id = s.target_id AND l.published = 1
    LEFT JOIN gram_reels r ON s.target_kind = 'reel' AND r.id = s.target_id AND r.published = 1
    WHERE s.user_id = ${userId}
      AND (p.id IS NOT NULL OR l.id IS NOT NULL OR r.id IS NOT NULL)
    ORDER BY s.created_at DESC
    LIMIT 90
  `;
  return rows.map((row) => ({ ...row, key: `${row.kind}-${row.id}` }));
}

export async function addComment(userId: number, kind: TargetKind, targetId: number, body: string) {
  const ownerId = await targetOwner(kind, targetId, userId);
  if (ownerId === null) return null;
  const text = body.trim().slice(0, 500);
  if (!text) return null;
  const sql = await db();
  const inserted = await sql<{ id: number }[]>`
    INSERT INTO gram_comments (user_id, target_kind, target_id, body)
    VALUES (${userId}, ${kind}, ${targetId}, ${text})
    RETURNING id
  `;
  await notify(ownerId, userId, "comment", kind, targetId);
  const me = await personById(userId);
  return {
    id: inserted[0].id,
    body: text,
    name: me?.name || "",
    handle: me?.handle || "",
    avatar_initials: me?.avatar_initials || "??",
    created_at: new Date().toISOString(),
  };
}

export async function commentsFor(kind: TargetKind, targetId: number, viewerId: number) {
  if ((await targetOwner(kind, targetId, viewerId)) === null) return null;
  const sql = await db();
  return sql`
    SELECT c.id, c.body, c.created_at, u.name, u.handle, u.avatar_initials
    FROM gram_comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.target_kind = ${kind} AND c.target_id = ${targetId}
    ORDER BY c.id ASC
    LIMIT 100
  `;
}

export async function createStory(userId: number, media: string, mediaKind: string, caption: string) {
  const safe = path.basename(media);
  if (!safe) return null;
  const sql = await db();
  const inserted = await sql<{ id: number }[]>`
    INSERT INTO gram_stories (user_id, media, media_kind, caption, expires_at)
    VALUES (
      ${userId}, ${safe}, ${mediaKind === "video" ? "video" : "image"}, ${caption.slice(0, 200)},
      to_char((now() + interval '24 hours') AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')
    )
    RETURNING id
  `;
  return { id: inserted[0].id };
}

export async function activeStories(viewerId: number) {
  const sql = await db();
  const rows = await sql<
    {
      id: number;
      media: string;
      media_kind: string;
      caption: string;
      created_at: string;
      user_id: number;
      name: string;
      handle: string;
      avatar_initials: string;
    }[]
  >`
    SELECT s.id, s.media, s.media_kind, s.caption, s.created_at,
           u.id AS user_id, u.name, u.handle, u.avatar_initials
    FROM gram_stories s
    JOIN users u ON u.id = s.user_id
    WHERE s.expires_at > to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')
      AND u.disabled = 0
    ORDER BY s.created_at ASC
  `;
  const groups: {
    user_id: number;
    name: string;
    handle: string;
    avatar_initials: string;
    mine: boolean;
    stories: { id: number; media: string; media_kind: string; caption: string; created_at: string }[];
  }[] = [];
  for (const row of rows) {
    let group = groups.find((entry) => entry.user_id === row.user_id);
    if (!group) {
      group = {
        user_id: row.user_id,
        name: row.name,
        handle: row.handle,
        avatar_initials: row.avatar_initials,
        mine: row.user_id === viewerId,
        stories: [],
      };
      groups.push(group);
    }
    group.stories.push({
      id: row.id,
      media: row.media,
      media_kind: row.media_kind,
      caption: row.caption,
      created_at: row.created_at,
    });
  }
  groups.sort((a, b) => Number(b.mine) - Number(a.mine));
  return groups;
}

export async function notify(
  userId: number,
  actorId: number,
  kind: string,
  targetKind: string,
  targetId: number
) {
  if (userId === actorId) return;
  const sql = await db();
  await sql`
    INSERT INTO gram_notifications (user_id, actor_id, kind, target_kind, target_id)
    VALUES (${userId}, ${actorId}, ${kind}, ${targetKind}, ${targetId})
  `;
}

export async function notificationsFor(userId: number) {
  const sql = await db();
  return sql`
    SELECT n.id, n.kind, n.target_kind, n.target_id, n.read_at, n.created_at,
           u.name, u.handle, u.avatar_initials
    FROM gram_notifications n
    JOIN users u ON u.id = n.actor_id
    WHERE n.user_id = ${userId}
    ORDER BY n.id DESC
    LIMIT 50
  `;
}

export async function unreadNotifications(userId: number): Promise<number> {
  const sql = await db();
  const rows = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM gram_notifications
    WHERE user_id = ${userId} AND read_at IS NULL
  `;
  return rows[0].c;
}

export async function markNotificationsRead(userId: number) {
  const sql = await db();
  await sql`
    UPDATE gram_notifications
    SET read_at = to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')
    WHERE user_id = ${userId} AND read_at IS NULL
  `;
}

export async function createReel(userId: number, video: string, caption: string) {
  const safe = path.basename(video);
  if (!safe) return null;
  const sql = await db();
  const inserted = await sql<{ id: number }[]>`
    INSERT INTO gram_reels (user_id, video, caption)
    VALUES (${userId}, ${safe}, ${caption.slice(0, 500)})
    RETURNING id
  `;
  return { id: inserted[0].id };
}

export async function myReels(userId: number) {
  const sql = await db();
  return sql`
    SELECT id, video, caption, published, created_at
    FROM gram_reels WHERE user_id = ${userId} ORDER BY id DESC
  `;
}

export async function reelsFeed(viewerId: number) {
  const sql = await db();
  const rows = await sql<
    {
      id: number;
      caption: string;
      video: string;
      created_at: string;
      user_id: number;
      name: string;
      handle: string;
      avatar_initials: string;
    }[]
  >`
    SELECT r.id, r.caption, r.video, r.created_at,
           u.id AS user_id, u.name, u.handle, u.avatar_initials
    FROM gram_reels r
    JOIN users u ON u.id = r.user_id
    WHERE r.published = 1 AND u.disabled = 0
    ORDER BY r.created_at DESC, r.id DESC
    LIMIT 40
  `;
  return enrichCards(
    viewerId,
    rows.map((row) => ({ ...row, kind: "reel" as const }))
  );
}

export async function exploreGrid(viewerId: number) {
  const sql = await db();
  const rows = await sql<
    {
      kind: TargetKind;
      id: number;
      title: string;
      image: string;
      created_at: string;
      handle: string;
      name: string;
      avatar_initials: string;
    }[]
  >`
    SELECT kind, id, title, image, created_at, handle, name, avatar_initials
    FROM (
      SELECT 'post' AS kind, p.id AS id, p.title AS title, p.image AS image, p.created_at AS created_at,
             u.handle AS handle, u.name AS name, u.avatar_initials AS avatar_initials
      FROM gram_posts p JOIN users u ON u.id = p.user_id
      WHERE p.published = 1 AND p.image != '' AND u.disabled = 0
      UNION ALL
      SELECT 'look', l.id, l.title, l.result_image, l.created_at, u.handle, u.name, u.avatar_initials
      FROM gram_looks l JOIN users u ON u.id = l.user_id
      WHERE l.published = 1 AND l.status = 'ready' AND l.result_image != '' AND u.disabled = 0
      UNION ALL
      SELECT 'reel', r.id, r.caption, r.video, r.created_at, u.handle, u.name, u.avatar_initials
      FROM gram_reels r JOIN users u ON u.id = r.user_id
      WHERE r.published = 1 AND u.disabled = 0
    ) AS combined
    ORDER BY created_at DESC, id DESC
    LIMIT 60
  `;
  return enrichCards(viewerId, rows);
}

export async function mediaAllowed(filename: string, viewerId: number): Promise<boolean> {
  const safe = path.basename(filename);
  const sql = await db();
  const rows = await sql`
    SELECT 1 AS ok FROM gram_posts WHERE image = ${safe} AND published = 1
    UNION ALL
    SELECT 1 FROM gram_looks WHERE result_image = ${safe} AND published = 1
    UNION ALL
    SELECT 1 FROM gram_reels WHERE video = ${safe} AND published = 1
    UNION ALL
    SELECT 1 FROM gram_stories WHERE media = ${safe}
      AND expires_at > to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')
    UNION ALL
    SELECT 1 FROM gram_posts WHERE image = ${safe} AND user_id = ${viewerId}
    UNION ALL
    SELECT 1 FROM gram_looks WHERE result_image = ${safe} AND user_id = ${viewerId}
    UNION ALL
    SELECT 1 FROM gram_reels WHERE video = ${safe} AND user_id = ${viewerId}
    UNION ALL
    SELECT 1 FROM gram_stories WHERE media = ${safe} AND user_id = ${viewerId}
    UNION ALL
    SELECT 1 FROM items WHERE local_image = ${safe} AND user_id = ${viewerId}
    LIMIT 1
  `;
  return rows.length > 0;
}
