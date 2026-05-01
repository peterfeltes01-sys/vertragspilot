-- CreateTable
CREATE TABLE "Contract" (
    "id" SERIAL NOT NULL,
    "lastCheck" TIMESTAMP(3),
    "kategorie" TEXT NOT NULL,
    "vertrag" TEXT NOT NULL,
    "web" TEXT,
    "kundennummer" TEXT,
    "vertragsbeginn" TIMESTAMP(3),
    "aktuellerBeginn" TIMESTAMP(3),
    "vertragsende" TIMESTAMP(3),
    "laufzeit" TEXT,
    "kuendigungsfrist" TEXT,
    "naechsteKuendigung" TIMESTAMP(3),
    "naechsteErinnerung" TIMESTAMP(3),
    "kosten" DOUBLE PRECISION,
    "zahlungsintervall" TEXT,
    "notizen" TEXT,
    "archiviert" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kategorie" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '📄',

    CONSTRAINT "Kategorie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Kategorie_name_key" ON "Kategorie"("name");
