import Link from "next/link";
import { creator, lastPostDate, posts } from "@/lib/seed";
import { CHAT_MODEL } from "@/lib/llm";
import { PROMPT_VERSION } from "@/lib/agent";

function Mark() {
  // A speech bubble whose tail loops back into itself: a coach that remembers.
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <rect x="2" y="3" width="24" height="18" rx="6" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.5" />
      <path d="M9 21v4.5l4.5-4.5" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 12a3 3 0 1 1 3 3h4a3 3 0 1 0-3-3" fill="none" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const icons = {
  studio: <path d="M3 5h10M3 8h7M3 11h5" />,
  evals: <path d="M3 13V8M7 13V4M11 13V9M14 13H2" />,
};

export function Shell({ active, children }: { active: "studio" | "evals"; children: React.ReactNode }) {
  const nav = [
    { id: "studio" as const, href: "/", label: "Studio" },
    { id: "evals" as const, href: "/evals", label: "Evals" },
  ];
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="workspace">
          <Mark />
          <div>
            <b>Stanley Memory</b>
            <span>Prototype for Stan</span>
          </div>
        </div>
        <div className="nav-label">Workspace</div>
        <nav className="nav">
          {nav.map((n) => (
            <Link key={n.id} href={n.href} aria-current={active === n.id ? "page" : undefined}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                {icons[n.id]}
              </svg>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>
            Prompt <code>{PROMPT_VERSION}</code>
          </span>
          <span>
            Model <code>{CHAT_MODEL}</code>
          </span>
          <span>
            {posts.length} posts synced, last {new Date(`${lastPostDate()}T12:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
          </span>
          <div className="creator-row">
            <span className="avatar">{creator.initials}</span>
            <div>
              <div style={{ color: "var(--text)", fontWeight: 500 }}>{creator.name}</div>
              <div>{creator.handle} (sample)</div>
            </div>
          </div>
        </div>
      </aside>
      <main className="canvas">{children}</main>
    </div>
  );
}
