import http from "k6/http";
import { check, sleep } from "k6";

// TrakPlus light load test — run with:
//   k6 run observability/load-test.js
// Capture p95 latency + req/s for the resume/portfolio numbers (todos.md Phase 8).

export const options = {
  stages: [
    { duration: "30s", target: 10 },  // ramp up
    { duration: "1m", target: 25 },   // sustained
    { duration: "30s", target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],   // <1% errors
    http_req_duration: ["p(95)<1000"], // p95 < 1s
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";

export default function () {
  // Public endpoints (no auth) — the bulk of real traffic.
  const search = http.get(`${BASE_URL}/search?q=death+note&type=all`);
  check(search, { "search 200": (r) => r.status === 200 });

  const health = http.get(`${BASE_URL}/health`);
  check(health, { "health 200": (r) => r.status === 200 });

  sleep(0.5);
}
