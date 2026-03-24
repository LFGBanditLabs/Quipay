import { SimpleCache } from "../utils/cache";

describe("SimpleCache", () => {
  let cache: SimpleCache;

  beforeEach(() => {
    cache = new SimpleCache();
  });

  it("should set and get a value", () => {
    cache.set("key", "value", 1000);
    expect(cache.get("key")).toBe("value");
  });

  it("should return null for non-existent key", () => {
    expect(cache.get("missing")).toBeNull();
  });

  it("should expire values after TTL", (done) => {
    cache.set("spy", "data", 10);
    setTimeout(() => {
      expect(cache.get("spy")).toBeNull();
      done();
    }, 20);
  });

  it("should delete values", () => {
    cache.set("key", "value", 1000);
    cache.del("key");
    expect(cache.get("key")).toBeNull();
  });

  it("should invalidate by prefix", () => {
    cache.set("pref:1", "v1", 1000);
    cache.set("pref:2", "v2", 1000);
    cache.set("other:1", "v3", 1000);

    cache.invalidateByPrefix("pref:");

    expect(cache.get("pref:1")).toBeNull();
    expect(cache.get("pref:2")).toBeNull();
    expect(cache.get("other:1")).toBe("v3");
  });

  it("should clear all values", () => {
    cache.set("k1", "v1", 1000);
    cache.set("k2", "v2", 1000);
    cache.clear();
    expect(cache.get("k1")).toBeNull();
    expect(cache.get("k2")).toBeNull();
  });
});
