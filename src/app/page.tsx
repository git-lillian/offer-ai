import Navbar from "@/components/navbar";

export default function Home() {
  return (
    <>
      <Navbar />

      <main className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-slate-50 px-6">
        <section className="max-w-3xl text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-blue-600">
            Offer.ai
          </p>

          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            Build stronger applications with AI guidance
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-600">
            Create personal statements, cover letters and CVs through a guided
            process designed around your experience, goals and target course.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <button className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">
              Start your application
            </button>

            <button className="rounded-lg border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-100">
              Learn more
            </button>
          </div>
        </section>
      </main>
    </>
  );
}