import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAuthUser } from "@/lib/server/auth";
import { errorResponse, PublicError } from "@/lib/server/http";
import { getOrderItemsRows, getOrderRow } from "@/lib/server/orders";

// GET /api/admin/orders/[id]/seller-sheet[?format=xlsx]
// Positionen gruppiert nach Seller — das ist die Liste, die du an die
// Yupoo-Seller schickst. Enthaelt bewusst Seller + Quell-URLs (Admin-only).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ detail: "Admin access required" }, { status: 403 });
  }
  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) throw new PublicError("Invalid order ID", 400);

    const order = await getOrderRow(orderId);
    const items = await getOrderItemsRows(orderId);

    // Gruppieren nach Seller (leer -> "Unknown Seller")
    const groups = new Map<string, typeof items>();
    for (const item of items) {
      const key = (item.seller || "").trim() || "Unknown Seller";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    const url = new URL(request.url);
    const format = url.searchParams.get("format");

    const sellerGroups = [...groups.entries()].map(([seller, sellerItems]) => ({
      seller,
      items: sellerItems.map((it) => ({
        id: it.id,
        title: it.title,
        chosen_size: it.chosenSize || "",
        color_variant: it.colorVariant || "",
        quantity: it.quantity,
        price_cny: it.priceCny ?? null,
        line_total_cny:
          it.priceCny !== null && it.priceCny !== undefined
            ? parseFloat((it.priceCny * it.quantity).toFixed(2))
            : null,
        source_url: it.sourceUrl || "",
        weidian_url: it.weidianUrl || "",
        fulfillment_status: it.fulfillmentStatus,
      })),
      total_cny: parseFloat(
        sellerItems
          .reduce((sum, it) => sum + (it.priceCny ?? 0) * it.quantity, 0)
          .toFixed(2)
      ),
    }));

    if (format === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Fashion Supply";
      for (const group of sellerGroups) {
        const sheet = workbook.addWorksheet(group.seller.slice(0, 31) || "Seller");
        sheet.columns = [
          { header: "Product Title", key: "title", width: 40 },
          { header: "Size", key: "size", width: 12 },
          { header: "Color", key: "color", width: 16 },
          { header: "Qty", key: "qty", width: 8 },
          { header: "Price CNY", key: "price", width: 12 },
          { header: "Line CNY", key: "line", width: 12 },
          { header: "Source URL", key: "source", width: 30 },
          { header: "Weidian URL", key: "weidian", width: 30 },
        ];
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true };
        for (const it of group.items) {
          const row = sheet.addRow({
            title: it.title,
            size: it.chosen_size,
            color: it.color_variant,
            qty: it.quantity,
            price: it.price_cny ?? "",
            line:
              it.price_cny !== null && it.price_cny !== undefined
                ? parseFloat((it.price_cny * it.quantity).toFixed(2))
                : "",
            source: it.source_url
              ? { text: "Open ↗", hyperlink: it.source_url }
              : "",
            weidian: it.weidian_url
              ? { text: "Weidian ↗", hyperlink: it.weidian_url }
              : "",
          });
          row.getCell("price").numFmt = "¥#,##0.00";
          row.getCell("line").numFmt = "¥#,##0.00";
        }
        const totalRow = sheet.addRow({ title: "TOTAL", line: group.total_cny });
        totalRow.font = { bold: true };
        totalRow.getCell("line").numFmt = "¥#,##0.00";
      }
      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(buffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="SellerSheet_${order.orderNumber}.xlsx"`,
        },
      });
    }

    return NextResponse.json({
      order_number: order.orderNumber,
      order_id: order.id,
      status: order.status,
      seller_groups: sellerGroups,
    });
  } catch (err) {
    return errorResponse("admin-seller-sheet", err);
  }
}
