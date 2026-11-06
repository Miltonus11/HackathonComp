import { ApiStatus } from "@/components/api-status";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-16">
      <h1 className="text-3xl font-semibold">Hackathon Template</h1>
      <ApiStatus />
    </main>
  );
}
