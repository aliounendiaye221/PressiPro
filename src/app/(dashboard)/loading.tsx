export default function DashboardLoading() {
  return (
    <div className="space-y-6 py-4 animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="skeleton h-7 w-44 rounded-xl" />
          <div className="skeleton h-4 w-64 rounded-lg" />
        </div>
        <div className="skeleton h-10 w-32 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 space-y-3"
          >
            <div className="skeleton h-4 w-24 rounded-md" />
            <div className="skeleton h-7 w-32 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-100 dark:border-slate-800 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
