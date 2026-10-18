"""The shop's promotional offers ("Offres promotionnelles"), loaded by `seed`.

Each offer is a box of jars with its offer price and the "instead of" price shown struck
through, both from the offers sheet.
"""

from dataclasses import dataclass

from app.seed_catalog import Text

# The six jars the offers are made of: (product slug, grams).
HAZELNUT_350 = ("creme-noisettes", 350)
COCOA_350 = ("pate-a-tartiner", 350)
ROCHER_HAZELNUT_200 = ("creme-noisettes-rocher", 200)
ROCHER_COCOA_200 = ("pate-a-tartiner-rocher", 200)
ROCHER_HAZELNUT_600 = ("creme-noisettes-rocher", 600)
ROCHER_COCOA_600 = ("pate-a-tartiner-rocher", 600)


@dataclass(frozen=True)
class SeedPack:
    number: int
    price: str  # TND
    regular_price: str  # "instead of", TND
    items: tuple[tuple[str, int], ...]  # one jar of each
    featured: bool = False

    @property
    def slug(self) -> str:
        return f"offre-{self.number}"

    @property
    def name(self) -> Text:
        return Text(en=f"Offer {self.number}", fr=f"Offre {self.number}", ar=f"العرض {self.number}")


# Shown on the home page: one four-jar, one three-jar and one two-jar offer.
PACKS: tuple[SeedPack, ...] = (
    SeedPack(
        number=1,
        price="75.000",
        regular_price="90.000",
        items=(HAZELNUT_350, COCOA_350, ROCHER_HAZELNUT_200, ROCHER_COCOA_200),
        featured=True,
    ),
    SeedPack(
        number=2,
        price="94.000",
        regular_price="112.000",
        items=(HAZELNUT_350, COCOA_350, ROCHER_HAZELNUT_200, ROCHER_HAZELNUT_600),
    ),
    SeedPack(
        number=3,
        price="87.000",
        regular_price="103.000",
        items=(HAZELNUT_350, COCOA_350, ROCHER_HAZELNUT_200, ROCHER_COCOA_600),
    ),
    SeedPack(
        number=4,
        price="92.000",
        regular_price="110.000",
        items=(HAZELNUT_350, COCOA_350, ROCHER_COCOA_200, ROCHER_HAZELNUT_600),
    ),
    SeedPack(
        number=5,
        price="104.000",
        regular_price="123.000",
        items=(HAZELNUT_350, COCOA_350, ROCHER_HAZELNUT_600, ROCHER_COCOA_600),
    ),
    SeedPack(
        number=6,
        price="84.000",
        regular_price="100.000",
        items=(HAZELNUT_350, ROCHER_HAZELNUT_200, ROCHER_COCOA_200, ROCHER_COCOA_600),
    ),
    SeedPack(
        number=7,
        price="97.000",
        regular_price="117.000",
        items=(ROCHER_HAZELNUT_200, ROCHER_COCOA_200, ROCHER_HAZELNUT_600, ROCHER_COCOA_600),
    ),
    SeedPack(
        number=8,
        price="57.000",
        regular_price="68.000",
        items=(HAZELNUT_350, COCOA_350, ROCHER_COCOA_200),
        featured=True,
    ),
    SeedPack(
        number=9,
        price="56.000",
        regular_price="67.000",
        items=(HAZELNUT_350, ROCHER_HAZELNUT_200, ROCHER_COCOA_200),
    ),
    SeedPack(
        number=10,
        price="53.000",
        regular_price="65.000",
        items=(COCOA_350, ROCHER_HAZELNUT_200, ROCHER_COCOA_200),
    ),
    SeedPack(
        number=11,
        price="51.000",
        regular_price="62.000",
        items=(ROCHER_COCOA_200, ROCHER_HAZELNUT_600),
    ),
    SeedPack(
        number=12,
        price="50.000",
        regular_price="58.000",
        items=(HAZELNUT_350, ROCHER_COCOA_600),
        featured=True,
    ),
)
