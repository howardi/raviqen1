import { test } from "node:test";
import assert from "node:assert/strict";
import { replyFromPlatform } from "../chatReply.js";

test("a greeting gets a usable reply", () => {
  const reply = replyFromPlatform("hello");
  assert.match(reply, /Hello/);
  assert.match(reply, /investigations/i);
  assert.doesNotMatch(reply, /trouble responding/i);
});

test("an investigation question explains the five steps", () => {
  const reply = replyFromPlatform("How do investigations work?");
  assert.match(reply, /Evidence/);
  assert.match(reply, /Decision/);
});
