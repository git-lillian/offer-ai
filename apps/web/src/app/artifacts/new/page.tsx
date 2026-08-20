import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Navbar } from "@/components/navbar";
import { CreateArtifactForm } from "@/components/artifacts/create-artifact-form";

export const metadata = {
  title: "New document | Offer.ai",
};

export default async function NewArtifactPage() {
  await requireUser();

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-2xl">
          <Link
            href="/artifacts"
            className="text-sm font-semibold text-blue-600 hover:text-blue-700"
          >
            ← Back to Document Studio
          </Link>

          <h1 className="mt-4 text-3xl font-bold text-slate-900">Create a document</h1>
          <p className="mt-2 text-slate-600">
            Choose a type and title. You can link it to an application case later, or leave it
            standalone. Versions are immutable — you&apos;ll add content in the next step.
          </p>

          <CreateArtifactForm />
        </section>
      </main>
    </>
  );
}
