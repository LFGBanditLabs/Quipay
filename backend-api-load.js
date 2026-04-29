import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

// Configuration
const BASE_URL = __ENV.K6_BACKEND_URL || "http://localhost:3001";
const AUTH_TOKEN = __ENV.K6_AUTH_TOKEN || "YOUR_ADMIN_OR_EMPLOYER_JWT_TOKEN"; // IMPORTANT: Replace
