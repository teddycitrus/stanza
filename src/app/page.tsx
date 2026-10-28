import { Shell } from "@/components/Shell";
import { Studio } from "@/components/Studio";

export default function Page() {
  return (
    <Shell active="studio">
      <Studio />
    </Shell>
  );
}
