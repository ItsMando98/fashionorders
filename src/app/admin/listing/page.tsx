"use client";
import { ShopShell } from "@/components/shop/shell";
import { ListingWizard } from "@/components/listing/wizard";

// FRONTEND-Seite: /admin/listing. Die eigentliche Arbeit macht der Wizard.
export default function ListingPage() {
  return (
    <ShopShell>
      <div className="mb-8">
        <p className="commerce-eyebrow">Administration</p>
        <h1 className="commerce-title">KI-Listing-Assistent</h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
          Neues Shop-Produkt in sechs Schritten: Yupoo-Link importieren, Bilder
          prüfen, Farben/Größen/Merkmale festlegen, Texte und Model-Fotos mit
          KI erzeugen, speichern.
        </p>
      </div>
      <ListingWizard />
    </ShopShell>
  );
}
