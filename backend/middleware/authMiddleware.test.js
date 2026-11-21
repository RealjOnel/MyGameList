import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/user.js";
import { getOptionalUserId } from "./authMiddleware.js";

test("optional authentication rejects revoked access tokens", async (t) => {
  const previousSecret = process.env.JWT_SECRET;
  const previousFindById = User.findById;
  const userId = new mongoose.Types.ObjectId().toString();
  let storedTokenVersion = 4;
  let lookupCount = 0;

  process.env.JWT_SECRET = "test-secret-long-enough-for-jwt-signing";
  User.findById = (id) => {
    lookupCount += 1;
    return {
      select: async () => ({ _id: id, tokenVersion: storedTokenVersion })
    };
  };

  t.after(() => {
    User.findById = previousFindById;
    if (previousSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = previousSecret;
    }
  });

  const token = jwt.sign(
    { id: userId, tokenVersion: storedTokenVersion },
    process.env.JWT_SECRET
  );
  const request = (authorization) => ({ headers: { authorization } });

  assert.equal(await getOptionalUserId(request(`Bearer ${token}`)), userId);

  storedTokenVersion += 1;
  assert.equal(await getOptionalUserId(request(`Bearer ${token}`)), null);
  assert.equal(await getOptionalUserId(request("Bearer invalid")), null);
  assert.equal(await getOptionalUserId(request(undefined)), null);
  assert.equal(lookupCount, 2);
});
