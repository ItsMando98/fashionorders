import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { getAuthUser } from "@/lib/server/auth";
import { db, users, items } from "@/lib/server/db";
import { getFeeSettings, enrichItem } from "@/lib/server/pricing";
import { User, Item } from "@/lib/types";

const CACHE_DIR = path.resolve(process.cwd(), ".cache_images");

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const feeSettings = await getFeeSettings();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fashion Supply";
  workbook.created = new Date();

  // Determine which users to export
  let usersToExport: User[] = [];
  if (user.role === "admin") {
    const rows = (await db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        avatar_initials: users.avatarInitials,
        share_all_friends: users.shareAllFriends,
        custom_item_fixed_eur: users.customItemFixedEur,
        custom_item_percent: users.customItemPercent,
        custom_haul_percent: users.customHaulPercent,
      })
      .from(users)
      .orderBy(asc(users.id))) as User[];
    usersToExport = rows;
  } else {
    usersToExport = [user];
  }

  for (const member of usersToExport) {
    const rawItems = await db
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
      .where(eq(items.userId, member.id))
      .orderBy(asc(items.id));

    const memberItems: Item[] = rawItems.map((it) =>
      enrichItem(it, member, feeSettings)
    );
    const sheetName = member.name.slice(0, 31);
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ showGridLines: true }],
    });

    // Column Definitions
    sheet.columns = [
      { header: "Image", key: "image", width: 14 },
      { header: "Brand", key: "brand", width: 18 },
      { header: "Product Title", key: "title", width: 34 },
      { header: "Size", key: "size", width: 12 },
      { header: "Available Sizes", key: "available_sizes", width: 22 },
      { header: "Base CNY (¥)", key: "base_cny", width: 14 },
      { header: "Base EUR (€)", key: "base_eur", width: 14 },
      { header: "Admin Fee (€)", key: "fee_eur", width: 14 },
      { header: "Final EUR (€)", key: "final_eur", width: 14 },
      { header: "Qty", key: "qty", width: 8 },
      { header: "Total EUR (€)", key: "line_total", width: 15 },
      { header: "Order Status", key: "status", width: 18 },
      { header: "User Notes", key: "user_notes", width: 20 },
      { header: "Admin / Tracking", key: "admin_notes", width: 22 },
      { header: "Product Link", key: "link", width: 16 },
    ];

    // Style Header Row: Luxury Forest Green (#0D2218)
    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0D2218" },
      };
      cell.font = {
        name: "Segoe UI",
        size: 10,
        bold: true,
        color: { argb: "FFF3C343" }, // Crest Yellow text
      };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = {
        bottom: { style: "medium", color: { argb: "FF1A3B2B" } },
      };
    });

    let rowIndex = 2;
    for (const item of memberItems) {
      const row = sheet.getRow(rowIndex);
      row.height = 68;

      row.getCell("brand").value = item.brand || "Unbranded";
      row.getCell("title").value = item.title;
      row.getCell("size").value = item.chosen_size || "";
      row.getCell("available_sizes").value = item.available_sizes || "";
      row.getCell("base_cny").value = item.price_cny ?? "";
      row.getCell("base_eur").value = item.base_price_eur ?? "";
      row.getCell("fee_eur").value = item.item_fee_eur ?? 0;
      row.getCell("final_eur").value = item.final_unit_eur ?? 0;
      row.getCell("qty").value = item.quantity || 1;
      row.getCell("line_total").value = item.line_total_eur ?? 0;
      row.getCell("status").value = item.order_status || "Pending";
      row.getCell("user_notes").value = item.user_notes || "";
      row.getCell("admin_notes").value = item.admin_notes || item.tracking_number || "";

      if (item.album_url || item.url) {
        row.getCell("link").value = {
          text: "Open Link ↗",
          hyperlink: item.album_url || item.url,
        };
      }

      // Embed thumbnail image if exists
      if (item.local_image) {
        const basename = path.basename(item.local_image);
        const imgPath = path.join(CACHE_DIR, basename);
        if (fs.existsSync(imgPath)) {
          try {
            const imgId = workbook.addImage({
              filename: imgPath,
              extension: "png",
            });
            sheet.addImage(imgId, {
              tl: { col: 0.1, row: rowIndex - 1 + 0.05 },
              ext: { width: 68, height: 68 },
            } as any);
          } catch {}
        }
      }

      // Formatting
      row.getCell("brand").alignment = { vertical: "middle" };
      row.getCell("title").alignment = { vertical: "middle", wrapText: true };
      row.getCell("size").alignment = { vertical: "middle", horizontal: "center" };
      row.getCell("available_sizes").alignment = { vertical: "middle" };
      row.getCell("base_cny").alignment = { vertical: "middle", horizontal: "right" };
      row.getCell("base_eur").alignment = { vertical: "middle", horizontal: "right" };
      row.getCell("fee_eur").alignment = { vertical: "middle", horizontal: "right" };
      row.getCell("final_eur").alignment = { vertical: "middle", horizontal: "right" };
      row.getCell("qty").alignment = { vertical: "middle", horizontal: "center" };
      row.getCell("line_total").alignment = { vertical: "middle", horizontal: "right" };
      row.getCell("status").alignment = { vertical: "middle", horizontal: "center" };
      row.getCell("user_notes").alignment = { vertical: "middle" };
      row.getCell("admin_notes").alignment = { vertical: "middle" };
      row.getCell("link").alignment = { vertical: "middle", horizontal: "center" };

      row.getCell("base_cny").numFmt = "¥#,##0.00";
      row.getCell("base_eur").numFmt = "€#,##0.00";
      row.getCell("fee_eur").numFmt = "+€#,##0.00";
      row.getCell("final_eur").numFmt = "€#,##0.00";
      row.getCell("line_total").numFmt = "€#,##0.00";

      // Subtle alternating zebra row
      if (rowIndex % 2 === 1) {
        row.eachCell((cell, colNum) => {
          if (colNum > 1) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF9FBF9" },
            };
          }
        });
      }

      rowIndex++;
    }

    // Summary Rows
    if (memberItems.length > 0) {
      const haulPct =
        member.custom_haul_percent !== null && member.custom_haul_percent !== undefined
          ? member.custom_haul_percent
          : feeSettings.default_haul_percent;

      // Subtotal
      const subRow = sheet.getRow(rowIndex);
      subRow.height = 24;
      subRow.getCell("title").value = "SUBTOTAL (ITEMS ONLY)";
      subRow.getCell("title").font = { bold: true };
      subRow.getCell("line_total").value = {
        formula: `SUM(K2:K${rowIndex - 1})`,
      };
      subRow.getCell("line_total").font = { bold: true };
      subRow.getCell("line_total").numFmt = "€#,##0.00";
      rowIndex++;

      // Haul Handling Fee
      const haulRow = sheet.getRow(rowIndex);
      haulRow.height = 24;
      haulRow.getCell("title").value = `HAUL HANDLING / ADMIN FEE (+${haulPct}%)`;
      haulRow.getCell("title").font = { bold: true, color: { argb: "FFB43C0C" } };
      haulRow.getCell("line_total").value = {
        formula: `K${rowIndex - 1} * ${haulPct / 100}`,
      };
      haulRow.getCell("line_total").font = { bold: true };
      haulRow.getCell("line_total").numFmt = "€#,##0.00";
      rowIndex++;

      // Grand Total
      const grandRow = sheet.getRow(rowIndex);
      grandRow.height = 28;
      grandRow.getCell("title").value = "GRAND TOTAL TO PAY (€)";
      grandRow.getCell("title").font = { bold: true, size: 11, color: { argb: "FF0D2218" } };
      grandRow.getCell("line_total").value = {
        formula: `K${rowIndex - 2} + K${rowIndex - 1}`,
      };
      grandRow.getCell("line_total").font = { bold: true, size: 12, color: { argb: "FF0D2218" } };
      grandRow.getCell("line_total").numFmt = "€#,##0.00";
      grandRow.getCell("line_total").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFDF2A9" }, // Crest Yellow highlight
      };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename =
    user.role === "admin"
      ? `FashionSupply_Master_Export_${new Date().toISOString().slice(0, 10)}.xlsx`
      : `FashionSupply_${user.name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
