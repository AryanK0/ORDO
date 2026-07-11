import re

from rapidfuzz import fuzz, process

from app.matching.aliases import AliasStore
from app.matching.catalog import ProductCatalog
from app.models.schemas import MatchSuggestion, Product


def _compact(value: str) -> str:
    return "".join(character for character in value.lower() if character.isalnum())


def _preferred_product_name(text: str) -> str | None:
    compact = _compact(text)
    if "ventoranspray" in compact and "small" in compact:
        return "VENTORAN 2X PAIN SPRAY 35G"
    if "ventoranspray" in compact or "ventaronspray" in compact:
        return "VENTORAN 2X PAIN SPRAY"
    if compact in {"ors"} or "ventolyteors" in compact:
        return "VENTOLYTE ORS (ORANGE)"

    aliases = [
        ("ventorana", "VENTORAN-A TAB"),
        ("dolosidp", "DOLOSAID P TAB"),
        ("dolosaidp", "DOLOSAID P TAB"),
        ("fepadol240", "FEPADOL-250 SUSP. 60ML"),
        ("fepadol250", "FEPADOL-250 SUSP. 60ML"),
        ("apilactinplus", "APILACTIN PLUS SYRUP 200ML"),
        ("aplicationplus", "APILACTIN PLUS SYRUP 200ML"),
        ("applicationplus", "APILACTIN PLUS SYRUP 200ML"),
        ("gasfizraft", "GASFIZ RAFT MINT FLAVOUR 150ml"),
        ("gastrizraft", "GASFIZ RAFT MINT FLAVOUR 150ml"),
        ("gasfizraff", "GASFIZ RAFT MINT FLAVOUR 150ml"),
        ("gasfizpaan", "GASFIZ  SUSPENSION PAAN FLAVOUR"),
        ("gastrizpaan", "GASFIZ  SUSPENSION PAAN FLAVOUR"),
        ("mylabionsyrup", "MYLABION  SYRUP 200ml"),
        ("mulcibionsyrup", "MYLABION  SYRUP 200ml"),
        ("mucibionsyrup", "MYLABION  SYRUP 200ml"),
        ("necadec50", "NECADEC-50 INJ"),
        ("necade50", "NECADEC-50 INJ"),
        ("uririded", "URIRIDE-D CAP"),
        ("cervicided", "URIRIDE-D CAP"),
        ("torsevent10", "TORSEVENT-10 TAB"),
        ("torsavent10", "TORSEVENT-10 TAB"),
        ("becomintal", "BECOMINTA-L DRY SYRUP"),
        ("betominderl", "BECOMINTA-L DRY SYRUP"),
        ("ventocal", "VENTOCAL SUSP. 200ML"),
        ("feriventxt", "FERIVENT-XT SUSP. 150 ML"),
        ("clarilite", "CLARILITE CREAM"),
        ("clavilite", "CLARILITE CREAM"),
        ("tenliventm1000", "TENLIVENT-M 1000 TAB"),
        ("ventimoxcv1000", "VENTIMOX-CV 1.2GM INJ."),
        ("ventimoxcvwfisyp30ml", "VENTIMOX-CV 228.5 DRY SYRUP (WFI)"),
        ("ventimoxcvwfisy", "VENTIMOX-CV 228.5 DRY SYRUP (WFI)"),
        ("telirolam", "TELIROL-AM TAB"),
        ("telironam", "TELIROL-AM TAB"),
        ("cilarol10", "CILAROL-10 TAB"),
        ("cilaral10", "CILAROL-10 TAB"),
        ("histigram", "HISTIGRA-M TAB"),
        ("histigecam", "HISTIGRA-M TAB"),
        ("histigra180", "HISTIGRA-180 TAB"),
        ("histigeca180", "HISTIGRA-180 TAB"),
        ("histigra120", "HISTIGRA-120 TAB"),
        ("histigeca120", "HISTIGRA-120 TAB"),
        ("raniliummps", "RANILIUM-MPS SUSPENSION 170ML"),
        ("ferimintaplus225", "FERIMINTA PLUS SYRUP 225ML"),
        ("spasivent250dt", "SPASMOVENT SUSP. 60ML"),
        ("spasmovent60", "SPASMOVENT SUSP. 60ML"),
        ("ventoceez", "VENTOCEE-Z TAB (20X10)"),
        ("ventoxollsjuniorsyp100ml", "VENTOXOL-LS JUNIOR 100ML"),
        ("ventoxollsjunior100ml", "VENTOXOL-LS JUNIOR 100ML"),
        ("ventoxollsjuniorexp60ml", "VENTOXOL-LS JUNIOR 60ML"),
        ("ventoxollsjunior60ml", "VENTOXOL-LS JUNIOR 60ML"),
        ("rozucard10", "ROZUCARD-10 TAB"),
        ("raniliumd", "RANILIUM-D TAB"),
        ("venzolidsyrup", "VENZOLID DRY SYRUP"),
        ("venzolidsyp", "VENZOLID DRY SYRUP"),
        ("epilevitra500", "EPILEVITRA-500 TAB (20X10)"),
        ("ventokastlctab", "VENTOKAST-LC TAB"),
        ("rozucard20", "ROZUCARD-20 TAB"),
        ("pantoventd", "PANTOVENT-D TAB"),
        ("torigesic90", "TORIGESIC-90 TAB"),
        ("rozucardf", "ROZUCARD-F TAB"),
        ("ventoran100", "VENTORAN-100 SR TAB"),
        ("mylabiond3forte", "MYLABION-D3 FORTE TAB"),
        ("dolosidxt", "DOLOSAID -TP 8 TAB"),
        ("loxaqin500", "LOXAQUIN-500 TAB"),
        ("loxaquin500", "LOXAQUIN-500 TAB"),
        ("chymorideforte", "CHYMORIDE FORTE TAB (10X1X20)"),
        ("acilopoint", "ORAVENT GEL 15GM"),
        ("oraventgel", "ORAVENT GEL 15GM"),
        ("tusstonsupertab", "TUSSTON SUPER-NF TAB (20X10)"),
        ("rejovitalmusli", "REJUVITAL MUSLI-GOLD CAPSULE"),
        ("rijuvitalmusli", "REJUVITAL MUSLI-GOLD CAPSULE"),
        ("rejuvitalmusli", "REJUVITAL MUSLI-GOLD CAPSULE"),
        ("flutigraspary", "FLUTIGRA NASAL SPRAY"),
        ("trizacetcold", "TRIZACET COLD DS RF SUSP. 60ml"),
        ("oftiventrf", "OFTIDERM-RF CREAM 15GM"),
        ("itromrxoc", "ITROMAX OC CREAM 15G"),
        ("dermovent5", "DERMOVENT-5 CREAM 15GM"),
        ("rozogurdgold20", "ROZUCARD-GOLD 20 CAP (10X1X10)"),
        ("citiridep", "CITIRIDE-P TAB"),
        ("candiventvg", "CANDIVENT-VG 30GM"),
        ("zyfix200lb", "ZYFIX 200-LB TAB"),
        ("levotramine10", "LEVOTRAMINE-10 TAB"),
        ("histgra180", "HISTIGRA-180 TAB"),
        ("uriride4", "URIRIDE 0.4 CAP (10X20)"),
        ("torigesicth4", "TORIGESIC-TH4 TAB"),
        ("daophageg2fortr", "DAOPHAGE G2 TAB (10X2X15)"),
        ("phylobron100cap", "PHYLOBRON CAP"),
        ("phylobron100", "PHYLOBRON CAP"),
        ("ranlumspas", "RANILIUM SPAS TAB"),
        ("bisovent5", "BISOVENT-5 TAB 20X10"),
        ("bisovent25", "BISOVENT-2.5 TAB 20X10"),
        ("torsivent10", "TORSEVENT-10 TAB"),
        ("amlomventat", "AMLOVENT AT TAB"),
        ("histarex25", "HISTAREX-25 TAB"),
        ("terbiride500", "TERBIRIDE-500 TAB"),
        ("dapalift10", "DAPALIFT-10 TAB (10X1X10)"),
        ("feriventxt", "FERIVENT-XT SUSP. 150 ML"),
        ("torigesic60", "TORIGESIC-60 TAB"),
        ("coliventdrops", "COLIVENT DROPS 30ML"),
        ("udiventsyp", "UDIVENT ORAL SUSP. 100 ML"),
        ("chocolate", "PROTIMINTA (CHOCOLATE) NEW"),
        ("chocolatepowder", "PROTIMINTA (CHOCOLATE) NEW"),
        ("americannuts", "PROTIMINTA (AMERICAN ICECREAM) NEW"),
        ("americannutspowder", "PROTIMINTA (AMERICAN ICECREAM) NEW"),
    ]
    for key, product_name in aliases:
        if compact == key:
            return product_name
    return None


TOKEN_SYNONYMS = {
    "SUSP": "SYRUP",
    "SUSPENSION": "SYRUP",
    "SYP": "SYRUP",
    "SYRP": "SYRUP",
    "DROPS": "DROP",
    "TABS": "TAB",
    "TABLET": "TAB",
    "CAPSULE": "CAP",
    "RESPULES": "RESPULE",
    "OINT": "OINTMENT",
}

TOKEN_NOISE = {
    "NEW",
    "PACK",
    "FOIL",
    "BLISTER",
    "ALU",
    "STRIP",
    "WFI",
    "BLUE",
    "GREY",
    "WHITE",
    "ROUND",
    "YELLOW",
    "PVC",
    "WITH",
    "MONO",
    "CARTON",
    "BOTTLE",
    "PET",
    "GLASS",
    "HDPE",
}

FORM_TOKENS = {
    "TAB",
    "CAP",
    "SYRUP",
    "INJ",
    "CREAM",
    "OINTMENT",
    "DROP",
    "RESPULE",
    "LOTION",
    "GEL",
    "SACHET",
}


def _tokens(value: str) -> list[str]:
    normalized = value.upper().replace("*", "X").replace("/", " ")
    normalized = re.sub(r"\b(\d+)MG\b", r"\1", normalized)
    normalized = re.sub(r"[^A-Z0-9]+", " ", normalized)
    tokens: list[str] = []
    for token in normalized.split():
        token = TOKEN_SYNONYMS.get(token, token)
        if token in TOKEN_NOISE:
            continue
        if re.fullmatch(r"\d+X\d+(X\d+)?", token):
            continue
        tokens.append(token)
    return tokens


def _normalized(value: str) -> str:
    return " ".join(_tokens(value))


def _candidate_score(text: str, product: Product) -> float:
    query_tokens = _tokens(text)
    label_tokens = _tokens(f"{product.name} {product.pack}")
    query = " ".join(query_tokens)
    label = " ".join(label_tokens)
    if not query or not label:
        return 0

    # Base score using token set and sort ratios
    set_ratio = fuzz.token_set_ratio(query, label)
    sort_ratio = fuzz.token_sort_ratio(query, label)
    score = (set_ratio * 0.6) + (sort_ratio * 0.4)

    # Strongly penalize mismatched form tokens to prevent merging distinct variants
    query_forms = set(query_tokens) & FORM_TOKENS
    label_forms = set(label_tokens) & FORM_TOKENS
    if query_forms and label_forms:
        if not (query_forms & label_forms):
            score -= 30
    elif query_forms and not label_forms:
        score -= 10
    elif label_forms and not query_forms:
        score -= 5

    # Bonus for exact prefix token match
    if query_tokens and label_tokens and query_tokens[0] == label_tokens[0]:
        score += 10
        
    return score


class ProductMatcher:
    def __init__(self, catalog: ProductCatalog, aliases: AliasStore) -> None:
        self.catalog = catalog
        self.aliases = aliases

    def suggest(self, text: str, limit: int = 3) -> list[MatchSuggestion]:
        if not self.catalog.products:
            return []
        normalized = text.strip().lower()
        alias_target = self.aliases.aliases.get(normalized)
        choices = {product.name: product for product in self.catalog.products}
        preferred_target = alias_target or _preferred_product_name(text)
        if preferred_target and preferred_target in choices:
            product = choices[preferred_target]
            alternate_matches = process.extract(
                text,
                choices.keys(),
                scorer=fuzz.WRatio,
                limit=max(limit - 1, 0),
            )
            suggestions = [MatchSuggestion(product=product, score=100, reason="catalog alias")]
            for name, score, _ in alternate_matches:
                if name != preferred_target:
                    suggestions.append(
                        MatchSuggestion(product=choices[name], score=float(score), reason="fuzzy catalog match")
                    )
                if len(suggestions) >= limit:
                    break
            return suggestions
        ranked_products = sorted(
            ((_candidate_score(text, product), product) for product in self.catalog.products),
            key=lambda item: item[0],
            reverse=True,
        )[:limit]
        suggestions: list[MatchSuggestion] = []
        for score, product in ranked_products:
            suggestions.append(
                MatchSuggestion(
                    product=product,
                    score=max(0, min(100, float(score))),
                    reason="catalog detail match",
                )
            )
        return suggestions

    def best(self, text: str) -> tuple[Product | None, float, list[MatchSuggestion]]:
        suggestions = self.suggest(text)
        if not suggestions:
            return None, 0, []
        best = suggestions[0]
        return best.product, best.score, suggestions
