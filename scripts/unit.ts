// Offline checks (no API key needed): slop detector, stylometrics and the novelty guard thresholds.
import assert from "node:assert/strict";
import { guard } from "../src/lib/novelty";
import { posts } from "../src/lib/seed";
import { emptyState } from "../src/lib/store";
import { scoreDraft, slopFlags, stylometric } from "../src/lib/voice";

const slop = "In today's fast-paced world, it's not just about lifting \u2014 it's about unlocking your potential. Let's dive in! \u2728 #nurselife";
const rules = slopFlags(slop).map((f) => f.rule);
for (const r of ["in today's world", "em dash", "unlock", "let's dive in", "emoji", "hashtag"]) assert.ok(rules.includes(r), `flags ${r}`);
assert.equal(slopFlags(posts[0].text).length, 0, "her own post has no slop flags");

const own = posts.map((p) => stylometric(p.text).score);
const ownMean = own.reduce((a, b) => a + b, 0) / own.length;
const corporate = stylometric(
  "As healthcare professionals, we often find ourselves navigating demanding schedules that leave little room for personal wellness, which is why establishing a sustainable fitness routine that accommodates rotating shifts is an investment in long-term resilience and professional performance across every dimension of our lives.",
).score;
console.log(`stylometric: her posts avg ${ownMean.toFixed(0)}, corporate paragraph ${corporate}`);
assert.ok(ownMean - corporate >= 25, "her posts score well above a corporate paragraph");

const s = emptyState();
s.memories.push({ id: "m1", kind: "avoid", text: "Morning routine content, she works nights", evidence: "", sourceMessageId: "x", createdAt: "", updatedAt: "" });
const idea = (title: string, hook: string) => ({ id: title, title, hook, format: "Reel" });

const first = await guard(s, [
  idea("Locker snacks with no microwave", "What I actually eat at 4am on shift"),
  idea("My 5am wake-up routine", "How I start every morning before work"),
  idea("Asking for a raise as a nurse", "The script I used with my manager"),
]);
console.log("round 1 kept:", first.kept.map((i) => i.title), "held:", first.held.map((h) => `${h.title} (${h.matchedSource} ${h.similarity})`));
assert.ok(first.held.some((h) => h.title.startsWith("Locker") && h.matchedSource === "posted"), "repeat of a published post is held");
assert.ok(first.held.some((h) => h.title.startsWith("My 5am") && h.matchedSource === "avoid"), "avoided topic is held");
assert.ok(first.kept.some((i) => i.title.startsWith("Asking for a raise")), "a new idea is kept");

const second = await guard(s, [
  idea("Negotiating a raise as an RN", "The exact words I used with my unit manager"),
  idea("Grip strength for patient transfers", "Two exercises that make lifting patients easier"),
]);
console.log("round 2 kept:", second.kept.map((i) => i.title), "held:", second.held.map((h) => `${h.title} (${h.matchedSource} ${h.similarity})`));
assert.ok(second.held.some((h) => h.title.startsWith("Negotiating")), "paraphrase of an earlier suggestion is held");
assert.ok(second.kept.some((i) => i.title.startsWith("Grip")), "a related but new idea is kept");

const r = await scoreDraft(slop, { useJudge: false });
assert.ok(r.score < 50, `slop draft scores low (${r.score})`);
console.log("all unit checks passed");
