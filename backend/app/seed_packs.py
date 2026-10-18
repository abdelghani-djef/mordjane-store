"""The shop's promotional offers ("Offres promotionnelles"), loaded by `seed`.

Each offer is a box of jars sold for less than the jars bought one by one; the "instead of"
price the shop shows is the sum of the sizes' prices in seed_catalog.py.
"""

from dataclasses import dataclass

from app.seed_catalog import Text

# The six jars the offers are made of: (product slug, grams).
HAZELNUT_350 = ("creme-noisettes", 350)  # 25 DT
COCOA_350 = ("pate-a-tartiner", 350)  # 23 DT
ROCHER_HAZELNUT_200 = ("creme-noisettes-rocher", 200)  # 22 DT
ROCHER_COCOA_200 = ("pate-a-tartiner-rocher", 200)  # 20 DT
ROCHER_HAZELNUT_600 = ("creme-noisettes-rocher", 600)  # 42 DT
ROCHER_COCOA_600 = ("pate-a-tartiner-rocher", 600)  # 33 DT


@dataclass(frozen=True)
class SeedPack:
    number: int
    price: str  # TND
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
        1,
        "75.000",
        (HAZELNUT_350, COCOA_350, ROCHER_HAZELNUT_200, ROCHER_COCOA_200),
        featured=True,
    ),
    SeedPack(2, "94.000", (HAZELNUT_350, COCOA_350, ROCHER_HAZELNUT_200, ROCHER_HAZELNUT_600)),
    SeedPack(3, "87.000", (HAZELNUT_350, COCOA_350, ROCHER_HAZELNUT_200, ROCHER_COCOA_600)),
    SeedPack(4, "92.000", (HAZELNUT_350, COCOA_350, ROCHER_COCOA_200, ROCHER_HAZELNUT_600)),
    SeedPack(5, "104.000", (HAZELNUT_350, COCOA_350, ROCHER_HAZELNUT_600, ROCHER_COCOA_600)),
    SeedPack(6, "84.000", (HAZELNUT_350, ROCHER_HAZELNUT_200, ROCHER_COCOA_200, ROCHER_COCOA_600)),
    SeedPack(
        7,
        "97.000",
        (ROCHER_HAZELNUT_200, ROCHER_COCOA_200, ROCHER_HAZELNUT_600, ROCHER_COCOA_600),
    ),
    SeedPack(8, "57.000", (HAZELNUT_350, COCOA_350, ROCHER_COCOA_200), featured=True),
    SeedPack(9, "56.000", (HAZELNUT_350, ROCHER_HAZELNUT_200, ROCHER_COCOA_200)),
    SeedPack(10, "53.000", (COCOA_350, ROCHER_HAZELNUT_200, ROCHER_COCOA_200)),
    SeedPack(11, "51.000", (ROCHER_COCOA_200, ROCHER_HAZELNUT_600)),
    SeedPack(12, "50.000", (HAZELNUT_350, ROCHER_COCOA_600), featured=True),
)
