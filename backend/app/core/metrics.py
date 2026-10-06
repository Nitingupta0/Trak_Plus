"""Application-level Prometheus metrics (in addition to the instrumentor's
request metrics exposed at /metrics)."""

from prometheus_client import Counter

# External API call volume per source — the key metric for watching
# rate-limit headroom (RAWG 20k/mo, Jikan ~3 req/s, etc.).
external_api_calls = Counter(
    "trakplus_external_api_calls_total",
    "Outbound external API requests by source",
    ["source"],
)
