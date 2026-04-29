const hooks = require("hooks");
const jwt = require("jsonwebtoken");

// Generate a mock token for contract tests
// In a real CI environment, this should match the JWT_SECRET
const secret = process.env.JWT_SECRET || "dev-secret-key-change-in-production";
const token = jwt.sign({ id: "test-admin", role: 2 }, secret);

hooks.beforeEach((transaction, done) => {
  // Inject Authorization header into every request
  transaction.request.headers["Authorization"] = `Bearer ${token}`;
  done();
});

// Handle specific setup for endpoints if needed (e.g. valid IDs)
hooks.before("/analytics/employers/{address} > GET", (transaction, done) => {
  transaction.fullPath = transaction.fullPath.replace(
    "{address}",
    "GBASE_ADDRESS_HERE",
  );
  done();
});
