import enum


class MediaType(enum.StrEnum):
    MOVIE = "movie"
    TV = "tv"
    GAME = "game"
    ANIME = "anime"
    MANGA = "manga"


class LibraryStatus(enum.StrEnum):
    WATCHING = "watching"
    PLAYING = "playing"
    READING = "reading"
    PLAN_TO = "plan_to"
    COMPLETED = "completed"
    DROPPED = "dropped"
    ON_HOLD = "on_hold"


class OfferType(enum.StrEnum):
    STREAM = "stream"
    RENT = "rent"
    BUY = "buy"


class ExternalSource(enum.StrEnum):
    TMDB = "tmdb"
    RAWG = "rawg"
    ANILIST = "anilist"
    JIKAN = "jikan"
    MAL = "mal"
    MANGADEX = "mangadex"
