import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <p className="mt-4 text-xl text-gray-600">Page non trouvée</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-md bg-primary-600 px-4 py-2 text-white hover:bg-primary-700"
        >
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
