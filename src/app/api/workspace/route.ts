import { NextResponse } from "next/server";
import { eq, ne, and, sql, desc, asc } from "drizzle-orm";
import { getAuthUser } from "@/lib/server/auth";
import { db, users, items } from "@/lib/server/db";
import { getFeeSettings, enrichItem, computeHaulSummary } from "@/lib/server/pricing";
import { User, Item } from "@/lib/types";

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const feeSettings = await getFeeSettings();

  // 1. Current user's own items
  const myItemRows = await db
    .select({
      id: items.id,
      user_id: items.userId,
      url: items.url,
      album_url: items.url,
      weidian_url: items.weidianUrl,
      source_platform: items.sourcePlatform,
      seller: items.seller,
      title: items.title,
      brand: items.brand,
      category: items.category,
      available_sizes: items.availableSizes,
      chosen_size: items.chosenSize,
      color_variant: items.colorVariant,
      quantity: items.quantity,
      price_cny: items.priceCny,
      shipping_cny: items.shippingCny,
      stage: items.stage,
      order_status: items.orderStatus,
      description: items.description,
      user_notes: items.userNotes,
      admin_notes: items.adminNotes,
      tracking_number: items.trackingNumber,
      image_url: items.imageUrl,
      local_image: items.localImage,
      created_at: items.createdAt,
      updated_at: items.updatedAt,
      is_shared: items.isShared,
      custom_fee_fixed_eur: items.customFeeFixedEur,
      custom_fee_percent: items.customFeePercent,
    })
    .from(items)
    .where(eq(items.userId, user.id))
    .orderBy(desc(items.id));

  const myItems: Item[] = myItemRows.map((it) => enrichItem(it, user, feeSettings));
  const myHaulSummary = computeHaulSummary(myItems, user, feeSettings);

  // 2. Shared items from friends
  const sharedRows = await db
    .select({
      id: items.id,
      user_id: items.userId,
      url: items.url,
      album_url: items.url,
      weidian_url: items.weidianUrl,
      source_platform: items.sourcePlatform,
      seller: items.seller,
      title: items.title,
      brand: items.brand,
      category: items.category,
      available_sizes: items.availableSizes,
      chosen_size: items.chosenSize,
      color_variant: items.colorVariant,
      quantity: items.quantity,
      price_cny: items.priceCny,
      shipping_cny: items.shippingCny,
      stage: items.stage,
      order_status: items.orderStatus,
      description: items.description,
      user_notes: items.userNotes,
      admin_notes: items.adminNotes,
      tracking_number: items.trackingNumber,
      image_url: items.imageUrl,
      local_image: items.localImage,
      created_at: items.createdAt,
      updated_at: items.updatedAt,
      is_shared: items.isShared,
      custom_fee_fixed_eur: items.customFeeFixedEur,
      custom_fee_percent: items.customFeePercent,
      owner_name: users.name,
      owner_initials: users.avatarInitials,
    })
    .from(items)
    .innerJoin(users, eq(items.userId, users.id))
    .where(
      and(
        ne(items.userId, user.id),
        eq(items.isShared, 1),
        sql`(${users.shareAllFriends} = 1 OR EXISTS (
          SELECT 1 FROM order_shares os
          WHERE os.owner_id = ${users.id} AND os.shared_with_user_id = ${user.id}
        ))`
      )
    )
    .orderBy(desc(items.id));

  const sharedItems: Item[] = sharedRows.map((it) => {
    const owner: User = {
      id: it.user_id,
      name: it.owner_name,
      role: "friend",
      avatar_initials: it.owner_initials,
      share_all_friends: 0,
      custom_item_fixed_eur: null,
      custom_item_percent: null,
      custom_haul_percent: null,
    };
    const enriched = enrichItem(it, owner, feeSettings);
    return { ...enriched, user_notes: "", admin_notes: "" };
  });

  // 3. Friends Directory
  const friends = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      avatar_initials: users.avatarInitials,
    })
    .from(users)
    .where(
      and(
        ne(users.id, user.id),
        eq(users.disabled, 0),
        sql`(
          EXISTS (
            SELECT 1 FROM order_shares os
            WHERE os.owner_id = ${user.id} AND os.shared_with_user_id = ${users.id}
          )
          OR EXISTS (
            SELECT 1 FROM order_shares os
            WHERE os.owner_id = ${users.id} AND os.shared_with_user_id = ${user.id}
          )
          OR ${users.shareAllFriends} = 1
        )`
      )
    )
    .orderBy(asc(users.name));

  // 4. Share targets
  const shareTargetRows = (await db
    .select({ sharedWithUserId: sql<number>`shared_with_user_id` })
    .from(sql`order_shares`)
    .where(sql`owner_id = ${user.id}`)) as { sharedWithUserId: number }[];
  const myShareTargets = shareTargetRows.map((r) => r.sharedWithUserId);

  // 5. Admin data
  let adminAllItems: Item[] = [];
  let adminUsers: any[] = [];
  let adminHaulSummaries: any[] = [];

  if (user.role === "admin") {
    const allUsers = (await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        avatar_initials: users.avatarInitials,
        share_all_friends: users.shareAllFriends,
        custom_item_fixed_eur: users.customItemFixedEur,
        custom_item_percent: users.customItemPercent,
        custom_haul_percent: users.customHaulPercent,
        disabled: users.disabled,
      })
      .from(users)
      .orderBy(asc(users.id))) as User[];

    adminUsers = allUsers;
    const usersMap = new Map<number, User>();
    for (const u of allUsers) {
      usersMap.set(u.id, u);
    }

    const allItemRows = await db
      .select({
        id: items.id,
        user_id: items.userId,
        url: items.url,
        album_url: items.url,
        weidian_url: items.weidianUrl,
        source_platform: items.sourcePlatform,
        seller: items.seller,
        title: items.title,
        brand: items.brand,
        category: items.category,
        available_sizes: items.availableSizes,
        chosen_size: items.chosenSize,
        color_variant: items.colorVariant,
        quantity: items.quantity,
        price_cny: items.priceCny,
        shipping_cny: items.shippingCny,
        stage: items.stage,
        order_status: items.orderStatus,
        description: items.description,
        user_notes: items.userNotes,
        admin_notes: items.adminNotes,
        tracking_number: items.trackingNumber,
        image_url: items.imageUrl,
        local_image: items.localImage,
        created_at: items.createdAt,
        updated_at: items.updatedAt,
        is_shared: items.isShared,
        custom_fee_fixed_eur: items.customFeeFixedEur,
        custom_fee_percent: items.customFeePercent,
        owner_name: users.name,
        owner_initials: users.avatarInitials,
      })
      .from(items)
      .innerJoin(users, eq(items.userId, users.id))
      .orderBy(desc(items.id));

    adminAllItems = allItemRows.map((it) => {
      const owner = usersMap.get(it.user_id) || null;
      return enrichItem(it, owner, feeSettings);
    });

    for (const u of allUsers) {
      const userItems = adminAllItems.filter((i) => i.user_id === u.id);
      adminHaulSummaries.push(computeHaulSummary(userItems, u, feeSettings));
    }
  }

  return NextResponse.json({
    current_user: user,
    settings: feeSettings,
    my_items: myItems,
    my_haul_summary: myHaulSummary,
    shared_items: sharedItems,
    friends_directory: friends,
    my_share_targets: myShareTargets,
    admin_all_items: adminAllItems,
    admin_users: adminUsers,
    admin_haul_summaries: adminHaulSummaries,
  });
}
