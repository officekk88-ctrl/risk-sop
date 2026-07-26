import assert from "node:assert/strict";
import test from "node:test";
import { beijingGreeting, beijingHour } from "../src/lib/beijing-time";

test("首页问候始终按北京时间计算，不受服务器时区影响", () => {
  assert.equal(beijingHour(new Date("2026-07-22T22:00:00.000Z")), 6);
  assert.equal(beijingGreeting(new Date("2026-07-22T22:00:00.000Z")), "早上好");
  assert.equal(beijingGreeting(new Date("2026-07-22T04:00:00.000Z")), "中午好");
  assert.equal(beijingGreeting(new Date("2026-07-22T07:00:00.000Z")), "下午好");
  assert.equal(beijingGreeting(new Date("2026-07-22T11:00:00.000Z")), "晚上好");
  assert.equal(beijingGreeting(new Date("2026-07-22T18:00:00.000Z")), "夜深了");
});
