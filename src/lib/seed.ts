// A fictional sample creator. Everything here is demo data, not a real account.

export interface SeedPost {
  id: string;
  date: string;
  platform: "Instagram" | "LinkedIn";
  format: string;
  text: string;
  likes: number;
  comments: number;
  saves: number;
}

export const creator = {
  name: "Maya Okafor",
  handle: "@nightshiftstrong",
  initials: "MO",
  bio: "ICU nurse in Toronto turned strength coach. Helps night-shift nurses get strong in 3 short sessions a week.",
  platforms: ["Instagram", "LinkedIn"],
  storeProduct: { name: "Night Shift Strong", price: 49, currency: "USD", kind: "8-week program on Stan Store" },
};

export const posts: SeedPost[] = [
  {
    id: "p01", date: "2026-08-04", platform: "Instagram", format: "Carousel",
    text: "Night shift math:\n12 hours on your feet.\n0 minutes to train.\n\nExcept that's not true.\nYou have 20 minutes. Twice a week. Before the commute home.\n\nGoblet squat. Push-up. Row.\nThat's the whole thing.\n\nWhich shift are you on this week?",
    likes: 1840, comments: 212, saves: 640,
  },
  {
    id: "p02", date: "2026-08-09", platform: "Instagram", format: "Reel",
    text: "I used to think I was lazy.\nI was just eating dinner at 4am and wondering why I felt like garbage at 2pm.\n\nWe fixed the timing first. Not the food.\n\nNurse friends, when is your 'lunch'?",
    likes: 2310, comments: 344, saves: 410,
  },
  {
    id: "p03", date: "2026-08-15", platform: "LinkedIn", format: "Text",
    text: "Eleven years in the ICU taught me one thing about habits.\n\nNobody follows a plan at 3am. They follow a default.\n\nSo I stopped writing plans for my clients.\nI write defaults.\n\nThe gym bag lives in the car. The protein lives in the locker. The workout is three moves.\n\nWhat's one default you could set up tonight?",
    likes: 960, comments: 88, saves: 0,
  },
  {
    id: "p04", date: "2026-08-21", platform: "Instagram", format: "Carousel",
    text: "Locker meal prep (no microwave required):\n\nGreek yogurt + granola. Wraps. Hard boiled eggs. Edamame.\n\nBoring? Yes.\nStill eating it at 0400 instead of the vending machine? Also yes.\n\nSave this for your next stretch of nights.",
    likes: 3120, comments: 190, saves: 1980,
  },
  {
    id: "p05", date: "2026-08-28", platform: "Instagram", format: "Reel",
    text: "Real talk from bed 14.\nMy patient asked how I stay strong on nights.\nI said I don't. I stay consistent.\n\nStrong shows up later.\n\n(ask me how I know)",
    likes: 1420, comments: 97, saves: 120,
  },
  {
    id: "p06", date: "2026-09-03", platform: "LinkedIn", format: "Text",
    text: "Hospitals spend millions on retention.\n\nHere's a cheaper idea: a squat rack in the staff room.\n\nI'm only half joking. The nurses I coach who train twice a week report fewer sick days and more patience at hour ten.\n\nWould your unit use it?",
    likes: 1210, comments: 143, saves: 0,
  },
  {
    id: "p07", date: "2026-09-10", platform: "Instagram", format: "Carousel",
    text: "Sleep after nights is a skill.\n\nBlackout curtains. Phone in another room. Same wind-down every time, even if it's 9am.\n\nYou can't out-train bad sleep.\nYou can't out-sleep bad timing either.\n\nWhat's wrecking your day sleep right now?",
    likes: 2040, comments: 266, saves: 870,
  },
  {
    id: "p08", date: "2026-09-18", platform: "Instagram", format: "Reel",
    text: "3 moves. 20 minutes. Scrubs on.\n\nSplit squat. Incline push-up. Band row.\n\nYes in the hospital parking garage. No I'm not embarrassed anymore.",
    likes: 2680, comments: 158, saves: 1120,
  },
  {
    id: "p09", date: "2026-09-26", platform: "LinkedIn", format: "Text",
    text: "I left bedside nursing in March.\nI did not leave nurses.\n\nEvery program I build starts with one question: will this survive a run of four nights?\n\nIf the answer is no, it doesn't ship.",
    likes: 1530, comments: 121, saves: 0,
  },
  {
    id: "p10", date: "2026-10-03", platform: "Instagram", format: "Carousel",
    text: "Caffeine cutoff for night shift:\n\nLast coffee 6 hours before you plan to sleep.\nOff at 0700? Done by 0100.\n\nI know. I KNOW.\nTry it for one stretch and tell me how you slept.",
    likes: 1760, comments: 302, saves: 940,
  },
  {
    id: "p11", date: "2026-10-12", platform: "Instagram", format: "Reel",
    text: "Client update: Priya deadlifted her bodyweight.\nShe works three 12s a week and has two kids under five.\n\nShe trained 2x a week for 14 weeks. That's it.\n\nNurse friends, your 'not enough time' is enough.",
    likes: 3480, comments: 410, saves: 760,
  },
  {
    id: "p12", date: "2026-10-20", platform: "LinkedIn", format: "Text",
    text: "Unpopular opinion for nurse managers:\n\nSelf-care workshops don't fix staffing.\nBut 20 minutes of strength work twice a week does make a twelve-hour shift feel like a ten.\n\nBoth things can be true. Which one is your unit investing in?",
    likes: 1105, comments: 176, saves: 0,
  },
];

export function lastPostDate(): string {
  return posts.map((p) => p.date).sort().at(-1)!;
}

export function engagement(p: SeedPost): number {
  return p.likes + p.comments + p.saves;
}

const total = posts.reduce((s, p) => s + engagement(p), 0);
console.assert(total === posts.reduce((s, p) => s + p.likes + p.comments + p.saves, 0), "engagement totals reconcile");
