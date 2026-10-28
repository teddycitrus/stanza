// The scripted creator session. The Studio replays it as demo steps; the eval suite gates on it.
export const SCRIPT: { label: string; text: string }[] = [
  {
    label: "Set context and rules",
    text: "Quick context: I work nights, 7pm to 7am, three shifts a week. My Night Shift Strong program launches November 17 and I want 150 buyers. Please stop suggesting morning routine content, it makes no sense for my audience. And no before and after body photos, ever.",
  },
  { label: "Ask for ideas", text: "Give me 5 Instagram post ideas for this week." },
  { label: "Mark one posted", text: "Cool, I already posted the locker snacks one. Give me 5 more ideas." },
  { label: "More ideas", text: "Give me 5 more, different from before." },
  { label: "Again", text: "One more batch of 5 ideas please." },
  { label: "Recall check", text: "Remind me, when does my program launch and what is my buyer goal?" },
  { label: "Draft a caption", text: "Write me an Instagram caption about training through a 4-night stretch." },
];

export const CONSTRAINTS = ["morning routine content (she works nights)", "before and after body photos"];
