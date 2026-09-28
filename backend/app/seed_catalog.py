"""The CEBON range the shop sells, as seed data.

Copy (French, English, Arabic), sizes and shelf lives come from the supplier's site
(cebon.dz); each size has its photo in seed_media/products/<slug>/<grams>.webp and the
product's listing photo is seed_media/products/<slug>.webp. Prices and stock are starting
values: review them in the admin panel.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Text:
    en: str
    fr: str
    ar: str


@dataclass(frozen=True)
class Size:
    grams: int
    price: str  # TND
    stock: int


@dataclass(frozen=True)
class SeedProduct:
    slug: str
    category: str
    name: Text
    description: Text
    ingredients: Text
    shelf_life_months: int
    sizes: tuple[Size, ...]
    featured: bool = False


BRAND = "Cebon"
STORAGE = Text(
    en="Keep dry, away from sunlight.",
    fr="À conserver au sec, à l'abri du soleil.",
    ar="يُحفظ في مكان جاف بعيدًا عن أشعة الشمس.",
)
GLAZE_DESCRIPTION = Text(
    en=(
        "Easy to spread and work with, our icing pastes are made with top-quality "
        "ingredients, without additives or artificial coloring. Give your desserts a "
        "perfect finish and an exquisite taste that will delight all chocolate lovers."
    ),
    fr=(
        "Facile à étaler et à travailler, nos pâtes à glacer sont fabriquées avec des "
        "ingrédients de première qualité, sans additifs ni colorants artificiels. Offrez "
        "à vos desserts un fini parfait et un goût exquis qui ravira tous les amateurs de "
        "chocolat."
    ),
    ar=(
        "بديل الشكولاطة للتزيين سهل الدهن والتزيين، مصنوع من مكونات عالية الجودة، بدون "
        "إضافات أو ألوان صناعية. امنح حلوياتك لمسة نهائية مثالية ومذاقًا رائعًا يسعد جميع "
        "عشاق الشوكولاتة."
    ),
)
NO_INGREDIENTS = Text(en="", fr="", ar="")  # not published for the glazing pastes

PRODUCTS: tuple[SeedProduct, ...] = (
    SeedProduct(
        slug="pate-a-tartiner",
        category="spreads",
        name=Text(
            en="Hazelnut cocoa spread",
            fr="Pâte à tartiner noisettes et cacao",
            ar="كريمة البندق مع الكاكاو",
        ),
        description=Text(
            en=(
                "Discover our hazelnut spread, a real invitation to indulgence. Creamy "
                "and rich in cocoa, it's easy to spread on bread or pancakes, or enjoy "
                "with a spoon for a moment of pure delight. Perfect for breakfasts and "
                "snacks, it will delight chocolate lovers of all ages."
            ),
            fr=(
                "Découvrez notre pâte à tartiner au noisettes, une véritable invitation à "
                "la gourmandise. Onctueuse et riche en cacao, elle se tartine facilement "
                "sur du pain, des crêpes, ou se savoure à la cuillère pour un pur moment "
                "de délice. Parfaite pour vos petits-déjeuners et goûters, elle ravira "
                "les amateurs de chocolat de tous âges."
            ),
            ar=(
                "اكتشف دهن البندق مع الكاكاو الذي نقدمه، دعوة حقيقية للتلذذ. إنه قشدي "
                "وغني بالكاكاو، يسهل دهنه على الخبز أو الفطائر، أو الاستمتاع به بالملعقة "
                "للحظة من البهجة الخالصة. مثالي لوجبات الفطور والوجبات الخفيفة، وسيسعد "
                "عشاق الشوكولاتة من جميع الأعمار."
            ),
        ),
        ingredients=Text(
            en=(
                "Sugar, palm oil, hazelnuts, skimmed milk powder, whey, cocoa powder, "
                "emulsifiers: lecithin, vanilla flavouring."
            ),
            fr=(
                "Sucre, huile de palme, noisettes, lait écrémé en poudre, lactosérum, "
                "poudre de cacao, émulsifiants: lécithine, arôme vanille"
            ),
            ar=(
                "سكر، زيت النخيل، بندق، حليب مجفف منزوع الدسم، مصل اللبن، مسحوق الكاكاو، "
                "مستحلبات: ليسيثين، نكهة الفانيليا."
            ),
        ),
        shelf_life_months=12,
        sizes=(
            Size(200, "6.900", 40),
            Size(350, "11.500", 40),
            Size(700, "20.900", 40),
            Size(2500, "64.000", 12),
            Size(12000, "285.000", 4),
        ),
        featured=True,
    ),
    SeedProduct(
        slug="creme-noisettes",
        category="spreads",
        name=Text(
            en="Hazelnut cream",
            fr="Crème de noisettes",
            ar="كريمة البندق المحمص",
        ),
        description=Text(
            en=(
                "Discover our hazelnut cream, a true delight for lovers of refined "
                "flavors. With its smooth texture and rich hazelnut taste, it's perfect "
                "for your breakfasts and snacks. Let yourself be seduced by the sweetness "
                "and intensity of our hazelnut cream."
            ),
            fr=(
                "Découvrez notre crème de noisettes, un véritable délice pour les "
                "amateurs de saveurs raffinées. Avec sa texture onctueuse et son goût "
                "riche en noisettes, elle se prête parfaitement à vos petits-déjeuners et "
                "goûters. Laissez-vous séduire par la douceur et l'intensité de notre "
                "crème de noisettes."
            ),
            ar=(
                "اكتشف كريمة البندق التي نقدمها لك، إنها متعة حقيقية لعشاق النكهات "
                "الراقية. بفضل قوامها الناعم و نكهة البندق الغنية، فهي مثالية لوجبات "
                "الفطور والوجبات الخفيفة. دع نفسك تنجذب إلى حلاوة وكثافة كريمة البندق "
                "لدينا."
            ),
        ),
        ingredients=Text(
            en=(
                "Sugar, palm oil, hazelnuts, skimmed milk powder, whey, emulsifiers: "
                "lecithin, vanilla flavouring."
            ),
            fr=(
                "Sucre, huile de palme, noisettes, lait écrémé en poudre, lactosérum, "
                "émulsifiants: lécithine, arôme vanille"
            ),
            ar=(
                "سكر، زيت النخيل، البندق، حليب مجفف منزوع الدسم، مصل اللبن، مستحلبات: "
                "ليسيثين، نكهة الفانيليا."
            ),
        ),
        shelf_life_months=12,
        sizes=(
            Size(200, "7.900", 40),
            Size(350, "12.900", 40),
            Size(700, "23.500", 40),
            Size(2500, "72.000", 12),
            Size(12000, "320.000", 4),
        ),
        featured=True,
    ),
    SeedProduct(
        slug="creme-cacahuetes",
        category="spreads",
        name=Text(
            en="Roasted peanut cream",
            fr="Crème de cacahuètes",
            ar="كريمة الفول السوداني",
        ),
        description=Text(
            en=(
                "Discover our peanut cream, a true invitation to indulgence in every "
                "spoonful. Its smooth, velvety texture and rich peanut flavor make it the "
                "perfect companion for your breakfasts and sweet breaks. Enjoy a simple "
                "yet satisfying moment with our peanut cream."
            ),
            fr=(
                "Découvrez notre crème de cacahuète, une invitation à la gourmandise à "
                "chaque cuillère. Sa texture fondante et son goût intensément cacahuète "
                "en font l'alliée parfaite de vos petits-déjeuners et pauses sucrées. "
                "Savourez un moment de plaisir simple et authentique avec notre crème de "
                "cacahuète."
            ),
            ar=(
                "اكتشفوا كريمة الفول السوداني الخاصة بنا، دعوة حقيقية للمتعة في كل ملعقة. "
                "بقوامها الناعم وطعمها الغني، تُعد الخيار المثالي لفطوركم واستراحاتكم "
                "الخفيفة. استمتعوا بلحظة لذيذة وبسيطة مع كريمة الفول السوداني الخاصة بنا."
            ),
        ),
        ingredients=Text(
            en=(
                "Sugar, peanut butter, vegetable fat, skimmed milk powder, whey, "
                "emulsifiers: lecithin, vanilla flavor, salt."
            ),
            fr=(
                "Sucre, beurre de cacahuètes, matière grasse végétale, lait écrémé en "
                "poudre, lactosérum, émulsifiants: lécithine, arôme vanille, sel."
            ),
            ar=(
                "سكر، زبدة الفول السوداني، دهن نباتي، حليب مجفف منزوع الدسم، مصل اللبن، "
                "مستحلبات: ليسيثين، نكهة الفانيليا."
            ),
        ),
        shelf_life_months=12,
        sizes=(
            Size(200, "5.900", 40),
            Size(350, "9.900", 40),
            Size(700, "17.900", 40),
        ),
    ),
    SeedProduct(
        slug="pate-a-tartiner-rocher",
        category="rocher",
        name=Text(
            en="Crunchy hazelnut cocoa spread",
            fr="Pâte à tartiner rocher",
            ar="كريمة البندق مع الكاكاو المقرمشة",
        ),
        description=Text(
            en=(
                "Discover our crunchy hazelnut spread, a symphony of textures and "
                "flavors. Creamy and rich in cocoa, it blends perfectly with the crunch "
                "of hazelnuts to offer an unrivalled gourmet experience. Savor every bite "
                "of this delicious spread, and transform every moment into pure pleasure."
            ),
            fr=(
                "Découvrez notre pâte à tartiner aux éclats de noisettes, une symphonie "
                "de textures et de saveurs. Onctueuse et riche en cacao, elle se marie "
                "parfaitement avec le croquant des noisettes pour offrir une expérience "
                "gourmande inégalée. Savourez chaque bouchée de cette délicieuse pâte à "
                "tartiner au chocolat rocher, et transformez chaque moment en pur "
                "plaisir."
            ),
            ar=(
                "اكتشف دهن البندق مع الكاكاو المقرمش الذي يُعد مزيجاً من القوام والنكهات. "
                "فهو كريمي وغني بالكاكاو و يمتزج بشكل مثالي مع قرمشة البندق ليقدم لك "
                "تجربة ذواقة لا مثيل لها. تذوّق كل ملعقة من هذا الدهن اللذيذ، وحوّل كل "
                "لحظة إلى متعة خالصة."
            ),
        ),
        ingredients=Text(
            en=(
                "Sugar, palm oil, hazelnuts, skimmed milk powder, whey, cocoa powder, "
                "emulsifiers: lecithin, vanilla flavouring."
            ),
            fr=(
                "Sucre, huile de palme, noisettes, lait écrémé en poudre, lactosérum, "
                "poudre de cacao, émulsifiants: lécithine, arôme vanille"
            ),
            ar=(
                "سكر، زيت النخيل، بندق، حليب مجفف منزوع الدسم، مصل اللبن، مسحوق الكاكاو، "
                "مستحلبات: ليسيثين، نكهة الفانيليا."
            ),
        ),
        shelf_life_months=12,
        sizes=(
            Size(200, "7.900", 40),
            Size(600, "19.900", 40),
            Size(2500, "69.000", 12),
        ),
        featured=True,
    ),
    SeedProduct(
        slug="creme-noisettes-rocher",
        category="rocher",
        name=Text(
            en="Crunchy hazelnut cream",
            fr="Crème de noisettes rocher",
            ar="كريمة البندق المحمص المقرمشة",
        ),
        description=Text(
            en=(
                "Discover our hazelnut cream with hazelnut fragments, a crunchy, creamy "
                "delight that will delight your taste buds. With its creamy texture "
                "enriched with crunchy hazelnut pieces, it offers an authentic gourmet "
                "experience. Savor the richness and unique texture of our hazelnut cream, "
                "and turn every moment into a real feast."
            ),
            fr=(
                "Découvrez notre crème de noisettes aux éclats de noisettes, un délice "
                "croquant et crémeux qui ravira vos papilles. Avec sa texture onctueuse "
                "enrichie de morceaux de noisettes croquants, elle offre une expérience "
                "gourmande et authentique. Savourez la richesse et la texture unique de "
                "notre crème de noisettes rocher, et transformez chaque moment en un "
                "véritable festin."
            ),
            ar=(
                "اكتشف كريمة البندق مع قطع البندق المقرمشة التي ستسعد ذوقك. بفضل قوامها "
                "الكريمي الغني بقطع البندق المقرمشة، تقدم لك تجربة ذواقة أصيلة. تذوّق "
                "القوام الغني والفريد من نوعه لكريمة البندق لدينا، وحوّل كل لحظة إلى "
                "وليمة حقيقية."
            ),
        ),
        ingredients=Text(
            en=(
                "Sugar, palm oil, hazelnuts, skimmed milk powder, whey, emulsifiers: "
                "lecithin, vanilla flavouring."
            ),
            fr=(
                "Sucre, huile de palme, noisettes, lait écrémé en poudre, lactosérum, "
                "émulsifiants: lécithine, arôme vanille"
            ),
            ar=(
                "سكر، زيت النخيل، البندق، حليب مجفف منزوع الدسم، مصل اللبن، مستحلبات: "
                "ليسيثين، نكهة الفانيليا."
            ),
        ),
        shelf_life_months=12,
        sizes=(
            Size(200, "8.900", 40),
            Size(600, "22.500", 40),
            Size(2500, "79.000", 12),
        ),
        featured=True,
    ),
    SeedProduct(
        slug="assila",
        category="baking",
        name=Text(
            en="Assila (honey-flavoured syrup)",
            fr="Assila",
            ar="عسيلة",
        ),
        description=Text(
            en=(
                "Our product is the result of years of research by our specialists; "
                "inspired by the qualities of natural honey, they have developed a new "
                "formula of invert sugar: Sarl CEBON guarantees its customers the "
                "non-crystallization of Assila EL Mordjene, making our product perfect "
                "for traditional cakes, desserts and your favorite entremets."
            ),
            fr=(
                "Notre produit issue de plusieurs années de recherches par nos "
                "spécialistes; s'inspirant des qualités du miel naturel ils ont pu "
                "développer une nouvelle formule de sucre intervertit: La Sarl CEBON "
                "garanti a ses client la non cristallisation de l'Assila EL Mordjene, ce "
                "qui rend notre produit parfait pour les gâteaux traditionnel, les "
                "dessert, et entremets préférés."
            ),
            ar=(
                "إن منتجنا هو ثمرة سنوات من الأبحاث التي قام بها الأخصائيون لدينا؛ حيث "
                "استلهموا من صفات العسل الطبيعي، وطوروا تركيبة جديدة من بديل السكر "
                "الطبيعي: تضمن شركة Sarl CEBON لزبائنها عدم بلورة عسيلة المرجان مما يجعل "
                "منتجنا مثاليا للكعك التقليدي والحلويات والمقبلات المفضلة لديك."
            ),
        ),
        ingredients=Text(
            en="Sugar, water, honey flavouring.",
            fr="Sucre blanc, eau, arôme miel.",
            ar="سكر، ماء، نكهة العسل.",
        ),
        shelf_life_months=24,
        sizes=(
            Size(500, "4.500", 40),
            Size(900, "7.500", 40),
            Size(1000, "7.900", 40),
            Size(2000, "14.500", 12),
            Size(3000, "20.900", 12),
            Size(5000, "33.000", 12),
        ),
    ),
    SeedProduct(
        slug="smen",
        category="baking",
        name=Text(
            en="Vegetable s'men",
            fr="S'men végétal",
            ar="سمن نباتي",
        ),
        description=Text(
            en=(
                "To satisfy the demands of both homemakers and professionals, Sarl CEBON "
                "has developed a purely vegetable S'MEN that is excellent for making "
                "traditional dishes and oriental cakes, thanks to its flavor and "
                "lightness, while respecting the pleasures of refined cuisine."
            ),
            fr=(
                "Pour satisfaire les exigences des ménagères et des professionnels, la "
                "Sarl CEBON à développer un S'MEN purement végétal excellent pour la "
                "confection des plats traditionnels, et les gâteaux orientaux par sa "
                "saveur et sa légèreté tout en respectant le plaisirs de la cuisine "
                "raffinée."
            ),
            ar=(
                "لتلبية متطلبات كل من ربات البيوت والمحترفين على حد سواء، قامت CEBON Sarl "
                "بتطوير سمن نباتي خالص ممتاز لإعداد الأطباق التقليدية والكعك التقليدي "
                "بسبب نكهته وخفته، مع احترام متعة الطهي الراقي."
            ),
        ),
        ingredients=Text(
            en=("Vegetable fat, butter flavour, beta-carotene 160 a(ii). Contains no animal fat."),
            fr=(
                "Graisse végétale, arôme beurre, bêtacarotène 160 a(ii). Ne contient pas "
                "de graisse animale."
            ),
            ar="دهون نباتية، نكهة الزبدة، بيتا كاروتين 160. لا يحتوي على دهون حيوانية.",
        ),
        shelf_life_months=24,
        sizes=(
            Size(300, "3.900", 40),
            Size(500, "5.900", 40),
            Size(900, "9.900", 40),
            Size(1800, "18.500", 12),
            Size(3000, "29.000", 12),
            Size(9000, "82.000", 4),
        ),
    ),
    SeedProduct(
        slug="vanille",
        category="baking",
        name=Text(
            en="Vanilla",
            fr="Vanille",
            ar="فانيليا",
        ),
        description=Text(
            en=(
                "Discover our premium vanilla, the very essence of gourmandise. Derived "
                "from the finest vanilla beans, it brings an enchanting fragrance and "
                "incomparable flavor to your desserts, pastries and beverages. Add a "
                "touch of elegance and finesse to your recipes with our exquisite "
                "vanilla."
            ),
            fr=(
                "Découvrez notre vanille de qualité supérieure, l'essence même de la "
                "gourmandise. Issue des meilleures gousses de vanille, elle apporte un "
                "parfum envoûtant et une saveur incomparable à vos desserts, pâtisseries "
                "et boissons. Ajoutez une touche d'élégance et de finesse à vos recettes "
                "avec notre vanille exquise."
            ),
            ar=(
                "اكتشف الفانيليا الفاخرة لدينا، جوهر اللذة. فهي مصنوعة من أجود أنواع حبوب "
                "الفانيليا، وتضيف رائحة ساحرة ونكهة لا تضاهى إلى الحلويات والمعجنات "
                "والمشروبات. أضف لمسة من الأناقة والبراعة إلى وصفاتك مع الفانيليا الرائعة "
                "التي نقدمها."
            ),
        ),
        ingredients=Text(
            en=(
                "Dextrose monohydrate, food additives: (vanilla, ethylvanillin), "
                "artificial flavors."
            ),
            fr=(
                "Dextrose monohydrate, additifs alimentaires: (vanille, éthylvanilline), "
                "arômes artificielles."
            ),
            ar=("دكستروز أحادي الهيدرات، مضافات غذائية: (فانيليا، إيثيلفانيلين)، نكهات اصطناعية."),
        ),
        shelf_life_months=24,
        sizes=(
            Size(5, "0.300", 200),
            Size(200, "4.500", 40),
            Size(700, "13.500", 40),
            Size(3000, "52.000", 12),
            Size(6000, "98.000", 4),
            Size(20000, "310.000", 4),
        ),
    ),
    SeedProduct(
        slug="levure-chimique",
        category="baking",
        name=Text(
            en="Baking powder",
            fr="Levure chimique",
            ar="خميرة كيميائية",
        ),
        description=Text(
            en=(
                "Designed to ensure perfect proofing with every use, our baking powder "
                "helps you create fluffy cakes, muffins and breads. Made from "
                "high-quality ingredients, it ensures an even texture and impeccable "
                "results. Simplify your preparations and make all your recipes a success "
                "with our baking powder, the secret of successful pastry chefs."
            ),
            fr=(
                "Conçue pour garantir une levée parfaite à chaque utilisation, notre "
                "levure chimique vous aide à réaliser des gâteaux, muffins, et pains "
                "moelleux. Fabriquée à partir d'ingrédients de haute qualité, elle assure "
                "une texture homogène et un résultat impeccable. Simplifiez vos "
                "préparations et réussissez toutes vos recettes avec notre levure "
                "chimique, le secret des pâtissiers réussis."
            ),
            ar=(
                "مصممة لضمان تخمير مثالي في كل مرة، تساعدك خميرة كيميائية التي نقدمها على "
                "تحضير الكعك والمافن والخبز الرقيق. فهي مصنوعة من مكونات عالية الجودة، "
                "وتضمن لك قواما متجانسا ونتائج لا مثيل لها. سهّل تحضيراتك واجعل جميع "
                "وصفاتك ناجحة مع الخميرة الكيميائية الخاصة بنا، وهي سر طهاة المعجنات "
                "الناجحين."
            ),
        ),
        ingredients=Text(
            en="Sodium pyrophosphate sin 450, sodium bicarbonate sin 500, corn starch.",
            fr=("Pyrophosphate de sodium sin 450, bicarbonate de sodium sin 500, amidon de maïs."),
            ar="بيروفوسفات الصوديوم sin 450، بيكربونات الصوديوم sin 500، نشا الذرة.",
        ),
        shelf_life_months=24,
        sizes=(
            Size(10, "0.250", 200),
            Size(300, "3.500", 40),
            Size(1000, "9.500", 40),
            Size(25000, "190.000", 4),
        ),
    ),
    SeedProduct(
        slug="cacao-poudre",
        category="baking",
        name=Text(
            en="Cocoa powder",
            fr="Cacao en poudre",
            ar="كاكاو",
        ),
        description=Text(
            en=(
                "Immerse yourself in the rich, intense world of our premium cacao. Pure "
                "and natural, it comes from the finest cocoa beans, carefully selected to "
                "deliver a deep, authentic flavor. Treat yourself to a moment of pure "
                "chocolate pleasure with our exceptional cocoa."
            ),
            fr=(
                "Plongez dans l'univers riche et intense de notre cacao premium. Pur et "
                "naturel, il est issu des meilleures fèves de cacao, soigneusement "
                "sélectionnées pour offrir une saveur profonde et authentique. "
                "Offrez-vous un moment de pur plaisir chocolaté avec notre cacao "
                "d'exception."
            ),
            ar=(
                "انغمس في عالم الكاكاو الفاخر الغني والمكثف. إنه نقي وطبيعي، يأتي من أجود "
                "أنواع حبوب الكاكاو المنتقاة بعناية لتقديم نكهة عميقة وأصيلة. دلل نفسك "
                "بلحظة من متعة الشوكولاتة الخالصة مع الكاكاو الاستثنائي الذي نقدمه."
            ),
        ),
        ingredients=Text(
            en="Cacao.",
            fr="Cacao.",
            ar="كاكاو.",
        ),
        shelf_life_months=24,
        sizes=(
            Size(150, "4.500", 40),
            Size(400, "10.500", 40),
            Size(2500, "52.000", 12),
            Size(5000, "98.000", 12),
        ),
    ),
    SeedProduct(
        slug="maizena",
        category="baking",
        name=Text(
            en="Cornstarch",
            fr="Maïzena",
            ar="نشاء الذرة",
        ),
        description=Text(
            en=(
                "Discover our cornflour, the essential ingredient for perfectly "
                "successful recipes. Versatile and fine, it's ideal for thickening "
                "sauces, creams and soups, as well as for making pastries light and "
                "fluffy. Made from top-quality corn, our starch guarantees an even "
                "texture and impeccable results."
            ),
            fr=(
                "Découvrez notre maïzena, l'ingrédient incontournable pour des recettes "
                "parfaitement réussies. Polyvalente et fine, elle est idéale pour "
                "épaissir vos sauces, crèmes, et potages, ainsi que pour apporter "
                "légèreté et moelleux à vos pâtisseries. Fabriquée à partir de maïs de "
                "haute qualité, notre amidon garantit une texture homogène et un résultat "
                "impeccable."
            ),
            ar=(
                "اكتشف نشاء الذرة، المكون الأساسي للوصفات الناجحة تماماً. إنه متعدد "
                "الاستخدامات وناعم، وهو مثالي لتكثيف الصلصات والكريمات والمرق، وكذلك لجعل "
                "المعجنات خفيفة ورقيقة. مصنوع من الذرة عالية الجودة، يضمن لك نشاء الذرة "
                "قواماً متجانساً ونتائج لا تضاهى."
            ),
        ),
        ingredients=Text(
            en="100% cornstarch.",
            fr="100% amidon de maïs.",
            ar="100% نشاء ذرة.",
        ),
        shelf_life_months=24,
        sizes=(
            Size(200, "1.900", 40),
            Size(500, "3.900", 40),
        ),
    ),
    SeedProduct(
        slug="sucre-glace",
        category="baking",
        name=Text(
            en="Powdered sugar",
            fr="Sucre glace",
            ar="سكر ناعم",
        ),
        description=Text(
            en=(
                "Enhance your culinary creations with our incomparably fine powdered "
                "sugar. Perfect for sprinkling on pastries, smooth glazes and light "
                "meringues. Add a touch of sweetness and perfection to your recipes with "
                "our top-quality powdered sugar."
            ),
            fr=(
                "Sublimez vos créations culinaires avec notre sucre glace d'une finesse "
                "incomparable. Parfait pour saupoudrer vos pâtisseries, réaliser des "
                "glaçages lisses et des meringues légères. Apportez une touche de douceur "
                "et de perfection à vos recettes avec notre sucre glace de qualité "
                "supérieure."
            ),
            ar=(
                "عزز إبداعاتك في الطهي مع مسحوق السكر الناعم الذي لا يضاهى. مثالي لنثره "
                "على المعجنات والطلاء والمرينغ الخفيف. أضف لمسة من النعومة والإتقان إلى "
                "وصفاتك مع مسحوق السكر عالي الجودة."
            ),
        ),
        ingredients=Text(
            en="Sugar, starch.",
            fr="Sucre blanc, amidon.",
            ar="سكر، نشاء.",
        ),
        shelf_life_months=24,
        sizes=(Size(700, "3.500", 40),),
    ),
    SeedProduct(
        slug="chantilly-poudre",
        category="baking",
        name=Text(
            en="Whipped cream powder",
            fr="Chantilly en poudre",
            ar="مسحوق الشانتيي",
        ),
        description=Text(
            en=(
                "Easy to use, it lets you create an airy whipped cream in just a few "
                "moments, ideal for topping cakes, tarts and other sweet delights. Made "
                "from top-quality ingredients, our whipped cream delivers a creamy "
                "texture and delicious taste effortlessly."
            ),
            fr=(
                "Facile à utiliser, elle vous permet de créer une crème chantilly "
                "aérienne en quelques instants, idéale pour garnir vos gâteaux, tartes, "
                "et autres délices sucrés. Fabriquée à partir d'ingrédients de première "
                "qualité, notre chantilly offre une texture crémeuse et un goût délicieux "
                "sans effort."
            ),
            ar=(
                "سهلة الاستخدام، فهي تتيح لك صنع كريمة مخفوقة جيدة التهوية في لحظات "
                "قليلة، وهي مثالية لتزيين الكعك والتورتات وغيرها من الحلويات الشهية. "
                "مصنوعة من مكونات عالية الجودة، توفر كريمة الشانتييه التي نقدمها قواما "
                "كريميا ومذاقا لذيذا دون عناء."
            ),
        ),
        ingredients=Text(
            en=(
                "Sugar, glucose syrup, vegetable oil, emulsifiers sin472a, sin47, milk "
                "proteins, pectin sin340ii, vanilla flavor."
            ),
            fr=(
                "Sucre, sirop de glucose, huile végétale, émulsifiants sin472a, sin47, "
                "protéines de lait, pectine sin340ii, arôme de vanille."
            ),
            ar=(
                "سكر، شراب الجلوكوز، زيت نباتي، مستحلبات sin472a و sin47، بروتينات "
                "الحليب، بكتين sin340ii، نكهة الفانيليا."
            ),
        ),
        shelf_life_months=24,
        sizes=(
            Size(200, "5.900", 40),
            Size(600, "15.500", 40),
            Size(2000, "44.000", 12),
            Size(3000, "63.000", 12),
            Size(6000, "120.000", 4),
        ),
    ),
    SeedProduct(
        slug="trimoline",
        category="baking",
        name=Text(
            en="Trimoline (invert sugar)",
            fr="Trimoline",
            ar="تريمولين (سكر مقلوب)",
        ),
        description=Text(
            en=(
                "Discover our inverted sugar, the secret ingredient of professional "
                "pastry chefs. Perfect for improving the texture and preserving the "
                "freshness of your sweet creations, it dissolves easily and adds "
                "incomparable sweetness. Ideal for creams, jams, pastries and much more."
            ),
            fr=(
                "Découvrez notre sucre inverti, l'ingrédient secret des pâtissiers "
                "professionnels. Parfait pour améliorer la texture et prolonger la "
                "fraîcheur de vos créations sucrées, il se dissout facilement et apporte "
                "une douceur incomparable. Idéal pour les glaces, les confitures, les "
                "pâtisseries et bien plus encore."
            ),
            ar=(
                "اكتشف بديل السكر الطبيعي، المكون السري لطهاة المعجنات المحترفين. مثالي "
                "لتحسين القوام والحفاظ على نضارة إبداعاتك من الحلويات، فهو يذوب بسهولة "
                "ويضيف حلاوة لا تضاهى. مثالي للكريمات والمربيات والمعجنات وغيرها الكثير."
            ),
        ),
        ingredients=Text(
            en="Fructose, glucose, sucrose.",
            fr="Fructose, glucose, saccharose.",
            ar="الفركتوز، الجلوكوز، السكروز.",
        ),
        shelf_life_months=24,
        sizes=(
            Size(1000, "9.500", 40),
            Size(3000, "25.000", 12),
            Size(5000, "39.000", 12),
            Size(15000, "110.000", 4),
        ),
    ),
    SeedProduct(
        slug="glacage-noisettes-rocher",
        category="glazes",
        name=Text(
            en="Milk & hazelnut crunch glazing paste",
            fr="Pâte à glacer rocher au lait",
            ar="عجينة تغطية بالحليب والبندق",
        ),
        description=GLAZE_DESCRIPTION,
        ingredients=NO_INGREDIENTS,
        shelf_life_months=12,
        sizes=(Size(250, "5.900", 40),),
    ),
    SeedProduct(
        slug="glacage-rocher-blanc",
        category="glazes",
        name=Text(
            en="White chocolate crunch glazing paste",
            fr="Pâte à glacer rocher blanc",
            ar="عجينة تغطية بيضاء بالبندق",
        ),
        description=GLAZE_DESCRIPTION,
        ingredients=NO_INGREDIENTS,
        shelf_life_months=12,
        sizes=(Size(250, "5.900", 40),),
    ),
    SeedProduct(
        slug="glacage-rocher-noir",
        category="glazes",
        name=Text(
            en="Dark chocolate crunch glazing paste",
            fr="Pâte à glacer rocher noir",
            ar="عجينة تغطية سوداء بالبندق",
        ),
        description=GLAZE_DESCRIPTION,
        ingredients=NO_INGREDIENTS,
        shelf_life_months=12,
        sizes=(Size(250, "5.900", 40),),
    ),
    SeedProduct(
        slug="glacage-au-lait",
        category="glazes",
        name=Text(
            en="Milk chocolate glazing paste",
            fr="Pâte à glacer au lait",
            ar="عجينة تغطية بالحليب",
        ),
        description=GLAZE_DESCRIPTION,
        ingredients=NO_INGREDIENTS,
        shelf_life_months=12,
        sizes=(Size(250, "4.900", 40),),
    ),
    SeedProduct(
        slug="glacage-noisettes",
        category="glazes",
        name=Text(
            en="Hazelnut glazing paste",
            fr="Pâte à glacer aux noisettes",
            ar="عجينة تغطية بالبندق",
        ),
        description=GLAZE_DESCRIPTION,
        ingredients=NO_INGREDIENTS,
        shelf_life_months=12,
        sizes=(Size(250, "5.500", 40),),
    ),
    SeedProduct(
        slug="glacage-chocolat-blanc",
        category="glazes",
        name=Text(
            en="White chocolate glazing paste",
            fr="Pâte à glacer chocolat blanc",
            ar="عجينة تغطية بيضاء",
        ),
        description=GLAZE_DESCRIPTION,
        ingredients=NO_INGREDIENTS,
        shelf_life_months=12,
        sizes=(Size(250, "4.900", 40),),
    ),
    SeedProduct(
        slug="glacage-chocolat-noir",
        category="glazes",
        name=Text(
            en="Dark chocolate glazing paste",
            fr="Pâte à glacer chocolat noir",
            ar="عجينة تغطية سوداء",
        ),
        description=GLAZE_DESCRIPTION,
        ingredients=NO_INGREDIENTS,
        shelf_life_months=12,
        sizes=(Size(250, "4.900", 40),),
    ),
)
