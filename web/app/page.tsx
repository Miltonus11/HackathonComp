import { ApiStatus } from "@/components/api-status";
import { Brand } from "@/components/brand";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-16">
      <h1 className="sr-only">EunoiApp</h1>
      <Brand tagline="Mental health screening and support for the City of San Fernando" />
      <ApiStatus />
    </main>
  );
}
